import type { Timestamp } from 'firebase/firestore';

export type PaymentType = 'charge' | 'spend' | 'refund' | 'bonus';
export type PaymentStatus = 'completed' | 'refunded' | 'failed';
export type PgProvider = 'toss' | 'iap' | 'portone'; // 'toss' = 2026-10 이전 웹 토스페이먼츠 기록 (경로는 제거)

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
  /** 표시되는 총 운 (= paidUn + bonusUn). 마케팅 헤드라인 ("15운"). */
  un: number;
  /** 결제로 충전된 본 운 (환불 가능, server PACKAGE_MAP.paidUn 과 일치) — 2026-04-27 4 패키지 정정 */
  paidUn: number;
  /** 보너스 운 (환불 제외) */
  bonusUn: number;
  price: number;
  pricePerUn: number;
  discount: number;
  guide?: string;   // 유도 문구 (카드 하단 표시용) — #55
  label?: string;   // 배지 라벨 ("가장 인기", "최대 혜택") — #55
}
