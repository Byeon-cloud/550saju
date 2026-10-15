/**
 * #saju-card-share Develop · 통일 chrome 컴포넌트
 *
 * 패턴 출처: src/pages/topic/_chrome.tsx + src/pages/free/_chrome.tsx
 *  · TopicHero / FreeHero 의 풀폭 gradient + 220px 한자 워터마크 + 흰 텍스트 오버레이
 *  · TopicSection / FreeSection 의 num + title + hanjaSuffix + sub 패턴
 *
 * 차이점:
 *  · 5 주제 테마 → 5 오행 테마 (목/화/토/금/수) — 일주의 천간 오행 자동 매핑
 *  · saju-card 전용 (PaywallBar / LockVeil 등 차감 컴포넌트 미포함 — 보관함 카드는 잠금 X)
 *
 * SSOT 토큰:
 *  · 5 오행 컬러 (목 #4E7A57 · 화 #B04A38 · 토 #B07F38 · 금 #7D7870 · 수 #3E5F82)
 *  · 카드 컨테이너: surface #FFFFFF · border rgba(184,150,90,0.18) · radius 16
 */

import type { ReactNode } from 'react';
import { hanjaNum } from '@/components/hanji/Hanji';
import type { OhengType } from '@/types/saju';

const C = {
  paper: '#F8F5EE',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#6F6557',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.10)',
  goldLine: 'rgba(184,150,90,0.40)',
  cardLine: 'rgba(184,150,90,0.18)',
  line: '#E5DFD0',
} as const;

const SERIF = "'Noto Serif KR', 'Apple SD Gothic Neo', serif";
const SANS = "'Pretendard', 'Noto Sans KR', system-ui, sans-serif";

/* ══════════════════════════════════════════════════════════════════
 * 5 오행 테마 — Topic 의 TOPIC_CHROME 동형 (5 주제 → 5 오행)
 * ═════════════════════════════════════════════════════════════════ */
export interface OhengTheme {
  /** Hero gradient (135deg dark slope) */
  heroGrad: string;
  /** 한자 워터마크 — 오행 한자 (木·火·土·金·水) */
  watermarkHanja: string;
  /** Primary accent (badge / num / underline) */
  accent: string;
  /** Accent dark (title hanjaSuffix / pull-quote border) */
  accentDark: string;
  /** Accent soft (chip bg / card highlight) */
  accentSoft: string;
  /** Card line (정렬용 SSOT) */
  cardLine: string;
  /** 오행 한국어 라벨 ("목·녹"등) */
  label: string;
}

export const OHENG_THEME: Record<OhengType, OhengTheme> = {
  목: {
    heroGrad: 'linear-gradient(135deg,#4A8068 0%,#2D5A3F 60%,#1A3326 100%)',
    watermarkHanja: '木',
    accent: '#4E7A57',
    accentDark: '#1B5E2C',
    accentSoft: 'rgba(78,122,87,0.12)',
    cardLine: 'rgba(78,122,87,0.22)',
    label: '목(木), 푸른',
  },
  화: {
    heroGrad: 'linear-gradient(135deg,#C04545 0%,#8E2E2E 60%,#5C1A1A 100%)',
    watermarkHanja: '火',
    accent: '#B04A38',
    accentDark: '#9B1B1B',
    accentSoft: 'rgba(176,74,56,0.10)',
    cardLine: 'rgba(176,74,56,0.20)',
    label: '화(火), 붉은',
  },
  토: {
    heroGrad: 'linear-gradient(135deg,#D4A645 0%,#A87E2A 60%,#6E5018 100%)',
    watermarkHanja: '土',
    accent: '#B07F38',
    accentDark: '#A8530B',
    accentSoft: 'rgba(176,127,56,0.10)',
    cardLine: 'rgba(176,127,56,0.22)',
    label: '토(土), 노란',
  },
  금: {
    heroGrad: 'linear-gradient(135deg,#7E8893 0%,#525864 60%,#2E323B 100%)',
    watermarkHanja: '金',
    accent: '#7D7870',
    accentDark: '#3D3D3D',
    accentSoft: 'rgba(74,74,74,0.10)',
    cardLine: 'rgba(74,74,74,0.22)',
    label: '금(金), 하얀',
  },
  수: {
    heroGrad: 'linear-gradient(135deg,#4A75B0 0%,#2E5285 60%,#1A3258 100%)',
    watermarkHanja: '水',
    accent: '#3E5F82',
    accentDark: '#0D3F8A',
    accentSoft: 'rgba(62,95,130,0.10)',
    cardLine: 'rgba(62,95,130,0.20)',
    label: '수(水), 검은',
  },
};

/* ══════════════════════════════════════════════════════════════════
 * 1. SajuCardHero — Round 2 위계 재설계
 *   · 시적 풀이 (Display 24pt) MAIN — 가장 강한 인상
 *   · "기유(己酉) 일주" 부가 14pt
 *   · "노란 닭" 작은 라벨 12pt
 *   · 일주 한자 워터마크 260pt 우하단 (잘림 0)
 * ═════════════════════════════════════════════════════════════════ */
export interface SajuCardHeroProps {
  theme: OhengTheme;
  /** 일주 한자 2글자 (예: "辛亥") — 워터마크용 */
  ilju: string;
  /** 일주 한국어 (예: "신해") */
  iljuKo: string;
  /** 시적 한 줄 (예: "추수의 풍요를 머금은 가을 들녘의 결") — Round 2 메인 */
  hint: string;
  /** 별명 ("하얀 돼지") — 작은 라벨 */
  nickname: string;
  /** 부제 — 일간 + 출생 정보 */
  meta: string;
}

export function SajuCardHero({
  theme,
  ilju,
  iljuKo,
  hint,
  nickname,
  meta,
}: SajuCardHeroProps) {
  // Stage 3 dramatic redesign — 다크 네이비 베이스 + 일간 오행 accent ring + 거대 한자
  // 두산 만세력 + 다크 만세력 레퍼 흡수: 흰 한자 큰(96pt) + 외곽선 + 강한 컬러 액센트
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 'calc(28px + env(safe-area-inset-top)) 20px 28px',
        color: '#FFFFFF',
        // 다크 네이비 + 일간 오행 그라디언트 합성 (dramatic)
        background: `linear-gradient(180deg, #0F0C09 0%, #1F1913 50%, ${theme.accent}33 100%), ${theme.heroGrad}`,
        backgroundBlendMode: 'multiply',
        marginLeft: -18,
        marginRight: -18,
        marginTop: -24,
        boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* 거대 일주 한자 워터마크 — 좌하단 (3 글자 모두 보이게) */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: -40,
          bottom: -100,
          fontFamily: SERIF,
          fontSize: 340,
          fontWeight: 900,
          color: `${theme.accent}24`,
          lineHeight: 0.9,
          pointerEvents: 'none',
          letterSpacing: '-0.04em',
        }}
      >
        {ilju.charAt(1) || theme.watermarkHanja}
      </span>
      {/* accent halo 좌상단 */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: -80,
          top: -80,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.accent}44 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* 상단 배지 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <span
          style={{
            background: theme.accent,
            color: '#0F0C09',
            padding: '4px 12px',
            borderRadius: 2,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.12em',
            boxShadow: `0 2px 8px ${theme.accent}66`,
          }}
        >
          사주500
        </span>
        <span
          style={{
            background: 'rgba(255,255,255,0.12)',
            padding: '4px 12px',
            borderRadius: 2,
            fontSize: 13,
            color: '#E8E2D4',
            border: `1px solid ${theme.accent}44`,
          }}
        >
          만세력 카드
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 13,
            color: theme.accent,
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          {theme.label}
        </span>
      </div>

      {/* ── Stage 3 dramatic 위계: 거대 일주 한자 ⭐ 핵심 시선 끌기 ── */}
      <div
        style={{
          marginTop: 30,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 18,
          position: 'relative',
        }}
      >
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 96,
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: '0.02em',
            color: '#FFFFFF',
            textShadow: `0 0 24px ${theme.accent}66, 0 4px 12px rgba(0,0,0,0.4)`,
            WebkitTextStroke: `1px ${theme.accent}88`,
          }}
        >
          {ilju || '命'}
        </span>
        <div style={{ flex: 1, paddingBottom: 10, minWidth: 0 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 13,
              fontWeight: 700,
              color: theme.accent,
              letterSpacing: '0.18em',
              marginBottom: 4,
            }}
          >
            日柱, {iljuKo}
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 18,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.005em',
              lineHeight: 1.25,
            }}
          >
            {nickname}
          </div>
        </div>
      </div>

      {/* 시적 풀이 — 2026-10-11 왼쪽 띠 → 위아래 가는 선 */}
      <h1
        style={{
          fontFamily: SERIF,
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1.55,
          marginTop: 22,
          marginBottom: 0,
          letterSpacing: '-0.005em',
          position: 'relative',
          padding: '14px 2px',
          borderTop: '1px solid rgba(255,255,255,0.24)',
          borderBottom: '1px solid rgba(255,255,255,0.24)',
          color: 'rgba(255,255,255,0.94)',
        }}
      >
        {hint}
      </h1>

      <div
        style={{
          fontSize: 13,
          opacity: 0.78,
          marginTop: 12,
          position: 'relative',
          letterSpacing: '0.02em',
          color: '#E8E2D4',
        }}
      >
        {meta}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 2. SajuCardSection — Round 2: intro 한 줄 (일반 유저 이해 가능)
 *  · num + title + hanjaSuffix (기존)
 *  · intro 12pt 회색 — 명리학 개념 한 줄 설명 (신규)
 * ═════════════════════════════════════════════════════════════════ */
export interface SajuCardSectionProps {
  theme: OhengTheme;
  /** 예: "01" / "02" */
  num: string;
  /** 한국어 제목 */
  title: string;
  /** 우측 한자 (예: "出生") */
  hanjaSuffix?: string;
  /** Round 2: 명리학 개념 한 줄 설명 — 일반 유저 이해 가능하게 */
  intro?: string;
  children: ReactNode;
}

export function SajuCardSection({
  theme,
  num,
  title,
  hanjaSuffix,
  intro,
  children,
}: SajuCardSectionProps) {
  return (
    <section style={{ marginTop: 28 }}>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 13,
          fontWeight: 700,
          color: theme.accentDark,
          letterSpacing: '0.2em',
          marginBottom: 6,
        }}
      >
        {hanjaNum(Number(num)) || num}
      </div>
      <div
        style={{
          fontFamily: SERIF,
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
      {intro && (
        <div
          style={{
            fontSize: 13.5,
            color: C.mute,
            marginTop: 6,
            lineHeight: 1.6,
            fontStyle: 'normal',
          }}
        >
          {intro}
        </div>
      )}
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 3. SajuCardCard — 일반 카드 컨테이너 (border + radius + padding)
 *  · 4 별도 카드 분리에 사용 (십성 / 지장간 / 운성 / 신살)
 * ═════════════════════════════════════════════════════════════════ */
export function SajuCardCard({
  children,
  noPadding = false,
}: {
  children: ReactNode;
  noPadding?: boolean;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.cardLine}`,
        borderRadius: 14,
        padding: noPadding ? 0 : 16,
      }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 4. SajuCardLabelRow — 좌측 한자 라벨 + 우측 4 기둥 값 가로 배치
 *  · 5×5 통합 표 → 4 별도 카드 분리에 핵심 컴포넌트
 *  · 좌 52px 한자 라벨 (서체 SERIF) + 우 flex 4-col grid
 * ═════════════════════════════════════════════════════════════════ */
export interface PillarRowItem {
  /** 기둥 라벨 ("시"·"일"·"월"·"년") */
  pillar: string;
  /** 중앙 값 (한자/한국어 한 줄) */
  value: string;
  /** 보조 값 (한국어 읽기) — 옵션 */
  sub?: string;
  /** 일주 강조 (true 이면 골드 border) */
  isDay?: boolean;
}

export function SajuCardLabelRow({
  theme,
  labelHanja,
  labelKo,
  items,
}: {
  theme: OhengTheme;
  /** 좌측 한자 라벨 (예: "十神") */
  labelHanja: string;
  /** 좌측 한국어 라벨 (예: "십성") */
  labelKo: string;
  /** 우측 4 기둥 값 — 시→일→월→년 순서 */
  items: PillarRowItem[];
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 12,
        minHeight: 60,
      }}
    >
      {/* 좌측 라벨 (52px) */}
      <div
        style={{
          width: 56,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.accentSoft,
          border: `1px solid ${theme.cardLine}`,
          borderRadius: 10,
          padding: '6px 4px',
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 18,
            fontWeight: 700,
            color: theme.accentDark,
            lineHeight: 1,
            letterSpacing: '0.04em',
          }}
        >
          {labelHanja}
        </div>
        <div
          style={{
            fontSize: 13,
            color: theme.accentDark,
            marginTop: 4,
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          {labelKo}
        </div>
      </div>

      {/* 우측 4 기둥 (시→일→월→년) */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
        }}
      >
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              padding: '6px 2px',
              borderRadius: 8,
              background: it.isDay ? C.goldSoft : C.paper,
              border: it.isDay
                ? `1.5px solid ${C.gold}`
                : `1px solid ${C.line}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 56,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: it.isDay ? C.goldDeep : C.mute,
                fontWeight: 700,
                letterSpacing: '0.04em',
                marginBottom: 3,
              }}
            >
              {it.pillar}
            </div>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 13,
                fontWeight: 600,
                color: it.isDay ? C.goldDeep : C.ink,
                lineHeight: 1.25,
                wordBreak: 'keep-all',
              }}
            >
              {it.value || '—'}
            </div>
            {it.sub && (
              <div
                style={{
                  fontSize: 13,
                  color: C.mute,
                  marginTop: 2,
                }}
              >
                {it.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 5. EightCharGrid — Round 2: 사주 8글자 명확 분리 (4 카드 × 천간/지지)
 *  · 옵션 B 채택: 4 카드 유지 + 천간/지지 사이 divider 1px + 32pt 한자 + 라벨 풀세트
 *  · 점신 패턴 — 한 카드 안에 (천간 한자 → 천간 라벨 → divider → 지지 한자 → 지지 라벨 → 12운성)
 *  · 일주 (가운데) 1.3배 강조 + 골드 box-shadow
 * ═════════════════════════════════════════════════════════════════ */

import type { Pillar } from '@/types/saju';
import { lookupSipsung } from '@/constants/sipsungColor';

export interface EightCharGridProps {
  pillars: Pillar[];
  /** sipsung[] from sajuData (calculator 결과) — position 별 십성 lookup 용 */
  sipsung: Array<{ position: string; 글자: string; 십성: string }>;
  /** unyoung12[] from sajuData — 12운성 표시용 */
  unyoung12: Array<{ position: string; 운성: string }>;
}

const OHENG_HEX_INLINE: Record<OhengType, string> = {
  목: '#4E7A57',
  화: '#B04A38',
  토: '#B07F38',
  금: '#7D7870',
  수: '#3E5F82',
};

/** 십성 ⇄ 위치 매핑 헬퍼 — calculator 출력 ('년간', '월지' 등) → 천간/지지 */
function pickSipsung(
  sipsung: EightCharGridProps['sipsung'],
  pillarIdx: number,
  channel: '천간' | '지지',
): string {
  const ganKeys = ['년간', '월간', '일간', '시간'];
  const zhiKeys = ['년지', '월지', '일지', '시지'];
  const key = channel === '천간' ? ganKeys[pillarIdx] : zhiKeys[pillarIdx];
  const found = sipsung.find((s) => s.position === key);
  return found?.십성 || '';
}

// lunar-javascript 간체/이칭 운성 → 정체 표준화 (만세력 표 노출용 · 养→養 등). 2026-06-02.
const _UNSEONG_S2T: Record<string, string> = { '长': '長', '养': '養', '禄': '祿', '带': '帶', '绝': '絶', '临': '臨' };
function canonUnseong(raw: string): string {
  let c = (raw || '').trim().split('').map((ch) => _UNSEONG_S2T[ch] ?? ch).join('');
  if (c === '臨官') c = '建祿';
  return c;
}
function pickUnyoung(
  unyoung12: EightCharGridProps['unyoung12'],
  pillarIdx: number,
): string {
  const keys = ['년지', '월지', '일지', '시지'];
  const found = unyoung12.find((u) => u.position === keys[pillarIdx]);
  return canonUnseong(found?.운성 || '');
}

export function EightCharGrid({ pillars, sipsung, unyoung12 }: EightCharGridProps) {
  // 시 → 일 → 월 → 년 (전통 명리)
  const order = [3, 2, 1, 0];
  const labels = ['시', '일', '월', '년'];
  const labelsHanja = ['時', '日', '月', '年'];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}
    >
      {order.map((idx, i) => {
        const p = pillars[idx];
        const isDay = idx === 2;
        const ganSipsung = pickSipsung(sipsung, idx, '천간');
        const zhiSipsung = pickSipsung(sipsung, idx, '지지');
        const unyoung = pickUnyoung(unyoung12, idx);

        return (
          <PillarCardCol
            key={i}
            pillar={p}
            label={labels[i]}
            labelHanja={labelsHanja[i]}
            ganSipsung={isDay ? '日主' : ganSipsung}
            zhiSipsung={zhiSipsung}
            unyoung={unyoung}
            isDay={isDay}
          />
        );
      })}
    </div>
  );
}

function PillarCardCol({
  pillar,
  label,
  labelHanja,
  ganSipsung,
  zhiSipsung,
  unyoung,
  isDay,
}: {
  pillar: Pillar | undefined;
  label: string;
  labelHanja: string;
  ganSipsung: string;
  zhiSipsung: string;
  unyoung: string;
  isDay: boolean;
}) {
  const available = pillar?.available !== false;
  const ganOh = pillar?.천간오행 as OhengType | undefined;
  const zhiOh = pillar?.지지오행 as OhengType | undefined;
  const ganColor = ganOh ? OHENG_HEX_INLINE[ganOh] : '#999';
  const zhiColor = zhiOh ? OHENG_HEX_INLINE[zhiOh] : '#999';

  const ganSipsungMeta = lookupSipsung(ganSipsung);
  const zhiSipsungMeta = lookupSipsung(zhiSipsung);

  // 일주 1.3배 강조 → padding scale
  const padScale = isDay ? 1.0 : 1.0; // 컬럼 폭 동일 — 강조는 border + shadow 로

  return (
    <div
      style={{
        background: isDay ? C.goldSoft : C.surface,
        border: isDay ? `2px solid ${C.gold}` : `1px solid ${C.cardLine}`,
        borderRadius: 12,
        padding: `10px ${4 * padScale}px 8px`,
        textAlign: 'center',
        boxShadow: isDay ? '0 2px 8px rgba(184,150,90,0.18)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* 라벨 (한자 + 한국어) */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: isDay ? C.goldDeep : C.mute,
          letterSpacing: '0.04em',
          marginBottom: 4,
        }}
      >
        {labelHanja} {label}
      </div>

      {available ? (
        <>
          {/* ━━━ 천간 ━━━ */}
          <CharRow
            ch={pillar!.천간}
            chRead={pillar!.천간읽기}
            chColor={ganColor}
            ohengName={pillar!.천간오행}
            sipsungLabel={isDay ? '日主' : ganSipsung}
            sipsungColor={isDay ? C.goldDeep : (ganSipsungMeta?.color ?? C.mute)}
            isDay={isDay}
          />

          {/* divider */}
          <div
            style={{
              height: 1,
              background: C.cardLine,
              margin: '4px 0',
              opacity: 0.6,
            }}
          />

          {/* ━━━ 지지 ━━━ */}
          <CharRow
            ch={pillar!.지지}
            chRead={pillar!.지지읽기}
            chColor={zhiColor}
            ohengName={pillar!.지지오행}
            sipsungLabel={zhiSipsung}
            sipsungColor={zhiSipsungMeta?.color ?? C.mute}
            isDay={false}
          />

          {/* 12운성 (지지 아래) */}
          {unyoung && (
            <div
              style={{
                fontSize: 13,
                color: C.mute,
                marginTop: 4,
                fontFamily: SERIF,
                letterSpacing: '0.02em',
              }}
            >
              {unyoung}
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            fontSize: 13,
            color: C.mute,
            padding: '24px 0',
            fontStyle: 'normal',
          }}
        >
          시간
          <br />
          모름
        </div>
      )}
    </div>
  );
}

/* Stage 3 dramatic: 두산 패턴 강한 원색 박스 — 외곽선 + 흰 한자 + 진한 그림자 */
interface OhengBoxStyle {
  bg: string;
  fg: string;
  outline: string;
  shadow: string;
}
const OHENG_BOX_STYLE: Record<OhengType, OhengBoxStyle> = {
  목: { bg: '#4E7A57', fg: '#FFFFFF', outline: '#1B5E2C', shadow: 'rgba(78,122,87,0.35)' },
  화: { bg: '#B04A38', fg: '#FFFFFF', outline: '#9B1B1B', shadow: 'rgba(176,74,56,0.35)' },
  토: { bg: '#B07F38', fg: '#FFFFFF', outline: '#B85A0E', shadow: 'rgba(176,127,56,0.35)' },
  금: { bg: '#FFFFFF', fg: '#1A1A1A', outline: '#9C9C9C', shadow: 'rgba(28,28,28,0.20)' },
  수: { bg: '#1A1A1A', fg: '#FFFFFF', outline: '#3D3D3D', shadow: 'rgba(0,0,0,0.45)' },
};

function CharRow({
  ch,
  chRead,
  ohengName,
  sipsungLabel,
  sipsungColor,
  isDay,
}: {
  ch: string;
  chRead: string;
  chColor: string;
  ohengName?: OhengType;
  sipsungLabel: string;
  sipsungColor: string;
  isDay: boolean;
}) {
  const sipsungShort = sipsungLabel
    ? sipsungLabel.split('/')[0].slice(0, 4)
    : '';
  const boxStyle = ohengName ? OHENG_BOX_STYLE[ohengName] : null;
  // Stage 3 dramatic: 일주 1.3배 + 강한 폰트
  const boxSize = isDay ? 60 : 48;
  const fontSize = isDay ? 36 : 28;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {/* 십성 chip (위) — Stage 3: floating 진한 컬러 */}
      {sipsungShort && (
        <div
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 2,
            background: sipsungColor,
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.03em',
            lineHeight: 1.3,
            marginBottom: 4,
            boxShadow: `0 2px 6px ${sipsungColor}55`,
          }}
        >
          {sipsungShort}
        </div>
      )}
      {/* Stage 3 dramatic: 강한 원색 박스 + 흰 한자 + 외곽선 + 진한 그림자 */}
      <div
        style={{
          width: boxSize,
          height: boxSize,
          background: boxStyle?.bg ?? C.surface,
          color: boxStyle?.fg ?? C.ink,
          border: boxStyle ? `2px solid ${boxStyle.outline}` : `2px solid ${C.line}`,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF,
          fontSize,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '0.02em',
          boxShadow: boxStyle
            ? `0 4px 12px ${boxStyle.shadow}, 0 1px 0 rgba(255,255,255,0.18) inset`
            : '0 1px 3px rgba(0,0,0,0.10)',
          textShadow: boxStyle?.fg === '#FFFFFF'
            ? '0 1px 3px rgba(0,0,0,0.30)'
            : 'none',
        }}
      >
        {ch}
      </div>
      <div style={{ fontSize: 13, color: C.mute, marginTop: 3, fontWeight: 600 }}>{chRead}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 6. OhengCountRow — Round 3: 오행 카운트 + 핵심 메타 한 줄
 *  · "木 3 · 火 0 · 土 2 · 金 2 · 水 1" — 0=빨강, 3+=진하게
 *  · "공망 申酉 · 천을귀인 子申 · 월령 甲" 한 줄 italic
 * ═════════════════════════════════════════════════════════════════ */

const OHENG_LABEL_HANJA: Record<OhengType, string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};

export function OhengCountRow({
  pillars,
}: {
  pillars: Pillar[];
}) {
  const dist: Record<OhengType, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const p of pillars) {
    if (!p.available) continue;
    if (p.천간오행) dist[p.천간오행 as OhengType]++;
    if (p.지지오행) dist[p.지지오행 as OhengType]++;
  }

  const ohengs: OhengType[] = ['목', '화', '토', '금', '수'];
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '8px 10px',
        background: C.surface,
        border: `1px solid ${C.cardLine}`,
        borderRadius: 10,
        fontSize: 13.5,
        color: C.inkSoft,
      }}
    >
      <span
        style={{
          fontWeight: 700,
          color: C.goldDeep,
          fontFamily: SERIF,
          letterSpacing: '0.04em',
        }}
      >
        오행
      </span>
      {ohengs.map((o) => {
        const v = dist[o];
        const isZero = v === 0;
        const isStrong = v >= 3;
        const ohengHex =
          o === '목' ? '#4E7A57'
          : o === '화' ? '#B04A38'
          : o === '토' ? '#B07F38'
          : o === '금' ? '#7D7870'
          : '#3E5F82';
        return (
          <span
            key={o}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 3,
              fontFamily: SERIF,
              fontWeight: isStrong ? 800 : 600,
              color: isZero ? '#C04545' : isStrong ? ohengHex : C.inkSoft,
              fontSize: 13.5,
            }}
          >
            <span style={{ color: ohengHex, fontWeight: 700 }}>
              {OHENG_LABEL_HANJA[o]}
            </span>
            <span style={{ fontFeatureSettings: '"tnum"' }}>{v}</span>
          </span>
        );
      })}
    </div>
  );
}

/** 공망 + 천을귀인 + 월령 한 줄 (italic 회색) */
export function SajuMetaRow({
  gongmang,
  cheonulPositions,
  wolryeong,
}: {
  /** 공망 한자 (예: "戌亥") — sajuData.gongmang 의 일주 기준 우선 */
  gongmang?: string;
  /** 천을귀인 발현 위치 한자 (예: "子申") */
  cheonulPositions?: string;
  /** 월령 한자 (월지) */
  wolryeong?: string;
}) {
  const items: string[] = [];
  if (gongmang) items.push(`공망 ${gongmang}`);
  if (cheonulPositions) items.push(`천을귀인 ${cheonulPositions}`);
  if (wolryeong) items.push(`월령 ${wolryeong}`);
  if (items.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 6,
        fontSize: 13,
        color: C.mute,
        fontStyle: 'normal',
        lineHeight: 1.55,
      }}
    >
      {items.join(', ')}
    </div>
  );
}

/* SSOT C 토큰 export — 페이지/내부 컴포넌트 공통 사용 */
export const SAJU_CARD_TOKENS = C;
export const SAJU_CARD_FONTS = { SERIF, SANS };
