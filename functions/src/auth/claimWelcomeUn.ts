/**
 * claimWelcomeUn — 처음 기기에 생기는 기본 1운을 로그인 계정의 서버 잔액에도 한 번 넣는다 (2026-10-23)
 *
 *   새 기기는 기본 1운으로 시작한다(src/services/storage/localStore.ts getBalanceDetail). 익명일 때는 서버가 운을 깎지 않아
 *   기기 잔액만으로 쓸 수 있었다. 로그인하면 유료 풀이 값을 서버 잔액(users/{uid}.balance)에서 깎는데, 기본 1운은 기기에만 있어
 *   화면은 '충분'인데 서버가 '운이 부족합니다'로 막았다(10-23 00:58 네이버 손님, 결제 3,000원 뒤 연애운 4운이 여덟 번 막힘).
 *   클라이언트는 로그인 계정에서 '기기 잔액이 서버보다 1운 넘게 많을 때'만 부른다(balanceReconcile.ts claimWelcomeIfPhantom).
 *
 *   지키는 것 (10-23 검수 반영)
 *   - 계정당 한 번: 손님이 고칠 수 없는 welcomeUnLog/{uid}(rules 기본 거부)를 트랜잭션에서 읽어 판정. welcomeUnAt 도 rules 금전 필드에 넣었다.
 *   - 익명 계정은 받지 않는다(sign_in_provider). 토스, 네이버(custom 토큰), 구글, 카카오는 받는다.
 *   - 서버 users 문서가 없으면 건드리지 않는다(그런 계정은 서버가 차감하지 않아 어긋남이 생기지 않고, 문서를 새로 만들면 차감 방식이 바뀐다).
 *   - 옛 숫자형 잔액(balance: 3)은 {paid: 3, bonus: 1, reward: 0} 으로 바꿔 숫자를 잃지 않는다(referral.ts 와 같은 방식).
 *   - 보너스 칸(환불 대상 아님)에 1운. 탈퇴해도 welcomeUnLog 는 남겨 같은 uid 가 다시 받지 못한다.
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
    const logRef = db.collection('welcomeUnLog').doc(uid);
    const res = await db.runTransaction(async (tx) => {
      const [snap, log] = await Promise.all([tx.get(ref), tx.get(logRef)]);
      if (log.exists) return { ok: false, why: 'already' };
      if (!snap.exists) return { ok: false, why: 'nodoc' };
      const bal = snap.data()?.balance;
      if (typeof bal === 'number') {
        tx.update(ref, { balance: { paid: Math.max(0, bal), bonus: 1, reward: 0 }, welcomeUnAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        tx.update(ref, { 'balance.bonus': admin.firestore.FieldValue.increment(1), welcomeUnAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      tx.set(logRef, { uid, provider, amount: 1, at: admin.firestore.FieldValue.serverTimestamp() });
      return { ok: true, why: 'granted' };
    });
    if (res.ok) console.info(`[welcomeUn] 1운 uid=${uid.slice(0, 8)}… provider=${provider}`);
    return res;
  },
);
