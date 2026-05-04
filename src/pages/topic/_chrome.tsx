// topic/_chrome.tsx — Phase D'-2 (#54) 5 mockup 시각 패턴 추출
// 진본: docs/mockups/사주500_UI개편_목업_1운_주제별*.html (5종)
//   - 연애 v1 (桃, 핑크-자주 #C88A95 → #A1606C)
//   - 재물 v2 (財, 골드 #B8965A → #8C6D3D)
//   - 직업 v1 (官, 블루 #5A7CA8 → #3F5A7C)
//   - 건강 v1 (壽, 그린 #6FA08C → #4A8071)
//   - 공부 v1 (學, 보라 #9C5A8A → #7C4570)
//
// 핵심 패턴 (5 mockup 공통):
//   1. TopicHero — gradient 배경 + 한자 워터마크 + badge·tier·일간 정보
//   2. TopicSajuMini — 8글자 4-cell grid + 핵심 신살 dot
//   3. TopicScoreCard — conic-gradient ring + 점수 + 한 줄 결론
//   4. TopicLinkCard — 사주 요소 chain (일간 × 십성 + 신살 → 점수)
//   5. TopicSection — section-num + section-title(한자) + section-sub
//   6. LockVeil — 블러 + 잠금 오버레이 (1운 / 10운 분기)
//   7. PullQuote — gradient bg + left-border 인용
//   8. TopicActionList — 3 numbered 액션 카드
//   9. TopicUpsellCard — 다크 박스 + 命 워터마크 (10운 프리미엄)
//   10. TopicSourceCite — 풀이 근거 (자평진전·적천수 등 원전 출처)
//
// 원칙:
//   - mockup 진본의 디자인 규율 그대로 (색·spacing·radius·shadow·typo)
//   - 내용·기능은 prod TopicConfig + topicPrompts.ts 응답에 의존 (fallback 카피만 mockup 인용)
//   - 디스클레이머 / topic.color 5색 / SSOT v1 한자 5종 모두 보존
//   - SSOT 토큰만 사용 (banned: #A08B6A/#F0E8D9/#7F6B4E/#B8965A/#8C6D3D)

import type { ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════════
 * 5 주제 디자인 매핑 (mockup 진본 색 추출)
 * ═════════════════════════════════════════════════════════════════ */
export type TopicChromeKey = 'love' | 'wealth' | 'career' | 'health' | 'study';

export interface TopicChromeTheme {
  /** Hero gradient — `linear-gradient(135deg, ...)` 진본 */
  heroGrad: string;
  /** 한자 워터마크 (Hero/Upsell 우하단 220px serif) */
  hanja: string;
  /** Primary accent (TopicHero badge·section-num·conic-gradient ring) */
  accent: string;
  /** Accent dark (sec-title.han · score num · pull-quote left border) */
  accentDark: string;
  /** Accent soft (link-card bg · saju-cell ilju bg) */
  accentSoft: string;
  /** Hint color (saju-mini ttl · sec-sub) */
  hint: string;
  /** Badge text on accent (Hero badge background에 올라가는 흰 텍스트) */
  badgeOn: string;
  /** Pull-quote left-border (accent와 동일하지만 명시적 분리) */
  quoteBorder: string;
  /** Mockup 진본 주제 라벨 ("연애운", "재물운" 등) */
  label: string;
  /** Hero 메인 카피 (mockup h1 진본) */
  heroH1: { line1: string; line2: string };
}

export const TOPIC_CHROME: Record<TopicChromeKey, TopicChromeTheme> = {
  love: {
    heroGrad: 'linear-gradient(135deg,#C88A95 0%,#A1606C 60%,#8E4D5B 100%)',
    hanja: '桃',
    accent: '#C88A95',
    accentDark: '#A1606C',
    accentSoft: 'rgba(200,138,149,0.10)',
    hint: '#5C2E36',
    badgeOn: '#FFFFFF',
    quoteBorder: '#A1606C',
    label: '연애운',
    heroH1: { line1: '관계의 흐름과', line2: '인연이 닿는 자리' },
  },
  wealth: {
    heroGrad: 'linear-gradient(135deg,#D4B07F 0%,#B8965A 55%,#8C6D3D 100%)',
    hanja: '財',
    accent: '#B8965A',
    accentDark: '#8C6D3D',
    accentSoft: 'rgba(184,150,90,0.10)',
    hint: '#5C4A2E',
    badgeOn: '#FFFFFF',
    quoteBorder: '#8C6D3D',
    label: '재물운',
    heroH1: { line1: '돈이 들어오고', line2: '머무는 자리' },
  },
  career: {
    heroGrad: 'linear-gradient(135deg,#7B9BC4 0%,#5A7CA8 55%,#3F5A7C 100%)',
    hanja: '官',
    accent: '#5A7CA8',
    accentDark: '#3F5A7C',
    accentSoft: 'rgba(90,124,168,0.10)',
    hint: '#28405C',
    badgeOn: '#FFFFFF',
    quoteBorder: '#3F5A7C',
    label: '직업운',
    heroH1: { line1: '쌓아올리는 자리와', line2: '커리어의 결' },
  },
  health: {
    heroGrad: 'linear-gradient(135deg,#8FB8A8 0%,#6FA08C 55%,#4A8071 100%)',
    hanja: '壽',
    accent: '#6FA08C',
    accentDark: '#4A8071',
    accentSoft: 'rgba(111,160,140,0.10)',
    hint: '#2E5448',
    badgeOn: '#FFFFFF',
    quoteBorder: '#4A8071',
    label: '건강운',
    heroH1: { line1: '몸의 결과', line2: '오래 가는 흐름' },
  },
  study: {
    heroGrad: 'linear-gradient(135deg,#B57FA0 0%,#9C5A8A 55%,#7C4570 100%)',
    hanja: '學',
    accent: '#9C5A8A',
    accentDark: '#7C4570',
    accentSoft: 'rgba(156,90,138,0.10)',
    hint: '#4C2C44',
    badgeOn: '#FFFFFF',
    quoteBorder: '#7C4570',
    label: '학업운',
    heroH1: { line1: '집중이 흐르는', line2: '시간과 자리' },
  },
};

/* ══════════════════════════════════════════════════════════════════
 * 1. TopicHero — gradient 배경 + 한자 워터마크 + badge·tier
 * ═════════════════════════════════════════════════════════════════ */
export function TopicHero({
  theme,
  ilganLabel,
  birthLabel,
  tierLabel = '1운',
  sinsalLabel,
}: {
  theme: TopicChromeTheme;
  /** 예: "기토(己土)" */
  ilganLabel?: string;
  /** 예: "양력 1995년 7월 12일 · 진시" */
  birthLabel?: string;
  tierLabel?: string;
  /** 우상단 신살 표기 (옵션) — 예: "桃花 · 도화" */
  sinsalLabel?: string;
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '18px 20px 28px',
        color: '#FFFFFF',
        background: theme.heroGrad,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: -18,
          bottom: -40,
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 220,
          fontWeight: 900,
          color: 'rgba(255,255,255,0.07)',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        {theme.hanja}
      </span>
      <div
        style={{
          display: 'flex',
          gap: 10,
          fontSize: 12,
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
            borderRadius: 100,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {theme.label}
        </span>
        <span
          style={{
            background: 'rgba(255,255,255,0.14)',
            padding: '3px 10px',
            borderRadius: 100,
            fontSize: 10,
          }}
        >
          {tierLabel}
        </span>
        {sinsalLabel && (
          <span style={{ marginLeft: 'auto', fontSize: 10.5, opacity: 0.8 }}>
            {sinsalLabel}
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
      {(ilganLabel || birthLabel) && (
        <div
          style={{
            fontSize: 12,
            opacity: 0.85,
            marginTop: 4,
            position: 'relative',
            fontFeatureSettings: '"tnum"',
          }}
        >
          {ilganLabel}
          {ilganLabel && birthLabel ? ' · ' : ''}
          {birthLabel}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 2. TopicScoreCard — conic-gradient ring + 점수 + 한 줄 결론
 * ═════════════════════════════════════════════════════════════════ */
export function TopicScoreCard({
  theme,
  score,
  title,
  body,
  note,
}: {
  theme: TopicChromeTheme;
  score: number;
  /** 예: "연애 지수" */
  title: string;
  /** 예: "인연이 잔잔히 들어오는 자리" */
  body: string;
  /** 보조 설명 (사주 근거) */
  note?: string;
}) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div
      style={{
        margin: '12px 20px 0',
        background: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        display: 'grid',
        gridTemplateColumns: '100px 1fr',
        gap: 16,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `conic-gradient(${theme.accentDark} 0 ${pct}%, #E5DFD0 ${pct}% 100%)`,
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
            inset: 8,
            borderRadius: '50%',
            background: '#FFFFFF',
          }}
        />
        <span
          style={{
            position: 'relative',
            zIndex: 1,
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 28,
            fontWeight: 700,
            color: theme.accentDark,
          }}
        >
          {pct}
          <small
            style={{
              fontSize: 12,
              color: theme.hint,
              fontWeight: 400,
              marginLeft: 2,
            }}
          >
            점
          </small>
        </span>
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            color: theme.hint,
            letterSpacing: '0.1em',
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#1A1A1A',
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
        {note && (
          <div
            style={{
              fontSize: 11.5,
              color: theme.hint,
              marginTop: 6,
              lineHeight: 1.55,
            }}
          >
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 3. TopicLinkCard — 사주 요소 chain (일간 × 십성 + 신살 → score)
 * ═════════════════════════════════════════════════════════════════ */
export interface TopicLinkPill {
  text: string;
  /** 'gan' | 'ten' | 'sinsal' | 'score' — 색상 분기 */
  variant?: 'gan' | 'ten' | 'sinsal' | 'score';
}

export function TopicLinkCard({
  theme,
  pills,
  desc,
}: {
  theme: TopicChromeTheme;
  /** 좌→우 chain — 사이에 자동 화살표 */
  pills: TopicLinkPill[];
  desc: ReactNode;
}) {
  return (
    <div
      style={{
        margin: '12px 20px 0',
        background: `linear-gradient(135deg, ${theme.accentSoft}, rgba(46,125,50,0.04))`,
        border: `1px solid ${theme.accent}4D`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          fontSize: 11.5,
          color: theme.hint,
          lineHeight: 1.5,
        }}
      >
        {pills.map((p, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Pill text={p.text} variant={p.variant} theme={theme} />
            {i < pills.length - 1 && (
              <span
                style={{
                  color: theme.accentDark,
                  fontSize: 12,
                }}
                aria-hidden
              >
                {pills[i + 1]?.variant === 'score' ? '→' : '+'}
              </span>
            )}
          </span>
        ))}
      </div>
      <div
        style={{
          fontSize: 12,
          color: '#2A2520',
          marginTop: 8,
          lineHeight: 1.65,
          wordBreak: 'keep-all',
        }}
      >
        {desc}
      </div>
    </div>
  );
}

function Pill({
  text,
  variant,
  theme,
}: {
  text: string;
  variant?: 'gan' | 'ten' | 'sinsal' | 'score';
  theme: TopicChromeTheme;
}) {
  const color =
    variant === 'gan'
      ? '#2E7D32'
      : variant === 'ten'
      ? theme.accentDark
      : variant === 'sinsal'
      ? theme.accentDark
      : variant === 'score'
      ? theme.accentDark
      : '#1A1A1A';
  return (
    <span
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5DFD0',
        borderRadius: 100,
        padding: '4px 10px',
        fontWeight: 600,
        fontFamily: "'Noto Serif KR', serif",
        color,
        fontSize: variant === 'score' ? 13 : 12,
      }}
    >
      {text}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 4. TopicSection — section-num + section-title(한자) + section-sub
 * ═════════════════════════════════════════════════════════════════ */
export function TopicSection({
  theme,
  num,
  title,
  hanjaSuffix,
  sub,
  children,
}: {
  theme: TopicChromeTheme;
  /** 예: "L1 · 지금" */
  num: string;
  title: string;
  /** 우측 한자 (·一語 · ·三月 등) */
  hanjaSuffix?: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginTop: 28 }}>
      <span
        style={{
          display: 'inline-block',
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 11,
          fontWeight: 600,
          color: theme.accentDark,
          letterSpacing: '0.2em',
          marginBottom: 6,
        }}
      >
        {num}
      </span>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 19,
          fontWeight: 700,
          color: '#1A1A1A',
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
            fontSize: 12,
            color: theme.hint,
            marginTop: 4,
            lineHeight: 1.55,
          }}
        >
          {sub}
        </div>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 5. LockVeil — 블러 + 잠금 오버레이 (1운 / 10운 분기)
 *  · _ui_chrome.tsx 의 BlurredSection 과 분리: TopicAnalysis 의 1운/10운 다중 잠금에 대응
 *  · Phase D' 작업 0: 단일 Primary CTA만 (1운 추가 결제 옵션 없음)
 * ═════════════════════════════════════════════════════════════════ */
export function LockVeil({
  theme,
  hanjaIcon = '命',
  primaryLabel,
  subLabel,
  onUnlock,
  children,
}: {
  theme: TopicChromeTheme;
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
        aria-label={`${primaryLabel} ${subLabel ? '· ' + subLabel : ''}`}
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
            color: '#1A1A1A',
            fontWeight: 700,
            marginTop: 6,
          }}
        >
          {primaryLabel}
        </div>
        {subLabel && (
          <div
            style={{
              fontSize: 11.5,
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
 * 6. PullQuote — gradient bg + left-border 인용
 * ═════════════════════════════════════════════════════════════════ */
export function PullQuote({
  theme,
  children,
}: {
  theme: TopicChromeTheme;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${theme.accentSoft}, rgba(232,197,203,0.10))`,
        borderRadius: 10,
        padding: '16px 18px',
        margin: '18px 0 0',
        borderLeft: `3px solid ${theme.quoteBorder}`,
        fontFamily: "'Noto Serif KR', serif",
        fontSize: 15,
        lineHeight: 1.75,
        color: '#1A1A1A',
        fontWeight: 500,
        wordBreak: 'keep-all',
      }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 7. TopicActionList — 3 numbered 액션 카드
 * ═════════════════════════════════════════════════════════════════ */
export interface TopicActionItem {
  title: string;
  desc: ReactNode;
}

export function TopicActionList({
  theme,
  items,
}: {
  theme: TopicChromeTheme;
  items: TopicActionItem[];
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        margin: '14px 0 0',
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5DFD0',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              flexShrink: 0,
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentDark})`,
              color: '#FFFFFF',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {i + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13.5,
                color: '#1A1A1A',
                marginBottom: 3,
              }}
            >
              {it.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: theme.hint,
                lineHeight: 1.65,
              }}
            >
              {it.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 8. TopicUpsellCard — 다크 박스 + 命 워터마크 (10운 프리미엄)
 *  Phase D' 작업 0 정렬: 단일 Primary CTA만 · 1운 추가 결제 옵션 없음
 *  2026-04-27 4 패키지 정정: 10운 → 15운 (p15 = 10본+5보너스 / 5,000원)
 * ═════════════════════════════════════════════════════════════════ */
export function TopicUpsellCard({
  title,
  desc,
  ctaLabel = '10운으로 시작',
  costLabel = '10운',
  onTap,
}: {
  title: string;
  desc: string;
  ctaLabel?: string;
  costLabel?: string;
  onTap?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        margin: '28px 0 0',
        background: 'linear-gradient(135deg, #1A1A1A, #2A1F22)',
        color: '#FFFFFF',
        borderRadius: 14,
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
          position: 'absolute',
          right: -8,
          bottom: -28,
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 130,
          fontWeight: 900,
          color: 'rgba(232,197,203,0.08)',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        命
      </span>
      <div
        style={{
          fontSize: 10,
          color: '#E8C5CB',
          letterSpacing: '0.15em',
          fontWeight: 600,
          marginBottom: 8,
          position: 'relative',
        }}
      >
        PREMIUM
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
          fontSize: 12.5,
          color: '#C4A8AE',
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
          background: 'linear-gradient(135deg, #E8C5CB, #A1606C)',
          color: '#1A1A1A',
          padding: '10px 18px',
          borderRadius: 100,
          fontSize: 13,
          fontWeight: 700,
          position: 'relative',
          alignItems: 'center',
        }}
      >
        {ctaLabel} →
        <span
          style={{
            background: 'rgba(255,255,255,0.08)',
            padding: '3px 10px',
            borderRadius: 100,
            fontSize: 11,
            color: '#5C2E36',
            marginLeft: 6,
            fontWeight: 600,
          }}
        >
          {costLabel}
        </span>
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 9. TopicSourceCite — 풀이 근거 (자평진전·적천수 등 원전 출처)
 * ═════════════════════════════════════════════════════════════════ */
export function TopicSourceCite({
  theme,
  citation,
}: {
  theme: TopicChromeTheme;
  /** 예: "자평진전(子平眞詮) 정관·편관 편 · 적천수(滴天髓) 도화 항" */
  citation: string;
}) {
  return (
    <div
      style={{
        margin: '14px 20px 0',
        padding: '12px 14px',
        background: theme.accentSoft,
        border: `1px solid ${theme.accent}33`,
        borderRadius: 10,
        fontSize: 11,
        color: theme.hint,
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: '#1A1A1A', fontWeight: 600 }}>풀이 근거</strong> · {citation}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 10. TopicSajuMini — 8글자 4-cell grid + 핵심 신살 dot
 *  prod의 SajuMiniCard 와 별개 — mockup 진본 디자인 (작은 4-cell + ilju 강조)
 * ═════════════════════════════════════════════════════════════════ */
export interface TopicSajuMiniCell {
  label: string; // "시"/"일"/"월"/"년"
  gan: string;
  ji: string;
  ganOheng?: '목' | '화' | '토' | '금' | '수';
  jiOheng?: '목' | '화' | '토' | '금' | '수';
  /** 십성 — 예: "겁재" / "일간" / "편재" / "편관" */
  ten?: string;
  /** ilju 강조 (일주만) */
  ilju?: boolean;
  /** 핵심 신살 자리 (mockup의 .key — 桃花 dot 등) */
  key?: boolean;
}

// SSOT 5오행 색 (#41 D1 fix 정렬) — banned 토큰 회피
const OHENG_COLOR: Record<string, string> = {
  목: '#2E7D32',
  화: '#C62828',
  토: '#E8B82A', // SSOT (mockup의 #7F6B4E 는 banned, D1 fix 정책 우선)
  금: '#4A4A4A',
  수: '#1565E0',
};

export function TopicSajuMini({
  theme,
  cells,
  hint,
}: {
  theme: TopicChromeTheme;
  /** 시→일→월→년 순서 4셀 */
  cells: TopicSajuMiniCell[];
  /** 우상단 힌트 — 예: "桃 = 도화 신살" */
  hint?: string;
}) {
  return (
    <div
      style={{
        margin: '16px 20px 0',
        background: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        border: '1px solid #E5DFD0',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: theme.accentDark,
          letterSpacing: '0.15em',
          fontWeight: 600,
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>내 사주 8글자</span>
        {hint && (
          <span
            style={{
              color: theme.hint,
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
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
          textAlign: 'center',
        }}
      >
        {cells.map((c, i) => {
          const ganColor = c.ganOheng ? OHENG_COLOR[c.ganOheng] : '#1A1A1A';
          const jiColor = c.jiOheng ? OHENG_COLOR[c.jiOheng] : '#1A1A1A';
          return (
            <div
              key={i}
              style={{
                background: c.ilju
                  ? 'linear-gradient(180deg, rgba(46,125,50,0.10), rgba(46,125,50,0.04))'
                  : '#F8F5EE',
                borderRadius: 6,
                padding: '8px 2px',
                border: c.ilju
                  ? '1px solid rgba(46,125,50,0.4)'
                  : '1px solid transparent',
                position: 'relative',
              }}
            >
              {c.key && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -2,
                    background: theme.accentDark,
                    color: '#FFFFFF',
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 9,
                    fontWeight: 700,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {theme.hanja}
                </span>
              )}
              <div style={{ fontSize: 8.5, color: theme.hint }}>{c.label}</div>
              <div
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 18,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  marginTop: 2,
                  color: ganColor,
                }}
              >
                {c.gan}
              </div>
              <div
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.1,
                  marginTop: 2,
                  color: jiColor,
                }}
              >
                {c.ji}
              </div>
              {c.ten && (
                <div
                  style={{
                    fontSize: 8.5,
                    color: theme.accentDark,
                    marginTop: 2,
                    fontWeight: 600,
                  }}
                >
                  {c.ten}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
