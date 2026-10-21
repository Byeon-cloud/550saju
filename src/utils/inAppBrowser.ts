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

/**
 * 지금 주소를 기본 브라우저로 연다 (2026-10-21, 오너: 인스타그램 안에서 구글 계정으로 로그인이 안 됨).
 *   카카오톡과 라인은 자체 주소 규칙, 안드로이드는 크롬 intent, 아이폰은 iOS 17 부터 되는 x-safari 주소.
 *   아이폰 인스타그램처럼 막힌 곳은 아무 일도 안 일어날 수 있어 화면 안내 문구는 그대로 둔다.
 *   앱 안 화면에 저장된 것(로그인 전 사주, 기기 잔액)은 새 브라우저로 따라가지 않는다 → 로그인 계정이 있는 사람용.
 */
export function openInExternalBrowser(url: string = typeof window !== 'undefined' ? window.location.href : ''): boolean {
  const name = inAppBrowserName();
  if (!name || !url) return false;
  const ua = navigator.userAgent;
  let target = '';
  if (name === '카카오톡') target = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  else if (name === '라인') target = url + (url.includes('?') ? '&' : '?') + 'openExternalBrowser=1';
  else if (/Android/i.test(ua)) target = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
  else if (/iPhone|iPad|iPod/i.test(ua)) target = `x-safari-${url}`;
  if (!target) return false;
  window.location.href = target;
  return true;
}
