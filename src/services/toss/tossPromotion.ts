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
  /** 사주 프로모션 50원 — 미션 "무료 사주보기" · 콘솔 2026-07-28 승인 (예산 10만원 = 2,000건 상한)
   *
   *  2026-07-14 준기 결정: 10원 → 50원 상향. 근거: 구 프로모(01KTRSZ...) 가 한 달 누적 273건
   *   (2,730원)에 그쳐 토스 혜택탭 가시성 자체가 낮다고 판단. 비용 리스크(273건 기준 월 13,650원)가
   *   작아 싸게 돌려볼 실험. 유닛 이코노믹스상 500~1,000원(토스 표준대)은 종합사주 2,500원 대비 과함.
   *
   *  ⚠️ 토스 콘솔은 승인된 프로모션의 금액 수정이 불가 → 금액 변경 = 새 프로모션 생성 = 새 코드 =
   *   .ait 재빌드·재심사. 코드/금액은 반드시 콘솔 값과 일치해야 하며 어긋나면 errorCode 반환.
   *  ⚠️ 구 코드(01KTRSZ5JQ8ETHH3QQD9S3QSEX, 10원)는 심사 통과 전 구버전 앱이 계속 호출하므로
   *   콘솔에서 먼저 종료하지 말 것 (종료 시 그 기간 지급 0). 신버전 배포 확인 후 종료.
   *  검증: `?_promotest=launch` 로 TEST_ 코드 지급 호출. */
  LAUNCH_SAJU: { code: '01KYM4E5PJ4FP2ZFEG5JPDV6PZ', amount: 50 },
  /** 사주500 · 7일 출석 완주 리워드 — 7일 연속 완주마다 반복 지급 (100원, 토스 콘솔 고정형) */
  ATTEND_7DAY: { code: '01KPQJYBWK3T1XY7XPPBYDA530', amount: 100 },
} as const;

export type PromoItem = { code: string; amount: number };

/**
 * 프로모션 코드 — 출시 전(테스트) = `TEST_` 접두사 / 출시 후(LIVE) = raw 코드.
 *
 * 2026-05-21 확정 (준기 콘솔 확인): 토스 콘솔에 테스트 프로모션이 `TEST_` 접두사
 *   코드로 별도 등록돼 있음. raw 코드는 LIVE 프로모션.
 *   - 테스트: TEST_01KPQJYBWK3T1XY7XPPBYDA530 (7일완주) / TEST_01KYM4E5PJ4FP2ZFEG5JPDV6PZ (50원 · 2026-07-28 신규 · 구 01KTRSZ 10원 대체)
 *   LIVE 전환 시 .env 에 VITE_PROMO_LIVE=1 → raw 코드로 전환.
 *   ⚠️ 금액 변경 시 토스 콘솔 프로모션 설정도 같은 값으로 맞출 것 (2026-07-14 50원 상향).
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
      // 2026-06-24 — 프로모 실지급을 어드민에 가시화. 기존: localStorage dedupe 만 남겨 토스 프로모(50원 첫콘텐츠·
      //   100원 7일완주)가 analytics·payments 어디에도 없어 어드민에 0 으로 보이던 것(1040원/104건 미표시 직접원인).
      //   reward_earned 는 FIRESTORE_TRACKED 기등록 + 어드민이 kind 별 분해 → code 별(promo_xxx) 즉시 집계.
      try {
        const { trackEvent } = await import('@/services/analytics');
        trackEvent('reward_earned', { kind: 'promo_' + realCode, amount: promo.amount });
      } catch { /* noop — fire-and-forget */ }
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

/** 토스 프로모션 에러코드 → 사람이 읽는 진단 (공식 문서 기준) */
const PROMO_ERROR_HINT: Record<string, string> = {
  '4100': '콘솔에 없는 프로모션 코드예요 (코드 불일치)',
  '4109': '프로모션이 실행중이 아니에요 — 콘솔에서 "시작하기" 미클릭 또는 예산 소진',
  '4110': '토스 내부 오류로 지급 실패 — 재시도 필요',
  '4111': '지급 내역을 찾을 수 없어요',
  '4112': '프로모션 예산(머니)이 부족해요',
  '4113': '이미 지급된 내역이에요 (중복 키)',
  '4114': '1회 지급 금액을 초과했어요 — 콘솔 금액과 코드의 amount 불일치 의심',
  '4116': '최대 지급 금액이 예산을 초과했어요',
  sdk_version_low: '토스앱이 5.232.0 미만이에요',
  not_in_toss: '앱인토스 환경이 아니에요 (브라우저에서는 동작 안 함)',
  already_granted: '이 기기에서 이미 호출했어요 — 강제 재시도로 다시 보낼 수 있어요',
};

/** reason 문자열에서 에러코드를 뽑아 진단 문구로 변환 */
export function describePromoFailure(reason?: string): string {
  if (!reason) return '알 수 없는 실패';
  const code = (reason.match(/\b(4\d{3})\b/) || [])[1] || reason.split(':')[0].trim();
  return PROMO_ERROR_HINT[code] ? `${reason} — ${PROMO_ERROR_HINT[code]}` : reason;
}

/**
 * 🧪 프로모션 **테스트** 호출 — `TEST_` 접두사 코드를 강제 사용 (VITE_PROMO_LIVE 무시).
 *
 * 근거(공식 문서): "실제 프로모션을 시작하기 전에 **테스트용 프로모션 코드로 최소 1회 이상 호출**해야
 *   해요… 비게임 미니앱의 테스트 코드는 샌드박스가 아닌 **토스앱(QR 코드 테스트)** 에서 호출해야 해요."
 *   → 이 호출을 마쳐야 콘솔에서 "프로모션 시작하기" 를 누를 수 있다.
 *
 * ⚠️ 기존 문제: 디버그 시트의 "프로모 TEST" 버튼이 grantLaunchPromotion() 을 불렀는데,
 *   `.env VITE_PROMO_LIVE=1` 이라 resolveCode() 가 **LIVE 코드**를 반환 → 라벨은 TEST 인데
 *   실제로는 실지급(50원 차감)이 나갔고, 정작 문서가 요구하는 TEST_ 호출은 한 번도 못 했다.
 *
 * @param force dedupe(localStorage) 를 무시하고 재호출. 테스트는 반복해야 할 수 있어 기본 true.
 */
export async function grantPromotionTest(
  promo: PromoItem,
  force = true,
): Promise<GrantResult> {
  if (!isAppsInToss()) return { ok: false, reason: 'not_in_toss' };

  const testCode = `TEST_${promo.code}`; // LIVE 플래그와 무관하게 항상 테스트 코드
  const dKey = dedupeKey(testCode);
  try {
    if (!force && window.localStorage.getItem(dKey)) {
      return { ok: false, reason: 'already_granted' };
    }
  } catch { /* noop */ }

  try {
    const mod: any = await import('@apps-in-toss/web-framework');
    const grant = mod.grantPromotionReward;
    if (typeof grant !== 'function') return { ok: false, reason: 'sdk_unsupported' };

    const result = await grant({ params: { promotionCode: testCode, amount: promo.amount } });

    if (result && typeof result === 'object' && 'key' in result) {
      try { window.localStorage.setItem(dKey, String(Date.now())); } catch { /* noop */ }
      return { ok: true, rewardKey: (result as any).key };
    }
    if (result && typeof result === 'object' && 'errorCode' in result) {
      return { ok: false, reason: `${(result as any).errorCode}: ${(result as any).message ?? ''}` };
    }
    if (result === undefined) return { ok: false, reason: 'sdk_version_low' };
    return { ok: false, reason: 'unknown_error' };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'exception' };
  }
}

/** 출시 프로모션 TEST 호출 (콘솔 "시작하기" 활성화용) */
export async function testLaunchPromotion(force = true): Promise<GrantResult> {
  return grantPromotionTest(PROMO.LAUNCH_SAJU, force);
}

/** 7일 완주 프로모션 TEST 호출 */
export async function test7DayPromotion(force = true): Promise<GrantResult> {
  return grantPromotionTest(PROMO.ATTEND_7DAY, force);
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
