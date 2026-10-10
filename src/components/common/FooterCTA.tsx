/**
 * FooterCTA — 결과 페이지 하단 3-part CTA 공통 컴포넌트
 *
 * 근거:
 *   - PC_인수인계_2026_04_21 §4 / 홈v5_Path분기_레이아웃diff v3 §6
 *
 * 3-part 패턴:
 *   [1] page_emblem    : 페이지 고유 한자 (命/桃/財/官/壽/印/運/月/合/歲)
 *   [2] 전체로 보기    : 부모 카테고리/홈으로 회귀
 *   [3] 10운으로 시작  : 프리미엄 업셀 (CTA는 항상 우측, 금색 강조)
 *
 * 사용:
 *   <FooterCTA pageKey="report" />
 *   <FooterCTA pageKey="topic:love" backTo="/storage" />
 */

import { useNavigate } from 'react-router-dom';
import { getPremiumPrice } from '@/constants/pricing'; // 종합사주 가격 SSOT (세일 자동 반영)

// SSOT v1 정렬 (2026-04-22): 'topic:move' / 'topic:exam' 추가. 한자도 SSOT v1 (緣/復/婚/進/學) 기준으로 정렬.
// 'topic:moving' 은 legacy alias 로 유지 (이미 배포된 캐시 대응).
export type FooterCTAPageKey =
  | 'report'
  | 'topic:love'
  | 'topic:wealth'
  | 'topic:career'
  | 'topic:health'
  | 'topic:study'
  | 'topic:exam'      // SSOT v1 신규 · 합격·이직운 進
  | 'topic:marriage'
  | 'topic:business'
  | 'topic:reunion'
  | 'topic:social'
  | 'topic:move'      // SSOT v1 canonical · 이사·이동운 移
  | 'topic:moving'    // legacy alias
  | 'daeun'
  | 'monthly'
  | 'weekly'
  | 'compat'
  | 'tojung';

interface FooterCTAConfig {
  emblem: string;
  emblemColor: string;
  overviewLabel: string;
  overviewTo: string;
}

/** 페이지별 emblem + 회귀 경로 SSOT (diff v3 §6 + 주제별SSOT_v1 정렬 2026-04-22) */
const CONFIG: Record<FooterCTAPageKey, FooterCTAConfig> = {
  report:           { emblem: '命', emblemColor: '#B8965A', overviewLabel: '사주 전체로',     overviewTo: '/storage' },
  'topic:love':     { emblem: '桃', emblemColor: '#8C6D3D', overviewLabel: '연애 전체로',     overviewTo: '/' }, // 2026-04-26: 緣 → 桃 (mockup 진본, 도화살 직접 한자)
  'topic:wealth':   { emblem: '財', emblemColor: '#B8965A', overviewLabel: '재물 전체로',     overviewTo: '/' },
  'topic:career':   { emblem: '官', emblemColor: '#8C6D3D', overviewLabel: '직업 전체로',     overviewTo: '/' },
  'topic:health':   { emblem: '壽', emblemColor: '#8C6D3D', overviewLabel: '건강 전체로',     overviewTo: '/' },
  'topic:study':    { emblem: '學', emblemColor: '#8C6D3D', overviewLabel: '학업 전체로',     overviewTo: '/' }, // SSOT v1 (구 印)
  'topic:exam':     { emblem: '進', emblemColor: '#8C6D3D', overviewLabel: '합격·이직 전체로', overviewTo: '/' }, // SSOT v1 신규
  'topic:marriage': { emblem: '婚', emblemColor: '#8C6D3D', overviewLabel: '결혼 전체로',     overviewTo: '/' }, // SSOT v1 (구 盟)
  'topic:business': { emblem: '業', emblemColor: '#A37A2E', overviewLabel: '사업 전체로',     overviewTo: '/' },
  'topic:reunion':  { emblem: '復', emblemColor: '#8C6D3D', overviewLabel: '재회 전체로',     overviewTo: '/' }, // SSOT v1 (구 緣)
  'topic:social':   { emblem: '人', emblemColor: '#8C6D3D', overviewLabel: '대인관계 전체로', overviewTo: '/' },
  'topic:move':     { emblem: '移', emblemColor: '#8C6D3D', overviewLabel: '이동 전체로',     overviewTo: '/' }, // SSOT v1 canonical
  'topic:moving':   { emblem: '移', emblemColor: '#8C6D3D', overviewLabel: '이동 전체로',     overviewTo: '/' }, // legacy alias
  // 2026-05-07: 출시 후 공개 — emblem 정의 보존, 라우트만 홈으로 임시 변경
  daeun:            { emblem: '運', emblemColor: '#3B7A4B', overviewLabel: '대운 흐름 전체로', overviewTo: '/' },
  monthly:          { emblem: '月', emblemColor: '#A23A2A', overviewLabel: '월운 전체로',     overviewTo: '/' },
  weekly:           { emblem: '週', emblemColor: '#8C6D3D', overviewLabel: '주간 전체로',     overviewTo: '/' }, // 2026-06-29 NEW
  compat:           { emblem: '合', emblemColor: '#8C6D3D', overviewLabel: '궁합 전체로',     overviewTo: '/' },
  tojung:           { emblem: '歲', emblemColor: '#1A1612', overviewLabel: '신년운세 전체로', overviewTo: '/' },
};

interface FooterCTAProps {
  /** 페이지 키 (emblem + 기본 회귀 경로 결정) */
  pageKey: FooterCTAPageKey;
  /** 기본 회귀 경로 override (선택) */
  backTo?: string;
  /** 프리미엄 CTA 클릭 시 경로 (기본: /premium — 종합사주 시작 진입점). 2026-06-02 fix: 라벨="종합사주 시작"과 일치하도록 /storage→/premium. */
  primaryTo?: string;
  /** 하단 여백 (기본 32px) */
  marginTop?: number;
}

export function FooterCTA({ pageKey, backTo, primaryTo = '/premium', marginTop = 32 }: FooterCTAProps) {
  const navigate = useNavigate();
  const cfg = CONFIG[pageKey];
  const onOverview = () => navigate(backTo ?? cfg.overviewTo);
  const onPrimary = () => navigate(primaryTo);
  // 2026-06-02 — "10운" 하드코딩 → SSOT 가격(세일 시 5운). 스테일 표기 방지.
  const premiumPrice = getPremiumPrice();
  const primaryLabel = `종합사주 ${premiumPrice.actualPrice}운으로 보기`;

  return (
    <div
      className="mx-auto flex items-center gap-3 px-4"
      style={{ marginTop, maxWidth: 520 }}
      data-footer-cta={pageKey}
    >
      {/* [1] emblem */}
      <span
        className="flex items-center justify-center flex-shrink-0 text-[22px] font-black leading-none rounded-full"
        style={{
          width: 44,
          height: 44,
          color: cfg.emblemColor,
          background: 'rgba(184,150,90,0.08)',
          border: `1px solid ${cfg.emblemColor}33`,
          fontFamily: "'Noto Serif KR', serif",
        }}
        aria-hidden="true"
      >
        {cfg.emblem}
      </span>

      {/* [2] 전체로 보기 */}
      <button
        type="button"
        onClick={onOverview}
        className="flex-1 h-[44px] rounded-full text-[13px] font-semibold"
        style={{
          color: '#3D3D3D',
          background: '#FFFFFF',
          border: '1px solid #E5DFD0',
        }}
      >
        {cfg.overviewLabel} →
      </button>

      {/* [3] 10운으로 시작 (프리미엄 업셀) */}
      <button
        type="button"
        onClick={onPrimary}
        className="flex-shrink-0 h-[44px] px-4 rounded-full text-[13px] font-extrabold"
        style={{
          color: '#1A1A1A',
          background: 'linear-gradient(135deg, #E8D9B8, #B8965A)',
          border: '1px solid #B8965A',
        }}
        aria-label={`${primaryLabel} — 프리미엄 10섹션 종합 리포트`}
      >
        {primaryLabel} →
      </button>
    </div>
  );
}

export default FooterCTA;
