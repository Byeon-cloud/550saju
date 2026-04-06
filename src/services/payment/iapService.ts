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
 * IAP 상품 SKU 매핑
 * 앱인토스 개발자센터에서 등록한 상품 ID와 일치해야 합니다
 * 공급가 기준 (VAT 별도 → 소비자가는 +10%)
 */
const IAP_PRODUCT_MAP: Record<string, { sku: string; paidUn: number; bonusUn: number }> = {
  once:    { sku: 'saju500.un.1',   paidUn: 1,  bonusUn: 0 },
  more:    { sku: 'saju500.un.4',   paidUn: 3,  bonusUn: 1 },
  serious: { sku: 'saju500.un.7',   paidUn: 5,  bonusUn: 2 },
  yearly:  { sku: 'saju500.un.15',  paidUn: 10, bonusUn: 5 },
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
  const product = IAP_PRODUCT_MAP[pkg.id];
  if (!product) return { success: false, message: '상품 정보를 찾을 수 없습니다' };

  return new Promise((resolve) => {
    try {
      // 동적 import — 런타임에만 로드 (Vite 정적분석 우회)
      const sdkName = '@apps-in-toss/' + 'web-framework';
      import(/* @vite-ignore */ sdkName).then((mod: any) => {
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

                // 2. 서버에 비동기 기록 (실패해도 return true)
                import('firebase/functions').then(({ getFunctions, httpsCallable }) => {
                  const fns = getFunctions(undefined, 'asia-northeast3');
                  httpsCallable(fns, 'grantPurchase')({
                    orderId,
                    sku: product.sku,
                    paidUn: product.paidUn,
                    bonusUn: product.bonusUn,
                  }).catch(() => {});
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
    const sdkName = '@apps-in-toss/' + 'web-framework';
    const { IAP } = await import(/* @vite-ignore */ sdkName);
    const result = await IAP.getPendingOrders();
    if (!result || result.orders.length === 0) return;

    for (const order of result.orders) {
      const product = Object.values(IAP_PRODUCT_MAP).find(p => p.sku === order.sku);
      if (!product) continue;

      try {
        addPaidBalance(product.paidUn, product.bonusUn);

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
