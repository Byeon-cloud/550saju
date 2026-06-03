/**
 * 일일 무료 이용권 시스템
 *
 * "운(運)"과는 완전히 별개 메커니즘.
 * 매일 자정(00:00)에 리셋되어 새로 1개씩 제공.
 * 사용 안 하면 사라짐 (누적 불가).
 *
 * 제공 항목:
 * - 오늘의 운세: 1일 1회 무료
 * - 꿈해몽: 1일 1회 무료
 * - 사주대화: 1일 1회 무료 (첫 질문만)
 *
 * 동작:
 * 1. 유저가 서비스 접근
 * 2. hasFreePass('daily') 체크 → true면 무료 이용
 * 3. useFreePass('daily') 호출 → 오늘 사용 기록
 * 4. 다음날 자정 이후 → 자동 리셋 (날짜 비교)
 *
 * "운" 잔액과의 관계:
 * - 무료 패스가 있으면 운 차감 안 함
 * - 무료 패스 소진 후 추가 이용하려면 운 필요
 * - 오늘의 운세, 꿈해몽은 무료 패스 소진 후에도 무료 (기존 정책 유지)
 * - 사주대화는 무료 패스 소진 후 1운(3회) 필요 (2026-04-21 갭리포트 §2-2)
 */

const PASS_KEY = 'saju500_daily_passes';

type PassType = 'daily' | 'dream' | 'chat';

interface DailyPasses {
  date: string; // YYYY-MM-DD
  used: Record<string, boolean>;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
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

function savePasses(passes: DailyPasses): void {
  localStorage.setItem(PASS_KEY, JSON.stringify(passes));
}

/**
 * 오늘의 무료 이용권이 남아있는지 확인
 */
export function hasFreePass(type: PassType): boolean {
  const passes = getPasses();
  return !passes.used[type];
}

/**
 * 무료 이용권 사용 처리
 * @returns true면 무료 이용 성공, false면 이미 사용함
 */
export function useFreePass(type: PassType): boolean {
  const passes = getPasses();
  if (passes.used[type]) return false;

  passes.date = getToday();
  passes.used[type] = true;
  savePasses(passes);
  return true;
}

/**
 * 무료 이용권 복구 (사용 후 AI 실패 등으로 결과를 못 받았을 때 되돌림).
 * 2026-05-29 — 채팅/콘텐츠 실패 시 무료 1회를 날리지 않도록 rollback 용.
 */
export function restoreFreePass(type: PassType): void {
  const passes = getPasses();
  if (passes.used[type]) {
    delete passes.used[type];
    savePasses(passes);
  }
}

/**
 * 모든 무료 이용권 현황 조회
 */
export function getAllFreePassStatus(): Record<PassType, boolean> {
  const passes = getPasses();
  return {
    daily: !passes.used['daily'],
    dream: !passes.used['dream'],
    chat: !passes.used['chat'],
  };
}
