/**
 * syncIapRefunds — 토스 앱 결제(인앱결제) 환불의 운 회수 (2026-10-19)
 *
 * 왜: 토스 앱 결제 환불은 우리 승인 없이 끝날 수 있다(안드로이드는 '상품을 받지 못했어요'로 요청 즉시 완료된 사례 2건, 6월.
 *   아이폰은 애플이 정한다). 그런데 서버가 환불을 알 길이 없어 운과 보너스가 그대로 남았다(웹 포트원은 10-16부터 회수).
 *
 * 하는 일:
 *   - 30분마다 최근 30일, 매일 3시 40분에 31~150일 전의 '확정' 토스 결제를 토스 '결제 상태 조회'(mTLS)로 확인한다.
 *   - REFUNDED 면 웹 환불과 같은 방식으로 한 트랜잭션에:
 *       결제 기록 status 'refunded' + refundedAt / 서버 잔액에서 그 결제의 운과 보너스 차감(0 아래로 안 내림) /
 *       users/{uid}/balanceAdjustments/{orderId} 기기 차감 지시(앱이 열릴 때 기기 잔액에서 뺀다, balanceAdjust.ts)
 *   - 같은 주문이 여러 계정에 있으면(기기 이관, 결제이력 복구) 가장 최근 계정에만 차감 지시를 남기고 나머지는 상태만 바꾼다.
 *   - 거둘 운은 결제 기록 값이 아니라 서버 묶음 표(금액 기준)로 정한다.
 *   - 회수할 때마다 backofficeAlerts(kind iap_refund)에 남겨 관리자 화면 경보에 보인다.
 *
 * 토스 API: POST https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/order/get-order-status { orderId }
 *   응답 { resultType, success: { status: PURCHASED|PAYMENT_COMPLETED|REFUNDED|..., statusDeterminedAt } }, 앱당 분당 3,000회.
 */
import * as admin from 'firebase-admin';
import * as https from 'https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { PACKAGE_MAP } from '../shared/chargePackages';

const TOSS_MTLS_CERT = defineSecret('TOSS_MTLS_CERT');
const TOSS_MTLS_KEY = defineSecret('TOSS_MTLS_KEY');
/** 처음 켤 때 한 번은 조회만 하고 바꾸지 않는다(상태 값이 예상과 같은지 로그로 확인) */
const DRY_RUN = false; // 10-19 시험 확인: 195건 중 PURCHASED 193, REFUNDED 2(6월)
/** 이 장치를 켜기 전의 환불은 기록만 바꾸고 운은 거두지 않는다 — 6월 두 건은 '상품을 받지 못했어요' 사유라 실제로 못 받았을 수 있다 */
const RECLAIM_FROM = Date.parse('2026-10-19T00:00:00+09:00');

const tsMs = (v: any): number => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'string' ? Date.parse(v) || 0 : 0);

function orderStatus(orderId: string, cert: string, key: string): Promise<{ status: string; at: string | null }> {
  const body = JSON.stringify({ orderId });
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: 'apps-in-toss-api.toss.im', port: 443, method: 'POST',
      path: '/api-partner/v1/apps-in-toss/order/get-order-status',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      cert, key, timeout: 10000,
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(raw);
          if (j.resultType !== 'SUCCESS') return reject(new Error(`토스 응답 ${res.statusCode} ${JSON.stringify(j.error || j).slice(0, 160)}`));
          resolve({ status: String(j.success?.status || ''), at: j.success?.statusDeterminedAt || null });
        } catch (e) { reject(new Error(`토스 응답 해석 실패 ${res.statusCode} ${raw.slice(0, 120)}`)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('토스 응답 시간 초과')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run(fromDaysAgo: number, toDaysAgo: number, cert: string, key: string): Promise<string> {
  const db = admin.firestore();
  const now = Date.now();
  const lo = now - toDaysAgo * 864e5;
  const hi = now - fromDaysAgo * 864e5;
  // 결제 기록 전체(수백 건)를 읽어 거른다 — pgProvider 컬렉션그룹 색인이 없어서. 수만 건이 되면 색인을 만들고 where 로 바꾼다
  const snap = await db.collectionGroup('payments').get();
  // 주문번호별로 묶는다 (같은 주문이 여러 계정에 있을 수 있다)
  const byOrder = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const d of snap.docs) {
    const p = d.data() as any;
    if (p.pgProvider !== 'iap' || p.status !== 'confirmed') continue;
    const at = tsMs(p.confirmedAt) || tsMs(p.createdAt);
    if (!at || at < lo || at > hi) continue;
    const id = String(p.orderId || d.id);
    (byOrder.get(id) || byOrder.set(id, []).get(id)!).push(d);
  }
  let checked = 0; let refunded = 0; let failed = 0;
  const stat: Record<string, number> = {};
  for (const [orderId, docs] of byOrder) {
    let st: { status: string; at: string | null };
    try { st = await orderStatus(orderId, cert, key); checked += 1; } catch (e: any) {
      failed += 1;
      if (failed <= 3) console.warn('[syncIapRefunds] 조회 실패', orderId.slice(0, 8), e?.message);
      if (failed >= 10) break; // 인증서나 토스 쪽 문제 — 이번 회차는 그만
      continue;
    }
    if (DRY_RUN) { stat[st.status] = (stat[st.status] || 0) + 1; if (st.status === 'REFUNDED') console.info('[syncIapRefunds] 시험: 환불 주문', orderId.slice(0, 8), docs.length); continue; }
    if (st.status !== 'REFUNDED') continue;
    // 가장 최근 계정 한 곳에만 차감 지시
    docs.sort((a, b) => (tsMs((b.data() as any).confirmedAt) || tsMs((b.data() as any).createdAt)) - (tsMs((a.data() as any).confirmedAt) || tsMs((a.data() as any).createdAt)));
    const main = docs[0];
    const uid = main.ref.parent.parent?.id || '';
    const pd = main.data() as any;
    const oldRefund = !!st.at && Date.parse(st.at) < RECLAIM_FROM;
    if (oldRefund) {
      for (const d of docs) await d.ref.update({ status: 'refunded', tossStatus: 'REFUNDED', tossStatusAt: st.at, refundedAt: st.at ? new Date(st.at) : admin.firestore.FieldValue.serverTimestamp(), refundNote: '회수 장치(10-19) 전 환불이라 운은 거두지 않음' }).catch(() => undefined);
      console.info('[syncIapRefunds] 예전 환불 기록만', orderId.slice(0, 8), st.at);
      continue;
    }
    const pkg = PACKAGE_MAP[Number(pd.amount)] || { paidUn: Number(pd.paidUn) || 0, bonusUn: Number(pd.bonusUn) || 0 };
    const userRef = db.collection('users').doc(uid);
    const adjRef = userRef.collection('balanceAdjustments').doc(orderId);
    const done = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(main.ref);
      if ((fresh.data() as any)?.status !== 'confirmed') return false; // 이미 처리
      const u = await tx.get(userRef);
      const bal = (u.data() || {}).balance || {};
      tx.set(userRef, {
        balance: {
          paid: Math.max(0, Number(bal.paid || 0) - pkg.paidUn),
          bonus: Math.max(0, Number(bal.bonus || 0) - pkg.bonusUn),
        },
        totalCharged: admin.firestore.FieldValue.increment(-pkg.paidUn),
      }, { merge: true });
      tx.update(main.ref, {
        status: 'refunded', tossStatus: 'REFUNDED', tossStatusAt: st.at,
        refundedAt: admin.firestore.FieldValue.serverTimestamp(), cancelledAmount: Number(pd.amount) || 0,
      });
      tx.set(adjRef, {
        paid: -pkg.paidUn, bonus: -pkg.bonusUn, reason: 'toss_iap_refund', orderId,
        amount: Number(pd.amount) || 0, applied: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (!done) continue;
    // 같은 주문의 다른 계정 기록은 상태만
    for (const d of docs.slice(1)) {
      await d.ref.update({ status: 'refunded', tossStatus: 'REFUNDED', tossStatusAt: st.at, refundedAt: admin.firestore.FieldValue.serverTimestamp(), refundNote: `회수는 ${uid.slice(0, 8)}… 계정에서` }).catch(() => undefined);
    }
    refunded += 1;
    await db.collection('backofficeAlerts').add({
      kind: 'iap_refund', uid, orderId, amount: Number(pd.amount) || 0, paidUn: pkg.paidUn, bonusUn: pkg.bonusUn,
      note: '토스 앱 결제가 환불돼 운과 보너스를 거뒀어요(기기는 다음에 열 때 빠짐)', createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => undefined);
  }
  return `주문 ${byOrder.size}건 확인 ${checked}, 환불 회수 ${refunded}, 조회 실패 ${failed}${DRY_RUN ? ` (시험, 상태별 ${JSON.stringify(stat)})` : ''}`;
}

/** 30분마다 — 최근 30일 */
export const syncIapRefunds = onSchedule(
  { schedule: 'every 30 minutes', timeZone: 'Asia/Seoul', secrets: [TOSS_MTLS_CERT, TOSS_MTLS_KEY], timeoutSeconds: 300, memory: '256MiB', retryCount: 0 },
  async () => {
    console.info('[syncIapRefunds] 최근 30일:', await run(0, 30, TOSS_MTLS_CERT.value(), TOSS_MTLS_KEY.value()));
  },
);

/** 매일 3시 40분 — 31~150일 전 (아이폰 환불은 늦게 올 수 있다) */
export const syncIapRefundsDeep = onSchedule(
  { schedule: '40 3 * * *', timeZone: 'Asia/Seoul', secrets: [TOSS_MTLS_CERT, TOSS_MTLS_KEY], timeoutSeconds: 540, memory: '256MiB', retryCount: 0 },
  async () => {
    console.info('[syncIapRefunds] 31~150일:', await run(30, 150, TOSS_MTLS_CERT.value(), TOSS_MTLS_KEY.value()));
  },
);
