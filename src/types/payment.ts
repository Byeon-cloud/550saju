import type { Timestamp } from 'firebase/firestore';

export type PaymentType = 'charge' | 'spend' | 'refund' | 'bonus';
export type PaymentStatus = 'completed' | 'refunded' | 'failed';
export type PgProvider = 'toss' | 'iap';

export interface Payment {
  payid: string;
  type: PaymentType;

  // 충전
  amount?: number;
  packageName?: string;

  // 운 변동
  unChange: number;
  balanceAfter: number;

  // 사용 시
  reportId?: string;
  productType?: string;

  // 결제 정보
  pgProvider?: PgProvider;
  pgPaymentKey?: string;

  createdAt: Timestamp;
  status: PaymentStatus;
}

export interface ChargePackage {
  id: string;
  name: string;
  un: number;
  bonusUn: number;
  price: number;
  pricePerUn: number;
  discount: number;
}
