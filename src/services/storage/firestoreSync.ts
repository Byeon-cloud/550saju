/**
 * localStorage → Firestore 동기화
 *
 * 멀티 디바이스 지원:
 * - 앱인토스에서 저장한 데이터를 웹에서도 볼 수 있게
 * - 로그인 시 localStorage 데이터를 Firestore에 업로드
 * - Firestore 데이터를 localStorage에 다운로드
 *
 * 호출 시점:
 * - 로그인 성공 직후 syncToCloud()
 * - 앱 시작 시 syncFromCloud()
 */

import { doc, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import { getReports, saveReport, type LocalReport } from './localStore';
import { getBalanceBreakdown, type BalanceDetail } from './localStore';

/**
 * 로컬 → 클라우드 동기화
 * 로그인 후 로컬에만 있는 데이터를 Firestore에 업로드
 */
export async function syncToCloud(uid: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    // 1. 잔액 동기화
    const balance = getBalanceBreakdown();
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // 신규 유저 — 로컬 데이터를 그대로 업로드
      batch.set(userRef, {
        balance,
        totalCharged: 0,
        totalSpent: 0,
        createdAt: new Date(),
        lastActiveAt: new Date(),
      });
    } else {
      // 기존 유저 — 클라우드 잔액이 우선 (서버가 진실의 원천)
      batch.update(userRef, { lastActiveAt: new Date() });
    }

    // 2. 리포트 동기화 — 로컬에만 있는 것을 업로드
    const localReports = getReports();
    for (const report of localReports) {
      const reportRef = doc(db, `users/${uid}/reports`, report.id);
      const existing = await getDoc(reportRef);
      if (!existing.exists()) {
        batch.set(reportRef, {
          name: report.name,
          input: report.input,
          sajuData: report.sajuData,
          situation: report.situation || null,
          createdAt: report.createdAt,
        });
      }
    }

    await batch.commit();
  } catch (err) {
    console.warn('[Sync] 클라우드 업로드 실패:', err);
  }
}

/**
 * 클라우드 → 로컬 동기화
 * Firestore에 있는 데이터를 localStorage에 다운로드
 */
export async function syncFromCloud(uid: string): Promise<void> {
  try {
    // 1. 클라우드 리포트 → 로컬에 없는 것만 추가
    const reportsSnap = await getDocs(collection(db, `users/${uid}/reports`));
    const localReports = getReports();
    const localIds = new Set(localReports.map(r => r.id));

    reportsSnap.forEach((docSnap) => {
      if (!localIds.has(docSnap.id)) {
        const data = docSnap.data();
        saveReport({
          id: docSnap.id,
          name: data.name,
          input: data.input,
          sajuData: data.sajuData,
          situation: data.situation,
          createdAt: data.createdAt,
        } as LocalReport);
      }
    });

    // 2. 클라우드 잔액 → 로컬에 반영 (서버가 진실의 원천)
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const cloudBalance = userDoc.data().balance as BalanceDetail | undefined;
      if (cloudBalance) {
        localStorage.setItem('saju500_balance_v2', JSON.stringify(cloudBalance));
      }
    }
  } catch (err) {
    console.warn('[Sync] 클라우드 다운로드 실패:', err);
  }
}
