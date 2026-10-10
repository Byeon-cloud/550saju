/**
 * MonthlyMockupView — 월별 운세 결과 v2 (오늘운세 DailyMockupView 패턴 복제)
 *
 * 작성: 2026-07-01 (사용자 요청 — 월운 결과를 오늘운세급 구조로 재구축)
 *
 * 정책 (DailyMockupView 와 100% 동일한 패턴):
 *  - 루트 namespace `.monthly-mockup` + MOCKUP_CSS 를 <style> 로 inject (isolated)
 *  - hd(Hero) → my-saju(4기둥 미니카드) → ohaeng-row(오행 균형) → main.body(SECTION 아코디언) → actions → service-notice
 *  - SectionHeader + openSections state (§01·02 기본 펼침) 아코디언
 *  - 강조: safeHtmlEmph(본문) · safeHtml(헤드라인) · stripAll(순수텍스트)
 *  - 콘텐츠 정체성: 월간 = 한 달 상·중·하순 깊이 (오늘운세 = 하루, 주간운세 = 7일 하루하루)
 *  - 월운색 #A23A2A (CLAUDE.md 톤 SSOT)
 *
 * 데이터: types/report.ts MonthlyDetailResponse
 *   headline·theme·keywords·periods[3]{phase,dateRange,score,body}
 *   wealth/love/career/health{score,body}·luckyDays·cautionDays·gaewoon
 */

import { useMemo, useState, useCallback } from 'react';
import { hanjaNum } from '@/components/hanji/Hanji';
import type { SajuProfile } from '@/services/storage/localStore';
import type { OhengType } from '@/types/saju';
import type { MonthlyDetailResponse, MonthlyPeriod, MonthlyDomain, MonthlyDayNote } from '@/types/report';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { autoEmphasize } from '@/utils/emphasis';
import { STEM_INFO, BRANCH_INFO } from '@/utils/sajuStemBranch';
import { getTopicPrice, formatPriceLabel } from '@/constants/pricing';

/** sanitizeAiText + autoEmphasize 결합 — 모든 AI 본문 출력 통과 */
const safeHtmlEmph = (text: any): { __html: string } => ({
  __html: sanitizeAiText(autoEmphasize(String(text ?? ''))),
});
/** 모든 HTML 태그 + markdown strip — plain text 자리 (title·name 등) */
const stripAll = (text: any): string =>
  stripMd(String(text ?? '')).replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^<>]*>/g, '');

const ACCENT = '#A23A2A'; // 월운 확장색 (CLAUDE.md 톤 SSOT)

interface MonthlyMockupViewProps {
  result: MonthlyDetailResponse;
  profile: SajuProfile;
  monthLabel: string;          // "2026년 7월"
  ilganLabel?: string;         // "갑(甲) 일간"
  loading?: boolean;           // 점진 로딩 — 아직 안 도착한 섹션(M2)은 스켈레톤
  refining?: boolean;          // ⚡ async 2차리뷰 — 초안 노출 후 다듬는 중(곧 갱신됨) 표시
  onShare: () => void;
  onChat: () => void;
  /** 영역별 → 해당 주제운 심층 분석 (재물→wealth·직업→career·애정→love·건강→health). 운 추가 소비 퍼널 */
  onTopic: (topicId: string) => void;
  /** 맨밑 교차 CTA — 주제별 운세 더 보기 (홈 주제 섹션) */
  onTopics: () => void;
}

const MOCKUP_CSS = `
.monthly-mockup * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
.monthly-mockup {
  font-family: 'Pretendard', sans-serif; color: #1A1A1A; letter-spacing: -0.01em; background: #F8F5EE;
  --c-paper: #F8F5EE;
  --c-surface: #FFFFFF;
  --c-ink: #1A1A1A;
  --c-ink-soft: #3D3D3D;
  --c-mute: #7A7269;
  --c-gold: #B8965A;
  --c-gold-deep: #8C6D3D;
  --c-gold-soft: rgba(184,150,90,0.10);
  --c-gold-line: rgba(184,150,90,0.40);
  --c-card-line: rgba(184,150,90,0.18);
  --c-line: #E5DFD0;
  /* 월운 강조색 */
  --c-accent: #A23A2A;
  --c-accent-soft: rgba(162,58,42,0.10);
  --c-accent-line: rgba(162,58,42,0.30);
  /* 5 오행 정식 (SajuCard OHENG_THEME) */
  --c-mok: #4E7A57; --c-hwa: #B04A38; --c-to: #B07F38; --c-geum: #7D7870; --c-su: #3E5F82;
  --c-mok-soft: rgba(78,122,87,0.10); --c-hwa-soft: rgba(176,74,56,0.10);
  --c-to-soft: rgba(176,127,56,0.10); --c-geum-soft: rgba(74,74,74,0.10); --c-su-soft: rgba(62,95,130,0.10);
}
.monthly-mockup .page { max-width: 480px; margin: 0 auto; background: var(--c-paper); }

/* Header — 월운색 그라데이션 + 月 워터마크 */
.monthly-mockup .hd {
  background: linear-gradient(180deg, rgba(26,22,18,.55) 0%, rgba(26,22,18,.82) 45%, #1A1612 100%), url('/art/inwang.webp') 30% 35% / cover no-repeat, #1A1612; /* 2026-10-10 v9 먹 머리 */
  color: #fff; padding: 18px 20px 28px; position: relative; overflow: hidden;
}
.monthly-mockup .hd::before { display: none; content: '月'; position: absolute; right: -16px; bottom: -40px; font-family: 'Noto Serif KR', serif; font-size: 200px; font-weight: 900; color: rgba(255,255,255,.07); line-height: 1; }
.monthly-mockup .hd .top { display: flex; align-items: center; gap: 10px; font-size: 13.5px; opacity: .92; flex-wrap: wrap; }
.monthly-mockup .hd .badge { background: rgba(255,255,255,.18); padding: 3px 10px; border-radius: 100px; font-size: 13px; }
.monthly-mockup .hd .month-tag { background: rgba(255,248,225,.22); color: #F5EBD9; padding: 3px 10px; border-radius: 100px; font-size: 13px; font-weight: 600; margin-left: auto; }
.monthly-mockup .hd h1 { font-family: 'Noto Serif KR', serif; font-size: 25px; font-weight: 700; margin-top: 14px; letter-spacing: -0.02em; line-height: 1.4; position: relative; }
.monthly-mockup .hd .sub { font-size: 13.5px; opacity: .85; margin-top: 6px; position: relative; }
.monthly-mockup .hd .kw-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; position: relative; }
.monthly-mockup .hd .kw {
  display: inline-flex; align-items: center;
  padding: 4px 11px; border-radius: 100px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.24);
  font-size: 13px; color: rgba(255,255,255,0.95); font-weight: 600;
}

/* My Saju mini card — DailyMockupView 와 100% 동일 */
.monthly-mockup .my-saju {
  margin: 16px 20px 0; background: var(--c-surface);
  border-radius: 14px; padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
  border: 1px solid var(--c-card-line);
}
.monthly-mockup .my-saju .ttl { font-size: 13px; color: var(--c-gold); letter-spacing: 0.15em; font-weight: 700; margin-bottom: 12px; }
.monthly-mockup .saju-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.monthly-mockup .saju-cell {
  display: flex; flex-direction: column; gap: 4px;
  border-radius: 10px; padding: 6px 4px;
  background: var(--c-paper);
  border: 1px solid var(--c-card-line);
}
.monthly-mockup .saju-cell.ilju {
  background: var(--c-gold-soft);
  border: 2px solid var(--c-gold);
  box-shadow: 0 2px 8px rgba(184,150,90,0.18);
  padding: 5px 3px;
}
.monthly-mockup .saju-cell .lab {
  font-size: 13px; font-weight: 700; letter-spacing: 0.04em;
  color: var(--c-mute); text-align: center; margin-bottom: 2px;
}
.monthly-mockup .saju-cell.ilju .lab { color: var(--c-gold-deep); }
.monthly-mockup .saju-cell .gan,
.monthly-mockup .saju-cell .ji {
  font-family: 'Noto Serif KR', serif;
  line-height: 1; text-align: center;
  border-radius: 8px;
  border: 1.5px solid transparent;
  color: #fff;
  padding: 8px 2px 6px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.monthly-mockup .saju-cell .gan .han,
.monthly-mockup .saju-cell .ji .han { font-size: 24px; font-weight: 800; line-height: 1; }
.monthly-mockup .saju-cell .ji .han { font-size: 20px; }
.monthly-mockup .saju-cell .gan .read,
.monthly-mockup .saju-cell .ji .read {
  font-size: 13px; font-weight: 700; opacity: 0.85;
  letter-spacing: 0.05em; font-family: 'Pretendard', sans-serif;
}
.monthly-mockup .saju-cell .gan-meaning,
.monthly-mockup .saju-cell .ji-meaning {
  font-size: 13px; color: var(--c-mute); font-weight: 600;
  text-align: center; line-height: 1.2; font-family: 'Pretendard', sans-serif;
}
.monthly-mockup .saju-cell.ilju .gan-meaning,
.monthly-mockup .saju-cell.ilju .ji-meaning { color: var(--c-gold-deep); }
.monthly-mockup .gan.mok,  .monthly-mockup .ji.mok   { background: var(--c-mok); border-color: var(--c-mok); }
.monthly-mockup .gan.hwa,  .monthly-mockup .ji.hwa   { background: var(--c-hwa); border-color: var(--c-hwa); }
.monthly-mockup .gan.to,   .monthly-mockup .ji.to    { background: var(--c-to); border-color: var(--c-to); color: #1A1A1A; }
.monthly-mockup .gan.geum, .monthly-mockup .ji.geum  { background: var(--c-surface); border-color: var(--c-card-line); color: var(--c-geum); }
.monthly-mockup .gan.su,   .monthly-mockup .ji.su    { background: #1A1A1A; border-color: #1A1A1A; }
.monthly-mockup .saju-cell.ilju .gan,
.monthly-mockup .saju-cell.ilju .ji { box-shadow: 0 2px 4px rgba(0,0,0,0.10); }

/* Oheng row — DailyMockupView chip 패턴 */
.monthly-mockup .ohaeng-row { margin: 12px 20px 0; background: var(--c-surface); border-radius: 14px; padding: 16px; border: 1px solid var(--c-card-line); }
.monthly-mockup .ohaeng-row .ttl { font-size: 13px; color: var(--c-gold); letter-spacing: 0.15em; font-weight: 700; margin-bottom: 6px; }
.monthly-mockup .ohaeng-row .lead { font-size: 13.5px; color: var(--c-mute); margin-bottom: 14px; line-height: 1.5; }
.monthly-mockup .ohaeng-bal { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.monthly-mockup .ob-item {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 100px;
  background: var(--c-surface);
  border: 1.5px solid var(--c-card-line);
  font-family: 'Noto Serif KR', serif;
  white-space: nowrap;
}
.monthly-mockup .ob-item.mok  { background: var(--c-mok-soft);  border-color: var(--c-mok); }
.monthly-mockup .ob-item.hwa  { background: var(--c-hwa-soft);  border-color: var(--c-hwa); }
.monthly-mockup .ob-item.to   { background: var(--c-to-soft);   border-color: var(--c-to); }
.monthly-mockup .ob-item.geum { background: var(--c-geum-soft); border-color: var(--c-geum); }
.monthly-mockup .ob-item.su   { background: var(--c-su-soft);   border-color: var(--c-su); }
.monthly-mockup .ob-item .glyph { font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 800; line-height: 1; }
.monthly-mockup .ob-item.mok  .glyph { color: var(--c-mok); }
.monthly-mockup .ob-item.hwa  .glyph { color: var(--c-hwa); }
.monthly-mockup .ob-item.to   .glyph { color: var(--c-to); }
.monthly-mockup .ob-item.geum .glyph { color: var(--c-geum); }
.monthly-mockup .ob-item.su   .glyph { color: var(--c-su); }
.monthly-mockup .ob-item.lack .glyph { opacity: 0.4; }
.monthly-mockup .ob-item .qty {
  font-family: 'Pretendard', sans-serif;
  font-size: 13px; font-weight: 700;
  color: var(--c-ink); font-feature-settings: 'tnum';
}
.monthly-mockup .ob-item.lack { opacity: 0.5; }
.monthly-mockup .ob-item.lack .qty::after { content: ' 부족'; font-size: 13px; color: var(--c-hwa); font-weight: 700; margin-left: 2px; }

/* Body */
.monthly-mockup .body { padding: 22px 20px 0; }
.monthly-mockup .section {
  margin-top: 16px;
  background: var(--c-surface);
  border: 1px solid var(--c-card-line);
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.2s;
}
.monthly-mockup .section:first-of-type { margin-top: 0; }
.monthly-mockup .section-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 18px;
  cursor: pointer;
  background: var(--c-surface);
  border: none; width: 100%;
  text-align: left; appearance: none;
  font: inherit;
  transition: background 0.2s;
}
.monthly-mockup .section-header:hover { background: var(--c-paper); }
.monthly-mockup .section-header .sec-num {
  font-family: 'Noto Serif KR', serif;
  font-size: 16px; font-weight: 900;
  color: #A23A2A; letter-spacing: 0;
  min-width: 18px; margin-right: 2px;
}
.monthly-mockup .section-header .sec-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 16px; font-weight: 700;
  color: var(--c-ink);
  flex: 1;
}
.monthly-mockup .section-header .sec-title .han {
  color: var(--c-accent); font-weight: 500;
  margin-left: 6px; font-size: 13px;
}
.monthly-mockup .section-header .chevron {
  width: 20px; height: 20px;
  color: var(--c-mute);
  transition: transform 0.25s;
  flex-shrink: 0;
}
.monthly-mockup .section.open .section-header .chevron { transform: rotate(180deg); color: var(--c-accent); }
.monthly-mockup .section.open .section-header { border-bottom: 1px dashed var(--c-card-line); }
.monthly-mockup .section:not(.open) > *:not(.section-header) { display: none !important; }
.monthly-mockup .section.open > *:not(.section-header) { padding-left: 18px; padding-right: 18px; }
.monthly-mockup .section.open > *:last-child { padding-bottom: 18px; }
.monthly-mockup .section.open > .sec-lead:first-of-type { padding-top: 14px; }
.monthly-mockup .sec-lead { font-size: 13.5px; color: var(--c-mute); margin-top: 4px; line-height: 1.55; }
.monthly-mockup .body p { font-size: 14.5px; line-height: 1.85; color: #2a2520; margin: 10px 0 0; word-break: keep-all; }

/* 강조 위계 (DailyMockupView 와 동일) */
.monthly-mockup .body p strong,
.monthly-mockup .body strong:not(.no-emph) {
  font-weight: 700;
  color: var(--c-gold-deep);
  background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.32) 55%);
  padding: 0 3px; border-radius: 2px;
}
.monthly-mockup .body p u,
.monthly-mockup .body u {
  text-decoration: underline;
  text-decoration-color: var(--c-gold);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
  color: var(--c-ink);
  font-weight: 600;
}
.monthly-mockup .body p b,
.monthly-mockup .body b {
  font-weight: 700;
  color: var(--c-ink);
  font-family: 'Noto Serif KR', serif;
}
.monthly-mockup .body p em,
.monthly-mockup .body em,
.monthly-mockup .period-body em,
.monthly-mockup .domain-body em,
.monthly-mockup .day-reason em,
.monthly-mockup .gaewoon-body em {
  font-style: normal;
  font-weight: 700;
  color: #A23A2A;
  background: linear-gradient(180deg, transparent 56%, rgba(162,58,42,.15) 56%);
  padding: 0 2px; border-radius: 2px;
}

/* §01 이 달의 결 — theme 본문 */
.monthly-mockup .theme-body { font-size: 14.5px; line-height: 1.85; color: #2a2520; word-break: keep-all; }
.monthly-mockup .theme-body strong { font-weight: 700; color: var(--c-gold-deep); background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.32) 55%); padding: 0 3px; border-radius: 2px; }
.monthly-mockup .theme-body u { text-decoration: underline; text-decoration-color: var(--c-gold); text-decoration-thickness: 2px; text-underline-offset: 3px; color: var(--c-ink); font-weight: 600; }
.monthly-mockup .theme-body em { font-style: normal; font-weight: 700; color: #A23A2A; background: linear-gradient(180deg, transparent 56%, rgba(162,58,42,.15) 56%); padding: 0 2px; border-radius: 2px; }

/* §02 상순, 중순, 하순 흐름 — timeline + score */
.monthly-mockup .period-chart { margin: 14px 0 0; background: #fff; border-radius: 12px; padding: 14px; border: 1px solid var(--c-card-line); }
.monthly-mockup .period-chart .ttl { font-size: 13px; color: var(--c-accent); letter-spacing: 0.15em; font-weight: 700; margin-bottom: 12px; }
.monthly-mockup .period-svg { width: 100%; height: 110px; }
.monthly-mockup .period-stack { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.monthly-mockup .period {
  background: #fff; border: 1px solid var(--c-card-line);
  border-radius: 12px; padding: 14px; overflow: hidden;
}
.monthly-mockup .period .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.monthly-mockup .period .head-l { display: flex; align-items: center; gap: 10px; }
.monthly-mockup .period .phase-orb {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 800;
}
.monthly-mockup .period .phase-name { font-family: 'Noto Serif KR', serif; font-size: 15px; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
.monthly-mockup .period .phase-range { font-size: 13px; color: var(--c-mute); margin-top: 2px; font-feature-settings: 'tnum'; }
.monthly-mockup .period .phase-score { font-family: 'Noto Serif KR', serif; font-size: 22px; font-weight: 800; line-height: 1; }
.monthly-mockup .period .score-bar { height: 6px; border-radius: 100px; overflow: hidden; background: rgba(0,0,0,0.06); margin-bottom: 10px; }
.monthly-mockup .period .score-bar > span { display: block; height: 100%; border-radius: 100px; }
.monthly-mockup .period .period-body { font-size: 13px; line-height: 1.75; color: #2a2520; word-break: keep-all; }
.monthly-mockup .period-body strong { font-weight: 700; color: var(--c-gold-deep); background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.30) 55%); padding: 0 2px; }
.monthly-mockup .period-body u { text-decoration-color: var(--c-gold); text-decoration-thickness: 2px; text-underline-offset: 2px; color: #1a1a1a; font-weight: 600; }

/* §03 영역별 (財官緣壽) — score bar */
.monthly-mockup .domain-stack { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
.monthly-mockup .domain {
  background: #fff; border: 1px solid var(--c-card-line);
  border-radius: 12px; padding: 14px;
  width: 100%; text-align: left; display: block;
  appearance: none; font: inherit; color: inherit; cursor: pointer;
  transition: border-color .18s, box-shadow .18s, transform .12s;
}
.monthly-mockup .domain:hover { border-color: var(--c-accent-line); box-shadow: 0 4px 14px rgba(162,58,42,.08); }
.monthly-mockup .domain:active { transform: scale(0.992); }
.monthly-mockup .domain .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.monthly-mockup .domain .sc-wrap { display: flex; align-items: center; gap: 6px; }
.monthly-mockup .domain .sc-tag {
  font-size: 12px; font-weight: 700; color: var(--c-mute);
  background: var(--c-paper); padding: 2px 7px; border-radius: 100px;
  border: 1px solid var(--c-card-line); white-space: nowrap; letter-spacing: 0.02em;
}
.monthly-mockup .domain .domain-cta {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 12px; padding-top: 11px;
  border-top: 1px dashed var(--c-card-line);
  font-size: 13.5px; font-weight: 700; letter-spacing: -0.01em;
}
.monthly-mockup .domain .domain-cta svg { width: 16px; height: 16px; flex-shrink: 0; }
.monthly-mockup .domain .head-l { display: flex; align-items: center; gap: 8px; }
.monthly-mockup .domain .dot { width: 10px; height: 10px; border-radius: 50%; }
.monthly-mockup .domain .han-chip {
  font-family: 'Noto Serif KR', serif; font-size: 13.5px; font-weight: 700;
  padding: 2px 8px; border-radius: 100px;
}
.monthly-mockup .domain .nm { font-family: 'Noto Serif KR', serif; font-size: 14.5px; font-weight: 700; color: #1a1a1a; }
.monthly-mockup .domain .sc { font-family: 'Noto Serif KR', serif; font-size: 20px; font-weight: 800; line-height: 1; }
.monthly-mockup .domain .bar { height: 6px; border-radius: 100px; overflow: hidden; margin-bottom: 10px; }
.monthly-mockup .domain .bar > span { display: block; height: 100%; border-radius: 100px; }
.monthly-mockup .domain .domain-body { font-size: 13px; line-height: 1.75; color: #2a2520; word-break: keep-all; }
.monthly-mockup .domain-body strong { font-weight: 700; color: var(--c-gold-deep); background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.30) 55%); padding: 0 2px; }
.monthly-mockup .domain-body u { text-decoration-color: var(--c-gold); text-decoration-thickness: 2px; text-underline-offset: 2px; color: #1a1a1a; font-weight: 600; }

/* §04 길일과 주의일 (吉凶日) */
.monthly-mockup .day-stack { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.monthly-mockup .day-note {
  border-radius: 12px; padding: 13px 14px;
  border: 1px solid var(--c-card-line);
}
.monthly-mockup .day-note.lucky { background: var(--c-accent-soft); border-color: var(--c-accent-line); }
.monthly-mockup .day-note.caution { background: rgba(176,74,56,0.05); border-color: rgba(176,74,56,0.22); }
.monthly-mockup .day-note .head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.monthly-mockup .day-note .pill { font-size: 13px; font-weight: 700; padding: 2px 9px; border-radius: 100px; color: #fff; }
.monthly-mockup .day-note.lucky .pill { background: var(--c-accent); }
.monthly-mockup .day-note.caution .pill { background: #B04A38; }
.monthly-mockup .day-note .dt { font-family: 'Noto Serif KR', serif; font-size: 15px; font-weight: 800; font-feature-settings: 'tnum'; }
.monthly-mockup .day-note.lucky .dt { color: var(--c-accent); }
.monthly-mockup .day-note.caution .dt { color: #B04A38; }
.monthly-mockup .day-note .day-reason { font-size: 13.5px; line-height: 1.65; color: #2a2520; word-break: keep-all; }
.monthly-mockup .day-reason strong { font-weight: 700; color: var(--c-gold-deep); background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.30) 55%); padding: 0 2px; }
.monthly-mockup .day-reason u { text-decoration-color: var(--c-gold); text-decoration-thickness: 2px; text-underline-offset: 2px; color: #1a1a1a; font-weight: 600; }

/* §05 개운 처방 (開運) */
.monthly-mockup .gaewoon-card {
  margin-top: 14px;
  background: var(--c-accent-soft);
  border: 1px solid var(--c-accent-line);
  border-radius: 12px;
  padding: 16px;
  position: relative; overflow: hidden;
}
.monthly-mockup .gaewoon-card::before { display: none; content: '開'; position: absolute; right: -8px; bottom: -24px; font-family: 'Noto Serif KR', serif; font-size: 110px; font-weight: 900; color: rgba(162,58,42,.06); line-height: 1; }
.monthly-mockup .gaewoon-card .lab { font-size: 13px; color: var(--c-accent); letter-spacing: 0.12em; font-weight: 700; margin-bottom: 8px; position: relative; }
.monthly-mockup .gaewoon-card .gaewoon-body { font-size: 14px; line-height: 1.8; color: #2a2520; word-break: keep-all; position: relative; }
.monthly-mockup .gaewoon-body strong { font-weight: 700; color: var(--c-gold-deep); background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.32) 55%); padding: 0 3px; border-radius: 2px; }
.monthly-mockup .gaewoon-body u { text-decoration-color: var(--c-gold); text-decoration-thickness: 2px; text-underline-offset: 3px; color: #1a1a1a; font-weight: 600; }

/* Actions — 교차 CTA (사주대화 + 주제별 운세) */
.monthly-mockup .actions { margin: 22px 20px 0; padding: 18px 0; border-top: 1px solid var(--c-card-line); display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.monthly-mockup .actions .btn { background: #fff; border: 1px solid var(--c-card-line); border-radius: 12px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: #1a1a1a; cursor: pointer; transition: .2s; font: inherit; appearance: none; text-align: center; }
.monthly-mockup .actions .btn:hover { background: var(--c-paper); }
.monthly-mockup .actions .btn svg { width: 22px; height: 22px; color: var(--c-accent); }
.monthly-mockup .actions .btn .ti { font-size: 13.5px; font-weight: 600; }
.monthly-mockup .actions .btn .sb { font-size: 13px; color: var(--c-mute); }

/* Share (단일 full-width) */
.monthly-mockup .share-row { margin: 14px 20px 0; }
.monthly-mockup .share-row button {
  width: 100%; appearance: none; border: none; cursor: pointer; font: inherit;
  background: linear-gradient(135deg, var(--c-gold), var(--c-gold-deep));
  color: #fff; border-radius: 12px; padding: 14px;
  font-size: 14px; font-weight: 700; letter-spacing: 0.02em;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.monthly-mockup .share-row button svg { width: 18px; height: 18px; }

.monthly-mockup .service-notice { margin: 22px 20px 0; padding: 14px 18px 28px; border-top: 1px dashed var(--c-card-line); font-size: 13px; line-height: 1.65; color: #9A8B70; text-align: center; letter-spacing: .01em; }
.monthly-mockup .service-notice .src { color: var(--c-mute); margin-bottom: 6px; }

/* 점진 로딩 스켈레톤 — "내용 바뀜"이 아니라 "채워짐" 명확한 placeholder */
.monthly-mockup .skeleton-section .section-header { cursor: default; }
.monthly-mockup .skel-body { padding: 12px 0 4px; }
.monthly-mockup .skel-note { font-size: 13px; color: var(--c-accent); font-weight: 600; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
.monthly-mockup .skel-note .dot-pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--c-accent); animation: monthly-pulse 1s infinite; }
.monthly-mockup .skel-line, .monthly-mockup .skel-card { position: relative; overflow: hidden; background: #ECE6DA; border-radius: 8px; }
.monthly-mockup .skel-line { height: 13px; margin: 9px 0; }
.monthly-mockup .skel-line.w100 { width: 100%; }
.monthly-mockup .skel-line.w80 { width: 82%; }
.monthly-mockup .skel-line.w60 { width: 58%; }
.monthly-mockup .skel-card { height: 62px; margin-top: 14px; border-radius: 12px; }
.monthly-mockup .skel-line::after, .monthly-mockup .skel-card::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.65), transparent);
  transform: translateX(-100%); animation: monthly-shimmer 1.3s infinite;
}
@keyframes monthly-shimmer { 100% { transform: translateX(100%); } }
@keyframes monthly-pulse { 0%,100% { opacity: .3; } 50% { opacity: 1; } }

/* ⚡ async 2차리뷰 — "다듬는 중" 표시 (초안→최종 스왑 예고, 내용 바뀜 혼란 차단) */
.monthly-mockup .refining-pill {
  margin: 12px 20px 0; padding: 9px 14px; border-radius: 100px;
  background: var(--c-gold-soft); border: 1px solid var(--c-gold-line);
  display: flex; align-items: center; gap: 8px;
  font-size: 13.5px; font-weight: 600; color: var(--c-gold-deep);
}
.monthly-mockup .refining-pill .spark { width: 7px; height: 7px; border-radius: 50%; background: var(--c-gold); animation: monthly-pulse 1s infinite; flex-shrink: 0; }
`;

const OHENG_KEY: Record<OhengType, string> = { 목: 'mok', 화: 'hwa', 토: 'to', 금: 'geum', 수: 'su' };
function getOhengClass(o?: OhengType | string): string {
  return OHENG_KEY[(o as OhengType) || '토'] || 'to';
}

/** 점수 → 색 밴드 (월운색 → 녹 → 골드 → 적) */
function scoreColor(score: number): string {
  if (score >= 80) return ACCENT;
  if (score >= 60) return '#4E7A57';
  if (score >= 40) return '#8C6D3D';
  return '#B04A38';
}

export function MonthlyMockupView(props: MonthlyMockupViewProps) {
  const { result, profile, monthLabel, ilganLabel, loading, refining, onShare, onChat, onTopic, onTopics } = props;

  // ── 섹션 접기/펼치기 (§01·02 기본 펼침 — 전 콘텐츠 통일 정책) ──
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
  const SectionHeader = ({ num, title, han, id }: { num: string; title: string; han?: string; id: string }) => (
    <button type="button" className="section-header" onClick={() => toggleSection(id)} aria-expanded={isOpen(id)}>
      <span className="sec-num">{hanjaNum(Number(num))}</span>
      <span className="sec-title">{title}{han && <span className="han">{han}</span>}</span>
      <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );

  // 점진 로딩 — 아직 안 도착한 섹션(주로 M2) 자리 스켈레톤. "내용이 바뀌는" 게 아니라 "채워지는" 명확한 placeholder.
  const SkeletonSection = ({ num, title, han }: { num: string; title: string; han?: string }) => (
    <section className="section open skeleton-section">
      <div className="section-header">
        <span className="sec-num">{hanjaNum(Number(num))}</span>
        <span className="sec-title">{title}{han && <span className="han">{han}</span>}</span>
      </div>
      <div className="skel-body">
        <div className="skel-note"><span className="dot-pulse" />분석을 불러오는 중이에요</div>
        <div className="skel-line w80" /><div className="skel-line w100" /><div className="skel-line w60" />
        <div className="skel-card" />
      </div>
    </section>
  );

  // ── 사주 4기둥
  const pillars = profile?.sajuData?.pillars || [];
  const cells = useMemo(() => {
    const at = (i: number) => ({
      gan: pillars[i]?.천간 || '',
      ji: pillars[i]?.지지 || '',
      ganO: (pillars[i]?.천간오행 as OhengType) || '토',
      jiO: (pillars[i]?.지지오행 as OhengType) || '토',
    });
    return [
      { ...at(3), lab: '시', ilju: false },
      { ...at(2), lab: '일 (나)', ilju: true },
      { ...at(1), lab: '월', ilju: false },
      { ...at(0), lab: '연', ilju: false },
    ];
  }, [pillars]);

  // ── 오행 균형 (sajuData 클라 계산)
  const elements = (profile?.sajuData?.elements || {}) as Record<string, number>;
  const ohengList = useMemo(() => (
    (['목', '화', '토', '금', '수'] as OhengType[]).map((o) => {
      const qty = Number(elements[o] ?? 0);
      return { oheng: o, qty, lack: qty === 0 };
    })
  ), [elements]);

  // ── 데이터 파싱
  const headline = stripAll(result?.headline || '이 달의 흐름');
  const theme = String(result?.theme || '');
  const keywords: string[] = Array.isArray(result?.keywords) ? result.keywords.filter(Boolean) : [];
  const periods: MonthlyPeriod[] = Array.isArray(result?.periods) ? result.periods : [];
  const luckyDays: MonthlyDayNote[] = Array.isArray(result?.luckyDays) ? result.luckyDays : [];
  const cautionDays: MonthlyDayNote[] = Array.isArray(result?.cautionDays) ? result.cautionDays : [];
  const gaewoon = String(result?.gaewoon || '');

  const domains: { key: string; topicId: string; nm: string; han: string; color: string; data?: MonthlyDomain }[] = [
    { key: 'wealth', topicId: 'wealth', nm: '재물운', han: '財', color: '#B8965A', data: result?.wealth },
    { key: 'career', topicId: 'career', nm: '직업운', han: '官', color: '#8C6D3D', data: result?.career },
    { key: 'love', topicId: 'love', nm: '애정운', han: '緣', color: '#8C6D3D', data: result?.love },
    { key: 'health', topicId: 'health', nm: '건강운', han: '壽', color: '#8C6D3D', data: result?.health },
  ].filter((d) => d.data && (d.data.body || typeof d.data.score === 'number'));

  // ── 상중하순 흐름 SVG path (3 점수 → 곡선)
  const periodSvgPath = useMemo(() => {
    if (periods.length !== 3) return null;
    const xs = [40, 160, 280];
    const clamp = (n: number) => Math.min(100, Math.max(0, Number(n) || 0));
    const ys = periods.map((p) => 95 - (clamp(p.score) / 100) * 80); // 점수 높을수록 위
    const pts = xs.map((x, i) => `${x},${ys[i].toFixed(1)}`).join(' L');
    const peakIdx = ys.indexOf(Math.min(...ys));
    return { path: `M0,${ys[0].toFixed(1)} L${pts} L320,${ys[2].toFixed(1)}`, xs, ys, peakX: xs[peakIdx], peakY: ys[peakIdx] };
  }, [periods]);

  return (
    <div className="monthly-mockup">
      <style dangerouslySetInnerHTML={{ __html: MOCKUP_CSS }} />
      <div className="page">
        {/* Hero */}
        <header className="hd">
          <div className="top">
            <span className="badge">월별 운세</span>
            <span>{profile?.name || '당신'} 님</span>
            {monthLabel && <span className="month-tag">{monthLabel}</span>}
          </div>
          <h1>{headline}</h1>
          {(ilganLabel || monthLabel) && (
            <div className="sub">{ilganLabel}{ilganLabel && monthLabel ? ', ' : ''}{monthLabel}</div>
          )}
          {keywords.length > 0 && (
            <div className="kw-row">
              {keywords.slice(0, 4).map((kw, i) => (
                <span key={i} className="kw">{stripAll(kw)}</span>
              ))}
            </div>
          )}
        </header>

        {/* ⚡ async 2차리뷰 — 초안 노출 중, 최종 보정 진행 표시 */}
        {refining && (
          <div className="refining-pill">
            <span className="spark" />
            결과를 더 정교하게 다듬는 중이에요, 잠시 후 자동으로 완성돼요
          </div>
        )}

        {/* 내 사주 미니 카드 */}
        {pillars.length === 4 && (
          <div className="my-saju">
            <div className="ttl">내 사주 — {profile?.name || '당신'}</div>
            <div className="saju-grid">
              {cells.map((p, idx) => {
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

        {/* 오행 균형 */}
        {ohengList.some((o) => o.qty > 0) && (
          <div className="ohaeng-row">
            <div className="ttl">내 사주 오행 균형</div>
            <div className="lead">타고난 5기운의 분포 — 이 달의 흐름이 어느 기운을 건드리는지 함께 읽어보세요.</div>
            <div className="ohaeng-bal">
              {ohengList.map((o) => {
                const glyph = o.oheng === '목' ? '木' : o.oheng === '화' ? '火' : o.oheng === '토' ? '土' : o.oheng === '금' ? '金' : '水';
                return (
                  <div key={o.oheng} className={`ob-item ${getOhengClass(o.oheng)} ${o.lack ? 'lack' : ''}`}>
                    <div className="glyph">{glyph}</div>
                    <div className="qty">{o.qty}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <main className="body">
          {/* §01 이 달의 결 — theme */}
          <section className={`section ${isOpen('01') ? 'open' : ''}`}>
            <SectionHeader num="01" title="이번 달의 결" han="月運" id="01" />
            <p className="sec-lead">이 달이 당신에게 어떤 한 달인지, 핵심 테마부터 짚어드려요.</p>
            {theme ? (
              <div className="theme-body" dangerouslySetInnerHTML={safeHtmlEmph(theme)} />
            ) : loading ? (
              <div className="skel-body"><div className="skel-note"><span className="dot-pulse" />분석을 불러오는 중이에요</div><div className="skel-line w80" /><div className="skel-line w100" /><div className="skel-line w60" /></div>
            ) : (
              <p className="sec-lead">이 달의 테마를 준비 중이에요.</p>
            )}
          </section>

          {/* §02 상순·중순·하순 흐름 — periods 3 + timeline/score */}
          {periods.length > 0 ? (
            <section className={`section ${isOpen('02') ? 'open' : ''}`}>
              <SectionHeader num="02" title="상순, 중순, 하순 흐름" han="旬" id="02" />
              <p className="sec-lead">한 달을 셋으로 나눠, 초, 중, 말 어느 구간이 강하고 어디를 다스려야 하는지 한눈에.</p>

              {/* timeline 인포그래픽 (점수 3개 → 곡선) */}
              {periodSvgPath && (
                <div className="period-chart">
                  <div className="ttl">한 달의 활력 흐름</div>
                  <svg className="period-svg" viewBox="0 0 320 110" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="monthlyGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity=".35" />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`${periodSvgPath.path} L320,110 L0,110 Z`} fill="url(#monthlyGrad)" />
                    <path d={periodSvgPath.path} stroke={ACCENT} strokeWidth="2" fill="none" />
                    {periodSvgPath.xs.map((x, i) => (
                      <circle key={i} cx={x} cy={periodSvgPath.ys[i]} r="4" fill="#fff" stroke={ACCENT} strokeWidth="2" />
                    ))}
                    <circle cx={periodSvgPath.peakX} cy={periodSvgPath.peakY} r="5.5" fill={ACCENT} stroke="#fff" strokeWidth="2" />
                    {periods.map((p, i) => (
                      <text key={i} x={periodSvgPath.xs[i]} y="106" fontSize="10" fill="#7A7269" textAnchor="middle" fontWeight="600">
                        {stripAll(p.phase).slice(0, 2)}
                      </text>
                    ))}
                  </svg>
                </div>
              )}

              {/* period 카드 3개 */}
              <div className="period-stack">
                {periods.map((p, i) => {
                  const sc = Math.max(0, Math.min(100, Number(p.score) || 0));
                  const col = scoreColor(sc);
                  return (
                    <div key={i} className="period">
                      <div className="head">
                        <div className="head-l">
                          <div className="phase-orb" style={{ background: `${col}18`, color: col }}>
                            {stripAll(p.phase).slice(0, 2)}
                          </div>
                          <div>
                            <div className="phase-name">{stripAll(p.phase)}</div>
                            {p.dateRange && <div className="phase-range">{stripAll(p.dateRange)}</div>}
                          </div>
                        </div>
                        <div className="phase-score" style={{ color: col }}>{sc}</div>
                      </div>
                      <div className="score-bar"><span style={{ width: `${sc}%`, background: col }} /></div>
                      {p.body && <div className="period-body" dangerouslySetInnerHTML={safeHtmlEmph(p.body)} />}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : loading ? (
            <SkeletonSection num="02" title="상순, 중순, 하순 흐름" han="旬" />
          ) : null}

          {/* §03 영역별 (財官緣壽) — score bar + body */}
          {domains.length > 0 ? (
            <section className={`section ${isOpen('03') ? 'open' : ''}`}>
              <SectionHeader num="03" title="영역별 흐름" han="財官緣壽" id="03" />
              <p className="sec-lead">
                아래 점수는 <span style={{ color: ACCENT, fontWeight: 700 }}>이번 달</span> 흐름이에요.
                영역을 누르면 그 운의 <span style={{ color: ACCENT, fontWeight: 700 }}>전체 흐름</span>까지 더 깊게 풀어드려요.
              </p>
              <div className="domain-stack">
                {domains.map((d) => {
                  const sc = Math.max(0, Math.min(100, Number(d.data?.score) || 0));
                  return (
                    <button type="button" key={d.key} className="domain" onClick={() => onTopic(d.topicId)} aria-label={`${d.nm} 전체 흐름 깊게 보기, ${formatPriceLabel(getTopicPrice(d.topicId))}`}>
                      <div className="head">
                        <div className="head-l">
                          <span className="dot" style={{ background: d.color }} />
                          <span className="nm">{d.nm}</span>
                          <span className="han-chip" style={{ background: `${d.color}1A`, color: d.color }}>{d.han}</span>
                        </div>
                        <div className="sc-wrap">
                          <span className="sc-tag">이번 달</span>
                          <span className="sc" style={{ color: d.color }}>{sc}</span>
                        </div>
                      </div>
                      <div className="bar" style={{ background: `${d.color}1A` }}>
                        <span style={{ width: `${sc}%`, background: d.color }} />
                      </div>
                      {d.data?.body && <div className="domain-body" dangerouslySetInnerHTML={safeHtmlEmph(d.data.body)} />}
                      <div className="domain-cta" style={{ color: d.color }}>
                        {/* 2026-09-17 — 이동 전 가격 표기 (주제운 SSOT getTopicPrice) */}
                        <span>{d.nm} 전체 흐름 깊게 보기, {formatPriceLabel(getTopicPrice(d.topicId))}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : loading ? (
            <SkeletonSection num="03" title="영역별 흐름" han="財官緣壽" />
          ) : null}

          {/* §04 길일·주의일 (吉凶日) */}
          {(luckyDays.length > 0 || cautionDays.length > 0) ? (
            <section className={`section ${isOpen('04') ? 'open' : ''}`}>
              <SectionHeader num="04" title="길일과 주의일" han="吉凶日" id="04" />
              <p className="sec-lead">이 달 안에서 손 내밀기 좋은 날과, 한 박자 늦추는 게 좋은 날.</p>
              <div className="day-stack">
                {luckyDays.map((d, i) => (
                  <div key={`lucky-${i}`} className="day-note lucky">
                    <div className="head">
                      <span className="pill">길일</span>
                      {d.date && <span className="dt">{stripAll(d.date)}</span>}
                    </div>
                    {d.reason && <div className="day-reason" dangerouslySetInnerHTML={safeHtmlEmph(d.reason)} />}
                  </div>
                ))}
                {cautionDays.map((d, i) => (
                  <div key={`caution-${i}`} className="day-note caution">
                    <div className="head">
                      <span className="pill">주의</span>
                      {d.date && <span className="dt">{stripAll(d.date)}</span>}
                    </div>
                    {d.reason && <div className="day-reason" dangerouslySetInnerHTML={safeHtmlEmph(d.reason)} />}
                  </div>
                ))}
              </div>
            </section>
          ) : loading ? (
            <SkeletonSection num="04" title="길일과 주의일" han="吉凶日" />
          ) : null}

          {/* §05 개운 처방 (開運) */}
          {gaewoon ? (
            <section className={`section ${isOpen('05') ? 'open' : ''}`}>
              <SectionHeader num="05" title="이 달의 개운 처방" han="開運" id="05" />
              <div className="gaewoon-card">
                <div className="lab">이 달, 흐름을 부드럽게</div>
                <div className="gaewoon-body" dangerouslySetInnerHTML={safeHtmlEmph(gaewoon)} />
              </div>
            </section>
          ) : loading ? (
            <SkeletonSection num="05" title="이 달의 개운 처방" han="開運" />
          ) : null}
        </main>

        {/* 공유 */}
        <div className="share-row">
          <button type="button" onClick={onShare}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            결과 공유하기
          </button>
        </div>

        {/* 교차 CTA — 사주대화 + 주제별 운세 (종합·주간 유도 제거, 운 추가 소비 퍼널) */}
        <div className="actions">
          <button type="button" className="btn" onClick={onChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <div className="ti">사주대화로 더 묻기</div>
            <div className="sb">이 달의 흐름 상담</div>
          </button>
          <button type="button" className="btn" onClick={onTopics}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <div className="ti">주제별 운세 더 보기</div>
            <div className="sb">연애, 재물, 합격, 사업 …</div>
          </button>
        </div>

        <div className="service-notice">
          <p className="src">한국 명리학 6대 원전(연해자평, 자평진전, 적천수, 궁통보감, 명리약언, 삼명통회) 기반</p>
          <p>사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다. 의료, 법률, 재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.</p>
        </div>
      </div>
    </div>
  );
}
