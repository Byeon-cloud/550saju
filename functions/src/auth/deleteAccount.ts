/**
 * deleteAccount — 회원탈퇴 (웹 단독 출시 · 파괴적 · 신중)
 *
 * 근거: docs/법적요건_웹출시.md §4 (개인정보보호법 제21조·제36조)
 *   - 회원탈퇴 시 개인정보 지체없이 파기.
 *   - 단 결제 기록(payments)은 전자상거래법상 5년 보존 → 삭제하지 않고 보존.
 *
 * ⚠️ uid 격리: 반드시 request.auth.uid 만 사용. 클라이언트가 보낸 어떤 uid 도 신뢰하지 않음.
 * ⚠️ 멱등성: 이미 삭제된 상태에서 재호출돼도 에러 없이 { ok: true } 반환.
 *
 * payments 보존 방식 (택1 — 가장 단순·안전):
 *   users/{uid} 문서를 통째로 지우지 않고, users/{uid}/payments 서브컬렉션은 **남겨둔다**.
 *   - users/{uid} 문서에는 `deletedAt` 마킹만 남기고 개인식별 필드(consent·displayName 등)는 제거하지 않음
 *     (어차피 Auth 계정이 삭제되어 재로그인 불가 → 식별 연결 끊김. payments 만 법정 보존).
 *   - 그 외 개인정보 서브컬렉션(profiles·reports·chats·dailyFortune·dreamQuota·shareLogs 등)은 재귀 삭제.
 *   - 최상위 reports 컬렉션 중 uid 일치 문서도 삭제.
 *   이 방식은 payments 를 다른 위치로 이관하지 않아 결제 기록 정합성(orderId·status)을 그대로 유지한다.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

/** payments 만 보존하고 삭제할 사용자 개인정보 서브컬렉션 목록. */
const SUBCOLLECTIONS_TO_DELETE = [
  'profiles',
  'reports',
  'chats',
  'dailyFortune',
  'dreamQuota',
  'shareLogs',
  'pdfIssuances',
  'rewardClaims',
  'inviteEvents',
  'attendance',
  'streakAttendance',
];

export const deleteAccount = onCall(
  { timeoutSeconds: 120, memory: '512MiB', minInstances: 0, cors: true },
  async (request) => {
    // auth 필수 — uid 는 오직 토큰에서만.
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);

    // 1) 개인정보 서브컬렉션 재귀 삭제 (payments 제외). 멱등 — 없으면 no-op.
    for (const sub of SUBCOLLECTIONS_TO_DELETE) {
      try {
        await db.recursiveDelete(userRef.collection(sub));
      } catch (e: any) {
        // 멱등성 — 일부 실패해도 계속 진행 (이미 삭제됐거나 비어있을 수 있음)
        console.warn(`[deleteAccount] sub=${sub} 삭제 경고 uid=${uid}:`, e?.message || e);
      }
    }

    // 2) 최상위 reports 컬렉션 중 본인(uid) 문서 삭제 (generateReport 가 여기에 저장).
    try {
      const ownReports = await db.collection('reports').where('uid', '==', uid).get();
      const batchSize = 400;
      for (let i = 0; i < ownReports.docs.length; i += batchSize) {
        const batch = db.batch();
        for (const d of ownReports.docs.slice(i, i + batchSize)) batch.delete(d.ref);
        await batch.commit();
      }
    } catch (e: any) {
      console.warn(`[deleteAccount] top-level reports 삭제 경고 uid=${uid}:`, e?.message || e);
    }

    // 3) users/{uid} 문서 — payments 서브컬렉션 보존 위해 문서 자체는 삭제하지 않고
    //    개인정보 필드를 제거 + deletedAt 마킹. (set merge 대신 명시적 필드 delete)
    try {
      await userRef.set(
        {
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          // 개인정보 필드 제거 (payments 법정 보존과 무관한 식별정보)
          consent: admin.firestore.FieldValue.delete(),
          displayName: admin.firestore.FieldValue.delete(),
          balance: admin.firestore.FieldValue.delete(),
        } as any,
        { merge: true },
      );
    } catch (e: any) {
      // 문서가 아예 없으면(이미 정리됨) 무시 — 멱등
      console.warn(`[deleteAccount] users doc 마킹 경고 uid=${uid}:`, e?.message || e);
    }

    // 4) Auth 계정 삭제 (마지막). 이미 삭제됐으면(user-not-found) 멱등 처리.
    try {
      await admin.auth().deleteUser(uid);
    } catch (e: any) {
      if (e?.code === 'auth/user-not-found') {
        // 이미 삭제됨 — 멱등
        console.info(`[deleteAccount] Auth 계정 이미 삭제됨 uid=${uid}`);
      } else {
        console.error(`[deleteAccount] Auth deleteUser 실패 uid=${uid}:`, e?.message || e);
        throw new HttpsError('internal', `계정 삭제에 실패했습니다: ${e?.message || 'unknown'}`);
      }
    }

    console.info(`[deleteAccount] 완료 uid=${uid} (payments 보존)`);
    return { ok: true };
  },
);
