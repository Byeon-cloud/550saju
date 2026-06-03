/**
 * 앱인토스 빌드 전용 — 토스페이먼츠 PG SDK stub
 *
 * 작성: 2026-05-09 (앱인토스 심사 반려 후 — "외부 PG SDK 번들 포함 금지")
 *
 * 동작: ait 빌드 시 vite.config.ts 의 alias 가 `@/services/payment/tossPayments`
 *       를 본 파일로 대체. 토스페이먼츠 SDK 코드가 번들에 들어가지 않음.
 *
 * 호출 시: 앱인토스 미니앱은 isAppsInToss() === true 라
 *          purchaseViaWeb() 가 절대 호출되지 않음. 만약 호출되면 에러.
 */
import type { ChargePackage } from '@/types/payment';

export async function requestTossPayment(_pkg: ChargePackage): Promise<void> {
  throw new Error('앱인토스 미니앱은 외부 PG 결제를 지원하지 않습니다. 인앱 결제만 사용하세요.');
}

export async function confirmTossPayment(
  _paymentKey: string,
  _orderId: string,
  _amount: number,
): Promise<{ success: boolean; message: string; totalUn?: number; paidUn?: number; bonusUn?: number }> {
  throw new Error('앱인토스 미니앱은 외부 PG 결제 확인을 지원하지 않습니다.');
}
