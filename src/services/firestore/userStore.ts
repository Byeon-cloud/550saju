import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import type { User } from '@/types/user';

const USERS = 'users';

/** 유저 문서 조회 */
export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? (snap.data() as User) : null;
}

/** 유저 문서 생성 (최초 가입 시) */
export async function createUser(uid: string, data: Partial<User>): Promise<void> {
  await setDoc(doc(db, USERS, uid), {
    uid,
    balance: 0,
    totalCharged: 0,
    totalSpent: 0,
    bonusBalance: 0,
    platform: 'web',
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    ...data,
  });
}

/** 유저 문서 업데이트 */
export async function updateUser(uid: string, data: Partial<User>): Promise<void> {
  await updateDoc(doc(db, USERS, uid), {
    ...data,
    lastActiveAt: serverTimestamp(),
  });
}
