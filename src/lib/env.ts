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

/**
 * 토스 네이티브 내비게이션 바(뒤로가기 버튼 포함)가 화면 상단에 떠 있는 환경인가.
 * **자체 뒤로가기 버튼 숨김 판정의 SSOT** — 헤더·하단바 어디든 '이전 화면/단계로' 버튼은 이걸로 가린다.
 *
 * 근거 (2026-09-16 토스 심사 반려): "내비게이션 바의 뒤로가기 버튼과 미니앱 자체 헤더 및
 *   뒤로가기 버튼이 함께 노출돼요. 중복된 버튼을 제거해 주세요."
 *   출시 체크리스트: 토스 제공 뒤로가기와 미니앱 자체 뒤로가기가 동시에 보이면 안 됨.
 *   SDK `defineConfig` 기본값 `navigationBar.withBackButton: true` (2.x·3.x 동일).
 *
 * ⚠️ 새 자체 뒤로가기를 만들 때: 동작이 '이전 화면'(라우트)이면 이 플래그로 숨기기만 하면 된다
 *   (토스 뒤로가기가 App.tsx backEvent → backNavigation.ts 로 동일 처리). 페이지 내부 단계(state)
 *   이동이었다면 숨기는 순간 그 동작이 사라지므로 토스 backEvent 쪽에 따로 연결해야 한다.
 */
export const hasNativeNavBack: boolean =
  isAppintosBuild ||
  (typeof navigator !== 'undefined' && /TossApp/i.test(navigator.userAgent)) ||
  (typeof window !== 'undefined' && window.location.href.includes('intoss://')) ||
  (typeof document !== 'undefined' && !!document.querySelector('meta[name="apps-in-toss"]'));

/** 웹앱 빌드 여부 (앱인토스 아니면 기본 웹앱). */
export const isWebAppBuild: boolean = !isAppintosBuild;

/** 빌드 타겟 문자열 (디버그 노출용). */
export const BUILD_TARGET = buildTarget;
