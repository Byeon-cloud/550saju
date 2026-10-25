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

import { addRewardBalance, wasBalanceKeyAbsentAtBoot } from './localStore';

const CHAT_CREDIT_KEY = 'saju500_chat_credits';

/**
 * 2026-10-25 대화권 서버 사본 — 운으로 산 대화권이 이 기기 localStorage 에만 있어, 저장소가 비거나(토스 앱 재설치, SDK 주소 변경)
 *   계정이 바뀌면 운 잔액은 기기 여권으로 돌아오는데 남은 대화권은 영영 사라졌다.
 *   이제 잔액 사본 문서(users/{uid}/state/balance)의 chat 칸에 함께 남긴다. 서버 기기 여권이 그 문서를 통째로(...md) 새 계정에 옮기므로
 *   서버는 바꿀 것이 없다. 되살리기는 firestoreSync.pullBalanceMirror(기기 여권), 웹 로그아웃 사본은 syncFromCloud 가 한다.
 *   - 대화권 칸만 merge 로 쓴다(운 칸은 건드리지 않는다). 저장소가 빈 부팅이면 잔액 사본처럼 45초 미룬다(기기 여권이 먼저 옛 사본을 옮기게)
 */
const CHAT_MIRROR_HOLD_MS = 45000;
const BOOT_AT = Date.now();
let chatMirrorTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleChatMirror(): void {
  try {
    if (chatMirrorTimer) clearTimeout(chatMirrorTimer);
    const holdLeft = wasBalanceKeyAbsentAtBoot() ? BOOT_AT + CHAT_MIRROR_HOLD_MS - Date.now() : 0;
    chatMirrorTimer = setTimeout(() => {
      chatMirrorTimer = null;
      import('./firestoreSync').then((m) => m.pushChatCreditMirror()).catch(() => { /* 다음 변경에서 다시 */ });
    }, Math.max(2000, holdLeft));
  } catch { /* noop */ }
}

/** 이 기기에 대화권 기록이 있는가 (한 번도 산 적 없거나 지운 기기는 false) */
export function hasChatCreditKey(): boolean {
  try { return localStorage.getItem(CHAT_CREDIT_KEY) !== null; } catch { return false; }
}

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
  scheduleChatMirror();
}

/** 대화권 1회 사용 */
export function useChatCredit(): boolean {
  const current = getChatCredits();
  if (current <= 0) return false;
  localStorage.setItem(CHAT_CREDIT_KEY, String(current - 1));
  scheduleChatMirror();
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
  scheduleChatMirror();
  addRewardBalance(blocks);
  return { credits, un: blocks };
}

/**
 * 2026-10-25 웹 로그아웃 — 이 계정 사본(logoutChat)에 남긴 뒤 이 기기 대화권을 지운다.
 *   남기면 다음 손님(익명 계정이나 다른 계정)이 쓰거나 운으로 되돌렸다. 기다리던 사본 쓰기도 취소한다(지운 0 이 사본을 덮지 않게).
 */
export function clearChatCredits(): void {
  if (chatMirrorTimer) { clearTimeout(chatMirrorTimer); chatMirrorTimer = null; }
  try { localStorage.removeItem(CHAT_CREDIT_KEY); } catch { /* noop */ }
}

/**
 * 2026-10-25 기기 여권 되살리기 — 옛 계정 사본의 대화권을 이 기기에 한 번 넣는다.
 *   이 기기에 대화권 기록이 아예 없을 때만(저장소가 비었다는 뜻. 다 쓴 기기는 '0' 이 남아 있어 다시 넣지 않는다).
 *   비정상으로 큰 값(300개, 100운어치 초과)은 넣지 않는다(고객센터로). 넣었으면 true.
 */
export function seedChatCreditsFromMirror(n: unknown): boolean {
  try {
    const v = Math.floor(Number(n) || 0);
    if (v <= 0 || v > 300) return false;
    if (hasChatCreditKey()) return false;
    localStorage.setItem(CHAT_CREDIT_KEY, String(v));
    return true;
  } catch { return false; }
}
