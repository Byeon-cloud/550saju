/**
 * registerDevicePassport — 기기 여권: deviceId→uid 등록부 + uid 회전 시 보관함 자동 이관
 *   (2026-08-13 신설 · CS "운·보관함 전부 초기화" 3건 재발 대응 — 개별 수동 복구 탈피)
 *
 * 배경: 익명 uid 는 웹뷰 IndexedDB 에 묶여, 토스 웹뷰가 저장소를 비우면(재설치·iOS 미방문 정리·
 *   OS 정리) 새 uid 가 발급되고 옛 uid 를 잇는 연결고리가 아무것도 남지 않는다. 그래서 지금까지는
 *   CS 가 올 때마다 결제 이력·이름으로 수동 추적했다 (조혜미 케이스 등).
 *
 * 해법: 토스 SDK `getDeviceId()` 는 **기기 영속** — 저장소가 비워져도 그대로다. 매 부팅마다
 *   `devices/{deviceId}.uids` 에 현재 uid 를 등록해두면, 회전 직후 첫 부팅에서 서버가
 *   "이 기기의 직전 uid" 를 즉시 알 수 있다 → 보관함을 자동 이관한다. 결제 여부와 무관하게 전 유저 커버.
 *
 * 신뢰 모델: deviceId 는 토스가 기기별 발급하는 고엔트로피 값 — claimCompensation(운 지급)이
 *   이미 같은 값을 지급 키로 신뢰한다. 동일 신뢰 수준으로 취급하되 아래 가드를 더한다.
 *
 * 안전 설계:
 *   - 이관은 **복사**(원본 보존) + 있는 문서는 건너뜀 → 멱등, 파괴 0.
 *   - 보관함(reports)만. 결제(payments)는 복사하지 않는다 — 잔액 복원은 recoverIapOrders 가
 *     결제 이력 검증으로 담당하며, payments 를 미리 복사하면 그쪽 지급 판정이 skip 돼 버린다.
 *   - 기증자(donor)는 '이 기기에서 등록된 적 있는 uid' 로 한정 — 임의 uid 보관함 탈취 불가.
 *   - 기기당 24h 이관 1회 + 등록 uid 상한 → 어뷰징/폭주 방어. 이관 내역은 문서에 감사 로그.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/** 한 번의 이관에서 복사할 리포트 상한 (조혜미 47건 대비 여유) */
const MIGRATE_LIMIT = 300;
/** 같은 기기의 이관 최소 간격(ms) — 회전이 하루 두 번 일어날 일은 없다 */
const MIGRATE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** 기기당 등록 uid 상한 — 초과는 비정상 기기로 보고 등록만 받고 이관은 중단 */
const MAX_UIDS_PER_DEVICE = 12;

export const registerDevicePassport = onCall(
  { timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다');

    const deviceId = String(request.data?.deviceId || '').trim().toLowerCase();
    // claimCompensation 과 동일 형식 검증 (토스 deviceId = hex)
    if (!/^[0-9a-f]{32,128}$/.test(deviceId)) {
      throw new HttpsError('invalid-argument', '유효하지 않은 deviceId');
    }

    const ref = db.doc(`devices/${deviceId}`);
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() as Record<string, any>) : {};
    const uids: Record<string, admin.firestore.Timestamp | null> = data.uids || {};
    const known = Object.keys(uids);
    const alreadyRegistered = known.includes(uid);

    // ── 1) 이관 판정 — 이 uid 가 이 기기에서 처음 보이는데, 직전 uid 가 등록돼 있으면 회전으로 간주
    let migratedReports = 0;
    let fromUid: string | null = null;
    let rotated = false;      // 회전 감지 (리포트 0건이어도 true — 잔액 seed 트리거)
    let mirrorReady = false;  // 이 uid 에 잔액 미러가 존재 (seed 재료 있음)

    const lastMigratedAt: admin.firestore.Timestamp | undefined = data.lastMigratedAt;
    const cooledDown = !lastMigratedAt || (Date.now() - lastMigratedAt.toMillis()) > MIGRATE_COOLDOWN_MS;

    if (!alreadyRegistered && known.length > 0 && known.length < MAX_UIDS_PER_DEVICE && cooledDown) {
      // 기증자 = 이 기기에서 가장 최근에 활동한 다른 uid
      const donor = known
        .filter((k) => k !== uid)
        .sort((a, b) => (uids[b]?.toMillis?.() ?? 0) - (uids[a]?.toMillis?.() ?? 0))[0];

      if (donor) {
        rotated = true; // 같은 기기에 직전 uid 존재 = 회전 (리포트 유무와 무관)
        try {
          const donorReports = await db.collection(`users/${donor}/reports`).limit(MIGRATE_LIMIT).get();
          if (!donorReports.empty) {
            let batch = db.batch();
            let pending = 0;
            for (const d of donorReports.docs) {
              const destRef = db.doc(`users/${uid}/reports/${d.id}`);
              const dest = await destRef.get();
              if (dest.exists) continue; // 있는 건 절대 덮지 않음 (멱등)
              batch.set(destRef, {
                ...d.data(),
                migratedFromUid: donor,
                migratedVia: 'device-passport',
                migratedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              migratedReports++;
              pending++;
              if (pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
            }
            if (pending > 0) await batch.commit();
            fromUid = donor;
            console.log(`[devicePassport] 자동 이관 ${donor} → ${uid} · 리포트 ${migratedReports}건 (device=${deviceId.slice(0, 12)}…)`);
          }
        } catch (e: any) {
          // 리포트 이관 실패해도 잔액 미러는 아래에서 별도로 시도 (0건 유저 잔액 복원 P0)
          console.warn(`[devicePassport] 리포트 이관 실패 device=${deviceId.slice(0, 12)}…: ${e?.message || e}`);
        }

        // 잔액 미러 이관 — 🚨 리포트 유무와 독립 (리포트 0건·무료 위주 유저도 잔액 복원돼야 함, P0 fix).
        //   클라가 '키 부재' 일 때 1회 seed 하는 재료. 멱등: dest 없을 때만.
        try {
          const mirror = await db.doc(`users/${donor}/state/balance`).get();
          const dest = await db.doc(`users/${uid}/state/balance`).get();
          if (dest.exists) {
            mirrorReady = true;
          } else if (mirror.exists) {
            await db.doc(`users/${uid}/state/balance`).set({
              ...mirror.data(),
              migratedFromUid: donor,
              migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            mirrorReady = true;
          }
        } catch { /* 미러 이관 실패는 무해 — 클라가 rotated 로 재시도 */ }
      }
    } else if (alreadyRegistered) {
      // 재부팅(같은 uid) — 이미 이관돼 온 잔액 미러가 있으면 seed 재시도 재료로 알린다 (네트워크 실패 복구).
      try {
        const dest = await db.doc(`users/${uid}/state/balance`).get();
        if (dest.exists && (dest.data() as any)?.migratedFromUid) mirrorReady = true;
      } catch { /* noop */ }
    }

    // ── 2) 등록 — uids 맵 deep-merge (기존 uid 기록 보존)
    const update: Record<string, any> = {
      uids: { [uid]: admin.firestore.FieldValue.serverTimestamp() },
      lastUid: uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (rotated && fromUid) {
      update.lastMigratedAt = admin.firestore.FieldValue.serverTimestamp();
      // 감사 로그 — 최근 20건만 유지
      const log: any[] = Array.isArray(data.migrationLog) ? data.migrationLog.slice(-19) : [];
      log.push({ from: fromUid, to: uid, reports: migratedReports, at: new Date().toISOString() });
      update.migrationLog = log;
    }
    await ref.set(update, { merge: true });

    return { registered: true, migratedReports, rotated, mirrorReady };
  },
);
