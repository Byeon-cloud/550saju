import {
  signInWithPopup,
  signInWithCustomToken,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { isAppsInToss } from '@/services/payment/iapService';

/**
 * 익명 로그인 — 앱 시작 시 자동 수행
 * 모든 유저에게 Firebase Auth 토큰을 부여하여 Cloud Functions 호출 가능하게
 * 나중에 토스/소셜 로그인 시 linkWithCredential로 계정 연결
 */
export async function ensureAuth(): Promise<void> {
  if (auth.currentUser) return; // 이미 로그인됨
  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.warn('[Auth] 익명 로그인 실패:', e);
  }
}

const googleProvider = new GoogleAuthProvider();

// 카카오 — Firebase OpenID Connect (프로바이더 ID: oidc.kakao)
const kakaoProvider = new OAuthProvider('oidc.kakao');

// 네이버 — Firebase OpenID Connect (프로바이더 ID: oidc.naver)
const naverProvider = new OAuthProvider('oidc.naver');

// Apple — Firebase OAuth (프로바이더 ID: apple.com)
// Service ID 미설정 시 Firebase Console 에러 → catch 단에서 친절 메시지 노출
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');
appleProvider.setCustomParameters({ locale: 'ko_KR' });

export type WebLoginProvider = 'google' | 'kakao' | 'naver' | 'apple';

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
    apple: appleProvider,
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
