/**
 * 토스 프로모션 / 공유 리워드 / 스마트발송 연결
 *
 * 1. 프로모션 (토스 포인트)
 *    - 앱인토스 콘솔에서 설정
 *    - 사용자가 특정 액션 완료 시 토스 포인트 지급
 *    - "혜택탭"에 노출되어 유입 증가
 *
 * 2. 공유 리워드
 *    - 토스 친구에게 공유 → 친구가 앱 진입 → 리워드 지급
 *    - SDK에서 자동 처리 (콘솔에서 리워드 설정)
 *
 * 3. 스마트발송 (세그먼트 푸시)
 *    - 앱인토스 콘솔에서 세그먼트 설정
 *    - 타겟 유저에게 푸시 발송
 *    - SDK 코드 불필요 (콘솔에서 관리)
 *
 * @see https://developers-apps-in-toss.toss.im/development/reward.html
 */

import { isAppsInToss } from '@/services/payment/iapService';

/**
 * 프로모션 이벤트 트리거
 * 사용자가 특정 액션을 완료했을 때 호출
 * 앱인토스 콘솔에서 설정한 조건과 매칭되면 토스 포인트 지급
 */
export async function triggerPromotionEvent(eventName: string, params?: Record<string, string>): Promise<void> {
  if (!isAppsInToss()) return;

  try {
    const sdkName = '@apps-in-toss/' + 'web-framework';
    const mod = await import(/* @vite-ignore */ sdkName);

    // 앱인토스 analytics 이벤트 발송
    // 콘솔에서 이 이벤트명에 연결된 프로모션이 있으면 자동으로 포인트 지급
    mod.analytics?.logEvent?.(eventName, params || {});
  } catch { /* 무시 */ }
}

/**
 * 주요 프로모션 이벤트:
 * - 'first_saju_complete'  : 첫 사주 분석 완료 → 토스 포인트 지급
 * - 'share_result'         : 결과 공유 → 공유 리워드
 * - 'daily_fortune_view'   : 일일 운세 확인 → 재방문 유도
 * - 'charge_complete'      : 충전 완료 → VIP 혜택
 */
export const PROMO_EVENTS = {
  FIRST_SAJU: 'first_saju_complete',
  SHARE_RESULT: 'share_result',
  DAILY_FORTUNE: 'daily_fortune_view',
  CHARGE: 'charge_complete',
  CHAT_START: 'chat_first_message',
} as const;
