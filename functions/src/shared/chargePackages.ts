/**
 * 충전 묶음 표 (서버 기준) — 금액 → 결제 운 + 보너스 운.
 *   결제 확인(포트원), 환불 회수(포트원, 토스 앱 결제)가 이 표 하나를 쓴다. 클라이언트 표는 src/constants/pricing.ts CHARGE_PACKAGES.
 *   환불 때 거둘 운은 결제 기록의 값(클라이언트가 보낸 값일 수 있음)이 아니라 이 표로 정한다.
 */
export const PACKAGE_MAP: Record<number, { name: string; paidUn: number; bonusUn: number }> = {
  500: { name: '한 번만', paidUn: 1, bonusUn: 0 },
  1500: { name: '좀 더 보자', paidUn: 3, bonusUn: 1 },
  2500: { name: '제대로 보자', paidUn: 5, bonusUn: 2 },
  5000: { name: '올해 다 보자', paidUn: 10, bonusUn: 5 },
};

export interface IapSkuPackage { paidUn: number; bonusUn: number; amount: number }
/**
 * 토스 앱 결제 상품 번호(sku) → 지급 운 (2026-10-26 recoverIapOrders 의 표를 여기로 옮겨 grantPurchase 도 같이 쓴다).
 *   클라이언트 src/services/payment/iapService.ts IAP_PRODUCT_MAP 과 같아야 한다. 토스 콘솔 묶음 네 개.
 */
export const IAP_SKU_MAP: Record<string, IapSkuPackage> = {
  'ait.0000025955.8f74931d.d3f5a2a979.5185316383': { paidUn: 1, bonusUn: 0, amount: 500 },
  'ait.0000025955.5d5bec27.6ee0778e2a.5185547787': { paidUn: 3, bonusUn: 1, amount: 1500 },
  'ait.0000025955.79d2ae48.26de419a84.5185590911': { paidUn: 5, bonusUn: 2, amount: 2500 },
  'ait.0000025955.304b4aa7.cabbd01e5e.5185730660': { paidUn: 10, bonusUn: 5, amount: 5000 },
};
