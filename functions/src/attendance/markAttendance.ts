/**
 * markAttendance — 결과 페이지 렌더링 완료 직후 호출되는 출석 마커.
 *   근거: 09_이벤트_v4.md §3·§9 · 핸드오버 §0-Q3·§1-B-2
 *
 *   - callable · 인증 필수
 *   - 오늘(KST) attendance/{YYYY-MM-DD} 1회만 생성 (idempotent)
 *   - streakAttendance/current 업데이트 (이동윈도우 규칙)
 *   - 3일 연속 달성 시 claimStreakReward 호출
 *   - 이번 주 7일 전부 달성 시 claimWeeklyTossPoint 호출
 *   - 반환: AttendanceResult (클라이언트가 Tier A/B 연출 판단)
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { claimStreakReward } from './claimStreakReward';
import { claimWeeklyTossPoint } from './claimWeeklyTossPoint';

// APPINTOS_MTLS_CERT / KEY / PROMOTION_CODE 는 실제 LIVE 전환 시점에
// `firebase functions:secrets:set` 으로 주입. 현재 STUB 모드 (환경변수 부재 시 자동 목업).
// defineSecret 을 쓰면 미주입 상태 배포 실패하므로 runtime 단에서만 참조.

/* ─── 날짜 유틸 (KST 기준) ─── */

function kstToday(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10); // YYYY-MM-DD
}

function kstAddDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO 주차 (월요일 시작) — "YYYY-Www". */
function kstWeekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  // ISO 8601: 주의 첫날 = 월요일 · 주 번호는 1월 4일을 포함하는 주가 week 1
  const day = d.getUTCDay() || 7; // 일=0 → 7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const markAttendance = onCall(
  {
    // STUB 모드: secrets 미선언. LIVE 전환 시 `secrets: [APPINTOS_MTLS_CERT, APPINTOS_MTLS_KEY, APPINTOS_PROMOTION_CODE]` 추가.
    timeoutSeconds: 30,
    memory: '256MiB',
    minInstances: 0,
    cors: true,
    invoker: 'public',
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인 필요');

    const db = admin.firestore();
    const today = kstToday();
    const yesterday = kstAddDays(today, -1);
    const weekKey = kstWeekKey(today);

    // 1. 오늘 출석 문서 생성 (이미 있으면 no-op)
    const attendanceRef = db.doc(`users/${uid}/attendance/${today}`);
    const attendanceSnap = await attendanceRef.get();
    const isFirstToday = !attendanceSnap.exists;
    if (isFirstToday) {
      await attendanceRef.set({
        dateKey: today,
        weekKey,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // 2. streakAttendance 이동윈도우 갱신 (트랜잭션)
    const streakRef = db.doc(`users/${uid}/streakAttendance/current`);
    const streak = await db.runTransaction(async (tx) => {
      const snap = await tx.get(streakRef);
      const data = (snap.exists ? snap.data() : {}) as any;
      const lastDate: string | null = data?.lastAttendedDate ?? null;

      if (lastDate === today) {
        return { currentStreak: data.currentStreak ?? 0, startDate: data.startDate ?? null, changed: false };
      }

      let currentStreak: number;
      let startDate: string;
      if (lastDate === yesterday) {
        currentStreak = (data.currentStreak ?? 0) + 1;
        startDate = data.startDate ?? today;
      } else {
        currentStreak = 1;
        startDate = today;
      }

      tx.set(
        streakRef,
        {
          startDate,
          currentStreak,
          lastAttendedDate: today,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { currentStreak, startDate, changed: true };
    });

    // 3. 3일 연속 달성 시 운 1 지급 (내부 함수)
    let streakRewardGranted = false;
    if (streak.changed && streak.currentStreak >= 3 && streak.startDate) {
      const res = await claimStreakReward(db, uid, streak.startDate, today);
      streakRewardGranted = res.granted;
      if (res.granted) {
        // streak 리셋 (다음 3일 사이클 시작)
        await streakRef.set(
          { currentStreak: 0, startDate: null, lastClaimAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
      }
    }

    // 4. 이번 주 7일 완주 체크
    const weekSnap = await db
      .collection(`users/${uid}/attendance`)
      .where('weekKey', '==', weekKey)
      .get();
    const weekCompleted = weekSnap.size;

    let weekRewardGranted = false;
    let weekRewardKind: 'tosspoint' | 'un_fallback' | null = null;
    let tossTxId: string | undefined;

    if (weekCompleted >= 7) {
      const res = await claimWeeklyTossPoint(db, uid, weekKey);
      if (res.granted) {
        weekRewardGranted = true;
        weekRewardKind = res.kind;
        tossTxId = res.tossTxId;
      }
    }

    // 5. 반환 (클라이언트가 Tier A/B 연출 판단)
    return {
      attended: isFirstToday,
      streakCount: streakRewardGranted ? 0 : streak.currentStreak,
      weekProgress: { completed: weekCompleted, weekKey },
      streakRewardGranted,
      weekRewardGranted,
      weekRewardKind,
      tossTxId,
    };
  },
);
