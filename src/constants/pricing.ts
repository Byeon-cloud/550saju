import type { ChargePackage } from '@/types/payment';

/** 충전 패키지 */
export const CHARGE_PACKAGES: ChargePackage[] = [
  {
    id: 'once',
    name: '한 번만',
    un: 1,
    bonusUn: 0,
    price: 550,
    pricePerUn: 550,
    discount: 0,
  },
  {
    id: 'more',
    name: '좀 더 보자',
    un: 3,
    bonusUn: 1,
    price: 1650,
    pricePerUn: 412,
    discount: 25,
  },
  {
    id: 'serious',
    name: '제대로 보자',
    un: 5,
    bonusUn: 2,
    price: 2750,
    pricePerUn: 392,
    discount: 29,
  },
  {
    id: 'yearly',
    name: '올해 다 보자',
    un: 10,
    bonusUn: 4,
    price: 5500,
    pricePerUn: 392,
    discount: 29,
  },
];

/** 상품별 운 비용 */
export const PRODUCT_COST: Record<string, number> = {
  basic: 1,
  compatibility: 1,
  daeun: 1,
  yearly: 1,
  premium: 10,
};

/** 리포트 섹션 메타 */
export const REPORT_SECTIONS = [
  { id: 'summary', icon: '☯', title: '사주 총평' },
  { id: 'personality', icon: '🪞', title: '타고난 성격과 기질' },
  { id: 'relationship', icon: '🤝', title: '대인관계와 소통' },
  { id: 'career', icon: '💼', title: '직업운과 적성' },
  { id: 'wealth', icon: '💰', title: '재물운' },
  { id: 'love', icon: '💕', title: '애정운과 연애 스타일' },
  { id: 'health', icon: '🏥', title: '건강 주의사항' },
  { id: 'thisyear', icon: '📅', title: '올해(2026)의 운세' },
  { id: 'challenge', icon: '🔑', title: '인생의 핵심 과제와 숨겨진 재능' },
  { id: 'luck', icon: '🍀', title: '개운법' },
] as const;
