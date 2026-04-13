/**
 * 공유하기 리워드 시스템
 *
 * 정책:
 * - 공유 1회 = 1운
 * - 하루 3회까지
 * - 월 제한 없음 (바이럴 극대화)
 * - 앱인토스: contactsViral SDK가 같은 친구 중복 공유 자체를 차단
 * - 웹: navigator.share() 완료 시에만 리워드 (취소 = 미적립)
 */

import { addRewardBalance } from '@/services/storage/localStore';

const SHARE_LOG_KEY = 'saju500_share_log';
const MAX_DAILY_SHARES = 3;
const REWARD_PER_SHARE = 1;

interface ShareLog {
  date: string;
  count: number;
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

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/** 오늘 남은 공유 리워드 횟수 */
export function getRemainingShareRewards(): number {
  const log = getShareLog();
  if (log.date !== getToday()) return MAX_DAILY_SHARES;
  return Math.max(0, MAX_DAILY_SHARES - log.count);
}

/** 공유 리워드 가능 여부 */
export function canEarnShareReward(): boolean {
  return getRemainingShareRewards() > 0;
}

/**
 * 앱인토스 공유 리워드 적립 — 제한 없음 (contactsViral이 자체 관리)
 */
export function claimShareRewardUnlimited(): number {
  addRewardBalance(REWARD_PER_SHARE);
  return REWARD_PER_SHARE;
}

/**
 * 웹 공유 리워드 적립 — 일 3회 제한
 * @returns 적립된 운 (0이면 한도 초과)
 */
export function claimShareReward(): number {
  if (!canEarnShareReward()) return 0;

  const today = getToday();
  const log = getShareLog();

  saveShareLog({
    date: today,
    count: log.date === today ? log.count + 1 : 1,
  });

  addRewardBalance(REWARD_PER_SHARE);
  return REWARD_PER_SHARE;
}

/** 공유 URL 생성 */
export function generateShareUrl(reportId: string, referrerCode?: string): string {
  const base = `${window.location.origin}/share/${reportId}`;
  return referrerCode ? `${base}?ref=${referrerCode}` : base;
}

/** 공유 데이터 구성 */
export function getShareData(name: string, reportId: string) {
  return {
    title: `${name}님의 사주 결과 — 사주500`,
    text: `${name}님의 사주를 분석했어요. 나도 500원에 내 사주를 볼 수 있다는데?`,
    url: generateShareUrl(reportId),
  };
}
