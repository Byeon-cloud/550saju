import { collection, doc, getDocs, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import type { Payment } from '@/types/payment';

function paymentsCol(uid: string) {
  return collection(db, 'users', uid, 'payments');
}

/** 결제 내역 조회 (최신순) */
export async function getPayments(uid: string, limitCount = 50): Promise<Payment[]> {
  const q = query(paymentsCol(uid), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Payment);
}

/** 결제 내역 저장 */
export async function savePayment(uid: string, payment: Payment): Promise<void> {
  await setDoc(doc(paymentsCol(uid), payment.payid), payment);
}
