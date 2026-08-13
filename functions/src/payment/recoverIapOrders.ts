/**
 * IAP 결제 이력 기반 잔액 복구 (2026-08-07 신설 · CS "운도 보관함도 전부 사라졌어요")
 *
 * 배경: 우리 잔액(운)은 localStorage 가 주 저장소이고, 서버 users/{uid}.balance 는 '충전만' 반영된
 *   값이라 복원하면 이미 쓴 운이 되살아난다(그래서 syncFromCloud 는 reportsOnly 로 잔액 복원을 끔).
 *   결과적으로 **기기 저장소가 초기화되면 충전한 운이 영구 소실**됐다.
 *
 * 해법: 토스 IAP 주문 이력(`IAP.getCompletedOrRefundedOrders`)은 **토스 계정 기준**이라
 *   localStorage·기기·익명 uid 와 무관하게 살아남는다. 이를 근거로 "결제했지만 이 uid 가 받은 적 없는"
 *   주문만 골라 재지급한다.
 *
 * 지급 판정 (순서대로):
 *   1) `users/{uid}/payments/{orderId}` 가 confirmed → 이 uid 는 이미 받음 → skip
 *   2) 전역 `iapOrders/{orderId}.recoverCount >= MAX_RECOVER` → 어뷰징 방지로 skip
 *      (재설치를 반복해 같은 주문으로 계속 운을 받는 것을 막는다)
 *   3) 그 외 → 서버 SSOT 매핑으로 지급 + 전역/유저 기록
 *
 * 🚨 보안: sku→운 매핑은 **서버가 진실**이다. 클라가 넘긴 금액을 신뢰하지 않는다.
 *   (기존 grantPurchase 는 클라가 paidUn 을 넘기는 구조라 조작 여지가 있음 — 별도 티켓)
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/** 같은 주문으로 허용할 최대 '복구' 횟수 (최초 결제 지급은 별도) */
const MAX_RECOVER_PER_ORDER = 1;

/** 한 번에 처리할 주문 상한 — 과도한 페이로드 방어 */
const MAX_ORDERS_PER_CALL = 50;

/**
 * SKU → 지급 운 매핑 (서버 SSOT).
 * 클라 src/services/payment/iapService.ts 의 IAP_PRODUCT_MAP 과 동일해야 한다.
 * 토스 콘솔 4 패키지: 1운/500원 · 4운(3+1)/1500원 · 7운(5+2)/2500원 · 15운(10+5)/5000원
 */
const SKU_UN_MAP: Record<string, { paidUn: number; bonusUn: number; amount: number }> = {
  'ait.0000025955.8f74931d.d3f5a2a979.5185316383': { paidUn: 1,  bonusUn: 0, amount: 500 },
  'ait.0000025955.5d5bec27.6ee0778e2a.5185547787': { paidUn: 3,  bonusUn: 1, amount: 1500 },
  'ait.0000025955.79d2ae48.26de419a84.5185590911': { paidUn: 5,  bonusUn: 2, amount: 2500 },
  'ait.0000025955.304b4aa7.cabbd01e5e.5185730660': { paidUn: 10, bonusUn: 5, amount: 5000 },
};

interface IncomingOrder {
  orderId?: unknown;
  sku?: unknown;
  status?: unknown;
  date?: unknown;
}

export const recoverIapOrders = onCall(
  { timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인 필요');

    const raw = (request.data?.orders ?? []) as IncomingOrder[];
    if (!Array.isArray(raw)) throw new HttpsError('invalid-argument', 'orders 배열 필요');

    // COMPLETED(환불되지 않은) 주문만, 형식 검증 후 상한 적용
    const orders = raw
      .filter((o) => typeof o?.orderId === 'string' && typeof o?.sku === 'string' && o?.status === 'COMPLETED')
      .slice(0, MAX_ORDERS_PER_CALL) as { orderId: string; sku: string; date?: string }[];

    let grantedPaid = 0;
    let grantedBonus = 0;
    const recovered: string[] = [];
    let skippedAlreadyMine = 0;
    let skippedAbuseGuard = 0;
    let skippedUnknownSku = 0;

    for (const o of orders) {
      const map = SKU_UN_MAP[o.sku];
      if (!map) { skippedUnknownSku++; continue; }

      const myPaymentRef = db.doc(`users/${uid}/payments/${o.orderId}`);
      const globalRef = db.doc(`iapOrders/${o.orderId}`);

      // 1) 이 uid 가 이미 받았는가 (정상 결제 완료 케이스)
      const mine = await myPaymentRef.get();
      const mineStatus = mine.exists ? mine.data()?.status : null;
      if (mineStatus === 'confirmed' || mineStatus === 'completed') { skippedAlreadyMine++; continue; }

      // 2) 어뷰징 가드 — 같은 주문의 복구 횟수 상한
      const g = await globalRef.get();
      const recoverCount = (g.exists ? (g.data()?.recoverCount as number | undefined) : 0) ?? 0;
      if (recoverCount >= MAX_RECOVER_PER_ORDER) { skippedAbuseGuard++; continue; }

      // 3) 지급 — 유저 잔액 + 유저 결제기록 + 전역 주문기록을 한 트랜잭션으로
      try {
        await db.runTransaction(async (tx) => {
          const userRef = db.collection('users').doc(uid);
          const userDoc = await tx.get(userRef);
          const data = userDoc.data() || {};

          tx.set(userRef, {
            balance: {
              paid: (data.balance?.paid ?? 0) + map.paidUn,
              bonus: (data.balance?.bonus ?? 0) + map.bonusUn,
            },
            totalCharged: admin.firestore.FieldValue.increment(map.paidUn),
          }, { merge: true });

          tx.set(myPaymentRef, {
            type: 'charge', orderId: o.orderId, sku: o.sku,
            paidUn: map.paidUn, bonusUn: map.bonusUn, amount: map.amount,
            pgProvider: 'iap',
            status: 'confirmed',
            recoveredFromIapHistory: true, // 결제 시점이 아니라 이력 복구로 지급됨
            orderDate: o.date ?? null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          tx.set(globalRef, {
            sku: o.sku,
            recoverCount: admin.firestore.FieldValue.increment(1),
            lastRecoveredUid: uid,
            lastRecoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        });

        grantedPaid += map.paidUn;
        grantedBonus += map.bonusUn;
        recovered.push(o.orderId);
      } catch (err: any) {
        console.error('[recoverIapOrders] 지급 실패:', o.orderId, err?.message);
        // 개별 실패는 건너뛰고 계속 (다음 부팅에 재시도 가능)
      }
    }

    if (recovered.length > 0) {
      console.log(`[recoverIapOrders] uid=${uid} 복구 ${recovered.length}건 (+${grantedPaid}운/+${grantedBonus}보너스)`);
    }

    /* ── 보관함(리포트) 이관 ──────────────────────────────────────────────
     * 잔액과 별개로 유저가 잃는 것이 '구매한 사주'다. 리포트는 users/{uid}/reports 에 백업되고
     * bootSync 가 복원하지만, **익명 uid 가 회전하면 옛 uid 를 몰라 영영 못 찾는다.**
     *
     * 그런데 IAP 주문 이력의 orderId 는 옛 uid 의 payments 문서에 필드로 남아 있다.
     * → collectionGroup('payments').where('orderId','==',…) 로 **옛 uid 를 역추적**해 리포트를 이관한다.
     * 소유증명: orderId 는 그 토스 계정의 결제 이력에서만 나오므로 본인 확인으로 충분하다.
     *
     * 안전장치: 복사(원본 보존) · 이미 있는 id 는 건너뜀 · 건수 상한 · 실패해도 잔액 복구 결과는 유지.
     */
    let migratedReports = 0;
    const MIGRATE_LIMIT = 200;
    try {
      const orderIds = orders.map((o) => o.orderId).slice(0, 10); // 역추적은 소수 주문으로 충분
      const legacyUids = new Set<string>();
      for (const oid of orderIds) {
        const snap = await db.collectionGroup('payments').where('orderId', '==', oid).limit(5).get();
        snap.forEach((d) => {
          const parentUid = d.ref.parent.parent?.id;
          if (parentUid && parentUid !== uid) legacyUids.add(parentUid);
        });
      }

      for (const legacyUid of legacyUids) {
        if (migratedReports >= MIGRATE_LIMIT) break;
        const legacyReports = await db.collection(`users/${legacyUid}/reports`).limit(MIGRATE_LIMIT).get();
        if (legacyReports.empty) continue;

        let batch = db.batch();
        let n = 0;
        for (const doc of legacyReports.docs) {
          if (migratedReports >= MIGRATE_LIMIT) break;
          const destRef = db.doc(`users/${uid}/reports/${doc.id}`);
          const dest = await destRef.get();
          if (dest.exists) continue; // 이미 있으면 덮어쓰지 않음
          batch.set(destRef, { ...doc.data(), migratedFromUid: legacyUid, migratedAt: admin.firestore.FieldValue.serverTimestamp() });
          migratedReports++; n++;
          if (n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
        }
        if (n > 0) await batch.commit();
        console.log(`[recoverIapOrders] 보관함 이관 ${legacyUid} → ${uid} (${migratedReports}건)`);
      }
    } catch (err: any) {
      console.warn('[recoverIapOrders] 보관함 이관 실패(잔액 복구는 유지):', err?.message);
    }

    return {
      granted: recovered.length,
      paidUn: grantedPaid,
      bonusUn: grantedBonus,
      orderIds: recovered,
      migratedReports,
      skipped: {
        alreadyMine: skippedAlreadyMine,
        abuseGuard: skippedAbuseGuard,
        unknownSku: skippedUnknownSku,
      },
    };
  },
);
