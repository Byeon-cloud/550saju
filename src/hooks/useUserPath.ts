/**
 * useUserPath — 유저 상태 기반 홈 v5 Path 분기 (A/B/C/D)
 *
 * 근거:
 *   - PC_인수인계_2026_04_21 §3 (Path 판별 로직 SSOT)
 *   - docs/prd/홈v5_Path분기_9종mockup_라벨링_번들.md §1
 *
 * Path 판별 (인수인계 §3 그대로):
 *   if (!user.hasSaju)     return 'A'   // Cold — 사주 입력 전
 *   if (!user.hasPaidAny)  return 'B'   // Warm — 입력·미결제
 *   if (!user.hasPaid5000) return 'C'   // Hot  — 500원 결제 · 프리미엄 미구매
 *   if (user.hasPaid5000)  return 'D'   // Loyal — 5000원 프리미엄 구매
 *
 *   Path E (예외: 결제실패 · NotFound 등)는 홈 분기가 아니므로 본 훅 미포함.
 *
 * 판별 기준 (ContentType):
 *   - hasPaidAny     (500원급) : type='paid' AND contentType ∈ {'report', 'topic', 'deepDream'}
 *   - hasPaid5000 (5000원급) : contentType ∈ {'daeun', 'monthly', 'compat', 'tojung'}
 *     (가격 v3.1: 대운·월운·궁합·토정비결 = 5,000원 프리미엄 확장)
 *
 * 주의:
 *   - 로컬 스토리지 동기 API (useHomeData 동일 패턴). Firestore 동기화는 상위에서.
 *   - 브라우저 스토리지 접근 실패 시 Path A fallback (가장 보수적).
 */

import { useEffect, useState } from 'react';
import { getReports, getMyProfile, getProfiles } from '@/services/storage/localStore';
import type { ContentType, LocalReport } from '@/services/storage/localStore';

export type UserPath = 'A' | 'B' | 'C' | 'D';

export interface UserPathState {
  /** 최종 Path 분기 (A/B/C/D) */
  path: UserPath;
  /** 사주 프로필 입력 여부 */
  hasSaju: boolean;
  /** 500원급 이상 유료 결제 1건 이상 여부 */
  hasPaidAny: boolean;
  /** 5000원급 프리미엄 확장 1건 이상 여부 */
  hasPaid5000: boolean;
  /** 판별 완료 여부 (false 동안은 skeleton / Path A fallback) */
  ready: boolean;
}

const PAID_TIER_TYPES: ReadonlyArray<ContentType> = ['report', 'topic', 'deepDream'];
const PREMIUM_TIER_TYPES: ReadonlyArray<ContentType> = ['daeun', 'monthly', 'compat', 'tojung'];

function isPaidTier(r: LocalReport): boolean {
  if (r.type !== 'paid') return false;
  return r.contentType !== undefined && PAID_TIER_TYPES.includes(r.contentType);
}

function isPremiumTier(r: LocalReport): boolean {
  // 프리미엄 확장은 type 무관 (확장 상품 자체가 유료)
  return r.contentType !== undefined && PREMIUM_TIER_TYPES.includes(r.contentType);
}

/**
 * 인수인계 §3 Path 분기 로직.
 *   Path A: !hasSaju
 *   Path B: hasSaju && !hasPaidAny
 *   Path C: hasSaju && hasPaidAny && !hasPaid5000
 *   Path D: hasSaju && hasPaidAny && hasPaid5000
 */
function derive(hasSaju: boolean, hasPaidAny: boolean, hasPaid5000: boolean): UserPath {
  if (!hasSaju) return 'A';
  if (!hasPaidAny) return 'B';
  if (!hasPaid5000) return 'C';
  return 'D';
}

/**
 * 유저 상태 → Path A/B/C/D 변형 훅.
 *
 * @returns `path` + 판별 flag 3종 + `ready`.
 *   판별 미완료 상태에서는 path='A' · ready=false 로 반환 (skeleton 분기 용).
 */
export function useUserPath(): UserPathState {
  const [state, setState] = useState<UserPathState>({
    path: 'A',
    hasSaju: false,
    hasPaidAny: false,
    hasPaid5000: false,
    ready: false,
  });

  useEffect(() => {
    try {
      const my = getMyProfile();
      const profiles = getProfiles();
      const hasSaju = !!my || (profiles && profiles.length > 0);

      const reports = getReports();
      const hasPaidAny = reports.some(isPaidTier) || reports.some(isPremiumTier);
      const hasPaid5000 = reports.some(isPremiumTier);

      const path = derive(hasSaju, hasPaidAny, hasPaid5000);

      setState({
        path,
        hasSaju,
        hasPaidAny,
        hasPaid5000,
        ready: true,
      });
    } catch {
      // 스토리지 접근 실패 → 가장 보수적인 Path A 유지 + ready=true (무한 skeleton 방지)
      setState({
        path: 'A',
        hasSaju: false,
        hasPaidAny: false,
        hasPaid5000: false,
        ready: true,
      });
    }
  }, []);

  return state;
}

/** 테스트·스토리북 용 순수 함수 재노출. */
export const __internal = {
  derive,
  isPaidTier,
  isPremiumTier,
  PAID_TIER_TYPES,
  PREMIUM_TIER_TYPES,
};
