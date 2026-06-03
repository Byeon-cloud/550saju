/**
 * 토스 프로모션 (토스 포인트 지급) — 비게임 미니앱 SDK 직접 방식
 *
 * 2026-05-09 전면 재작성 (심사 후 — analytics.logEvent 방식은 프로모션 활성화 X 확인):
 *   이전 코드는 `analytics.logEvent(eventName)` 만 호출 → 토스 콘솔 프로모션이
 *   "테스트 호출 0회" 라 활성화 안 됨. 비게임 미니앱은 `grantPromotionReward`
 *   SDK 함수를 프로모션 코드로 직접 호출해야 함.
 *
 * 공식 API (developers-apps-in-toss.toss.im/bedrock/reference/framework/비게임/promotion):
 *   import { grantPromotionReward } from '@apps-in-toss/web-framework';
 *   const result = await grantPromotionReward({ params: { promotionCode, amount } });
 *   // result: { key } 성공 | { errorCode, message } 실패 | 'ERROR' | undefined(버전미만)
 *
 * 정책:
 *   - 토스앱 5.232.0+ / SDK 2.0.8+ 에서 동작
 *   - 출시 전: TEST_ prefix 코드로 최소 1회 호출 → 콘솔 "시작하기" 활성화
 *   - 출시 후: 찐 코드로 전환 (VITE_PROMO_LIVE=1)
 *   - 중복 호출 시 중복 지급 → localStorage 방어 로직 필수
 *
 * @see https://developers-apps-in-toss.toss.im/promotion/develop.html
 */

import { isAppsInToss } from '@/services/payment/iapService';

/**
 * 토스 콘솔 등록 프로모션 코드 SSOT
 * (토스 developer 콘솔 → 프로모션 → 각 항목의 "프로모션 코드")
 */
export const PROMO = {
  /** 사주500 출시 프로모션 — 미션 "사주풀이 하기", 3원 지급 */
  LAUNCH_SAJU: { code: '01KS4XVNTSTJW8VG595GTDYNNE', amount: 3 },
  /** 사주500 · 7일 출석 완주 리워드 — 7일 연속 출석 완주 시 1회 (100원, 토스 콘솔 고정형) */
  ATTEND_7DAY: { code: '01KPQJYBWK3T1XY7XPPBYDA530', amount: 100 },
} as const;

export type PromoItem = { code: string; amount: number };

/**
 * 프로모션 코드 — 출시 전(테스트) = `TEST_` 접두사 / 출시 후(LIVE) = raw 코드.
 *
 * 2026-05-21 확정 (준기 콘솔 확인): 토스 콘솔에 테스트 프로모션이 `TEST_` 접두사
 *   코드로 별도 등록돼 있음. raw 코드는 LIVE 프로모션(출시 후 실행).
 *   - 테스트: TEST_01KPQJYBWK3T1XY7XPPBYDA530 (7일완주) / TEST_01KS4XVNTSTJW8VG595GTDYNNE (출시 · 2026-05-27 정정)
 *   출시 시 .env 에 VITE_PROMO_LIVE=1 → raw 코드로 전환.
 */
const PROMO_LIVE = import.meta.env.VITE_PROMO_LIVE === '1';

function resolveCode(code: string): string {
  return PROMO_LIVE ? code : `TEST_${code}`;
}

/** 중복 지급 방지 키 (코드 단위 — TEST/LIVE 별도 추적) */
function dedupeKey(resolvedCode: string): string {
  return `saju500:promo_granted:${resolvedCode}`;
}

export interface GrantResult {
  ok: boolean;
  /** 'already_granted' | 'not_in_toss' | 'sdk_unsupported' | 'sdk_version_low' | errorCode | 'exception' */
  reason?: string;
  rewardKey?: string;
}

/**
 * 프로모션 리워드 지급 (서버 없이 SDK 직접 — grantPromotionReward).
 * 중복 방지 + TEST/LIVE 분기 내장. 앱인토스 환경에서만 동작.
 */
export async function grantPromotion(promo: PromoItem): Promise<GrantResult> {
  if (!isAppsInToss()) return { ok: false, reason: 'not_in_toss' };

  const realCode = resolveCode(promo.code);
  const dKey = dedupeKey(realCode);

  // 중복 지급 방지 — 이미 지급 성공한 코드면 skip
  try {
    if (window.localStorage.getItem(dKey)) {
      return { ok: false, reason: 'already_granted' };
    }
  } catch { /* localStorage 접근 불가 — 계속 진행 */ }

  try {
    const mod: any = await import('@apps-in-toss/web-framework');
    const grant = mod.grantPromotionReward;
    if (typeof grant !== 'function') return { ok: false, reason: 'sdk_unsupported' };

    const result = await grant({
      params: { promotionCode: realCode, amount: promo.amount },
    });

    // { key } 성공
    if (result && typeof result === 'object' && 'key' in result) {
      try { window.localStorage.setItem(dKey, String(Date.now())); } catch { /* noop */ }
      return { ok: true, rewardKey: (result as any).key };
    }
    // { errorCode, message } 실패
    if (result && typeof result === 'object' && 'errorCode' in result) {
      return { ok: false, reason: `${(result as any).errorCode}: ${(result as any).message ?? ''}` };
    }
    // undefined = 최소 지원 버전 미만 (토스앱 < 5.232.0)
    if (result === undefined) return { ok: false, reason: 'sdk_version_low' };
    // 'ERROR' 또는 기타
    return { ok: false, reason: 'unknown_error' };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'exception' };
  }
}

/**
 * 출시 프로모션 — "사주풀이 하기" 미션 (3원).
 * 첫 사주 분석 완료 시점에 호출.
 */
export async function grantLaunchPromotion(): Promise<GrantResult> {
  return grantPromotion(PROMO.LAUNCH_SAJU);
}

/**
 * 7일 출석 완주 리워드.
 * 7일 연속 출석 완료 시점에 호출 (출석 추적은 dailyReward.ts).
 */
export async function grant7DayAttendance(): Promise<GrantResult> {
  return grantPromotion(PROMO.ATTEND_7DAY);
}

/* ─────────────────────────────────────────────────────────────
 * 레거시 호환 — 기존 triggerPromotionEvent / PROMO_EVENTS 사용처 보존.
 *   ChargePage·ChatSessionPage·InputPage·LoadingPage 가 import 중.
 *   FIRST_SAJU 이벤트만 실제 프로모션(출시 — 사주풀이 하기)으로 매핑.
 *   나머지(CHARGE·CHAT_START·DAILY_FORTUNE)는 콘솔에 매칭 프로모션 없으면 no-op.
 * ──────────────────────────────────────────────────────────── */

export const PROMO_EVENTS = {
  FIRST_SAJU: 'first_saju_complete',
  SHARE_RESULT: 'share_result',
  DAILY_FORTUNE: 'daily_fortune_view',
  CHARGE: 'charge_complete',
  CHAT_START: 'chat_first_message',
} as const;

/**
 * @deprecated analytics.logEvent 방식은 프로모션 활성화 X.
 *   호환 유지용 — FIRST_SAJU 만 실제 grantPromotion 으로 매핑.
 *   신규 코드는 grantLaunchPromotion() / grant7DayAttendance() 직접 사용 권장.
 */
export async function triggerPromotionEvent(
  eventName: string,
  _params?: Record<string, string>,
): Promise<void> {
  if (!isAppsInToss()) return;

  // 첫 사주 완료 → 출시 프로모션 "사주풀이 하기" 지급
  if (eventName === PROMO_EVENTS.FIRST_SAJU) {
    await grantLaunchPromotion();
  }
  // CHARGE / CHAT_START / DAILY_FORTUNE / SHARE_RESULT —
  // 현재 콘솔에 매칭 프로모션 없음. 추후 콘솔 등록 시 PROMO 에 코드 추가 + 매핑.
}
