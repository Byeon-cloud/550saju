/**
 * #phase-2-stage-2A · MonthTimeline 공통 컴포넌트
 *
 * mockup 진본 (5 Topic 분기 v1/v2) 의 `.month-tl > .mg > .mc` 패턴 통합:
 *   - 12 셀 그리드 (2행 × 6열) 또는 짧은 버전 (3개월 강조용)
 *   - 각 셀 intensity: high / mid / low / plain
 *   - 현재 월 (now) 마커 — outline ring + 진하게
 *   - 4-tier 범례 (강·중·주의·평이)
 *
 * 5 Topic 분기 + Stage 2B/2D~2G 에서 재사용:
 *   - love: 분홍 톤 (#A1606C / #E8C5CB)
 *   - wealth: 골드 톤 (#B8965A / #E8D9B8)
 *   - career: 청 톤 (#3F5A7C / #A8C0E0)
 *   - health: 녹 톤 (#4A8071 / #A8C9C0)
 *   - study: 자 톤 (#7C4570 / #C8A8C0)
 *
 * 정책 (b) 준수:
 *   - 이모지 0건
 *   - SSOT 토큰 (5 분기 톤은 mockup 진본 색 — TopicChrome 정렬)
 *   - 한자 + 한국어 즉시 병기 (제목 hanjaSuffix 옵션)
 *   - 자체 SVG / div (recharts 회피)
 *
 * 진본 mockup 패턴 (재물 v2 line 402-424):
 *   <div class="month-tl">
 *     <div class="ttl">월별 재물 지수</div>
 *     <div class="mg">
 *       <div class="mc {high|mid|low|now}"><div class="m">N</div></div> × 12
 *     </div>
 *     <div class="legend">...</div>
 *   </div>
 */

import type { ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════════
 * 타입
 * ═════════════════════════════════════════════════════════════════ */

export type MonthIntensity = 'high' | 'mid' | 'low' | 'plain';

export interface MonthCell {
  /** 월 번호 1~12 (또는 짧은 버전에서는 3~5 등) */
  month: number;
  /** 강도 — default 'plain' (잔잔/평이) */
  intensity?: MonthIntensity;
  /** 현재 월 강조 — outline ring + bold */
  isCurrent?: boolean;
  /** 호버/aria-label 용 한 줄 풀이 */
  hint?: string;
}

export interface MonthTimelineTheme {
  /** 강 — 진한 톤 (예: gold #B8965A) */
  high: string;
  /** 중 — 옅은 톤 (예: gold-light #E8D9B8) */
  mid: string;
  /** 주의 — 빨강 (모든 분기 공통 — 위험 표기) */
  low: string;
  /** 평이 — 회색 (모든 분기 공통) */
  plain: string;
  /** 현재 월 ring 색 — 보통 high 톤과 동일 */
  ringColor?: string;
}

export interface MonthTimelineProps {
  /** 12 또는 N (3~12) 셀 — month-tl 본문 */
  cells: MonthCell[];
  /** 상단 제목 (예: "월별 재물 지수") */
  title: string;
  /** 한자 suffix (예: "年運") */
  hanjaSuffix?: string;
  /** 부제 (옵션, 한 줄) */
  subtitle?: string;
  /** 분기별 색 테마 — TopicChrome 정렬 */
  theme: MonthTimelineTheme;
  /** 범례 레이블 — default ['강', '중', '주의', '평이'] */
  legendLabels?: { high: string; mid: string; low: string; plain: string };
  /** plain 셀 숨김 (3개월만 표시 등) — default false */
  hidePlain?: boolean;
  /** 컨테이너 우상단 액션 (예: "더 자세히 →") */
  rightAction?: ReactNode;
}

/* ══════════════════════════════════════════════════════════════════
 * 5 분기 default 테마 — TopicChrome accent 정렬
 *  · TOPIC_CHROME[key].accent / accentSoft 와 일관
 *  · 사용처에서 직접 import 하거나 TopicChrome 재사용 가능
 * ═════════════════════════════════════════════════════════════════ */

export const MONTH_TIMELINE_THEMES = {
  love:    { high: '#A1606C', mid: 'rgba(200,138,149,0.45)', low: 'rgba(198,40,40,0.18)', plain: '#E5DFD0', ringColor: '#A1606C' },
  wealth:  { high: '#B8965A', mid: '#E8D9B8',                 low: 'rgba(198,40,40,0.18)', plain: '#E5DFD0', ringColor: '#8C6D3D' },
  career:  { high: '#3F5A7C', mid: 'rgba(90,124,168,0.45)',  low: 'rgba(198,40,40,0.18)', plain: '#E5DFD0', ringColor: '#3F5A7C' },
  health:  { high: '#4A8071', mid: 'rgba(111,160,140,0.45)', low: 'rgba(198,40,40,0.18)', plain: '#E5DFD0', ringColor: '#4A8071' },
  study:   { high: '#7C4570', mid: 'rgba(156,90,138,0.45)',  low: 'rgba(198,40,40,0.18)', plain: '#E5DFD0', ringColor: '#7C4570' },
} as const satisfies Record<string, MonthTimelineTheme>;

const DEFAULT_LEGEND = { high: '강', mid: '중', low: '주의', plain: '평이' };

/* ══════════════════════════════════════════════════════════════════
 * SSOT 토큰 (자체 사용)
 * ═════════════════════════════════════════════════════════════════ */
const C = {
  paper: '#F8F5EE',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  goldDeep: '#8C6D3D',
  cardLine: 'rgba(184,150,90,0.18)',
} as const;

const SERIF = "'Noto Serif KR', serif";

/* ══════════════════════════════════════════════════════════════════
 * MonthTimeline
 * ═════════════════════════════════════════════════════════════════ */

export function MonthTimeline({
  cells,
  title,
  hanjaSuffix,
  subtitle,
  theme,
  legendLabels = DEFAULT_LEGEND,
  hidePlain = false,
  rightAction,
}: MonthTimelineProps) {
  // 12 셀 보장 — 빈 월은 plain 으로 채움 (mockup 진본 패턴: 빈 클래스 = plain)
  const fullCells: MonthCell[] = (() => {
    if (cells.length >= 12) return cells.slice(0, 12);
    // 짧은 버전 (3~12 미만): 비어있는 월은 plain 채움
    const map = new Map(cells.map((c) => [c.month, c]));
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return map.get(m) ?? { month: m, intensity: 'plain' };
    });
  })();

  function bgFor(intensity: MonthIntensity): string {
    switch (intensity) {
      case 'high': return theme.high;
      case 'mid': return theme.mid;
      case 'low': return theme.low;
      case 'plain': default: return theme.plain;
    }
  }

  function fgFor(intensity: MonthIntensity): string {
    // high/low 는 어두운 배경 → 흰 글자, mid/plain 은 밝은 배경 → 잉크
    return intensity === 'high' || intensity === 'low' ? '#FFFFFF' : C.ink;
  }

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.cardLine}`,
        borderRadius: 14,
        padding: '14px 14px 12px',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginBottom: subtitle ? 4 : 10,
        }}
      >
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 13,
            fontWeight: 700,
            color: C.goldDeep,
          }}
        >
          {title}
        </span>
        {hanjaSuffix && (
          <span style={{ fontSize: 11, color: C.mute, fontFamily: SERIF }}>
            {hanjaSuffix}
          </span>
        )}
        {rightAction && (
          <span style={{ marginLeft: 'auto' }}>{rightAction}</span>
        )}
      </div>

      {subtitle && (
        <div
          style={{
            fontSize: 11,
            color: C.mute,
            marginBottom: 10,
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      )}

      {/* 12 셀 그리드 — 2행 × 6열 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 4,
        }}
      >
        {fullCells.map((c) => {
          const intensity = c.intensity ?? 'plain';
          const visible = !(hidePlain && intensity === 'plain');
          const bg = bgFor(intensity);
          const fg = fgFor(intensity);
          const isPlain = intensity === 'plain';

          return (
            <div
              key={c.month}
              role="gridcell"
              aria-label={`${c.month}월${c.hint ? ` — ${c.hint}` : ''}${c.isCurrent ? ' (현재)' : ''}`}
              title={c.hint || `${c.month}월`}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                minHeight: 36,
                background: visible ? bg : 'transparent',
                border: c.isCurrent
                  ? `2px solid ${theme.ringColor ?? theme.high}`
                  : isPlain
                  ? `1px solid ${C.cardLine}`
                  : 'none',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: SERIF,
                fontSize: 13,
                fontWeight: c.isCurrent ? 800 : 600,
                color: visible ? fg : C.mute,
                opacity: visible ? 1 : 0.4,
                boxShadow: c.isCurrent
                  ? `0 0 0 1px ${C.surface} inset, 0 2px 8px ${theme.ringColor ?? theme.high}33`
                  : 'none',
                transition: 'transform 0.15s',
              }}
            >
              <span>{c.month}</span>
              {c.isCurrent && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    fontSize: 7,
                    fontWeight: 800,
                    color: theme.ringColor ?? theme.high,
                    background: '#FFFFFF',
                    padding: '0 3px',
                    borderRadius: 2,
                    letterSpacing: '0.04em',
                  }}
                >
                  NOW
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 10,
          fontSize: 10.5,
          color: C.mute,
        }}
      >
        <LegendItem color={theme.high} label={legendLabels.high} />
        <LegendItem color={theme.mid} label={legendLabels.mid} />
        <LegendItem color={theme.low} label={legendLabels.low} />
        <LegendItem color={theme.plain} label={legendLabels.plain} bordered />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  bordered,
}: {
  color: string;
  label: string;
  bordered?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        lineHeight: 1.3,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 12,
          height: 10,
          background: color,
          border: bordered ? `1px solid ${C.cardLine}` : 'none',
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 헬퍼 — 점수 → intensity 자동 매핑 (호출자 편의)
 *  · 70+ → high · 50~69 → mid · 30~49 → plain · 30 미만 → low
 *  · 사주 도메인 가이드 (mockup 색감 기준)
 * ═════════════════════════════════════════════════════════════════ */

export function scoreToIntensity(score: number): MonthIntensity {
  if (score >= 70) return 'high';
  if (score >= 50) return 'mid';
  if (score >= 30) return 'plain';
  return 'low';
}

/** 점수 배열 → 12 MonthCell 자동 생성 (월 1~12) */
export function buildMonthCells(
  scores: number[],
  options: { currentMonth?: number; hints?: string[] } = {},
): MonthCell[] {
  const { currentMonth, hints = [] } = options;
  return scores.slice(0, 12).map((s, i) => ({
    month: i + 1,
    intensity: scoreToIntensity(s),
    isCurrent: currentMonth === i + 1,
    hint: hints[i],
  }));
}
