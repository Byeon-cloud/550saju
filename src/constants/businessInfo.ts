/**
 * 사업자 신원정보 SSOT (웹 단독 출시 · 전자상거래법 제10조)
 *
 * 근거: docs/법적요건_웹출시.md §1
 *   - 초기화면(또는 전 페이지 푸터)에 상호·대표·주소·전화·이메일·사업자등록번호·통신판매업신고번호 표시 필수.
 *   - 위반 과태료 최대 500만원.
 *   - 앱인토스는 토스가 판매자 우산 → 불필요. 웹(`!isAppsInToss()`)에서만 노출.
 *
 * 2026-06-22 — 사업자등록 + 통신판매업 신고 완료된 '실제 등록 정보'. 변경 시 신고증과 일치시킬 것.
 */
export interface BusinessInfo {
  /** 상호 */
  companyName: string;
  /** 대표자 성명 */
  ceoName: string;
  /** 사업자등록번호 (XXX-XX-XXXXX) */
  businessRegistrationNumber: string;
  /** 통신판매업 신고번호 (제 XXXX-지역-XXXXX 호) */
  mailOrderSalesNumber: string;
  /** 영업소 소재지 주소 (소비자 불만처리 장소 포함) */
  address: string;
  /** 고객센터 전화번호 */
  phone: string;
  /** 전자우편주소 (기존 운영 메일) */
  email: string;
  /** 호스팅 사업자 (권장 표시 항목) */
  hostingProvider: string;
}

export const BUSINESS_INFO: BusinessInfo = {
  companyName: '주라벨 주식회사',
  ceoName: '변준기',
  businessRegistrationNumber: '228-88-03113',
  // 2026-06-22 통신판매업 신고 완료 — 신고증(부산 사하구) 발급 번호
  mailOrderSalesNumber: '제 2025-부산사하-0235호',
  address: '부산광역시 사하구 하신중앙로 324, 2층 6호실',
  phone: '010-6427-9803',
  // 기존 운영 메일 (MyPage CONTACT_EMAIL 과 동일 SSOT)
  email: 'info@juulabel.com',
  hostingProvider: 'Google Firebase Hosting (Google LLC)',
};
