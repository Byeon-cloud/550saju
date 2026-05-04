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

/** 상품별 운 비용 */
export const PRODUCT_COST: Record<string, number> = {
  basic: 1,
  compatibility: 1,
  daeun: 1,
  monthly: 1,
  yearly: 1,
  tojung: 1,
  premium: 10,
};

/** 리포트 12섹션 메타 (PRD v2 기준) */
export const REPORT_SECTIONS = [
  { id: 'summary', title: '사주 총평', visual: 'ohengFlow' },
  { id: 'personality', title: '타고난 성격과 기질', visual: 'jijanggan' },
  { id: 'social', title: '대인관계와 소통', visual: 'relationshipMap' },
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
  { id: 'tojung', title: '토정비결', desc: '올해의 운세를 전통 방식으로', price: 1, label: '500원' },
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
