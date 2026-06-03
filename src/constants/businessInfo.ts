/**
 * 사업자 신원정보 SSOT (웹 단독 출시 · 전자상거래법 제10조)
 *
 * 근거: docs/법적요건_웹출시.md §1
 *   - 초기화면(또는 전 페이지 푸터)에 상호·대표·주소·전화·이메일·사업자등록번호·통신판매업신고번호 표시 필수.
 *   - 위반 과태료 최대 500만원.
 *   - 앱인토스는 토스가 판매자 우산 → 불필요. 웹(`!isAppsInToss()`)에서만 노출.
 *
 * ⚠️ 아래 값은 전부 placeholder 입니다.
 *    통신판매업 신고·사업자등록 완료 후 실제 값으로 교체해야 법적 효력 발생.
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
  // TODO(준기): 통신판매업 신고 후 실제 값 입력
  companyName: '(주)○○○',
  // TODO(준기): 통신판매업 신고 후 실제 값 입력
  ceoName: '○○○',
  // TODO(준기): 통신판매업 신고 후 실제 값 입력
  businessRegistrationNumber: '000-00-00000',
  // TODO(준기): 통신판매업 신고 후 실제 값 입력
  mailOrderSalesNumber: '제0000-지역-00000호',
  // TODO(준기): 통신판매업 신고 후 실제 값 입력
  address: '○○도 ○○시 ○○로 000, 0층',
  // TODO(준기): 통신판매업 신고 후 실제 값 입력
  phone: '000-0000-0000',
  // 기존 운영 메일 (MyPage CONTACT_EMAIL 과 동일 SSOT)
  email: 'info@juulabel.com',
  // TODO(준기): 통신판매업 신고 후 실제 값 입력 (예: Google Firebase Hosting)
  hostingProvider: 'Google Firebase Hosting (Google LLC)',
};
