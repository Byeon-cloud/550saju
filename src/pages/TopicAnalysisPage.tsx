import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { getProfiles, saveReport, generateId, spendBalance, refundBalance, getBalance, getReport, type LocalReport } from '@/services/storage/localStore';
import { CHEONGAN_OHENG, OHENG_MAP, CHEONGAN_KO, JIJI_KO, CHEONGAN_EUMYANG, JIJI_EUMYANG } from '@/constants/oheng';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSeoMeta } from '@/hooks/useSeoMeta';
// 2026-05-29 — 주제분석 결과도 출석 이벤트(3일 연속·이번주) 카운트에 포함 (기존 누락 fix).
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import { generateTopicAnalysis, type TopicStreamErrorKind } from '@/services/ai/reportGenerator';
import { AILoading } from '@/components/common/AILoading';
import { ScoreRing } from '@/components/saju/ScoreRing';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { Pictogram, type TopicKey } from '@/components/brand/PictogramRegistry';
import { HourPickerSheet } from '@/components/common/HourPickerSheet';
import { normalizeTopicId, TOPIC_REGISTRY, TOPIC_IDS, type TopicId } from '@/constants/topics';
import { kstToday } from '@/utils/kstDate';
import { loveStars, loveDday, wealthStars, examFact, spouseSeatFact, josa } from '@/services/saju/hookFacts';
import { HJ, GoldCta, Pansim, hanjaNum, INK_HERO_BG } from '@/components/hanji/Hanji';

/** 2026-10-10 — 결제 확인 시트의 '내 사주' 한 줄 (만세력 사실만 · 홈 고민 카드와 같은 문장) */
function confirmFact(key: string, sd: any): string | null {
  try {
    if (!sd?.pillars?.[2]?.천간) return null;
    const today = kstToday();
    const yr = (d: string) => (Number(d.slice(0, 4)) > Number(today.slice(0, 4)) ? '내년 ' : '');
    if (key === 'love' || key === 'reunion') {
      const ls = loveStars(sd);
      const ld = loveDday(sd, today);
      const a = ls.count > 0 ? `연인의 별이 ${ls.count}개(${ls.chars.join('')}) 있어요.` : '사주에 연인의 별이 드러나 있지 않아요.';
      const b = ld ? ` ${yr(ld.month.start)}${ld.month.calMonth}월에 ${ls.count > 0 ? '하나가 더' : '그 별이'} 들어와요.` : '';
      return a + b;
    }
    if (key === 'wealth') {
      const w = wealthStars(sd);
      if (!w.count) return '재물의 별이 드러나 있지 않은 사주예요. 돈이 들어오는 길과 때를 따로 짚어 드려요.';
      const kind = w.pyeon && !w.jeong ? '큰돈이 오가는 별(편재)' : w.jeong && !w.pyeon ? '꾸준히 쌓는 별(정재)' : '쌓는 별과 오가는 별이 함께';
      return `재물의 별이 ${w.count}개 — ${kind}이에요.`;
    }
    if (key === 'exam') return examFact(sd);
    if (key === 'marriage') return spouseSeatFact(sd);
    return null;
  } catch { return null; }
}
import { normalizeSipsungKo } from '@/constants/sipsungColor';
import { findCurrentDaeun } from '@/services/saju/daeunCurrent';
import { sijiForClock, bandCenterHourForDate } from '@/services/saju/sijiPreview';
import type { DaeUn } from '@/types/saju';

/**
 * 상대방 출생 시간 — 분 단위 입력 + 진태양시 시지(時支) 실시간 표시 (2026-07 본인 입력과 통일).
 * 30분 블록 선택의 "3:30 경계 애매함"을 앱이 자동 판정. 비우면 미상(-1). 시(時)만 알면 시트 fallback.
 */
function PartnerTimeField({
  info,
  onChange,
  onOpenSheet,
}: {
  info: { birthYear: number; birthMonth: number; birthDay: number; birthHour: number; birthMinute?: number };
  onChange: (hour: number, minute: number) => void;
  onOpenSheet: () => void;
}) {
  const has = info.birthHour >= 0;
  const value = has
    ? `${String(info.birthHour).padStart(2, '0')}:${String(info.birthMinute ?? 0).padStart(2, '0')}`
    : '';
  const siji = has
    ? sijiForClock(info.birthYear, info.birthMonth, info.birthDay, info.birthHour, info.birthMinute ?? 0)
    : null;
  return (
    <div>
      <input
        type="time"
        value={value}
        onChange={(e) => {
          const m2 = e.target.value.match(/^(\d{1,2}):(\d{2})$/);
          if (m2) onChange(Number(m2[1]), Number(m2[2]));
          else onChange(-1, 0); // 비움 = 미상
        }}
        aria-label="상대방 태어난 시각 (시:분)"
        className="w-full h-11 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
      />
      {siji ? (
        <p className="text-[11px] text-text-hint mt-1">
          진태양시(약 30분) 보정 후 <b style={{ color: '#8C6D3D' }}>{siji.ko}({siji.hanja})</b> 로 계산돼요
        </p>
      ) : (
        <p className="text-[11px] text-text-hint mt-1">모르면 비워두세요 — 알면 시주까지 분석하여 더 정확해요</p>
      )}
      <button
        type="button"
        onClick={onOpenSheet}
        className="text-[11px] font-semibold mt-1 underline underline-offset-2"
        style={{ color: '#8C6D3D' }}
      >
        시각은 모르고 태어난 시(時)만 아세요?
      </button>
    </div>
  );
}
// Phase 2 Stage 2A — 공통 MonthTimeline 컴포넌트
// 2026-05-28 — wealth 에서 제거 (AreaChart 와 중복). buildMonthCells 만 유지 (다른 주제 wiring 대비 reserved).
import { buildMonthCells } from './topic/_month_timeline';
// Phase D'-2 Bundle 2 (#54) — mockup 진본 시각 정렬
import {
  TOPIC_CHROME,
  TopicHero,
  TopicSajuMini,
  TopicOhengBalance,
  TopicScoreCard,
  TopicConclusionDark,
  TopicSection,
  PullQuote,
  TopicActionList,
  TopicSourceCite,
  type TopicChromeKey,
  type TopicSajuMiniCell,
  type TopicActionItem,
} from './topic/_chrome';
// 2026-05-07 Option A — JDS_Topic_IA 신규 통합 view (8섹션 골격)
// AI prompt 재작성 (Phase 4) 까지 USE_TOPIC_MOCKUP_VIEW=false 로 leg스 보존
import { TopicMockupView } from './topic/TopicMockupView';
import { TOPIC_THEMES, normalizeTopicKey, type TopicResultV2 } from './topic/_topic_themes';
// 2026-10-04 — 주제 반쪽(__partial) 자가치유 · 스트림 마감 정책 · 폴백 전 서버 완성본 채택
import * as topicHeal from './topic/topicPartialHeal';
import { getTopicPrice, formatPriceLabel } from '@/constants/pricing';
import { NextStepsCard, openChatWithResult } from '@/components/common/NextStepsCard';
import { ReviewAsk } from '@/components/common/ReviewAsk';

/** Phase 4 (AI prompt 재작성) 완료 후 true 로 flip — JDS_Topic_IA 통합 결과 페이지 활성화 */
const USE_TOPIC_MOCKUP_VIEW = false;

/** 현재 AI 응답 → TopicResultV2 best-effort 매핑 (AI prompt 재작성 전 임시 어댑터) */
function adaptToTopicResultV2(result: any, topicId: string): TopicResultV2 {
  const key = normalizeTopicKey(topicId);
  const theme = TOPIC_THEMES[key];
  return {
    topicId: key,
    title: result?.title || theme.sec01Title,
    oneLineConclusion: result?.oneLineSummary || result?.oneLineConclusion || result?.summary || '',
    conclusionSajuRef: result?.sajuBasis || result?.conclusionSajuRef,
    narrative: Array.isArray(result?.sections)
      ? result.sections.map((s: any) => s?.body || s?.content || '').filter(Boolean).join('\n\n')
      : (result?.deepAnalysis || result?.narrative || ''),
    sajuHighlights: result?.sajuHighlights || result?.topicData?.highlights,
    topicSipsung: result?.topicSipsung || {
      main: { name: theme.sipsungAxes.main, count: 0, level: '보통' },
      secondary: { name: theme.sipsungAxes.secondary, count: 0, level: '보통' },
      resistance: { name: theme.sipsungAxes.resistance, count: 0, level: '보통' },
      aux: { name: theme.sipsungAxes.aux, count: 0, level: '보통' },
      interpretation: '',
    },
    timeline: result?.timeline || { type: theme.timelineType, items: [] },
    meet: result?.meet || { boost: { who: '', why: '' }, clash: { who: '', why: '' }, calm: { who: '', why: '' } },
    doList: Array.isArray(result?.doList) ? result.doList : [],
    dontList: Array.isArray(result?.dontList) ? result.dontList : [],
    lucky: result?.lucky || result?.luckyProfile || {
      color: { value: '', reason: '' },
      direction: { value: '', reason: '' },
      hour: { value: '', reason: '' },
      number: { value: '', reason: '' },
      word: { value: '', reason: '' },
      food: { value: '', reason: '' },
    },
    pullQuote: result?.pullQuote || result?.actionAdvice || '',
    upsellLine: result?.upsellLine,
  };
}

/* ─── 주제 설정 — 이모지 제거, 브랜드 픽토그램 사용.
 *    key가 PictogramRegistry의 topic:* 와 1:1 매핑. (브랜드픽토그램_시스템.md)
 *
 *    TODO(audit-task-3 / inline-svg → Pictogram 마이그레이션):
 *      이 파일에 인라인 SVG ~33개 잔존 (별·번개·하트·새싹·체크·플러스·사람·집·책·서류 등 ~15 가지 모양).
 *      PictogramRegistry 에 신규 키 15+ 추가 + JSX 50+ 사이트 교체 필요 → 회귀 위험 큼.
 *      `svg width="14" height="14" viewBox="0 0 24 24"` 패턴 일괄 grep 후 Pictogram 컴포넌트로 단계적 이전 권장.
 *      차트(레이더·게이지·도넛 등 unique visualization SVG) 은 보존.
 */
const TOPICS: Record<TopicKey, { label: string; color: string; desc: string }> = {
  // SSOT v1 컬러 정렬 (2026-04-22 · @/constants/topics)
  love:     { label: '연애운',       color: '#8C6D3D', desc: '만남·관계·인연 흐름' },
  wealth:   { label: '재물운',       color: '#8C6D3D', desc: '돈·투자·현금흐름 변곡' },
  career:   { label: '직업운',       color: '#8C6D3D', desc: '커리어·승진·평생 결' },
  marriage: { label: '결혼운',       color: '#8C6D3D', desc: '인연 시기와 배우자 결' },
  business: { label: '사업운',       color: '#8C6D3D', desc: '창업·자영업 흐름과 시기' },
  health:   { label: '건강운',       color: '#8C6D3D', desc: '체질·기운·주의 시기' },
  reunion:  { label: '재회운',       color: '#8C6D3D', desc: '헤어진 사람과의 흐름' },
  study:    { label: '학업운',       color: '#8C6D3D', desc: '집중력·지식 흡수·학습 패턴' },
  exam:     { label: '합격·이직운', color: '#8C6D3D', desc: '시험·이직 결정 시기' }, // SSOT v1 신규
  move:     { label: '이사·이동운', color: '#8C6D3D', desc: '이사·이동 길흉 방향' }, // SSOT v1 canonical
  social:   { label: '대인관계운',   color: '#8C6D3D', desc: '귀인운, 구설수 주의, 관계 패턴' }, // legacy 유지
  moving:   { label: '이사·이동운', color: '#8C6D3D', desc: '이사·이동 길흉 방향' }, // legacy — 'move' alias
};

const OHENG_COLORS: Record<string, string> = { 목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82' };

/** 2026-05-29 — 토픽별 섹션 제목 SSOT (functions/src/ai/claudeTopic.ts TOPIC_CONFIGS.sections 미러).
 *  스트리밍 중 결과 페이지가 "빈 화면 → 갑툭튀" 하지 않도록, 도착 전 섹션 헤더 + 스켈레톤 스캐폴드를 미리 렌더.
 *  AI 가 실제 heading 을 보내면 그걸 우선 사용, 없으면 이 제목으로 fallback. */
const TOPIC_SECTION_TITLES: Record<string, string[]> = {
  love: ['나의 연애 스타일', '사주 궁합이 잘 맞는 이성', '인연이 시작되는 시기와 장소', '연애 중 반복되는 패턴', '올해 연애 흐름과 전략'],
  wealth: ['돈 버는 스타일', '재물 흐름 분석', '투자 성향과 적기', '새는 돈 패턴', '올해 재물 전략'],
  career: ['타고난 직업 적성', '사주가 부르는 직종 TOP 5', '평생 커리어 흐름', '명리학적 직업 근거', '일터에서 반복되는 관계 패턴'],
  marriage: ['결혼 적기 분석', '미래 배우자의 성향', '결혼 후 생활 패턴', '배우자 가족 관계', '결혼 준비 조언'],
  business: ['사업가 기질 분석', '맞는 업종', '창업·확장 타이밍', '동업 궁합', '사업 리스크 관리'],
  health: ['오행별 취약 장기', '체질 분석', '올해 건강 주의 시기', '정신 건강 패턴', '건강 개선 전략'],
  study: ['나의 학습 체질 분석', '집중이 잘 되는 시간과 환경', '실력이 오르는 시기', '슬럼프 극복법', '올해 공부 로드맵'],
  exam: ['올해 합격·변동 기운', '유리한 방향과 분야', '시험·면접·결정 시기', '변동 후 적응 전망', '올해 실전 전략'],
  move: ['이동 적기 분석', '좋은 방향', '이사·유학·이주 전망', '해외운', '올해 이동 전략'],
  reunion: ['이별의 사주적 원인 분석', '상대방의 사주 성향 분석', '두 사람의 오행 궁합 구조', '전통 연애 신살(神殺) 분석', '재회 가능성과 적기', '월별 재회 에너지 흐름', '재회 실전 전략', '재회 후 관계 변화 예측', '새 인연 vs 재회 — 냉정한 비교', '재회 성공을 위한 개운법'],
};

// 2026-05-28 PM — 가격 SSOT: src/constants/pricing.ts 의 getTopicPrice 사용. 로컬 정의 삭제.

/** 토픽 hex 컬러 → ExtensionHero 패턴 3-stop gradient (lighten + base + darken) */
function shadeHex(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  return `#${[adj(r), adj(g), adj(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
// 2026-05-07: 검정 톤으로 통일 — topicHeroGrad 미사용 (코드 보존)
function topicHeroGrad(color: string): string {
  return `linear-gradient(135deg, ${shadeHex(color, 0.10)} 0%, ${color} 60%, ${shadeHex(color, -0.18)} 100%)`;
}
void topicHeroGrad;
/** 토픽 한자 (legacy — TopicHero/TopicChrome 이 SSOT) — 호환 export 유지 */
const TOPIC_HANJA: Record<string, string> = {
  love: '桃', wealth: '財', career: '官', marriage: '婚', business: '業',
  health: '壽', reunion: '復', study: '學', exam: '進', move: '移', moving: '移', social: '人',
};
void TOPIC_HANJA;

/** AI가 "(추정)", "(추론)" 등 괄호 주석을 붙여 보내는 경우 한자 1글자만 추출 */
function cleanHanja(raw: string | undefined): string {
  if (!raw) return '?';
  // 괄호+내용 제거, 앞뒤 공백 제거 후 첫 글자만
  const stripped = raw.replace(/\s*[\(（].*?[\)）]/g, '').trim();
  return stripped.charAt(0) || '?';
}
/** 오행 텍스트 정리 — "(추정)" 제거 후 목/화/토/금/수만 추출 */
function cleanOheng(raw: string | undefined): string {
  if (!raw) return '';
  const stripped = raw.replace(/\s*[\(（].*?[\)）]/g, '').trim();
  const match = stripped.match(/[목화토금수]/);
  return match ? match[0] : stripped.charAt(0) || '';
}

type Phase = 'select' | 'loading' | 'result';

/** 점수 -> 한자 판정 (사주 전통 방식) */
function getJudgment(score: number) {
  if (score >= 85) return { hanja: '大吉', reading: '대길', desc: '매우 좋은 기운', color: '#B8965A', bg: 'rgba(184,150,90,0.12)' };
  if (score >= 70) return { hanja: '吉',   reading: '길',   desc: '좋은 기운의 흐름', color: '#4E7A57', bg: 'rgba(78,122,87,0.10)' };
  if (score >= 55) return { hanja: '平',   reading: '평',   desc: '무난한 흐름',   color: '#3E5F82', bg: 'rgba(62,95,130,0.10)' };
  if (score >= 40) return { hanja: '小注意', reading: '소주의', desc: '보완이 필요한 기운', color: '#8A6226', bg: 'rgba(138,98,38,0.10)' };
  return               { hanja: '要注意', reading: '요주의', desc: '적극 보완 필요', color: '#B04A38', bg: 'rgba(176,74,56,0.10)' };
}

const LUCKY_COLOR_HEX: Record<string, string> = {
  // 빨강 계열
  빨강: '#B04A38', 빨간색: '#B04A38', 붉은색: '#B04A38', 적색: '#B04A38', 레드: '#B04A38',
  진빨강: '#8A3326', 와인: '#880E4F', 와인색: '#880E4F',
  // 파랑 계열
  파랑: '#3E5F82', 파란색: '#3E5F82', 청색: '#3E5F82', 블루: '#3E5F82',
  진파랑: '#2A4560', 남색: '#1A237E', 남청색: '#1A237E', 감색: '#1A237E',
  하늘: '#42A5F5', 하늘색: '#42A5F5', 연파랑: '#42A5F5', 스카이: '#42A5F5',
  진청색: '#2A4560', 진청: '#2A4560',
  // 초록 계열
  초록: '#4E7A57', 초록색: '#4E7A57', 녹색: '#4E7A57', 그린: '#4E7A57',
  연두: '#7CB342', 연두색: '#7CB342',
  진초록: '#355A3E', 짙은초록: '#355A3E',
  // 청록 계열
  청록: '#00897B', 청록색: '#00897B', 청녹: '#00897B', 청녹색: '#00897B',
  민트: '#26A69A', 민트색: '#26A69A', 옥색: '#26A69A', 옥: '#26A69A',
  터코이즈: '#00897B', 에메랄드: '#00796B',
  // 노랑 계열
  노랑: '#F9A825', 노란색: '#F9A825', 황색: '#F9A825', 옐로: '#F9A825',
  황금: '#FFB300', 황금색: '#FFB300',
  연노랑: '#FDD835',
  // 흰색/검정 계열
  흰색: '#BDBDBD', 백색: '#BDBDBD', 하양: '#BDBDBD', 하얀색: '#BDBDBD', 화이트: '#BDBDBD',
  검정: '#57534D', 검은색: '#57534D', 흑색: '#57534D', 블랙: '#57534D',
  회색: '#7D7870', 회색빛: '#7D7870', 은색: '#9E9E9E', 실버: '#9E9E9E',
  // 금색 계열
  금색: '#B8965A', 골드: '#B8965A', 금: '#B8965A', 황토: '#BF8C3E', 황토색: '#BF8C3E',
  갈색: '#795548', 브라운: '#795548', 갈: '#795548',
  베이지: '#D7CCC8', 아이보리: '#EFEBE9',
  // 보라 계열
  보라: '#7A5C7E', 보라색: '#7A5C7E', 자색: '#7A5C7E', 퍼플: '#7A5C7E',
  연보라: '#BA68C8', 라벤더: '#BA68C8',
  진보라: '#4A148C', 자주: '#AD1457', 자주색: '#AD1457',
  // 분홍 계열
  분홍: '#8C6D3D', 분홍색: '#8C6D3D', 핑크: '#8C6D3D',
  연분홍: '#F48FB1', 로즈: '#C62828', 장미: '#C62828',
  // 주황 계열
  주황: '#8A6226', 주황색: '#8A6226', 오렌지: '#8A6226',
  살구: '#FF8A65', 살구색: '#FF8A65', 코랄: '#FF7043',
};

/** 행운 컬러 텍스트에서 hex 찾기 — "검은색, 진청색(수 기운)" → '#57534D' */
function findLuckyColorHex(value: string): string | null {
  if (!value) return null;
  for (const [key, hex] of Object.entries(LUCKY_COLOR_HEX)) {
    if (value.includes(key)) return hex;
  }
  return null;
}

/** 등급 기준표 데이터 */
const GRADE_SCALE = [
  { hanja: '大吉', reading: '대길', range: '85~100', color: '#B8965A' },
  { hanja: '吉', reading: '길', range: '70~84', color: '#4E7A57' },
  { hanja: '平', reading: '평', range: '55~69', color: '#3E5F82' },
  { hanja: '小注意', reading: '소주의', range: '40~54', color: '#8A6226' },
  { hanja: '要注意', reading: '요주의', range: '~39', color: '#B04A38' },
];

const LOADING_MSGS = [
  '사주 원국을 분석하고 있어요...',
  '오행의 흐름을 읽고 있어요...',
  '십성 배치를 확인하고 있어요...',
  '현재 대운과 연결하고 있어요...',
  '맞춤 분석을 정리하고 있어요...',
];

/* ─── 가로 바 차트 컴포넌트 ─── */
function HBar({ value, label, color, suffix = '' }: { value: number; label: string; color: string; suffix?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-secondary leading-snug">{label}</span>
        <span className="text-[11px] font-bold flex-shrink-0 ml-2" style={{ color }}>{value}{suffix}</span>
      </div>
      <div className="h-[14px] rounded-full overflow-hidden" style={{ background: `${color}10` }}>
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${Math.min(value, 100)}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
      </div>
    </div>
  );
}

/* ─── 뱃지 ─── */
function TypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <motion.span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold"
      style={{ background: `${color}15`, color, border: `1.5px solid ${color}25` }}
      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}>
      {label}
    </motion.span>
  );
}

/* ════════════════════════════════════════════════
   공통 시각화 컴포넌트 (전 주제 공통)
   ════════════════════════════════════════════════ */

/** 5축 레이더 차트 */
function SubScoreRadar({ subScores, color }: { subScores: { axis: string; value: number }[]; color: string }) {
  if (!subScores?.length) return null;
  return (
    <FadeIn delay={0.15}>
      <div className="card">
        <p className="text-h3 text-text-primary mb-1">세부 역량 분석</p>
        <p className="text-[11px] text-text-hint mb-2">5가지 항목별 점수 비교</p>
        <div className="h-52 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={subScores.map(s => ({ name: s.axis, value: s.value, fullMark: 100 }))}>
              <PolarGrid strokeOpacity={0.12} />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2}
                dot={{ r: 3, fill: color, strokeWidth: 0 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
          {subScores.map((s, i) => (
            <span key={i} className="text-[11px] text-text-muted">
              {s.axis} <strong className="font-bold" style={{ color }}>{s.value}</strong>
            </span>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}

/** 핵심 키워드 태그 — P0-4 (2026-05-28 PM) 제거됨. 본문 <strong> 형광펜으로 동일 정보 노출되어 중복.
 *  컴포넌트 자체는 ts-expect-error 방지를 위해 stub 으로 유지 (호출처 다른 페이지에서 import 가능). */
function KeywordTags(_props: { keywords?: string[]; color: string }) {
  return null;
}
void KeywordTags;

/** 강점 / 주의점 — P0-5 (2026-05-28 PM) Daily SSOT 통일.
 *  Daily 패턴: 단일 카드 + 좋은 점(green chip) / 조심할 점(red chip) 인라인 노출.
 *  기존 2-column grid → 1 card 안에 좌측 chip + 우측 내용 패턴 (시각 무게 60% 다이어트). */
function StrengthsCautions({ strengths, cautions }: { strengths?: string[]; cautions?: string[]; color: string }) {
  if (!strengths?.length && !cautions?.length) return null;
  return (
    <FadeIn delay={0.12}>
      <div
        style={{
          background: '#F8F5EE',
          border: '1px solid #E5DFD0',
          borderRadius: 14,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {strengths?.map((s, i) => (
          <div key={`s-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                color: '#1B5E2C',
                background: 'rgba(78,122,87,0.16)',
                border: '1px solid rgba(78,122,87,0.32)',
                padding: '3px 10px',
                borderRadius: 100,
                letterSpacing: '0.02em',
                minWidth: 56,
                textAlign: 'center',
              }}
            >
              좋은 점
            </span>
            <span style={{ flex: 1, fontSize: 12.5, color: '#1A1A1A', lineHeight: 1.55, wordBreak: 'keep-all' }}>{s}</span>
          </div>
        ))}
        {cautions?.map((c, i) => (
          <div key={`c-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                color: '#B33A0E',
                background: 'rgba(176,74,56,0.10)',
                border: '1px solid rgba(176,74,56,0.32)',
                padding: '3px 10px',
                borderRadius: 100,
                letterSpacing: '0.02em',
                minWidth: 56,
                textAlign: 'center',
              }}
            >
              조심할 점
            </span>
            <span style={{ flex: 1, fontSize: 12.5, color: '#1A1A1A', lineHeight: 1.55, wordBreak: 'keep-all' }}>{c}</span>
          </div>
        ))}
      </div>
    </FadeIn>
  );
}

/* ════════════════════════════════════════════════
   주제별 시각화 컴포넌트
   ════════════════════════════════════════════════ */

/* ── 2026-06-03 주제운 디자인 통일 — 공용 stat 타일 ──
 *  산만함 주범이던 산발 rgba(초록/빨강/주황/파랑/골드)를 정리:
 *   · default = 토픽 색 (각 주제 정체성 유지)
 *   · good    = 초록 (긍정·유리)  · warn = 웜레드 (주의·위험)
 *  타이포·패딩·radius 일관 → 종합사주 톤에 근접하되 주제색은 살림. */
type StatTone = 'default' | 'good' | 'warn';
function StatTile({ label, value, color, tone = 'default', big = false }:
  { label: string; value: React.ReactNode; color: string; tone?: StatTone; big?: boolean }) {
  const pal = tone === 'good'
    ? { bg: 'rgba(78,122,87,0.08)', fg: '#4E7A57' }
    : tone === 'warn'
      ? { bg: 'rgba(192,57,43,0.07)', fg: '#C0392B' }
      : { bg: `${color}0E`, fg: color };
  return (
    <div className="rounded-xl px-2.5 py-3 text-center" style={{ background: pal.bg }}>
      <p className="text-[11px] text-text-hint mb-1 leading-tight">{label}</p>
      <p className={`${big ? 'text-[15px]' : 'text-[13px]'} font-bold leading-tight`} style={{ color: pal.fg }}>{value}</p>
    </div>
  );
}

function LoveViz({ data, color, myName, partnerName }: { data: any; color: string; myName?: string; partnerName?: string }) {
  if (!data) return null;
  const it = data.idealType;
  const fields = it ? [
    { label: '성격', value: it.personality },
    { label: '직업군', value: it.job },
    { label: '나이 경향', value: it.ageGap },
    { label: '만남 장소', value: it.meetPlace },
    { label: '외모 경향', value: it.appearance },
  ].filter(r => r.value) : [];

  // 2026-05-28 — 분기별 신규 필드 (server schema 분리)
  // 🚨 2026-10-09 — 상태는 서버 스탬프(topicData.loveStatus) 우선. 이전엔 '상대 궁합 데이터 유무'로 갈라
  //   연애중인데 상대 생년월일을 안 넣은 사람이 솔로 화면('인연 시작 유력 시기'·'궁합 잘 맞는 이성')을 봤다.
  const loveStatus: 'solo' | 'some' | 'dating' =
    data.loveStatus === 'some' || data.loveStatus === 'dating' || data.loveStatus === 'solo'
      ? data.loveStatus
      : (data.partnerCompat ? (data.confessionTiming ? 'some' : 'dating') : 'solo');
  const isSolo = loveStatus === 'solo';
  const isSome = loveStatus === 'some' && !!(data.confessionTiming || data.approachStrategy || data.signalReading || data.interestLevel != null);
  const isDating = loveStatus === 'dating' && !!(data.stabilityPhase || data.longTermOutlook || data.riskMonth || data.deepenTip);

  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 2026-05-28 — 솔로/썸/연애중 분기별 시각 차별화 */}
        {isSolo && (data.newEncounterMonth || data.encounterPlace || data.selfPreparation) && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] font-black" style={{ background: `${color}18`, color, fontFamily: "'Noto Serif KR', serif" }}>緣</span>
              <p className="text-h3 text-text-primary">새 인연이 닿는 자리</p>
            </div>
            <div className="space-y-2.5">
              {data.newEncounterMonth && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>새 인연 가능성 월</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.newEncounterMonth}</p>
                </div>
              )}
              {data.encounterPlace && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>만남이 잘 풀리는 자리</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.encounterPlace}</p>
                </div>
              )}
              {data.selfPreparation && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>인연 전에 다듬을 결</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.selfPreparation}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {isSome && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] font-black" style={{ background: `${color}18`, color, fontFamily: "'Noto Serif KR', serif" }}>桃</span>
              <p className="text-h3 text-text-primary">썸의 결을 풀어내는 자리</p>
            </div>
            <div className="space-y-2.5">
              {data.confessionTiming && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>고백 적기</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.confessionTiming}</p>
                </div>
              )}
              {data.interestLevel != null && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>상대방의 호감 강도</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[20px] font-black" style={{ color }}>{typeof data.interestLevel === 'number' ? `${data.interestLevel}%` : data.interestLevel}</span>
                    {typeof data.interestLevel === 'number' && (
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: `${color}15` }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, data.interestLevel)}%`, background: color }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {data.approachStrategy && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>접근 전략</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.approachStrategy}</p>
                </div>
              )}
              {data.signalReading && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>지금 상대의 마음 신호</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.signalReading}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {isDating && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] font-black" style={{ background: `${color}18`, color, fontFamily: "'Noto Serif KR', serif" }}>戀</span>
              <p className="text-h3 text-text-primary">관계의 흐름과 안정성</p>
            </div>
            <div className="space-y-2.5">
              {data.stabilityPhase && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>현재 관계 단계</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.stabilityPhase}</p>
                </div>
              )}
              {data.longTermOutlook && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>장기 전망 (6~12개월)</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.longTermOutlook}</p>
                </div>
              )}
              {data.riskMonth && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(138,98,38,0.06)' }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color: '#8A6226' }}>다툼 주의 시기</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.riskMonth}</p>
                </div>
              )}
              {data.deepenTip && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>깊어지는 방법</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{data.deepenTip}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* 도화살 + 매력 원천 + 인연 시기 */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-h3 text-text-primary">연애 사주 프로필</p>
            {data.loveStyle && <TypeBadge label={data.loveStyle} color={color} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.doHwaSal != null && (
              <StatTile label="매력의 별 · 도화살" value={data.doHwaSal ? '있음' : '없음'} color={color} tone={data.doHwaSal ? 'good' : 'default'} big />
            )}
            {data.bestMeetMonth && (
              <StatTile label={loveStatus === 'some' ? '썸이 연애로 이어지는 시기' : loveStatus === 'dating' ? '관계가 깊어지는 시기' : '인연 시작 유력 시기'} value={data.bestMeetMonth} color={color} tone="good" big />
            )}
          </div>
          {data.attractionSource && (
            <div className="mt-2.5 rounded-xl py-2.5 px-3" style={{ background: `${color}06` }}>
              <p className="text-[11px] font-semibold mb-0.5" style={{ color }}>매력의 원천</p>
              <p className="text-[12px] text-text-primary leading-snug">{data.attractionSource}</p>
            </div>
          )}
          {data.charmPoint && (
            <div className="mt-2 rounded-xl py-2.5 px-3" style={{ background: 'rgba(140,109,61,0.04)' }}>
              <p className="text-[11px] font-semibold mb-0.5" style={{ color }}>나의 매력 포인트</p>
              <p className="text-[12px] text-text-primary leading-snug">{data.charmPoint}</p>
            </div>
          )}
        </div>

        {/* 궁합 좋은 이성 — 연애중이면 숨김 (이미 연인이 있다) */}
        {fields.length > 0 && loveStatus !== 'dating' && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">{loveStatus === 'some' ? '내 사주와 잘 맞는 사람의 결' : '사주 궁합이 잘 맞는 이성'}</p>
            <div className="space-y-2.5">
              {fields.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[11px] font-bold mt-0.5 w-14 flex-shrink-0 text-right" style={{ color }}>{f.label}</span>
                  <p className="text-[12px] text-text-primary leading-snug flex-1">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 상대방 궁합 분석 (썸/연애중일 때만) */}
        {data.partnerCompat && (() => {
          const pc = data.partnerCompat;
          const ohengBg: Record<string, string> = { 목: 'rgba(78,122,87,0.10)', 화: 'rgba(176,74,56,0.10)', 토: 'rgba(176,127,56,0.10)', 금: 'rgba(74,74,74,0.10)', 수: 'rgba(62,95,130,0.10)' };
          const ohengText: Record<string, string> = { 목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82' };
          const typeIcon: Record<string, { icon: string; color: string; bg: string }> = {
            '합': { icon: '合', color: '#4E7A57', bg: 'rgba(78,122,87,0.12)' },
            '충': { icon: '沖', color: '#B04A38', bg: 'rgba(176,74,56,0.10)' },
            '형': { icon: '刑', color: '#8A6226', bg: 'rgba(138,98,38,0.10)' },
            '해': { icon: '害', color: '#8A6226', bg: 'rgba(138,98,38,0.10)' },
            '상생': { icon: '生', color: '#4E7A57', bg: 'rgba(78,122,87,0.12)' },
            '상극': { icon: '克', color: '#B04A38', bg: 'rgba(176,74,56,0.10)' },
          };
          const getTS = (type: string) => { for (const [k, v] of Object.entries(typeIcon)) if (type?.includes(k)) return v; return { icon: '?', color: '#7D7870', bg: 'rgba(0,0,0,0.06)' }; };
          const pComp = pc.pillarComparison;
          const interMap: Record<string, any> = {};
          (pComp?.interactions || []).forEach((it: any) => {
            if (it.position === '년주') interMap['year'] = it;
            else if (it.position === '월주') interMap['month'] = it;
            else if (it.position === '일주') interMap['day'] = it;
          });
          return (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-h3 text-text-primary">두 사람의 연애 궁합</p>
                {pc.compatScore != null && (
                  <span className="text-[12px] font-bold px-2.5 py-1 rounded-lg" style={{ background: `${color}10`, color }}>{pc.compatScore}점</span>
                )}
              </div>
              {pc.loveChemistry && (
                <p className="text-[11px] text-text-muted mb-3 leading-snug">{pc.loveChemistry}</p>
              )}

              {/* 기둥 비교 — 2026-05-28 가독성 개선: 한자 박스 크게(44px), 행간 넓힘, 가운데 아이콘 명확화 */}
              {pComp && (() => {
                const renderPillar = (p: any, side: 'left' | 'right') => {
                  const oh = cleanOheng(p.oheng);
                  const bg = ohengBg[oh] || 'rgba(0,0,0,0.03)';
                  const fg = ohengText[oh] || '#3D3427';
                  return (
                    <div className={`flex-1 rounded-xl p-3 flex items-center gap-2 ${side === 'right' ? 'justify-end' : ''}`} style={{ background: bg, border: `1px solid ${fg}25` }}>
                      {side === 'right' && <span className="text-[12px] font-bold" style={{ color: fg }}>{oh}</span>}
                      <div className="flex gap-1.5">
                        <span className="w-11 h-11 rounded-lg flex items-center justify-center text-[20px] font-black" style={{ background: '#fff', color: fg, border: `1.5px solid ${fg}40`, fontFamily: "'Noto Serif KR', serif" }}>{cleanHanja(p.cheongan)}</span>
                        <span className="w-11 h-11 rounded-lg flex items-center justify-center text-[20px] font-black" style={{ background: '#fff', color: fg, border: `1.5px solid ${fg}40`, fontFamily: "'Noto Serif KR', serif" }}>{cleanHanja(p.jiji)}</span>
                      </div>
                      {side === 'left' && <span className="text-[12px] font-bold" style={{ color: fg }}>{oh}</span>}
                    </div>
                  );
                };
                return (
                  <div className="mb-3">
                    <p className="text-[12px] text-text-hint mb-3 font-semibold">사주 기둥(柱) 비교</p>
                    <div className="space-y-4">
                      {[{ key: 'year', label: '년주' }, { key: 'month', label: '월주' }, { key: 'day', label: '일주' }].map(({ key, label }) => {
                        const myP = pComp.myPillars?.[key];
                        const ptP = pComp.partnerPillars?.[key];
                        const inter = interMap[key];
                        const ts = inter ? getTS(inter.type) : null;
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-[12px] text-text-hint font-bold">{label}</span>
                              {ts && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full ml-auto" style={{ background: ts.bg, color: ts.color }}>{ts.icon} {inter.type}</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {myP && renderPillar(myP, 'left')}
                              <div className="flex-shrink-0 w-8 flex items-center justify-center">
                                {ts ? <span className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-black" style={{ background: ts.bg, color: ts.color, border: `1.5px solid ${ts.color}30` }}>{ts.icon}</span> : <span className="text-[13px] text-text-hint font-semibold">vs</span>}
                              </div>
                              {ptP && renderPillar(ptP, 'right')}
                            </div>
                            {inter?.desc && <p className="text-[12px] text-text-secondary mt-2 ml-1 leading-relaxed" style={{ wordBreak: 'keep-all' }}>{inter.desc}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 px-1" style={{ borderTop: '1px dashed rgba(0,0,0,0.08)' }}>
                      <span className="text-[11px] font-bold" style={{ color }}>← {myName ? `${myName} 님 (나)` : '나'}</span>
                      <span className="text-[11px] text-text-hint font-semibold">{partnerName ? `${partnerName} 님 (상대)` : '상대'} →</span>
                    </div>
                    {/* 2026-06-12 신뢰 카피 — "양방향 동일 판정" CS 혼란 예방 (합·충은 만세력 객관 계산값) */}
                    <p className="text-[11px] text-text-hint mt-2 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                      두 분의 합·충 판정은 만세력 계산값이라 어느 분 기준으로 보셔도 똑같아요. 풀이만 {myName ? `${myName} 님` : '나'}의 사주를 중심으로 전개돼요.
                    </p>
                  </div>
                );
              })()}

              {/* 잘 맞는 점 / 안 맞는 점 — 2026-05-28 가독성 개선 */}
              {(pc.matchPoints?.length > 0 || pc.clashPoints?.length > 0) && (
                <div className="space-y-2.5 mb-3">
                  {pc.matchPoints?.map((m: string, i: number) => (
                    <div key={`m${i}`} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(78,122,87,0.07)' }}>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-black mt-0.5" style={{ background: 'rgba(78,122,87,0.18)', color: '#4E7A57', border: '1px solid rgba(78,122,87,0.25)', fontFamily: "'Noto Serif KR', serif" }}>合</span>
                      <p className="text-[13px] text-text-primary leading-relaxed flex-1" style={{ wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(m) }} />
                    </div>
                  ))}
                  {pc.clashPoints?.map((c: string, i: number) => (
                    <div key={`c${i}`} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(138,98,38,0.06)' }}>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-black mt-0.5" style={{ background: 'rgba(138,98,38,0.16)', color: '#8A6226', border: '1px solid rgba(138,98,38,0.25)', fontFamily: "'Noto Serif KR', serif" }}>沖</span>
                      <p className="text-[13px] text-text-primary leading-relaxed flex-1" style={{ wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(c) }} />
                    </div>
                  ))}
                </div>
              )}

              {/* 상대방 연애 스타일 */}
              {pc.partnerLoveStyle && (
                <div className="rounded-xl py-2 px-3" style={{ background: `${color}05`, borderLeft: `3px solid ${color}30` }}>
                  <p className="text-[11px] font-semibold mb-0.5" style={{ color }}>상대방의 연애 스타일</p>
                  <p className="text-[11px] text-text-primary leading-snug">{pc.partnerLoveStyle}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </FadeIn>
  );
}

function WealthViz({ data, color, sajuData, birthYear }: { data: any; color: string; sajuData?: any; birthYear?: number }) {
  if (!data) return null;

  // 월별 재물 점수에서 베스트/워스트 찾기
  const monthly = data.monthlyWealth || [];
  let bestMonth = '', worstMonth = '', bestScore = 0, worstScore = 100;
  monthly.forEach((m: any) => {
    const s = typeof m.score === 'number' ? m.score : parseInt(m.score) || 0;
    if (s > bestScore) { bestScore = s; bestMonth = m.month; }
    if (s < worstScore) { worstScore = s; worstMonth = m.month; }
  });

  // 2026-05-28 — monthTimelineCells 제거 (12-cell grid 미사용 — AreaChart 로 통합)
  void buildMonthCells;

  // Stage 2B-1: Donut 4분면 재물 분포 — wealthType 기반 inference (data 0 변경 정책)
  const incomeDistribution = useMemo(() => {
    // 서버 응답에 incomeSources 직접 있으면 사용 (forward-compat)
    if (data.incomeSources && typeof data.incomeSources === 'object') {
      // ?? 만 사용 (|| 마스킹 제거) — AI 가 0 반환 시 0 보존, undefined 만 0 으로 fallback
      // (이전: `?? 0 || 50` 이중 fallback 으로 0 → 50 마스킹 발생)
      const s = data.incomeSources;
      return [
        { key: 'main',    label: '본업',    hanja: '本業', value: Number(s.main ?? 0),    color: '#B8965A' },
        { key: 'invest',  label: '투자',    hanja: '投資', value: Number(s.invest ?? 0),  color: '#3E5F82' },
        { key: 'side',    label: '사이드',   hanja: '副業', value: Number(s.side ?? 0),    color: '#4E7A57' },
        { key: 'inherit', label: '상속·기타', hanja: '其他', value: Number(s.inherit ?? 0), color: '#8C6D3D' },
      ];
    }
    // wealthType 기반 inference (서버 response 누락 시 안전 fallback)
    const t = String(data.wealthType ?? '').trim();
    let dist: Record<string, number>;
    if (t.includes('정규직')) dist = { main: 70, invest: 10, side: 10, inherit: 10 };
    else if (t.includes('사업'))  dist = { main: 30, invest: 20, side: 40, inherit: 10 };
    else if (t.includes('투자'))  dist = { main: 30, invest: 60, side:  5, inherit:  5 };
    else if (t.includes('재테크')) dist = { main: 50, invest: 35, side: 10, inherit:  5 };
    else dist = { main: 50, invest: 20, side: 20, inherit: 10 };
    return [
      { key: 'main',    label: '본업',    hanja: '本業', value: dist.main,    color: '#B8965A' },
      { key: 'invest',  label: '투자',    hanja: '投資', value: dist.invest,  color: '#3E5F82' },
      { key: 'side',    label: '사이드',   hanja: '副業', value: dist.side,    color: '#4E7A57' },
      { key: 'inherit', label: '상속·기타', hanja: '其他', value: dist.inherit, color: '#8C6D3D' },
    ];
  }, [data.incomeSources, data.wealthType]);
  const isInferredDist = !data.incomeSources;

  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">

        {/* 재물 역량 3축 게이지 — 2026-05-28 재설계 (한자 chip + 큰 점수 + 게이지) */}
        <div style={{
          background: '#F8F5EE',
          borderRadius: 14,
          padding: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: `1px solid ${color}20`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 우하단 한자 워터마크 */}
          <span aria-hidden style={{
            position: 'absolute', right: -10, bottom: -22,
            fontFamily: "'Noto Serif KR', serif",
            display: 'none', fontSize: 120, fontWeight: 900, color, opacity: 0.05,
            lineHeight: 1, pointerEvents: 'none',
          }}>力</span>
          {/* 헤더 — 한자 chip + 라벨 */}
          <div className="flex items-center gap-2 mb-4" style={{ position: 'relative' }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${color}16`, border: `1px solid ${color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 14, fontWeight: 800, color,
            }}>力</span>
            <p className="text-h3 text-text-primary" style={{ margin: 0, flex: 1 }}>재물 역량 분석</p>
            {data.wealthType && <TypeBadge label={data.wealthType} color={color} />}
          </div>
          {/* 3축 게이지 — 점수 폰트 크게 */}
          <div className="space-y-3" style={{ position: 'relative' }}>
            {data.earningPower != null && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-text-secondary font-semibold">수익력 <span className="text-[11px] text-text-hint font-normal">· 돈 벌어오는 힘</span></span>
                  <span className="text-[18px] font-black" style={{ color: '#4E7A57', fontFamily: "'Noto Serif KR', serif" }}>{data.earningPower}<small className="text-[11px] font-normal text-text-hint ml-0.5">점</small></span>
                </div>
                <div className="h-[10px] rounded-full overflow-hidden" style={{ background: 'rgba(78,122,87,0.10)' }}>
                  <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #4E7A57 0%, #4caf50 100%)', width: `${data.earningPower}%` }} />
                </div>
              </div>
            )}
            {data.savingPower != null && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-text-secondary font-semibold">저축력 <span className="text-[11px] text-text-hint font-normal">· 돈 모으는 힘</span></span>
                  <span className="text-[18px] font-black" style={{ color: '#3E5F82', fontFamily: "'Noto Serif KR', serif" }}>{data.savingPower}<small className="text-[11px] font-normal text-text-hint ml-0.5">점</small></span>
                </div>
                <div className="h-[10px] rounded-full overflow-hidden" style={{ background: 'rgba(62,95,130,0.10)' }}>
                  <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #3E5F82 0%, #42a5f5 100%)', width: `${data.savingPower}%` }} />
                </div>
              </div>
            )}
            {data.spendingRisk != null && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-text-secondary font-semibold">지출 위험도 <span className="text-[11px] text-text-hint font-normal">· 높을수록 새는 돈 큼</span></span>
                  <span className="text-[18px] font-black" style={{ color: '#B04A38', fontFamily: "'Noto Serif KR', serif" }}>{data.spendingRisk}<small className="text-[11px] font-normal text-text-hint ml-0.5">점</small></span>
                </div>
                <div className="h-[10px] rounded-full overflow-hidden" style={{ background: 'rgba(176,74,56,0.10)' }}>
                  <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #B04A38 0%, #ef5350 100%)', width: `${data.spendingRisk}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 재성 구조 + 핵심 수치 — 2026-05-28 재설계 (한자 chip + 2x2 grid 명확한 라벨) */}
        <div style={{
          background: '#F8F5EE',
          borderRadius: 14, padding: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: `1px solid ${color}20`,
          position: 'relative', overflow: 'hidden',
        }}>
          <span aria-hidden style={{
            position: 'absolute', right: -10, bottom: -22,
            fontFamily: "'Noto Serif KR', serif",
            display: 'none', fontSize: 120, fontWeight: 900, color, opacity: 0.05,
            lineHeight: 1, pointerEvents: 'none',
          }}>鍵</span>
          <div className="flex items-center gap-2 mb-4" style={{ position: 'relative' }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${color}16`, border: `1px solid ${color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 14, fontWeight: 800, color,
            }}>鍵</span>
            <p className="text-h3 text-text-primary" style={{ margin: 0 }}>재물 핵심 지표</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5" style={{ position: 'relative' }}>
            {data.jaeseongType && (
              <div className="rounded-xl p-3.5" style={{ background: `${color}0A`, border: `1px solid ${color}25` }}>
                <p className="text-[11px] font-bold mb-1.5" style={{ color: '#8C6D3D' }}>돈 부르는 결</p>
                <p className="text-[16px] font-black mb-1" style={{ color, fontFamily: "'Noto Serif KR', serif" }}>{data.jaeseongType}</p>
                {data.jaeseongDesc && <p className="text-[11px] text-text-secondary leading-snug" style={{ wordBreak: 'keep-all' }}>{data.jaeseongDesc}</p>}
              </div>
            )}
            {data.wealthPeakPeriod && (
              <div className="rounded-xl p-3.5" style={{ background: 'rgba(176,127,56,0.08)', border: '1px solid rgba(176,127,56,0.30)' }}>
                <p className="text-[11px] font-bold mb-1.5" style={{ color: '#8C6D3D' }}>재물 전성기</p>
                <p className="text-[16px] font-black mb-1" style={{ color: '#8B6F0C', fontFamily: "'Noto Serif KR', serif" }}>{data.wealthPeakPeriod}</p>
                <p className="text-[11px] text-text-secondary leading-snug" style={{ wordBreak: 'keep-all' }}>이 시기에 자산이 가장 크게 불어요</p>
              </div>
            )}
            {data.investStyle && (
              <div className="rounded-xl p-3.5" style={{ background: 'rgba(62,95,130,0.06)', border: '1px solid rgba(62,95,130,0.25)' }}>
                <p className="text-[11px] font-bold mb-1.5 text-[#3E5F82]">투자 성향</p>
                <p className="text-[16px] font-black text-[#3E5F82]" style={{ fontFamily: "'Noto Serif KR', serif" }}>{data.investStyle}</p>
              </div>
            )}
            {data.bestInvestMonth && (
              <div className="rounded-xl p-3.5" style={{ background: 'rgba(78,122,87,0.06)', border: '1px solid rgba(78,122,87,0.25)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4E7A57" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01z" /></svg>
                  <p className="text-[11px] font-bold text-[#4E7A57]">올해 투자 적기</p>
                </div>
                <p className="text-[16px] font-black text-[#4E7A57]" style={{ fontFamily: "'Noto Serif KR', serif" }}>{data.bestInvestMonth}</p>
              </div>
            )}
          </div>
          {data.wealthFlow && (
            <div className="mt-3 rounded-xl py-2.5 px-3.5 flex items-center gap-2" style={{ background: `${color}10`, border: `1px solid ${color}30`, position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              <p className="text-[12px] text-text-secondary">올해 재물 흐름: <strong style={{ color, fontWeight: 700 }}>{data.wealthFlow}</strong></p>
            </div>
          )}
        </div>

        {/* 월별 재물 흐름 차트 — 2026-05-28 재설계 (한자 chip + 통일 디자인) */}
        {monthly.length > 0 && (
          <div style={{
            background: '#F8F5EE',
            borderRadius: 14, padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            border: `1px solid ${color}20`,
            position: 'relative', overflow: 'hidden',
          }}>
            <span aria-hidden style={{
              position: 'absolute', right: -10, bottom: -22,
              fontFamily: "'Noto Serif KR', serif",
              display: 'none', fontSize: 120, fontWeight: 900, color, opacity: 0.05,
              lineHeight: 1, pointerEvents: 'none',
            }}>月</span>
            <div className="flex items-center gap-2 mb-1" style={{ position: 'relative' }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${color}16`, border: `1px solid ${color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 14, fontWeight: 800, color,
              }}>月</span>
              <p className="text-h3 text-text-primary" style={{ margin: 0, flex: 1 }}>월별 재물 흐름</p>
              {data.dangerMonths && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(176,74,56,0.10)', color: '#B04A38', border: '1px solid rgba(176,74,56,0.25)' }}>
                  주의: {data.dangerMonths}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-hint mb-3 ml-9">올해 12개월 재물 에너지 추이</p>
            <div className="h-[150px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly.map((m: any) => ({ ...m, score: typeof m.score === 'number' ? m.score : parseInt(m.score) || 0 }))} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false}
                    tickFormatter={(v: string) => v.replace('월', '')} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} />
                  <Area type="monotone" dataKey="score" stroke={color} fill="url(#wealthGrad)"
                    strokeWidth={2} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* 베스트/워스트 월 */}
            {bestMonth && worstMonth && (
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4E7A57" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01z" /></svg>
                  <span className="text-[11px] text-text-muted">최고: <strong className="text-[#4E7A57]">{bestMonth} ({bestScore}점)</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B04A38" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <span className="text-[11px] text-text-muted">주의: <strong className="text-[#B04A38]">{worstMonth} ({worstScore}점)</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2026-05-28 — 월별 재물 지수 12-cell grid 제거 (user 피드백: AreaChart 와 중복 + 가독성 X).
            위 AreaChart 가 12개월 흐름 + 베스트/주의 월 라벨로 충분. */}

        {/* 돈이 들어오는 통로 — 2026-05-28 재설계 (한자 chip 통일) */}
        <div style={{
          background: '#F8F5EE',
          borderRadius: 14, padding: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: `1px solid ${color}20`,
          position: 'relative', overflow: 'hidden',
        }}>
          <span aria-hidden style={{
            position: 'absolute', right: -10, bottom: -22,
            fontFamily: "'Noto Serif KR', serif",
            display: 'none', fontSize: 120, fontWeight: 900, color, opacity: 0.05,
            lineHeight: 1, pointerEvents: 'none',
          }}>通</span>
          <div className="flex items-center gap-2 mb-1" style={{ position: 'relative' }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${color}16`, border: `1px solid ${color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 14, fontWeight: 800, color,
            }}>通</span>
            <p className="text-h3 text-text-primary" style={{ margin: 0, flex: 1 }}>돈이 들어오는 통로</p>
            {isInferredDist && (
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(122,114,105,0.10)', color: '#7A7269', border: '1px solid rgba(122,114,105,0.20)' }}
                title="재물 유형 기반 기본 구성으로 보여드려요"
              >
                참고
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-hint mb-3 ml-9">
            본업·투자·사이드·기타 — 4 통로의 비중
          </p>
          <IncomeDonut segments={incomeDistribution} accentColor={color} />
        </div>

        {/* Stage 2B-2: 평생 재물 흐름 — 8 대운 60년 timeline */}
        {sajuData?.daeun && Array.isArray(sajuData.daeun) && sajuData.daeun.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-h3 text-text-primary">평생 재물 흐름</p>
              <span className="text-[11px] text-text-hint">大運 · 10년 단위</span>
            </div>
            <p className="text-[11px] text-text-hint mb-3">
              8 대운 60년 — 재물 강세 시기 한눈에
            </p>
            <DaewoonWealthRail
              daeun={sajuData.daeun}
              ilgan={sajuData.pillars?.[2]?.천간 ?? ''}
              birthYear={birthYear ?? new Date().getFullYear() - 30}
              accentColor={color}
            />
          </div>
        )}

        {/* Stage 2B-2: 돈을 움직이는 인맥 — 십성 분포 기반 3 카드 */}
        {sajuData?.sipsung && Array.isArray(sajuData.sipsung) && (
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-h3 text-text-primary">돈을 움직이는 인맥</p>
              <span className="text-[11px] text-text-hint">人脈</span>
            </div>
            <p className="text-[11px] text-text-hint mb-3">
              사주 십성에서 도출 — 도와주는 사람 / 부딪히는 사람 / 평온한 사람
            </p>
            <RelflowCards sipsung={sajuData.sipsung} />
          </div>
        )}

        {/* 돈 새는 함정 경고 */}
        {data.moneyLeakTrap && (
          <div className="card" style={{ background: 'rgba(138,98,38,0.04)', border: '1px solid rgba(138,98,38,0.25)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A6226" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[12px] font-bold text-[#8A6226]">돈이 새는 자리 — 미리 챙기면 막을 수 있어요</p>
            </div>
            <p className="text-[13px] text-text-primary font-semibold leading-snug mb-1">{data.moneyLeakTrap}</p>
            {data.moneyLeakDesc && (
              <p className="text-[11px] text-text-secondary leading-relaxed">{data.moneyLeakDesc}</p>
            )}
          </div>
        )}
      </div>
    </FadeIn>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2B-1 · IncomeDonut — 4분면 재물 분포 도넛 (자체 SVG, ~80줄)
 *  · 본업·투자·사이드·상속(기타) 4 segment
 *  · mockup `donut + legend` 진본 패턴 정렬
 *  · recharts 회피 (번들 영향 0)
 *  · 좌측 도넛 + 우측 범례 + 비중 % + 한자 라벨
 * ═════════════════════════════════════════════════════════════════ */
function IncomeDonut({
  segments,
  accentColor: _accentColor,
}: {
  segments: Array<{ key: string; label: string; hanja: string; value: number; color: string }>;
  accentColor: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const stroke = size * 0.18;

  // 호 path 빌더 — 시계 방향 12시 시작
  let acc = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const startAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
      acc += s.value;
      const endAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
      const x1 = cx + Math.cos(startAngle) * r;
      const y1 = cy + Math.sin(startAngle) * r;
      const x2 = cx + Math.cos(endAngle) * r;
      const y2 = cy + Math.sin(endAngle) * r;
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      const path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      const pct = Math.round((s.value / total) * 100);
      return { ...s, path, pct };
    });

  // 가장 큰 segment (강조)
  const dominant = arcs.reduce((max, s) => (s.value > max.value ? s : max), arcs[0]);

  return (
    <div className="flex items-center gap-4">
      {/* 좌측 도넛 SVG */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="재물 통로 4분면 도넛" style={{ flexShrink: 0 }}>
        {/* 배경 ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(184,150,90,0.10)" strokeWidth={stroke} />
        {/* 데이터 호 */}
        {arcs.map((s) => (
          <path
            key={s.key}
            d={s.path}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
        ))}
        {/* 중앙 — dominant segment */}
        {dominant && (
          <>
            <text
              x={cx} y={cy - 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={700}
              fill={dominant.color}
              fontFamily="'Noto Serif KR', serif"
              letterSpacing="0.02em"
            >
              {dominant.label}
            </text>
            <text
              x={cx} y={cy + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={20}
              fontWeight={800}
              fill="#1A1A1A"
              fontFamily="'Noto Serif KR', serif"
            >
              {dominant.pct}%
            </text>
            <text
              x={cx} y={cy + 26}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8}
              fill="#7A7269"
              letterSpacing="0.05em"
            >
              주력 통로
            </text>
          </>
        )}
      </svg>

      {/* 우측 범례 */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-1.5">
          {arcs.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-[11px]">
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#1A1A1A', minWidth: 40 }}>{s.label}</span>
              <span style={{ fontSize: 11, color: '#7A7269', fontFamily: "'Noto Serif KR', serif" }}>{s.hanja}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 800, color: s.color, fontFeatureSettings: '"tnum"' }}>
                {s.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2B-2 · DaewoonWealthRail — 8 대운 60년 가로 timeline (재물 강도)
 *  · sajuData.daeun 직접 활용 (calculator.ts 결과 그대로)
 *  · 각 대운 천간 → 일간 십성 → 재물 강도 자동 도출 (재성·식상=강 / 비겁·관성=약)
 *  · 현재 대운 ring 강조 + 정점 대운 별표
 * ═════════════════════════════════════════════════════════════════ */

// 2026-05-04 자연수 — 5의 배수 회피 (UI 표시 시 fake 신호 방지)
const WEALTH_SIPSUNG_INTENSITY: Record<string, number> = {
  // 재성 (돈 자체) — 가장 강
  정재: 88, 편재: 93,
  // 식상 (돈 만드는 힘)
  식신: 76, 상관: 71,
  // 인성 (돈 굴리는 보조)
  정인: 57, 편인: 52,
  // 비겁 (돈 다투는 — 약)
  비견: 36, 겁재: 27,
  // 관성 (압박 — 중간)
  정관: 47, 편관: 41,
};

const OHENG_SAENG_LOCAL: Record<string, string> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
const OHENG_KEUK_LOCAL: Record<string, string> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
const CHEONGAN_OHENG_LOCAL: Record<string, string> = {
  甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수',
};
const CHEONGAN_YINYANG_LOCAL: Record<string, '양' | '음'> = {
  甲: '양', 丙: '양', 戊: '양', 庚: '양', 壬: '양',
  乙: '음', 丁: '음', 己: '음', 辛: '음', 癸: '음',
};

function deriveSipsungLocal(ilgan: string, target: string): string {
  if (!ilgan || !target) return '';
  const xOh = CHEONGAN_OHENG_LOCAL[ilgan];
  const xYY = CHEONGAN_YINYANG_LOCAL[ilgan];
  const yOh = CHEONGAN_OHENG_LOCAL[target];
  const yYY = CHEONGAN_YINYANG_LOCAL[target];
  if (!xOh || !yOh) return '';
  const same = xYY === yYY;
  if (xOh === yOh) return same ? '비견' : '겁재';
  if (OHENG_SAENG_LOCAL[xOh] === yOh) return same ? '식신' : '상관';
  if (OHENG_KEUK_LOCAL[xOh] === yOh) return same ? '편재' : '정재';
  if (OHENG_KEUK_LOCAL[yOh] === xOh) return same ? '편관' : '정관';
  if (OHENG_SAENG_LOCAL[yOh] === xOh) return same ? '편인' : '정인';
  return '';
}

function DaewoonWealthRail({
  daeun,
  ilgan,
  birthYear,
  accentColor,
}: {
  daeun: any[];
  ilgan: string;
  birthYear: number;
  accentColor: string;
}) {
  // 2026-07 fix — 연나이 fallback 은 세는나이 기준 대운나이와 1살 어긋남(현재대운 off-by-one 버그 클래스).
  //   SSOT(daeunCurrent.findCurrentDaeun)로 재판정 후 isCurrent 만 신뢰.
  findCurrentDaeun((daeun || []) as DaeUn[], birthYear);
  const cells = (daeun || []).slice(0, 8).map((d: any) => {
    const gan = String(d.간지 ?? '').charAt(0);
    const sipsung = deriveSipsungLocal(ilgan, gan);
    const intensity = WEALTH_SIPSUNG_INTENSITY[sipsung] ?? 50;
    const isCurrent = d.isCurrent === true;
    return {
      startAge: d.시작나이,
      endAge: d.끝나이,
      ganji: d.간지,
      sipsung,
      intensity,
      isCurrent,
    };
  });

  if (cells.length === 0) return null;
  const peakIntensity = Math.max(...cells.map((c) => c.intensity));

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2">
      {cells.map((c, i) => {
        const isPeak = c.intensity === peakIntensity && c.intensity >= 70;
        const tone =
          c.intensity >= 70 ? accentColor
          : c.intensity >= 50 ? '#E8D9B8'
          : c.intensity >= 35 ? '#E5DFD0'
          : 'rgba(198,40,40,0.18)';
        const fg = c.intensity >= 70 || c.intensity < 35 ? '#FFFFFF' : '#1A1A1A';
        return (
          <div
            key={i}
            style={{
              // 2026-05-28 — 60대 가독성 floor 11px. 폰트 9px/8.5px → 11px 일괄 (user 피드백: 작아서 잘 안 읽힘)
              flex: '0 0 auto',
              minWidth: 76,  // 64 → 76 (폰트 키운 만큼 박스도)
              padding: '10px 6px',
              background: c.isCurrent ? 'rgba(184,150,90,0.10)' : '#FFFFFF',
              border: c.isCurrent ? '2px solid #B8965A' : '1px solid rgba(184,150,90,0.18)',
              borderRadius: 10,
              textAlign: 'center',
              boxShadow: c.isCurrent ? '0 2px 8px rgba(184,150,90,0.20)' : 'none',
              position: 'relative',
            }}
            title={`${c.startAge}~${c.endAge}세 · ${c.ganji} · ${c.sipsung || '—'} (재물 ${c.intensity})`}
          >
            {isPeak && (
              <span aria-hidden style={{ position: 'absolute', top: -6, right: -2, fontSize: 12, color: accentColor }}>
                ★
              </span>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: c.isCurrent ? '#8C6D3D' : '#7A7269', marginBottom: 5 }}>
              {c.startAge}~{c.endAge}세
            </div>
            <div
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 18,
                fontWeight: 700,
                color: '#1A1A1A',
                letterSpacing: '0.04em',
              }}
            >
              {c.ganji}
            </div>
            {c.sipsung && (
              <div
                style={{
                  display: 'inline-block',
                  marginTop: 5,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: tone,
                  color: fg,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {c.sipsung}
              </div>
            )}
            {/* 재물 강도 mini bar — 두께 늘려서 가독 */}
            <div style={{ height: 5, marginTop: 7, background: '#F0ECE1', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${c.intensity}%`, background: tone === 'rgba(198,40,40,0.18)' ? '#B04A38' : (c.intensity >= 70 ? accentColor : '#8C6D3D') }} />
            </div>
            {c.isCurrent && (
              <div style={{ fontSize: 11, fontWeight: 800, color: '#8C6D3D', marginTop: 4, letterSpacing: '0.05em' }}>
                NOW
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Stage 2B-2 · RelflowCards — 사주 십성 분포 기반 인맥 매핑 (3 카드)
 *  · 도와주는 사람 (인성·식상) / 부딪히는 사람 (비겁) / 평온한 사람 (재성·관성)
 *  · 십성 카운트 → 우세 십성 + 한 줄 풀이
 * ═════════════════════════════════════════════════════════════════ */

const RELFLOW_CATEGORIES = [
  {
    key: 'helper',
    label: '도와주는 사람',
    hanja: '助',
    color: '#4E7A57',
    bg: 'rgba(78,122,87,0.06)',
    border: 'rgba(78,122,87,0.30)',
    sipsungs: ['정인', '편인', '식신', '상관'] as const,
    desc: '인성·식상 — 돈 굴리는 지혜와 재능을 주는 사람',
  },
  {
    key: 'rival',
    label: '부딪히는 사람',
    hanja: '爭',
    color: '#B04A38',
    bg: 'rgba(176,74,56,0.06)',
    border: 'rgba(176,74,56,0.30)',
    sipsungs: ['비견', '겁재'] as const,
    desc: '비겁 — 같은 자리를 노리는 경쟁자, 돈 다투는 결',
  },
  {
    key: 'peace',
    label: '평온한 사람',
    hanja: '安',
    color: '#3E5F82',
    bg: 'rgba(62,95,130,0.06)',
    border: 'rgba(62,95,130,0.30)',
    sipsungs: ['정관', '편관', '정재', '편재'] as const,
    desc: '관성·재성 — 책임과 실리를 함께 나누는 자리',
  },
];

function RelflowCards({ sipsung }: { sipsung: any[] }) {
  // 십성 카운트
  // ⚠️ lunar-javascript 는 간체 한자(七杀·伤官·偏财 등)를 내므로 한국어 카테고리(정관·편재 등)와
  //   직접 비교하면 전부 미매칭 → 3카드 모두 "없음" 버그. normalizeSipsungKo 로 한국어 정통명 통일 후 카운트.
  //   (2026-06-13 fix)
  const counts: Record<string, number> = {};
  for (const s of sipsung || []) {
    if (!s.십성 || s.십성 === '일주' || s.십성 === '日主') continue;
    const parts = String(s.십성).split('/');
    for (const p of parts) {
      const ko = normalizeSipsungKo(p);
      if (ko) counts[ko] = (counts[ko] ?? 0) + 1;
    }
  }

  // 2026-05-28 — 완전 재설계 (user 피드백: 가독성 X, 폰트 작음, 0개 의미 없음, 한눈에 안 보임)
  // 가로 3-grid → 세로 list 1-row, 폰트 9px → 12-14px floor (60대 가독)
  // 2026-05-28 PM — user 캡쳐 피드백: 安 카드 "이 사주에 해당 십성이 없어요" placeholder 보임 (재물운에 관성·재성 0이면 발생).
  //   완전 비어있는 카드 = 빈 박스 클러터. 0개 카테고리는 더 컴팩트하게 (60% opacity + "없음" 작게) 렌더해 의미는 유지하되 시각 무게 줄임.
  return (
    <div className="space-y-2.5">
      {RELFLOW_CATEGORIES.map((cat) => {
        const total = cat.sipsungs.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
        const dominant = cat.sipsungs.reduce(
          (max, s) => ((counts[s] ?? 0) > (counts[max] ?? 0) ? s : max),
          cat.sipsungs[0],
        );
        const isEmpty = total === 0;
        return (
          <div
            key={cat.key}
            style={{
              background: cat.bg,
              border: `1px solid ${cat.border}`,
              borderRadius: 12,
              padding: isEmpty ? 10 : 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              opacity: isEmpty ? 0.55 : 1,
            }}
          >
            {/* 좌측 한자 + 한글 라벨 (큰 시각 앵커) — empty 시 축소 */}
            <div style={{ flexShrink: 0, textAlign: 'center', minWidth: isEmpty ? 44 : 56 }}>
              <div
                style={{
                  fontFamily: "'Noto Serif KR', serif",
                  fontSize: isEmpty ? 20 : 28,
                  fontWeight: 800,
                  color: cat.color,
                  lineHeight: 1,
                  marginBottom: isEmpty ? 2 : 4,
                }}
              >
                {cat.hanja}
              </div>
              <div style={{ fontSize: isEmpty ? 11 : 13, fontWeight: 700, color: '#1A1A1A' }}>
                {cat.label}
              </div>
            </div>
            {/* 우측 — 설명 + 데이터 + 주력. empty 시 1-row compact */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEmpty ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#7A7269', wordBreak: 'keep-all', lineHeight: 1.4, flex: 1 }}>{cat.desc}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#7A7269',
                    background: 'rgba(0,0,0,0.04)', padding: '2px 8px', borderRadius: 100, flexShrink: 0,
                  }}>
                    없음
                  </span>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: '#5C4A2E', lineHeight: 1.55, marginBottom: 8, wordBreak: 'keep-all' }}>
                    {cat.desc}
                  </p>
                  {/* 데이터 영역 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: cat.color, fontFeatureSettings: '"tnum"', lineHeight: 1 }}>
                      {total}
                    </span>
                    <span style={{ fontSize: 12, color: '#7A7269' }}>자</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: cat.color,
                      background: '#fff', border: `1px solid ${cat.color}40`,
                      padding: '3px 8px', borderRadius: 100, marginLeft: 'auto',
                    }}>
                      주력 · {dominant}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CareerViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  // 2026-05-28 PM — user 캡쳐 피드백: "직종 적합도 TOP 5" 헤더만 빈 카드 렌더 발견.
  //   careerFit 데이터 없을 때 카드 자체를 숨김 (헤더만 보이는 placeholder 클러터 박멸).
  const hasCareerFit = (data.careerFit?.length || 0) > 0;
  // 2026-05-28 PM — hasInterview 변수 제거 (면접/연봉 카드 자체 제거. exam 영역으로 이전).
  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 직종 적합도 — careerFit 있을 때만 렌더. 2026-05-28 PM — reason 표시 (왜 이 직종이 맞는지) */}
        {hasCareerFit && (
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-h3 text-text-primary">사주가 부르는 직종 TOP 5</p>
              {data.workStyle && <TypeBadge label={data.workStyle} color={color} />}
            </div>
            <p className="text-[11px] text-text-hint mb-3">일간 오행·격국·십성 비중 분석 — 잘 맞는 5직종</p>
            <div className="space-y-3">
              {data.careerFit.map((c: any, i: number) => (
                <div key={i} className="space-y-1">
                  <HBar value={c.fitPercent || 0} label={c.job || ''} color={color} suffix="%" />
                  {c.reason && (
                    <p className="text-[11.5px] leading-relaxed pl-1" style={{ color: '#5C4A2E', wordBreak: 'keep-all' }}>
                      {c.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 현재 상태 분석 + 관심 분야 적합도 (입력 시) */}
        {(data.statusAnalysis || data.fieldFitScore != null) && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">맞춤 분석</p>
            {data.statusAnalysis && (
              <div className="rounded-xl py-2.5 px-3 mb-2" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
                <p className="text-[11px] font-bold mb-0.5" style={{ color }}>현재 상태 분석</p>
                <p className="text-[12px] text-text-primary leading-snug">{data.statusAnalysis}</p>
              </div>
            )}
            {data.fieldFitScore != null && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.015)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-bold" style={{ color }}>관심 분야 적합도</p>
                  <span className="text-[14px] font-black" style={{ color }}>{data.fieldFitScore}<span className="text-[11px]">점</span></span>
                </div>
                <div className="h-[8px] rounded-full overflow-hidden mb-1.5" style={{ background: `${color}12` }}>
                  <motion.div className="h-full rounded-full" style={{ background: color }}
                    initial={{ width: 0 }} animate={{ width: `${Math.min(data.fieldFitScore, 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }} />
                </div>
                {data.fieldFitAnalysis && (
                  <p className="text-[11px] text-text-secondary leading-snug">{data.fieldFitAnalysis}</p>
                )}
              </div>
            )}
            {data.jobChangeTiming && (
              <div className="mt-2 rounded-xl py-2 px-3" style={{ background: 'rgba(78,122,87,0.05)' }}>
                <p className="text-[11px] text-text-hint">이직 최적 시기: <strong className="text-[#4E7A57]">{data.jobChangeTiming}</strong></p>
              </div>
            )}
          </div>
        )}

        {/* 2026-05-28 PM — 면접/연봉/이직 시기 카드 제거.
            user 결정: "직업운 = 평생 적성 + 명리학 근거. 면접/이직은 합격·이직운(exam)에서". */}

        {/* 명리학적 직업 근거 카드 — 신규 (왜 이 사주에 이 직업이 잘 맞는지) */}
        {data.myeongriBasis && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${color}16`,
                border: `1px solid ${color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 14, fontWeight: 800, color,
              }}>命</span>
              <p className="text-h3 text-text-primary" style={{ margin: 0 }}>왜 이 직업이 맞는지</p>
            </div>
            <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>
              {data.myeongriBasis}
            </p>
          </div>
        )}

        {/* audit 4 P0 #5 — CareerViz 깊이 보강 (ReunionViz 14 vs CareerViz 3 비대칭 해소)
            추가 3 카드: 직업 핵심 결 (관성·식상 비중) + 승진·이직 좋은 달 12-cell + 직장 단계 timeline */}

        {/* 카드 4 — 직업 핵심 결 (관성·식상·인성 등 직업 관련 십성 비중 mini-bar) */}
        {(data.sipsungBalance || data.coreStrength || data.officeAdaptType) && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">직업 핵심 결</p>
            <div className="space-y-2">
              {data.coreStrength && (
                <div className="rounded-xl py-2 px-3" style={{ background: `${color}08`, borderLeft: `3px solid ${color}` }}>
                  <p className="text-[11px] font-bold mb-0.5" style={{ color }}>타고난 직업 강점</p>
                  <p className="text-[12.5px] text-text-primary leading-snug">{stripMd(String(data.coreStrength))}</p>
                </div>
              )}
              {data.officeAdaptType && (
                <div className="rounded-xl py-2 px-3" style={{ background: 'rgba(0,0,0,0.02)' }}>
                  <p className="text-[11px] font-bold mb-0.5" style={{ color: '#5C4A2E' }}>직장 적응 타입</p>
                  <p className="text-[12.5px] text-text-primary leading-snug">{stripMd(String(data.officeAdaptType))}</p>
                </div>
              )}
              {data.sipsungBalance && (
                <div className="space-y-1.5">
                  {Object.entries(data.sipsungBalance as Record<string, number>).map(([k, v]) => (
                    <HBar key={k} value={Number(v)} label={k} color={color} suffix="%" />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2026-05-28 PM — "올해 직업 운 12개월" 카드 제거.
            시기성 정보 = 합격·이직운(exam) 영역. 직업운 = 평생 적성 정책 위반이라 박멸. */}

        {/* 카드 6 — 직장 단계 timeline (평생 적성 흐름 — 사주 대운 기반, 시기성 아닌 평생 적성) */}
        {Array.isArray(data.careerPhases) && data.careerPhases.length > 0 && (
          <div className="card" style={{ background: `linear-gradient(135deg, ${color}08, ${color}03)` }}>
            <p className="text-h3 text-text-primary mb-3">직업 흐름 — 단계별</p>
            <div className="space-y-2">
              {data.careerPhases.map((p: any, i: number) => (
                <div key={i} className="rounded-xl py-2.5 px-3 bg-white" style={{ borderLeft: `3px solid ${p.isCurrent ? color : '#E5DFD0'}` }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[11px] font-bold" style={{ color: p.isCurrent ? color : '#5C4A2E' }}>
                      {p.label || p.age || `단계 ${i + 1}`}
                      {p.isCurrent && <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: color, color: '#fff' }}>NOW</span>}
                    </p>
                    {p.score != null && <span className="text-[12px] font-black" style={{ color: p.isCurrent ? color : '#7A7269' }}>{p.score}</span>}
                  </div>
                  {p.description && (
                    <p className="text-[12px] text-text-primary leading-snug" dangerouslySetInnerHTML={{ __html: sanitizeAiText(String(p.description)) }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FadeIn>
  );
}

function MarriageViz({ data, color, myName, partnerName }: { data: any; color: string; myName?: string; partnerName?: string }) {
  if (!data) return null;
  const sp = data.spouseProfile;
  const tm = data.timing;
  const fields = sp ? [
    { label: '성격', value: sp.personality },
    { label: '직업군', value: sp.job },
    { label: '나이 경향', value: sp.ageGap },
    { label: '만남 경로', value: sp.meetStyle },
  ].filter(r => r.value) : [];

  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 결혼 핵심 수치 — 2026-05-28 PM user 피드백: 빈 카드 방지. 항목 1+ 있을 때만 렌더 + 그리드 auto */}
        {(() => {
          const marriageCells = [data.marriageAge, tm?.urgency, data.inlawsCompat].filter(Boolean).length;
          if (marriageCells === 0 && !tm?.bestPeriod && !data.weddingLuckMonth) return null;
          const gridCols = marriageCells === 1 ? 'grid-cols-1' : marriageCells === 2 ? 'grid-cols-2' : 'grid-cols-3';
          return (
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">결혼 핵심 분석</p>
          <div className={`grid ${gridCols} gap-2`}>
            {data.marriageAge && (
              <StatTile label="결혼 적령기" value={data.marriageAge} color={color} />
            )}
            {tm?.urgency && (
              <StatTile label="시급도" value={tm.urgency} color={color} />
            )}
            {data.inlawsCompat && (
              <StatTile label="시댁/처가 궁합" value={data.inlawsCompat} color={color} tone={data.inlawsCompat === '주의' ? 'warn' : 'default'} />
            )}
          </div>
          {tm?.bestPeriod && (
            <div className="mt-2.5 rounded-xl py-2.5 px-3 flex items-center gap-3" style={{ background: `${color}06` }}>
              <p className="text-[11px] font-semibold" style={{ color }}>결혼 적기</p>
              <p className="text-[13px] text-text-primary font-bold flex-1">{tm.bestPeriod}</p>
            </div>
          )}
          {data.weddingLuckMonth && (
            <div className="mt-2 rounded-xl py-2 px-3" style={{ background: 'rgba(78,122,87,0.05)' }}>
              <p className="text-[11px] text-text-hint">결혼식 유리 월: <strong className="text-[#4E7A57]">{data.weddingLuckMonth}</strong></p>
            </div>
          )}
        </div>
          );
        })()}

        {/* 배우자 프로필 */}
        {fields.length > 0 && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">사주로 본 배우자상</p>
            <div className="space-y-2.5">
              {fields.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[11px] font-bold mt-0.5 w-14 flex-shrink-0 text-right" style={{ color }}>{f.label}</span>
                  <p className="text-[12px] text-text-primary leading-snug flex-1">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 갈등 패턴 경고 */}
        {data.conflictPattern && (
          <div className="card" style={{ background: 'rgba(138,98,38,0.04)', border: '1px solid rgba(138,98,38,0.25)' }}>
            <p className="text-[11px] font-bold text-[#8A6226] mb-1">부부 갈등 핵심 패턴</p>
            <p className="text-[12px] text-text-primary leading-snug">{data.conflictPattern}</p>
          </div>
        )}

        {/* 상대방 궁합 분석 (연애중일 때만) */}
        {data.partnerCompat && (() => {
          const pc = data.partnerCompat;
          const ohengBg: Record<string, string> = { 목: 'rgba(78,122,87,0.10)', 화: 'rgba(176,74,56,0.10)', 토: 'rgba(176,127,56,0.10)', 금: 'rgba(74,74,74,0.10)', 수: 'rgba(62,95,130,0.10)' };
          const ohengText: Record<string, string> = { 목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82' };
          const typeIcon: Record<string, { icon: string; color: string; bg: string }> = {
            '합': { icon: '合', color: '#4E7A57', bg: 'rgba(78,122,87,0.12)' },
            '충': { icon: '沖', color: '#B04A38', bg: 'rgba(176,74,56,0.10)' },
            '형': { icon: '刑', color: '#8A6226', bg: 'rgba(138,98,38,0.10)' },
            '해': { icon: '害', color: '#8A6226', bg: 'rgba(138,98,38,0.10)' },
            '상생': { icon: '生', color: '#4E7A57', bg: 'rgba(78,122,87,0.12)' },
            '상극': { icon: '克', color: '#B04A38', bg: 'rgba(176,74,56,0.10)' },
          };
          const getTS = (type: string) => { for (const [k, v] of Object.entries(typeIcon)) if (type?.includes(k)) return v; return { icon: '?', color: '#7D7870', bg: 'rgba(0,0,0,0.06)' }; };
          const pComp = pc.pillarComparison;
          const interMap: Record<string, any> = {};
          (pComp?.interactions || []).forEach((it: any) => {
            if (it.position === '년주') interMap['year'] = it;
            else if (it.position === '월주') interMap['month'] = it;
            else if (it.position === '일주') interMap['day'] = it;
          });
          return (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-h3 text-text-primary">두 사람의 결혼 궁합</p>
                {pc.compatScore != null && (
                  <span className="text-[12px] font-bold px-2.5 py-1 rounded-lg" style={{ background: `${color}10`, color }}>{pc.compatScore}점</span>
                )}
              </div>
              {pc.marriageChemistry && (
                <p className="text-[11px] text-text-muted mb-3 leading-snug">{pc.marriageChemistry}</p>
              )}

              {/* 기둥 비교 — 2026-05-28 가독성 개선: 한자 박스 크게(44px), 행간 넓힘, 가운데 아이콘 명확화 */}
              {pComp && (() => {
                const renderPillar = (p: any, side: 'left' | 'right') => {
                  const oh = cleanOheng(p.oheng);
                  const bg = ohengBg[oh] || 'rgba(0,0,0,0.03)';
                  const fg = ohengText[oh] || '#3D3427';
                  return (
                    <div className={`flex-1 rounded-xl p-3 flex items-center gap-2 ${side === 'right' ? 'justify-end' : ''}`} style={{ background: bg, border: `1px solid ${fg}25` }}>
                      {side === 'right' && <span className="text-[12px] font-bold" style={{ color: fg }}>{oh}</span>}
                      <div className="flex gap-1.5">
                        <span className="w-11 h-11 rounded-lg flex items-center justify-center text-[20px] font-black" style={{ background: '#fff', color: fg, border: `1.5px solid ${fg}40`, fontFamily: "'Noto Serif KR', serif" }}>{cleanHanja(p.cheongan)}</span>
                        <span className="w-11 h-11 rounded-lg flex items-center justify-center text-[20px] font-black" style={{ background: '#fff', color: fg, border: `1.5px solid ${fg}40`, fontFamily: "'Noto Serif KR', serif" }}>{cleanHanja(p.jiji)}</span>
                      </div>
                      {side === 'left' && <span className="text-[12px] font-bold" style={{ color: fg }}>{oh}</span>}
                    </div>
                  );
                };
                return (
                  <div className="mb-3">
                    <p className="text-[12px] text-text-hint mb-3 font-semibold">사주 기둥(柱) 비교</p>
                    <div className="space-y-4">
                      {[{ key: 'year', label: '년주' }, { key: 'month', label: '월주' }, { key: 'day', label: '일주' }].map(({ key, label }) => {
                        const myP = pComp.myPillars?.[key];
                        const ptP = pComp.partnerPillars?.[key];
                        const inter = interMap[key];
                        const ts = inter ? getTS(inter.type) : null;
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-[12px] text-text-hint font-bold">{label}</span>
                              {ts && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full ml-auto" style={{ background: ts.bg, color: ts.color }}>{ts.icon} {inter.type}</span>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {myP && renderPillar(myP, 'left')}
                              <div className="flex-shrink-0 w-8 flex items-center justify-center">
                                {ts ? <span className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-black" style={{ background: ts.bg, color: ts.color, border: `1.5px solid ${ts.color}30` }}>{ts.icon}</span> : <span className="text-[13px] text-text-hint font-semibold">vs</span>}
                              </div>
                              {ptP && renderPillar(ptP, 'right')}
                            </div>
                            {inter?.desc && <p className="text-[12px] text-text-secondary mt-2 ml-1 leading-relaxed" style={{ wordBreak: 'keep-all' }}>{inter.desc}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 px-1" style={{ borderTop: '1px dashed rgba(0,0,0,0.08)' }}>
                      <span className="text-[11px] font-bold" style={{ color }}>← {myName ? `${myName} 님 (나)` : '나'}</span>
                      <span className="text-[11px] text-text-hint font-semibold">{partnerName ? `${partnerName} 님 (상대)` : '상대'} →</span>
                    </div>
                    {/* 2026-06-12 신뢰 카피 — "양방향 동일 판정" CS 혼란 예방 (합·충은 만세력 객관 계산값) */}
                    <p className="text-[11px] text-text-hint mt-2 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                      두 분의 합·충 판정은 만세력 계산값이라 어느 분 기준으로 보셔도 똑같아요. 풀이만 {myName ? `${myName} 님` : '나'}의 사주를 중심으로 전개돼요.
                    </p>
                  </div>
                );
              })()}

              {/* 잘 맞는 점 / 안 맞는 점 — 2026-05-28 가독성 개선 */}
              {(pc.matchPoints?.length > 0 || pc.clashPoints?.length > 0) && (
                <div className="space-y-2.5 mb-3">
                  {pc.matchPoints?.map((m: string, i: number) => (
                    <div key={`m${i}`} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(78,122,87,0.07)' }}>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-black mt-0.5" style={{ background: 'rgba(78,122,87,0.18)', color: '#4E7A57', border: '1px solid rgba(78,122,87,0.25)', fontFamily: "'Noto Serif KR', serif" }}>合</span>
                      <p className="text-[13px] text-text-primary leading-relaxed flex-1" style={{ wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(m) }} />
                    </div>
                  ))}
                  {pc.clashPoints?.map((c: string, i: number) => (
                    <div key={`c${i}`} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(138,98,38,0.06)' }}>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-black mt-0.5" style={{ background: 'rgba(138,98,38,0.16)', color: '#8A6226', border: '1px solid rgba(138,98,38,0.25)', fontFamily: "'Noto Serif KR', serif" }}>沖</span>
                      <p className="text-[13px] text-text-primary leading-relaxed flex-1" style={{ wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(c) }} />
                    </div>
                  ))}
                </div>
              )}

              {/* 상대방 결혼관 */}
              {pc.partnerMarriageStyle && (
                <div className="rounded-xl py-2 px-3" style={{ background: `${color}05`, borderLeft: `3px solid ${color}30` }}>
                  <p className="text-[11px] font-semibold mb-0.5" style={{ color }}>상대방의 결혼관</p>
                  <p className="text-[11px] text-text-primary leading-snug">{pc.partnerMarriageStyle}</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </FadeIn>
  );
}

function BusinessViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 업종 적합도 */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-h3 text-text-primary">업종 적합도 TOP 5</p>
            {data.businessType && <TypeBadge label={data.businessType} color={color} />}
          </div>
          {data.fitIndustries?.length > 0 && (
            <div className="space-y-2">
              {data.fitIndustries.map((ind: any, i: number) => (
                <HBar key={i} value={ind.fitPercent || 0} label={ind.name || ''} color={color} suffix="%" />
              ))}
            </div>
          )}
        </div>
        {/* 현재 사업 진단 (운영중일 때) */}
        {(data.currentBizPhase || data.bizHealthScore != null) && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">현재 사업 진단</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {data.currentBizPhase && (
                <StatTile label="사업 단계" value={data.currentBizPhase} color={color} />
              )}
              {data.bizHealthScore != null && (
                <StatTile label="사업 건강도" value={<>{data.bizHealthScore}<span className="text-[11px] font-normal">점</span></>} color={color} big />
              )}
            </div>
            {data.openingAnalysis && (
              <div className="rounded-xl py-2.5 px-3 mb-2" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
                <p className="text-[11px] font-bold mb-0.5" style={{ color }}>개업 시점 분석</p>
                <p className="text-[12px] text-text-primary leading-snug">{data.openingAnalysis}</p>
              </div>
            )}
            {data.nextPhaseAdvice && (
              <div className="rounded-xl py-2 px-3" style={{ background: 'rgba(78,122,87,0.05)' }}>
                <p className="text-[11px] font-bold text-[#4E7A57] mb-0.5">다음 단계 전략</p>
                <p className="text-[12px] text-text-primary leading-snug">{data.nextPhaseAdvice}</p>
              </div>
            )}
          </div>
        )}

        {/* 창업 준비도 + 리스크 + 동업 — 2026-05-28 PM 빈 카드 방지 + 동적 제목/그리드 */}
        {(() => {
          const cells = [data.startupReadiness != null, !!data.riskLevel, !!data.bestPartnerOheng].filter(Boolean).length;
          if (cells === 0 && !data.bestStartMonth && !data.partnerAdvice) return null;
          const gridCols = cells === 1 ? 'grid-cols-1' : cells === 2 ? 'grid-cols-2' : 'grid-cols-3';
          // 동적 제목 — 실제 채워진 영역 기준
          const parts: string[] = [];
          if (data.startupReadiness != null) parts.push('준비도');
          if (data.riskLevel) parts.push('리스크');
          if (data.bestPartnerOheng || data.partnerAdvice) parts.push('동업');
          const dynamicTitle = parts.length === 1
            ? `사업 ${parts[0]} 진단`
            : parts.length === 2 || parts.length === 3
              ? '사업 준비 현황'
              : '창업 분석';
          // 2026-06-02 fix: 항목 하나라도 있을 때만 (빈 카드 방지)
          if (data.startupReadiness == null && !data.riskLevel && !data.bestPartnerOheng && !data.bestStartMonth && !data.partnerAdvice) return null;
          return (
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">{dynamicTitle}</p>
          <div className={`grid ${gridCols} gap-2`}>
            {data.startupReadiness != null && (
              <StatTile label="창업 준비도" value={<>{data.startupReadiness}<span className="text-[11px] font-normal">점</span></>} color={color} big />
            )}
            {data.riskLevel && (
              <StatTile label="리스크 수준" value={data.riskLevel} color={color} tone={data.riskLevel === '높음' ? 'warn' : 'default'} />
            )}
            {data.bestPartnerOheng && (
              <StatTile label="동업자 오행" value={data.bestPartnerOheng} color={color} />
            )}
          </div>
          {data.bestStartMonth && (
            <div className="mt-2 rounded-xl py-2 px-3" style={{ background: 'rgba(78,122,87,0.05)' }}>
              <p className="text-[11px] text-text-hint">창업 최적 시기: <strong className="text-[#4E7A57]">{data.bestStartMonth}</strong></p>
            </div>
          )}
          {data.partnerAdvice && (
            <div className="mt-2 rounded-xl py-2.5 px-3" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
              <p className="text-[11px] font-bold mb-0.5" style={{ color }}>동업 조언</p>
              <p className="text-[12px] text-text-primary leading-snug">{data.partnerAdvice}</p>
            </div>
          )}
        </div>
          );
        })()}
      </div>
    </FadeIn>
  );
}

function HealthViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  const statusColor: Record<string, string> = { '양호': '#4E7A57', '주의': '#8A6226', '경고': '#B04A38' };
  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 오행 장기 상태 */}
        <div className="card">
          <p className="text-h3 text-text-primary mb-1">오행 장기 상태</p>
          {(data.bodyType || data.bestExercise) && (
            <div className="flex items-center gap-2 mb-3">
              {data.bodyType && <TypeBadge label={data.bodyType} color={color} />}
              {data.bestExercise && (
                <span className="text-[11px] text-text-muted">추천: {data.bestExercise}</span>
              )}
            </div>
          )}
          {data.organStatus?.length > 0 && (
            <div className="space-y-2.5">
              {data.organStatus.map((o: any, i: number) => {
                const elColor = OHENG_COLORS[o.element] || color;
                const stColor = statusColor[o.status] || color;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${elColor}18` }}>
                      <span className="text-[11px] font-black" style={{ color: elColor }}>{o.element}</span>
                    </div>
                    <span className="text-[11px] text-text-secondary w-14 flex-shrink-0">{o.organ}</span>
                    <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: `${stColor}10` }}>
                      <motion.div className="h-full rounded-full" style={{ background: stColor }}
                        initial={{ width: 0 }} animate={{ width: `${Math.min(o.risk || 0, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.1 * i }} />
                    </div>
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-lg flex-shrink-0"
                      style={{ background: `${stColor}12`, color: stColor }}>{o.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* 건강 관리 카드 — 2026-06-02 fix: 항목 하나라도 있을 때만 (빈 카드 방지) */}
        {(data.cautionMonths || data.bestSleepTime || data.mentalStressType || data.dietAdvice) && (
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">건강 관리 포인트</p>
          <div className="grid grid-cols-2 gap-2">
            {data.cautionMonths && (
              <StatTile label="건강 주의 월" value={data.cautionMonths} color={color} tone="warn" />
            )}
            {data.bestSleepTime && (
              <StatTile label="최적 수면 시간" value={data.bestSleepTime} color={color} />
            )}
            {data.mentalStressType && (
              <StatTile label="스트레스 유형" value={data.mentalStressType} color={color} />
            )}
            {data.dietAdvice && (
              <StatTile label="식단 조언" value={data.dietAdvice} color={color} tone="good" />
            )}
          </div>
        </div>
        )}
      </div>
    </FadeIn>
  );
}

function ReunionViz({ data, color, myName, partnerName }: { data: any; color: string; myName?: string; partnerName?: string }) {
  if (!data) return null;
  const prob = data.reunionProb ?? 50;
  const verdictColor = data.verdict === '재회 추천' ? '#4E7A57' : data.verdict === '새 인연 추천' ? '#3E5F82' : '#8A6226';
  const contactColor: Record<string, string> = { '지금 연락하기': '#4E7A57', '기다리기': '#B07F38', '새출발': '#3E5F82' };
  const cycleColor: Record<string, string> = { '상승기': '#4E7A57', '하강기': '#B04A38', '정체기': '#7D7870' };
  const ohengColor: Record<string, string> = { 목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82' };
  const pp = data.partnerProfile;
  const ca = data.compatAnalysis;
  const sinsalList = data.sinsal;
  const bd = data.breakupDuration;

  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">

        {/* ━━━ 1. 재회 확률 대형 게이지 ━━━ */}
        {/* 2026-05-28 PM QA — cream bg는 globals.css .topic-analysis-page .card SSOT 통해 자동 적용 */}
        <div className="card py-6">
          <p className="text-[13px] text-text-hint text-center mb-3">재회 가능성</p>
          <div className="flex justify-center mb-4">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                <circle cx="70" cy="70" r="58" fill="none" stroke={`${color}10`} strokeWidth="12" />
                <motion.circle cx="70" cy="70" r="58" fill="none" stroke={color} strokeWidth="12"
                  strokeLinecap="round" strokeDasharray={`${prob * 3.64} 364`}
                  initial={{ strokeDasharray: '0 364' }}
                  animate={{ strokeDasharray: `${prob * 3.64} 364` }}
                  transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span className="text-3xl font-black" style={{ color }}
                  initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: 'spring' }}>
                  {prob}%
                </motion.span>
                <span className="text-[11px] text-text-muted mt-0.5">재회 가능성</span>
              </div>
            </div>
          </div>
          {data.partnerFeeling && (
            <p className="text-[13px] text-text-secondary text-center leading-relaxed mb-3 px-4">{data.partnerFeeling}</p>
          )}
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            {data.verdict && <TypeBadge label={data.verdict} color={verdictColor} />}
            {data.contactAdvice && <TypeBadge label={data.contactAdvice} color={contactColor[data.contactAdvice] || color} />}
            {data.emotionCycle && <TypeBadge label={`감정 ${data.emotionCycle}`} color={cycleColor[data.emotionCycle] || color} />}
          </div>
        </div>

        {/* ━━━ 2. 핵심 수치 대시보드 ━━━ 2026-06-02 fix: 항목 하나라도 있을 때만 (빈 카드 방지) */}
        {(data.bestTiming || data.bestContactMonth || ca?.totalScore != null || data.breakupCause) && (
        <div className="card">
          <div className="grid grid-cols-3 gap-2">
            {data.bestTiming && (
              <StatTile label="재회 적기" value={data.bestTiming} color={color} />
            )}
            {data.bestContactMonth && (
              <StatTile label="최적 연락" value={data.bestContactMonth} color={color} tone="good" />
            )}
            {ca?.totalScore != null && (
              <StatTile label="궁합 점수" value={<>{ca.totalScore}<span className="text-[11px] font-normal">점</span></>} color={color} />
            )}
          </div>
          {data.breakupCause && (
            <div className="mt-2.5 rounded-xl py-2.5 px-3" style={{ background: 'rgba(138,98,38,0.05)' }}>
              <p className="text-[11px] font-bold text-[#8A6226] mb-0.5">이별의 사주적 핵심 원인</p>
              <p className="text-[12px] text-text-primary leading-snug">{data.breakupCause}</p>
            </div>
          )}
        </div>
        )}

        {/* ━━━ 3. 두 사람의 결 (2026-05-28 완전 재설계 — 정통 사주 표현 X, 일상어 스토리텔링) ━━━
            user 피드백: "갈아엎으라고 기존 디자인 내용 싹 버리고"
            - 사주 기둥(柱) 比교 / 년주 월주 일주 한자 라벨 제거
            - 한자 박스 좌우 비교 시각화 제거
            - 대신: 나의 결 / 상대의 결 / 두 사람의 만남 3-카드 스토리텔링 */}
        {pp && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">두 사람, 어떻게 다를까?</p>
            <p className="text-[12px] text-text-muted mb-4 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
              {pp.myVsPartner || '두 사람의 결을 일상어로 풀어드려요.'}
            </p>

            {/* 3-카드 스토리텔링: 나의 결 / 상대의 결 / 만남의 결 */}
            {(() => {
              // 상대 핵심 키워드 추출 (interactions 가장 강한 1개)
              const pc = pp.pillarComparison;
              const ohengBg: Record<string, string> = { 목: 'rgba(78,122,87,0.10)', 화: 'rgba(176,74,56,0.10)', 토: 'rgba(176,127,56,0.10)', 금: 'rgba(74,74,74,0.10)', 수: 'rgba(62,95,130,0.10)' };
              const ohengText: Record<string, string> = { 목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82' };
              const myIlganOheng = pc?.myPillars?.day ? cleanOheng(pc.myPillars.day.oheng) : '';
              const ptIlganOheng = pc?.partnerPillars?.day ? cleanOheng(pc.partnerPillars.day.oheng) : '';
              // 일주 interaction 만 추출 (가장 핵심)
              const dayInter = (pc?.interactions || []).find((it: any) => it.position === '일주');
              const dayType = dayInter?.type || '';
              const isPositive = dayType.includes('합') || dayType.includes('상생') || dayType.includes('생');
              const isNegative = dayType.includes('충') || dayType.includes('상극') || dayType.includes('극') || dayType.includes('형') || dayType.includes('해');
              return (
                <div className="space-y-2.5 mb-3">
                  {/* 나의 결 */}
                  <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: ohengBg[myIlganOheng] || `${color}08`, border: `1px solid ${ohengText[myIlganOheng] || color}25` }}>
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-black text-white" style={{ background: ohengText[myIlganOheng] || color, fontFamily: "'Noto Serif KR', serif" }}>
                      나
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold mb-1" style={{ color: ohengText[myIlganOheng] || color }}>
                        {myName ? `${myName} 님의 결` : '나의 결'} {myIlganOheng && <span className="opacity-70">· {myIlganOheng} 기운</span>}
                      </p>
                      <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                        {pp.loveStyle || '내 사주의 연애 스타일을 분석 중'}
                      </p>
                    </div>
                  </div>
                  {/* 두 사람의 만남 (가운데) — 합/충/생/극 일상어로 */}
                  {dayType && (
                    <div className="rounded-xl p-3.5 text-center" style={{ background: isPositive ? 'rgba(78,122,87,0.06)' : isNegative ? 'rgba(138,98,38,0.06)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isPositive ? 'rgba(78,122,87,0.2)' : isNegative ? 'rgba(138,98,38,0.2)' : 'rgba(0,0,0,0.08)'}` }}>
                      <p className="text-[11px] font-bold mb-1" style={{ color: isPositive ? '#4E7A57' : isNegative ? '#8A6226' : '#7A7269' }}>
                        {isPositive ? '✓ 잘 맞물리는 결' : isNegative ? '⚠ 부딪히는 결' : '두 사람의 만남'}
                      </p>
                      <p className="text-[13px] font-bold text-text-primary mb-1.5" style={{ wordBreak: 'keep-all' }}>
                        {dayInter?.desc || dayType}
                      </p>
                    </div>
                  )}
                  {/* 상대의 결 */}
                  <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: ohengBg[ptIlganOheng] || `${ohengColor[pp.dominantOheng] || color}08`, border: `1px solid ${ohengText[ptIlganOheng] || color}25` }}>
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-black text-white" style={{ background: ohengText[ptIlganOheng] || color, fontFamily: "'Noto Serif KR', serif" }}>
                      상대
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold mb-1" style={{ color: ohengText[ptIlganOheng] || color }}>
                        {partnerName ? `${partnerName} 님의 결` : '상대의 결'} {ptIlganOheng && <span className="opacity-70">· {ptIlganOheng} 기운</span>}
                      </p>
                      <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                        {pp.personality || '상대의 사주를 분석 중'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 2026-06-13 P1-2 — 신뢰 카피 (연애·결혼과 동일 · 재회만 누락돼 있던 것) */}
            <p className="text-[11px] text-text-hint mb-3 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
              두 분의 합·충 판정은 만세력 계산값이라 어느 분 기준으로 보셔도 똑같아요. 풀이만 {myName ? `${myName} 님` : '나'}의 사주를 중심으로 전개돼요.
            </p>

            {/* 2026-05-28 — 나 vs 상대 2-카드 제거 (위 3-카드 스토리텔링에 통합됨) */}

            {/* 상대 현재 감정 + 재회 욕구 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {pp.currentEmotion && (
                <div className="rounded-xl p-2.5" style={{ background: 'rgba(138,98,38,0.04)' }}>
                  <p className="text-[11px] text-text-hint mb-0.5">상대 현재 감정</p>
                  <p className="text-[11px] font-semibold text-[#8A6226]">{pp.currentEmotion}</p>
                </div>
              )}
              {pp.reunionDesire != null && (
                <div className="rounded-xl p-2.5" style={{ background: `${color}06` }}>
                  <p className="text-[11px] text-text-hint mb-1">상대 재회 욕구</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-[8px] rounded-full overflow-hidden" style={{ background: `${color}12` }}>
                      <motion.div className="h-full rounded-full" style={{ background: color }}
                        initial={{ width: 0 }} animate={{ width: `${Math.min(pp.reunionDesire, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.4 }} />
                    </div>
                    <span className="text-[11px] font-bold flex-shrink-0" style={{ color }}>{pp.reunionDesire}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* 잘 맞는 점 / 안 맞는 점 — 2026-05-28 가독성 개선 (love/marriage SSOT 정렬) */}
            {(pp.matchPoints?.length > 0 || pp.clashPoints?.length > 0) && (
              <div className="space-y-2.5 mt-3">
                {pp.matchPoints?.map((m: string, i: number) => (
                  <div key={`m${i}`} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(78,122,87,0.07)' }}>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-black mt-0.5"
                      style={{ background: 'rgba(78,122,87,0.18)', color: '#4E7A57', border: '1px solid rgba(78,122,87,0.25)', fontFamily: "'Noto Serif KR', serif" }}>合</span>
                    <p className="text-[13px] text-text-primary leading-relaxed flex-1" style={{ wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(m) }} />
                  </div>
                ))}
                {pp.clashPoints?.map((c: string, i: number) => (
                  <div key={`c${i}`} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: 'rgba(138,98,38,0.06)' }}>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-black mt-0.5"
                      style={{ background: 'rgba(138,98,38,0.16)', color: '#8A6226', border: '1px solid rgba(138,98,38,0.25)', fontFamily: "'Noto Serif KR', serif" }}>沖</span>
                    <p className="text-[13px] text-text-primary leading-relaxed flex-1" style={{ wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(c) }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ━━━ 4. 궁합 분석 레이더 차트 ━━━ */}
        {ca?.axes?.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-h3 text-text-primary">궁합 구조 분석</p>
              {ca.totalScore != null && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                  style={{ background: `${color}10`, color }}>{ca.totalScore}점</span>
              )}
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={ca.axes.map((a: any) => ({ axis: a.axis, score: a.score }))}>
                  <PolarGrid stroke="rgba(0,0,0,0.06)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: '#8D7B68' }} />
                  <Radar dataKey="score" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} dot={{ r: 3, fill: color }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-5 gap-1 mt-2">
              {ca.axes.map((a: any, i: number) => (
                <div key={i} className="text-center">
                  <p className="text-[12px] font-bold" style={{ color }}>{a.score}</p>
                  <p className="text-[11px] text-text-hint">{a.axis}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ━━━ 5. 전통 연애 신살 분석 ━━━ */}
        {sinsalList && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">타고난 6 가지 연애 특질</p>
            <p className="text-[11px] text-text-hint mb-3">사주에 숨겨진 연애 DNA를 하나씩 짚어봤어요</p>
            <div className="space-y-3">
              {[
                { key: 'doHwaSal', name: '도화살', hanja: '桃花殺', summary: '타고난 연애 매력', subject: '나의 사주',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8C6D3D" strokeWidth="2"><path d="M12 21C7 17 2 13 2 8.5a5.5 5.5 0 0110-3.08A5.5 5.5 0 0122 8.5C22 13 17 17 12 21z" /></svg>, activeColor: '#8C6D3D' },
                { key: 'hongYeomSal', name: '홍염살', hanja: '紅艶殺', summary: '강렬한 끌림', subject: '나의 사주',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B04A38" strokeWidth="2"><path d="M12 2c1 3 4 5.5 4 10a4 4 0 11-8 0c0-4.5 3-7 4-10z" /></svg>, activeColor: '#B04A38' },
                { key: 'wonJinSal', name: '원진살', hanja: '怨嗔殺', summary: '감정 어긋남', subject: '두 사람 사이',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A6226" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M16 8l-8 8M8 8l8 8" /></svg>, activeColor: '#8A6226' },
                { key: 'cheonEulGuiin', name: '천을귀인', hanja: '天乙貴人', summary: '귀인의 도움', subject: '나의 사주',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4E7A57" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01z" /></svg>, activeColor: '#4E7A57' },
                { key: 'samhap', name: '삼합', hanja: '三合', summary: '세 기운의 조화', subject: '두 사람 사이',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3E5F82" strokeWidth="2"><path d="M12 3l8.66 15H3.34z" /></svg>, activeColor: '#3E5F82' },
                { key: 'yukhap', name: '육합', hanja: '六合', summary: '짝궁 결합', subject: '두 사람 사이',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A5C7E" strokeWidth="2"><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></svg>, activeColor: '#7A5C7E' },
              ].map(({ key, name, hanja, summary, subject, icon, activeColor }) => {
                const s = sinsalList[key];
                if (!s) return null;
                const isActive = s.have === true || s.have === 'true';
                const impactType = s.impact || (isActive ? 'positive' : 'neutral');
                const impactLabel = impactType === 'positive' ? '좋은 영향' : impactType === 'negative' ? '주의 필요' : '해당 없음';
                const impactColor = impactType === 'positive' ? '#4E7A57' : impactType === 'negative' ? '#8A6226' : '#999';
                return (
                  <div key={key} className="rounded-2xl overflow-hidden"
                    style={{ background: isActive ? `${activeColor}04` : 'rgba(0,0,0,0.015)', border: `1px solid ${isActive ? `${activeColor}15` : 'rgba(0,0,0,0.04)'}` }}>
                    {/* 헤더 */}
                    <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: isActive ? `${activeColor}12` : 'rgba(0,0,0,0.04)' }}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[12px] font-bold text-text-primary">{name}</p>
                          <span className="text-[11px] text-text-hint">({hanja})</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[rgba(0,0,0,0.04)] text-text-hint">{subject}</span>
                        </div>
                        <p className="text-[11px] text-text-muted">{summary}</p>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: isActive ? `${impactColor}12` : 'rgba(0,0,0,0.04)', color: isActive ? impactColor : '#bbb' }}>
                        {isActive ? impactLabel : '없음'}
                      </span>
                    </div>
                    {/* 본문 — 쉬운 설명 */}
                    <div className="px-3.5 pb-3 space-y-1.5">
                      {s.meaning && (
                        <div className="rounded-lg py-2 px-2.5" style={{ background: isActive ? `${activeColor}06` : 'rgba(0,0,0,0.02)' }}>
                          <p className="text-[11px] font-semibold mb-0.5" style={{ color: isActive ? activeColor : '#999' }}>쉽게 말하면</p>
                          <p className="text-[11px] text-text-primary leading-relaxed">{s.meaning}</p>
                        </div>
                      )}
                      {s.advice && isActive && (
                        <div className="flex items-start gap-1.5">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2.5" className="mt-0.5 flex-shrink-0">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                          <p className="text-[11px] text-text-secondary leading-snug">{s.advice}</p>
                        </div>
                      )}
                      {s.desc && !s.meaning && (
                        <p className="text-[11px] text-text-secondary leading-snug">{s.desc}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ━━━ 6. 월별 에너지 흐름 차트 ━━━ */}
        {data.monthlyEnergy?.length > 0 && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">월별 재회 에너지 흐름</p>
            <p className="text-[11px] text-text-hint mb-3">나의 에너지 / 재회 확률 추이</p>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyEnergy} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="reunionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="myEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8C6D3D" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#8C6D3D" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false}
                    tickFormatter={(v: string) => v.replace('월', '')} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} />
                  <Area type="monotone" dataKey="reunionChance" stroke={color} fill="url(#reunionGrad)"
                    strokeWidth={2} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="myEnergy" stroke="#8C6D3D" fill="url(#myEnergyGrad)"
                    strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-[2px] rounded-full" style={{ background: color }} />
                <span className="text-[11px] text-text-hint">재회 확률</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-[2px] rounded-full" style={{ background: '#8C6D3D', opacity: 0.6 }} />
                <span className="text-[11px] text-text-hint">나의 에너지</span>
              </div>
            </div>
          </div>
        )}

        {/* ━━━ 7. 재회 핵심 변수 분석 ━━━ */}
        {data.reunionFactors?.length > 0 && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">재회 핵심 변수</p>
            <p className="text-[11px] text-text-hint mb-3">사주 구조에서 재회에 영향을 미치는 요인들</p>
            <div className="space-y-2.5">
              {data.reunionFactors.map((f: any, i: number) => {
                const isFav = f.favorable === true || f.favorable === 'true';
                const barColor = isFav ? '#4E7A57' : '#8A6226';
                const impact = Math.min(f.impact ?? 50, 100);
                return (
                  <motion.div key={i} className="rounded-xl p-3" style={{ background: isFav ? 'rgba(78,122,87,0.04)' : 'rgba(138,98,38,0.03)' }}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0"
                          style={{ background: `${barColor}15`, color: barColor }}>
                          {isFav ? '+' : '!'}
                        </span>
                        <p className="text-[12px] font-bold text-text-primary">{f.factor}</p>
                      </div>
                      <span className="text-[11px] font-bold flex-shrink-0" style={{ color: barColor }}>{impact}%</span>
                    </div>
                    <div className="h-[6px] rounded-full overflow-hidden ml-7" style={{ background: `${barColor}10` }}>
                      <motion.div className="h-full rounded-full" style={{ background: barColor }}
                        initial={{ width: 0 }} animate={{ width: `${impact}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }} />
                    </div>
                    {f.desc && <p className="text-[11px] text-text-muted mt-1 ml-7 leading-snug">{f.desc}</p>}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ━━━ 8. 그린플래그 / 레드플래그 ━━━ */}
        {(data.greenFlags?.length > 0 || data.redFlags?.length > 0) && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">재회 신호 분석</p>
            <div className="grid grid-cols-2 gap-3">
              {data.greenFlags?.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(78,122,87,0.04)' }}>
                  <p className="text-[11px] font-bold text-[#4E7A57] mb-2 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                      style={{ background: 'rgba(78,122,87,0.15)' }}>+</span>
                    긍정 신호
                  </p>
                  {data.greenFlags.map((f: string, i: number) => (
                    <p key={i} className="text-[11px] text-text-secondary mb-1.5 leading-snug pl-5 relative">
                      <span className="absolute left-0 top-0.5 text-[#4E7A57] text-[11px]">&#x2713;</span>
                      {stripMd(f)}
                    </p>
                  ))}
                </div>
              )}
              {data.redFlags?.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(176,74,56,0.04)' }}>
                  <p className="text-[11px] font-bold text-[#B04A38] mb-2 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                      style={{ background: 'rgba(176,74,56,0.12)' }}>!</span>
                    경고 신호
                  </p>
                  {data.redFlags.map((f: string, i: number) => (
                    <p key={i} className="text-[11px] text-text-secondary mb-1.5 leading-snug pl-5 relative">
                      <span className="absolute left-0 top-0.5 text-[#B04A38] text-[11px]">&#x2717;</span>
                      {stripMd(f)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ━━━ 9. 이별 기간 분석 (감정 페이즈 타임라인) ━━━ */}
        {bd && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">이별 기간 분석</p>
            {bd.emotionNow && (
              <p className="text-[11px] text-text-muted mb-3">{bd.emotionNow}</p>
            )}

            {/* 감정 페이즈 타임라인 */}
            {bd.phases?.length > 0 && (
              <div className="mb-3">
                {/* 페이즈 프로그레스 바 */}
                <div className="flex gap-1 mb-3">
                  {bd.phases.map((_: any, i: number) => {
                    const isCurrent = i === (bd.currentPhaseIndex ?? 0);
                    const isPast = i < (bd.currentPhaseIndex ?? 0);
                    return (
                      <div key={i} className="flex-1 h-[6px] rounded-full transition-all"
                        style={{ background: isCurrent ? color : isPast ? `${color}50` : `${color}12` }} />
                    );
                  })}
                </div>
                {/* 페이즈 상세 — 모든 단계 표시, 현재 단계 강조 */}
                <div className="space-y-2">
                  {bd.phases.map((ph: any, i: number) => {
                    const isCurrent = i === (bd.currentPhaseIndex ?? 0);
                    const isPast = i < (bd.currentPhaseIndex ?? 0);
                    // 각 단계 아이콘 (SVG 인라인)
                    const phaseIcons = [
                      // 충격기: 깨진 하트
                      <svg key="p0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B04A38" strokeWidth="2"><path d="M12 6l-2 4 3 2-4 6" /><path d="M19.5 13c0 4.5-7.5 9-7.5 9s-7.5-4.5-7.5-9a6 6 0 0112 0z" /></svg>,
                      // 거부기: 화난 얼굴(번개)
                      <svg key="p1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A6226" strokeWidth="2"><path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" /></svg>,
                      // 회복기: 새싹
                      <svg key="p2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4E7A57" strokeWidth="2"><path d="M12 22V10" /><path d="M6 12c0-3.3 2.7-6 6-6" /><path d="M18 12c0-3.3-2.7-6-6-6" /><circle cx="12" cy="22" r="1" fill="#4E7A57" /></svg>,
                      // 수용기: 균형
                      <svg key="p3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3E5F82" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>,
                      // 장기 분리기: 나비(날개)
                      <svg key="p4" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7A5C7E" strokeWidth="2"><path d="M12 12c-3-3-7-3-8 0s1 7 4 7c2 0 3-2 4-4" /><path d="M12 12c3-3 7-3 8 0s-1 7-4 7c-2 0-3-2-4-4" /><path d="M12 7v10" /></svg>,
                    ];
                    return (
                      <div key={i} className="rounded-xl p-3 transition-all"
                        style={{
                          background: isCurrent ? `${color}08` : isPast ? 'rgba(0,0,0,0.015)' : 'rgba(0,0,0,0.01)',
                          border: isCurrent ? `1.5px solid ${color}25` : '1px solid rgba(0,0,0,0.04)',
                        }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{phaseIcons[i] || phaseIcons[4]}</span>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isCurrent ? 'animate-pulse' : ''}`}
                            style={{ background: isCurrent ? color : isPast ? `${color}40` : `${color}15` }} />
                          <p className={`text-[11px] flex-1 ${isCurrent ? 'font-bold' : isPast ? 'font-medium text-text-muted' : 'font-medium text-text-hint'}`}
                            style={isCurrent ? { color } : {}}>
                            {ph.name} <span className={`font-normal ${isCurrent ? '' : 'text-text-hint'}`} style={isCurrent ? { color: `${color}90` } : {}}>({ph.period})</span>
                          </p>
                          {isCurrent && <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: color }}>현재</span>}
                          {isPast && <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium text-text-hint" style={{ background: 'rgba(0,0,0,0.04)' }}>지남</span>}
                        </div>
                        {/* 단계 설명 — 모든 단계에 표시 */}
                        {ph.desc && (
                          <p className={`text-[11px] leading-snug ml-7 mb-1 ${isCurrent ? 'text-text-secondary' : 'text-text-hint'}`}>
                            {ph.desc}
                          </p>
                        )}
                        {/* 나/상대 상태 — 모든 단계에 표시 */}
                        <div className="ml-7 grid grid-cols-2 gap-2">
                          {ph.myState && (
                            <p className={`text-[11px] ${isCurrent ? 'text-text-secondary' : 'text-text-hint'}`}>
                              나: <span className={`font-semibold ${isCurrent ? 'text-text-primary' : ''}`}>{ph.myState}</span>
                            </p>
                          )}
                          {ph.partnerState && (
                            <p className={`text-[11px] ${isCurrent ? 'text-text-secondary' : 'text-text-hint'}`}>
                              상대: <span className={`font-semibold ${isCurrent ? 'text-text-primary' : ''}`}>{ph.partnerState}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 핵심 정보 */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {bd.healingStage && (
                <div className="rounded-xl p-2.5" style={{ background: `${color}06` }}>
                  <p className="text-[11px] text-text-hint mb-0.5">현재 단계</p>
                  <p className="text-[12px] font-bold" style={{ color }}>{bd.healingStage}</p>
                </div>
              )}
              {bd.optimalWait && (
                <div className="rounded-xl p-2.5" style={{ background: 'rgba(78,122,87,0.05)' }}>
                  <p className="text-[11px] text-text-hint mb-0.5">최적 대기 기간</p>
                  <p className="text-[12px] font-bold text-[#4E7A57]">{bd.optimalWait}</p>
                </div>
              )}
            </div>
            {bd.stageDesc && (
              <p className="text-[11px] text-text-secondary leading-relaxed mb-1.5">{bd.stageDesc}</p>
            )}
            {bd.reunionImpact && (
              <div className="rounded-xl py-2 px-3 mt-1" style={{ background: `${color}05`, borderLeft: `3px solid ${color}30` }}>
                <p className="text-[11px] text-text-primary leading-snug">{bd.reunionImpact}</p>
              </div>
            )}
          </div>
        )}

        {/* ━━━ 10. 재회 vs 새인연 비교 ━━━ */}
        {data.comparison && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">재회 vs 새 인연 비교</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: `${color}06` }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ background: color }}>R</span>
                  <p className="text-[11px] font-bold" style={{ color }}>재회</p>
                </div>
                {data.comparison.reunionPros?.map((p: string, i: number) => (
                  <p key={`rp${i}`} className="text-[11px] text-text-secondary mb-1 flex items-start gap-1">
                    <span className="text-[#4E7A57] mt-0.5 flex-shrink-0 font-bold">+</span>{stripMd(p)}
                  </p>
                ))}
                {data.comparison.reunionCons?.map((c: string, i: number) => (
                  <p key={`rc${i}`} className="text-[11px] text-text-muted mb-1 flex items-start gap-1">
                    <span className="text-[#B04A38] mt-0.5 flex-shrink-0 font-bold">-</span>{stripMd(c)}
                  </p>
                ))}
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(62,95,130,0.05)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ background: '#3E5F82' }}>N</span>
                  <p className="text-[11px] font-bold text-[#3E5F82]">새 인연</p>
                </div>
                {data.comparison.newLovePros?.map((p: string, i: number) => (
                  <p key={`np${i}`} className="text-[11px] text-text-secondary mb-1 flex items-start gap-1">
                    <span className="text-[#4E7A57] mt-0.5 flex-shrink-0 font-bold">+</span>{stripMd(p)}
                  </p>
                ))}
                {data.comparison.newLoveCons?.map((c: string, i: number) => (
                  <p key={`nc${i}`} className="text-[11px] text-text-muted mb-1 flex items-start gap-1">
                    <span className="text-[#B04A38] mt-0.5 flex-shrink-0 font-bold">-</span>{stripMd(c)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </FadeIn>
  );
}

function StudyViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  // 2026-05-28 PM — empty card guard (CareerViz fix 와 같은 패턴 적용)
  const hasStudyProfile = !!(data.studyType || data.examStrength || data.passRate || data.examLuckMonth);
  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 학습 프로필 — 항목 1개라도 있을 때만 렌더 */}
        {hasStudyProfile && (
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">학습 프로필</p>
          <div className="grid grid-cols-2 gap-2">
            {data.studyType && <StatTile label="학습 유형" value={data.studyType} color={color} />}
            {data.examStrength && <StatTile label="시험 강점" value={data.examStrength} color={color} />}
            {data.passRate && <StatTile label="합격 기운" value={data.passRate} color={color} tone={data.passRate === '높음' ? 'good' : data.passRate === '보완필요' ? 'warn' : 'default'} />}
            {data.examLuckMonth && <StatTile label="시험운 최강 월" value={data.examLuckMonth} color={color} tone="good" />}
          </div>
        </div>
        )}
        {/* 시험 맞춤 분석 (시험명/예정일 입력 시) */}
        {(data.examFitScore != null || data.examTimingVerdict) && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">시험 맞춤 분석</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {data.examFitScore != null && (
                <div className="rounded-xl p-3" style={{ background: `${color}06` }}>
                  <p className="text-[11px] text-text-hint mb-1">시험 적합도</p>
                  <div className="flex items-end gap-1">
                    <span className="text-[20px] font-black" style={{ color }}>{data.examFitScore}</span>
                    <span className="text-[11px] text-text-muted mb-1">/ 100</span>
                  </div>
                  <div className="h-[6px] rounded-full overflow-hidden mt-1" style={{ background: `${color}12` }}>
                    <motion.div className="h-full rounded-full" style={{ background: color }}
                      initial={{ width: 0 }} animate={{ width: `${Math.min(data.examFitScore, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }} />
                  </div>
                </div>
              )}
              {data.examTimingVerdict && (
                <div className="rounded-xl p-3" style={{
                  background: data.examTimingVerdict === '최적' ? 'rgba(78,122,87,0.06)' : data.examTimingVerdict === '주의' ? 'rgba(176,74,56,0.05)' : `${color}06`
                }}>
                  <p className="text-[11px] text-text-hint mb-1">시험 시기 판정</p>
                  <p className="text-[18px] font-black" style={{
                    color: data.examTimingVerdict === '최적' ? '#4E7A57' : data.examTimingVerdict === '주의' ? '#B04A38' : color
                  }}>{data.examTimingVerdict}</p>
                </div>
              )}
            </div>
            {data.examTimingAnalysis && (
              <div className="rounded-xl py-2.5 px-3 mb-2" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
                <p className="text-[12px] text-text-primary leading-snug">{data.examTimingAnalysis}</p>
              </div>
            )}
            {data.examDayTips && (
              <div className="rounded-xl py-2 px-3" style={{ background: 'rgba(78,122,87,0.05)' }}>
                <p className="text-[11px] font-bold text-[#4E7A57] mb-0.5">시험 당일 꿀팁</p>
                <p className="text-[12px] text-text-primary leading-snug">{data.examDayTips}</p>
              </div>
            )}
          </div>
        )}

        {/* 시험 전략 카드 — 2026-06-02 fix: study 필드 하나라도 있을 때만 렌더 (exam 재사용 시 빈 카드 방지) */}
        {(data.bestStudyTime || data.focusPeakHour || data.seatDirection || data.studyPartnerType || data.slumpPeriod) && (
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">시험 전략 포인트</p>
          <div className="grid grid-cols-2 gap-2">
            {data.bestStudyTime && (
              <StatTile label="최적 공부 시간대" value={data.bestStudyTime} color={color} />
            )}
            {data.focusPeakHour && (
              <StatTile label="집중력 피크" value={data.focusPeakHour} color={color} />
            )}
            {data.seatDirection && (
              <StatTile label="유리한 좌석 방향" value={data.seatDirection} color={color} />
            )}
            {data.studyPartnerType && (
              <StatTile label="같이 공부하면 좋은 유형" value={data.studyPartnerType} color={color} tone="good" />
            )}
          </div>
          {data.slumpPeriod && (
            <div className="mt-2.5 rounded-xl py-2 px-3" style={{ background: 'rgba(138,98,38,0.06)' }}>
              <p className="text-[11px] text-text-primary">슬럼프 주의 시기: <strong className="text-[#8A6226]">{data.slumpPeriod}</strong></p>
            </div>
          )}
        </div>
        )}
      </div>
    </FadeIn>
  );
}

/**
 * ExamViz — 합격·이직운 전용 (audit 4 P0 #1 신규)
 *  · StudyViz 재사용 + exam-specific 카드 추가
 *  · 합격 신살 (문창·학당·태극귀인) 활성화 상태
 *  · 시험·면접·이직 3축 인디케이터
 *  · 보라계 컬러 (#8C6D3D)
 */
function ExamViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  // exam-specific 데이터 (있으면 노출, 없어도 안 깨짐)
  const examLuckLevel = data.examLuckLevel || data.passProbability;
  const luckSinsal = data.luckSinsal || data.gilseong || data.examGilseong;
  const bestExamMonth = data.bestExamMonth || data.examPeakMonth;
  const interviewTime = data.interviewTime || data.bestInterviewTime;
  const jobChangeTiming = data.jobChangeTiming;
  // 2026-05-28 — exam 신규 분기 schema (changeType + examName + bestField + decisionUrgency 등)
  const examTargetInfo = data.examTimingVerdict || data.examTargetVerdict;
  const examTimingAnalysis = data.examTimingAnalysis || data.changeTimingAnalysis;
  const decisionUrgency = data.decisionUrgency;
  const oneShotVsMultiple = data.oneShotVsMultiple || data.passApproach;
  const recommendedFields = data.bestField || data.recommendedFields;

  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 2026-05-28 — exam 분기별 시각 차별화 (시험명/이직/직무전환 입력 시) */}
        {(examTargetInfo || examTimingAnalysis || decisionUrgency || oneShotVsMultiple || recommendedFields) && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] font-black" style={{ background: `${color}18`, color, fontFamily: "'Noto Serif KR', serif" }}>進</span>
              <p className="text-h3 text-text-primary">예정 변동 정밀 분석</p>
            </div>
            <div className="space-y-2.5">
              {examTargetInfo && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>예정 시기 판정</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{examTargetInfo}</p>
                </div>
              )}
              {examTimingAnalysis && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>대운·세운 흐름</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{examTimingAnalysis}</p>
                </div>
              )}
              {oneShotVsMultiple && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>합격 접근 방식</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{oneShotVsMultiple}</p>
                </div>
              )}
              {decisionUrgency && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(138,98,38,0.06)' }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color: '#8A6226' }}>결정 시급도</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{decisionUrgency}</p>
                </div>
              )}
              {recommendedFields && (
                <div className="rounded-xl p-3" style={{ background: `${color}08` }}>
                  <p className="text-[11px] font-bold mb-1" style={{ color }}>사주 맞춤 추천 분야</p>
                  <p className="text-[13px] text-text-primary leading-relaxed" style={{ wordBreak: 'keep-all' }}>{Array.isArray(recommendedFields) ? recommendedFields.join(' · ') : recommendedFields}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {/* exam-specific top — 합격 운 + 시기 + 면접 시간대 (있는 데이터만).
            2026-05-28 PM — 동적 제목/그리드 (cell 1개면 1-col). */}
        {(examLuckLevel || bestExamMonth || interviewTime || jobChangeTiming) && (() => {
          const cells = [examLuckLevel, bestExamMonth, interviewTime, jobChangeTiming].filter(Boolean).length;
          const gridCols = cells === 1 ? 'grid-cols-1' : 'grid-cols-2';
          // 동적 제목 — 채워진 항목 기준
          const parts: string[] = [];
          if (examLuckLevel || bestExamMonth) parts.push('합격');
          if (jobChangeTiming) parts.push('이직');
          if (interviewTime && !parts.includes('합격')) parts.push('면접');
          const dynamicTitle = parts.length === 0
            ? '핵심 지표'
            : parts.length === 1
              ? `${parts[0]} 핵심 지표`
              : `${parts.join('·')} 핵심 지표`;
          return (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">{dynamicTitle}</p>
            <div className={`grid ${gridCols} gap-2`}>
              {examLuckLevel && (
                <StatTile label="합격 운 강도" value={stripMd(String(examLuckLevel))} color={color} />
              )}
              {bestExamMonth && (
                <StatTile label="최적 시기" value={stripMd(String(bestExamMonth))} color={color} tone="good" />
              )}
              {interviewTime && (
                <StatTile label="면접 유리 시간" value={stripMd(String(interviewTime))} color={color} />
              )}
              {jobChangeTiming && (
                <StatTile label="이직 좋은 시기" value={stripMd(String(jobChangeTiming))} color={color} tone="good" />
              )}
            </div>
          </div>
          );
        })()}

        {/* 합격 신살 (문창·학당·태극) 활성화 상태 */}
        {luckSinsal && (Array.isArray(luckSinsal) ? luckSinsal.length > 0 : true) && (
          <div className="card" style={{ background: `linear-gradient(135deg, ${color}08, ${color}03)` }}>
            <p className="text-[12px] font-bold mb-2" style={{ color }}>★ 합격 길성 (합격에 도움 주는 별)</p>
            {Array.isArray(luckSinsal) ? (
              <div className="flex flex-wrap gap-2">
                {luckSinsal.map((s: any, i: number) => (
                  <span key={i} className="px-3 py-1 rounded-full text-[12px] font-semibold"
                    style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}>
                    {typeof s === 'string' ? s : s.name || s.label || ''}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-text-primary">{stripMd(String(luckSinsal))}</p>
            )}
          </div>
        )}

        {/* StudyViz 의 학습 프로필·과목별 적성·집중력 시간대 등 재활용 */}
        <StudyViz data={data} color={color} />
      </div>
    </FadeIn>
  );
}

function SocialViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  const guiinOhengColor = data.guiinProfile?.oheng ? (OHENG_COLORS[data.guiinProfile.oheng] || color) : color;
  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 관계 프로필 */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-h3 text-text-primary">관계 프로필</p>
            {data.socialStyle && <TypeBadge label={data.socialStyle} color={color} />}
          </div>
          {data.guiinProfile && (
            <div className="rounded-xl p-3" style={{ background: `${color}06` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[11px] font-bold" style={{ color }}>귀인(貴人) 프로필</p>
                {data.guiinProfile.oheng && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-lg"
                    style={{ background: `${guiinOhengColor}15`, color: guiinOhengColor }}>
                    {data.guiinProfile.oheng}
                  </span>
                )}
              </div>
              {data.guiinProfile.traits && (
                <p className="text-[12px] text-text-primary mb-1">{data.guiinProfile.traits}</p>
              )}
              {data.guiinProfile.when && (
                <p className="text-[11px] text-text-muted">만남 시기: <strong style={{ color }}>{data.guiinProfile.when}</strong></p>
              )}
            </div>
          )}
          {data.bestAllyType && (
            <div className="mt-2 rounded-xl py-2 px-3" style={{ background: 'rgba(78,122,87,0.05)' }}>
              <p className="text-[11px] text-text-hint">잘 맞는 동료/친구: <strong className="text-[#4E7A57]">{data.bestAllyType}</strong></p>
            </div>
          )}
        </div>
        {/* 주의 사항 카드 */}
        {(data.gossipMonth || data.conflictTrigger) && (
          <div className="card" style={{ background: 'rgba(138,98,38,0.04)', border: '1px solid rgba(138,98,38,0.25)' }}>
            <p className="text-[11px] font-bold text-[#8A6226] mb-2">주의 포인트</p>
            {data.gossipMonth && (
              <p className="text-[11px] text-text-primary mb-1.5">구설수 주의 월: <strong className="text-[#8A6226]">{data.gossipMonth}</strong></p>
            )}
            {data.conflictTrigger && (
              <p className="text-[11px] text-text-primary">갈등 트리거: <strong className="text-[#8A6226]">{data.conflictTrigger}</strong></p>
            )}
          </div>
        )}
      </div>
    </FadeIn>
  );
}

function MovingViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 이동 핵심 수치 */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-h3 text-text-primary">이동 분석</p>
            {data.hasYeokmasal != null && (
              <TypeBadge label={data.hasYeokmasal ? '역마살(驛馬殺) 있음' : '역마살 없음'}
                color={data.hasYeokmasal ? '#8A6226' : '#4E7A57'} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.bestDirection && (
              <StatTile label="좋은 방향" value={data.bestDirection} color={color} tone="good" />
            )}
            {data.avoidDirection && (
              <StatTile label="피할 방향" value={data.avoidDirection} color={color} tone="warn" />
            )}
            {data.movingType && (
              <StatTile label="유리한 이동 유형" value={data.movingType} color={color} />
            )}
            {data.travelLuck && (
              <StatTile label="해외운" value={data.travelLuck} color={color} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {data.bestTiming && (
              <StatTile label="최적 이동 시기" value={data.bestTiming} color={color} />
            )}
            {data.bestMoveMonth && (
              <StatTile label="이사 최적 월" value={data.bestMoveMonth} color={color} tone="good" />
            )}
          </div>
        </div>
        {/* 이사 예정 시기 분석 (입력 시) */}
        {(data.planDateVerdict || data.purposeAdvice) && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">이사 계획 분석</p>
            {data.planDateVerdict && (
              <div className={`grid ${data.betterAlternative ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-2`}>
                <StatTile label="예정 시기 판정" value={data.planDateVerdict} color={color} big tone={data.planDateVerdict === '좋음' ? 'good' : data.planDateVerdict === '주의' ? 'warn' : 'default'} />
                {data.betterAlternative && (
                  <StatTile label="더 좋은 시기" value={data.betterAlternative} color={color} tone="good" />
                )}
              </div>
            )}
            {data.planDateAnalysis && (
              <div className="rounded-xl py-2.5 px-3 mb-2" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
                <p className="text-[12px] text-text-primary leading-snug">{data.planDateAnalysis}</p>
              </div>
            )}
            {data.purposeAdvice && (
              <div className="rounded-xl py-2 px-3" style={{ background: 'rgba(62,95,130,0.05)' }}>
                <p className="text-[11px] font-bold text-[#3E5F82] mb-0.5">이사 목적 조언</p>
                <p className="text-[12px] text-text-primary leading-snug">{data.purposeAdvice}</p>
              </div>
            )}
          </div>
        )}

        {/* 오행 방위 매핑 */}
        {data.ohengDirectionMap && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-2">오행 방위 분석</p>
            <p className="text-[12px] text-text-secondary leading-relaxed">{data.ohengDirectionMap}</p>
          </div>
        )}
      </div>
    </FadeIn>
  );
}

/** 주제별 시각화 라우터 */
function TopicViz({ topicId, data, color, sajuData, birthYear, myName, partnerName }: { topicId: string; data: any; color: string; sajuData?: any; birthYear?: number; myName?: string; partnerName?: string }) {
  if (!data) return null;
  switch (topicId) {
    case 'love': return <LoveViz data={data} color={color} myName={myName} partnerName={partnerName} />;
    // Phase 2 Stage 2B: WealthViz 에 sajuData + birthYear 추가 — daewoon-card / relflow 사용
    case 'wealth': return <WealthViz data={data} color={color} sajuData={sajuData} birthYear={birthYear} />;
    case 'career': return <CareerViz data={data} color={color} />;
    case 'marriage': return <MarriageViz data={data} color={color} myName={myName} partnerName={partnerName} />;
    case 'business': return <BusinessViz data={data} color={color} />;
    case 'health': return <HealthViz data={data} color={color} />;
    case 'reunion': return <ReunionViz data={data} color={color} myName={myName} partnerName={partnerName} />;
    case 'study': return <StudyViz data={data} color={color} />;
    case 'social': return <SocialViz data={data} color={color} />;
    case 'move':
    case 'moving': return <MovingViz data={data} color={color} />;
    case 'exam': return <ExamViz data={data} color={color} />; // audit 4 P0 #1 — 합격·이직운 전용 ExamViz (StudyViz 재사용 + exam-specific 카드)
    default: return null;
  }
}

/** 섹션 인사이트 카드 — 사주 용어 기반 핵심 데이터 카드 */
function InsightCards({ cards, color }: { cards?: { label: string; value: string; type: string }[]; color: string }) {
  if (!cards?.length) return null;
  const styles: Record<string, { bg: string; border: string; labelColor: string }> = {
    info:    { bg: 'rgba(62,95,130,0.06)',  border: 'rgba(62,95,130,0.15)', labelColor: '#3E5F82' },
    accent:  { bg: `${color}08`,             border: `${color}20`,            labelColor: color },
    warning: { bg: 'rgba(138,98,38,0.06)',    border: 'rgba(138,98,38,0.15)',   labelColor: '#8A6226' },
  };
  return (
    <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      {cards.map((card, ci) => {
        const s = styles[card.type] || styles.info;
        return (
          <div key={ci} className="flex-1 min-w-[140px] rounded-xl px-3 py-2.5"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <p className="text-[11px] font-bold mb-0.5" style={{ color: s.labelColor }}>{card.label}</p>
            <p className="text-[11px] text-text-primary leading-snug">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}

/** 접기/펼치기 섹션 카드 — 비테마 주제(재회·결혼·합격·사업·이사)용.
 *  긴 주제 분석 가독성 — 헤더 클릭으로 토글, 첫 섹션만 기본 펼침. */
/**
 * 2026-05-28 — 성별 인지 단어 swap 헬퍼.
 * marriage 결과의 "시댁" / "처가" 용어가 사용자 성별에 따라 자동 전환.
 * - 남성 (male): "시댁" → "처가" (남자는 처가가 처가)
 * - 여성 (female): 그대로 "시댁" 유지
 * - 미상: 양가 관계로 중립 변환
 */
function swapGenderedTerms(text: string | undefined | null, gender?: 'male' | 'female' | null): string {
  if (!text) return '';
  if (gender === 'male') {
    return text
      .replace(/시댁\s*관계/g, '처가 관계')
      .replace(/시댁\s*분위기/g, '처가 분위기')
      .replace(/시댁\s*가족/g, '처가 가족')
      .replace(/시댁\s*어른/g, '처가 어른')
      .replace(/시부모/g, '장인·장모')
      .replace(/시어머니/g, '장모님')
      .replace(/시아버지/g, '장인어른')
      .replace(/시댁/g, '처가');
  }
  if (gender === 'female') {
    return text; // 시댁 그대로
  }
  // 미상 — 중립
  return text
    .replace(/시댁\s*관계/g, '양가 관계')
    .replace(/시댁\s*분위기/g, '양가 분위기')
    .replace(/시댁/g, '배우자 가족');
}

function TopicCollapsibleCard({
  index,
  title,
  color,
  defaultOpen = false,
  children,
}: {
  index: number;
  title: string;
  color: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // 2026-05-28 — 펼칠 때마다 600ms skeleton (user 피드백)
  const [openingSkeleton, setOpeningSkeleton] = useState(false);
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setOpeningSkeleton(true);
      const t = setTimeout(() => setOpeningSkeleton(false), 600);
      prevOpenRef.current = open;
      return () => clearTimeout(t);
    }
    prevOpenRef.current = open;
  }, [open]);
  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
          style={{ background: color }}
        >
          {index}
        </span>
        <p className="text-h3 text-text-primary flex-1 text-left">{title}</p>
        <span
          aria-hidden="true"
          className="flex-shrink-0 text-[13px]"
          style={{
            color,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="mt-3">
          {openingSkeleton ? (
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
          ) : children}
        </div>
      )}
    </div>
  );
}

/** 섹션 본문 — 단락 분리 + 실천 포인트 콜아웃 */
function SectionBody({ content, color }: { content: string; color: string }) {
  // 2026-05-28 — stripMd 제거. sanitizeAiText (strong/b/u/i/em/br 화이트리스트) 로 강조 살림.
  //   user 피드백: "줄글로만 되어있어 강약 X" — AI prompt 가 <strong>/<u> 출력하면 그대로 렌더.
  //   autoEmphasize 후 dangerouslySetInnerHTML 사용 (XSS 안전).
  const paragraphs = String(content || '').split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

  // 한자(괄호 풀이) + 시기 표현 + 숫자/월 표현 자동 강조 (AI 가 <strong> 안 써도 fallback)
  // 2026-05-28 — 자동 강조 패턴 확장 (user 피드백: "볼드 + 색상 강약 조절")
  // 2026-05-28 PM — DailyMockupView 형광펜 패턴 일치화. user 직접 캡쳐 verify 결과:
  //   love/marriage/reunion 등 대부분 페이지에서 <strong> 0건 (pattern 4·5 너무 좁아 AI 텍스트와 매칭 안됨).
  //   career/health 일부만 우연히 매칭. 결과: 줄글로만 보이고 강약조절 X — 사용자 불만의 핵심.
  //   해결: 단락별로 conclusion-sentence 1~2개 강제 highlight + 한자/시기 패턴은 그대로.
  const autoEmphasize = (text: string): string => {
    if (!text) return '';
    // 단락 단위 처리. paragraph = "\n\n" split (단일 paragraph 도 동일 로직 적용).
    return text.split(/(\n\s*\n)/).map(chunk => {
      if (/^\n\s*\n$/.test(chunk)) return chunk;
      return emphasizeParagraph(chunk);
    }).join('');
  };

  // 2026-05-28 PM v2 — user 캡쳐 verify: "정재형(正財型, 안정적이고...)입니다" 같은 conclusion 이
  //   여전히 <strong> 매칭 안 됨. 원인: 기존 pattern 5 가 hanja <b> 변환 후 실행되어 <b> 태그가 [^<>] 차단함.
  //   수정: pattern 5/6/7 (strong) 을 hanja <b> 변환 BEFORE 에 실행 + noun 직후 (xxx) 괄호 허용.
  const emphasizeParagraph = (text: string): string => {
    let t = text;
    // 이미 <strong>/<b>/<u> 있으면 placeholder 보호 (AI 가 직접 출력한 강조 유지)
    const placeholders: string[] = [];
    t = t.replace(/<(strong|b|u|em|i)>[^<]*<\/\1>/g, (m) => {
      placeholders.push(m);
      return `__PH_${placeholders.length - 1}__`;
    });

    // ─── PHASE A0 · <em> 주의·경고 (번트오렌지) — 2026-05-29. 경고는 금색 대신 경고색으로 분리. ───
    //    Daily/Topic/Dream 와 톤 일치. char class 가 <> 차단하므로 이후 strong 패턴이 재포장 X.
    t = t.replace(
      /([가-힣\s,()\d~·一-鿿]{4,40})(주의하세요|주의가 필요합니다|조심하세요|조심해야 합니다|피하세요|삼가세요|멈추세요|위험합니다|불리합니다|불안정합니다)/g,
      '<em>$1$2</em>',
    );

    // ─── PHASE A · <strong> 형광펜 (반드시 hanja <b> 전에 실행) ───
    // 5) 결론·정의 noun-phrase 형광펜 — noun 직후 (한자, 풀이) 괄호 허용.
    //    "정재형(正財型, 안정 수익) 입니다" / "안정형입니다" / "가장 큰 특징입니다" 모두 매칭.
    t = t.replace(
      /([가-힣]{2,15}(?:형|한 사람|사주|시기|자리|구조|결|패턴|흐름|특징|신호|기운|운|타입|본능|의미|핵심|능력|성격|매력|인연|순간|시점|주기|체질|그릇|공간|관계|영역|쪽|유형|기질|구조|상태|모습|문제|장점|단점))((?:\([^)]*\))?)(\s*)(입니다|이에요|예요|돼요|됩니다)/g,
      '<strong>$1$2</strong>$3$4',
    );
    // 6) 핵심 동사·행동 권고 — strong + 직전 phrase 까지 포함
    t = t.replace(
      /([가-힣\s,()\d~·一-鿿]{6,50})(유리합니다|불리합니다|주의하세요|추천합니다|좋습니다|위험합니다|필요합니다|어울립니다|적합합니다|시작하세요|멈추세요|기다리세요|움직이세요|챙기세요|준비하세요|살피세요|이어집니다|풀립니다|열립니다|단단해집니다|약해집니다|강해집니다|쏟아집니다|흔들립니다|있습니다)/g,
      '<strong>$1$2</strong>',
    );
    // 7) Safety net — 단락 80+ chars 이고 <strong> 0개면 마지막 결론 문장에 강제 highlight.
    const strippedForCheck = t.replace(/__PH_\d+__/g, '');
    if (strippedForCheck.length >= 80 && !/<strong>/.test(t)) {
      t = t.replace(
        /([가-힣\s,()\d~·一-鿿]{6,40})(있어요|돼요|만듭니다|만들어요|보입니다|드러납니다|시작됩니다|마무리됩니다)(\s*[.!?]?\s*)$/,
        '<strong>$1$2</strong>$3',
      );
    }

    // ─── PHASE B · <b> 한자 (strong 내부에서도 작동) ───
    // 1) 한자(괄호 풀이) — 검은 볼드. "정재(正財, 안정 수익)" / "병화(丙火)" / "일지 자(子, 물의 자리)"
    t = t.replace(/([가-힣]+)\(([一-鿿]+)([^)]*)\)/g, '<b>$1($2$3)</b>');

    // ─── PHASE C · <u> 시기·숫자·색·방위 ───
    // 2) 시기·기간 — 황금 밑줄
    t = t.replace(/(\d{1,2}월(?:\s*~\s*\d{1,2}월)?|\d{1,2}~\d{1,2}월|\d{1,2}월부터\s*\d{1,2}월|\d{2,3}대(?:\s*[초중후반]+)?|올해\s*[봄여름가을겨울]|올해 \d{1,2}월|상반기|하반기|연말|연초|장기적|단기적|중장기|초중반|중후반|오전\s*\d{1,2}시?(?:~\d{1,2}시?)?|오후\s*\d{1,2}시?(?:~\d{1,2}시?)?|새벽|아침|점심|저녁|밤)/g, '<u>$1</u>');
    // 3) 백분율·점수·횟수
    t = t.replace(/(\d+(?:\.\d+)?%|\d+점|\d+회|\d+개월|\d+\s*개|\d+년)/g, '<u>$1</u>');
    // 4) 색·방위
    t = t.replace(/(노란색|빨간색|파란색|초록색|검은색|흰색|황금색|남색|보라색|핑크색|회색|동쪽|서쪽|남쪽|북쪽|동남쪽|동북쪽|서남쪽|서북쪽)/g, '<u>$1</u>');

    // placeholder 복원
    t = t.replace(/__PH_(\d+)__/g, (_, i) => placeholders[+i] || '');
    return t;
  };

  if (paragraphs.length <= 1) {
    return (
      <p
        className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line topic-section-body"
        dangerouslySetInnerHTML={{ __html: sanitizeAiText(autoEmphasize(content || '')) }}
      />
    );
  }

  const lastP = paragraphs[paragraphs.length - 1];
  const isAdvice = /하세요|해보세요|추천합니다|좋습니다|실천|시작하세요|도전하세요|시도하세요|활용하세요|기억하세요/.test(stripMd(lastP));

  return (
    <div className="space-y-3 topic-section-body">
      {paragraphs.map((p, pi) => {
        const isLast = pi === paragraphs.length - 1;
        const emphasized = autoEmphasize(p);
        if (isLast && isAdvice) {
          return (
            <div key={pi} className="rounded-xl py-2.5 px-3.5 mt-0.5"
              style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
              <p className="text-[11px] font-bold mb-1" style={{ color }}>실천 포인트</p>
              <p
                className="text-body-sm text-text-primary leading-relaxed whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: sanitizeAiText(emphasized) }}
              />
            </div>
          );
        }
        if (pi === 0) {
          return (
            <p
              key={pi}
              className="text-[13px] text-text-primary leading-relaxed whitespace-pre-line font-medium"
              dangerouslySetInnerHTML={{ __html: sanitizeAiText(emphasized) }}
            />
          );
        }
        return (
          <p
            key={pi}
            className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line"
            dangerouslySetInnerHTML={{ __html: sanitizeAiText(emphasized) }}
          />
        );
      })}
    </div>
  );
}


/* ════════════════════════════════════════════════
   메인 페이지 컴포넌트
   ════════════════════════════════════════════════ */

/** 2026-10-04 — '지금 상황 한 줄' 예시 (주제별) */
const CONCERN_PLACEHOLDER: Record<string, string> = {
  love: '예: 3년째 솔로인데 올해 안에 인연이 있을지 궁금해요',
  reunion: '예: 7월에 제가 먼저 헤어지자고 했고, 지금은 연락이 끊겼어요',
  marriage: '예: 2년 만난 사람과 결혼 얘기가 오가는데 확신이 안 서요',
  wealth: '예: 적금만 하다가 투자를 시작해볼까 고민 중이에요',
  exam: '예: 회사 3년차인데 이직을 준비하고 있어요',
  business: '예: 퇴사하고 작은 가게 창업을 준비하고 있어요',
  health: '예: 요즘 잠을 잘 못 자고 쉽게 피곤해요',
  move: '예: 내년 초 전세 만기라 이사 갈 곳을 고민 중이에요',
  study: '예: 자격증 공부를 하는데 집중이 잘 안 돼요',
  career: '예: 지금 일이 저와 맞는지, 계속해도 될지 고민이에요',
};
export function TopicAnalysisPage() {
  const { topicId: rawTopicId } = useParams<{ topicId: string }>();
  // SSOT v1 정렬 (2026-04-22): legacy URL ('/topic/moving') 을 canonical ('move') 로 정규화.
  // 잘못된 id 는 null 반환 — 이 경우 'love' 로 폴백 (구 기본값 유지).
  const topicId = (normalizeTopicId(rawTopicId) || rawTopicId || 'love') as string;
  const topic = TOPICS[(topicId || 'love') as TopicKey];
  const navigate = useNavigate();
  const location = useLocation();
  // toast 제거 — F5 (AI 실패 inline error 카드) 로 대체. 향후 다른 알림 필요 시 useToast 재추가.
  usePageTitle(topic?.label || '심층분석');
  useSeoMeta({
    description: `${topic?.label || '주제별'} 사주 심층 분석 — 정통 명리학으로 풀어내는 나의 ${topic?.label || '운세'}. 사주500 주제별 분석.`,
  });

  // 보관함에서 저장된 결과 또는 사주리포트에서 baseScore를 넘겨받은 경우
  // 2026-09-17 — profileId: 다른 화면(종합사주 추천·오늘의운세·월간·꿈해몽·다른 주제)이 넘겨준 대상 프로필
  const rawNavState = location.state as { savedResult?: any; savedReport?: LocalReport; baseScore?: number; profileId?: string } | undefined;
  // 2026-05-28 — URL ?reportId= 폴백. state 손실(새로고침/strict mode) 대비.
  const [searchParams] = useSearchParams();
  const reportIdFromUrl = searchParams.get('reportId');
  const reportFromUrl = useMemo(() => {
    if (!reportIdFromUrl) return null;
    try { return getReport(reportIdFromUrl); } catch { return null; }
  }, [reportIdFromUrl]);
  const navState = rawNavState?.savedReport
    ? rawNavState
    : (reportFromUrl ? { savedResult: reportFromUrl.aiResult, savedReport: reportFromUrl } : undefined);

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  // 2026-09-17 — state.profileId 로 들어오면 해당 프로필 미리 선택 (존재할 때만 · 보관함/URL 복원이 우선).
  //   lazy 초기값이라 첫 렌더부터 선택 상태 → 캐시 자동로드·서버 복구 effect 가 바로 동작. 단일 프로필 자동선택과 공존.
  const [selected, setSelected] = useState<LocalReport | null>(() => {
    if (navState?.savedReport) return navState.savedReport;
    const pid = rawNavState?.profileId;
    if (!pid) return null;
    try {
      const found = getProfiles().find((p) => p.id === pid);
      return found ? (found as unknown as LocalReport) : null;
    } catch { return null; }
  });
  const [result, setResult] = useState<any>(navState?.savedResult || null);
  // 2026-10-09 — 서버가 먼저 보낸 상황별 섹션 제목 (로딩 스켈레톤 제목 = 실제 제목)
  const [serverTitles, setServerTitles] = useState<string[] | null>(null);
  // 생성이 끝났는지 (NEXT 카드는 다 쓴 뒤에만 — 반쯤 쓰인 문장이 보이지 않게)
  const [streaming, setStreaming] = useState(false);
  const streamComplete = !streaming;
  // 2026-09-17 B-1 — 이번 화면에서 저장 완료된 결과 리포트 id (URL ?reportId= 기록용 · 완성본만)
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [, setLoadingMsg] = useState(0);
  // 더블클릭 가드 — 1운 중복 차감 차단 (InputPage 패턴)
  const isAnalyzingRef = useRef(false);
  // 2026-10-04 — 늦게 도착한 완성본·비동기 복구가 다른 시도/다른 주제/선택 화면을 덮지 않게: 시도 번호 + 현재 phase 미러.
  //   주제 변경·언마운트 시 번호를 올려 진행 중이던 시도의 화면 갱신을 끊는다 (저장·승격은 계속 진행).
  const attemptSeqRef = useRef(0);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  useEffect(() => () => { attemptSeqRef.current++; }, [topicId]);
  // F3 · 상대방 입력 명시 펼침 (sessionStorage 복원에 사용)
  const [, setPartnerExpanded] = useState(false);
  // 2026-05-28 — 결과 페이지 진입 시 skeleton → 본문 교체 (user 피드백 "스켈레톤 활용").
  //   phase='result' 진입 + 1200ms 후 contentReady=true → TopicSection isLoading={false}.
  //   sections heading 은 즉시 노출, body 만 shimmer skeleton.
  //   1200ms 로 늘림 (600ms 너무 짧아 user 가 못 본다고 피드백).
  const { mark: markAttendance } = useAttendanceOnResult();
  const [contentReady, setContentReady] = useState(false);
  useEffect(() => {
    if (phase !== 'result') {
      setContentReady(false);
      return;
    }
    const timer = setTimeout(() => setContentReady(true), 1200);
    // 2026-05-29 — 출시 프로모션(50원): 첫 콘텐츠 결과 도달 시 자동 지급 (무료/유료 무관).
    //   grantPromotion 이 코드 단위 localStorage dedupe → 어느 콘텐츠든 첫 1회만 실제 지급. 앱인토스 only.
    import('@/services/toss/tossPromotion').then(m => m.grantLaunchPromotion());
      // 2026-06-02 — 출석 적립 + 일일/연속 보상 자동 지급 (콘텐츠 이용 시, 클라 잔액 적립)
      import('@/services/storage/dailyReward').then(m => m.processAttendanceRewards());
      // LIVE BEST 조회 기록 (24h 디듀프) — 주제 canonical id
      import('@/services/liveBest').then(m => m.recordTopicView(topicId)).catch(() => {});
    // 2026-05-29 — 출석 이벤트(3일 연속·이번주) 마킹. 주제분석 결과도 출석 인정 (기존 누락 fix).
    //   서버가 KST 당일 1회 idempotent + 세션 dedupe → 중복 안전.
    markAttendance().catch(() => {/* non-blocking */});
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  // audit 3 P0 E1·E2·F5 — 결제 confirm Modal / 잔액 부족 inline / AI 실패 inline
  const [showConfirm, setShowConfirm] = useState(false);
  const [showInsufficient, setShowInsufficient] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const balance = getBalance();
  // E2 · sessionStorage 키 (충전 후 복귀 시 입력값 복원)
  const PENDING_KEY = `saju500:topic_pending:${topicId}`;

  // 재회운/결혼운 상대방 정보
  const [partnerInfo, setPartnerInfo] = useState({
    name: '', birthYear: 1995, birthMonth: 1, birthDay: 1, gender: 'male',
    breakupYear: new Date().getFullYear(), breakupMonth: 1,
    birthHour: -1, // -1 = 미상 (시계 시각 그대로 — 진태양시 보정은 서버 computePartnerPillars)
    birthMinute: 0, // 2026-07 — 분 단위 입력 (본인 입력과 통일, 3:30 경계 자동 판정)
  });
  const [showPartner, setShowPartner] = useState(false);
  // 2026-05-07 — partner 시간 선택 sheet (네이티브 select → bottom sheet 통일)
  const [hourSheetOpen, setHourSheetOpen] = useState(false);
  // 결혼운/연애운: 연애 상태
  const [relationStatus, setRelationStatus] = useState<'solo' | 'dating'>('solo');
  // 연애운: 솔로/썸/연애중
  const [loveStatus, setLoveStatus] = useState<'solo' | 'some' | 'dating'>('solo');
  // 사업운/취업운/이사운/학업운/합격이직운: 추가 상태 정보
  // 2026-10-04 — '지금 상황 한 줄' (전 주제 · 선택). 꿈해몽의 '요즘 떠나지 않는 생각' 칸처럼, 적은 상황에 맞춰 풀이.
  const [concern, setConcern] = useState('');
  const [extraInfo, setExtraInfo] = useState({
    // 사업운
    bizStatus: '' as '' | 'preparing' | 'running',
    bizOpenYear: new Date().getFullYear(),
    bizOpenMonth: 1,
    // 취업·이직운
    jobStatus: '' as '' | 'student' | 'jobseeking' | 'employed',
    targetField: '',
    // 이사·이동운
    movePurpose: '' as '' | 'house' | 'job' | 'study' | 'abroad',
    movePlanYear: new Date().getFullYear(),
    movePlanMonth: 6,
    // 학업·시험운
    examName: '',
    examYear: new Date().getFullYear(),
    examMonth: 6,
    // 2026-05-28 — 합격·이직운(exam) 입력 분기 신설 (이전엔 UI 폼 부재)
    changeType: '' as '' | 'exam' | 'jobchange' | 'career_pivot',
    // 연애운: 솔로/썸/연애중 명시 (이전엔 loveStatus 만)
    loveStatus: '' as '' | 'solo' | 'some' | 'dating',
  });

  // 프로필 목록 (독립 저장소)
  const profiles = useMemo(() => getProfiles(), []);

  // 이미 분석한 결과가 있는지 확인 (재회운은 상대방이 다를 수 있으므로 auto-load 하지 않음)
  const existingResult = useMemo(() => {
    if (!selected || !topicId) return null;
    if (navState?.savedResult) return null;
    if (topicId === 'reunion' || topicId === 'marriage' || topicId === 'love') return null; // 상대방 정보가 다를 수 있으므로 항상 입력 폼 표시
    const key = `topic_${topicId}_${selected.id}`;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      // 2026-07-03 P0 — partial 박제 캐시는 자동 로드하지 않음 (없는 셈 → 아래 recover 가 서버 완성본으로 치유)
      if (parsed?.__partial) return null;
      return parsed;
    } catch { return null; }
  }, [selected, topicId]);

  useEffect(() => {
    if (existingResult) {
      setResult(existingResult);
      setPhase('result');
    }
  }, [existingResult]);

  // 2026-06-18 퍼널 정확성 — 토픽 결과 도달 시 content_result 발사 (기존엔 /result 경로만 자동발사돼
  //   토픽/꿈/오늘운세 완료가 '결과도달' 퍼널에서 누락됐음). 결과당 1회.
  const resultTrackedRef = useRef(false);
  useEffect(() => {
    if (phase === 'result' && topicId && !resultTrackedRef.current) {
      resultTrackedRef.current = true;
      import('@/services/analytics').then((a) => a.trackEvent('content_result', { type: 'topic' })).catch(() => {});
    }
  }, [phase, topicId]);

  // 2026-06-17 — 생성 중 앱 종료로 결과를 못 받은 경우(미해결 pending 차감 有), 서버에 저장된
  //   결과를 끌어와 복원 (재구매 0). pending 이 있을 때만 발동 → 의도적 보관함 삭제(pending 無)와 구분.
  // 🚨 2026-10-04 재작성 — 기존 자가치유가 실측상 대부분 안 먹던 이유와 수정 (보관함 반쪽 14건 중 10건 미치유):
  //   ① 서버 '최신 1건 · 1시간 창' 만 봐서 1시간 뒤 재방문은 영영 미치유
  //      → restoreLibrary(창 없음·생성 시각 포함) 후보 중 본문 지문이 '같은 생성' 인 완성본만 채택
  //   ② 반쪽을 지우고 서버 id 로 새로 저장 → 서버 미러에 반쪽이 남아 복원 때 되살아남
  //      → 같은 레코드 id 를 유지한 채 본문만 교체 (재차감 0 · 보관함 중복 0 · 미러도 덮어씀)
  //   ③ 최신 1건을 무검증 채택 → 연달아 돌린 다른 시도(다른 상대방) 결과로 덮일 위험 → 지문 검증
  //   이 화면(주제·프로필)의 최근 1시간 치유본만 바로 띄우고, 그 외는 보관함만 조용히 치유한다.
  const recoverKeyRef = useRef<string>('');
  useEffect(() => {
    if (!topicId || !selected || phase === 'result' || result) return;
    const key = `${topicId}:${selected.id}`;
    if (recoverKeyRef.current === key) return;
    recoverKeyRef.current = key;
    const profile = selected;
    // 비동기 도중 사용자가 분석을 시작했으면 화면을 가로채지 않는다
    const canShow = () => phaseRef.current === 'select' && !isAnalyzingRef.current;
    (async () => {
      try {
        // 1) 반쪽(__partial) 저장본 → 서버 완성본으로 승격
        const healed = await topicHeal.healPartialTopicReports();
        const mine = healed
          .filter((r) => r.aiResult?.topicId === topicId && r.profileId === profile.id
            && Date.now() - new Date(r.createdAt).getTime() < 60 * 60 * 1000)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (mine) {
          if (canShow()) { setResult(mine.aiResult); setPhase('result'); setSavedReportId(mine.id); }
          return;
        }
        // 2) 반쪽조차 못 남기고 앱이 닫힌 경우 (pending 만 남음) → 서버 완성본을 새 기록으로
        const rec = await topicHeal.recoverPendingTopic({ topicId, profile, newId: generateId });
        if (rec && canShow()) { setResult(rec.aiResult); setPhase('result'); setSavedReportId(rec.id); }
      } catch { /* noop — 실패해도 기존 흐름(재구매/자동환불) 유지 */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, selected, phase, result]);

  // 🚨 2026-10-04 — 보관함에서 반쪽(__partial) 기록을 열면 그 자리에서 서버 완성본으로 승격 (같은 id).
  //   기존: phase='result' 로 진입해 위 복구 effect 가 아예 돌지 않음 → 반쪽이 영구 노출됐다.
  const storageHealRef = useRef<string>('');
  useEffect(() => {
    const rep = navState?.savedReport;
    if (!rep?.id || !(rep.aiResult as any)?.__partial || storageHealRef.current === rep.id) return;
    storageHealRef.current = rep.id;
    (async () => {
      const [healed] = await topicHeal.healPartialTopicReports({ onlyIds: [rep.id], force: true });
      if (!healed || phaseRef.current !== 'result' || isAnalyzingRef.current) return;
      setResult(healed.aiResult);
      // 히스토리의 반쪽도 교체 — 뒤로/앞으로·새로고침 재방문 시 반쪽이 다시 뜨지 않게 (실제 주소가 이 화면일 때만).
      //   반쪽이 '이미 따로 있던 완성본' 으로 대체(정리)된 경우 id 가 바뀌므로 ?reportId= 도 갱신.
      if (typeof window !== 'undefined' && window.location.pathname === location.pathname) {
        const qs = new URLSearchParams(location.search);
        if (qs.has('reportId')) qs.set('reportId', healed.id);
        const search = qs.toString() ? `?${qs.toString()}` : '';
        navigate(`${location.pathname}${search}`, {
          replace: true,
          state: rawNavState?.savedReport
            ? { ...rawNavState, savedResult: healed.aiResult, savedReport: healed }
            : location.state,
        });
      }
    })().catch(() => { /* noop — 실패 시 반쪽 그대로 (다음 진입/부팅에서 재시도) */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navState?.savedReport?.id]);

  /* 🚨 2026-09-17 B-1 — 주제 결과 → 다른 주제 → 뒤로가기 시 결과가 사라지던 버그.
   *   원인: 결과가 URL/히스토리 어디에도 없음 + 연애·재회·결혼은 캐시 자동로드 차단(상대방별 결과라 의도).
   *   수정: 결과 화면이면 현재 히스토리 항목을 교체 기록 — 완성 저장본은 ?reportId=(reportFromUrl 복원 경로),
   *   그 외(캐시 로드 등)는 state.profileId(재진입 시 프로필 미리 선택 → 캐시 자동로드).
   *   effect 라 마운트 중에만 실행 → 스트리밍 도중 다른 화면으로 떠나도 남의 히스토리 항목을 덮지 않고,
   *   analyze() 의 저장·pending 해제 흐름은 그대로 끝까지 진행된다.
   *   __partial 박제본은 reportId 기록 X (URL 복원되면 recoverTopicResult 자가치유가 막힘). */
  useEffect(() => {
    if (phase !== 'result' || !selected) return;
    if (rawNavState?.savedReport) return; // 보관함 진입 — 히스토리 state 에 이미 결과 보존
    const pid = (selected as any).profileId || selected.id;
    const wantReportId = savedReportId || reportIdFromUrl;
    const curState: Record<string, any> =
      location.state && typeof location.state === 'object' ? (location.state as Record<string, any>) : {};
    if (curState.profileId === pid && (!wantReportId || reportIdFromUrl === wantReportId)) return;
    // 페이지 전환 애니메이션(App.tsx AnimatePresence mode="wait", ~250ms) 동안 떠나는 이 페이지가 아직 살아 있어,
    //   그 사이 저장이 끝나면 replace 가 **다음 페이지의 히스토리 항목**을 덮어써 이전 주제로 되돌려진다.
    //   실제 주소가 아직 이 페이지일 때만 기록한다.
    if (typeof window !== 'undefined' && window.location.pathname !== location.pathname) return;
    // 기존 쿼리(from= 등)는 보존하고 reportId 만 set
    const qs = new URLSearchParams(location.search);
    if (wantReportId) qs.set('reportId', wantReportId);
    const search = qs.toString() ? `?${qs.toString()}` : '';
    navigate(`${location.pathname}${search}`, { replace: true, state: { ...curState, profileId: pid } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selected, savedReportId]);

  // 단일 프로필이면 자동 선택
  useEffect(() => {
    if (profiles.length === 1 && !selected) {
      setSelected(profiles[0] as unknown as LocalReport);
    }
  }, [profiles, selected]);

  // E2 · 충전 후 복귀 시 sessionStorage 에서 입력값 복원
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.partnerInfo) setPartnerInfo(data.partnerInfo);
      if (data?.loveStatus) setLoveStatus(data.loveStatus);
      if (data?.relationStatus) setRelationStatus(data.relationStatus);
      if (data?.showPartner !== undefined) setShowPartner(data.showPartner);
      if (data?.partnerExpanded !== undefined) setPartnerExpanded(data.partnerExpanded);
      if (data?.extraInfo) setExtraInfo(data.extraInfo);
      if (typeof data?.concern === 'string') setConcern(data.concern);
      if (data?.selectedId) {
        const found = profiles.find((p) => p.id === data.selectedId);
        if (found) setSelected(found as unknown as LocalReport);
      }
      sessionStorage.removeItem(PENDING_KEY);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  if (!topic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-page">
        <div className="text-center space-y-4">
          <p className="text-h2 text-text-primary">알 수 없는 주제예요</p>
          <Button onClick={() => navigate('/')}>홈으로</Button>
        </div>
      </div>
    );
  }

  // E1 · 결제 직전 confirm — 1운 무방비 차감 방지
  function requestAnalyze() {
    if (!selected) return;
    if (isAnalyzingRef.current || phase === 'loading') return;
    setAnalyzeError(null);
    setShowConfirm(true);
  }

  async function analyze() {
    if (!selected) return;
    // 더블클릭 가드 — 1운 중복 차감 차단
    if (isAnalyzingRef.current || phase === 'loading') return;
    isAnalyzingRef.current = true;
    setShowConfirm(false);

    // 2026-05-28 PM — TOPIC_PRICING SSOT 사용 (재회운=세일 1운, 정가 3운).
    const pricing = getTopicPrice(topicId as TopicKey);
    const actualPrice = pricing.isOnSale && pricing.salePrice != null ? pricing.salePrice : pricing.regularPrice;

    // 측정 — 분석 시작 확정 (fire-and-forget · UX 영향 0)
    import('@/services/analytics').then((a) => a.trackEvent('topic_select', { topic: topicId! })).catch(() => {});

    // E2 · 잔액 부족 시 입력값 보존 + inline 모달 (toast 만 X · 강제 navigate X)
    if (!spendBalance(actualPrice)) {
      // 2026-06-18 — 잔액부족 = 충전 유도 직전(전환 모멘트) 트래킹
      import('@/services/analytics').then((a) => a.trackEvent('insufficient_balance', { type: `topic:${topicId}`, needed: actualPrice })).catch(() => {});
      // 입력값 sessionStorage 보존
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({
          partnerInfo, loveStatus, relationStatus, showPartner, extraInfo, concern,
          selectedId: selected.id,
        }));
      } catch { /* noop */ }
      setShowInsufficient(true);
      isAnalyzingRef.current = false;
      return;
    }

    // 측정 — 운 차감 성공 직후 (C1 · fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'topic', amount: actualPrice, topic: topicId! })).catch(() => {});

    // P0 CS fix (2026-06-11) — 생성 중 앱 종료 시 운 소실 방지: pending 마킹.
    //   결과 저장 성공 시 clear / 에러 시 즉시 환불 / 앱 종료 시 재접속 부팅에서 자동 환불.
    const { markPendingSpend, clearPendingSpend } = await import('@/services/storage/localStore');
    const pendingId = markPendingSpend(`topic:${topicId}`, actualPrice);
    // 2026-10-04 — 이 시도가 진행 중임을 표시(재진입 복구가 가로채지 않게) + 시도 번호(늦은 완성본이 다른 화면을 덮지 않게)
    topicHeal.markTopicInFlight(pendingId);
    const attemptSeq = ++attemptSeqRef.current;

    setPhase('loading');
    const interval = setInterval(() => setLoadingMsg(s => Math.min(s + 1, LOADING_MSGS.length - 1)), 3000);

    try {
      // 재회운/결혼운(기혼)/연애운(썸·연애중)이고 상대방 정보가 있으면 전달
      const needsPartner = (topicId === 'reunion' && showPartner && partnerInfo.name)
        || (topicId === 'marriage' && relationStatus === 'dating' && partnerInfo.name)
        || (topicId === 'love' && loveStatus !== 'solo' && partnerInfo.name);
      const partner = needsPartner
        ? {
            ...partnerInfo,
            birthHour: partnerInfo.birthHour >= 0 ? partnerInfo.birthHour : undefined,
            // 2026-07 — 분 단위 (서버 computePartnerPillars 가 진태양시 보정에 사용)
            birthMinute: partnerInfo.birthHour >= 0 ? (partnerInfo.birthMinute ?? 0) : undefined,
          } : undefined;

      // 주제별 추가 정보 (사업운/취업운/이사운/학업운/연애운)
      const loveExtra = topicId === 'love' ? { loveStatus } : {};
      /* 🚨 2026-09-15 — 결혼운 기혼 오분류 fix.
       *   기존: relationStatus('solo'=미혼 / 'dating'=기혼)가 서버로 전송되지 않고,
       *   서버는 partnerInfo 유무로만 상태를 역추론 → 배우자 생년월일을 안 넣은 기혼자가
       *   '솔로'로 처리돼 '결혼 적기 분석'을 받았다. 상태 자체를 명시 전송한다. */
      const marriageExtra = topicId === 'marriage' ? { relationStatus } : {};
      // SSOT canonical: 'move' (legacy 'moving' 는 normalizeTopicId 로 이미 정규화됨)
      // 🚨 2026-09-15 fix — 'exam' 누락으로 합격·이직운 전용 입력(changeType/시험명/예정시기)이
      //   submit 에서 통째로 버려져 서버 exam 분기가 실행 0회 데드코드였음.
      //   증상: 첫 취업 준비생인데 '이직' 관점 결과가 나옴. whitelist 에 exam 추가로 경로 복구.
      const topicExtra = (() => {
        if (!['business', 'career', 'move', 'study', 'exam'].includes(topicId!)) return {};
        const e: Record<string, any> = Object.fromEntries(
          Object.entries(extraInfo).filter(([, v]) => v !== '' && v != null));
        /* 🚨 2026-09-15 — 유령 예정일 제거.
         *   날짜 필드는 숫자 기본값(올해/6월/1월)이라 사용자가 '(선택)'을 건드리지 않아도
         *   필터를 통과해 항상 전송됐고, 서버는 그걸 '사용자가 지정한 예정 시기'로 읽어
         *   고르지도 않은 날짜로 분석했다. 동반 필드가 비면 그 날짜는 미지정으로 간주한다. */
        if (!extraInfo.bizStatus) { delete e.bizOpenYear; delete e.bizOpenMonth; }
        if (!extraInfo.movePurpose) { delete e.movePlanYear; delete e.movePlanMonth; }
        if (!extraInfo.examName && !extraInfo.changeType) { delete e.examYear; delete e.examMonth; }
        return e;
      })();
      const concernExtra = concern.trim() ? { userConcern: concern.trim().slice(0, 200) } : {};
      const extra = { ...topicExtra, ...loveExtra, ...marriageExtra, ...concernExtra };
      const finalExtra = Object.keys(extra).length > 0 ? extra : undefined;
      // 2026-10-04 — pending ↔ 대상 프로필·상대방 장부 (앱 종료 후 복구가 엉뚱한 프로필/상대방에 붙지 않게)
      topicHeal.recordTopicAttempt(pendingId, { topicId: topicId!, profileId: selected.id, partnerName: partner?.name || undefined });

      // ── 스트리밍 우선 (오늘의 운세 패턴 · 점진 스켈레톤) → 실패 시 callable 폴백 ──
      // 프롬프트·모델·출력은 callable 과 100% 동일 (전송만 SSE). partial 은 adaptToTopicResultV2
      // 가 전부 ?.||fallback 방어라 안전. 첫 minimal key 도달 시 phase='result' 전이.
      let res: { reportId: string; content: any };
      // 2026-10-04 — 마감 뒤 같은 연결로 늦게 도착한 완성본 (반쪽 저장 후 같은 레코드로 승격 — 아래 저장부에서 apply 연결)
      const late: { content: any; reportId: string; apply: null | ((content: any, reportId: string) => void) } =
        { content: null, reportId: '', apply: null };
      // C2 — 타임아웃 시 저장용 최신 partial (2026-10-04: 폴백 전 서버 완성본 대조 지문으로도 사용 → try 밖으로)
      let latestPartial: any = null;
      const sse: { started: boolean; errKind: TopicStreamErrorKind | null } = { started: false, errKind: null };
      let t0 = Date.now();
      try {
        const { generateTopicAnalysisStream } = await import('@/services/ai/reportGenerator');
        let phaseShown = false;
        t0 = Date.now();
        let lastActivity = t0;
        setServerTitles(null);
        setStreaming(true);
        // ⭐ 2026-05-27 v2 — 첫 paint 조건은 substantive content 도착 시점에만 (title 단독 X)
        res = await new Promise<{ reportId: string; content: any }>((resolve, reject) => {
          // 2026-07-03 P0 fix (CS "연애운 풀이가 나오지 않아요") — 기존 60s 단일 타임아웃의 3중 결함:
          //   ① 정상 생성이 60-90s 인데 60s 에 마감 → 부분(partial) 결과가 '완성본'처럼 저장·박제
          //   ② 그 경로가 pending 까지 해제 → 서버 완성본 복구(recoverTopicResult, pending 필요) 영구 차단
          //   ③ 첫 paint 시 타이머 해제 → 이후 스트림 끊기면 영구 hang (C2 가 잡았던 증상 부분 재발)
          //   수정: [화면 공개 60s]와 [데이터 마감] 분리. partial 박제는 최후수단 + __partial 마킹
          //   (pending 유지 → 재진입 시 서버 완성본으로 자가 치유).
          // 🚨 2026-10-04 — 150s 고정 마감이 재회운(실측 ~222s · 출력 13.6~14.7K 토큰)을 매번 반쪽으로 잘랐다
          //   (보관함 박제 14건 중 11건이 재회운). 서버는 그 61~94초 뒤 완성본을 저장하고 같은 연결로 done 까지
          //   보냈지만, 이미 resolve 된 Promise 라 클라가 버렸다. 수정:
          //   ① 마감 = 재회운 300s / 그 외 150s (topicStreamDeadlineMs)
          //   ② 마감 시점에 20s 안에 청크가 들어왔으면 '진행 중' → 끊지 않고 연장 (절대 상한 600s)
          //   ③ 그래도 반쪽으로 끝냈으면 늦게 온 done 을 버리지 않고 같은 레코드로 승격 (late)
          let settled = false; // 완료·실패·마감(반쪽) 중 하나로 이미 끝냈는가
          const paintTimeoutId = setTimeout(() => {
            if (!phaseShown) {
              phaseShown = true;
              console.warn('[topic] 60s — 화면 부분 공개 (생성은 마감까지 계속 대기)');
              setPhase('result');
            }
          }, 60_000);
          let safetyTimeoutId: ReturnType<typeof setTimeout> | undefined;
          const onDeadline = () => {
            const now = Date.now();
            if (now - lastActivity < topicHeal.TOPIC_STREAM_IDLE_MS && now - t0 < topicHeal.TOPIC_STREAM_ABSOLUTE_CAP_MS) {
              safetyTimeoutId = setTimeout(onDeadline, 5_000); // 청크가 들어오는 중 — 마감으로 끊지 않음
              return;
            }
            settled = true;
            if (!phaseShown) { phaseShown = true; setPhase('result'); }
            if (latestPartial) {
              console.warn(`[topic] ${Math.round((now - t0) / 1000)}s 마감 — partial 저장 (__partial 마킹 · pending 유지 · 늦은 완성본 승격 대기)`);
              resolve({ reportId: '', content: { ...latestPartial, __partial: true } });
            } else reject(new Error('topic stream timeout'));
          };
          safetyTimeoutId = setTimeout(onDeadline, topicHeal.topicStreamDeadlineMs(topicId!));
          const clearTimers = () => { clearTimeout(paintTimeoutId); if (safetyTimeoutId) clearTimeout(safetyTimeoutId); };
          generateTopicAnalysisStream(
            { topicId: topicId!, sajuData: selected.sajuData, baseScore: navState?.baseScore, partnerInfo: partner, extraInfo: finalExtra },
            {
              onStart: () => { sse.started = true; lastActivity = Date.now(); console.log('[topic SSE] start'); },
              onOutline: (headings) => { if (attemptSeqRef.current === attemptSeq && headings.length > 0) setServerTitles(headings); },
              onProgress: () => { lastActivity = Date.now(); },
              // 오늘의 운세 패턴 — 첫 partial 도착 시 result phase 전이 + 점진 렌더.
              //   방어 가드 (꿈해몽 회귀 학습): 불완전한 섹션(heading/content 미생성) 은
              //   렌더링에서 필터링 → 렌더 컴포넌트가 undefined 만나서 깨질 위험 0.
              //   첫 섹션 도착 시 phase='result' 전이 → 사용자는 위에서부터 읽으며
              //   뒷 섹션은 스트리밍으로 채워짐 (오늘의 운세 동일 UX).
              onPartial: ({ partial, totalChars }) => {
                try {
                  if (settled) return; // 마감 후 — 화면·저장본은 늦은 완성본 승격이 교체
                  if (!partial || typeof partial !== 'object') return;
                  const safe = {
                    ...partial,
                    sections: Array.isArray(partial.sections)
                      ? partial.sections.filter((s: any) => s && typeof s.heading === 'string' && s.heading && typeof s.content === 'string' && s.content)
                      : undefined,
                    timeline: Array.isArray(partial.timeline)
                      ? partial.timeline.filter((t: any) => t && t.period && t.description)
                      : undefined,
                  };
                  latestPartial = safe; // C2 — 타임아웃 시 저장용 최신 partial 보존
                  // 2026-10-04 — 다른 시도/다른 주제 화면이면 화면은 건드리지 않음 (데이터만 계속 보존)
                  if (attemptSeqRef.current !== attemptSeq) return;
                  setResult(safe);
                  // ⭐ 2026-05-27 v2 — substantive content 도착 시점에만 phase 전이.
                  //   첫 섹션이 heading+content 둘 다 채워졌거나 oneLineSummary 100자+
                  const oneLineLen = typeof safe.oneLineSummary === 'string' ? safe.oneLineSummary.length : 0;
                  const firstSecOk = Array.isArray(safe.sections) && safe.sections.length >= 1
                    && typeof safe.sections[0]?.content === 'string' && safe.sections[0].content.length >= 100;
                  const hasMinKeys = oneLineLen >= 100 || firstSecOk;
                  if (!phaseShown && hasMinKeys) {
                    phaseShown = true;
                    clearTimeout(paintTimeoutId); // ⚠️ paint 타이머만 해제 — 마감 타이머는 onDone 까지 유지 (hang 차단)
                    console.log(`[topic] 첫 paint (${Date.now() - t0}ms, ${totalChars}자)`);
                    setPhase('result');
                  }
                } catch (err) { console.warn('[topic onPartial guard]', err); }
              },
              onDone: ({ reportId, content }) => {
                clearTimers();
                if (settled) {
                  // 2026-10-04 — 마감 뒤 도착한 완성본: 버리지 않고 반쪽 레코드를 같은 id 로 승격
                  console.log(`[topic SSE] late done (${Date.now() - t0}ms) — 반쪽 승격`);
                  if (late.apply) late.apply(content, reportId);
                  else { late.content = content; late.reportId = reportId; }
                  return;
                }
                settled = true;
                console.log(`[topic SSE] done (${Date.now() - t0}ms)`);
                resolve({ reportId, content });
              },
              onError: (msg, info) => {
                clearTimers();
                if (settled) return; // 반쪽 저장 후 연결 종료 — 후속 재시도(scheduleTopicHealRetries)가 처리
                settled = true;
                sse.errKind = info?.kind ?? 'network';
                reject(new Error(msg));
              },
            },
          ).catch((e) => {
            clearTimers();
            if (!settled) { settled = true; sse.errKind = 'network'; reject(e); }
          });
        });
      } catch (streamErr: any) {
        console.warn('[topic] SSE 실패:', streamErr?.message, sse.errKind);
        // 🚨 2026-10-04 이중 생성 방지 — 연결만 끊긴 경우(iOS 'Load failed' 등) 서버 스트림은 끝까지 돌아
        //   완성본을 저장한다 (실측: 같은 uid·주제·입력 완성본 2건이 47~153초 간격 = 스트림 + callable 폴백 둘 다 완주).
        //   바로 callable 을 부르면 같은 결과를 또 생성(토큰 2배 · 서버 차감 2회)하고 재회운은 ~222초를 처음부터 다시 기다린다.
        //   → 시작된 스트림이 연결 단에서 끊겼고 반쪽 지문이 있으면, 서버 완성본(지문 일치만)을 먼저 기다려 채택.
        //     서버가 error 를 보냈거나(생성 실패·서버 환불) 못 찾으면 기존대로 callable.
        let adopted: { reportId: string; content: any } | null = null;
        if (sse.started && sse.errKind !== 'server' && sse.errKind !== 'http' && latestPartial) {
          adopted = await topicHeal.waitForServerTopicResult(topicId!, latestPartial, {
            deadlineAt: t0 + topicHeal.topicAdoptWaitMs(topicId!),
          });
          if (adopted) console.log(`[topic] 서버 스트림 완성본 채택 (${Date.now() - t0}ms) — callable 재생성 생략`);
        }
        res = adopted ?? await generateTopicAnalysis(topicId!, selected.sajuData, navState?.baseScore, partner, finalExtra);
      }
      // 2026-06-12 UX — 상대방 이름을 결과에 영속: 결과 화면 '나 vs 상대' 라벨에 실명 표기
      //   (캐시·보관함 재진입에도 유지 — 누구 기준 리포트인지 한눈에)
      const contentFinal = partner?.name ? { ...res.content, partnerName: partner.name } : res.content;
      setResult(contentFinal);
      setStreaming(false);

      // localStorage 캐시 (재회운/결혼운/연애운은 상대방 이름 포함)
      const hasPartnerName = (topicId === 'reunion' || topicId === 'marriage' || topicId === 'love') && partnerInfo.name;
      const cacheKey = hasPartnerName
        ? `topic_${topicId}_${selected.id}_${partnerInfo.name}`
        : `topic_${topicId}_${selected.id}`;
      localStorage.setItem(cacheKey, JSON.stringify(contentFinal));

      // 보관함 저장
      const savedId = res.reportId || generateId();
      saveReport({
        id: savedId,
        name: selected.name,
        input: selected.input,
        sajuData: selected.sajuData,
        type: 'paid',
        contentType: 'topic',
        createdAt: new Date().toISOString(),
        aiResult: { topicId, ...contentFinal },
        profileId: selected.id, // 보관함 삭제 시 topic_<id>_<profileId> 캐시 동반 제거용 (2026-06-17)
      });

      // 2026-07-03 P0 — partial 박제 시 pending 유지: 서버 완성본으로 승격될 때 clear.
      //   승격 전에 5분이 지나 부팅 reconcile 이 자동환불했다면, 그 뒤 승격돼도 재차감하지 않는다 (반쪽 노출 보상).
      if (!(contentFinal as any)?.__partial) {
        clearPendingSpend(pendingId); // 완성본 저장 완료 — pending 해제
        setSavedReportId(savedId); // B-1 — URL ?reportId= 기록 (언마운트 후면 no-op → 남의 히스토리 안 건드림)
      } else {
        console.warn('[topic] partial 저장 — pending 유지 (늦은 완성본 승격 / 후속 재시도 대기)');
        // 🚨 2026-10-04 — 반쪽 저장 뒤 도착하는 완성본으로 '같은 레코드' 를 승격 (재차감 0 · 보관함 중복 0 · 서버 미러도 갱신).
        //   ① 같은 SSE 연결로 늦게 온 done (late) — 실측상 재회운 반쪽의 서버 완성은 마감 61~94초 뒤
        //   ② 연결이 끊겨 done 을 못 받으면 서버 완성본 후속 조회 (scheduleTopicHealRetries · 지문 일치만)
        //   화면은 이 시도가 아직 떠 있을 때만 교체 (다른 시도·주제·선택 화면이면 보관함만 치유).
        const showHealed = (rec: LocalReport) => {
          if (attemptSeqRef.current !== attemptSeq || phaseRef.current === 'select') return;
          setResult(rec.aiResult);
          setSavedReportId(rec.id);
        };
        late.apply = (full, serverReportId) => {
          const rec = topicHeal.upgradePartialTopicRecord(savedId, full, { serverReportId, pendingId });
          if (rec && !rec.aiResult?.__partial) showHealed(rec);
        };
        if (late.content) late.apply(late.content, late.reportId);
        else topicHeal.scheduleTopicHealRetries(savedId, { onHealed: showHealed });
      }
      setPhase('result');
    } catch (e: any) {
      console.error('주제 분석 실패:', e);
      // 2026-05-07 fix — AI 실패 시 클라이언트에서 즉시 환불
      // 2026-05-29 fix — 환불액 1 하드코딩 → 실제 차감액(actualPrice). 재회운 정가(3운) 전환 시 과소 환불 방지.
      //   + e.message(영문 기술오류) 노출 금지 — 항상 친절 카피 + 환불 안내.
      clearPendingSpend(pendingId); // 즉시 환불하므로 pending 해제 (부팅 이중환불 방지)
      refundBalance(actualPrice);
      setAnalyzeError(`분석에 실패해서 ${actualPrice}운을 돌려드렸어요. 잠시 후 다시 시도해주세요.`);
      setPhase('select');
    } finally {
      setStreaming(false);
      clearInterval(interval);
      isAnalyzingRef.current = false;
      topicHeal.unmarkTopicInFlight(pendingId); // 반쪽으로 끝났으면 그 pending 은 반쪽 레코드가 소유 (승격 시 clear)
    }
  }

  // 년도 범위 생성
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 70 }, (_, i) => currentYear - 15 - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="px-5 pt-4 pb-8 space-y-5 topic-analysis-page">

        {/* 2026-05-28 — Legacy header 완전 제거.
            result phase: TopicHero 가 유일한 헤더 (검은 그라데이션 + 한자 + 일간/생일)
            select/loading phase: 페이지 자체에 minimal 헤더 인라인 (Header 컴포넌트 또는 단순 라벨) */}
        {phase !== 'result' && (
          <FadeIn>
            {/* 2026-10-10 v9 — 다른 콘텐츠(주간·월간·궁합·종합사주)와 같은 먹 + 그림 머리 */}
            <header style={{ margin: '-16px -20px 0', padding: '20px 22px 26px', color: '#FFFFFF', background: INK_HERO_BG }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#D3C7B4', fontWeight: 600 }}>
                <span className="hj-seal" style={{ width: 30, height: 30, fontSize: 14, color: '#E7B9AC', borderColor: 'rgba(231,185,172,.7)', background: 'transparent' }}>
                  {TOPIC_REGISTRY[(normalizeTopicId(topicId || '') || topicId) as TopicId]?.kanji || '命'}
                </span>
                주제운 · {getTopicPrice(topicId as TopicKey).actualPrice}운
              </div>
              <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 24, fontWeight: 700, marginTop: 12, lineHeight: 1.35, letterSpacing: '-0.02em' }}>
                {topic.label} 심층분석
              </h1>
              <p style={{ fontSize: 14.5, color: '#D3C7B4', marginTop: 6, lineHeight: 1.6 }}>{topic.desc}</p>
            </header>
          </FadeIn>
        )}

        <AnimatePresence mode="wait">
          {/* ====== 프로필 선택 ====== */}
          {phase === 'select' && (
            <motion.div key="select" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
              {profiles.length > 0 ? (
                <>
                  <p className="text-h3 text-text-primary">누구의 {topic.label}을 분석할까요?</p>
                  {/* 2026-05-04 사주카드 패턴 통일 — StoragePage ProfileCard 와 동일 일주 심볼 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {profiles.map((r) => {
                      const il = r.sajuData.pillars[2]?.천간 || '';
                      const ji = r.sajuData.pillars[2]?.지지 || '';
                      const oh = il ? CHEONGAN_OHENG[il] : '';
                      const ohengColor = (oh && OHENG_MAP[oh]?.color) || '#8C6D3D';
                      const ohengHanja = (oh && OHENG_MAP[oh]?.hanja) || ' ';
                      const relation = (r as any).relation || '본인';
                      const isMe = relation === '본인' || relation === 'self';
                      const isSelected = selected?.id === r.id;
                      return (
                        <motion.button
                          key={r.id}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setSelected(r as unknown as LocalReport)}
                          aria-label={`${r.name} 선택`}
                          style={{
                            position: 'relative',
                            height: 116,
                            background: '#FFFFFF',
                            border: isSelected ? `2px solid ${topic.color}` : `1px solid ${isMe ? '#B8965A' : '#E5DFD0'}`,
                            borderRadius: 16,
                            padding: 16,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            cursor: 'pointer',
                            textAlign: 'left',
                            boxShadow: isSelected ? `0 4px 14px ${topic.color}33` : 'none',
                          }}
                        >
                          {/* 좌 일주 심볼 — 오행 컬러 + 천간/지지 + 우상단 오행 뱃지 */}
                          <div
                            aria-hidden
                            style={{
                              width: 56,
                              height: 56,
                              flexShrink: 0,
                              borderRadius: 12,
                              background: il ? ohengColor : 'rgba(140,109,61,0.13)',
                              border: `2px solid ${il ? ohengColor : 'rgba(184,150,90,0.40)'}`,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: "'Noto Serif KR', serif",
                              color: il ? '#FFFFFF' : '#8C6D3D',
                              lineHeight: 0.96,
                              boxShadow: `0 4px 10px ${ohengColor}33`,
                              position: 'relative',
                            }}
                          >
                            {il ? (
                              <>
                                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '0.02em' }}>{il}</span>
                                <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.02em', marginTop: 1 }}>{ji}</span>
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: -6,
                                    right: -4,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: '1px 5px',
                                    borderRadius: 999,
                                    background: '#FFFFFF',
                                    color: ohengColor,
                                    border: `1.5px solid ${ohengColor}`,
                                    lineHeight: 1.2,
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  {ohengHanja}
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: 22, fontWeight: 700 }}>{ohengHanja || '命'}</span>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 17, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.01em' }}>{r.name}</span>
                              {isMe ? (
                                <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: '#8C6D3D', color: '#F8F5EE', letterSpacing: '0.04em' }}>본인</span>
                              ) : (
                                <span style={{ fontSize: 11, color: '#8C6D3D', fontWeight: 700, padding: '1px 7px', background: 'rgba(184,150,90,0.14)', borderRadius: 999 }}>{relation}</span>
                              )}
                            </div>
                            {il && (
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#8C6D3D', letterSpacing: '0.02em' }}>
                                일간 {il} · {oh}
                              </div>
                            )}
                          </div>

                          {isSelected ? (
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: topic.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                            </div>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B8070" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden>
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* ─── 다른 사람 사주 입력 ─── */}
                  <button onClick={() => navigate('/input')}
                    className="card w-full text-left py-3.5 px-4 flex items-center gap-3 opacity-70 hover:opacity-100 transition-opacity">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-dashed"
                      style={{ borderColor: `${topic.color}40` }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={topic.color} strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-body-sm font-semibold text-text-secondary">다른 사람의 사주 분석하기</p>
                      <p className="text-[11px] text-text-hint">새로운 생년월일시를 입력해요</p>
                    </div>
                  </button>

                  {/* ─── 연애운: 현재 상태 + 상대방 정보 ─── */}
                  {topicId === 'love' && selected && (
                    <FadeIn delay={0.1}>
                      <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={topic.color} strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
                          </svg>
                          <div>
                            <p className="text-h3 text-text-primary">현재 연애 상태</p>
                            <p className="text-[11px] text-text-hint">상태에 따라 분석 방향이 달라져요</p>
                          </div>
                        </div>

                        {/* 솔로 / 썸 / 연애중 토글 */}
                        <div className="flex gap-2 mb-3">
                          {[
                            { v: 'solo' as const, l: '솔로', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 10-16 0" /></svg> },
                            { v: 'some' as const, l: '썸', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21C7 17 2 13 2 8.5a5.5 5.5 0 0110-3.08A5.5 5.5 0 0122 8.5C22 13 17 17 12 21z" strokeDasharray="3 3" /></svg> },
                            { v: 'dating' as const, l: '연애중', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4a4 4 0 11-3 6.5" /><path d="M8 4a4 4 0 103 6.5" /><path d="M22 21a8 8 0 00-6-7.75" /><path d="M2 21a8 8 0 016-7.75" /></svg> },
                          ].map(s => (
                            <button key={s.v}
                              className={`flex-1 h-11 rounded-xl text-body-sm font-semibold transition-all flex items-center justify-center gap-2 ${loveStatus === s.v ? 'text-white shadow-md' : 'bg-bg-page border border-border-light text-text-muted'}`}
                              style={loveStatus === s.v ? { background: topic.color } : {}}
                              onClick={() => setLoveStatus(s.v)}>
                              {s.icon} {s.l}
                            </button>
                          ))}
                        </div>

                        {/* 썸/연애중 → 상대방 입력 */}
                        <AnimatePresence>
                          {loveStatus !== 'solo' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="pt-3 space-y-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                <p className="text-[11px] text-text-muted">
                                  {loveStatus === 'some' ? '관심 상대의 정보를 입력하면 궁합 분석이 가능해요' : '상대방 정보를 입력하면 실제 사주 궁합 기반 분석이 가능해요'}
                                </p>

                                {/* 이름 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">이름</label>
                                  <input type="text" placeholder="상대방 이름"
                                    className="w-full h-11 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                                    value={partnerInfo.name}
                                    onChange={e => setPartnerInfo(p => ({ ...p, name: e.target.value }))} />
                                </div>

                                {/* 생년월일 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">생년월일 (양력)</label>
                                  <div className="flex gap-2">
                                    <select className="flex-1 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthYear}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthYear: +e.target.value }))}>
                                      {years.map(y => <option key={y} value={y}>{y}년</option>)}
                                    </select>
                                    <select className="w-20 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthMonth}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthMonth: +e.target.value }))}>
                                      {months.map(m => <option key={m} value={m}>{m}월</option>)}
                                    </select>
                                    <select className="w-20 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthDay}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthDay: +e.target.value }))}>
                                      {days.map(d => <option key={d} value={d}>{d}일</option>)}
                                    </select>
                                  </div>
                                </div>

                                {/* 성별 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">성별</label>
                                  <div className="flex gap-2">
                                    {[{ v: 'male', l: '남성' }, { v: 'female', l: '여성' }].map(g => (
                                      <button key={g.v}
                                        className={`flex-1 h-11 rounded-xl text-body-sm font-semibold transition-all ${partnerInfo.gender === g.v ? 'text-white' : 'bg-bg-page border border-border-light text-text-muted'}`}
                                        style={partnerInfo.gender === g.v ? { background: topic.color } : {}}
                                        onClick={() => setPartnerInfo(p => ({ ...p, gender: g.v }))}>
                                        {g.l}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* 출생 시간 (선택) */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">
                                    출생 시간 <span className="text-[11px] opacity-60">(선택사항)</span>
                                  </label>
                                  <PartnerTimeField
                                    info={partnerInfo}
                                    onChange={(h, m) => setPartnerInfo(p => ({ ...p, birthHour: h, birthMinute: m }))}
                                    onOpenSheet={() => setHourSheetOpen(true)}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </FadeIn>
                  )}

                  {/* ─── 결혼운: 현재 상태 + 상대방 정보 ─── */}
                  {topicId === 'marriage' && selected && (
                    <FadeIn delay={0.1}>
                      <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={topic.color} strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
                          </svg>
                          <div>
                            <p className="text-h3 text-text-primary">결혼 상태</p>
                            <p className="text-[11px] text-text-hint">상태에 따라 분석 방향이 달라져요 (미혼/기혼)</p>
                          </div>
                        </div>

                        {/* 미혼 / 기혼 토글 (2026-05-08 sync — 락 진본 13_미혼·14_기혼 mockup 패턴) */}
                        <div className="flex gap-2 mb-3">
                          {[
                            { v: 'solo' as const, l: '미혼', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 10-16 0" /></svg> },
                            { v: 'dating' as const, l: '기혼', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4a4 4 0 11-3 6.5" /><path d="M8 4a4 4 0 103 6.5" /><path d="M22 21a8 8 0 00-6-7.75" /><path d="M2 21a8 8 0 016-7.75" /></svg> },
                          ].map(s => (
                            <button key={s.v}
                              className={`flex-1 h-11 rounded-xl text-body-sm font-semibold transition-all flex items-center justify-center gap-2 ${relationStatus === s.v ? 'text-white shadow-md' : 'bg-bg-page border border-border-light text-text-muted'}`}
                              style={relationStatus === s.v ? { background: topic.color } : {}}
                              onClick={() => { setRelationStatus(s.v); if (s.v === 'solo') setShowPartner(false); else setShowPartner(true); }}>
                              {s.icon} {s.l}
                            </button>
                          ))}
                        </div>

                        {/* 연애중 → 상대방 입력 */}
                        <AnimatePresence>
                          {relationStatus === 'dating' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="pt-3 space-y-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                <p className="text-[11px] text-text-muted">배우자 정보를 입력하면 실제 사주 궁합 기반 부부 분석이 가능해요</p>

                                {/* 이름 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">배우자 이름</label>
                                  <input type="text" placeholder="배우자 이름"
                                    className="w-full h-11 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                                    value={partnerInfo.name}
                                    onChange={e => setPartnerInfo(p => ({ ...p, name: e.target.value }))} />
                                </div>

                                {/* 생년월일 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">생년월일 (양력)</label>
                                  <div className="flex gap-2">
                                    <select className="flex-1 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthYear}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthYear: +e.target.value }))}>
                                      {years.map(y => <option key={y} value={y}>{y}년</option>)}
                                    </select>
                                    <select className="w-20 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthMonth}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthMonth: +e.target.value }))}>
                                      {months.map(m => <option key={m} value={m}>{m}월</option>)}
                                    </select>
                                    <select className="w-20 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthDay}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthDay: +e.target.value }))}>
                                      {days.map(d => <option key={d} value={d}>{d}일</option>)}
                                    </select>
                                  </div>
                                </div>

                                {/* 성별 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">성별</label>
                                  <div className="flex gap-2">
                                    {[{ v: 'male', l: '남성' }, { v: 'female', l: '여성' }].map(g => (
                                      <button key={g.v}
                                        className={`flex-1 h-11 rounded-xl text-body-sm font-semibold transition-all ${partnerInfo.gender === g.v ? 'text-white' : 'bg-bg-page border border-border-light text-text-muted'}`}
                                        style={partnerInfo.gender === g.v ? { background: topic.color } : {}}
                                        onClick={() => setPartnerInfo(p => ({ ...p, gender: g.v }))}>
                                        {g.l}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* 출생 시간 (선택) */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">
                                    출생 시간 <span className="text-[11px] opacity-60">(선택사항)</span>
                                  </label>
                                  <PartnerTimeField
                                    info={partnerInfo}
                                    onChange={(h, m) => setPartnerInfo(p => ({ ...p, birthHour: h, birthMinute: m }))}
                                    onOpenSheet={() => setHourSheetOpen(true)}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </FadeIn>
                  )}

                  {/* ─── 사업운: 현재 상태 ─── */}
                  {topicId === 'business' && selected && (
                    <FadeIn delay={0.1}>
                      <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={topic.color} strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>
                          <div>
                            <p className="text-h3 text-text-primary">현재 사업 상태</p>
                            <p className="text-[11px] text-text-hint">상태에 따라 분석 방향이 달라져요</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mb-2">
                          {[
                            { v: 'preparing' as const, l: '창업 준비중' },
                            { v: 'running' as const, l: '현재 운영중' },
                          ].map(s => (
                            <button key={s.v}
                              className={`flex-1 h-11 rounded-xl text-body-sm font-semibold transition-all ${extraInfo.bizStatus === s.v ? 'text-white shadow-md' : 'bg-bg-page border border-border-light text-text-muted'}`}
                              style={extraInfo.bizStatus === s.v ? { background: topic.color } : {}}
                              onClick={() => setExtraInfo(p => ({ ...p, bizStatus: p.bizStatus === s.v ? '' : s.v }))}>
                              {s.l}
                            </button>
                          ))}
                        </div>
                        <AnimatePresence>
                          {extraInfo.bizStatus === 'running' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="pt-3 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                <label className="text-[11px] text-text-hint block">개업 시기</label>
                                {/* 2026-05-28 — 미래 차단 (이미 운영중이라 개업은 과거). currentYear+currentMonth 까지만 */}
                                {(() => {
                                  const now = new Date();
                                  const cYear = now.getFullYear();
                                  const cMonth = now.getMonth() + 1;
                                  const isCurrentYear = extraInfo.bizOpenYear === cYear;
                                  const availableMonths = isCurrentYear ? months.filter(m => m <= cMonth) : months;
                                  return (
                                    <div className="flex gap-2">
                                      <select className="flex-1 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                        value={extraInfo.bizOpenYear}
                                        onChange={e => {
                                          const newYear = +e.target.value;
                                          setExtraInfo(p => {
                                            const monthNeedsReset = newYear === cYear && p.bizOpenMonth > cMonth;
                                            return { ...p, bizOpenYear: newYear, ...(monthNeedsReset ? { bizOpenMonth: cMonth } : {}) };
                                          });
                                        }}>
                                        {Array.from({ length: 30 }, (_, i) => cYear - i).map(y => <option key={y} value={y}>{y}년</option>)}
                                      </select>
                                      <select className="w-24 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                        value={extraInfo.bizOpenMonth}
                                        onChange={e => setExtraInfo(p => ({ ...p, bizOpenMonth: +e.target.value }))}>
                                        {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
                                      </select>
                                    </div>
                                  );
                                })()}
                                <p className="text-[11px] text-text-hint">개업 시점의 대운 흐름을 분석해드려요</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </FadeIn>
                  )}

                  {/* ─── 취업·이직운: 현재 상태 ─── */}
                  {topicId === 'career' && selected && (
                    <FadeIn delay={0.1}>
                      <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={topic.color} strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>
                          <div>
                            <p className="text-h3 text-text-primary">현재 상태</p>
                            <p className="text-[11px] text-text-hint">상태에 따라 분석 방향이 달라져요</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {[
                            { v: 'student' as const, l: '학생' },
                            { v: 'jobseeking' as const, l: '구직중' },
                            { v: 'employed' as const, l: '재직중' },
                          ].map(s => (
                            <button key={s.v}
                              className={`flex-1 min-w-[80px] h-11 rounded-xl text-body-sm font-semibold transition-all ${extraInfo.jobStatus === s.v ? 'text-white shadow-md' : 'bg-bg-page border border-border-light text-text-muted'}`}
                              style={extraInfo.jobStatus === s.v ? { background: topic.color } : {}}
                              onClick={() => setExtraInfo(p => ({ ...p, jobStatus: p.jobStatus === s.v ? '' : s.v }))}>
                              {s.l}
                            </button>
                          ))}
                        </div>
                        <div className="pt-2">
                          <label className="text-[11px] text-text-hint mb-1 block">관심 분야 / 희망 직종 <span className="text-[11px] opacity-60">(선택)</span></label>
                          <input type="text" placeholder="예: IT개발, 디자인, 마케팅, 공무원..."
                            className="w-full h-11 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                            value={extraInfo.targetField}
                            onChange={e => setExtraInfo(p => ({ ...p, targetField: e.target.value }))} />
                          <p className="text-[11px] text-text-hint mt-1">입력하면 해당 분야의 사주적 적합도를 분석해요</p>
                        </div>
                      </div>
                    </FadeIn>
                  )}

                  {/* ─── 이사·이동운: 이사 목적 + 예정 시기 ─── */}
                  {topicId === 'move' && selected && (
                    <FadeIn delay={0.1}>
                      <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={topic.color} strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                          <div>
                            <p className="text-h3 text-text-primary">이사 계획</p>
                            <p className="text-[11px] text-text-hint">목적과 시기에 맞는 분석을 해드려요</p>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-text-hint mb-1 block">이사 목적</label>
                          <div className="flex gap-2 flex-wrap mb-3">
                            {[
                              { v: 'house' as const, l: '주거 이사' },
                              // '직장 이동' chip 삭제 (2026-05-08 sync — topics.ts excludedScope: 'move → exam' redirect)
                              { v: 'study' as const, l: '유학/학업' },
                              { v: 'abroad' as const, l: '해외 이주' },
                            ].map(s => (
                              <button key={s.v}
                                className={`flex-1 min-w-[70px] h-11 rounded-xl text-[12px] font-semibold transition-all ${extraInfo.movePurpose === s.v ? 'text-white shadow-md' : 'bg-bg-page border border-border-light text-text-muted'}`}
                                style={extraInfo.movePurpose === s.v ? { background: topic.color } : {}}
                                onClick={() => setExtraInfo(p => ({ ...p, movePurpose: p.movePurpose === s.v ? '' : s.v }))}>
                                {s.l}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* 2026-05-28 — 이사는 예정(미래) 만. currentYear+currentMonth 이후만 가능 */}
                        {(() => {
                          const now = new Date();
                          const cYear = now.getFullYear();
                          const cMonth = now.getMonth() + 1;
                          const isCurrentYear = extraInfo.movePlanYear === cYear;
                          const availableMonths = isCurrentYear ? months.filter(m => m >= cMonth) : months;
                          return (
                            <div>
                              <label className="text-[11px] text-text-hint mb-1 block">이사 예정 시기 <span className="text-[11px] opacity-60">(선택)</span></label>
                              <div className="flex gap-2">
                                <select className="flex-1 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                  value={extraInfo.movePlanYear}
                                  onChange={e => {
                                    const newYear = +e.target.value;
                                    setExtraInfo(p => {
                                      const monthNeedsReset = newYear === cYear && p.movePlanMonth < cMonth;
                                      return { ...p, movePlanYear: newYear, ...(monthNeedsReset ? { movePlanMonth: cMonth } : {}) };
                                    });
                                  }}>
                                  {Array.from({ length: 5 }, (_, i) => cYear + i).map(y => <option key={y} value={y}>{y}년</option>)}
                                </select>
                                <select className="w-24 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                  value={extraInfo.movePlanMonth}
                                  onChange={e => setExtraInfo(p => ({ ...p, movePlanMonth: +e.target.value }))}>
                                  {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
                                </select>
                              </div>
                              <p className="text-[11px] text-text-hint mt-1">예정 시기의 이동운과 최적 방위를 분석해요</p>
                            </div>
                          );
                        })()}
                      </div>
                    </FadeIn>
                  )}

                  {/* ─── 합격·이직운: 변동 유형 + 시기 (2026-05-28 신설) ─── */}
                  {topicId === 'exam' && selected && (
                    <FadeIn delay={0.1}>
                      <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={topic.color} strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                          <div>
                            <p className="text-h3 text-text-primary">변동 정보</p>
                            <p className="text-[11px] text-text-hint">어떤 변동을 준비 중인지 알려주세요</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[11px] text-text-hint mb-1 block">변동 유형 <span className="text-[11px] opacity-60">(선택)</span></label>
                            <div className="flex gap-2 flex-wrap">
                              {[
                                { v: 'exam', l: '시험·자격증' },
                                { v: 'jobchange', l: '이직' },
                                { v: 'career_pivot', l: '직무 전환' },
                              ].map((s) => {
                                const active = extraInfo.changeType === s.v;
                                return (
                                  <button key={s.v} type="button"
                                    onClick={() => setExtraInfo(p => ({ ...p, changeType: p.changeType === s.v ? '' : s.v as any }))}
                                    style={{
                                      height: 36, padding: '0 14px', borderRadius: 999,
                                      background: active ? topic.color : '#fff',
                                      color: active ? '#fff' : '#3D3D3D',
                                      border: `1px solid ${active ? topic.color : '#E5DFD0'}`,
                                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                    }}>
                                    {s.l}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-text-hint mb-1 block">시험명 또는 목표 <span className="text-[11px] opacity-60">(선택)</span></label>
                            <input type="text" placeholder="예: 7급 공무원, 변호사시험, 대기업 이직..."
                              className="w-full h-11 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                              value={extraInfo.examName}
                              onChange={e => setExtraInfo(p => ({ ...p, examName: e.target.value }))} />
                          </div>
                          {/* 2026-05-28 — 시험은 예정(미래) 만. currentYear+currentMonth 이후만 */}
                          {(() => {
                            const now = new Date();
                            const cYear = now.getFullYear();
                            const cMonth = now.getMonth() + 1;
                            const isCurrentYear = extraInfo.examYear === cYear;
                            const availableMonths = isCurrentYear ? months.filter(m => m >= cMonth) : months;
                            return (
                              <div>
                                <label className="text-[11px] text-text-hint mb-1 block">예정 시기 <span className="text-[11px] opacity-60">(선택)</span></label>
                                <div className="flex gap-2">
                                  <select className="flex-1 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                    value={extraInfo.examYear}
                                    onChange={e => {
                                      const newYear = +e.target.value;
                                      setExtraInfo(p => {
                                        const monthNeedsReset = newYear === cYear && p.examMonth < cMonth;
                                        return { ...p, examYear: newYear, ...(monthNeedsReset ? { examMonth: cMonth } : {}) };
                                      });
                                    }}>
                                    {Array.from({ length: 3 }, (_, i) => cYear + i).map(y => <option key={y} value={y}>{y}년</option>)}
                                  </select>
                                  <select className="w-24 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                    value={extraInfo.examMonth}
                                    onChange={e => setExtraInfo(p => ({ ...p, examMonth: +e.target.value }))}>
                                    {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
                                  </select>
                                </div>
                                <p className="text-[11px] text-text-hint mt-1">예정 시기의 합격·변동운을 정밀 분석합니다</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </FadeIn>
                  )}

                  {/* ─── 학업·시험운: 시험 정보 ─── */}
                  {topicId === 'study' && selected && (
                    <FadeIn delay={0.1}>
                      <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={topic.color} strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" /></svg>
                          <div>
                            <p className="text-h3 text-text-primary">시험 정보</p>
                            <p className="text-[11px] text-text-hint">시험에 맞춘 정밀 분석을 해드려요</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[11px] text-text-hint mb-1 block">준비중인 시험 <span className="text-[11px] opacity-60">(선택)</span></label>
                            <input type="text" placeholder="예: 공무원, 수능, 토익, 자격증명..."
                              className="w-full h-11 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                              value={extraInfo.examName}
                              onChange={e => setExtraInfo(p => ({ ...p, examName: e.target.value }))} />
                          </div>
                          {/* 2026-05-28 — 시험은 예정(미래) 만. currentYear+currentMonth 이후만 */}
                          {(() => {
                            const now = new Date();
                            const cYear = now.getFullYear();
                            const cMonth = now.getMonth() + 1;
                            const isCurrentYear = extraInfo.examYear === cYear;
                            const availableMonths = isCurrentYear ? months.filter(m => m >= cMonth) : months;
                            return (
                              <div>
                                <label className="text-[11px] text-text-hint mb-1 block">시험 예정 시기 <span className="text-[11px] opacity-60">(선택)</span></label>
                                <div className="flex gap-2">
                                  <select className="flex-1 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                    value={extraInfo.examYear}
                                    onChange={e => {
                                      const newYear = +e.target.value;
                                      setExtraInfo(p => {
                                        const monthNeedsReset = newYear === cYear && p.examMonth < cMonth;
                                        return { ...p, examYear: newYear, ...(monthNeedsReset ? { examMonth: cMonth } : {}) };
                                      });
                                    }}>
                                    {Array.from({ length: 3 }, (_, i) => cYear + i).map(y => <option key={y} value={y}>{y}년</option>)}
                                  </select>
                                  <select className="w-24 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                    value={extraInfo.examMonth}
                                    onChange={e => setExtraInfo(p => ({ ...p, examMonth: +e.target.value }))}>
                                    {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
                                  </select>
                                </div>
                                <p className="text-[11px] text-text-hint mt-1">시험 시기에 맞춘 합격 전략을 세워드려요</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </FadeIn>
                  )}

                  {/* ─── 재회운: 상대방 정보 입력 ─── */}
                  {topicId === 'reunion' && selected && (
                    <FadeIn delay={0.1}>
                      <div className="card">
                        <button className="w-full flex items-center justify-between"
                          onClick={() => setShowPartner(!showPartner)}>
                          <div className="flex items-center gap-2">
                            <Pictogram k="topic:letter" size={16} color="#7A5C7E" />
                            <div className="text-left">
                              <p className="text-h3 text-text-primary">재회 상대방 정보</p>
                              <p className="text-[11px] text-text-hint">입력하면 더 정확한 분석이 가능해요</p>
                            </div>
                          </div>
                          <motion.svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" className="text-text-muted"
                            animate={{ rotate: showPartner ? 180 : 0 }}>
                            <path d="M6 9l6 6 6-6" />
                          </motion.svg>
                        </button>

                        <AnimatePresence>
                          {showPartner && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="pt-4 mt-3 space-y-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>

                                {/* 이름 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">이름</label>
                                  <input type="text" placeholder="상대방 이름"
                                    className="w-full h-11 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                                    style={{ '--tw-ring-color': topic.color } as any}
                                    value={partnerInfo.name}
                                    onChange={e => setPartnerInfo(p => ({ ...p, name: e.target.value }))} />
                                </div>

                                {/* 생년월일 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">생년월일 (양력)</label>
                                  <div className="flex gap-2">
                                    <select className="flex-1 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthYear}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthYear: +e.target.value }))}>
                                      {years.map(y => <option key={y} value={y}>{y}년</option>)}
                                    </select>
                                    <select className="w-20 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthMonth}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthMonth: +e.target.value }))}>
                                      {months.map(m => <option key={m} value={m}>{m}월</option>)}
                                    </select>
                                    <select className="w-20 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthDay}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthDay: +e.target.value }))}>
                                      {days.map(d => <option key={d} value={d}>{d}일</option>)}
                                    </select>
                                  </div>
                                </div>

                                {/* 성별 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">성별</label>
                                  <div className="flex gap-2">
                                    {[{ v: 'male', l: '남성' }, { v: 'female', l: '여성' }].map(g => (
                                      <button key={g.v}
                                        className={`flex-1 h-11 rounded-xl text-body-sm font-semibold transition-all ${partnerInfo.gender === g.v ? 'text-white' : 'bg-bg-page border border-border-light text-text-muted'}`}
                                        style={partnerInfo.gender === g.v ? { background: topic.color } : {}}
                                        onClick={() => setPartnerInfo(p => ({ ...p, gender: g.v }))}>
                                        {g.l}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* 헤어진 시기 — 2026-05-28 미래 시기 선택 차단 (헤어짐은 과거만 가능) */}
                                {(() => {
                                  const now = new Date();
                                  const cYear = now.getFullYear();
                                  const cMonth = now.getMonth() + 1;
                                  const isCurrentYear = partnerInfo.breakupYear === cYear;
                                  const availableMonths = isCurrentYear ? months.filter(m => m <= cMonth) : months;
                                  return (
                                    <div>
                                      <label className="text-[11px] text-text-hint mb-1 block">헤어진 시기</label>
                                      <div className="flex gap-2">
                                        <select className="flex-1 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                          value={partnerInfo.breakupYear}
                                          onChange={e => {
                                            const newYear = +e.target.value;
                                            setPartnerInfo(p => {
                                              // 새 year 가 currentYear 면 month 가 미래면 currentMonth 로 reset
                                              const monthNeedsReset = newYear === cYear && p.breakupMonth > cMonth;
                                              return { ...p, breakupYear: newYear, ...(monthNeedsReset ? { breakupMonth: cMonth } : {}) };
                                            });
                                          }}>
                                          {Array.from({ length: 10 }, (_, i) => cYear - i).map(y => <option key={y} value={y}>{y}년</option>)}
                                        </select>
                                        <select className="w-24 h-11 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                          value={partnerInfo.breakupMonth}
                                          onChange={e => setPartnerInfo(p => ({ ...p, breakupMonth: +e.target.value }))}>
                                          {availableMonths.map(m => <option key={m} value={m}>{m}월</option>)}
                                        </select>
                                      </div>
                                      <p className="text-[11px] text-text-hint mt-1">
                                        헤어진 기간에 따른 재회 에너지 변화를 분석해드려요
                                      </p>
                                    </div>
                                  );
                                })()}

                                {/* 상대방 출생 시간 (선택) */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">
                                    상대방 출생 시간 <span className="text-[11px] opacity-60">(선택사항)</span>
                                  </label>
                                  <PartnerTimeField
                                    info={partnerInfo}
                                    onChange={(h, m) => setPartnerInfo(p => ({ ...p, birthHour: h, birthMinute: m }))}
                                    onOpenSheet={() => setHourSheetOpen(true)}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </FadeIn>
                  )}

                  {/* 2026-10-04 — 지금 상황 한 줄 (선택) */}
                  {selected && (
                    <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D6', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
                      <label htmlFor="topic-concern" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
                        지금 상황을 한 줄로 알려주세요 <span style={{ fontWeight: 500, color: '#7A7269' }}>(선택)</span>
                      </label>
                      <p style={{ fontSize: 12, color: '#7A7269', lineHeight: 1.5, marginBottom: 8 }}>
                        적어주시면 그 상황에 맞춰 풀어드려요. 비워둬도 괜찮아요.
                      </p>
                      <textarea
                        id="topic-concern"
                        value={concern}
                        onChange={(e) => setConcern(e.target.value.slice(0, 200))}
                        rows={2}
                        maxLength={200}
                        placeholder={CONCERN_PLACEHOLDER[topicId || ''] || '예: 지금 가장 마음에 걸리는 상황을 적어주세요'}
                        style={{
                          width: '100%', boxSizing: 'border-box', resize: 'none', fontSize: 16, lineHeight: 1.5,
                          color: '#1A1A1A', background: '#F8F5EE', border: '1px solid #E8E2D6', borderRadius: 10, padding: '10px 12px',
                        }}
                      />
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#7A7269', marginTop: 4 }}>{concern.length}/200</div>
                    </div>
                  )}

                  {/* F5 · AI 실패 inline error 카드 */}
                  {analyzeError && (
                    <div
                      role="alert"
                      style={{
                        background: '#FFF7F5',
                        border: '1px solid #F0BFB6',
                        borderRadius: 12,
                        padding: '14px 16px',
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#8B1A1A', marginBottom: 6 }}>
                        분석에 실패했어요
                      </div>
                      <div style={{ fontSize: 12.5, color: '#3D3D3D', lineHeight: 1.6, marginBottom: 10 }}>
                        {analyzeError}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setAnalyzeError(null); requestAnalyze(); }}
                        style={{
                          fontSize: 12.5, fontWeight: 700, color: '#1A1A1A',
                          background: '#F8F5EE', border: '1px solid #B8965A',
                          borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                        }}
                      >
                        다시 시도
                      </button>
                    </div>
                  )}

                  {selected && (() => {
                    // 2026-05-28 PM — 토픽별 가격 SSOT. 재회운 세일 1운 (정가 3운).
                    const pricing = getTopicPrice(topicId as TopicKey);
                    const actualPrice = pricing.isOnSale && pricing.salePrice != null ? pricing.salePrice : pricing.regularPrice;
                    return (
                      <Button fullWidth size="lg" variant="gold" onClick={requestAnalyze}>
                        {pricing.isOnSale && pricing.salePrice != null ? (
                          <span>
                            {topic.label} 분석하기 (
                            <span style={{ textDecoration: 'line-through', opacity: 0.7, marginRight: 4 }}>{pricing.regularPrice}운</span>
                            <span style={{ fontWeight: 800 }}>{actualPrice}운</span>
                            <span style={{ marginLeft: 6, fontSize: '0.85em', color: '#FFD54F' }}>· {pricing.saleBadge}</span>
                            )
                          </span>
                        ) : (
                          `${topic.label} 분석하기 (${actualPrice}운)`
                        )}
                      </Button>
                    );
                  })()}
                </>
              ) : (
                <div className="card text-center py-10 space-y-3">
                  <p className="text-h2 text-text-primary">사주를 먼저 입력해주세요</p>
                  <p className="text-body-sm text-text-muted">생년월일시를 입력하면 {topic.label} 심층분석을 받을 수 있어요</p>
                  {/* E3 · returnTo state — 입력 후 자동 복귀 동선 */}
                  <Button variant="gold" onClick={() => navigate('/input', { state: { returnTo: `/topic/${topicId}` } })}>사주 입력하기</Button>
                </div>
              )}
            </motion.div>
          )}

          {/* ====== 로딩 ====== */}
          {phase === 'loading' && (() => {
            const TOPIC_NOTES: Record<string, string> = {
              love: '인연을 끌어당기는 글자와 결혼 자리를 확인하고 있어요.|당신의 연애 패턴을 사주에서 읽고 있어요.|인연의 시기를 월 단위로 계산하고 있어요.|사주적으로 궁합이 맞는 이성을 찾고 있어요.',
              wealth: '재성 구조로 돈 버는 스타일을 분석하고 있어요.|투자 적기를 대운 흐름으로 계산하고 있어요.|새는 돈 패턴을 사주에서 찾고 있어요.|돈을 만드는 사주 구조를 확인하고 있어요.',
              career: '책임감과 표현력의 균형을 보고 있어요.|이직 최적 타이밍을 계산하고 있어요.|면접 유리 요일과 시간대를 확인하고 있어요.|딱 맞는 직종 TOP 5를 선정하고 있어요.',
              marriage: '배우자궁의 구조를 깊이 분석하고 있어요.|결혼 적기를 대운 흐름으로 계산하고 있어요.|만세력으로 배우자 성향을 읽고 있어요.|결혼 후 생활 패턴까지 예측하고 있어요.',
              business: '사업 적성과 맞는 업종을 분석하고 있어요.|창업 최적 타이밍을 계산하고 있어요.|동업 궁합 구조를 확인하고 있어요.|사업가 기질의 사주 구조를 읽고 있어요.',
              health: '오행 균형으로 체질을 정밀 분석하고 있어요.|취약 장기와 주의 시기를 확인하고 있어요.|사주에서 건강 리스크를 찾고 있어요.|맞춤 건강 보완법을 만들고 있어요.',
              reunion: '두 사람의 사주를 교차 분석하고 있어요.|상대방의 숨은 마음까지 읽고 있어요.|궁합 구조와 신살을 정밀 분석 중이에요.|재회 전략까지 세우고 있어요.',
              study: '인성 구조로 학습 체질을 분석하고 있어요.|합격 운과 최적 시기를 계산하고 있어요.|집중력 피크 시간대를 찾고 있어요.|시험 당일 전략까지 세우고 있어요.',
              // audit 2 P1 B1 — exam 키 신규 추가 (TOPICS 에 등록됐지만 NOTES 누락이었음)
              exam: '합격·이직 좋은 달을 사주에서 찾고 있어요.|면접 유리한 시간대를 보고 있어요.|변동 운이 강한 시기를 짚고 있어요.|합격 신살(문창·학당·태극)을 확인하고 있어요.',
              move: '이동·변화의 글자를 확인하고 있어요.|오행 방위로 좋은 방향을 계산하고 있어요.|이사 최적 시기를 확인하고 있어요.|해외운까지 분석하고 있어요.',
              social: '도와줄 인연이 있는 자리를 보고 있어요.|귀인운이 언제 오는지 확인하고 있어요.|구설수 주의 시기를 계산하고 있어요.|사주적 관계 패턴을 읽고 있어요.',
              moving: '이동·변화의 글자를 확인하고 있어요.|오행 방위로 좋은 방향을 계산하고 있어요.|이사 최적 시기를 확인하고 있어요.|해외운까지 분석하고 있어요.',
            };
            const reunionSteps = [
              '사주 원국을 깊이 분석하고 있어요',
              '상대방의 만세력을 함께 살피고 있어요',
              '두 사람의 궁합 구조를 교차 분석 중이에요',
              '전통 신살을 하나하나 확인하고 있어요',
              '월별 재회 에너지를 계산하고 있어요',
              '맞춤 분석을 정리하고 있어요',
            ];
            const defaultSteps = ['사주 원국을 분석하고 있어요', '오행의 흐름을 읽고 있어요', '맞춤 분석을 정리하고 있어요'];
            return (
              <AILoading
                name={selected?.name}
                type={`${topic.label} 심층분석`}
                sajuData={selected?.sajuData}
                steps={topicId === 'reunion' ? reunionSteps : defaultSteps}
                premiumNote={TOPIC_NOTES[topicId || '']}
                estimatedSeconds={25} // 10-09 — 첫 화면(첫 섹션) 실측 ~23초 · 재회운도 본문 스트리밍이라 같음
              />
            );
          })()}

          {/* ====== 결과 ====== */}
          {phase === 'result' && result && (() => {
            // 2026-05-07 Option A — JDS_Topic_IA 통합 view 사용 시 early return
            // (USE_TOPIC_MOCKUP_VIEW=true 로 flip 시 AI prompt v2 schema 가 필요)
            if (USE_TOPIC_MOCKUP_VIEW && selected && topicId) {
              const v2Theme = TOPIC_THEMES[normalizeTopicKey(topicId)];
              const v2Result = adaptToTopicResultV2(result, topicId);
              const pricing = getTopicPrice(topicId as TopicKey);
              return (
                <motion.div key="result-v2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <TopicMockupView
                    theme={v2Theme}
                    profile={selected}
                    result={v2Result}
                    nameLabel={selected.name ? `${selected.name} 님` : undefined}
                    tierLabel={formatPriceLabel(pricing)}
                    onShare={() => { /* ShareModal trigger TBD */ }}
                    onChat={async () => {
                      const { createChatRoom } = await import('@/services/storage/chatStore');
                      const room = createChatRoom(selected?.name || '나');
                      navigate(`/chat/${room.id}`, {
                        state: {
                          profile: selected,
                          contentContext: {
                            type: 'topic',
                            label: topic?.label || '주제 분석',
                            fullResult: v2Result,
                          },
                        },
                      });
                    }}
                    onUpsell={() => navigate('/input', { state: { returnTo: '/result' } })}
                  />
                </motion.div>
              );
            }

            // 2026-05-28 — SSOT 10주제 chrome 매핑 (5 → 10 확장). 디자인 양극화 해소.
            const chromeKey = (
              ['love', 'wealth', 'career', 'health', 'study', 'reunion', 'marriage', 'exam', 'business', 'move'].includes(topicId || '')
                ? topicId
                : null
            ) as TopicChromeKey | null;
            const theme = chromeKey ? TOPIC_CHROME[chromeKey] : null;

            // 사주 8글자 mini cells (시→일→월→년)
            const sajuCells: TopicSajuMiniCell[] | null = (() => {
              if (!selected?.sajuData?.pillars?.length) return null;
              const labels = ['시', '일', '월', '년'];
              const pillars = [...selected.sajuData.pillars].reverse(); // 시→일→월→년
              return pillars.map((p: any, i: number) => {
                const gan = p.천간 || '';
                const ji = p.지지 || '';
                const ganOheng = p.천간오행 || (gan ? CHEONGAN_OHENG[gan] : undefined);
                const jiOheng = p.지지오행;
                // 2026-05-28 — 친절한 표시: 한국어 읽기 + 음양·오행 텍스트 + 십성 sip-tag
                const ganYum = gan ? `${CHEONGAN_KO[gan] || ''} / ${CHEONGAN_EUMYANG[gan] || ''}${ganOheng || ''}` : '';
                const jiYum = ji ? `${JIJI_KO[ji] || ''} / ${JIJI_EUMYANG[ji] || ''}${jiOheng || ''}` : '';
                const ganSip = i === 1 ? '일간' : (p.십성 || '');
                return {
                  label: labels[i] || '',
                  gan, ji, ganOheng, jiOheng,
                  ganYum, jiYum, ganSip,
                  ten: i === 1 ? '일간' : (p.십성 || ''),
                  ilju: i === 1,
                  key: false,
                };
              });
            })();

            // P0-4 (2026-05-28 PM) — linkPills 제거 (TopicLinkCard 제거에 따라 dead).

            // 액션 카드 (3개) — actionAdvice 가 줄바꿈/번호로 구분되면 분리, 아니면 단일 PullQuote
            const actionItems: TopicActionItem[] | null = (() => {
              if (!Array.isArray(result.actionItems) || result.actionItems.length === 0) return null;
              return result.actionItems.slice(0, 3).map((a: any) => ({
                title: stripMd(String(a.title || a.heading || '')),
                desc: stripMd(String(a.desc || a.description || a.content || '')),
              }));
            })();

            // ?? (nullish) 사용 — AI 가 정상적으로 0 점 반환할 때 75 마스킹 방지
            // 0 점은 명리학적으로 유효한 값이므로 보존
            const score = (typeof result.overallScore === 'number' && !isNaN(result.overallScore))
              ? result.overallScore
              : 75;
            const j = getJudgment(score);

            return (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* ─── Phase D'-2 Bundle 2 · TopicHero (5 주제 한정) ─── */}
              {/* 2026-05-28 PM — DailyMockupView 패턴 통일: personName chip + bottomHint pill 추가.
                  세일 토픽(재회운)은 tierLabel="3운 → 1운 SALE" 노출. */}
              {theme && (() => {
                const pricing = getTopicPrice(topicId as TopicKey);
                const tierLabel = pricing.isOnSale && pricing.salePrice != null
                  ? `${pricing.regularPrice}운 → ${pricing.salePrice}운 ${pricing.saleBadge || 'SALE'}`
                  : `${pricing.regularPrice}운`;
                return (
                <div style={{ margin: '0 -20px 0' }}>
                  <TopicHero
                    theme={theme}
                    personName={selected?.input?.name ? `${selected.input.name} 님` : undefined}
                    bottomHint={theme.heroHint}
                    ilganLabel={
                      selected?.sajuData?.pillars?.[2]?.천간
                        ? `${selected.sajuData.pillars[2].천간}${
                            selected.sajuData.pillars[2].천간오행 ? `(${selected.sajuData.pillars[2].천간오행})` : ''
                          }`
                        : undefined
                    }
                    birthLabel={
                      selected?.input
                        ? `${selected.input.calendarType === 'lunar' ? '음력 ' : '양력 '}${selected.input.birthYear}년 ${selected.input.birthMonth}월 ${selected.input.birthDay}일`
                        : undefined
                    }
                    tierLabel={tierLabel}
                  />
                </div>
                );
              })()}

              {/* ─── Phase D'-2 Bundle 2 · TopicSajuMini (8글자 4-cell) ─── */}
              {theme && sajuCells && sajuCells.length === 4 && (
                <div style={{ margin: '0 -20px' }}>
                  <TopicSajuMini theme={theme} cells={sajuCells} />
                </div>
              )}

              {/* ─── P0-7 (2026-05-28 PM) · TopicOhengBalance — Daily 패턴 통일 ─── */}
              {theme && sajuCells && sajuCells.length === 4 && (() => {
                const counts: Record<'목' | '화' | '토' | '금' | '수', number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
                for (const c of sajuCells) {
                  if (c.ganOheng) counts[c.ganOheng]++;
                  if (c.jiOheng) counts[c.jiOheng]++;
                }
                return (
                  <div style={{ margin: '0 -20px' }}>
                    <TopicOhengBalance theme={theme} topicKey={topicId as TopicChromeKey} counts={counts} />
                  </div>
                );
              })()}

              {/* ─── 종합 점수 — 5 주제는 TopicScoreCard, 그 외는 기존 ScoreRing 카드 ─── */}
              {theme ? (
                <>
                  {/* 2026-05-28 — 점수 카드: 두괄식 결론(j.desc) 만 노출.
                      어려운 명리학 인용(sajuBasis)은 아래 TopicLinkCard 한 곳에서만 노출 (중복 제거).
                      user 피드백: "어려운 단어 남발 + 같은말 반복 + 두괄식 X + 잘림" */}
                  <div style={{ margin: '0 -20px' }}>
                    <TopicScoreCard
                      theme={theme}
                      score={score}
                      title={`${topic.label} 지수`}
                      body={`${j.reading} · ${j.desc}`}
                      // note 제거 — 중복 + 어려운 단어
                    />
                  </div>
                  {/* audit 4 P1 D2 — 다크 결론박스 (5 주제 한정 · summary 첫 문장 한 줄) */}
                  {result.summary && (
                    <FadeIn delay={0.15}>
                      <TopicConclusionDark
                        theme={theme}
                        conclusion={sanitizeAiText(stripMd(String(result.summary)).split(/[.!?。]/)[0] + '.')}
                        // sajuRef 제거 — 잘림 + 중복
                      />
                    </FadeIn>
                  )}
                </>
              ) : (
                <div className="card py-6 px-5">
                  {/* 점수 링 */}
                  <div className="flex justify-center mb-4">
                    <ScoreRing label={topic.label} score={score} color={topic.color} delay={0.2} />
                  </div>

                  {/* 한자 판정 */}
                  <motion.div className="text-center mb-1"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <span className="text-3xl font-black" style={{ color: j.color }}>{j.hanja}</span>
                  </motion.div>
                  <p className="text-[12px] text-center" style={{ color: j.color }}>{j.reading} · {j.desc}</p>

                  {/* 사주 근거 */}
                  {result.sajuBasis && (
                    <motion.div className="mt-4 pt-3 text-center"
                      style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                      <p className="text-[11px] text-text-hint mb-1">사주 근거</p>
                      <p className="text-[12px] text-text-secondary leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.sajuBasis) }} />
                    </motion.div>
                  )}
                  {!result.sajuBasis && result.gradeLabel && (
                    <p className="text-body-sm text-text-muted mt-3 text-center" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.gradeLabel) }} />
                  )}

                  {/* 등급 기준표 */}
                  <motion.div className="mt-4 pt-3"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
                    <p className="text-[11px] text-text-hint text-center mb-2">등급 기준</p>
                    <div className="flex justify-between px-1">
                      {GRADE_SCALE.map(g => {
                        const isActive = g.hanja === j.hanja;
                        return (
                          <div key={g.hanja} className="flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-all"
                            style={isActive ? { background: `${g.color}10`, outline: `1.5px solid ${g.color}30` } : {}}>
                            <span className="text-[13px] font-black" style={{ color: g.color, opacity: isActive ? 1 : 0.4 }}>{g.hanja}</span>
                            <span className="text-[11px]" style={{ color: isActive ? g.color : 'var(--text-disabled)' }}>{g.range}점</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              )}

              {/* P0-4 (2026-05-28 PM) — TopicLinkCard (quick chip row) 제거.
                  Daily SSOT 통일: 헤더 + score pill + 한 줄 결론 으로 충분. 시각 클러터 박멸. */}
              {/* P0-4 (2026-05-28 PM) — KeywordTags hashtag chip 제거.
                  Daily 패턴에 hashtag 없음. 같은 정보가 본문 <strong> 형광펜으로 노출되므로 중복. */}

              {/* P0-6 (2026-05-28 PM) — "結 이 사주의 핵심" 카드 제거.
                  Daily 패턴: 한 줄 결론 + SECTION 01 으로 충분 — 같은 summary 가 TopicConclusionDark + SECTION 01 본문에 중복 노출되던 클러터 해결. */}

              {/* ── 세부 역량 레이더 ── */}
              <SubScoreRadar subScores={result.topicData?.subScores} color={topic.color} />

              {/* ── 강점 / 주의점 ── */}
              <StrengthsCautions strengths={result.topicData?.strengths} cautions={result.topicData?.cautions} color={topic.color} />

              {/* ── 주제별 시각화 카드 ── */}
              <TopicViz topicId={topicId || ''} data={result.topicData} color={topic.color} sajuData={selected?.sajuData} birthYear={selected?.input?.birthYear} myName={selected?.name} partnerName={(result as any)?.partnerName || partnerInfo.name || undefined} />

              {/* 2026-05-28 — 성별 인지 heading swap: 남성→'처가', 여성→'시댁'. user 피드백: "남자면 시댁 관계 X" */}
              {(() => { void 0; return null; })()}
              {/* ── 섹션들 — 5 주제는 TopicSection 래핑, 그 외는 기존 디자인 ── */}
              {/* 2026-05-28 — FadeIn delay 제거 (뚝뚝 끊김 X) + isLoading={!contentReady} 스켈레톤 도입.
                  결과 페이지 진입 즉시 sections heading 다 노출, body 만 600ms shimmer 후 본문 교체. */}
              {/* 2026-05-29 — 스켈레톤 스캐폴드. 스트리밍 중 "빈 화면 → 갑툭튀" 박멸.
                  도착 전 섹션도 헤더 + 스켈레톤으로 미리 그려 전체 구조를 즉시 노출 (회사형 skeleton screen).
                  loading = 콘텐츠 미도착 OR 글로벌 1200ms 미경과 → 진입 즉시 전체 스켈레톤, 이후 도착순 콘텐츠 교체. */}
              {(() => {
                const SECTION_HANJA = ['·一語', '·三月', '·一年', '·終身', '·處方', '·神算', '·實踐', '·豫測', '·要訣', '·開運'];
                const liveSections: any[] = Array.isArray(result.sections) ? result.sections : [];
                const lookupKey = topicId === 'moving' ? 'move' : (topicId || '');
                const expectedTitles = TOPIC_SECTION_TITLES[lookupKey] || [];
                /* 🚨 2026-09-15 — 서버가 상황(changeType·jobStatus·relationStatus·movePurpose·상대정보)에
                 *   따라 섹션 제목을 바꾸므로(claudeTopic.ts effectiveSections), 하드코딩 미러를 그대로 쓰면
                 *   로딩 중 상황과 안 맞는 옛 제목이 깜빡 보인다(예: 첫 취준생에게 '이직 후 3개월 적응 전망').
                 *   미러를 서버와 이중 관리하면 drift 가 나므로, 해당 상황에서는 제목만 비우고
                 *   서버가 실제 heading 을 보내면 그때 채운다. 슬롯 수·진행 표시는 그대로 유지. */
                const situationDynamic =
                  (lookupKey === 'exam' && !!extraInfo.changeType) ||
                  (lookupKey === 'marriage' && (relationStatus === 'dating' || !!(showPartner && partnerInfo.name))) ||
                  (lookupKey === 'reunion' && !(showPartner && partnerInfo.name)) ||
                  (lookupKey === 'career' && !!extraInfo.jobStatus) ||
                  (lookupKey === 'business' && !!extraInfo.bizStatus) ||
                  (lookupKey === 'move' && !!extraInfo.movePurpose) ||
                  (lookupKey === 'love' && loveStatus !== 'solo');
                const safeTitles = serverTitles && serverTitles.length > 0 ? serverTitles : (situationDynamic ? [] : expectedTitles);
                const slotCount = Math.max(serverTitles?.length || expectedTitles.length, liveSections.length);
                if (slotCount === 0) return null;
                const scaffold = Array.from({ length: slotCount }, (_, i) => {
                  const live = liveSections[i];
                  const hasContent = !!(live && typeof live.content === 'string' && live.content.trim());
                  return {
                    heading: (live && live.heading) || safeTitles[i] || `섹션 ${i + 1}`,
                    highlight: live?.highlight,
                    content: live?.content || '',
                    insightCards: live?.insightCards,
                    loading: !hasContent || !contentReady,
                  };
                });
                return scaffold.map((sec, i) =>
                  theme ? (
                    <FadeIn key={i}>
                      {/* SECTION 카드 cream bg 통일 (globals.css .topic-analysis-page .card SSOT) */}
                      <div className="card">
                        <TopicSection
                          theme={theme}
                          collapsible
                          defaultOpen={i < 2}
                          isLoading={sec.loading}
                          num={hanjaNum(i + 1)}
                          title={swapGenderedTerms(sec.heading, selected?.input?.gender)}
                          hanjaSuffix={SECTION_HANJA[i] || '·一語'}
                          sub={sec.highlight ? swapGenderedTerms(stripMd(sec.highlight), selected?.input?.gender) : undefined}
                        >
                          <SectionBody content={swapGenderedTerms(sec.content, selected?.input?.gender)} color={topic.color} />
                          <InsightCards cards={sec.insightCards?.map((c: any) => ({ ...c, label: swapGenderedTerms(c.label, selected?.input?.gender), value: swapGenderedTerms(c.value, selected?.input?.gender) }))} color={topic.color} />
                        </TopicSection>
                      </div>
                    </FadeIn>
                  ) : (
                    <FadeIn key={i}>
                      <TopicCollapsibleCard
                        index={i + 1}
                        title={swapGenderedTerms(sec.heading, selected?.input?.gender)}
                        color={topic.color}
                        defaultOpen={i < 2}
                      >
                        {sec.loading ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div className="topic-skel-line" style={{ width: '92%' }} />
                            <div className="topic-skel-line" style={{ width: '78%' }} />
                            <div className="topic-skel-line" style={{ width: '88%' }} />
                          </div>
                        ) : (
                          <>
                            {sec.highlight && (
                              <div className="mb-3 rounded-xl py-2.5 px-3" style={{ background: `${topic.color}08` }}>
                                <p className="text-[12px] font-semibold leading-snug" style={{ color: topic.color }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(swapGenderedTerms(sec.highlight, selected?.input?.gender)) }} />
                              </div>
                            )}
                            <SectionBody content={swapGenderedTerms(sec.content, selected?.input?.gender)} color={topic.color} />
                            <InsightCards cards={sec.insightCards?.map((c: any) => ({ ...c, label: swapGenderedTerms(c.label, selected?.input?.gender), value: swapGenderedTerms(c.value, selected?.input?.gender) }))} color={topic.color} />
                          </>
                        )}
                      </TopicCollapsibleCard>
                    </FadeIn>
                  )
                );
              })()}

              {/* ── 타임라인 — AreaChart + 설명 ── */}
              {result.timeline?.length > 0 && (
                <FadeIn delay={0.1}>
                  <div className="card">
                    <p className="text-h3 text-text-primary mb-3">시기별 흐름</p>
                    <div className="h-36 -mx-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={result.timeline.map((t: any) => ({ name: t.period, 점수: t.score || 5 }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`topicGrad-${topicId}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={topic.color} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={topic.color} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-hint)' }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: 'var(--text-disabled)' }} axisLine={false} tickLine={false} />
                          <Area type="monotone" dataKey="점수" stroke={topic.color} strokeWidth={2}
                            fill={`url(#topicGrad-${topicId})`}
                            dot={{ r: 3, fill: topic.color, strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: topic.color, stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 space-y-1.5 border-t border-border-light pt-3">
                      {result.timeline.map((t: any, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[11px] font-bold mt-0.5 w-14 flex-shrink-0 text-right" style={{ color: topic.color }}>{t.period}</span>
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: topic.color }} />
                          <p className="text-[11px] text-text-muted flex-1" dangerouslySetInnerHTML={{ __html: sanitizeAiText(t.description) }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* ── 행운 프로필 ── */}
              {result.luckyProfile && (() => {
                const lp = result.luckyProfile;
                const luckyHex = findLuckyColorHex(lp.color);
                const items = [
                  lp.color && { label: '행운 컬러', value: lp.color, icon: <div className="w-7 h-7 rounded-lg shadow-sm border border-white/60" style={{ background: luckyHex || '#B8965A' }} /> },
                  lp.direction && { label: '행운 방위', value: lp.direction, icon: <span className="text-[14px] font-black" style={{ color: '#B8965A' }}>方</span> },
                  lp.number && { label: '행운 숫자', value: String(lp.number), icon: <span className="text-[14px] font-black" style={{ color: '#B8965A' }}>數</span> },
                  lp.item && { label: '행운 아이템', value: lp.item, icon: <span className="text-[14px] font-black" style={{ color: '#B8965A' }}>福</span> },
                  lp.bestMonth && { label: '최적 시기', value: lp.bestMonth, icon: <span className="text-[14px] font-black" style={{ color: '#B8965A' }}>時</span> },
                ].filter(Boolean) as { label: string; value: string; icon: any }[];

                return (
                  <FadeIn delay={0.15}>
                    <div className="card-gold py-5 px-5">
                      <p className="text-h3 text-text-primary mb-3">{topic.label} 행운 프로필</p>
                      <div className="space-y-0">
                        {items.map((item) => (
                          <div key={item.label} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid rgba(184,150,90,0.12)' }}>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(184,150,90,0.1)' }}>
                              {item.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-text-hint">{item.label}</p>
                              <p className="text-[12px] font-semibold text-text-primary leading-snug">{item.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </FadeIn>
                );
              })()}

              {/* ── 핵심 조언 / 액션 — 5 주제는 PullQuote + ActionList, 그 외는 기존 ── */}
              {theme && result.actionAdvice ? (
                <FadeIn delay={0.2}>
                  <PullQuote theme={theme}>{stripMd(result.actionAdvice)}</PullQuote>
                </FadeIn>
              ) : result.actionAdvice ? (
                <FadeIn delay={0.2}>
                  <div className="card-emphasis">
                    <p className="text-label mb-2" style={{ color: topic.color }}>지금 바로 할 수 있는 것</p>
                    <p className="text-body text-text-primary leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.actionAdvice) }} />
                  </div>
                </FadeIn>
              ) : null}

              {/* ── 5 주제 한정 · 3 numbered 액션 카드 (actionItems 있을 때만) ── */}
              {theme && actionItems && actionItems.length > 0 && (
                <FadeIn delay={0.22}>
                  <TopicSection
                    theme={theme}
                    num="지금 할 수 있는 일"
                    title="3가지 실천"
                    hanjaSuffix="·三行"
                  >
                    <TopicActionList theme={theme} items={actionItems} />
                  </TopicSection>
                </FadeIn>
              )}

              {/* 2026-05-21 — "주제 프리미엄" 업셀 제거 (없는 상품이라 오해 소지 · 준기 결정).
                  종합사주(10운) CTA 는 홈에서 별도 안내. 여기선 노출 X. */}

              {/* ── 5 주제 한정 · TopicSourceCite (풀이 근거 출처) ── */}
              {theme && result.citation && (
                <div style={{ margin: '0 -20px' }}>
                  <TopicSourceCite theme={theme} citation={stripMd(String(result.citation))} />
                </div>
              )}

              {/* 2026-10-09 — NEXT: 이 결과에서 이어지는 주제 2 + 사주대화 질문 3 (서버 nextHooks · 다 쓴 뒤에만) */}
              {streamComplete && !result.__partial && result.nextHooks && (() => {
                const nh = result.nextHooks;
                const nextProfileId = selected ? ((selected as any).profileId || selected.id) : undefined;
                return (
                  <div className="pt-2">
                    <NextStepsCard
                      topics={Array.isArray(nh.topics) ? nh.topics : []}
                      questions={Array.isArray(nh.chatQuestions) ? nh.chatQuestions : []}
                      onTopic={(id) => navigate(`/topic/${id}`, nextProfileId ? { state: { profileId: nextProfileId } } : undefined)}
                      onAsk={(q) => { void openChatWithResult({ navigate, name: selected?.name || '나', profile: selected, ctx: { type: 'topic', label: topic.label, fullResult: result }, question: q }); }}
                    />
                  </div>
                );
              })()}

              {/* 2026-10-10 — 실제 후기 수집 (다 쓴 뒤에만 · 결과 1건당 한 번) */}
              {streamComplete && !result.__partial && (
                <ReviewAsk contentType="topic" contentLabel={topic.label}
                  reportKey={savedReportId || `topic:${topicId}:${selected ? ((selected as any).profileId || selected.id) : ''}`}
                  style={{ margin: '8px 0 0' }} />
              )}

              {/* ── 다른 주제 CTA — audit 3 P0 E4 ──
                  · navigate 만 호출 (race condition 제거 — 라우터 pathname 변경 시 컴포넌트 재마운트 → state 자동 초기화)
                  · min-height 56px (audit 4 P1 D6)
                  · 🚨 2026-09-17 — 결과 무관 고정 family 순서 → 주제 간 연결 우선 4칸:
                    ① topics.ts excludedScope.redirectTo (이 주제가 다루지 않아 넘기는 인접 주제 — 예: 합격·이직→직업·사업)
                    ② 같은 그룹  ③ 인기순(재물·연애·재회 사용량 최상위 → 합격 HOT …). 자기 자신 제외.
                  · 가격 SSOT(formatPriceLabel) 표기 + 같은 프로필로 이어가도록 state.profileId 전달 */}
              <div className="space-y-2 pt-2">
                <p className="text-label text-text-hint text-center">{streamComplete && result.nextHooks?.topics?.length > 0 ? '다른 주제 더 보기' : '다른 운세도 궁금하다면'}</p>
                {/* 2026-10-04 궁합 공개 — 연애·재회·결혼 결과에서 '그 사람과의 궁합'으로 바로 연결 */}
                {['love', 'reunion', 'marriage'].includes(String(normalizeTopicId(topicId))) && (
                  <button
                    onClick={() => navigate('/compat')}
                    className="card w-full py-3 px-3 flex items-center gap-2"
                    style={{ minHeight: 56 }}
                  >
                    <span style={{ width: 20, textAlign: 'center', fontWeight: 900, color: '#8C6D3D', fontFamily: "'Noto Serif KR', serif" }}>合</span>
                    <span className="flex flex-col items-start text-left" style={{ minWidth: 0 }}>
                      <span className="text-[14px] font-semibold text-text-primary">그 사람과의 궁합 보기</span>
                      <span className="text-[11px] text-text-hint">두 사람 사주가 맞물리는 자리 · 1운</span>
                    </span>
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const cur = normalizeTopicId(topicId);
                    const GROUP: Record<TopicId, string> = {
                      love: 'relation', reunion: 'relation', marriage: 'relation',
                      wealth: 'money', career: 'money', business: 'money',
                      exam: 'growth', study: 'growth',
                      health: 'life', move: 'life',
                    };
                    const POPULAR: TopicId[] = ['wealth', 'love', 'reunion', 'exam', 'career', 'marriage', 'business', 'study', 'health', 'move'];
                    const ordered: TopicId[] = [];
                    const push = (id: TopicId) => {
                      if (id !== cur && !ordered.includes(id) && (TOPICS as Record<string, unknown>)[id]) ordered.push(id);
                    };
                    if (cur) {
                      TOPIC_REGISTRY[cur].excludedScope.forEach((s) => push(s.redirectTo));
                      TOPIC_IDS.filter((id) => GROUP[id] === GROUP[cur]).forEach(push);
                    }
                    POPULAR.forEach(push);
                    // NEXT 카드에 이미 나온 주제는 타일에서 뺌 (같은 주제 두 번 X)
                    const hooked = new Set<string>(streamComplete && Array.isArray(result.nextHooks?.topics) ? result.nextHooks.topics.map((h: any) => h?.id) : []);
                    for (let i = ordered.length - 1; i >= 0; i--) if (hooked.has(ordered[i])) ordered.splice(i, 1);
                    const nextProfileId = selected ? ((selected as any).profileId || selected.id) : undefined;
                    return ordered.slice(0, 4).map((id) => {
                      const t = TOPICS[id as TopicKey];
                      if (!t) return null;
                      return (
                        <button
                          key={id}
                          onClick={() => navigate(`/topic/${id}`, nextProfileId ? { state: { profileId: nextProfileId } } : undefined)}
                          className="card py-3 px-3 flex items-center gap-2"
                          style={{ minHeight: 56 }}
                        >
                          <Pictogram k={`topic:${id as TopicKey}`} size={20} color={t.color} />
                          <span className="flex flex-col items-start text-left" style={{ minWidth: 0 }}>
                            <span className="text-[14px] font-semibold text-text-primary">{t.label}</span>
                            <span className="text-[11px] text-text-hint">{formatPriceLabel(getTopicPrice(id))}</span>
                          </span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) — DailyFortune/Dream 통일 패턴 */}
              <div className="mt-8 text-center space-y-1">
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반
                </p>
                <p className="text-[11px] italic" style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
                  <br />
                  의료·법률·재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
                </p>
              </div>

              {/* 2026-05-28 PM — user 피드백: Daily 패턴과 통일 (2-action row).
                  Daily .actions: 친구 공유 +1운 / 이 주제로 상담 이어가기 사주대화.
                  컴팩트 화이트 outlined + 골드 아이콘 + 서브타이틀 패턴. */}
              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: '1px solid rgba(184,150,90,0.18)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={async () => {
                    // 2026-05-28 PM — 결과 페이지 공유 = OG 바이럴 (보상 X). type-aware shareResult.
                    const { shareResult } = await import('@/utils/share');
                    await shareResult({
                      type: 'topic',
                      topicId: topicId,
                      topicLabel: topic.label,
                      name: selected?.name || '나',
                      reportId: topicId, // 향후: 실제 report.id 로 교체 (사용자별 deep link)
                    });
                  }}
                  style={{
                    background: '#fff',
                    border: '1px solid rgba(184,150,90,0.18)',
                    borderRadius: 12,
                    padding: '12px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8965A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>친구에게 공유하기</span>
                  <span style={{ fontSize: 11, color: '#7A7269' }}>결과 카드 송출</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // 이 주제 결과를 사주대화로 자연 연결 — 세션 생성 + 주제 컨텍스트 전달.
                    // 2026-05-28 PM — contentContext 를 createChatRoom 에 영구 저장 (며칠 후 보관함 재진입에도 복원).
                    const { createChatRoom } = await import('@/services/storage/chatStore');
                    const ctx = {
                      type: 'topic' as const,
                      label: topic.label,
                      fullResult: result,
                    };
                    const room = createChatRoom(selected?.name || '나', 'free', ctx);
                    navigate(`/chat/${room.id}`, {
                      state: {
                        profile: selected,
                        fromTopic: topicId,
                        topicLabel: topic.label,
                        contentContext: ctx,
                      },
                    });
                  }}
                  style={{
                    background: '#fff',
                    border: '1px solid rgba(184,150,90,0.18)',
                    borderRadius: 12,
                    padding: '12px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B8965A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>이 주제로 상담 이어가기</span>
                  <span style={{ fontSize: 11, color: '#7A7269' }}>사주대화</span>
                </button>
              </div>
            </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* audit 3 P0 E1 · 결제 직전 confirm — 2026-10-10 v9 한지 결제 시트
          무엇을 받는지(실제 장 제목) → 내 사주 사실 한 줄 → 걸리는 시간 → 잔액 → 버튼 하나.
          잔액이 모자라면 여기서 바로 '충전하고 바로 열기'(입력값 보존 · 돌아오면 이어서). */}
      <Modal isOpen={showConfirm} onClose={() => { setShowConfirm(false); isAnalyzingRef.current = false; }}
        title={`${selected?.name ? `${selected.name}님 ` : ''}${topic.label}${josa(topic.label, '을', '를')} 열까요?`}>
        {(() => {
          const pricing = getTopicPrice(topicId as TopicKey);
          const actualPrice = pricing.isOnSale && pricing.salePrice != null ? pricing.salePrice : pricing.regularPrice;
          const lookupKey = topicId === 'moving' ? 'move' : (topicId || '');
          const dyn =
            (lookupKey === 'exam' && !!extraInfo.changeType) ||
            (lookupKey === 'marriage' && (relationStatus === 'dating' || !!(showPartner && partnerInfo.name))) ||
            (lookupKey === 'reunion' && !(showPartner && partnerInfo.name)) ||
            (lookupKey === 'career' && !!extraInfo.jobStatus) ||
            (lookupKey === 'business' && !!extraInfo.bizStatus) ||
            (lookupKey === 'move' && !!extraInfo.movePurpose) ||
            (lookupKey === 'love' && loveStatus !== 'solo');
          const titles = dyn ? [] : (TOPIC_SECTION_TITLES[lookupKey] || []);
          const fact = confirmFact(lookupKey, (selected as any)?.sajuData);
          const r1 = (n: number) => Math.round(n * 10) / 10;
          const short = balance < actualPrice;
          const kanji = TOPIC_REGISTRY[(normalizeTopicId(lookupKey) || lookupKey) as TopicId]?.kanji || '命';
          const goCharge = () => {
            try {
              sessionStorage.setItem(PENDING_KEY, JSON.stringify({
                partnerInfo, loveStatus, relationStatus, showPartner, extraInfo, concern,
                selectedId: selected?.id,
              }));
            } catch { /* noop */ }
            import('@/services/analytics').then((a) => a.trackEvent('insufficient_balance', { type: `topic:${topicId}`, needed: actualPrice })).catch(() => {});
            setShowConfirm(false);
            isAnalyzingRef.current = false;
            navigate(`/charge?need=${actualPrice}`, { state: { message: `${topic.label}에 ${actualPrice}운이 필요해요`, returnTo: `/topic/${topicId}` } });
          };
          return (
            <>
              <div className="hj-sheet" style={{ borderRadius: 14, border: `1px solid ${HJ.line}`, padding: '0 14px 12px', marginBottom: 14 }}>
                <Pansim>{kanji} · {topic.label}</Pansim>
                {fact && (
                  <p style={{ fontSize: 15, color: HJ.ink2, lineHeight: 1.65, marginTop: 12, wordBreak: 'keep-all' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: HJ.goldText, marginRight: 6 }}>내 사주</span>{fact}
                  </p>
                )}
                {titles.length > 0 ? (
                  <ol style={{ listStyle: 'none', padding: 0, marginTop: 10, borderTop: '1px solid rgba(92,78,60,.25)' }}>
                    {titles.map((t, i) => (
                      <li key={i} style={{ display: 'flex', gap: 10, padding: '9px 2px', borderBottom: '1px solid rgba(92,78,60,.15)', fontSize: 15, fontWeight: 600, color: HJ.ink }}>
                        <span style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 900, color: HJ.seal, width: 16, flexShrink: 0 }}>{hanjaNum(i + 1)}</span>{t}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p style={{ fontSize: 15, color: HJ.ink, fontWeight: 600, marginTop: 12 }}>지금 고른 상황에 맞춘 다섯 장으로 풀어요.</p>
                )}
                <p style={{ fontSize: 13.5, color: HJ.mute, lineHeight: 1.6, marginTop: 10, wordBreak: 'keep-all' }}>
                  {topicId === 'reunion' ? '첫 풀이는 20초쯤 뜨고, 전체는 3분 안팎이에요' : '첫 풀이는 20초쯤 뜨고, 전체는 2분 안팎이에요'} — 위에서부터 차례로 채워져요.
                  {' '}다 읽고 궁금한 건 사주대화로 이어서 물어볼 수 있고, 결과는 보관함에 평생 남아요.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: HJ.card, border: `1px solid ${HJ.line}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, marginBottom: 12 }}>
                <span style={{ color: HJ.ink2 }}>내 운 <b style={{ color: HJ.ink }}>{r1(balance)}운</b></span>
                {short
                  ? <b style={{ color: HJ.seal }}>{r1(actualPrice - balance)}운 모자라요</b>
                  : <span style={{ color: HJ.ink2 }}>열고 나면 <b style={{ color: HJ.ink }}>{r1(balance - actualPrice)}운</b></span>}
              </div>
              {pricing.isOnSale && pricing.salePrice != null && (
                <p style={{ fontSize: 13.5, color: HJ.ink2, textAlign: 'center', marginBottom: 8 }}>
                  <span style={{ textDecoration: 'line-through', opacity: 0.7, marginRight: 6 }}>{pricing.regularPrice}운</span>{pricing.saleBadge}
                </p>
              )}
              <GoldCta onClick={short ? goCharge : analyze} sub={`${actualPrice}운`}>
                {short ? '충전하고 바로 열기' : `${topic.label} 열기`}
              </GoldCta>
              {short && <p style={{ fontSize: 13, color: HJ.mute, textAlign: 'center', marginTop: 8 }}>충전하면 이 화면으로 돌아와요 · 입력한 내용은 그대로예요</p>}
              <button type="button" onClick={() => { setShowConfirm(false); isAnalyzingRef.current = false; }}
                style={{ display: 'block', margin: '10px auto 0', fontSize: 14.5, color: HJ.mute, background: 'transparent', border: 0, padding: 8 }}>
                다음에 할게요
              </button>
            </>
          );
        })()}
      </Modal>

      {/* audit 3 P0 E2 · 잔액 부족 inline Modal (입력값은 sessionStorage 보존됨) */}
      {(() => {
        const need = getTopicPrice(topicId as TopicKey).actualPrice;
        return (
        <Modal isOpen={showInsufficient} onClose={() => setShowInsufficient(false)} title={`${need}운이 부족해요`}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: '#3D3D3D', lineHeight: 1.65, marginBottom: 8 }}>
              <strong style={{ color: '#A37A2E' }}>{topic.label}</strong> 분석에는 {need}운이 필요해요.
            </p>
            <p style={{ fontSize: 13, color: '#5C4A2E', lineHeight: 1.6 }}>
              지금까지 입력한 내용은 그대로 저장돼 있어요. 충전 후 돌아오면 이어서 분석할 수 있습니다.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" fullWidth onClick={() => setShowInsufficient(false)}>
              나중에
            </Button>
            <Button
              variant="gold"
              fullWidth
              onClick={() => {
                setShowInsufficient(false);
                navigate(`/charge?need=${need}`, { state: { message: `${topic.label} 분석에 ${need}운이 필요해요`, returnTo: `/topic/${topicId}` } });
              }}
            >
              충전하러 가기
            </Button>
          </div>
        </Modal>
        );
      })()}

      {/* 2026-05-07 — partner 시간 선택 시트 (InputPage HourSheet 와 디자인 통일) */}
      <HourPickerSheet
        open={hourSheetOpen}
        currentHour={partnerInfo.birthHour}
        onClose={() => setHourSheetOpen(false)}
        onSelect={(h) => {
          // 시(時) 블록 = 해당 시진 중앙 클럭값 + 분 0 (진태양시 보정 후에도 같은 시진 유지)
          // 2026-07-14 — 87/88 서머타임 출생은 중앙값 +60분 앵커 보정 (bandCenterHourForDate 주석 참조)
          setPartnerInfo((p) => {
            const adj = p.birthYear && p.birthMonth && p.birthDay
              ? bandCenterHourForDate(p.birthYear, p.birthMonth, p.birthDay, h)
              : h;
            return { ...p, birthHour: adj, birthMinute: 0 };
          });
          setHourSheetOpen(false);
        }}
        title="상대방 출생 시간"
      />
    </div>
  );
}

export { TOPICS };
