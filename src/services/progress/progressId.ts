/**
 * progressId — 점진 로딩 좌표 id + 기능 플래그 (2026-07-01)
 *
 *  - 클라가 추측 불가 UUID 를 생성해 생성 요청(callable data / SSE body)에 실어 보냄.
 *    서버는 그 id 의 progress/{id} 에 그룹별 증분 write → 클라가 같은 id 구독.
 *  - 플래그 OFF 면 호출측이 점진 레이어를 통째로 건너뜀(기존 거동 100% 동일).
 */

/** 추측 불가 점진 좌표 id (UUID 우선, 폴백은 random+time) */
export function makeProgressId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* noop */
  }
  return 'pg_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * 점진 로딩 기능 플래그. OFF(기본)면 호출측이 점진 레이어를 건너뛰고 기존 로딩 게이트 유지.
 * .env: VITE_PROGRESSIVE_ENABLED=true 로 ON.
 */
export function isProgressiveEnabled(): boolean {
  try {
    return import.meta.env.VITE_PROGRESSIVE_ENABLED === 'true';
  } catch {
    return false;
  }
}

/**
 * ⚡ async 2차리뷰 기능 플래그. ON 이면 주간/월간을 draft(1차·즉시노출) + refine(2차·백그라운드) 2콜로.
 * 체감 로딩 반토막. OFF(기본)면 기존 단일 콜(1차+2차) 그대로.
 * .env: VITE_ASYNC_REVIEW_ENABLED=true 로 ON.
 */
export function isAsyncReviewEnabled(): boolean {
  try {
    return import.meta.env.VITE_ASYNC_REVIEW_ENABLED === 'true';
  } catch {
    return false;
  }
}
