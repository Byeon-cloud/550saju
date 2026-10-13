// ChatSessionPage — #51 Sprint 2 (C 화면 · /chat/:sessionId)
// 스펙: docs/mockups/사주500_UI개편_06_사주대화.md §6-§10 · §13 · §15
//
// 골격:
//   TopBar 56 → ChatContextBanner 56(접기 32) → MessageStream → SuggestedContentCard → Composer
//
// 보존:
//   - P2-4 quotaExceeded state 분기 (자발적 vs 한도 소진)
//   - 사주대화 Guard 2-layer는 reportGenerator가 보유 (Layer 1 키워드 + Layer 2 schema)
//   - Sonnet 4.6 사주대화 모델 (reportGenerator 호출 변경 0)
//
// UX 라이팅 §15:
//   - "사주를 살피는 중…" (스트리밍 금지)
//   - AI/모델명 0건
//   - 답변은 일괄 렌더

import type { ReactNode } from 'react';
import '@/styles/hanji.css';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { hasNativeNavBack } from '@/lib/env';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  getMyProfile,
  getProfiles,
  type LocalReport,
  type SajuProfile,
} from '@/services/storage/localStore';
import {
  getChatRoom,
  addChatMessage,
  completeChatRoom,
  updateRoomName,
  deleteChatRoom,
  createChatRoom,
  setChatRoomProfileId,
  type ChatMessage,
} from '@/services/storage/chatStore';
import { hasFreePass, useFreePass, restoreFreePass, subscribeFreePass } from '@/services/storage/dailyFreePass';
import { kstToday } from '@/utils/kstDate';
import {
  getChatCredits,
  useChatCredit,
  addChatCredits,
} from '@/services/storage/chatCredit';
import { generateChatAnswer } from '@/services/ai/reportGenerator';
import { trackEvent } from '@/services/analytics';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { autoEmphasize } from '@/utils/emphasis';
import { CHEONGAN_OHENG } from '@/constants/oheng';
import { getTopicPrice, getWeeklyPrice, getMonthlyPrice, formatPriceLabel } from '@/constants/pricing';
import { TOPIC_REGISTRY, normalizeTopicId, type TopicId } from '@/constants/topics';
import { EXTENSION_THEME } from '@/pages/extension/_chrome';

/** AI 문자열 → 순수 텍스트 (markdown + HTML 태그 제거). 인사·배너·컨텍스트 프롬프트용. */
function plainText(s: unknown): string {
  return stripMd(String(s ?? '')).replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^<>]*>/g, '').trim();
}

/** 대화 사주 → 프로필 id. getMyProfile()·보관함 결과는 리포트 id 라 이름·생년월일로 프로필을 역매칭. 못 찾으면 undefined. */
function resolveProfileId(p: SajuProfile | LocalReport | null | undefined): string | undefined {
  if (!p) return undefined;
  const profiles = getProfiles();
  if (p.id && profiles.some((x) => x.id === p.id)) return p.id;
  const i = p.input;
  if (!i) return undefined;
  return profiles.find(
    (x) => x.name === p.name && x.input?.birthYear === i.birthYear && x.input?.birthMonth === i.birthMonth && x.input?.birthDay === i.birthDay,
  )?.id;
}

/** 결과 컨텍스트 배너 — 사용자가 어떤 풀이를 보고 왔는지 시각 확인 (AI 가 진짜 컨텍스트 받았다는 증명) */
function ResultContextBanner({ ctx }: { ctx: any }) {
  if (!ctx || !ctx.type) return null;
  const HAN: Record<string, string> = {
    dream: '夢', daily: '日', topic: '題', premium: '命',
    compat: '合', daeun: '運', monthly: '月', weekly: '週', tojung: '歲',
  };
  const COLORS: Record<string, string> = {
    dream: '#1A1612', daily: '#A23A2A', topic: '#B8965A', premium: '#8C6D3D',
    compat: '#8C6D3D', daeun: '#3B7A4B', monthly: EXTENSION_THEME.monthly.accentDark,
    weekly: EXTENSION_THEME.weekly.accentDark, tojung: '#1A1612',
  };
  const han = HAN[ctx.type] || '解';
  const color = COLORS[ctx.type] || '#B8965A';
  // type 별 요약 텍스트
  let summary: ReactNode = null;
  if (ctx.type === 'dream') {
    summary = (
      <>
        {ctx.category && <div style={{ fontSize: 13, color: 'rgba(248,245,238,0.6)', marginTop: 6 }}>꿈 주제, {ctx.category}</div>}
        {ctx.dreamText && <div style={{ fontSize: 13, color: '#F5EFE0', marginTop: 4, fontStyle: 'normal' }}>"{ctx.dreamText}"</div>}
        {ctx.concern && <div style={{ fontSize: 13.5, color: 'rgba(248,245,238,0.75)', marginTop: 4 }}>요새 고민, {ctx.concern}</div>}
      </>
    );
  } else if (ctx.fullResult?.title) {
    summary = <div style={{ fontSize: 13, color: '#F5EFE0', marginTop: 6, fontFamily: "'Noto Serif KR', serif", fontWeight: 600 }}>{stripMd(String(ctx.fullResult.title))}</div>;
  } else if (ctx.fullResult?.weekHeadline || ctx.fullResult?.headline) {
    // 2026-09-17 — 주간(weekHeadline)·월간(headline) 한 줄 요약
    summary = (
      <>
        <div style={{ fontSize: 13, color: '#F5EFE0', marginTop: 6, fontFamily: "'Noto Serif KR', serif", fontWeight: 600 }}>
          {plainText(ctx.fullResult.weekHeadline || ctx.fullResult.headline)}
        </div>
        {ctx.periodLabel && <div style={{ fontSize: 13, color: 'rgba(248,245,238,0.7)', marginTop: 4 }}>기간, {ctx.periodLabel}</div>}
      </>
    );
  }
  // 2026-10-13 v9 정리 — 콘텐츠별 색 그라데이션과 큰 한자 워터마크(금지 패턴) 제거 → 먹 바탕 한 장 + 작은 낙관
  void color;
  return (
    <div style={{
      background: '#1A1612',
      color: '#F5EFE0', borderRadius: 6, padding: '14px 16px', marginBottom: 8,
      position: 'relative',
    }}>
      <div style={{ position: 'relative', paddingRight: 34 }}>
        <span className="hj-mark" aria-hidden style={{ position: 'absolute', right: 0, top: 0, borderColor: 'rgba(245,237,223,0.55)', color: '#F5EDDF', background: 'transparent' }}>{han}</span>
        <div style={{ fontSize: 13, letterSpacing: '0.15em', fontWeight: 700, color: 'rgba(248,245,238,0.75)' }}>
          이 풀이를 보고 오셨어요
        </div>
        <div style={{ fontSize: 14, fontFamily: "'Noto Serif KR', serif", fontWeight: 700, marginTop: 4 }}>
          {ctx.label || ctx.type}
        </div>
        {summary}
      </div>
    </div>
  );
}

/** 결과 페이지 → 채팅 컨텍스트 prompt 빌더 (AI 가 사용자가 본 결과를 알고 답변).
 *  각 콘텐츠 type 별 핵심 필드를 자연어로 묶어 system-like message 로 prepend. */
function buildContextPrompt(ctx: any, userName: string): string {
  if (!ctx || typeof ctx !== 'object') return '';
  const { type, label, dreamText, concern, category, fullResult } = ctx;
  const lines: string[] = [`[CONTENT_CONTEXT] ${userName} 님은 방금 "${label || type}" 풀이를 보고 채팅에 들어왔습니다.`];
  // 결과 데이터 줄이 실제로 들어갔는지 판정 기준점 — 라벨·기간 같은 메타 줄은 데이터로 세지 않음 (아래 지시문 분기용)
  let dataStart = lines.length;
  if (type === 'dream') {
    if (category) lines.push(`꿈 주제: ${category}`);
    if (dreamText) lines.push(`꿈 내용: "${dreamText}"`);
    if (concern) lines.push(`요새 고민: ${concern}`);
    if (fullResult?.title) lines.push(`풀이 제목: ${stripMd(String(fullResult.title))}`);
    if (fullResult?.verdict) lines.push(`판정: ${stripMd(String(fullResult.verdict))}`);
    if (fullResult?.narrative) lines.push(`첫 인상: ${stripMd(String(fullResult.narrative)).slice(0, 300)}`);
    if (fullResult?.sajuTone) lines.push(`사주 톤: ${stripMd(String(fullResult.sajuTone)).slice(0, 300)}`);
    if (fullResult?.todayConnection) lines.push(`고민 연결: ${stripMd(String(fullResult.todayConnection)).slice(0, 300)}`);
  } else if (type === 'daily') {
    if (fullResult?.title) lines.push(`오늘 제목: ${stripMd(String(fullResult.title))}`);
    if (fullResult?.todayNarrative) lines.push(`오늘 풀이: ${stripMd(String(fullResult.todayNarrative)).slice(0, 400)}`);
    if (fullResult?.scoreHeadline) lines.push(`헤드라인: ${stripMd(String(fullResult.scoreHeadline))}`);
  } else if (type === 'topic') {
    // 2026-05-28 PM 완전 재작성 — user: "결과페이지 점수도 모름" 사건.
    //   AI 가 결과를 충분히 알고 대화 가능하도록 풀-컨텍스트 주입.
    if (label) lines.push(`주제: ${label}`);
    dataStart = lines.length;
    if (fullResult?.overallScore != null) lines.push(`전체 점수: ${fullResult.overallScore}점 / 100`);
    if (fullResult?.gradeLabel) lines.push(`등급: ${stripMd(String(fullResult.gradeLabel))}`);
    if (fullResult?.oneLineSummary) lines.push(`한 줄 결론: ${stripMd(String(fullResult.oneLineSummary))}`);
    if (fullResult?.summary) lines.push(`요약: ${stripMd(String(fullResult.summary)).slice(0, 400)}`);
    if (fullResult?.sajuBasis) lines.push(`사주 근거: ${stripMd(String(fullResult.sajuBasis)).slice(0, 300)}`);
    // subScores 5축 (직무적성/대인관계/리더십/지속력/성장운 등)
    if (Array.isArray(fullResult?.topicData?.subScores)) {
      const subStr = fullResult.topicData.subScores
        .map((s: any) => `${s.axis} ${s.value}점`)
        .join(', ');
      if (subStr) lines.push(`세부 5축: ${subStr}`);
    }
    // keywords
    if (Array.isArray(fullResult?.topicData?.keywords) && fullResult.topicData.keywords.length > 0) {
      lines.push(`핵심 키워드: ${fullResult.topicData.keywords.slice(0, 5).join(' ')}`);
    }
    // strengths / cautions
    if (Array.isArray(fullResult?.topicData?.strengths) && fullResult.topicData.strengths.length > 0) {
      lines.push(`강점: ${fullResult.topicData.strengths.slice(0, 3).map((s: any) => stripMd(String(s))).join(' / ')}`);
    }
    if (Array.isArray(fullResult?.topicData?.cautions) && fullResult.topicData.cautions.length > 0) {
      lines.push(`주의: ${fullResult.topicData.cautions.slice(0, 3).map((s: any) => stripMd(String(s))).join(' / ')}`);
    }
    // 5 sections — 제목 + 첫 200자 본문
    if (Array.isArray(fullResult?.sections)) {
      fullResult.sections.slice(0, 5).forEach((sec: any, i: number) => {
        if (sec?.heading || sec?.content) {
          const h = sec?.heading ? stripMd(String(sec.heading)) : `섹션 ${i + 1}`;
          const c = sec?.content ? stripMd(String(sec.content)).slice(0, 220) : '';
          lines.push(`[${h}] ${c}`);
        }
      });
    }
    // 행운 프로필 (있을 때)
    if (fullResult?.luckyProfile) {
      const lp = fullResult.luckyProfile;
      const lpParts = [];
      if (lp.color) lpParts.push(`색: ${lp.color}`);
      if (lp.direction) lpParts.push(`방위: ${lp.direction}`);
      if (lp.number) lpParts.push(`숫자: ${lp.number}`);
      if (lp.bestMonth) lpParts.push(`시기: ${lp.bestMonth}`);
      if (lpParts.length > 0) lines.push(`행운 프로필: ${lpParts.join(', ')}`);
    }
    // 주요 topic-specific 필드 — 토픽별 핵심 데이터
    const td = fullResult?.topicData || {};
    const extraFields: string[] = [];
    // career
    if (td.workStyle) extraFields.push(`스타일: ${td.workStyle}`);
    if (td.coreStrength) extraFields.push(`핵심 강점: ${stripMd(String(td.coreStrength)).slice(0, 80)}`);
    if (Array.isArray(td.careerFit) && td.careerFit.length > 0) {
      extraFields.push(`적합 직종: ${td.careerFit.slice(0, 3).map((c: any) => c.job).filter(Boolean).join(', ')}`);
    }
    // marriage
    if (td.marriageAge) extraFields.push(`결혼 적령기: ${td.marriageAge}`);
    if (td.timing?.bestPeriod) extraFields.push(`결혼 적기: ${td.timing.bestPeriod}`);
    // wealth
    if (td.wealthType) extraFields.push(`재물 유형: ${td.wealthType}`);
    if (td.peakAge) extraFields.push(`재물 전성기: ${td.peakAge}`);
    // exam
    if (td.examLuckLevel) extraFields.push(`합격 운: ${td.examLuckLevel}`);
    if (td.bestExamMonth) extraFields.push(`최적 시기: ${td.bestExamMonth}`);
    // love / reunion
    if (td.reunionProbability != null) extraFields.push(`재회 가능성: ${td.reunionProbability}%`);
    if (td.newEncounterMonth) extraFields.push(`새 인연 월: ${td.newEncounterMonth}`);
    if (extraFields.length > 0) lines.push(`추가 데이터: ${extraFields.join(', ')}`);
  } else if (type === 'premium') {
    if (fullResult?.overallScore != null) lines.push(`전체 점수: ${fullResult.overallScore}점 / 100`);
    if (fullResult?.summary) lines.push(`종합 요약: ${stripMd(String(fullResult.summary)).slice(0, 400)}`);
    if (Array.isArray(fullResult?.sections)) {
      // 10섹션 각자 제목 + 첫 150자
      fullResult.sections.slice(0, 10).forEach((s: any, i: number) => {
        if (s?.title || s?.content) {
          lines.push(`[${s.title || `섹션 ${i + 1}`}] ${s.content ? stripMd(String(s.content)).slice(0, 150) : ''}`);
        }
      });
    }
  } else if (type === 'compat') {
    // 2026-10-13 — 궁합(10-07 공개) 결과를 대화로 넘김. 전엔 분기가 없어 AI 가 제목 한 줄만 받았다
    if (ctx.partnerName) lines.push(`상대: ${plainText(ctx.partnerName)}`);
    if (ctx.relation) lines.push(`관계: ${plainText(ctx.relation)}`);
    dataStart = lines.length;
    if (fullResult?.overallScore != null) lines.push(`궁합 점수: ${fullResult.overallScore}점 / 100`);
    if (fullResult?.relationshipType) lines.push(`관계 유형: ${plainText(fullResult.relationshipType)}`);
    if (fullResult?.summary) lines.push(`요약: ${plainText(fullResult.summary).slice(0, 400)}`);
    if (Array.isArray(fullResult?.categories)) {
      fullResult.categories.slice(0, 6).forEach((c: any) => {
        if (!c) return;
        lines.push(`[${plainText(c.name)} ${c.score != null ? `${c.score}점` : ''}] ${plainText(c.description).slice(0, 100)}`);
      });
    }
    if (Array.isArray(fullResult?.strengths) && fullResult.strengths.length) lines.push(`잘 맞는 점: ${fullResult.strengths.slice(0, 3).map((x: unknown) => plainText(x)).join(' / ')}`);
    if (Array.isArray(fullResult?.challenges) && fullResult.challenges.length) lines.push(`주의할 점: ${fullResult.challenges.slice(0, 3).map((x: unknown) => plainText(x)).join(' / ')}`);
    if (fullResult?.ohengHarmony?.description) lines.push(`오행 조화: ${plainText(fullResult.ohengHarmony.relation)} ${plainText(fullResult.ohengHarmony.description).slice(0, 150)}`);
    if (fullResult?.advice) lines.push(`조언: ${plainText(fullResult.advice).slice(0, 200)}`);
    if (fullResult?.futureOutlook) lines.push(`앞으로의 흐름: ${plainText(fullResult.futureOutlook).slice(0, 200)}`);
  } else if (type === 'tojung') {
    // 2026-10-13 — 신년운세(10-07 공개) 결과를 대화로 넘김
    if (fullResult?.targetYear) lines.push(`대상 연도: ${fullResult.targetYear}년`);
    dataStart = lines.length;
    if (Array.isArray(fullResult?.keywords) && fullResult.keywords.length) lines.push(`핵심 키워드: ${fullResult.keywords.slice(0, 5).map((k: unknown) => plainText(k)).join(' ')}`);
    const yo = fullResult?.yearOverview || {};
    if (yo.총운) lines.push(`한 해 총운: ${plainText(yo.총운).slice(0, 300)}`);
    (['금전운', '직장운', '애정운', '건강운', '결혼운'] as const).forEach((k) => { if (yo[k]) lines.push(`${k}: ${plainText(yo[k]).slice(0, 120)}`); });
    if (Array.isArray(fullResult?.months)) {
      fullResult.months.slice(0, 12).forEach((m: any) => {
        if (!m) return;
        const sc = m.score != null ? ` ${m.score}점` : '';
        const kw = m.keyword ? ` ${plainText(m.keyword)}` : '';
        lines.push(`[${m.month}월${sc}${kw}] ${plainText(m.현대해석 || m.전통해석).slice(0, 90)}`);
      });
    }
    if (Array.isArray(fullResult?.keyDates)) {
      fullResult.keyDates.slice(0, 6).forEach((k: any) => { if (k?.date) lines.push(`꼭 기억할 날 ${plainText(k.date)}: ${plainText(k.why).slice(0, 80)}`); });
    }
    if (fullResult?.luckyAdvice) lines.push(`개운 조언: ${plainText(fullResult.luckyAdvice).slice(0, 150)}`);
  } else if (type === 'weekly') {
    // 2026-09-17 — 주간운세 (WeeklyDetailResponse · 구매일 전날부터 롤링 7일)
    if (ctx.periodLabel) lines.push(`기간: ${ctx.periodLabel} (구매일 전날부터 7일)`);
    dataStart = lines.length;
    if (fullResult?.weekHeadline) lines.push(`이번 주 한 줄: ${plainText(fullResult.weekHeadline)}`);
    if (Array.isArray(fullResult?.keywords) && fullResult.keywords.length > 0) {
      lines.push(`핵심 키워드: ${fullResult.keywords.slice(0, 5).map((k: unknown) => plainText(k)).join(' ')}`);
    }
    if (fullResult?.weekTheme) lines.push(`이번 주 흐름: ${plainText(fullResult.weekTheme).slice(0, 400)}`);
    // 요일별 — 날짜·일진·점수·톤 + 본문 앞부분 + 실천
    if (Array.isArray(fullResult?.dailyBreakdown)) {
      fullResult.dailyBreakdown.slice(0, 7).forEach((d: any) => {
        if (!d) return;
        const head = [d.day, d.date, d.ganji].filter(Boolean).map((v: unknown) => plainText(v)).join(' ');
        const score = d.score != null ? ` ${d.score}점` : '';
        const tone = d.tone ? ` ${plainText(d.tone)}` : '';
        const body = d.body ? `: ${plainText(d.body).slice(0, 120)}` : '';
        const action = d.action ? ` (실천: ${plainText(d.action).slice(0, 60)})` : '';
        lines.push(`[${head}]${score}${tone}${body}${action}`);
      });
    }
    // 핵심일 (좋은 날·주의일)
    const keyDays = Array.isArray(fullResult?.keyDays) ? fullResult.keyDays : [];
    keyDays.slice(0, 4).forEach((k: any) => {
      if (!k) return;
      const kind = k.type === 'caution' ? '주의일' : '좋은 날';
      const when = [k.day, k.date].filter(Boolean).map((v: unknown) => plainText(v)).join(' ');
      lines.push(`${kind}: ${when}${k.reason ? `: ${plainText(k.reason).slice(0, 150)}` : ''}`);
    });
    if (keyDays.length === 0) {
      if (fullResult?.bestDay) lines.push(`좋은 날: ${plainText(fullResult.bestDay)}`);
      if (fullResult?.cautionDay) lines.push(`주의일: ${plainText(fullResult.cautionDay)}`);
    }
    if (fullResult?.weekLesson) lines.push(`이번 주 교훈: ${plainText(fullResult.weekLesson).slice(0, 200)}`);
  } else if (type === 'monthly') {
    // 2026-09-17 — 월별 운세 (MonthlyDetailResponse · 단일월 심층)
    if (fullResult?.year && fullResult?.month) lines.push(`대상 달: ${fullResult.year}년 ${fullResult.month}월`);
    dataStart = lines.length;
    if (fullResult?.headline) lines.push(`이 달 한 줄: ${plainText(fullResult.headline)}`);
    if (Array.isArray(fullResult?.keywords) && fullResult.keywords.length > 0) {
      lines.push(`핵심 키워드: ${fullResult.keywords.slice(0, 5).map((k: unknown) => plainText(k)).join(' ')}`);
    }
    if (fullResult?.theme) lines.push(`이 달 핵심 테마: ${plainText(fullResult.theme).slice(0, 400)}`);
    // 상순·중순·하순
    if (Array.isArray(fullResult?.periods)) {
      fullResult.periods.slice(0, 3).forEach((p: any) => {
        if (!p) return;
        const head = [p.phase, p.dateRange].filter(Boolean).map((v: unknown) => plainText(v)).join(' ');
        const score = p.score != null ? ` ${p.score}점` : '';
        const body = p.body ? `: ${plainText(p.body).slice(0, 150)}` : '';
        lines.push(`[${head}]${score}${body}`);
      });
    }
    // 영역별 (재물·직업·애정·건강) — 이번 달 점수
    const DOMAINS: [string, string][] = [['wealth', '재물운'], ['career', '직업운'], ['love', '애정운'], ['health', '건강운']];
    DOMAINS.forEach(([key, nm]) => {
      const dm = fullResult?.[key];
      if (!dm || (dm.score == null && !dm.body)) return;
      const score = dm.score != null ? ` ${dm.score}점` : '';
      const body = dm.body ? `: ${plainText(dm.body).slice(0, 120)}` : '';
      lines.push(`이번 달 ${nm}${score}${body}`);
    });
    const dayNotes = (arr: unknown, kind: string) => {
      if (!Array.isArray(arr)) return;
      arr.slice(0, 3).forEach((d: any) => {
        if (!d?.date && !d?.reason) return;
        lines.push(`${kind}: ${d?.date ? plainText(d.date) : ''}${d?.reason ? `: ${plainText(d.reason).slice(0, 100)}` : ''}`);
      });
    };
    dayNotes(fullResult?.luckyDays, '길일');
    dayNotes(fullResult?.cautionDays, '주의일');
    if (fullResult?.gaewoon) lines.push(`개운 처방: ${plainText(fullResult.gaewoon).slice(0, 200)}`);
  }
  // compat/daeun/tojung 3종은 출시 lockdown (라우트 홈 redirect) — 공개 시 동일 패턴으로 분기 추가.
  const hasData = lines.length > dataStart;
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (hasData) {
    lines.push('⚠️ 중요: 위 데이터는 사용자가 방금 본 결과 페이지의 실제 콘텐츠입니다.');
    lines.push('- 점수, 키워드, 시기(요일과 상중하순), 섹션, 행운 정보 등 위 데이터를 그대로 참조해 답변하세요.');
    lines.push('- "확인이 어렵다", "결과 페이지를 보세요" 같은 답변 금지. 위 데이터가 곧 결과 페이지입니다.');
    lines.push('- 새로 분석하지 말고 이미 본 풀이의 "깊이"를 늘려주는 답변을 하세요.');
    lines.push('- 사용자가 점수를 물으면 위 데이터에 있는 점수를 직접 인용하세요.');
  } else {
    // 2026-09-17 — 결과 데이터가 비었는데 "위 데이터를 그대로 참조" 지시를 넣으면 AI 가 점수·날짜를 지어냄(환각) → 분기.
    lines.push('⚠️ 중요: 이 풀이의 세부 결과 데이터는 전달되지 않았습니다.');
    lines.push('- 결과 페이지의 점수, 날짜, 문구를 추측하거나 지어내지 마세요.');
    lines.push('- 사주 원국 기준으로 답하고, 결과 세부 내용을 물으면 결과 화면에서 다시 확인할 수 있다고 짧게 안내하세요.');
  }
  return lines.join('\n');
}
import type { SajuData } from '@/types/saju';
import { splitAfter } from '@/utils/safeRegex';
import {
  C,
  ConvertUnModal,
  getTotalTickets,
} from './_shared';

/* ══════════════════════════════════════════════════════════════════
 * 추천 콘텐츠 카드 매핑 (스펙 §8) — 세션당 최대 2개
 *  2026-09-17 SSOT 정렬: 주제 한자·색·라우트 = TOPIC_REGISTRY, 주간/월간 = EXTENSION_THEME,
 *  가격 = pricing SSOT (기존 '· 1운' 고정 표기·事/#0E4582 등 하드코딩 제거).
 * ═════════════════════════════════════════════════════════════════ */
type RecKey = TopicId | 'weekly' | 'monthly';

interface ContentRec {
  path: string;
  title: string;
  desc: string;
  hanja: string;
  color: string;
  topicKey: RecKey; // 같은 추천 중복 방지용 키
  priceLabel: string;
}

/** '일'이 "일(업무)"로 쓰였는지 판정.
 *  · 다른 단어 속 '일'(내일·일요일·일주일·일간·일주·큰일)은 앞 경계 + 뒤 조사로 거름.
 *  · 앞 단어 끝 글자가 받침 ㄴ/ㄹ(관형형: 좋은·무슨·큰·나쁜·어떤·생길·별)이면 "좋은 일·무슨 일" 같은 일반 사건 → 제외.
 *    (lookbehind 없이 앞 글자를 직접 검사 — 아래 REC_RULES 주석 참고) */
function hasWorkIl(text: string): boolean {
  const re = /(^|[\s,.!?])일(?=[이을은에도만하할해]|자리|터|[\s,.!?]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let j = m.index + m[1].length - 1; // '일' 바로 앞 글자
    while (j >= 0 && /[\s,.!?]/.test(text[j])) j--;
    if (j < 0) return true; // 문장 첫 단어가 '일'
    const code = text.charCodeAt(j);
    const jong = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : -1;
    if (jong === 4 || jong === 8) continue; // ㄴ·ㄹ 받침 관형형 → 일반 '일'
    return true;
  }
  return false;
}

/** 키워드 → 추천 규칙. 배열 순서 = 우선순위 (인접 주제는 구체적인 쪽 먼저: 재회·결혼 → 연애 / 합격·이직 → 직업 / 사업 → 재물).
 *  2026-09-18 오탐 정리: 헤어스타일·아파트·이사님·"가게 될까"·"좋은 일/무슨 일"·집에 가다 류가 주제로 잡히던 문제.
 *  ⚠ lookbehind((?<=…)) 금지 — 구형 iOS WebView 는 정규식 파싱 에러로 페이지 모듈 전체가 죽음 (lookahead 만 사용). */
const REC_RULES: { key: RecKey; re: RegExp; extra?: (text: string) => boolean }[] = [
  // '헤어'는 헤어지다 활용형만 (헤어스타일·헤어샵 제외)
  { key: 'reunion', re: /이별|재회|헤어[지진졌짐질져]/ },
  { key: 'marriage', re: /결혼|배우자|신혼/ },
  // '궁합'·커플 질문은 궁합 출시 전까지 연애운으로 (2026-05-07 결정 유지) · 썸네일 제외
  { key: 'love', re: /연애|썸(?!네일)|연인|궁합|커플|남자친구|여자친구|남친|여친/ },
  { key: 'exam', re: /이직|합격|시험|취업|면접/ },
  // 단독 '일'은 hasWorkIl 로 판정 (좋은 일·무슨 일 제외)
  { key: 'career', re: /직장|승진|회사|업무|일자리|일터|하는 ?일|맡은 ?일/, extra: hasWorkIl },
  // '가게 되다/될까'(동사 가다)·'가게끔' 제외
  { key: 'business', re: /사업|창업|가게(?!끔| ?(되|될|돼|됐|됩))/ },
  { key: 'wealth', re: /돈|재물|투자/ },
  // 이사님·이사회·이사장 등 직함 제외 / '집에 가·집에서' 같은 일상 표현 제외 (집중·집값 등은 뒤 글자로 거름)
  { key: 'move', re: /이사(?![님회장진직급])|이동|(^|[\s,.!?])집(?=[이을은도]|에(?!서| ?(가|와|오|있))|[\s,.!?]|$)/ },
  { key: 'study', re: /공부|학업/ },
  // 아파트·아프리카 제외
  { key: 'health', re: /건강|아프(?!리카)|아픔|아파(?!트)|병원|피곤/ },
  { key: 'weekly', re: /이번 ?주|주간/ },
  { key: 'monthly', re: /이번 ?달|월간/ },
];

function buildRec(key: RecKey): ContentRec {
  if (key === 'weekly') {
    const t = EXTENSION_THEME.weekly;
    return {
      path: '/weekly',
      title: '이번 주 7일 흐름을 풀어드릴까요?',
      desc: '좋은 날과 조심할 날을 하루씩',
      hanja: t.hanja.slice(0, 1),
      color: t.accentDark,
      topicKey: 'weekly',
      priceLabel: formatPriceLabel(getWeeklyPrice()),
    };
  }
  if (key === 'monthly') {
    const t = EXTENSION_THEME.monthly;
    return {
      path: '/monthly',
      title: '이번 달 흐름을 깊게 풀어드릴까요?',
      desc: '상순, 중순, 하순과 길일, 주의일',
      hanja: t.hanja.slice(0, 1),
      color: t.accentDark,
      topicKey: 'monthly',
      priceLabel: formatPriceLabel(getMonthlyPrice()),
    };
  }
  const meta = TOPIC_REGISTRY[key];
  return {
    path: meta.path,
    title: `${meta.label}을 더 깊게 풀어드릴까요?`,
    desc: meta.subCopy,
    hanja: meta.kanji,
    color: meta.color,
    topicKey: key,
    priceLabel: formatPriceLabel(getTopicPrice(key)),
  };
}

/** texts 를 앞에서부터(최근 질문 → 전체 대화) 검사해 아직 안 보인 첫 추천을 고름 */
function pickRecommendation(
  texts: string[],
  excluded: Set<string>,
): ContentRec | null {
  for (const text of texts) {
    if (!text) continue;
    for (const rule of REC_RULES) {
      if (!excluded.has(rule.key) && (rule.re.test(text) || !!rule.extra?.(text))) return buildRec(rule.key);
    }
  }
  return null;
}

/** 목업 .ts 진본 — 가운데 시간 스탬프 라벨 산출 (첫 + 5분 이상 간격) */
function formatChatTimestamp(
  current: string,
  previous: string | null | undefined,
): string | null {
  const cur = new Date(current);
  if (!previous) {
    // 첫 메시지 — 절대 일자 (YYYY.MM.DD HH:mm)
    return `${cur.getFullYear()}.${String(cur.getMonth() + 1).padStart(2, '0')}.${String(cur.getDate()).padStart(2, '0')} ${String(cur.getHours()).padStart(2, '0')}:${String(cur.getMinutes()).padStart(2, '0')}`;
  }
  const prev = new Date(previous);
  const gapMs = cur.getTime() - prev.getTime();
  // 5분 이내면 스탬프 생략
  if (gapMs < 5 * 60 * 1000) return null;
  // 같은 날이면 시간만, 아니면 일자+시간
  const sameDay =
    cur.getFullYear() === prev.getFullYear() &&
    cur.getMonth() === prev.getMonth() &&
    cur.getDate() === prev.getDate();
  if (sameDay) {
    return `${String(cur.getHours()).padStart(2, '0')}:${String(cur.getMinutes()).padStart(2, '0')}`;
  }
  return `${cur.getFullYear()}.${String(cur.getMonth() + 1).padStart(2, '0')}.${String(cur.getDate()).padStart(2, '0')} ${String(cur.getHours()).padStart(2, '0')}:${String(cur.getMinutes()).padStart(2, '0')}`;
}

/** 자동 대화방 이름 (보존) */
function autoRoomName(text: string): string {
  if (/이직|퇴사|취업|직장|직업|승진|면접/.test(text)) return '이직과 직장 상담';
  if (/연애|사랑|썸|이별|전 ?애인|인연|결혼|궁합/.test(text)) return '연애 상담';
  if (/돈|재물|투자|재테크|부업|사업/.test(text)) return '재물 상담';
  if (/건강|피곤|아프|스트레스|불안|잠/.test(text)) return '고민 상담';
  if (/운세|올해|내년|이번 ?달/.test(text)) return '운세 상담';
  return text.slice(0, 18) + (text.length > 18 ? '...' : '');
}

/* ══════════════════════════════════════════════════════════════════
 * Page
 * ═════════════════════════════════════════════════════════════════ */
export function ChatSessionPage() {
  usePageTitle('사주대화');
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const toast = useToast();

  if (!sessionId) {
    navigate('/chat', { replace: true });
    return null;
  }

  // location.state에서 프로필 우선, 없으면 myProfile fallback
  const stateProfile = (location.state as any)?.profile as
    | SajuProfile
    | LocalReport
    | undefined;
  // 2026-09-17 — 목록에서 방을 다시 열면 state 가 없어 본인 사주로 대체되던 문제 fix:
  //   state.profile → 방에 저장된 profileId → 본인 사주 순으로 복원.
  const myProfile = useMemo<SajuProfile | LocalReport | null>(() => {
    if (stateProfile) return stateProfile;
    try {
      const pid = getChatRoom(sessionId)?.profileId;
      if (pid) {
        const p = getProfiles().find((x) => x.id === pid);
        if (p) return p;
      }
    } catch { /* noop */ }
    return getMyProfile();
  }, [stateProfile, sessionId]);
  // 결과 페이지·사주 선택에서 넘어온 사주를 방에 연결 저장 (재진입 복원용)
  useEffect(() => {
    if (!stateProfile) return;
    const pid = resolveProfileId(stateProfile);
    if (pid) setChatRoomProfileId(sessionId, pid);
  }, [stateProfile, sessionId]);
  const sajuData: SajuData | undefined = myProfile?.sajuData;
  const hasProfile = !!myProfile;
  const userName = myProfile?.name || '';
  const ilgan = myProfile?.sajuData?.pillars?.[2]?.천간 || '';
  const oheng = ilgan ? CHEONGAN_OHENG[ilgan] : '';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [roomNameSet, setRoomNameSet] = useState(false);

  // 추천 카드 — 실제로 "보인" 추천 키 (세션당 최대 2개 판정 · 새로고침에도 유지)
  const recStoreKey = `chat:recsShown:${sessionId}`;
  const [shownRecs, setShownRecs] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(recStoreKey);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* noop */ }
    return new Set();
  });
  const [activeRec, setActiveRec] = useState<ContentRec | null>(null);
  const recCheckpointRef = useRef('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingRoomDelete, setPendingRoomDelete] = useState(false);

  // P2-4 — 분기 카피 (자발적 탭 vs 한도 소진)
  const [showConvert, setShowConvert] = useState(false);
  const [convertMode, setConvertMode] = useState<'default' | 'quota_exceeded'>(
    'default',
  );
  // 충전 후 잔액 갱신 트리거
  const [refreshTick, setRefreshTick] = useState(0);

  // 2026-05-28 — 결과 페이지에서 넘어온 컨텍스트 (꿈/오늘운세/주제분석/종합사주 등)
  //   AI 가 사용자가 무엇을 봤는지 알고 답변하도록 시스템 프롬프트에 주입.
  //   복원 우선순위: 1) location.state 2) chatStore room.contentContext (영구) 3) sessionStorage 폴백
  //   2026-05-28 PM — chatStore 영구 저장 추가 (sessionStorage 휘발성 해소).
  const contentContext = useMemo(() => {
    const ctx = (location.state as any)?.contentContext;
    if (ctx && typeof ctx === 'object' && typeof ctx.type === 'string') return ctx;
    // 1순위 폴백 — chatStore 영구 저장 (며칠 후 재진입에도 보존)
    if (sessionId) {
      try {
        const room = getChatRoom(sessionId);
        if (room?.contentContext && typeof room.contentContext.type === 'string') {
          return room.contentContext;
        }
      } catch { /* noop */ }
    }
    // 2순위 폴백 — sessionStorage (현 탭만)
    try {
      const raw = sessionStorage.getItem(`chat:contentCtx:${sessionId}`);
      if (raw) return JSON.parse(raw);
    } catch { /* noop */ }
    return null;
  }, [location.state, sessionId]);
  // 첫 진입 시 sessionStorage 에 저장 (새로고침·재진입 시 보존 — chatStore 와 dual-write)
  useEffect(() => {
    if (contentContext && sessionId) {
      try { sessionStorage.setItem(`chat:contentCtx:${sessionId}`, JSON.stringify(contentContext)); }
      catch { /* noop */ }
    }
  }, [contentContext, sessionId]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── 대화방 로드
  useEffect(() => {
    const room = getChatRoom(sessionId!);
    if (room) {
      setIsCompleted(!!room.completed);
      if (room.messages.length > 0) {
        setMessages(room.messages);
        setRoomNameSet(true);
        const userCount = room.messages.filter((m) => m.role === 'user').length;
        if (userCount >= 5 && !room.completed) setShowWrapUp(true);
        return;
      }
    }
    // 주제별 운세 결과 → "이 주제로 상담 이어가기" 진입 시 주제 컨텍스트.
    const fromTopicLabel = (location.state as any)?.topicLabel as string | undefined;
    // 2026-05-28 — contentContext 기반 인사 + 기본 질문 (꿈/오늘운세/종합사주 등 통합)
    const ctxType = contentContext?.type as string | undefined;
    const ctxLabel = contentContext?.label as string | undefined;

    // 빈 방 → 인사 (콘텐츠별 맞춤 인사 + 결과 요약 동적 포함)
    let greeting: string;
    let defaultQuestions: string[];
    if (ctxType === 'dream') {
      // 꿈 내용 + 고민 직접 인용 → "X 꿈을 꾸고 오셨군요. Y 라는 고민과 함께 풀어드릴게요"
      const dt = contentContext?.dreamText ? String(contentContext.dreamText).trim() : '';
      const cn = contentContext?.concern ? String(contentContext.concern).trim() : '';
      const dtShort = dt.length > 30 ? `${dt.slice(0, 30)}…` : dt;
      const dreamPhrase = dt ? `"${dtShort}" 꿈을 꾸고 오셨군요.` : '꿈해몽 풀이를 보고 오셨네요.';
      const concernPhrase = cn ? ` ${cn.length > 25 ? cn.slice(0, 25) + '…' : cn}라는 고민과 함께 풀어드릴게요.` : ' 꿈과 사주를 종합해 풀어드릴게요.';
      greeting = `${userName} 님, ${dreamPhrase}${concernPhrase} 편하게 물어보세요.`;
      defaultQuestions = ['이 꿈이 예고하는 시기는?', '꿈이 가리키는 사람은 누구인가요?', '꿈 속 상징을 더 자세히 풀어주세요'];
    } else if (ctxType === 'daily') {
      const title = contentContext?.fullResult?.title ? String(contentContext.fullResult.title).trim() : '';
      const titlePhrase = title ? `"${title}" 풀이를 보고 오셨네요.` : '오늘의 운세 풀이를 보고 오셨네요.';
      greeting = `${userName} 님, ${titlePhrase} 오늘 하루를 더 깊이 살피고 싶은 부분 편하게 물어보세요.`;
      defaultQuestions = ['오늘 가장 조심할 시간대는?', '오늘의 행운 색과 방위는?', '내일 운세도 미리 알려주세요'];
    } else if (ctxType === 'topic' && ctxLabel) {
      const oneLine = contentContext?.fullResult?.oneLineSummary
        ? String(contentContext.fullResult.oneLineSummary).trim()
        : (splitAfter(plainText(contentContext?.fullResult?.summary), /([.!?。])\s/g)[0] || '').trim();
      const oneLineShort = oneLine.length > 50 ? `${oneLine.slice(0, 50)}…` : oneLine;
      const summaryPhrase = oneLineShort ? ` "${oneLineShort}" 라는 풀이를 본 김에 ` : ' ';
      greeting = `${userName} 님,${summaryPhrase}${ctxLabel}에 대해 더 깊이 궁금한 점 편하게 물어보세요.`;
      defaultQuestions = [`${ctxLabel}이 가장 좋아지는 시기는?`, `${ctxLabel}에서 제가 조심할 점은?`, `${ctxLabel} 결과를 더 자세히 풀어주세요`];
    } else if (ctxType === 'premium') {
      const title = contentContext?.fullResult?.title ? String(contentContext.fullResult.title).trim() : '';
      greeting = title
        ? `${userName} 님, "${title}" 종합 사주 풀이를 보고 오셨네요. 10섹션 중 더 깊이 풀고 싶은 부분 편하게 물어보세요.`
        : `${userName} 님 종합 사주 풀이를 보고 오셨네요. 10섹션 중 더 깊이 풀고 싶은 부분 편하게 물어보세요.`;
      defaultQuestions = ['내 사주의 가장 강한 오행은?', '올해 가장 큰 변곡점은 언제?', '직업, 재물, 연애 중 어느 운세가 가장 좋아요?'];
    } else if (ctxType === 'weekly') {
      // 2026-09-17 — 주간운세 결과 → 사주대화 (한 줄 요약 인용)
      const head = plainText(contentContext?.fullResult?.weekHeadline);
      const headShort = head.length > 40 ? `${head.slice(0, 40)}…` : head;
      greeting = headShort
        ? `${userName} 님, "${headShort}" 주간운세를 보고 오셨네요. 이번 7일 중 더 깊이 살피고 싶은 날이나 일을 편하게 물어보세요.`
        : `${userName} 님, 주간운세를 보고 오셨네요. 이번 7일 중 더 깊이 살피고 싶은 날이나 일을 편하게 물어보세요.`;
      defaultQuestions = ['이번 주 가장 좋은 날엔 뭘 하면 좋을까요?', '조심할 날은 어떻게 보내면 좋을까요?', '중요한 약속은 언제 잡는 게 좋아요?'];
    } else if (ctxType === 'monthly') {
      // 2026-09-17 — 월별 운세 결과 → 사주대화
      const head = plainText(contentContext?.fullResult?.headline);
      const headShort = head.length > 40 ? `${head.slice(0, 40)}…` : head;
      const monthName = ctxLabel && /\d+월/.test(ctxLabel) ? ctxLabel.replace(/\s*운세$/, '') : '이 달';
      greeting = headShort
        ? `${userName} 님, "${headShort}" 풀이를 보고 오셨네요. ${monthName} 한 달 중 더 깊이 살피고 싶은 부분 편하게 물어보세요.`
        : `${userName} 님, ${monthName} 운세를 보고 오셨네요. 한 달 중 더 깊이 살피고 싶은 부분 편하게 물어보세요.`;
      defaultQuestions = ['이 달 가장 힘을 줘도 되는 시기는?', '길일에는 무엇을 하면 좋을까요?', '이 달 재물과 일 중 어디에 집중할까요?'];
    } else if (ctxType === 'compat') {
      // 2026-10-13 — 궁합 결과 → 사주대화 (10-07 공개 후 빠져 있던 인사 분기)
      const pn = contentContext?.partnerName ? String(contentContext.partnerName) : '그분';
      const sc = contentContext?.fullResult?.overallScore;
      greeting = `${userName} 님, ${pn} 님과의 궁합${sc != null ? `(${sc}점)` : ''} 풀이를 보고 오셨네요. 두 분 사이에서 더 깊이 궁금한 점 편하게 물어보세요.`;
      defaultQuestions = [`${pn} 님과 가장 잘 맞는 시기는?`, '두 사람이 자주 부딪히는 이유는?', '관계를 오래 가게 하려면 무엇을 조심할까요?'];
    } else if (ctxType === 'tojung') {
      // 2026-10-13 — 신년운세 결과 → 사주대화
      const ty = contentContext?.fullResult?.targetYear;
      greeting = `${userName} 님, ${ty ? `${ty}년 ` : ''}신년운세를 보고 오셨네요. 한 해 중 더 깊이 살피고 싶은 달이나 일을 편하게 물어보세요.`;
      const yr = ty ? `${ty}년` : '올해';
      defaultQuestions = [`${yr}에 가장 힘을 줘도 되는 달은?`, '조심해야 할 달은 어떻게 보내면 좋을까요?', `${yr}에는 재물과 일 중 어디에 집중할까요?`];
    // daeun 은 비공개(lockdown) → 인사 분기 없음 (공개 시 추가)
    } else if (fromTopicLabel) {
      // legacy fallback (Topic 페이지가 contentContext 보다 topicLabel 만 전달했을 때)
      greeting = `${userName} 님의 ${fromTopicLabel} 풀이를 보고 오셨네요. ${fromTopicLabel}에 대해 더 깊이 궁금한 점을 편하게 물어보세요.`;
      defaultQuestions = [`${fromTopicLabel}이 가장 좋아지는 시기는?`, `${fromTopicLabel}에서 제가 조심할 점은?`, `${fromTopicLabel} 결과를 더 자세히 풀어주세요`];
    } else if (hasProfile) {
      greeting = `${userName} 님 사주로 풀이해드릴게요. 편하게 물어보세요.`;
      defaultQuestions = ['올해 나에게 가장 좋은 달은?', '내 사주의 가장 강한 오행은?', '요즘 고민이 있어요'];
    } else {
      greeting = '편하게 물어보세요. 사주를 등록하면 더 정확한 맞춤 풀이가 가능해요.';
      defaultQuestions = ['내 연애 스타일이 궁금해요', '올해 운세가 궁금해요', '사주로 뭘 알 수 있나요?'];
    }
    // 2026-10-09 — 결과가 만든 맞춤 질문(주제·오늘 nextHooks.chatQuestions / 종합 chatQuestions) 우선 — 일반 질문보다 클릭이 붙는다
    {
      const fr = contentContext?.fullResult as any;
      const raw = Array.isArray(fr?.nextHooks?.chatQuestions) ? fr.nextHooks.chatQuestions : (Array.isArray(fr?.chatQuestions) ? fr.chatQuestions : []);
      const aiQs = raw.filter((q: unknown) => typeof q === 'string' && (q as string).trim()).slice(0, 3) as string[];
      if (aiQs.length >= 2) defaultQuestions = aiQs;
    }
    const welcome: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      content: greeting,
      keywords: defaultQuestions,
      timestamp: new Date().toISOString(),
    };
    setMessages([welcome]);
    addChatMessage(sessionId!, welcome);

    // prefill (location.state 또는 history.state)
    const prefill =
      (location.state as any)?.prefill ||
      (window.history.state?.usr as any)?.prefill;
    if (prefill && typeof prefill === 'string') setInputText(prefill);
    // 2026-10-09 — 결과 화면 'NEXT' 카드에서 고른 질문: 한 번만, 환영 메시지 뒤에 바로 전송 (뒤로 갔다 와도 재전송 X)
    const autoAsk = (location.state as any)?.autoAsk;
    if (typeof autoAsk === 'string' && autoAsk.trim()) {
      setPendingAsk(autoAsk.trim().slice(0, 200));
      try { navigate(location.pathname, { replace: true, state: { ...(location.state as any), autoAsk: undefined } }); } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // autoAsk 실행 — 환영 메시지가 들어간 뒤(최신 state 로) 1회
  useEffect(() => {
    if (!pendingAsk || isLoading) return;
    if (!messages.some((m) => m.id === 'welcome')) return;
    const q = pendingAsk;
    setPendingAsk(null);
    void sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk, messages, isLoading]);

  // ── 자동 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  // ── AI 응답 중 뒤로가기 차단
  useEffect(() => {
    if (!isLoading) return;
    const handle = (_e: PopStateEvent) => {
      if (isLoading) {
        window.history.pushState(null, '', window.location.href);
        toast.show('사주를 살피는 중이에요. 잠시만 기다려 주세요', 'info');
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handle);
    return () => window.removeEventListener('popstate', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // ── 잔액 (총 대화권)
  const tickets = useMemo(
    () => getTotalTickets(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshTick, messages.length],
  );
  // 무료권 변화(다른 화면 사용·자정 KST 넘김·앱 복귀) 시 대화권 재계산 — 켜 둔 채 자정을 넘겨도 오늘 무료 1회가 바로 반영되도록
  useEffect(() => subscribeFreePass(() => setRefreshTick((t) => t + 1)), []);

  // ── 메시지 전송
  async function sendMessage(text: string) {
    if (!text.trim() || isLoading || isCompleted) return;

    // 사주 가드 — sajuData 없으면 일반론 답변(모든 사용자 동일) 위험 → 입력 페이지로 유도
    // (이전: hasProfile 체크가 일부 UI 분기에만 있어, sendMessage 가 saju 없이 호출 가능)
    if (!myProfile?.sajuData) {
      toast.show('맞춤 답변을 위해 먼저 사주를 입력해 주세요.', 'warning');
      navigate('/input?from=chat');
      return;
    }

    const userMsgCount = messages.filter((m) => m.role === 'user').length;

    // 무료 패스 → 결제 크레딧 → 부족. 2026-05-29 — 소비 종류 추적(실패 시 복구용).
    //   2026-09-17 fix — 무료권은 "오늘 첫 질문 1개" 정책: 방과 무관하게 무료권이 남아 있으면 먼저 소비.
    //   (기존: '이 방의 첫 메시지'일 때만 무료 → 이미 대화가 있는 방에선 무료 1회를 못 쓰고 유료 대화권이 먼저 빠짐)
    let consumed: 'freepass' | 'credit' | null = null;
    // 2026-09-18 — 무료권 쓴 날(KST). 자정 넘겨 실패하면 새 날 무료권까지 복구되는 것 방지 (restoreFreePass usedOn)
    let freePassUsedOn: string | undefined;
    if (hasFreePass('chat')) {
      freePassUsedOn = kstToday();
      useFreePass('chat');
      consumed = 'freepass';
    } else if (getChatCredits() > 0) {
      useChatCredit();
      consumed = 'credit';
    } else {
      // P2-4 보존: 여기 도달 = 오늘 무료권 이미 사용 + 대화권 0 → 한도 소진 카피 (무료권 기준 판정)
      setConvertMode('quota_exceeded');
      setShowConvert(true);
      return;
    }

    // 2026-06-24 — 사주대화 사용량 계측 (메시지 단위 · 무료패스/대화권 차감 성공 직후 1회)
    trackEvent('content_open', { type: 'chat' });

    if (!roomNameSet) {
      updateRoomName(sessionId!, autoRoomName(text.trim()));
      setRoomNameSet(true);
      import('@/services/toss/tossPromotion').then((m) =>
        m.triggerPromotionEvent(m.PROMO_EVENTS.CHAT_START),
      );
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(36),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    addChatMessage(sessionId!, userMsg);
    setInputText('');
    setActiveRec(null); // 다음 질문으로 넘어가면 이전 추천 카드는 내림
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));
      // 2026-05-28 — contentContext 가 있으면 첫 번째 history 로 prepend (AI 가 결과를 알고 답변)
      const augmentedHistory = contentContext
        ? [{ role: 'user' as const, content: buildContextPrompt(contentContext, userName) }, ...history]
        : history;
      const result = await generateChatAnswer(text.trim(), sajuData, augmentedHistory);
      // 2026-09-17 — 서버 안전가드 응답(consumed: 0 · 의료·법률·투자 등 답변 불가 안내)은 차감하지 않음 → 소비분 복구.
      //   서버 계약: functions/src/index.ts generateChatAnswer 반환 { answer, keywords, consumed: 0|1, guard }.
      //   클라 타입(reportGenerator)엔 consumed 가 없어 교차 타입으로 읽기만 함.
      const serverConsumed = (result as typeof result & { consumed?: number }).consumed;
      if (serverConsumed === 0) {
        if (consumed === 'credit') addChatCredits(1);
        else if (consumed === 'freepass') restoreFreePass('chat', freePassUsedOn);
        consumed = null; // 이후 예외 시 catch 이중 복구 방지
      }
      const aiMsg: ChatMessage = {
        id: Date.now().toString(36) + '_ai',
        role: 'assistant',
        content: result.answer,
        keywords: result.keywords || ['더 자세히 알려줘', '다른 질문할게'],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      addChatMessage(sessionId!, aiMsg);
      if (userMsgCount + 1 >= 5) setShowWrapUp(true);
      setRefreshTick((t) => t + 1);
    } catch {
      // 2026-05-29 — 실패 시 소비한 대화권/무료패스 실제 복구 (스펙 §13-4 "재시도 공짜" 구현).
      //   기존: 안내 문구만 있고 복구 코드 없어 유료 대화권/무료 1회가 답변 없이 소진되던 버그.
      if (consumed === 'credit') {
        addChatCredits(1);
      } else if (consumed === 'freepass') {
        restoreFreePass('chat', freePassUsedOn);
      }
      const aiMsg: ChatMessage = {
        id: Date.now().toString(36) + '_ai',
        role: 'assistant',
        content: '잠시 풀이가 막혔어요. 다시 한번 물어봐주세요. (대화권은 차감되지 않았어요)',
        keywords: ['다시 질문할게'],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      addChatMessage(sessionId!, aiMsg);
    } finally {
      setIsLoading(false);
    }
  }

  /** 대화 마무리 — 5턴(질문 5개) 이후 노출되는 "대화 마무리하기".
   *  정책(2026-09-17 오너 결정 · 현행 유지): 마무리 요약은 AI 를 1회 더 호출하지만 대화권·무료권을 차감하지 않음.
   *  실패해도 차감이 없으므로 복구 로직 불필요 (토스트만). */
  async function wrapUp() {
    setIsLoading(true);
    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));
      const augmentedHistory = contentContext
        ? [{ role: 'user' as const, content: buildContextPrompt(contentContext, userName) }, ...history]
        : history;
      const result = await generateChatAnswer(
        '[WRAP_UP] 지금까지의 대화를 마무리해주세요.',
        sajuData,
        augmentedHistory,
      );
      const wrapMsg: ChatMessage = {
        id: 'wrap_' + Date.now().toString(36),
        role: 'assistant',
        content: result.answer,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, wrapMsg]);
      addChatMessage(sessionId!, wrapMsg);
      completeChatRoom(sessionId!);
      setIsCompleted(true);
      setShowWrapUp(false);
    } catch {
      toast.show('마무리 풀이를 만드는 데 실패했어요', 'warning');
    } finally {
      setIsLoading(false);
    }
  }

  // ── 추천 카드 (세션당 최대 2개)
  //   2026-09-17 fix — 기존엔 누르거나 닫은 추천만 세서, 보고 지나친 추천은 한도에 안 잡혀 계속 노출됨.
  //   이제 "화면에 실제로 보인" 추천을 셈. 대화 중엔 3번째 질문마다(답변 도착 후) 1회, 마무리 후엔 1개 노출.
  //   이동한 콘텐츠(주간·월간·같은 주제)에서 들어온 방이면 그 콘텐츠는 추천에서 제외.
  const contextRecKey = useMemo<RecKey | null>(() => {
    const t = contentContext?.type;
    if (t === 'weekly' || t === 'monthly') return t;
    if (t === 'topic') {
      const fromState = normalizeTopicId((location.state as any)?.fromTopic);
      if (fromState) return fromState;
      const lbl = String(contentContext?.label || '');
      return Object.values(TOPIC_REGISTRY).find((m) => m.label === lbl)?.id ?? null;
    }
    return null;
  }, [contentContext, location.state]);

  useEffect(() => {
    if (isLoading) return;
    const userTexts = messages.filter((m) => m.role === 'user').map((m) => m.content);
    if (userTexts.length === 0) return;
    const checkpoint = isCompleted ? 'done' : `q${userTexts.length}`;
    if (recCheckpointRef.current === checkpoint) return;
    recCheckpointRef.current = checkpoint;
    if (!isCompleted && userTexts.length % 3 !== 0) return;

    const excluded = new Set<string>(shownRecs);
    if (contextRecKey) excluded.add(contextRecKey);
    let rec: ContentRec | null = null;
    if (shownRecs.size < 2) {
      rec = pickRecommendation([userTexts[userTexts.length - 1], userTexts.join(' ')], excluded);
    }
    if (!rec && isCompleted) {
      // 마무리 후 1개 보장 — 새 추천이 없으면(한도 도달·키워드 없음) 마지막으로 보인 추천을 다시, 그것도 없으면 주간/월간 흐름
      const lastShown = Array.from(shownRecs).pop() as RecKey | undefined;
      rec = buildRec(lastShown ?? (contextRecKey === 'weekly' ? 'monthly' : 'weekly'));
    }
    setActiveRec(rec);
    if (rec && !shownRecs.has(rec.topicKey)) {
      const next = new Set(shownRecs);
      next.add(rec.topicKey);
      setShownRecs(next);
      try { sessionStorage.setItem(recStoreKey, JSON.stringify(Array.from(next))); } catch { /* noop */ }
    }
  }, [messages, isLoading, isCompleted, shownRecs, contextRecKey, recStoreKey]);

  function handleOpenRec() {
    if (!activeRec) return;
    const rec = activeRec;
    setActiveRec(null);
    // 공용 계약: 이동한 콘텐츠가 같은 사주를 미리 선택하도록 profileId 전달
    const profileId = resolveProfileId(myProfile);
    navigate(rec.path, profileId ? { state: { profileId } } : undefined);
  }
  function handleDismissRec() {
    setActiveRec(null);
  }

  // 메뉴 액션
  function handleMenuChangeProfile() {
    setMenuOpen(false);
    navigate('/chat/new');
  }
  function handleMenuOpenLatestResult() {
    setMenuOpen(false);
    // 2026-09-17 fix — 기존 /result/{프로필id} 는 프로필 id 로 결과 화면이 열리지 않아 빈 화면 위험 → 사주 카드(만세력)로.
    const profileId = resolveProfileId(myProfile);
    if (profileId) {
      navigate(`/saju-card/${profileId}`);
    } else {
      toast.show('연결된 사주 카드가 없어요', 'info');
    }
  }
  function handleMenuDelete() {
    setMenuOpen(false);
    setPendingRoomDelete(true);
  }
  function confirmDeleteRoom() {
    deleteChatRoom(sessionId!);
    setPendingRoomDelete(false);
    toast.show('대화가 삭제됐어요', 'info');
    navigate('/chat', { replace: true });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.paper,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* §1-2 TopBar — 목업 .hd 다크 그라디언트 */}
      <DarkChatHeader
        userName={userName}
        ilgan={ilgan}
        ticketsTotal={tickets.total}
        isCompleted={isCompleted}
        onBack={() => navigate(-1)}
        onTicketsTap={() => {
          setConvertMode('default');
          setShowConvert(true);
        }}
        onMenuTap={() => setMenuOpen(true)}
      />

      {/* §6 컨텍스트 카드 — 목업 .ctx 진본 (헤더 아래 골드 박스) */}
      {hasProfile && (
        <ContextBanner
          name={userName}
          birth={
            myProfile && 'input' in myProfile
              ? `${myProfile.input.birthYear}.${String(
                  myProfile.input.birthMonth,
                ).padStart(2, '0')}.${String(
                  myProfile.input.birthDay,
                ).padStart(2, '0')}`
              : ''
          }
          ilgan={ilgan}
          oheng={oheng}
        />
      )}

      {/* §7 MessageStream */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* 2026-05-28 — 결과 페이지 컨텍스트 배너 (사용자가 무엇을 보고 왔는지 시각 확인) */}
        {contentContext && messages.length <= 1 && (
          <ResultContextBanner ctx={contentContext} />
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            // 목업 .ts 진본 — 가운데 정렬 시간 스탬프
            // 첫 메시지 또는 직전 메시지와 5분 이상 간격일 때만 표시
            const prev = idx > 0 ? messages[idx - 1] : null;
            const tsLabel = formatChatTimestamp(msg.timestamp, prev?.timestamp);
            return (
              <div
                key={msg.id}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                {tsLabel && (
                  <div
                    style={{
                      fontSize: 13,
                      color: '#8a7d5f',
                      textAlign: 'center',
                      margin: '4px 0 -4px',
                    }}
                  >
                    {tsLabel}
                  </div>
                )}
                <BubbleRow
                  msg={msg}
                  isLast={idx === messages.length - 1}
                  isCompleted={isCompleted}
                  showWrapUp={showWrapUp && idx === messages.length - 1}
                  onChipTap={(kw) => sendMessage(kw)}
                  onWrapUp={wrapUp}
                  onContinue={() => setShowWrapUp(false)}
                />
              </div>
            );
          })}

          {/* §7-5 Typing indicator — 목업 라벨 정렬 (命 + 사주를 살피는 중…) */}
          {isLoading && (
            <motion.div
              key="typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ alignSelf: 'flex-start', maxWidth: '85%' }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  fontSize: 13,
                  color: '#B8965A',
                  marginBottom: 6,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  命
                </span>
                <span>사주를 살피는 중…</span>
              </div>
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #ebe4d2',
                  borderRadius: '4px 16px 16px 16px',
                  padding: '14px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
                role="status"
                aria-live="polite"
              >
                {['命', '理', '학'].map((c, i) => (
                  <motion.span
                    key={i}
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#f4d166',
                      fontFamily: "'Noto Serif KR', serif",
                    }}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      delay: i * 0.3,
                    }}
                  >
                    {c}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* §8 SuggestedContentCard (세션당 최대 2개 · 마무리 후 1개) */}
        {activeRec && !isLoading && (
          <SuggestedContentCard
            rec={activeRec}
            onTap={handleOpenRec}
            onDismiss={handleDismissRec}
          />
        )}

        {/* 사주 미등록 안내 */}
        {!hasProfile && messages.length <= 1 && (
          <div
            style={{
              marginTop: 12,
              padding: '14px 16px',
              background: C.goldSoft,
              border: `1px solid ${C.goldLine}`,
              borderRadius: 14,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/input?from=chat')}
            role="button"
            aria-label="사주 등록하러 가기"
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.ink,
                margin: 0,
              }}
            >
              사주를 등록하면 더 정확하게 풀어드려요
            </p>
            <p
              style={{
                fontSize: 13,
                color: C.inkSoft,
                margin: '4px 0 0',
              }}
            >
              생년월일과 시간을 입력하면 맞춤 풀이가 가능해요
            </p>
          </div>
        )}

        {/* 완료 표시 */}
        {isCompleted && (
          <div
            style={{
              textAlign: 'center',
              padding: '16px 0',
            }}
          >
            <p
              style={{
                fontSize: 13,
                color: C.mute,
                margin: '0 0 12px',
              }}
            >
              이 풀이는 마무리됐어요
            </p>
            <button
              type="button"
              onClick={() => {
                const room = createChatRoom(userName || '새 풀이');
                navigate(`/chat/${room.id}`, { replace: true });
              }}
              style={{
                padding: '12px 22px',
                background: 'linear-gradient(180deg, #D2B477 0%, #B8965A 100%)',
                color: '#17110A',
                border: 'none',
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              새 대화 시작하기
            </button>
          </div>
        )}
      </div>

      {/* §9 Composer */}
      {!isCompleted && (
        <ChatComposer
          value={inputText}
          onChange={setInputText}
          onSend={() => sendMessage(inputText)}
          disabled={isLoading}
          ticketsTotal={tickets.total}
          freeAvailable={tickets.free > 0}
          onNeedCharge={() => {
            // 대화권 0 = 오늘 무료권도 이미 사용 → 한도 소진 카피 (sendMessage 분기와 동일)
            setConvertMode('quota_exceeded');
            setShowConvert(true);
          }}
        />
      )}

      {/* 변환 모달 (P2-4 분기 카피) */}
      <ConvertUnModal
        open={showConvert}
        mode={convertMode}
        redirectPath={`/chat/${sessionId}`}
        onClose={() => {
          setShowConvert(false);
          setConvertMode('default');
        }}
        onConverted={() => setRefreshTick((t) => t + 1)}
      />

      {/* §10 Menu Sheet */}
      <ChatMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenLatestResult={handleMenuOpenLatestResult}
        onChangeProfile={handleMenuChangeProfile}
        onDelete={handleMenuDelete}
      />

      {/* 삭제 확인 */}
      <AnimatePresence>
        {pendingRoomDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPendingRoomDelete(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 130,
              background: 'rgba(15,13,10,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 320,
                background: C.paper,
                borderRadius: 20,
                padding: '24px 24px 20px',
                textAlign: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.ink,
                  margin: '0 0 8px',
                }}
              >
                이 대화를 삭제할까요?
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: C.inkSoft,
                  lineHeight: 1.55,
                  margin: '0 0 20px',
                }}
              >
                삭제한 대화는 복구할 수 없어요.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setPendingRoomDelete(false)}
                  style={{
                    flex: 1,
                    height: 48,
                    background: C.surface,
                    color: C.inkSoft,
                    border: `1px solid ${C.line}`,
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteRoom}
                  style={{
                    flex: 1,
                    height: 48,
                    background: C.danger,
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  삭제하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §1-2 DarkChatHeader — 목업 .hd 진본 (다크 그라디언트 + 골드)
 *  · linear-gradient(180deg, #1a1a1a 0%, #2a2520 100%)
 *  · 좌: 뒤로(←) / 중앙: 타이틀(Noto Serif KR) + 골드 서브 / 우: 대화권 chip
 * ═════════════════════════════════════════════════════════════════ */
function DarkChatHeader({
  userName,
  ilgan,
  ticketsTotal,
  isCompleted,
  onBack,
  onTicketsTap,
  onMenuTap,
}: {
  userName: string;
  ilgan: string;
  ticketsTotal: number;
  isCompleted: boolean;
  onBack: () => void;
  onTicketsTap: () => void;
  onMenuTap: () => void;
}) {
  return (
    <header
      style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2520 100%)',
        color: '#fff',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid rgba(184,150,90,0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* 앱인토스: 토스 내비바 뒤로가기와 중복 → 숨김 (2026-09-16 심사 반려 · env.ts hasNativeNavBack) */}
      {!hasNativeNavBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            opacity: 0.85,
            fontSize: 22,
            lineHeight: 1,
            padding: '4px 6px',
            cursor: 'pointer',
          }}
        >
          ←
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          사주대화
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#f4d166',
            marginTop: 2,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {userName ? `${userName} 님 사주 기준` : '사주 등록 후 정확한 풀이'}
          {ilgan ? ` ${ilgan} 일간` : ''}
        </div>
      </div>
      {!isCompleted && (
        <button
          type="button"
          onClick={onTicketsTap}
          aria-label={`대화권 ${ticketsTotal}개, 탭하여 충전`}
          style={{
            background: 'rgba(184,150,90,0.15)',
            border: '1px solid rgba(184,150,90,0.3)',
            padding: '5px 10px',
            borderRadius: 100,
            fontSize: 13,
            color: '#f4d166',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          대화권 {ticketsTotal}
        </button>
      )}
      <button
        type="button"
        onClick={onMenuTap}
        aria-label="대화 메뉴"
        style={{
          width: 36,
          height: 36,
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.85)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DotsIcon />
      </button>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §6 ChatContextBanner (56 / 접기 32)
 * ═════════════════════════════════════════════════════════════════ */
function ContextBanner({
  name,
  birth,
  ilgan,
  oheng,
}: {
  name: string;
  birth: string;
  ilgan: string;
  oheng: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  // 목업 .ctx 진본 — 헤더 아래 골드 카드 (margin 12px 16px 0)
  // 命 한자 + 이름·생년 한 줄, 접기/펼치기 없음 (목업 정렬)
  return (
    <div
      style={{
        margin: '12px 16px 0',
        background: 'rgba(184,150,90,0.08)',
        border: '1px solid rgba(184,150,90,0.25)',
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 13,
        color: '#6a5d3f',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontFamily: "'Noto Serif KR', serif",
          color: '#B8965A',
          fontSize: 14,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        命
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <strong style={{ color: '#1a1a1a', fontWeight: 700 }}>{name}</strong>
        {birth ? ` (${birth})` : ''}
        {ilgan ? (
          <span style={{ color: '#B8965A', fontWeight: 600 }}>
            {', '}
            {ilgan}({oheng}) 일간
          </span>
        ) : null}
        <span style={{ color: '#8a7d5f' }}> 사주를 살피며 대화 중</span>
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * AI 버블 본문 — 진본 safeHtmlEmph 패턴 (autoEmphasize → sanitizeAiText)
 *  · 문단(\n\n) split 후 각 문단을 className "topic-section-body" 로 렌더
 *  · 강조 위계: <strong> 황금 형광펜 · <u> 골드 밑줄 · <em> 번트오렌지 (globals.css 매칭)
 * ═════════════════════════════════════════════════════════════════ */
function ChatBubbleContent({ text }: { text: string }) {
  // 진본 safeHtmlEmph 패턴 — 문단(\n\n) split 후 각 문단을 autoEmphasize → sanitizeAiText 로
  //   강조 주입(황금 형광펜 <strong> · 골드 밑줄 <u> · 번트오렌지 <em>) 후 dangerouslySetInnerHTML.
  //   className "topic-section-body" 로 globals.css 강조 CSS 가 매칭됨.
  const paragraphs = text.split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((para, pIdx) => (
        <p
          key={pIdx}
          className="topic-section-body"
          style={{
            margin: pIdx === paragraphs.length - 1 ? 0 : '0 0 10px',
          }}
          dangerouslySetInnerHTML={{
            __html: sanitizeAiText(autoEmphasize(stripMd(para))),
          }}
        />
      ))}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §7-3·§7-4 BubbleRow
 * ═════════════════════════════════════════════════════════════════ */
function BubbleRow({
  msg,
  isLast,
  isCompleted,
  showWrapUp,
  onChipTap,
  onWrapUp,
  onContinue,
}: {
  msg: ChatMessage;
  isLast: boolean;
  isCompleted: boolean;
  showWrapUp: boolean;
  onChipTap: (s: string) => void;
  onWrapUp: () => void;
  onContinue: () => void;
}) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        gap: isUser ? 0 : 8,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ maxWidth: '85%', flex: isUser ? '0 0 auto' : '1 1 auto' }}>
        {/* §7-3 AI 라벨 — 목업 진본 "命 사주를 살피는 중…" (라벨 통일, AI 표기 0) */}
        {!isUser && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              fontSize: 13,
              color: '#B8965A',
              marginBottom: 6,
              fontWeight: 600,
              letterSpacing: '0.1em',
            }}
          >
            <span
              aria-hidden
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              命
            </span>
            <span>사주 풀이</span>
          </div>
        )}
        <div
          role="article"
          aria-label={isUser ? '내 메시지' : '사주 풀이 메시지'}
          style={{
            background: isUser ? '#1a1a1a' : '#fff',
            color: isUser ? '#fff' : '#2a2520',
            padding: isUser ? '12px 14px' : '14px 16px',
            borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
            border: isUser ? 'none' : '1px solid #ebe4d2',
            boxShadow: isUser ? 'none' : '0 2px 8px rgba(0,0,0,0.04)',
            fontSize: 14,
            lineHeight: 1.75,
            whiteSpace: 'pre-line',
            wordBreak: 'keep-all',
          }}
        >
          {!isUser ? (
            <ChatBubbleContent text={stripMd(msg.content)} />
          ) : (
            stripMd(msg.content)
          )}
        </div>

        {/* §7-6 추천 칩 (assistant only · 마지막 버블만) */}
        {!isUser && msg.keywords && msg.keywords.length > 0 && !isCompleted && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              {msg.keywords.map((kw) => (
                <motion.button
                  key={kw}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onChipTap(kw)}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    background: C.goldSoft,
                    color: C.ink,
                    border: `1px solid ${C.line}`,
                    borderRadius: 999,
                    fontSize: 13.5,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {kw}
                </motion.button>
              ))}
            </div>
            {/* 마무리 토글 — 5+ 메시지 후 */}
            {showWrapUp && isLast && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={onContinue}
                  style={{
                    flex: 1,
                    height: 40,
                    background: C.surface,
                    color: C.inkSoft,
                    border: `1px solid ${C.line}`,
                    borderRadius: 12,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  계속 대화하기
                </button>
                <button
                  type="button"
                  onClick={onWrapUp}
                  style={{
                    flex: 1,
                    height: 40,
                    background: C.gold,
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  대화 마무리하기
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §8 SuggestedContentCard
 * ═════════════════════════════════════════════════════════════════ */
function SuggestedContentCard({
  rec,
  onTap,
  onDismiss,
}: {
  rec: ContentRec;
  onTap: () => void;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        marginTop: 4,
        padding: '14px 16px',
        background: C.goldSoft,
        border: `1px solid ${C.goldLine}`,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 38,
          height: 38,
          flexShrink: 0,
          borderRadius: 10,
          background: `${rec.color}1A`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: rec.color,
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "'Noto Serif KR', serif",
        }}
      >
        {rec.hanja}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.ink,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          {rec.title}
        </p>
        <p
          style={{
            fontSize: 13,
            color: C.inkSoft,
            margin: '3px 0 0',
          }}
        >
          {rec.desc}, {rec.priceLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={onTap}
        style={{
          height: 32,
          padding: '0 12px',
          background: C.ink,
          color: C.paper,
          border: 'none',
          borderRadius: 8,
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        보기
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="추천 닫기"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 24,
          height: 24,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: C.mute,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CloseIcon />
      </button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §9 ChatComposer (40 ~ 120 auto-grow)
 * ═════════════════════════════════════════════════════════════════ */
function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  ticketsTotal,
  freeAvailable,
  onNeedCharge,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  ticketsTotal: number;
  /** 오늘 무료 1회 남음 — 다음 질문은 무료권이 먼저 차감됨 (sendMessage 소비 순서와 일치) */
  freeAvailable: boolean;
  onNeedCharge: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // auto-grow
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = '40px';
    const next = Math.min(120, Math.max(40, ta.scrollHeight));
    ta.style.height = `${next}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !disabled;
  const blocked = ticketsTotal === 0;

  function handleSend() {
    if (blocked) {
      onNeedCharge();
      return;
    }
    if (!canSend) return;
    onSend();
  }

  return (
    <div
      style={{
        flexShrink: 0,
        position: 'sticky',
        bottom: 0,
        background: '#fff',
        borderTop: '1px solid #ebe4d2',
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      }}
    >
      {/* 목업 .ticket-cost — Composer 우상단 다크 칩 */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          top: -10,
          background: '#1a1a1a',
          color: '#f4d166',
          padding: '3px 10px',
          borderRadius: 100,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        {blocked ? '운 충전 필요' : freeAvailable ? '오늘 첫 질문 무료' : '대화권 1개 차감'}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          aria-label="질문 입력"
          aria-describedby="chat-tickets-hint"
          placeholder="궁금한 걸 물어보세요…"
          style={{
            flex: 1,
            minHeight: 40,
            maxHeight: 120,
            resize: 'none',
            outline: 'none',
            background: '#faf8f3',
            border: '1px solid #ebe4d2',
            borderRadius: 100,
            color: '#1a1a1a',
            fontSize: 14,
            lineHeight: 1.5,
            padding: '10px 16px',
            fontFamily: 'inherit',
            scrollbarWidth: 'none',
          }}
        />
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={handleSend}
          disabled={!canSend && !blocked}
          aria-label="전송"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: '50%',
            background:
              canSend || blocked
                ? 'linear-gradient(135deg, #f4d166, #B8965A)'
                : '#e5dfd0',
            color: '#1a1a1a',
            border: 'none',
            cursor: canSend || blocked ? 'pointer' : 'not-allowed',
            opacity: canSend || blocked ? 1 : 0.6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: canSend ? '0 2px 6px rgba(184,150,90,0.3)' : 'none',
          }}
        >
          <SendIcon />
        </motion.button>
      </div>
      <p
        id="chat-tickets-hint"
        style={{
          fontSize: 13,
          color: '#8a7d5f',
          margin: '6px 4px 0',
          textAlign: 'right',
        }}
      >
        {blocked
          ? '대화권이 없어요. 탭하면 운으로 바꿀 수 있어요.'
          : `대화권 ${ticketsTotal}개 남음${freeAvailable ? ' (오늘 무료 1회 포함)' : ''}`}
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * §10 ChatMenuSheet
 * ═════════════════════════════════════════════════════════════════ */
function ChatMenuSheet({
  open,
  onClose,
  onOpenLatestResult,
  onChangeProfile,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  onOpenLatestResult: () => void;
  onChangeProfile: () => void;
  onDelete: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(15,13,10,0.55)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: C.paper,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: '12px 0',
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 36,
                height: 4,
                borderRadius: 999,
                background: C.line,
                margin: '6px auto 12px',
              }}
            />
            <MenuItem label="이 사주 카드 보기" onClick={onOpenLatestResult} />
            <MenuItem label="다른 사주로 바꾸기" onClick={onChangeProfile} />
            <MenuItem
              label="대화 삭제"
              onClick={onDelete}
              danger
            />
            <div style={{ height: 8 }} />
            <MenuItem label="닫기" onClick={onClose} muted />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
  muted,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  muted?: boolean;
}) {
  const color = danger ? C.danger : muted ? C.mute : C.ink;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        padding: '14px 24px',
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        fontSize: 14.5,
        fontWeight: danger ? 600 : 500,
        color,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 아이콘
 * ═════════════════════════════════════════════════════════════════ */
function DotsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default ChatSessionPage;
