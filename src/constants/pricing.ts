import type { ChargePackage } from '@/types/payment';

/**
 * 충전 패키지 — #55 정정 (2026-04-27)
 *
 * **2026-04-27 4 패키지 정정** (mockup 드리프트 → 토스 콘솔 진본 정렬):
 * - 토스 콘솔 진본: 1운 / 4운(3+1) / 7운(5+2) / 15운(10+5) — 4종
 * - 5,000원(15운) = 프리미엄 결제 라인 — 10운 본격 풀이 + 5운 보너스 자유 사용
 *   = 5운 패키지보다 압도적 매력으로 LTV 극대화
 * - 토스 공급가 450원/운 (수수료 ~10%, 소비자가 500원/운)
 * - server `functions/src/index.ts` PACKAGE_MAP 과 1:1 정합 (paidUn/bonusUn 분리)
 *
 * **Superseded (2026-04-24 결정 무효)**:
 * - 구 5 패키지 (p1/p5/p10/p30/p50) 결정은 mockup 드리프트로 잘못 들어감 → 본 4 패키지 진본
 * - p5/p10/p30/p50 는 `LEGACY_PACKAGE_ALIASES` 로 신 패키지에 매핑 (호환성)
 *
 * 보너스 정책: paidUn = 결제 충전 (환불 가능) / bonusUn = 보너스 (환불 제외)
 */
export const CHARGE_PACKAGES: ChargePackage[] = [
  {
    id: 'p1',
    name: '1운',
    un: 1,
    paidUn: 1,
    bonusUn: 0,
    price: 500,
    pricePerUn: 500,
    discount: 0,
    guide: '주제 하나 가볍게',
  },
  {
    id: 'p4',
    name: '3운+1운 보너스',
    un: 4,
    paidUn: 3,
    bonusUn: 1,
    price: 1500,
    pricePerUn: 375, // 1500 / 4
    discount: 25,    // 2000 → 1500 (500원 절약 — 1운당 500원 → 375원)
    guide: '주제 3~4개 가볍게',
  },
  {
    id: 'p7',
    name: '5운+2운 보너스',
    un: 7,
    paidUn: 5,
    bonusUn: 2,
    price: 2500,
    pricePerUn: 357, // 2500 / 7
    discount: 28,    // 3500 → 2500 (1000원 절약)
    guide: '주제별 골고루 보기 좋아요',
  },
  {
    id: 'p15',
    name: '10운+5운 보너스',
    un: 15,
    paidUn: 10,
    bonusUn: 5,
    price: 5000,
    pricePerUn: 333, // 5000 / 15
    discount: 33,    // 7500 → 5000 (2500원 절약)
    label: '가장 인기',
    guide: '프리미엄 1번 + 5운 보너스로 자유롭게',
  },
];

/**
 * Legacy 패키지 ID 호환 매핑 — localStorage 캐시 / 외부 링크에서 구 ID 들어올 때 자동 변환.
 * 구 결정 (2026-04-24 5 패키지) → 신 결정 (2026-04-27 4 패키지) 매핑.
 */
export const LEGACY_PACKAGE_ALIASES: Record<string, string> = {
  // 구 5 패키지 → 신 4 패키지 (가장 가까운 가격대로 매핑)
  p5: 'p7',     // 구 p5 (5운/2500원) → 신 p7 (7운/2500원, +2 보너스 추가)
  p10: 'p15',   // 구 p10 (10운/5000원) → 신 p15 (15운/5000원, +5 보너스 추가)
  p30: 'p15',   // 구 p30 (30운/14000원) — 30/50운 패키지는 진본에 없음, p15 로 안내
  p50: 'p15',   // 구 p50 (50운/22000원) — 동일
  // 더 이전 (Sprint 1 이전) 시멘틱 키 호환
  once: 'p1',
  more: 'p4',
  serious: 'p7',
  yearly: 'p15',
};

/** 패키지 lookup — legacy ID 자동 변환 */
export function findPackageById(id: string): ChargePackage | undefined {
  const resolved = LEGACY_PACKAGE_ALIASES[id] ?? id;
  return CHARGE_PACKAGES.find((p) => p.id === resolved);
}

/** 상품별 운 비용 (정가) — 세일 적용된 실제 차감가는 getTopicPrice/getPremiumPrice 사용 */
export const PRODUCT_COST: Record<string, number> = {
  basic: 1,
  compatibility: 1,
  daeun: 1,
  monthly: 7,   // 2026-06-29 NEW 출시 — 월운세 정가 7운 (getMonthlyPrice SSOT)
  weekly: 5,    // 2026-06-29 NEW 출시 — 주간운세 정가 5운 (getWeeklyPrice SSOT)
  yearly: 1,
  tojung: 7, // 2026-10-08 신년운세 7운 프리미엄 (Opus 3그룹) — 클라 TojungPage·서버 generateTojung 과 일치
  premium: 10,
};

/* ──────────────────────────────────────────────────────────────────
 * 2026-05-28 PM — 토픽운·종합사주 세일 SSOT (준기 결정)
 *  · 주제운 정가 1운 · 재회운 정가 3운 (출시 세일 종료 2026-06-27)
 *  · 종합사주 정가 10운 (런칭 세일 5운 종료 2026-06-27 · 준기 결정)
 *  · 세일 재개 시 해당 def 의 isOnSale:true + saleEndDate 갱신만 (UI/차감 전부 SSOT 자동 반영)
 *  · 모든 spendBalance() 호출은 getTopicPrice / getPremiumPrice 의 actualPrice 사용
 * ────────────────────────────────────────────────────────────────── */

export interface PricingInfo {
  /** 정가 (운) */
  regularPrice: number;
  /** 세일가 (운) — isOnSale 일 때만 사용 */
  salePrice?: number;
  /** 현재 세일 중 여부 (saleEndDate 만료 시 자동 false) */
  isOnSale: boolean;
  /** 세일 라벨 (예: "출시 세일", "런칭 세일") */
  saleBadge?: string;
  /** 세일 종료일 (ISO date) */
  saleEndDate?: string;
  /** 실제 차감되는 가격 (자동 계산) */
  actualPrice: number;
}

interface PricingDef {
  regularPrice: number;
  salePrice?: number;
  isOnSale: boolean;
  saleBadge?: string;
  saleEndDate?: string;
}

function isStillOnSale(saleEndDate: string | undefined): boolean {
  if (!saleEndDate) return true;
  try {
    return new Date() <= new Date(saleEndDate + 'T23:59:59');
  } catch {
    return true;
  }
}

function resolvePricing(def: PricingDef): PricingInfo {
  const isOnSaleNow = def.isOnSale && isStillOnSale(def.saleEndDate);
  const actualPrice = isOnSaleNow && def.salePrice != null ? def.salePrice : def.regularPrice;
  return {
    regularPrice: def.regularPrice,
    salePrice: def.salePrice,
    isOnSale: isOnSaleNow,
    saleBadge: def.saleBadge,
    saleEndDate: def.saleEndDate,
    actualPrice,
  };
}

/** 주제운별 가격 raw 정의 (10주제) — 정의 안 된 토픽은 default 1운 */
const TOPIC_PRICING_RAW: Record<string, PricingDef> = {
  // 2026-06-27 준기: 재물·연애·재회운 = 정가 3운 (사용량 최상위 핵심 유료 콘텐츠).
  //   나머지 7주제는 DEFAULT_TOPIC_PRICING 1운. 세일 도입 시 salePrice + isOnSale:true 만 추가.
  love: { regularPrice: 3, isOnSale: false },
  wealth: { regularPrice: 3, isOnSale: false },
  reunion: { regularPrice: 3, isOnSale: false },
};

const DEFAULT_TOPIC_PRICING: PricingDef = { regularPrice: 1, isOnSale: false };

/** 주제운 가격 조회 — 항상 actualPrice 포함된 PricingInfo 반환 */
export function getTopicPrice(topicId: string): PricingInfo {
  return resolvePricing(TOPIC_PRICING_RAW[topicId] || DEFAULT_TOPIC_PRICING);
}

/** 종합사주(프리미엄) raw 정의 — 2026-06-29 하반기 시작 이벤트 재개(준기): 10운 → 5운, ~7/13(2주).
 *  종료일(saleEndDate) 지나면 isStillOnSale 가 자동 false → 정가 10운 복귀(코드 변경 0). */
const PREMIUM_PRICING_RAW: PricingDef = {
  regularPrice: 10,
  salePrice: 5,
  isOnSale: true,
  saleBadge: '하반기 시작 이벤트',
  saleEndDate: '2026-07-15', // 2026-07-01 준기: 15일까지 연장
};

/** 종합사주 가격 조회 */
export function getPremiumPrice(): PricingInfo {
  return resolvePricing(PREMIUM_PRICING_RAW);
}

/** 월운세(2026 12개월) raw 정의 — 2026-06-29 NEW 출시(준기), 정가 7운.
 *  이벤트성 세일 시 salePrice + isOnSale:true + saleEndDate 추가만. */
const MONTHLY_PRICING_RAW: PricingDef = {
  regularPrice: 7,
  salePrice: 5,
  isOnSale: true,
  saleBadge: '하반기 시작 이벤트',
  saleEndDate: '2026-07-15', // 2026-07-01 준기: 월운 7→5운 이벤트 세일
};

/** 월운세 가격 조회 — 항상 actualPrice 포함 */
export function getMonthlyPrice(): PricingInfo {
  return resolvePricing(MONTHLY_PRICING_RAW);
}

/** 주간운세(이번 주 7일) raw 정의 — 2026-06-29 NEW 출시(준기), 정가 5운. */
const WEEKLY_PRICING_RAW: PricingDef = {
  regularPrice: 5,
  salePrice: 3,
  isOnSale: true,
  saleBadge: '하반기 시작 이벤트',
  saleEndDate: '2026-07-15', // 2026-07-01 준기: 주간 5→3운 이벤트 세일
};

/** 주간운세 가격 조회 — 항상 actualPrice 포함 */
export function getWeeklyPrice(): PricingInfo {
  return resolvePricing(WEEKLY_PRICING_RAW);
}

/** "1운" / "3운 → 1운 출시 세일" 형식 — chip pill */
export function formatPriceLabel(p: PricingInfo): string {
  if (p.isOnSale && p.salePrice != null) {
    return `${p.regularPrice}운 → ${p.salePrice}운 ${p.saleBadge || 'SALE'}`;
  }
  return `${p.regularPrice}운`;
}

/** 리포트 11섹션 메타 (PRD v2 기준 · 2026-05-28 social 제거 — SSOT 10주제 정렬) */
export const REPORT_SECTIONS = [
  { id: 'summary', title: '사주 총평', visual: 'ohengFlow' },
  { id: 'personality', title: '타고난 성격과 기질', visual: 'jijanggan' },
  { id: 'career', title: '직업운과 적성', visual: 'careerFit' },
  { id: 'wealth', title: '재물운', visual: 'wealthFlow' },
  { id: 'love', title: '애정운과 연애 스타일', visual: null },
  { id: 'health', title: '건강 주의사항', visual: 'healthVis' },
  { id: 'year2026', title: '2026년 운세', visual: 'monthlyFortune' },
  { id: 'daeun', title: '대운의 흐름', visual: 'daeunTimeline' },
  { id: 'mission', title: '인생의 핵심 과제', visual: null },
  { id: 'luck', title: '개운법', visual: 'gaewoonVis' },
  { id: 'luckyProfile', title: '나만의 럭키 프로필', visual: 'luckyProfile' },
] as const;

/** 전체 서비스 목록 (런칭 버전) */
export const ALL_SERVICES = [
  // 무료
  { id: 'daily', title: '오늘의 운세', desc: '매일 달라지는 나만의 운세', price: 0, label: '무료' },
  { id: 'dream', title: '꿈해몽', desc: '간밤에 꾼 꿈, 무슨 의미일까요', price: 0, label: '무료' },
  // 유료 (1운 = 500원)
  { id: 'saju', title: '내 사주 풀이', desc: '성격, 직업, 연애, 재물, 건강 상세 분석', price: 1, label: '1운' },
  { id: 'chat', title: '사주 상담', desc: '대화로 주고받는 1:1 맞춤 사주 상담', price: 1, label: '1운 = 3회' },
  { id: 'compatibility', title: '궁합 분석', desc: '두 사람의 사주 비교 · 연애/결혼/직장', price: 1, label: '500원' },
  { id: 'daeun', title: '대운 해설', desc: '10년 단위 운의 흐름과 전환점', price: 1, label: '500원' },
  { id: 'monthly', title: '2026 월별 운세', desc: '올해 12개월, 좋은 달과 조심할 달', price: 1, label: '500원' },
  { id: 'tojung', title: '신년운세', desc: '내 사주로 미리 보는 한 해 열두 달 · 좋은 날까지', price: 7, label: '3,500원' },
  // 프리미엄 (10운 = 5,000원) — Phase 2에서 활성화
  // { id: 'premium', title: '프리미엄 심층 분석', desc: '기본 12항목 + PDF + 월운 상세 + 궁합 + 전문가 코멘트', price: 10, label: '5,000원' },
] as const;

/**
 * 프리미엄 티어 설계 — 2026-04-27 정정 (15운 묶음 = 5,000원)
 *
 * **15운 패키지(5,000원)에 실질 포함 가치**:
 *   - 결제 충전: 10운 (paidUn) — 종합 사주 1회 풀이 (10운 차감)
 *   - 보너스: 5운 (bonusUn) — 자유롭게 주제별 5건 추가 또는 사주대화 등
 *
 *   ▶ 프리미엄(10운) 수행 후에도 5운이 남아 즉시 추가 풀이 가능 → LTV 극대화
 *   ▶ 5운 단독(2500원) 패키지보다 "10운 풀이 + 5운 보너스" 가 매력
 *
 * 가격 전략 (1운 = 500원, 토스 공급가 450원):
 *   - p1   1운/500원   — "주제 하나 가볍게" (소비 진입 허들 최소)
 *   - p4   4운/1500원  — "주제 3~4개 가볍게" (1운당 375원, 25% off)
 *   - p7   7운/2500원  — "주제별 골고루" (1운당 357원, 28% off)
 *   - p15 15운/5000원  — "가장 인기 / 프리미엄 라인" (1운당 333원, 33% off)
 *
 * 종합 사주(10운 차감) 흐름:
 *   1. 무료 사주 풀이 → 블러 영역 → "15운으로 해제" CTA
 *   2. /charge?need=15 → p15 자동 선택 → 5,000원 결제
 *   3. 15운 적립(paidUn=10, bonusUn=5) → 종합 사주 1회 (paidUn -10)
 *   4. 잔여 보너스 5운 → 자유 사용 (추가 주제별·사주대화 등)
 */
