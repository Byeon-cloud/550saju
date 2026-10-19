/**
 * 앱 안 브라우저 판정 (2026-10-19, 웹 유료광고 준비)
 *   인스타그램, 페이스북, 카카오톡, 네이버 앱 등에서 링크를 누르면 그 앱 안의 브라우저로 열린다.
 *   구글은 이런 화면에서 로그인을 막는다(403 disallowed_useragent) → 로그인 시트에서 구글 버튼을 숨긴다.
 *   토스 앱 안(앱인토스)은 여기서 다루지 않는다(토스 로그인만 쓴다).
 */
export function inAppBrowserName(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string | null {
  if (!ua || /TossApp/i.test(ua)) return null;
  if (/KAKAOTALK/i.test(ua)) return '카카오톡';
  if (/Instagram/i.test(ua)) return '인스타그램';
  if (/Barcelona/i.test(ua)) return '스레드';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return '페이스북';
  if (/NAVER\(inapp|NAVER\//i.test(ua)) return '네이버';
  if (/DaumApps/i.test(ua)) return '다음';
  if (/\bLine\//i.test(ua)) return '라인';
  if (/everytimeApp/i.test(ua)) return '에브리타임';
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return '앱';
  if (/iPhone|iPad|iPod/i.test(ua) && !/Safari\//.test(ua)) return '앱';
  return null;
}

export const isInAppBrowser = (): boolean => inAppBrowserName() !== null;
