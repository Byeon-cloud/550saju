/**
 * LegalFooter — 웹 단독 출시 사업자 신원정보 푸터 (전자상거래법 제10조)
 *
 * 근거: docs/법적요건_웹출시.md §1
 *   - 상호·대표·사업자등록번호·통신판매업신고번호·주소·전화 + 약관/방침/사업자정보 링크 표시.
 *   - 앱인토스(토스 판매자 우산)에서는 비노출 → `!isAppsInToss()` 게이팅.
 *
 * 배치: MyPage + 결제/약관/사업자정보 페이지 하단. (전 페이지 푸터는 TabBar 와 충돌하므로
 *       법적 노출 의무가 직결되는 화면에 우선 배치.)
 */
import '@/styles/hanji.css';
import { useNavigate } from 'react-router-dom';
import { isAppsInToss } from '@/services/payment/iapService';
import { isAppintosBuild } from '@/lib/env';
import { BUSINESS_INFO } from '@/constants/businessInfo';

const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  mute: '#6F6557',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  line: '#E5DFD0',
  faint: '#A69C8E', // 2026-10-16 사업자 정보용 옅은 글자
} as const;

export function LegalFooter() {
  const navigate = useNavigate();

  // 앱인토스에서는 토스가 판매자 → 비노출 (빌드타임 OR 런타임 — 혼용 금지)
  if (isAppintosBuild || isAppsInToss()) return null;

  const b = BUSINESS_INFO;
  // 2026-10-16 오너 — 사업자 정보가 너무 눈에 띄었다. 상시 표시(PG 심사 요건, 전자상거래법 제10조)는 지키되
  //   작은 옅은 글자 한 덩어리로. 굵은 라벨, 한 줄에 한 항목, 접기 토글은 뺐다.
  const info = [
    b.companyName,
    `대표 ${b.ceoName}`,
    `사업자등록번호 ${b.businessRegistrationNumber}`,
    `통신판매업 ${b.mailOrderSalesNumber}`,
    b.address,
    b.phone,
    b.email,
    `호스팅 ${b.hostingProvider}`,
  ];
  const linkStyle = { background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: 0, fontSize: 12 } as const;

  return (
    <footer
      className="mt-6"
      style={{ borderTop: `1px solid ${C.line}`, background: C.paper, padding: '14px 8px 22px', textAlign: 'center' }}
    >
      <div className="flex items-center justify-center flex-wrap" style={{ gap: '4px 10px', marginBottom: 8 }}>
        <button type="button" className="tap-pad" onClick={() => navigate('/terms')} style={linkStyle}>이용약관</button>
        <button type="button" className="tap-pad" onClick={() => navigate('/privacy')} style={{ ...linkStyle, fontWeight: 700 }}>개인정보처리방침</button>
        <button type="button" className="tap-pad" onClick={() => navigate('/business')} style={linkStyle}>사업자정보</button>
        <button type="button" className="tap-pad" onClick={() => { void import('@/services/payment/refundRequest').then((m) => m.openRefundRequest()); }} style={linkStyle}>환불 요청</button>
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.7, color: C.faint, margin: 0, wordBreak: 'keep-all' }}>
        {info.join(' | ')}
      </p>
      <p style={{ fontSize: 12, color: C.faint, margin: '4px 0 0' }}>
        © {new Date().getFullYear()} 사주500
      </p>
    </footer>
  );
}
