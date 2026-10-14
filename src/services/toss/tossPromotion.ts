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
 * ⚠️ SDK 3.4.1 타입 기준 `grantPromotionReward` 는 @deprecated → 대체 `Promotion.grantReward({ promotionCode, amount })`
 *   (파라미터가 params 래핑 없이 평평함 · 실패 시 반환이 아니라 error.code 를 담아 throw). 교체는 3.x 이행 때 함께.
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
  /** 2026-10 종료 (오너 확인 10-14) — 지급 호출은 전부 제거, 이벤트 탭 '받은 토스포인트' 과거 기록 라벨과 장부 이관에만 쓴다.
   *  사주 프로모션 50원 — 미션 "무료 사주보기" · 콘솔 2026-07-28 승인 (예산 10만원 = 2,000건 상한)
   *
   *  2026-07-14 준기 결정: 10원 → 50원 상향. 근거: 구 프로모(01KTRSZ...) 가 한 달 누적 273건
   *   (2,730원)에 그쳐 토스 혜택탭 가시성 자체가 낮다고 판단. 비용 리스크(273건 기준 월 13,650원)가
   *   작아 싸게 돌려볼 실험. 유닛 이코노믹스상 500~1,000원(토스 표준대)은 종합사주 2,500원 대비 과함.
   *
   *  ⚠️ 토스 콘솔은 승인된 프로모션의 금액 수정이 불가 → 금액 변경 = 새 프로모션 생성 = 새 코드 =
   *   .ait 재빌드·재심사. 코드/금액은 반드시 콘솔 값과 일치해야 하며 어긋나면 errorCode 반환.
   *  ⚠️ 구 코드(01KTRSZ5JQ8ETHH3QQD9S3QSEX, 10원)는 심사 통과 전 구버전 앱이 계속 호출하므로
   *   콘솔에서 먼저 종료하지 말 것 (종료 시 그 기간 지급 0). 신버전 배포 확인 후 종료.
   *  (종료 전 검증 경로였던 MyPage 디버그 버튼과 `?_promotest=launch` 도 제거) */
  LAUNCH_SAJU: { code: '01KYM4E5PJ4FP2ZFEG5JPDV6PZ', amount: 50 },
  /** 사주500 · 7일 출석 완주 리워드 — 요일 무관 7일 연속 출석마다 반복 지급 (100원, 토스 콘솔 고정형)
   *  ⚠️ 반복 지급이므로 콘솔의 1인당 지급 횟수 제한·예산이 반복 지급을 허용하는지 확인 필요. */
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

/** LIVE 코드로 실지급하는 빌드인가 — false(TEST_ 코드) 빌드의 지급은 실제 돈이 아니라 보상 장부에 기록하지 않는다 */
export const PROMO_IS_LIVE = PROMO_LIVE;

function resolveCode(code: string): string {
  return PROMO_LIVE ? code : `TEST_${code}`;
}

/**
 * 중복 지급 방지 키 — TEST/LIVE 별도 추적.
 *   cycleId 없음 = 코드 단위 영구 1회 (출시 프로모션)
 *   cycleId 있음 = 사이클 단위 1회 (7일 연속 출석 · 완주일마다 새 키 → 반복 지급)
 *   2026-09-17 fix: 7일 프로모도 코드 단위 영구 키를 써서 2번째 사이클부터 토스 미호출·'already_granted' 로 막혔다.
 *   2026-09-18 fix: TEST_ 코드 키는 `promo_test:` 로 분리 — 테스트 호출이 실지급 기록(`promo_granted:`)으로
 *     읽혀 LIVE 프로모를 지급된 것으로 막거나, 보상 장부에 실지급으로 옮겨지는 일이 없게 한다.
 */
function dedupeKey(resolvedCode: string, cycleId?: string): string {
  const prefix = resolvedCode.startsWith('TEST_') ? 'saju500:promo_test' : 'saju500:promo_granted';
  return cycleId ? `${prefix}:${resolvedCode}:${cycleId}` : `${prefix}:${resolvedCode}`;
}

/** epoch ms → KST 'YYYY-MM-DD' */
export function kstDateFromEpoch(epochMs: number): string {
  return new Date(epochMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 토스 서버 시각 (epoch ms) — 기기 시계가 아니다. 7일 토스포인트 지급 직전 날짜 검증용.
 *   SDK: `Environment.getServerTime()` (3.x) / `getServerTime()` (2.x·3.x deprecated 별칭) → Promise<number | undefined>
 *   토스앱 5.245.0 미만이면 isSupported() false. 앱인토스 밖·미지원·실패·5초 초과는 모두 null (= 지급하지 않음).
 */
export async function getTossServerTime(): Promise<number | null> {
  if (!isAppsInToss()) return null;
  try {
    const mod: any = await import('@apps-in-toss/web-framework');
    const fn = mod.Environment?.getServerTime ?? mod.getServerTime;
    if (typeof fn !== 'function') return null;
    try {
      if (typeof fn.isSupported === 'function' && !fn.isSupported()) return null;
    } catch {
      return null;
    }
    const t = await Promise.race<unknown>([
      fn(),
      new Promise((resolve) => setTimeout(() => resolve(undefined), 5000)),
    ]);
    return typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : null;
  } catch {
    return null;
  }
}

export interface GrantResult {
  ok: boolean;
  /** 'already_granted' | 'not_in_toss' | 'sdk_unsupported' | 'sdk_version_low' | errorCode | 'exception' */
  reason?: string;
  rewardKey?: string;
}

/** 같은 키로 동시에 들어온 호출은 진행 중인 1건을 공유 — 결과 화면 여러 곳이 동시에 불러도 SDK 는 1회만 */
const grantInFlight = new Map<string, Promise<GrantResult>>();

/**
 * 프로모션 리워드 지급 (서버 없이 SDK 직접 — grantPromotionReward).
 * 중복 방지 + TEST/LIVE 분기 내장. 앱인토스 환경에서만 동작.
 *
 * ⚠️ 중복 지급 방지가 **기기 저장소(localStorage)뿐**이다.
 *   - 저장소 초기화·재설치·SDK 3.x origin 변경 시 방어 기록이 사라져 같은 유저가 다시 받을 수 있다
 *     (출시 프로모션 재지급 · 7일 사이클은 출석 기록도 함께 사라져 영향 작음).
 *   - 토스 지급 성공 후 응답을 기록하기 전에 앱이 종료되면 다음 재시도가 이중 지급이 될 수 있다.
 *   → SDK 3.x 이행 전 서버화 과제 (uid·토스 userKey 기준 서버 장부 + 멱등 키).
 */
export async function grantPromotion(
  promo: PromoItem,
  opts?: { cycleId?: string },
): Promise<GrantResult> {
  if (!isAppsInToss()) return { ok: false, reason: 'not_in_toss' };

  const realCode = resolveCode(promo.code);
  const dKey = dedupeKey(realCode, opts?.cycleId);

  const running = grantInFlight.get(dKey);
  if (running) return running;

  const task = (async (): Promise<GrantResult> => {
    // 중복 지급 방지 — 이미 지급 성공한 코드(사이클)면 skip
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
  })();

  grantInFlight.set(dKey, task);
  try {
    return await task;
  } finally {
    grantInFlight.delete(dKey);
  }
}

/** 토스 프로모션 에러코드 → 사람이 읽는 진단 (공식 문서 기준) */
const PROMO_ERROR_HINT: Record<string, string> = {
  '4100': '콘솔에 없는 프로모션 코드예요 (코드 불일치)',
  '4109': '프로모션이 실행중이 아니에요, 콘솔에서 "시작하기" 미클릭 또는 예산 소진',
  '4110': '토스 내부 오류로 지급 실패: 재시도 필요',
  '4111': '지급 내역을 찾을 수 없어요',
  '4112': '프로모션 예산(머니)이 부족해요',
  '4113': '이미 지급된 내역이에요 (중복 키)',
  '4114': '1회 지급 금액을 초과했어요, 콘솔 금액과 코드의 amount 불일치 의심',
  '4116': '최대 지급 금액이 예산을 초과했어요',
  sdk_version_low: '토스앱이 5.232.0 미만이에요',
  not_in_toss: '앱인토스 환경이 아니에요 (브라우저에서는 동작 안 함)',
  already_granted: '이 기기에서 이미 호출했어요, 강제 재시도로 다시 보낼 수 있어요',
};

/** reason 문자열에서 에러코드를 뽑아 진단 문구로 변환 */
export function describePromoFailure(reason?: string): string {
  if (!reason) return '알 수 없는 실패';
  const code = (reason.match(/\b(4\d{3})\b/) || [])[1] || reason.split(':')[0].trim();
  return PROMO_ERROR_HINT[code] ? `${reason} — ${PROMO_ERROR_HINT[code]}` : reason;
}

/**
 * 프로모션 **테스트** 호출 — `TEST_` 접두사 코드를 강제 사용 (VITE_PROMO_LIVE 무시).
 *
 * 근거(공식 문서): "실제 프로모션을 시작하기 전에 **테스트용 프로모션 코드로 최소 1회 이상 호출**해야
 *   해요… 비게임 미니앱의 테스트 코드는 샌드박스가 아닌 **토스앱(QR 코드 테스트)** 에서 호출해야 해요."
 *   → 이 호출을 마쳐야 콘솔에서 "프로모션 시작하기" 를 누를 수 있다.
 *
 * ⚠️ 기존 문제: 디버그 시트의 "프로모 TEST" 버튼이 grantLaunchPromotion() 을 불렀는데,
 *   `.env VITE_PROMO_LIVE=1` 이라 resolveCode() 가 **LIVE 코드**를 반환 → 라벨은 TEST 인데
 *   실제로는 실지급(50원 차감)이 나갔고, 정작 문서가 요구하는 TEST_ 호출은 한 번도 못 했다.
 *
 * 출석 기록·보상 장부는 건드리지 않는다 (테스트 호출은 유저 보상이 아님).
 *
 * @param force dedupe(localStorage) 를 무시하고 재호출. 테스트는 반복해야 할 수 있어 기본 true.
 */
export async function grantPromotionTest(
  promo: PromoItem,
  force = true,
): Promise<GrantResult> {
  if (!isAppsInToss()) return { ok: false, reason: 'not_in_toss' };

  const testCode = `TEST_${promo.code}`; // LIVE 플래그와 무관하게 항상 테스트 코드
  // 디버그 TEST 호출 전용 키 — 실지급 기록(promo_granted:)·TEST 빌드 앱 흐름(promo_test:) 어느 쪽도 막지 않는다
  const dKey = `saju500:promo_testcall:${testCode}`;
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

/** 7일 완주 프로모션 TEST 호출 */
export async function test7DayPromotion(force = true): Promise<GrantResult> {
  return grantPromotionTest(PROMO.ATTEND_7DAY, force);
}

/**
 * 7일 연속 출석 리워드 — 사이클(완주일) 단위 1회, 사이클마다 반복.
 * 출석 판정·재시도·서버시각 검증·30일 상한·지급 기록은 dailyReward.ts (retryPendingAttend7Reward).
 *
 * 2026-09-18 보안 fix (실측: 기기 날짜를 하루씩 넘기며 결과를 다시 열어 70회 → 10회 지급 = 1,000원):
 *   사이클 키가 기기 날짜로 만들어져 가짜 날짜마다 새 키가 생겼다. → 토스 서버 시각(KST 날짜)이 완주일과 같을 때만 지급.
 *   호출부가 받은 서버 시각을 넘기고, 여기서 한 번 더 같은 날인지 확인한다 (다른 경로의 우회 호출 방지).
 * @param cycleId 완주일 KST YYYY-MM-DD (기기 날짜)
 * @param serverNow getTossServerTime() 값 (epoch ms)
 */
export async function grant7DayAttendance(cycleId: string, serverNow: number): Promise<GrantResult> {
  if (!Number.isFinite(serverNow) || kstDateFromEpoch(serverNow) !== cycleId) {
    return { ok: false, reason: 'server_date_mismatch' };
  }
  return grantPromotion(PROMO.ATTEND_7DAY, { cycleId });
}

/**
 * 기기 보상 장부 도입(2026-09-17) 이전의 토스포인트 지급 기록을 장부로 1회 옮긴다.
 *   · 출시 프로모션: 코드 단위 키가 곧 지급 성공 기록 → 같은 id 로 기록 (이후 신규 기록과 중복 안 됨)
 *   · 7일 완주: 구 구조는 코드 단위 영구 키라 실제 지급은 기기당 최대 1회였다 → 1건으로 기록
 *   운 지급(0.1운·3일·공유)은 구 구조에 기록이 없어 옮기지 못한다 (장부 since 로 안내).
 */
const LEGACY_PROMO_SEED_FLAG = 'saju500:reward_ledger:promo_seeded';

export async function seedLegacyPromoLedger(): Promise<void> {
  // TEST_ 코드 빌드의 지급 기록은 실지급이 아니므로 옮기지 않는다 (플래그도 남기지 않아 LIVE 전환 후 1회 실행)
  if (!PROMO_LIVE) return;
  try {
    if (window.localStorage.getItem(LEGACY_PROMO_SEED_FLAG)) return;
  } catch {
    return;
  }
  try {
    const { appendRewardLog } = await import('@/services/storage/dailyReward');
    const readAt = (key: string): number | null => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const at = Number(raw);
      return Number.isFinite(at) && at > 0 ? at : Date.now();
    };
    const launchCode = resolveCode(PROMO.LAUNCH_SAJU.code);
    const launchAt = readAt(dedupeKey(launchCode));
    if (launchAt !== null) {
      appendRewardLog('launch_promo', PROMO.LAUNCH_SAJU.amount, `launch_promo:${launchCode}`, launchAt);
    }
    const attendCode = resolveCode(PROMO.ATTEND_7DAY.code);
    const attendAt = readAt(dedupeKey(attendCode));
    if (attendAt !== null) {
      appendRewardLog('attend7', PROMO.ATTEND_7DAY.amount, `attend7:legacy:${attendCode}`, attendAt);
    }
    window.localStorage.setItem(LEGACY_PROMO_SEED_FLAG, '1');
  } catch { /* noop — 다음 진입 때 재시도 (id 중복 방지로 안전) */ }
}
