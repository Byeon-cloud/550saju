/**
 * deleteAccount 클라이언트 — 회원탈퇴 Cloud Function 호출 (웹 단독 출시)
 *
 * 근거: docs/법적요건_웹출시.md §4 (개인정보보호법 제21조·제36조)
 *   - 회원탈퇴 경로 필수. 탈퇴 시 개인정보 지체없이 파기.
 *   - 단 결제 기록(payments)은 전자상거래법 5년 보존 → 서버에서 분리 보존.
 */
import { httpsCallable } from 'firebase/functions';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';

/** 회원탈퇴 — Firestore 유저 데이터 삭제 + Auth 계정 삭제 (payments 보존). */
export async function callDeleteAccount(): Promise<{ ok: boolean }> {
  await ensureFunctionsTarget();
  const fn = httpsCallable<Record<string, never>, { ok: boolean }>(
    functions,
    'deleteAccount',
    { timeout: 30000 },
  );
  const res = await fn({});
  return res.data;
}
