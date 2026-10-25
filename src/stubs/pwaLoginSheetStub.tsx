/**
 * 앱인토스 빌드용 빈 홈 화면 앱 로그인 시트 (2026-10-26) — vite.config.ts 가 PwaLoginSheet 를 이 파일로 바꿔 끼운다.
 *   홈 화면 앱(PWA)은 웹 전용이고, 이 시트는 웹 로그인 시트를 연다(1.6.3 검수 반려 대응).
 */
export function useRealLoginState(): [boolean | null, (v: boolean) => void] {
  return [null, () => {}];
}
export function PwaLoginSheet(_props: Record<string, unknown>): null {
  return null;
}
