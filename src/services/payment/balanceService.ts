import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';

/**
 * 운(運) 잔액을 차감합니다.
 * Firestore 트랜잭션으로 원자적 처리합니다.
 */
export async function spendUn(uid: string, amount: number, reportId: string, productType: string): Promise<number> {
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
