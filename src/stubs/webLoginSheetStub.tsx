/**
 * 앱인토스 빌드용 빈 웹 로그인 시트 (2026-10-26) — vite.config.ts 가 WebLoginSheet 를 이 파일로 바꿔 끼운다.
 *   앱에서는 토스 로그인만 쓰므로 소셜 로그인 버튼 화면이 번들에 들어가지 않게 한다(1.6.3 검수 반려 대응).
 */
export function WebLoginSheet(_props: Record<string, unknown>): null {
  return null;
}
