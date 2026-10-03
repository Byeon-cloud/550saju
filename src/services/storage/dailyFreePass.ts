/**
 * 일일 무료 이용권 시스템
 *
 * "운(運)"과는 완전히 별개 메커니즘.
 * 매일 자정(00:00 · 한국시간 KST)에 리셋되어 새로 1개씩 제공.
 * 사용 안 하면 사라짐 (누적 불가).
 *
 * 제공 항목:
 * - 오늘의 운세: 1일 1회 무료
 * - 꿈해몽: 1일 1회 무료
 * - 사주대화: 1일 1회 무료 (첫 질문만)
 *
 * 동작:
 * 1. 유저가 서비스 접근
 * 2. hasFreePass(type) 체크 → true면 무료 이용
 * 3. useFreePass(type) 호출 → 오늘 사용 기록
 * 4. 생성 실패 등으로 결과를 못 드리면 restoreFreePass(type) 로 되돌림
 * 5. 다음날 자정(KST) 이후 → 자동 리셋 (날짜 비교)
 *
 * "운" 잔액과의 관계 (2026-09-17 준기 결정 — 세 콘텐츠 모두 같은 규칙):
 * - 무료 패스가 있으면 운 차감 안 함
 * - 무료 패스 소진 후 추가 이용은 운(사주대화는 대화권)이 필요
 *   · 오늘의 운세: 두 번째부터 1운 (같은 날 같은 프로필 결과 다시 열기·보관함 열람은 무료)
 *   · 꿈해몽: 두 번째부터 운 차감 (가격은 DreamPage 기준)
 *   · 사주대화: 1운 = 대화 3회 대화권 (2026-04-21 갭리포트 §2-2)
 * - (폐기) "오늘의 운세·꿈해몽은 무료 패스 소진 후에도 무료" — 이 정책으로 되돌리지 말 것
 *
 * 화면 반영: subscribeFreePass(cb) — 사용/복구 · 자정(KST) 넘김 · 화면 복귀 · 다른 탭 변경 시 cb 호출
 *   (홈 뱃지처럼 마운트 때 한 번 계산하는 화면이 '오늘 1회 무료' 에 고정되지 않도록)
 */

import { kstToday } from '@/utils/kstDate';

const PASS_KEY = 'saju500_daily_passes';

type PassType = 'daily' | 'dream' | 'chat';

/* ── 정책 시행일 (2026-10-04 결정) ──
 *   운영 앱(09-17 번들)은 오늘의 운세·꿈해몽이 무제한 무료였고, 6/3 약관도 꿈해몽(기본 해석)을 무료로 적어 두었다.
 *   '하루 1회 무료 → 이후 1운' 은 이용자에게 불리한 변경이라 30일 이상 앞서 알린 뒤 시행한다.
 *   시행일 전에는 오늘의 운세·꿈해몽 무료권을 소진하지 않고(무제한 무료), 화면·약관에 시행일을 미리 안내한다.
 *   사주대화(첫 질문 무료 → 대화권)는 기존 정책 그대로 — 게이트 대상 아님. */
export const FREE_PASS_POLICY_START = '2026-11-10'; // KST
export const FREE_PASS_POLICY_START_LABEL = '11월 10일';

/** 오늘의 운세·꿈해몽 '하루 1회 무료 → 이후 1운' 이 시행 중인지 (KST 기준) */
export function isFreePassPolicyActive(): boolean {
  return getToday() >= FREE_PASS_POLICY_START;
}
const isGated = (type: PassType) => type !== 'chat' && !isFreePassPolicyActive();

interface DailyPasses {
  date: string; // YYYY-MM-DD
  used: Record<string, boolean>;
}

// 2026-07-03 fix — UTC 날짜라 "매일 자정 리셋"이 실제론 KST 오전 9시에 됐음 (아침에 무료 안 풀림) → KST
function getToday(): string {
  return kstToday();
}

function getPasses(): DailyPasses {
  try {
    const raw = localStorage.getItem(PASS_KEY);
    if (!raw) return { date: '', used: {} };
    const parsed: DailyPasses = JSON.parse(raw);
    // 날짜가 오늘이 아니면 리셋
    if (parsed.date !== getToday()) {
      return { date: getToday(), used: {} };
    }
    return parsed;
  } catch {
    return { date: getToday(), used: {} };
  }
}

/** @returns 저장 성공 여부 — localStorage 가득 참 등으로 실패하면 false (2026-09-18: throw 대신) */
function savePasses(passes: DailyPasses): boolean {
  try {
    localStorage.setItem(PASS_KEY, JSON.stringify(passes));
    return true;
  } catch {
    return false;
  }
}

/**
 * 오늘의 무료 이용권이 남아있는지 확인
 */
export function hasFreePass(type: PassType): boolean {
  if (isGated(type)) return true; // 시행일 전 — 무제한 무료
  const passes = getPasses();
  return !passes.used[type];
}

/**
 * 무료 이용권 사용 처리
 * @returns true면 무료 이용 성공, false면 이미 사용함 (또는 사용 기록 저장 실패 — 무료로 진행하지 않음)
 */
export function useFreePass(type: PassType): boolean {
  if (isGated(type)) return true; // 시행일 전 — 기록하지 않음 (시행일 첫 이용도 무료로 남게)
  const passes = getPasses();
  if (passes.used[type]) return false;

  passes.date = getToday();
  passes.used[type] = true;
  if (!savePasses(passes)) return false;
  notifyChange();
  return true;
}

/**
 * 무료 이용권 복구 (사용 후 AI 실패 등으로 결과를 못 받았을 때 되돌림).
 * 2026-05-29 — 채팅/콘텐츠 실패 시 무료 1회를 날리지 않도록 rollback 용.
 * @param usedOn 무료권을 쓴 날(KST 'YYYY-MM-DD' · useFreePass 직전 kstToday()). 주면 오늘과 같을 때만 되돌림 —
 *   자정을 넘겨 실패한 경우 새 날의 무료권 기록까지 지워 하루 2회 무료가 되는 것 방지 (2026-09-18).
 *   생략하면 기존 동작(무조건 복구) — 하위 호환.
 */
export function restoreFreePass(type: PassType, usedOn?: string): void {
  if (usedOn && usedOn !== getToday()) return;
  const passes = getPasses();
  if (passes.used[type]) {
    delete passes.used[type];
    if (savePasses(passes)) notifyChange();
  }
}

/**
 * 모든 무료 이용권 현황 조회
 */
export function getAllFreePassStatus(): Record<PassType, boolean> {
  const passes = getPasses();
  return {
    daily: isGated('daily') || !passes.used['daily'],
    dream: isGated('dream') || !passes.used['dream'],
    chat: !passes.used['chat'],
  };
}

/* ── 변경 구독 (2026-09-17) ──
 *   hasFreePass 는 호출 시점 스냅샷이라 마운트 때 한 번 계산한 화면은
 *   ① 다른 화면에서의 사용/복구 ② 켜 둔 채 자정(KST) 넘김 ③ 앱 복귀·다른 탭 변경을 놓친다.
 *   세 경우 모두 cb 를 불러 다시 계산하게 한다. 반환값 = 구독 해제 함수. */
const CHANGE_EVENT = 'saju500:free-pass-change';

function notifyChange(): void {
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch { /* noop */ }
}

export function subscribeFreePass(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onVisible = () => {
    if (document.visibilityState === 'visible') cb();
  };
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === null || ev.key === PASS_KEY) cb();
  };
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener('focus', cb);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  // 화면을 켜 둔 채 자정을 넘기는 경우 — 1분마다 날짜만 확인, 바뀌었을 때만 cb
  let lastDay = getToday();
  const timer = window.setInterval(() => {
    const d = getToday();
    if (d !== lastDay) {
      lastDay = d;
      cb();
    }
  }, 60_000);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('focus', cb);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}
