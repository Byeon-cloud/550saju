/**
 * adminGrantCompensation — 어드민 CS 운 지급 (2026-06-12)
 *
 * 배경: 보상 장부(compensations)를 매번 개발자가 CLI 로 심어야 했음.
 *   → 어드민 'CS 지급' 탭에서 준기가 디바이스 ID + 운 수량 입력 → 즉시 장부 기록.
 *   수령은 기존 claimCompensation 파이프 그대로 (고객이 앱 열면 자동 적립). 배포 0.
 *
 * 2026-10-19 개편:
 *   - 오너 판정은 ./owner 하나로(예전엔 여기 목록을 따로 들고 있었다).
 *   - 토스 로그인 회원 ID(toss_숫자, 20자 미만)가 형식 검사에 걸려 지급이 막히던 것 → 회원 ID 6~128자 허용.
 *   - 지급 사유(reason)를 고른다: pay_missing(결제했는데 운이 안 들어옴), ai_fail(풀이 실패), lost_restored(기록 유실, 복구됨),
 *     lost_unrestored(기록 유실, 복구 안 됨), apology(불편 사과), other.
 *   - 지급할 때마다 compensationLog 에 한 줄씩 남긴다(장부 문서는 누적되며 덮어써져 이력이 사라졌다). action 'history' 로 본다.
 *   - 웹 회원도 받는다: 웹은 App.tsx 가 부팅 때 회원 ID 로 claimCompensation 을 부른다(10-19 전엔 앱만 불렀다).
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertOwner } from './owner';

const TOPIC_KEYS = ['love', 'reunion', 'marriage', 'wealth', 'exam', 'business', 'health', 'move', 'study', 'career'];
const REASONS = ['pay_missing', 'ai_fail', 'lost_restored', 'lost_unrestored', 'apology', 'other'];
const REASON_LABEL: Record<string, string> = {
  pay_missing: '결제 누락', ai_fail: '풀이 실패', lost_restored: '기록 유실(복구됨)', lost_unrestored: '기록 유실(복구 안 됨)', apology: '불편 사과', other: 'CS 보상',
};

export const adminGrantCompensation = onCall(
  { timeoutSeconds: 15, memory: '256MiB', cors: true },
  async (request) => {
    const uid = assertOwner(request);

    const action = String(request.data?.action || 'grant');
    // 디바이스 ID(hex 32~128, 토스 앱) 또는 회원 ID(Firebase uid, 토스 로그인 toss_숫자 포함). 회원 ID 는 대소문자를 지킨다.
    const rawTarget = String(request.data?.deviceId || request.data?.target || '').trim();
    const isHexDevice = /^[0-9a-f]{32,128}$/.test(rawTarget.toLowerCase());
    const isUid = !isHexDevice && /^[A-Za-z0-9_-]{6,128}$/.test(rawTarget);
    if (!isHexDevice && !isUid) {
      throw new HttpsError('invalid-argument', '디바이스 ID(hex 32~128) 또는 회원 ID 형식이 아니에요');
    }
    const targetId = isHexDevice ? rawTarget.toLowerCase() : rawTarget;
    const db = admin.firestore();
    const ref = db.collection('compensations').doc(targetId);

    // 상태 조회 — 지급 전 확인 / 수령 여부 추적
    if (action === 'status' || action === 'history') {
      const [snap, logs] = await Promise.all([
        ref.get(),
        action === 'history' ? db.collection('compensationLog').where('target', '==', targetId).limit(50).get().catch(() => null) : Promise.resolve(null),
      ]);
      const d = snap.exists ? (snap.data() as any) : null;
      return {
        exists: !!d,
        amount: d?.amount ?? 0,
        claimed: !!d?.claimed,
        note: d?.note ?? '',
        reason: d?.reason ?? '',
        wipeTopics: d?.wipeTopics ?? [],
        claimedAt: d?.claimedAt?.toDate?.()?.toISOString?.() ?? null,
        createdAt: d?.createdAt?.toDate?.()?.toISOString?.() ?? null,
        log: (logs?.docs || []).map((x) => {
          const l = x.data() as any;
          return { at: l.at?.toDate?.()?.toISOString?.() ?? null, amount: l.amount, reason: l.reason, note: l.note };
        }).sort((a, b) => String(b.at).localeCompare(String(a.at))),
      };
    }

    // 지급 — 미수령 장부가 있으면 누적, 수령됐거나 없으면 새 장부
    const amount = Math.max(1, Math.min(100, Math.round(Number(request.data?.amount) || 0)));
    const reason = REASONS.includes(String(request.data?.reason)) ? String(request.data.reason) : 'other';
    const note = String(request.data?.note || '').slice(0, 200) || REASON_LABEL[reason];
    const wipeTopics = (Array.isArray(request.data?.wipeTopics) ? request.data.wipeTopics : [])
      .filter((t: unknown) => typeof t === 'string' && TOPIC_KEYS.includes(t));

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists ? (snap.data() as any) : null;
      const pendingPrev = prev && !prev.claimed ? Number(prev.amount) || 0 : 0;
      const total = Math.min(100, pendingPrev + amount);
      tx.set(ref, {
        amount: total,
        note: note || prev?.note || 'CS 보상',
        reason,
        wipeTopics: wipeTopics.length > 0 ? wipeTopics : (prev && !prev.claimed ? prev.wipeTopics ?? [] : []),
        claimed: false,
        createdAt: prev?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        grantedBy: uid,
      });
      // 지급 이력 한 줄 (고객 찾기에서 회원 ID 로 찾을 수 있게 uids 배열도 남긴다)
      tx.set(db.collection('compensationLog').doc(), {
        target: targetId,
        kind: isHexDevice ? 'device' : 'uid',
        uids: isHexDevice ? (Array.isArray(request.data?.uids) ? request.data.uids.filter((x: unknown) => typeof x === 'string').slice(0, 6) : []) : [targetId],
        amount, reason, note, wipeTopics,
        by: uid,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { totalPending: total, accumulated: pendingPrev > 0 };
    });
    console.info(`[adminGrant] ${amount}운 ${reason} (대기합계 ${result.totalPending}) target=${targetId.slice(0, 12)}… by=${uid.slice(0, 8)}`);
    return { ok: true, ...result };
  },
);
