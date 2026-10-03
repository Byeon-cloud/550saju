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
 *   - 등록 uid 상한 → 어뷰징/폭주 방어. 이관 내역은 문서에 감사 로그.
 *   - (2026-09-27) 24h 쿨다운 폐지 — 연속 회전 피해의 직접 원인이었다. 복사·skip 이라 멱등.
 *   - (2026-09-27) 토스 익명키(anonKeys/{sha256}) 등록부 추가 — 기기 변경에도 같은 사람을 잇는다.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

const db = admin.firestore();

/** 한 번의 이관에서 복사할 리포트 상한 (조혜미 47건 대비 여유) */
const MIGRATE_LIMIT = 300;
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

    // 🌉 보상 이력 다리 (2026-08-13) — 과거 CS 보상 유저는 여권 배포 전 회전이라 devices 등록이 없다.
    //   compensations/{deviceId}.claimedByUid 는 어드민이 확정한 '이 기기의 옛 uid' → 신뢰도 높은
    //   donor 후보 (self-report 인 devices/ 보다 안전 — 어드민만 write). 이걸 후보에 더해
    //   결제 안 한 과거 피해자도 다음 부팅에 자동 복구되게 한다.
    let compDonor: string | null = null;
    try {
      const comp = await db.doc(`compensations/${deviceId}`).get();
      const cuid = comp.exists ? (comp.data()?.claimedByUid as string | undefined) : undefined;
      if (cuid && cuid !== uid && !known.includes(cuid)) compDonor = cuid;
    } catch { /* noop */ }

    // ── 0) 토스 익명키 등록부 (2026-09-27) — User.getAnonymousKey() 는 '미니앱 × 토스 계정' 고유 해시라
    //   기기를 바꾸거나 deviceId 가 달라져도 같은 사람을 잇는다. deviceId 와 같은 신뢰 수준(클라 제공값)으로 취급.
    //   문서 id 는 원문 대신 sha256 (해시에 '/' 등이 있어도 안전, 원문 노출 최소화).
    const rawAnon = String(request.data?.anonKey || '').trim();
    const anonKey = /^[A-Za-z0-9_\-+=/.]{8,256}$/.test(rawAnon) ? rawAnon : '';
    const anonRef = anonKey ? db.doc(`anonKeys/${createHash('sha256').update(anonKey).digest('hex')}`) : null;
    let anonUids: string[] = [];
    if (anonRef) {
      try {
        const a = await anonRef.get();
        const m: Record<string, admin.firestore.Timestamp | null> = a.exists ? ((a.data() as any)?.uids || {}) : {};
        anonUids = Object.entries(m)
          .filter(([k]) => k !== uid)
          .sort((x, y) => (y[1]?.toMillis?.() ?? 0) - (x[1]?.toMillis?.() ?? 0))
          .map(([k]) => k);
      } catch { /* noop */ }
    }

    // ── 1) 이관 판정
    //   🚨 2026-09-27 재설계 — 실측 피해(9/26 CS): 저장소가 비면 익명 로그인이 연달아 2번 일어나 uid 가
    //   몇 초~몇 분 간격으로 두 번 바뀐다. 구 로직은 ① 첫 uid 로 이관 후 ② '24h 쿨다운' 때문에 두 번째(실제로
    //   쓰이는) uid 이관을 막았고 ③ 한 번 등록된 uid 는 다시 보지 않아, 복구가 영구히 빗나갔다(4기기).
    //   → 쿨다운 폐지 + 형제 uid 전부를 기증자로 + 이미 등록된 uid 라도 '빠진 리포트'가 있으면 채운다.
    //   이관은 복사·있는 문서 skip 이라 몇 번을 돌아도 멱등 — 쿨다운 없이도 폭주·중복이 생기지 않는다.
    let migratedReports = 0;
    let fromUid: string | null = null;
    let rotated = false;      // 새 uid 가 이 기기/계정에서 처음 보임 (리포트 0건이어도 true — 잔액 seed 트리거)
    let mirrorReady = false;  // 이 uid 에 잔액 미러가 존재 (seed 재료 있음)
    let profilesRestored = 0; // 사주원국 미러로 합쳐진 인물 수
    let migratedChats = 0;    // 사주대화 백업 이관 수 (2026-10-04)

    // 기증자 = 이 기기 등록 uid(최근순) ∪ 익명키 등록 uid ∪ 보상이력 uid — 현재 uid 제외, 상한 적용
    const donors = Array.from(new Set([
      ...known.filter((k) => k !== uid)
        .sort((a, b) => (uids[b]?.toMillis?.() ?? 0) - (uids[a]?.toMillis?.() ?? 0)),
      ...anonUids,
      ...(compDonor ? [compDonor] : []),
    ])).slice(0, MAX_UIDS_PER_DEVICE);

    // 잔액은 '같은 기기'에서 이어지는 계정(기기 등록 uid·보상이력 uid)에게서만 받는다 — 익명키로만 이어진
    //   다른 기기의 잔액을 복사하면 두 기기에서 같은 운을 쓰게 된다(복제). 리포트·인물은 공유해도 무해.
    const deviceDonors = donors.filter((d) => known.includes(d) || d === compDonor);
    if (donors.length > 0 && known.length < MAX_UIDS_PER_DEVICE) {
      if (!alreadyRegistered && deviceDonors.length > 0) rotated = true;
      try {
        // 현재 uid 의 문서 id — listDocuments 는 본문을 읽지 않아 저렴
        const destIds = new Set((await db.collection(`users/${uid}/reports`).listDocuments()).map((r) => r.id));
        // 삭제 장부 (2026-10-03) — 유저가 지운 결과(id·지문)는 어느 계정에서든 다시 복사하지 않는다
        const deletedIds = new Set<string>();
        const deletedFps = new Set<string>();
        for (const u of [uid, ...donors]) {
          try {
            const dl = await db.doc(`users/${u}/state/deleted`).get();
            const dd = dl.exists ? (dl.data() as any) : null;
            (Array.isArray(dd?.reportIds) ? dd.reportIds : []).forEach((x: any) => typeof x === 'string' && deletedIds.add(x));
            (Array.isArray(dd?.fingerprints) ? dd.fingerprints : []).forEach((x: any) => typeof x === 'string' && deletedFps.add(x));
          } catch { /* noop */ }
        }
        const fpOfDoc = (d: any): string => {
          const iso = typeof d?.createdAt === 'string' ? d.createdAt : (d?.createdAt ? new Date(d.createdAt).toISOString() : '');
          const len = d?.aiResultJson ? String(d.aiResultJson).length : 0;
          return `${d?.contentType ?? 'report'}@${String(iso).slice(0, 16)}@${Math.round(len / 800)}`;
        };
        let batch = db.batch();
        let pending = 0;
        for (const donor of donors) {
          if (migratedReports >= MIGRATE_LIMIT) break;
          const refs = await db.collection(`users/${donor}/reports`).listDocuments();
          const missing = refs.filter((r) => !destIds.has(r.id) && !deletedIds.has(r.id)).slice(0, MIGRATE_LIMIT - migratedReports);
          if (missing.length === 0) continue;
          const snaps = await db.getAll(...missing);
          let fromThis = 0;
          for (const d of snaps) {
            if (!d.exists || destIds.has(d.id)) continue;
            if (deletedFps.has(fpOfDoc(d.data()))) continue; // 지운 결과의 쌍둥이 사본
            batch.set(db.doc(`users/${uid}/reports/${d.id}`), {
              ...d.data(),
              migratedFromUid: donor,
              migratedVia: 'device-passport',
              migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            destIds.add(d.id); // 형제끼리 같은 리포트(이전 이관 사본)는 한 번만
            migratedReports++; fromThis++; pending++;
            if (pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
          }
          if (fromThis > 0 && !fromUid) fromUid = donor;
        }
        if (pending > 0) await batch.commit();
        if (migratedReports > 0) {
          console.log(`[devicePassport] 자동 이관 → ${uid} · 리포트 ${migratedReports}건 · 기증자 ${donors.length} (${alreadyRegistered ? '누락 보충' : '회전'} · device=${deviceId.slice(0, 12)}…)`);
        }
      } catch (e: any) {
        // 리포트 이관 실패해도 잔액 미러는 아래에서 별도로 시도 (0건 유저 잔액 복원 P0)
        console.warn(`[devicePassport] 리포트 이관 실패 device=${deviceId.slice(0, 12)}…: ${e?.message || e}`);
      }

      // 사주대화 백업 (2026-10-04) — 형제 계정의 대화방 중 이 계정에 없는 것만 복사 (삭제 장부 존중)
      try {
        const destChatIds = new Set((await db.collection(`users/${uid}/chats`).listDocuments()).map((r) => r.id));
        const deletedChats = new Set<string>();
        for (const u of [uid, ...donors]) {
          try {
            const dl = await db.doc(`users/${u}/state/deleted`).get();
            const ids = dl.exists ? (dl.data() as any)?.chatIds : null;
            if (Array.isArray(ids)) ids.forEach((x: any) => typeof x === 'string' && deletedChats.add(x));
          } catch { /* noop */ }
        }
        let batch = db.batch();
        let pending = 0;
        for (const donor of donors) {
          const refs = (await db.collection(`users/${donor}/chats`).listDocuments())
            .filter((r) => !destChatIds.has(r.id) && !deletedChats.has(r.id))
            .slice(0, 100);
          if (refs.length === 0) continue;
          for (const d of await db.getAll(...refs)) {
            if (!d.exists || destChatIds.has(d.id)) continue;
            batch.set(db.doc(`users/${uid}/chats/${d.id}`), { ...d.data(), migratedFromUid: donor });
            destChatIds.add(d.id); migratedChats++; pending++;
            if (pending >= 50) { await batch.commit(); batch = db.batch(); pending = 0; } // 대화 문서는 클 수 있어 작게 커밋
          }
        }
        if (pending > 0) await batch.commit();
      } catch { /* 대화 이관 실패는 무해 — 다음 부팅 재시도 */ }

      // 잔액 미러 — 리포트 유무와 독립. 기기 기증자 중 미러가 있는 가장 최근 uid 에서 1회.
      //   🚨 2026-10-03 경합 fix: 저장소가 빈 부팅에서 앱 첫 화면이 기본 잔액(1운)을 먼저 서버에 올려,
      //   dest 가 '있다'고 판단해 옛 잔액 복사를 건너뛰고 클라는 자기 기본값을 seed 했다(운 소실 그대로).
      //   → dest 가 기본값 수준(paid≤1·bonus 0·reward≤0.1)이고 이관 표식이 없으면 기증자 미러로 덮는다.
      try {
        const dest = await db.doc(`users/${uid}/state/balance`).get();
        const dd = dest.exists ? (dest.data() as any) : null;
        const destIsDefault = !!dd && !dd.migratedFromUid
          && (Number(dd.paid) || 0) <= 1 && (Number(dd.bonus) || 0) <= 0 && (Number(dd.reward) || 0) <= 0.1;
        if (dest.exists && !destIsDefault) {
          mirrorReady = !!dd?.migratedFromUid;
        } else if (!alreadyRegistered || !dest.exists) {
          for (const donor of deviceDonors) {
            const mirror = await db.doc(`users/${donor}/state/balance`).get();
            if (!mirror.exists) continue;
            const md = mirror.data() as any;
            const total = (Number(md?.paid) || 0) + (Number(md?.bonus) || 0) + (Number(md?.reward) || 0);
            if (dest.exists && total <= 1.1) break; // 기증자도 기본값 — 덮을 이유 없음
            await db.doc(`users/${uid}/state/balance`).set({
              ...md,
              migratedFromUid: donor,
              migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            mirrorReady = true;
            if (!fromUid) fromUid = donor;
            break;
          }
        }
      } catch { /* 미러 이관 실패는 무해 — 클라가 rotated 로 재시도 */ }

      // 사주원국 미러 (2026-09-27) — 기증자 목록을 현재 uid 목록에 합친다 (이름+생년월일 기준, 추가만)
      //   2026-10-03: 계정 첫 등장(회전) 또는 이 계정 미러가 아직 없을 때만 — 이미 쓰던 계정에서 매번 합치면
      //   유저가 지운 인물이 형제 미러에서 계속 되살아난다.
      try {
        const destRef = db.doc(`users/${uid}/state/profiles`);
        const destSnap = await destRef.get();
        if (alreadyRegistered && destSnap.exists) throw new Error('skip-merge');
        const items: any[] = destSnap.exists && Array.isArray((destSnap.data() as any)?.items) ? [...(destSnap.data() as any).items] : [];
        const pkey = (p: any) => `${p?.name}_${p?.input?.birthYear}_${p?.input?.birthMonth}_${p?.input?.birthDay}`;
        const keys = new Set(items.map(pkey));
        // 이 계정에서 지운 인물은 다른 계정 목록에서 되살리지 않는다 (2026-10-03)
        (Array.isArray((destSnap.data() as any)?.deletedKeys) ? (destSnap.data() as any).deletedKeys : []).forEach((k: any) => keys.add(String(k)));
        for (const donor of donors) {
          const m = await db.doc(`users/${donor}/state/profiles`).get();
          const arr: any[] = m.exists && Array.isArray((m.data() as any)?.items) ? (m.data() as any).items : [];
          for (const p of arr) {
            if (!p?.name || !p?.input?.birthYear) continue;
            const k = pkey(p);
            if (keys.has(k)) continue;
            keys.add(k); items.push(p); profilesRestored++;
          }
        }
        // 상한 100 — 잘려 나간 건 '복원'으로 세지 않는다 (매 호출 무의미한 쓰기·pull 방지)
        const destBase = destSnap.exists && Array.isArray((destSnap.data() as any)?.items) ? (destSnap.data() as any).items.length : 0;
        profilesRestored = Math.max(0, Math.min(items.length, 100) - destBase);
        if (profilesRestored > 0) {
          await destRef.set({
            items: items.slice(0, 100),
            count: Math.min(items.length, 100),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedProfilesAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
      } catch { /* 무해 — 리포트 복원 경로가 인물도 함께 복원한다 */ }
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
    if (fromUid && (migratedReports > 0 || rotated)) {
      update.lastMigratedAt = admin.firestore.FieldValue.serverTimestamp();
      // 감사 로그 — 최근 20건만 유지
      const log: any[] = Array.isArray(data.migrationLog) ? data.migrationLog.slice(-19) : [];
      log.push({ from: fromUid, to: uid, reports: migratedReports, at: new Date().toISOString(), heal: alreadyRegistered });
      update.migrationLog = log;
    }
    await ref.set(update, { merge: true });
    if (anonRef) {
      try {
        await anonRef.set({
          uids: { [uid]: admin.firestore.FieldValue.serverTimestamp() },
          devices: { [deviceId.slice(0, 64)]: admin.firestore.FieldValue.serverTimestamp() },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch { /* 등록 실패는 무해 — 다음 부팅 재시도 */ }
    }

    return { registered: true, migratedReports, rotated, mirrorReady, profilesRestored, migratedChats };
  },
);
