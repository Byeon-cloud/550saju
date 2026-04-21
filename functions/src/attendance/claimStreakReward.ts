/**
 * claimStreakReward — 내부 함수 (markAttendance 내부에서만 호출).
 *   근거: 09_이벤트_v4.md §3 · 핸드오버 §1-B-3
 *
 *   - idempotency: `streak_{uid}_{startDate}` rewardClaims 문서
 *   - 성공 시 users/{uid}/unBalance +1 (+ rewardClaims 기록)
 *   - 반환: granted boolean + claimId
 */

import * as admin from 'firebase-admin';

export interface StreakClaimResult {
  granted: boolean;
  claimId: string;
  reason?: string;
}

/**
 * 3일 연속 출석 달성 시 운 1 지급.
 * 반드시 Firestore 트랜잭션 안에서만 rewardClaims + unBalance 동시 변경.
 */
export async function claimStreakReward(
  db: admin.firestore.Firestore,
  uid: string,
  streakStartDate: string,
  streakEndDate: string,
): Promise<StreakClaimResult> {
  const claimId = `streak_${uid}_${streakStartDate}`;
  const claimRef = db.doc(`users/${uid}/rewardClaims/${claimId}`);
  const userRef = db.doc(`users/${uid}`);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(claimRef);
    if (existing.exists) {
      return { granted: false, claimId, reason: 'already_claimed' };
    }

    const userSnap = await tx.get(userRef);
    const prevBalance = (userSnap.exists && (userSnap.data() as any)?.unBalance) ?? 0;

    tx.set(claimRef, {
      type: 'attendance_streak3',
      amount: 1,
      currency: 'UN',
      cycle: `${streakStartDate}_${streakEndDate}`,
      idempotencyKey: claimId,
      grantedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(
      userRef,
      { unBalance: prevBalance + 1 },
      { merge: true },
    );

    return { granted: true, claimId };
  });
}
