/**
 * syncPortoneCancellations — 포트원에서 취소된 웹 결제의 운 회수 (2026-10-16 신설)
 *
 * 왜: 웹 환불은 오너가 포트원 콘솔에서 결제를 취소한다. 그런데 운 잔액의 기준은 기기(localStorage)이고 서버는
 *   '다른 기기 충전분 더하기'만 내려보낼 수 있어서, 취소해도 운이 그대로 남았다(오너 10-16 테스트 결제).
 *
 * 하는 일 (15분마다):
 *   1. 포트원에서 최근 8일 안에 상태가 '취소'로 바뀐 실결제를 찾는다 (PORTONE_V2_API_SECRET 조회 전용).
 *   2. 우리 기록 users/{uid}/payments/{paymentId} 가 confirmed 면 한 트랜잭션으로
 *      - 결제 기록 status 'refunded'
 *      - 서버 잔액에서 그 결제로 준 운(결제분 paidUn + 보너스 bonusUn) 차감 (0 아래로는 내리지 않음)
 *      - users/{uid}/balanceAdjustments/{paymentId} 에 기기 차감 지시 { paid: -paidUn, bonus: -bonusUn, applied: false }
 *   3. 앱은 열릴 때 applied=false 인 지시를 읽어 기기 잔액에서 빼고 applied=true 로 표시한다
 *      (src/services/storage/balanceAdjust.ts).
 *   부분 취소는 몇 운을 거둘지 정할 수 없어 기록만 'partial_refund_review' 로 두고 오너 확인 알림을 남긴다.
 */
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';

const PORTONE_V2_API_SECRET = defineSecret('PORTONE_V2_API_SECRET');
const LOOKBACK_DAYS = 8; // 환불 기한 7일 + 하루 여유

export const syncPortoneCancellations = onSchedule(
  { schedule: 'every 15 minutes', timeZone: 'Asia/Seoul', secrets: [PORTONE_V2_API_SECRET], timeoutSeconds: 120, memory: '256MiB', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    const key = PORTONE_V2_API_SECRET.value();
    const from = new Date(Date.now() - LOOKBACK_DAYS * 864e5).toISOString();
    const items: any[] = [];
    for (let page = 0; page < 10; page++) {
      const body = { page: { number: page, size: 100 }, filter: { isTest: false, timestampType: 'STATUS_CHANGED_AT', from, until: new Date().toISOString(), status: ['CANCELLED', 'PARTIAL_CANCELLED'] } };
      const res = await fetch('https://api.portone.io/payments?requestBody=' + encodeURIComponent(JSON.stringify(body)), { headers: { Authorization: `PortOne ${key}` } });
      if (!res.ok) { console.error('[portoneCancelSync] 조회 실패', res.status, await res.text().catch(() => '')); return; }
      const j: any = await res.json();
      items.push(...(j.items || []));
      if ((j.items || []).length < 100) break;
    }

    let done = 0; let skipped = 0;
    for (const p of items) {
      let cd: any = p.customData;
      try { if (typeof cd === 'string') cd = JSON.parse(cd); } catch { cd = null; }
      const uid: string = cd?.uid || '';
      const paymentId: string = p.id;
      if (!uid || !paymentId || !paymentId.startsWith(uid.slice(0, 8))) { skipped++; continue; }

      const userRef = db.collection('users').doc(uid);
      const payRef = userRef.collection('payments').doc(paymentId);
      const adjRef = userRef.collection('balanceAdjustments').doc(paymentId);
      const partial = p.status === 'PARTIAL_CANCELLED';
      const outcome = await db.runTransaction(async (tx) => {
        const pay = await tx.get(payRef);
        if (!pay.exists) return 'no_record';
        const pd = pay.data() || {};
        if (pd.status !== 'confirmed') return 'not_confirmed'; // 이미 처리했거나 지급 전 결제
        const cancelledAmount = Number(p.amount?.cancelled || 0);
        if (partial) {
          tx.update(payRef, {
            status: 'partial_refund_review', portoneStatus: p.status, cancelledAmount,
            portoneCancelledAt: p.cancelledAt || p.statusChangedAt || null,
            reviewNote: '포트원 부분 취소 — 회수할 운을 오너가 정해야 함',
          });
          return 'partial';
        }
        const paidUn = Number(pd.paidUn || 0);
        const bonusUn = Number(pd.bonusUn || 0);
        const u = await tx.get(userRef);
        const bal = (u.data() || {}).balance || {};
        tx.set(userRef, {
          balance: {
            paid: Math.max(0, Number(bal.paid || 0) - paidUn),
            bonus: Math.max(0, Number(bal.bonus || 0) - bonusUn),
          },
          totalCharged: admin.firestore.FieldValue.increment(-paidUn),
        }, { merge: true });
        tx.update(payRef, {
          status: 'refunded', portoneStatus: p.status, cancelledAmount,
          portoneCancelledAt: p.cancelledAt || p.statusChangedAt || null,
          refundedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(adjRef, {
          paid: -paidUn, bonus: -bonusUn, reason: 'portone_refund', paymentId,
          amount: Number(pd.amount || 0), applied: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return 'refunded';
      });

      if (outcome === 'refunded') done++;
      else if (outcome === 'partial') {
        done++;
        await db.collection('backofficeAlerts').add({
          type: 'portone_partial_cancel', uid, paymentId, amount: p.amount?.total || 0, cancelled: p.amount?.cancelled || 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => undefined);
      } else skipped++;
    }
    console.log(`[portoneCancelSync] 취소 ${items.length}건, 처리 ${done}건, 건너뜀 ${skipped}건`);
  },
);
