/**
 * 앱인토스 뒤로가기 분기 SSOT (2026-07-28 신설)
 *
 * 배경: `graniteEvent.addEventListener('backEvent', …)` 를 구독하면 공식 문서 기준
 *   **"기본 뒤로가기는 차단"** 된다. 즉 구독하는 순간 모든 경로를 앱이 책임져야 하고,
 *   한 갈래라도 빠뜨리면 유저가 그 화면에 갇힌다. 그런데 판정 로직이 SDK 콜백 안에
 *   인라인으로 있으면 **테스트가 불가능**해서, 실기기에 올려보기 전엔 검증할 방법이 없다.
 *   → 순수 함수로 분리해 전 경로를 자동 검증하고, App.tsx 는 '실행'만 담당한다.
 *
 * 규칙 (우선순위 순):
 *   1. 홈('/' · '/home')            → 미니앱 종료 (뒤로 갈 곳이 없음)
 *   2. 결과 페이지('/result…')      → 홈. 뒤로 갔다가 '/loading' 으로 되돌아가면
 *                                     재생성이 트리거될 수 있어 히스토리를 타지 않는다.
 *   3. 히스토리 없음(length <= 1)   → 홈. 프로모 딥링크·공유 링크로 첫 진입한 경우
 *                                     history.back() 이 무동작이라 갇힌다.
 *   4. 그 외                        → 일반 뒤로가기
 */

export type BackAction =
  /** 미니앱 종료 (SDK closeView) */
  | { kind: 'close' }
  /** 홈으로 이동 (히스토리 미사용) */
  | { kind: 'home' }
  /** 일반 뒤로가기 (history.back) */
  | { kind: 'back' };

/**
 * @param pathname 현재 경로 (window.location.pathname)
 * @param historyLength 현재 히스토리 길이 (window.history.length)
 */
export function resolveBackAction(pathname: string, historyLength: number): BackAction {
  // 방어: 비정상 입력이면 '홈'으로. (앱 종료는 되돌릴 수 없으므로, 판단 불가일 때 택하지 않는다)
  //   window.location.pathname 은 항상 유효 문자열이라 실제로는 도달하지 않는 경로.
  if (typeof pathname !== 'string' || pathname.length === 0) return { kind: 'home' };
  const path = pathname;

  // 1) 홈 → 앱 종료
  if (path === '/' || path === '/home') return { kind: 'close' };

  // 2) 결과 페이지 → 홈 (로딩 재진입에 의한 재생성 방지)
  if (path.startsWith('/result')) return { kind: 'home' };

  // 3) 히스토리가 없으면 back() 이 무동작 → 홈으로 탈출구 제공
  if (!Number.isFinite(historyLength) || historyLength <= 1) return { kind: 'home' };

  // 4) 일반 뒤로가기
  return { kind: 'back' };
}
