/**
 * DailyMockupView — 무료 오늘의 운세 v2 (mockup 진본 픽셀-퍼펙트 카피)
 *
 * 출처: docs/mockups/사주500_UI개편_목업_무료_오늘의운세_v2.html
 * 작성: 2026-05-06 (사용자 요청 — mockup 그대로 + legacy 삭제 + 회귀 방지)
 *
 * 정책:
 *  - mockup HTML 의 <style> 블록을 통째로 컴포넌트 내부에 inject (isolated CSS)
 *  - mockup <body> 의 모든 섹션을 JSX 로 1:1 변환
 *  - 동적 데이터 = AI v5 응답 + sajuData (props)
 *  - **legacy 코드 호출 금지** — 본 컴포넌트 외부에서 옛 카드 렌더 X
 */

import { useMemo, useState, useCallback, type ReactNode } from 'react';
import { hanjaNum } from '@/components/hanji/Hanji';
import type { SajuProfile } from '@/services/storage/localStore';
import type { OhengType } from '@/types/saju';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { STEM_INFO, BRANCH_INFO } from '@/utils/sajuStemBranch';
import { getTopicPrice, getWeeklyPrice, getMonthlyPrice, type PricingInfo } from '@/constants/pricing';
import type { TopicId } from '@/constants/topics';

/**
 * §07 4영역 → 실제 주제 묶음 (2026-09-17) — 카드 가격 표기 · DailyFortunePage 선택창 공용 SSOT.
 *   가격이 섞인 묶음은 실제 최저가 기준 "N운~" (예: 관계 = 결혼 1운 · 연애/재회 3운 → "1운~")
 */
export const DAILY_TOPIC_GROUPS: Record<'wealth' | 'love' | 'career' | 'health', readonly TopicId[]> = {
  wealth: ['wealth'],
  love: ['love', 'marriage', 'reunion'],
  career: ['career', 'exam', 'business', 'study'],
  health: ['health', 'move'],
};

function groupPriceLabel(key: keyof typeof DAILY_TOPIC_GROUPS): string {
  const prices = DAILY_TOPIC_GROUPS[key].map((id) => getTopicPrice(id).actualPrice);
  const min = Math.min(...prices);
  return prices.some((p) => p !== min) ? `${min}운~` : `${min}운`;
}

/** 주간·월간 가격 chip — 세일 중이면 "정가 → 실제" (Weekly/MonthlyPage 히어로 표기와 동일 기준) */
function extensionCostLabel(p: PricingInfo): string {
  return p.isOnSale && p.salePrice != null ? `${p.regularPrice}운 → ${p.actualPrice}운` : `${p.actualPrice}운`;
}

// HTML 안전 태그 (<strong>, <b>, <u> 등) 보존 + XSS 차단 (P0 fix 2026-05-06)
const safeHtml = (text: any): { __html: string } => ({ __html: sanitizeAiText(String(text ?? '')) });

/** 모든 HTML 태그 + markdown strip — plain text 자리에서 사용 (title, name 등) */
const stripAll = (text: any): string =>
  stripMd(String(text ?? '')).replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^<>]*>/g, '');

/**
 * 자동 강조 필터 — Haiku 가 강조 태그 안 넣어도 클라이언트가 주입 (2026-05-06 v3)
 * - 시간/방위/색/숫자에 <u> 자동 주입 (이미 <u> 있으면 skip)
 * - 마지막 1 문장에 <strong> 결론 주입 (이미 <strong> 있으면 skip)
 *
 * 안전망 — AI 출력 톤에 의존하지 않고 강조 보장.
 */
function autoEmphasize(input: string): string {
  if (!input) return input;
  let text = String(input);

  // 이미 <u> 가 있으면 추가 주입 skip
  const hasUnderline = /<u>/i.test(text);

  // 1) 시간 패턴 → <u>...</u> (정밀 패턴만, 1글자 한자 매칭 금지)
  if (!hasUnderline) {
    // "오후 2~5시", "오전 9~11시", "저녁 7시 이후" — 시간대 + 숫자 + 시
    text = text.replace(
      /(?<!<u>)(오전|오후|저녁|밤|새벽|아침)\s*\d+(?:\s*[~∼-]\s*\d+)?\s*시(?:\s*이후)?/g,
      '<u>$&</u>'
    );
    // "14~17시" 24h 표기
    text = text.replace(
      /(?<!<u>)(?<!\d)\d{1,2}\s*[~∼-]\s*\d{1,2}\s*시/g,
      '<u>$&</u>'
    );
    // 방위 — 명확한 방향 표현만 (1글자 매칭 금지)
    text = text.replace(
      /(?<!<u>)(동남쪽|동북쪽|서남쪽|서북쪽|동쪽|서쪽|남쪽|북쪽|동남방|동북방|서남방|서북방)/g,
      '<u>$1</u>'
    );
    // 색상 — 긴 단어를 먼저, 짧은 단어를 뒤로 (regex alternative 순서로 부분매칭 방지)
    text = text.replace(
      /(?<!<u>)(짙은 파란색|진한 파란색|연한 녹색|밝은 빨강|짙은 검은색|남보라|보라색|주황색|연두색|검은색|검정색|파란색|초록색|노란색|갈색|남색|회색|빨강|파랑|초록|노랑|검정|흰색|은색|금색)/g,
      '<u>$1</u>'
    );
  }

  // 문장 분할 (strong·em 공유)
  const splitSentences = (t: string) => t.split(/(?<=[다요네][.!?])\s+/);

  // 2) <em> 주의/경고 절 자동 주입 (2026-05-29 신규 · 최대 2회)
  //    분석 본문에서 "주의·조심·위험·충돌·긴장" 류 경고 절을 번트오렌지로 강조 → 결과 페이지 강약 부여.
  //    sanitizeAiText 가 class 속성을 strip 하므로 비어있던 <em> 태그를 경고 전용으로 repurpose.
  if (!/<em>/i.test(text)) {
    const cautionTrigger = /주의|조심|피하|삼가|위험|긴장|갈등|충돌|불안|악화|심화|예민|상처|마찰|소진|과부하|무리|경계/;
    const sentences = splitSentences(text);
    let emCount = 0;
    const emPhrases: string[] = [];
    for (const s of sentences) {
      if (emCount >= 2) break;
      if (!cautionTrigger.test(s)) continue;
      const clean = s.trim().replace(/[.!?]+$/, '');
      // 마지막 쉼표 이후 절을 우선 (없거나 트리거 없으면 짧은 전체 문장 fallback)
      const lastComma = clean.lastIndexOf(',');
      let seg = lastComma !== -1 ? clean.slice(lastComma + 1).trim() : clean;
      if (!cautionTrigger.test(seg) || seg.length < 8 || seg.length > 46) {
        if (clean.length >= 8 && clean.length <= 46 && cautionTrigger.test(clean)) {
          seg = clean;
        } else {
          continue;
        }
      }
      if (/[<>]/.test(seg)) continue; // 이미 태그 포함 절 skip (중첩 방지)
      emPhrases.push(seg);
      emCount++;
    }
    for (const p of emPhrases) {
      const idx = text.lastIndexOf(p);
      if (idx === -1) continue;
      const before = text.slice(Math.max(0, idx - 12), idx);
      if (/<(strong|u|em|b)>[^<]*$/.test(before)) continue;
      text = text.slice(0, idx) + `<em>${p}</em>` + text.slice(idx + p.length);
    }
  }

  // 3) <strong> 결론 절 자동 주입 (단락당 최대 2회, 2026-05-29 v5 — 분석 본문까지 확장)
  if (!/<strong>/i.test(text) && text.length >= 50) {
    const sentences = splitSentences(text);
    // 결론 패턴: 명사 엔딩 + 동사 명령형 + 종결형/서술 결론 (분석 본문 대응 확장)
    const conclusionEndings = [
      // 명사 + 종결: ~날입니다 / ~핵심 과제입니다 / ~신호예요
      '(?:날|시간|자리|결|순간|것|점|곳|쪽|무기|핵심|정답|답|이유|방법|시점|구간|기회|신호|중심|기준|기억|감각|선택|순서|과제|상태|경향|특징|의미|시기|부분|영역|타이밍|강점|장점)\\s*(?:이에요|예요|입니다|이다|네요)',
      // 동사 명령형
      '(?:하세요|미루세요|집중하세요|정리하세요|만나세요|배치하세요|챙기세요|준비하세요|확인하세요|시도하세요|체크하세요|넘기세요|놓치지 마세요|유지하세요|시작하세요|마무리하세요|머물러 보세요|꺼내세요|살펴보세요|믿으세요|들어보세요|찾으세요|보충하세요|모으세요|끌어당기세요)',
      // 종결형 + 서술 결론 (분석 본문)
      '(?:게 좋아요|필수예요|필요해요|중요해요|좋습니다|중요합니다|필요합니다|효율적입니다|적절합니다|좋은 자리예요|어울려요|솟아오릅니다|강화합니다|극대화됩니다|커집니다|높습니다|좋아집니다|수월합니다|핵심 과제입니다)',
    ];
    const conclusionPattern = new RegExp(`([가-힣\\sA-Za-z0-9·~()]{8,32}(?:${conclusionEndings.join('|')}))[.!?]?$`);

    let strongCount = 0;
    const maxStrong = 2;
    const replacements: Array<{ phrase: string }> = [];

    for (const sentence of sentences) {
      if (strongCount >= maxStrong) break;
      const clean = sentence.trim().replace(/[.!?]+$/, '');
      const lastCommaIdx = clean.lastIndexOf(',');
      const segment = lastCommaIdx !== -1 ? clean.slice(lastCommaIdx + 1).trim() : clean;
      if (/[<>]/.test(segment)) continue; // 이미 태그(em/u) 포함 절 skip
      const m = segment.match(conclusionPattern);
      if (m && m[1].length >= 8 && m[1].length <= 32) {
        replacements.push({ phrase: m[1].trim() });
        strongCount++;
      }
    }

    for (const r of replacements) {
      if (/[<>]/.test(r.phrase)) continue;
      const idx = text.lastIndexOf(r.phrase);
      if (idx === -1) continue;
      const before = text.slice(Math.max(0, idx - 12), idx);
      if (/<(strong|u|em|b)>[^<]*$/.test(before)) continue;
      text = text.slice(0, idx) + `<strong>${r.phrase}</strong>` + text.slice(idx + r.phrase.length);
    }
  }

  return text;
}

/** safeHtml + autoEmphasize 결합 — 모든 AI 본문 출력 통과 */
const safeHtmlEmph = (text: any): { __html: string } => ({
  __html: sanitizeAiText(autoEmphasize(String(text ?? ''))),
});

/** 시간대 컨텍스트 (2026-05-07) — 사용자가 운세를 보는 시각에 따라 톤 변경 */
function getTimeContext(): { slot: string; greeting: string; subtle: string } {
  const h = new Date().getHours();
  if (h < 6) return { slot: 'dawn', greeting: '늦은 새벽에 보고 계세요', subtle: '하루를 시작하기 전, 또는 하루를 마무리하는 자리에서.' };
  if (h < 12) return { slot: 'morning', greeting: '아침에 보고 계세요', subtle: '하루의 시작을 짚어보세요.' };
  if (h < 14) return { slot: 'noon', greeting: '점심 무렵에 보고 계세요', subtle: '오전을 정리하고 오후를 준비하는 자리.' };
  if (h < 18) return { slot: 'afternoon', greeting: '오후에 보고 계세요', subtle: '하루의 한가운데, 흐름을 점검하는 자리.' };
  if (h < 22) return { slot: 'evening', greeting: '저녁에 보고 계세요', subtle: '하루를 마무리하기 전, 한 호흡 멈춰보세요.' };
  return { slot: 'night', greeting: '늦은 밤에 보고 계세요', subtle: '오늘을 정리하고 내일을 준비하는 자리.' };
}

interface DailyMockupViewProps {
  result: any; // claudeFortune v5 응답
  profile: SajuProfile;
  dateLabel: string; // "2026년 5월 6일 화요일 · 병진일(丙辰)"
  todayGanzi: string;
  todayGanReading: string; // "병"
  todayOheng: OhengType; // "화"
  myGan: string; // "甲"
  myGanReading: string; // "갑"
  myOheng: OhengType; // "목"
  /** @deprecated 2026-05-07 — 내부에서 getOhengRelation() 으로 직접 계산. prop 호환만 유지. */
  relationLabel?: string;
  /** 주간운세 추천 카드 CTA (2026-09-17 복구 — 주간 5운·월간 7운 2026-06-29 출시) */
  onUpsell: () => void;
  /** 월별 운세 보조 링크 */
  onMonthly?: () => void;
  /** 헤더 태그 — 무료 1회 / 1운 추가 이용 (기본 '오늘 1회 무료') */
  priceTag?: string;
  /** 스트리밍 생성 중 — 데이터 없는 §07 은 이때만 스켈레톤, 끝나면 대체 표시 · 추천 카드는 끝난 뒤 노출 */
  isGenerating?: boolean;
  onShare: () => void;
  onChat: () => void;
  /** 2026-10-09 — 오늘 풀이에서 이어지는 주제·사주대화 질문 카드 (생성 끝난 뒤 §07 아래) */
  nextSteps?: ReactNode;
  /** §02 4영역 카드 클릭 — topicId: 'wealth'|'love'|'career'|'health' (2026-05-06 v6) */
  onTopicClick?: (topicId: 'wealth' | 'love' | 'career' | 'health') => void;
}

const MOCKUP_CSS = `
/* ═══ SajuCard 토큰 정식 동기화 (2026-05-06 v3) ═══
   src/pages/saju-card/_chrome.tsx 의 C·OHENG_THEME 와 100% 일치 */
.daily-mockup * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
.daily-mockup {
  font-family: 'Pretendard', sans-serif; color: #1A1612; letter-spacing: -0.01em; background: #F4EFE4;
  /* 2026-10-10 v9 한지 톤 — 먹·종이 (src/styles/hanji.css 와 같은 값 · 보조 글자 대비 5:1) */
  --c-paper: #F4EFE4;
  --c-surface: #FFFDF8;
  --c-ink: #1A1612;
  --c-ink-soft: #4B4238;
  --c-mute: #6F6557;
  --c-gold: #B8965A;
  --c-gold-deep: #8C6D3D;
  --c-gold-soft: rgba(184,150,90,0.10);
  --c-gold-line: rgba(184,150,90,0.40);
  --c-card-line: rgba(184,150,90,0.18);
  --c-line: #E1D7C4;
  /* 5 오행 정식 (SajuCard OHENG_THEME) */
  --c-mok: #2D8A4E; --c-hwa: #D32F2F; --c-to: #E8B82A; --c-geum: #4A4A4A; --c-su: #1565E0;
  --c-mok-soft: rgba(45,138,78,0.10); --c-hwa-soft: rgba(211,47,47,0.10);
  --c-to-soft: rgba(232,184,42,0.10); --c-geum-soft: rgba(74,74,74,0.10); --c-su-soft: rgba(21,101,224,0.10);
}
.daily-mockup .page { max-width: 480px; margin: 0 auto; background: var(--c-paper); }

/* Header */
.daily-mockup .hd {
  /* 2026-10-10 v9 — 붉은 그라데이션 + 큰 火 워터마크 → 먹 바탕 + 정선 「인왕제색도」 (공유마당 만료 저작물) */
  background: linear-gradient(180deg, rgba(26,22,18,.55) 0%, rgba(26,22,18,.82) 45%, #1A1612 100%), url('/art/inwang.webp') 30% 35% / cover no-repeat, #1A1612;
  color: #fff; padding: 18px 20px 28px; position: relative; overflow: hidden;
}
.daily-mockup .hd::before { display: none; content: '火'; position: absolute; right: -16px; bottom: -36px; font-family: 'Noto Serif KR', serif; font-size: 200px; font-weight: 900; color: rgba(255,255,255,.06); line-height: 1; }
.daily-mockup .hd .top { display: flex; align-items: center; gap: 10px; font-size: 12px; opacity: .9; flex-wrap: wrap; }
.daily-mockup .hd .badge { background: rgba(255,255,255,.18); padding: 3px 10px; border-radius: 100px; font-size: 11px; }
.daily-mockup .hd .free-tag { background: rgba(212,175,55,.25); color: #fff8e1; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; margin-left: auto; }
.daily-mockup .hd h1 { font-family: 'Noto Serif KR', serif; font-size: 26px; font-weight: 700; margin-top: 14px; letter-spacing: -0.02em; line-height: 1.35; }
.daily-mockup .hd .date { font-size: 12px; opacity: .8; margin-top: 4px; font-feature-settings: 'tnum'; }
.daily-mockup .hd .time-chip {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 12px;
  padding: 6px 12px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 100px;
  font-size: 11.5px;
  color: rgba(255,255,255,0.92);
  font-weight: 600;
}
.daily-mockup .hd .time-chip .ic { font-size: 13px; }
.daily-mockup .hd .time-chip .sub { font-size: 11px; opacity: 0.8; font-weight: 500; }

/* My Saju mini card — SajuCardPage 큰 색 블록 패턴 동기화 (2026-05-06 v4)
   _details_table.tsx 의 천간/지지 솔리드 컬러 블록 스타일 */
.daily-mockup .my-saju {
  margin: 16px 20px 0; background: var(--c-surface);
  border-radius: 14px; padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
  border: 1px solid var(--c-card-line);
}
.daily-mockup .my-saju .ttl { font-size: 11px; color: var(--c-gold); letter-spacing: 0.15em; font-weight: 700; margin-bottom: 12px; }
.daily-mockup .saju-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.daily-mockup .saju-cell {
  display: flex; flex-direction: column; gap: 4px;
  border-radius: 10px; padding: 6px 4px;
  background: var(--c-paper);
  border: 1px solid var(--c-card-line);
}
.daily-mockup .saju-cell.ilju {
  background: var(--c-gold-soft);
  border: 2px solid var(--c-gold);
  box-shadow: 0 2px 8px rgba(184,150,90,0.18);
  padding: 5px 3px;
}
.daily-mockup .saju-cell .lab {
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
  color: var(--c-mute); text-align: center; margin-bottom: 2px;
}
.daily-mockup .saju-cell.ilju .lab { color: var(--c-gold-deep); }
/* 천간/지지 큰 색 블록 + 읽기/상징 (SajuCardPage 스타일 · 2026-05-06 v5) */
.daily-mockup .saju-cell .gan,
.daily-mockup .saju-cell .ji {
  font-family: 'Noto Serif KR', serif;
  line-height: 1; text-align: center;
  border-radius: 8px;
  border: 1.5px solid transparent;
  color: #fff;
  padding: 8px 2px 6px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.daily-mockup .saju-cell .gan .han,
.daily-mockup .saju-cell .ji .han {
  font-size: 24px; font-weight: 800; line-height: 1;
}
.daily-mockup .saju-cell .ji .han { font-size: 20px; }
.daily-mockup .saju-cell .gan .read,
.daily-mockup .saju-cell .ji .read {
  font-size: 11px; font-weight: 700; opacity: 0.85;
  letter-spacing: 0.05em;
  font-family: 'Pretendard', sans-serif;
}
.daily-mockup .saju-cell .gan-meaning,
.daily-mockup .saju-cell .ji-meaning {
  font-size: 11px; color: var(--c-mute); font-weight: 600;
  text-align: center; line-height: 1.2;
  font-family: 'Pretendard', sans-serif;
}
.daily-mockup .saju-cell.ilju .gan-meaning,
.daily-mockup .saju-cell.ilju .ji-meaning { color: var(--c-gold-deep); }
/* 5 오행 솔리드 색 블록 */
.daily-mockup .gan.mok,  .daily-mockup .ji.mok   { background: var(--c-mok); border-color: var(--c-mok); }
.daily-mockup .gan.hwa,  .daily-mockup .ji.hwa   { background: var(--c-hwa); border-color: var(--c-hwa); }
.daily-mockup .gan.to,   .daily-mockup .ji.to    { background: var(--c-to); border-color: var(--c-to); color: #1A1A1A; }
.daily-mockup .gan.geum, .daily-mockup .ji.geum  { background: var(--c-surface); border-color: var(--c-card-line); color: var(--c-geum); }
.daily-mockup .gan.su,   .daily-mockup .ji.su    { background: #1A1A1A; border-color: #1A1A1A; }
.daily-mockup .saju-cell.ilju .gan,
.daily-mockup .saju-cell.ilju .ji { box-shadow: 0 2px 4px rgba(0,0,0,0.10); }

/* Relation card — SajuCard 큰 색 블록 + 일상어 풀이 (2026-05-06 v4) */
.daily-mockup .relation-card { margin: 12px 20px 0; background: var(--c-surface); border-radius: 14px; padding: 16px 14px; border: 1px solid var(--c-card-line); }
.daily-mockup .relation-card .ttl { font-size: 11px; color: var(--c-gold); letter-spacing: 0.15em; font-weight: 700; margin-bottom: 14px; }
.daily-mockup .rel-flex { display: grid; grid-template-columns: 1fr 60px 1fr; gap: 8px; align-items: stretch; }
.daily-mockup .rel-stem-card {
  background: var(--c-surface);
  border-radius: 12px;
  border: 1px solid var(--c-card-line);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.daily-mockup .rel-stem-card.me {
  border: 2px solid var(--c-gold);
  box-shadow: 0 2px 8px rgba(184,150,90,0.18);
}
/* 상단 라벨 영역 */
.daily-mockup .rel-stem-card .lb {
  font-size: 11px; color: var(--c-mute);
  font-weight: 700; letter-spacing: 0.08em;
  text-align: center; padding: 8px 6px 6px;
  background: var(--c-paper);
}
.daily-mockup .rel-stem-card.me .lb { background: var(--c-gold-soft); color: var(--c-gold-deep); }
/* 천간 큰 색 블록 (사주카드 패턴) */
.daily-mockup .rel-stem-card .gan-block {
  font-family: 'Noto Serif KR', serif;
  font-size: 48px; font-weight: 800;
  line-height: 1; padding: 16px 6px 14px;
  text-align: center;
  color: #fff;
}
.daily-mockup .rel-stem-card .gan-block.mok  { background: var(--c-mok); }
.daily-mockup .rel-stem-card .gan-block.hwa  { background: var(--c-hwa); }
.daily-mockup .rel-stem-card .gan-block.to   { background: var(--c-to); color: var(--c-ink); }
.daily-mockup .rel-stem-card .gan-block.geum { background: var(--c-geum); }
.daily-mockup .rel-stem-card .gan-block.su   { background: #1A1A1A; }
/* 하단 풀이 영역 */
.daily-mockup .rel-stem-card .gan-info {
  padding: 10px 8px 12px;
  text-align: center;
  background: var(--c-surface);
}
.daily-mockup .rel-stem-card.me .gan-info { background: var(--c-gold-soft); }
.daily-mockup .rel-stem-card .gan-read {
  font-size: 13px; font-weight: 700; color: var(--c-ink);
  margin-bottom: 2px;
}
.daily-mockup .rel-stem-card .gan-yy {
  font-size: 11px; color: var(--c-mute); font-weight: 600;
  margin-bottom: 6px;
}
.daily-mockup .rel-stem-card .gan-brief {
  font-size: 11px; color: var(--c-ink-soft);
  line-height: 1.5; word-break: keep-all;
}
/* 화살표 + 카테고리 chip */
.daily-mockup .rel-arrow {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 6px;
}
.daily-mockup .rel-arrow svg { width: 40px; height: 14px; }
.daily-mockup .rel-arrow .label {
  font-size: 11px; font-weight: 700;
  color: #fff; background: var(--c-gold);
  padding: 4px 8px; border-radius: 100px;
  white-space: nowrap; letter-spacing: 0.02em;
  text-align: center; line-height: 1.3;
  word-break: keep-all;
}
/* 풀이 영역 — meaning + 좋은점/조심할점 (2026-05-28 — 좌측 골드 strip 제거. AI 손톱 디자인 회피) */
.daily-mockup .rel-explain {
  margin-top: 14px; padding: 14px 16px;
  background: var(--c-paper); border-radius: 10px;
  border: 1px solid var(--c-card-line);
  font-size: 13px; color: var(--c-ink-soft); line-height: 1.75;
}
.daily-mockup .rel-explain .meaning {
  color: var(--c-ink); font-weight: 500;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--c-card-line);
}
.daily-mockup .rel-explain .pros, .daily-mockup .rel-explain .cons {
  margin-top: 8px; display: flex; gap: 8px; align-items: flex-start;
}
.daily-mockup .rel-explain .tag {
  font-size: 11px; font-weight: 700;
  padding: 3px 10px; border-radius: 100px;
  flex-shrink: 0; line-height: 1.4;
}
.daily-mockup .rel-explain .pros .tag {
  background: var(--c-mok-soft); color: var(--c-mok);
  border: 1px solid var(--c-mok);
}
.daily-mockup .rel-explain .cons .tag {
  background: var(--c-hwa-soft); color: var(--c-hwa);
  border: 1px solid var(--c-hwa);
}
.daily-mockup .rel-explain .txt { flex: 1; color: var(--c-ink-soft); }
.daily-mockup .rel-explain strong { color: var(--c-ink); font-weight: 700; }

/* Oheng row — SajuCardPage 만세력 chip 패턴 (2026-05-06 v4)
   "木 1목" / "火 3화" / "土 1토" / "金 2 +1 금" / "水 1수" pill chip */
.daily-mockup .ohaeng-row { margin: 12px 20px 0; background: var(--c-surface); border-radius: 14px; padding: 16px; border: 1px solid var(--c-card-line); }
.daily-mockup .ohaeng-row .ttl { font-size: 11px; color: var(--c-gold); letter-spacing: 0.15em; font-weight: 700; margin-bottom: 6px; }
.daily-mockup .ohaeng-row .lead { font-size: 12px; color: var(--c-mute); margin-bottom: 14px; line-height: 1.5; }
.daily-mockup .ohaeng-bal {
  display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;
}
.daily-mockup .ob-item {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 100px;
  background: var(--c-surface);
  border: 1.5px solid var(--c-card-line);
  font-family: 'Noto Serif KR', serif;
  transition: all 0.2s;
  white-space: nowrap;
}
.daily-mockup .ob-item.mok  { background: var(--c-mok-soft);  border-color: var(--c-mok); }
.daily-mockup .ob-item.hwa  { background: var(--c-hwa-soft);  border-color: var(--c-hwa); }
.daily-mockup .ob-item.to   { background: var(--c-to-soft);   border-color: var(--c-to); }
.daily-mockup .ob-item.geum { background: var(--c-geum-soft); border-color: var(--c-geum); }
.daily-mockup .ob-item.su   { background: var(--c-su-soft);   border-color: var(--c-su); }
.daily-mockup .ob-item.bonus {
  background: var(--c-gold-soft) !important;
  border: 2px solid var(--c-gold) !important;
  box-shadow: 0 2px 8px rgba(184,150,90,0.20);
}
.daily-mockup .ob-item .glyph {
  font-family: 'Noto Serif KR', serif;
  font-size: 16px; font-weight: 800; line-height: 1;
}
.daily-mockup .ob-item.mok  .glyph { color: var(--c-mok); }
.daily-mockup .ob-item.hwa  .glyph { color: var(--c-hwa); }
.daily-mockup .ob-item.to   .glyph { color: var(--c-to); }
.daily-mockup .ob-item.geum .glyph { color: var(--c-geum); }
.daily-mockup .ob-item.su   .glyph { color: var(--c-su); }
.daily-mockup .ob-item.lack .glyph { opacity: 0.4; }
.daily-mockup .ob-item .dot { display: none; }  /* chip 디자인은 dot 불필요 */
.daily-mockup .ob-item .qty {
  font-family: 'Pretendard', sans-serif;
  font-size: 13px; font-weight: 700;
  color: var(--c-ink); font-feature-settings: 'tnum';
}
.daily-mockup .ob-item.bonus .qty { color: var(--c-gold-deep); }
.daily-mockup .ob-item .qty .plus { color: var(--c-hwa); font-weight: 800; margin-left: 2px; }
.daily-mockup .ob-item.lack { opacity: 0.5; }
.daily-mockup .ob-item.lack .qty::after { content: ' 부족'; font-size: 11px; color: var(--c-hwa); font-weight: 700; margin-left: 2px; }
/* 2026-05-28 — 좌측 골드 strip 제거. 배경 톤만으로 callout 표현. */
.daily-mockup .ohaeng-bonus-note { margin-top: 12px; font-size: 12px; color: var(--c-ink-soft); line-height: 1.6; padding: 10px 12px; background: var(--c-gold-soft); border-radius: 8px; }
.daily-mockup .ohaeng-bonus-note strong { color: var(--c-gold-deep); font-weight: 700; }

/* Body */
.daily-mockup .body { padding: 22px 20px 0; }
.daily-mockup .section {
  margin-top: 16px;
  background: var(--c-surface);
  border: 1px solid var(--c-card-line);
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.2s;
}
.daily-mockup .section:first-of-type { margin-top: 0; }
.daily-mockup .section-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 18px;
  cursor: pointer;
  background: var(--c-surface);
  border: none; width: 100%;
  text-align: left; appearance: none;
  font: inherit;
  transition: background 0.2s;
}
.daily-mockup .section-header:hover { background: var(--c-paper); }
.daily-mockup .section-header .sec-num {
  font-family: 'Noto Serif KR', serif;
  font-size: 16px; font-weight: 900;
  color: #A23A2A; letter-spacing: 0;
  min-width: 18px; margin-right: 2px;
}
.daily-mockup .section-header .sec-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 17.5px; font-weight: 700;
  color: var(--c-ink);
  flex: 1;
}
.daily-mockup .section-header .sec-title .han {
  color: var(--c-mute); font-weight: 500;
  margin-left: 8px; font-size: 13px; letter-spacing: .1em;
}
.daily-mockup .section-header .chevron {
  width: 20px; height: 20px;
  color: var(--c-mute);
  transition: transform 0.25s;
  flex-shrink: 0;
}
.daily-mockup .section.open .section-header .chevron { transform: rotate(180deg); color: var(--c-gold); }
.daily-mockup .section.open .section-header { border-bottom: 1px dashed var(--c-card-line); }
/* 접힘: section-header 외 자식 모두 숨김. 펼침: 표시 (!important — 다른 컴포넌트 override 차단) */
.daily-mockup .section:not(.open) > *:not(.section-header) { display: none !important; }
.daily-mockup .section.open > *:not(.section-header) { padding-left: 18px; padding-right: 18px; }
.daily-mockup .section.open > *:last-child { padding-bottom: 18px; }
.daily-mockup .section.open > .sec-lead:first-of-type { padding-top: 14px; }
.daily-mockup .sec-num { display: inline-block; font-family: 'Noto Serif KR', serif; font-size: 11px; font-weight: 600; color: #B8965A; letter-spacing: 0.2em; margin-bottom: 4px; }
.daily-mockup .sec-title { font-family: 'Noto Serif KR', serif; font-size: 19px; font-weight: 700; color: #1a1a1a; }
.daily-mockup .sec-title .han { color: #B8965A; font-weight: 500; margin-left: 6px; font-size: 14px; }
.daily-mockup .sec-lead { font-size: 13.5px; color: var(--c-mute); margin-top: 4px; line-height: 1.55; }
.daily-mockup .body p { font-size: 15.5px; line-height: 1.85; color: #2a2520; margin: 10px 0 0; word-break: keep-all; }
/* ⭐ 강조 위계 통일 (PremiumResult 패턴) — 2026-05-06 v5
   <strong> = 황금볼드 (일상 결론) · <u> = 황금밑줄 (시기·숫자·색) · <b> = 검정볼드 (한자) */
.daily-mockup .body p strong,
.daily-mockup .body strong:not(.no-emph) {
  font-weight: 700;
  color: var(--c-gold-deep);
  background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.32) 55%);
  padding: 0 3px; border-radius: 2px;
}
.daily-mockup .body p u,
.daily-mockup .body u {
  text-decoration: underline;
  text-decoration-color: var(--c-gold);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  color: var(--c-ink);
  font-weight: 600;
}
.daily-mockup .body p b,
.daily-mockup .body b {
  font-weight: 700;
  color: var(--c-ink);
  font-family: 'Noto Serif KR', serif;
}
/* <em> = 주의·경고 (번트오렌지) — 2026-05-29. 황금 형광펜(긍정 결론)과 대비되는 경고 톤.
   font-style normal (한글 italic 가독성 ↓), class 없이 태그만으로 스타일 (sanitize 가 속성 strip). */
.daily-mockup .body p em,
.daily-mockup .body em,
.daily-mockup .reason em,
.daily-mockup .ds em {
  font-style: normal;
  font-weight: 700;
  color: #B5441F;
  background: linear-gradient(180deg, transparent 56%, rgba(181,68,31,.15) 56%);
  padding: 0 2px; border-radius: 2px;
}
.daily-mockup .body p .han { font-family: 'Noto Serif KR', serif; color: var(--c-ink-soft); font-size: 13px; }
.daily-mockup .score-headline { font-family: 'Noto Serif KR', serif; font-size: 15px; font-weight: 700; color: #1a1a1a; margin-top: 8px; line-height: 1.55; }
.daily-mockup .my-today { font-size: 12.5px; color: var(--c-ink-soft); margin-top: 6px; line-height: 1.65; }

/* Topic grid (§02) */
.daily-mockup .topic-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 14px 0 0; }
.daily-mockup .topic-card {
  background: #fff; border: 1px solid var(--c-card-line); border-radius: 12px;
  padding: 14px; position: relative; overflow: hidden;
  cursor: pointer; transition: all .2s;
  /* button reset */
  font: inherit; text-align: left; appearance: none; width: 100%;
  display: flex; flex-direction: column; gap: 6px;
}
.daily-mockup .topic-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(184,150,90,0.18);
  border-color: var(--c-gold);
}
.daily-mockup .topic-card:active { transform: translateY(0); }
.daily-mockup .topic-card:focus-visible {
  outline: 2px solid var(--c-gold);
  outline-offset: 2px;
}
/* 2026-05-28 — .strip(좌측 컬러 바) 제거 (AI 디자인 티). 톤은:
   ① 한자 우상단 chip (rounded background + 톤 컬러 텍스트)
   ② 카드 우상단 corner 의 미세한 radial wash (1-corner only — 균일 grid 아님) */
.daily-mockup .topic-card::before {
  content: ''; position: absolute; top: 0; right: 0; width: 56px; height: 56px;
  background: radial-gradient(circle at top right, var(--card-tone, rgba(184,150,90,0.10)), transparent 70%);
  pointer-events: none;
}
.daily-mockup .topic-card.t-money  { --card-tone: rgba(184,150,90,0.14); }
.daily-mockup .topic-card.t-rel    { --card-tone: rgba(200,138,149,0.18); }
.daily-mockup .topic-card.t-work   { --card-tone: rgba(90,124,168,0.18); }
.daily-mockup .topic-card.t-health { --card-tone: rgba(111,160,140,0.18); }
.daily-mockup .topic-card .head { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 1; }
.daily-mockup .topic-card .nm { font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700; color: #1a1a1a; }
.daily-mockup .topic-card .han {
  font-family: 'Noto Serif KR', serif; font-size: 12.5px; font-weight: 700;
  padding: 3px 8px; border-radius: 100px;
  background: var(--han-bg, rgba(184,150,90,0.12));
  color: var(--han-fg, #8C6D3D);
  line-height: 1.2;
}
.daily-mockup .topic-card.t-money  .han { --han-bg: rgba(184,150,90,0.14); --han-fg: #8C6D3D; }
.daily-mockup .topic-card.t-rel    .han { --han-bg: rgba(200,138,149,0.16); --han-fg: #B05B6B; }
.daily-mockup .topic-card.t-work   .han { --han-bg: rgba(90,124,168,0.14); --han-fg: #4D6E96; }
.daily-mockup .topic-card.t-health .han { --han-bg: rgba(111,160,140,0.16); --han-fg: #5A8674; }
.daily-mockup .topic-card .score-row { display: flex; align-items: baseline; gap: 4px; margin-top: 6px; position: relative; z-index: 1; }
.daily-mockup .topic-card .score { font-family: 'Noto Serif KR', serif; font-size: 24px; font-weight: 700; }
.daily-mockup .topic-card .score-max { font-size: 11px; color: var(--c-mute); }
.daily-mockup .topic-card .one-liner { font-size: 11.5px; color: var(--c-ink-soft); margin-top: 6px; line-height: 1.55; word-break: keep-all; position: relative; z-index: 1; }
.daily-mockup .topic-card.t-money .score  { color: #B8965A; }
.daily-mockup .topic-card.t-rel .score    { color: #C88A95; }
.daily-mockup .topic-card.t-work .score   { color: #5A7CA8; }
.daily-mockup .topic-card.t-health .score { color: #6FA08C; }
.daily-mockup .topic-card .cta-text { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--c-card-line); font-size: 11px; color: #B8965A; font-weight: 600; display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 1; }
.daily-mockup .topic-card .cost-pill { background: rgba(184,148,31,.1); color: #B8965A; padding: 2px 8px; border-radius: 100px; font-size: 11px; font-weight: 600; }

/* Hour chart (§03) */
.daily-mockup .hour-chart { margin: 14px 0 0; background: #fff; border-radius: 12px; padding: 14px; border: 1px solid var(--c-card-line); }
.daily-mockup .hour-chart .ttl { font-size: 11px; color: #B8965A; letter-spacing: 0.15em; font-weight: 600; margin-bottom: 10px; }
.daily-mockup .hour-svg { width: 100%; height: 120px; }
.daily-mockup .hour-legend { display: flex; gap: 10px; font-size: 11px; color: var(--c-ink-soft); margin-top: 6px; align-items: center; flex-wrap: wrap; }
.daily-mockup .hour-legend .sw { width: 10px; height: 10px; border-radius: 50%; }

/* Meet (§04) */
/* §04 만나는 사람 — 브랜드톤 통일 (2026-05-06 v2 · orb 3D 폐기) */
.daily-mockup .meet-stack { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.daily-mockup .meet { background: #fff; border: 1px solid var(--c-card-line); border-radius: 12px; padding: 14px; display: grid; grid-template-columns: 52px 1fr; gap: 12px; align-items: flex-start; }
.daily-mockup .meet .badge-orb {
  width: 52px; height: 52px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Noto Serif KR', serif; font-size: 13px; font-weight: 700;
  color: #B8965A; text-align: center; line-height: 1.1; flex-direction: column;
  background: rgba(184, 150, 90, 0.10);
  border: 1px solid rgba(184, 150, 90, 0.30);
}
/* 2026-05-28 — badge-orb 좌측 컬러 strip 제거 (AI 디자인 티). 컬러 톤은 .tag chip 으로 충분히 표현됨. */
.daily-mockup .meet .badge-orb span { font-size: 14px; line-height: 1.15; }
.daily-mockup .meet .ti-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.daily-mockup .meet .ti { font-family: 'Noto Serif KR', serif; font-size: 14.5px; font-weight: 700; color: #1a1a1a; }
.daily-mockup .meet .tag { font-size: 11px; padding: 2px 8px; border-radius: 100px; font-weight: 700; letter-spacing: .03em; }
.daily-mockup .meet.boost .tag { background: var(--c-mok-soft); color: var(--c-mok); }
.daily-mockup .meet.clash .tag { background: var(--c-hwa-soft); color: var(--c-hwa); }
.daily-mockup .meet.calm  .tag { background: rgba(184,150,90,.14); color: #8C6D3D; }
.daily-mockup .meet .ds { font-size: 12.5px; color: #2a2520; line-height: 1.7; margin-top: 6px; }
.daily-mockup .meet .ds strong { color: var(--c-gold-deep); font-weight: 700; background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.32) 55%); padding: 0 3px; border-radius: 2px; }
.daily-mockup .meet .ds u { color: #1a1a1a; text-decoration-color: #B8965A; text-decoration-thickness: 2px; text-underline-offset: 2px; }
.daily-mockup .meet .ds .han { font-family: 'Noto Serif KR', serif; color: var(--c-ink-soft); font-size: 11.5px; }

/* Do/Don't (§05) */
/* §04 행동 처방 — 클린 디자인 v4 (2026-05-06) */
.daily-mockup .do-grid { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
.daily-mockup .do-col {
  background: var(--c-surface);
  border: 1px solid var(--c-card-line);
  border-radius: 14px;
  overflow: hidden;
}
.daily-mockup .do-col .ch {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Noto Serif KR', serif; font-size: 15px; font-weight: 700;
  padding: 14px 16px; color: var(--c-ink);
  background: var(--c-paper);
  border-bottom: 1px solid var(--c-card-line);
}
.daily-mockup .do-col.go .ch { background: rgba(184,150,90,0.08); }
.daily-mockup .do-col .ch .han-tag {
  font-family: 'Noto Serif KR', serif;
  width: 28px; height: 28px;
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--c-gold);
  color: #fff;
  font-size: 14px; font-weight: 800;
}
.daily-mockup .do-col.no .ch .han-tag {
  background: transparent;
  border: 1.5px solid var(--c-gold-deep);
  color: var(--c-gold-deep);
}
.daily-mockup .do-col .ch .count {
  font-size: 11.5px;
  color: var(--c-gold-deep);
  font-weight: 700; margin-left: auto;
  font-family: 'Pretendard', sans-serif;
}
.daily-mockup .do-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
.daily-mockup .do-list li {
  padding: 14px 16px;
  border-bottom: 1px solid var(--c-card-line);
  word-break: keep-all;
}
.daily-mockup .do-list li:last-child { border-bottom: none; }
.daily-mockup .do-list li .action-row {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 6px;
}
.daily-mockup .do-list li .action-num {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--c-gold-soft);
  color: var(--c-gold-deep);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800;
  flex-shrink: 0;
  font-family: 'Pretendard', sans-serif;
}
.daily-mockup .do-col.no .do-list li .action-num {
  background: transparent;
  border: 1.5px solid var(--c-gold-deep);
}
.daily-mockup .do-list li .action-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 14.5px; font-weight: 700;
  color: var(--c-ink); flex: 1; line-height: 1.3;
}
.daily-mockup .do-list li .when {
  display: inline-block; font-size: 11px; color: var(--c-gold-deep);
  font-weight: 700;
  padding: 3px 10px; background: var(--c-gold-soft);
  border-radius: 100px;
  margin-bottom: 8px;
  margin-left: 32px;
}
.daily-mockup .do-list li .reason {
  display: block; font-size: 12.5px; color: var(--c-ink-soft);
  line-height: 1.7;
  margin-left: 32px;
}
.daily-mockup .do-list li .reason strong {
  background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.30) 55%);
  padding: 0 2px; color: var(--c-gold-deep); font-weight: 700;
}
.daily-mockup .do-list li .reason u {
  text-decoration-color: var(--c-gold); text-decoration-thickness: 2px;
  text-underline-offset: 2px; color: var(--c-ink); font-weight: 600;
}

/* Lucky 6 (§06) */
/* §06 오늘의 럭키 — 디자인 강화 (2026-05-06 v2)
   golden top accent + 큰 아이콘 + bigger value text + 부드러운 hover */
.daily-mockup .lucky-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
.daily-mockup .lucky {
  background: linear-gradient(180deg, #FFFFFF 0%, #FAF7EE 100%);
  border: 1px solid var(--c-card-line);
  border-radius: 12px;
  padding: 16px 10px 14px;
  text-align: center;
  position: relative;
  overflow: hidden;
  transition: all 0.2s;
}
/* 2026-05-28 — 6카드 상단 균일 골드 strip 제거 (AI grid 디자인 티).
   톤은 ico-wrap 원형 배경 + lab 골드 컬러로 충분. */
.daily-mockup .lucky .ico-wrap {
  width: 36px; height: 36px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: rgba(184, 150, 90, 0.10);
  display: flex; align-items: center; justify-content: center;
}
.daily-mockup .lucky .ico { font-size: 18px; line-height: 1; color: #B8965A; font-weight: 700; }
.daily-mockup .lucky .swatch { display: block; width: 24px; height: 24px; border-radius: 50%; margin: 0 auto; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
.daily-mockup .lucky .lab { font-size: 11px; color: #B8965A; letter-spacing: 0.12em; font-weight: 700; text-transform: uppercase; }
.daily-mockup .lucky .vl { font-size: 14px; color: #1a1a1a; font-weight: 700; margin-top: 6px; line-height: 1.3; word-break: keep-all; }
.daily-mockup .lucky .vl.han { font-family: 'Noto Serif KR', serif; font-size: 16px; }

/* PullQuote + Tomorrow (§07) */
/* 2026-05-28 — 좌측 컬러 strip 제거. 그라데이션 배경 + 큰 따옴표(typography)로 인용 표현. */
.daily-mockup .pullq { background: linear-gradient(135deg, rgba(184,150,90,.06), rgba(212,175,55,.08)); border-radius: 10px; padding: 30px 20px 16px; margin: 16px 0 0; font-family: 'Noto Serif KR', serif; font-size: 14.5px; line-height: 1.75; color: #1a1a1a; font-weight: 500; word-break: keep-all; position: relative; }
.daily-mockup .pullq::before { content: '"'; position: absolute; top: 6px; left: 14px; font-family: 'Noto Serif KR', serif; font-size: 42px; line-height: 1; color: rgba(184,150,90,0.28); font-weight: 700; }
/* §06 한 문장 안 Tomorrow 카드 — §06 body 내부 통합 디자인 (2026-05-07 v3) */
.daily-mockup .tomorrow.tomorrow-v2 {
  margin: 14px 0 0;
  padding: 14px 0 0;
  border-top: 1px dashed var(--c-card-line);
}
.daily-mockup .tomorrow-v2 .tomorrow-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.daily-mockup .tomorrow-v2 .lab { font-size: 11px; color: #B8965A; letter-spacing: 0.18em; font-weight: 700; }
.daily-mockup .tomorrow-v2 .score-chip { background: rgba(184,150,90,0.14); border: 1px solid rgba(184,150,90,0.30); padding: 4px 10px; border-radius: 100px; display: inline-flex; align-items: baseline; gap: 2px; }
.daily-mockup .tomorrow-v2 .score-num { font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 700; color: #B8965A; line-height: 1; }
.daily-mockup .tomorrow-v2 .score-max { font-size: 11px; color: #B8965A; font-weight: 600; }
.daily-mockup .tomorrow-v2 .tomorrow-date { font-size: 13px; color: #2a2520; font-weight: 600; line-height: 1.5; padding-bottom: 8px; border-bottom: 1px dashed rgba(184,150,90,0.30); margin-bottom: 8px; }
.daily-mockup .tomorrow-v2 .tomorrow-date strong { color: #B8965A; font-weight: 700; }
.daily-mockup .tomorrow-v2 .tomorrow-headline { font-size: 13.5px; color: #2a2520; line-height: 1.7; word-break: keep-all; }
.daily-mockup .tomorrow-v2 .tomorrow-headline strong { color: #1a1a1a; font-weight: 700; background: linear-gradient(180deg, transparent 60%, rgba(184,150,90,.25) 60%); padding: 0 1px; }

/* legacy tomorrow (호환 유지) */
.daily-mockup .tomorrow { margin: 14px 0 0; }

/* §07 마무리 메시지 — "내일 다시 만나요" */
.daily-mockup .closing-note {
  margin: 16px 0 0;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--c-card-line);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.daily-mockup .closing-note .closing-icon {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: rgba(184,150,90,0.10);
  display: flex; align-items: center; justify-content: center;
  color: #B8965A;
  flex-shrink: 0;
}
.daily-mockup .closing-note .closing-icon svg { width: 16px; height: 16px; }
.daily-mockup .closing-note .closing-title { font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700; color: #1a1a1a; }
.daily-mockup .closing-note .closing-sub { font-size: 12px; color: var(--c-mute); margin-top: 3px; }

/* Upsell + Actions */
.daily-mockup .upsell { margin: 22px 20px 0; background: linear-gradient(135deg, #1a1a1a, #2a2520); color: #fff; border-radius: 14px; padding: 22px 20px; position: relative; overflow: hidden; }
.daily-mockup .upsell::before { content: '月'; position: absolute; right: -8px; bottom: -28px; font-family: 'Noto Serif KR', serif; font-size: 130px; font-weight: 900; color: rgba(212,175,55,.08); line-height: 1; }
.daily-mockup .upsell .lab { font-size: 11px; color: #E8D9B8; letter-spacing: 0.15em; font-weight: 600; margin-bottom: 8px; }
.daily-mockup .upsell h3 { font-family: 'Noto Serif KR', serif; font-size: 17px; font-weight: 700; margin-bottom: 6px; position: relative; line-height: 1.45; }
.daily-mockup .upsell p { font-size: 12.5px; color: #c4baa0; margin-bottom: 14px; line-height: 1.6; position: relative; word-break: keep-all; }
.daily-mockup .upsell .cta { display: inline-flex; gap: 6px; background: linear-gradient(135deg, #E8D9B8, #B8965A); color: #1a1a1a; padding: 10px 18px; border-radius: 100px; font-size: 13px; font-weight: 700; cursor: pointer; position: relative; align-items: center; border: none; }
.daily-mockup .upsell .cost { background: rgba(255,255,255,.08); padding: 3px 10px; border-radius: 100px; font-size: 11px; color: #E8D9B8; margin-left: 6px; font-weight: 600; }
/* 2026-09-17 주간·월간 추천 카드 (기존 .upsell 재사용) */
.daily-mockup .upsell.upsell-weekly::before { content: '週'; }
.daily-mockup .upsell .cta-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; position: relative; }
.daily-mockup .upsell .cta-row .cta { min-height: 44px; padding: 0 20px; }
.daily-mockup .upsell .cta-row .cost { margin-left: 0; }
.daily-mockup .upsell .sub-link {
  position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; min-height: 44px; margin-top: 16px; padding: 12px 0 0;
  border: none; border-top: 1px dashed rgba(232,217,184,0.22); background: transparent;
  color: #E8D9B8; font: inherit; font-size: 12.5px; font-weight: 600; text-align: left; cursor: pointer; word-break: keep-all;
}
.daily-mockup .upsell .sub-link .sub-cost { font-size: 11px; color: #c4baa0; white-space: nowrap; }

.daily-mockup .actions { margin: 22px 20px 0; padding: 18px 0; border-top: 1px solid var(--c-card-line); display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.daily-mockup .actions .btn { background: #fff; border: 1px solid var(--c-card-line); border-radius: 12px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: #1a1a1a; cursor: pointer; transition: .2s; }
.daily-mockup .actions .btn svg { width: 22px; height: 22px; color: #B8965A; }
.daily-mockup .actions .btn .ti { font-size: 12.5px; font-weight: 600; }
.daily-mockup .actions .btn .sb { font-size: 11px; color: var(--c-mute); }

.daily-mockup .service-notice { margin: 22px 20px 0; padding: 14px 18px; border-top: 1px dashed var(--c-card-line); font-size: 11px; line-height: 1.65; color: #9A8B70; text-align: center; letter-spacing: .01em; }

/* Skeleton — Progressive Render (2026-05-06) */
.daily-mockup .skeleton-block { background: linear-gradient(90deg, #F0E8D9 0%, #F8F2E5 50%, #F0E8D9 100%); background-size: 200% 100%; animation: skel-pulse 1.4s ease-in-out infinite; border-radius: 6px; }
.daily-mockup .skeleton-line { height: 14px; margin-top: 8px; }
.daily-mockup .skeleton-line.w-30 { width: 30%; }
.daily-mockup .skeleton-line.w-60 { width: 60%; }
.daily-mockup .skeleton-line.w-80 { width: 80%; }
.daily-mockup .skeleton-line.w-90 { width: 90%; }
.daily-mockup .skeleton-line.w-full { width: 100%; }
@keyframes skel-pulse {
  0% { background-position: -50% 0; }
  100% { background-position: 150% 0; }
}
.daily-mockup .skeleton-card { background: #fff; border: 1px solid var(--c-card-line); border-radius: 12px; padding: 18px; margin-top: 14px; }
.daily-mockup .skeleton-card .skeleton-title { width: 40%; height: 18px; margin-bottom: 14px; }
`;

const OHENG_KEY: Record<OhengType, string> = { 목: 'mok', 화: 'hwa', 토: 'to', 금: 'geum', 수: 'su' };

function getOhengClass(o?: OhengType | string): string {
  return OHENG_KEY[(o as OhengType) || '토'] || 'to';
}

// STEM_INFO + BRANCH_INFO → @/utils/sajuStemBranch 로 이전 (2026-05-07 · TopicSajuMini 와 공유)

/** 두 오행 관계 → 일상어 라벨 + 의미 + 좋은 점 + 조심할 점 (한자 X) */
function getOhengRelation(my: OhengType, today: OhengType): {
  label: string;        // 짧은 라벨 (chip 표시용 · 일상어)
  category: string;     // 카테고리 (재물 자리 / 도움 자리 등)
  meaning: string;      // 풀이 1문장
  good: string;         // 좋은 점
  watch: string;        // 조심할 점
  type: 'same' | 'support-me' | 'i-support' | 'i-control' | 'controls-me';
} {
  const ohengName: Record<OhengType, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const myK = ohengName[my];
  const todayK = ohengName[today];

  if (my === today) {
    return {
      label: '동행',
      category: '동료 자리',
      meaning: `오늘은 나와 같은 ${myK} 기운이 만나는 날이에요. 동료·동반자처럼 같은 결의 사람과 함께하는 자리.`,
      good: '협력·연대·공감대 형성에 유리. 같은 결의 사람과 만남이 의미 있어요.',
      watch: '경쟁·자존심 부딪힘 주의. 한 박자 양보가 흐름을 부드럽게 합니다.',
      type: 'same',
    };
  }
  const sheng: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const ke: Record<OhengType, OhengType> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };

  if (sheng[today] === my) {
    return {
      label: '도움 받음',
      category: '도움·배움 자리',
      meaning: `오늘 ${todayK} 기운이 내 ${myK} 기운을 키워주는 날이에요. 윗사람·스승·책에서 도움이 들어오는 자리.`,
      good: '윗사람·선배·스승의 도움, 배움·정리·휴식에 유리한 자리.',
      watch: '받는 데 익숙해지면 추진력이 떨어집니다. 받은 만큼 한 번은 움직이세요.',
      type: 'support-me',
    };
  }
  if (sheng[my] === today) {
    return {
      label: '표현·창의',
      category: '표현·나눔 자리',
      meaning: `내 ${myK} 기운이 오늘 ${todayK}을 살려주는 날이에요. 말·글·아이디어로 나누고 표현하는 자리.`,
      good: '말·글·아이디어가 잘 풀리는 날. 표현하고 나누는 자리에 유리.',
      watch: '에너지 빼주는 자리라 피로감 누적 주의. 무리하지 말고 한 번에 몰아치지 마세요.',
      type: 'i-support',
    };
  }
  if (ke[my] === today) {
    return {
      label: '재물·기회',
      category: '재물·기회 자리',
      meaning: `내 ${myK} 기운이 오늘 ${todayK}을 다스리는 날이에요. 돈·기회·결실이 눈앞에 보이는 자리.`,
      good: '돈·기회·결실이 보이는 날. 작은 입금·협상·계약 신호가 들어옵니다.',
      watch: '한 번에 다 끌어당기려 하면 마찰. 한 박자 늦추는 게 효율적입니다.',
      type: 'i-control',
    };
  }
  if (ke[today] === my) {
    return {
      label: '책임·기준',
      category: '책임·기준 자리',
      meaning: `오늘 ${todayK} 기운이 내 ${myK} 기운을 누르는 날이에요. 마감·약속·평가가 또렷해지는 자리.`,
      good: '체계·규율·시험·평가에 집중력 살아나는 날. 마감·약속이 또렷해집니다.',
      watch: '피로와 긴장이 쌓이는 날이에요. 깊은 결정은 내일로 미루세요.',
      type: 'controls-me',
    };
  }
  return {
    label: '일상',
    category: '평이한 흐름',
    meaning: `${myK} 기운과 ${todayK} 기운이 만나는 평이한 날이에요.`,
    good: '평이한 흐름. 일상 루틴 유지에 좋습니다.',
    watch: '특별한 변화 신호는 약합니다.',
    type: 'same',
  };
}

export function DailyMockupView(props: DailyMockupViewProps) {
  const { result, profile, dateLabel, todayGanzi, todayGanReading, todayOheng, myGan, myGanReading, myOheng, relationLabel: _relationLabel, onUpsell, onMonthly, priceTag = '오늘 1회 무료', isGenerating = false, onShare, onChat, onTopicClick, nextSteps } = props;

  // ── 섹션 접기/펼치기 (§01 default open · 2026-05-06 v6) ──
  // 2026-06-13 통일 정책 (준기 결정) — 01·02 만 펼침, 03+ 접힘.
  //   상단 섹션은 먼저 읽히게 + 나머지는 (로딩 중이어도) 접힌 채 순차 노출되는 UX 구조. 전 콘텐츠 동일.
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['01', '02']));
  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const isOpen = (id: string) => openSections.has(id);
  // 섹션 헤더 + chevron 헬퍼
  const SectionHeader = ({ num, title, han, id }: { num: string; title: string; han?: string; id: string }) => (
    <button
      type="button"
      className="section-header"
      onClick={() => toggleSection(id)}
      aria-expanded={isOpen(id)}
    >
      <span className="sec-num">{hanjaNum(Number(num))}</span>
      <span className="sec-title">{title}{han && <span className="han">{han}</span>}</span>
      <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );

  // ── 사주 4기둥
  const pillars = profile?.sajuData?.pillars || [];
  const yearGan = pillars[0]?.천간 || '';
  const yearJi = pillars[0]?.지지 || '';
  const monthGan = pillars[1]?.천간 || '';
  const monthJi = pillars[1]?.지지 || '';
  const dayGan = pillars[2]?.천간 || '';
  const dayJi = pillars[2]?.지지 || '';
  const hourGan = pillars[3]?.천간 || '';
  const hourJi = pillars[3]?.지지 || '';
  const yearGanO = (pillars[0]?.천간오행 as OhengType) || '토';
  const yearJiO = (pillars[0]?.지지오행 as OhengType) || '토';
  const monthGanO = (pillars[1]?.천간오행 as OhengType) || '토';
  const monthJiO = (pillars[1]?.지지오행 as OhengType) || '토';
  const dayGanO = (pillars[2]?.천간오행 as OhengType) || '토';
  const dayJiO = (pillars[2]?.지지오행 as OhengType) || '토';
  const hourGanO = (pillars[3]?.천간오행 as OhengType) || '토';
  const hourJiO = (pillars[3]?.지지오행 as OhengType) || '토';

  // ── 오행 균형
  const elements = profile?.sajuData?.elements || {};
  const ohengList = useMemo(() => (
    (['목', '화', '토', '금', '수'] as OhengType[]).map((o) => {
      const qty = Number(elements[o] ?? 0);
      const todayBonus = o === todayOheng;
      return { oheng: o, qty, todayBonus, lack: qty === 0 };
    })
  ), [elements, todayOheng]);

  // ── v5 schema 파싱
  const title = stripMd(String(result?.title || '오늘의 운세'));
  const scoreHeadline = stripMd(String(result?.scoreHeadline || ''));
  const myToday = stripMd(String(result?.myToday || ''));
  const todayNarrative = stripMd(String(result?.todayNarrative || '')).split('\n').filter(Boolean);

  const subScores = result?.subScores || {};
  const subScoreOneLines = result?.subScoreOneLines || {};
  const hasSubScores = subScores.wealth !== undefined || subScores.love !== undefined;
  const get10 = (key: string): string => {
    const raw = subScores?.[key];
    // 2026-09-17 — 점수 없음은 0.0 이 아니라 '—' (생성 완료 후 subScores 누락 시 대체 표시)
    if (raw === undefined || raw === null || raw === '' || !Number.isFinite(Number(raw))) return '—';
    const v = Number(raw);
    return (Math.max(0, Math.min(100, v)) / 10).toFixed(1);
  };

  const timeSlots: any[] = Array.isArray(result?.timeSlots) ? result.timeSlots.slice(0, 4) : [];
  const hourlyPeak = result?.hourlyPeak;
  const hourlyAvoid = result?.hourlyAvoid;

  const meetPeople: any[] = Array.isArray(result?.meetPeople) ? result.meetPeople.slice(0, 3) : [];
  const doList: any[] = Array.isArray(result?.doList) ? result.doList.slice(0, 3) : [];
  const dontList: any[] = Array.isArray(result?.dontList) ? result.dontList.slice(0, 3) : [];

  const luckyProfile = result?.luckyProfile || {};
  const dailyQuote = stripMd(String(result?.dailyQuote || ''));
  const tomorrow = result?.tomorrow;

  // ── 시간대 SVG path 생성 (4 점수 → 곡선)
  const hourSvgPath = useMemo(() => {
    if (timeSlots.length !== 4) return null;
    const xs = [40, 120, 200, 280];
    const ys = timeSlots.map((s) => 100 - Math.min(90, Math.max(0, Number(s?.score ?? 50))));
    // smooth path
    const points = xs.map((x, i) => `${x},${ys[i]}`).join(' L');
    const peakIdx = ys.indexOf(Math.min(...ys));
    return { path: `M0,90 L${points} L320,${ys[3]}`, peakX: xs[peakIdx], peakY: ys[peakIdx] };
  }, [timeSlots]);

  return (
    <div className="daily-mockup">
      <style dangerouslySetInnerHTML={{ __html: MOCKUP_CSS }} />
      <div className="page">
        <header className="hd">
          <div className="top">
            <span className="badge">오늘의 운세</span>
            <span>{profile?.name || '당신'} 님</span>
            <span className="free-tag">{priceTag}</span>
          </div>
          <h1>{stripAll(title)}</h1>
          <div className="date">{dateLabel}</div>
          {(() => {
            const tc = getTimeContext();
            return (
              <div className="time-chip" style={{ wordBreak: 'keep-all' }}>
                {/* 2026-06-13 — ⏱ 이모지 → 時 한자 (이모지 절대 금지 정책) + keep-all (단어 깨짐 fix) */}
                <span className="ic" style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 900 }}>時</span>
                <span>{tc.greeting}</span>
                <span className="sub">· {tc.subtle}</span>
              </div>
            );
          })()}
        </header>

        {/* 내 사주 미니 카드 */}
        {pillars.length === 4 && (
          <div className="my-saju">
            <div className="ttl">내 사주 — {profile?.name || '당신'}</div>
            <div className="saju-grid">
              {[
                { gan: hourGan, ji: hourJi, ganO: hourGanO, jiO: hourJiO, lab: '시', ilju: false },
                { gan: dayGan,  ji: dayJi,  ganO: dayGanO,  jiO: dayJiO,  lab: '일 (나)', ilju: true },
                { gan: monthGan,ji: monthJi,ganO: monthGanO,jiO: monthJiO,lab: '월', ilju: false },
                { gan: yearGan, ji: yearJi, ganO: yearGanO, jiO: yearJiO, lab: '연', ilju: false },
              ].map((p, idx) => {
                const ganInfo = STEM_INFO[p.gan];
                const jiInfo = BRANCH_INFO[p.ji];
                return (
                  <div key={idx} className={`saju-cell ${p.ilju ? 'ilju' : ''}`}>
                    <div className="lab">{p.lab}</div>
                    <div className={`gan ${getOhengClass(p.ganO)}`}>
                      <span className="han">{p.gan || '-'}</span>
                      {ganInfo && <span className="read">{ganInfo.reading}</span>}
                    </div>
                    {ganInfo && <div className="gan-meaning">{ganInfo.symbol}</div>}
                    <div className={`ji ${getOhengClass(p.jiO)}`}>
                      <span className="han">{p.ji || '-'}</span>
                      {jiInfo && <span className="read">{jiInfo.reading}</span>}
                    </div>
                    {jiInfo && <div className="ji-meaning">{jiInfo.animal}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 오행 균형 — 내 사주 카드 바로 아래로 이동 (2026-05-06 v2)
            통일 골드 색상 + 오늘 보충 위치 강조 + 어디 더해졌는지 텍스트 안내 */}
        {ohengList.some((o) => o.qty > 0) && (() => {
          const bonusItem = ohengList.find((o) => o.todayBonus);
          const todayStem = STEM_INFO[todayGanzi?.[0] || ''];
          return (
          <div className="ohaeng-row">
            <div className="ttl">내 사주 오행 + 오늘의 보충</div>
            <div className="lead">사주 5기운 균형 + 오늘 일진의 추가 기운</div>
            <div className="ohaeng-bal">
              {ohengList.map((o) => {
                const glyph = o.oheng === '목' ? '木' : o.oheng === '화' ? '火' : o.oheng === '토' ? '土' : o.oheng === '금' ? '金' : '水';
                return (
                  <div key={o.oheng} className={`ob-item ${getOhengClass(o.oheng)} ${o.todayBonus ? 'bonus' : ''} ${o.lack ? 'lack' : ''}`}>
                    <div className="glyph">{glyph}</div>
                    <div className="dot" />
                    <div className="qty">{o.qty}{o.todayBonus ? <span className="plus">{' +1'}</span> : ''}</div>
                  </div>
                );
              })}
            </div>
            {bonusItem && todayStem && (
              <div className="ohaeng-bonus-note">
                오늘 <strong>{todayStem.reading}({todayGanzi?.[0]})</strong> 기운이 들어와서 <strong>{bonusItem.oheng}</strong> 자리에 +1 보충됩니다.
              </div>
            )}
          </div>
          );
        })()}

        {/* 오늘 vs 내 일간 관계 — 사각 카드 + 한자 풀이 + 관계 의미 (2026-05-06 v2) */}
        {myGan && todayGanzi && (() => {
          const meStem = STEM_INFO[myGan];
          const todayStem = STEM_INFO[todayGanzi[0]];
          const relation = getOhengRelation(myOheng, todayOheng);
          return (
          <div className="relation-card">
            <div className="ttl">오늘의 기운과 내 기운의 만남</div>
            <div className="rel-flex">
              <div className="rel-stem-card me">
                <div className="lb">내 기운</div>
                <div className={`gan-block ${getOhengClass(myOheng)}`}>{myGan}</div>
                <div className="gan-info">
                  <div className="gan-read">{myGanReading}({myGan})</div>
                  {meStem && <div className="gan-yy">{meStem.yinyang}의 {myOheng} 기운</div>}
                  {meStem && <div className="gan-brief">{meStem.brief}</div>}
                </div>
              </div>
              <div className="rel-arrow">
                <svg viewBox="0 0 60 14" fill="none">
                  <path d="M5 7 L55 7" stroke="#B8965A" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M50 3 L55 7 L50 11" stroke="#B8965A" strokeWidth="1.5" fill="none" />
                </svg>
                <div className="label">{relation.category}</div>
              </div>
              <div className="rel-stem-card">
                <div className="lb">오늘 기운</div>
                <div className={`gan-block ${getOhengClass(todayOheng)}`}>{todayGanzi[0]}</div>
                <div className="gan-info">
                  <div className="gan-read">{todayGanReading}({todayGanzi[0]})</div>
                  {todayStem && <div className="gan-yy">{todayStem.yinyang}의 {todayOheng} 기운</div>}
                  {todayStem && <div className="gan-brief">{todayStem.brief}</div>}
                </div>
              </div>
            </div>
            <div className="rel-explain">
              <div className="meaning">{relation.meaning}</div>
              <div className="pros">
                <span className="tag">좋은 점</span>
                <span className="txt">{relation.good}</span>
              </div>
              <div className="cons">
                <span className="tag">조심할 점</span>
                <span className="txt">{relation.watch}</span>
              </div>
            </div>
            {result?.relationExplain && (
              <div className="rel-explain" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: stripMd(String(result.relationExplain)) }} />
            )}
          </div>
          );
        })()}

        <main className="body">
          {/* §01 오늘의 결 — default open */}
          <section className={`section ${isOpen('01') ? 'open' : ''}`}>
            <SectionHeader num="01" title="오늘의 결" han="日柱" id="01" />
            {(scoreHeadline || myToday || todayNarrative.length > 0) ? (
              <>
                {scoreHeadline && <div className="score-headline" dangerouslySetInnerHTML={safeHtml(scoreHeadline)} />}
                {myToday && <div className="my-today" dangerouslySetInnerHTML={safeHtml(myToday)} />}
                {todayNarrative.map((para, i) => (
                  <p key={i} dangerouslySetInnerHTML={safeHtmlEmph(para)} />
                ))}
              </>
            ) : (
              <>
                <div className="skeleton-block skeleton-line w-60" style={{ marginTop: 12 }} />
                <div className="skeleton-block skeleton-line w-80" />
                <div className="skeleton-block skeleton-line w-full" />
                <div className="skeleton-block skeleton-line w-90" />
                <div className="skeleton-block skeleton-line w-full" />
                <div className="skeleton-block skeleton-line w-80" />
              </>
            )}
          </section>

          {/* §02 (4영역 점수)는 §07 closing 직전으로 이동 (CTA = 마지막) — 2026-05-06 v6 */}

          {/* §02 시간대 흐름 — 데이터 없으면 skeleton (2026-05-06 v6 renumber) */}
          {!(timeSlots.length === 4 && hourSvgPath) ? (
            <section className={`section ${isOpen('02') ? 'open' : ''}`}>
              <SectionHeader num="02" title="오늘의 시간 흐름" han="時運" id="02" />
              <p className="sec-lead">하루 24시간 중 어느 시간대가 가장 운이 강하고, 어느 시간대를 조심해야 하는지 한눈에.</p>
              <div style={{ background: '#fff', border: '1px solid #E5DFD0', borderRadius: 12, padding: 18, marginTop: 14 }}>
                <div className="skeleton-block" style={{ width: '100%', height: 120, borderRadius: 8 }} />
                <div className="skeleton-block skeleton-line w-60" style={{ marginTop: 14 }} />
                <div className="skeleton-block skeleton-line w-80" />
              </div>
            </section>
          ) : (
            <section className={`section ${isOpen('02') ? 'open' : ''}`}>
              <SectionHeader num="02" title="오늘의 시간 흐름" han="時運" id="02" />
              <p className="sec-lead">하루 24시간 중 어느 시간대가 가장 운이 강하고, 어느 시간대를 조심해야 하는지 한눈에.</p>
              <div className="hour-chart">
                <div className="ttl">시간대별 활력 지수</div>
                <svg className="hour-svg" viewBox="0 0 320 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="dailyGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#B8965A" stopOpacity=".4" />
                      <stop offset="100%" stopColor="#B8965A" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${hourSvgPath.path} L320,120 L0,120 Z`} fill="url(#dailyGrad)" />
                  <path d={hourSvgPath.path} stroke="#B8965A" strokeWidth="2" fill="none" />
                  <circle cx={hourSvgPath.peakX} cy={hourSvgPath.peakY} r="5" fill="#fff" stroke="#B8965A" strokeWidth="2" />
                  <text x={hourSvgPath.peakX} y={hourSvgPath.peakY - 11} textAnchor="middle" fontSize="9" fill="#B8965A" fontWeight="600">PEAK</text>
                  {timeSlots.map((s, i) => (
                    <text key={i} x={[0, 80, 160, 240][i]} y="115" fontSize="9" fill="#7A7269">
                      {String(s?.slot || '').replace(/[()]/g, '').split(' ')[0] || ''}
                    </text>
                  ))}
                </svg>
                {(hourlyPeak?.range || hourlyAvoid?.range) && (
                  <div className="hour-legend">
                    {hourlyPeak?.range && (
                      <><span className="sw" style={{ background: '#B8965A' }} /><span>피크 {hourlyPeak.range}</span></>
                    )}
                    {hourlyAvoid?.range && (
                      <><span className="sw" style={{ background: '#7A7269' }} /><span>주의 {hourlyAvoid.range}</span></>
                    )}
                  </div>
                )}
              </div>
              {hourlyPeak?.reason && (
                <p dangerouslySetInnerHTML={safeHtmlEmph(String(hourlyPeak.reason || '') + (hourlyAvoid?.reason ? ` ${String(hourlyAvoid.reason)}` : ''))} />
              )}
            </section>
          )}

          {/* §04 오늘 만나는 사람 — 데이터 없으면 skeleton */}
          {meetPeople.length === 0 ? (
            <section className={`section ${isOpen('03') ? 'open' : ''}`}>
              <SectionHeader num="03" title="오늘 만나는 사람" han="人緣" id="03" />
              <p className="sec-lead">오행으로 본 오늘의 인연 결. 일간이 무엇인지 모르더라도 행동·분위기로 가늠할 수 있습니다.</p>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #E5DFD0', borderRadius: 12, padding: 14, marginTop: 12, display: 'flex', gap: 12 }}>
                  <div className="skeleton-block" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-block skeleton-line w-30" />
                    <div className="skeleton-block skeleton-line w-90" />
                    <div className="skeleton-block skeleton-line w-80" />
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <section className={`section ${isOpen('03') ? 'open' : ''}`}>
              <SectionHeader num="03" title="오늘 만나는 사람" han="人緣" id="03" />
              <p className="sec-lead">오행으로 본 오늘의 인연 결. 일간이 무엇인지 모르더라도 행동·분위기로 가늠할 수 있습니다.</p>
              <div className="meet-stack">
                {meetPeople.map((m, i) => {
                  const type = String(m?.type || 'boost');
                  const glyphs = Array.isArray(m?.glyphs) ? m.glyphs : [];
                  // 빈 desc fallback (Haiku 가 가끔 비움 — 2026-05-07 사용자 지적)
                  let desc = String(m?.desc || '').trim();
                  if (!desc || desc.length < 20) {
                    const fallbackByType: Record<string, string> = {
                      boost: '<u>차분하고 깊이 있는 분위기</u>의 사람과 만나면 오늘 흐름이 부드러워집니다. <strong>대화 중 무리한 결정은 미루세요</strong>.',
                      clash: '<u>강하고 결단 있는 톤</u>의 사람과는 마찰이 생깁니다. <strong>한 박자 늦추는 게 효율적입니다</strong>.',
                      calm: '<u>실질적이고 안정적인 분위기</u>의 사람과 가벼운 대화·식사가 좋아요. <strong>깊은 결정은 다른 자리에서</strong>.',
                    };
                    desc = fallbackByType[type] || fallbackByType.boost;
                  }
                  return (
                    <div key={i} className={`meet ${type}`}>
                      <div className="badge-orb">
                        {glyphs[0] && <span>{glyphs[0]}</span>}
                        {glyphs[1] && <span style={{ fontSize: 13 }}>{glyphs[1]}</span>}
                      </div>
                      <div>
                        <div className="ti-row">
                          <span className="ti" dangerouslySetInnerHTML={safeHtml(m?.title || '')} />
                          <span className="tag">{String(m?.tag || '')}</span>
                        </div>
                        <div className="ds" dangerouslySetInnerHTML={safeHtmlEmph(desc)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* §05 행동 처방 — 데이터 없으면 skeleton */}
          {!(doList.length > 0 || dontList.length > 0) ? (
            <section className={`section ${isOpen('04') ? 'open' : ''}`}>
              <SectionHeader num="04" title="오늘의 행동 처방" han="處方" id="04" />
              <p className="sec-lead">오늘 결에 맞춰 행동 단위로 정리한 처방. 가볍게 한 가지만 실천해도 흐름이 바뀝니다.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                {[0, 1].map((col) => (
                  <div key={col} style={{ background: '#fff', border: '1px solid #E5DFD0', borderRadius: 12, padding: 14 }}>
                    <div className="skeleton-block skeleton-line w-60" />
                    <div className="skeleton-block skeleton-line w-full" style={{ marginTop: 8 }} />
                    <div className="skeleton-block skeleton-line w-90" />
                    <div className="skeleton-block skeleton-line w-80" />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className={`section ${isOpen('04') ? 'open' : ''}`}>
              <SectionHeader num="04" title="오늘의 행동 처방" han="處方" id="04" />
              <p className="sec-lead">오늘 결에 맞춰 행동 단위로 정리한 처방. 가볍게 한 가지만 실천해도 흐름이 바뀝니다.</p>
              <div className="do-grid">
                <div className="do-col go">
                  <div className="ch">
                    <span className="han-tag">宜</span>
                    오늘 행할 일
                    <span className="count">{doList.length}</span>
                  </div>
                  <ul className="do-list">
                    {doList.map((d, i) => {
                      const action = typeof d === 'string' ? d : (d?.action || '');
                      const when = typeof d === 'string' ? '' : (d?.when || '');
                      const reason = typeof d === 'string' ? '' : (d?.reason || '');
                      return (
                        <li key={i}>
                          <div className="action-row">
                            <span className="action-num">{i + 1}</span>
                            <span className="action-title" dangerouslySetInnerHTML={safeHtml(action || '—')} />
                          </div>
                          {when && <span className="when" dangerouslySetInnerHTML={safeHtml(when)} />}
                          {reason && <span className="reason" dangerouslySetInnerHTML={safeHtmlEmph(reason)} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="do-col no">
                  <div className="ch">
                    <span className="han-tag">忌</span>
                    오늘 삼갈 일
                    <span className="count">{dontList.length}</span>
                  </div>
                  <ul className="do-list">
                    {dontList.map((d, i) => {
                      const action = typeof d === 'string' ? d : (d?.action || '');
                      const when = typeof d === 'string' ? '' : (d?.when || '');
                      const reason = typeof d === 'string' ? '' : (d?.reason || '');
                      return (
                        <li key={i}>
                          <div className="action-row">
                            <span className="action-num">{i + 1}</span>
                            <span className="action-title" dangerouslySetInnerHTML={safeHtml(action || '—')} />
                          </div>
                          {when && <span className="when" dangerouslySetInnerHTML={safeHtml(when)} />}
                          {reason && <span className="reason" dangerouslySetInnerHTML={safeHtmlEmph(reason)} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* §06 럭키 6 — 데이터 없으면 skeleton */}
          {Object.keys(luckyProfile).length === 0 ? (
            <section className={`section ${isOpen('05') ? 'open' : ''}`}>
              <SectionHeader num="05" title="오늘의 럭키" han="吉物" id="05" />
              <p className="sec-lead">한 가지만 곁에 둬도 흐름이 부드러워집니다.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #E5DFD0', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div className="skeleton-block" style={{ width: 24, height: 24, borderRadius: '50%', margin: '0 auto' }} />
                    <div className="skeleton-block skeleton-line w-60" style={{ margin: '8px auto 0', height: 10 }} />
                    <div className="skeleton-block skeleton-line w-80" style={{ margin: '4px auto 0', height: 12 }} />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className={`section ${isOpen('05') ? 'open' : ''}`}>
              <SectionHeader num="05" title="오늘의 럭키" han="吉物" id="05" />
              <p className="sec-lead">한 가지만 곁에 둬도 흐름이 부드러워집니다.</p>
              <div className="lucky-grid">
                {luckyProfile?.color?.name && (
                  <div className="lucky">
                    <div className="ico-wrap"><span className="swatch" style={{ background: luckyProfile.color.hex || '#B8965A' }} /></div>
                    <div className="lab">행운 색</div>
                    <div className="vl">{stripAll(luckyProfile.color.name)}</div>
                  </div>
                )}
                {(luckyProfile?.direction?.value || luckyProfile?.direction) && (
                  <div className="lucky">
                    <div className="ico-wrap"><div className="ico">↑</div></div>
                    <div className="lab">행운 방향</div>
                    <div className="vl">{stripAll(luckyProfile.direction?.value || luckyProfile.direction)}</div>
                  </div>
                )}
                {luckyProfile?.time?.range && (
                  <div className="lucky">
                    <div className="ico-wrap"><div className="ico">⏱</div></div>
                    <div className="lab">행운 시간</div>
                    <div className="vl" style={{ fontFeatureSettings: "'tnum'" }}>{stripAll(luckyProfile.time.range)}</div>
                  </div>
                )}
                {(luckyProfile?.number?.value !== undefined || luckyProfile?.number !== undefined) && (
                  <div className="lucky">
                    <div className="ico-wrap"><div className="ico">◉</div></div>
                    <div className="lab">행운 숫자</div>
                    <div className="vl">{stripAll(luckyProfile.number?.value ?? luckyProfile.number)}</div>
                  </div>
                )}
                {luckyProfile?.food?.name && (
                  <div className="lucky">
                    <div className="ico-wrap"><div className="ico">☕</div></div>
                    <div className="lab">행운 음식</div>
                    <div className="vl">{stripAll(luckyProfile.food.name)}</div>
                  </div>
                )}
                {luckyProfile?.glyph?.value && (
                  <div className="lucky">
                    <div className="ico-wrap"><div className="ico">字</div></div>
                    <div className="lab">행운 글자</div>
                    <div className="vl han">{stripAll(luckyProfile.glyph.value)}</div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* §06 한 문장 + 내일 (이전 §07 · 2026-05-06 v6 reorder) */}
          {!(dailyQuote || tomorrow) ? (
            <section className={`section ${isOpen('06') ? 'open' : ''}`}>
              <SectionHeader num="06" title="오늘의 한 문장" han="日箴" id="06" />
              <div style={{ background: '#fff', border: '1px solid #E5DFD0', borderRadius: 12, padding: 18, marginTop: 14 }}>
                <div className="skeleton-block skeleton-line w-90" style={{ height: 18 }} />
                <div className="skeleton-block skeleton-line w-80" style={{ height: 18, marginTop: 6 }} />
              </div>
              <div style={{ background: '#fff', border: '1px solid #E5DFD0', borderRadius: 12, padding: 12, marginTop: 14, display: 'flex', gap: 10 }}>
                <div className="skeleton-block" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-block skeleton-line w-30" style={{ height: 10 }} />
                  <div className="skeleton-block skeleton-line w-full" style={{ marginTop: 4 }} />
                </div>
              </div>
            </section>
          ) : (
            <section className={`section ${isOpen('06') ? 'open' : ''}`}>
              <SectionHeader num="06" title="오늘의 한 문장" han="日箴" id="06" />
              {dailyQuote && <div className="pullq" dangerouslySetInnerHTML={safeHtml(dailyQuote)} />}
            </section>
          )}

          {/* §07 4영역 점수 (CTA) — 맨 아래 이동 (사용자 요청 2026-05-06 v6)
              "재물·관계·일·건강 깊이 보기" CTA. 유저가 콘텐츠 다 읽은 후 자연스러운 진입 자리. */}
          {/* 2026-09-17 — 스켈레톤은 생성 중에만. 생성이 끝났는데 subScores 가 없으면 아래 카드(점수 '—')로 대체해
              '더 깊이 보기' 진입이 사라지지 않게 */}
          {!hasSubScores && isGenerating && (
            <section className={`section ${isOpen('07') ? 'open' : ''}`}>
              <SectionHeader num="07" title="오늘 4개의 결" han="四運" id="07" />
              <div className="topic-grid">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-card" style={{ marginTop: 14, padding: 14 }}>
                    <div className="skeleton-block skeleton-title" />
                    <div className="skeleton-block skeleton-line w-30" />
                    <div className="skeleton-block skeleton-line w-90" />
                  </div>
                ))}
              </div>
            </section>
          )}
          {(hasSubScores || !isGenerating) && (
            <section className={`section ${isOpen('07') ? 'open' : ''}`}>
              <SectionHeader num="07" title="오늘 4개의 결" han="四運" id="07" />
              <p className="sec-lead">
                {hasSubScores
                  ? '각 영역을 더 깊이 보고 싶다면 카드를 눌러주세요.'
                  : '이번 풀이에는 영역별 점수가 담기지 않았어요. 궁금한 영역을 눌러 더 깊이 볼 수 있어요.'}
              </p>
              <div className="topic-grid">
                {[
                  { cls: 't-money', nm: '재물', han: '財', key: 'wealth' as const, cta: '재물운 깊이 보기' },
                  { cls: 't-rel', nm: '관계', han: '緣', key: 'love' as const, cta: '관계·연애운 깊이 보기' },
                  { cls: 't-work', nm: '일', han: '業', key: 'career' as const, cta: '직업·진로운 깊이 보기' },
                  { cls: 't-health', nm: '건강', han: '身', key: 'health' as const, cta: '건강·체질운 깊이 보기' },
                ].map((t) => {
                  // 2026-09-17 — 카드 하나가 여러 주제로 이어지므로 묶음 실제 최저가 기준 표기 ("1운~")
                  const price = groupPriceLabel(t.key);
                  const score10 = get10(t.key);
                  return (
                  <button
                    key={t.key}
                    type="button"
                    className={`topic-card ${t.cls}`}
                    onClick={() => onTopicClick?.(t.key)}
                    aria-label={`${t.nm} 깊이 보기 (${price})`}
                  >
                    <div className="head">
                      <span className="nm">{t.nm}</span>
                      <span className="han">{t.han}</span>
                    </div>
                    <div className="score-row">
                      <span className="score">{score10}</span>
                      {score10 !== '—' && <span className="score-max">/10</span>}
                    </div>
                    <div className="one-liner" dangerouslySetInnerHTML={safeHtmlEmph(subScoreOneLines?.[t.key] || '—')} />
                    <div className="cta-text"><span>{t.cta}</span><span className="cost-pill">{price}</span></div>
                  </button>
                  );
                })}
              </div>

              {/* §07 마무리: closing 메시지 + 내일 미리보기 (사용자 요청 2026-05-07 v7)
                  "내일도 만나요" close 와 tomorrow 카드는 의미상 짝 — §07 안에 붙임 */}
              <div className="closing-note">
                <div className="closing-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <div className="closing-title">오늘 풀이는 여기까지예요</div>
                  <div className="closing-sub">내일도 새로운 결로 다시 만나요.</div>
                </div>
              </div>
              {tomorrow && (
                <div className="tomorrow tomorrow-v2">
                  <div className="tomorrow-head">
                    <span className="lab">TOMORROW · 내일</span>
                    {typeof tomorrow.scoreHint === 'number' && (
                      <div className="score-chip">
                        <span className="score-num">{(tomorrow.scoreHint / 10).toFixed(1)}</span>
                        <span className="score-max">/10</span>
                      </div>
                    )}
                  </div>
                  <div className="tomorrow-date">
                    {tomorrow.date && (() => {
                      try {
                        return <>{String(tomorrow.date).slice(5).replace('-', '월 ')}일</>;
                      } catch { return null; }
                    })()}
                    {tomorrow.ganzi && <> · <strong>{stripAll(tomorrow.ganzi)}일</strong></>}
                  </div>
                  {tomorrow.headline && (
                    <div className="tomorrow-headline" dangerouslySetInnerHTML={safeHtmlEmph(tomorrow.headline)} />
                  )}
                </div>
              )}
            </section>
          )}
        </main>

        {!isGenerating && nextSteps && (
          <div style={{ margin: '4px 16px 22px' }}>{nextSteps}</div>
        )}

        {/* 주간·월간 추천 — 2026-09-17 복구 (2026-05-27 월운 미출시로 제거했으나 주간 5운·월간 7운 2026-06-29 출시).
            오늘 하루 → 이번 주 7일 → 한 달 흐름으로 이어보기. 가격은 pricing SSOT. 생성이 끝난 뒤에만 노출. */}
        {!isGenerating && (
          <section className="upsell upsell-weekly" aria-label="이어서 볼 만한 운세">
            <div className="lab">NEXT · 이번 주 흐름</div>
            <h3>오늘 하루를 봤다면,<br />이번 주 7일도 이어서 볼까요?</h3>
            <p>
              {profile?.name ? `${stripAll(profile.name)}님 사주로` : '내 사주로'} 오늘부터 7일 중 힘을 실어도 좋은 날과
              한 템포 쉬어갈 날을 짚어드려요.
            </p>
            <div className="cta-row">
              <button type="button" className="cta" onClick={onUpsell}>주간운세 보기</button>
              <span className="cost">{extensionCostLabel(getWeeklyPrice())}</span>
            </div>
            {onMonthly && (
              <button type="button" className="sub-link" onClick={onMonthly}>
                <span>한 달 흐름이 궁금하다면 · 월별 운세 보기</span>
                <span className="sub-cost">{extensionCostLabel(getMonthlyPrice())}</span>
              </button>
            )}
          </section>
        )}

        {/* 액션 */}
        <div className="actions">
          <button type="button" className="btn" onClick={onShare}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <div className="ti">친구에게 공유하기</div>
            <div className="sb">결과 카드 송출</div>
          </button>
          <button type="button" className="btn" onClick={onChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <div className="ti">이 주제로 상담 이어가기</div>
            <div className="sb">사주대화</div>
          </button>
        </div>

        <div className="service-notice">
          <p>사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다. 의료·법률·재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.</p>
        </div>
      </div>
    </div>
  );
}
