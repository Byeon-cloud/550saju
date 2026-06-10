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

/** 측정 — fire-and-forget (실패해도 UX 영향 0) */
function track(name: string, params?: Record<string, string | number>) {
  import('@/services/analytics').then((a) => a.trackEvent(name, params)).catch(() => {});
}

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
  track('reward_earned', { kind: 'share', amount: REWARD_PER_SHARE });
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
  track('reward_earned', { kind: 'share', amount: REWARD_PER_SHARE });
  return REWARD_PER_SHARE;
}

/**
 * 앱인토스 "공유 리워드" moduleId — 토스 콘솔 미니앱 > 공유 리워드 메뉴의 UUID.
 * ⚠️ 콘솔 값과 반드시 일치해야 contactsViral 화면이 정상 노출됨.
 */
export const TOSS_VIRAL_MODULE_ID = '0a21ea14-951b-4abb-8484-aaf61b0123b8';

/**
 * 🔗 통합 공유 — 앱 전체의 모든 공유 진입점은 이 함수 하나만 호출.
 *
 *   앱인토스: contactsViral (토스 공식 "공유 리워드" 화면 — 친구 목록 + 운받기).
 *             sendViral(친구 공유 실제 완료) 이벤트 시에만 일 3회 한도로 적립.
 *   웹:       navigator.share 폴백 — 완료 시 일 3회 한도로 적립.
 *
 *   2026-05-21 — 준기 지시로 전 앱 공유를 토스 SDK contactsViral 로 통일.
 *   (웹 런칭 시 웹 분기 별도 보강 필요 — 현재는 토스 우선.)
 */
export async function inviteFriendsViaToss(opts?: {
  onReward?: (earned: number) => void; // 리워드 적립 (earned 운)
  onShared?: () => void;               // 공유 완료했으나 한도 초과 등 미적립
  onCancel?: () => void;               // 취소·실패
}): Promise<void> {
  // 측정 — 공유 시도 (C2 · 친구 초대 트리거)
  track('share_click', { type: 'invite' });
  const { isAppsInToss } = await import('@/services/payment/iapService');
  if (isAppsInToss()) {
    try {
      const { contactsViral } = await import('@apps-in-toss/web-framework');
      contactsViral({
        options: { moduleId: TOSS_VIRAL_MODULE_ID },
        onEvent: (event: any) => {
          if (event?.type === 'sendViral') {
            const earned = claimShareReward(); // 일 3회 한도 (claimShareReward 내장)
            if (earned > 0) opts?.onReward?.(earned);
            else opts?.onShared?.();
          }
        },
        onError: () => opts?.onCancel?.(),
      });
    } catch {
      opts?.onCancel?.();
    }
    return;
  }
  // ── 웹 폴백 ──
  const url = `${window.location.origin}/share/invite`;
  const text = '나도 500원에 내 사주 볼 수 있대! 한번 해봐';
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: '사주500', text, url });
      const earned = claimShareReward();
      if (earned > 0) opts?.onReward?.(earned);
      else opts?.onShared?.();
    } catch {
      opts?.onCancel?.();
    }
  } else {
    try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch { /* noop */ }
    opts?.onShared?.();
  }
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
