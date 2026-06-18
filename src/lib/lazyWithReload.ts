import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * lazyWithReload — dynamic import 실패 시 화이트 스크린 대신 1회 자동 새로고침. (2026-06-18)
 *
 * 배경: 코드 스플리팅된 페이지 청크는 빌드마다 해시가 바뀐다. 유저가 앱을 띄워둔 상태에서
 *   새 배포가 나가면, 메모리의 옛 앱은 사라진 옛 청크 해시를 가리킨다 → 새 페이지로 이동 시
 *   청크 404 → import reject → (Suspense 바깥/안에서) 화이트 스크린 또는 에러. 모바일 네트워크
 *   순단도 같은 증상. "콘텐츠 보면 자꾸 화이트 / 결과가 안 나온다" CS 의 유력 원인.
 *
 * 처치: import 가 실패하면 세션당 1회 window.location.reload() → index.html(no-cache)이 최신
 *   청크 참조를 다시 내려줌 → 정상 로드. 리로드 중엔 영원히 pending 인 promise 를 반환해
 *   에러를 surface 하지 않고 스피너(PageFallback)를 유지한다. 이미 1회 리로드했는데도 실패하면
 *   (진짜 깨진 배포) 에러를 전파 → ErrorBoundary 안내 화면. → 무한 리로드 루프 없음.
 *
 * 안전성: 순수 additive. 정상 로드 시 동작 0. 최악의 경우라도 리로드 1회뿐(돈/상태 변형 없음).
 */
const RELOAD_FLAG = 'saju500:chunk_reloaded';

// React.lazy 원형과 동일하게 ComponentType<any> — props 있는 페이지도 수용.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err: unknown) => {
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
          // 리로드 진행 중 — resolve/reject 둘 다 안 함 → 스피너 유지, 에러 노출 X
          return new Promise<{ default: T }>(() => { /* never settles */ });
        }
      } catch { /* sessionStorage 불가(시크릿 등) — 그냥 에러 전파 */ }
      throw err;
    }),
  );
}

/** 앱이 정상 마운트되면 호출 — 다음 청크 실패도 다시 1회 리로드 받을 수 있게 플래그 해제. */
export function clearChunkReloadFlag(): void {
  try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* noop */ }
}
