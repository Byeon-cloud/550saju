/**
 * 대화권 관리
 *
 * 구조:
 * - 1운 = 대화 3회
 * - 매일 무료 1회는 dailyFreePass에서 별도 관리
 * - 대화권은 "운"과 별개로 카운트 (운에서 차감 → 대화권 추가)
 *
 * 유저에게 보이는 방식:
 * "남은 대화: 3회"
 * "1운으로 3회 추가"
 */

const CHAT_CREDIT_KEY = 'saju500_chat_credits';

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
