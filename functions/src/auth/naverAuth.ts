import * as admin from 'firebase-admin';

/**
 * 웹 네이버 로그인 (2026-10-19) — 서버가 네이버와 직접 주고받고 Firebase 맞춤 토큰을 돌려준다.
 *
 *   왜: Firebase 의 OIDC 공급자(oidc.naver)는 로그인 끝에 UserInfo 를 불러 ID 토큰의 sub 와 맞춰 보는데,
 *       네이버 UserInfo(openapi.naver.com/v1/nid/me)는 sub 가 없고 형식도 달라 늘 auth/invalid-credential 이었다
 *       ("'sub' in ID Token does not match 'sub' in UserInfo response"). 그래서 네이버로 로그인한 사람이 0명이었다.
 *   흐름: 웹이 네이버 로그인 화면으로 보냄 → /auth/naver?code&state 로 돌아옴 → loginWithNaver(code, state, redirectUri)
 *        → 네이버 토큰 교환(client_secret) → 회원 id, 이메일 → authLinks/naver_{id} 로 계정을 찾거나 지금 계정에 붙임 → 맞춤 토큰.
 *   계정: 처음이면 지금 쓰던 계정(익명이어도)에 붙인다(구글, 카카오의 '연결'과 같게 운과 기록이 그대로).
 *         이미 다른 계정에 붙은 네이버면 그 계정으로 로그인한다.
 *   키: 네이버 client id 와 secret 은 Firebase 인증 설정(oidc.naver)에 이미 있는 값을 읽는다(같은 값을 두 곳에 두지 않는다).
 *   지우기: 탈퇴하면 purgeUser 가 authLinks 와 users.naverId 를 지운다.
 */

const TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const ME_URL = 'https://openapi.naver.com/v1/nid/me';
const ALLOWED_REDIRECT = /^https:\/\/(saju500\.app|appintoss-saju\.web\.app|appintoss-saju\.firebaseapp\.com)\/auth\/naver$/;

let cached: { clientId: string; clientSecret: string; at: number } | null = null;
async function naverKeys(): Promise<{ clientId: string; clientSecret: string }> {
  if (cached && Date.now() - cached.at < 10 * 60e3) return cached;
  const cfg: any = await admin.auth().getProviderConfig('oidc.naver');
  const clientId = String(cfg?.clientId || '');
  const clientSecret = String(cfg?.clientSecret || '');
  if (!clientId || !clientSecret) throw new Error('naver_config_missing');
  cached = { clientId, clientSecret, at: Date.now() };
  return cached;
}

/** 웹이 네이버 로그인 화면 주소를 만들 때 쓰는 공개 client id */
export async function naverClientId(): Promise<string> {
  return (await naverKeys()).clientId;
}

async function userAlive(uid: string): Promise<boolean> {
  try {
    const u = await admin.auth().getUser(uid);
    if (u.disabled) return false;
    const d = await admin.firestore().doc(`users/${uid}`).get();
    return !(d.exists && (d.data() as any)?.purgedAt);
  } catch {
    return false;
  }
}

export async function loginWithNaverCode(input: { code: string; state: string; redirectUri: string; callerUid?: string }): Promise<{ customToken: string; uid: string; email: string; switched: boolean }> {
  const { code, state, redirectUri, callerUid } = input;
  if (!code || !state || !ALLOWED_REDIRECT.test(redirectUri)) throw new Error('bad_request');
  const { clientId, clientSecret } = await naverKeys();

  // 1) 코드 → 접근 토큰
  const tq = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, state, redirect_uri: redirectUri });
  const tr = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tq.toString() });
  const tj: any = await tr.json().catch(() => ({}));
  if (!tj.access_token) throw new Error(`naver_token:${String(tj.error || tr.status)}:${String(tj.error_description || '').slice(0, 80)}`);

  // 2) 회원 정보 (id 는 이 앱 전용 고유값, 이메일은 동의했을 때만)
  const mr = await fetch(ME_URL, { headers: { Authorization: `Bearer ${tj.access_token}` } });
  const mj: any = await mr.json().catch(() => ({}));
  const naverId = String(mj?.response?.id || '');
  if (mj?.resultcode !== '00' || !naverId) throw new Error(`naver_me:${String(mj?.resultcode || mr.status)}`);
  const email = String(mj?.response?.email || '').toLowerCase().slice(0, 120);

  // 3) 계정 찾기 또는 붙이기
  const db = admin.firestore();
  const linkRef = db.doc(`authLinks/naver_${naverId}`);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const prev = await linkRef.get();
  let uid = prev.exists ? String((prev.data() as any).uid || '') : '';
  if (uid && !(await userAlive(uid))) uid = ''; // 탈퇴로 지운 계정이면 새로 붙인다
  let switched = false;
  if (uid) {
    switched = !!callerUid && callerUid !== uid;
    await linkRef.set({ lastLoginAt: now, ...(email ? { email } : {}) }, { merge: true });
  } else {
    uid = callerUid || (await admin.auth().createUser({})).uid;
    await linkRef.set({ uid, provider: 'naver', createdAt: now, lastLoginAt: now, ...(email ? { email } : {}) });
  }

  await db.doc(`users/${uid}`).set({
    naverId,
    ...(email ? { naverEmail: email } : {}),
    webLoginProvider: 'naver',
    lastWebLoginAt: now,
  }, { merge: true });

  const customToken = await admin.auth().createCustomToken(uid, { provider: 'naver', ...(email ? { naverEmail: email } : {}) });
  return { customToken, uid, email, switched };
}

/** 탈퇴 파기 — 이 계정에 붙은 네이버 연결을 지운다 (purgeUser) */
export async function purgeNaverLinksOf(uid: string): Promise<number> {
  const db = admin.firestore();
  const s = await db.collection('authLinks').where('uid', '==', uid).get();
  await Promise.all(s.docs.map((d) => d.ref.delete()));
  return s.size;
}
