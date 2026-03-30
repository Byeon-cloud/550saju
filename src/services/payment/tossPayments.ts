/**
 * 토스페이먼츠 웹 SDK 연동
 * Phase 1-B에서 구현
 */

export interface TossPaymentRequest {
  amount: number;
  orderId: string;
  orderName: string;
}

// TODO: 토스페이먼츠 SDK 로드 및 결제 호출
export async function requestTossPayment(_params: TossPaymentRequest): Promise<void> {
  throw new Error('토스페이먼츠 연동은 Phase 1-B에서 구현합니다.');
}
