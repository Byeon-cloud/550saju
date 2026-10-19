/**
 * 이름이 아닌 이름 (2026-10-19)
 *   무료 만세력은 이름을 비우면 '나'로 저장하고, 직접 '나', '본인'이라고 넣는 사람도 많다. 그대로 프롬프트에 넣으면
 *   풀이가 '나 님은 ~'으로 나온다. 그런 이름은 모르는 이름으로 보고 '미상'을 넘긴다(TONE_FINAL_CHECK: 이름을 모르면 호칭 없이).
 *   클라이언트 src/utils/personName.ts 와 같은 목록.
 */
const PLACEHOLDER = /^(나|본인|저|내꺼|내 사주|나의 사주|사용자|미상|익명)$/;

/** 부를 수 있는 이름이면 그 이름, 아니면 '' */
export function realName(name?: unknown): string {
  const n = String(name ?? '').trim();
  return n && !PLACEHOLDER.test(n) ? n : '';
}

/** 프롬프트의 '이름:' 칸 — 모르면 '미상' */
export function promptName(name?: unknown): string {
  return realName(name) || '미상';
}
