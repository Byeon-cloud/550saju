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
import { useState } from 'react';
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
} as const;

export function LegalFooter() {
  const navigate = useNavigate();
  // 2026-07-02 — 기본 펼침으로 변경. PG 입점심사 반려 요건(포트원 6/22 반려 메일)이
  //   "상호·번호·대표·주소·전화 하단 **고정 노출**" — 접힘 토글은 심사관에게 미노출로 판정될 수 있음.
  //   (전자상거래법 §10도 상시 표시가 원칙. 접기 토글은 유지하되 기본값만 펼침)
  const [bizOpen, setBizOpen] = useState(true);

  // 앱인토스에서는 토스가 판매자 → 비노출 (빌드타임 OR 런타임 — 혼용 금지)
  if (isAppintosBuild || isAppsInToss()) return null;

  const b = BUSINESS_INFO;
  const infoLines: Array<[string, string]> = [
    ['상호', b.companyName],
    ['대표자', b.ceoName],
    ['사업자등록번호', b.businessRegistrationNumber],
    ['통신판매업신고', b.mailOrderSalesNumber],
    ['주소', b.address],
    ['전화', b.phone],
    ['이메일', b.email],
  ];

  return (
    <footer
      className="mt-6"
      style={{
        borderTop: `1px solid ${C.line}`,
        background: C.paper,
        padding: '16px 4px 24px',
      }}
    >
      {/* 링크 행 */}
      <div
        className="flex items-center justify-center flex-wrap gap-x-3 gap-y-2 mb-3"
        style={{ fontSize: 13.5, fontWeight: 700 }}
      >
        <button
          type="button"
          onClick={() => navigate('/terms')}
          style={{ background: 'none', border: 'none', color: C.goldDeep, cursor: 'pointer', padding: 0 }}
        >
          이용약관
        </button>
        <span style={{ color: C.line }}>|</span>
        <button
          type="button"
          onClick={() => navigate('/privacy')}
          style={{ background: 'none', border: 'none', color: C.goldDeep, cursor: 'pointer', padding: 0 }}
        >
          개인정보처리방침
        </button>
        <span style={{ color: C.line }}>|</span>
        <button
          type="button"
          onClick={() => navigate('/business')}
          style={{ background: 'none', border: 'none', color: C.goldDeep, cursor: 'pointer', padding: 0 }}
        >
          사업자정보
        </button>
      </div>

      {/* 사업자 신원정보 — 기본 접힘 (토글로 법적 노출 요건 충족 · 화면 점유 최소화) */}
      <div className="flex flex-col items-center" style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => setBizOpen((v) => !v)}
          aria-expanded={bizOpen}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 8px',
            fontSize: 13, fontWeight: 600, color: C.mute,
          }}
        >
          {b.companyName} 사업자 정보 <span className={`hj-chev${bizOpen ? ' up' : ''}`} style={{ marginLeft: 6 }} aria-hidden="true" />
        </button>
        {bizOpen && (
          <div
            className="flex flex-col items-center gap-1 mt-2"
            style={{ fontSize: 13, lineHeight: 1.6, color: C.mute }}
          >
            {infoLines.map(([label, value]) => (
              <div key={label}>
                <span style={{ fontWeight: 700 }}>{label}</span> {value}
              </div>
            ))}
            <div className="mt-2" style={{ fontSize: 13, color: C.mute }}>
              호스팅 제공: {b.hostingProvider}
            </div>
          </div>
        )}
        <div className="mt-2" style={{ fontSize: 13, color: C.mute }}>
          © {new Date().getFullYear()} 사주500. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default LegalFooter;
