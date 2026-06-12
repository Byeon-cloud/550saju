/**
 * adminGrantCompensation — 어드민 CS 운 지급 (2026-06-12)
 *
 * 배경: 보상 장부(compensations)를 매번 개발자가 CLI 로 심어야 했음.
 *   → 어드민 'CS 지급' 탭에서 준기가 디바이스 ID + 운 수량 입력 → 즉시 장부 기록.
 *   수령은 기존 claimCompensation 파이프 그대로 (고객이 앱 열면 자동 적립). 배포 0.
 *
 * 보안: OWNER_UIDS 하드코딩 검증 (src/services/admin/adminConfig.ts 와 동일 목록 유지).
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const OWNER_UIDS = [
  '6C4MSgYY5UMLBpsth0ehx3Pyj0K3', // 준기 · 구글 웹
  '8Nda5XA4GwQfyjOLJk54i0ADdTb2', // 준기 · PC 웹 익명
  'biXRUeNouMhbtPVMDcaylJUqFqj1', // 준기 · saju500.app 익명
];

const TOPIC_KEYS = ['love', 'reunion', 'marriage', 'wealth', 'exam', 'business', 'health', 'move', 'study', 'career'];

export const adminGrantCompensation = onCall(
  { timeoutSeconds: 15, memory: '256MiB', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid || !OWNER_UIDS.includes(uid)) throw new HttpsError('permission-denied', '오너 전용');

    const action = String(request.data?.action || 'grant');
    const deviceId = String(request.data?.deviceId || '').trim().toLowerCase();
    if (!/^[0-9a-f]{32,128}$/.test(deviceId)) {
      throw new HttpsError('invalid-argument', '디바이스 ID 형식이 아니에요 (hex 32~128자)');
    }
    const db = admin.firestore();
    const ref = db.collection('compensations').doc(deviceId);

    // 상태 조회 — 지급 전 확인 / 수령 여부 추적
    if (action === 'status') {
      const snap = await ref.get();
      if (!snap.exists) return { exists: false };
      const d = snap.data() as any;
      return {
        exists: true,
        amount: d.amount ?? 0,
        claimed: !!d.claimed,
        note: d.note ?? '',
        wipeTopics: d.wipeTopics ?? [],
        claimedAt: d.claimedAt?.toDate?.()?.toISOString?.() ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    }

    // 지급 — 미수령 장부가 있으면 누적, 수령됐거나 없으면 새 장부
    const amount = Math.max(1, Math.min(100, Math.round(Number(request.data?.amount) || 0)));
    const note = String(request.data?.note || '').slice(0, 200);
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
        wipeTopics: wipeTopics.length > 0 ? wipeTopics : (prev && !prev.claimed ? prev.wipeTopics ?? [] : []),
        claimed: false,
        createdAt: prev?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        grantedBy: uid,
      });
      return { totalPending: total, accumulated: pendingPrev > 0 };
    });
    console.info(`[adminGrant] ${amount}운 (대기합계 ${result.totalPending}) device=${deviceId.slice(0, 12)}… by=${uid.slice(0, 8)}`);
    return { ok: true, ...result };
  },
);
