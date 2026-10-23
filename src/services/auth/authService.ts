import {
  signInWithPopup,
  signInWithCustomToken,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  signInWithCredential,
  type AuthCredential,
  signInAnonymously,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, authDomainIsSelf } from './firebase';
import { isAppsInToss } from '@/services/payment/iapService';
import { isIosStandalone } from '@/lib/displayMode';

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

const googleProvider = new GoogleAuthProvider();

// 카카오 — Firebase OpenID Connect (프로바이더 ID: oidc.kakao)
const kakaoProvider = new OAuthProvider('oidc.kakao');
// 2026-10-23 — 카카오계정(이메일)을 선택 동의로 켰다(카카오 개발자 '사주500' 앱을 비즈 앱으로 전환). 결제한 웹 손님에게
//   결제, 환불, 보상 안내를 보낼 길이 없던 일(10-23 종합사주 사고 손님 둘) 대응. 동의하지 않아도 로그인은 된다.
kakaoProvider.addScope('account_email');

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

/** 웹 로그인 — Google/카카오/네이버
 *  2026-10-16 — 지금 계정이 익명이면 새 계정으로 갈아타지 않고 익명 계정에 소셜 계정을 '연결'한다(uid 그대로).
 *    갈아타면 로그인 전에 충전한 운, 보관함, 결제 기록이 익명 uid 에 남아 새 계정에서 안 보였다(오너: 로그인 없이 결제됨).
 *    그 소셜 계정이 이미 다른 사주500 계정에 쓰이고 있으면(credential-already-in-use) 그 계정으로 로그인한다. */
async function signInWithWeb(provider: WebLoginProvider): Promise<User> {
  const providers: Record<WebLoginProvider, GoogleAuthProvider | OAuthProvider> = {
    google: googleProvider,
    kakao: kakaoProvider,
    naver: naverProvider,
    apple: appleProvider,
  };
  // 2026-10-23 — 아이폰, 아이패드 홈 화면 앱: 팝업은 결과가 돌아오지 않아 끝없이 기다렸고(Firebase 10.14.1),
  //   로그인 도메인이 사이트와 다르면 리다이렉트도 결과를 못 읽는다. 사이트가 VITE_AUTH_SELF_HOSTS(saju500.app)가 아니면
  //   여기서 멈추고 로그인 시트가 '사파리에서 saju500.app 으로 열어 주세요'를 보여 준다(WebLoginSheet).
  const iosStandalone = import.meta.env.VITE_BUILD_TARGET !== 'appintos' && isIosStandalone(); // 앱 빌드에서는 통째로 빠진다
  if (iosStandalone && !authDomainIsSelf) {
    throw Object.assign(new Error('사파리에서 saju500.app 으로 열어 로그인해 주세요'), { code: 'saju500/standalone-host' });
  }
  // 2026-10-19 — 네이버는 Firebase OIDC 로 늘 실패했다(네이버 UserInfo 형식이 달라 sub 비교 실패, 로그인 0명).
  //   네이버 로그인 화면으로 보내고 /auth/naver 에서 서버(loginWithNaver)가 마무리한다.
  if (provider === 'naver') {
    startNaverLogin();
    throw new Error('로그인 화면으로 이동해요');
  }
  const p = providers[provider];
  const cur = auth.currentUser;
  const linkAnon = !!cur && cur.isAnonymous;

  try {
    // 2026-10-19 — 모바일 리다이렉트는 로그인 도메인이 사이트와 같을 때만 쓴다.
    //   다르면(appintoss-saju.firebaseapp.com) 크롬 115+, 사파리 16.1+ 가 돌아온 결과를 읽지 못해
    //   로그인하고 돌아와도 익명 그대로였다(결제 전 로그인 시트가 다시 뜨는 반복). 그때는 팝업(새 탭)으로 한다.
    //   2026-10-23 — 아이폰, 아이패드 홈 화면 앱은 리다이렉트(아이패드는 UA 가 Macintosh 라 UA 판정에서 빠졌다. 로그인 도메인이 다르면 위에서 멈춘다)
    const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent) || iosStandalone;
    if (isMobile && authDomainIsSelf) {
      markRedirectLogin(provider);
      if (linkAnon) await linkWithRedirect(cur!, p);
      else await signInWithRedirect(auth, p);
      throw new Error('로그인 화면으로 이동해요');
    }

    // PC, 그리고 로그인 도메인이 다른 모바일은 팝업
    const result = linkAnon ? await linkWithPopup(cur!, p) : await signInWithPopup(auth, p);
    import('@/services/analytics').then((a) => a.trackEvent('login_success', { provider, linked: linkAnon ? 1 : 0 })).catch(() => {});
    return result.user;
  } catch (err: any) {
    const switched = await signInIfAlreadyInUse(err);
    if (switched) {
      import('@/services/analytics').then((a) => a.trackEvent('login_success', { provider, linked: 0, existing: 1 })).catch(() => {});
      return switched;
    }
    console.error(`[Auth] ${provider} 로그인 실패:`, err);
    throw err;
  }
}

/** 연결하려던 소셜 계정이 이미 다른 계정에 붙어 있으면 그 계정으로 로그인 (익명 계정은 두고 간다) */
async function signInIfAlreadyInUse(err: any): Promise<User | null> {
  const code: string = err?.code || '';
  if (!/credential-already-in-use|email-already-in-use|account-exists-with-different-credential/.test(code)) return null;
  let cred: AuthCredential | null = null;
  try { cred = OAuthProvider.credentialFromError(err); } catch { /* noop */ }
  if (!cred) { try { cred = GoogleAuthProvider.credentialFromError(err); } catch { /* noop */ } }
  if (!cred) return null;
  try {
    const r = await signInWithCredential(auth, cred);
    return r.user;
  } catch (e) {
    console.error('[Auth] 기존 계정 로그인 실패:', e);
    return null;
  }
}

/** 리다이렉트 로그인을 떠나기 직전에 남긴다 — 돌아와서 성공, 실패를 집계하려고 (2026-10-19) */
const REDIRECT_MARK = 'saju500:login_redirect';
function markRedirectLogin(provider: WebLoginProvider): void {
  try { sessionStorage.setItem(REDIRECT_MARK, JSON.stringify({ provider, at: Date.now() })); } catch { /* noop */ }
}

/** 리다이렉트 복귀 시 결과 확인 (App.tsx에서 호출) — 연결 복귀도 같은 함수로 마무리 */
export async function checkRedirectResult(): Promise<User | null> {
  let mark: { provider?: string; at?: number } | null = null;
  try {
    const raw = sessionStorage.getItem(REDIRECT_MARK);
    if (raw) { mark = JSON.parse(raw); sessionStorage.removeItem(REDIRECT_MARK); }
  } catch { /* noop */ }
  const fresh = !!mark && Date.now() - Number(mark.at || 0) < 15 * 60e3;
  const report = (name: 'login_success' | 'login_fail', extra: Record<string, string | number>) => {
    if (!fresh) return;
    import('@/services/analytics').then((a) => a.trackEvent(name, { provider: String(mark?.provider || ''), via: 'redirect', ...extra })).catch(() => {});
  };
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) report('login_success', {});
    else if (auth.currentUser?.isAnonymous) report('login_fail', { code: 'no_result' });
    return result?.user || null;
  } catch (err: any) {
    const u = await signInIfAlreadyInUse(err);
    if (u) report('login_success', { existing: 1 });
    else report('login_fail', { code: String(err?.code || 'error').slice(0, 60) });
    return u;
  }
}

/* ── 웹 네이버 로그인 (2026-10-19) ──
 *   1) startNaverLogin: state 를 남기고 네이버 로그인 화면으로 이동
 *   2) 네이버가 https://<사이트>/auth/naver?code&state 로 돌려보냄 (네이버 개발자센터 Callback URL 에 등록 필요)
 *   3) finishNaverLogin: state 확인 → 서버 loginWithNaver → 맞춤 토큰으로 로그인 → 보던 화면으로 */
const NAVER_KEY = 'saju500:naver_login';
export const NAVER_LOGIN_INFO = 'saju500:login_provider';

const NAVER_RETRY = 'saju500:naver_retry';

function startNaverLogin(returnToOverride?: string): void {
  const clientId = String(import.meta.env.VITE_NAVER_CLIENT_ID || '');
  if (!clientId) throw new Error('네이버 로그인을 준비 중이에요');
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const state = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const returnTo = returnToOverride || `${location.pathname}${location.search}`;
  try { localStorage.setItem(NAVER_KEY, JSON.stringify({ state, returnTo, at: Date.now() })); } catch { /* noop */ }
  const redirectUri = `${location.origin}/auth/naver`;
  const q = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state });
  location.assign(`https://nid.naver.com/oauth2.0/authorize?${q.toString()}`);
}

/** /auth/naver 화면이 부른다. 돌아갈 주소를 돌려준다 */
export async function finishNaverLogin(params: URLSearchParams): Promise<{ returnTo: string; email: string }> {
  let saved: { state?: string; returnTo?: string; at?: number } = {};
  try { saved = JSON.parse(localStorage.getItem(NAVER_KEY) || '{}'); localStorage.removeItem(NAVER_KEY); } catch { /* noop */ }
  try { sessionStorage.removeItem(REDIRECT_MARK); } catch { /* noop */ }
  const returnTo = saved.returnTo && saved.returnTo.startsWith('/') && !saved.returnTo.startsWith('/auth/') ? saved.returnTo : '/my';
  const err = params.get('error');
  if (err) throw Object.assign(new Error(err === 'access_denied' ? '네이버 로그인을 취소했어요' : `네이버 로그인 오류: ${err}`), { code: `naver/${err}`, returnTo });
  const code = params.get('code') || '';
  const state = params.get('state') || '';
  if (!code || !state || state !== saved.state || Date.now() - Number(saved.at || 0) > 30 * 60e3) {
    // 2026-10-20 — 휴대폰에서 네이버 앱이나 다른 브라우저를 거쳐 돌아오면 이 브라우저에 시작 기록(state)이 없어 늘 실패했다
    //   (오너 기기 10-20, 네이버 검수 '로그인을 이용할 수 없음'). 이 브라우저에서 한 번만 다시 시작해 같은 곳으로 돌아오게 한다
    let last = 0;
    try { last = Number(sessionStorage.getItem(NAVER_RETRY) || 0); } catch { /* noop */ }
    if (Date.now() - last > 2 * 60e3) {
      try { sessionStorage.setItem(NAVER_RETRY, String(Date.now())); } catch { /* noop */ }
      import('@/services/analytics').then((a) => a.trackEvent('login_fail', { provider: 'naver', via: 'redirect', code: 'naver/state_retry', msg: saved.state ? 'mismatch' : 'no_local_state' })).catch(() => {});
      startNaverLogin(returnTo);
      return new Promise<never>(() => {}); // 네이버로 다시 이동하는 중
    }
    throw Object.assign(new Error('로그인 정보가 맞지 않아요. 다시 시도해 주세요'), { code: 'naver/state', returnTo });
  }
  try { sessionStorage.removeItem(NAVER_RETRY); } catch { /* noop */ }
  // 지금 쓰던 계정(익명 포함)이 서버 요청에 같이 가야 그 계정에 붙는다. 부팅의 익명 로그인이 아직이면 잠깐 기다린다
  //   (기다리지 않으면 맞춤 토큰 로그인 뒤에 부팅의 익명 로그인이 덮어쓸 수 있다)
  await auth.authStateReady();
  if (!auth.currentUser) {
    await new Promise<void>((resolve) => {
      let off: () => void = () => {};
      const t = window.setTimeout(() => { off(); resolve(); }, 4000);
      off = onAuthStateChanged(auth, (u) => { if (u) { window.clearTimeout(t); setTimeout(() => off(), 0); resolve(); } });
    });
  }
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const { app: firebaseApp } = await import('./firebase');
  const fn = httpsCallable(getFunctions(firebaseApp, 'us-central1'), 'loginWithNaver');
  const r = await fn({ code, state, redirectUri: `${location.origin}/auth/naver` });
  const { customToken, email, switched } = r.data as { customToken: string; email: string; switched: boolean };
  await signInWithCustomToken(auth, customToken);
  try { localStorage.setItem(NAVER_LOGIN_INFO, JSON.stringify({ provider: 'naver', email: email || '', uid: auth.currentUser?.uid || '' })); } catch { /* noop */ }
  import('@/services/analytics').then((a) => a.trackEvent('login_success', { provider: 'naver', via: 'redirect', linked: switched ? 0 : 1, ...(switched ? { existing: 1 } : {}) })).catch(() => {});
  return { returnTo, email: email || '' };
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
