/**
 * claimWelcomeUn — 처음 기기에 생기는 기본 1운을 로그인 계정의 서버 잔액에도 한 번 넣는다 (2026-10-23)
 *
 *   새 기기는 기본 1운으로 시작한다(src/services/storage/localStore.ts getBalanceDetail). 익명일 때는 서버가 운을 깎지 않아
 *   기기 잔액만으로 쓸 수 있었다. 로그인하면 유료 풀이 값을 서버 잔액(users/{uid}.balance)에서 깎는데, 기본 1운은 기기에만 있어
 *   화면은 '충분'인데 서버가 '운이 부족합니다'로 막았다(10-23 00:58 네이버 손님, 결제 3,000원 뒤 연애운 4운이 여덟 번 막힘).
 *   클라이언트는 로그인 계정에서 '기기 잔액이 서버보다 1운 넘게 많을 때'만 부른다(balanceReconcile.ts).
 *
 *   계정당 한 번(users/{uid}.welcomeUnAt), 익명 계정은 받지 않는다, 보너스 칸(환불 대상 아님)에 1운.
 *   기록: welcomeUnLog (관리자 고객 찾기에서 볼 수 있게 uid, 시각).
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const claimWelcomeUn = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요해요');
    const provider = String((request.auth?.token as { firebase?: { sign_in_provider?: string } })?.firebase?.sign_in_provider || '');
    if (!provider || provider === 'anonymous') return { ok: false, why: 'anonymous' };
    const db = admin.firestore();
    const ref = db.doc(`users/${uid}`);
    const res = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.data()?.welcomeUnAt) return { ok: false, why: 'already' };
      tx.set(ref, {
        balance: { bonus: admin.firestore.FieldValue.increment(1) },
        welcomeUnAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      tx.set(db.collection('welcomeUnLog').doc(uid), { uid, provider, amount: 1, at: admin.firestore.FieldValue.serverTimestamp() });
      return { ok: true, why: 'granted' };
    });
    if (res.ok) console.info(`[welcomeUn] 1운 uid=${uid.slice(0, 8)}… provider=${provider}`);
    return res;
  },
);
