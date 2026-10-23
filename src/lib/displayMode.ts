/**
 * 홈 화면 앱(웹 PWA) 판정 기초 (2026-10-23)
 *
 *   다른 모듈을 끌어오지 않는 작은 함수만 둔다. inAppBrowser.ts, authService.ts, analytics.ts, lib/pwa.ts 가 같이 쓴다.
 *   - 아이폰, 아이패드: 홈 화면에서 연 사주500은 navigator.standalone === true (사파리 탭에서는 false)
 *   - 안드로이드 크롬과 그 밖의 설치 앱: (display-mode: standalone)
 *   - 토스 앱 안(앱인토스)과 앱 빌드는 언제나 '브라우저'로 본다. 홈 화면 앱 안내와 뒤로 버튼이 앱에 새면 안 된다.
 *   fullscreen 은 넣지 않는다. PC 크롬 전체 화면(F11)도 (display-mode: fullscreen) 이 되어 잘못 잡힌다.
 */

function inTossOrAppBuild(): boolean {
  if (import.meta.env.VITE_BUILD_TARGET === 'appintos') return true;
  return typeof navigator !== 'undefined' && /TossApp/i.test(navigator.userAgent || '');
}

/** 홈 화면에 추가한 사주500으로 열려 있나 (웹만, 토스 안과 앱 빌드는 false) */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (inTossOrAppBuild()) return false;
  try {
    if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  } catch { /* noop */ }
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch { /* noop */ }
  return false;
}

/** 아이폰, 아이패드, 아이팟. 아이패드 사파리는 UA 가 Macintosh 라서 터치 지점 수로 가린다 */
export function isIosDevice(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (!/Macintosh/i.test(ua) || typeof navigator === 'undefined') return false;
  return (navigator.maxTouchPoints || 0) > 1;
}

export function isAndroidDevice(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /Android/i.test(ua);
}

/** 아이폰, 아이패드 홈 화면 앱 — 사파리와 저장 공간이 따로다(로그인과 기기 잔액이 따라오지 않는다) */
export function isIosStandalone(): boolean {
  return isStandaloneDisplay() && isIosDevice();
}

/** 분석 기록용 한 단어 */
export function displayModeLabel(): 'standalone' | 'browser' {
  return isStandaloneDisplay() ? 'standalone' : 'browser';
}
