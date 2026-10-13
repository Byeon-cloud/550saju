// extension/_chrome.tsx — Phase D'-4 Bundle 1 (#54) 확장 4종 mockup 시각 패턴 추출
// 진본:
//   - 확장_대운흐름_v1 (287L)  → DaeunPage  (2운, 大運, #3B7A4B)
//   - 확장_월운_v1 (285L)      → MonthlyPage (1운, 月運, #A23A2A)
//   - 확장_궁합_v1 (289L)      → CompatibilityPage (3운, 合, #8C6D3D)
//   - 확장_토정비결_v1 (272L)  → TojungPage (2운, 歲, #2F4B7C)
//
// 핵심 패턴:
//   공통(4):   ExtensionHero / ExtensionSection / ExtensionUpsellCard / ExtensionLockVeil
//   Daeun(3):  DaeunBars (8칸 막대 + NOW/PEAK) / DaeunHeatGrid (5십성×10년) / DaeunAccordion (dw-head + body + tags)
//   Monthly(3): MonthHero (월 큰숫자 + pillar) / FourCard (일·사람·돈·몸 ring) / CalGrid (일별 강도)
//   Compat(2): CompatPair (좌·우 pcard + 중앙 合) / CompatTimeline (관계 타임라인)
//   Tojung(3): TojungHexagramCard (本卦 + glyph + pull) / TojungFourBox (4 fc) / TojungMonthGrid (12절)
//
// 원칙:
//   - mockup 진본 디자인 그대로 (badge·tier·sub·meta·seal·sec-num·han·pullq·src 등)
//   - SSOT 토큰만 (banned 회피)
//   - 4 페이지 색 SSOT v1 (#3B7A4B / #A23A2A / #8C6D3D / #2F4B7C)
//   - D∞ 단일 CTA (작업 0)
//   - mount는 Bundle 2

import type { ReactNode } from 'react';
import { INK_HERO_BG, Pansim, SERIF } from '@/components/hanji/Hanji';
// 2026-05-29 H1 fix — 업셀 "10운" 하드코딩 → SSOT 세일가.
import { getPremiumPrice } from '@/constants/pricing';

/* ══════════════════════════════════════════════════════════════════
 * 공용 토큰
 * ═════════════════════════════════════════════════════════════════ */
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  goldLine: 'rgba(184,150,90,0.40)',
  line: '#E5DFD0',
  surface: '#FFFFFF',
} as const;

/* ══════════════════════════════════════════════════════════════════
 * 4 페이지 디자인 매핑
 * ═════════════════════════════════════════════════════════════════ */
export type ExtensionPageKey = 'daeun' | 'monthly' | 'weekly' | 'compat' | 'tojung';

export interface ExtensionTheme {
  heroGrad: string;
  hanja: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
  hint: string;
  label: string;
  /** Hero h1 메인 카피 (mockup 진본) */
  heroH1: { line1: string; line2: string };
  /** 운 비용 (페이지별) */
  cost: '1운' | '2운' | '3운' | '5운' | '7운';
}

// 2026-10-10 v9 — 콘텐츠별 강조색(대운 초록·월간 주홍·궁합 보라·신년 남청) 폐기 → 금(라벨·칩) + 먹(제목) 하나로.
//   heroGrad 는 더 안 씀 (ExtensionHero = INK_HERO_BG). 값은 하위호환으로만 남김.
export const EXTENSION_THEME: Record<ExtensionPageKey, ExtensionTheme> = {
  daeun: {
    heroGrad: 'linear-gradient(135deg,#8C6D3D 0%,#1A1612 60%,#1A1612 100%)',
    hanja: '大運',
    accent: '#8C6D3D',
    accentDark: '#1A1612',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#4B4238',
    label: '대운 흐름',
    heroH1: { line1: '인생을 흐르는', line2: '10년 단위의 기운' },
    // 2026-07-01 가격 fix — 대운 실제 차감 1운 (DaeunPage spendBalance(1)). 기존 '2운' stale.
    cost: '1운',
  },
  monthly: {
    heroGrad: 'linear-gradient(135deg,#8C6D3D 0%,#A23A2A 60%,#6E2A20 100%)',
    hanja: '月運',
    accent: '#8C6D3D',
    accentDark: '#1A1612',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#4B4238',
    label: '이번 달 월운',
    heroH1: { line1: '이번 달의 결과', line2: '시기를 살핍니다' },
    // 2026-07-01 가격 fix — 월운 정가 7운 (getMonthlyPrice SSOT). 세일가는 호출부 costLabel 로.
    cost: '7운',
  },
  weekly: {
    // 2026-06-29 NEW — 주간운세 (이번 주 7일) · SSOT 색 #8C6D3D
    heroGrad: 'linear-gradient(135deg,#B8965A 0%,#8C6D3D 60%,#7A5C2E 100%)',
    hanja: '週',
    accent: '#8C6D3D',
    accentDark: '#1A1612',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#4B4238',
    label: '이번 주 운세',
    heroH1: { line1: '이번 주 7일의', line2: '흐름을 짚어 드립니다' },
    cost: '5운' as ExtensionTheme['cost'],
  },
  compat: {
    heroGrad: 'linear-gradient(135deg,#8C6D3D 0%,#1A1612 60%,#1A1612 100%)',
    hanja: '合',
    accent: '#8C6D3D',
    accentDark: '#1A1612',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#4B4238',
    label: '궁합',
    heroH1: { line1: '두 사주의 기운을 겹쳐', line2: '읽어 드립니다' },
    // 2026-07-01 가격 fix — 궁합 실제 차감 1운 (CompatibilityPage spendBalance(1)). 기존 '3운' stale.
    cost: '1운',
  },
  tojung: {
    heroGrad: 'linear-gradient(135deg,#8C6D3D 0%,#1A1612 60%,#1A1612 100%)',
    hanja: '歲',
    accent: '#8C6D3D',
    accentDark: '#1A1612',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#4B4238',
    // 2026-10-08 — 신년운세 7운 프리미엄 (TojungPage NEWYEAR_PRICE=7 · 서버 generateTojung 7운)
    label: '신년운세',
    heroH1: { line1: '다가올 한 해를', line2: '날짜까지 미리 봅니다' },
    cost: '7운',
  },
};

/* ══════════════════════════════════════════════════════════════════
 * 1. ExtensionHero — 공통 헤더 (gradient + badge·tier·sub·meta·seal·한자 워터마크)
 * ═════════════════════════════════════════════════════════════════ */
export interface ExtensionHeroProps {
  theme: ExtensionTheme;
  /** crumb — 예: "사주500 · 더 알아볼 주제 · 궁합" (compat/tojung 만 사용) */
  crumb?: string;
  /** sub — 일간/생년/대운 정보 또는 자유 문구 */
  sub?: string;
  /** meta chips — 예: ["3운 · 약 3,800자", "2026·04·21 ·기준", "전문가 감수"] */
  meta?: string[];
  /** seal — 우상단 한자 인장 (예: "合" / "歲") — compat/tojung */
  seal?: string;
  /** 우측 작은 한자 라벨 (daeun/monthly용 — 예: "大運 · 10년 단위 큰 흐름") */
  rightLabel?: string;
  /**
   * cost 칩 라벨 오버라이드 — 세일가 표기용 (예: "7운 → 5운").
   * ExtensionUpsellCard 의 getPremiumPrice 세일표기 패턴과 동일하게,
   * 호출부가 getMonthlyPrice()·getWeeklyPrice() 등으로 세일가를 만들어 넘긴다.
   * 미지정 시 theme.cost (정가) 폴백.
   */
  costLabel?: string;
  /** 이벤트 배지 — 세일 중 "하반기 이벤트 · ~7/15" 표기 (cost 칩 옆). 미지정 시 미노출. */
  eventLabel?: string;
}

export function ExtensionHero({
  theme,
  crumb,
  sub,
  meta,
  seal,
  rightLabel,
  costLabel,
  eventLabel,
}: ExtensionHeroProps) {
  return (
    <header
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '18px 20px 28px',
        color: '#FFFFFF',
        // 2026-10-10 v9 — 콘텐츠별 색 그라데이션 → 먹 + 그림 (전 콘텐츠 같은 머리)
        background: INK_HERO_BG,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'none', // 2026-10-10 v9 — 큰 한자 워터마크 제거
          position: 'absolute',
          right: -18,
          bottom: -40,
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 220,
          fontWeight: 900,
          color: 'rgba(255,255,255,0.07)',
          lineHeight: 1,
          pointerEvents: 'none',
          letterSpacing: '-0.05em',
        }}
      >
        {theme.hanja}
      </span>
      {seal && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: 18,
            top: 18,
            width: 44,
            height: 44,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.30)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 22,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: 0,
          }}
        >
          {seal}
        </div>
      )}
      {crumb && (
        <div
          style={{
            fontSize: 13,
            opacity: 0.75,
            marginBottom: 8,
            position: 'relative',
            letterSpacing: '0.02em',
          }}
        >
          {crumb}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          gap: 10,
          fontSize: 13.5,
          opacity: 0.92,
          flexWrap: 'wrap',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <span
          style={{
            background: 'rgba(255,255,255,0.22)',
            padding: '3px 10px',
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {theme.label}
        </span>
        <span
          style={{
            background: 'rgba(255,255,255,0.14)',
            padding: '3px 10px',
            borderRadius: 2,
            fontSize: 13,
          }}
        >
          {costLabel ?? theme.cost}
        </span>
        {eventLabel && (
          <span
            style={{
              background: 'rgba(255,255,255,0.28)',
              padding: '3px 9px',
              borderRadius: 2,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {eventLabel}
          </span>
        )}
        {rightLabel && (
          <span style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.8 }}>
            {rightLabel}
          </span>
        )}
      </div>
      <h1
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 24,
          fontWeight: 700,
          marginTop: 14,
          letterSpacing: '-0.02em',
          lineHeight: 1.4,
          position: 'relative',
        }}
      >
        {theme.heroH1.line1}
        <br />
        {theme.heroH1.line2}
      </h1>
      {sub && (
        <div
          style={{
            fontSize: 13.5,
            opacity: 0.85,
            marginTop: 4,
            position: 'relative',
          }}
        >
          {sub}
        </div>
      )}
      {meta && meta.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 10,
            fontSize: 13,
            opacity: 0.8,
            flexWrap: 'wrap',
            position: 'relative',
          }}
        >
          {meta.map((m, i) => (
            <span key={i}>{i > 0 ? ', ' : ''}{m}</span>
          ))}
        </div>
      )}
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 2. ExtensionSection — sec-num + sec-title + han + sec-sub
 * ═════════════════════════════════════════════════════════════════ */
export function ExtensionSection({
  theme,
  num,
  title,
  hanjaSuffix,
  sub,
  children,
}: {
  theme: ExtensionTheme;
  num: string;
  title: string;
  hanjaSuffix?: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: 28 }}>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 13,
          fontWeight: 600,
          color: theme.accentDark,
          letterSpacing: '0.2em',
          marginBottom: 6,
        }}
      >
        {num}
      </div>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 19,
          fontWeight: 700,
          color: C.ink,
        }}
      >
        {title}
        {hanjaSuffix && (
          <span
            style={{
              color: theme.accentDark,
              fontWeight: 500,
              marginLeft: 6,
              fontSize: 14,
            }}
          >
            {hanjaSuffix}
          </span>
        )}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 13.5,
            color: theme.hint,
            marginTop: 4,
            lineHeight: 1.55,
          }}
        >
          {sub}
        </div>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 3. ExtensionUpsellCard — 다크 박스 + 命 워터마크 + 단일 CTA
 *  Phase D' 작업 0: 단일 Primary 만 (1운 추가 결제 옵션 0)
 * ═════════════════════════════════════════════════════════════════ */
export function ExtensionUpsellCard({
  title,
  desc,
  ctaLabel = '종합사주 보기', // 2026-10-13 — '사주 전체로'는 뜻이 불명확(05-21 오너), 화살표 기호 제거
  costLabel,
  onTap,
}: {
  title: string;
  desc: string;
  ctaLabel?: string;
  costLabel?: string;
  onTap?: () => void;
}) {
  // 2026-05-29 H1 — costLabel 미지정 시 SSOT 종합사주 세일가 ("10운 → 5운").
  if (!costLabel) {
    const pp = getPremiumPrice();
    costLabel = pp.isOnSale && pp.salePrice != null
      ? `${pp.regularPrice}운 → ${pp.salePrice}운`
      : `${pp.regularPrice}운`;
  }
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        margin: '28px 0 0',
        background: '#1A1612', // 2026-10-13 v9 — 먹 단색, 종이 한 장 모서리
        color: '#FFFFFF',
        borderRadius: 6,
        padding: '22px 20px',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'left',
        border: 'none',
        cursor: onTap ? 'pointer' : 'default',
        width: '100%',
      }}
      aria-label={`${title} (${costLabel})`}
    >
      <span
        aria-hidden
        style={{
          display: 'none', // 2026-10-10 v9 — 큰 한자 워터마크 제거
          position: 'absolute',
          right: -8,
          bottom: -28,
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 130,
          fontWeight: 900,
          color: 'rgba(232,217,184,0.08)',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        命
      </span>
      <div
        style={{
          fontSize: 13,
          color: '#E8D9B8',
          letterSpacing: 0,
          fontWeight: 600,
          marginBottom: 8,
          position: 'relative',
        }}
      >
        종합사주, 열 장
      </div>
      <h3
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 17,
          fontWeight: 700,
          marginBottom: 6,
          position: 'relative',
          lineHeight: 1.45,
          color: '#FFFFFF',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13.5,
          color: '#C4B69A',
          marginBottom: 14,
          lineHeight: 1.6,
          position: 'relative',
          wordBreak: 'keep-all',
        }}
      >
        {desc}
      </p>
      <span
        style={{
          display: 'inline-flex',
          gap: 6,
          background: 'linear-gradient(180deg, var(--hj-gold-hi, #D2B477) 0%, var(--hj-gold, #B8965A) 100%)', // 승인된 금 버튼 양식(.hj-cta)
          color: '#17110A',
          padding: '11px 18px',
          borderRadius: 10,
          fontSize: 15,
          fontWeight: 800,
          position: 'relative',
          alignItems: 'center',
        }}
      >
        {ctaLabel}
        <span
          style={{
            paddingLeft: 10,
            borderLeft: '1px solid rgba(23,17,10,0.3)',
            fontSize: 13.5,
            color: '#3A2C18',
            marginLeft: 4,
            fontWeight: 700,
          }}
        >
          {costLabel}
        </span>
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 4. ExtensionLockVeil — 잠금 영역 (mockup의 lock-veil)
 * ═════════════════════════════════════════════════════════════════ */
export function ExtensionLockVeil({
  theme,
  hanjaIcon = '命',
  primaryLabel,
  subLabel,
  onUnlock,
  children,
}: {
  theme: ExtensionTheme;
  hanjaIcon?: string;
  primaryLabel: string;
  subLabel?: string;
  onUnlock?: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ position: 'relative', margin: '14px 0 0' }}>
      <div
        style={{
          filter: 'blur(6px)',
          opacity: 0.6,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        aria-hidden
      >
        {children}
      </div>
      <button
        type="button"
        onClick={onUnlock}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(180deg, rgba(248,245,238,0.4) 0%, rgba(248,245,238,0.95) 60%)',
          borderRadius: 12,
          border: 'none',
          cursor: onUnlock ? 'pointer' : 'default',
          padding: 0,
        }}
        aria-label={primaryLabel}
      >
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 32,
            color: theme.accentDark,
            fontWeight: 900,
          }}
        >
          {hanjaIcon}
        </div>
        <div
          style={{
            fontSize: 13,
            color: C.ink,
            fontWeight: 700,
            marginTop: 6,
          }}
        >
          {primaryLabel}
        </div>
        {subLabel && (
          <div
            style={{
              fontSize: 13,
              color: theme.hint,
              marginTop: 4,
              textAlign: 'center',
              lineHeight: 1.5,
              maxWidth: 280,
              padding: '0 16px',
            }}
          >
            {subLabel}
          </div>
        )}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 5. DaeunBars — 8칸 막대 그래프 (NOW + PEAK 강조)
 * ═════════════════════════════════════════════════════════════════ */
export interface DaeunBar {
  age: number; // 시작 나이
  key: string; // 간지 (예: "壬辰")
  /** 0~100 강도 (mockup의 height 비율) */
  strength: number;
  /** 라벨 — 예: 78 */
  value: number;
  variant?: 'normal' | 'now' | 'peak';
}

export function DaeunBars({
  bars,
  hint,
}: {
  bars: DaeunBar[];
  hint?: string;
}) {
  return (
    <div
      style={{
        margin: '12px 20px 0',
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '14px 16px',
        border: `1px solid ${C.line}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: 13,
          color: C.goldDeep,
          letterSpacing: '0.15em',
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        <span>대운 8칸 흐름</span>
        {hint && (
          <span
            style={{
              fontSize: 13,
              color: C.mute,
              fontWeight: 500,
              letterSpacing: 0,
            }}
          >
            {hint}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${bars.length}, 1fr)`,
          gap: 4,
          alignItems: 'flex-end',
          height: 120,
        }}
      >
        {bars.map((b, i) => {
          const isNow = b.variant === 'now';
          const isPeak = b.variant === 'peak';
          const fillBg = isPeak
            ? 'linear-gradient(180deg, #A23A2A, #6E2A20)'
            : isNow
            ? 'linear-gradient(180deg, #1A1612, #1A1612)'
            : 'linear-gradient(180deg, #C9D5BD, #A1B8A6)';
          const numColor = isNow || isPeak ? '#FFFFFF' : '#1A1612';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(20, Math.min(100, b.strength))}%`,
                  background: fillBg,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: 4,
                  position: 'relative',
                  border: isNow
                    ? '2px solid #1A1612'
                    : isPeak
                    ? '2px solid #6E2A20'
                    : 'none',
                  boxShadow: isPeak
                    ? '0 2px 8px rgba(162,58,42,0.30)'
                    : isNow
                    ? '0 2px 8px rgba(140,109,61,0.30)'
                    : 'none',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: numColor,
                  }}
                >
                  {b.value}
                </span>
              </div>
              <span style={{ fontSize: 13, color: C.mute, fontWeight: 600 }}>
                {b.age}
              </span>
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: isNow
                    ? '#1A1612'
                    : isPeak
                    ? '#6E2A20'
                    : C.ink,
                }}
              >
                {b.key}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 6. DaeunHeatGrid — 5십성 × 10년 히트맵 (h1~h5 강도)
 * ═════════════════════════════════════════════════════════════════ */
export interface DaeunHeatRow {
  /** 십성 라벨 — 예: "관성" */
  label: string;
  /** 10년치 강도 (1~5) */
  cells: Array<{ strength: 1 | 2 | 3 | 4 | 5; isNow?: boolean }>;
}

const HEAT_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#E5DFD0',
  2: '#C9D5BD',
  3: '#A1C7AE',
  4: '#5C8A6F',
  5: '#1A1612',
};

export function DaeunHeatGrid({
  rows,
  yearStart,
  title = '대운 × 세운 히트맵',
}: {
  rows: DaeunHeatRow[];
  yearStart: number;
  title?: string;
}) {
  const yearCount = rows[0]?.cells.length ?? 10;
  const years = Array.from({ length: yearCount }, (_, i) => yearStart + i);
  return (
    <div
      style={{
        margin: '12px 20px 0',
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '14px 16px',
        border: `1px solid ${C.line}`,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: C.goldDeep,
          letterSpacing: '0.15em',
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `48px repeat(${yearCount}, 1fr)`,
          gap: 3,
          fontSize: 13,
        }}
      >
        <div></div>
        {years.map((y) => (
          <div
            key={y}
            style={{ textAlign: 'center', color: C.mute, fontWeight: 600 }}
          >
            {String(y).slice(-2)}
          </div>
        ))}
        {rows.map((r, ri) => (
          <>
            <div
              key={`l-${ri}`}
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.ink,
                alignSelf: 'center',
              }}
            >
              {r.label}
            </div>
            {r.cells.map((c, ci) => (
              <div
                key={`${ri}-${ci}`}
                style={{
                  aspectRatio: '1 / 1',
                  background: HEAT_COLORS[c.strength],
                  borderRadius: 4,
                  border: c.isNow
                    ? '2px solid #1A1A1A'
                    : '1px solid transparent',
                }}
              />
            ))}
          </>
        ))}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          color: C.mute,
          display: 'flex',
          gap: 4,
          alignItems: 'center',
        }}
      >
        강도{' '}
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <span
            key={n}
            style={{
              width: 12,
              height: 12,
              background: HEAT_COLORS[n],
              borderRadius: 2,
              display: 'inline-block',
            }}
          />
        ))}{' '}
        약 → 강, ◼ 박스: 올해
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 7. DaeunAccordion — 8개 대운 카드 (dw-head + body + tags)
 * ═════════════════════════════════════════════════════════════════ */
export interface DaeunCard {
  ageRange: string; // 예: "35~44"
  key: string; // 간지 한자
  reading: string; // 한글 읽기 (예: "임진")
  tag?: string; // 우상단 — "현재" / "정점"
  badge?: 'now' | 'peak' | 'warn';
  body: ReactNode;
  tags?: string[]; // dw-tags
}

export function DaeunAccordion({ cards }: { cards: DaeunCard[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {cards.map((c, i) => {
        const accent =
          c.badge === 'now'
            ? '#1A1612'
            : c.badge === 'peak'
            ? '#A23A2A'
            : c.badge === 'warn'
            ? '#8C6D3D'
            : C.line;
        const bg =
          c.badge === 'now'
            ? '#FFFDF8'
            : c.badge === 'peak'
            ? '#FFFDF8'
            : c.badge === 'warn'
            ? '#FFFDF8'
            : '#FFFFFF';
        return (
          <div
            key={i}
            style={{
              background: bg,
              border: `1px solid ${c.badge ? accent : C.line}`,
              boxShadow: c.badge ? `inset 0 0 0 2px ${bg}, inset 0 0 0 3px ${accent}55` : 'none',
              borderRadius: 3,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  background: C.goldSoft,
                  color: C.goldDeep,
                  padding: '2px 8px',
                  borderRadius: 2,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {c.ageRange}
              </span>
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: c.badge ? accent : C.ink,
                }}
              >
                {c.key}
              </span>
              <span style={{ fontSize: 13, color: C.mute }}>
                {c.reading}
                {c.tag ? ` ${c.tag}` : ''}
              </span>
              {c.badge && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    background: accent,
                    padding: '2px 7px',
                    borderRadius: 4,
                    letterSpacing: '0.04em',
                  }}
                >
                  {c.badge === 'now'
                    ? '지금'
                    : c.badge === 'peak'
                    ? '정점'
                    : '注'}
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: C.inkSoft,
                lineHeight: 1.7,
                wordBreak: 'keep-all',
              }}
            >
              {c.body}
            </div>
            {c.tags && c.tags.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginTop: 10,
                  flexWrap: 'wrap',
                }}
              >
                {c.tags.map((t, ti) => (
                  <span
                    key={ti}
                    style={{
                      background: '#F5F0E8',
                      color: C.inkSoft,
                      padding: '2px 8px',
                      borderRadius: 2,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 8. MonthHero — 월 큰숫자 + pillar + 한 줄 결 + desc
 * ═════════════════════════════════════════════════════════════════ */
export function MonthHero({
  yearLabel,
  month,
  pillar,
  title,
  desc,
}: {
  yearLabel: string; // 예: "2026 APRIL"
  month: number;
  pillar: string; // 예: "壬辰 月柱"
  title: string;
  desc: ReactNode;
}) {
  return (
    <div
      style={{
        margin: '12px 20px 0',
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '18px 20px',
        border: `1px solid ${C.line}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: '#A23A2A',
              letterSpacing: '0.2em',
              fontWeight: 700,
            }}
          >
            {yearLabel}
          </div>
          <div
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 56,
              fontWeight: 800,
              color: '#A23A2A',
              lineHeight: 1,
              marginTop: 4,
            }}
          >
            {month}
            <small
              style={{
                fontSize: 18,
                color: '#6E2A20',
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              월
            </small>
          </div>
        </div>
        <div
          style={{
            background: 'rgba(162,58,42,0.10)',
            color: '#6E2A20',
            padding: '4px 10px',
            borderRadius: 2,
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {pillar}
        </div>
      </div>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 17,
          fontWeight: 700,
          color: C.ink,
          marginBottom: 6,
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: C.inkSoft,
          lineHeight: 1.7,
          wordBreak: 'keep-all',
        }}
      >
        {desc}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 9. FourCard — 4면 강도 (일·사람·돈·몸 ring)
 * ═════════════════════════════════════════════════════════════════ */
export interface FourCardItem {
  label: string;
  score: number; // 0~100
  /** rank 1~4 — 색 분기 */
  rank?: 1 | 2 | 3 | 4;
}

const FOURCARD_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: '#1A1612', // 가장 강
  2: '#8C6D3D',
  3: '#A23A2A', // 약함 (주의)
  4: '#1A1612',
};

export function FourCard({ items, title }: { items: FourCardItem[]; title?: string }) {
  return (
    <div
      style={{
        margin: '12px 20px 0',
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '14px 16px',
        border: `1px solid ${C.line}`,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 13,
            color: C.goldDeep,
            letterSpacing: '0.15em',
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}
      >
        {items.map((it, i) => {
          const color = FOURCARD_COLORS[it.rank ?? 2];
          return (
            <div
              key={i}
              style={{
                textAlign: 'center',
                padding: '10px 4px',
                background: `${color}10`,
                border: `1px solid ${color}26`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {it.label}
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  margin: '0 auto',
                  borderRadius: '50%',
                  background: `conic-gradient(${color} 0 ${it.score}%, ${color}1A ${it.score}% 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 4,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color,
                  }}
                >
                  {it.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 10. CalGrid — 월간 캘린더 일별 강도 (0~3 단계)
 * ═════════════════════════════════════════════════════════════════ */
export interface CalDay {
  /** 1~31 */
  day: number;
  /** 0=비활성/공백, 1~3 강도 */
  strength: 0 | 1 | 2 | 3;
  /** 오늘 강조 */
  isToday?: boolean;
  /** 일요일·토요일 색 */
  weekday?: 'sun' | 'sat' | null;
}

const CAL_INTENSITY: Record<0 | 1 | 2 | 3, string> = {
  0: 'transparent',
  1: 'rgba(162,58,42,0.10)',
  2: 'rgba(162,58,42,0.30)',
  3: 'rgba(162,58,42,0.55)',
};

export function CalGrid({
  days,
  hint,
  monthLabel,
}: {
  /** 35칸(5주) 또는 42칸(6주) — 빈 칸은 day=0 */
  days: CalDay[];
  hint?: string;
  monthLabel?: string;
}) {
  return (
    <div
      style={{
        margin: '12px 20px 0',
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '14px 16px',
        border: `1px solid ${C.line}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: '#A23A2A',
            letterSpacing: '0.15em',
            fontWeight: 700,
          }}
        >
          {monthLabel ?? '캘린더, 일별 강도'}
        </div>
        {hint && (
          <div style={{ fontSize: 13, color: C.mute }}>{hint}</div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {(['일', '월', '화', '수', '목', '금', '토'] as const).map((d, i) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: i === 0 ? '#A23A2A' : i === 6 ? '#3E5F82' : C.mute,
              fontWeight: 700,
              padding: '4px 0',
            }}
          >
            {d}
          </div>
        ))}
        {days.map((c, i) => (
          <div
            key={i}
            style={{
              aspectRatio: '1 / 1',
              background: c.day === 0 ? 'transparent' : CAL_INTENSITY[c.strength],
              border: c.isToday
                ? '2px solid #1A1A1A'
                : c.day === 0
                ? 'none'
                : `1px solid ${C.line}`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              color:
                c.day === 0
                  ? 'transparent'
                  : c.weekday === 'sun'
                  ? '#A23A2A'
                  : c.weekday === 'sat'
                  ? '#3E5F82'
                  : C.ink,
              fontWeight: c.isToday ? 800 : 500,
            }}
          >
            {c.day || ''}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 11. CompatPair — 좌·우 pcard + 중앙 合 인장
 * ═════════════════════════════════════════════════════════════════ */
export interface CompatPersonCard {
  who: string; // "사용자" / "상대"
  name: string;
  ilgan: string; // "己土"
  desc: string; // "습한 텃밭의 흙"
  pillars: Array<{ label: string; gan: string }>; // 4기둥
}

export function CompatPair({
  left,
  right,
  centerHanja = '合',
}: {
  left: CompatPersonCard;
  right: CompatPersonCard;
  centerHanja?: string;
}) {
  return (
    <section
      style={{
        margin: '12px 20px 0',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: 8,
        alignItems: 'stretch',
      }}
    >
      <CompatPCard card={left} />
      <div
        aria-hidden
        style={{
          alignSelf: 'center',
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 28,
          fontWeight: 800,
          color: '#1A1612',
          background: 'rgba(140,109,61,0.10)',
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(140,109,61,0.30)',
        }}
      >
        {centerHanja}
      </div>
      <CompatPCard card={right} />
    </section>
  );
}

function CompatPCard({ card }: { card: CompatPersonCard }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: '#1A1612',
          letterSpacing: '0.15em',
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {card.who}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: C.ink,
          marginBottom: 6,
        }}
      >
        {card.name}
      </div>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 22,
          fontWeight: 700,
          color: '#1A1612',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {card.ilgan}
      </div>
      <div
        style={{
          fontSize: 13,
          color: C.inkSoft,
          marginBottom: 8,
          lineHeight: 1.5,
        }}
      >
        {card.desc}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          flexWrap: 'wrap',
        }}
      >
        {card.pillars.map((p, i) => (
          <span
            key={i}
            style={{
              background: 'rgba(140,109,61,0.06)',
              border: '1px solid rgba(140,109,61,0.20)',
              padding: '3px 7px',
              borderRadius: 6,
              fontSize: 13,
              color: '#1A1612',
            }}
          >
            <b
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 700,
              }}
            >
              {p.gan}
            </b>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 12. CompatTimeline — 관계 타임라인 (만남 → 결정 → 안정)
 * ═════════════════════════════════════════════════════════════════ */
export interface CompatTimelineStep {
  label: string; // 시기 — 예: "1~3개월"
  title: string;
  desc: ReactNode;
  highlight?: boolean;
}

export function CompatTimeline({ steps }: { steps: CompatTimelineStep[] }) {
  return (
    <div
      style={{
        position: 'relative',
        paddingLeft: 20,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          bottom: 6,
          width: 1.5,
          background: 'rgba(140,109,61,0.30)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: -20,
                top: 4,
                width: 13,
                height: 13,
                borderRadius: '50%',
                background: s.highlight ? '#1A1612' : '#FFFFFF',
                border: '2px solid #1A1612',
              }}
            />
            <div
              style={{
                fontSize: 13,
                color: '#1A1612',
                fontWeight: 700,
                marginBottom: 3,
                letterSpacing: '0.04em',
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 14,
                fontWeight: 700,
                color: C.ink,
                marginBottom: 4,
              }}
            >
              {s.title}
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: C.inkSoft,
                lineHeight: 1.65,
                wordBreak: 'keep-all',
              }}
            >
              {s.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 13. TojungHexagramCard — 本卦 + glyph + name + one + pull
 * ═════════════════════════════════════════════════════════════════ */
export function TojungHexagramCard({
  yearLabel,
  glyph,
  name,
  oneLine,
  pullQuote,
}: {
  yearLabel: string; // "2026 병오년 · 본괘"
  glyph: string; // "水山蹇"
  name: string; // "수산건(水山蹇) · 멈춤 속의 단단함"
  oneLine: string;
  pullQuote?: string;
}) {
  // 2026-10-11 — 옅은 그라데이션 카드 → 감지금니 표지 (먹지 + 사방 금선 두 줄 + 판심 + 금빛 세운 글자)
  return (
    <section className="hj-verdict gold" style={{ margin: '14px 20px 0', textAlign: 'center' }}>
      <Pansim>{yearLabel}</Pansim>
      <div style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 800, color: '#E2C98F', letterSpacing: '0.12em', lineHeight: 1.1, margin: '4px 0 8px' }}>
        {glyph}
      </div>
      <div style={{ fontSize: 14.5, color: '#D8CCB4', fontWeight: 700, marginBottom: 16 }}>{name}</div>
      <p className="vt" style={{ textAlign: 'center' }}>{oneLine}</p>
      {pullQuote && (
        <p className="vref" style={{ textAlign: 'center', fontFamily: SERIF, fontSize: 15, color: '#E2C98F' }}>{pullQuote}</p>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 14. TojungFourBox — 4 fc (상반기/하반기/길월/주의월)
 * ═════════════════════════════════════════════════════════════════ */
export interface TojungFourItem {
  head: string; // "상반기" / "길월"
  value: string; // "수습" / "7·9·11월"
  desc: string; // "정리·복기"
}

export function TojungFourBox({ items }: { items: TojungFourItem[] }) {
  // 2026-10-11 — 둥근 흰 카드 → 금선 두 줄 칸 (프리미엄)
  return (
    <div style={{ margin: '12px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} className="hj-cell gold">
          <span className="k" style={{ fontWeight: 700, color: C.ink }}>{it.head}</span>
          <span className="v big">{it.value}</span>
          <span className="d">{it.desc}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 15. TojungMonthGrid — 12절 grid (1~12월 카드)
 * ═════════════════════════════════════════════════════════════════ */
export interface TojungMonthItem {
  month: number;
  /** 한 줄 풀이 */
  oneLiner: string;
  /** 권장 행동 */
  action?: string;
  /** 강조 — 길월/주의월 */
  variant?: 'good' | 'caution';
}

export function TojungMonthGrid({ months }: { months: TojungMonthItem[] }) {
  return (
    <div
      style={{
        margin: '12px 20px 0',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8,
      }}
    >
      {months.map((m) => {
        const accent =
          m.variant === 'good'
            ? '#1A1612'
            : m.variant === 'caution'
            ? '#A23A2A'
            : '#1A1612';
        const bg =
          m.variant === 'good'
            ? '#FFFDF8'
            : m.variant === 'caution'
            ? '#FFFDF8'
            : '#FFFFFF';
        return (
          <div
            key={m.month}
            style={{
              background: bg,
              border: `1px solid ${m.variant === 'good' || m.variant === 'caution' ? accent : C.line}`,
              boxShadow: m.variant === 'good' || m.variant === 'caution' ? `inset 0 0 0 2px ${bg}, inset 0 0 0 3px ${accent}55` : 'none',
              borderRadius: 3,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 18,
                  fontWeight: 800,
                  color: accent,
                  lineHeight: 1,
                }}
              >
                {m.month}
              </span>
              <span style={{ fontSize: 13, color: C.mute, fontWeight: 600 }}>
                월
              </span>
              {m.variant === 'good' && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    background: '#1A1612',
                    padding: '1px 6px',
                    borderRadius: 2,
                  }}
                >
                  吉
                </span>
              )}
              {m.variant === 'caution' && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    background: '#A23A2A',
                    padding: '1px 6px',
                    borderRadius: 2,
                  }}
                >
                  注
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: C.ink,
                lineHeight: 1.6,
                marginBottom: m.action ? 6 : 0,
                wordBreak: 'keep-all',
                fontWeight: 500,
              }}
            >
              {m.oneLiner}
            </div>
            {m.action && (
              <div
                style={{
                  fontSize: 13,
                  color: accent,
                  fontWeight: 600,
                  paddingTop: 6,
                  borderTop: `1px dashed ${accent}30`,
                }}
              >
                → {m.action}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
