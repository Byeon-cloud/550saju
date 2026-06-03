// free/_chrome.tsx — Phase D'-3 Bundle 1 (#54) 무료 페이지 mockup 시각 패턴 추출
// 진본:
//   - docs/mockups/사주500_UI개편_목업_무료_오늘의운세_v2.html (586L)
//   - docs/mockups/사주500_UI개편_목업_무료_꿈해몽_v2.html (600L)
//
// 핵심 패턴 (2 mockup 공통):
//   1. FreeHero — gradient header + badge·tier·일간 + h1 + date
//   2. FreeSection — sec-num + sec-title + han + sec-lead + 본문 (Topic _chrome 의 TopicSection 변형)
//   3. FreeUpsellCard — 다크 박스 + 命 워터마크 + 단일 CTA "사주 전체로 (10운)"
//   4. FreeServiceNotice — 서비스 이용 안내 (앱인토스 검수 §6-1 대응)
//
// 오늘운세 전용:
//   5. TodayRelationCard — 내 일간 vs 오늘 일간 만남 (orb 2개 + arrow + 관계 라벨)
//   6. TodayOhengRow — 5오행 균형 + 오늘 보충
//   7. TodayTopicGrid — 4 영역 점수 (재물·관계·일·건강) + 1운 CTA
//   8. TodayMeetStack — 끌어주는 사람 / 부딪히는 사람 (오늘의 인연 결)
//
// 꿈해몽 전용:
//   9. DreamInputStack — 3-part 입력 echo (꿈 주제/내용/요새 고민)
//   10. DreamSymbolGrid — 4-card 꿈 상징 (SVG + 이름 + 한자 + 설명)
//   11. DreamQuoteStack — 인용 + 해석 카드 (사용자 문장 키워드 추출)
//
// 원칙:
//   - mockup 진본의 디자인 규율 그대로
//   - SSOT 토큰만 (banned: #A08B6A/#F0E8D9/#7F6B4E/#B8965A/#8C6D3D)
//   - 5오행 색은 SSOT (D1 fix 정렬)
//   - 桃花 한자 (Bundle 2 緣→桃 sweep과 정렬)
//   - 디스클레이머·DailyRewardBadge·Flippable 정적화는 호출처 보존

import type { ReactNode } from 'react';
// 2026-05-29 H1 fix — 업셀 "10운" 하드코딩 → SSOT 세일가 (런칭세일 중 5운).
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

// 5오행 색 (SSOT D1 fix 정렬)
export const OHENG_COLOR_FREE: Record<string, string> = {
  목: '#2E7D32',
  화: '#C62828',
  토: '#F57F17',
  금: '#4A4A4A',
  수: '#1565C0',
};

/* ══════════════════════════════════════════════════════════════════
 * 1. FreeHero — gradient header + badge·tier·일간 + h1 + date
 *  · 오늘운세: 일간 오행 그라디언트 (Daily 의 day-tile 보존, Hero 는 추가 층)
 *  · 꿈해몽: 다크 블루 그라디언트 (꿈의 무의식 톤)
 * ═════════════════════════════════════════════════════════════════ */
export interface FreeHeroProps {
  /** 좌상단 라벨 — "오늘의 운세" / "꿈해몽" */
  badge: string;
  /** 우상단 무료 태그 — 기본 "오늘 1회 무료" */
  freeTagLabel?: string;
  /** 사용자 이름 — 미지정 시 표시 안 함 */
  userName?: string;
  /** Hero 메인 카피 (mockup 진본 h1) */
  h1: ReactNode;
  /** 하단 메타 — 예: "2026년 4월 20일 월요일 · 병진일(丙辰)" */
  meta?: string;
  /** Background gradient — `linear-gradient(...)` */
  gradient?: string;
  /** 우하단 한자 워터마크 (220px) — 예: "日" / "夢" */
  hanjaWatermark?: string;
  /** 한자 워터마크 색 — 기본 rgba(255,255,255,0.07) */
  hanjaOpacityRgb?: string;
}

export function FreeHero({
  badge,
  freeTagLabel = '오늘 1회 무료',
  userName,
  h1,
  meta,
  gradient = 'linear-gradient(135deg,#4A6B5E 0%,#2D4A3F 60%,#1A302A 100%)',
  hanjaWatermark,
  hanjaOpacityRgb = 'rgba(255,255,255,0.07)',
}: FreeHeroProps) {
  return (
    <header
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '18px 20px 28px',
        color: '#FFFFFF',
        background: gradient,
      }}
    >
      {hanjaWatermark && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: -18,
            bottom: -40,
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 220,
            fontWeight: 900,
            color: hanjaOpacityRgb,
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {hanjaWatermark}
        </span>
      )}
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
          {badge}
        </span>
        {userName && <span>{userName} 님</span>}
        <span
          style={{
            marginLeft: userName ? 'auto' : 0,
            background: 'rgba(255,255,255,0.14)',
            padding: '3px 10px',
            borderRadius: 100,
            fontSize: 10,
          }}
        >
          {freeTagLabel}
        </span>
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
        {h1}
      </h1>
      {meta && (
        <div
          style={{
            fontSize: 12,
            opacity: 0.85,
            marginTop: 4,
            position: 'relative',
            fontFeatureSettings: '"tnum"',
          }}
        >
          {meta}
        </div>
      )}
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 2. FreeSection — sec-num + sec-title + han + sec-lead + 본문
 *  · Topic 의 TopicSection 과 디자인 동일하지만 무료 페이지용 톤 (gold accent)
 * ═════════════════════════════════════════════════════════════════ */
export interface FreeSectionProps {
  /** 예: "SECTION 01" / "L1 · 지금" */
  num: string;
  /** 한글 제목 */
  title: string;
  /** 우측 한자 (예: "日柱" / "初相") */
  hanjaSuffix?: string;
  /** 부제 (sec-lead) */
  lead?: string;
  /** 색 분기 — 기본 gold */
  accent?: string;
  accentDark?: string;
  children: ReactNode;
}

export function FreeSection({
  num,
  title,
  hanjaSuffix,
  lead,
  accent = C.goldDeep,
  children,
}: FreeSectionProps) {
  return (
    <section style={{ marginTop: 28 }}>
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 11,
          fontWeight: 600,
          color: accent,
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
              color: accent,
              fontWeight: 500,
              marginLeft: 6,
              fontSize: 14,
            }}
          >
            {hanjaSuffix}
          </span>
        )}
      </div>
      {lead && (
        <div
          style={{
            fontSize: 12,
            color: C.mute,
            marginTop: 4,
            lineHeight: 1.55,
          }}
        >
          {lead}
        </div>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 3. FreeUpsellCard — 다크 박스 + 命 워터마크 (15운 프리미엄 = 10본 + 5보너스)
 *  · Phase D' 작업 0: 단일 Primary CTA만
 *  · 2026-04-27 4 패키지 정정: 10운 → 15운 (p15 = 5,000원)
 * ═════════════════════════════════════════════════════════════════ */
export function FreeUpsellCard({
  title,
  desc,
  ctaLabel = '사주 전체로',
  costLabel,
  onTap,
}: {
  title: string;
  desc: string;
  ctaLabel?: string;
  costLabel?: string;
  onTap?: () => void;
}) {
  // costLabel 미지정 시 SSOT 종합사주 가격(세일 반영). 세일 중: "10운 → 5운".
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
        background: 'linear-gradient(135deg, #1A1A1A, #2A2520)',
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
          color: 'rgba(232,217,184,0.08)',
          lineHeight: 1,
          pointerEvents: 'none',
        }}
      >
        命
      </span>
      <div
        style={{
          fontSize: 10,
          color: '#E8D9B8',
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
          background: 'linear-gradient(135deg, #E8D9B8, #B8965A)',
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
            background: 'rgba(255,255,255,0.10)',
            padding: '3px 10px',
            borderRadius: 100,
            fontSize: 11,
            color: '#5C4A2E',
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
 * 4. FreeServiceNotice — 서비스 이용 안내 (앱인토스 검수 §6-1)
 * ═════════════════════════════════════════════════════════════════ */
export function FreeServiceNotice({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: '22px 20px 0',
        padding: '14px 18px',
        borderTop: `1px dashed ${C.line}`,
        fontSize: 11,
        lineHeight: 1.65,
        color: '#9A8B70',
        textAlign: 'center',
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 5. TodayRelationCard — 내 일간 vs 오늘 일간 만남
 *  진본: orb-block × 2 + arrow + 관계 라벨 ("목생화" 등)
 * ═════════════════════════════════════════════════════════════════ */
export interface TodayRelationCardProps {
  /** 내 일간 한자 */
  myGan: string;
  /** 내 일간 이름 — 예: "갑(甲) · 양목" */
  myGanName: string;
  /** 오늘 일간 한자 */
  todayGan: string;
  /** 오늘 일간 이름 */
  todayGanName: string;
  /** 관계 라벨 — 예: "목생화" / "화극금" */
  relationLabel: string;
  /** 풀이 본문 */
  explain: ReactNode;
  /** orb 색 (기본 gold) */
  myColor?: string;
  todayColor?: string;
}

export function TodayRelationCard({
  myGan,
  myGanName,
  todayGan,
  todayGanName,
  relationLabel,
  explain,
  myColor = C.goldDeep,
  todayColor = '#C62828',
}: TodayRelationCardProps) {
  return (
    <div
      style={{
        margin: '12px 20px 0',
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '16px 18px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        border: `1px solid ${C.line}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: C.goldDeep,
          letterSpacing: '0.15em',
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        오늘 일간과 내 일간의 만남
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <RelOrbBlock gan={myGan} label="내 일간" name={myGanName} color={myColor} />
        <div style={{ textAlign: 'center' }}>
          <svg viewBox="0 0 60 30" width="60" height="30" fill="none" aria-hidden>
            <path
              d="M5 15 L55 15"
              stroke={C.gold}
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <path
              d="M50 10 L55 15 L50 20"
              stroke={C.gold}
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.goldDeep,
              marginTop: 2,
            }}
          >
            {relationLabel}
          </div>
        </div>
        <RelOrbBlock
          gan={todayGan}
          label="오늘 일간"
          name={todayGanName}
          color={todayColor}
        />
      </div>
      <div
        style={{
          marginTop: 14,
          padding: '12px 14px',
          background: C.goldSoft,
          borderRadius: 10,
          fontSize: 12.5,
          color: C.ink,
          lineHeight: 1.7,
          wordBreak: 'keep-all',
        }}
      >
        {explain}
      </div>
    </div>
  );
}

function RelOrbBlock({
  gan,
  label,
  name,
  color,
}: {
  gan: string;
  label: string;
  name: string;
  color: string;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        aria-hidden
        style={{
          width: 64,
          height: 64,
          margin: '0 auto',
          borderRadius: '50%',
          background: `${color}1A`,
          border: `2px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 28,
          fontWeight: 800,
          color,
        }}
      >
        {gan}
      </div>
      <div
        style={{
          fontSize: 10,
          color: C.mute,
          marginTop: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{name}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 6. TodayOhengRow — 5오행 균형 + 오늘 보충
 *  진본: glyph + dot + qty (예: "2 +1")
 * ═════════════════════════════════════════════════════════════════ */
export interface OhengItem {
  oheng: '목' | '화' | '토' | '금' | '수';
  qty: number;
  /** 오늘 보충 — 예: "+1" */
  todayBonus?: string;
  /** 부족 (lack 표시) */
  lack?: boolean;
}

export function TodayOhengRow({ items }: { items: OhengItem[] }) {
  const HANJA: Record<string, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
  return (
    <div
      style={{
        margin: '12px 20px 0',
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '14px 18px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        border: `1px solid ${C.line}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: C.goldDeep,
          letterSpacing: '0.15em',
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        내 사주 오행 + 오늘의 보충
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
        }}
      >
        {items.map((it) => {
          const color = OHENG_COLOR_FREE[it.oheng];
          return (
            <div
              key={it.oheng}
              style={{
                textAlign: 'center',
                padding: '10px 4px',
                borderRadius: 10,
                background: it.lack ? `${color}08` : `${color}14`,
                border: `1px solid ${it.lack ? color + '44' : color + '26'}`,
              }}
            >
              <div
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 22,
                  fontWeight: 800,
                  color,
                  lineHeight: 1,
                }}
              >
                {HANJA[it.oheng]}
              </div>
              <div
                aria-hidden
                style={{
                  width: 4,
                  height: 4,
                  margin: '6px auto 4px',
                  borderRadius: '50%',
                  background: it.lack ? '#C62828' : color,
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: it.lack ? '#C62828' : color,
                }}
              >
                {it.qty}
                {it.todayBonus && (
                  <span style={{ fontSize: 9, marginLeft: 2, color: C.goldDeep }}>
                    {it.todayBonus}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 7. TodayTopicGrid — 4 영역 점수 카드 (재물·관계·일·건강)
 *  진본: t-money/t-rel/t-work/t-health · 한자 財·桃·業·身 + 1운 CTA
 *  ※ 관계 한자: Bundle 2 緣→桃 sweep과 정렬
 * ═════════════════════════════════════════════════════════════════ */
export interface TodayTopicCard {
  key: 'money' | 'rel' | 'work' | 'health';
  label: string;
  hanja: string;
  score: number; // 0~10
  oneLiner: ReactNode;
  ctaText: string;
  /** 1운 / 10운 — 카드 진입 비용 */
  costLabel?: string;
  onTap?: () => void;
}

const TOPIC_CARD_COLOR: Record<TodayTopicCard['key'], { accent: string; soft: string }> = {
  money: { accent: '#B8965A', soft: 'rgba(184,150,90,0.10)' },
  rel: { accent: '#C88A95', soft: 'rgba(200,138,149,0.10)' },
  work: { accent: '#5A7CA8', soft: 'rgba(90,124,168,0.10)' },
  health: { accent: '#6FA08C', soft: 'rgba(111,160,140,0.10)' },
};

export function TodayTopicGrid({ cards }: { cards: TodayTopicCard[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
      }}
    >
      {cards.map((c) => {
        const col = TOPIC_CARD_COLOR[c.key];
        return (
          <button
            key={c.key}
            type="button"
            onClick={c.onTap}
            style={{
              background: '#FFFFFF',
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              padding: '14px',
              textAlign: 'left',
              cursor: c.onTap ? 'pointer' : 'default',
              position: 'relative',
              overflow: 'hidden',
            }}
            aria-label={`${c.label} ${c.score}/10 — ${c.ctaText}`}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: col.accent,
              }}
            />
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
                  fontSize: 12,
                  fontWeight: 700,
                  color: col.accent,
                  letterSpacing: '0.04em',
                }}
              >
                {c.label}
              </span>
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 14,
                  fontWeight: 700,
                  color: col.accent,
                }}
              >
                {c.hanja}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 28,
                  fontWeight: 800,
                  color: col.accent,
                  lineHeight: 1,
                }}
              >
                {c.score}
              </span>
              <span style={{ fontSize: 11, color: C.mute, fontWeight: 600 }}>/10</span>
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: C.inkSoft,
                lineHeight: 1.6,
                marginBottom: 10,
                wordBreak: 'keep-all',
              }}
            >
              {c.oneLiner}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
                paddingTop: 8,
                borderTop: `1px solid ${C.line}`,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: col.accent }}>
                {c.ctaText}
              </span>
              <span
                style={{
                  background: col.soft,
                  border: `1px solid ${col.accent}40`,
                  color: col.accent,
                  padding: '2px 8px',
                  borderRadius: 100,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {c.costLabel ?? '1운'}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 8. TodayMeetStack — 끌어주는 사람 / 부딪히는 사람
 *  진본: badge-orb (한자 1~2자) + ti-row + tag + ds 본문
 * ═════════════════════════════════════════════════════════════════ */
export interface TodayMeetItem {
  variant: 'boost' | 'clash';
  /** badge orb — 한자 1~2자 (예: "壬癸" / "庚辛") */
  ganChars: string;
  title: string;
  /** 우상단 태그 — "+ 보완" / "− 충돌" */
  tag: string;
  /** 본문 */
  body: ReactNode;
}

export function TodayMeetStack({ items }: { items: TodayMeetItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => {
        const isBoost = it.variant === 'boost';
        const accent = isBoost ? '#1565C0' : '#4A4A4A';
        const bg = isBoost ? 'rgba(21,101,224,0.06)' : 'rgba(74,74,74,0.06)';
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '64px 1fr',
              gap: 14,
              padding: '14px 16px',
              background: bg,
              border: `1px solid ${accent}33`,
              borderRadius: 12,
            }}
          >
            <div
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: `${accent}14`,
                border: `2px solid ${accent}`,
                color: accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                fontFamily: "'Noto Serif KR', serif",
                fontWeight: 800,
                lineHeight: 1,
                fontSize: 18,
                gap: 1,
              }}
            >
              {it.ganChars.split('').map((c, j) => (
                <span key={j} style={{ fontSize: j === 0 ? 18 : 13 }}>
                  {c}
                </span>
              ))}
            </div>
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                  {it.title}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: accent,
                    background: `${accent}14`,
                    padding: '1px 7px',
                    borderRadius: 100,
                  }}
                >
                  {it.tag}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: C.inkSoft,
                  lineHeight: 1.7,
                  wordBreak: 'keep-all',
                }}
              >
                {it.body}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 9. DreamInputStack — 3-part 입력 echo (꿈 주제/내용/요새 고민)
 * ═════════════════════════════════════════════════════════════════ */
export interface DreamInputItem {
  /** 라벨 — "꿈 주제" / "꿈 내용" / "요새 고민" */
  label: string;
  text: string;
  /** dot 색 — 기본 gold */
  dotColor?: string;
}

export function DreamInputStack({ items }: { items: DreamInputItem[] }) {
  return (
    <div
      style={{
        margin: '16px 20px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            borderRadius: 12,
            padding: '12px 14px',
            border: `1px solid ${C.line}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              color: C.goldDeep,
              fontWeight: 700,
              letterSpacing: '0.1em',
              marginBottom: 6,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: it.dotColor ?? C.gold,
              }}
            />
            {it.label}
          </div>
          <div
            style={{
              fontSize: 13,
              color: C.ink,
              lineHeight: 1.65,
              wordBreak: 'keep-all',
            }}
          >
            {it.text}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 10. DreamSymbolGrid — 4-card 꿈 상징 (SVG + 이름 + 한자 + 설명)
 *  진본: pic 영역 + hd2 (nm + han) + dc 본문
 *  주의: SVG 매핑은 호출처가 보유 (feedback_dream_visualization.md — 50~100개 라이브러리)
 * ═════════════════════════════════════════════════════════════════ */
export interface DreamSymbolItem {
  /** SVG 또는 fallback 한자 카드 (호출처가 결정) */
  pic: ReactNode;
  /** 이름 — 예: "물" / "맨발" */
  name: string;
  /** 한자 — 예: "水" / "足" */
  hanja: string;
  /** 설명 */
  desc: ReactNode;
  /** Pic 영역 색조 (기본 dark blue) */
  picColor?: string;
}

export function DreamSymbolGrid({ items }: { items: DreamSymbolItem[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            borderRadius: 12,
            padding: '14px 12px',
            border: `1px solid ${C.line}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '100%',
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: it.picColor ?? '#2C3E50',
              marginBottom: 10,
            }}
            aria-hidden
          >
            {it.pic}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.ink,
              }}
            >
              {it.name}
            </span>
            <span
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 14,
                fontWeight: 700,
                color: C.goldDeep,
              }}
            >
              {it.hanja}
            </span>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: C.inkSoft,
              lineHeight: 1.6,
              wordBreak: 'keep-all',
            }}
          >
            {it.desc}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 11. DreamQuoteStack — 인용 + 해석 카드 (사용자 문장 키워드 추출)
 *  진본: src (인용) + interp (tag + 본문)
 * ═════════════════════════════════════════════════════════════════ */
export interface DreamQuoteItem {
  /** 사용자 문장 (mockup 진본 hl 강조 부분 마크업 가능 — `<strong>` 또는 ReactNode) */
  src: ReactNode;
  /** 해석 태그 — "준비됨" / "파장" / "집중" */
  tag: string;
  /** 해석 본문 */
  interp: ReactNode;
}

export function DreamQuoteStack({ items }: { items: DreamQuoteItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            background: '#FFFFFF',
            borderRadius: 12,
            padding: '14px 16px',
            border: `1px solid ${C.line}`,
            borderLeft: `3px solid ${C.goldDeep}`,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: C.inkSoft,
              fontStyle: 'italic',
              lineHeight: 1.7,
              marginBottom: 10,
              wordBreak: 'keep-all',
            }}
          >
            {it.src}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              paddingTop: 10,
              borderTop: `1px dashed ${C.line}`,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 700,
                color: C.goldDeep,
                background: C.goldSoft,
                padding: '2px 8px',
                borderRadius: 100,
                marginTop: 2,
              }}
            >
              {it.tag}
            </span>
            <div
              style={{
                fontSize: 13,
                color: C.ink,
                lineHeight: 1.7,
                wordBreak: 'keep-all',
              }}
            >
              {it.interp}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
