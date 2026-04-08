import {
  signInWithPopup,
  signInWithCustomToken,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { isAppsInToss } from '@/services/payment/iapService';

const googleProvider = new GoogleAuthProvider();

// 카카오 — Firebase OpenID Connect (프로바이더 ID: oidc.kakao)
const kakaoProvider = new OAuthProvider('oidc.kakao');

// 네이버 — Firebase OpenID Connect (프로바이더 ID: oidc.naver)
const naverProvider = new OAuthProvider('oidc.naver');

export type WebLoginProvider = 'google' | 'kakao' | 'naver';

/**
 * 로그인 — 플랫폼 자동 분기
 * 앱인토스: appLogin() → authorizationCode → 서버 토큰 교환 → signInWithCustomToken
 * 웹: 사용자가 선택한 프로바이더로 로그인
 */
export async function signIn(provider?: WebLoginProvider): Promise<User> {
  if (isAppsInToss()) {
    return signInWithToss();
  }
  return signInWithWeb(provider || 'google');
}

/** 웹 로그인 — Google/카카오/네이버 */
async function signInWithWeb(provider: WebLoginProvider): Promise<User> {
  const providers: Record<WebLoginProvider, GoogleAuthProvider | OAuthProvider> = {
    google: googleProvider,
    kakao: kakaoProvider,
    naver: naverProvider,
  };

  try {
    // 모바일에서는 redirect 방식이 더 안정적
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobile) {
      await signInWithRedirect(auth, providers[provider]);
      // 리다이렉트 후 복귀 시 getRedirectResult로 처리
      const result = await getRedirectResult(auth);
      if (result) return result.user;
      throw new Error('로그인이 취소됐어요');
    }

    // PC에서는 popup
    const result = await signInWithPopup(auth, providers[provider]);
    return result.user;
  } catch (err: any) {
    console.error(`[Auth] ${provider} 로그인 실패:`, err);
    throw err;
  }
}

/** 리다이렉트 복귀 시 결과 확인 (App.tsx에서 호출) */
export async function checkRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch {
    return null;
  }
}

/** 앱인토스 토스 로그인 */
async function signInWithToss(): Promise<User> {
  try {
    const sdkName = '@apps-in-toss/' + 'web-framework';
    const { appLogin } = await import(/* @vite-ignore */ sdkName);

    const { authorizationCode } = await appLogin();

    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app: firebaseApp } = await import('./firebase');
    const functions = getFunctions(firebaseApp, 'us-central1');
    const loginFn = httpsCallable(functions, 'loginWithToss');
    const result = await loginFn({ authorizationCode });
    const { customToken } = result.data as { customToken: string; uid: string };

    const credential = await signInWithCustomToken(auth, customToken);
    return credential.user;
  } catch (err) {
    console.error('[Auth] 토스 로그인 실패:', err);
    throw err;
  }
}

/** 로그아웃 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/** 인증 상태 구독 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
