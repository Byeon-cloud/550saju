/**
 * @deprecated 2026-04-22
 *
 * `usePathVariant` 는 `useUserPath` 로 리네임되었습니다.
 * (근거: PC_인수인계_2026_04_21 §8 P0.1 — 훅 이름 SSOT 일치)
 *
 * 본 파일은 **재노출 shim** 이며, 과거 import 를 깨뜨리지 않기 위해 유지됩니다.
 * 신규 코드는 반드시 `@/hooks/useUserPath` 를 직접 import 하세요.
 *
 * shim 제거 조건:
 *   - 전 repo 에 `usePathVariant` · `PathVariant` · `PathVariantState` 참조 0건 확인
 *   - 준기 승인 후 일괄 삭제
 *
 * 원본 히스토리: git log src/hooks/usePathVariant.ts (2026-04-21 이전 커밋)
 */

import { useUserPath } from './useUserPath';
import type { UserPath, UserPathState } from './useUserPath';
import { __internal as __useUserPathInternal } from './useUserPath';

/** @deprecated `UserPath` 사용 */
export type PathVariant = UserPath;

/**
 * @deprecated `UserPathState` 사용
 *
 * 구 shape (`variant` / `hasProfile` / `paidCount` / `premiumCount`) → 신 shape 매핑.
 * count 필드는 boolean flag 로 축약되었으므로 0 또는 1 로 근사 제공.
 */
export interface PathVariantState {
  variant: PathVariant;
  hasProfile: boolean;
  /** @deprecated hasPaidAny 참조. 정확 건수는 제공하지 않음 (0 또는 1 근사) */
  paidCount: number;
  /** @deprecated hasPaid5000 참조. 정확 건수는 제공하지 않음 (0 또는 1 근사) */
  premiumCount: number;
  ready: boolean;
}

/**
 * @deprecated `useUserPath` 사용.
 *
 * 구 API 호환 어댑터. 내부는 `useUserPath` 를 호출 후 shape 매핑만 담당.
 */
export function usePathVariant(): PathVariantState {
  const s: UserPathState = useUserPath();
  return {
    variant: s.path,
    hasProfile: s.hasSaju,
    paidCount: s.hasPaidAny ? 1 : 0,
    premiumCount: s.hasPaid5000 ? 1 : 0,
    ready: s.ready,
  };
}

/** @deprecated `useUserPath` 의 `__internal` 사용 */
export const __internal = __useUserPathInternal;
