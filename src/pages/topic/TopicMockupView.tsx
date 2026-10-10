/**
 * TopicMockupView — 10주제 운세 통합 결과 페이지 (DailyMockupView generic화)
 *
 * 출처: docs/design/JDS_Topic_IA.md + DailyMockupView.tsx (mockup 진본 패턴)
 * 작성: 2026-05-07 (사용자 요청 — Option A Phase 1)
 *
 * 정책:
 *  - DailyMockupView 와 동일한 토큰·강조 위계·섹션 카드 패턴
 *  - 주제별 액센트는 Hero stripe + 한자 워터마크 + chip 만 (검정·골드·크림 base 유지)
 *  - 8섹션 골격 (主柱·八字·十神·時運·人緣·處方·吉物·日箴)
 *  - props 기반 React JSX (mockup HTML 임베드 X)
 *  - AI 응답 = TopicResultV2 schema (_topic_themes.ts)
 *
 * 회귀 방지:
 *  - 자유 hex 추가 금지 (TOPIC_THEMES SSOT 만 사용)
 *  - 이모지 0건
 *  - text-[10px] 미만 금지
 *  - <strong>·<u>·<b> 자동 주입은 autoEmphasize 함수가 담당
 */

import { useCallback, useState, useMemo } from 'react';
import { hanjaNum } from '@/components/hanji/Hanji';
import type { SajuProfile } from '@/services/storage/localStore';
import type { OhengType } from '@/types/saju';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { STEM_INFO, BRANCH_INFO } from '@/utils/sajuStemBranch';
import {
  type TopicTheme,
  type TopicResultV2,
  type TimelineType,
} from './_topic_themes';
import { getPremiumPrice } from '@/constants/pricing';

/* ══════════════════════════════════════════════════════════════════
 * Helpers — DailyMockupView 의 강조 자동 주입 패턴 재사용
 * ═════════════════════════════════════════════════════════════════ */

const safeHtml = (text: any): { __html: string } => ({ __html: sanitizeAiText(String(text ?? '')) });

const stripAll = (text: any): string =>
  stripMd(String(text ?? '')).replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^<>]*>/g, '');

/** 자동 강조 — DailyMockupView 와 1:1 동기화 (시기·방위·색 → <u> · 결론 → <strong>) */
function autoEmphasize(input: string): string {
  if (!input) return input;
  let text = String(input);
  const hasUnderline = /<u>/i.test(text);

  if (!hasUnderline) {
    text = text.replace(
      /(?<!<u>)(오전|오후|저녁|밤|새벽|아침)\s*\d+(?:\s*[~∼-]\s*\d+)?\s*시(?:\s*이후)?/g,
      '<u>$&</u>'
    );
    text = text.replace(/(?<!<u>)(?<!\d)\d{1,2}\s*[~∼-]\s*\d{1,2}\s*시/g, '<u>$&</u>');
    text = text.replace(
      /(?<!<u>)(동남쪽|동북쪽|서남쪽|서북쪽|동쪽|서쪽|남쪽|북쪽|동남방|동북방|서남방|서북방)/g,
      '<u>$1</u>'
    );
    text = text.replace(
      /(?<!<u>)(짙은 파란색|진한 파란색|연한 녹색|밝은 빨강|짙은 검은색|남보라|보라색|주황색|연두색|검은색|검정색|파란색|초록색|노란색|갈색|남색|회색|빨강|파랑|초록|노랑|검정|흰색|은색|금색)/g,
      '<u>$1</u>'
    );
  }

  // 문장 분할 (strong·em 공유)
  const splitSentences = (t: string) => t.split(/(?<=[다요네][.!?])\s+/);

  // 주의/경고 절 → <em> (번트오렌지). 2026-05-29 — DailyMockupView 와 1:1 동기화.
  if (!/<em>/i.test(text)) {
    const cautionTrigger = /주의|조심|피하|삼가|위험|긴장|갈등|충돌|불안|악화|심화|예민|상처|마찰|소진|과부하|무리|경계/;
    const sentences = splitSentences(text);
    let emCount = 0;
    const emPhrases: string[] = [];
    for (const s of sentences) {
      if (emCount >= 2) break;
      if (!cautionTrigger.test(s)) continue;
      const clean = s.trim().replace(/[.!?]+$/, '');
      const lastComma = clean.lastIndexOf(',');
      let seg = lastComma !== -1 ? clean.slice(lastComma + 1).trim() : clean;
      if (!cautionTrigger.test(seg) || seg.length < 8 || seg.length > 46) {
        if (clean.length >= 8 && clean.length <= 46 && cautionTrigger.test(clean)) seg = clean;
        else continue;
      }
      if (/[<>]/.test(seg)) continue;
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

  if (!/<strong>/i.test(text) && text.length >= 50) {
    const sentences = splitSentences(text);
    const conclusionEndings = [
      '(?:날|시간|자리|결|순간|것|점|곳|쪽|무기|핵심|정답|답|이유|방법|시점|구간|기회|신호|중심|기준|기억|감각|선택|순서|과제|상태|경향|특징|의미|시기|부분|영역|타이밍|강점|장점)\\s*(?:이에요|예요|입니다|이다|네요)',
      '(?:하세요|미루세요|집중하세요|정리하세요|만나세요|배치하세요|챙기세요|준비하세요|확인하세요|시도하세요|체크하세요|넘기세요|놓치지 마세요|유지하세요|시작하세요|마무리하세요|머물러 보세요|꺼내세요|살펴보세요|믿으세요|들어보세요|찾으세요|보충하세요|모으세요|끌어당기세요)',
      '(?:게 좋아요|필수예요|필요해요|중요해요|좋습니다|중요합니다|필요합니다|효율적입니다|적절합니다|좋은 자리예요|어울려요|솟아오릅니다|강화합니다|극대화됩니다|커집니다|높습니다|좋아집니다|수월합니다|핵심 과제입니다)',
    ];
    const conclusionPattern = new RegExp(
      `([가-힣\\sA-Za-z0-9~()]{8,32}(?:${conclusionEndings.join('|')}))[.!?]?$`
    );

    let strongCount = 0;
    const replacements: Array<{ phrase: string }> = [];
    for (const sentence of sentences) {
      if (strongCount >= 2) break;
      const clean = sentence.trim().replace(/[.!?]+$/, '');
      const lastCommaIdx = clean.lastIndexOf(',');
      const segment = lastCommaIdx !== -1 ? clean.slice(lastCommaIdx + 1).trim() : clean;
      if (/[<>]/.test(segment)) continue;
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

const safeHtmlEmph = (text: any): { __html: string } => ({
  __html: sanitizeAiText(autoEmphasize(String(text ?? ''))),
});

/* ══════════════════════════════════════════════════════════════════
 * MOCKUP CSS — DailyMockupView SSOT 토큰 + 주제색 액센트 변수 (--c-topic)
 * ═════════════════════════════════════════════════════════════════ */
const MOCKUP_CSS = `
.topic-mockup * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
.topic-mockup {
  font-family: 'Pretendard', sans-serif; color: #1A1612; letter-spacing: -0.01em; background: #F4EFE4;
  /* 2026-10-10 v9 한지 톤 — 먹과 종이 (src/styles/hanji.css 와 같은 값, 보조 글자 대비 5:1) */
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
  --c-mok: #4E7A57; --c-hwa: #B04A38; --c-to: #B07F38; --c-geum: #7D7870; --c-su: #3E5F82;
  --c-mok-soft: rgba(78,122,87,0.10); --c-hwa-soft: rgba(176,74,56,0.10);
  --c-to-soft: rgba(176,127,56,0.10); --c-geum-soft: rgba(74,74,74,0.10); --c-su-soft: rgba(62,95,130,0.10);
}
.topic-mockup .page { max-width: 480px; margin: 0 auto; background: var(--c-paper); }

/* Header — 검정 base + 주제색 좌측 stripe (3px) + 한자 워터마크 (주제색 0.10) */
.topic-mockup .hd {
  position: relative; overflow: hidden;
  padding: 20px 22px 30px; color: #F8F5EE;
}
.topic-mockup .hd::before {
  display: none; /* 2026-10-10 v9 — 큰 한자 워터마크 제거 (AI 같은 장식) */
  content: attr(data-han);
  position: absolute; right: -20px; bottom: -50px;
  font-family: 'Noto Serif KR', serif; font-size: 240px; font-weight: 900;
  color: var(--c-topic-accent); opacity: 0.10;
  line-height: 1; letter-spacing: -0.05em; pointer-events: none;
}
.topic-mockup .hd .top { display: flex; align-items: center; gap: 8px; font-size: 11px; flex-wrap: wrap; position: relative; }
.topic-mockup .hd .badge {
  background: rgba(184,150,90,0.20);
  border: 1px solid rgba(184,150,90,0.40);
  padding: 4px 12px; border-radius: 100px;
  font-size: 11px; font-weight: 700; color: #F4D166;
  letter-spacing: 0.02em;
}
.topic-mockup .hd .tier {
  background: rgba(248,245,238,0.10);
  padding: 4px 10px; border-radius: 100px;
  font-size: 10px; color: #F8F5EE; opacity: 0.85;
}
.topic-mockup .hd .name { margin-left: auto; font-size: 11px; opacity: 0.7; color: #E8DAB8; }
.topic-mockup .hd h1 {
  font-family: 'Noto Serif KR', serif;
  font-size: 26px; font-weight: 700; margin-top: 16px;
  letter-spacing: -0.02em; line-height: 1.4;
  position: relative; color: #FFFEF8;
}
.topic-mockup .hd .meta {
  font-size: 12px; opacity: 0.7; margin-top: 6px;
  position: relative; color: #E8DAB8;
  font-feature-settings: 'tnum';
}

/* My Saju mini — DailyMockupView 패턴 동기화 (4-cell + 일주 강조) */
.topic-mockup .my-saju {
  margin: 16px 16px 0; background: #FFFFFF;
  border: 1px solid var(--c-card-line); border-radius: 14px;
  padding: 14px 14px 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}
.topic-mockup .my-saju .ttl {
  font-size: 11px; color: var(--c-gold-deep); letter-spacing: 0.15em;
  font-weight: 700; margin-bottom: 10px;
  font-family: 'Noto Serif KR', serif;
}
.topic-mockup .saju-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center;
}
.topic-mockup .saju-cell {
  background: var(--c-paper); border-radius: 8px; padding: 10px 4px;
  border: 1px solid transparent; position: relative;
}
.topic-mockup .saju-cell.ilju {
  background: linear-gradient(180deg, var(--c-gold-soft), rgba(184,150,90,0.04));
  border-color: var(--c-gold-line);
}
.topic-mockup .saju-cell.key::after {
  content: attr(data-key);
  position: absolute; top: -7px; right: -2px;
  background: var(--c-topic-accent-dark); color: #FFFFFF;
  font-family: 'Noto Serif KR', serif; font-size: 9px; font-weight: 700;
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  line-height: 1;
}
.topic-mockup .saju-cell .lab { font-size: 9.5px; color: var(--c-mute); margin-bottom: 4px; }
.topic-mockup .saju-cell .gan, .topic-mockup .saju-cell .ji {
  font-family: 'Noto Serif KR', serif; font-weight: 700; line-height: 1.1;
}
.topic-mockup .saju-cell .gan { font-size: 18px; }
.topic-mockup .saju-cell .ji { font-size: 14px; margin-top: 4px; }
.topic-mockup .saju-cell .read { display: block; font-size: 9.5px; color: var(--c-mute); margin-top: 1px; font-weight: 500; font-family: 'Pretendard', sans-serif; }
.topic-mockup .saju-cell .ten { font-size: 9px; color: var(--c-topic-accent-dark); margin-top: 4px; font-weight: 600; }
.topic-mockup .gan.o-mok, .topic-mockup .ji.o-mok { color: var(--c-mok); }
.topic-mockup .gan.o-hwa, .topic-mockup .ji.o-hwa { color: var(--c-hwa); }
.topic-mockup .gan.o-to,  .topic-mockup .ji.o-to  { color: var(--c-to); }
.topic-mockup .gan.o-geum,.topic-mockup .ji.o-geum{ color: var(--c-geum); }
.topic-mockup .gan.o-su,  .topic-mockup .ji.o-su  { color: var(--c-su); }

/* 2026-05-28 — 결론박스 좌측 strip 제거 (AI 손톱 디자인). 한자 워터마크(::after) + 컬러 텍스트로 톤 표현. */
.topic-mockup .conclusion {
  margin: 14px 16px 0;
  background: linear-gradient(135deg, #FFFEF8 0%, #FAF6EC 100%);
  border-radius: 14px; padding: 20px 20px 22px;
  border: 1px solid var(--c-card-line);
  position: relative; overflow: hidden;
  box-shadow: 0 4px 16px rgba(184,150,90,0.10);
}
.topic-mockup .conclusion::after {
  display: none; /* 2026-10-10 v9 워터마크 제거 */
  content: attr(data-han); position: absolute; right: -12px; bottom: -36px;
  font-family: 'Noto Serif KR', serif; font-size: 200px; font-weight: 900;
  color: var(--c-topic-accent); opacity: 0.06; line-height: 1; pointer-events: none;
}
.topic-mockup .conclusion .lb {
  font-family: 'Noto Serif KR', serif; font-size: 11px; font-weight: 700;
  color: var(--c-gold-deep); letter-spacing: 0.14em; margin-bottom: 10px; position: relative;
}
.topic-mockup .conclusion .body {
  font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 700;
  color: var(--c-ink); line-height: 1.65; margin: 0; position: relative;
  word-break: keep-all; letter-spacing: -0.01em;
}
.topic-mockup .conclusion .ref {
  font-size: 12px; color: #5C4220; line-height: 1.6; margin: 12px 0 0;
  position: relative; word-break: keep-all;
  padding-top: 10px; border-top: 1px solid var(--c-card-line);
}

/* Body sections — DailyMockupView 동일 패턴 */
.topic-mockup .body { padding: 22px 16px 0; }
.topic-mockup .section {
  margin-top: 14px; background: var(--c-surface);
  border: 1px solid var(--c-card-line); border-radius: 14px;
  overflow: hidden; transition: all 0.2s;
}
.topic-mockup .section:first-of-type { margin-top: 0; }
.topic-mockup .section-header {
  display: flex; align-items: center; gap: 10px; padding: 16px 18px;
  cursor: pointer; background: var(--c-surface);
  border: none; width: 100%; text-align: left; appearance: none; font: inherit;
  transition: background 0.2s;
}
.topic-mockup .section-header:hover { background: var(--c-paper); }
.topic-mockup .section-header .sec-num {
  font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 900;
  color: #A23A2A; letter-spacing: 0; min-width: 18px; margin-right: 2px;
}
.topic-mockup .section-header .sec-title {
  font-family: 'Noto Serif KR', serif; font-size: 17.5px; font-weight: 700;
  color: var(--c-ink); flex: 1;
}
.topic-mockup .section-header .sec-title .han {
  color: var(--c-mute); font-weight: 500; margin-left: 8px; font-size: 13px; letter-spacing: .1em;
}
.topic-mockup .section-header .chevron {
  width: 20px; height: 20px; color: var(--c-mute); transition: transform 0.25s; flex-shrink: 0;
}
.topic-mockup .section.open .section-header .chevron { transform: rotate(180deg); color: var(--c-gold); }
.topic-mockup .section.open .section-header { border-bottom: 1px dashed var(--c-card-line); }
.topic-mockup .section:not(.open) > *:not(.section-header) { display: none !important; }
.topic-mockup .section.open > *:not(.section-header) { padding-left: 18px; padding-right: 18px; }
.topic-mockup .section.open > *:last-child { padding-bottom: 18px; }
.topic-mockup .section.open > .sec-lead:first-of-type { padding-top: 14px; }

.topic-mockup .sec-lead { font-size: 13.5px; color: var(--c-mute); margin-top: 4px; line-height: 1.55; }
.topic-mockup .body p {
  font-size: 15.5px; line-height: 1.85; color: #2a2520; margin: 10px 0 0; word-break: keep-all;
}
.topic-mockup .body p strong, .topic-mockup .body strong:not(.no-emph) {
  font-weight: 700; color: var(--c-gold-deep);
  background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.32) 55%);
  padding: 0 3px; border-radius: 2px;
}
.topic-mockup .body p u, .topic-mockup .body u {
  text-decoration: underline; text-decoration-color: var(--c-gold);
  text-decoration-thickness: 2px; text-underline-offset: 3px;
  color: var(--c-ink); font-weight: 600;
}
.topic-mockup .body p b, .topic-mockup .body b {
  font-weight: 700; color: var(--c-ink); font-family: 'Noto Serif KR', serif;
}
/* <em> = 주의와 경고 (번트오렌지) — 2026-05-29. 황금 형광펜과 대비. font-style normal (한글 가독). */
.topic-mockup .body p em, .topic-mockup .body em,
.topic-mockup .reason em, .topic-mockup .ds em {
  font-style: normal; font-weight: 700; color: #A23A2A;
  background: linear-gradient(180deg, transparent 56%, rgba(162,58,42,.15) 56%);
  padding: 0 2px; border-radius: 2px;
}

/* §02 八字 highlights — 주제 specific glyph chips */
.topic-mockup .saju-hl {
  display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0;
}
.topic-mockup .saju-hl .chip {
  background: var(--c-topic-accent-soft);
  border: 1px solid var(--c-topic-accent-soft);
  color: var(--c-topic-accent-dark);
  padding: 5px 10px; border-radius: 100px;
  font-size: 11.5px; font-weight: 600;
  font-family: 'Noto Serif KR', serif;
}

/* §03 十神 4축 분포 — 막대 + 카운트 */
.topic-mockup .sip-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 0;
}
.topic-mockup .sip-cell {
  background: var(--c-paper); border-radius: 10px; padding: 10px 6px;
  border: 1px solid var(--c-card-line); text-align: center;
}
.topic-mockup .sip-cell .nm {
  font-family: 'Noto Serif KR', serif; font-size: 12px; font-weight: 700;
  color: var(--c-ink); margin-bottom: 4px;
}
.topic-mockup .sip-cell .ct {
  font-family: 'Noto Serif KR', serif; font-size: 22px; font-weight: 700;
  color: var(--c-topic-accent-dark); line-height: 1;
}
.topic-mockup .sip-cell .lvl {
  font-size: 10px; font-weight: 600; color: var(--c-gold-deep);
  margin-top: 4px; letter-spacing: 0.04em;
}
.topic-mockup .sip-cell.lv-강함 .lvl { color: var(--c-mok); }
.topic-mockup .sip-cell.lv-보통 .lvl { color: var(--c-gold-deep); }
.topic-mockup .sip-cell.lv-약함 .lvl { color: var(--c-mute); }
.topic-mockup .sip-cell.lv-부족 .lvl { color: var(--c-hwa); }
/* 2026-05-28 — 좌측 strip 제거. 배경 톤만으로 callout 표현. */
.topic-mockup .sip-interp {
  margin: 12px 0 0; padding: 12px 14px;
  background: var(--c-gold-soft); border-radius: 8px;
  font-size: 12.5px; line-height: 1.7; color: var(--c-ink-soft);
}

/* §04 時運 timeline */
.topic-mockup .tl-12m {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin: 14px 0 0;
}
.topic-mockup .tl-cell {
  background: var(--c-paper); border-radius: 6px; padding: 8px 2px;
  border: 1px solid var(--c-card-line); text-align: center;
  font-size: 10.5px; color: var(--c-mute);
}
.topic-mockup .tl-cell.best {
  background: var(--c-topic-accent-soft);
  border-color: var(--c-topic-accent);
}
.topic-mockup .tl-cell .slot { font-weight: 700; color: var(--c-ink); font-size: 11px; }
.topic-mockup .tl-cell .score { font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700; color: var(--c-topic-accent-dark); margin-top: 2px; }
.topic-mockup .tl-cell.best .score { color: var(--c-topic-accent-dark); }

.topic-mockup .tl-3stage {
  display: flex; flex-direction: column; gap: 10px; margin: 14px 0 0;
}
.topic-mockup .tl-stage {
  background: #FFF; border: 1px solid var(--c-card-line);
  border-radius: 12px; padding: 12px 14px;
  display: grid; grid-template-columns: 50px 1fr; gap: 12px; align-items: center;
}
.topic-mockup .tl-stage .num {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--c-topic-accent-soft);
  border: 1px solid var(--c-topic-accent);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700;
  color: var(--c-topic-accent-dark);
}
.topic-mockup .tl-stage .ti {
  font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700; color: var(--c-ink);
}
.topic-mockup .tl-stage .ds { font-size: 12px; color: var(--c-ink-soft); margin-top: 4px; line-height: 1.6; }

/* §05 人緣 meet stack — DailyMockupView 동기화 */
.topic-mockup .meet-stack { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.topic-mockup .meet {
  background: #fff; border: 1px solid var(--c-card-line); border-radius: 12px;
  padding: 14px; display: grid; grid-template-columns: 52px 1fr; gap: 12px; align-items: flex-start;
}
.topic-mockup .meet .badge-orb {
  width: 52px; height: 52px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Noto Serif KR', serif; font-size: 13px; font-weight: 700;
  color: var(--c-gold-deep); text-align: center; line-height: 1.1; flex-direction: column;
  background: rgba(184,150,90,0.10); border: 1px solid rgba(184,150,90,0.30);
}
/* 2026-05-28 — badge-orb 좌측 컬러 strip 제거 (AI 디자인 티). 컬러 톤은 .tag chip 으로 충분히 표현됨. */
.topic-mockup .meet .ti-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.topic-mockup .meet .ti { font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700; color: var(--c-ink); }
.topic-mockup .meet .tag { font-size: 10.5px; padding: 2px 8px; border-radius: 100px; font-weight: 700; }
.topic-mockup .meet.boost .tag { background: var(--c-mok-soft); color: var(--c-mok); }
.topic-mockup .meet.clash .tag { background: var(--c-hwa-soft); color: var(--c-hwa); }
.topic-mockup .meet.calm  .tag { background: rgba(184,150,90,.14); color: var(--c-gold-deep); }
.topic-mockup .meet .ds { font-size: 12.5px; color: #2a2520; line-height: 1.7; margin-top: 6px; }

/* §06 處方 do/dont — DailyMockupView 동기화 */
.topic-mockup .do-grid { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
.topic-mockup .do-col {
  background: var(--c-surface); border: 1px solid var(--c-card-line);
  border-radius: 14px; overflow: hidden;
}
.topic-mockup .do-col .ch {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Noto Serif KR', serif; font-size: 14px; font-weight: 700;
  padding: 12px 14px; color: var(--c-ink);
  background: var(--c-paper); border-bottom: 1px solid var(--c-card-line);
}
.topic-mockup .do-col.go .ch { background: rgba(184,150,90,0.08); }
.topic-mockup .do-col .ch .han-tag {
  font-family: 'Noto Serif KR', serif;
  width: 26px; height: 26px; border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--c-gold); color: #fff; font-size: 13px; font-weight: 800;
}
.topic-mockup .do-col.no .ch .han-tag {
  background: transparent; border: 1.5px solid var(--c-gold-deep); color: var(--c-gold-deep);
}
.topic-mockup .do-list { list-style: none; padding: 0; margin: 0; }
.topic-mockup .do-list li {
  padding: 12px 14px; border-bottom: 1px solid var(--c-card-line);
  display: grid; grid-template-columns: 22px 1fr; gap: 10px;
}
.topic-mockup .do-list li:last-child { border-bottom: none; }
.topic-mockup .do-list li .num {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--c-gold-soft); color: var(--c-gold-deep);
  font-family: 'Noto Serif KR', serif; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.topic-mockup .do-list li .ti {
  font-size: 13.5px; font-weight: 700; color: var(--c-ink); margin-bottom: 4px;
}
.topic-mockup .do-list li .when {
  display: inline-block; font-size: 10.5px; padding: 2px 7px; border-radius: 100px;
  background: var(--c-topic-accent-soft); color: var(--c-topic-accent-dark);
  margin-left: 6px; font-weight: 600;
}
.topic-mockup .do-list li .ds { font-size: 12px; color: var(--c-ink-soft); line-height: 1.6; }

/* §07 吉物 lucky 6 grid */
.topic-mockup .lucky-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0 0;
}
.topic-mockup .lucky-cell {
  background: #fff; border: 1px solid var(--c-card-line);
  border-radius: 10px; padding: 12px;
}
.topic-mockup .lucky-cell .lb {
  font-size: 10.5px; color: var(--c-gold-deep); letter-spacing: 0.12em;
  font-weight: 700; margin-bottom: 6px; font-family: 'Noto Serif KR', serif;
}
.topic-mockup .lucky-cell .vl {
  font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 700;
  color: var(--c-ink); line-height: 1.4;
}
.topic-mockup .lucky-cell .rs {
  font-size: 11.5px; color: var(--c-ink-soft); margin-top: 6px; line-height: 1.55;
}

/* §08 日箴 pullquote (2026-05-28 — 좌측 strip 제거. 그라데이션 + 큰 따옴표로 인용 표현) */
.topic-mockup .pullquote {
  margin: 14px 0 0;
  background: linear-gradient(135deg, var(--c-topic-accent-soft), var(--c-gold-soft));
  border-radius: 12px; padding: 30px 22px 18px;
  font-family: 'Noto Serif KR', serif; font-size: 15px;
  line-height: 1.85; color: var(--c-ink); font-weight: 500; word-break: keep-all;
  position: relative;
}
.topic-mockup .pullquote::before {
  content: '"'; position: absolute; top: 6px; left: 16px;
  font-family: 'Noto Serif KR', serif; font-size: 44px; line-height: 1;
  color: var(--c-topic-accent-dark); opacity: 0.28; font-weight: 700;
}

/* Upsell card — 종합사주 유도 */
.topic-mockup .upsell {
  margin: 24px 16px; background: linear-gradient(135deg, #1A1A1A, #2A2018);
  color: #FFF; border-radius: 14px; padding: 22px 20px;
  position: relative; overflow: hidden; cursor: pointer;
  border: none; text-align: left; width: calc(100% - 32px);
  font: inherit;
}
.topic-mockup .upsell::after {
  display: none;
  content: '命'; position: absolute; right: -12px; bottom: -32px;
  font-family: 'Noto Serif KR', serif; font-size: 180px; font-weight: 900;
  color: rgba(184,150,90,0.08); line-height: 1; pointer-events: none;
}
.topic-mockup .upsell .lb {
  font-size: 12.5px; color: #D3C7B4; letter-spacing: 0.04em;
  font-weight: 600; margin-bottom: 8px; position: relative;
}
.topic-mockup .upsell h3 {
  font-family: 'Noto Serif KR', serif; font-size: 17px; font-weight: 700;
  margin-bottom: 8px; line-height: 1.45; color: #FFFEF8; position: relative;
}
.topic-mockup .upsell p {
  font-size: 12.5px; color: #C9B89E; margin-bottom: 14px;
  line-height: 1.65; position: relative; word-break: keep-all;
}
.topic-mockup .upsell .cta {
  display: inline-flex; gap: 6px; align-items: center;
  background: linear-gradient(135deg, #B8965A, #8C6D3D);
  color: #1A1A1A; padding: 10px 18px; border-radius: 100px;
  font-size: 13px; font-weight: 700; position: relative;
}
.topic-mockup .upsell .cta .cost {
  background: rgba(255,255,255,0.10); padding: 3px 10px; border-radius: 100px;
  font-size: 11px; color: #FFFEF8; margin-left: 6px; font-weight: 600;
}

/* Footer 3-part actions */
.topic-mockup .footer-actions {
  margin: 18px 16px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.topic-mockup .footer-actions button {
  background: #FFF; border: 1px solid var(--c-card-line);
  border-radius: 10px; padding: 12px;
  font-size: 12.5px; font-weight: 600; color: var(--c-ink);
  cursor: pointer; font: inherit;
}
.topic-mockup .footer-actions button:hover { background: var(--c-paper); }
`;

/* ══════════════════════════════════════════════════════════════════
 * Helpers — 오행 클래스 매핑 + 십성 카운트 추출
 * ═════════════════════════════════════════════════════════════════ */
function getOhengClass(o?: OhengType | string): string {
  if (!o) return '';
  return o === '목' ? 'o-mok' : o === '화' ? 'o-hwa' : o === '토' ? 'o-to' : o === '금' ? 'o-geum' : o === '수' ? 'o-su' : '';
}

/* ══════════════════════════════════════════════════════════════════
 * Props
 * ═════════════════════════════════════════════════════════════════ */
export interface TopicMockupViewProps {
  theme: TopicTheme;
  profile: SajuProfile;
  result: TopicResultV2 | any; // AI 응답 — TopicResultV2 미충족 시 graceful fallback
  /** Hero 우상단 라벨 (예: "변준기 님") */
  nameLabel?: string;
  /** 1운 / 무료 등 tier 라벨 */
  tierLabel?: string;
  onShare?: () => void;
  onChat?: () => void;
  onUpsell?: () => void;
}

/* ══════════════════════════════════════════════════════════════════
 * 메인 — TopicMockupView
 * ═════════════════════════════════════════════════════════════════ */
export function TopicMockupView(props: TopicMockupViewProps) {
  const { theme, profile, result, nameLabel, tierLabel = '1운', onShare, onChat, onUpsell } = props;

  // 섹션 접기/펼치기 (§01 default open)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['01']));
  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const isOpen = (id: string) => openSections.has(id);
  const SectionHeader = ({ num, title, han, id }: { num: string; title: string; han?: string; id: string }) => (
    <button type="button" className="section-header" onClick={() => toggleSection(id)} aria-expanded={isOpen(id)}>
      <span className="sec-num">{hanjaNum(Number(num))}</span>
      <span className="sec-title">{title}{han && <span className="han">{han}</span>}</span>
      <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );

  // 사주 4기둥
  const pillars = profile?.sajuData?.pillars || [];
  const cells = pillars.length === 4 ? [
    { label: '시', gan: pillars[3]?.천간 || '-', ji: pillars[3]?.지지 || '-', ganO: pillars[3]?.천간오행 as OhengType, jiO: pillars[3]?.지지오행 as OhengType, ilju: false },
    { label: '일 (나)', gan: pillars[2]?.천간 || '-', ji: pillars[2]?.지지 || '-', ganO: pillars[2]?.천간오행 as OhengType, jiO: pillars[2]?.지지오행 as OhengType, ilju: true },
    { label: '월', gan: pillars[1]?.천간 || '-', ji: pillars[1]?.지지 || '-', ganO: pillars[1]?.천간오행 as OhengType, jiO: pillars[1]?.지지오행 as OhengType, ilju: false },
    { label: '연', gan: pillars[0]?.천간 || '-', ji: pillars[0]?.지지 || '-', ganO: pillars[0]?.천간오행 as OhengType, jiO: pillars[0]?.지지오행 as OhengType, ilju: false },
  ] : [];

  // CSS 변수 주입 — 주제색 → --c-topic-accent
  const themeStyle = useMemo(() => ({
    ['--c-topic-accent' as any]: theme.accent,
    ['--c-topic-accent-dark' as any]: theme.accentDark,
    ['--c-topic-accent-soft' as any]: theme.accentSoft,
  }), [theme]);

  // AI 응답 파싱 (graceful fallback) — title 은 현재 sec01Title 로 일관 표기 (theme.sec01Title 사용)
  const oneLine = stripMd(String(result?.oneLineConclusion || result?.oneLineSummary || ''));
  const conclusionRef = stripMd(String(result?.conclusionSajuRef || ''));
  const narrative = stripMd(String(result?.narrative || result?.deepAnalysis || '')).split('\n').filter(Boolean);

  const sajuHighlights: string[] = Array.isArray(result?.sajuHighlights) ? result.sajuHighlights.slice(0, 6) : [];

  const sip = result?.topicSipsung;
  const sipInterpretation = stripMd(String(sip?.interpretation || ''));
  const sipCells = sip ? [
    sip.main, sip.secondary, sip.resistance, sip.aux,
  ].filter(Boolean) : [];

  const timelineType: TimelineType = result?.timeline?.type || theme.timelineType;
  const timelineItems: any[] = Array.isArray(result?.timeline?.items) ? result.timeline.items : [];
  const bestSlots: string[] = Array.isArray(result?.timeline?.bestSlots) ? result.timeline.bestSlots : [];

  const meet = result?.meet;
  const doList: any[] = Array.isArray(result?.doList) ? result.doList.slice(0, 6) : [];
  const dontList: any[] = Array.isArray(result?.dontList) ? result.dontList.slice(0, 6) : [];

  const lucky = result?.lucky;
  const luckyEntries = lucky ? [
    { lb: '색', key: 'color' },
    { lb: '방위', key: 'direction' },
    { lb: '시간', key: 'hour' },
    { lb: '숫자', key: 'number' },
    { lb: '단어', key: 'word' },
    { lb: '음식', key: 'food' },
  ] : [];

  const pullQuote = stripMd(String(result?.pullQuote || ''));
  const upsellLine = stripMd(String(result?.upsellLine || theme.upsellHint));

  return (
    <div className="topic-mockup" style={themeStyle as any}>
      <style dangerouslySetInnerHTML={{ __html: MOCKUP_CSS }} />
      <div className="page">
        {/* Hero — 검정 base + 주제색 stripe + 한자 워터마크 */}
        <header
          className="hd"
          data-han={theme.hanja}
          style={{
            // 2026-10-10 v9 — 주제별 색 그라데이션 → 먹 + 김홍도 「장안사」 (공유마당 만료 저작물) · 전 콘텐츠 같은 머리
            background: "linear-gradient(180deg, rgba(26,22,18,.58) 0%, rgba(26,22,18,.84) 50%, #1A1612 100%), url('/art/jangansa.webp') 40% 45% / cover no-repeat, #1A1612",
          }}
        >
          <div className="top">
            <span className="badge">{theme.label}</span>
            <span className="tier">{tierLabel}</span>
            {nameLabel && <span className="name">{nameLabel}</span>}
          </div>
          <h1>
            {theme.heroH1.line1}
            <br />
            {theme.heroH1.line2}
          </h1>
          {profile?.name && (
            <div className="meta">{profile.name} 님, {theme.sajuRefPrefix}</div>
          )}
        </header>

        {/* 사주 4기둥 미니 카드 */}
        {cells.length === 4 && (
          <div className="my-saju">
            <div className="ttl">내 사주 — {profile?.name || '당신'}</div>
            <div className="saju-grid">
              {cells.map((c, idx) => {
                const ganInfo = STEM_INFO[c.gan];
                const jiInfo = BRANCH_INFO[c.ji];
                return (
                  <div key={idx} className={`saju-cell ${c.ilju ? 'ilju' : ''}`}>
                    <div className="lab">{c.label}</div>
                    <div className={`gan ${getOhengClass(c.ganO)}`}>{c.gan}</div>
                    {ganInfo && <span className="read">{ganInfo.reading}</span>}
                    <div className={`ji ${getOhengClass(c.jiO)}`}>{c.ji}</div>
                    {jiInfo && <span className="read">{jiInfo.reading}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 다크 결론박스 — §01 핵심 결 */}
        {oneLine && (
          <div className="conclusion" data-han={theme.hanja}>
            <div className="lb">◇ 한 줄 결론</div>
            <p className="body" dangerouslySetInnerHTML={safeHtml(oneLine)} />
            {conclusionRef && (
              <p className="ref">— {conclusionRef}</p>
            )}
          </div>
        )}

        {/* Body — 8 sections */}
        <main className="body">
          {/* §01 主柱 — default open */}
          <section className={`section ${isOpen('01') ? 'open' : ''}`}>
            <SectionHeader num="01" title={theme.sec01Title} han={theme.sec01Hanja} id="01" />
            <div className="sec-lead">{theme.sajuRefPrefix} 중심으로 풀어낸 핵심 결</div>
            {narrative.length > 0 ? (
              narrative.map((para, i) => (
                <p key={i} dangerouslySetInnerHTML={safeHtmlEmph(para)} />
              ))
            ) : (
              <p style={{ color: 'var(--c-mute)' }}>분석 결과가 곧 도착합니다.</p>
            )}
          </section>

          {/* §02 八字 — 사주 4기둥 + 주제 specific 인용 */}
          {sajuHighlights.length > 0 && (
            <section className={`section ${isOpen('02') ? 'open' : ''}`}>
              <SectionHeader num="02" title="내 사주 안의 결" han="八字" id="02" />
              <div className="sec-lead">{theme.label}에 직접 영향을 주는 사주 글자</div>
              <div className="saju-hl">
                {sajuHighlights.map((hl, i) => (
                  <span key={i} className="chip" dangerouslySetInnerHTML={safeHtml(hl)} />
                ))}
              </div>
            </section>
          )}

          {/* §03 十神 — 4축 분포 */}
          {sipCells.length === 4 && (
            <section className={`section ${isOpen('03') ? 'open' : ''}`}>
              <SectionHeader num="03" title={`${theme.label} 십성 분포`} han="十神" id="03" />
              <div className="sec-lead">{theme.label}에 직접 영향을 주는 4축 — {theme.sipsungAxes.main}, {theme.sipsungAxes.secondary}, {theme.sipsungAxes.resistance}, {theme.sipsungAxes.aux}</div>
              <div className="sip-grid">
                {sipCells.map((c: any, i: number) => (
                  <div key={i} className={`sip-cell lv-${c?.level || '보통'}`}>
                    <div className="nm">{c?.name || '-'}</div>
                    <div className="ct">{c?.count ?? 0}</div>
                    <div className="lvl">{c?.level || '보통'}</div>
                  </div>
                ))}
              </div>
              {sipInterpretation && (
                <div className="sip-interp" dangerouslySetInnerHTML={safeHtmlEmph(sipInterpretation)} />
              )}
            </section>
          )}

          {/* §04 時運 — timeline (12months / 3stage / semester) */}
          {timelineItems.length > 0 && (
            <section className={`section ${isOpen('04') ? 'open' : ''}`}>
              <SectionHeader num="04" title="시기별 흐름" han="時運" id="04" />
              <div className="sec-lead">
                {timelineType === '12months' && '한 해의 12개월 흐름'}
                {timelineType === '3stage' && '시작, 전환, 결판 3단계'}
                {timelineType === 'semester' && '학기 단위 집중, 정체, 도약'}
              </div>
              {timelineType === '12months' && (
                <div className="tl-12m">
                  {timelineItems.slice(0, 12).map((it, i) => (
                    <div
                      key={i}
                      className={`tl-cell ${bestSlots.includes(it.slot) ? 'best' : ''}`}
                      title={it.message}
                    >
                      <div className="slot">{it.slot}</div>
                      <div className="score">{Math.round(it.score)}</div>
                    </div>
                  ))}
                </div>
              )}
              {(timelineType === '3stage' || timelineType === 'semester') && (
                <div className="tl-3stage">
                  {timelineItems.slice(0, timelineType === 'semester' ? 4 : 3).map((it, i) => (
                    <div key={i} className="tl-stage">
                      <div className="num">{i + 1}</div>
                      <div>
                        <div className="ti">{it.slot}</div>
                        <div className="ds" dangerouslySetInnerHTML={safeHtmlEmph(it.message || '')} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* §05 人緣 — meet 3 cards */}
          {meet && (meet.boost || meet.clash || meet.calm) && (
            <section className={`section ${isOpen('05') ? 'open' : ''}`}>
              <SectionHeader num="05" title={`${theme.label} 인연`} han="人緣" id="05" />
              <div className="sec-lead">도움, 충돌, 평온 — 세 가지 결</div>
              <div className="meet-stack">
                {(['boost', 'clash', 'calm'] as const).map((kind) => {
                  const m = meet[kind];
                  if (!m) return null;
                  const label = theme.meetLabels[kind];
                  const tagText = kind === 'boost' ? '도움' : kind === 'clash' ? '충돌' : '평온';
                  return (
                    <div key={kind} className={`meet ${kind}`}>
                      <div className="badge-orb">
                        <span>{kind === 'boost' ? '助' : kind === 'clash' ? '衝' : '緩'}</span>
                      </div>
                      <div>
                        <div className="ti-row">
                          <span className="ti">{stripAll(m.who) || label}</span>
                          <span className="tag">{tagText}</span>
                        </div>
                        <div className="ds" dangerouslySetInnerHTML={safeHtmlEmph(m.why || '')} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* §06 處方 — Do/Don't */}
          {(doList.length > 0 || dontList.length > 0) && (
            <section className={`section ${isOpen('06') ? 'open' : ''}`}>
              <SectionHeader num="06" title="행동 처방" han="處方" id="06" />
              <div className="sec-lead">{theme.doFocus}</div>
              <div className="do-grid">
                {doList.length > 0 && (
                  <div className="do-col go">
                    <div className="ch">
                      <span className="han-tag">行</span>
                      해야 할 것
                    </div>
                    <ul className="do-list">
                      {doList.map((d, i) => (
                        <li key={i}>
                          <div className="num">{i + 1}</div>
                          <div>
                            <div className="ti">
                              {stripAll(d.title)}
                              {d.when && <span className="when">{d.when}</span>}
                            </div>
                            {d.detail && <div className="ds" dangerouslySetInnerHTML={safeHtmlEmph(d.detail)} />}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {dontList.length > 0 && (
                  <div className="do-col no">
                    <div className="ch">
                      <span className="han-tag">止</span>
                      피할 것
                    </div>
                    <ul className="do-list">
                      {dontList.map((d, i) => (
                        <li key={i}>
                          <div className="num">{i + 1}</div>
                          <div>
                            <div className="ti">
                              {stripAll(d.title)}
                              {d.when && <span className="when">{d.when}</span>}
                            </div>
                            {d.detail && <div className="ds" dangerouslySetInnerHTML={safeHtmlEmph(d.detail)} />}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* §07 吉物 — lucky 6 */}
          {lucky && (
            <section className={`section ${isOpen('07') ? 'open' : ''}`}>
              <SectionHeader num="07" title={`${theme.label} 럭키 6`} han="吉物" id="07" />
              <div className="sec-lead">색, 방위, 시간, 숫자, 단어, 음식</div>
              <div className="lucky-grid">
                {luckyEntries.map((e) => {
                  const v = lucky[e.key as keyof typeof lucky];
                  if (!v) return null;
                  return (
                    <div key={e.key} className="lucky-cell">
                      <div className="lb">{e.lb}</div>
                      <div className="vl">{stripAll((v as any).value)}</div>
                      {(v as any).reason && (
                        <div className="rs" dangerouslySetInnerHTML={safeHtml((v as any).reason)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* §08 日箴 — pullquote + upsell */}
          {pullQuote && (
            <section className={`section ${isOpen('08') ? 'open' : ''}`}>
              <SectionHeader num="08" title="한 문장으로" han="日箴" id="08" />
              <div className="pullquote" dangerouslySetInnerHTML={safeHtmlEmph(pullQuote)} />
            </section>
          )}
        </main>

        {/* Upsell — 종합사주 유도 */}
        {onUpsell && (
          <button type="button" className="upsell" onClick={onUpsell}>
            <div className="lb">종합사주, 열 장</div>
            <h3>{upsellLine || '평생을 사주 전체로 보면'}</h3>
            <p>10가지 결을 한 번에 — 종합사주로 평생의 흐름을 펼쳐 봅니다.</p>
            <span className="cta">
              종합사주로 보기 →
              <span className="cost">{getPremiumPrice().actualPrice}운</span>
            </span>
          </button>
        )}

        {/* Footer 3-part */}
        {(onShare || onChat) && (
          <div className="footer-actions">
            {onShare && <button type="button" onClick={onShare}>결과 공유</button>}
            {onChat && <button type="button" onClick={onChat}>사주대화로 더 묻기</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export default TopicMockupView;
