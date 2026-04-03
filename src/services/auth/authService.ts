import {
  signInWithPopup,
  signInWithCustomToken,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { isAppsInToss } from '@/services/payment/iapService';

const googleProvider = new GoogleAuthProvider();

/**
 * 로그인 — 플랫폼 자동 분기
 * 앱인토스: appLogin() → authorizationCode → 서버 토큰 교환 → signInWithCustomToken
 * 웹: Google 팝업 로그인 (Phase 2에서 카카오/네이버 추가)
 */
export async function signIn(): Promise<User> {
  if (isAppsInToss()) {
    return signInWithToss();
  }
  return signInWithGoogle();
}

/** 앱인토스 토스 로그인 */
async function signInWithToss(): Promise<User> {
  try {
    const sdkName = '@apps-in-toss/' + 'web-framework';
    const { appLogin } = await import(/* @vite-ignore */ sdkName);

    // 1. 토스에서 인증 코드 받기
    const { authorizationCode } = await appLogin();

    // 2. Cloud Function으로 토큰 교환
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(undefined, 'asia-northeast3');
    const loginFn = httpsCallable(functions, 'loginWithToss');
    const result = await loginFn({ authorizationCode });
    const { customToken } = result.data as { customToken: string; uid: string };

    // 3. Firebase 로그인
    const credential = await signInWithCustomToken(auth, customToken);
    return credential.user;
  } catch (err) {
    console.error('[Auth] 토스 로그인 실패:', err);
    throw err;
  }
}

/** Google 로그인 (웹용) */
async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/** 로그아웃 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/** 인증 상태 구독 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
