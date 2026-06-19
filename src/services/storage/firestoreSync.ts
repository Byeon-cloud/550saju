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
import { type BalanceDetail } from './localStore';

/**
 * 로컬 → 클라우드 동기화
 * 로그인 후 로컬에만 있는 데이터를 Firestore에 업로드
 */
export async function syncToCloud(uid: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    // 1. 유저 문서 동기화 (잔액 제외)
    // 2026-05-29 보안 — 기존: 신규 유저 시 localStorage 잔액(조작 가능)을 Firestore 에 그대로 업로드 →
    //   콘솔로 부풀린 잔액이 서버에 박히는 구멍. 수정: 클라이언트는 금전 필드(balance/total*)를 절대 안 씀.
    //   서버 잔액은 결제(confirmPayment/grantPurchase, Admin SDK)만 기록 = 단일 진실원천.
    //   (firestore.rules 도 금전 필드 클라 write 차단 — 이중 방어)
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // 신규 유저 — 비금전 필드만 생성 (잔액은 서버가 결제 시 Admin SDK 로 기록)
      batch.set(userRef, {
        createdAt: new Date(),
        lastActiveAt: new Date(),
      });
    } else {
      batch.update(userRef, { lastActiveAt: new Date() });
    }

    // 2. 리포트 동기화 — 내용(aiResult)까지 백업.
    //   2026-06-19 CRITICAL fix — 기존: 제목·사주·날짜만 올려서, 기기 저장소 비워지면 복원 시 '빈 껍데기'
    //     → "결제했는데 결과 안 보임 / 내역 사라짐" 유료 콘텐츠 유실. 이제 aiResult 까지 백업/복원.
    //   큰 JSON 은 문자열(aiResultJson)로 — Firestore 색인 1500byte 한계 회피 (색인예외 필드).
    const localReports = getReports();
    for (const report of localReports) {
      const reportRef = doc(db, `users/${uid}/reports`, report.id);
      const existing = await getDoc(reportRef);
      const contentMissing = !existing.exists() || existing.data().aiResultJson == null;
      if (!existing.exists() || (report.aiResult && contentMissing)) {
        batch.set(reportRef, {
          name: report.name,
          input: report.input,
          sajuData: report.sajuData,
          situation: report.situation || null,
          createdAt: report.createdAt,
          contentType: report.contentType ?? null,
          type: report.type ?? null,
          profileId: report.profileId ?? null,
          ...(report.aiResult ? { aiResultJson: JSON.stringify(report.aiResult) } : {}),
        }, { merge: true });
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
        // 2026-06-19 — 내용(aiResult) 복원 (문자열 → 파싱). 없으면(구 백업) undefined → 빈 껍데기지만 기존과 동일.
        let aiResult: unknown = undefined;
        try { if (data.aiResultJson) aiResult = JSON.parse(data.aiResultJson); } catch { /* noop */ }
        saveReport({
          id: docSnap.id,
          name: data.name,
          input: data.input,
          sajuData: data.sajuData,
          situation: data.situation,
          createdAt: data.createdAt,
          contentType: data.contentType ?? undefined,
          type: data.type ?? undefined,
          profileId: data.profileId ?? undefined,
          aiResult,
        } as LocalReport);
      }
    });

    // 2. 클라우드 잔액 → 로컬에 반영
    // 2026-05-28 — 무조건 덮어쓰기 제거. 어뷰징 방지 (로컬에서 차감 후 sync 시 복원되는 무한충전 차단).
    //   정책: 클라우드 잔액이 로컬보다 많을 때만 (= 다른 디바이스 충전 흔적) 차이만큼 보강.
    //   로컬보다 적으면 무시 (= 이미 차감했는데 서버는 미반영된 경우 — 클라가 진실).
    //   숫자 schema(legacy)는 객체로 변환해서 비교.
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const cloudBalanceRaw = userDoc.data().balance as BalanceDetail | number | undefined;
      const cloudBalance: BalanceDetail | null = (() => {
        if (cloudBalanceRaw == null) return null;
        if (typeof cloudBalanceRaw === 'number') return { paid: cloudBalanceRaw, bonus: 0, reward: 0 };
        return cloudBalanceRaw;
      })();
      if (cloudBalance) {
        try {
          const localRaw = localStorage.getItem('saju500_balance_v2');
          const local: BalanceDetail = localRaw ? JSON.parse(localRaw) : { paid: 0, bonus: 0, reward: 0 };
          const cloudTotal = (cloudBalance.paid || 0) + (cloudBalance.bonus || 0) + (cloudBalance.reward || 0);
          const localTotal = (local.paid || 0) + (local.bonus || 0) + (local.reward || 0);
          // 클라우드가 더 많으면 다른 디바이스 충전분 → 차이만큼 paid 에 보강
          if (cloudTotal > localTotal) {
            const diff = cloudTotal - localTotal;
            local.paid = (local.paid || 0) + diff;
            localStorage.setItem('saju500_balance_v2', JSON.stringify(local));
          }
          // 로컬이 더 많으면 (클라가 차감, 서버 미반영) — 무시. 다음 차감 시 서버에도 반영됨.
        } catch (parseErr) {
          // 파싱 실패 시 안전하게 클라우드 잔액으로 초기화
          localStorage.setItem('saju500_balance_v2', JSON.stringify(cloudBalance));
        }
      }
    }
  } catch (err) {
    console.warn('[Sync] 클라우드 다운로드 실패:', err);
  }
}
