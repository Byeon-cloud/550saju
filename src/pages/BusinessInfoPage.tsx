/**
 * BusinessInfoPage — 사업자정보 공개페이지 (전자상거래법 제10조)
 *
 * 근거: docs/법적요건_웹출시.md §1
 *   - 전자상거래법상 "사업자정보 공개페이지" 요건 충족용 독립 페이지.
 *   - 웹 단독 출시 전용 — 앱인토스에서는 토스가 판매자라 진입 시 홈으로 redirect.
 */
import { Navigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { LegalFooter } from '@/components/layout/LegalFooter';
import { usePageTitle } from '@/hooks/usePageTitle';
import { isAppsInToss } from '@/services/payment/iapService';
import { isAppintosBuild } from '@/lib/env';
import { BUSINESS_INFO } from '@/constants/businessInfo';

const C = {
  ink: '#1A1A1A',
  mute: '#6F6557',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  line: '#E5DFD0',
} as const;

export function BusinessInfoPage() {
  usePageTitle('사업자정보');

  // 앱인토스는 토스가 판매자 → 공개페이지 불필요. 홈으로. (빌드타임 OR 런타임 — 혼용 금지)
  if (isAppintosBuild || isAppsInToss()) return <Navigate to="/" replace />;

  const b = BUSINESS_INFO;
  const rows: Array<[string, string]> = [
    ['상호', b.companyName],
    ['대표자', b.ceoName],
    ['사업자등록번호', b.businessRegistrationNumber],
    ['통신판매업 신고번호', b.mailOrderSalesNumber],
    ['영업소 소재지', b.address],
    ['고객센터 전화', b.phone],
    ['전자우편', b.email],
    ['호스팅 제공자', b.hostingProvider],
  ];

  return (
    <div className="min-h-screen bg-bg-page">
      <Header title="사업자정보" />
      <div className="px-5 pt-4 pb-20">
        <div className="card">
          <h2 className="text-h2 text-text-primary mb-1">사업자정보</h2>
          <p className="text-body-sm mb-5" style={{ color: C.mute }}>
            전자상거래 등에서의 소비자보호에 관한 법률에 따라 사업자 신원정보를 공개합니다.
          </p>

          <div
            style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}
          >
            {rows.map(([label, value], idx) => (
              <div
                key={label}
                className="flex"
                style={{
                  borderBottom: idx < rows.length - 1 ? `1px solid ${C.line}` : 'none',
                }}
              >
                <div
                  style={{
                    flex: '0 0 116px',
                    padding: '12px 14px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: C.goldDeep,
                    background: 'rgba(184,150,90,0.06)',
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    fontSize: 13,
                    color: C.ink,
                    lineHeight: 1.5,
                    wordBreak: 'keep-all',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <p className="text-caption mt-5" style={{ color: C.mute, lineHeight: 1.6 }}>
            고객 불만 및 소비자 분쟁 처리는 위 고객센터 전화 또는 전자우편으로 접수하실 수 있습니다.
          </p>
        </div>

        <LegalFooter />
      </div>
    </div>
  );
}

export default BusinessInfoPage;
