/**
 * 대화권 관리
 *
 * 구조:
 * - 1운 = 대화 3회 (양방향 환율, 2026-04-22 SSOT)
 * - 매일 무료 1회는 dailyFreePass에서 별도 관리
 * - 대화권은 "운"과 별개로 카운트 (운에서 차감 → 대화권 추가)
 *
 * 유저에게 보이는 방식:
 *   "남은 대화: 3회"
 *   "1운으로 3회 추가"          (정방향)
 *   "대화권 3회를 1운으로 바꾸기" (역방향, 2026-04-22 신규)
 *
 * ⚠ 역변환 정책 (어뷰징 방지):
 *   - 환원된 운은 reward bucket 으로 적립 (환불 불가).
 *   - 이유: paid → chatCredit → paid 변환 후 환불 받는 세탁 방지.
 *   - reward bucket 은 사용 우선순위가 가장 높아 다음 사용 시 자동 소진.
 *   - 3 단위로만 환원 가능 (잔여 대화권은 그대로 유지).
 */

import { addRewardBalance } from './localStore';

const CHAT_CREDIT_KEY = 'saju500_chat_credits';

/** 1운 = N 대화 (양방향 환율) */
export const CREDITS_PER_UN = 3;

/** 남은 대화권 수 */
export function getChatCredits(): number {
  try {
    return Number(localStorage.getItem(CHAT_CREDIT_KEY)) || 0;
  } catch { return 0; }
}

/** 대화권 추가 (구매 시) */
export function addChatCredits(amount: number): void {
  const current = getChatCredits();
  localStorage.setItem(CHAT_CREDIT_KEY, String(current + amount));
}

/** 대화권 1회 사용 */
export function useChatCredit(): boolean {
  const current = getChatCredits();
  if (current <= 0) return false;
  localStorage.setItem(CHAT_CREDIT_KEY, String(current - 1));
  return true;
}

/**
 * 대화권을 운으로 역변환 (3대화권 → 1운)
 *
 * - 가능한 최대 단위 (3의 배수) 만 환원, 나머지는 그대로 유지.
 * - 환원된 운은 reward bucket 으로 적립 (환불 불가, 어뷰징 방지).
 * - 환원할 단위가 없으면 null 반환.
 *
 * @returns { credits: 차감된 대화권, un: 적립된 운 } 또는 null
 */
export function convertChatCreditsToUn(): { credits: number; un: number } | null {
  const current = getChatCredits();
  const blocks = Math.floor(current / CREDITS_PER_UN);
  if (blocks <= 0) return null;
  const credits = blocks * CREDITS_PER_UN;
  const remaining = current - credits;
  localStorage.setItem(CHAT_CREDIT_KEY, String(remaining));
  addRewardBalance(blocks);
  return { credits, un: blocks };
}
