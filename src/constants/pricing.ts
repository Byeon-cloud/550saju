import type { ChargePackage } from '@/types/payment';

/** 충전 패키지 */
export const CHARGE_PACKAGES: ChargePackage[] = [
  {
    id: 'once',
    name: '한 번만',
    un: 1,
    bonusUn: 0,
    price: 500,
    pricePerUn: 500,
    discount: 0,
  },
  {
    id: 'more',
    name: '좀 더 보자',
    un: 3,
    bonusUn: 1,
    price: 1500,
    pricePerUn: 375,
    discount: 25,
  },
  {
    id: 'serious',
    name: '제대로 보자',
    un: 5,
    bonusUn: 2,
    price: 2500,
    pricePerUn: 357,
    discount: 29,
  },
  {
    id: 'yearly',
    name: '올해 다 보자',
    un: 10,
    bonusUn: 5,
    price: 5000,
    pricePerUn: 333,
    discount: 33,
  },
];

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
 * 프리미엄 티어 설계 (Phase 2)
 *
 * 10운(5,000원)에 포함되는 항목:
 * 1. 기본 12섹션 심층 분석 (1운 상품의 모든 것)
 * 2. PDF 다운로드 (인쇄 가능한 리포트)
 * 3. 월운 12개월 상세 해설 (기본은 점수만, 프리미엄은 월별 해석)
 * 4. 궁합 1회 무료 포함
 * 5. 대운 10년 상세 해설 포함
 * 6. 사주 상담 10회 포함 (기본 5회의 2배)
 * 7. 전문가 AI 코멘트 (더 상위 모델로 분석)
 *
 * 가격 전략:
 * - 기본 1운(500원): 12섹션 분석 — "맛보기"
 * - 프리미엄 10운(5,000원): 올인원 — "제대로"
 * - 개별 서비스 합산: 사주(1) + 궁합(1) + 대운(1) + 월별(1) + 상담(1) = 5운
 * → 프리미엄은 10운이지만 5운 이상의 가치 (PDF + 확장 상담 + 전문가 코멘트)
 * → "따로 사면 2,500원인데, 5,000원에 2배 이상의 가치"라는 포지셔닝
 */
