/**
 * 공유하기 리워드 시스템
 *
 * 기획 의도:
 * - 공유 → 리워드(운) → 재사용 → 더 많은 공유의 선순환
 * - 공유 이미지에 블러 처리로 수신자 궁금증 유발
 *
 * 공유 정책 (심플):
 * - 공유 1회 = 1운
 * - 횟수 제한 없음
 * - 단, 같은 사람에게 중복 공유 불가 (서버에서 레퍼럴 코드로 추적)
 * - 새로운 친구한테 공유할수록 계속 1운씩 받음
 * - 어뷰징 방지: 실제로 친구가 앱에 진입해야 리워드 지급 (Phase 2)
 */

import { addRewardBalance } from '@/services/storage/localStore';

const SHARE_LOG_KEY = 'saju500_share_log';
const MONTHLY_LOG_KEY = 'saju500_share_monthly';
const MAX_DAILY_SHARES = 3;       // 하루 3회까지
const MAX_MONTHLY_REWARD = 10;    // 월 10운까지 (= 5,000원 상당)
const REWARD_PER_SHARE = 1;       // 공유 1회 = 1운

interface ShareLog {
  date: string;
  count: number;
}

interface MonthlyLog {
  month: string; // YYYY-MM
  total: number; // 이번 달 적립된 총 운
}

function getShareLog(): ShareLog {
  try {
    const raw = localStorage.getItem(SHARE_LOG_KEY);
    if (!raw) return { date: '', count: 0 };
    return JSON.parse(raw);
  } catch { return { date: '', count: 0 }; }
}

function saveShareLog(log: ShareLog): void {
  localStorage.setItem(SHARE_LOG_KEY, JSON.stringify(log));
}

function getMonthlyLog(): MonthlyLog {
  try {
    const raw = localStorage.getItem(MONTHLY_LOG_KEY);
    if (!raw) return { month: '', total: 0 };
    return JSON.parse(raw);
  } catch { return { month: '', total: 0 }; }
}

function saveMonthlyLog(log: MonthlyLog): void {
  localStorage.setItem(MONTHLY_LOG_KEY, JSON.stringify(log));
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getThisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** 오늘 남은 공유 리워드 횟수 */
export function getRemainingShareRewards(): number {
  const daily = getShareLog();
  const dailyRemain = daily.date !== getToday() ? MAX_DAILY_SHARES : Math.max(0, MAX_DAILY_SHARES - daily.count);

  const monthly = getMonthlyLog();
  const monthlyRemain = monthly.month !== getThisMonth()
    ? MAX_MONTHLY_REWARD / REWARD_PER_SHARE
    : Math.max(0, (MAX_MONTHLY_REWARD - monthly.total) / REWARD_PER_SHARE);

  return Math.min(dailyRemain, Math.floor(monthlyRemain));
}

/** 공유 리워드 가능 여부 */
export function canEarnShareReward(): boolean {
  return getRemainingShareRewards() > 0;
}

/** 이번 달 남은 리워드 운 */
export function getMonthlyRewardRemaining(): number {
  const monthly = getMonthlyLog();
  if (monthly.month !== getThisMonth()) return MAX_MONTHLY_REWARD;
  return Math.max(0, Math.round((MAX_MONTHLY_REWARD - monthly.total) * 10) / 10);
}

/**
 * 공유 리워드 적립
 * @returns 적립된 운 (0이면 한도 초과)
 */
export function claimShareReward(): number {
  if (!canEarnShareReward()) return 0;

  const today = getToday();
  const thisMonth = getThisMonth();

  // 일간 로그 업데이트
  const dailyLog = getShareLog();
  saveShareLog({
    date: today,
    count: dailyLog.date === today ? dailyLog.count + 1 : 1,
  });

  // 월간 로그 업데이트
  const monthlyLog = getMonthlyLog();
  saveMonthlyLog({
    month: thisMonth,
    total: monthlyLog.month === thisMonth
      ? Math.round((monthlyLog.total + REWARD_PER_SHARE) * 10) / 10
      : REWARD_PER_SHARE,
  });

  // reward 유형으로 적립 (환불 불가)
  addRewardBalance(REWARD_PER_SHARE);

  return REWARD_PER_SHARE;
}

/**
 * 공유 URL 생성 (레퍼럴 코드 포함)
 */
export function generateShareUrl(reportId: string, referrerCode?: string): string {
  const base = `${window.location.origin}/share/${reportId}`;
  return referrerCode ? `${base}?ref=${referrerCode}` : base;
}

/**
 * 공유 데이터 구성
 */
export function getShareData(name: string, reportId: string): {
  title: string;
  text: string;
  url: string;
} {
  return {
    title: `${name}님의 사주 결과 — 사주500`,
    text: `${name}님의 사주를 분석했어요. 나도 500원에 내 사주를 볼 수 있다는데?`,
    url: generateShareUrl(reportId),
  };
}
