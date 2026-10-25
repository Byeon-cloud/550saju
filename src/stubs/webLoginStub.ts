/**
 * 앱인토스 빌드용 빈 웹 로그인 (2026-10-26) — vite.config.ts 가 '@/services/auth/webLogin' 을 이 파일로 바꿔 끼운다.
 *   앱인토스는 토스 로그인만 쓸 수 있다. 구글, 카카오, 네이버, 애플 로그인 코드가 앱 번들에 들어가면 검수에서 반려된다(1.6.3).
 */
import type { User } from 'firebase/auth';

export async function signInWithWeb(): Promise<User> {
  throw new Error('토스 앱에서는 토스 로그인만 써요');
}
export async function checkRedirectResult(): Promise<User | null> {
  return null;
}
