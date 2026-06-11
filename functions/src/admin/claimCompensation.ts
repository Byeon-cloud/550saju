/**
 * claimCompensation — CS 보상 운 지급 (디바이스 ID 기반) · 2026-06-11
 *
 * 배경: 익명 계정 + 클라 잔액 구조라 특정 유저에게 운을 원격 지급할 수단이 없었음.
 *   앱인토스 CS 콘솔이 문의자 디바이스 ID 를 제공 → 이를 키로 보상 장부 운영.
 *
 * 운영 절차 (준기):
 *   Firebase Console → Firestore → `compensations` 컬렉션 → 문서 ID = 디바이스 ID(소문자 hex 그대로)
 *   필드: amount(number, 지급 운), note(string, 사유), claimed(boolean, false), createdAt(timestamp)
 *   → 유저가 앱을 열면(신규 번들) 자동 수령 + 토스트 안내.
 *
 * 보안: 클라이언트는 이 callable 로만 접근(직접 read 불가 — rules write/read false, admin SDK 우회).
 *   디바이스 ID 는 64자 hex 고엔트로피라 추측 불가. claimed 전이는 트랜잭션 — 재설치/재호출 중복 지급 차단.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const claimCompensation = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    const deviceId = String(request.data?.deviceId || '').trim().toLowerCase();
    // 앱인토스 디바이스 ID 형식 (hex 32~128자) 외 거부 — 스캔 방지
    if (!/^[0-9a-f]{32,128}$/.test(deviceId)) {
      return { amount: 0 };
    }
    const db = admin.firestore();
    const ref = db.collection('compensations').doc(deviceId);
    try {
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return { amount: 0 };
        const d = snap.data() as { amount?: number; note?: string; claimed?: boolean; wipeTopics?: string[] };
        if (d.claimed) return { amount: 0 };
        const amount = Math.max(0, Math.min(100, Number(d.amount) || 0)); // 상한 100운 안전장치
        if (amount <= 0) return { amount: 0 };
        tx.update(ref, {
          claimed: true,
          claimedAt: admin.firestore.FieldValue.serverTimestamp(),
          claimedByUid: request.auth!.uid,
        });
        // wipeTopics: 잘못 생성된 주제 결과를 클라가 수령 시점에 보관함에서 정리 (예: ['love','marriage'])
        return { amount, note: d.note || '', wipeTopics: Array.isArray(d.wipeTopics) ? d.wipeTopics : [] };
      });
      if (result.amount > 0) {
        console.info(`[claimCompensation] 지급: ${result.amount}운 device=${deviceId.slice(0, 12)}… uid=${request.auth.uid}`);
      }
      return result;
    } catch (e: any) {
      console.error('[claimCompensation] 실패:', e?.message);
      return { amount: 0 }; // 실패해도 클라 UX 영향 0 (다음 부팅 재시도)
    }
  },
);
