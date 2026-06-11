/**
 * 앱인토스 인앱결제(IAP) + 웹 결제 서비스
 *
 * 앱인토스 IAP 정책:
 * - SDK: @apps-in-toss/web-framework (v1.1.3+)
 * - 상품 유형: 소모품(Consumable) — "운(運)"
 * - 수수료: 앱마켓 15% + 토스 5% = 20%
 * - 최소 가격: 공급가 400원(VAT별도), 소비자가 ~440원
 * - processProductGrant 콜백에서 서버 지급 처리 필수
 * - 앱 시작 시 getPendingOrders()로 미지급 주문 복구 필수
 *
 * @see https://developers-apps-in-toss.toss.im/iap/develop.html
 */

import { addPaidBalance, spendBalance } from '@/services/storage/localStore';
import type { ChargePackage } from '@/types/payment';

/** 앱인토스 환경인지 감지 */
export function isAppsInToss(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('TossApp');
}

/**
 * IAP 상품 SKU 매핑 — #55 정정 (2026-04-27, 4 패키지 진본)
 *
 * 토스 콘솔 진본 4 패키지 (1/4/7/15운) 정렬:
 *  - p1   1운  / 500원   — paidUn=1,  bonusUn=0
 *  - p4   4운  / 1500원  — paidUn=3,  bonusUn=1
 *  - p7   7운  / 2500원  — paidUn=5,  bonusUn=2
 *  - p15  15운 / 5000원  — paidUn=10, bonusUn=5  ★ 프리미엄 라인 (가장 인기)
 *
 * 토스 콘솔 표기 "14운(10+5)" 은 typo — 실제 SKU 명에 "15운" 명시 (10+5=15).
 *
 * **Superseded (2026-04-24 5 패키지 결정 무효)**:
 *  - 구 p5/p10/p30/p50 SKU 매핑 제거 — `pricing.ts LEGACY_PACKAGE_ALIASES` 로 자동 변환.
 *  - p7 = 구 p5 SKU 재사용 (가격 2500원 동일, 보너스만 추가)
 *  - p15 = 구 p10 SKU 재사용 (가격 5000원 동일, 보너스만 추가)
 *  - p4 = 신규 SKU (1500원 가격대 신설)
 */
const IAP_PRODUCT_MAP: Record<string, { sku: string; paidUn: number; bonusUn: number }> = {
  p1:  { sku: 'ait.0000025955.8f74931d.d3f5a2a979.5185316383', paidUn: 1,  bonusUn: 0 },
  p4:  { sku: 'ait.0000025955.5d5bec27.6ee0778e2a.5185547787', paidUn: 3,  bonusUn: 1 },
  p7:  { sku: 'ait.0000025955.79d2ae48.26de419a84.5185590911', paidUn: 5,  bonusUn: 2 },
  p15: { sku: 'ait.0000025955.304b4aa7.cabbd01e5e.5185730660', paidUn: 10, bonusUn: 5 },
};

/**
 * 인앱결제 요청
 */
export async function purchasePackage(pkg: ChargePackage): Promise<{ success: boolean; message: string }> {
  if (isAppsInToss()) {
    return purchaseViaIAP(pkg);
  }
  return purchaseViaWeb(pkg);
}

/**
 * 앱인토스 IAP 구매
 * SDK 1.1.3+ 필수 — processProductGrant 콜백 포함
 */
async function purchaseViaIAP(pkg: ChargePackage): Promise<{ success: boolean; message: string }> {
  // legacy 패키지 ID 대비 — pricing.ts LEGACY_PACKAGE_ALIASES 와 동일 매핑
  const { LEGACY_PACKAGE_ALIASES } = await import('@/constants/pricing');
  const resolvedId = LEGACY_PACKAGE_ALIASES[pkg.id] ?? pkg.id;
  const product = IAP_PRODUCT_MAP[resolvedId];
  if (!product) return { success: false, message: '상품 정보를 찾을 수 없습니다' };

  return new Promise((resolve) => {
    try {
      // 동적 import — 런타임에만 로드 (Vite 정적분석 우회)
      import('@apps-in-toss/web-framework').then((mod: any) => {
        const IAP = mod.IAP;
        IAP.createOneTimePurchaseOrder({
          options: {
            sku: product.sku,
            processProductGrant: async ({ orderId }: { orderId: string }) => {
              // 30초 내에 return true 해야 함 (앱인토스 정책)
              // 로컬 먼저 적립 → 서버는 비동기로 (실패 시 getPendingOrders로 복구)
              try {
                // 1. 로컬 즉시 적립 (UX 빠르게)
                addPaidBalance(product.paidUn, product.bonusUn);
                // 측정 — IAP 충전 완료 (2026-06-12: 웹 PG만 찍히고 IAP 누락이던 갭 fix)
                import('@/services/analytics').then(a => a.trackEvent('charge_complete', { amount: pkg.price, package: resolvedId, pg: 'iap' })).catch(() => {});

                // 2. 서버에 비동기 기록 (실패해도 return true — restorePendingPurchases 가 복구)
                // 2026-05-28 — silent fail 보강: 실패 시 console.error + pending orderId 로컬 큐 적재
                import('firebase/functions').then(({ getFunctions, httpsCallable }) => {
                  const fns = getFunctions(undefined, 'us-central1');
                  httpsCallable(fns, 'grantPurchase')({
                    orderId,
                    sku: product.sku,
                    paidUn: product.paidUn,
                    bonusUn: product.bonusUn,
                  }).catch((err) => {
                    console.error('[IAP] grantPurchase 실패 (restorePendingPurchases 가 복구):', orderId, err);
                    try {
                      const key = 'saju500:iap_pending_grants:v1';
                      const existing = JSON.parse(localStorage.getItem(key) || '[]');
                      existing.push({ orderId, sku: product.sku, paidUn: product.paidUn, bonusUn: product.bonusUn, ts: Date.now() });
                      localStorage.setItem(key, JSON.stringify(existing));
                    } catch { /* noop */ }
                  });
                });

                return true; // 30초 제한 내에 즉시 반환
              } catch {
                return false;
              }
            },
          },
          onEvent: (event: any) => {
            if (event.type === 'success') {
              const total = product.paidUn + product.bonusUn;
              resolve({
                success: true,
                message: `${total}운이 충전되었습니다!`,
              });
            }
          },
          onError: (error: any) => {
            console.error('[IAP] 구매 오류:', error);
            resolve({ success: false, message: '결제가 취소되었거나 오류가 발생했습니다' });
          },
        });
      }).catch(() => {
        resolve({ success: false, message: '결제 모듈을 불러올 수 없습니다' });
      });
    } catch {
      resolve({ success: false, message: '결제 처리 중 오류가 발생했습니다' });
    }
  });
}

/**
 * 앱 시작 시 미지급 주문 복구
 * 결제는 완료됐지만 서버 지급이 실패한 경우 복구
 * App.tsx에서 한 번 호출
 */
export async function restorePendingPurchases(): Promise<void> {
  if (!isAppsInToss()) return;

  try {
    const { IAP } = await import('@apps-in-toss/web-framework');
    const result = await IAP.getPendingOrders();
    if (!result || result.orders.length === 0) return;

    // 2026-05-28 — idempotency: orderId 기반 처리 추적. SDK 재호출 시 중복 적립 차단.
    const PROCESSED_KEY = 'saju500:iap_processed_orders:v1';
    let processed: string[] = [];
    try { processed = JSON.parse(localStorage.getItem(PROCESSED_KEY) || '[]'); } catch { /* noop */ }
    const processedSet = new Set(processed);

    for (const order of result.orders) {
      const product = Object.values(IAP_PRODUCT_MAP).find(p => p.sku === order.sku);
      if (!product) continue;
      // 이미 처리한 orderId 면 SDK completeProductGrant 만 호출 (잔액 재적립 X)
      if (processedSet.has(order.orderId)) {
        try { await IAP.completeProductGrant({ params: { orderId: order.orderId } }); } catch { /* noop */ }
        continue;
      }

      try {
        addPaidBalance(product.paidUn, product.bonusUn);
        // 서버에도 재기록 시도 (pending 큐 fallback)
        try {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const fns = getFunctions(undefined, 'us-central1');
          await httpsCallable(fns, 'grantPurchase')({
            orderId: order.orderId, sku: order.sku,
            paidUn: product.paidUn, bonusUn: product.bonusUn,
          });
        } catch (serverErr) {
          console.error('[IAP] 복구 시 서버 기록 실패:', order.orderId, serverErr);
        }
        // orderId 처리 완료 표시
        processedSet.add(order.orderId);
        try { localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processedSet])); } catch { /* noop */ }

        // 지급 완료 처리
        await IAP.completeProductGrant({ params: { orderId: order.orderId } });
        console.log('[IAP] 복구 완료:', order.orderId);
      } catch (err) {
        console.error('[IAP] 복구 실패:', order.orderId, err);
      }
    }
  } catch {
    // SDK 로드 실패 — 무시
  }
}

/** 웹 브라우저 — 토스페이먼츠 PG 결제 */
async function purchaseViaWeb(pkg: ChargePackage): Promise<{ success: boolean; message: string }> {
  try {
    const { requestTossPayment } = await import('@/services/payment/tossPayments');
    await requestTossPayment(pkg);
    // requestTossPayment은 리다이렉트 발생 — 여기 도달하면 취소된 것
    return { success: false, message: '결제가 취소됐어요' };
  } catch (err: any) {
    console.error('[Web Payment]', err);
    return { success: false, message: err.message || '결제 처리 중 오류가 발생했어요' };
  }
}

/** 운 사용 — reward → bonus → paid 순으로 차감 */
export function spendUn(amount: number): boolean {
  return spendBalance(amount);
}
