// topic/_chrome.tsx — Phase D'-2 (#54) 5 mockup 시각 패턴 추출
// 진본: docs/mockups/사주500_UI개편_목업_1운_주제별*.html (5종)
//   - 연애 v1 (桃, 핑크-자주 #8C6D3D → #7A5C2E)
//   - 재물 v2 (財, 골드 #B8965A → #8C6D3D)
//   - 직업 v1 (官, 블루 #5A7CA8 → #3F5A7C)
//   - 건강 v1 (壽, 그린 #8C6D3D → #7A5C2E)
//   - 공부 v1 (學, 보라 #8C6D3D → #7A5C2E)
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

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { INK_HERO_BG } from '@/components/hanji/Hanji';

/* ══════════════════════════════════════════════════════════════════
 * 5 주제 디자인 매핑 (mockup 진본 색 추출)
 * ═════════════════════════════════════════════════════════════════ */
// 2026-05-28 — SSOT 10주제 chrome 확장 (reunion/marriage/exam/business/move 추가 — 5 일반 주제 디자인 격차 해소)
export type TopicChromeKey = 'love' | 'wealth' | 'career' | 'health' | 'study' | 'reunion' | 'marriage' | 'exam' | 'business' | 'move';

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
  /** 2026-05-28 PM — 헤더 하단 info pill (DailyMockupView 통일) */
  heroHint?: string;
}

export const TOPIC_CHROME: Record<TopicChromeKey, TopicChromeTheme> = {
  love: {
    heroGrad: 'linear-gradient(135deg,#8C6D3D 0%,#7A5C2E 60%,#8E4D5B 100%)',
    hanja: '桃',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#5C2E36',
    badgeOn: '#FFFFFF',
    quoteBorder: '#7A5C2E',
    label: '연애운',
    heroH1: { line1: '관계의 흐름과', line2: '인연이 닿는 자리' },
    heroHint: '천천히 읽어보세요, 인연의 결은 한 번에 들어오지 않아요',
  },
  wealth: {
    heroGrad: 'linear-gradient(135deg,#D4B07F 0%,#B8965A 55%,#8C6D3D 100%)',
    hanja: '財',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#5C4A2E',
    badgeOn: '#FFFFFF',
    quoteBorder: '#8C6D3D',
    label: '재물운',
    heroH1: { line1: '돈이 들어오고', line2: '머무는 자리' },
    heroHint: '천천히 읽어보세요, 돈의 결은 한 줄로 풀리지 않아요',
  },
  career: {
    heroGrad: 'linear-gradient(135deg,#8C6D3D 0%,#8C6D3D 55%,#3F5A7C 100%)',
    hanja: '官',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#28405C',
    badgeOn: '#FFFFFF',
    quoteBorder: '#3F5A7C',
    label: '직업운',
    heroH1: { line1: '쌓아올리는 자리와', line2: '커리어의 결' },
    heroHint: '천천히 읽어보세요, 일의 결은 시간이 만들어가요',
  },
  health: {
    heroGrad: 'linear-gradient(135deg,#8FB8A8 0%,#8C6D3D 55%,#7A5C2E 100%)',
    hanja: '壽',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#2E5448',
    badgeOn: '#FFFFFF',
    quoteBorder: '#7A5C2E',
    label: '건강운',
    heroH1: { line1: '몸의 결과', line2: '오래 가는 흐름' },
    heroHint: '천천히 읽어보세요, 몸의 신호는 작은 데서 시작돼요',
  },
  study: {
    heroGrad: 'linear-gradient(135deg,#B57FA0 0%,#8C6D3D 55%,#7A5C2E 100%)',
    hanja: '學',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#4C2C44',
    badgeOn: '#FFFFFF',
    quoteBorder: '#7A5C2E',
    label: '학업운',
    heroH1: { line1: '집중이 흐르는', line2: '시간과 자리' },
    heroHint: '천천히 읽어보세요, 공부의 결은 리듬에서 나와요',
  },
  // 2026-05-28 — SSOT 10주제 chrome 확장. TOPIC_REGISTRY 색상 기반 (topics.ts) — 디자인 양극화 해소.
  reunion: {
    heroGrad: 'linear-gradient(135deg,#E0AC9C 0%,#8C6D3D 55%,#7A5C2E 100%)',
    hanja: '復',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#5E3326',
    badgeOn: '#FFFFFF',
    quoteBorder: '#7A5C2E',
    label: '재회운',
    heroH1: { line1: '헤어진 사람과의', line2: '회복 가능성' },
    heroHint: '천천히 읽어보세요, 끝난 결도 다시 흐를 수 있어요',
  },
  marriage: {
    heroGrad: 'linear-gradient(135deg,#D5A0B0 0%,#8C6D3D 55%,#7A5C2E 100%)',
    hanja: '婚',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#56263A',
    badgeOn: '#FFFFFF',
    quoteBorder: '#7A5C2E',
    label: '결혼운',
    heroH1: { line1: '인연이 닿는 시기와', line2: '배우자의 결' },
    heroHint: '천천히 읽어보세요, 평생 함께할 결을 살펴봐요',
  },
  exam: {
    heroGrad: 'linear-gradient(135deg,#8B9CC9 0%,#8C6D3D 55%,#7A5C2E 100%)',
    hanja: '進',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#22315C',
    badgeOn: '#FFFFFF',
    quoteBorder: '#7A5C2E',
    label: '합격 이직운',
    heroH1: { line1: '시험과 이직이', line2: '풀리는 시기' },
    heroHint: '천천히 읽어보세요, 도약의 결은 미리 와요',
  },
  business: {
    heroGrad: 'linear-gradient(135deg,#C49B5C 0%,#A37A2E 55%,#7A5820 100%)',
    hanja: '業',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#3F2D10',
    badgeOn: '#FFFFFF',
    quoteBorder: '#7A5820',
    label: '사업운',
    heroH1: { line1: '창업과 자영업', line2: '흐름과 시기' },
    heroHint: '천천히 읽어보세요, 사업의 결은 타이밍에서 갈려요',
  },
  move: {
    heroGrad: 'linear-gradient(135deg,#7AA5A6 0%,#8C6D3D 55%,#7A5C2E 100%)',
    hanja: '移',
    accent: '#8C6D3D',
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    hint: '#1C3D3E',
    badgeOn: '#FFFFFF',
    quoteBorder: '#7A5C2E',
    label: '이사 이동운',
    heroH1: { line1: '이사 이동의', line2: '길흉과 방향' },
    heroHint: '천천히 읽어보세요, 이동의 결은 방향에서 시작돼요',
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
  personName,
  bottomHint,
}: {
  theme: TopicChromeTheme;
  /** 예: "기토(己土)" */
  ilganLabel?: string;
  /** 예: "양력 1995년 7월 12일 · 진시" */
  birthLabel?: string;
  tierLabel?: string;
  /** 우상단 신살 표기 (옵션) — 예: "桃花 · 도화" */
  sinsalLabel?: string;
  /** 2026-05-28 PM — DailyMockupView 통일: 사람 이름 chip (예: "이혜지 님") */
  personName?: string;
  /** 2026-05-28 PM — 헤더 카드 하단 info pill (예: "주말에 보고 가세요 · 한 주의 흐름을 짚어보세요") */
  bottomHint?: string;
}) {
  // 2026-05-28 PM — DailyMockupView SSOT 통일: 토픽-컬러 그라데이션 (다크 네이비 폐기).
  //   준기 결정: "Daily 디자인+포맷이 전체 앱에 더 잘 맞아". heroGrad 는 각 토픽 컬러로 정의됨 (TOPIC_CHROME §59-179).
  //   예: 재물 #B8965A 골드, 연애 #8C6D3D 핑크, 건강 #8C6D3D 그린.
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 22px 30px',
        color: '#FFFFFF',
        // 2026-10-10 v9 — 주제별 색 그라데이션 → 먹 + 그림 (전 콘텐츠 같은 머리)
        background: INK_HERO_BG,
      }}
    >
      {/* 한자 워터마크 — 2026-10-10 v9 제거 */}
      <span
        aria-hidden
        style={{
          display: 'none',
          position: 'absolute',
          right: -20,
          bottom: -50,
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 240,
          fontWeight: 900,
          color: '#FFFFFF',
          opacity: 0.12,
          lineHeight: 1,
          pointerEvents: 'none',
          letterSpacing: '-0.05em',
        }}
      >
        {theme.hanja}
      </span>
      {/* badge row — 골드 톤 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          fontSize: 13,
          flexWrap: 'wrap',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {/* 2026-05-28 PM — Daily 패턴: 흰 배경 chip + 토픽 컬러 텍스트 (역상). 가독성 우선. */}
        <span
          style={{
            background: 'rgba(255,255,255,0.95)',
            padding: '4px 12px',
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 700,
            color: theme.accentDark,
            letterSpacing: '0.02em',
          }}
        >
          {theme.label}
        </span>
        {personName && (
          <span
            style={{
              background: 'rgba(255,255,255,0.20)',
              border: '1px solid rgba(255,255,255,0.25)',
              padding: '4px 10px',
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              color: '#FFFFFF',
            }}
          >
            {personName}
          </span>
        )}
        <span
          style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '4px 10px',
            borderRadius: 100,
            fontSize: 12,
            color: '#FFFFFF',
            opacity: 0.92,
          }}
        >
          {tierLabel}
        </span>
        {sinsalLabel && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 13,
              opacity: 0.7,
              fontFamily: "'Noto Serif KR', serif",
              color: theme.accent,
            }}
          >
            {sinsalLabel}
          </span>
        )}
      </div>
      {/* H1 — Daily 패턴: 흰색 굵은 serif */}
      <h1
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 26,
          fontWeight: 700,
          marginTop: 16,
          letterSpacing: '-0.02em',
          lineHeight: 1.4,
          position: 'relative',
          color: '#FFFFFF',
        }}
      >
        {theme.heroH1.line1}
        <br />
        {theme.heroH1.line2}
      </h1>
      {(ilganLabel || birthLabel) && (
        <div
          style={{
            fontSize: 13.5,
            opacity: 0.92,
            marginTop: 6,
            position: 'relative',
            fontFeatureSettings: '"tnum"',
            color: '#FFFFFF',
          }}
        >
          {ilganLabel}
          {ilganLabel && birthLabel ? ', ' : ''}
          {birthLabel}
        </div>
      )}
      {/* 2026-05-28 PM — DailyMockupView 패턴 통일: 하단 info pill. 토픽 페이지 호흡 가이드 */}
      {bottomHint && (
        <div
          style={{
            marginTop: 14,
            background: 'rgba(0,0,0,0.18)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 100,
            padding: '7px 14px',
            fontSize: 13,
            color: '#FFFFFF',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            position: 'relative',
            opacity: 0.98,
          }}
        >
          <span aria-hidden style={{ fontSize: 11, opacity: 0.9 }}>◉</span>
          {bottomHint}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 2. TopicScoreCard — conic-gradient ring + 점수 + 한 줄 결론
 * ═════════════════════════════════════════════════════════════════ */
/**
 * 2026-05-28 PM v4 — 점수 UX 부드럽게 (user: "점수 낮으면 기분 나빠함, 그래도 점수는 받고 싶어함").
 *  · 5-band (주의/보통/안정/상승/좋음) → 3-band (보강기/안정기/상승기) — 부정적 단어 박멸
 *  · 점수 아래 disclaimer: "사주의 한 면 · 인생 전체의 값이 아니에요"
 *  · 50 이하 점수일 때 안심 메시지 ("약점을 알면 보완할 수 있어요")
 *  · 점수 자체는 유지 (사람은 점수를 받고 싶어함)
 */

// 점수 구간 → 토픽-구체 rich phrase. "주의" 같은 부정 단어 박멸 → "보강 구간" 같이 발전 가능성 강조.
function getRichScoreLabel(theme: TopicChromeTheme, score: number): { grade: string; phrase: string; band: string; reassurance?: string } {
  const topicLabel = theme.label.replace('운', '');
  if (score >= 85) return {
    grade: '상승기',
    phrase: `${topicLabel} 기운이 또렷하게 살아나는 시기예요`,
    band: '상승기',
  };
  if (score >= 70) return {
    grade: '안정기',
    phrase: `${topicLabel} 흐름이 부드럽게 받쳐주는 시기예요`,
    band: '안정기',
  };
  if (score >= 55) return {
    grade: '안정기',
    phrase: `${topicLabel} 흐름이 잔잔하게 유지되는 시기예요`,
    band: '안정기',
  };
  if (score >= 40) return {
    grade: '보강기',
    phrase: `${topicLabel} 결을 조금 보강하면 흐름이 살아나요`,
    band: '보강기',
    reassurance: '약점을 알면 보완할 수 있어요. 아래에서 방법을 살펴보세요.',
  };
  return {
    grade: '보강기',
    phrase: `${topicLabel} 결이 잠시 약해진 시기예요`,
    band: '보강기',
    reassurance: '점수가 인생 전체를 말하지 않아요. 보강 포인트만 짚어도 흐름은 바뀌어요.',
  };
}

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
  /** 예: "인연이 잔잔히 들어오는 자리" — AI 가 보낸 두괄식 결론. body 우선 사용, 없으면 자동 phrase */
  body: string;
  /** 보조 설명 (사주 근거) */
  note?: string;
}) {
  const pct = Math.max(0, Math.min(100, score));
  // body 가 "길 · 좋은 기운의 흐름" generic 인지 체크 → generic 이면 rich phrase 로 대체
  const isGeneric = /^(길|평|주의|흉)\s*[·,]\s*(좋은|무난한|흔들리는|큰)/.test(body);
  const rich = getRichScoreLabel(theme, pct);
  const headline = isGeneric || !body ? rich.phrase : body.replace(/^(길|평|주의|흉)\s*[·,]\s*/, '').trim();

  return (
    <div
      style={{
        margin: '10px 20px 0',
        background: '#F8F5EE',
        borderRadius: 14,
        padding: '16px 16px 14px',
        border: '1px solid #E5DFD0',
      }}
    >
      {/* 1행 — 라벨 + 큰 점수 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: theme.accentDark, letterSpacing: '0.08em', fontWeight: 700 }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 32,
              fontWeight: 800,
              color: theme.accentDark,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {pct}
          </span>
          <span style={{ fontSize: 13.5, color: theme.hint, fontWeight: 600 }}>/ 100</span>
          <span
            style={{
              marginLeft: 6,
              fontSize: 13,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 100,
              background: `${theme.accent}24`,
              color: theme.accentDark,
              letterSpacing: '0.02em',
            }}
          >
            {rich.grade}
          </span>
        </div>
      </div>

      {/* 2행 — gradient bar with marker */}
      <div style={{ position: 'relative', height: 8, borderRadius: 100, background: '#E5DFD0', overflow: 'visible', marginBottom: 8 }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${pct}%`,
            borderRadius: 100,
            background: `linear-gradient(90deg, ${theme.accent} 0%, ${theme.accentDark} 100%)`,
            transition: 'width 0.6s ease',
          }}
        />
        {/* marker dot at current score */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${pct}%`,
            transform: 'translate(-50%, -50%)',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#FFFFFF',
            border: `3px solid ${theme.accentDark}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }}
        />
      </div>

      {/* 3행 — scale labels 3-band (보강기/안정기/상승기) — 부정 단어 박멸 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.hint, fontWeight: 600, marginBottom: 12, paddingLeft: 2, paddingRight: 2 }}>
        <span>보강기</span>
        <span style={{ marginLeft: '15%' }}>안정기</span>
        <span>상승기</span>
      </div>

      {/* 4행 — 토픽-구체 한 줄 (generic 박멸) */}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.5, wordBreak: 'keep-all' }}>
        {headline}
      </div>

      {/* 5행 — 안심 메시지 (40 이하 점수 시만) */}
      {rich.reassurance && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: 'rgba(184,150,90,0.08)',
          borderRadius: 10,
          borderLeft: `3px solid ${theme.accent}`,
          fontSize: 13,
          color: '#3D3427',
          lineHeight: 1.5,
        }}>
          {rich.reassurance}
        </div>
      )}

      {/* 6행 — disclaimer (작은 글, 항상 노출) */}
      <div style={{
        marginTop: 8,
        fontSize: 13,
        color: theme.hint,
        lineHeight: 1.5,
        opacity: 0.85,
        fontStyle: 'italic',
      }}>
        * 점수는 사주의 한 면을 본 것 — 인생 전체의 값이 아니에요
      </div>

      {note && (
        <div style={{ fontSize: 13, color: theme.hint, marginTop: 4, lineHeight: 1.55 }}>
          {note}
        </div>
      )}
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
        background: `linear-gradient(135deg, ${theme.accentSoft}, rgba(78,122,87,0.04))`,
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
          fontSize: 13,
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
                  fontSize: 13.5,
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
          fontSize: 13.5,
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
      ? '#4E7A57'
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
        fontSize: variant === 'score' ? 13 : 13.5,
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
  collapsible = false,
  defaultOpen = false,
  isLoading = false,
}: {
  theme: TopicChromeTheme;
  /** 예: "SECTION 01" */
  num: string;
  title: string;
  /** 우측 한자 (·一語 · ·三月 등) */
  hanjaSuffix?: string;
  sub?: string;
  children: ReactNode;
  /** true = 헤더 클릭으로 접기/펼치기 (긴 주제 분석 가독성) */
  collapsible?: boolean;
  /** collapsible 일 때 초기 펼침 여부 (기본 접힘) */
  defaultOpen?: boolean;
  /** 2026-05-28 — true 일 때 body 위치에 shimmer skeleton 표시 (sections heading 은 즉시 노출) */
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = !collapsible || open;
  // 2026-05-28 — 펼칠 때마다 짧은 skeleton 표시. user 피드백: "접히기 되어있는걸 폈을때 스켈레톤이 돌아가야지"
  const [openingSkeleton, setOpeningSkeleton] = useState(false);
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // 닫혀있다가 펼쳐짐 → 600ms skeleton
      setOpeningSkeleton(true);
      const t = setTimeout(() => setOpeningSkeleton(false), 600);
      prevOpenRef.current = open;
      return () => clearTimeout(t);
    }
    prevOpenRef.current = open;
  }, [open]);
  const showSkeleton = isLoading || openingSkeleton;

  const header = (
    <>
      <span
        style={{
          display: 'inline-block',
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 17,
          fontWeight: 900,
          color: '#A23A2A',
          letterSpacing: 0,
          marginBottom: 4,
        }}
      >
        {num}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 19,
          fontWeight: 700,
          color: '#1A1A1A',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>
          {title}
          {hanjaSuffix && (
            <span
              style={{
                color: '#6F6557',
                fontWeight: 500,
                marginLeft: 6,
                fontSize: 13.5,
              }}
            >
              {hanjaSuffix}
            </span>
          )}
        </span>
        {collapsible && (
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              fontSize: 13,
              color: theme.accentDark,
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          >
            ▾
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
            textAlign: 'left',
          }}
        >
          {sub}
        </div>
      )}
    </>
  );

  return (
    <div style={{ marginTop: 28 }}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{
            display: 'block',
            width: '100%',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          {header}
        </button>
      ) : (
        header
      )}
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {showSkeleton ? (
            // 2026-05-28 — body skeleton (shimmer). sections heading 은 즉시 노출, 펼칠 때마다 600ms shimmer 후 본문 교체.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="topic-skel-line" style={{ width: '92%' }} />
              <div className="topic-skel-line" style={{ width: '78%' }} />
              <div className="topic-skel-line" style={{ width: '88%' }} />
              <div className="topic-skel-line" style={{ width: '65%' }} />
              <style>{`
                @keyframes topic-skel-shimmer {
                  0% { background-position: -200% 0; }
                  100% { background-position: 200% 0; }
                }
                .topic-skel-line {
                  height: 12px;
                  border-radius: 6px;
                  background: linear-gradient(90deg, rgba(184,150,90,0.08) 0%, rgba(184,150,90,0.18) 50%, rgba(184,150,90,0.08) 100%);
                  background-size: 200% 100%;
                  animation: topic-skel-shimmer 1.4s ease-in-out infinite;
                }
              `}</style>
            </div>
          ) : (
            children
          )}
        </div>
      )}
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
        aria-label={`${primaryLabel} ${subLabel ? ', ' + subLabel : ''}`}
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
 * 6.5 TopicConclusionDark — 다크 결론박스 (audit 4 P1 D2 신규)
 *  · 종합사주 PremiumResult 의 다크 결론박스 시각 시그니처를 5 주제 결과에도 적용
 *  · 흰 텍스트 + 한자 워터마크 + 좌측 6px accent border
 *  · UpsellCard 와 시각 분리: 결론박스 = 좌측 border / UpsellCard = 우측 → CTA 화살표
 * ═════════════════════════════════════════════════════════════════ */
export function TopicConclusionDark({
  theme,
  conclusion,
  sajuRef,
}: {
  theme: TopicChromeTheme;
  conclusion: string;
  sajuRef?: string;
}) {
  // 2026-05-07 — 종합사주(/result) 톤앤매너 통일: paper 베이스 + 검정 글자 + 골드 액센트
  // 이전: 검정 + 분홍 그라데이션 + 흰 글자 (가독성 ↓ + 톤 X)
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #FFFEF8 0%, #FAF6EC 100%)',
        borderRadius: 14,
        padding: '22px 22px 24px',
        margin: '14px 0 18px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(184,150,90,0.10)',
        borderWidth: '1px 1px 1px 5px',
        borderStyle: 'solid',
        borderColor: `rgba(184,150,90,0.18) rgba(184,150,90,0.18) rgba(184,150,90,0.18) ${theme.accent}`,
      }}
    >
      {/* 한자 워터마크 — 우하단 큰 글자 (paper 톤이라 alpha 낮춤) */}
      <span
        aria-hidden
        style={{
          display: 'none', // 2026-10-10 v9 — 큰 한자 워터마크 제거
          position: 'absolute',
          right: -12,
          bottom: -36,
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 200,
          fontWeight: 900,
          color: theme.accent,
          opacity: 0.06,
          lineHeight: 1,
          pointerEvents: 'none',
          letterSpacing: '-0.05em',
        }}
      >
        {theme.hanja}
      </span>
      {/* 라벨 */}
      <div
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 13,
          fontWeight: 700,
          color: '#8C6D3D',
          letterSpacing: '0.14em',
          marginBottom: 10,
          position: 'relative',
        }}
      >
        ◇ 한 줄 결론
      </div>
      {/* 본문 — 검정 글자, 큰 폰트 */}
      <p
        style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 17,
          fontWeight: 700,
          color: '#1A1A1A',
          lineHeight: 1.65,
          margin: 0,
          position: 'relative',
          wordBreak: 'keep-all',
          letterSpacing: '-0.01em',
        }}
        dangerouslySetInnerHTML={{ __html: conclusion }}
      />
      {/* 사주 근거 (있을 때만) — 골드 톤 회색 */}
      {sajuRef && (
        <p
          style={{
            fontSize: 13.5,
            color: '#5C4220',
            lineHeight: 1.6,
            margin: '12px 0 0',
            position: 'relative',
            wordBreak: 'keep-all',
            paddingTop: 10,
            borderTop: '1px solid rgba(184,150,90,0.18)',
          }}
        >
          — {sajuRef}
        </p>
      )}
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
                fontSize: 13.5,
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
          display: 'none', // 2026-10-10 v9 — 큰 한자 워터마크 제거
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
          fontSize: 13,
          color: '#E8C5CB',
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
          background: 'linear-gradient(135deg, #E8C5CB, #7A5C2E)',
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
            fontSize: 13,
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
        fontSize: 13,
        color: theme.hint,
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: '#1A1A1A', fontWeight: 600 }}>풀이 근거</strong>, {citation}
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
  /** 천간 음양·오행 텍스트 — 예: "갑 / 양목" (종합사주 yum SSOT) */
  ganYum?: string;
  /** 지지 음양·오행 텍스트 — 예: "인 / 양목" */
  jiYum?: string;
  /** 천간 십성 — 예: "인성" / "일간" / "관성" (종합사주 sip-tag SSOT) */
  ganSip?: string;
  /** 십성 — 예: "겁재" / "일간" / "편재" / "편관" */
  ten?: string;
  /** ilju 강조 (일주만) */
  ilju?: boolean;
  /** 핵심 신살 자리 (mockup의 .key — 桃花 dot 등) */
  key?: boolean;
}

// 2026-05-28 — 종합사주(PremiumResult wongug-cell) SSOT 정렬 — 오행 박스 컬러 매핑
//   천간/지지 글자를 컬러 박스 안에 흰 글씨로 (금만 흰 배경 + 검은 글씨)
const OHENG_BOX: Record<string, { bg: string; color: string; border: string }> = {
  목: { bg: '#4E7A57', color: '#fff', border: '#1B5E2C' },
  화: { bg: '#B04A38', color: '#fff', border: '#9B1B1B' },
  토: { bg: '#B07F38', color: '#fff', border: '#C9A030' },
  금: { bg: '#FFFFFF', color: '#1A1A1A', border: '#9C9C9C' },
  수: { bg: '#1A1A1A', color: '#fff', border: '#3D3D3D' },
};

// 2026-05-28 PM — DailyMockupView 패턴 통일: 친근 hangul 별칭. 10간 12지 SSOT.
//   user 결정: "Daily 디자인+포맷이 전체 앱에 더 잘 맞아". 학술 라벨(갑/양목) 은 c.ganYum 으로 작게 보존.
//   "큰나무·대양·보석" 같은 친근 noun 으로 60대 가독 + 따뜻한 톤.
const GAN_FRIENDLY: Record<string, string> = {
  甲: '큰나무', 갑: '큰나무',
  乙: '풀꽃', 을: '풀꽃',
  丙: '대양', 병: '대양',
  丁: '촛불', 정: '촛불',
  戊: '큰산', 무: '큰산',
  己: '옥토', 기: '옥토',
  庚: '도끼', 경: '도끼',
  辛: '보석', 신: '보석',
  壬: '바다', 임: '바다',
  癸: '이슬', 계: '이슬',
};
const JI_FRIENDLY: Record<string, string> = {
  子: '쥐', 자: '쥐',
  丑: '소', 축: '소',
  寅: '호랑이', 인: '호랑이',
  卯: '토끼', 묘: '토끼',
  辰: '용', 진: '용',
  巳: '뱀', 사: '뱀',
  午: '말', 오: '말',
  未: '양', 미: '양',
  申: '원숭이', 신_ji: '원숭이',
  酉: '닭', 유: '닭',
  戌: '개', 술: '개',
  亥: '돼지', 해: '돼지',
};
// 신 (申, 원숭이) 와 신 (辛, 보석) 동음이의 — hanja 우선 매핑. hangul-only 입력 시 ji_FRIENDLY 의 '신' 은 천간 매핑으로 가서 falsy 반환 → 그때만 jiYum 보고 추정.
function ganFriendly(gan: string | undefined): string | undefined {
  if (!gan) return undefined;
  return GAN_FRIENDLY[gan];
}
function jiFriendly(ji: string | undefined): string | undefined {
  if (!ji) return undefined;
  // hanja 매핑 우선
  if (JI_FRIENDLY[ji]) return JI_FRIENDLY[ji];
  // hangul-only 인 경우 '신' 이면 '원숭이' (지지)
  if (ji === '신') return '원숭이';
  return undefined;
}

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
          fontSize: 12,
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
        {/* 2026-05-28 — 종합사주(PremiumResult wongug-cell) SSOT 디자인 적용.
            천간/지지 글자를 오행 컬러 박스 안에 흰 글씨로 (금만 흰 배경 + 검은 글씨).
            일주 셀: 골드 외곽 + 그라데이션 배경 + "일간" 라벨. */}
        {cells.map((c, i) => {
          const ganBox = c.ganOheng ? OHENG_BOX[c.ganOheng] : { bg: '#F8F5EE', color: '#1A1A1A', border: '#E5DFD0' };
          const jiBox = c.jiOheng ? OHENG_BOX[c.jiOheng] : { bg: '#F8F5EE', color: '#1A1A1A', border: '#E5DFD0' };
          return (
            <div
              key={i}
              style={{
                background: c.ilju
                  ? 'linear-gradient(180deg, rgba(184,150,90,0.18) 0%, rgba(184,150,90,0.08) 100%)'
                  : '#fff',
                borderRadius: 10,
                padding: '10px 4px 8px',
                border: c.ilju
                  ? '2px solid #B8965A'
                  : '1.5px solid #E5DFD0',
                position: 'relative',
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
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
              {/* 시/일/월/년 col-header */}
              <div style={{ fontSize: 12, color: '#B8965A', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>
                {c.label}
              </div>
              {/* 십성 sip-tag (인성/관성/재성/일간 등) — 종합사주 SSOT */}
              {c.ganSip && (
                <div style={{ fontSize: 12, color: c.ilju ? '#8C6D3D' : theme.accentDark, fontWeight: 600, marginBottom: 4, letterSpacing: '0.02em' }}>
                  {c.ganSip}
                </div>
              )}
              {/* 천간 오행 박스 */}
              <div
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 18,
                  fontWeight: 800,
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: ganBox.bg,
                  color: ganBox.color,
                  border: `1.5px solid ${ganBox.border}`,
                  textShadow: ganBox.color === '#fff' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {c.gan}
              </div>
              {/* 2026-05-28 PM — Daily 친근 hangul (큰나무/대양/보석) + 작은 학술 (갑/양목) 하이브리드 */}
              {ganFriendly(c.gan) && (
                <div style={{ fontSize: 13.5, color: '#1A1A1A', marginTop: 4, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {ganFriendly(c.gan)}
                </div>
              )}
              {c.ganYum && (
                <div style={{ fontSize: 12, color: '#9C9C9C', marginTop: 1, fontWeight: 500 }}>
                  {c.ganYum}
                </div>
              )}
              {/* 지지 오행 박스 */}
              <div
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 16,
                  fontWeight: 700,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: jiBox.bg,
                  color: jiBox.color,
                  border: `1.5px solid ${jiBox.border}`,
                  textShadow: jiBox.color === '#fff' ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {c.ji}
              </div>
              {/* 2026-05-28 PM — Daily 친근 hangul (말/쥐/소) + 작은 학술 (오/양화) 하이브리드 */}
              {jiFriendly(c.ji) && (
                <div style={{ fontSize: 13.5, color: '#1A1A1A', marginTop: 4, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {jiFriendly(c.ji)}
                </div>
              )}
              {c.jiYum && (
                <div style={{ fontSize: 12, color: '#9C9C9C', marginTop: 1, fontWeight: 500 }}>
                  {c.jiYum}
                </div>
              )}
              {/* 일주 라벨 또는 십성 (ganSip 없는 경우 fallback) */}
              {c.ilju && !c.ganSip ? (
                <div style={{ fontSize: 12, color: '#8C6D3D', marginTop: 4, fontWeight: 700 }}>
                  일간
                </div>
              ) : c.ten && !c.ganSip ? (
                <div style={{ fontSize: 12, color: theme.accentDark, marginTop: 4, fontWeight: 600 }}>
                  {c.ten}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 11. TopicOhengBalance — 5-badge oheng + 토픽 핵심 오행 augment
 *   DailyMockupView "내 사주 오행 + 오늘의 보충" 패턴 통일 (2026-05-28 PM).
 *   Daily=오늘 일진 +1 / Topic=주제 핵심 오행 강조 (예: 재물=재성, 연애=배우자성)
 * ═════════════════════════════════════════════════════════════════ */

// 토픽별 핵심 오행 키 매핑 (참고용 — UX 카피로만 노출, 점수는 사주 본래 카운트)
const TOPIC_KEY_OHENG_LABEL: Record<TopicChromeKey, string> = {
  love:      '재성과 관성',     // 배우자성
  wealth:    '재성',          // 정재·편재
  career:    '관성',          // 정관·편관
  health:    '인성',          // 정인·편인
  study:     '인성과 식상',     // 인성+식상관
  reunion:   '재성과 관성',
  marriage:  '재성과 관성',
  exam:      '관성과 인성',
  business:  '재성과 식상',
  move:      '관성과 재성',
};

// 오행 컬러 (badge inner) — 종합사주 SSOT
const OHENG_BADGE: Record<string, { color: string; bg: string }> = {
  목: { color: '#4E7A57', bg: 'rgba(78,122,87,0.10)' },
  화: { color: '#B04A38', bg: 'rgba(176,74,56,0.10)' },
  토: { color: '#B07F38', bg: 'rgba(176,127,56,0.12)' },
  금: { color: '#7A6A52', bg: 'rgba(156,156,156,0.14)' },
  수: { color: '#1A1A1A', bg: 'rgba(26,26,26,0.08)' },
};
const OHENG_HANJA: Record<string, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
const OHENG_ORDER = ['목', '화', '토', '금', '수'] as const;

export function TopicOhengBalance({
  theme,
  topicKey,
  counts,
  augmentNote,
}: {
  theme: TopicChromeTheme;
  topicKey: TopicChromeKey;
  /** 오행 카운트 {목:1,화:3,토:1,금:2,수:1} — TopicAnalysisPage 에서 derive */
  counts: Record<'목' | '화' | '토' | '금' | '수', number>;
  /** 보충 caption — 미지정 시 자동 생성 */
  augmentNote?: string;
}) {
  const total = OHENG_ORDER.reduce((s, k) => s + (counts[k] ?? 0), 0);
  const dominant = OHENG_ORDER.reduce((max, k) => ((counts[k] ?? 0) > (counts[max] ?? 0) ? k : max), '화');
  const missing = OHENG_ORDER.filter((k) => (counts[k] ?? 0) === 0);
  const keyLabel = TOPIC_KEY_OHENG_LABEL[topicKey];
  const note =
    augmentNote ||
    (missing.length === 0
      ? `5기운 모두 갖춘 균형 사주, ${theme.label} 핵심은 ${keyLabel} 기운입니다.`
      : missing.length === 1
        ? `${OHENG_HANJA[missing[0]]}(${missing[0]}) 기운이 비어있어 ${theme.label} 핵심 ${keyLabel} 보강이 필요해요.`
        : `${missing.map((m) => OHENG_HANJA[m]).join(', ')} 기운이 부족 — ${theme.label} 분석은 ${OHENG_HANJA[dominant]}(${dominant}) 중심으로 풀려요.`);

  return (
    <div
      style={{
        margin: '14px 20px 0',
        background: '#F8F5EE',
        borderRadius: 14,
        padding: '14px 16px 16px',
        border: '1px solid #E5DFD0',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
        내 사주 오행 + {theme.label} 핵심
      </div>
      <div style={{ fontSize: 13, color: '#7A7269', marginBottom: 12 }}>
        사주 5기운 균형 + {theme.label} 분석 핵심 기운
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 6,
          marginTop: 10,
          marginBottom: 12,
        }}
      >
        {OHENG_ORDER.map((k) => {
          const count = counts[k] ?? 0;
          const isDominant = k === dominant;
          const isMissing = count === 0;
          const palette = OHENG_BADGE[k];
          return (
            <div
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '7px 0',
                background: palette.bg,
                border: `2px solid ${isDominant ? palette.color : 'transparent'}`,
                borderRadius: 100,
                opacity: isMissing ? 0.42 : 1,
                position: 'relative',
              }}
            >
              <span
                aria-hidden
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 15,
                  fontWeight: 800,
                  color: palette.color,
                  lineHeight: 1,
                }}
              >
                {OHENG_HANJA[k]}
              </span>
              <span
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1A1A1A',
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {count}
              </span>
              {isDominant && total > 0 && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    background: theme.accentDark,
                    padding: '1px 7px',
                    borderRadius: 100,
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  주력
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 13.5, color: '#1A1A1A', lineHeight: 1.55 }}>
        {note}
      </div>
    </div>
  );
}
