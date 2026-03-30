import { collection, doc, getDoc, getDocs, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import type { Report } from '@/types/report';

function reportsCol(uid: string) {
  return collection(db, 'users', uid, 'reports');
}

/** 리포트 단건 조회 */
export async function getReport(uid: string, rid: string): Promise<Report | null> {
  const snap = await getDoc(doc(reportsCol(uid), rid));
  return snap.exists() ? (snap.data() as Report) : null;
}

/** 리포트 목록 조회 (최신순) */
export async function getReports(uid: string, limitCount = 20): Promise<Report[]> {
  const q = query(reportsCol(uid), orderBy('generatedAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Report);
}

/** 리포트 저장 */
export async function saveReport(uid: string, report: Report): Promise<void> {
  await setDoc(doc(reportsCol(uid), report.rid), report);
}
