/**
 * 공유하기 리워드 시스템
 *
 * 정책:
 * - 공유 1회 = 1운
 * - 하루 3회까지 (친구 초대 · 결과 공유 한도 공유 — KST 자정 리셋)
 * - 월 제한 없음 (바이럴 극대화)
 * - 앱인토스: contactsViral SDK가 같은 친구 중복 공유 자체를 차단
 * - 웹: navigator.share() 완료 시에만 리워드 (취소 = 미적립)
 *
 * 2026-09-17 — 장부 통일: 운 지급·남은 횟수는 이 기기 장부가 SSOT (이벤트 탭 초대 카운터도 getRemainingShareRewards).
 *   서버 onInviteReceived / grantShareReward 는 더 이상 호출하지 않는다 (서버 STUB 장부에 운이 따로 쌓이던 이중 지급 경로).
 *   지급 시 기기 보상 장부(dailyReward.appendRewardLog)에 invite / share 로 기록.
 *   친구 여러 명에게 한 번에 보내면 sendViral 이 친구마다 발생 → 건마다 일 3회 한도 안에서 적립 (서버 inviteId 1개 문제와 무관).
 */

import { addRewardBalance, getBalance } from '@/services/storage/localStore';
import { appendRewardLog } from '@/services/storage/dailyReward';
import { kstToday } from '@/utils/kstDate';

/** 측정 — fire-and-forget (실패해도 UX 영향 0) */
function track(name: string, params?: Record<string, string | number>) {
  import('@/services/analytics').then((a) => a.trackEvent(name, params)).catch(() => {});
}

const SHARE_LOG_KEY = 'saju500_share_log';
const MAX_DAILY_SHARES = 3;
const REWARD_PER_SHARE = 1;

/** 기기 보상 장부 기록 종류 — 친구 초대(inviteFriendsViaToss) / 결과 공유(ShareModal) */
export type ShareRewardKind = 'invite' | 'share';

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

function saveShareLog(log: ShareLog): boolean {
  try {
    localStorage.setItem(SHARE_LOG_KEY, JSON.stringify(log));
    return true;
  } catch {
    return false;
  }
}

// 2026-07-03 CS fix — UTC 날짜라 일 3회 리셋이 KST 오전 9시에야 됐음 ("다음날 리워드 안 들어와요") → KST 기준
function getToday(): string {
  return kstToday();
}

/** 오늘 남은 공유 리워드 횟수 */
export function getRemainingShareRewards(): number {
  const log = getShareLog();
  if (log.date !== getToday()) return MAX_DAILY_SHARES;
  return Math.max(0, MAX_DAILY_SHARES - log.count);
}

/** 하루 공유 리워드 한도 (이벤트 탭 표시용) */
export const MAX_DAILY_SHARE_REWARDS = MAX_DAILY_SHARES;

/** 공유 리워드 가능 여부 */
export function canEarnShareReward(): boolean {
  return getRemainingShareRewards() > 0;
}

function logShareReward(kind: ShareRewardKind): void {
  appendRewardLog(kind, REWARD_PER_SHARE, `${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
}

/**
 * @deprecated 호출처 없음 — 일 3회 한도를 우회한다. claimShareReward 사용.
 * 앱인토스 공유 리워드 적립 — 제한 없음 (contactsViral이 자체 관리)
 */
export function claimShareRewardUnlimited(): number {
  addRewardBalance(REWARD_PER_SHARE);
  logShareReward('invite');
  track('reward_earned', { kind: 'share', amount: REWARD_PER_SHARE });
  return REWARD_PER_SHARE;
}

/**
 * 공유 리워드 적립 — 일 3회 제한 (친구 초대·결과 공유 공통 한도)
 * @param kind 장부 기록 종류 (기본 'share')
 * @returns 적립된 운 (0이면 한도 초과)
 */
export function claimShareReward(kind: ShareRewardKind = 'share'): number {
  if (!canEarnShareReward()) return 0;

  const today = getToday();
  const log = getShareLog();

  // 횟수 기록을 못 남기면 적립하지 않음 (한도 우회·중복 지급 방지)
  const saved = saveShareLog({
    date: today,
    count: log.date === today ? log.count + 1 : 1,
  });
  if (!saved) return 0;

  addRewardBalance(REWARD_PER_SHARE);
  logShareReward(kind);
  // 어드민 집계 kind 는 기존대로 'share' 유지 (초대·공유 합산 지표 연속성)
  track('reward_earned', { kind: 'share', amount: REWARD_PER_SHARE });
  return REWARD_PER_SHARE;
}

/**
 * 앱인토스 "공유 리워드" moduleId — 토스 콘솔 미니앱 > 공유 리워드 메뉴의 UUID.
 * ⚠️ 콘솔 값과 반드시 일치해야 contactsViral 화면이 정상 노출됨.
 */
export const TOSS_VIRAL_MODULE_ID = '0a21ea14-951b-4abb-8484-aaf61b0123b8';

/**
 * 통합 공유 — 앱 전체의 모든 공유 진입점은 이 함수 하나만 호출.
 *
 *   앱인토스: contactsViral (토스 공식 "공유 리워드" 화면 — 친구 목록 + 운받기).
 *             sendViral(친구 공유 실제 완료) 이벤트 시에만 일 3회 한도로 적립.
 *   웹:       navigator.share 폴백 — 완료 시 일 3회 한도로 적립.
 *
 *   2026-05-21 — 준기 지시로 전 앱 공유를 토스 SDK contactsViral 로 통일.
 *   (웹 런칭 시 웹 분기 별도 보강 필요 — 현재는 토스 우선.)
 *   ⚠️ SDK 3.4.1 타입 기준 contactsViral 은 @deprecated ("사용 권장 X") — Promotion.openContactsInvite 도 동일하게
 *     deprecated 표시라 1:1 대체 API 는 없음. 새 바이럴 API 는 `Viral`(getCampaign / share / track) 네임스페이스.
 */
export async function inviteFriendsViaToss(opts?: {
  onReward?: (earned: number) => void; // 리워드 적립 (earned 운)
  onShared?: () => void;               // 공유 완료했으나 한도 초과 등 미적립
  onCancel?: () => void;               // 취소·실패
}): Promise<void> {
  // 측정 — 공유 시도 (C2 · 친구 초대 트리거)
  //   2026-06-24 마케팅 차원 보강 — share.ts 와 동일하게 page + balance 첨부 (잔액대별 초대 성향).
  track('share_click', {
    type: 'invite',
    page: typeof window !== 'undefined' ? window.location.pathname : '',
    balance: Math.round(getBalance()),
  });
  const { isAppsInToss } = await import('@/services/payment/iapService');
  if (isAppsInToss()) {
    try {
      const { contactsViral } = await import('@apps-in-toss/web-framework');
      contactsViral({
        options: { moduleId: TOSS_VIRAL_MODULE_ID },
        onEvent: (event: any) => {
          if (event?.type === 'sendViral') {
            const earned = claimShareReward('invite'); // 일 3회 한도 (claimShareReward 내장)
            // 2026-07-03 바이럴 퍼널 — 공유 '성사' 측정. 일 3회 한도 초과분(rewarded:0)도
            //   실제 친구 공유 완료이므로 반드시 기록 (기존엔 reward_earned 만 있어 4번째~ 공유가 유령).
            track('share_complete', { type: 'invite', method: 'toss_viral', rewarded: earned > 0 ? 1 : 0 });
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
      const earned = claimShareReward('invite');
      track('share_complete', { type: 'invite', method: 'web_share', rewarded: earned > 0 ? 1 : 0 });
      if (earned > 0) opts?.onReward?.(earned);
      else opts?.onShared?.();
    } catch {
      opts?.onCancel?.(); // 취소 = 시도(share_click)만 남음 → 어드민에서 시도-성사 델타로 취소율 파생
    }
  } else {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      // 클립보드 복사는 '약한 성사' — method 로 구분해 집계 (실공유 여부 불명)
      track('share_complete', { type: 'invite', method: 'clipboard', rewarded: 0 });
    } catch { /* noop */ }
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
