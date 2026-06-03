import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';

/**
 * @deprecated 2026-04-22 — DO NOT USE FROM CLIENT.
 *
 * 이 파일의 `spendUn` / `chargeUn` 은 클라이언트에서 Firestore `users/{uid}/payments/{payid}` 에
 * 직접 write 하는 레거시 경로입니다. E13 결제 원자성 원칙에 따라 모든 `payments` write 는
 * Cloud Functions (`confirmPayment` / `grantPurchase`) 의 Admin SDK 경유로 이관되었고,
 * Firestore rules 에서 `payments` 의 클라이언트 write 를 `false` 로 차단했습니다.
 *
 * 호출 시 rules 에 의해 PERMISSION_DENIED 가 발생합니다. 실제 잔액 조작은
 * `src/services/storage/localStore.ts` (localStorage) + Cloud Functions (서버 grant) 를 사용하세요.
 *
 * Grace period 종료 후 삭제 예정 (2026-05-15).
 */
export async function spendUn(uid: string, amount: number, reportId: string, productType: string): Promise<number> {
  console.warn('[balanceService] spendUn is deprecated. Use localStore.spendBalance() or a Cloud Function.');
  const userRef = doc(db, 'users', uid);
  const paymentRef = doc(db, 'users', uid, 'payments', crypto.randomUUID());

  return runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('유저를 찾을 수 없습니다.');

    const userData = userSnap.data();
    const currentBalance = (userData.balance ?? 0) as number;

    if (currentBalance < amount) {
      throw new Error('운이 부족합니다. 충전 후 이용해주세요.');
    }

    const newBalance = currentBalance - amount;

    tx.update(userRef, {
      balance: newBalance,
      totalSpent: (userData.totalSpent ?? 0) + amount,
      lastActiveAt: serverTimestamp(),
    });

    tx.set(paymentRef, {
      payid: paymentRef.id,
      type: 'spend',
      unChange: -amount,
      balanceAfter: newBalance,
      reportId,
      productType,
      createdAt: serverTimestamp(),
      status: 'completed',
    });

    return newBalance;
  });
}

/**
 * 운(運) 잔액을 충전합니다.
 */
export async function chargeUn(uid: string, un: number, bonusUn: number, amount: number, packageName: string): Promise<number> {
  const userRef = doc(db, 'users', uid);
  const paymentRef = doc(db, 'users', uid, 'payments', crypto.randomUUID());

  return runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('유저를 찾을 수 없습니다.');

    const userData = userSnap.data();
    const totalUn = un + bonusUn;
    const newBalance = (userData.balance ?? 0) + totalUn;

    tx.update(userRef, {
      balance: newBalance,
      totalCharged: (userData.totalCharged ?? 0) + un,
      bonusBalance: (userData.bonusBalance ?? 0) + bonusUn,
      lastActiveAt: serverTimestamp(),
    });

    tx.set(paymentRef, {
      payid: paymentRef.id,
      type: 'charge',
      amount,
      packageName,
      unChange: totalUn,
      balanceAfter: newBalance,
      createdAt: serverTimestamp(),
      status: 'completed',
    });

    return newBalance;
  });
}
