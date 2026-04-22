/**
 * claimWeeklyTossPoint — 7일 완주 토스포인트 100원 지급 (내부 함수).
 *   근거: 09_이벤트_v4.md §4·§9 · 핸드오버 §1-B-4 · API 리서치 §6
 *
 *   - idempotency 키: `tosspoint_week7_{uid}_{weekKey}` (rewardClaims 문서 ID)
 *   - 7일 출석 재검증 (attendance 컬렉션 count)
 *   - grantTossPoint 호출 (STUB 모드면 항상 성공 + tossTxId="STUB_...")
 *   - 재시도 3회 · 실패 시 운 2 폴백 + 백오피스 알림
 *   - 앱인토스 정책: 고정형 100원 / 랜덤 금지
 */

import * as admin from 'firebase-admin';
import { grantTossPoint, getUserKey, getAppintosMode } from '../shared/appintosClient';

export interface WeeklyClaimResult {
  granted: boolean;
  kind: 'tosspoint' | 'un_fallback' | null;
  tossTxId?: string;
  claimId: string;
  mode: 'STUB' | 'LIVE';
  reason?: string;
}

const RETRY_MAX = 3;
const RETRYABLE_CODES = new Set(['4110', '4112', '4116']);

export async function claimWeeklyTossPoint(
  db: admin.firestore.Firestore,
  uid: string,
  weekKey: string,
): Promise<WeeklyClaimResult> {
  const claimId = `tosspoint_week7_${uid}_${weekKey}`;
  const claimRef = db.doc(`users/${uid}/rewardClaims/${claimId}`);
  const mode = getAppintosMode();

  // 1. 사전 멱등성 체크 (트랜잭션 밖에서 빠르게 stop)
  const existing = await claimRef.get();
  if (existing.exists) {
    const d = existing.data() as any;
    return {
      granted: false,
      kind: d?.type === 'attendance_week7_fallback' ? 'un_fallback' : 'tosspoint',
      tossTxId: d?.tossTxId,
      claimId,
      mode,
      reason: 'already_claimed',
    };
  }

  // 2. 7일 출석 재검증
  const attendanceSnap = await db
    .collection(`users/${uid}/attendance`)
    .where('weekKey', '==', weekKey)
    .get();
  if (attendanceSnap.size < 7) {
    return { granted: false, kind: null, claimId, mode, reason: 'not_completed' };
  }

  // 3. 사전 lock (한 주 1회만 보장) — 트랜잭션으로 claimRef 선점
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(claimRef);
      if (snap.exists) {
        throw new Error('RACE_ALREADY_CLAIMED');
      }
      tx.set(claimRef, {
        type: 'attendance_week7_pending',
        cycle: weekKey,
        amount: 100,
        currency: 'TOSSPOINT',
        idempotencyKey: claimId,
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } catch (e: any) {
    if (String(e?.message).includes('RACE_ALREADY_CLAIMED')) {
      return { granted: false, kind: 'tosspoint', claimId, mode, reason: 'race_already_claimed' };
    }
    throw e;
  }

  // 4. 토스포인트 실지급 (3회 재시도)
  const promotionCode = process.env.APPINTOS_PROMOTION_CODE || 'TEST_PENDING';
  let lastError: { code: string; reason: string } | null = null;

  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    try {
      const userKey = await getUserKey(uid);
      const result = await grantTossPoint({
        userKey,
        promotionCode,
        amount: 100,
        idempotencyKey: claimId,
      });

      if (result.resultType === 'SUCCESS') {
        // 성공 — pending → attendance_week7_tosspoint
        await claimRef.set(
          {
            type: 'attendance_week7_tosspoint',
            tossTxId: result.success.key,
            mode,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        // eslint-disable-next-line no-console
        console.info('[claimWeeklyTossPoint] granted', {
          uid,
          weekKey,
          mode,
          tossTxId: result.success.key,
          attempt,
        });
        return { granted: true, kind: 'tosspoint', tossTxId: result.success.key, claimId, mode };
      }

      // FAILURE
      lastError = { code: result.error.errorCode, reason: result.error.reason };
      if (!RETRYABLE_CODES.has(result.error.errorCode)) break;
      // eslint-disable-next-line no-console
      console.warn(`[claimWeeklyTossPoint] retry ${attempt}/${RETRY_MAX}`, lastError);
    } catch (e: any) {
      lastError = { code: 'NETWORK', reason: e?.message ?? 'unknown' };
      // eslint-disable-next-line no-console
      console.warn(`[claimWeeklyTossPoint] throw ${attempt}/${RETRY_MAX}`, e?.message);
    }
  }

  // 5. 폴백: 운 2 + 백오피스 알림
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const prev = (userSnap.exists && (userSnap.data() as any)?.unBalance) ?? 0;
    tx.set(userRef, { unBalance: prev + 2 }, { merge: true });
    tx.set(
      claimRef,
      {
        type: 'attendance_week7_fallback',
        amount: 2,
        currency: 'UN',
        tossErrorCode: lastError?.code ?? 'UNKNOWN',
        tossErrorReason: lastError?.reason ?? 'all retries failed',
        grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(db.collection('backofficeAlerts').doc(), {
      kind: 'tosspoint_fallback',
      uid,
      weekKey,
      error: lastError,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // eslint-disable-next-line no-console
  console.error('[claimWeeklyTossPoint] fallback to UN 2', { uid, weekKey, lastError });
  return { granted: true, kind: 'un_fallback', claimId, mode, reason: lastError?.code };
}
