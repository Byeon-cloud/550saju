/**
 * 이름이 아닌 이름 (2026-10-19)
 *   무료 만세력(/manse/)은 이름을 비우면 '나'로 저장한다(사주 카드는 '나의 사주'). 직접 '나', '본인'이라고 넣는 사람도 많다.
 *   이걸 그대로 '이름 님'에 넣으면 '나 님의 2027년', '나 님 선택됨'이 된다 → 화면에서는 이름이 없는 것으로 다룬다.
 *   서버 풀이도 같은 규칙(promptsV3 TONE_FINAL_CHECK, shared/personName.ts).
 */
const PLACEHOLDER = /^(나|본인|저|내꺼|내 사주|나의 사주|사용자|미상|익명)$/;

/** 부를 수 있는 이름이면 그 이름, 아니면 '' */
export function realName(name?: string | null): string {
  const n = String(name || '').trim();
  return n && !PLACEHOLDER.test(n) ? n : '';
}
