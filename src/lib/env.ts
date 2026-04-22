// v4.1 · P0-A·C 공통 · 앱인토스 빌드/런타임 감지 (2026-04-21 D-1)
// 근거: PC_PATCH_A_TOSSPAY_SIMPLIFY.md §7 · audit_responsive_360x640.md §7-2
//
// 사용처:
//   - `/charge` 결제 수단 분기 (앱인토스 = 토스페이 1종)
//   - TopBar.showBack 분기 (앱인토스 네이티브 뒤로가기 중복 방지)
//   - 결제 페이지 라벨 분기 ("토스페이로 결제" vs "결제")

/** 빌드 타임 타겟 — Vite 환경변수 `VITE_BUILD_TARGET=appintos | webapp` */
const buildTarget =
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_BUILD_TARGET : undefined) ?? 'webapp';

/** 런타임 UA fallback — 앱인토스 WebView가 InTossApp 식별자 노출 */
function detectInTossApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /InTossApp/i.test(navigator.userAgent);
}

/** 앱인토스 빌드 또는 앱인토스 WebView 런타임 여부. */
export const isAppintosBuild: boolean = buildTarget === 'appintos' || detectInTossApp();

/** 웹앱 빌드 여부 (앱인토스 아니면 기본 웹앱). */
export const isWebAppBuild: boolean = !isAppintosBuild;

/** 빌드 타겟 문자열 (디버그 노출용). */
export const BUILD_TARGET = buildTarget;
