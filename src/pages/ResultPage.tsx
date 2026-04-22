import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';
import { useSajuContext } from '@/contexts/SajuContext';
import { calculateSaju } from '@/services/saju/calculator';
import { Header } from '@/components/layout/Header';
import { CHEONGAN_OHENG, JIJI_OHENG, CHEONGAN_KO, JIJI_KO, CHEONGAN_EUMYANG } from '@/constants/oheng';
import { ErrorState } from '@/components/common/ErrorState';
import { FooterCTA } from '@/components/common/FooterCTA';
import { ShareModal } from '@/components/share/ShareModal';

import { getReport, getReports, getMyProfile } from '@/services/storage/localStore';
import { LuckyProfile } from '@/components/saju/LuckyProfile';
import { MonthlyFortune } from '@/components/saju/MonthlyFortune';
import { stripMd } from '@/utils/format';
import { RelationshipMap } from '@/components/saju/RelationshipMap';
import { WealthFlow } from '@/components/saju/WealthFlow';
import { Pictogram } from '@/components/brand/PictogramRegistry';
import type { OhengType, Pillar, SajuData, DaeUn, SipSung, JiJangGan, UnYoung, NaPeum, SinSal, GongMang } from '@/types/saju';

// ─── Element color config ───
type ElemKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
interface ElemColor {
  main: string;
  light: string;
  med: string;
  dark: string;
  grad: string;
}

const EC: Record<ElemKey, ElemColor> = {
  wood: { main: '#2d8a4e', light: '#e8f5e9', med: '#a5d6a7', dark: '#1b5e20', grad: 'linear-gradient(135deg,#e8f5e9,#c8e6c9)' },
  fire: { main: '#d32f2f', light: '#ffebee', med: '#ef9a9a', dark: '#b71c1c', grad: 'linear-gradient(135deg,#ffebee,#ffcdd2)' },
  earth: { main: '#f57f17', light: '#fff8e1', med: '#ffe082', dark: '#e65100', grad: 'linear-gradient(135deg,#fff8e1,#ffecb3)' },
  metal: { main: '#757575', light: '#f5f5f5', med: '#e0e0e0', dark: '#424242', grad: 'linear-gradient(135deg,#f5f5f5,#e0e0e0)' },
  water: { main: '#1565c0', light: '#e3f2fd', med: '#90caf9', dark: '#0d47a1', grad: 'linear-gradient(135deg,#e3f2fd,#bbdefb)' },
};
const EKR: Record<ElemKey, string> = { wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)' };
const EHAN: Record<ElemKey, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

// ─── 오행 한글→영문 변환 ───
const OHENG_TO_ELEM: Record<OhengType, ElemKey> = { 목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water' };
const OHENG_KR_LABEL: Record<OhengType, string> = { 목: '목', 화: '화', 토: '토', 금: '금', 수: '수' };

// ─── Demo data generator ───
function getDemoData(): SajuData {
  return calculateSaju({
    name: '준기',
    birthYear: 1998,
    birthMonth: 3,
    birthDay: 3,
    calendarType: 'solar',
    gender: 'male',
    hasBirthTime: true,
    birthHour: 5,
    birthMinute: 0,
  });
}

// ─── Data mapping types ───
interface V4Pillar {
  label: string;
  sub: string;
  gH: string;
  jH: string;
  gKr: string;
  jKr: string;
  gE: ElemKey;
  jE: ElemKey;
  gM: string;
  jM: string;
  gSip: string;
  jSip: string;
  desc: string;
  isMe?: boolean;
  empty?: boolean;
}

interface V4Unyoung {
  pillar: string;
  value: string;
  kr: string;
  color: string;
  meaning: string;
}

interface V4Daeun {
  age: string;
  gz: string;
  kr: string;
  elem: ElemKey;
  label: string;
  period: string;
  current?: boolean;
}

interface V4Napeum {
  pillar: string;
  hanja: string;
  kr: string;
  icon: string;
  desc: string;
}

interface V4SinSal {
  hanja: string;
  kr: string;
  desc: string;
  source: string; // 어떤 기준의 신살인지 (예: "일주")
}

interface V4GongMang {
  basis: string;
  value: string;
  kr: string;
  meaning: string;
  category: string;
  tip: string;
}

interface V4Elements {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
}

// ─── Data mapping functions ───
const POSITION_LABELS: Record<string, { label: string; sub: string; desc: string }> = {
  year: { label: '년주', sub: '年柱', desc: '조상·사회·어린시절' },
  month: { label: '월주', sub: '月柱', desc: '부모·직장·청년기' },
  day: { label: '일주', sub: '日柱', desc: '나·배우자·중년기' },
  time: { label: '시주', sub: '時柱', desc: '자녀·말년·결과물' },
};

function mapPillars(pillars: Pillar[], sipsung: SipSung[]): V4Pillar[] {
  return pillars.map((p) => {
    const meta = POSITION_LABELS[p.position];
    if (!p.available) {
      return {
        label: meta.label,
        sub: meta.sub,
        gH: '',
        jH: '',
        gKr: '',
        jKr: '',
        gE: 'earth' as ElemKey,
        jE: 'earth' as ElemKey,
        gM: '',
        jM: '',
        gSip: '',
        jSip: '',
        desc: meta.desc,
        empty: true,
      };
    }

    // Find sipsung for this pillar's gan and zhi
    const ganPos = p.position === 'year' ? '년간' : p.position === 'month' ? '월간' : p.position === 'day' ? '일간' : '시간';
    const zhiPos = p.position === 'year' ? '년지' : p.position === 'month' ? '월지' : p.position === 'day' ? '일지' : '시지';
    const ganSip = sipsung.find(s => s.position === ganPos);
    const zhiSip = sipsung.find(s => s.position === zhiPos);

    const gSipLabel = ganSip ? (ganSip.십성 === '일주' ? '일주(나)' : ganSip.십성) : '';
    const jSipLabel = zhiSip ? zhiSip.십성 : '';

    return {
      label: meta.label,
      sub: meta.sub,
      gH: p.천간,
      jH: p.지지,
      gKr: p.천간읽기,
      jKr: p.지지읽기,
      gE: OHENG_TO_ELEM[p.천간오행],
      jE: OHENG_TO_ELEM[p.지지오행],
      gM: OHENG_KR_LABEL[p.천간오행],
      jM: OHENG_KR_LABEL[p.지지오행],
      gSip: gSipLabel,
      jSip: jSipLabel,
      desc: meta.desc,
      isMe: p.position === 'day',
    };
  });
}

function mapElements(elements: Record<OhengType, number>): V4Elements {
  // Convert raw counts to approximate percentage-like values
  const total = Object.values(elements).reduce((s, v) => s + v, 0);
  if (total === 0) return { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  return {
    wood: Math.round((elements['목'] / total) * 100),
    fire: Math.round((elements['화'] / total) * 100),
    earth: Math.round((elements['토'] / total) * 100),
    metal: Math.round((elements['금'] / total) * 100),
    water: Math.round((elements['수'] / total) * 100),
  };
}

function getUnyoungColor(value: string): string {
  // Map Chinese 12운성 values to colors
  const green = ['長生', '长生', '冠帶', '冠带', '臨官', '临官', '帝旺'];
  const orange = ['衰', '病', '墓', '絶', '绝', '養', '养', '胎'];
  const red = ['死'];
  if (green.some(v => value.includes(v))) return '#27ae60';
  if (red.some(v => value.includes(v))) return '#e74c3c';
  if (orange.some(v => value.includes(v))) return '#e67e22';
  return '#8b7e6f';
}

function getUnyoungKr(value: string): string {
  const map: Record<string, string> = {
    '長生': '장생', '长生': '장생', '沐浴': '목욕', '冠帶': '관대', '冠带': '관대',
    '臨官': '임관', '临官': '임관', '帝旺': '제왕', '衰': '쇠',
    '病': '병', '死': '사', '墓': '묘', '絶': '절', '绝': '절',
    '胎': '태', '養': '양', '养': '양',
  };
  return map[value] ?? value;
}

function getUnyoungMeaning(value: string, position: string): string {
  const kr = getUnyoungKr(value);
  const posLabel = position;
  if (kr === '장생') return `${posLabel}에서 생명력이 넘침! 끊임없이 새로운 것을 만들어내는 에너지.`;
  if (kr === '사') {
    if (posLabel.includes('년')) return '에너지가 내면으로 수렴. 겉으로 과시하기보다 내면의 깊이를 추구합니다.';
    if (posLabel.includes('월')) return '직장·사회에서도 내면 지향. 겉으로 드러내지 않는 실력자 타입.';
    return '에너지가 내면으로 수렴되는 상태.';
  }
  if (kr === '병') return '결과물·말년 영역의 에너지가 약해지는 단계. 건강 관리와 무리하지 않는 페이스 조절이 중요.';
  if (kr === '제왕') return '에너지가 최고조! 강력한 추진력과 리더십.';
  if (kr === '관대') return '성장하며 빛나는 단계. 사회적 인정과 발전.';
  if (kr === '임관') return '본격적으로 힘을 발휘하는 단계.';
  if (kr === '쇠') return '에너지가 서서히 줄어드는 때. 내실을 다지는 시기.';
  if (kr === '묘') return '에너지가 저장되는 시기. 잠재력을 키우는 때.';
  if (kr === '절') return '완전한 전환기. 새로운 시작을 준비하는 때.';
  if (kr === '태') return '새로운 가능성이 싹트는 시기.';
  if (kr === '양') return '힘을 기르고 준비하는 단계.';
  if (kr === '목욕') return '변화와 적응의 시기. 유연성이 중요.';
  return '독특한 에너지 상태.';
}

function mapUnyoung12(unyoung: UnYoung[], pillars: Pillar[]): V4Unyoung[] {
  return unyoung.map((u) => {
    const p = pillars.find(pp =>
      (u.position === '년지' && pp.position === 'year') ||
      (u.position === '월지' && pp.position === 'month') ||
      (u.position === '일지' && pp.position === 'day') ||
      (u.position === '시지' && pp.position === 'time')
    );
    const jijiStr = p ? `${p.지지}(${p.지지읽기})` : '';
    return {
      pillar: `${u.position} ${jijiStr}`,
      value: u.운성,
      kr: getUnyoungKr(u.운성),
      color: getUnyoungColor(u.운성),
      meaning: getUnyoungMeaning(u.운성, u.position),
    };
  });
}

function mapDaeun(daeunList: DaeUn[], birthYear: number): V4Daeun[] {
  const labels = ['학업기', '확립기', '안정기', '확립기', '수확기', '원숙기', '완성기', '지혜기', '관조기', '회고기'];
  // 비정상 항목 + 간지 없는 소운 기간 필터
  const valid = daeunList.filter(d => d.시작나이 <= d.끝나이 && d.간지 && d.간지.trim().length > 0);
  return valid.slice(0, 8).map((d, i) => {
    const ganOheng = CHEONGAN_OHENG[d.천간];
    const elem = ganOheng ? OHENG_TO_ELEM[ganOheng] : 'earth';
    const ganKr = CHEONGAN_KO[d.천간] ?? d.천간;
    const zhiKr = JIJI_KO[d.지지] ?? d.지지;
    let label = labels[i] ?? `${i + 1}기`;
    if (d.isCurrent) label = '현재';
    return {
      age: `${d.시작나이}~${d.끝나이}세`,
      gz: d.간지,
      kr: `${ganKr}${zhiKr}`,
      elem,
      label,
      period: `${birthYear + d.시작나이}~${birthYear + d.끝나이}`,
      current: d.isCurrent,
    };
  });
}

function getNapeumIcon(napeum: string): string {
  if (napeum.includes('火') || napeum.includes('화')) return '火';
  if (napeum.includes('水') || napeum.includes('수')) return '水';
  if (napeum.includes('土') || napeum.includes('토')) return '土';
  if (napeum.includes('金') || napeum.includes('금')) return '金';
  if (napeum.includes('木') || napeum.includes('목')) return '木';
  return '音';
}

function getNapeumDesc(napeum: string): string {
  const descMap: Record<string, string> = {
    '城头土': '성벽 위의 흙 — 높은 곳에서 넓게 바라보는 시야',
    '城頭土': '성벽 위의 흙 — 높은 곳에서 넓게 바라보는 시야',
    '大溪水': '큰 계곡의 물 — 깊고 맑으며 끊임없이 흐르는 지혜',
    '大驿土': '역참의 넓은 땅 — 많은 사람이 오가며 인연이 풍부',
    '大驛土': '역참의 넓은 땅 — 많은 사람이 오가며 인연이 풍부',
    '炉中火': '화로 안의 불 — 내면에 숨겨진 뜨거운 열정과 창작의 불꽃',
    '爐中火': '화로 안의 불 — 내면에 숨겨진 뜨거운 열정과 창작의 불꽃',
    '山头火': '산꼭대기의 불 — 멀리서도 보이는 존재감과 리더십',
    '山頭火': '산꼭대기의 불 — 멀리서도 보이는 존재감과 리더십',
    '海中金': '바다 속의 금 — 숨겨진 가치가 있으며 깊이 파야 빛남',
    '剑锋金': '칼날의 금 — 날카로운 판단력과 결단력',
    '劍鋒金': '칼날의 금 — 날카로운 판단력과 결단력',
    '白蜡金': '백랍의 금 — 섬세하고 정교한 손재주',
    '白蠟金': '백랍의 금 — 섬세하고 정교한 손재주',
    '沙中金': '모래 속의 금 — 인내 끝에 빛나는 실력',
    '金箔金': '금박의 금 — 겉으로 빛나는 매력과 표현력',
    '钗钏金': '비녀의 금 — 우아함과 세련된 감각',
    '釵釧金': '비녀의 금 — 우아함과 세련된 감각',
    '天河水': '은하수 — 상상력과 이상이 높음',
    '涧下水': '계곡 아래 물 — 조용하지만 깊은 사고력',
    '澗下水': '계곡 아래 물 — 조용하지만 깊은 사고력',
    '长流水': '끊임없이 흐르는 물 — 꾸준함과 지속력',
    '長流水': '끊임없이 흐르는 물 — 꾸준함과 지속력',
    '泉中水': '샘물 — 내면에서 솟아나는 창의력',
    '大海水': '대해의 물 — 포용력과 넓은 도량',
    '霹雳火': '번개불 — 순간적 폭발력과 번뜩이는 아이디어',
    '霹靂火': '번개불 — 순간적 폭발력과 번뜩이는 아이디어',
    '天上火': '하늘의 불 — 밝고 따뜻한 에너지, 주변을 환하게 함',
    '佛灯火': '부처의 등불 — 지혜의 빛, 깨달음과 통찰력',
    '佛燈火': '부처의 등불 — 지혜의 빛, 깨달음과 통찰력',
    '覆灯火': '등잔불 — 가까이에서 은은하게 비추는 따뜻함',
    '覆燈火': '등잔불 — 가까이에서 은은하게 비추는 따뜻함',
    '山下火': '산 아래 불 — 땅 속의 열정, 묵묵히 타오르는 의지',
    '路旁土': '길가의 흙 — 누구나 밟고 지나가는 포용력',
    '壁上土': '벽 위의 흙 — 든든한 울타리, 보호와 안정',
    '沙中土': '모래 속의 흙 — 유연하고 적응력이 뛰어남',
    '屋上土': '지붕 위의 흙 — 가정과 안식처를 중시',
    '平地木': '평지의 나무 — 안정적 성장, 꾸준한 발전',
    '桑柘木': '뽕나무 — 실용적이고 사람들에게 도움이 됨',
    '桑柺木': '뽕나무 — 실용적이고 사람들에게 도움이 됨',
    '松柏木': '소나무 — 사계절 변하지 않는 절개와 끈기',
    '大林木': '큰 숲의 나무 — 리더십과 큰 그릇',
    '杨柳木': '버드나무 — 유연함과 적응력, 예술적 감성',
    '楊柳木': '버드나무 — 유연함과 적응력, 예술적 감성',
    '石榴木': '석류나무 — 겉은 단단하고 속은 풍성한 다재다능',
  };
  return descMap[napeum] ?? `${napeum}의 근본 에너지`;
}

function getNapeumPracticalTip(napeum: string): string {
  const tips: Record<string, string> = {
    '城头土': '큰 그림을 보는 능력이 강해요. 전략적 사고, 기획, 관리에 유리하고 남들이 못 보는 기회를 포착하는 타입이에요.',
    '城頭土': '큰 그림을 보는 능력이 강해요. 전략적 사고, 기획, 관리에 유리하고 남들이 못 보는 기회를 포착하는 타입이에요.',
    '大溪水': '깊이 파고드는 능력이 뛰어나요. 한 분야를 오래 파면 전문가가 되고, 연구·분석·학습에 재능이 있어요.',
    '大驿土': '사람들이 자연스럽게 모이는 체질이에요. 네트워킹·커뮤니티·서비스업에 강하고, 인맥이 재산이 되는 타입이에요.',
    '大驛土': '사람들이 자연스럽게 모이는 체질이에요. 네트워킹·커뮤니티·서비스업에 강하고, 인맥이 재산이 되는 타입이에요.',
    '炉中火': '겉으론 조용하지만 작업에 몰입하면 폭발적 집중력을 보여줘요. 창작·예술·개발에 강점이에요.',
    '爐中火': '겉으론 조용하지만 작업에 몰입하면 폭발적 집중력을 보여줘요. 창작·예술·개발에 강점이에요.',
    '山头火': '존재감이 강하고 리더십이 있어요. 사람들 앞에 서면 자연스럽게 주목받는 타입이에요.',
    '山頭火': '존재감이 강하고 리더십이 있어요. 사람들 앞에 서면 자연스럽게 주목받는 타입이에요.',
    '海中金': '겉으로 드러나지 않지만 내면의 실력이 탄탄해요. 꾸준히 실력을 쌓으면 때가 되어 빛나요.',
    '剑锋金': '결단력과 분석력이 뛰어나요. 빠른 판단이 필요한 상황에서 강점을 보여요.',
    '劍鋒金': '결단력과 분석력이 뛰어나요. 빠른 판단이 필요한 상황에서 강점을 보여요.',
    '白蜡金': '섬세하고 정교한 작업에 재능이 있어요. 디자인, 공예, 정밀 작업에 유리해요.',
    '白蠟金': '섬세하고 정교한 작업에 재능이 있어요. 디자인, 공예, 정밀 작업에 유리해요.',
    '沙中金': '인내심이 강해요. 당장은 안 보여도 꾸준히 하면 반드시 결과가 나오는 타입이에요.',
    '金箔金': '첫인상이 좋고 표현력이 뛰어나요. 영업, 프레젠테이션, 콘텐츠 제작에 유리해요.',
    '天河水': '상상력과 이상이 높아요. 창의적 직업, 기획, 예술 분야에서 빛을 발해요.',
    '涧下水': '조용하지만 깊은 사고력의 소유자예요. 혼자만의 시간에 최고의 아이디어가 나와요.',
    '澗下水': '조용하지만 깊은 사고력의 소유자예요. 혼자만의 시간에 최고의 아이디어가 나와요.',
    '长流水': '꾸준함이 최대 무기예요. 단기보다 장기 프로젝트에서 강점을 보이는 타입이에요.',
    '長流水': '꾸준함이 최대 무기예요. 단기보다 장기 프로젝트에서 강점을 보이는 타입이에요.',
    '泉中水': '내면에서 끊임없이 아이디어가 솟아나요. 창작, 기획, 문제 해결에 재능이 있어요.',
    '大海水': '포용력이 크고 도량이 넓어요. 리더십과 팀 관리에 강점이 있는 타입이에요.',
    '霹雳火': '순간적인 번뜩임이 강해요. 위기 상황에서 빠른 대처 능력이 뛰어나요.',
    '霹靂火': '순간적인 번뜩임이 강해요. 위기 상황에서 빠른 대처 능력이 뛰어나요.',
    '天上火': '밝고 따뜻한 에너지로 주변 사람들에게 긍정적 영향을 줘요. 대인관계가 자산이에요.',
    '佛灯火': '통찰력과 지혜가 깊어요. 상담, 교육, 멘토링에 재능이 있어요.',
    '佛燈火': '통찰력과 지혜가 깊어요. 상담, 교육, 멘토링에 재능이 있어요.',
    '覆灯火': '가까운 사람들에게 따뜻한 영향을 주는 타입이에요. 소규모 팀에서 강점이 돋보여요.',
    '覆燈火': '가까운 사람들에게 따뜻한 영향을 주는 타입이에요. 소규모 팀에서 강점이 돋보여요.',
    '山下火': '묵묵히 타오르는 의지가 있어요. 남들이 포기할 때도 끝까지 밀어붙이는 끈기파예요.',
    '路旁土': '누구와도 잘 어울리는 포용력이 있어요. 서비스, 상담, 교육 분야에 유리해요.',
    '壁上土': '가정과 안정을 중시하고, 든든한 울타리 역할을 잘해요. 신뢰받는 타입이에요.',
    '沙中土': '유연하고 적응력이 뛰어나요. 환경이 바뀌어도 빠르게 적응하는 강점이 있어요.',
    '屋上土': '가정과 안식처를 중시하는 타입이에요. 부동산이나 공간 관련 분야와 인연이 있어요.',
    '平地木': '꾸준히 성장하는 타입이에요. 급격한 변화보다 안정적으로 실력을 쌓는 게 유리해요.',
    '桑柘木': '실용적이고 사람들에게 도움이 되는 일에 보람을 느껴요. 사회적 기여에 강점.',
    '桑柺木': '실용적이고 사람들에게 도움이 되는 일에 보람을 느껴요. 사회적 기여에 강점.',
    '松柏木': '끈기와 절개가 강해요. 어려운 상황에서도 흔들리지 않는 멘탈이 최대 무기예요.',
    '大林木': '그릇이 크고 리더십이 있어요. 큰 조직이나 프로젝트를 이끄는 데 적합해요.',
    '杨柳木': '유연하고 예술적 감성이 뛰어나요. 트렌드 파악과 감성적 콘텐츠 제작에 강해요.',
    '楊柳木': '유연하고 예술적 감성이 뛰어나요. 트렌드 파악과 감성적 콘텐츠 제작에 강해요.',
    '石榴木': '다재다능하고 겉과 속이 다른 풍성한 재능이 있어요. 여러 분야에서 성과를 낼 수 있어요.',
  };
  return tips[napeum] ?? '이 에너지의 성질이 당신의 기본 행동 패턴에 영향을 줘요.';
}

function mapNapeum(napeumList: NaPeum[]): V4Napeum[] {
  return napeumList.map(n => ({
    pillar: n.position,
    hanja: n.납음,
    kr: n.납음한자 || n.납음,
    icon: getNapeumIcon(n.납음),
    desc: getNapeumDesc(n.납음),
  }));
}

// ─── 신살 한글 읽기 + 설명 데이터베이스 ───
const SINSAL_KR: Record<string, string> = {
  // 길신
  天恩: '천은', 陰德: '음덕', 阴德: '음덕', 福生: '복생', 除神: '제신',
  玉堂: '옥당', 鳴吠: '명폐', 鸣吠: '명폐', 天德: '천덕', 月德: '월덕',
  天喜: '천희', 天赦: '천사', 天福: '천복', 天巫: '천무', 福德: '복덕',
  聖心: '성심', 圣心: '성심', 五合: '오합', 六合: '육합', 天成: '천성',
  天官: '천관', 母倉: '모창', 母仓: '모창', 要安: '요안', 不將: '불장', 不将: '불장',
  守日: '수일', 天馬: '천마', 天马: '천마', 解神: '해신', 驛馬: '역마', 驿马: '역마',
  天瑞: '천서', 續世: '속세', 续世: '속세', 陽德: '양덕', 阳德: '양덕',
  益後: '익후', 益后: '익후', 生氣: '생기', 生气: '생기', 時陽: '시양', 时阳: '시양',
  時德: '시덕', 时德: '시덕', 民日: '민일', 三合: '삼합', 臨日: '임일', 临日: '임일',
  天醫: '천의', 天医: '천의', 普護: '보호', 普护: '보호', 敬安: '경안',
  // 흉살
  月破: '월파', 大耗: '대모', 災煞: '재살', 灾煞: '재살', 天火: '천화',
  月厌: '월염', 月厭: '월염', 地火: '지화', 五虛: '오허', 五虚: '오허',
  五離: '오리', 五离: '오리', 元武: '원무', 白虎: '백호', 朱雀: '주작',
  勾陳: '구진', 勾陈: '구진', 天吏: '천리', 天賊: '천적', 天贼: '천적',
  重日: '중일', 復日: '복일', 复日: '복일', 歸忌: '귀기', 归忌: '귀기',
  血忌: '혈기', 血支: '혈지', 月刑: '월형', 月害: '월해', 遊禍: '유화', 游祸: '유화',
  九空: '구공', 八專: '팔전', 八专: '팔전', 四擊: '사격', 四击: '사격',
  四窮: '사궁', 四穷: '사궁', 四忌: '사기', 四廢: '사폐', 四废: '사폐',
  致死: '치사', 地囊: '지낭', 天罡: '천강', 受死: '수사',
  大煞: '대살', 大殺: '대살', 荒蕪: '황무', 往亡: '왕망', 天棒: '천봉',
  天狗: '천구', 河魁: '하괴', 飛廉: '비렴', 飞廉: '비렴', 劫煞: '겁살',
  土府: '토부', 月煞: '월살', 歲煞: '세살', 岁煞: '세살',
};

const SINSAL_DESC: Record<string, string> = {
  // 길신 — 구체적 설명
  天恩: '위기 때 예상 못한 도움이 들어오는 기운. 귀인이 알아서 찾아오는 체질',
  陰德: '남몰래 베푼 선행이 복으로 돌아오는 운. 드러내지 않을수록 더 커짐', 阴德: '남몰래 베푼 선행이 복으로 돌아오는 운. 드러내지 않을수록 더 커짐',
  福生: '타고난 복 체질. 큰 노력 없이도 자연스럽게 좋은 기회가 따르는 편',
  除神: '장애물과 방해를 제거하는 힘. 난관을 돌파하는 추진력이 있음',
  玉堂: '학문·배움에서 귀인을 만남. 자격증·학위 취득에 유리',
  鳴吠: '말과 글로 사람을 움직이는 힘. 콘텐츠·발표·설득에 재능', 鸣吠: '말과 글로 사람을 움직이는 힘. 콘텐츠·발표·설득에 재능',
  天德: '하늘이 보호하는 기운. 큰 위기에서도 무사히 넘기는 수호 에너지',
  月德: '매월 꾸준히 들어오는 소소한 행운. 복리처럼 쌓이는 타입',
  天喜: '경사스러운 일이 잘 찾아옴. 결혼·승진·합격 등 기쁜 소식과 인연',
  天赦: '실수해도 용서받는 운. 위기를 기회로 전환하는 능력',
  天福: '타고난 복이 깊음. 물질적·정신적 풍요가 함께 따르는 기운',
  天巫: '영적 감각이 뛰어남. 직감이 정확하고 사람의 속마음을 잘 읽음',
  福德: '덕을 베풀수록 복이 커지는 구조. 나눔이 곧 투자',
  聖心: '마음이 순수하고 선한 에너지. 진심이 통하는 관계를 맺음', 圣心: '마음이 순수하고 선한 에너지. 진심이 통하는 관계를 맺음',
  五合: '화합하는 힘. 사람들을 연결하고 중재하는 능력이 뛰어남',
  六合: '인연을 맺는 힘이 강함. 좋은 파트너·동료를 만나는 운',
  天成: '하고자 하는 일이 자연스럽게 이루어지는 기운',
  天官: '사회적 지위·명예를 얻는 힘. 승진·인정과 인연이 깊음',
  母倉: '양육과 보살핌의 에너지. 사람을 키우고 성장시키는 데 재능', 母仓: '양육과 보살핌의 에너지. 사람을 키우고 성장시키는 데 재능',
  天馬: '이동·변화에서 기회를 잡음. 여행·이직·이사가 행운으로 연결', 天马: '이동·변화에서 기회를 잡음. 여행·이직·이사가 행운으로 연결',
  解神: '복잡한 문제를 풀어내는 힘. 갈등 해결과 중재에 강점',
  驛馬: '활동적 에너지. 움직일수록 운이 트이는 타입', 驿马: '활동적 에너지. 움직일수록 운이 트이는 타입',
  陽德: '베풀면 되돌아오는 기운. 밝고 따뜻한 에너지가 주변에 전파', 阳德: '베풀면 되돌아오는 기운. 밝고 따뜻한 에너지가 주변에 전파',
  生氣: '생명력과 활력이 넘침. 새로운 시작에 유리한 기운', 生气: '생명력과 활력이 넘침. 새로운 시작에 유리한 기운',
  時德: '때를 잘 만나는 운. 타이밍이 잘 맞아떨어지는 사람', 时德: '때를 잘 만나는 운. 타이밍이 잘 맞아떨어지는 사람',
  天醫: '치유의 기운. 의료·상담·힐링 분야에 적성이 있음', 天医: '치유의 기운. 의료·상담·힐링 분야에 적성이 있음',
  守日: '지키는 힘이 강함. 맡은 일을 끝까지 완수하는 끈기',
  三合: '세 가지 기운이 조화를 이룸. 팀워크와 협업에서 빛남',
  要安: '안정의 기운. 혼란 속에서도 중심을 잡는 능력',
  不將: '조용히 실력을 쌓는 타입. 겉으로 드러나지 않지만 실속이 있음', 不将: '조용히 실력을 쌓는 타입. 겉으로 드러나지 않지만 실속이 있음',
  普護: '두루 보호받는 기운. 위험한 상황에서도 안전한 편', 普护: '두루 보호받는 기운. 위험한 상황에서도 안전한 편',
  // 흉살 — 구체적 설명
  月破: '계획이 중간에 깨지기 쉬움. 중요한 일은 백업 플랜 필수',
  大耗: '예상 밖 지출이 발생하기 쉬움. 재정 관리에 각별히 주의',
  災煞: '갑작스러운 사건·사고에 주의. 안전 불감증이 가장 큰 적', 灾煞: '갑작스러운 사건·사고에 주의. 안전 불감증이 가장 큰 적',
  天火: '급격한 감정 폭발 주의. 분노 조절과 스트레스 관리가 과제',
  月厌: '주변의 질투나 시기를 받기 쉬움. 성과를 드러내기보다 겸손함이 보호막', 月厭: '주변의 질투나 시기를 받기 쉬움. 성과를 드러내기보다 겸손함이 보호막',
  地火: '가정·거주 환경에서 문제가 생기기 쉬움. 이사·인테리어 신중하게',
  五虛: '체력이 바닥나기 쉬운 체질. 규칙적 운동과 충분한 수면이 필수', 五虚: '체력이 바닥나기 쉬운 체질. 규칙적 운동과 충분한 수면이 필수',
  五離: '오해가 생기기 쉬운 체질. 커뮤니케이션에 의식적 노력 필요', 五离: '오해가 생기기 쉬운 체질. 커뮤니케이션에 의식적 노력 필요',
  元武: '속마음을 잘 드러내지 않는 성향. 신뢰하는 사람에겐 열어보는 연습',
  白虎: '급하게 행동하면 다치기 쉬움. 침착함과 안전이 최우선',
  朱雀: '말실수가 큰 화를 부를 수 있음. "한 번 더 생각하고 말하기" 습관화',
  勾陳: '법적 문제·계약 분쟁에 주의. 전문가 도움을 받는 게 안전', 勾陈: '법적 문제·계약 분쟁에 주의. 전문가 도움을 받는 게 안전',
  天吏: '관공서·기관과의 일에 지연 가능. 서류는 미리미리 준비',
  天賊: '도난·사기 주의. 재물 관리와 보안에 신경 쓸 것', 天贼: '도난·사기 주의. 재물 관리와 보안에 신경 쓸 것',
  重日: '같은 실수를 반복하기 쉬움. 패턴을 인식하고 의식적으로 바꿀 것',
  復日: '지나간 문제가 재발할 수 있음. 근본 원인을 해결해야 반복 안 됨', 复日: '지나간 문제가 재발할 수 있음. 근본 원인을 해결해야 반복 안 됨',
  歸忌: '귀가·복귀 시 주의. 여행 후 컨디션 관리 중요', 归忌: '귀가·복귀 시 주의. 여행 후 컨디션 관리 중요',
  血忌: '건강 검진 꼼꼼히. 특히 혈액·순환계통 관리',
  血支: '출혈·수술 주의. 날카로운 것 취급 시 조심',
  月刑: '대인관계에서 마찰이 생기기 쉬움. 양보가 최선의 전략',
  月害: '뜻밖의 방해가 들어올 수 있음. 플랜B 항상 준비',
  遊禍: '외출·여행 중 사고 주의. 교통 안전 최우선', 游祸: '외출·여행 중 사고 주의. 교통 안전 최우선',
  九空: '계획이 공중분해될 수 있음. 구두 약속보다 문서 확인',
  致死: '무리한 일정 금지. 과로가 가장 큰 적',
  天罡: '강한 에너지가 폭발할 수 있음. 분노를 제어하는 연습',
  河魁: '예민한 감정 기복에 주의. 명상·호흡 등 안정 루틴 추천',
  受死: '에너지가 극도로 떨어지는 시기. 무리하지 말고 쉬어갈 것',
  往亡: '방향 감각을 잃기 쉬움. 중요한 결정은 하루 묵혔다가',
  劫煞: '재물 손실에 주의. 투자·보증·대출 신중하게', 겁살: '재물 손실에 주의. 투자·보증·대출 신중하게',
};

const SINSAL_TIP: Record<string, string> = {
  // 길신 실전 활용
  天恩: '어려울 때 주변에 도움을 요청하세요. 예상치 못한 귀인이 나타날 확률이 높아요',
  陰德: '남몰래 선행을 베풀면 더 큰 복으로 돌아와요. 기부·봉사 활동 추천', 阴德: '남몰래 선행을 베풀면 더 큰 복으로 돌아와요. 기부·봉사 활동 추천',
  福生: '감사 일기를 쓰면 복의 체질이 더 강해져요. 긍정 에너지를 의식적으로 유지하세요',
  除神: '장애물을 만나도 쉽게 돌파하는 힘이 있어요. 어려운 프로젝트에 자원하세요',
  玉堂: '배움과 학문에서 귀인이 나타나요. 자격증·학위 취득에 유리한 운이에요',
  鳴吠: '글쓰기·발표·SNS 등 표현 활동에 재능이 있어요. 적극적으로 의견을 내세요', 鸣吠: '글쓰기·발표·SNS 등 표현 활동에 재능이 있어요. 적극적으로 의견을 내세요',
  天德: '큰 위기에서도 안전하게 넘기는 수호 에너지예요. 과감한 도전에 유리해요',
  月德: '매월 꾸준히 소소한 행운이 따라요. 복권보다 꾸준한 투자가 잘 맞아요',
  天喜: '경사스러운 기회가 잘 찾아와요. 모임이나 네트워킹에 적극 참여하세요',
  天赦: '실수에서 배우는 게 빠른 편이에요. 두려워 말고 새로운 시도를 하세요',
  天福: '베풀수록 더 많이 들어오는 구조예요. 인색하지 않게 나누세요',
  天巫: '명상·직관 훈련을 하면 감각이 더 날카로워져요. 첫인상을 믿으세요',
  五合: '팀 프로젝트·협업에서 리더십을 발휘하세요. 사람을 모으는 힘이 있어요',
  六合: '소개팅·네트워킹에 적극적으로 나서세요. 좋은 인연이 올 확률이 높아요',
  天成: '시작한 일은 대부분 완성되는 기운. 망설이지 말고 행동으로 옮기세요',
  天官: '승진·자격·인정이 필요한 시기에 도전하면 유리해요',
  母倉: '후배·팀원을 이끄는 역할이 잘 맞아요. 멘토링에 시간을 투자하세요', 母仓: '후배·팀원을 이끄는 역할이 잘 맞아요. 멘토링에 시간을 투자하세요',
  天馬: '출장·여행·이사 등 움직임이 행운을 불러와요. 가만히 있지 마세요', 天马: '출장·여행·이사 등 움직임이 행운을 불러와요. 가만히 있지 마세요',
  解神: '주변 갈등을 중재하는 역할을 맡아보세요. 신뢰를 얻는 좋은 기회에요',
  驛馬: '해외·지방 활동이 유리해요. 한 곳에 머물기보다 다양한 경험을 쌓으세요', 驿马: '해외·지방 활동이 유리해요. 한 곳에 머물기보다 다양한 경험을 쌓으세요',
  生氣: '새 프로젝트를 시작하기에 좋은 기운. 신규 도전에 과감하게 뛰어드세요', 生气: '새 프로젝트를 시작하기에 좋은 기운. 신규 도전에 과감하게 뛰어드세요',
  天醫: '건강 관련 학습·봉사가 잘 맞아요. 주변의 아픈 사람을 돌보면 덕이 쌓여요', 天医: '건강 관련 학습·봉사가 잘 맞아요. 주변의 아픈 사람을 돌보면 덕이 쌓여요',
  // 흉살 대처법
  月破: '중요한 약속·계약은 꼭 서면으로. 구두 약속은 깨지기 쉬워요',
  大耗: '비상금을 꼭 따로 빼놓으세요. 충동구매 금지, 큰 지출은 하루 묵혔다가 결정',
  災煞: '안전벨트·헬멧 착용 생활화. 위험한 활동은 보험 확인 후에', 灾煞: '안전벨트·헬멧 착용 생활화. 위험한 활동은 보험 확인 후에',
  天火: '화가 날 때 10초 세고 말하세요. 분노 조절 앱이나 명상이 도움이 돼요',
  月厌: '성과를 자랑하기보다 겸손하게. SNS 과시도 자제하는 게 좋아요', 月厭: '성과를 자랑하기보다 겸손하게. SNS 과시도 자제하는 게 좋아요',
  地火: '집 안 화재 예방 점검. 전기장판·가스 등 안전 체크',
  五虛: '체력이 바닥날 때가 있어요. 규칙적 운동과 충분한 수면이 최고의 보약이에요', 五虚: '체력이 바닥날 때가 있어요. 규칙적 운동과 충분한 수면이 최고의 보약이에요',
  五離: '오해가 생기기 쉬운 체질이에요. 중요한 말은 카톡보다 직접 만나서 하세요', 五离: '오해가 생기기 쉬운 체질이에요. 중요한 말은 카톡보다 직접 만나서 하세요',
  元武: '속마음을 감추는 편인데, 가까운 사람에겐 먼저 마음을 열어보세요',
  白虎: '급한 결정은 피하고, 운전·운동 시 안전에 주의하세요. 침착함이 무기예요',
  朱雀: '한 번 더 생각하고 말하는 습관을 들이세요. 말실수가 큰 화를 부를 수 있어요',
  勾陳: '법적 문제·문서 작업은 전문가 도움을 받으세요. 혼자 처리하면 빠지기 쉬워요', 勾陈: '법적 문제·문서 작업은 전문가 도움을 받으세요. 혼자 처리하면 빠지기 쉬워요',
  天吏: '계약서·문서는 하루 묵혔다 결정하세요. 급하게 사인하면 후회할 수 있어요',
  天賊: '비밀번호·보안 정기 점검. 낯선 링크 클릭 금지, 보이스피싱 주의', 天贼: '비밀번호·보안 정기 점검. 낯선 링크 클릭 금지, 보이스피싱 주의',
  重日: '같은 실수를 했다면 일기에 적어두세요. 패턴을 인식하는 게 첫걸음이에요',
  復日: '과거 문제가 되살아나면 이번엔 근본 원인을 해결하세요', 复日: '과거 문제가 되살아나면 이번엔 근본 원인을 해결하세요',
  歸忌: '장거리 이동 후엔 충분히 쉬세요. 무리하면 컨디션이 확 떨어져요', 归忌: '장거리 이동 후엔 충분히 쉬세요. 무리하면 컨디션이 확 떨어져요',
  血忌: '정기 건강검진 꼭 받으세요. 특히 혈액검사와 심혈관 체크',
  月刑: '직장·가정에서 충돌이 생기면 한 발 물러서세요. 양보가 이기는 전략이에요',
  月害: '플랜B를 항상 준비해두세요. 예상치 못한 방해가 들어올 수 있어요',
  九空: '구두 약속은 믿지 마세요. 중요한 건 반드시 문서·기록으로 남기세요',
  致死: '무리한 일정은 용기 있게 거절하세요. 건강이 최우선이에요',
  受死: '이 시기엔 쉬어가는 게 전략이에요. 큰 결정은 미루세요',
  天罡: '운동·명상으로 강한 에너지를 긍정적으로 방출하세요',
};

function getSinsalKr(hanja: string): string {
  return SINSAL_KR[hanja] ?? hanja;
}

function mapSinSal(list: SinSal[]): V4SinSal[] {
  return list.map(s => {
    const name = s.이름한자 || s.이름;
    return {
      hanja: name,
      kr: getSinsalKr(name),
      desc: s.의미 || SINSAL_DESC[name] || (s.type === 'gilsin' ? '좋은 기운이 함께하는 길신' : '의식적으로 주의하면 강점이 되는 흉살'),
      source: '일주',
    };
  });
}

function mapGongmang(list: GongMang[], dayOheng: OhengType): V4GongMang[] {
  // 오행 상생상극 관계로 십성 카테고리 결정
  const SANGSAENG_MAP: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const SANGGEUK_MAP: Record<OhengType, OhengType> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };

  function getSipsungCategory(targetOheng: OhengType): string {
    if (targetOheng === dayOheng) return '비겁';
    if (SANGSAENG_MAP[dayOheng] === targetOheng) return '식상';
    if (SANGGEUK_MAP[dayOheng] === targetOheng) return '재성';
    if (SANGGEUK_MAP[targetOheng] === dayOheng) return '관성';
    if (SANGSAENG_MAP[targetOheng] === dayOheng) return '인성';
    return '';
  }

  const categoryMeanings: Record<string, { desc: string; tip: string }> = {
    비겁: {
      desc: '동료·형제·자아 영역이 비어 있는 구조 — 남에게 기대기보다 스스로 서는 힘이 강해요',
      tip: '혼자서도 잘하는 타입이에요. 동료 관계에서 기대를 줄이고 독립적으로 성취하면 오히려 큰 결과를 얻어요',
    },
    식상: {
      desc: '표현·창작·소통 영역이 비어 있는 구조 — 남들처럼 표현하려 하면 답답하지만, 나만의 방식을 찾으면 차별화됨',
      tip: '남들의 표현법을 따라하지 마세요. 자기만의 독특한 방식으로 표현할 때 오히려 강력한 개성이 돼요',
    },
    재성: {
      desc: '재물·실리 영역이 비어 있는 구조 — 돈에 집착하면 오히려 새어나가고, 자유롭게 접근할 때 뜻밖의 경로로 들어옴',
      tip: '재물에 대한 집착을 내려놓으세요. 하고 싶은 일에 몰입하면 돈은 자연스럽게 따라오는 구조예요',
    },
    관성: {
      desc: '직장·사회적 지위 영역이 비어 있는 구조 — 조직에서 인정받으려 애쓰기보다, 자기 브랜드를 키우면 더 빛남',
      tip: '대기업·공무원 같은 안정적 경로보다, 프리랜서·창업·자기 사업이 더 잘 맞을 수 있어요. 틀에 얽매이지 마세요',
    },
    인성: {
      desc: '학문·배움·어머니 영역이 비어 있는 구조 — 정규 교육보다 독학·실전 경험이 더 빛나는 체질',
      tip: '정석적인 공부법에 답답함을 느낄 수 있어요. 실전에서 몸으로 배우는 방식이 훨씬 효율적이에요',
    },
  };

  return list.map(g => {
    const chars = g.공망.split('');
    const krParts = chars.map(c => JIJI_KO[c] ?? c).join('');
    const elemParts = chars.map(c => {
      const oh = JIJI_OHENG[c];
      return oh ? OHENG_KR_LABEL[oh] : '';
    }).filter(Boolean);
    const elemStr = elemParts.length > 0 ? ` (${[...new Set(elemParts)].join('·')})` : '';

    // 공망 지지들의 오행으로 십성 카테고리 결정
    const ohengSet = [...new Set(chars.map(c => JIJI_OHENG[c]).filter(Boolean))] as OhengType[];
    const categories = [...new Set(ohengSet.map(oh => getSipsungCategory(oh)))].filter(Boolean);
    const primaryCategory = categories[0] || '';
    const catInfo = categoryMeanings[primaryCategory];

    const personalMeaning = catInfo
      ? catInfo.desc
      : g.의미 || '비어있는 에너지 — 의식적 보완이 필요합니다';

    return {
      basis: `${g.기준} 공망`,
      value: g.공망,
      kr: `${krParts}${elemStr}`,
      meaning: personalMeaning,
      category: primaryCategory, // 추가 필드
      tip: catInfo?.tip || '비어있는 영역이지만, 집착을 내려놓으면 오히려 자유로운 영역이 돼요.',
    };
  });
}

// ─── 해석 가이드 헬퍼 ───

function getUnyoungEnergyLevel(kr: string): number {
  const scores: Record<string, number> = {
    '제왕': 5, '장생': 5, '임관': 4, '관대': 4, '목욕': 3,
    '양': 2, '태': 2, '쇠': 2, '묘': 1, '병': 1, '사': 1, '절': 0,
  };
  return scores[kr] ?? 2;
}

function getUnyoungPositionContext(pillar: string): string {
  if (pillar.includes('년')) return '초년·사회';
  if (pillar.includes('월')) return '직장·청년기';
  if (pillar.includes('일')) return '나의 본질';
  if (pillar.includes('시')) return '말년·결과';
  return '';
}

function getUnyoungSummary(items: V4Unyoung[]): string {
  const ilji = items.find(u => u.pillar.includes('일지'));
  const iljiLevel = ilji ? getUnyoungEnergyLevel(ilji.kr) : 0;
  const highCount = items.filter(u => getUnyoungEnergyLevel(u.kr) >= 4).length;
  const lowCount = items.filter(u => getUnyoungEnergyLevel(u.kr) <= 1).length;
  if (ilji && iljiLevel >= 4 && lowCount >= 2) {
    return `겉으로는 조용해 보이지만, 본질(일지)에서 '${ilji.kr}'의 강렬한 에너지가 숨어있어요. 과시형이 아닌 실력파 — 속에서 끊임없이 새로운 것을 만들어내는 구조입니다.`;
  }
  if (ilji && iljiLevel >= 4) {
    return `나의 본질(일지)에서 '${ilji.kr}'의 강한 에너지가 있어요. 내면의 생명력이 강하고, 스스로 성장하는 힘이 큽니다.`;
  }
  if (lowCount >= 3) {
    return '전체적으로 에너지가 안으로 수렴되는 구조예요. 조용하지만 깊이있는 타입으로, 독서·사색·창작 등 내면을 채우는 활동에서 힘을 얻어요.';
  }
  if (highCount >= 3) {
    return '전체적으로 에너지가 활발한 구조예요. 적극적으로 움직일수록 운이 트이는 타입이에요.';
  }
  const strongItem = items.find(u => getUnyoungEnergyLevel(u.kr) >= 4);
  if (strongItem) {
    return `'${getUnyoungPositionContext(strongItem.pillar)}' 영역에서 에너지가 가장 강해요. 이 영역에 집중하면 좋은 결과를 얻어요.`;
  }
  return '균형 잡힌 에너지 분포예요. 한쪽에 치우치지 않고, 상황에 따라 유연하게 대처하는 타입이에요.';
}

function getDaeunCurrentSummary(daeunList: V4Daeun[]): string {
  const current = daeunList.find(d => d.current);
  if (!current) return '';
  const nextIdx = daeunList.findIndex(d => d.current) + 1;
  const next = nextIdx < daeunList.length ? daeunList[nextIdx] : null;
  const elemDesc: Record<ElemKey, string> = {
    wood: '성장·확장의 시기예요. 새로운 시작, 배움, 도전이 자연스러운 시기입니다.',
    fire: '열정·표현의 시기예요. 적극적으로 나서고, 자기 PR에 유리한 시기입니다.',
    earth: '안정·축적의 시기예요. 기반을 다지고 내실을 챙기는 게 중요해요.',
    metal: '결실·정리의 시기예요. 불필요한 것을 정리하고 핵심에 집중하세요.',
    water: '지혜·유연함의 시기예요. 관찰하고 기다리며, 기회를 포착하세요.',
  };
  let text = `지금은 ${current.gz}(${current.kr}) 대운 — ${EKR[current.elem]} 에너지가 지배하는 ${current.age} 시기예요.\n${elemDesc[current.elem]}`;
  if (next) {
    text += `\n\n다음 대운(${next.gz})부터는 ${EKR[next.elem]} 에너지로 전환돼요.`;
  }
  return text;
}

function getNapeumSummary(items: V4Napeum[]): string {
  const ilju = items.find(n => n.pillar === '일주');
  if (!ilju) {
    return items.length > 0 ? `${items[0].hanja}의 에너지가 기본 바탕이에요.` : '';
  }
  const practical = getNapeumPracticalTip(ilju.hanja);
  return `당신의 근본 에너지는 '${ilju.hanja}'예요. ${ilju.desc}\n\n실생활에서는? ${practical}`;
}

function getNapeumPositionRole(pillar: string): string {
  const roles: Record<string, string> = {
    '년주': '조상에게서 물려받은 에너지',
    '월주': '사회에서 발현되는 에너지',
    '일주': '나의 가장 근본적인 에너지',
    '시주': '말년에 나타나는 에너지',
  };
  return roles[pillar] ?? '';
}

function getGilsinActionTip(name: string): string {
  return SINSAL_TIP[name] ?? '이 길신의 에너지를 의식적으로 활용해보세요';
}

function getHyungsalActionTip(name: string): string {
  return SINSAL_TIP[name] ?? '이 부분을 의식적으로 주의하면 오히려 강점으로 바뀌어요';
}

// getGongmangActionTip — 공망 정보가 V4GongMang.tip에 포함되어 더 이상 사용되지 않음

// ─── Utility sub-components ───

function useLocalInView(threshold = 0.15): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function AnimNum({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const [ref, vis] = useLocalInView(0.3);
  const ran = useRef(false);
  useEffect(() => {
    if (!vis || ran.current) return;
    ran.current = true;
    const t0 = performance.now();
    const go = (now: number) => {
      const p = Math.min((now - t0) / 1200, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(go);
    };
    requestAnimationFrame(go);
  }, [vis, target]);
  return <span ref={ref}>{val}</span>;
}

function LocalFadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [ref, v] = useLocalInView(0.1);
  return (
    <div
      ref={ref}
      style={{
        opacity: v ? 1 : 0,
        transform: v ? 'translateY(0)' : 'translateY(20px)',
        transition: `all 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── ScoreRing ───
function ScoreRing({ label, score, color, delay = 0, topicId }: {
  label: string; score: number; color: string; delay?: number; topicId?: string;
}) {
  const [ref, v] = useLocalInView(0.3);
  const r = 32;
  const c = 2 * Math.PI * r;
  const navigate = useNavigate();
  return (
    <div ref={ref} className="flex flex-col items-center gap-1"
      onClick={topicId ? () => navigate(`/topic/${topicId}`, { state: { baseScore: score } }) : undefined}
      style={topicId ? { cursor: 'pointer' } : {}}>
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg viewBox="0 0 80 80" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f0ebe3" strokeWidth="4.5" />
          <circle
            cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="4.5"
            strokeLinecap="round" strokeDasharray={c}
            strokeDashoffset={v ? c * (1 - score / 100) : c}
            style={{ transition: `stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) ${delay}ms` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold" style={{ color, fontSize: 16 }}>
            {v ? <AnimNum target={score} /> : 0}
          </span>
        </div>
      </div>
      <span style={{ color: '#8b7e6f', fontSize: 11 }}>{label}</span>
      {topicId && <span style={{ color, fontSize: 9, fontWeight: 700, marginTop: -2 }}>심층분석 →</span>}
    </div>
  );
}

// ─── PillarCard ───
function PillarCard({ p, index, total }: { p: V4Pillar; index: number; total: number }) {
  if (p.empty) {
    return (
      <div
        className="relative flex flex-col items-center rounded-2xl overflow-hidden"
        style={{
          animation: `cardReveal 0.8s ease ${index * 180}ms both`,
          border: '2px dashed #d4ccc0',
          background: '#faf7f2',
        }}
      >
        <div className="w-full pt-6 pb-2 px-2 text-center">
          <div style={{ fontSize: 11, color: '#a0937f', fontWeight: 600 }}>
            {p.label} <span style={{ color: '#c9b99a' }}>{p.sub}</span>
          </div>
          <div style={{ fontSize: 10, color: '#c9b99a', marginBottom: 8 }}>{p.desc}</div>
          <div style={{ fontSize: 28, color: '#d4ccc0', fontWeight: 900 }}>?</div>
          <div style={{ fontSize: 10, color: '#c9b99a', marginTop: 4 }}>미입력</div>
        </div>
        <div className="w-full h-px" style={{ background: '#e8e0d4' }} />
        <div className="w-full py-2 px-2 text-center">
          <div style={{ fontSize: 28, color: '#d4ccc0', fontWeight: 900 }}>?</div>
          <div style={{ fontSize: 10, color: '#c9b99a', marginTop: 4 }}>미입력</div>
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(250,247,242,0.6)' }}
        >
          <div className="text-center px-2">
            <div style={{ fontSize: 14, fontWeight: 900, color: '#a0937f' }}>時</div>
            <div style={{ fontSize: 9, color: '#a0937f', marginTop: 4, lineHeight: 1.4, fontWeight: 600 }}>
              출생시간<br />미입력
            </div>
          </div>
        </div>
      </div>
    );
  }

  const gc = EC[p.gE];
  const jc = EC[p.jE];
  const isNarrow = total === 4;
  const hanjaSize = isNarrow ? 34 : 42;

  return (
    <div
      className="relative flex flex-col items-center rounded-2xl overflow-hidden"
      style={{
        animation: `cardReveal 0.8s ease ${index * 180}ms both`,
        background: p.isMe ? 'linear-gradient(180deg, #1B2A4A, #243656)' : '#FFFFFF',
        border: p.isMe ? '2px solid #B8965A' : '1px solid #E2E5EC',
        boxShadow: p.isMe ? '0 4px 20px rgba(184,150,90,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* 오행 색상 띠 (나 제외) — 직관적 오행 구분 */}
      {!p.isMe && (
        <div className="w-full h-[4px]" style={{ background: gc.main }} />
      )}

      {/* 기둥 라벨 */}
      <div className="w-full pt-3 pb-1 px-2 text-center"
        style={{ background: p.isMe ? 'rgba(184,150,90,0.15)' : '#F8F9FB' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: p.isMe ? '#E8D5A8' : '#8892A4' }}>
          {p.label} {p.sub}
        </div>
        <div style={{ fontSize: 9, color: p.isMe ? 'rgba(255,255,255,0.4)' : '#A8B1C1' }}>{p.desc}</div>
        {p.isMe && (
          <div className="inline-block rounded-full mt-1 px-2 py-0.5"
            style={{ background: '#B8965A', fontSize: 9, fontWeight: 800, color: '#fff' }}>
            나
          </div>
        )}
      </div>

      {/* 천간 */}
      <div className="w-full py-3 px-2 text-center">
        <div style={{ fontSize: hanjaSize, fontWeight: 900, lineHeight: 1, color: p.isMe ? '#FFFFFF' : gc.dark }}>
          {p.gH}
        </div>
        <div className="flex items-center justify-center gap-1 mt-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: gc.main }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: p.isMe ? '#E8D5A8' : gc.main }}>{p.gKr} · {p.gM}</span>
        </div>
        <div className="inline-block rounded-full mt-1.5"
          style={{ padding: '2px 8px', background: p.isMe ? 'rgba(255,255,255,0.1)' : gc.main + '12', color: p.isMe ? '#E8D5A8' : gc.dark, fontSize: 10, fontWeight: 600 }}>
          {p.gSip}
        </div>
      </div>

      {/* 구분선 */}
      <div className="w-10 h-px mx-auto" style={{ background: p.isMe ? 'rgba(184,150,90,0.3)' : '#E2E5EC' }} />

      {/* 지지 */}
      <div className="w-full py-3 px-2 text-center">
        <div style={{ fontSize: hanjaSize, fontWeight: 900, lineHeight: 1, color: p.isMe ? '#FFFFFF' : jc.dark }}>
          {p.jH}
        </div>
        <div className="flex items-center justify-center gap-1 mt-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: jc.main }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: p.isMe ? '#E8D5A8' : jc.main }}>{p.jKr} · {p.jM}</span>
        </div>
        <div className="inline-block rounded-full mt-1.5"
          style={{ padding: '2px 8px', background: p.isMe ? 'rgba(255,255,255,0.1)' : jc.main + '12', color: p.isMe ? '#E8D5A8' : jc.dark, fontSize: 10, fontWeight: 600 }}>
          {p.jSip}
        </div>
      </div>
    </div>
  );
}

// ─── Inline visuals ───
function OhengFlowVis({ elements, hasBirthTime }: { elements: V4Elements; hasBirthTime: boolean }) {
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47', marginBottom: 4 }}>
        ▎오행 상생상극 — 이 사주의 핵심 구조
      </div>
      <div style={{ fontSize: 10, color: '#a0937f', marginBottom: 10, lineHeight: 1.5 }}>
        <span style={{ color: '#2E7D32', fontWeight: 700 }}>상생(→생→)</span>은 에너지를 키워주고, <span style={{ color: '#c62828', fontWeight: 700 }}>상극(→극→)</span>은 에너지를 억제해요
      </div>
      <div
        className="flex items-center justify-center gap-1 flex-wrap"
        style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 8 }}
      >
        <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.wood.light, color: EC.wood.dark }}>
          木 목 {elements.wood}
        </span>
        <span className="font-bold" style={{ color: '#c62828' }}>→극→</span>
        <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.earth.light, color: EC.earth.dark }}>
          土 토(나) {elements.earth}
        </span>
        <span>→생→</span>
        <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.metal.light, color: EC.metal.dark }}>
          金 금 {elements.metal}
        </span>
      </div>
      <div className="text-center px-2" style={{ fontSize: 11, color: '#a0937f', marginBottom: 10 }}>
        강한 목이 토(나)를 압박하고, 토가 낳은 금(식신)은 약한 구조
      </div>
      <div
        className="p-3 rounded-xl text-center"
        style={{ background: '#ffebee', border: '1px dashed #ef9a9a', fontSize: 11 }}
      >
        <div className="font-bold" style={{ color: '#c62828', marginBottom: 4 }}>
          火 2026년 해결책: 화(火) 에너지 유입!
        </div>
        <div
          className="flex items-center justify-center gap-1 flex-wrap"
          style={{ color: '#8b7e6f' }}
        >
          <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.wood.light, color: EC.wood.dark }}>
            목
          </span>
          <span>→생→</span>
          <span
            className="px-2 py-1 rounded-lg font-bold"
            style={{ background: EC.fire.light, color: EC.fire.dark, border: '2px solid ' + EC.fire.main }}
          >
            火 화
          </span>
          <span>→생→</span>
          <span className="px-2 py-1 rounded-lg font-bold" style={{ background: EC.earth.light, color: EC.earth.dark }}>
            토(나) ↑
          </span>
        </div>
        <div style={{ color: '#e65100', marginTop: 4 }}>목→화→토 순환 완성 = 압박이 풀림!</div>
        {hasBirthTime && (
          <div style={{ color: '#8b7e6f', marginTop: 4, fontSize: 10 }}>
            시주 납음이 노중화(炉中火)! 내면에 숨겨진 화의 씨앗이 있었어요.
          </div>
        )}
      </div>
      {/* 쉽게 말하면 */}
      <div className="mt-3 p-3 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#3949ab', marginBottom: 6 }}>쉽게 말하면?</p>
        <div style={{ fontSize: 11, color: '#5c6bc0', lineHeight: 1.7 }}>
          <p>• <b>상생(→생→)</b>: A가 B에게 에너지를 주는 관계예요. 자연스럽게 도움이 되는 흐름</p>
          <p>• <b>상극(→극→)</b>: A가 B를 누르는 관계예요. 압박이 되지만, 성장의 원동력이기도 해요</p>
          <p style={{ marginTop: 6, fontWeight: 600, color: '#3949ab' }}>
            위에서 가장 강한 오행이 나(토)를 극하고 있으면 → 외부 압박·스트레스가 큰 구조예요.
            해결책 영역의 오행이 중간에서 에너지를 전달해주면 이 압박이 풀려요!
          </p>
        </div>
      </div>
    </div>
  );
}

function JijangganVisComp({ jijanggan, pillars, hasBirthTime }: {
  jijanggan: JiJangGan[]; pillars: Pillar[]; hasBirthTime: boolean;
}) {
  // ─── 중국어→한국어 십성 변환 (lunar-javascript는 中文 반환) ───
  const cnToKr: Record<string, string> = {
    '比肩': '비견', '劫財': '겁재', '食神': '식신', '傷官': '상관',
    '偏財': '편재', '正財': '정재', '偏官': '편관', '七殺': '편관',
    '正官': '정관', '偏印': '편인', '正印': '정인', '日主': '일주',
  };
  function toKrSipsung(raw: string): string {
    return cnToKr[raw] ?? raw;
  }

  // ─── 캐시 데이터 십성 누락 시 일간 기준 직접 계산 ───
  const SANGSAENG: Record<string, string> = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  const SANGGEUK: Record<string, string> = { '목': '토', '토': '수', '수': '화', '화': '금', '금': '목' };
  const dayGan = pillars[2]?.천간 ?? '';
  const dayOheng = CHEONGAN_OHENG[dayGan] ?? '토';
  const dayEumyang = CHEONGAN_EUMYANG[dayGan] ?? '양';

  function calcSipsung(targetGan: string): string {
    const tOheng = CHEONGAN_OHENG[targetGan];
    const tEumyang = CHEONGAN_EUMYANG[targetGan];
    if (!tOheng || !tEumyang) return '';
    const samePolarity = dayEumyang === tEumyang;
    if (dayOheng === tOheng) return samePolarity ? '비견' : '겁재';
    if (SANGSAENG[dayOheng] === tOheng) return samePolarity ? '식신' : '상관';
    if (SANGSAENG[tOheng] === dayOheng) return samePolarity ? '편인' : '정인';
    if (SANGGEUK[dayOheng] === tOheng) return samePolarity ? '편재' : '정재';
    if (SANGGEUK[tOheng] === dayOheng) return samePolarity ? '편관' : '정관';
    return '';
  }

  // ─── 한국어 조사 헬퍼 ───
  function josa(word: string, withBatchim: string, withoutBatchim: string): string {
    const last = word.charAt(word.length - 1);
    const code = last.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      return (code - 0xAC00) % 28 !== 0 ? withBatchim : withoutBatchim;
    }
    return withoutBatchim;
  }

  // ─── 일간 오행별 특성 사전 — 사주마다 다른 내용 생성 ───
  const OHENG_NATURE: Record<OhengType, { noun: string; adj: string; energy: string }> = {
    목: { noun: '나무', adj: '성장하는', energy: '생명력' },
    화: { noun: '불꽃', adj: '열정적인', energy: '표현력' },
    토: { noun: '대지', adj: '안정적인', energy: '포용력' },
    금: { noun: '쇠', adj: '단단한', energy: '결단력' },
    수: { noun: '물', adj: '유연한', energy: '지혜' },
  };

  function getSipsungPersonalized(sip: string): { voice: string; trait: string } | null {
    const me = OHENG_NATURE[dayOheng as OhengType] || OHENG_NATURE['토'];
    const n = me.noun;
    const e = me.energy;
    // 조사: 이/가, 을/를, 은/는
    const nGa = josa(n, '이', '가'); // 나무가, 불꽃이, 쇠가, 물이
    const nReul = josa(n, '을', '를'); // 나무를, 불꽃을, 쇠를, 물을
    const eGa = josa(e, '이', '가');
    const eReul = josa(e, '을', '를');
    const ohGa = josa(dayOheng, '이', '가');
    const ohReul = josa(dayOheng, '을', '를');

    const map: Record<string, { voice: string; trait: string }> = {
      비견: {
        voice: `"${n}${nGa} ${n}${nReul} 만남 — 같이 가자"`,
        trait: `같은 ${dayOheng} 에너지의 만남. ${me.adj} ${e}${eGa} 두 배가 되지만, 같은 자원을 나누는 구조라 협력과 배분의 지혜가 동시에 필요해요`,
      },
      겁재: {
        voice: `"내 ${e}${eReul} 빼앗기면 안 돼"`,
        trait: `${n}의 반대 극성 에너지 — ${e}${eReul} 지키려는 강한 방어본능. 승부욕이 강하고, 위기 상황에서 오히려 진가를 발휘하는 타입이에요`,
      },
      식신: {
        voice: `"${n}에서 태어난 것을 세상에 보여주고 싶어"`,
        trait: `${dayOheng}${ohGa} 자연스럽게 만들어내는 에너지. 창작·요리·표현 등 무언가를 만들어내는 활동에서 기쁨과 충만함을 느끼는 구조예요`,
      },
      상관: {
        voice: `"${n}의 틀을 깨고 새로운 형태를 만들겠어"`,
        trait: `${dayOheng}${ohGa} 폭발적으로 분출되는 에너지. 기존 질서에 의문을 던지고, 남들이 생각 못한 방식으로 혁신하는 반골 기질이에요`,
      },
      편재: {
        voice: `"${n}${nGa} 지배하는 영역에서 기회를 잡자"`,
        trait: `${dayOheng}${ohGa} 억누르는 대상 — 적극적 재물 추구 에너지. 투자 감각이 있고, 기회를 포착하면 과감하게 움직이는 행동파예요`,
      },
      정재: {
        voice: `"${n}의 힘으로 꾸준히 쌓아가자"`,
        trait: `${dayOheng}${ohGa} 안정적으로 관리하는 재물 에너지. 저축과 계획적 소비 성향이 강하고, 빠른 수익보다 꾸준한 축적을 선호해요`,
      },
      편관: {
        voice: `"${n}${nReul} 단련시키는 압박 — 대충은 절대 안 돼"`,
        trait: `${dayOheng}${ohReul} 극(剋)하는 에너지 — 외부 압박과 규율이 나를 단련시키는 구조. 스트레스가 되지만 이것이 성장의 원동력이에요`,
      },
      정관: {
        voice: `"${n}${nReul} 올바르게 다듬는 힘 — 제대로 해야 해"`,
        trait: `${dayOheng}${ohReul} 규제하는 정통 질서의 힘. 규칙과 책임감을 중시하고, 사회적 인정과 신뢰를 얻는 데 유리한 구조예요`,
      },
      편인: {
        voice: `"${n}에게 영감을 주는 독특한 감각"`,
        trait: `${dayOheng}${ohReul} 생(生)해주는 비정통 에너지. 직감이 강하고, 남들과 다른 시각으로 문제를 풀어내는 독창적 사고의 소유자예요`,
      },
      정인: {
        voice: `"${n}${nReul} 키워주는 근본적인 배움의 힘"`,
        trait: `${dayOheng}${ohReul} 생(生)해주는 정통 학습의 에너지. 학문·지식·자격에 끌리고, 공부할수록 내면이 단단해지는 구조예요`,
      },
      일주: {
        voice: '"나 자신의 근본 에너지"',
        trait: `${dayOheng} 일간(${dayGan}) — ${me.adj} ${e}${eGa} 당신의 본질. 모든 판단과 행동의 출발점이 되는 핵심 에너지예요`,
      },
    };
    return map[sip] ?? null;
  }

  // ─── 포지션별 의미 ───
  const posContext: Record<string, { role: string; desc: string }> = {
    '년지': { role: '어린 시절의 나', desc: '부모·조상에게서 물려받은 기질' },
    '년지+월지': { role: '성장기의 나', desc: '타고난 기질 + 사회적 성격' },
    '월지': { role: '사회에서의 나', desc: '직장·대인관계에서 보이는 모습' },
    '일지': { role: '진짜 나의 본질', desc: '가장 솔직한 내면, 배우자궁' },
    '시지': { role: '말년의 나', desc: '나이 들수록 드러나는 성향, 자녀궁' },
  };

  // ─── 데이터 빌드 ───
  interface JjEntry { hanja: string; kr: string; elemKey: ElemKey; sipsung: string; meaning: { voice: string; trait: string } | null }
  interface JjCard { hanja: string; elemKey: ElemKey; posKey: string; posLabel: string; role: string; roleDesc: string; entries: JjEntry[]; isCore?: boolean }

  function buildEntries(jj: JiJangGan): JjEntry[] {
    return jj.지장간.map((g, gi) => {
      const gOheng = CHEONGAN_OHENG[g];
      const gElem = gOheng ? OHENG_TO_ELEM[gOheng] : 'earth' as ElemKey;
      const gKr = CHEONGAN_KO[g] ?? g;
      const rawSip = jj.십성[gi] ?? '';
      // 십성 데이터 없으면 일간 기준으로 직접 계산 (캐시된 구 데이터 대응)
      const sip = rawSip ? toKrSipsung(rawSip) : calcSipsung(g);
      return { hanja: g, kr: gKr, elemKey: gElem, sipsung: sip, meaning: getSipsungPersonalized(sip) };
    });
  }

  const cards: JjCard[] = [];
  const yearJj = jijanggan[0]; const monthJj = jijanggan[1]; const dayJj = jijanggan[2];
  const timeJj = hasBirthTime && jijanggan[3] ? jijanggan[3] : null;

  if (yearJj && monthJj && yearJj.지지 === monthJj.지지) {
    const zhiOheng = JIJI_OHENG[yearJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
    const kr = JIJI_KO[yearJj.지지] ?? yearJj.지지; const pos = '년지+월지';
    cards.push({ hanja: yearJj.지지, elemKey, posKey: pos, posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext[pos]?.role ?? pos, roleDesc: posContext[pos]?.desc ?? '', entries: buildEntries(yearJj) });
  } else {
    if (yearJj) {
      const zhiOheng = JIJI_OHENG[yearJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
      const kr = JIJI_KO[yearJj.지지] ?? yearJj.지지;
      cards.push({ hanja: yearJj.지지, elemKey, posKey: '년지', posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext['년지'].role, roleDesc: posContext['년지'].desc, entries: buildEntries(yearJj) });
    }
    if (monthJj) {
      const zhiOheng = JIJI_OHENG[monthJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
      const kr = JIJI_KO[monthJj.지지] ?? monthJj.지지;
      cards.push({ hanja: monthJj.지지, elemKey, posKey: '월지', posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext['월지'].role, roleDesc: posContext['월지'].desc, entries: buildEntries(monthJj) });
    }
  }
  if (dayJj) {
    const zhiOheng = JIJI_OHENG[dayJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
    const kr = JIJI_KO[dayJj.지지] ?? dayJj.지지;
    cards.push({ hanja: dayJj.지지, elemKey, posKey: '일지', posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext['일지'].role, roleDesc: posContext['일지'].desc, entries: buildEntries(dayJj), isCore: true });
  }
  if (timeJj) {
    const zhiOheng = JIJI_OHENG[timeJj.지지]; const elemKey = zhiOheng ? OHENG_TO_ELEM[zhiOheng] : 'earth' as ElemKey;
    const kr = JIJI_KO[timeJj.지지] ?? timeJj.지지;
    cards.push({ hanja: timeJj.지지, elemKey, posKey: '시지', posLabel: `${kr}(${OHENG_KR_LABEL[zhiOheng ?? '토']})`, role: posContext['시지'].role, roleDesc: posContext['시지'].desc, entries: buildEntries(timeJj) });
  }

  // ─── 종합 해석 ───
  const allSipsung = cards.flatMap(c => c.entries.map(e => e.sipsung)).filter(s => s && s !== '일주' && s !== '');
  const sipsungCounts: Record<string, number> = {};
  allSipsung.forEach(s => { sipsungCounts[s] = (sipsungCounts[s] || 0) + 1; });
  const topSipsung = Object.entries(sipsungCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const summaryParts = topSipsung.map(([sip, count]) => {
    const m = getSipsungPersonalized(sip);
    return m ? `${m.voice} — ${m.trait.split('.')[0]} (${sip}${count >= 2 ? ' x' + count + ', 특히 강함' : ''})` : null;
  }).filter(Boolean);

  // 일지의 핵심 목소리
  const dayCard = cards.find(c => c.isCore);
  const dayVoices = dayCard?.entries.filter(e => e.meaning).map(e => e.meaning!.voice).join(' + ') ?? '';

  // ─── 성격 구성도 데이터 (5대 카테고리) ───
  const sipCategoryMap: Record<string, string> = {
    비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
    편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성',
    편인: '인성', 정인: '인성',
  };
  const catColors: Record<string, { main: string; light: string; label: string }> = {
    비겁: { main: '#2d8a4e', light: '#e8f5e9', label: '자아/독립' },
    식상: { main: '#d32f2f', light: '#ffebee', label: '표현/창작' },
    재성: { main: '#f57f17', light: '#fff8e1', label: '재물/실리' },
    관성: { main: '#757575', light: '#f5f5f5', label: '사회/직위' },
    인성: { main: '#1565c0', light: '#e3f2fd', label: '학문/배움' },
  };
  const catCounts: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  allSipsung.forEach(s => { const cat = sipCategoryMap[s]; if (cat) catCounts[cat]++; });
  const catTotal = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="my-4 rounded-2xl overflow-hidden" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      {/* Section header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(180deg, #B8965A, #a08b6a)' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#3D3427', letterSpacing: '-0.3px' }}>지장간 — 내 안의 숨은 성격들</span>
        </div>
        <p style={{ fontSize: 11, color: '#a0937f', lineHeight: 1.7, marginLeft: 11 }}>
          각 기둥 속에 <b style={{ color: '#6b5b47' }}>2~3개의 숨은 성격</b>이 있어요.<br />
          겉으로 안 보이지만 내면에서 끊임없이 영향을 주는 목소리들이에요.
        </p>
      </div>

      {/* 성격 구성도 (Personality Composition Bar) */}
      <div className="mx-4 mb-3 p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#a08b6a', marginBottom: 8, letterSpacing: '0.5px' }}>
          성격 구성도
        </p>
        {/* Horizontal stacked bar */}
        <div className="flex rounded-full overflow-hidden" style={{ height: 14 }}>
          {Object.entries(catCounts).map(([cat, cnt]) => {
            const pct = (cnt / catTotal) * 100;
            if (pct === 0) return null;
            return (
              <div key={cat} style={{ width: `${pct}%`, background: catColors[cat].main, minWidth: pct > 0 ? 8 : 0, transition: 'width 0.5s ease' }} />
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2.5">
          {Object.entries(catCounts).map(([cat, cnt]) => {
            const pct = Math.round((cnt / catTotal) * 100);
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <div style={{ width: 8, height: 8, borderRadius: 2, background: catColors[cat].main, opacity: cnt > 0 ? 1 : 0.25 }} />
                <span style={{ fontSize: 10, color: cnt > 0 ? '#6b5b47' : '#c4bab0', fontWeight: cnt > 0 ? 600 : 400 }}>
                  {cat}<span style={{ fontSize: 9, color: '#a0937f', marginLeft: 2 }}>{catColors[cat].label}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: catColors[cat].main, marginLeft: 3 }}>{pct}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 나의 내면 요약 */}
      {summaryParts.length > 0 && (
        <div className="mx-4 mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(184,150,90,0.2)' }}>
          <div className="px-4 py-2.5" style={{ background: 'linear-gradient(135deg, #F5F0E8 0%, #EDE5D5 100%)' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#a08b6a', letterSpacing: '-0.2px' }}>나의 내면 요약</p>
          </div>
          <div className="px-4 py-3 space-y-2.5" style={{ background: 'linear-gradient(180deg, #FDFBF7, #faf7f2)' }}>
            {summaryParts.map((part, i) => (
              <p key={i} style={{ fontSize: 12, color: '#4a3f33', lineHeight: 1.75, wordBreak: 'keep-all' }}>{part}</p>
            ))}
            {dayVoices && (
              <div className="flex items-start gap-2 mt-1 pt-2.5" style={{ borderTop: '1px dashed #e0d8cc' }}>
                <div style={{ width: 3, minHeight: 20, borderRadius: 2, background: '#B8965A', marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.65 }}>
                  특히 <b style={{ color: '#B8965A' }}>일지(본질)</b>에서 {dayVoices} 목소리가 가장 강하게 작동해요.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 카드 리스트 (세로) */}
      <div className="px-4 pb-1 space-y-3">
        {cards.map((card, ci) => {
          const ec = EC[card.elemKey];
          return (
            <div key={ci} className="rounded-xl overflow-hidden" style={{
              border: card.isCore ? '2px solid #B8965A' : `1px solid ${ec.med}`,
              boxShadow: card.isCore ? '0 2px 12px rgba(184,150,90,0.15)' : '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              {/* 카드 헤더 */}
              <div className="flex items-center gap-3 px-3.5 py-3" style={{
                background: card.isCore
                  ? 'linear-gradient(135deg, #F7F1E6 0%, #EDE2CF 50%, #E8DABE 100%)'
                  : `linear-gradient(135deg, ${ec.light} 0%, ${ec.light}ee 60%, ${ec.med}44 100%)`,
              }}>
                <div className="flex-shrink-0 flex items-center justify-center" style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: card.isCore ? 'linear-gradient(135deg, #B8965A, #b8965a)' : `linear-gradient(135deg, ${ec.main}, ${ec.dark})`,
                  boxShadow: card.isCore ? '0 2px 8px rgba(184,150,90,0.3)' : `0 2px 6px ${ec.main}33`,
                }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{card.hanja}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#3D3427' }}>{card.posKey}</span>
                    {card.isCore && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: '0.5px',
                        background: 'linear-gradient(135deg, #B8965A, #b8965a)',
                        borderRadius: 6, padding: '2px 8px',
                        boxShadow: '0 1px 4px rgba(184,150,90,0.3)',
                      }}>핵심</span>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: '#8b7e6f', marginTop: 1 }}>{card.role} — {card.roleDesc}</p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: card.isCore ? '#B8965A' : ec.main,
                  background: card.isCore ? 'rgba(184,150,90,0.1)' : `${ec.light}`,
                  borderRadius: 6, padding: '2px 7px',
                  border: card.isCore ? '1px solid rgba(184,150,90,0.25)' : `1px solid ${ec.med}`,
                }}>{card.posLabel}</span>
              </div>
              {/* 숨은 성격 목록 */}
              <div className="px-3.5 py-2.5 space-y-0" style={{ background: '#fff' }}>
                {card.entries.map((e, ei) => {
                  const eec = EC[e.elemKey];
                  return (
                    <div key={ei} className="flex items-start gap-3 py-2.5" style={{
                      borderLeft: `3px solid ${eec.main}22`,
                      paddingLeft: 10,
                      marginLeft: -2,
                      ...(ei < card.entries.length - 1 ? { borderBottom: '1px solid #f5f0e8' } : {}),
                    }}>
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{
                        background: `linear-gradient(135deg, ${eec.light}, ${eec.med}44)`,
                        border: `1px solid ${eec.med}`,
                      }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: eec.dark }}>{e.hanja}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#3D3427' }}>{e.kr}</span>
                          {e.sipsung && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, color: eec.dark,
                              background: `linear-gradient(135deg, ${eec.light}, ${eec.med}55)`,
                              borderRadius: 5, padding: '1.5px 6px',
                              border: `1px solid ${eec.med}88`,
                            }}>{e.sipsung}</span>
                          )}
                        </div>
                        {e.meaning ? (
                          <div style={{ marginTop: 4 }}>
                            <div className="flex items-start gap-0" style={{ marginBottom: 3 }}>
                              <div style={{ width: 2, minHeight: 14, borderRadius: 1, background: '#B8965A', marginTop: 3, marginRight: 6, flexShrink: 0 }} />
                              <p style={{ fontSize: 11, color: '#B8965A', fontWeight: 700, lineHeight: 1.5, fontStyle: 'italic' }}>{e.meaning.voice}</p>
                            </div>
                            <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.65 }}>{e.meaning.trait}</p>
                          </div>
                        ) : e.sipsung ? (
                          <p style={{ fontSize: 11, color: '#8b7e6f', marginTop: 3 }}>{e.sipsung} 에너지</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 해석 가이드 */}
      <div className="mx-4 mt-3 mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #e8e0d4' }}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'linear-gradient(135deg, #faf5eb, #f3eadb)', borderBottom: '1px solid #e8e0d4' }}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: 'linear-gradient(135deg, #B8965A, #b8965a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 800 }}>?</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#a08b6a' }}>이렇게 읽어요</span>
        </div>
        <div className="px-3.5 py-3 space-y-2" style={{ background: '#fff' }}>
          <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.75 }}>
            각 칸마다 2~3개의 숨은 성격이 있어요. 예를 들어 한 칸에 "제대로 해야 해" + "더 배우고 싶어"가 같이 있으면, <b style={{ color: '#3D3427' }}>완벽주의와 학습욕이 동시에 작동</b>하는 성격이에요.
          </p>
          <div className="flex items-start gap-2 pt-1" style={{ borderTop: '1px dashed #e8e0d4' }}>
            <div style={{ width: 3, minHeight: 28, borderRadius: 2, background: '#B8965A', marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.75 }}>
              <b style={{ color: '#B8965A' }}>일지 = 진짜 나</b> (가장 중요), 년지 = 어릴 때 모습, 시지 = 나이 들수록 나타나는 모습이에요. 같은 십성이 여러 칸에 반복되면 그 성향이 특히 강해요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CareerFitVis({ aiCareerFit, dayOheng, elements, sipDist }: {
  aiCareerFit?: { job: string; score: number; reason?: string }[];
  dayOheng: OhengType;
  elements: V4Elements;
  sipDist?: { 비겁: number; 식상: number; 재성: number; 관성: number; 인성: number };
}) {
  // 사주 기반 직업 추천 생성 (AI 결과 없을 때 + AI 결과 보강)
  function generateFromSaju(): { job: string; score: number; reason: string; basis: string }[] {
    const dist = sipDist || { 비겁: 2, 식상: 2, 재성: 2, 관성: 2, 인성: 2 };
    const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    const pct = {
      비겁: Math.round((dist.비겁 / total) * 100),
      식상: Math.round((dist.식상 / total) * 100),
      재성: Math.round((dist.재성 / total) * 100),
      관성: Math.round((dist.관성 / total) * 100),
      인성: Math.round((dist.인성 / total) * 100),
    };

    // 일간 오행 × 십성 조합별 초구체적 직업 매핑
    const CAREER_BY_SIPSUNG: Record<string, Record<OhengType, { job: string; reason: string }>> = {
      식상: {
        목: { job: '교육 콘텐츠 크리에이터 (유튜브/클래스101)', reason: '목 일간의 식상 = 나무가 꽃을 피우듯 지식을 콘텐츠로 변환하는 능력. 성장을 가르치는 교육 분야에서 표현력이 극대화' },
        화: { job: '영상 PD / 숏폼 콘텐츠 디렉터', reason: '화 일간의 식상 = 불꽃이 빛으로 변하듯 시각적 표현에 천부적 감각. 미디어·영상 분야에서 창작 에너지가 폭발' },
        토: { job: '요식업 프랜차이즈 오너 / 쿠킹클래스 운영', reason: '토 일간의 식상 = 대지가 열매를 맺듯 음식·맛 관련 창작에 강점. 외식업·푸드테크에서 안정적 수익 구조 설계 능력' },
        금: { job: '보석감정사 / 귀금속 디자이너', reason: '금 일간의 식상 = 쇠를 다듬어 작품으로 만드는 정교함. 정밀 공예·디자인 분야에서 섬세한 표현력 발휘' },
        수: { job: '데이터 기반 마케팅 전략가', reason: '수 일간의 식상 = 물이 흘러가며 길을 만들듯 데이터에서 인사이트를 뽑아내는 능력. 분석+표현 융합형 직무에 최적' },
      },
      재성: {
        목: { job: '친환경 부동산 투자 컨설턴트', reason: '목 일간이 토를 극해 재성 = 성장 에너지로 부동산·토지를 관리. ESG·녹색 건축 분야에서 투자 안목이 뛰어남' },
        화: { job: '핀테크 자산관리 플래너 (로보어드바이저)', reason: '화 일간이 금을 극해 재성 = 열정적 판단력으로 금융 자산을 다루는 능력. IT+금융 융합 분야에서 빠른 의사결정이 강점' },
        토: { job: '수산물 유통/해외 무역 사업가', reason: '토 일간이 수를 극해 재성 = 안정적 관리력으로 유통·물류를 장악. 실물 거래에서 꼼꼼한 관리 능력이 수익으로 연결' },
        금: { job: '임업/목재 가공 스타트업 대표', reason: '금 일간이 목을 극해 재성 = 원재료를 가공해 가치를 만드는 구조. 제조·가공·원자재 분야에서 수익 창출 능력' },
        수: { job: '전기차/신에너지 투자 애널리스트', reason: '수 일간이 화를 극해 재성 = 냉정한 분석력으로 에너지 시장을 읽는 능력. 신기술 투자에서 리스크 관리 탁월' },
      },
      관성: {
        목: { job: '국가직 7급 교육행정 사무관', reason: '목 일간의 관성(금) = 나무를 다듬는 가위. 교육·환경 분야 공직에서 조직력과 성장 마인드가 시너지' },
        화: { job: '소방방재청 안전정책 기획관', reason: '화 일간의 관성(수) = 불을 제어하는 물의 힘. 안전·방재·위기관리 분야 공직에서 열정과 규율의 균형이 강점' },
        토: { job: '도시계획 전문 건축행정 공무원', reason: '토 일간의 관성(목) = 땅 위에 나무를 심는 구조. 국토·건축·도시계획 분야에서 안정적 관리와 성장 비전 양립' },
        금: { job: '검찰/금융감독원 조사관', reason: '금 일간의 관성(화) = 불에 단련되는 쇠. 법집행·금융감독 분야에서 날카로운 분석력과 강한 추진력 발휘' },
        수: { job: '과학기술정보통신부 R&D 정책관', reason: '수 일간의 관성(토) = 물길을 잡아주는 제방. 기술정책·연구관리 분야에서 깊은 전문성과 체계적 관리력 병행' },
      },
      인성: {
        목: { job: '대학교수 (교육학/심리학 전공)', reason: '목 일간의 인성(수) = 나무에게 물을 주는 근원. 교육·연구 분야에서 학문적 깊이와 성장 지향성이 조화' },
        화: { job: 'AI/머신러닝 연구원 (네이버/카카오급)', reason: '화 일간의 인성(목) = 불꽃에 장작을 더하듯 끊임없이 배우는 에너지. 첨단 기술 연구에서 열정+학습력 극대화' },
        토: { job: '한의사 / 전통의학 연구자', reason: '토 일간의 인성(화) = 대지를 데우는 햇볕. 전통 지식을 현대에 접목하는 분야에서 깊은 이해력과 실용성 발휘' },
        금: { job: '특허 전문 변리사 / 기술거래사', reason: '금 일간의 인성(토) = 쇠의 원광석. 기술·지식재산 분야에서 정밀한 분석력과 체계적 학습 능력이 강점' },
        수: { job: '빅데이터 사이언티스트 (삼성SDS급)', reason: '수 일간의 인성(금) = 물을 정화하는 금속. 데이터·통계 기반 연구에서 깊이 있는 분석력과 논리적 사고력 발휘' },
      },
      비겁: {
        목: { job: '에듀테크 스타트업 CEO (클래스101 유형)', reason: '목 일간의 비겁 = 나무가 숲을 이루듯 교육 플랫폼을 키우는 리더십. 성장 분야에서 독립적 사업 능력' },
        화: { job: 'SaaS/앱 서비스 스타트업 창업 CEO', reason: '화 일간의 비겁 = 불꽃이 불꽃을 만나 더 크게 타오르듯, IT 서비스 분야에서 폭발적 추진력으로 시장 개척' },
        토: { job: '부동산 개발/시행 법인 대표', reason: '토 일간의 비겁 = 대지가 넓어지듯 부동산·건설 분야에서 안정적이면서도 확장하는 사업 구조에 적합' },
        금: { job: '법무법인/세무법인 공동대표', reason: '금 일간의 비겁 = 쇠가 모여 강해지듯 전문직 파트너십 구조에서 날카로운 경쟁력 발휘' },
        수: { job: '지식 플랫폼/온라인 교육 운영자', reason: '수 일간의 비겁 = 물이 모여 강을 이루듯 지식·정보 기반 플랫폼에서 깊이와 규모를 동시에 확보' },
      },
    };

    const careers: { job: string; score: number; reason: string; basis: string }[] = [];

    // 십성 분포 기반 추천 — 일간 오행별 초구체적 직업
    const sipEntries = [
      { key: '식상' as const, count: dist.식상, pctVal: pct.식상, base: 70 },
      { key: '재성' as const, count: dist.재성, pctVal: pct.재성, base: 68 },
      { key: '관성' as const, count: dist.관성, pctVal: pct.관성, base: 66 },
      { key: '인성' as const, count: dist.인성, pctVal: pct.인성, base: 65 },
      { key: '비겁' as const, count: dist.비겁, pctVal: pct.비겁, base: 64 },
    ].sort((a, b) => b.pctVal - a.pctVal);

    for (const entry of sipEntries) {
      if (entry.pctVal >= 20 && careers.length < 5) {
        const careerInfo = CAREER_BY_SIPSUNG[entry.key]?.[dayOheng];
        if (careerInfo) {
          careers.push({
            job: careerInfo.job,
            score: Math.min(95, entry.base + entry.pctVal),
            reason: careerInfo.reason,
            basis: `${entry.key} ${entry.count}개 (${entry.pctVal}%)`,
          });
        }
      }
    }

    // 최소 3개 보장 — 오행 강약 기반 추가
    if (careers.length < 3) {
      const elemArr = Object.entries(elements) as [ElemKey, number][];
      const strongElem = elemArr.reduce((a, b) => a[1] > b[1] ? a : b);
      const ELEM_TO_OHENG = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' } as Record<ElemKey, OhengType>;
      const ohKey = ELEM_TO_OHENG[strongElem[0]];
      // 강한 오행 기반 보조 직업
      const OHENG_SUB: Record<OhengType, { job: string; reason: string }[]> = {
        목: [
          { job: '환경/ESG 전문 컨설턴트', reason: `목 에너지가 강해(${strongElem[1]}%) 성장·환경 분야에서 자연스러운 적성. 지속가능성 분야에서 장기적 커리어 유망` },
          { job: '인테리어/공간 디자이너', reason: '목의 창조 에너지가 공간 설계에서 발현. 나무·식물·자연소재를 활용한 디자인에 감각이 있어요' },
        ],
        화: [
          { job: 'UX/UI 디자이너 (토스/배민급)', reason: `화 에너지가 강해(${strongElem[1]}%) 시각적 표현과 사용자 경험 설계에 뛰어난 감각. 디지털 디자인 분야 천직` },
          { job: '퍼포먼스 마케터 (CPA/ROAS 전문)', reason: '화의 확산 에너지가 마케팅에서 발현. 데이터 기반 광고 최적화에서 빠른 판단력 발휘' },
        ],
        토: [
          { job: '프로젝트 매니저(PM) / 스크럼마스터', reason: `토 에너지가 강해(${strongElem[1]}%) 사람과 일을 조율하는 능력 탁월. 팀을 안정적으로 이끄는 관리형 리더` },
          { job: '공인중개사 / 자산관리 전문가', reason: '토의 안정 에너지가 부동산·자산 분야에서 발현. 장기적 자산 설계에 강점' },
        ],
        금: [
          { job: 'CPA 세무사 / 관세사', reason: `금 에너지가 강해(${strongElem[1]}%) 숫자와 규칙에 정확한 분석력. 회계·세무·관세 분야에서 꼼꼼함이 무기` },
          { job: '의료기기/바이오 전문 영업 (메드트로닉급)', reason: '금의 정밀 에너지가 의료 분야에서 발현. 전문 지식 기반 B2B 영업에 강점' },
        ],
        수: [
          { job: '심리상담사 / 코칭 전문가 (ICF 인증)', reason: `수 에너지가 강해(${strongElem[1]}%) 깊은 통찰력과 공감 능력. 상담·코칭 분야에서 신뢰감 있는 전문가` },
          { job: '국제무역/수출입 스페셜리스트', reason: '수의 유통 에너지가 무역에서 발현. 해외 시장 분석과 글로벌 네트워킹에 재능' },
        ],
      };
      const subs = OHENG_SUB[ohKey] || OHENG_SUB['토'];
      for (const sub of subs) {
        if (careers.length < 5) {
          careers.push({ job: sub.job, score: Math.min(82, 58 + strongElem[1]), reason: sub.reason, basis: `${ohKey} 오행 ${strongElem[1]}%` });
        }
      }
    }

    return careers.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  const fits = (aiCareerFit && aiCareerFit.length > 0)
    ? aiCareerFit.sort((a, b) => b.score - a.score).map((cf) => ({
        label: cf.job,
        score: cf.score,
        reason: cf.reason || '',
        basis: '',
      }))
    : generateFromSaju().map(cf => ({
        label: cf.job,
        score: cf.score,
        reason: cf.reason,
        basis: cf.basis,
      }));

  if (fits.length === 0) return null;

  const SCORE_COLORS = ['#B8965A', '#2D8A4E', '#1565C0', '#F57F17', '#757575'];
  const topFit = fits[0];
  const strongFields = fits.filter(f => f.score >= 75);
  const weakFields = fits.filter(f => f.score < 55);

  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47', marginBottom: 4 }}>▎직업 적성 매칭도</div>
      <p style={{ fontSize: 10, color: '#8b7e6f', marginBottom: 12, lineHeight: 1.5 }}>
        일간 오행({dayOheng}), 십성 분포, 오행 밸런스를 종합 분석하여 적합한 직업을 도출했어요
      </p>

      {/* 종합 해석 */}
      <div className="mb-4 p-3.5 rounded-xl" style={{ background: 'linear-gradient(135deg, #f5f0e8, #ede5d5)', border: '1px solid rgba(184,150,90,0.25)' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#a08b6a', marginBottom: 4 }}>나의 직업 성향 요약</p>
        <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7 }}>
          <b>{topFit.label}</b> 분야와 궁합이 가장 좋아요 ({topFit.score}%).
          {strongFields.length > 1 && <> <b>{strongFields.slice(1).map(f => f.label).join(', ')}</b> 분야도 잘 맞는 편이에요.</>}
          {weakFields.length > 0 && <> 반면 <b>{weakFields.map(f => f.label).join(', ')}</b>은 에너지 소모가 클 수 있어요 — 못한다는 게 아니라 더 힘이 드는 방향이에요.</>}
        </p>
      </div>

      {/* 직업 카드 */}
      <div className="space-y-3">
        {fits.map((f, i) => {
          const color = SCORE_COLORS[i % SCORE_COLORS.length];
          const isTop = f.score >= 80;
          const isWeak = f.score < 55;
          return (
            <div key={i} className="rounded-xl overflow-hidden" style={{
              border: isTop ? `2px solid ${color}40` : `1px solid #e8e0d4`,
            }}>
              {/* 바 영역 */}
              <div className="p-3" style={{ background: isTop ? `${color}08` : '#fff' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color }}>{i + 1}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#6b5b47', flex: 1 }}>{f.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color }}>{f.score}%</span>
                </div>
                <div className="rounded-full overflow-hidden mb-2" style={{ height: 8, background: '#efe8db' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${f.score}%`,
                    background: `linear-gradient(90deg, ${color}80, ${color})`,
                    transition: 'width 1s ease',
                  }} />
                </div>
                {/* 점수 범위 해석 */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="rounded-full px-2 py-0.5" style={{
                    fontSize: 9, fontWeight: 700,
                    background: isTop ? `${color}15` : isWeak ? '#fff3e0' : '#f5f5f5',
                    color: isTop ? color : isWeak ? '#e65100' : '#757575',
                  }}>
                    {isTop ? '천직 수준' : isWeak ? '에너지 소모 큼' : f.score >= 65 ? '충분히 적합' : '보조 적성'}
                  </span>
                  {f.basis && (
                    <span className="rounded-full px-2 py-0.5" style={{ fontSize: 9, fontWeight: 600, background: '#f5f0e8', color: '#a08b6a' }}>
                      {f.basis}
                    </span>
                  )}
                </div>
                {/* 사주 근거 */}
                {f.reason && (
                  <div className="p-2.5 rounded-lg" style={{ background: '#faf7f2', border: '1px dashed #e8e0d4' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 2 }}>왜 이 직업이 나왔을까?</p>
                    <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.7 }}>{f.reason}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 해석 가이드 */}
      <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#fff8e1', border: '1px solid #ffe082' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#f57f17', marginBottom: 3 }}>이렇게 읽어요</p>
        <p style={{ fontSize: 10, color: '#8b7e6f', lineHeight: 1.6 }}>
          점수 기준: 80% 이상 = 사주의 에너지 흐름과 가장 잘 맞는 '천직' 수준.
          65~79% = 타고난 적성이 충분히 있어 잘 해낼 수 있는 분야.
          55~64% = 노력하면 되지만 에너지가 더 드는 방향.
          55% 미만 = 이 방향보다 더 맞는 길이 있다는 신호.
          <b style={{ color: '#6b5b47' }}> 점수는 일간 오행({dayOheng})·십성 분포·오행 밸런스를 종합 산출한 결과예요.</b>
        </p>
      </div>
    </div>
  );
}

function HealthVis({ elements, dayOheng, pillars: _pillars }: {
  elements: V4Elements; dayOheng: OhengType; pillars: Pillar[];
}) {
  // 오행<->장기 매핑 (동의보감 기준)
  const HEALTH_MAP: Record<ElemKey, { organ: string; detail: string; strong: string; weak: string; fix: string }> = {
    wood: {
      organ: '간(肝)·담·눈·근육',
      detail: '해독 능력, 시력, 근육의 유연성을 관장',
      strong: '스트레스가 간에 쌓이기 쉬움. 분노 조절과 충분한 수면, 음주 절제가 핵심이에요',
      weak: '눈이 쉽게 피로하고 근육이 뻣뻣해질 수 있어요. 스트레칭, 녹색 채소, 간 해독에 신경 쓰세요',
      fix: '산책·등산(목 에너지 보충), 녹색 채소·쑥차, 새벽 기상 습관',
    },
    fire: {
      organ: '심장(心)·소장·혈관·혀',
      detail: '혈액순환, 체온 조절, 정신 건강을 관장',
      strong: '심장에 부담이 갈 수 있어요. 과로·과열 주의, 시원한 음식과 명상으로 열을 식히세요',
      weak: '혈액순환이 약하고 수족 냉증이 올 수 있어요. 유산소 운동과 따뜻한 차(생강·계피)를 추천해요',
      fix: '유산소 운동(달리기·자전거), 쓴맛 음식(커피·미역), 충분한 수면',
    },
    earth: {
      organ: '비장(脾)·위(胃)·소화기·입',
      detail: '소화 흡수, 면역력, 에너지 전환을 관장',
      strong: '과식·폭식 주의. 위산 과다나 소화불량이 올 수 있어요. 규칙적 식사와 가벼운 식단이 중요해요',
      weak: '소화력이 약해 체력이 금방 떨어질 수 있어요. 따뜻한 음식, 잡곡밥, 규칙적 식사 시간이 핵심이에요',
      fix: '규칙적 식사, 단맛 음식(꿀·고구마), 복부 마사지·산책',
    },
    metal: {
      organ: '폐(肺)·대장·코·피부',
      detail: '호흡기, 면역 방어, 피부 건강을 관장',
      strong: '피부 건조함이나 호흡기 과민 반응에 주의. 보습과 환기를 신경 쓰고, 매운 음식을 줄이세요',
      weak: '감기에 자주 걸리고 피부 트러블이 생기기 쉬워요. 호흡 운동, 환절기 마스크 착용, 보습 케어가 필수예요',
      fix: '심호흡·단전호흡, 매운맛 적정 섭취(무·배·도라지), 공기청정기 활용',
    },
    water: {
      organ: '신장(腎)·방광·귀·뼈',
      detail: '생명력의 근원, 체력, 생식기능, 뼈 건강을 관장',
      strong: '부종이나 냉증이 올 수 있어요. 땀을 흘리는 운동과 따뜻하게 유지하는 습관이 중요해요',
      weak: '체력이 쉽게 바닥나고 허리·무릎이 약해질 수 있어요. 수분 섭취, 하체 운동, 검은깨·검은콩이 도움돼요',
      fix: '수영·하체 운동, 짠맛 적정 섭취(해산물·미역), 족욕·반신욕',
    },
  };

  // 오행 수치로 상태 판단
  const items = (['wood', 'fire', 'earth', 'metal', 'water'] as ElemKey[]).map(elem => {
    const val = elements[elem];
    const info = HEALTH_MAP[elem];
    let status: string;
    let statusColor: string;
    let advice: string;
    let level: number; // 0~4

    if (val === 0) {
      status = '없음'; statusColor = '#c62828'; advice = info.weak; level = 0;
    } else if (val <= 10) {
      status = '약함'; statusColor = '#e65100'; advice = info.weak; level = 1;
    } else if (val <= 25) {
      status = '양호'; statusColor = '#2e7d32'; advice = `균형 잡힌 상태예요. ${info.fix.split(',')[0]}으로 유지하세요`; level = 3;
    } else if (val <= 35) {
      status = '강함'; statusColor = '#1565c0'; advice = `에너지가 충분해요. 다만 과하면 ${info.organ.split('·')[0]}에 부담이 갈 수 있으니 적당히 조절하세요`; level = 4;
    } else {
      status = '과다'; statusColor = '#c62828'; advice = info.strong; level = 4;
    }

    return { elem, organ: info.organ, detail: info.detail, status, statusColor, advice, fix: info.fix, level, val };
  });

  // 가장 취약한 장기 + 가장 과한 장기
  const weakest = items.reduce((a, b) => a.val < b.val ? a : b);
  const strongest = items.reduce((a, b) => a.val > b.val ? a : b);

  // 일간 오행 특성에 따른 추가 조언
  const dayHealthTip: Record<OhengType, string> = {
    목: '목 일간은 스트레스를 간에 쌓는 경향이 있어요. 분노를 참기보다 적절히 표현하고, 간 건강을 위해 음주를 절제하세요',
    화: '화 일간은 심장·혈관에 열이 몰리기 쉬워요. 과로와 흥분을 피하고, 충분한 수면으로 심장에 휴식을 주세요',
    토: '토 일간은 위장이 예민한 편이에요. 불규칙한 식사가 가장 큰 적이고, 정해진 시간에 따뜻한 식사를 하면 컨디션이 좋아져요',
    금: '금 일간은 호흡기·피부가 약점이에요. 환절기 감기와 피부 건조에 특히 주의하고, 보습과 실내 환기를 습관화하세요',
    수: '수 일간은 신장·허리에 주의가 필요해요. 장시간 앉아있기를 피하고, 하체 운동과 충분한 수분 섭취가 건강의 핵심이에요',
  };

  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47', marginBottom: 4 }}>
        ▎오행별 건강 분석
      </div>
      <p style={{ fontSize: 10, color: '#a0937f', marginBottom: 12, lineHeight: 1.5 }}>
        오행 분포를 기반으로 장기별 강약을 분석했어요. 부족한 오행의 장기를 의식적으로 관리하면 건강을 지킬 수 있어요.
      </p>

      {/* 종합 진단 */}
      <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.25)' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#a08b6a', marginBottom: 4 }}>종합 건강 진단</p>
        <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7 }}>
          가장 주의할 장기는 <b style={{ color: '#c62828' }}>{weakest.organ}</b>({EHAN[weakest.elem]}, {weakest.status})이에요.
          {strongest.val > 35 && <> 반면 <b style={{ color: '#1565c0' }}>{strongest.organ}</b>({EHAN[strongest.elem]})은 에너지가 과해 부담이 갈 수 있어요.</>}
        </p>
        <p style={{ fontSize: 11, color: '#8b7e6f', marginTop: 6, lineHeight: 1.6 }}>
          {dayHealthTip[dayOheng]}
        </p>
      </div>

      {/* 장기별 카드 */}
      <div className="space-y-2.5">
        {items.map((it, i) => {
          const ec = EC[it.elem];
          const isAlert = it.val === 0 || it.val > 35;
          return (
            <div key={i} className="rounded-xl overflow-hidden" style={{
              border: isAlert ? `2px solid ${it.statusColor}40` : `1px solid ${ec.med}`,
            }}>
              {/* 헤더 */}
              <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: ec.light }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: ec.dark }}>{EHAN[it.elem]}</span>
                <div className="flex-1">
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6b5b47' }}>{it.organ}</span>
                  <p style={{ fontSize: 9, color: '#a0937f' }}>{it.detail}</p>
                </div>
                <div className="text-center">
                  <span style={{ fontSize: 13, fontWeight: 900, color: it.statusColor }}>{it.status}</span>
                  <div className="flex gap-0.5 mt-1">
                    {[1,2,3,4].map(n => (
                      <div key={n} className="rounded-sm" style={{
                        width: 10, height: 4,
                        background: n <= it.level ? it.statusColor : '#e8e0d4',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
              {/* 상세 */}
              <div className="px-3 py-2.5" style={{ background: '#fff' }}>
                <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.7 }}>{it.advice}</p>
                <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${ec.med}` }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: ec.dark, marginBottom: 2 }}>보완법</p>
                  <p style={{ fontSize: 10, color: '#8b7e6f', lineHeight: 1.6 }}>{it.fix}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GaewoonVis() {
  const items: Array<{ id: 'color' | 'direction' | 'food' | 'exercise'; label: string; desc: string }> = [
    { id: 'color', label: '색상', desc: '검정·남색(수) + 흰색·은색(금)' },
    { id: 'direction', label: '방위', desc: '북(수)·서(금) 방향으로 책상 배치' },
    { id: 'food', label: '음식', desc: '해산물·검은깨(수) + 배·닭고기(금)' },
    { id: 'exercise', label: '운동', desc: '수영 최고! 요가·등산도 추천' },
  ];
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47', marginBottom: 10 }}>▎개운법 한눈에</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.id} className="p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Pictogram k={`gaewoon:${it.id}`} size={22} color="#6b5b47" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#6b5b47' }}>{it.label}</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b5b47', fontWeight: 500, lineHeight: 1.5 }}>{it.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── SectionVis dispatcher (PRD v2: 12섹션 + 4개 신규 시각화) ───
function SectionVis({ type, elements, hasBirthTime, jijanggan, pillars, aiResult }: {
  type: string;
  elements: V4Elements;
  hasBirthTime: boolean;
  jijanggan: JiJangGan[];
  pillars: Pillar[];
  aiResult?: any;
}) {
  if (type === 'oheng_structure') return <OhengFlowVis elements={elements} hasBirthTime={hasBirthTime} />;
  if (type === 'jijanggan') return <JijangganVisComp jijanggan={jijanggan} pillars={pillars} hasBirthTime={hasBirthTime} />;
  if (type === 'career_fit') {
    const dOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const myeongri = (aiResult as any)?.analysisBase;
    const sipDistData = myeongri?.십성분포;
    return <CareerFitVis aiCareerFit={aiResult?.careerFit} dayOheng={dOheng} elements={elements} sipDist={sipDistData} />;
  }
  if (type === 'health_oheng') {
    const dOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    return <HealthVis elements={elements} dayOheng={dOheng} pillars={pillars} />;
  }
  if (type === 'gaewoon') return <GaewoonVis />;
  // PRD v2 신규 시각화 — AI 결과가 있을 때만 표시
  if (type === 'luckyProfile') return aiResult?.luckyProfile ? <LuckyProfile data={aiResult.luckyProfile} /> : null;
  if (type === 'monthlyFortune') return aiResult?.monthlyFortune ? <MonthlyFortune data={aiResult.monthlyFortune} /> : null;
  if (type === 'relationshipMap') return aiResult?.relationshipMap ? <RelationshipMap data={aiResult.relationshipMap} /> : null;
  if (type === 'wealthFlow') return aiResult?.wealthFlow ? <WealthFlow data={aiResult.wealthFlow} /> : null;
  if (type === 'challenge_vis') {
    // 인생과제 — VS 비율 분석 (실제 사주 오행 분포 기반 십성 비율)
    const dOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const dElem = OHENG_TO_ELEM[dOheng];
    const ecC = EC[dElem];
    const SYM_C: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };
    const NAT_C: Record<OhengType, string> = { 목: '성장하는 나무', 화: '타오르는 불꽃', 토: '묵직한 대지', 금: '단단한 쇠', 수: '흐르는 물' };

    // ── 십성 → 오행 매핑 (V4Elements 영문 키 기준) ──
    // 비겁=나, 식상=내가 생, 재성=내가 극, 관성=나를 극, 인성=나를 생
    const SS_MAP: Record<OhengType, Record<string, ElemKey>> = {
      목: { 비겁: 'wood', 식상: 'fire', 재성: 'earth', 관성: 'metal', 인성: 'water' },
      화: { 비겁: 'fire', 식상: 'earth', 재성: 'metal', 관성: 'water', 인성: 'wood' },
      토: { 비겁: 'earth', 식상: 'metal', 재성: 'water', 관성: 'wood', 인성: 'fire' },
      금: { 비겁: 'metal', 식상: 'water', 재성: 'wood', 관성: 'fire', 인성: 'earth' },
      수: { 비겁: 'water', 식상: 'wood', 재성: 'fire', 관성: 'earth', 인성: 'metal' },
    };
    const ssm = SS_MAP[dOheng];
    const el = elements || { wood: 2, fire: 2, earth: 2, metal: 1, water: 1 };
    const getScore = (cats: string[]) => cats.reduce((s, c) => s + (el[ssm[c]] || 0), 0);
    const calcPct = (sA: string[], sB: string[]): number => {
      const a = getScore(sA), b = getScore(sB), t = a + b;
      if (t === 0) return 50;
      return Math.max(15, Math.min(85, Math.round((a / t) * 100)));
    };

    interface VsTheme {
      labelA: string; labelB: string;
      sideA: string[]; sideB: string[];
      tip: string;
      vH: string; // A쪽이 높을 때 해석
      vL: string; // B쪽이 높을 때 해석
    }

    const CM: Record<OhengType, { coreQ: string; summary: string; themes: VsTheme[] }> = {
      목: {
        coreQ: '어떻게 하면 곧게 자라면서도 부러지지 않을 수 있을까?',
        summary: '목(木) 일간의 인생 과제는 "성장과 유연성의 균형"입니다. 나무는 위로 뻗으려 하지만, 바람에 흔들리지 못하면 부러져요.',
        themes: [
          { labelA: '고집', labelB: '유연성',
            sideA: ['비겁', '인성'], sideB: ['관성', '식상', '재성'],
            tip: '일주일에 한 번, 내 의견과 반대되는 입장을 의도적으로 생각해보세요',
            vH: '자기 주장이 강한 사주예요. 내 생각이 틀릴 수도 있다는 가능성을 열어두는 것이 성장의 열쇠입니다.',
            vL: '유연하게 대처하는 힘이 있지만, 때로는 소신을 더 강하게 밀어붙여도 괜찮아요. 흔들리지 않는 중심이 필요해요.' },
          { labelA: '독립', labelB: '협력',
            sideA: ['비겁'], sideB: ['재성', '관성', '식상'],
            tip: '프로젝트마다 1명 이상 파트너를 만들어보세요. 혼자보다 빨라요',
            vH: '독립심이 강한 사주예요. 혼자 다 하려 하지 말고, 도움을 요청하는 것은 약함이 아니라 지혜임을 기억하세요.',
            vL: '협력을 잘하는 사주지만, 자기 결정권을 더 챙겨도 괜찮아요. 주도권을 잡는 연습이 필요해요.' },
          { labelA: '성급함', labelB: '인내',
            sideA: ['식상', '비겁'], sideB: ['인성', '관성', '재성'],
            tip: '중요한 결정은 최소 하루 묵혔다가 하세요. 48시간 규칙이 효과적',
            vH: '행동력은 빠르지만 조급해질 수 있는 사주예요. 뿌리를 깊이 내린 나무가 가장 오래 서 있어요. 의도적으로 천천히.',
            vL: '신중한 편이지만, 때로는 빠른 결단이 기회를 만들어요. 70% 확신이면 GO. 완벽한 타이밍은 없어요.' },
        ],
      },
      화: {
        coreQ: '이 뜨거운 에너지를 태워버리지 않고, 어디에 비출 것인가?',
        summary: '화(火) 일간의 인생 과제는 "열정의 방향 설정과 에너지 분배"입니다. 불꽃은 밝지만, 조절 없이 타면 스스로 꺼져요.',
        themes: [
          { labelA: '열정', labelB: '절제',
            sideA: ['비겁', '식상'], sideB: ['관성', '인성', '재성'],
            tip: '번아웃 전조 증상(수면 장애, 의욕 저하)을 체크리스트로 만들어 관리하세요',
            vH: '열정이 넘치는 사주예요. 100%로 달리다 갑자기 0%가 되는 패턴을 주의하세요. 70%가 가장 오래 가는 속도예요.',
            vL: '자기 조절력이 좋은 사주예요. 하지만 가끔은 열정을 더 풀어줘도 괜찮아요. 안전지대를 벗어나보세요.' },
          { labelA: '표현', labelB: '절제',
            sideA: ['식상', '비겁'], sideB: ['관성', '인성'],
            tip: '화가 날 때 10초 세고 말하는 습관. 메신저는 작성 후 5분 뒤 전송',
            vH: '표현욕이 강한 사주예요. 한 마디가 관계를 태울 수 있으니, 말하기 전 한 박자 쉬는 게 핵심이에요.',
            vL: '절제력이 있는 사주예요. 하지만 속 얘기를 더 꺼내는 연습도 필요해요. 침묵이 항상 답은 아니에요.' },
          { labelA: '즉흥', labelB: '계획',
            sideA: ['식상', '비겁'], sideB: ['재성', '관성', '인성'],
            tip: '분기별 목표 1개만 정해두세요. 나머지는 거기에 맞춰서 움직이면 돼요',
            vH: '즉흥적 에너지가 강한 사주예요. 방향만 정하면 그 에너지가 레이저가 돼요. 전략이 불꽃의 방향을 잡아줘요.',
            vL: '계획적인 사주지만, 가끔 직감을 믿고 뛰어드는 용기도 필요해요. 모든 걸 계획할 순 없어요.' },
        ],
      },
      토: {
        coreQ: '안정을 지키면서도 어떻게 앞으로 나아갈 수 있을까?',
        summary: '토(土) 일간의 인생 과제는 "안정 추구와 변화 수용의 균형"입니다. 대지는 든든하지만, 움직이지 않으면 새싹도 못 틔워요.',
        themes: [
          { labelA: '안정', labelB: '변화',
            sideA: ['비겁', '인성'], sideB: ['식상', '재성', '관성'],
            tip: '3개월에 1번은 새로운 것을 시도하세요. 새 취미, 새 모임, 새 루트',
            vH: '안정 지향 사주예요. 익숙한 환경에 머물려는 본능이 강하지만, 의식적으로 작은 변화를 시도해야 성장해요.',
            vL: '변화를 잘 수용하는 사주예요. 하지만 기본 토대를 더 단단히 다져두세요. 뿌리 없는 변화는 표류예요.' },
          { labelA: '포용', labelB: '경계',
            sideA: ['비겁', '인성'], sideB: ['관성', '재성', '식상'],
            tip: '부탁받으면 바로 대답하지 말고 "생각해볼게"라고 하세요',
            vH: '모두를 품으려는 사주예요. 정작 나를 잃기 쉬우니, NO라고 말하는 것도 사랑이에요.',
            vL: '적절한 경계가 있는 사주예요. 하지만 마음의 벽을 조금 낮춰도 괜찮아요. 신뢰는 열어야 시작돼요.' },
          { labelA: '신중', labelB: '결단',
            sideA: ['비겁', '인성'], sideB: ['식상', '관성', '재성'],
            tip: '작은 결정(메뉴, 옷)부터 5초 안에 고르는 연습을 하세요. 결단 근육이 커져요',
            vH: '신중하지만 결정이 느린 사주예요. 70% 확신이면 움직이세요. 기회는 기다려주지 않아요.',
            vL: '결단력이 있는 사주예요. 하지만 중요한 결정은 하루 더 생각해도 늦지 않아요. 신중함도 무기예요.' },
        ],
      },
      금: {
        coreQ: '완벽을 추구하면서도 어떻게 자신과 타인을 용서할 수 있을까?',
        summary: '금(金) 일간의 인생 과제는 "완벽주의와 유연함의 균형"입니다. 쇠는 날카롭고 정확하지만, 유연하지 못하면 깨져요.',
        themes: [
          { labelA: '완벽', labelB: '유연',
            sideA: ['비겁', '관성'], sideB: ['식상', '재성', '인성'],
            tip: '완벽하지 않아도 마감을 지키세요. 수정은 나중에 해도 돼요',
            vH: '완벽을 추구하는 사주예요. 80%면 일단 내보내세요. Done is better than perfect. 완벽은 적의 이름이에요.',
            vL: '유연한 사주지만, 디테일에 좀 더 신경쓰면 결과물의 질이 크게 달라져요. 마무리 한 끗이 중요해요.' },
          { labelA: '이성', labelB: '감성',
            sideA: ['비겁', '관성'], sideB: ['식상', '인성', '재성'],
            tip: '하루 1번, 가까운 사람에게 감정을 표현하는 연습을 하세요',
            vH: '이성적 판단이 강한 사주예요. 옳은 말보다 따뜻한 말이 필요한 순간을 놓치지 마세요. 관계는 논리가 아니에요.',
            vL: '감성적인 면이 있는 사주예요. 중요한 순간엔 감정보다 이성적 판단을 믿으세요. 냉정함이 때로는 친절이에요.' },
          { labelA: '집착', labelB: '놓아줌',
            sideA: ['비겁', '인성'], sideB: ['식상', '재성', '관성'],
            tip: '분기 1회, "이제 그만둘 것" 리스트를 만들어보세요. 놓아야 새것이 들어와요',
            vH: '한번 잡으면 안 놓는 사주예요. 손해가 분명하면 빨리 놓는 것도 용기입니다. 집착은 기회비용이에요.',
            vL: '놓아줄 줄 아는 사주예요. 하지만 정말 중요한 것엔 끈기를 더 발휘하세요. 포기가 습관이 되면 안 돼요.' },
        ],
      },
      수: {
        coreQ: '깊이 생각하면서도 어떻게 결정적 순간에 행동할 수 있을까?',
        summary: '수(水) 일간의 인생 과제는 "깊이와 방향성의 균형"입니다. 물은 깊고 유연하지만, 방향 없이 흐르면 고여서 썩어요.',
        themes: [
          { labelA: '생각', labelB: '행동',
            sideA: ['인성', '비겁'], sideB: ['식상', '재성', '관성'],
            tip: '아이디어가 떠오르면 48시간 안에 첫 행동 1개를 실행하세요',
            vH: '분석형 사주예요. 생각의 30%에서 행동을 시작하세요. 완벽한 계획은 없어요. 움직이면서 수정하세요.',
            vL: '실행력이 좋은 사주예요. 가끔은 한 발 물러서 깊이 생각해보세요. 방향이 속도보다 더 중요해요.' },
          { labelA: '적응', labelB: '정체성',
            sideA: ['비겁', '식상'], sideB: ['인성', '관성', '재성'],
            tip: '나의 핵심 가치 3개를 정하고 적어두세요. 결정이 흔들릴 때 기준이 돼요',
            vH: '적응력이 강한 사주예요. 하지만 "나는 누구인가"의 중심축을 잡아야 흔들리지 않아요. 유연함에도 뿌리가 필요해요.',
            vL: '중심이 뚜렷한 사주예요. 때로는 유연하게 방향을 틀어보세요. 물은 돌아가야 바다에 닿아요.' },
          { labelA: '깊이', labelB: '넓이',
            sideA: ['비겁', '인성'], sideB: ['식상', '재성', '관성'],
            tip: '전공 외 관심 분야 1개를 매년 정해서 가볍게 공부하세요. T자형 인재가 목표',
            vH: '한 우물형 사주예요. 전문성은 강하지만 시야가 좁아질 수 있어요. 관련 분야 1~2개를 함께 보면 시야가 넓어져요.',
            vL: '넓게 보는 힘이 있는 사주예요. 하지만 하나를 깊이 파는 집중력을 키우면 전문가가 돼요. 넓이만으론 부족해요.' },
        ],
      },
    };

    const data = CM[dOheng] || CM['토'];

    return (
      <div className="my-4">
        <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 14, lineHeight: 1.6 }}>
          {dOheng}({SYM_C[dOheng]}) 일간의 오행 분포에서 십성 비율을 분석하여, 성향의 편향과 핵심 과제를 도출했어요.
        </p>

        {/* 핵심 질문 — 네이비 카드 */}
        <div className="rounded-xl p-4 mb-4" style={{ background: 'linear-gradient(135deg, #1B2A4A, #243656)', boxShadow: '0 2px 12px rgba(27,42,74,0.15)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: ecC.main, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${ecC.main}55` }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{SYM_C[dOheng]}</span>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#E8D5A8', fontWeight: 600 }}>{NAT_C[dOheng]}의 과제</p>
              <p style={{ fontSize: 13, color: '#fff', fontWeight: 800, marginTop: 1 }}>{dOheng} 일간의 핵심 질문</p>
            </div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(232,213,168,0.2)' }}>
            <p style={{ fontSize: 14, color: '#E8D5A8', fontWeight: 700, lineHeight: 1.7, fontStyle: 'italic' }}>
              "{data.coreQ}"
            </p>
          </div>
        </div>

        {/* 종합 요약 */}
        <div className="p-3.5 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.25)' }}>
          <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.75, fontWeight: 500 }}>{data.summary}</p>
        </div>

        {/* 3대 과제 카드 — VS 비율 바 */}
        <div className="space-y-3">
          {data.themes.map((t, i) => {
            const pctA = calcPct(t.sideA, t.sideB);
            const pctB = 100 - pctA;
            const aWins = pctA >= 55;
            const bWins = pctB >= 55 + 1; // pctA <= 44
            const verdict = aWins ? t.vH : bWins ? t.vL
              : `${t.labelA}와 ${t.labelB}가 비교적 균형 잡혀 있어요. 어느 쪽이든 발휘할 수 있는 유연함이 강점이지만, 상황에 따라 한쪽으로 기울 수 있으니 주의하세요.`;

            return (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8e0d4', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                {/* 과제 헤더 */}
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: i === 0 ? 'linear-gradient(135deg, rgba(184,150,90,0.1), rgba(140,109,61,0.15))' : '#faf7f2' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: i === 0 ? 'linear-gradient(135deg, #B8965A, #b8965a)' : 'rgba(184,150,90,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: i === 0 ? '0 2px 6px rgba(184,150,90,0.3)' : 'none',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: i === 0 ? '#fff' : '#B8965A' }}>{i + 1}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#3D3427', flex: 1 }}>{t.labelA} vs {t.labelB}</span>
                  {i === 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#B8965A', background: 'rgba(184,150,90,0.12)', borderRadius: 6, padding: '2px 8px' }}>
                      핵심 과제
                    </span>
                  )}
                </div>

                <div className="px-4 py-3 space-y-3" style={{ background: '#fff' }}>
                  {/* VS 비율 바 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontSize: 12, fontWeight: aWins ? 800 : 500, color: aWins ? ecC.main : '#a0937f' }}>
                        {t.labelA} {pctA}%
                      </span>
                      <span style={{ fontSize: 12, fontWeight: bWins ? 800 : 500, color: bWins ? ecC.main : '#a0937f' }}>
                        {pctB}% {t.labelB}
                      </span>
                    </div>
                    <div className="flex rounded-full overflow-hidden" style={{ height: 12, background: '#e8e0d4' }}>
                      <div style={{
                        width: `${pctA}%`,
                        background: aWins
                          ? `linear-gradient(90deg, ${ecC.main}, ${ecC.main}CC)`
                          : !bWins ? `linear-gradient(90deg, #B8965A, #B8965AAA)` : '#d4cbb8',
                        transition: 'width 0.8s ease',
                        borderRight: '2px solid #fff',
                      }} />
                      <div style={{
                        width: `${pctB}%`,
                        background: bWins
                          ? `linear-gradient(90deg, ${ecC.main}CC, ${ecC.main})`
                          : !aWins ? `linear-gradient(90deg, #B8965AAA, #B8965A)` : '#d4cbb8',
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                    {/* 우세 표시 */}
                    <div className="mt-1.5">
                      {(aWins || bWins) ? (
                        <div className="flex items-center gap-1.5">
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: ecC.main }} />
                          <span style={{ fontSize: 10, color: ecC.main, fontWeight: 700 }}>
                            {aWins ? t.labelA : t.labelB} 쪽으로 기울어진 사주
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8965A' }} />
                          <span style={{ fontSize: 10, color: '#B8965A', fontWeight: 700 }}>양쪽 균형형 사주</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 사주 분석 (개인 해석) */}
                  <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #1B2A4A, #243656)' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#E8D5A8', marginBottom: 4 }}>나의 사주 분석</p>
                    <p style={{ fontSize: 12, color: '#fff', lineHeight: 1.75 }}>{verdict}</p>
                  </div>

                  {/* 실천 방법 */}
                  <div className="p-3 rounded-lg" style={{ background: '#faf7f2', border: '1px dashed #d4cbb8' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#a08b6a', marginBottom: 3 }}>실천 방법</p>
                    <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.65 }}>{t.tip}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  if (type === 'daeun_vis') {
    // 대운 흐름 도식화 — 상세풀이 섹션 안에서 렌더링
    // SectionVis는 sajuData에 직접 접근 불가 — pillars 정보로 간접 표시
    // 대운 데이터가 없어도 일간 오행별 대운 가이드를 보여줌
    const dOheng = (pillars[2]?.천간오행 ?? '토') as OhengType;
    const dElem = OHENG_TO_ELEM[dOheng];
    const ec = EC[dElem];

    const DAEUN_GUIDE: Record<OhengType, { now: string; tip: string; seasons: { elem: string; meaning: string }[] }> = {
      목: {
        now: '목 일간은 금(관성) 대운에서 가장 큰 시련과 성장을 겪고, 수(인성) 대운에서 학습과 지원을 받아요.',
        tip: '현재 대운의 오행이 나를 돕는지(인성·비겁), 도전하는지(관성·재성)를 파악하는 게 핵심이에요.',
        seasons: [
          { elem: '목 대운', meaning: '비겁 — 독립·경쟁 심화, 자아 확립기' },
          { elem: '화 대운', meaning: '식상 — 표현·창작 폭발, 재능 개화기' },
          { elem: '토 대운', meaning: '재성 — 재물 기회, 적극적 투자 시기' },
          { elem: '금 대운', meaning: '관성 — 시련과 성장, 사회적 압박기' },
          { elem: '수 대운', meaning: '인성 — 학습·귀인, 내면 충전기' },
        ],
      },
      화: {
        now: '화 일간은 수(관성) 대운에서 가장 큰 시련과 성장을 겪고, 목(인성) 대운에서 에너지를 충전받아요.',
        tip: '화 일간은 에너지 소모가 빠르므로, 대운 흐름에 따라 의식적으로 페이스 조절이 필요해요.',
        seasons: [
          { elem: '화 대운', meaning: '비겁 — 열정 배가, 경쟁·독립 강화기' },
          { elem: '토 대운', meaning: '식상 — 안정적 표현, 결과물 축적기' },
          { elem: '금 대운', meaning: '재성 — 재물 기회, 정밀한 판단 필요' },
          { elem: '수 대운', meaning: '관성 — 감정 통제 시련, 성숙기' },
          { elem: '목 대운', meaning: '인성 — 학습·성장, 에너지 보충기' },
        ],
      },
      토: {
        now: '토 일간은 목(관성) 대운에서 외부 압박이 강해지고, 화(인성) 대운에서 안정적 지원을 받아요.',
        tip: '토 일간은 변화에 느리므로, 관성·식상 대운에서 의식적으로 움직여야 정체를 피할 수 있어요.',
        seasons: [
          { elem: '토 대운', meaning: '비겁 — 안정 강화, 자기 영역 확립기' },
          { elem: '금 대운', meaning: '식상 — 표현력 향상, 정리·정돈기' },
          { elem: '수 대운', meaning: '재성 — 유동적 재물, 투자 기회기' },
          { elem: '목 대운', meaning: '관성 — 변화 압박, 성장통 시기' },
          { elem: '화 대운', meaning: '인성 — 열정 충전, 배움·귀인기' },
        ],
      },
      금: {
        now: '금 일간은 화(관성) 대운에서 가장 강한 단련을 받고, 토(인성) 대운에서 기반이 단단해져요.',
        tip: '금 일간은 완벽주의 때문에 관성 대운에서 특히 스트레스를 받아요. 유연함을 연습하세요.',
        seasons: [
          { elem: '금 대운', meaning: '비겁 — 경쟁 심화, 전문성 승부기' },
          { elem: '수 대운', meaning: '식상 — 지혜 표현, 창작·소통기' },
          { elem: '목 대운', meaning: '재성 — 재물 확장, 새 기회 포착기' },
          { elem: '화 대운', meaning: '관성 — 뜨거운 단련, 변혁·성장기' },
          { elem: '토 대운', meaning: '인성 — 안정적 학습, 기반 축적기' },
        ],
      },
      수: {
        now: '수 일간은 토(관성) 대운에서 방향이 잡히면서도 압박을 느끼고, 금(인성) 대운에서 지혜가 깊어져요.',
        tip: '수 일간은 생각이 많아 행동이 늦어지기 쉬워요. 재성·비겁 대운에서 과감하게 움직이세요.',
        seasons: [
          { elem: '수 대운', meaning: '비겁 — 유연함 극대화, 경쟁·적응기' },
          { elem: '목 대운', meaning: '식상 — 성장 에너지 분출, 창작기' },
          { elem: '화 대운', meaning: '재성 — 열정적 재물 추구, 투자기' },
          { elem: '토 대운', meaning: '관성 — 방향 설정 시련, 구조화기' },
          { elem: '금 대운', meaning: '인성 — 깊은 학습, 지혜 축적기' },
        ],
      },
    };

    const guide = DAEUN_GUIDE[dOheng] || DAEUN_GUIDE['토'];
    const SEASON_COLORS = [ec.main, '#D32F2F', '#F57F17', '#757575', '#1565C0'];

    return (
      <div className="my-4 rounded-2xl overflow-hidden" style={{ border: '1px solid #e8e0d4' }}>
        <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #1B2A4A, #243656)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#E8D5A8' }}>대운 흐름 해석 가이드</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{dOheng} 일간이 각 대운에서 겪는 에너지 변화</p>
        </div>

        <div className="p-4 space-y-3" style={{ background: '#faf7f2' }}>
          {/* 핵심 해석 */}
          <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.25)' }}>
            <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.75 }}>{guide.now}</p>
            <p style={{ fontSize: 11, color: '#a08b6a', marginTop: 6, lineHeight: 1.6 }}>{guide.tip}</p>
          </div>

          {/* 오행별 대운 의미 */}
          <p style={{ fontSize: 10, fontWeight: 700, color: '#a08b6a', marginBottom: -4 }}>오행별 대운이 나에게 주는 의미</p>
          <div className="space-y-2">
            {guide.seasons.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${SEASON_COLORS[i]}15`,
                  border: `2px solid ${SEASON_COLORS[i]}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: SEASON_COLORS[i] }}>{s.elem.charAt(0)}</span>
                </div>
                <div className="flex-1">
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#3D3427' }}>{s.elem}</span>
                  <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.5, marginTop: 1 }}>{s.meaning}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 읽기 가이드 */}
          <div className="p-2.5 rounded-lg" style={{ background: '#f5f0e8', border: '1px dashed #d4cbb8' }}>
            <p style={{ fontSize: 10, color: '#8b7e6f', lineHeight: 1.6 }}>
              위쪽 <b style={{ color: '#6b5b47' }}>대운 타임라인</b>에서 현재 대운의 오행을 확인하고, 이 가이드와 대조하면 지금 시기의 의미를 정확히 알 수 있어요.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// ─── ReportSection ───
interface SectionData {
  id: string;
  icon: string;
  title: string;
  keyInsight?: string;
  content: string;
  visual?: string;
}

function ReportSection({ section, index, elements, hasBirthTime, jijanggan, pillars, aiResult }: {
  section: SectionData;
  index: number;
  elements: V4Elements;
  hasBirthTime: boolean;
  jijanggan: JiJangGan[];
  pillars: Pillar[];
  aiResult?: any;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <LocalFadeIn delay={index * 50}>
      <div className="card overflow-hidden !p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center gap-3 p-4 text-left transition-colors duration-200 ${
            expanded ? 'bg-bg-surface' : 'bg-white'
          }`}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(184,150,90,0.1)' }}>
            <div className="w-2 h-2 rounded-full bg-brand-gold" />
          </div>
          <span className="flex-1 text-h3 text-text-primary">{section.title}</span>
          <span className={`text-brand-gold text-sm transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="px-4 pb-4"
          >
            {/* 소름 포인트 — keyInsight 골드 하이라이트 */}
            {section.keyInsight && (
              <div className="mb-4 p-3.5 rounded-xl relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(184,150,90,0.08), rgba(140,109,61,0.12))' }}>
                <div className="absolute top-0 left-0 w-1 h-full rounded-r" style={{ background: 'linear-gradient(180deg, #B8965A, #8C6D3D)' }} />
                <p className="text-body-sm font-semibold leading-relaxed pl-2.5" style={{ color: '#8B7355' }}>
                  ✦ {section.keyInsight}
                </p>
              </div>
            )}
            <div className="text-body-sm text-text-secondary whitespace-pre-line leading-relaxed">
              {stripMd(section.content)}
            </div>
            {section.visual && (
              <div className="mt-4">
                <SectionVis
                  type={section.visual}
                  elements={elements}
                  hasBirthTime={hasBirthTime}
                  jijanggan={jijanggan}
                  pillars={pillars}
                  aiResult={aiResult}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </LocalFadeIn>
  );
}


// ─── MAIN PAGE ───
export function ResultPage() {
  const { sajuData: ctxData, input: ctxInput } = useSajuContext();
  const reportId = window.location.pathname.split('/').pop() || 'local';
  const { mark: markAttendance } = useAttendanceOnResult();

  // 이벤트 v4 · 결과 렌더링 1회 출석 마커
  useEffect(() => {
    markAttendance().catch(() => {/* non-blocking */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sajuData = useMemo(() => {
    // 1. Context에 데이터 있으면 사용 (InputPage → Loading → Result 플로우)
    if (ctxData) return ctxData;
    // 2. URL의 리포트 ID로 localStorage에서 조회 (보관함에서 클릭 등)
    if (reportId && reportId !== 'local') {
      const report = getReport(reportId);
      if (report) return report.sajuData;
    }
    // 3. 내 프로필 우선, 없으면 최근 리포트
    const myProfile = getMyProfile();
    if (myProfile) return myProfile.sajuData;
    const reports = getReports();
    if (reports.length > 0) return reports[0].sajuData;
    // 4. 데모 데이터
    try { return getDemoData(); } catch { return null; }
  }, [ctxData, reportId]);

  if (!sajuData) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="사주 리포트" />
        <ErrorState
          title="데이터를 불러올 수 없어요"
          description="사주 입력 후 다시 시도해주세요"
          onRetry={() => window.location.href = '/input'}
        />
      </div>
    );
  }

  // 이름/입력: context → localStorage → 사주데이터 내장 → 기본값
  const storedReport = reportId ? getReport(reportId) : null;
  const name = ctxInput?.name || storedReport?.name || sajuData.input?.name || '사용자';
  const input = ctxInput || storedReport?.input || sajuData.input;
  const hasBirthTime = input.hasBirthTime;
  const dateStr = `${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일`;
  const genderStr = input.gender === 'male' ? '남' : '여';

  // Map data to v4 formats
  // 전통 명리학 순서: 시주→일주→월주→년주 (왼쪽→오른쪽)
  const v4Pillars = mapPillars([...sajuData.pillars].reverse(), sajuData.sipsung);
  const v4Elements = mapElements(sajuData.elements);
  const v4Unyoung = mapUnyoung12(sajuData.unyoung12, sajuData.pillars);
  const v4Daeun = mapDaeun(sajuData.daeun, input.birthYear);
  const v4Napeum = mapNapeum(sajuData.napeum);
  const v4Gilsin = mapSinSal(sajuData.gilsin);
  const v4Hyungsal = mapSinSal(sajuData.hyungsal);
  const dayOhengForGM = sajuData.pillars[2]?.천간오행 ?? '토' as OhengType;
  const v4Gongmang = mapGongmang(sajuData.gongmang, dayOhengForGM);

  // AI 결과 로드 — 저장된 리포트에서 aiResult 추출
  const aiResult = storedReport?.aiResult;

  // 점수: AI 결과 우선, 없으면 오행 기반 추정
  const scores = useMemo((): Record<string, number> => {
    if (aiResult?.scores) return aiResult.scores as Record<string, number>;
    const e = sajuData.elements;
    const total = Object.values(e).reduce((a: number, b: number) => a + b, 0) || 1;
    const balance = 1 - Math.abs(Object.values(e).reduce((max: number, v: number) => Math.max(max, v), 0) / total - 0.2) * 2;
    const base = Math.round(55 + balance * 35);
    return {
      career: Math.min(98, base + (e.금 || 0) * 3 + (e.토 || 0) * 2),
      love: Math.min(98, base + (e.화 || 0) * 3 + (e.수 || 0) * 2),
      wealth: Math.min(98, base + (e.토 || 0) * 3 + (e.금 || 0) * 2),
      social: Math.min(98, base + (e.목 || 0) * 3 + (e.화 || 0) * 2),
      health: Math.min(98, base - Math.max(0, (Object.values(e).filter(v => v === 0).length) * 8)),
      potential: Math.min(98, base + (e.수 || 0) * 3 + (e.목 || 0) * 2),
    };
  }, [sajuData, aiResult]);

  // 격국/용신 분석 기반 (AI가 반환한 analysisBase)
  const analysisBase = aiResult?.analysisBase;

  const radarData = (Object.entries(v4Elements) as [ElemKey, number][]).map(([k, v]) => ({
    subject: EKR[k].replace(/\(.*\)/, ''),
    value: v,
    fullMark: 100,
  }));

  const pillarCount = v4Pillars.length;

  // 섹션: AI 결과에서만 가져옴 (더미 데이터 없음)
  const sections: SectionData[] = useMemo(() => {
    if (aiResult?.sections?.length > 0) {
      const SECTION_VISUALS: Record<string, string> = {
        summary: 'oheng_structure', structure: '', personality: 'jijanggan',
        social: 'relationshipMap', career: 'career_fit', wealth: 'wealthFlow',
        health: 'health_oheng', luck: 'luckyProfile',
        challenge: 'challenge_vis', mission: 'challenge_vis', gaewoon: 'gaewoon',
        daeun: 'daeun_vis', daeun_flow: 'daeun_vis',
        love: '', year2026: 'monthlyFortune', luckyProfile: 'luckyProfile',
      };
      return aiResult.sections.map((s: any) => ({
        id: s.id,
        icon: '',
        title: s.title,
        keyInsight: s.keyInsight || '',
        content: s.content,
        visual: SECTION_VISUALS[s.id] || (s.id.startsWith('year') ? 'monthlyFortune' : ''),
      }));
    }
    // AI 결과 없으면 빈 배열 — 사주 원국/오행/대운 등 기본 차트만 표시
    return [];
  }, [aiResult]);

  const zodiac = sajuData.띠 ? `${sajuData.띠}띠` : '';
  const birthTimeStr = hasBirthTime && input.birthHour !== undefined
    ? `${input.birthHour}시`
    : null;

  const [showShareModal, setShowShareModal] = useState(false);

  // 최고 점수 항목 (공유 카드에 표시)
  const topScoreEntry = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
  const topScoreLabel = { career: '직업운', love: '애정운', wealth: '재물운', social: '대인운', health: '건강운', potential: '잠재력' }[topScoreEntry[0]] || '';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="사주 리포트" right={
        <button
          className="w-10 h-10 flex items-center justify-center"
          aria-label="공유"
          onClick={() => setShowShareModal(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      } />

      {/* 공유 모달 */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        name={name}
        reportId={reportId}
        topScore={{ label: topScoreLabel, score: topScoreEntry[1] }}
      />

      {/* Hero — 네이비 카드 */}
      <div className="px-5 pt-4 pb-2">
        <div className="card-navy text-center py-6">
          <span className="badge-gold text-tiny mb-3 inline-block">사주명리 분석 리포트</span>
          <h1 className="text-display text-white mt-2">{name}님의 사주</h1>
          <div className="flex flex-wrap justify-center gap-1.5 mt-2 text-label text-white/50">
            <span>{dateStr}</span><span>·</span><span>{genderStr}</span>
            {zodiac && <><span>·</span><span>{zodiac}</span></>}
            {birthTimeStr && <><span>·</span><span>{birthTimeStr}</span></>}
          </div>
        </div>
      </div>

      <div className="max-w-mobile mx-auto px-5 pb-24">
        <div className="space-y-5">

          {/* Time missing banner */}
          {!hasBirthTime && (
            <LocalFadeIn>
              <div className="card-alert-warning">
                <p className="text-h3 text-func-warning">출생시간이 입력되지 않았습니다</p>
                <p className="text-caption text-text-secondary mt-1 leading-relaxed">
                  현재 3기둥 6글자로 분석 중이에요. 출생시간을 입력하면 <b>시주(時柱)</b>가 추가되어 더 정밀한 분석이 가능합니다.
                </p>
              </div>
            </LocalFadeIn>
          )}

          {/* 사주팔자 구조 해설 */}
          <LocalFadeIn>
            <div className="card space-y-3">
              <h2 className="text-h3 text-text-primary">사주팔자(四柱八字)란?</h2>
              <p className="text-caption text-text-muted leading-relaxed">
                태어난 <b className="text-text-secondary">해·월·일·시</b>의 네 기둥(四柱), 각 기둥의 천간(위)·지지(아래) 여덟 글자(八字).
                {hasBirthTime ? ' 4기둥 8글자 완전판으로 분석합니다.' : ' 출생시간 미상으로 3기둥 6글자로 분석합니다.'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-center text-caption text-text-muted">
                <div className="p-2.5 rounded-xl bg-bg-surface">
                  <div className="text-label text-text-secondary mb-0.5">↑ 천간 天干</div>
                  <div>하늘의 기운 · 겉으로 드러나는 나</div>
                </div>
                <div className="p-2.5 rounded-xl bg-bg-surface">
                  <div className="text-label text-text-secondary mb-0.5">↓ 지지 地支</div>
                  <div>땅의 기운 · 내면에 숨겨진 나</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center text-tiny text-text-muted">
                {([
                  { t: '시주 時柱', d: '자녀·말년', hl: false, dim: !hasBirthTime },
                  { t: '일주 日柱', d: '나·배우자', hl: true, dim: false },
                  { t: '월주 月柱', d: '부모·직장', hl: false, dim: false },
                  { t: '년주 年柱', d: '조상·사회', hl: false, dim: false },
                ] as const).map((x, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg ${x.hl ? 'bg-gold-bg border-[1.5px] border-brand-gold/30' : x.dim ? 'border border-dashed border-border opacity-60' : 'bg-bg-surface'}`}
                  >
                    <div className={`text-tiny font-bold ${x.hl ? 'text-brand-gold' : 'text-text-secondary'}`}>
                      {x.t}{x.hl ? ' ★' : ''}
                    </div>
                    <div className={x.hl ? 'text-brand-gold/70' : ''}>{x.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </LocalFadeIn>

          {/* 만세력 원국 — 네이비 카드 */}
          <LocalFadeIn delay={80}>
            <div className="card-navy py-6 px-4">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-h3 text-white">만세력 원국</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(184,150,90,0.2)', color: '#E8D5A8' }}>
                  {hasBirthTime ? '4기둥 8글자' : '3기둥 6글자'}
                </span>
              </div>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${pillarCount}, 1fr)` }}>
                {v4Pillars.map((p, i) => (
                  <PillarCard key={i} p={p} index={i} total={pillarCount} />
                ))}
              </div>
              <div className="text-center mt-3 text-caption text-white/50">
                일간 <span className="text-h2 text-brand-gold-light">
                  {sajuData.pillars[2].천간}({sajuData.pillars[2].천간읽기})
                </span> = 나 자신
              </div>
            </div>
          </LocalFadeIn>

          {/* 오행 밸런스 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-3">오행 밸런스</h2>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e8e0d4" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b5b47', fontSize: 11, fontWeight: 600 }} />
                    <Radar
                      dataKey="value" stroke="#c9b99a" fill="#c9b99a" fillOpacity={0.2}
                      strokeWidth={2} dot={{ r: 3, fill: '#a08b6a', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {(Object.entries(v4Elements) as [ElemKey, number][]).map(([elem, val]) => {
                  const ecB = EC[elem];
                  return (
                    <div key={elem} className="flex items-center gap-2">
                      <span style={{ fontSize: 13 }}>{EHAN[elem]}</span>
                      <span className="text-right" style={{ width: 50, fontSize: 11, fontWeight: 700, color: ecB.dark }}>
                        {EKR[elem]}
                      </span>
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 16, background: ecB.light }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(val, 3)}%`,
                            background: `linear-gradient(90deg,${ecB.med},${ecB.main})`,
                            transition: 'width 1s',
                          }}
                        />
                      </div>
                      <span
                        className="text-right"
                        style={{ width: 32, fontSize: 11, fontWeight: 800, color: val === 0 ? '#c62828' : ecB.dark }}
                      >
                        {val === 0 ? '없음!' : val}
                      </span>
                    </div>
                  );
                })}
              </div>
              {v4Elements.water === 0 && (
                <div className="card-alert-warning mt-3">
                  <p className="text-caption text-func-warning font-semibold">
                    수(水) 에너지 완전 부재 — 개운법에서 보충 방법을 꼭 확인하세요
                  </p>
                </div>
              )}
            </div>
          </LocalFadeIn>

          {/* 격국·용신 분석 — AI 분석 결과가 있을 때만 */}
          {analysisBase && (() => {
            // ─── 격국 해석 데이터 ───
            const GYEOKGUK_INFO: Record<string, { summary: string; personality: string; good: string; caution: string }> = {
              정인격: {
                summary: '학문과 배움을 통해 성장하는 구조의 사주',
                personality: '지적 호기심이 강하고 배움에 끌리는 타입이에요. 책·강의·자격증 등 공부를 통해 안정감을 얻고, 남에게 가르치는 일에서 보람을 느끼는 구조예요.',
                good: '학습 능력이 뛰어나 전문직·교육직에 유리하고, 어머니·스승 같은 귀인이 잘 나타나요',
                caution: '생각이 많아 행동이 느려질 수 있고, 너무 안전한 길만 선택하려는 경향 주의',
              },
              편인격: {
                summary: '독특한 시각과 직관으로 승부하는 구조의 사주',
                personality: '남들과 다른 감각이 있어요. 정석보다 독학, 체계보다 직관으로 움직이며, 예술·기술·영적 분야에서 두각을 나타내는 타입이에요.',
                good: '창의력과 직관이 뛰어나 남들이 못 보는 기회를 포착할 수 있어요',
                caution: '끈기 부족과 변덕이 약점이 될 수 있어요. 한 가지에 집중하는 연습이 필요해요',
              },
              정관격: {
                summary: '규칙과 질서 속에서 안정적으로 성장하는 구조의 사주',
                personality: '책임감이 강하고 규칙을 중시해요. 조직에서 인정받으며 승진하는 정통 엘리트 코스가 잘 맞는 타입이에요. 공직·대기업·전문직과 인연이 깊어요.',
                good: '사회적 신뢰와 지위를 자연스럽게 얻는 구조. 공직·대기업에서 강점',
                caution: '지나친 원칙주의가 관계를 딱딱하게 만들 수 있어요. 유연성을 의식적으로 키우세요',
              },
              편관격: {
                summary: '강한 압박을 에너지로 전환하는 구조의 사주',
                personality: '외부 압박과 경쟁 속에서 오히려 힘을 발휘하는 타입이에요. 위기 상황에서 진가를 보이며, 리더십과 추진력이 강해요. 군인·경찰·사업가 기질이 있어요.',
                good: '위기관리 능력이 탁월하고, 강한 추진력으로 큰 성과를 낼 수 있어요',
                caution: '스트레스를 받으면 공격적이 될 수 있어요. 감정 조절과 휴식이 중요해요',
              },
              식신격: {
                summary: '창작과 표현을 통해 가치를 만드는 구조의 사주',
                personality: '무언가를 만들어내는 데 천부적 재능이 있어요. 요리·글쓰기·디자인·콘텐츠 등 창작 활동에서 행복을 느끼고, 자연스럽게 재물도 따라와요.',
                good: '창작·표현 분야에서 자연스럽게 돈이 벌리는 구조. 프리랜서·창작자에 적합',
                caution: '게으름과 안주가 적. 현재에 만족하면 성장이 멈출 수 있어요',
              },
              상관격: {
                summary: '기존 틀을 깨고 혁신하는 구조의 사주',
                personality: '권위에 도전하고 새로운 방식을 만들어내는 반골 기질이에요. 기존 질서에 답답함을 느끼고, 남들이 생각 못한 방법으로 문제를 해결하는 타입이에요.',
                good: '혁신적 아이디어로 새 시장을 개척하는 능력. 스타트업·예술·IT에 강점',
                caution: '말실수와 대인관계 충돌 주의. 특히 윗사람과의 갈등이 생기기 쉬워요',
              },
              정재격: {
                summary: '꾸준한 노력으로 안정적 부를 쌓는 구조의 사주',
                personality: '계획적이고 성실해요. 한방보다 꾸준한 축적을 선호하고, 정직한 노력이 재물로 연결되는 타입이에요. 저축과 장기 투자에 적합한 구조예요.',
                good: '안정적 수입과 자산 축적에 유리. 장기적으로 부를 이루는 구조',
                caution: '지나친 절약이 기회를 놓치게 할 수 있어요. 전략적 소비도 필요해요',
              },
              편재격: {
                summary: '기회를 포착해 큰 재물을 다루는 구조의 사주',
                personality: '투자 감각이 있고 기회를 보면 과감하게 움직이는 타입이에요. 사업·무역·투자에서 두각을 나타내며, 돈의 흐름을 읽는 감각이 남다른 구조예요.',
                good: '사업 수완이 뛰어나고, 큰 돈을 다루는 능력이 있어요. 투자·무역에 유리',
                caution: '도박성 투자와 과소비 주의. 리스크 관리를 의식적으로 해야 해요',
              },
              비견격: {
                summary: '독립적인 힘으로 자기 길을 개척하는 구조의 사주',
                personality: '자존심이 강하고 남에게 기대지 않는 타입이에요. 독립심과 경쟁심이 강하며, 혼자서도 잘 해내는 추진력이 있어요. 독립 사업이나 1인 기업에 적합해요.',
                good: '독립적으로 성취하는 능력이 탁월. 창업·프리랜서에서 강점',
                caution: '고집과 타협 부족이 약점. 협력하면 더 큰 성과를 낼 수 있어요',
              },
              겁재격: {
                summary: '승부욕과 경쟁에서 힘을 발휘하는 구조의 사주',
                personality: '지기 싫어하는 성격이에요. 경쟁 상황에서 폭발적인 에너지를 보이며, 위기를 기회로 바꾸는 힘이 있어요. 영업·스포츠·투자 분야와 인연이 깊어요.',
                good: '위기 상황에서 오히려 강해지는 구조. 경쟁이 치열한 분야에서 두각',
                caution: '재물 손실과 인간관계 충돌 주의. 욕심을 조절하는 것이 핵심 과제',
              },
              건록격: {
                summary: '본인의 힘이 충만해 자립형으로 성공하는 구조의 사주',
                personality: '에너지가 넘치고 자기 확신이 강한 타입이에요. 남에게 의존하지 않고 자기 힘으로 일어서며, 실행력이 뛰어나요.',
                good: '자수성가형. 본인 역량으로 안정적 성공을 이루는 구조',
                caution: '독선적이 되기 쉬움. 다른 사람 의견을 듣는 열린 태도가 중요',
              },
              양인격: {
                summary: '강렬한 에너지를 어떻게 쓰느냐가 인생을 결정하는 구조의 사주',
                personality: '에너지가 매우 강하고 카리스마가 있어요. 잘 쓰면 리더, 잘못 쓰면 갈등의 원인이 되는 양날의 검 같은 구조예요.',
                good: '강한 리더십과 결단력. 군인·경찰·외과의·사업가로 대성할 수 있어요',
                caution: '분노 조절이 최대 과제. 에너지를 운동이나 사업으로 승화시키세요',
              },
            };

            // 오행 해석 데이터
            const OHENG_MEANING: Record<string, { name: string; symbol: string; nature: string; color: string; season: string; direction: string; goodWith: string; lifestyle: string }> = {
              목: { name: '목(木)', symbol: '木', nature: '성장·생명·인자함', color: '#2D8A4E', season: '봄', direction: '동쪽', goodWith: '녹색 식물, 나무 소품, 동쪽 배치', lifestyle: '아침 산책, 녹색 채소, 원목 가구 활용' },
              화: { name: '화(火)', symbol: '火', nature: '열정·표현·예의', color: '#D32F2F', season: '여름', direction: '남쪽', goodWith: '붉은색 포인트, 밝은 조명, 남향 생활', lifestyle: '유산소 운동, 매운맛 음식, 사교 활동' },
              토: { name: '토(土)', symbol: '土', nature: '안정·포용·신뢰', color: '#F57F17', season: '환절기', direction: '중앙', goodWith: '황토색 소품, 도자기, 안정적 공간', lifestyle: '규칙적 생활, 잡곡밥, 명상·산책' },
              금: { name: '금(金)', symbol: '金', nature: '결단·정의·절제', color: '#757575', season: '가을', direction: '서쪽', goodWith: '금속 소품, 흰색 인테리어, 서쪽 배치', lifestyle: '호흡 운동, 현미·배, 미니멀 정리' },
              수: { name: '수(水)', symbol: '水', nature: '지혜·유연·적응', color: '#1565C0', season: '겨울', direction: '북쪽', goodWith: '물 관련 소품, 검은색 포인트, 수족관', lifestyle: '수영·반신욕, 해산물·검은콩, 독서·명상' },
            };

            // 신강/신약 해석
            const gangYakDetail: Record<string, { meaning: string; good: string; caution: string; strategy: string }> = {
              신강: {
                meaning: '일간(나)의 힘이 사주에서 강한 위치에 있어요. 주변 환경보다 내 에너지가 더 세서, 스스로 길을 개척하는 주도형 사주예요.',
                good: '자기 주장이 뚜렷하고 추진력이 강해요. 리더십·독립 사업·자기 브랜드에 유리해요',
                caution: '남의 말을 안 듣는 고집, 무리한 확장, 건강 과신이 약점이에요',
                strategy: '용신(부족한 오행)을 채워 에너지를 분산시키고, 협력자를 두는 것이 핵심이에요',
              },
              신약: {
                meaning: '일간(나)의 힘이 사주에서 약한 편이에요. 주변 환경의 영향을 많이 받지만, 그만큼 적응력과 관찰력이 뛰어난 구조예요.',
                good: '눈치가 빠르고 겸손해서 귀인이 잘 나타나요. 팀워크·조직·파트너십에 유리해요',
                caution: '우유부단함, 자신감 부족, 남 눈치 보기가 약점이에요',
                strategy: '용신(나를 도와주는 오행)을 보강해 자신감과 에너지를 높이는 것이 핵심이에요',
              },
              중화: {
                meaning: '일간(나)의 힘이 적절히 균형 잡혀 있어요. 상황에 따라 유연하게 대처하는 능력이 있는 이상적 구조예요.',
                good: '유연성이 높아 다양한 환경에 적응 가능. 치우침 없이 안정적 인생을 살 수 있어요',
                caution: '특출난 강점이 없어 보일 수 있어요. 의식적으로 전문 분야를 정해 깊이 파는 것이 중요',
                strategy: '용신으로 약간의 에너지 보정을 하면 더 큰 성과를 낼 수 있어요',
              },
            };

            const gyeokInfo = GYEOKGUK_INFO[analysisBase.격국];
            const gangYak = gangYakDetail[analysisBase.일간강약] || gangYakDetail['중화'];
            const yongOheng = OHENG_MEANING[analysisBase.용신];
            const huiOheng = analysisBase.희신 ? OHENG_MEANING[analysisBase.희신] : null;
            const giOheng = analysisBase.기신 ? OHENG_MEANING[analysisBase.기신] : null;
            const gangYakColor = analysisBase.일간강약 === '신강' ? '#D32F2F' : analysisBase.일간강약 === '신약' ? '#1565C0' : '#F57F17';

            return (
            <LocalFadeIn delay={80}>
              <div className="card py-5 px-4">
                <h2 className="text-h3 text-text-primary mb-1">격국·용신 분석</h2>
                <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12, lineHeight: 1.6 }}>
                  사주의 구조(격국)를 파악하고, 균형을 맞춰줄 핵심 오행(용신)을 도출했어요. 아래 분석이 개운법·직업·건강의 근거가 됩니다.
                </p>

                {/* ────── 1. 격국 ────── */}
                <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid #e8e0d4' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(135deg, #f8f5ef, #f0ebe3)' }}>
                    <div>
                      <p style={{ fontSize: 10, color: '#a0937f', fontWeight: 600 }}>격국 — 사주의 구조 유형</p>
                      <p style={{ fontSize: 20, fontWeight: 900, color: '#3D3427', marginTop: 2 }}>{analysisBase.격국}</p>
                    </div>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #1B2A4A, #243656)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, color: '#E8D5A8', fontWeight: 800 }}>格</span>
                    </div>
                  </div>
                  {gyeokInfo ? (
                    <div className="px-4 py-3 space-y-2.5" style={{ background: '#fff' }}>
                      <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7, fontWeight: 600 }}>{gyeokInfo.summary}</p>
                      <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.75 }}>{gyeokInfo.personality}</p>
                      <div className="flex gap-2">
                        <div className="flex-1 p-2.5 rounded-lg" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#2e7d32', marginBottom: 2 }}>이런 점이 좋아요</p>
                          <p style={{ fontSize: 10, color: '#2e7d32', lineHeight: 1.6 }}>{gyeokInfo.good}</p>
                        </div>
                        <div className="flex-1 p-2.5 rounded-lg" style={{ background: '#fff3e0', border: '1px solid #ffe0b2' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#e65100', marginBottom: 2 }}>주의할 점</p>
                          <p style={{ fontSize: 10, color: '#e65100', lineHeight: 1.6 }}>{gyeokInfo.caution}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-3" style={{ background: '#fff' }}>
                      <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.7 }}>
                        {analysisBase.격국} 구조의 사주예요. 사주의 핵심 에너지 흐름을 결정하는 구조로, 아래 용신과 함께 해석하면 전체 그림이 보여요.
                      </p>
                    </div>
                  )}
                </div>

                {/* ────── 2. 일간 강약 ────── */}
                <div className="rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${gangYakColor}25` }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: `${gangYakColor}08` }}>
                    <div>
                      <p style={{ fontSize: 10, color: '#a0937f', fontWeight: 600 }}>일간 강약 — 나의 에너지 세기</p>
                      <p style={{ fontSize: 20, fontWeight: 900, color: gangYakColor, marginTop: 2 }}>{analysisBase.일간강약}</p>
                    </div>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${gangYakColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, color: gangYakColor, fontWeight: 800 }}>力</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2.5" style={{ background: '#fff' }}>
                    <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.75 }}>{gangYak.meaning}</p>
                    <div className="flex gap-2">
                      <div className="flex-1 p-2.5 rounded-lg" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#2e7d32', marginBottom: 2 }}>강점</p>
                        <p style={{ fontSize: 10, color: '#2e7d32', lineHeight: 1.6 }}>{gangYak.good}</p>
                      </div>
                      <div className="flex-1 p-2.5 rounded-lg" style={{ background: '#fff3e0', border: '1px solid #ffe0b2' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#e65100', marginBottom: 2 }}>약점</p>
                        <p style={{ fontSize: 10, color: '#e65100', lineHeight: 1.6 }}>{gangYak.caution}</p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg" style={{ background: '#f5f0e8', border: '1px dashed #d4cbb8' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#a08b6a', marginBottom: 2 }}>대응 전략</p>
                      <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.6 }}>{gangYak.strategy}</p>
                    </div>
                  </div>
                </div>

                {/* ────── 3. 용신 ────── */}
                <div className="rounded-xl overflow-hidden mb-3" style={{ border: '2px solid rgba(184,150,90,0.3)', boxShadow: '0 2px 12px rgba(184,150,90,0.1)' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(135deg, rgba(184,150,90,0.1), rgba(140,109,61,0.15))' }}>
                    <div>
                      <p style={{ fontSize: 10, color: '#a08b6a', fontWeight: 600 }}>용신 — 사주 균형의 열쇠</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p style={{ fontSize: 22, fontWeight: 900, color: yongOheng?.color || '#B8965A' }}>{analysisBase.용신}</p>
                        {yongOheng && <span style={{ fontSize: 11, color: '#8b7e6f' }}>{yongOheng.nature}</span>}
                      </div>
                    </div>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #B8965A, #b8965a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(184,150,90,0.3)' }}>
                      <span style={{ fontSize: 18, color: '#fff', fontWeight: 800 }}>神</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-3" style={{ background: '#fff' }}>
                    {/* 용신 = 뭐가 좋다는 거야? 해석 */}
                    <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #f5f0e8, #ede5d5)', border: '1px solid rgba(184,150,90,0.2)' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#a08b6a', marginBottom: 4 }}>이게 뭔 뜻이에요?</p>
                      <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.75 }}>
                        당신의 사주에는 <b style={{ color: yongOheng?.color || '#B8965A' }}>{analysisBase.용신}({yongOheng?.name || analysisBase.용신})</b> 에너지가 가장 필요해요.
                        {analysisBase.일간강약 === '신강'
                          ? ` ${analysisBase.일간강약}(에너지 과잉) 사주이기 때문에, ${analysisBase.용신} 에너지로 넘치는 힘을 적절히 분산시켜야 균형이 잡혀요.`
                          : analysisBase.일간강약 === '신약'
                            ? ` ${analysisBase.일간강약}(에너지 부족) 사주이기 때문에, ${analysisBase.용신} 에너지가 나를 도와주고 힘을 채워줘요.`
                            : ` ${analysisBase.용신} 에너지를 보충하면 사주의 균형이 더 완성돼요.`
                        }
                      </p>
                    </div>

                    {/* 용신근거 */}
                    {analysisBase.용신근거 && (
                      <div className="p-2.5 rounded-lg" style={{ background: '#faf7f2', border: '1px dashed #d4cbb8' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#a08b6a', marginBottom: 2 }}>산출 근거</p>
                        <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.7 }}>{analysisBase.용신근거}</p>
                      </div>
                    )}

                    {/* 실생활 활용법 */}
                    {yongOheng && (
                      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${yongOheng.color}25` }}>
                        <div className="px-3 py-2" style={{ background: `${yongOheng.color}08` }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: yongOheng.color }}>
                            {analysisBase.용신}({yongOheng.name}) 에너지 보충법 — 이렇게 활용하세요
                          </p>
                        </div>
                        <div className="px-3 py-2.5 space-y-1.5" style={{ background: '#fff' }}>
                          <div className="flex items-start gap-2">
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a0937f', width: 40, flexShrink: 0 }}>방위</span>
                            <span style={{ fontSize: 11, color: '#6b5b47' }}>{yongOheng.direction} 방향이 유리 — 책상·침대를 {yongOheng.direction}으로 배치</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a0937f', width: 40, flexShrink: 0 }}>계절</span>
                            <span style={{ fontSize: 11, color: '#6b5b47' }}>{yongOheng.season}에 운이 상승, 중요한 일은 이 시기에</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a0937f', width: 40, flexShrink: 0 }}>소품</span>
                            <span style={{ fontSize: 11, color: '#6b5b47' }}>{yongOheng.goodWith}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a0937f', width: 40, flexShrink: 0 }}>생활</span>
                            <span style={{ fontSize: 11, color: '#6b5b47' }}>{yongOheng.lifestyle}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ────── 4. 희신·기신 ────── */}
                {(analysisBase.희신 || analysisBase.기신) && (
                  <div className="flex gap-2 mb-3">
                    {analysisBase.희신 && (
                      <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #c8e6c9' }}>
                        <div className="px-3 py-2" style={{ background: '#e8f5e9' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#2e7d32' }}>희신 — 용신을 돕는 오행</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span style={{ fontSize: 18, fontWeight: 900, color: huiOheng?.color || '#2D8A4E' }}>{analysisBase.희신}</span>
                            {huiOheng && <span style={{ fontSize: 9, color: '#4caf50' }}>{huiOheng.nature}</span>}
                          </div>
                        </div>
                        <div className="px-3 py-2" style={{ background: '#fff' }}>
                          <p style={{ fontSize: 10, color: '#2e7d32', lineHeight: 1.6 }}>
                            용신({analysisBase.용신})을 옆에서 돕는 오행이에요. {analysisBase.희신} 에너지가 많은 환경에 있으면 용신의 효과가 배가돼요.
                          </p>
                        </div>
                      </div>
                    )}
                    {analysisBase.기신 && (
                      <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #ffcdd2' }}>
                        <div className="px-3 py-2" style={{ background: '#ffebee' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#c62828' }}>기신 — 균형을 깨는 오행</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span style={{ fontSize: 18, fontWeight: 900, color: giOheng?.color || '#D32F2F' }}>{analysisBase.기신}</span>
                            {giOheng && <span style={{ fontSize: 9, color: '#ef5350' }}>{giOheng.nature}</span>}
                          </div>
                        </div>
                        <div className="px-3 py-2" style={{ background: '#fff' }}>
                          <p style={{ fontSize: 10, color: '#c62828', lineHeight: 1.6 }}>
                            사주 균형을 무너뜨리는 오행이에요. {analysisBase.기신} 에너지가 과하면 건강·재물·관계에 부정적 영향이 생길 수 있어요.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ────── 5. 종합 요약 — "그래서 나는?" ────── */}
                <div className="p-3.5 rounded-xl" style={{ background: 'linear-gradient(135deg, #1B2A4A, #243656)', boxShadow: '0 2px 12px rgba(27,42,74,0.15)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#E8D5A8', marginBottom: 6 }}>한 줄 요약 — 그래서 나는?</p>
                  <p style={{ fontSize: 12, color: '#fff', lineHeight: 1.8 }}>
                    {gyeokInfo
                      ? `${analysisBase.격국} + ${analysisBase.일간강약} = ${gyeokInfo.summary.replace('구조의 사주', '')}사주이며, `
                      : `${analysisBase.격국} 구조의 사주이며, `
                    }
                    <b style={{ color: '#E8D5A8' }}>{analysisBase.용신}({yongOheng?.name || analysisBase.용신})</b> 에너지를 보충하면 부족한 부분이 채워져요.
                    {analysisBase.희신 && <> <span style={{ color: '#a5d6a7' }}>{analysisBase.희신}(희신)</span>은 나를 돕고,</>}
                    {analysisBase.기신 && <> <span style={{ color: '#ef9a9a' }}>{analysisBase.기신}(기신)</span>은 조심해야 해요.</>}
                    {yongOheng && <> 일상에서 <b style={{ color: '#E8D5A8' }}>{yongOheng.direction} 방향, {yongOheng.season}철, {yongOheng.lifestyle.split(',')[0]}</b>을 의식하면 운이 좋아져요.</>}
                  </p>
                </div>
              </div>
            </LocalFadeIn>
            );
          })()}

          {/* 12운성 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">12운성 — 에너지 상태</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12, lineHeight: 1.6 }}>
                인생 각 영역의 에너지 강도를 보여줘요. <span style={{ color: '#27ae60', fontWeight: 700 }}>높을수록 활발</span>하고, <span style={{ color: '#e74c3c', fontWeight: 700 }}>낮을수록 내면에 집중</span>하는 에너지예요.
              </p>

              {/* 종합 해석 */}
              <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.2)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#B8965A', marginBottom: 4 }}>종합 해석</p>
                <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7 }}>{getUnyoungSummary(v4Unyoung)}</p>
              </div>

              {/* 에너지 레벨 한눈에 */}
              <div className="mb-4 p-3 rounded-xl" style={{ background: '#faf7f2' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#8b7e6f', marginBottom: 8 }}>에너지 한눈에 보기</p>
                <div className="space-y-2.5">
                  {v4Unyoung.map((u, i) => {
                    const level = getUnyoungEnergyLevel(u.kr);
                    const posCtx = getUnyoungPositionContext(u.pillar);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span style={{ minWidth: 70, fontSize: 11, color: '#6b5b47', fontWeight: 600 }}>{posCtx}</span>
                        <div className="flex gap-0.5 flex-1">
                          {[1,2,3,4,5].map(n => (
                            <div key={n} className="h-2.5 rounded-sm flex-1" style={{ background: n <= level ? u.color : '#e8e0d4', maxWidth: 28 }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: u.color, minWidth: 28 }}>{u.kr}</span>
                        {u.pillar.includes('일지') && <span style={{ fontSize: 9, color: '#B8965A', fontWeight: 800 }}>핵심</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 상세 카드 */}
              <div className="space-y-2">
                {v4Unyoung.map((u, i) => {
                  const level = getUnyoungEnergyLevel(u.kr);
                  const bgColor = level >= 4 ? '#e8f5e9' : level <= 1 ? '#fce4ec' : '#fff3e0';
                  const borderColor = level >= 4 ? '#a5d6a7' : level <= 1 ? '#f8bbd0' : '#ffe0b2';
                  const posCtx = getUnyoungPositionContext(u.pillar);
                  return (
                    <div key={i} className="p-3 rounded-xl" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                      <div className="flex items-center gap-3 mb-1.5">
                        <div className="text-center" style={{ minWidth: 44 }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: u.color }}>{u.value}</div>
                          <div style={{ fontSize: 10, color: u.color + '99' }}>{u.kr}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#6b5b47' }}>{u.pillar}</span>
                          </div>
                          <span style={{ fontSize: 10, color: '#a0937f', fontWeight: 600 }}>{posCtx} 영역</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.7, paddingLeft: 2 }}>{u.meaning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </LocalFadeIn>

          {/* 운세 종합 점수 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-3">운세 종합 점수</h2>
              <div className="grid grid-cols-3 gap-2">
                <ScoreRing label="직업운" score={scores.career} color="#2563eb" topicId="career" />
                <ScoreRing label="애정운" score={scores.love} color="#db2777" delay={100} topicId="love" />
                <ScoreRing label="재물운" score={scores.wealth} color="#d97706" delay={200} topicId="wealth" />
                <ScoreRing label="대인운" score={scores.social} color="#7c3aed" delay={300} topicId="social" />
                <ScoreRing label="건강운" score={scores.health} color="#059669" delay={400} topicId="health" />
                <ScoreRing label="잠재력" score={scores.potential} color="#ea580c" delay={500} />
              </div>
              {/* 점수 해석 가이드 */}
              <div className="mt-4 pt-3 border-t border-border-light">
                {(() => {
                  const best = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
                  const worst = Object.entries(scores).reduce((a, b) => a[1] < b[1] ? a : b);
                  const labels: Record<string, string> = { career: '직업운', love: '애정운', wealth: '재물운', social: '대인운', health: '건강운', potential: '잠재력' };
                  return (
                    <div className="space-y-1.5">
                      <p style={{ fontSize: 12, color: '#2E7D32', fontWeight: 600 }}>
                        가장 강한 운: {labels[best[0]]} ({best[1]}점) — 이 영역에서 타고난 재능이 빛나요
                      </p>
                      <p style={{ fontSize: 12, color: '#D32F2F', fontWeight: 600 }}>
                        보완이 필요한 운: {labels[worst[0]]} ({worst[1]}점) — 의식적인 노력이 도움돼요
                      </p>
                      <p style={{ fontSize: 11, color: '#8b7e6f' }}>
                        점수는 사주 원국의 오행 분포와 십성 관계를 기반으로 산출했어요
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </LocalFadeIn>

          {/* 대운 흐름 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">대운 흐름</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12 }}>10년 단위로 바뀌는 운의 큰 흐름이에요. <span style={{ fontWeight: 700, color: '#B8965A' }}>현재 대운</span>이 강조되어 있어요.</p>

              {/* 현재 대운 해석 */}
              {getDaeunCurrentSummary(v4Daeun) && (
                <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.2)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#B8965A', marginBottom: 4 }}>지금 이 시기의 의미</p>
                  <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{getDaeunCurrentSummary(v4Daeun)}</p>
                </div>
              )}

              {/* ═══ 대운 타임라인 시각화 (업그레이드) ═══ */}
              <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #e8e0d4', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div className="px-4 py-2.5" style={{ background: 'linear-gradient(135deg, #1B2A4A, #243656)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#E8D5A8', letterSpacing: '0.5px' }}>인생 대운 타임라인</p>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>10년 단위 운의 큰 흐름 — 오행별 색상 구분</p>
                </div>
                <div className="p-3" style={{ background: '#faf7f2' }}>
                  {/* 메인 바 차트 */}
                  <div className="flex gap-1 mb-1" style={{ height: 56 }}>
                    {v4Daeun.map((d, i) => {
                      const barEc = EC[d.elem];
                      return (
                        <div key={i} className="flex-1 relative overflow-hidden" style={{
                          borderRadius: d.current ? 8 : 5,
                          background: d.current
                            ? `linear-gradient(180deg, ${barEc.main}, ${barEc.dark})`
                            : `linear-gradient(180deg, ${barEc.light}, ${barEc.med}44)`,
                          border: d.current ? `2.5px solid ${barEc.main}` : `1px solid ${barEc.med}88`,
                          boxShadow: d.current ? `0 3px 12px ${barEc.main}40` : 'none',
                          transform: d.current ? 'scaleY(1.08)' : 'scaleY(1)',
                          transformOrigin: 'bottom',
                          transition: 'all 0.3s ease',
                        }}>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span style={{ fontSize: d.current ? 13 : 10, fontWeight: 900, color: d.current ? '#fff' : barEc.dark }}>
                              {d.gz}
                            </span>
                            <span style={{ fontSize: d.current ? 8 : 7, color: d.current ? 'rgba(255,255,255,0.8)' : barEc.main, fontWeight: 600, marginTop: 1 }}>
                              {d.kr}
                            </span>
                            {d.current && (
                              <span style={{ fontSize: 7, fontWeight: 800, color: '#E8D5A8', background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '0 4px', marginTop: 2 }}>NOW</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* 나이·시기 라벨 */}
                  <div className="flex gap-1">
                    {v4Daeun.map((d, i) => (
                      <div key={i} className="flex-1 text-center">
                        <span style={{
                          fontSize: 9,
                          color: d.current ? EC[d.elem].main : '#a0937f',
                          fontWeight: d.current ? 800 : 400,
                        }}>
                          {d.age}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* 라벨 (학업기, 현재, ...) */}
                  <div className="flex gap-1 mt-0.5">
                    {v4Daeun.map((d, i) => (
                      <div key={i} className="flex-1 text-center">
                        <span style={{
                          fontSize: 8,
                          color: d.current ? EC[d.elem].dark : '#c9b99a',
                          fontWeight: d.current ? 700 : 400,
                        }}>
                          {d.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 오행 범례 + 읽기 안내 */}
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#f5f0e8', borderTop: '1px solid #e8e0d4' }}>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {(['wood', 'fire', 'earth', 'metal', 'water'] as const).map(elem => (
                      <div key={elem} className="flex items-center gap-1">
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: EC[elem].main }} />
                        <span style={{ fontSize: 9, color: '#8b7e6f', fontWeight: 500 }}>{EKR[elem]}</span>
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 8, color: '#c9b99a' }}>오행별 색상</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {v4Daeun.map((d, i) => {
                  const ec = EC[d.elem];
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl"
                      style={{
                        padding: '10px 12px',
                        background: d.current ? ec.light : '#faf7f2',
                        border: d.current ? `2px solid ${ec.main}` : '1px solid #e8e0d4',
                        boxShadow: d.current ? `0 2px 10px ${ec.main}18` : 'none',
                      }}
                    >
                      <div className="text-center" style={{ minWidth: 50 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: ec.dark }}>{d.gz}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: ec.main }}>{d.kr}</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47' }}>{d.age}</span>
                          {d.current && (
                            <span
                              className="rounded text-white"
                              style={{ padding: '1px 6px', background: ec.main, fontSize: 9, fontWeight: 800 }}
                            >
                              현재
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#a0937f' }}>{d.period} · {d.label}</div>
                      </div>
                      <span style={{ fontSize: 16 }}>{EHAN[d.elem]}</span>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const cur = v4Daeun.find(d => d.current);
                if (!cur) return null;
                const curEc = EC[cur.elem];
                return (
                  <div className="mt-3 p-3 rounded-xl" style={{ background: `${curEc.main}08`, border: `1px solid ${curEc.main}30` }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: curEc.dark }}>
                      현재 {cur.gz}({cur.kr}) 대운 — {EKR[cur.elem]} 에너지 시기
                    </p>
                    <p style={{ fontSize: 10, color: '#8b7e6f', marginTop: 2 }}>
                      {cur.label} ({cur.period})에 해당하는 시기로, {EKR[cur.elem]} 오행의 영향을 크게 받고 있어요.
                    </p>
                  </div>
                );
              })()}
              {/* 이렇게 읽어요 */}
              <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3949ab', marginBottom: 3 }}>이렇게 읽어요</p>
                <p style={{ fontSize: 10, color: '#5c6bc0', lineHeight: 1.6 }}>
                  대운은 인생의 큰 계절이에요. 봄(목)→여름(화)→환절기(토)→가을(금)→겨울(수)처럼, 각 시기에 맞는 전략이 달라요. 현재 대운의 오행이 나에게 어떤 영향을 주는지가 핵심이에요.
                </p>
              </div>
            </div>
          </LocalFadeIn>

          {/* 납음 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">납음 — 근본 에너지</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12 }}>
                사주의 가장 깊은 곳에 있는 근본 에너지예요. 각 기둥마다 고유한 에너지가 있고, <span style={{ fontWeight: 700, color: '#B8965A' }}>일주 납음이 가장 중요</span>해요.
              </p>

              {/* 종합 해석 */}
              <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.2)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#B8965A', marginBottom: 4 }}>종합 해석</p>
                <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{getNapeumSummary(v4Napeum)}</p>
              </div>

              <div className="space-y-2">
                {v4Napeum.map((n, i) => {
                  const isIlju = n.pillar === '일주';
                  return (
                    <div key={i} className="p-3 rounded-xl" style={{
                      background: isIlju ? '#FFF8E1' : '#faf7f2',
                      border: isIlju ? '2px solid #B8965A' : '1px solid #e8e0d4',
                    }}>
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 24 }}>{n.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#6b5b47' }}>{n.hanja}</span>
                            <span style={{ fontSize: 11, color: '#a0937f', fontWeight: 600 }}>{n.kr}</span>
                            <span className="rounded" style={{ padding: '2px 8px', background: isIlju ? '#B8965A' : '#B8965A20', color: isIlju ? '#fff' : '#B8965A', fontSize: 10, fontWeight: 700 }}>
                              {n.pillar}{isIlju ? ' ← 핵심' : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: '#a0937f', marginTop: 2 }}>{getNapeumPositionRole(n.pillar)}</div>
                          <div style={{ fontSize: 12, color: '#6b5b47', marginTop: 4, fontWeight: 500, lineHeight: 1.5 }}>{n.desc}</div>
                          <div style={{ fontSize: 11, color: isIlju ? '#8d6e00' : '#5c6bc0', marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${isIlju ? '#B8965A80' : '#e0e0e0'}`, lineHeight: 1.6 }}>
                            <span style={{ fontWeight: 700 }}>실생활:</span> {getNapeumPracticalTip(n.hanja)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 이렇게 읽어요 */}
              <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3949ab', marginBottom: 3 }}>이렇게 읽어요</p>
                <p style={{ fontSize: 10, color: '#5c6bc0', lineHeight: 1.6 }}>
                  납음은 당신의 '기본 성격 모드'예요. 일주 납음이 가장 중요 — 평소 자연스럽게 행동하는 방식이에요. 예를 들어 '역참의 넓은 땅'이면 사람을 모으고 연결하는 게 자연스러운 사람이에요. 이 성질을 살리는 방향으로 살면 인생이 편해져요.
                </p>
              </div>
            </div>
          </LocalFadeIn>

          {/* 신살 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">신살 — 타고난 별</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 4 }}>
                사주에 타고난 특별한 에너지예요. <span style={{ color: '#2e7d32', fontWeight: 700 }}>길신</span>은 타고난 재능과 행운, <span style={{ color: '#e65100', fontWeight: 700 }}>흉살</span>은 주의하면 오히려 강점으로 바뀌는 에너지예요.
              </p>
              <p style={{ fontSize: 10, color: '#a0937f', marginBottom: 12 }}>
                아래 신살은 <b style={{ color: '#6b5b47' }}>일주(日柱)</b> 기준으로 추출한 것으로, 본인의 핵심 성향에 직접 영향을 줍니다.
              </p>

              {/* 요약 뱃지 */}
              <div className="flex items-center gap-2 mb-4">
                <span className="rounded-full px-2.5 py-1" style={{ background: '#e8f5e9', fontSize: 10, fontWeight: 700, color: '#2e7d32' }}>
                  길신 {v4Gilsin.length}개
                </span>
                <span className="rounded-full px-2.5 py-1" style={{ background: '#fff3e0', fontSize: 10, fontWeight: 700, color: '#e65100' }}>
                  흉살 {v4Hyungsal.length}개
                </span>
                <span className="rounded-full px-2.5 py-1" style={{ background: '#f5f5f5', fontSize: 10, fontWeight: 600, color: '#757575' }}>
                  일주 기준
                </span>
              </div>

              <div className="mb-4">
                <div className="text-label text-func-success mb-2">길신 — 타고난 재능</div>
                <div className="space-y-2">
                  {v4Gilsin.map((g, i) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#2e7d32' }}>{g.hanja}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>{g.kr}</span>
                        <span className="rounded" style={{ padding: '1px 6px', background: '#c8e6c9', color: '#1b5e20', fontSize: 9, fontWeight: 700 }}>
                          {g.source}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#2e7d32', lineHeight: 1.6, fontWeight: 500, marginBottom: 4 }}>
                        {g.desc}
                      </p>
                      <p style={{ fontSize: 10, color: '#1b5e20', lineHeight: 1.5, paddingTop: 4, borderTop: '1px dashed #a5d6a740' }}>
                        <b>실전 활용:</b> {getGilsinActionTip(g.hanja)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-label text-func-warning mb-2">흉살 — 주의하면 강점</div>
                <div className="space-y-2">
                  {v4Hyungsal.map((h, i) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: '#fff3e0', border: '1px solid #ffe0b2' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#e65100' }}>{h.hanja}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#e65100' }}>{h.kr}</span>
                        <span className="rounded" style={{ padding: '1px 6px', background: '#ffe0b2', color: '#bf360c', fontSize: 9, fontWeight: 700 }}>
                          {h.source}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#e65100', lineHeight: 1.6, fontWeight: 500, marginBottom: 4 }}>
                        {h.desc}
                      </p>
                      <p style={{ fontSize: 10, color: '#bf360c', lineHeight: 1.5, paddingTop: 4, borderTop: '1px dashed #ffcc8040' }}>
                        <b>대처법:</b> {getHyungsalActionTip(h.hanja)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {/* 이렇게 읽어요 */}
              <div className="mt-4 p-2.5 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3949ab', marginBottom: 3 }}>이렇게 읽어요</p>
                <p style={{ fontSize: 10, color: '#5c6bc0', lineHeight: 1.6 }}>
                  길신이 많다 = 행운의 기회가 많다. 흉살이 있다 = 나쁜 게 아니라 '조심해야 할 포인트'예요. 흉살을 의식하고 대비하면 오히려 남들보다 강한 사람이 돼요. 신살은 바꿀 수 없지만, 활용 방법은 내가 선택할 수 있어요.
                </p>
              </div>
            </div>
          </LocalFadeIn>

          {/* 공망 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">공망 — 비어있는 에너지</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12 }}>
                공망은 사주에서 '비어있는 자리'예요. 나쁜 게 아니라, <span style={{ fontWeight: 700, color: '#6a1b9a' }}>집착을 내려놓으면 오히려 자유롭고 창의적인 영역</span>이 돼요.
              </p>
              <div className="space-y-3">
                {v4Gongmang.map((g, i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e1bee7' }}>
                    {/* 헤더 */}
                    <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'linear-gradient(135deg, #f3e5f5, #ede0f5)' }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#6a1b9a' }}>{g.value}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#6a1b9a' }}>{g.kr}</span>
                          <span className="rounded-full" style={{ padding: '1px 8px', background: '#e1bee7', color: '#6a1b9a', fontSize: 9, fontWeight: 700 }}>
                            {g.basis}
                          </span>
                          {g.category && (
                            <span className="rounded-full" style={{ padding: '1px 8px', background: '#6a1b9a', color: '#fff', fontSize: 9, fontWeight: 700 }}>
                              {g.category} 영역
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* 내용 */}
                    <div className="px-4 py-3 space-y-2" style={{ background: '#faf5ff' }}>
                      <p style={{ fontSize: 12, color: '#4a148c', lineHeight: 1.7, fontWeight: 500 }}>
                        {g.meaning}
                      </p>
                      <div className="p-2.5 rounded-lg" style={{ background: '#f3e5f5', border: '1px dashed #ce93d8' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#7b1fa2', marginBottom: 2 }}>실전 활용</p>
                        <p style={{ fontSize: 11, color: '#6a1b9a', lineHeight: 1.6 }}>
                          {g.tip}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* 이렇게 읽어요 */}
              <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3949ab', marginBottom: 3 }}>이렇게 읽어요</p>
                <p style={{ fontSize: 10, color: '#5c6bc0', lineHeight: 1.6 }}>
                  공망의 영역은 사주의 일간({sajuData.pillars[2]?.천간읽기} 일간)과 공망 지지의 오행 관계로 결정돼요. 예를 들어 재성 공망이면 '돈에 집착할수록 도망감', 관성 공망이면 '조직보다 자유로운 경로가 유리' — 비어있는 영역이기에 오히려 남들과 다른 강점이 돼요.
                </p>
              </div>
            </div>
          </LocalFadeIn>

          {/* (인생과제는 상세풀이 섹션 challenge_vis로 통합됨) */}

          {/* 상세 풀이 */}
          <div>
            <div className="flex items-center gap-2 px-1 mb-3">
              <div className="w-5 h-px bg-brand-gold" />
              <h2 className="text-h3 text-text-primary">상세 풀이 · 12섹션</h2>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2.5">
              {sections.map((s, i) => (
                <ReportSection
                  key={s.id}
                  section={s}
                  index={i}
                  elements={v4Elements}
                  hasBirthTime={hasBirthTime}
                  jijanggan={sajuData.jijanggan}
                  pillars={sajuData.pillars}
                  aiResult={aiResult}
                />
              ))}
            </div>
          </div>

          {/* 크로스셀 CTA */}
          <LocalFadeIn delay={80}>
            <div className="card space-y-3">
              <h3 className="text-h3 text-text-primary">더 알아보기</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { title: '궁합 분석', desc: '1운', action: () => window.location.href = '/compat' },
                  { title: '대운 상세', desc: '1운', action: () => window.location.href = '/daeun' },
                  { title: '공유하기', desc: '+1운', action: () => setShowShareModal(true) },
                ].map((item) => (
                  <button key={item.title} onClick={item.action} className="card text-center py-3 space-y-1 hover-lift">
                    <div className="w-8 h-8 rounded-lg mx-auto bg-brand-gold/10 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
                    </div>
                    <p className="text-caption text-text-primary font-semibold">{item.title}</p>
                    <span className="badge-gold text-tiny">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </LocalFadeIn>


          {/* 공유 리워드 배너 */}
          <LocalFadeIn delay={80}>
            <button
              onClick={() => setShowShareModal(true)}
              className="w-full card-gold py-5 px-5 text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-h3 text-text-primary">친구에게 공유하면 1운 적립</p>
                  <p className="text-caption text-text-muted mt-0.5">공유받은 친구도 사주를 볼 수 있어요</p>
                </div>
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #B8965A, #8C6D3D)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </div>
              </div>
            </button>
          </LocalFadeIn>

          {/* 3-part Footer CTA (diff v3 §6) */}
          <FooterCTA pageKey="report" backTo="/storage" marginTop={24} />

          {/* Footer */}
          <div className="text-center pt-8 pb-4">
            <div className="divider mb-4" />
            <p className="text-caption text-brand-gold font-bold">사주500</p>
            <p className="text-tiny text-text-hint mt-1">정통 명리학 기반 사주 분석 리포트</p>
            <p className="text-tiny text-text-disabled mt-1">
              &copy; 2026 사주500. 참고용이며 전문 상담을 대체하지 않아요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
