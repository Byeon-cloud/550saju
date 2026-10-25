import {
  signInWithCustomToken,
  signInAnonymously,
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
/**
 * 익명 로그인 보장 — 🚨 2026-09-27 단일화 (CS "운·보관함·사주원국 전부 사라짐" 진범 중 하나).
 *   저장소가 비워진 부팅에서 여러 곳(여권·보상·동기화·이벤트…)이 동시에 ensureAuth 를 부르면
 *   signInAnonymously 가 병렬로 돌아 **익명 계정이 몇 초 간격으로 2개** 생겼다(실측 4기기).
 *   복구 장치는 첫 계정으로 이관하는데 앱은 두 번째 계정으로 넘어가 복구가 빗나갔다.
 *   → ① 저장된 로그인 복원(authStateReady)이 끝날 때까지 기다리고 ② 진행 중 호출을 공유한다.
 */
let ensureAuthInflight: Promise<void> | null = null;
export async function ensureAuth(): Promise<void> {
  if (auth.currentUser) return; // 이미 로그인됨
  if (ensureAuthInflight) return ensureAuthInflight;
  ensureAuthInflight = (async () => {
    try {
      // 복원 전 currentUser 는 null — 여기서 새로 로그인하면 멀쩡한 기존 계정을 버리게 된다
      try { await auth.authStateReady(); } catch { /* 구형 SDK — 아래 판정으로 진행 */ }
      if (auth.currentUser) return;
      await signInAnonymously(auth);
    } catch (e) {
      console.warn('[Auth] 익명 로그인 실패:', e);
    } finally {
      ensureAuthInflight = null;
    }
  })();
  return ensureAuthInflight;
}

export type WebLoginProvider = 'google' | 'kakao' | 'naver' | 'apple';

/**
 * 로그인 — 플랫폼 자동 분기
 * 앱인토스: appLogin() → authorizationCode → 서버 토큰 교환 → signInWithCustomToken
 * 웹: 사용자가 선택한 프로바이더로 로그인
 *
 * 2026-10-26 — 웹 로그인(구글, 카카오, 네이버, 애플) 코드는 webLogin.ts 로 떼어 내 동적으로만 부른다.
 *   앱 빌드는 그 파일을 빈 모듈(src/stubs/webLoginStub.ts)로 바꿔 끼운다. 1.6.3 검수 반려('토스 로그인 외 다른 로그인 연동 불가,
 *   네이버 로그인 사용 확인') 대응: 화면에서 막혀 있어도 코드가 앱 번들에 있으면 걸린다.
 */
export async function signIn(provider?: WebLoginProvider): Promise<User> {
  // 앱 빌드는 빌드 상수로 토스 로그인만 남긴다(아래 웹 로그인 줄이 번들에서 통째로 지워진다)
  if (import.meta.env.VITE_BUILD_TARGET === 'appintos' || isAppsInToss()) {
    return signInWithToss();
  }
  const web = await import('@/services/auth/webLogin');
  return web.signInWithWeb(provider || 'google');
}

/** 리다이렉트 복귀 시 결과 확인 (App.tsx에서 호출) — 웹만. 앱 빌드에서는 빈 모듈이 null 을 돌려준다 */
export async function checkRedirectResult(): Promise<User | null> {
  if (import.meta.env.VITE_BUILD_TARGET === 'appintos' || isAppsInToss()) return null;
  const web = await import('@/services/auth/webLogin');
  return web.checkRedirectResult();
}

/** 앱인토스 토스 로그인 */
async function signInWithToss(): Promise<User> {
  try {
    const { appLogin } = await import('@apps-in-toss/web-framework');

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

// 2026-06-22 엔드게임 P1 — 익명 → 토스 안정 uid 자동 승격 + 보관함 병합 (uid 회전 CS 근절).
//   ⚠️ 플래그 OFF 기본: VITE_TOSS_SSO_ENABLED !== 'true' 면 즉시 return → 신호 오면 .env 켜고 빌드만.
//   흐름: 익명 ID토큰 캡처(소유증명) → 익명 로컬 서버백업 → 토스 SSO(toss_{userKey}) → mergeAnonIntoToss → 보관함 복원.
//   안전: 잔액 미관여(localStorage uid 독립이라 같은 기기 보존). 실패 시 익명 유지(graceful).
let _tossUpgradeAttempted = false;
export async function maybeUpgradeToTossIdentity(): Promise<void> {
  if (import.meta.env.VITE_TOSS_SSO_ENABLED !== 'true') return; // 플래그 OFF = 완전 비활성
  if (_tossUpgradeAttempted) return;
  if (!isAppsInToss()) return;                  // 앱인토스에서만 (웹은 익명 유지)
  const cur = auth.currentUser;
  if (!cur || !cur.isAnonymous) return;         // 익명일 때만 (이미 토스면 종료)
  _tossUpgradeAttempted = true;
  try {
    const anonUid = cur.uid;
    const anonIdToken = await cur.getIdToken(); // 소유 증명 토큰 — 토스 로그인 '전에' 캡처
    // 익명 로컬 보관함을 서버에 먼저 백업 (머지가 users/{anonUid}/reports 를 읽으므로)
    const sync = await import('@/services/storage/firestoreSync');
    await sync.syncToCloud(anonUid);
    // 익명 → 토스 안정 uid 로 전환
    await signInWithToss();
    const tossUid = auth.currentUser?.uid;
    if (!tossUid || !tossUid.startsWith('toss_')) return;
    // 익명 보관함 → 토스 uid 병합 (소유증명 토큰 동봉, 멱등)
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app: fb } = await import('./firebase');
    const mergeFn = httpsCallable(getFunctions(fb, 'us-central1'), 'mergeAnonIntoToss');
    await mergeFn({ anonIdToken });
    // 병합분을 로컬에 복원 (reports 만 — 잔액은 같은 기기 localStorage 에 이미 보존)
    await sync.syncFromCloud(tossUid, { reportsOnly: true });
  } catch (e) {
    console.warn('[tossUpgrade] 실패 — 익명 유지(다음 부팅 재시도)', e);
    _tossUpgradeAttempted = false; // 실패 시 재시도 허용
  }
}
