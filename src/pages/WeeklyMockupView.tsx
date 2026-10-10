/**
 * WeeklyMockupView — 유료 주간운세(이번 주 7일) 결과 v2 (오늘운세급 구조 복제)
 *
 * 진본 템플릿: src/pages/daily/DailyMockupView.tsx (오늘의 운세)
 * 작성: 2026-07-01 (주간운세 결과 페이지를 오늘운세 패턴으로 재구축)
 *
 * 정책 (DailyMockupView 와 동일):
 *  - namespace 한 MOCKUP_CSS 를 <style dangerouslySetInnerHTML> 로 inject (isolated CSS)
 *  - hd(Hero) → my-saju(4기둥, 기본 노출) → ohaeng-row(오행 균형, 기본 노출)
 *    → main.body(SECTION 아코디언 01·02 기본 펼침) → actions → service-notice
 *  - 동적 데이터 = AI 응답(WeeklyDetailResponse) + sajuData (props)
 *  - 강조 SSOT: 형광펜 rgba(184,150,90,.32) · 밑줄 #B8965A · 한자 검정볼드 · 경고 #A23A2A
 *
 * 주간 특색 (오늘운세와 차별):
 *  - 주간색 #8C6D3D (오늘=화/적색 대비)
 *  - 7일 하루하루 리듬 (오늘운세=하루 시간 흐름)
 *  - 과거형 어조: index 0 = 어제(지난 날), index 1 = 오늘, index 2+ = 다가올 날
 *  - recharts AreaChart 7일 score 그래프 + best/caution 핵심일 시각 강조
 *  - Footer CTA: 종합사주 유도 제거 → '사주대화로 더 묻기' + '월운세 보기'(교차)
 */

import { useMemo, useState, useCallback } from 'react';
import { hanjaNum } from '@/components/hanji/Hanji';
import type { LocalReport } from '@/services/storage/localStore';
import type { OhengType } from '@/types/saju';
import type { WeeklyDetailResponse } from '@/types/report';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { autoEmphasize } from '@/utils/emphasis';
import { STEM_INFO, BRANCH_INFO } from '@/utils/sajuStemBranch';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

// HTML 안전 태그(<strong>, <b>, <u> 등) 보존 + XSS 차단
const safeHtml = (text: any): { __html: string } => ({ __html: sanitizeAiText(String(text ?? '')) });
// safeHtml + autoEmphasize 결합 — 모든 AI 본문 출력 통과
const safeHtmlEmph = (text: any): { __html: string } => ({ __html: sanitizeAiText(autoEmphasize(String(text ?? ''))) });
// 모든 HTML 태그 + markdown strip — plain text 자리 (title, name 등)
const stripAll = (text: any): string =>
  stripMd(String(text ?? '')).replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^<>]*>/g, '');

interface WeeklyMockupViewProps {
  result: WeeklyDetailResponse;
  profile: LocalReport;
  periodLabel: string; // "6/30 ~ 7/6"
  refining?: boolean;  // ⚡ async 2차리뷰 — 초안 노출 후 다듬는 중 표시
  onChat: () => void;
  onShare: () => void;
  onMonthly: () => void; // 교차 CTA — 월운세 보기
  monthlyPriceLabel?: string; // 교차 CTA 가격 표기 (예: "7운") — WeeklyPage 가 getMonthlyPrice SSOT 로 계산
}

// 주간 SSOT 색
const ACCENT = '#8C6D3D';

const MOCKUP_CSS = `
.weekly-mockup * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
.weekly-mockup {
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
  /* 주간 테마 색 #8C6D3D */
  --c-week: #8C6D3D; --c-week-deep: #7A5C2E; --c-week-soft: rgba(140,109,61,0.10);
  /* 5 오행 정식 (SajuCard OHENG_THEME 일치) */
  --c-mok: #4E7A57; --c-hwa: #B04A38; --c-to: #B07F38; --c-geum: #7D7870; --c-su: #3E5F82;
  --c-mok-soft: rgba(78,122,87,0.10); --c-hwa-soft: rgba(176,74,56,0.10);
  --c-to-soft: rgba(176,127,56,0.10); --c-geum-soft: rgba(74,74,74,0.10); --c-su-soft: rgba(62,95,130,0.10);
}
.weekly-mockup .page { max-width: 480px; margin: 0 auto; background: var(--c-paper); }

/* Header — 주간 후크 + 기간 + 週 워터마크 */
.weekly-mockup .hd {
  background: linear-gradient(180deg, rgba(26,22,18,.55) 0%, rgba(26,22,18,.82) 45%, #1A1612 100%), url('/art/inwang.webp') 30% 35% / cover no-repeat, #1A1612; /* 2026-10-10 v9 먹 머리 */
  color: #fff; padding: 18px 20px 28px; position: relative; overflow: hidden;
}
.weekly-mockup .hd::before { display: none; content: '週'; position: absolute; right: -10px; bottom: -34px; font-family: 'Noto Serif KR', serif; font-size: 190px; font-weight: 900; color: rgba(255,255,255,.07); line-height: 1; }
.weekly-mockup .hd .top { display: flex; align-items: center; gap: 10px; font-size: 12px; opacity: .92; flex-wrap: wrap; }
.weekly-mockup .hd .badge { background: rgba(255,255,255,.18); padding: 3px 10px; border-radius: 100px; font-size: 11px; }
.weekly-mockup .hd .span-tag { background: rgba(255,255,255,.22); color: #fff8ef; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; margin-left: auto; }
.weekly-mockup .hd h1 { font-family: 'Noto Serif KR', serif; font-size: 24px; font-weight: 700; margin-top: 14px; letter-spacing: -0.02em; line-height: 1.4; position: relative; word-break: keep-all; }
.weekly-mockup .hd .date { font-size: 12px; opacity: .85; margin-top: 6px; font-feature-settings: 'tnum'; position: relative; }
.weekly-mockup .hd .kw-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; position: relative; }
.weekly-mockup .hd .kw {
  display: inline-flex; align-items: center;
  padding: 4px 10px;
  background: rgba(255,255,255,0.16);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 100px;
  font-size: 11px; font-weight: 600;
  color: rgba(255,255,255,0.95);
}

/* My Saju mini card — DailyMockupView 와 동일 패턴 */
.weekly-mockup .my-saju {
  margin: 16px 20px 0; background: var(--c-surface);
  border-radius: 14px; padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
  border: 1px solid var(--c-card-line);
}
.weekly-mockup .my-saju .ttl { font-size: 11px; color: var(--c-week-deep); letter-spacing: 0.15em; font-weight: 700; margin-bottom: 12px; }
.weekly-mockup .saju-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.weekly-mockup .saju-cell {
  display: flex; flex-direction: column; gap: 4px;
  border-radius: 10px; padding: 6px 4px;
  background: var(--c-paper);
  border: 1px solid var(--c-card-line);
}
.weekly-mockup .saju-cell.ilju {
  background: var(--c-gold-soft);
  border: 2px solid var(--c-gold);
  box-shadow: 0 2px 8px rgba(184,150,90,0.18);
  padding: 5px 3px;
}
.weekly-mockup .saju-cell .lab {
  font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
  color: var(--c-mute); text-align: center; margin-bottom: 2px;
}
.weekly-mockup .saju-cell.ilju .lab { color: var(--c-gold-deep); }
.weekly-mockup .saju-cell .gan,
.weekly-mockup .saju-cell .ji {
  font-family: 'Noto Serif KR', serif;
  line-height: 1; text-align: center;
  border-radius: 8px;
  border: 1.5px solid transparent;
  color: #fff;
  padding: 8px 2px 6px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
.weekly-mockup .saju-cell .gan .han,
.weekly-mockup .saju-cell .ji .han { font-size: 24px; font-weight: 800; line-height: 1; }
.weekly-mockup .saju-cell .ji .han { font-size: 20px; }
.weekly-mockup .saju-cell .gan .read,
.weekly-mockup .saju-cell .ji .read {
  font-size: 11px; font-weight: 700; opacity: 0.85;
  letter-spacing: 0.05em; font-family: 'Pretendard', sans-serif;
}
.weekly-mockup .saju-cell .gan-meaning,
.weekly-mockup .saju-cell .ji-meaning {
  font-size: 11px; color: var(--c-mute); font-weight: 600;
  text-align: center; line-height: 1.2; font-family: 'Pretendard', sans-serif;
}
.weekly-mockup .saju-cell.ilju .gan-meaning,
.weekly-mockup .saju-cell.ilju .ji-meaning { color: var(--c-gold-deep); }
.weekly-mockup .gan.mok,  .weekly-mockup .ji.mok   { background: var(--c-mok); border-color: var(--c-mok); }
.weekly-mockup .gan.hwa,  .weekly-mockup .ji.hwa   { background: var(--c-hwa); border-color: var(--c-hwa); }
.weekly-mockup .gan.to,   .weekly-mockup .ji.to    { background: var(--c-to); border-color: var(--c-to); color: #1A1A1A; }
.weekly-mockup .gan.geum, .weekly-mockup .ji.geum  { background: var(--c-surface); border-color: var(--c-card-line); color: var(--c-geum); }
.weekly-mockup .gan.su,   .weekly-mockup .ji.su    { background: #1A1A1A; border-color: #1A1A1A; }
.weekly-mockup .saju-cell.ilju .gan,
.weekly-mockup .saju-cell.ilju .ji { box-shadow: 0 2px 4px rgba(0,0,0,0.10); }

/* Oheng row — DailyMockupView chip 패턴 */
.weekly-mockup .ohaeng-row { margin: 12px 20px 0; background: var(--c-surface); border-radius: 14px; padding: 16px; border: 1px solid var(--c-card-line); }
.weekly-mockup .ohaeng-row .ttl { font-size: 11px; color: var(--c-week-deep); letter-spacing: 0.15em; font-weight: 700; margin-bottom: 6px; }
.weekly-mockup .ohaeng-row .lead { font-size: 12px; color: var(--c-mute); margin-bottom: 14px; line-height: 1.5; }
.weekly-mockup .ohaeng-bal { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.weekly-mockup .ob-item {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 100px;
  background: var(--c-surface);
  border: 1.5px solid var(--c-card-line);
  font-family: 'Noto Serif KR', serif;
  white-space: nowrap;
}
.weekly-mockup .ob-item.mok  { background: var(--c-mok-soft);  border-color: var(--c-mok); }
.weekly-mockup .ob-item.hwa  { background: var(--c-hwa-soft);  border-color: var(--c-hwa); }
.weekly-mockup .ob-item.to   { background: var(--c-to-soft);   border-color: var(--c-to); }
.weekly-mockup .ob-item.geum { background: var(--c-geum-soft); border-color: var(--c-geum); }
.weekly-mockup .ob-item.su   { background: var(--c-su-soft);   border-color: var(--c-su); }
.weekly-mockup .ob-item .glyph { font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 800; line-height: 1; }
.weekly-mockup .ob-item.mok  .glyph { color: var(--c-mok); }
.weekly-mockup .ob-item.hwa  .glyph { color: var(--c-hwa); }
.weekly-mockup .ob-item.to   .glyph { color: var(--c-to); }
.weekly-mockup .ob-item.geum .glyph { color: var(--c-geum); }
.weekly-mockup .ob-item.su   .glyph { color: var(--c-su); }
.weekly-mockup .ob-item.lack .glyph { opacity: 0.4; }
.weekly-mockup .ob-item .qty {
  font-family: 'Pretendard', sans-serif;
  font-size: 13px; font-weight: 700;
  color: var(--c-ink); font-feature-settings: 'tnum';
}
.weekly-mockup .ob-item.lack { opacity: 0.5; }
.weekly-mockup .ob-item.lack .qty::after { content: ' 부족'; font-size: 11px; color: var(--c-hwa); font-weight: 700; margin-left: 2px; }

/* Body + SECTION 아코디언 (DailyMockupView 동일) */
.weekly-mockup .body { padding: 22px 20px 0; }
.weekly-mockup .section {
  margin-top: 16px;
  background: var(--c-surface);
  border: 1px solid var(--c-card-line);
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.2s;
}
.weekly-mockup .section:first-of-type { margin-top: 0; }
.weekly-mockup .section-header {
  display: flex; align-items: center; gap: 10px;
  padding: 16px 18px; cursor: pointer;
  background: var(--c-surface);
  border: none; width: 100%;
  text-align: left; appearance: none; font: inherit;
  transition: background 0.2s;
}
.weekly-mockup .section-header:hover { background: var(--c-paper); }
.weekly-mockup .section-header .sec-num {
  font-family: 'Noto Serif KR', serif;
  font-size: 16px; font-weight: 900;
  color: #A23A2A; letter-spacing: 0;
  min-width: 18px; margin-right: 2px;
}
.weekly-mockup .section-header .sec-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 16px; font-weight: 700;
  color: var(--c-ink); flex: 1;
}
.weekly-mockup .section-header .sec-title .han {
  color: var(--c-week-deep); font-weight: 500;
  margin-left: 6px; font-size: 13px;
}
.weekly-mockup .section-header .chevron {
  width: 20px; height: 20px; color: var(--c-mute);
  transition: transform 0.25s; flex-shrink: 0;
}
.weekly-mockup .section.open .section-header .chevron { transform: rotate(180deg); color: var(--c-week); }
.weekly-mockup .section.open .section-header { border-bottom: 1px dashed var(--c-card-line); }
.weekly-mockup .section:not(.open) > *:not(.section-header) { display: none !important; }
.weekly-mockup .section.open > *:not(.section-header) { padding-left: 18px; padding-right: 18px; }
.weekly-mockup .section.open > *:last-child { padding-bottom: 18px; }
.weekly-mockup .section.open > .sec-lead:first-of-type { padding-top: 14px; }
.weekly-mockup .sec-lead { font-size: 12px; color: var(--c-mute); margin-top: 4px; line-height: 1.55; }
.weekly-mockup .body p { font-size: 14.5px; line-height: 1.85; color: #2a2520; margin: 10px 0 0; word-break: keep-all; }

/* 강조 위계 통일 (DailyMockupView SSOT) */
.weekly-mockup .body p strong,
.weekly-mockup .body strong:not(.no-emph),
.weekly-mockup .ds strong {
  font-weight: 700; color: var(--c-gold-deep);
  background: linear-gradient(180deg, transparent 55%, rgba(184,150,90,.32) 55%);
  padding: 0 3px; border-radius: 2px;
}
.weekly-mockup .body p u,
.weekly-mockup .body u,
.weekly-mockup .ds u {
  text-decoration: underline; text-decoration-color: var(--c-gold);
  text-decoration-thickness: 2px; text-underline-offset: 3px;
  color: var(--c-ink); font-weight: 600;
}
.weekly-mockup .body p b,
.weekly-mockup .body b {
  font-weight: 700; color: var(--c-ink); font-family: 'Noto Serif KR', serif;
}
.weekly-mockup .body p em,
.weekly-mockup .body em,
.weekly-mockup .ds em,
.weekly-mockup .reason em {
  font-style: normal; font-weight: 700; color: #A23A2A;
  background: linear-gradient(180deg, transparent 56%, rgba(162,58,42,.15) 56%);
  padding: 0 2px; border-radius: 2px;
}
.weekly-mockup .body p .han { font-family: 'Noto Serif KR', serif; color: var(--c-ink-soft); font-size: 13px; }

/* §01 이번 7일의 결 — 큰 후크 + 테마 */
.weekly-mockup .week-hook { font-family: 'Noto Serif KR', serif; font-size: 17px; font-weight: 700; color: #1a1a1a; margin-top: 8px; line-height: 1.5; word-break: keep-all; }

/* §02 주간 리듬 그래프 */
.weekly-mockup .week-chart { margin: 14px 0 0; background: #fff; border-radius: 12px; padding: 14px; border: 1px solid var(--c-card-line); }
.weekly-mockup .week-chart .ttl { font-size: 11px; color: var(--c-week-deep); letter-spacing: 0.15em; font-weight: 700; margin-bottom: 4px; }
.weekly-mockup .week-chart .sub { font-size: 11px; color: var(--c-mute); margin-bottom: 8px; }
.weekly-mockup .week-chart .chart-wrap { width: 100%; height: 150px; margin: 0 -6px; }

/* §02 요일별 카드 stack */
.weekly-mockup .day-stack { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.weekly-mockup .day-card {
  background: #fff; border: 1px solid var(--c-card-line); border-radius: 12px;
  padding: 14px; transition: all .2s; position: relative;
}
.weekly-mockup .day-card.is-today { border: 2px solid var(--c-week); box-shadow: 0 2px 10px rgba(140,109,61,0.16); }
.weekly-mockup .day-card.is-past { opacity: 0.78; background: linear-gradient(180deg, #fff 0%, #FBF8F2 100%); }
.weekly-mockup .day-card .day-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.weekly-mockup .day-card .day-head-left { display: flex; align-items: center; gap: 10px; }
.weekly-mockup .day-card .day-orb {
  width: 40px; height: 40px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Noto Serif KR', serif; font-size: 18px; font-weight: 900;
  flex-shrink: 0;
}
.weekly-mockup .day-card .day-meta { display: flex; flex-direction: column; gap: 2px; }
.weekly-mockup .day-card .day-date-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.weekly-mockup .day-card .day-date { font-family: 'Noto Serif KR', serif; font-size: 15px; font-weight: 700; color: #1a1a1a; }
.weekly-mockup .day-card .day-ganji { font-family: 'Noto Serif KR', serif; font-size: 11px; font-weight: 600; color: var(--c-mute); }
.weekly-mockup .day-card .day-when {
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 100px; letter-spacing: 0.02em;
}
.weekly-mockup .day-card .day-when.past   { background: rgba(122,114,105,0.12); color: var(--c-mute); }
.weekly-mockup .day-card .day-when.today   { background: var(--c-week); color: #fff; }
.weekly-mockup .day-card .day-when.future { background: var(--c-week-soft); color: var(--c-week-deep); border: 1px solid rgba(140,109,61,0.30); }
.weekly-mockup .day-card .day-tone { font-size: 11.5px; color: var(--c-mute); margin-top: 1px; }
.weekly-mockup .day-card .day-score { font-family: 'Noto Serif KR', serif; font-size: 22px; font-weight: 800; line-height: 1; }
.weekly-mockup .day-card .day-body { font-size: 13px; color: #2a2520; line-height: 1.7; margin-top: 8px; word-break: keep-all; }
.weekly-mockup .day-card .day-action {
  margin-top: 10px; padding: 9px 12px; border-radius: 10px;
  background: var(--c-week-soft);
  font-size: 12px; font-weight: 600; color: var(--c-week-deep);
  line-height: 1.5; word-break: keep-all;
}
.weekly-mockup .day-card .day-action .arr { font-weight: 800; margin-right: 4px; }

/* §03 핵심일 (best/caution) */
.weekly-mockup .keyday-stack { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.weekly-mockup .keyday {
  border-radius: 12px; padding: 14px 16px;
  border: 1px solid transparent;
}
.weekly-mockup .keyday.best    { background: var(--c-week-soft); border-color: rgba(140,109,61,0.26); }
.weekly-mockup .keyday.caution { background: rgba(176,74,56,0.05); border-color: rgba(176,74,56,0.20); }
.weekly-mockup .keyday .kd-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.weekly-mockup .keyday .kd-badge { font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 100px; color: #fff; letter-spacing: 0.04em; }
.weekly-mockup .keyday.best    .kd-badge { background: var(--c-week); }
.weekly-mockup .keyday.caution .kd-badge { background: #B04A38; }
.weekly-mockup .keyday .kd-day { font-family: 'Noto Serif KR', serif; font-size: 16px; font-weight: 800; }
.weekly-mockup .keyday.best    .kd-day { color: var(--c-week-deep); }
.weekly-mockup .keyday.caution .kd-day { color: #A23A2A; }
.weekly-mockup .keyday .kd-date { font-size: 11px; color: var(--c-mute); font-feature-settings: 'tnum'; }
.weekly-mockup .keyday .kd-reason { font-size: 12.5px; color: #2a2520; line-height: 1.7; word-break: keep-all; }

/* §04 이번 주 교훈 (pullquote 톤) */
.weekly-mockup .lesson {
  background: linear-gradient(135deg, rgba(140,109,61,.07), rgba(184,150,90,.08));
  border-radius: 10px; padding: 30px 20px 18px; margin-top: 14px;
  font-family: 'Noto Serif KR', serif; font-size: 14.5px; line-height: 1.8; color: #1a1a1a;
  font-weight: 500; word-break: keep-all; position: relative;
}
.weekly-mockup .lesson::before { content: '"'; position: absolute; top: 6px; left: 14px; font-family: 'Noto Serif KR', serif; font-size: 42px; line-height: 1; color: rgba(140,109,61,0.30); font-weight: 700; }
.weekly-mockup .lesson strong { color: var(--c-week-deep); font-weight: 700; background: linear-gradient(180deg, transparent 55%, rgba(140,109,61,.22) 55%); padding: 0 3px; }

/* Actions + notice (DailyMockupView 동일) */
.weekly-mockup .actions { margin: 22px 20px 0; padding: 18px 0; border-top: 1px solid var(--c-card-line); display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.weekly-mockup .actions .btn { background: #fff; border: 1px solid var(--c-card-line); border-radius: 12px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: #1a1a1a; cursor: pointer; transition: .2s; appearance: none; font: inherit; }
.weekly-mockup .actions .btn:hover { border-color: var(--c-week); }
.weekly-mockup .actions .btn svg { width: 22px; height: 22px; color: var(--c-week); }
.weekly-mockup .actions .btn .ti { font-size: 12.5px; font-weight: 600; }
.weekly-mockup .actions .btn .sb { font-size: 11px; color: var(--c-mute); }

.weekly-mockup .share-btn {
  margin: 16px 20px 0; width: calc(100% - 40px);
  background: linear-gradient(135deg, var(--c-week) 0%, var(--c-week-deep) 100%);
  color: #fff; border: none; border-radius: 12px; padding: 14px;
  font-size: 14px; font-weight: 700; cursor: pointer; appearance: none; font-family: inherit;
}

.weekly-mockup .service-notice { margin: 22px 20px 0; padding: 14px 18px; border-top: 1px dashed var(--c-card-line); font-size: 11px; line-height: 1.65; color: #9A8B70; text-align: center; letter-spacing: .01em; }
.weekly-mockup .service-notice .src { color: var(--c-mute); margin-bottom: 6px; }

/* ⚡ async 2차리뷰 — "다듬는 중" 표시 (초안→최종 스왑 예고) */
.weekly-mockup .refining-pill {
  margin: 12px 20px 0; padding: 9px 14px; border-radius: 100px;
  background: rgba(140,109,61,0.10); border: 1px solid rgba(140,109,61,0.30);
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 600; color: #a05a24;
}
.weekly-mockup .refining-pill .spark { width: 7px; height: 7px; border-radius: 50%; background: #8C6D3D; animation: weekly-refine-pulse 1s infinite; flex-shrink: 0; }
@keyframes weekly-refine-pulse { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
`;

const OHENG_KEY: Record<OhengType, string> = { 목: 'mok', 화: 'hwa', 토: 'to', 금: 'geum', 수: 'su' };
function getOhengClass(o?: OhengType | string): string {
  return OHENG_KEY[(o as OhengType) || '토'] || 'to';
}

/** 점수 → 컬러 밴드 (WeekDayCard 와 동일 정책: 80↑ 주간색 / 60↑ 녹 / 40↑ 골드 / else 적) */
function scoreColor(score: number): string {
  if (score >= 80) return ACCENT;
  if (score >= 60) return '#4E7A57';
  if (score >= 40) return '#8C6D3D';
  return '#B04A38';
}

export function WeeklyMockupView(props: WeeklyMockupViewProps) {
  const { result, profile, periodLabel, refining, onChat, onShare, onMonthly, monthlyPriceLabel } = props;

  // ── 섹션 접기/펼치기 (§01·02 default open — DailyMockupView 통일 정책) ──
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

  // ── 사주 4기둥
  const pillars = profile?.sajuData?.pillars || [];
  const cell = (idx: number) => ({
    gan: pillars[idx]?.천간 || '',
    ji: pillars[idx]?.지지 || '',
    ganO: (pillars[idx]?.천간오행 as OhengType) || '토',
    jiO: (pillars[idx]?.지지오행 as OhengType) || '토',
  });
  const cYear = cell(0), cMonth = cell(1), cDay = cell(2), cHour = cell(3);

  // ── 오행 균형
  const elements = profile?.sajuData?.elements || ({} as Record<OhengType, number>);
  const ohengList = useMemo(() => (
    (['목', '화', '토', '금', '수'] as OhengType[]).map((o) => {
      const qty = Number(elements[o] ?? 0);
      return { oheng: o, qty, lack: qty === 0 };
    })
  ), [elements]);

  // ── AI 스키마 파싱
  const weekHeadline = stripAll(result?.weekHeadline || '이번 7일의 흐름');
  const keywords: string[] = Array.isArray(result?.keywords) ? result.keywords.slice(0, 5) : [];
  const weekTheme = String(result?.weekTheme || '').trim();
  const days = Array.isArray(result?.dailyBreakdown) ? result.dailyBreakdown : [];
  const keyDays = Array.isArray(result?.keyDays) ? result.keyDays : [];
  const weekLesson = String(result?.weekLesson || '').trim();

  // recharts 데이터 — 7일 score 추이
  const chartData = useMemo(
    () => days.map((d) => ({ name: stripAll(d.day), 점수: Math.max(0, Math.min(100, Number(d.score) || 0)) })),
    [days]
  );

  // 과거형 어조 구분: index 0 = 어제(지난 날), index 1 = 오늘, index 2+ = 다가올 날
  // (computeWeekDays 가 i=-1 부터 시작하므로 0번이 어제)
  const dayPhase = (i: number): 'past' | 'today' | 'future' => (i === 0 ? 'past' : i === 1 ? 'today' : 'future');
  const whenLabel: Record<'past' | 'today' | 'future', string> = { past: '지난 날', today: '오늘', future: '다가올 날' };

  return (
    <div className="weekly-mockup">
      <style dangerouslySetInnerHTML={{ __html: MOCKUP_CSS }} />
      <div className="page">
        <header className="hd">
          <div className="top">
            <span className="badge">주간운세</span>
            <span>{profile?.name || '당신'} 님</span>
            <span className="span-tag">오늘부터 7일</span>
          </div>
          <h1 dangerouslySetInnerHTML={safeHtml(weekHeadline)} />
          {periodLabel && <div className="date">오늘부터 7일 · {periodLabel}</div>}
          {keywords.length > 0 && (
            <div className="kw-row">
              {keywords.map((kw, i) => <span key={i} className="kw">{stripAll(kw)}</span>)}
            </div>
          )}
        </header>

        {/* ⚡ async 2차리뷰 — 초안 노출 중, 최종 보정 진행 표시 */}
        {refining && (
          <div className="refining-pill">
            <span className="spark" />
            결과를 더 정교하게 다듬는 중이에요 · 잠시 후 자동으로 완성돼요
          </div>
        )}

        {/* 내 사주 미니 카드 */}
        {pillars.length === 4 && (
          <div className="my-saju">
            <div className="ttl">내 사주 — {profile?.name || '당신'}</div>
            <div className="saju-grid">
              {[
                { ...cHour, lab: '시', ilju: false },
                { ...cDay, lab: '일 (나)', ilju: true },
                { ...cMonth, lab: '월', ilju: false },
                { ...cYear, lab: '연', ilju: false },
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

        {/* 오행 균형 — 이번 7일 흐름의 기운 톤 */}
        {ohengList.some((o) => o.qty > 0) && (
          <div className="ohaeng-row">
            <div className="ttl">내 사주 오행 균형</div>
            <div className="lead">이번 7일의 흐름이 어느 기운 위에서 움직이는지 — 내 사주 5기운의 균형</div>
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
          {/* §01 이번 7일의 결 — weekTheme */}
          <section className={`section ${isOpen('01') ? 'open' : ''}`}>
            <SectionHeader num="01" title="이번 7일의 결" han="週運" id="01" />
            <div className="week-hook" dangerouslySetInnerHTML={safeHtml(weekHeadline)} />
            {weekTheme
              ? weekTheme.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i} dangerouslySetInnerHTML={safeHtmlEmph(para)} />
                ))
              : <p style={{ color: 'var(--c-mute)' }}>이번 주 흐름을 정리하고 있어요.</p>}
          </section>

          {/* §02 요일별 흐름 — 7일 그래프 + 요일별 카드 */}
          <section className={`section ${isOpen('02') ? 'open' : ''}`}>
            <SectionHeader num="02" title="요일별 흐름" han="日歷" id="02" />
            <p className="sec-lead">오늘부터 7일을 하루씩 — 지난 날은 과거형으로, 다가올 날은 미리 짚어드려요.</p>

            {/* 주간 리듬 그래프 */}
            {chartData.length > 0 && (
              <div className="week-chart">
                <div className="ttl">이번 주 흐름</div>
                <div className="sub">7일 점수 추이 (요일별)</div>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 6, right: 8, left: -4, bottom: 0 }} /* 2026-10-10 — left -22 가 Y축(폭 36)을 잘라 '100·75·50' 이 끝자리만 보이던 버그 */>
                      <defs>
                        <linearGradient id="weeklyMockupGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ACCENT} stopOpacity={0.28} />
                          <stop offset="95%" stopColor={ACCENT} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7A7269' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#B5AC9E' }} axisLine={false} tickLine={false} width={36} />
                      <Area type="monotone" dataKey="점수" stroke={ACCENT} strokeWidth={2}
                        fill="url(#weeklyMockupGrad)"
                        dot={{ r: 2.5, fill: ACCENT, strokeWidth: 0 }}
                        activeDot={{ r: 4, fill: ACCENT, stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 요일별 카드 */}
            <div className="day-stack">
              {days.map((d, i) => {
                const score = Math.max(0, Math.min(100, Number(d.score) || 0));
                const sc = scoreColor(score);
                const phase = dayPhase(i);
                return (
                  <div key={`${d.day}-${d.date}-${i}`} className={`day-card ${phase === 'today' ? 'is-today' : phase === 'past' ? 'is-past' : ''}`}>
                    <div className="day-head">
                      <div className="day-head-left">
                        <div className="day-orb" style={{ background: `${sc}14`, color: sc }}>{stripAll(d.day)}</div>
                        <div className="day-meta">
                          <div className="day-date-row">
                            <span className="day-date">{stripAll(d.date)}</span>
                            {d.ganji && <span className="day-ganji">{stripAll(d.ganji)}</span>}
                            <span className={`day-when ${phase}`}>{whenLabel[phase]}</span>
                          </div>
                          {d.tone && <div className="day-tone">{stripAll(d.tone)}</div>}
                        </div>
                      </div>
                      <span className="day-score" style={{ color: sc }}>{score}</span>
                    </div>
                    {d.body && <div className="day-body ds" dangerouslySetInnerHTML={safeHtmlEmph(d.body)} />}
                    {d.action && (
                      <div className="day-action"><span className="arr">→</span>{stripAll(d.action)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* §03 핵심일 — best/caution */}
          <section className={`section ${isOpen('03') ? 'open' : ''}`}>
            <SectionHeader num="03" title="이번 주 핵심일" han="要日" id="03" />
            <p className="sec-lead">이번 7일 중 가장 좋은 날과 한 번쯤 조심하면 좋은 날.</p>
            {keyDays.length > 0 ? (
              <div className="keyday-stack">
                {keyDays.map((k, i) => {
                  const isCaution = k.type === 'caution';
                  return (
                    <div key={i} className={`keyday ${isCaution ? 'caution' : 'best'}`}>
                      <div className="kd-head">
                        <span className="kd-badge">{isCaution ? '주의' : '좋은 날'}</span>
                        <span className="kd-day">{stripAll(k.day)}</span>
                        {k.date && <span className="kd-date">{stripAll(k.date)}</span>}
                      </div>
                      <div className="kd-reason ds" dangerouslySetInnerHTML={safeHtmlEmph(k.reason)} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--c-mute)' }}>이번 주는 큰 기복 없이 평이한 흐름이에요.</p>
            )}
          </section>

          {/* §04 이번 주 교훈 — weekLesson */}
          {weekLesson && (
            <section className={`section ${isOpen('04') ? 'open' : ''}`}>
              <SectionHeader num="04" title="이번 주 교훈" han="週訓" id="04" />
              <div className="lesson" dangerouslySetInnerHTML={safeHtmlEmph(weekLesson)} />
            </section>
          )}
        </main>

        {/* 공유 */}
        <button type="button" className="share-btn" onClick={onShare}>결과 공유하기</button>

        {/* 액션 — 사주대화 + 월운세 교차 (종합사주 유도 제거) */}
        <div className="actions">
          <button type="button" className="btn" onClick={onChat}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            <div className="ti">사주대화로 더 묻기</div>
            <div className="sb">이번 주 흐름을 상담으로</div>
          </button>
          <button type="button" className="btn" onClick={onMonthly}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <div className="ti">월운세 보기</div>
            <div className="sb">한 달 전체의 흐름{monthlyPriceLabel ? ` · ${monthlyPriceLabel}` : ''}</div>
          </button>
        </div>

        <div className="service-notice">
          <p className="src">한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반</p>
          <p>사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다. 의료·법률·재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.</p>
        </div>
      </div>
    </div>
  );
}
