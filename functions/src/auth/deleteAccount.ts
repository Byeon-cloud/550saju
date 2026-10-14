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
 * payments 보존 방식: users/{uid}/payments 하위 컬렉션만 남기고, users 문서는 결제 집계와 상태 표식만 남게
 *   덮어쓴다. 지우는 범위의 정본은 purgeUser.ts.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { purgeUserData, unlinkPurgedUids } from './purgeUser';

/*
 * 2026-10-14 — 지우는 범위를 purgeUser.ts 로 옮겼다 (토스 탈퇴 5일 뒤 파기와 같은 함수).
 *   예전 고정 목록은 users/{uid}/state(사주원국 미러, 잔액, 삭제 장부)와 progress, 기기 여권 연결을
 *   빠뜨렸고, users 문서에 이름 같은 필드가 남았다. 지금은 payments 만 남기고 전부 지운다.
 */
export const deleteAccount = onCall(
  { timeoutSeconds: 300, memory: '512MiB', minInstances: 0, cors: true },
  async (request) => {
    // auth 필수 — uid 는 오직 토큰에서만.
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const r = await purgeUserData(uid, 'WEB_DELETE_ACCOUNT');
    const unlinked = await unlinkPurgedUids([uid]);

    if (r.auth === 'failed') {
      console.error(`[deleteAccount] Auth 삭제 실패 uid=${uid}:`, r.errors.join(' | '));
      throw new HttpsError('internal', '계정 삭제에 실패했습니다. 잠시 뒤 다시 시도해 주세요.');
    }
    if (r.errors.length > 0) console.warn(`[deleteAccount] 일부 경고 uid=${uid}:`, r.errors.join(' | '));
    console.info(`[deleteAccount] 완료 uid=${uid} sub=${r.subcollections} reports=${r.topReports} progress=${r.progress} links=${unlinked} (payments 보존)`);
    return { ok: true };
  },
);
