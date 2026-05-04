import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { getProfiles, saveReport, generateId, spendBalance, type LocalReport } from '@/services/storage/localStore';
import { CHEONGAN_OHENG, OHENG_MAP } from '@/constants/oheng';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/common/Toast';
import { generateTopicAnalysis } from '@/services/ai/reportGenerator';
import { AILoading } from '@/components/common/AILoading';
import { FooterCTA, type FooterCTAPageKey } from '@/components/common/FooterCTA';
import { ScoreRing } from '@/components/saju/ScoreRing';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { Pictogram, type TopicKey } from '@/components/brand/PictogramRegistry';
import { normalizeTopicId } from '@/constants/topics';
// Phase 2 Stage 2A — 공통 MonthTimeline 컴포넌트 (5 분기 wiring 시작)
import {
  MonthTimeline,
  MONTH_TIMELINE_THEMES,
  buildMonthCells,
} from './topic/_month_timeline';
// Phase D'-2 Bundle 2 (#54) — mockup 진본 시각 정렬
import {
  TOPIC_CHROME,
  TopicHero,
  TopicSajuMini,
  TopicScoreCard,
  TopicLinkCard,
  TopicSection,
  PullQuote,
  TopicActionList,
  TopicUpsellCard,
  TopicSourceCite,
  type TopicChromeKey,
  type TopicSajuMiniCell,
  type TopicLinkPill,
  type TopicActionItem,
} from './topic/_chrome';

/* ─── 주제 설정 — 이모지 제거, 브랜드 픽토그램 사용.
 *    key가 PictogramRegistry의 topic:* 와 1:1 매핑. (브랜드픽토그램_시스템.md)
 */
const TOPICS: Record<TopicKey, { label: string; color: string; desc: string }> = {
  // SSOT v1 컬러 정렬 (2026-04-22 · @/constants/topics)
  love:     { label: '연애운',       color: '#C88A95', desc: '만남·관계·인연 흐름' },
  wealth:   { label: '재물운',       color: '#B8965A', desc: '돈·투자·현금흐름 변곡' },
  career:   { label: '직업운',       color: '#5A7CA8', desc: '커리어·승진·평생 결' },
  marriage: { label: '결혼운',       color: '#C97B95', desc: '인연 시기와 배우자 결' },
  business: { label: '사업운',       color: '#A37A2E', desc: '창업·자영업 흐름과 시기' },
  health:   { label: '건강운',       color: '#6FA08C', desc: '체질·기운·주의 시기' },
  reunion:  { label: '재회운',       color: '#D89A8A', desc: '헤어진 사람과의 흐름' },
  study:    { label: '학업운',       color: '#9C5A8A', desc: '집중력·지식 흡수·학습 패턴' },
  exam:     { label: '합격·이직운', color: '#5A6FA8', desc: '시험·이직 결정 시기' }, // SSOT v1 신규
  move:     { label: '이사·이동운', color: '#4F8A8B', desc: '이사·이동 길흉 방향' }, // SSOT v1 canonical
  social:   { label: '대인관계운',   color: '#E8B82A', desc: '귀인운, 구설수 주의, 관계 패턴' }, // legacy 유지
  moving:   { label: '이사·이동운', color: '#4F8A8B', desc: '이사·이동 길흉 방향' }, // legacy — 'move' alias
};

const OHENG_COLORS: Record<string, string> = { 목: '#2D8A4E', 화: '#D32F2F', 토: '#E8B82A', 금: '#4A4A4A', 수: '#1565E0' };

/** 토픽 hex 컬러 → ExtensionHero 패턴 3-stop gradient (lighten + base + darken) */
function shadeHex(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  return `#${[adj(r), adj(g), adj(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
function topicHeroGrad(color: string): string {
  return `linear-gradient(135deg, ${shadeHex(color, 0.10)} 0%, ${color} 60%, ${shadeHex(color, -0.18)} 100%)`;
}
/** 토픽 한자 (ExtensionHero seal/워터마크) — SSOT v1 정렬 */
const TOPIC_HANJA: Record<string, string> = {
  love: '緣', wealth: '財', career: '官', marriage: '婚', business: '業',
  health: '壽', reunion: '復', study: '學', exam: '進', move: '移', moving: '移', social: '人',
};

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
  if (score >= 70) return { hanja: '吉',   reading: '길',   desc: '좋은 기운의 흐름', color: '#2D8A4E', bg: 'rgba(45,138,78,0.10)' };
  if (score >= 55) return { hanja: '平',   reading: '평',   desc: '무난한 흐름',   color: '#1565E0', bg: 'rgba(21,101,224,0.10)' };
  if (score >= 40) return { hanja: '小注意', reading: '소주의', desc: '보완이 필요한 기운', color: '#E65100', bg: 'rgba(230,81,0,0.10)' };
  return               { hanja: '要注意', reading: '요주의', desc: '적극 보완 필요', color: '#D32F2F', bg: 'rgba(211,47,47,0.10)' };
}

const LUCKY_COLOR_HEX: Record<string, string> = {
  // 빨강 계열
  빨강: '#D32F2F', 빨간색: '#D32F2F', 붉은색: '#D32F2F', 적색: '#D32F2F', 레드: '#D32F2F',
  진빨강: '#B71C1C', 와인: '#880E4F', 와인색: '#880E4F',
  // 파랑 계열
  파랑: '#1565E0', 파란색: '#1565E0', 청색: '#1565E0', 블루: '#1565E0',
  진파랑: '#0D47A1', 남색: '#1A237E', 남청색: '#1A237E', 감색: '#1A237E',
  하늘: '#42A5F5', 하늘색: '#42A5F5', 연파랑: '#42A5F5', 스카이: '#42A5F5',
  진청색: '#0D47A1', 진청: '#0D47A1',
  // 초록 계열
  초록: '#2D8A4E', 초록색: '#2D8A4E', 녹색: '#2D8A4E', 그린: '#2D8A4E',
  연두: '#7CB342', 연두색: '#7CB342',
  진초록: '#1B5E20', 짙은초록: '#1B5E20',
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
  검정: '#424242', 검은색: '#424242', 흑색: '#424242', 블랙: '#424242',
  회색: '#4A4A4A', 회색빛: '#4A4A4A', 은색: '#9E9E9E', 실버: '#9E9E9E',
  // 금색 계열
  금색: '#B8965A', 골드: '#B8965A', 금: '#B8965A', 황토: '#BF8C3E', 황토색: '#BF8C3E',
  갈색: '#795548', 브라운: '#795548', 갈: '#795548',
  베이지: '#D7CCC8', 아이보리: '#EFEBE9',
  // 보라 계열
  보라: '#7B1FA2', 보라색: '#7B1FA2', 자색: '#7B1FA2', 퍼플: '#7B1FA2',
  연보라: '#BA68C8', 라벤더: '#BA68C8',
  진보라: '#4A148C', 자주: '#AD1457', 자주색: '#AD1457',
  // 분홍 계열
  분홍: '#E91E63', 분홍색: '#E91E63', 핑크: '#E91E63',
  연분홍: '#F48FB1', 로즈: '#C62828', 장미: '#C62828',
  // 주황 계열
  주황: '#E65100', 주황색: '#E65100', 오렌지: '#E65100',
  살구: '#FF8A65', 살구색: '#FF8A65', 코랄: '#FF7043',
};

/** 행운 컬러 텍스트에서 hex 찾기 — "검은색, 진청색(수 기운)" → '#424242' */
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
  { hanja: '吉', reading: '길', range: '70~84', color: '#2D8A4E' },
  { hanja: '平', reading: '평', range: '55~69', color: '#1565E0' },
  { hanja: '小注意', reading: '소주의', range: '40~54', color: '#E65100' },
  { hanja: '要注意', reading: '요주의', range: '~39', color: '#D32F2F' },
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
        <p className="text-[10px] text-text-hint mb-2">5가지 항목별 점수 비교</p>
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
            <span key={i} className="text-[10px] text-text-muted">
              {s.axis} <strong className="font-bold" style={{ color }}>{s.value}</strong>
            </span>
          ))}
        </div>
      </div>
    </FadeIn>
  );
}

/** 핵심 키워드 태그 */
function KeywordTags({ keywords, color }: { keywords: string[]; color: string }) {
  if (!keywords?.length) return null;
  return (
    <motion.div className="flex flex-wrap gap-1.5 justify-center"
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      {keywords.map((kw, i) => (
        <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${color}10`, color, border: `1px solid ${color}20` }}>
          {kw}
        </span>
      ))}
    </motion.div>
  );
}

/** 강점 / 주의점 비주얼 카드 */
function StrengthsCautions({ strengths, cautions }: { strengths?: string[]; cautions?: string[]; color: string }) {
  if (!strengths?.length && !cautions?.length) return null;
  return (
    <FadeIn delay={0.12}>
      <div className="grid grid-cols-2 gap-3">
        {strengths?.length ? (
          <div className="rounded-2xl p-3.5" style={{ background: 'rgba(45,138,78,0.05)' }}>
            <p className="text-[10px] font-bold text-[#2D8A4E] mb-2">강점</p>
            {strengths.map((s, i) => (
              <p key={i} className="text-[11px] text-text-secondary mb-1.5 flex items-start gap-1.5">
                <span className="text-[#2D8A4E] mt-0.5 flex-shrink-0 text-[10px]">+</span>
                <span>{s}</span>
              </p>
            ))}
          </div>
        ) : <div />}
        {cautions?.length ? (
          <div className="rounded-2xl p-3.5" style={{ background: 'rgba(211,47,47,0.04)' }}>
            <p className="text-[10px] font-bold text-[#E65100] mb-2">주의할 점</p>
            {cautions.map((c, i) => (
              <p key={i} className="text-[11px] text-text-secondary mb-1.5 flex items-start gap-1.5">
                <span className="text-[#E65100] mt-0.5 flex-shrink-0 text-[10px]">!</span>
                <span>{c}</span>
              </p>
            ))}
          </div>
        ) : <div />}
      </div>
    </FadeIn>
  );
}

/* ════════════════════════════════════════════════
   주제별 시각화 컴포넌트
   ════════════════════════════════════════════════ */

function LoveViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  const it = data.idealType;
  const fields = it ? [
    { label: '성격', value: it.personality },
    { label: '직업군', value: it.job },
    { label: '나이 경향', value: it.ageGap },
    { label: '만남 장소', value: it.meetPlace },
    { label: '외모 경향', value: it.appearance },
  ].filter(r => r.value) : [];

  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 도화살 + 매력 원천 + 인연 시기 */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-h3 text-text-primary">연애 사주 프로필</p>
            {data.loveStyle && <TypeBadge label={data.loveStyle} color={color} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.doHwaSal != null && (
              <div className="rounded-xl p-3 text-center" style={{ background: data.doHwaSal ? 'rgba(233,30,99,0.06)' : 'rgba(0,0,0,0.03)' }}>
                <p className="text-[9px] text-text-hint mb-1">도화살(桃花殺)</p>
                <p className="text-[14px] font-black" style={{ color: data.doHwaSal ? '#E91E63' : 'var(--text-muted)' }}>
                  {data.doHwaSal ? '있음' : '없음'}
                </p>
              </div>
            )}
            {data.bestMeetMonth && (
              <div className="rounded-xl p-3 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-1">인연 시작 유력 시기</p>
                <p className="text-[14px] font-black" style={{ color }}>{data.bestMeetMonth}</p>
              </div>
            )}
          </div>
          {data.attractionSource && (
            <div className="mt-2.5 rounded-xl py-2.5 px-3" style={{ background: `${color}06` }}>
              <p className="text-[10px] font-semibold mb-0.5" style={{ color }}>매력의 원천</p>
              <p className="text-[12px] text-text-primary leading-snug">{data.attractionSource}</p>
            </div>
          )}
          {data.charmPoint && (
            <div className="mt-2 rounded-xl py-2.5 px-3" style={{ background: 'rgba(233,30,99,0.04)' }}>
              <p className="text-[10px] font-semibold mb-0.5" style={{ color }}>나의 매력 포인트</p>
              <p className="text-[12px] text-text-primary leading-snug">{data.charmPoint}</p>
            </div>
          )}
        </div>

        {/* 궁합 좋은 이성 */}
        {fields.length > 0 && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">사주 궁합이 잘 맞는 이성</p>
            <div className="space-y-2.5">
              {fields.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] font-bold mt-0.5 w-14 flex-shrink-0 text-right" style={{ color }}>{f.label}</span>
                  <p className="text-[12px] text-text-primary leading-snug flex-1">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 상대방 궁합 분석 (썸/연애중일 때만) */}
        {data.partnerCompat && (() => {
          const pc = data.partnerCompat;
          const ohengBg: Record<string, string> = { 목: 'rgba(45,138,78,0.10)', 화: 'rgba(211,47,47,0.10)', 토: 'rgba(232,184,42,0.10)', 금: 'rgba(74,74,74,0.10)', 수: 'rgba(21,101,224,0.10)' };
          const ohengText: Record<string, string> = { 목: '#2D8A4E', 화: '#D32F2F', 토: '#E8B82A', 금: '#4A4A4A', 수: '#1565E0' };
          const typeIcon: Record<string, { icon: string; color: string; bg: string }> = {
            '합': { icon: '合', color: '#2D8A4E', bg: 'rgba(45,138,78,0.12)' },
            '충': { icon: '沖', color: '#D32F2F', bg: 'rgba(211,47,47,0.10)' },
            '형': { icon: '刑', color: '#E65100', bg: 'rgba(230,81,0,0.10)' },
            '해': { icon: '害', color: '#E65100', bg: 'rgba(230,81,0,0.10)' },
            '상생': { icon: '生', color: '#2D8A4E', bg: 'rgba(45,138,78,0.12)' },
            '상극': { icon: '克', color: '#D32F2F', bg: 'rgba(211,47,47,0.10)' },
          };
          const getTS = (type: string) => { for (const [k, v] of Object.entries(typeIcon)) if (type?.includes(k)) return v; return { icon: '?', color: '#4A4A4A', bg: 'rgba(0,0,0,0.06)' }; };
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

              {/* 기둥 비교 */}
              {pComp && (() => {
                const renderPillar = (p: any, side: 'left' | 'right') => {
                  const oh = cleanOheng(p.oheng);
                  const bg = ohengBg[oh] || 'rgba(0,0,0,0.03)';
                  const fg = ohengText[oh] || '#3D3427';
                  return (
                    <div className={`flex-1 rounded-lg p-2 flex items-center gap-2 ${side === 'right' ? 'justify-end' : ''}`} style={{ background: bg }}>
                      {side === 'right' && <span className="text-[8px] font-semibold" style={{ color: ohengText[oh] || '#4A4A4A' }}>{oh}</span>}
                      <div className="flex gap-1">
                        <span className="w-8 h-9 rounded-md flex items-center justify-center text-[15px] font-black" style={{ background: 'rgba(255,255,255,0.7)', color: fg }}>{cleanHanja(p.cheongan)}</span>
                        <span className="w-8 h-9 rounded-md flex items-center justify-center text-[15px] font-black" style={{ background: 'rgba(255,255,255,0.5)', color: fg }}>{cleanHanja(p.jiji)}</span>
                      </div>
                      {side === 'left' && <span className="text-[8px] font-semibold" style={{ color: ohengText[oh] || '#4A4A4A' }}>{oh}</span>}
                    </div>
                  );
                };
                return (
                  <div className="mb-3">
                    <p className="text-[10px] text-text-hint mb-2 font-semibold">사주 기둥(柱) 비교</p>
                    <div className="space-y-2">
                      {[{ key: 'year', label: '년주' }, { key: 'month', label: '월주' }, { key: 'day', label: '일주' }].map(({ key, label }) => {
                        const myP = pComp.myPillars?.[key];
                        const ptP = pComp.partnerPillars?.[key];
                        const inter = interMap[key];
                        const ts = inter ? getTS(inter.type) : null;
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[9px] text-text-hint font-medium">{label}</span>
                              {ts && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full ml-auto" style={{ background: ts.bg, color: ts.color }}>{ts.icon} {inter.type}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {myP && renderPillar(myP, 'left')}
                              <div className="flex-shrink-0 w-6 flex items-center justify-center">
                                {ts ? <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: ts.bg, color: ts.color }}>{ts.icon}</span> : <span className="text-[10px] text-text-hint">vs</span>}
                              </div>
                              {ptP && renderPillar(ptP, 'right')}
                            </div>
                            {inter?.desc && <p className="text-[10px] text-text-muted mt-1 ml-1 leading-snug">{inter.desc}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 px-1" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                      <span className="text-[9px] text-text-hint">나</span>
                      <span className="text-[9px] text-text-hint">상대 (추론)</span>
                    </div>
                  </div>
                );
              })()}

              {/* 잘 맞는 점 / 안 맞는 점 */}
              {(pc.matchPoints?.length > 0 || pc.clashPoints?.length > 0) && (
                <div className="space-y-2 mb-2">
                  {pc.matchPoints?.map((m: string, i: number) => (
                    <div key={`m${i}`} className="flex items-start gap-2 rounded-lg p-2" style={{ background: 'rgba(45,138,78,0.05)' }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-black mt-0.5" style={{ background: 'rgba(45,138,78,0.12)', color: '#2D8A4E' }}>合</span>
                      <p className="text-[11px] text-text-secondary leading-snug" dangerouslySetInnerHTML={{ __html: sanitizeAiText(m) }} />
                    </div>
                  ))}
                  {pc.clashPoints?.map((c: string, i: number) => (
                    <div key={`c${i}`} className="flex items-start gap-2 rounded-lg p-2" style={{ background: 'rgba(230,81,0,0.04)' }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-black mt-0.5" style={{ background: 'rgba(230,81,0,0.10)', color: '#E65100' }}>沖</span>
                      <p className="text-[11px] text-text-secondary leading-snug" dangerouslySetInnerHTML={{ __html: sanitizeAiText(c) }} />
                    </div>
                  ))}
                </div>
              )}

              {/* 상대방 연애 스타일 */}
              {pc.partnerLoveStyle && (
                <div className="rounded-xl py-2 px-3" style={{ background: `${color}05`, borderLeft: `3px solid ${color}30` }}>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color }}>상대방의 연애 스타일</p>
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

  // Stage 2B-1: MonthTimeline 12 셀 cells 빌드 (mockup month-tl 진본 패턴)
  const monthTimelineCells = useMemo(() => {
    if (!monthly.length) return [];
    const scores = Array.from({ length: 12 }, (_, i) => {
      const found = monthly.find((m: any) => {
        const mNum = typeof m.month === 'string' ? parseInt(m.month) : m.month;
        return mNum === i + 1;
      });
      if (!found) return 50; // plain 기본
      return typeof found.score === 'number' ? found.score : parseInt(found.score) || 50;
    });
    return buildMonthCells(scores, {
      currentMonth: new Date().getMonth() + 1,
    });
  }, [monthly]);

  // Stage 2B-1: Donut 4분면 재물 분포 — wealthType 기반 inference (data 0 변경 정책)
  const incomeDistribution = useMemo(() => {
    // 서버 응답에 incomeSources 직접 있으면 사용 (forward-compat)
    if (data.incomeSources && typeof data.incomeSources === 'object') {
      // ?? 만 사용 (|| 마스킹 제거) — AI 가 0 반환 시 0 보존, undefined 만 0 으로 fallback
      // (이전: `?? 0 || 50` 이중 fallback 으로 0 → 50 마스킹 발생)
      const s = data.incomeSources;
      return [
        { key: 'main',    label: '본업',    hanja: '本業', value: Number(s.main ?? 0),    color: '#B8965A' },
        { key: 'invest',  label: '투자',    hanja: '投資', value: Number(s.invest ?? 0),  color: '#1565E0' },
        { key: 'side',    label: '사이드',   hanja: '副業', value: Number(s.side ?? 0),    color: '#2D8A4E' },
        { key: 'inherit', label: '상속·기타', hanja: '其他', value: Number(s.inherit ?? 0), color: '#9C5A8A' },
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
      { key: 'invest',  label: '투자',    hanja: '投資', value: dist.invest,  color: '#1565E0' },
      { key: 'side',    label: '사이드',   hanja: '副業', value: dist.side,    color: '#2D8A4E' },
      { key: 'inherit', label: '상속·기타', hanja: '其他', value: dist.inherit, color: '#9C5A8A' },
    ];
  }, [data.incomeSources, data.wealthType]);
  const isInferredDist = !data.incomeSources;

  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">

        {/* 재물 역량 3축 게이지 */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-h3 text-text-primary">재물 역량 분석</p>
            {data.wealthType && <TypeBadge label={data.wealthType} color={color} />}
          </div>
          <div className="space-y-2.5">
            {data.earningPower != null && <HBar value={data.earningPower} label="수익력 — 돈 벌어오는 힘" color="#2D8A4E" />}
            {data.savingPower != null && <HBar value={data.savingPower} label="저축력 — 돈 모으는 힘" color="#1565C0" />}
            {data.spendingRisk != null && <HBar value={data.spendingRisk} label="지출위험 — 돈 새는 위험도" color="#D32F2F" suffix=" (높을수록 위험)" />}
          </div>
        </div>

        {/* 재성 구조 + 핵심 수치 대시보드 */}
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">재물 핵심 지표</p>
          <div className="grid grid-cols-2 gap-2">
            {data.jaeseongType && (
              <div className="rounded-xl p-3" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-1">재성(財星) 구조</p>
                <p className="text-[13px] font-black" style={{ color }}>{data.jaeseongType}</p>
                {data.jaeseongDesc && <p className="text-[10px] text-text-muted mt-1 leading-snug">{data.jaeseongDesc}</p>}
              </div>
            )}
            {data.wealthPeakPeriod && (
              <div className="rounded-xl p-3" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-1">재물 전성기</p>
                <p className="text-[13px] font-black" style={{ color }}>{data.wealthPeakPeriod}</p>
                <p className="text-[10px] text-text-muted mt-1">이 시기에 자산이 가장 크게 불어요</p>
              </div>
            )}
            {data.investStyle && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(21,101,224,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-1">투자 성향</p>
                <p className="text-[13px] font-black text-[#1565C0]">{data.investStyle}</p>
              </div>
            )}
            {data.bestInvestMonth && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <div className="flex items-center gap-1 mb-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01z" /></svg>
                  <p className="text-[9px] text-text-hint">올해 투자 적기</p>
                </div>
                <p className="text-[13px] font-black text-[#2D8A4E]">{data.bestInvestMonth}</p>
              </div>
            )}
          </div>
          {data.wealthFlow && (
            <div className="mt-2 rounded-lg py-2 px-3 flex items-center gap-2" style={{ background: `${color}05` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              <p className="text-[11px] text-text-secondary">올해 재물 흐름: <strong style={{ color }}>{data.wealthFlow}</strong></p>
            </div>
          )}
        </div>

        {/* 월별 재물 흐름 차트 */}
        {monthly.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-h3 text-text-primary">월별 재물 흐름</p>
              {data.dangerMonths && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(211,47,47,0.08)', color: '#D32F2F' }}>
                  주의: {data.dangerMonths}
                </span>
              )}
            </div>
            <p className="text-[10px] text-text-hint mb-3">올해 12개월 재물 에너지 추이</p>
            <div className="h-[150px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly.map((m: any) => ({ ...m, score: typeof m.score === 'number' ? m.score : parseInt(m.score) || 0 }))} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#999' }} tickLine={false} axisLine={false}
                    tickFormatter={(v: string) => v.replace('월', '')} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#999' }} tickLine={false} axisLine={false} />
                  <Area type="monotone" dataKey="score" stroke={color} fill="url(#wealthGrad)"
                    strokeWidth={2} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* 베스트/워스트 월 */}
            {bestMonth && worstMonth && (
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01z" /></svg>
                  <span className="text-[10px] text-text-muted">최고: <strong className="text-[#2D8A4E]">{bestMonth} ({bestScore}점)</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <span className="text-[10px] text-text-muted">주의: <strong className="text-[#D32F2F]">{worstMonth} ({worstScore}점)</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 2B-1: MonthTimeline — mockup `month-tl` 진본 12 셀 grid (재물 강도 4-tier) */}
        {monthTimelineCells.length > 0 && (
          <MonthTimeline
            cells={monthTimelineCells}
            title="월별 재물 지수"
            hanjaSuffix="年運"
            subtitle={
              data.wealthFlow
                ? `${data.wealthFlow} · 강(70+) · 중(50~) · 평이(30~) · 주의(<30)`
                : '강 / 중 / 평이 / 주의 — 4-tier 재물 강도'
            }
            theme={MONTH_TIMELINE_THEMES.wealth}
            legendLabels={{ high: '강', mid: '중', low: '주의', plain: '평이' }}
          />
        )}

        {/* Stage 2B-1: Donut 4분면 재물 분포 — mockup `donut` 패턴 (자체 SVG, recharts 회피) */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <p className="text-h3 text-text-primary">돈이 들어오는 통로</p>
            {isInferredDist && (
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(122,114,105,0.10)', color: '#7A7269' }}
                title="서버 응답에 incomeSources 누락 — wealthType 기반 추정값"
              >
                추정
              </span>
            )}
          </div>
          <p className="text-[10px] text-text-hint mb-3">
            본업·투자·사이드·기타 — 4 통로의 비중
          </p>
          <IncomeDonut segments={incomeDistribution} accentColor={color} />
        </div>

        {/* Stage 2B-2: 평생 재물 흐름 — 8 대운 60년 timeline */}
        {sajuData?.daeun && Array.isArray(sajuData.daeun) && sajuData.daeun.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-h3 text-text-primary">평생 재물 흐름</p>
              <span className="text-[9px] text-text-hint">大運 · 10년 단위</span>
            </div>
            <p className="text-[10px] text-text-hint mb-3">
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
              <span className="text-[9px] text-text-hint">人脈</span>
            </div>
            <p className="text-[10px] text-text-hint mb-3">
              사주 십성에서 도출 — 도와주는 사람 / 부딪히는 사람 / 평온한 사람
            </p>
            <RelflowCards sipsung={sajuData.sipsung} />
          </div>
        )}

        {/* 돈 새는 함정 경고 */}
        {data.moneyLeakTrap && (
          <div className="card" style={{ borderLeft: '3px solid #E65100' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E65100" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[12px] font-bold text-[#E65100]">돈 새는 핵심 함정</p>
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
              <span style={{ fontSize: 9.5, color: '#7A7269', fontFamily: "'Noto Serif KR', serif" }}>{s.hanja}</span>
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
  const currentAge = new Date().getFullYear() - birthYear;
  const cells = (daeun || []).slice(0, 8).map((d: any) => {
    const gan = String(d.간지 ?? '').charAt(0);
    const sipsung = deriveSipsungLocal(ilgan, gan);
    const intensity = WEALTH_SIPSUNG_INTENSITY[sipsung] ?? 50;
    const isCurrent =
      d.isCurrent === true || (currentAge >= d.시작나이 && currentAge <= d.끝나이);
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
              flex: '0 0 auto',
              minWidth: 64,
              padding: '8px 4px',
              background: c.isCurrent ? 'rgba(184,150,90,0.10)' : '#FFFFFF',
              border: c.isCurrent ? '2px solid #B8965A' : '1px solid rgba(184,150,90,0.18)',
              borderRadius: 8,
              textAlign: 'center',
              boxShadow: c.isCurrent ? '0 2px 8px rgba(184,150,90,0.20)' : 'none',
              position: 'relative',
            }}
            title={`${c.startAge}~${c.endAge}세 · ${c.ganji} · ${c.sipsung || '—'} (재물 ${c.intensity})`}
          >
            {isPeak && (
              <span aria-hidden style={{ position: 'absolute', top: -6, right: -2, fontSize: 11, color: accentColor }}>
                ★
              </span>
            )}
            <div style={{ fontSize: 9, fontWeight: 700, color: c.isCurrent ? '#8C6D3D' : '#7A7269', marginBottom: 4 }}>
              {c.startAge}~{c.endAge}세
            </div>
            <div
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 16,
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
                  marginTop: 4,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: tone,
                  color: fg,
                  fontSize: 8.5,
                  fontWeight: 700,
                }}
              >
                {c.sipsung}
              </div>
            )}
            {/* 재물 강도 mini bar */}
            <div style={{ height: 3, marginTop: 6, background: '#F0ECE1', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${c.intensity}%`, background: tone === 'rgba(198,40,40,0.18)' ? '#D32F2F' : (c.intensity >= 70 ? accentColor : '#8C6D3D') }} />
            </div>
            {c.isCurrent && (
              <div style={{ fontSize: 7, fontWeight: 800, color: '#8C6D3D', marginTop: 3, letterSpacing: '0.05em' }}>
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
    color: '#2D8A4E',
    bg: 'rgba(45,138,78,0.06)',
    border: 'rgba(45,138,78,0.30)',
    sipsungs: ['정인', '편인', '식신', '상관'] as const,
    desc: '인성·식상 — 돈 굴리는 지혜와 재능을 주는 사람',
  },
  {
    key: 'rival',
    label: '부딪히는 사람',
    hanja: '爭',
    color: '#D32F2F',
    bg: 'rgba(211,47,47,0.06)',
    border: 'rgba(211,47,47,0.30)',
    sipsungs: ['비견', '겁재'] as const,
    desc: '비겁 — 같은 자리를 노리는 경쟁자, 돈 다투는 결',
  },
  {
    key: 'peace',
    label: '평온한 사람',
    hanja: '安',
    color: '#1565E0',
    bg: 'rgba(21,101,224,0.06)',
    border: 'rgba(21,101,224,0.30)',
    sipsungs: ['정관', '편관', '정재', '편재'] as const,
    desc: '관성·재성 — 책임과 실리를 함께 나누는 자리',
  },
];

function RelflowCards({ sipsung }: { sipsung: any[] }) {
  // 십성 카운트
  const counts: Record<string, number> = {};
  for (const s of sipsung || []) {
    if (!s.십성 || s.십성 === '일주' || s.십성 === '日主') continue;
    const parts = String(s.십성).split('/');
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed) counts[trimmed] = (counts[trimmed] ?? 0) + 1;
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {RELFLOW_CATEGORIES.map((cat) => {
        const total = cat.sipsungs.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
        const dominant = cat.sipsungs.reduce(
          (max, s) => ((counts[s] ?? 0) > (counts[max] ?? 0) ? s : max),
          cat.sipsungs[0],
        );
        return (
          <div
            key={cat.key}
            style={{
              background: cat.bg,
              border: `1px solid ${cat.border}`,
              borderRadius: 10,
              padding: '10px 8px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 18,
                fontWeight: 800,
                color: cat.color,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {cat.hanja}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A', marginBottom: 2 }}>
              {cat.label}
            </div>
            <div style={{ fontSize: 9, color: '#7A7269', lineHeight: 1.4, marginBottom: 6 }}>
              {cat.desc}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: cat.color,
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {total}
              </span>
              <span style={{ fontSize: 9, color: '#7A7269' }}>개</span>
            </div>
            {total > 0 && (
              <div style={{ fontSize: 9, color: cat.color, fontWeight: 700, marginTop: 2 }}>
                주력 · {dominant}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CareerViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 직종 적합도 */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-h3 text-text-primary">직종 적합도 TOP 5</p>
            {data.workStyle && <TypeBadge label={data.workStyle} color={color} />}
          </div>
          {data.careerFit?.length > 0 && (
            <div className="space-y-2">
              {data.careerFit.map((c: any, i: number) => (
                <HBar key={i} value={c.fitPercent || 0} label={c.job || ''} color={color} suffix="%" />
              ))}
            </div>
          )}
        </div>
        {/* 현재 상태 분석 + 관심 분야 적합도 (입력 시) */}
        {(data.statusAnalysis || data.fieldFitScore != null) && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">맞춤 분석</p>
            {data.statusAnalysis && (
              <div className="rounded-xl py-2.5 px-3 mb-2" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
                <p className="text-[10px] font-bold mb-0.5" style={{ color }}>현재 상태 분석</p>
                <p className="text-[12px] text-text-primary leading-snug">{data.statusAnalysis}</p>
              </div>
            )}
            {data.fieldFitScore != null && (
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.015)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold" style={{ color }}>관심 분야 적합도</p>
                  <span className="text-[14px] font-black" style={{ color }}>{data.fieldFitScore}<span className="text-[10px]">점</span></span>
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
              <div className="mt-2 rounded-xl py-2 px-3" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[10px] text-text-hint">이직 최적 시기: <strong className="text-[#2D8A4E]">{data.jobChangeTiming}</strong></p>
              </div>
            )}
          </div>
        )}

        {/* 면접 + 연봉 전략 카드 */}
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">면접 / 연봉 전략</p>
          <div className="grid grid-cols-2 gap-2">
            {data.interviewDay && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">면접 유리 요일</p>
                <p className="text-[12px] font-bold" style={{ color }}>{data.interviewDay}</p>
              </div>
            )}
            {data.interviewTime && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">면접 유리 시간</p>
                <p className="text-[12px] font-bold" style={{ color }}>{data.interviewTime}</p>
              </div>
            )}
            {data.salaryTiming && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">연봉 협상 적기</p>
                <p className="text-[12px] font-bold text-[#2D8A4E]">{data.salaryTiming}</p>
              </div>
            )}
            {data.bossCompat && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(21,101,224,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">맞는 상사 유형</p>
                <p className="text-[12px] font-bold text-[#1565C0]">{data.bossCompat}</p>
              </div>
            )}
          </div>
          {data.interviewTip && (
            <div className="mt-2.5 rounded-xl py-2.5 px-3" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
              <p className="text-[10px] font-bold mb-0.5" style={{ color }}>면접 꿀팁</p>
              <p className="text-[12px] text-text-primary leading-snug">{data.interviewTip}</p>
            </div>
          )}
        </div>
      </div>
    </FadeIn>
  );
}

function MarriageViz({ data, color }: { data: any; color: string }) {
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
        {/* 결혼 핵심 수치 */}
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">결혼 핵심 분석</p>
          <div className="grid grid-cols-3 gap-2">
            {data.marriageAge && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">결혼 적령기</p>
                <p className="text-[13px] font-black" style={{ color }}>{data.marriageAge}</p>
              </div>
            )}
            {tm?.urgency && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">시급도</p>
                <p className="text-[13px] font-black" style={{ color }}>{tm.urgency}</p>
              </div>
            )}
            {data.inlawsCompat && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: data.inlawsCompat === '주의' ? 'rgba(230,81,0,0.06)' : `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">시댁/처가 궁합</p>
                <p className="text-[13px] font-black" style={{ color: data.inlawsCompat === '주의' ? '#E65100' : color }}>{data.inlawsCompat}</p>
              </div>
            )}
          </div>
          {tm?.bestPeriod && (
            <div className="mt-2.5 rounded-xl py-2.5 px-3 flex items-center gap-3" style={{ background: `${color}06` }}>
              <p className="text-[10px] font-semibold" style={{ color }}>결혼 적기</p>
              <p className="text-[13px] text-text-primary font-bold flex-1">{tm.bestPeriod}</p>
            </div>
          )}
          {data.weddingLuckMonth && (
            <div className="mt-2 rounded-xl py-2 px-3" style={{ background: 'rgba(45,138,78,0.05)' }}>
              <p className="text-[10px] text-text-hint">결혼식 유리 월: <strong className="text-[#2D8A4E]">{data.weddingLuckMonth}</strong></p>
            </div>
          )}
        </div>

        {/* 배우자 프로필 */}
        {fields.length > 0 && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">사주로 본 배우자상</p>
            <div className="space-y-2.5">
              {fields.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] font-bold mt-0.5 w-14 flex-shrink-0 text-right" style={{ color }}>{f.label}</span>
                  <p className="text-[12px] text-text-primary leading-snug flex-1">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 갈등 패턴 경고 */}
        {data.conflictPattern && (
          <div className="card" style={{ borderLeft: '3px solid #E65100' }}>
            <p className="text-[10px] font-bold text-[#E65100] mb-1">부부 갈등 핵심 패턴</p>
            <p className="text-[12px] text-text-primary leading-snug">{data.conflictPattern}</p>
          </div>
        )}

        {/* 상대방 궁합 분석 (연애중일 때만) */}
        {data.partnerCompat && (() => {
          const pc = data.partnerCompat;
          const ohengBg: Record<string, string> = { 목: 'rgba(45,138,78,0.10)', 화: 'rgba(211,47,47,0.10)', 토: 'rgba(232,184,42,0.10)', 금: 'rgba(74,74,74,0.10)', 수: 'rgba(21,101,224,0.10)' };
          const ohengText: Record<string, string> = { 목: '#2D8A4E', 화: '#D32F2F', 토: '#E8B82A', 금: '#4A4A4A', 수: '#1565E0' };
          const typeIcon: Record<string, { icon: string; color: string; bg: string }> = {
            '합': { icon: '合', color: '#2D8A4E', bg: 'rgba(45,138,78,0.12)' },
            '충': { icon: '沖', color: '#D32F2F', bg: 'rgba(211,47,47,0.10)' },
            '형': { icon: '刑', color: '#E65100', bg: 'rgba(230,81,0,0.10)' },
            '해': { icon: '害', color: '#E65100', bg: 'rgba(230,81,0,0.10)' },
            '상생': { icon: '生', color: '#2D8A4E', bg: 'rgba(45,138,78,0.12)' },
            '상극': { icon: '克', color: '#D32F2F', bg: 'rgba(211,47,47,0.10)' },
          };
          const getTS = (type: string) => { for (const [k, v] of Object.entries(typeIcon)) if (type?.includes(k)) return v; return { icon: '?', color: '#4A4A4A', bg: 'rgba(0,0,0,0.06)' }; };
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

              {/* 기둥 비교 */}
              {pComp && (() => {
                const renderPillar = (p: any, side: 'left' | 'right') => {
                  const oh = cleanOheng(p.oheng);
                  const bg = ohengBg[oh] || 'rgba(0,0,0,0.03)';
                  const fg = ohengText[oh] || '#3D3427';
                  return (
                    <div className={`flex-1 rounded-lg p-2 flex items-center gap-2 ${side === 'right' ? 'justify-end' : ''}`} style={{ background: bg }}>
                      {side === 'right' && <span className="text-[8px] font-semibold" style={{ color: ohengText[oh] || '#4A4A4A' }}>{oh}</span>}
                      <div className="flex gap-1">
                        <span className="w-8 h-9 rounded-md flex items-center justify-center text-[15px] font-black" style={{ background: 'rgba(255,255,255,0.7)', color: fg }}>{cleanHanja(p.cheongan)}</span>
                        <span className="w-8 h-9 rounded-md flex items-center justify-center text-[15px] font-black" style={{ background: 'rgba(255,255,255,0.5)', color: fg }}>{cleanHanja(p.jiji)}</span>
                      </div>
                      {side === 'left' && <span className="text-[8px] font-semibold" style={{ color: ohengText[oh] || '#4A4A4A' }}>{oh}</span>}
                    </div>
                  );
                };
                return (
                  <div className="mb-3">
                    <p className="text-[10px] text-text-hint mb-2 font-semibold">사주 기둥(柱) 비교</p>
                    <div className="space-y-2">
                      {[{ key: 'year', label: '년주' }, { key: 'month', label: '월주' }, { key: 'day', label: '일주' }].map(({ key, label }) => {
                        const myP = pComp.myPillars?.[key];
                        const ptP = pComp.partnerPillars?.[key];
                        const inter = interMap[key];
                        const ts = inter ? getTS(inter.type) : null;
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[9px] text-text-hint font-medium">{label}</span>
                              {ts && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full ml-auto" style={{ background: ts.bg, color: ts.color }}>{ts.icon} {inter.type}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {myP && renderPillar(myP, 'left')}
                              <div className="flex-shrink-0 w-6 flex items-center justify-center">
                                {ts ? <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: ts.bg, color: ts.color }}>{ts.icon}</span> : <span className="text-[10px] text-text-hint">vs</span>}
                              </div>
                              {ptP && renderPillar(ptP, 'right')}
                            </div>
                            {inter?.desc && <p className="text-[10px] text-text-muted mt-1 ml-1 leading-snug">{inter.desc}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 px-1" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                      <span className="text-[9px] text-text-hint">나</span>
                      <span className="text-[9px] text-text-hint">상대 (추론)</span>
                    </div>
                  </div>
                );
              })()}

              {/* 잘 맞는 점 / 안 맞는 점 */}
              {(pc.matchPoints?.length > 0 || pc.clashPoints?.length > 0) && (
                <div className="space-y-2 mb-2">
                  {pc.matchPoints?.map((m: string, i: number) => (
                    <div key={`m${i}`} className="flex items-start gap-2 rounded-lg p-2" style={{ background: 'rgba(45,138,78,0.05)' }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-black mt-0.5" style={{ background: 'rgba(45,138,78,0.12)', color: '#2D8A4E' }}>合</span>
                      <p className="text-[11px] text-text-secondary leading-snug" dangerouslySetInnerHTML={{ __html: sanitizeAiText(m) }} />
                    </div>
                  ))}
                  {pc.clashPoints?.map((c: string, i: number) => (
                    <div key={`c${i}`} className="flex items-start gap-2 rounded-lg p-2" style={{ background: 'rgba(230,81,0,0.04)' }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-black mt-0.5" style={{ background: 'rgba(230,81,0,0.10)', color: '#E65100' }}>沖</span>
                      <p className="text-[11px] text-text-secondary leading-snug" dangerouslySetInnerHTML={{ __html: sanitizeAiText(c) }} />
                    </div>
                  ))}
                </div>
              )}

              {/* 상대방 결혼관 */}
              {pc.partnerMarriageStyle && (
                <div className="rounded-xl py-2 px-3" style={{ background: `${color}05`, borderLeft: `3px solid ${color}30` }}>
                  <p className="text-[10px] font-semibold mb-0.5" style={{ color }}>상대방의 결혼관</p>
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
                <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                  <p className="text-[9px] text-text-hint mb-0.5">사업 단계</p>
                  <p className="text-[13px] font-black" style={{ color }}>{data.currentBizPhase}</p>
                </div>
              )}
              {data.bizHealthScore != null && (
                <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                  <p className="text-[9px] text-text-hint mb-0.5">사업 건강도</p>
                  <p className="text-[16px] font-black" style={{ color }}>{data.bizHealthScore}<span className="text-[10px]">점</span></p>
                </div>
              )}
            </div>
            {data.openingAnalysis && (
              <div className="rounded-xl py-2.5 px-3 mb-2" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
                <p className="text-[10px] font-bold mb-0.5" style={{ color }}>개업 시점 분석</p>
                <p className="text-[12px] text-text-primary leading-snug">{data.openingAnalysis}</p>
              </div>
            )}
            {data.nextPhaseAdvice && (
              <div className="rounded-xl py-2 px-3" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[10px] font-bold text-[#2D8A4E] mb-0.5">다음 단계 전략</p>
                <p className="text-[12px] text-text-primary leading-snug">{data.nextPhaseAdvice}</p>
              </div>
            )}
          </div>
        )}

        {/* 창업 준비도 + 리스크 + 동업 */}
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">사업 준비 현황</p>
          <div className="grid grid-cols-3 gap-2">
            {data.startupReadiness != null && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">창업 준비도</p>
                <p className="text-[16px] font-black" style={{ color }}>{data.startupReadiness}<span className="text-[10px]">점</span></p>
              </div>
            )}
            {data.riskLevel && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: data.riskLevel === '높음' ? 'rgba(211,47,47,0.06)' : `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">리스크 수준</p>
                <p className="text-[13px] font-black" style={{ color: data.riskLevel === '높음' ? '#D32F2F' : color }}>{data.riskLevel}</p>
              </div>
            )}
            {data.bestPartnerOheng && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">동업자 오행</p>
                <p className="text-[13px] font-black" style={{ color }}>{data.bestPartnerOheng}</p>
              </div>
            )}
          </div>
          {data.bestStartMonth && (
            <div className="mt-2 rounded-xl py-2 px-3" style={{ background: 'rgba(45,138,78,0.05)' }}>
              <p className="text-[10px] text-text-hint">창업 최적 시기: <strong className="text-[#2D8A4E]">{data.bestStartMonth}</strong></p>
            </div>
          )}
          {data.partnerAdvice && (
            <div className="mt-2 rounded-xl py-2.5 px-3" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
              <p className="text-[10px] font-bold mb-0.5" style={{ color }}>동업 조언</p>
              <p className="text-[12px] text-text-primary leading-snug">{data.partnerAdvice}</p>
            </div>
          )}
        </div>
      </div>
    </FadeIn>
  );
}

function HealthViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  const statusColor: Record<string, string> = { '양호': '#2D8A4E', '주의': '#E65100', '경고': '#D32F2F' };
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
                      <span className="text-[10px] font-black" style={{ color: elColor }}>{o.element}</span>
                    </div>
                    <span className="text-[11px] text-text-secondary w-14 flex-shrink-0">{o.organ}</span>
                    <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: `${stColor}10` }}>
                      <motion.div className="h-full rounded-full" style={{ background: stColor }}
                        initial={{ width: 0 }} animate={{ width: `${Math.min(o.risk || 0, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.1 * i }} />
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ background: `${stColor}12`, color: stColor }}>{o.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {/* 건강 관리 카드 */}
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">건강 관리 포인트</p>
          <div className="grid grid-cols-2 gap-2">
            {data.cautionMonths && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(230,81,0,0.06)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">건강 주의 월</p>
                <p className="text-[12px] font-bold text-[#E65100]">{data.cautionMonths}</p>
              </div>
            )}
            {data.bestSleepTime && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(21,101,224,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">최적 수면 시간</p>
                <p className="text-[12px] font-bold text-[#1565C0]">{data.bestSleepTime}</p>
              </div>
            )}
            {data.mentalStressType && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">스트레스 유형</p>
                <p className="text-[12px] font-bold" style={{ color }}>{data.mentalStressType}</p>
              </div>
            )}
            {data.dietAdvice && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">식단 조언</p>
                <p className="text-[12px] font-bold text-[#2D8A4E]">{data.dietAdvice}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </FadeIn>
  );
}

function ReunionViz({ data, color }: { data: any; color: string }) {
  if (!data) return null;
  const prob = data.reunionProb ?? 50;
  const verdictColor = data.verdict === '재회 추천' ? '#2D8A4E' : data.verdict === '새 인연 추천' ? '#1565E0' : '#E65100';
  const contactColor: Record<string, string> = { '지금 연락하기': '#2D8A4E', '기다리기': '#E8B82A', '새출발': '#1565E0' };
  const cycleColor: Record<string, string> = { '상승기': '#2D8A4E', '하강기': '#D32F2F', '정체기': '#4A4A4A' };
  const ohengColor: Record<string, string> = { 목: '#2D8A4E', 화: '#D32F2F', 토: '#E8B82A', 금: '#4A4A4A', 수: '#1565E0' };
  const pp = data.partnerProfile;
  const ca = data.compatAnalysis;
  const sinsalList = data.sinsal;
  const bd = data.breakupDuration;

  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">

        {/* ━━━ 1. 재회 확률 대형 게이지 ━━━ */}
        <div className="card py-6">
          <p className="text-[10px] text-text-hint text-center tracking-widest mb-3">REUNION PROBABILITY</p>
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
                <span className="text-[10px] text-text-muted mt-0.5">재회 가능성</span>
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

        {/* ━━━ 2. 핵심 수치 대시보드 ━━━ */}
        <div className="card">
          <div className="grid grid-cols-3 gap-2">
            {data.bestTiming && (
              <div className="rounded-xl p-3 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-1">재회 적기</p>
                <p className="text-[13px] font-bold" style={{ color }}>{data.bestTiming}</p>
              </div>
            )}
            {data.bestContactMonth && (
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-1">최적 연락</p>
                <p className="text-[13px] font-bold text-[#2D8A4E]">{data.bestContactMonth}</p>
              </div>
            )}
            {ca?.totalScore != null && (
              <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(21,101,224,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-1">궁합 점수</p>
                <p className="text-[13px] font-bold text-[#1565C0]">{ca.totalScore}점</p>
              </div>
            )}
          </div>
          {data.breakupCause && (
            <div className="mt-2.5 rounded-xl py-2.5 px-3" style={{ background: 'rgba(230,81,0,0.04)', borderLeft: '3px solid rgba(230,81,0,0.25)' }}>
              <p className="text-[10px] font-bold text-[#E65100] mb-0.5">이별의 사주적 핵심 원인</p>
              <p className="text-[12px] text-text-primary leading-snug">{data.breakupCause}</p>
            </div>
          )}
        </div>

        {/* ━━━ 3. 두 사람의 사주 비교 카드 ━━━ */}
        {pp && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">두 사람의 사주 비교</p>
            {pp.myVsPartner && (
              <p className="text-[11px] text-text-muted mb-3 leading-snug">{pp.myVsPartner}</p>
            )}

            {/* 사주 기둥(柱) 비교 시각화 */}
            {pp.pillarComparison && (() => {
              const pc = pp.pillarComparison;
              const pillLabels = [
                { key: 'year', label: '년주', hanja: '年柱' },
                { key: 'month', label: '월주', hanja: '月柱' },
                { key: 'day', label: '일주', hanja: '日柱' },
              ];
              const ohengBg: Record<string, string> = { 목: 'rgba(45,138,78,0.10)', 화: 'rgba(211,47,47,0.10)', 토: 'rgba(232,184,42,0.10)', 금: 'rgba(74,74,74,0.10)', 수: 'rgba(21,101,224,0.10)' };
              const ohengText: Record<string, string> = { 목: '#2D8A4E', 화: '#D32F2F', 토: '#E8B82A', 금: '#4A4A4A', 수: '#1565E0' };
              // interactions를 position별로 맵핑
              const interMap: Record<string, { type: string; desc: string }> = {};
              (pc.interactions || []).forEach((it: any) => {
                if (it.position === '년주') interMap['year'] = it;
                else if (it.position === '월주') interMap['month'] = it;
                else if (it.position === '일주') interMap['day'] = it;
              });
              const typeIcon: Record<string, { icon: string; color: string; bg: string }> = {
                '합': { icon: '合', color: '#2D8A4E', bg: 'rgba(45,138,78,0.12)' },
                '충': { icon: '沖', color: '#D32F2F', bg: 'rgba(211,47,47,0.10)' },
                '형': { icon: '刑', color: '#E65100', bg: 'rgba(230,81,0,0.10)' },
                '해': { icon: '害', color: '#E65100', bg: 'rgba(230,81,0,0.10)' },
                '상생': { icon: '生', color: '#2D8A4E', bg: 'rgba(45,138,78,0.12)' },
                '상극': { icon: '克', color: '#D32F2F', bg: 'rgba(211,47,47,0.10)' },
              };
              const getTypeStyle = (type: string) => {
                for (const [k, v] of Object.entries(typeIcon)) {
                  if (type?.includes(k)) return v;
                }
                return { icon: '?', color: '#4A4A4A', bg: 'rgba(0,0,0,0.06)' };
              };
              const renderPillar = (p: any, side: 'left' | 'right') => {
                const oh = cleanOheng(p.oheng);
                const bg = ohengBg[oh] || 'rgba(0,0,0,0.03)';
                const fg = ohengText[oh] || '#3D3427';
                return (
                  <div className={`flex-1 rounded-lg p-2 flex items-center gap-2 ${side === 'right' ? 'justify-end' : ''}`} style={{ background: bg }}>
                    {side === 'right' && <span className="text-[8px] font-semibold" style={{ color: ohengText[oh] || '#4A4A4A' }}>{oh}</span>}
                    <div className="flex gap-1">
                      <span className="w-8 h-9 rounded-md flex items-center justify-center text-[15px] font-black" style={{ background: 'rgba(255,255,255,0.7)', color: fg }}>{cleanHanja(p.cheongan)}</span>
                      <span className="w-8 h-9 rounded-md flex items-center justify-center text-[15px] font-black" style={{ background: 'rgba(255,255,255,0.5)', color: fg }}>{cleanHanja(p.jiji)}</span>
                    </div>
                    {side === 'left' && <span className="text-[8px] font-semibold" style={{ color: ohengText[oh] || '#4A4A4A' }}>{oh}</span>}
                  </div>
                );
              };
              return (
                <div className="mb-4">
                  <p className="text-[10px] text-text-hint mb-2 font-semibold">사주 기둥(柱) 비교</p>
                  <div className="space-y-2">
                    {pillLabels.map(({ key, label, hanja }) => {
                      const myP = pc.myPillars?.[key];
                      const ptP = pc.partnerPillars?.[key];
                      const inter = interMap[key];
                      const ts = inter ? getTypeStyle(inter.type) : null;
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[9px] text-text-hint font-medium">{label}</span>
                            <span className="text-[8px] text-text-hint opacity-60">({hanja})</span>
                            {ts && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
                                style={{ background: ts.bg, color: ts.color }}>{ts.icon} {inter.type}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {myP && renderPillar(myP, 'left')}
                            <div className="flex-shrink-0 w-6 flex items-center justify-center">
                              {ts ? (
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                                  style={{ background: ts.bg, color: ts.color }}>{ts.icon}</span>
                              ) : (
                                <span className="text-[10px] text-text-hint">vs</span>
                              )}
                            </div>
                            {ptP && renderPillar(ptP, 'right')}
                          </div>
                          {inter?.desc && (
                            <p className="text-[10px] text-text-muted mt-1 ml-1 leading-snug">{inter.desc}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* 범례 */}
                  <div className="flex items-center justify-between mt-3 pt-2 px-1" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <span className="text-[9px] text-text-hint">나</span>
                    <span className="text-[9px] text-text-hint">상대 (추론)</span>
                  </div>
                </div>
              );
            })()}

            {/* 나 vs 상대 프로필 비교 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl p-3 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-1">나</p>
                <p className="text-[11px] font-semibold text-text-primary">{pp.loveStyle || '분석 중'}</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: `${ohengColor[pp.dominantOheng] || color}06`, borderTop: `2px solid ${ohengColor[pp.dominantOheng] || color}30` }}>
                <p className="text-[9px] text-text-hint mb-1">상대 ({pp.dominantOheng || '?'})</p>
                <p className="text-[11px] font-semibold text-text-primary">{pp.personality || '분석 중'}</p>
              </div>
            </div>

            {/* 상대 현재 감정 + 재회 욕구 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {pp.currentEmotion && (
                <div className="rounded-xl p-2.5" style={{ background: 'rgba(230,81,0,0.04)' }}>
                  <p className="text-[9px] text-text-hint mb-0.5">상대 현재 감정</p>
                  <p className="text-[11px] font-semibold text-[#E65100]">{pp.currentEmotion}</p>
                </div>
              )}
              {pp.reunionDesire != null && (
                <div className="rounded-xl p-2.5" style={{ background: `${color}06` }}>
                  <p className="text-[9px] text-text-hint mb-1">상대 재회 욕구</p>
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

            {/* 잘 맞는 점 / 안 맞는 점 */}
            {(pp.matchPoints?.length > 0 || pp.clashPoints?.length > 0) && (
              <div className="space-y-2">
                {pp.matchPoints?.map((m: string, i: number) => (
                  <div key={`m${i}`} className="flex items-start gap-2 rounded-lg p-2" style={{ background: 'rgba(45,138,78,0.05)' }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-black mt-0.5"
                      style={{ background: 'rgba(45,138,78,0.12)', color: '#2D8A4E' }}>合</span>
                    <p className="text-[11px] text-text-secondary leading-snug" dangerouslySetInnerHTML={{ __html: sanitizeAiText(m) }} />
                  </div>
                ))}
                {pp.clashPoints?.map((c: string, i: number) => (
                  <div key={`c${i}`} className="flex items-start gap-2 rounded-lg p-2" style={{ background: 'rgba(230,81,0,0.04)' }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-black mt-0.5"
                      style={{ background: 'rgba(230,81,0,0.10)', color: '#E65100' }}>沖</span>
                    <p className="text-[11px] text-text-secondary leading-snug" dangerouslySetInnerHTML={{ __html: sanitizeAiText(c) }} />
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
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: '#8D7B68' }} />
                  <Radar dataKey="score" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} dot={{ r: 3, fill: color }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-5 gap-1 mt-2">
              {ca.axes.map((a: any, i: number) => (
                <div key={i} className="text-center">
                  <p className="text-[12px] font-bold" style={{ color }}>{a.score}</p>
                  <p className="text-[8px] text-text-hint">{a.axis}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ━━━ 5. 전통 연애 신살 분석 ━━━ */}
        {sinsalList && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">연애 신살(神殺) 분석</p>
            <p className="text-[10px] text-text-hint mb-3">사주에 숨겨진 연애 DNA를 하나씩 짚어봤어요</p>
            <div className="space-y-3">
              {[
                { key: 'doHwaSal', name: '도화살', hanja: '桃花殺', summary: '타고난 연애 매력', subject: '나의 사주',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E91E63" strokeWidth="2"><path d="M12 21C7 17 2 13 2 8.5a5.5 5.5 0 0110-3.08A5.5 5.5 0 0122 8.5C22 13 17 17 12 21z" /></svg>, activeColor: '#E91E63' },
                { key: 'hongYeomSal', name: '홍염살', hanja: '紅艶殺', summary: '강렬한 끌림', subject: '나의 사주',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2"><path d="M12 2c1 3 4 5.5 4 10a4 4 0 11-8 0c0-4.5 3-7 4-10z" /></svg>, activeColor: '#D32F2F' },
                { key: 'wonJinSal', name: '원진살', hanja: '怨嗔殺', summary: '감정 어긋남', subject: '두 사람 사이',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E65100" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M16 8l-8 8M8 8l8 8" /></svg>, activeColor: '#E65100' },
                { key: 'cheonEulGuiin', name: '천을귀인', hanja: '天乙貴人', summary: '귀인의 도움', subject: '나의 사주',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01z" /></svg>, activeColor: '#2D8A4E' },
                { key: 'samhap', name: '삼합', hanja: '三合', summary: '세 기운의 조화', subject: '두 사람 사이',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="2"><path d="M12 3l8.66 15H3.34z" /></svg>, activeColor: '#1565E0' },
                { key: 'yukhap', name: '육합', hanja: '六合', summary: '짝궁 결합', subject: '두 사람 사이',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7B1FA2" strokeWidth="2"><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></svg>, activeColor: '#7B1FA2' },
              ].map(({ key, name, hanja, summary, subject, icon, activeColor }) => {
                const s = sinsalList[key];
                if (!s) return null;
                const isActive = s.have === true || s.have === 'true';
                const impactType = s.impact || (isActive ? 'positive' : 'neutral');
                const impactLabel = impactType === 'positive' ? '좋은 영향' : impactType === 'negative' ? '주의 필요' : '해당 없음';
                const impactColor = impactType === 'positive' ? '#2D8A4E' : impactType === 'negative' ? '#E65100' : '#999';
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
                          <span className="text-[9px] text-text-hint">({hanja})</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[rgba(0,0,0,0.04)] text-text-hint">{subject}</span>
                        </div>
                        <p className="text-[10px] text-text-muted">{summary}</p>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: isActive ? `${impactColor}12` : 'rgba(0,0,0,0.04)', color: isActive ? impactColor : '#bbb' }}>
                        {isActive ? impactLabel : '없음'}
                      </span>
                    </div>
                    {/* 본문 — 쉬운 설명 */}
                    <div className="px-3.5 pb-3 space-y-1.5">
                      {s.meaning && (
                        <div className="rounded-lg py-2 px-2.5" style={{ background: isActive ? `${activeColor}06` : 'rgba(0,0,0,0.02)' }}>
                          <p className="text-[10px] font-semibold mb-0.5" style={{ color: isActive ? activeColor : '#999' }}>쉽게 말하면</p>
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
            <p className="text-[10px] text-text-hint mb-3">나의 에너지 / 재회 확률 추이</p>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyEnergy} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="reunionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="myEnergyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E91E63" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#E91E63" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#999' }} tickLine={false} axisLine={false}
                    tickFormatter={(v: string) => v.replace('월', '')} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#999' }} tickLine={false} axisLine={false} />
                  <Area type="monotone" dataKey="reunionChance" stroke={color} fill="url(#reunionGrad)"
                    strokeWidth={2} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="myEnergy" stroke="#E91E63" fill="url(#myEnergyGrad)"
                    strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-[2px] rounded-full" style={{ background: color }} />
                <span className="text-[9px] text-text-hint">재회 확률</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-[2px] rounded-full" style={{ background: '#E91E63', opacity: 0.6 }} />
                <span className="text-[9px] text-text-hint">나의 에너지</span>
              </div>
            </div>
          </div>
        )}

        {/* ━━━ 7. 재회 핵심 변수 분석 ━━━ */}
        {data.reunionFactors?.length > 0 && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">재회 핵심 변수</p>
            <p className="text-[10px] text-text-hint mb-3">사주 구조에서 재회에 영향을 미치는 요인들</p>
            <div className="space-y-2.5">
              {data.reunionFactors.map((f: any, i: number) => {
                const isFav = f.favorable === true || f.favorable === 'true';
                const barColor = isFav ? '#2D8A4E' : '#E65100';
                const impact = Math.min(f.impact ?? 50, 100);
                return (
                  <motion.div key={i} className="rounded-xl p-3" style={{ background: isFav ? 'rgba(45,138,78,0.04)' : 'rgba(230,81,0,0.03)' }}
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
                    {f.desc && <p className="text-[10px] text-text-muted mt-1 ml-7 leading-snug">{f.desc}</p>}
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
                <div className="rounded-xl p-3" style={{ background: 'rgba(45,138,78,0.04)' }}>
                  <p className="text-[11px] font-bold text-[#2D8A4E] mb-2 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                      style={{ background: 'rgba(45,138,78,0.15)' }}>+</span>
                    긍정 신호
                  </p>
                  {data.greenFlags.map((f: string, i: number) => (
                    <p key={i} className="text-[11px] text-text-secondary mb-1.5 leading-snug pl-5 relative">
                      <span className="absolute left-0 top-0.5 text-[#2D8A4E] text-[10px]">&#x2713;</span>
                      {stripMd(f)}
                    </p>
                  ))}
                </div>
              )}
              {data.redFlags?.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(211,47,47,0.04)' }}>
                  <p className="text-[11px] font-bold text-[#D32F2F] mb-2 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                      style={{ background: 'rgba(211,47,47,0.12)' }}>!</span>
                    경고 신호
                  </p>
                  {data.redFlags.map((f: string, i: number) => (
                    <p key={i} className="text-[11px] text-text-secondary mb-1.5 leading-snug pl-5 relative">
                      <span className="absolute left-0 top-0.5 text-[#D32F2F] text-[10px]">&#x2717;</span>
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
                      <svg key="p0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2"><path d="M12 6l-2 4 3 2-4 6" /><path d="M19.5 13c0 4.5-7.5 9-7.5 9s-7.5-4.5-7.5-9a6 6 0 0112 0z" /></svg>,
                      // 거부기: 화난 얼굴(번개)
                      <svg key="p1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E65100" strokeWidth="2"><path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" /></svg>,
                      // 회복기: 새싹
                      <svg key="p2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2D8A4E" strokeWidth="2"><path d="M12 22V10" /><path d="M6 12c0-3.3 2.7-6 6-6" /><path d="M18 12c0-3.3-2.7-6-6-6" /><circle cx="12" cy="22" r="1" fill="#2D8A4E" /></svg>,
                      // 수용기: 균형
                      <svg key="p3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1565C0" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>,
                      // 장기 분리기: 나비(날개)
                      <svg key="p4" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7B1FA2" strokeWidth="2"><path d="M12 12c-3-3-7-3-8 0s1 7 4 7c2 0 3-2 4-4" /><path d="M12 12c3-3 7-3 8 0s-1 7-4 7c-2 0-3-2-4-4" /><path d="M12 7v10" /></svg>,
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
                          {isCurrent && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: color }}>현재</span>}
                          {isPast && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium text-text-hint" style={{ background: 'rgba(0,0,0,0.04)' }}>지남</span>}
                        </div>
                        {/* 단계 설명 — 모든 단계에 표시 */}
                        {ph.desc && (
                          <p className={`text-[10px] leading-snug ml-7 mb-1 ${isCurrent ? 'text-text-secondary' : 'text-text-hint'}`}>
                            {ph.desc}
                          </p>
                        )}
                        {/* 나/상대 상태 — 모든 단계에 표시 */}
                        <div className="ml-7 grid grid-cols-2 gap-2">
                          {ph.myState && (
                            <p className={`text-[10px] ${isCurrent ? 'text-text-secondary' : 'text-text-hint'}`}>
                              나: <span className={`font-semibold ${isCurrent ? 'text-text-primary' : ''}`}>{ph.myState}</span>
                            </p>
                          )}
                          {ph.partnerState && (
                            <p className={`text-[10px] ${isCurrent ? 'text-text-secondary' : 'text-text-hint'}`}>
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
                  <p className="text-[9px] text-text-hint mb-0.5">현재 단계</p>
                  <p className="text-[12px] font-bold" style={{ color }}>{bd.healingStage}</p>
                </div>
              )}
              {bd.optimalWait && (
                <div className="rounded-xl p-2.5" style={{ background: 'rgba(45,138,78,0.05)' }}>
                  <p className="text-[9px] text-text-hint mb-0.5">최적 대기 기간</p>
                  <p className="text-[12px] font-bold text-[#2D8A4E]">{bd.optimalWait}</p>
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
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: color }}>R</span>
                  <p className="text-[11px] font-bold" style={{ color }}>재회</p>
                </div>
                {data.comparison.reunionPros?.map((p: string, i: number) => (
                  <p key={`rp${i}`} className="text-[11px] text-text-secondary mb-1 flex items-start gap-1">
                    <span className="text-[#2D8A4E] mt-0.5 flex-shrink-0 font-bold">+</span>{stripMd(p)}
                  </p>
                ))}
                {data.comparison.reunionCons?.map((c: string, i: number) => (
                  <p key={`rc${i}`} className="text-[11px] text-text-muted mb-1 flex items-start gap-1">
                    <span className="text-[#D32F2F] mt-0.5 flex-shrink-0 font-bold">-</span>{stripMd(c)}
                  </p>
                ))}
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(21,101,224,0.05)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: '#1565E0' }}>N</span>
                  <p className="text-[11px] font-bold text-[#1565C0]">새 인연</p>
                </div>
                {data.comparison.newLovePros?.map((p: string, i: number) => (
                  <p key={`np${i}`} className="text-[11px] text-text-secondary mb-1 flex items-start gap-1">
                    <span className="text-[#2D8A4E] mt-0.5 flex-shrink-0 font-bold">+</span>{stripMd(p)}
                  </p>
                ))}
                {data.comparison.newLoveCons?.map((c: string, i: number) => (
                  <p key={`nc${i}`} className="text-[11px] text-text-muted mb-1 flex items-start gap-1">
                    <span className="text-[#D32F2F] mt-0.5 flex-shrink-0 font-bold">-</span>{stripMd(c)}
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
  const rateColor: Record<string, string> = { '높음': '#2D8A4E', '보통': '#E8B82A', '보완필요': '#D32F2F' };
  return (
    <FadeIn delay={0.1}>
      <div className="space-y-3">
        {/* 학습 프로필 */}
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">학습 프로필</p>
          <div className="grid grid-cols-2 gap-2">
            {data.studyType && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">학습 유형</p>
                <p className="text-[13px] font-bold" style={{ color }}>{data.studyType}</p>
              </div>
            )}
            {data.examStrength && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">시험 강점</p>
                <p className="text-[13px] font-bold" style={{ color }}>{data.examStrength}</p>
              </div>
            )}
            {data.passRate && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${rateColor[data.passRate] || color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">합격 기운</p>
                <p className="text-[13px] font-bold" style={{ color: rateColor[data.passRate] || color }}>{data.passRate}</p>
              </div>
            )}
            {data.examLuckMonth && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">시험운 최강 월</p>
                <p className="text-[13px] font-bold text-[#2D8A4E]">{data.examLuckMonth}</p>
              </div>
            )}
          </div>
        </div>
        {/* 시험 맞춤 분석 (시험명/예정일 입력 시) */}
        {(data.examFitScore != null || data.examTimingVerdict) && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">시험 맞춤 분석</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {data.examFitScore != null && (
                <div className="rounded-xl p-3" style={{ background: `${color}06` }}>
                  <p className="text-[9px] text-text-hint mb-1">시험 적합도</p>
                  <div className="flex items-end gap-1">
                    <span className="text-[20px] font-black" style={{ color }}>{data.examFitScore}</span>
                    <span className="text-[10px] text-text-muted mb-1">/ 100</span>
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
                  background: data.examTimingVerdict === '최적' ? 'rgba(45,138,78,0.06)' : data.examTimingVerdict === '주의' ? 'rgba(211,47,47,0.05)' : `${color}06`
                }}>
                  <p className="text-[9px] text-text-hint mb-1">시험 시기 판정</p>
                  <p className="text-[18px] font-black" style={{
                    color: data.examTimingVerdict === '최적' ? '#2D8A4E' : data.examTimingVerdict === '주의' ? '#D32F2F' : color
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
              <div className="rounded-xl py-2 px-3" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[10px] font-bold text-[#2D8A4E] mb-0.5">시험 당일 꿀팁</p>
                <p className="text-[12px] text-text-primary leading-snug">{data.examDayTips}</p>
              </div>
            )}
          </div>
        )}

        {/* 시험 전략 카드 */}
        <div className="card">
          <p className="text-h3 text-text-primary mb-3">시험 전략 포인트</p>
          <div className="grid grid-cols-2 gap-2">
            {data.bestStudyTime && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">최적 공부 시간대</p>
                <p className="text-[12px] font-bold" style={{ color }}>{data.bestStudyTime}</p>
              </div>
            )}
            {data.focusPeakHour && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">집중력 피크</p>
                <p className="text-[12px] font-bold" style={{ color }}>{data.focusPeakHour}</p>
              </div>
            )}
            {data.seatDirection && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(21,101,224,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">유리한 좌석 방향</p>
                <p className="text-[12px] font-bold text-[#1565C0]">{data.seatDirection}</p>
              </div>
            )}
            {data.studyPartnerType && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">같이 공부하면 좋은 유형</p>
                <p className="text-[12px] font-bold text-[#2D8A4E]">{data.studyPartnerType}</p>
              </div>
            )}
          </div>
          {data.slumpPeriod && (
            <div className="mt-2.5 rounded-xl py-2 px-3" style={{ background: 'rgba(230,81,0,0.05)', borderLeft: '3px solid rgba(230,81,0,0.3)' }}>
              <p className="text-[10px] text-text-primary">슬럼프 주의 시기: <strong className="text-[#E65100]">{data.slumpPeriod}</strong></p>
            </div>
          )}
        </div>
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
                <p className="text-[10px] font-bold" style={{ color }}>귀인(貴人) 프로필</p>
                {data.guiinProfile.oheng && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
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
            <div className="mt-2 rounded-xl py-2 px-3" style={{ background: 'rgba(45,138,78,0.05)' }}>
              <p className="text-[10px] text-text-hint">잘 맞는 동료/친구: <strong className="text-[#2D8A4E]">{data.bestAllyType}</strong></p>
            </div>
          )}
        </div>
        {/* 주의 사항 카드 */}
        {(data.gossipMonth || data.conflictTrigger) && (
          <div className="card" style={{ borderLeft: '3px solid #E65100' }}>
            <p className="text-[10px] font-bold text-[#E65100] mb-2">주의 포인트</p>
            {data.gossipMonth && (
              <p className="text-[11px] text-text-primary mb-1.5">구설수 주의 월: <strong className="text-[#E65100]">{data.gossipMonth}</strong></p>
            )}
            {data.conflictTrigger && (
              <p className="text-[11px] text-text-primary">갈등 트리거: <strong className="text-[#E65100]">{data.conflictTrigger}</strong></p>
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
                color={data.hasYeokmasal ? '#E65100' : '#2D8A4E'} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.bestDirection && (
              <div className="rounded-xl p-2.5" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">좋은 방향</p>
                <p className="text-[12px] font-bold text-[#2D8A4E]">{data.bestDirection}</p>
              </div>
            )}
            {data.avoidDirection && (
              <div className="rounded-xl p-2.5" style={{ background: 'rgba(211,47,47,0.04)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">피할 방향</p>
                <p className="text-[12px] font-bold text-[#D32F2F]">{data.avoidDirection}</p>
              </div>
            )}
            {data.movingType && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">유리한 이동 유형</p>
                <p className="text-[12px] font-bold" style={{ color }}>{data.movingType}</p>
              </div>
            )}
            {data.travelLuck && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">해외운</p>
                <p className="text-[12px] font-bold" style={{ color }}>{data.travelLuck}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {data.bestTiming && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: `${color}06` }}>
                <p className="text-[9px] text-text-hint mb-0.5">최적 이동 시기</p>
                <p className="text-[12px] font-bold" style={{ color }}>{data.bestTiming}</p>
              </div>
            )}
            {data.bestMoveMonth && (
              <div className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(45,138,78,0.05)' }}>
                <p className="text-[9px] text-text-hint mb-0.5">이사 최적 월</p>
                <p className="text-[12px] font-bold text-[#2D8A4E]">{data.bestMoveMonth}</p>
              </div>
            )}
          </div>
        </div>
        {/* 이사 예정 시기 분석 (입력 시) */}
        {(data.planDateVerdict || data.purposeAdvice) && (
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">이사 계획 분석</p>
            {data.planDateVerdict && (
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl p-2.5 text-center flex-1" style={{
                  background: data.planDateVerdict === '좋음' ? 'rgba(45,138,78,0.06)' : data.planDateVerdict === '주의' ? 'rgba(211,47,47,0.05)' : `${color}06`
                }}>
                  <p className="text-[9px] text-text-hint mb-0.5">예정 시기 판정</p>
                  <p className="text-[16px] font-black" style={{
                    color: data.planDateVerdict === '좋음' ? '#2D8A4E' : data.planDateVerdict === '주의' ? '#D32F2F' : color
                  }}>{data.planDateVerdict}</p>
                </div>
                {data.betterAlternative && (
                  <div className="rounded-xl p-2.5 text-center flex-1" style={{ background: 'rgba(45,138,78,0.05)' }}>
                    <p className="text-[9px] text-text-hint mb-0.5">더 좋은 시기</p>
                    <p className="text-[12px] font-bold text-[#2D8A4E]">{data.betterAlternative}</p>
                  </div>
                )}
              </div>
            )}
            {data.planDateAnalysis && (
              <div className="rounded-xl py-2.5 px-3 mb-2" style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
                <p className="text-[12px] text-text-primary leading-snug">{data.planDateAnalysis}</p>
              </div>
            )}
            {data.purposeAdvice && (
              <div className="rounded-xl py-2 px-3" style={{ background: 'rgba(21,101,224,0.05)' }}>
                <p className="text-[10px] font-bold text-[#1565C0] mb-0.5">이사 목적 조언</p>
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
function TopicViz({ topicId, data, color, sajuData, birthYear }: { topicId: string; data: any; color: string; sajuData?: any; birthYear?: number }) {
  if (!data) return null;
  switch (topicId) {
    case 'love': return <LoveViz data={data} color={color} />;
    // Phase 2 Stage 2B: WealthViz 에 sajuData + birthYear 추가 — daewoon-card / relflow 사용
    case 'wealth': return <WealthViz data={data} color={color} sajuData={sajuData} birthYear={birthYear} />;
    case 'career': return <CareerViz data={data} color={color} />;
    case 'marriage': return <MarriageViz data={data} color={color} />;
    case 'business': return <BusinessViz data={data} color={color} />;
    case 'health': return <HealthViz data={data} color={color} />;
    case 'reunion': return <ReunionViz data={data} color={color} />;
    case 'study': return <StudyViz data={data} color={color} />;
    case 'social': return <SocialViz data={data} color={color} />;
    case 'move':
    case 'moving': return <MovingViz data={data} color={color} />;
    case 'exam': return <StudyViz data={data} color={color} />; // 합격·이직운 — study viz 재사용 (차후 ExamViz 전용 교체)
    default: return null;
  }
}

/** 섹션 인사이트 카드 — 사주 용어 기반 핵심 데이터 카드 */
function InsightCards({ cards, color }: { cards?: { label: string; value: string; type: string }[]; color: string }) {
  if (!cards?.length) return null;
  const styles: Record<string, { bg: string; border: string; labelColor: string }> = {
    info:    { bg: 'rgba(21,101,224,0.06)',  border: 'rgba(21,101,224,0.15)', labelColor: '#1565E0' },
    accent:  { bg: `${color}08`,             border: `${color}20`,            labelColor: color },
    warning: { bg: 'rgba(230,81,0,0.06)',    border: 'rgba(230,81,0,0.15)',   labelColor: '#E65100' },
  };
  return (
    <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      {cards.map((card, ci) => {
        const s = styles[card.type] || styles.info;
        return (
          <div key={ci} className="flex-1 min-w-[140px] rounded-xl px-3 py-2.5"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <p className="text-[9px] font-bold mb-0.5" style={{ color: s.labelColor }}>{card.label}</p>
            <p className="text-[11px] text-text-primary leading-snug">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}

/** 섹션 본문 — 단락 분리 + 실천 포인트 콜아웃 */
function SectionBody({ content, color }: { content: string; color: string }) {
  const cleaned = stripMd(content);
  const paragraphs = cleaned.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

  if (paragraphs.length <= 1) {
    return <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{cleaned}</p>;
  }

  const lastP = paragraphs[paragraphs.length - 1];
  const isAdvice = /하세요|해보세요|추천합니다|좋습니다|실천|시작하세요|도전하세요|시도하세요|활용하세요|기억하세요/.test(lastP);

  return (
    <div className="space-y-3">
      {paragraphs.map((p, pi) => {
        const isLast = pi === paragraphs.length - 1;
        if (isLast && isAdvice) {
          return (
            <div key={pi} className="rounded-xl py-2.5 px-3.5 mt-0.5"
              style={{ background: `${color}06`, borderLeft: `3px solid ${color}35` }}>
              <p className="text-[10px] font-bold mb-1" style={{ color }}>실천 포인트</p>
              <p className="text-body-sm text-text-primary leading-relaxed whitespace-pre-line">{p}</p>
            </div>
          );
        }
        if (pi === 0) {
          return <p key={pi} className="text-[13px] text-text-primary leading-relaxed whitespace-pre-line font-medium">{p}</p>;
        }
        return <p key={pi} className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{p}</p>;
      })}
    </div>
  );
}


/* ════════════════════════════════════════════════
   메인 페이지 컴포넌트
   ════════════════════════════════════════════════ */
export function TopicAnalysisPage() {
  const { topicId: rawTopicId } = useParams<{ topicId: string }>();
  // SSOT v1 정렬 (2026-04-22): legacy URL ('/topic/moving') 을 canonical ('move') 로 정규화.
  // 잘못된 id 는 null 반환 — 이 경우 'love' 로 폴백 (구 기본값 유지).
  const topicId = (normalizeTopicId(rawTopicId) || rawTopicId || 'love') as string;
  const topic = TOPICS[(topicId || 'love') as TopicKey];
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  usePageTitle(topic?.label || '심층분석');

  // 보관함에서 저장된 결과 또는 사주리포트에서 baseScore를 넘겨받은 경우
  const navState = location.state as { savedResult?: any; savedReport?: LocalReport; baseScore?: number } | undefined;

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  const [selected, setSelected] = useState<LocalReport | null>(navState?.savedReport || null);
  const [result, setResult] = useState<any>(navState?.savedResult || null);
  const [, setLoadingMsg] = useState(0);
  // 더블클릭 가드 — 1운 중복 차감 차단 (InputPage 패턴)
  const isAnalyzingRef = useRef(false);

  // 재회운/결혼운 상대방 정보
  const [partnerInfo, setPartnerInfo] = useState({
    name: '', birthYear: 1995, birthMonth: 1, birthDay: 1, gender: 'male',
    breakupYear: new Date().getFullYear(), breakupMonth: 1,
    birthHour: -1, // -1 = 미상
  });
  const [showPartner, setShowPartner] = useState(false);
  // 결혼운/연애운: 연애 상태
  const [relationStatus, setRelationStatus] = useState<'solo' | 'dating'>('solo');
  // 연애운: 솔로/썸/연애중
  const [loveStatus, setLoveStatus] = useState<'solo' | 'some' | 'dating'>('solo');
  // 사업운/취업운/이사운/학업운: 추가 상태 정보
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
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [selected, topicId]);

  useEffect(() => {
    if (existingResult) {
      setResult(existingResult);
      setPhase('result');
    }
  }, [existingResult]);

  // 단일 프로필이면 자동 선택
  useEffect(() => {
    if (profiles.length === 1 && !selected) {
      setSelected(profiles[0] as unknown as LocalReport);
    }
  }, [profiles, selected]);

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

  async function analyze() {
    if (!selected) return;
    // 더블클릭 가드 — 1운 중복 차감 차단
    if (isAnalyzingRef.current || phase === 'loading') return;
    isAnalyzingRef.current = true;

    // 과금
    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: `${topic.label} 분석에 1운이 필요해요` } });
      isAnalyzingRef.current = false;
      return;
    }

    setPhase('loading');
    const interval = setInterval(() => setLoadingMsg(s => Math.min(s + 1, LOADING_MSGS.length - 1)), 3000);

    try {
      // 재회운/결혼운(연애중)/연애운(썸·연애중)이고 상대방 정보가 있으면 전달
      const needsPartner = (topicId === 'reunion' && showPartner && partnerInfo.name)
        || (topicId === 'marriage' && relationStatus === 'dating' && partnerInfo.name)
        || (topicId === 'love' && loveStatus !== 'solo' && partnerInfo.name);
      const partner = needsPartner
        ? { ...partnerInfo, birthHour: partnerInfo.birthHour >= 0 ? partnerInfo.birthHour : undefined } : undefined;

      // 주제별 추가 정보 (사업운/취업운/이사운/학업운/연애운)
      const loveExtra = topicId === 'love' ? { loveStatus } : {};
      // SSOT canonical: 'move' (legacy 'moving' 는 normalizeTopicId 로 이미 정규화됨)
      const topicExtra = (['business', 'career', 'move', 'study'].includes(topicId!))
        ? Object.fromEntries(Object.entries(extraInfo).filter(([, v]) => v !== '' && v != null)) : {};
      const extra = { ...topicExtra, ...loveExtra };
      const finalExtra = Object.keys(extra).length > 0 ? extra : undefined;

      const res = await generateTopicAnalysis(topicId!, selected.sajuData, navState?.baseScore, partner, finalExtra);
      setResult(res.content);

      // localStorage 캐시 (재회운/결혼운/연애운은 상대방 이름 포함)
      const hasPartnerName = (topicId === 'reunion' || topicId === 'marriage' || topicId === 'love') && partnerInfo.name;
      const cacheKey = hasPartnerName
        ? `topic_${topicId}_${selected.id}_${partnerInfo.name}`
        : `topic_${topicId}_${selected.id}`;
      localStorage.setItem(cacheKey, JSON.stringify(res.content));

      // 보관함 저장
      saveReport({
        id: res.reportId || generateId(),
        name: selected.name,
        input: selected.input,
        sajuData: selected.sajuData,
        type: 'paid',
        contentType: 'topic',
        createdAt: new Date().toISOString(),
        aiResult: { topicId, ...res.content },
      });

      setPhase('result');
    } catch (e: any) {
      console.error('주제 분석 실패:', e);
      // 환불은 서버(Cloud Function) 트랜잭션 롤백에 위임 — 클라이언트 직접 환불 금지 (보안)
      toast.show('분석에 실패했어요. 잔액은 자동으로 복구돼요.', 'warning');
      setPhase('select');
    } finally {
      clearInterval(interval);
      isAnalyzingRef.current = false;
    }
  }

  // 년도 범위 생성
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 70 }, (_, i) => currentYear - 15 - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="px-5 pt-4 pb-8 space-y-5">

        {/* 헤더 — ExtensionHero 패턴 통일 (gradient + 한자 워터마크 + seal + crumb + tier) */}
        <FadeIn>
          <header
            style={{
              position: 'relative',
              overflow: 'hidden',
              padding: '18px 20px 28px',
              color: '#FFFFFF',
              background: topicHeroGrad(topic.color),
              borderRadius: 16,
              marginLeft: -20,
              marginRight: -20,
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                right: -18,
                bottom: -40,
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 220,
                fontWeight: 900,
                color: 'rgba(255,255,255,0.07)',
                lineHeight: 1,
                pointerEvents: 'none',
                letterSpacing: '-0.05em',
              }}
            >
              {TOPIC_HANJA[topicId || 'love'] || '吉'}
            </span>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                right: 18,
                top: 18,
                width: 44,
                height: 44,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.30)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 22,
                fontWeight: 800,
                color: '#FFFFFF',
              }}
            >
              {TOPIC_HANJA[topicId || 'love'] || '吉'}
            </div>
            <div
              style={{
                fontSize: 11,
                opacity: 0.78,
                marginBottom: 8,
                position: 'relative',
                letterSpacing: '0.02em',
              }}
            >
              사주 500 · 더 알아볼 주제 · {topic.label}
            </div>
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
              <span style={{ background: 'rgba(255,255,255,0.22)', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600 }}>
                {topic.label}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.14)', padding: '3px 10px', borderRadius: 100, fontSize: 10 }}>
                1운
              </span>
              <span style={{ background: 'rgba(255,255,255,0.14)', padding: '3px 10px', borderRadius: 100, fontSize: 10 }}>
                심층분석
              </span>
            </div>
            <h1
              style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 22,
                fontWeight: 700,
                marginTop: 14,
                letterSpacing: '-0.02em',
                lineHeight: 1.4,
                position: 'relative',
              }}
            >
              {topic.label} 심층분석
            </h1>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4, position: 'relative' }}>
              {topic.desc}
            </div>
          </header>
        </FadeIn>

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
                                    fontSize: 9,
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
                                <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: '#8C6D3D', color: '#F8F5EE', letterSpacing: '0.04em' }}>본인</span>
                              ) : (
                                <span style={{ fontSize: 10.5, color: '#8C6D3D', fontWeight: 700, padding: '1px 7px', background: 'rgba(184,150,90,0.14)', borderRadius: 999 }}>{relation}</span>
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
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8B1C1" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden>
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
                      <p className="text-[10px] text-text-hint">새로운 생년월일시를 입력해요</p>
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
                            <p className="text-[10px] text-text-hint">상태에 따라 분석 방향이 달라져요</p>
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
                                    className="w-full h-10 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                                    value={partnerInfo.name}
                                    onChange={e => setPartnerInfo(p => ({ ...p, name: e.target.value }))} />
                                </div>

                                {/* 생년월일 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">생년월일 (양력)</label>
                                  <div className="flex gap-2">
                                    <select className="flex-1 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthYear}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthYear: +e.target.value }))}>
                                      {years.map(y => <option key={y} value={y}>{y}년</option>)}
                                    </select>
                                    <select className="w-20 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthMonth}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthMonth: +e.target.value }))}>
                                      {months.map(m => <option key={m} value={m}>{m}월</option>)}
                                    </select>
                                    <select className="w-20 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
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
                                        className={`flex-1 h-10 rounded-xl text-body-sm font-semibold transition-all ${partnerInfo.gender === g.v ? 'text-white' : 'bg-bg-page border border-border-light text-text-muted'}`}
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
                                    출생 시간 <span className="text-[9px] opacity-60">(선택사항)</span>
                                  </label>
                                  <select className="w-full h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                    value={partnerInfo.birthHour}
                                    onChange={e => setPartnerInfo(p => ({ ...p, birthHour: +e.target.value }))}>
                                    <option value={-1}>모름</option>
                                    {Array.from({ length: 24 }, (_, i) => i).map(h => (
                                      <option key={h} value={h}>
                                        {`${String(h).padStart(2, '0')}시 (${['자','축','축','인','인','묘','묘','진','진','사','사','오','오','미','미','신','신','유','유','술','술','해','해','자'][h]}시)`}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[10px] text-text-hint mt-1">알면 시주까지 분석하여 더 정확해요</p>
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
                            <p className="text-h3 text-text-primary">현재 연애 상태</p>
                            <p className="text-[10px] text-text-hint">상태에 따라 분석 방향이 달라져요</p>
                          </div>
                        </div>

                        {/* 솔로 / 연애중 토글 */}
                        <div className="flex gap-2 mb-3">
                          {[
                            { v: 'solo' as const, l: '솔로', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 10-16 0" /></svg> },
                            { v: 'dating' as const, l: '연애중', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4a4 4 0 11-3 6.5" /><path d="M8 4a4 4 0 103 6.5" /><path d="M22 21a8 8 0 00-6-7.75" /><path d="M2 21a8 8 0 016-7.75" /></svg> },
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
                                <p className="text-[11px] text-text-muted">상대방 정보를 입력하면 실제 사주 궁합 기반 분석이 가능해요</p>

                                {/* 이름 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">이름</label>
                                  <input type="text" placeholder="상대방 이름"
                                    className="w-full h-10 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                                    value={partnerInfo.name}
                                    onChange={e => setPartnerInfo(p => ({ ...p, name: e.target.value }))} />
                                </div>

                                {/* 생년월일 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">생년월일 (양력)</label>
                                  <div className="flex gap-2">
                                    <select className="flex-1 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthYear}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthYear: +e.target.value }))}>
                                      {years.map(y => <option key={y} value={y}>{y}년</option>)}
                                    </select>
                                    <select className="w-20 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthMonth}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthMonth: +e.target.value }))}>
                                      {months.map(m => <option key={m} value={m}>{m}월</option>)}
                                    </select>
                                    <select className="w-20 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
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
                                        className={`flex-1 h-10 rounded-xl text-body-sm font-semibold transition-all ${partnerInfo.gender === g.v ? 'text-white' : 'bg-bg-page border border-border-light text-text-muted'}`}
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
                                    출생 시간 <span className="text-[9px] opacity-60">(선택사항)</span>
                                  </label>
                                  <select className="w-full h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                    value={partnerInfo.birthHour}
                                    onChange={e => setPartnerInfo(p => ({ ...p, birthHour: +e.target.value }))}>
                                    <option value={-1}>모름</option>
                                    {Array.from({ length: 24 }, (_, i) => i).map(h => (
                                      <option key={h} value={h}>
                                        {`${String(h).padStart(2, '0')}시 (${['자','축','축','인','인','묘','묘','진','진','사','사','오','오','미','미','신','신','유','유','술','술','해','해','자'][h]}시)`}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[10px] text-text-hint mt-1">알면 시주까지 분석하여 더 정확해요</p>
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
                            <p className="text-[10px] text-text-hint">상태에 따라 분석 방향이 달라져요</p>
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
                                <div className="flex gap-2">
                                  <select className="flex-1 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                    value={extraInfo.bizOpenYear}
                                    onChange={e => setExtraInfo(p => ({ ...p, bizOpenYear: +e.target.value }))}>
                                    {Array.from({ length: 30 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}년</option>)}
                                  </select>
                                  <select className="w-24 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                    value={extraInfo.bizOpenMonth}
                                    onChange={e => setExtraInfo(p => ({ ...p, bizOpenMonth: +e.target.value }))}>
                                    {months.map(m => <option key={m} value={m}>{m}월</option>)}
                                  </select>
                                </div>
                                <p className="text-[10px] text-text-hint">개업 시점의 대운 흐름을 분석해드려요</p>
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
                            <p className="text-[10px] text-text-hint">상태에 따라 분석 방향이 달라져요</p>
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
                          <label className="text-[11px] text-text-hint mb-1 block">관심 분야 / 희망 직종 <span className="text-[9px] opacity-60">(선택)</span></label>
                          <input type="text" placeholder="예: IT개발, 디자인, 마케팅, 공무원..."
                            className="w-full h-10 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                            value={extraInfo.targetField}
                            onChange={e => setExtraInfo(p => ({ ...p, targetField: e.target.value }))} />
                          <p className="text-[10px] text-text-hint mt-1">입력하면 해당 분야의 사주적 적합도를 분석해요</p>
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
                            <p className="text-[10px] text-text-hint">목적과 시기에 맞는 분석을 해드려요</p>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-text-hint mb-1 block">이사 목적</label>
                          <div className="flex gap-2 flex-wrap mb-3">
                            {[
                              { v: 'house' as const, l: '주거 이사' },
                              { v: 'job' as const, l: '직장 이동' },
                              { v: 'study' as const, l: '유학/학업' },
                              { v: 'abroad' as const, l: '해외 이주' },
                            ].map(s => (
                              <button key={s.v}
                                className={`flex-1 min-w-[70px] h-10 rounded-xl text-[12px] font-semibold transition-all ${extraInfo.movePurpose === s.v ? 'text-white shadow-md' : 'bg-bg-page border border-border-light text-text-muted'}`}
                                style={extraInfo.movePurpose === s.v ? { background: topic.color } : {}}
                                onClick={() => setExtraInfo(p => ({ ...p, movePurpose: p.movePurpose === s.v ? '' : s.v }))}>
                                {s.l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-text-hint mb-1 block">이사 예정 시기 <span className="text-[9px] opacity-60">(선택)</span></label>
                          <div className="flex gap-2">
                            <select className="flex-1 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                              value={extraInfo.movePlanYear}
                              onChange={e => setExtraInfo(p => ({ ...p, movePlanYear: +e.target.value }))}>
                              {Array.from({ length: 5 }, (_, i) => currentYear + i).map(y => <option key={y} value={y}>{y}년</option>)}
                            </select>
                            <select className="w-24 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                              value={extraInfo.movePlanMonth}
                              onChange={e => setExtraInfo(p => ({ ...p, movePlanMonth: +e.target.value }))}>
                              {months.map(m => <option key={m} value={m}>{m}월</option>)}
                            </select>
                          </div>
                          <p className="text-[10px] text-text-hint mt-1">예정 시기의 이동운과 최적 방위를 분석해요</p>
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
                            <p className="text-[10px] text-text-hint">시험에 맞춘 정밀 분석을 해드려요</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[11px] text-text-hint mb-1 block">준비중인 시험 <span className="text-[9px] opacity-60">(선택)</span></label>
                            <input type="text" placeholder="예: 공무원, 수능, 토익, 자격증명..."
                              className="w-full h-10 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                              value={extraInfo.examName}
                              onChange={e => setExtraInfo(p => ({ ...p, examName: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-[11px] text-text-hint mb-1 block">시험 예정 시기 <span className="text-[9px] opacity-60">(선택)</span></label>
                            <div className="flex gap-2">
                              <select className="flex-1 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                value={extraInfo.examYear}
                                onChange={e => setExtraInfo(p => ({ ...p, examYear: +e.target.value }))}>
                                {Array.from({ length: 3 }, (_, i) => currentYear + i).map(y => <option key={y} value={y}>{y}년</option>)}
                              </select>
                              <select className="w-24 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                value={extraInfo.examMonth}
                                onChange={e => setExtraInfo(p => ({ ...p, examMonth: +e.target.value }))}>
                                {months.map(m => <option key={m} value={m}>{m}월</option>)}
                              </select>
                            </div>
                            <p className="text-[10px] text-text-hint mt-1">시험 시기에 맞춘 합격 전략을 세워드려요</p>
                          </div>
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
                            <Pictogram k="topic:letter" size={16} color="#7B1FA2" />
                            <div className="text-left">
                              <p className="text-h3 text-text-primary">재회 상대방 정보</p>
                              <p className="text-[10px] text-text-hint">입력하면 더 정확한 분석이 가능해요</p>
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
                                    className="w-full h-10 px-3 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary outline-none focus:border-2"
                                    style={{ '--tw-ring-color': topic.color } as any}
                                    value={partnerInfo.name}
                                    onChange={e => setPartnerInfo(p => ({ ...p, name: e.target.value }))} />
                                </div>

                                {/* 생년월일 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">생년월일 (양력)</label>
                                  <div className="flex gap-2">
                                    <select className="flex-1 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthYear}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthYear: +e.target.value }))}>
                                      {years.map(y => <option key={y} value={y}>{y}년</option>)}
                                    </select>
                                    <select className="w-20 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.birthMonth}
                                      onChange={e => setPartnerInfo(p => ({ ...p, birthMonth: +e.target.value }))}>
                                      {months.map(m => <option key={m} value={m}>{m}월</option>)}
                                    </select>
                                    <select className="w-20 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
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
                                        className={`flex-1 h-10 rounded-xl text-body-sm font-semibold transition-all ${partnerInfo.gender === g.v ? 'text-white' : 'bg-bg-page border border-border-light text-text-muted'}`}
                                        style={partnerInfo.gender === g.v ? { background: topic.color } : {}}
                                        onClick={() => setPartnerInfo(p => ({ ...p, gender: g.v }))}>
                                        {g.l}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* 헤어진 시기 */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">헤어진 시기</label>
                                  <div className="flex gap-2">
                                    <select className="flex-1 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.breakupYear}
                                      onChange={e => setPartnerInfo(p => ({ ...p, breakupYear: +e.target.value }))}>
                                      {Array.from({ length: 10 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}년</option>)}
                                    </select>
                                    <select className="w-24 h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                      value={partnerInfo.breakupMonth}
                                      onChange={e => setPartnerInfo(p => ({ ...p, breakupMonth: +e.target.value }))}>
                                      {months.map(m => <option key={m} value={m}>{m}월</option>)}
                                    </select>
                                  </div>
                                  <p className="text-[10px] text-text-hint mt-1">
                                    헤어진 기간에 따른 재회 에너지 변화를 분석해드려요
                                  </p>
                                </div>

                                {/* 상대방 출생 시간 (선택) */}
                                <div>
                                  <label className="text-[11px] text-text-hint mb-1 block">
                                    상대방 출생 시간 <span className="text-[9px] opacity-60">(선택사항)</span>
                                  </label>
                                  <select className="w-full h-10 px-2 rounded-xl bg-bg-page border border-border-light text-body-sm text-text-primary"
                                    value={partnerInfo.birthHour}
                                    onChange={e => setPartnerInfo(p => ({ ...p, birthHour: +e.target.value }))}>
                                    <option value={-1}>모름</option>
                                    {Array.from({ length: 24 }, (_, i) => i).map(h => (
                                      <option key={h} value={h}>
                                        {`${String(h).padStart(2, '0')}시 (${['자','축','축','인','인','묘','묘','진','진','사','사','오','오','미','미','신','신','유','유','술','술','해','해','자'][h]}시)`}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[10px] text-text-hint mt-1">
                                    알면 시주(時柱)까지 분석하여 더 정확한 결과를 드려요
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </FadeIn>
                  )}

                  {selected && (
                    <Button fullWidth size="lg" variant="gold" onClick={analyze}>
                      {topic.label} 분석하기 (1운)
                    </Button>
                  )}
                </>
              ) : (
                <div className="card text-center py-10 space-y-3">
                  <p className="text-h2 text-text-primary">사주를 먼저 입력해주세요</p>
                  <p className="text-body-sm text-text-muted">생년월일시를 입력하면 {topic.label} 심층분석을 받을 수 있어요</p>
                  <Button variant="gold" onClick={() => navigate('/input')}>사주 입력하기</Button>
                </div>
              )}
            </motion.div>
          )}

          {/* ====== 로딩 ====== */}
          {phase === 'loading' && (() => {
            const TOPIC_NOTES: Record<string, string> = {
              love: '도화살과 배우자궁을 분석하고 있어요.|당신의 연애 패턴을 사주에서 읽고 있어요.|인연의 시기를 월 단위로 계산하고 있어요.|사주적으로 궁합이 맞는 이성을 찾고 있어요.',
              wealth: '재성 구조로 돈 버는 스타일을 분석하고 있어요.|투자 적기를 대운 흐름으로 계산하고 있어요.|새는 돈 패턴을 사주에서 찾고 있어요.|식신생재, 겁재 구조를 확인하고 있어요.',
              career: '관성과 식상으로 직업 적성을 분석하고 있어요.|이직 최적 타이밍을 계산하고 있어요.|면접 유리 요일과 시간대를 확인하고 있어요.|딱 맞는 직종 TOP 5를 선정하고 있어요.',
              marriage: '배우자궁의 구조를 깊이 분석하고 있어요.|결혼 적기를 대운 흐름으로 계산하고 있어요.|사주로 배우자 성향을 추론하고 있어요.|결혼 후 생활 패턴까지 예측하고 있어요.',
              business: '사업 적성과 맞는 업종을 분석하고 있어요.|창업 최적 타이밍을 계산하고 있어요.|동업 궁합 구조를 확인하고 있어요.|편재와 식상으로 사업 구조를 읽고 있어요.',
              health: '오행 균형으로 체질을 정밀 분석하고 있어요.|취약 장기와 주의 시기를 확인하고 있어요.|사주에서 건강 리스크를 찾고 있어요.|맞춤 건강 보완법을 만들고 있어요.',
              reunion: '두 사람의 사주를 교차 분석하고 있어요.|상대방의 숨은 마음까지 읽고 있어요.|궁합 구조와 신살을 정밀 분석 중이에요.|재회 전략까지 세우고 있어요.',
              study: '인성 구조로 학습 체질을 분석하고 있어요.|합격 운과 최적 시기를 계산하고 있어요.|집중력 피크 시간대를 찾고 있어요.|시험 당일 전략까지 세우고 있어요.',
              social: '비겁과 귀인 구조로 관계를 분석하고 있어요.|귀인운이 언제 오는지 확인하고 있어요.|구설수 주의 시기를 계산하고 있어요.|사주적 관계 패턴을 읽고 있어요.',
              moving: '역마살과 이동운을 분석하고 있어요.|오행 방위로 좋은 방향을 계산하고 있어요.|이사 최적 시기를 확인하고 있어요.|해외운까지 분석하고 있어요.',
            };
            const reunionSteps = [
              '사주 원국을 깊이 분석하고 있어요',
              '상대방의 사주 성향을 추론하고 있어요',
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
                estimatedSeconds={topicId === 'reunion' ? 60 : 30}
              />
            );
          })()}

          {/* ====== 결과 ====== */}
          {phase === 'result' && result && (() => {
            // Phase D'-2 Bundle 2 — chrome theme 매핑 (5 주제만, 그 외 기존 디자인 유지)
            const chromeKey = (
              ['love', 'wealth', 'career', 'health', 'study'].includes(topicId || '')
                ? topicId
                : null
            ) as TopicChromeKey | null;
            const theme = chromeKey ? TOPIC_CHROME[chromeKey] : null;

            // 사주 8글자 mini cells (시→일→월→년)
            const sajuCells: TopicSajuMiniCell[] | null = (() => {
              if (!selected?.sajuData?.pillars?.length) return null;
              const labels = ['시', '일', '월', '년'];
              const pillars = [...selected.sajuData.pillars].reverse(); // 시→일→월→년
              return pillars.map((p: any, i: number) => ({
                label: labels[i] || '',
                gan: p.천간 || '',
                ji: p.지지 || '',
                ganOheng: p.천간오행,
                jiOheng: p.지지오행,
                ten: i === 1 ? '일간' : (p.십성 || ''),
                ilju: i === 1,
                key: false, // 핵심 신살 dot — 향후 신살 매칭으로 활성화
              }));
            })();

            // 사주→주제 link card pill chain (theme 있을 때만)
            const linkPills: TopicLinkPill[] | null = theme && selected?.sajuData?.pillars?.[2] ? (() => {
              const ilgan = selected.sajuData.pillars[2].천간 || '';
              const ilganOheng = selected.sajuData.pillars[2].천간오행 || '';
              // ?? (nullish) 사용 — AI 가 정상적으로 0 점 반환할 때 75 마스킹 방지
            // 0 점은 명리학적으로 유효한 값이므로 보존
            const score = (typeof result.overallScore === 'number' && !isNaN(result.overallScore))
              ? result.overallScore
              : 75;
              return [
                { text: ilgan ? `${ilgan}${ilganOheng ? '·' + ilganOheng : ''}` : '일간', variant: 'gan' },
                { text: result.topicData?.tenshin || theme.label, variant: 'ten' },
                { text: theme.hanja, variant: 'sinsal' },
                { text: String(score), variant: 'score' },
              ] as TopicLinkPill[];
            })() : null;

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
              {theme && (
                <div style={{ margin: '0 -20px 0' }}>
                  <TopicHero
                    theme={theme}
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
                    tierLabel="1운"
                  />
                </div>
              )}

              {/* ─── Phase D'-2 Bundle 2 · TopicSajuMini (8글자 4-cell) ─── */}
              {theme && sajuCells && sajuCells.length === 4 && (
                <div style={{ margin: '0 -20px' }}>
                  <TopicSajuMini theme={theme} cells={sajuCells} />
                </div>
              )}

              {/* ─── 종합 점수 — 5 주제는 TopicScoreCard, 그 외는 기존 ScoreRing 카드 ─── */}
              {theme ? (
                <div style={{ margin: '0 -20px' }}>
                  <TopicScoreCard
                    theme={theme}
                    score={score}
                    title={`${topic.label} 지수`}
                    body={`${j.reading} · ${j.desc}`}
                    note={result.sajuBasis ? stripMd(result.sajuBasis) : undefined}
                  />
                </div>
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
                      <p className="text-[10px] text-text-hint mb-1">사주 근거</p>
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
                    <p className="text-[9px] text-text-hint text-center mb-2">등급 기준</p>
                    <div className="flex justify-between px-1">
                      {GRADE_SCALE.map(g => {
                        const isActive = g.hanja === j.hanja;
                        return (
                          <div key={g.hanja} className="flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-all"
                            style={isActive ? { background: `${g.color}10`, outline: `1.5px solid ${g.color}30` } : {}}>
                            <span className="text-[13px] font-black" style={{ color: g.color, opacity: isActive ? 1 : 0.4 }}>{g.hanja}</span>
                            <span className="text-[8px]" style={{ color: isActive ? g.color : 'var(--text-disabled)' }}>{g.range}점</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>
              )}

              {/* ─── Phase D'-2 Bundle 2 · TopicLinkCard (사주→주제 chain) ─── */}
              {theme && linkPills && (
                <div style={{ margin: '0 -20px' }}>
                  <TopicLinkCard
                    theme={theme}
                    pills={linkPills}
                    desc={
                      <>
                        {result.sajuBasis ? (
                          stripMd(result.sajuBasis)
                        ) : (
                          <>
                            일간과 {topic.label.replace('운', '')} 영역의 연결이{' '}
                            <strong>{j.reading}</strong>의 결을 만듭니다.
                          </>
                        )}
                      </>
                    }
                  />
                </div>
              )}

              {/* ── 핵심 키워드 ── */}
              <KeywordTags keywords={result.topicData?.keywords} color={topic.color} />

              {/* ── 요약 ── */}
              <div className="card">
                <p className="text-body text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.summary) }} />
              </div>

              {/* ── 세부 역량 레이더 ── */}
              <SubScoreRadar subScores={result.topicData?.subScores} color={topic.color} />

              {/* ── 강점 / 주의점 ── */}
              <StrengthsCautions strengths={result.topicData?.strengths} cautions={result.topicData?.cautions} color={topic.color} />

              {/* ── 주제별 시각화 카드 ── */}
              <TopicViz topicId={topicId || ''} data={result.topicData} color={topic.color} sajuData={selected?.sajuData} birthYear={selected?.input?.birthYear} />

              {/* ── 섹션들 — 5 주제는 TopicSection 래핑, 그 외는 기존 디자인 ── */}
              {theme
                ? result.sections?.map((sec: any, i: number) => (
                    <FadeIn key={i} delay={0.05 * i}>
                      <div className="card">
                        <TopicSection
                          theme={theme}
                          num={`L${i + 1} · ${
                            i === 0 ? '지금' : i === 1 ? '가까운 흐름' : i === 2 ? '더 깊이' : '인생 큰 흐름'
                          }`}
                          title={sec.heading}
                          hanjaSuffix={
                            i === 0 ? '·一語' : i === 1 ? '·三月' : i === 2 ? '·一年' : '·終身'
                          }
                          sub={sec.highlight ? stripMd(sec.highlight) : undefined}
                        >
                          <SectionBody content={sec.content} color={topic.color} />
                          <InsightCards cards={sec.insightCards} color={topic.color} />
                        </TopicSection>
                      </div>
                    </FadeIn>
                  ))
                : result.sections?.map((sec: any, i: number) => (
                    <FadeIn key={i} delay={0.05 * i}>
                      <div className="card">
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                            style={{ background: topic.color }}>
                            {i + 1}
                          </span>
                          <p className="text-h3 text-text-primary">{sec.heading}</p>
                        </div>
                        {sec.highlight && (
                          <div className="mb-3 rounded-xl py-2.5 px-3" style={{ background: `${topic.color}08` }}>
                            <p className="text-[12px] font-semibold leading-snug" style={{ color: topic.color }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(sec.highlight) }} />
                          </div>
                        )}
                        <SectionBody content={sec.content} color={topic.color} />
                        <InsightCards cards={sec.insightCards} color={topic.color} />
                      </div>
                    </FadeIn>
                  ))}

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
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-hint)' }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: 'var(--text-disabled)' }} axisLine={false} tickLine={false} />
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
                          <span className="text-[10px] font-bold mt-0.5 w-14 flex-shrink-0 text-right" style={{ color: topic.color }}>{t.period}</span>
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
                              <p className="text-[9px] text-text-hint">{item.label}</p>
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

              {/* ── 5 주제 한정 · TopicUpsellCard (10운 프리미엄, 단일 CTA) ── */}
              {theme && (
                <FadeIn delay={0.25}>
                  <TopicUpsellCard
                    title={`${topic.label.replace('운', '')} 전체를 한 편으로 풀어드립니다`}
                    desc="대운별 흐름, 사주 전체에서 이 영역의 자리, 평생의 결까지. 한 번에 풀어냅니다."
                    onTap={() => navigate('/charge?need=10')}
                  />
                </FadeIn>
              )}

              {/* ── 5 주제 한정 · TopicSourceCite (풀이 근거 출처) ── */}
              {theme && result.citation && (
                <div style={{ margin: '0 -20px' }}>
                  <TopicSourceCite theme={theme} citation={stripMd(String(result.citation))} />
                </div>
              )}

              {/* ── 다른 주제 CTA ── */}
              <div className="space-y-2 pt-2">
                <p className="text-label text-text-hint text-center">다른 운세도 궁금하다면</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TOPICS).filter(([id]) => id !== topicId).slice(0, 4).map(([id, t]) => (
                    <button key={id} onClick={() => { navigate(`/topic/${id}`); setPhase('select'); setResult(null); setSelected((profiles[0] as unknown as LocalReport) || null); }}
                      className="card py-3 px-3 flex items-center gap-2">
                      <Pictogram k={`topic:${id as TopicKey}`} size={18} color={t.color} />
                      <span className="text-caption font-semibold text-text-primary">{t.label}</span>
                    </button>
                  ))}
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

              {/* 3-part Footer CTA (diff v3 §6) */}
              <FooterCTA pageKey={`topic:${topicId}` as FooterCTAPageKey} backTo="/" />
            </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}

export { TOPICS };
