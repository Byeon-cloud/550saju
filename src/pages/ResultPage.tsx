import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import { ShareModal } from '@/components/share/ShareModal';

import { getReport, getReports, getMyProfile } from '@/services/storage/localStore';
import { LuckyProfile } from '@/components/saju/LuckyProfile';
import { MonthlyFortune } from '@/components/saju/MonthlyFortune';
import { stripMd } from '@/utils/format';
import { RelationshipMap } from '@/components/saju/RelationshipMap';
import { WealthFlow } from '@/components/saju/WealthFlow';
import type { OhengType, Pillar, SajuData, DaeUn, SipSung, JiJangGan, UnYoung, NaPeum, SinSal, GongMang } from '@/types/saju';
import type { LuckyProfile as LuckyProfileType, MonthlyFortune as MonthlyFortuneType, RelationshipMap as RelMapType, WealthFlow as WealthFlowType } from '@/types/report';

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
}

interface V4GongMang {
  basis: string;
  value: string;
  kr: string;
  meaning: string;
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
  const labels = ['성장기', '학업기', '확립기', '안정기', '확립기', '수확기', '원숙기', '완성기', '지혜기', '관조기'];
  // 시작나이 > 끝나이인 비정상 항목(대운 전 소운) 필터
  const valid = daeunList.filter(d => d.시작나이 <= d.끝나이);
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

function mapSinSal(list: SinSal[]): V4SinSal[] {
  return list.map(s => ({
    hanja: s.이름한자 || s.이름,
    kr: s.이름,
    desc: s.의미 || getDefaultSinSalDesc(s.이름, s.type),
  }));
}

function getDefaultSinSalDesc(name: string, type: 'gilsin' | 'hyungsal'): string {
  const gilsinDescs: Record<string, string> = {
    '天恩': '위기 때 예상 못한 도움이 들어옴',
    '阴德': '남몰래 베푼 선행이 돌아오는 기운',
    '陰德': '남몰래 베푼 선행이 돌아오는 기운',
    '福生': '자연스럽게 복이 따르는 체질',
    '除神': '장애물을 제거하는 힘',
    '鸣吠': '말과 글로 영향력을 발휘',
    '鳴吠': '말과 글로 영향력을 발휘',
    '天德': '하늘의 덕으로 큰 어려움을 넘김',
    '月德': '매월 들어오는 복의 에너지',
    '天喜': '기쁜 일이 생기는 길신',
    '玉堂': '귀인의 도움이 들어옴',
  };
  const hyungsalDescs: Record<string, string> = {
    '天吏': '계약·문서를 꼼꼼히 확인할 것',
    '五虚': '체력 관리와 내실 다지기 중요',
    '五虛': '체력 관리와 내실 다지기 중요',
    '五离': '관계에서 소통 노력 필요',
    '五離': '관계에서 소통 노력 필요',
    '元武': '속마음을 여는 연습이 과제',
    '白虎': '급한 일 처리 시 안전 주의',
    '朱雀': '말실수 조심, 신중한 소통 필요',
    '勾陈': '문서·법적 문제 꼼꼼히 체크',
    '勾陳': '문서·법적 문제 꼼꼼히 체크',
  };
  if (type === 'gilsin') return gilsinDescs[name] ?? '좋은 기운이 함께합니다';
  return hyungsalDescs[name] ?? '주의가 필요한 부분입니다';
}

function mapGongmang(list: GongMang[]): V4GongMang[] {
  const defaultMeanings: Record<string, string> = {
    '년주': '사회적 인정이 늦게 오지만, 꾸준히 쌓으면 한꺼번에 돌아옴',
    '일주': '남의 기대에 매이지 말 것. 자기 창작에 집중할 때 인생이 풀림',
  };
  return list.map(g => {
    // Try to infer kr from the 공망 characters
    const chars = g.공망.split('');
    const krParts = chars.map(c => JIJI_KO[c] ?? c).join('');
    // Infer element from jiji
    const elemParts = chars.map(c => {
      const oh = JIJI_OHENG[c];
      return oh ? OHENG_KR_LABEL[oh] : '';
    }).filter(Boolean);
    const elemStr = elemParts.length > 0 ? ` (${[...new Set(elemParts)].join('·')})` : '';

    return {
      basis: `${g.기준} 공망`,
      value: g.공망,
      kr: `${krParts}${elemStr}`,
      meaning: g.의미 || defaultMeanings[g.기준] || '비어있는 에너지 — 의식적 보완이 필요합니다',
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
  const tips: Record<string, string> = {
    '天恩': '어려울 때 주변에 도움을 요청하세요. 예상치 못한 귀인이 나타날 확률이 높아요',
    '阴德': '남몰래 선행을 베풀면 더 큰 복으로 돌아와요. 기부·봉사 활동 추천',
    '陰德': '남몰래 선행을 베풀면 더 큰 복으로 돌아와요. 기부·봉사 활동 추천',
    '福生': '감사 일기를 쓰면 복의 체질이 더 강해져요. 긍정 에너지를 유지하세요',
    '除神': '장애물을 만나도 쉽게 돌파하는 힘이 있어요. 어려운 프로젝트를 맡아보세요',
    '鸣吠': '글쓰기·발표·SNS 등 표현 활동에 재능이 있어요. 적극적으로 의견을 내세요',
    '鳴吠': '글쓰기·발표·SNS 등 표현 활동에 재능이 있어요. 적극적으로 의견을 내세요',
    '天德': '큰 위기에서도 안전하게 넘기는 수호 에너지예요. 과감한 도전에 유리해요',
    '月德': '매월 꾸준히 소소한 행운이 따라요. 복권보다 꾸준한 투자가 잘 맞아요',
    '天喜': '경사스러운 기회가 잘 찾아와요. 모임이나 네트워킹에 적극 참여하세요',
    '玉堂': '배움과 학문에서 귀인이 나타나요. 자격증·학위 취득에 유리한 운이에요',
  };
  return tips[name] ?? '이 길신의 에너지를 의식적으로 활용해보세요';
}

function getHyungsalActionTip(name: string): string {
  const tips: Record<string, string> = {
    '天吏': '계약서·문서는 하루 묵혔다 결정하세요. 급하게 사인하면 후회할 수 있어요',
    '致死': '무리한 일정은 피하고 체력 관리에 신경 쓰세요. 과로가 가장 큰 적이에요',
    '五虚': '체력이 바닥날 때가 있어요. 규칙적 운동과 충분한 수면이 최고의 보약이에요',
    '五虛': '체력이 바닥날 때가 있어요. 규칙적 운동과 충분한 수면이 최고의 보약이에요',
    '五离': '오해가 생기기 쉬운 체질이에요. 중요한 말은 카톡보다 직접 만나서 하세요',
    '五離': '오해가 생기기 쉬운 체질이에요. 중요한 말은 카톡보다 직접 만나서 하세요',
    '元武': '속마음을 감추는 편인데, 가까운 사람에겐 먼저 마음을 열어보세요. 관계가 깊어져요',
    '白虎': '급한 결정은 피하고, 운전·운동 시 안전에 주의하세요. 침착함이 무기예요',
    '朱雀': '한 번 더 생각하고 말하는 습관을 들이세요. 말실수가 큰 화를 부를 수 있어요',
    '勾陈': '법적 문제·문서 작업은 전문가 도움을 받으세요. 혼자 처리하면 빠지기 쉬워요',
    '勾陳': '법적 문제·문서 작업은 전문가 도움을 받으세요. 혼자 처리하면 빠지기 쉬워요',
  };
  return tips[name] ?? '이 부분을 의식적으로 주의하면 오히려 강점으로 바뀌어요';
}

function getGongmangActionTip(basis: string): string {
  if (basis.includes('년')) return '사회적 인정이 늦어도 조급해하지 마세요. 꾸준히 쌓으면 때가 되었을 때 한꺼번에 돌아옵니다.';
  if (basis.includes('일')) return '타인의 기대에 맞추려 하지 말고, 자기만의 길을 가세요. 자기 창작·자기 사업에서 인생이 풀리는 구조예요.';
  return '비어있는 영역이지만, 집착을 내려놓으면 오히려 자유로운 영역이 돼요.';
}

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
        border: p.isMe ? '2px solid #C9A96E' : '1px solid #E2E5EC',
        boxShadow: p.isMe ? '0 4px 20px rgba(201,169,110,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* 오행 색상 띠 (나 제외) — 직관적 오행 구분 */}
      {!p.isMe && (
        <div className="w-full h-[4px]" style={{ background: gc.main }} />
      )}

      {/* 기둥 라벨 */}
      <div className="w-full pt-3 pb-1 px-2 text-center"
        style={{ background: p.isMe ? 'rgba(201,169,110,0.15)' : '#F8F9FB' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: p.isMe ? '#E8D5A8' : '#8892A4' }}>
          {p.label} {p.sub}
        </div>
        <div style={{ fontSize: 9, color: p.isMe ? 'rgba(255,255,255,0.4)' : '#A8B1C1' }}>{p.desc}</div>
        {p.isMe && (
          <div className="inline-block rounded-full mt-1 px-2 py-0.5"
            style={{ background: '#C9A96E', fontSize: 9, fontWeight: 800, color: '#fff' }}>
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
      <div className="w-10 h-px mx-auto" style={{ background: p.isMe ? 'rgba(201,169,110,0.3)' : '#E2E5EC' }} />

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

  // ─── 십성별 실생활 의미 ───
  const sipMeaning: Record<string, { voice: string; trait: string; emoji: string }> = {
    '정관': { voice: '"제대로 해야 해"', trait: '규칙, 책임감, 자기관리가 철저한 성향', emoji: '📏' },
    '정인': { voice: '"더 배우고 싶어"', trait: '학습욕, 지적 호기심, 자격증·공부에 끌림', emoji: '📚' },
    '겁재': { voice: '"밀리면 안 돼"', trait: '경쟁심, 승부욕, 내 것을 지키려는 에너지', emoji: '🔥' },
    '편관': { voice: '"대충은 안 돼"', trait: '완벽주의, 추진력, 압박감 속에서 빛나는 타입', emoji: '⚡' },
    '편인': { voice: '"직감을 믿어"', trait: '독창적 사고, 영감, 남들과 다른 시각', emoji: '💡' },
    '식신': { voice: '"만들고 표현하자"', trait: '창작 욕구, 맛집·예술·취미에 진심', emoji: '🎨' },
    '상관': { voice: '"틀을 깨고 싶어"', trait: '혁신, 반골기질, 기존 방식에 의문을 던짐', emoji: '🚀' },
    '편재': { voice: '"기회를 잡자"', trait: '기회 포착, 투자감각, 유행에 민감', emoji: '🎯' },
    '정재': { voice: '"안정이 최고"', trait: '저축, 계획적 소비, 꾸준한 축적형', emoji: '🏦' },
    '비견': { voice: '"같이 가자"', trait: '동료의식, 협동심, 혼자보다 함께 하는 타입', emoji: '🤝' },
    '일주': { voice: '"나 자신"', trait: '나의 본질 에너지, 모든 판단의 기준점', emoji: '👤' },
  };

  // ─── 포지션별 의미 ───
  const posContext: Record<string, { role: string; desc: string }> = {
    '년지': { role: '어린 시절의 나', desc: '부모·조상에게서 물려받은 기질' },
    '년지+월지': { role: '성장기의 나', desc: '타고난 기질 + 사회적 성격' },
    '월지': { role: '사회에서의 나', desc: '직장·대인관계에서 보이는 모습' },
    '일지': { role: '진짜 나의 본질', desc: '가장 솔직한 내면, 배우자궁' },
    '시지': { role: '말년의 나', desc: '나이 들수록 드러나는 성향, 자녀궁' },
  };

  // ─── 데이터 빌드 ───
  interface JjEntry { hanja: string; kr: string; elemKey: ElemKey; sipsung: string; meaning: { voice: string; trait: string; emoji: string } | null }
  interface JjCard { hanja: string; elemKey: ElemKey; posKey: string; posLabel: string; role: string; roleDesc: string; entries: JjEntry[]; isCore?: boolean }

  function buildEntries(jj: JiJangGan): JjEntry[] {
    return jj.지장간.map((g, gi) => {
      const gOheng = CHEONGAN_OHENG[g];
      const gElem = gOheng ? OHENG_TO_ELEM[gOheng] : 'earth' as ElemKey;
      const gKr = CHEONGAN_KO[g] ?? g;
      const rawSip = jj.십성[gi] ?? '';
      // 십성 데이터 없으면 일간 기준으로 직접 계산 (캐시된 구 데이터 대응)
      const sip = rawSip ? toKrSipsung(rawSip) : calcSipsung(g);
      return { hanja: g, kr: gKr, elemKey: gElem, sipsung: sip, meaning: sipMeaning[sip] ?? null };
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
    const m = sipMeaning[sip];
    return m ? `${m.emoji} ${m.voice} (${sip}${count >= 2 ? ' ×' + count + ', 특히 강함' : ''})` : null;
  }).filter(Boolean);

  // 일지의 핵심 목소리
  const dayCard = cards.find(c => c.isCore);
  const dayVoices = dayCard?.entries.filter(e => e.meaning).map(e => e.meaning!.voice).join(' + ') ?? '';

  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47', marginBottom: 4 }}>
        ▎지장간 — 내 안의 숨은 성격들
      </div>
      <p style={{ fontSize: 10, color: '#a0937f', marginBottom: 10, lineHeight: 1.6 }}>
        각 기둥 속에 <b style={{ color: '#6b5b47' }}>2~3개의 숨은 성격</b>이 있어요. 겉으로 안 보이지만 내면에서 끊임없이 영향을 주는 목소리들이에요.
      </p>

      {/* 종합 해석 */}
      {summaryParts.length > 0 && (
        <div className="p-3 rounded-xl mb-3" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(201,169,110,0.25)' }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#a08b6a', marginBottom: 6 }}>나의 내면 요약</p>
          <div className="space-y-1">
            {summaryParts.map((part, i) => (
              <p key={i} style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.6 }}>{part}</p>
            ))}
          </div>
          {dayVoices && (
            <p style={{ fontSize: 10, color: '#8b7e6f', marginTop: 6, lineHeight: 1.5 }}>
              → 특히 <b style={{ color: '#6b5b47' }}>일지(본질)</b>에서 {dayVoices} 목소리가 가장 강하게 작동해요.
            </p>
          )}
        </div>
      )}

      {/* 카드 리스트 (세로) */}
      <div className="space-y-3">
        {cards.map((card, ci) => {
          const ec = EC[card.elemKey];
          return (
            <div key={ci} className="rounded-xl overflow-hidden" style={{ border: card.isCore ? '2px solid #C9A96E' : `1px solid ${ec.med}` }}>
              {/* 카드 헤더 */}
              <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: card.isCore ? 'linear-gradient(135deg, #F5F0E8, #EDE5D5)' : ec.light }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: card.isCore ? '#C9A96E' : ec.dark }}>{card.hanja}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6b5b47' }}>{card.posKey}</span>
                    {card.isCore && <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: '#C9A96E', borderRadius: 4, padding: '1px 5px' }}>핵심</span>}
                  </div>
                  <p style={{ fontSize: 9, color: '#8b7e6f' }}>{card.role} — {card.roleDesc}</p>
                </div>
                <span style={{ fontSize: 10, color: ec.main, fontWeight: 600 }}>{card.posLabel}</span>
              </div>
              {/* 숨은 성격 목록 */}
              <div className="px-3 py-2 space-y-2" style={{ background: '#fff' }}>
                {card.entries.map((e, ei) => {
                  const eec = EC[e.elemKey];
                  return (
                    <div key={ei} className="flex items-start gap-2.5 pb-2" style={ei < card.entries.length - 1 ? { borderBottom: '1px solid #f0ebe3' } : {}}>
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: eec.light, border: `1px solid ${eec.med}` }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: eec.dark }}>{e.hanja}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#6b5b47' }}>{e.kr}</span>
                          {e.sipsung && <span style={{ fontSize: 9, fontWeight: 700, color: eec.main, background: eec.light, borderRadius: 4, padding: '1px 5px' }}>{e.sipsung}</span>}
                        </div>
                        {e.meaning ? (
                          <div style={{ marginTop: 2 }}>
                            <p style={{ fontSize: 10, color: '#C9A96E', fontWeight: 700 }}>{e.meaning.voice}</p>
                            <p style={{ fontSize: 10, color: '#8b7e6f', lineHeight: 1.5 }}>{e.meaning.trait}</p>
                          </div>
                        ) : e.sipsung ? (
                          <p style={{ fontSize: 10, color: '#8b7e6f', marginTop: 2 }}>{e.sipsung} 에너지</p>
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
      <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#fff8e1', border: '1px solid #ffe082' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#f57f17', marginBottom: 3 }}>이렇게 읽어요</p>
        <p style={{ fontSize: 10, color: '#8b7e6f', lineHeight: 1.7 }}>
          각 칸마다 2~3개의 숨은 성격이 있어요. 예를 들어 한 칸에 "제대로 해야 해" + "더 배우고 싶어"가 같이 있으면, <b style={{ color: '#6b5b47' }}>완벽주의와 학습욕이 동시에 작동</b>하는 성격이에요.
          <br /><b style={{ color: '#6b5b47' }}>일지 = 진짜 나</b> (가장 중요), 년지 = 어릴 때 모습, 시지 = 나이 들수록 나타나는 모습이에요. 같은 십성이 여러 칸에 반복되면 그 성향이 특히 강해요.
        </p>
      </div>
    </div>
  );
}

function CareerFitVis() {
  const fits = [
    { label: '개발·기술', score: 92, color: EC.metal.main, icon: '💻',
      why: '금(金) 기운이 강해 논리적 사고와 정밀한 분석력이 뛰어나요. 복잡한 문제를 체계적으로 풀어내는 능력이 타고났어요.',
      jobs: 'SW개발, 데이터분석, 엔지니어, 연구직' },
    { label: '디자인·창작', score: 88, color: EC.fire.main, icon: '🎨',
      why: '화(火) 기운의 감각과 금(金)의 정교함이 만나 미적 감각 + 완성도가 높아요. 트렌드를 읽는 눈도 좋은 편이에요.',
      jobs: 'UX/UI, 영상편집, 작가, 브랜딩' },
    { label: '기획·전략', score: 80, color: EC.earth.main, icon: '📋',
      why: '토(土) 기운이 중심을 잡아주고, 여러 요소를 통합하는 힘이 있어요. 큰 그림을 보면서 실행까지 연결하는 능력이에요.',
      jobs: '서비스기획, 전략컨설팅, PM, 사업개발' },
    { label: '영업·대인', score: 45, color: EC.wood.main, icon: '🤝',
      why: '목(木) 기운이 약한 편이라 적극적 대인관계에 에너지 소모가 클 수 있어요. 소규모·깊은 관계에서 더 빛나는 타입이에요.',
      jobs: '컨설턴트, 강사, 코칭, B2B영업' },
    { label: '순수 관리직', score: 40, color: EC.water.main, icon: '📊',
      why: '수(水) 기운은 있지만 창의적 에너지가 강해서 단순 반복 관리보다는 변화가 있는 환경이 더 맞아요.',
      jobs: '프로젝트 매니저(변화 있는), 스타트업 운영' },
  ];

  const topFit = fits[0];
  const strongFields = fits.filter(f => f.score >= 75);
  const weakFields = fits.filter(f => f.score < 50);

  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47', marginBottom: 4 }}>▎직업 적성 매칭도</div>
      <p style={{ fontSize: 10, color: '#8b7e6f', marginBottom: 12, lineHeight: 1.5 }}>
        사주 오행의 강약을 기반으로 어떤 분야에서 자연스럽게 능력을 발휘할 수 있는지 분석했어요
      </p>

      {/* 종합 해석 */}
      <div className="mb-4 p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #f5f0e8, #ede5d5)', border: '1px solid rgba(201,169,110,0.25)' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#a08b6a', marginBottom: 4 }}>나의 직업 성향 요약</p>
        <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.7 }}>
          <b>{topFit.label}</b> 분야와 궁합이 가장 좋아요 ({topFit.score}%).
          {strongFields.length > 1 && <> <b>{strongFields.slice(1).map(f => f.label).join(', ')}</b> 분야도 잘 맞는 편이에요.</>}
          {weakFields.length > 0 && <> 반면 <b>{weakFields.map(f => f.label).join(', ')}</b>은 에너지 소모가 클 수 있어요 — 못한다는 게 아니라 더 힘이 드는 방향이에요.</>}
        </p>
      </div>

      {/* 바 차트 + 설명 카드 */}
      <div className="space-y-3">
        {fits.map((f, i) => {
          const isStrong = f.score >= 75;
          return (
            <div key={i} className="p-3 rounded-xl" style={{ background: '#fff', border: `1px solid ${isStrong ? f.color + '30' : '#e8e0d4'}` }}>
              {/* 바 */}
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6b5b47', flex: 1 }}>{f.label}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: f.color }}>{f.score}%</span>
              </div>
              <div className="rounded-full overflow-hidden mb-2" style={{ height: 10, background: '#efe8db' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${f.score}%`, background: `linear-gradient(90deg, ${f.color}99, ${f.color})` }}
                />
              </div>
              {/* 왜 이 점수인지 */}
              <p style={{ fontSize: 10, color: '#6b5b47', lineHeight: 1.6, marginBottom: 4 }}>
                <b style={{ color: f.color }}>왜?</b> {f.why}
              </p>
              {/* 추천 직업 */}
              <p style={{ fontSize: 10, color: '#8b7e6f', lineHeight: 1.5 }}>
                <b>추천:</b> {f.jobs}
              </p>
            </div>
          );
        })}
      </div>

      {/* 추천 근무 환경 */}
      <div className="mt-4 p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47', marginBottom: 6 }}>🏢 나에게 맞는 근무 환경</p>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span style={{ fontSize: 10, color: '#2D8A4E', fontWeight: 800, minWidth: 50 }}>잘 맞음</span>
            <span style={{ fontSize: 10, color: '#6b5b47', lineHeight: 1.6 }}>자율적인 시간 관리, 깊은 몰입이 가능한 환경, 소규모 팀, 실력으로 인정받는 문화</span>
          </div>
          <div className="flex items-start gap-2">
            <span style={{ fontSize: 10, color: '#e65100', fontWeight: 800, minWidth: 50 }}>주의</span>
            <span style={{ fontSize: 10, color: '#6b5b47', lineHeight: 1.6 }}>지나친 회의·보고 문화, 성과보다 인맥이 중요한 환경, 창의성 없이 반복하는 업무</span>
          </div>
        </div>
      </div>

      {/* 해석 가이드 */}
      <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#fff8e1', border: '1px solid #ffe082' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#f57f17', marginBottom: 3 }}>이렇게 읽어요</p>
        <p style={{ fontSize: 10, color: '#8b7e6f', lineHeight: 1.6 }}>
          높은 점수 = "타고난 적성이 잘 맞아서 적은 에너지로 좋은 성과를 낼 수 있는 분야"예요. 낮은 점수는 "못한다"가 아니라 <b style={{ color: '#6b5b47' }}>"더 많은 에너지가 든다"</b>는 뜻이에요. 80% 이상이면 천직 수준, 60~79%면 충분히 잘할 수 있는 범위, 50% 미만이면 다른 분야와 병행하면 좋아요.
        </p>
      </div>
    </div>
  );
}

function HealthVis() {
  const items = [
    { elem: 'wood' as ElemKey, organ: '간·눈·근육', status: '과다 — 주의', advice: '눈 휴식, 음주 절제', c: '#c62828' },
    { elem: 'fire' as ElemKey, organ: '심장·혈압', status: '2026 주의', advice: '시원한 음식, 과로 금지', c: '#e65100' },
    { elem: 'earth' as ElemKey, organ: '위·소화기', status: '보통', advice: '규칙적 식사', c: '#2e7d32' },
    { elem: 'metal' as ElemKey, organ: '폐·피부', status: '약함', advice: '호흡 운동, 환절기 주의', c: '#e65100' },
    { elem: 'water' as ElemKey, organ: '신장·방광', status: '없음 — 보완 필요', advice: '수분 섭취 필수!', c: '#c62828' },
  ];
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47', marginBottom: 10 }}>▎오행별 건강 체크</div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#fff', fontSize: 11 }}>
            <span>{EHAN[it.elem]}</span>
            <span style={{ width: 60, fontWeight: 600, color: '#6b5b47' }}>{it.organ}</span>
            <span style={{ width: 64, fontWeight: 800, color: it.c }}>{it.status}</span>
            <span className="flex-1" style={{ color: '#8b7e6f' }}>{it.advice}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaewoonVis() {
  const items = [
    { label: '색상', desc: '검정·남색(수) + 흰색·은색(금)', icon: '🎨' },
    { label: '방위', desc: '북(수)·서(금) 방향으로 책상 배치', icon: '🧭' },
    { label: '음식', desc: '해산물·검은깨(수) + 배·닭고기(금)', icon: '🍽️' },
    { label: '운동', desc: '수영 최고! 요가·등산도 추천', icon: '🏊' },
  ];
  return (
    <div className="my-4 p-4 rounded-2xl" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47', marginBottom: 10 }}>▎개운법 한눈에</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it, i) => (
          <div key={i} className="p-3 rounded-xl" style={{ background: '#fff', border: '1px solid #e8e0d4' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span style={{ fontSize: 20 }}>{it.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#6b5b47' }}>{it.label}</span>
            </div>
            <div style={{ fontSize: 11, color: '#6b5b47', fontWeight: 500, lineHeight: 1.5 }}>{it.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Demo data for new PRD v2 visualizations ───
const DEMO_LUCKY_PROFILE: LuckyProfileType = {
  colors: ['#1565C0', '#2D8A4E', '#424242'],
  colorNames: ['파란색', '초록색', '검은색'],
  numbers: [3, 7, 12],
  direction: '동쪽',
  day: '수요일',
  foods: ['검은콩', '미역', '해산물'],
  element: '수(水)',
};

const DEMO_MONTHLY: MonthlyFortuneType[] = [
  { month: 1, score: 65 }, { month: 2, score: 72 }, { month: 3, score: 78 },
  { month: 4, score: 60 }, { month: 5, score: 85 }, { month: 6, score: 70 },
  { month: 7, score: 55 }, { month: 8, score: 80 }, { month: 9, score: 75 },
  { month: 10, score: 68 }, { month: 11, score: 82 }, { month: 12, score: 90 },
];

const DEMO_REL_MAP: RelMapType = {
  work: { score: 72, keyword: '배려형 리더' },
  friend: { score: 85, keyword: '묵묵한 조력자' },
  lover: { score: 60, keyword: '조심스러운 표현' },
};

const DEMO_WEALTH: WealthFlowType = {
  earning: { score: 75, style: '간접적·창작형' },
  spending: { score: 55, style: '충동 가끔·계획 위주' },
  saving: { score: 70, style: '장기 투자형' },
};

// ─── SectionVis dispatcher (PRD v2: 12섹션 + 4개 신규 시각화) ───
function SectionVis({ type, elements, hasBirthTime, jijanggan, pillars }: {
  type: string;
  elements: V4Elements;
  hasBirthTime: boolean;
  jijanggan: JiJangGan[];
  pillars: Pillar[];
}) {
  if (type === 'oheng_structure') return <OhengFlowVis elements={elements} hasBirthTime={hasBirthTime} />;
  if (type === 'jijanggan') return <JijangganVisComp jijanggan={jijanggan} pillars={pillars} hasBirthTime={hasBirthTime} />;
  if (type === 'career_fit') return <CareerFitVis />;
  if (type === 'health_oheng') return <HealthVis />;
  if (type === 'gaewoon') return <GaewoonVis />;
  // PRD v2 신규 시각화
  if (type === 'luckyProfile') return <LuckyProfile data={DEMO_LUCKY_PROFILE} />;
  if (type === 'monthlyFortune') return <MonthlyFortune data={DEMO_MONTHLY} />;
  if (type === 'relationshipMap') return <RelationshipMap data={DEMO_REL_MAP} />;
  if (type === 'wealthFlow') return <WealthFlow data={DEMO_WEALTH} />;
  return null;
}

// ─── ReportSection ───
interface SectionData {
  id: string;
  icon: string;
  title: string;
  content: string;
  visual?: string;
}

function ReportSection({ section, index, elements, hasBirthTime, jijanggan, pillars }: {
  section: SectionData;
  index: number;
  elements: V4Elements;
  hasBirthTime: boolean;
  jijanggan: JiJangGan[];
  pillars: Pillar[];
}) {
  const [expanded, setExpanded] = useState(index < 2);
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
            style={{ background: 'rgba(201,169,110,0.1)' }}>
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
                />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </LocalFadeIn>
  );
}

// ─── Sections content (v4 exact) ───
function getSections(hasBirthTime: boolean): SectionData[] {
  const HAS_TIME = hasBirthTime;
  return [
    {
      id: 'summary', icon: '', title: '사주 총평', visual: 'oheng_structure',
      content: `일간이 己土(기토)입니다. 기토는 논밭의 부드러운 흙이에요. 딱딱한 바위(戊토)와 달리, 생명을 품고 키워내는 포용적인 흙입니다. 겉으로는 온화하고 수용적이지만, 그 안에 놀라운 생산력을 가지고 있어요.

이 사주의 가장 극적인 구조는 목(木)의 압도적 우세입니다. 년지·월지 모두 寅(인목)${HAS_TIME ? ', 시지에 卯(묘목)까지' : '이고'} — 부드러운 논밭에 거대한 나무${HAS_TIME ? ' 세 그루가' : ' 두 그루가'} 뿌리를 내린 형국입니다. 명리학에서 '목극토(木剋土)'라 하여 나무가 흙의 양분을 빼앗고 뿌리로 흙을 헤집는 관계인데, 삶에서는 "외부의 기대·압력·책임감이 끊임없이 나를 압박하는 구조"로 나타납니다.

결정적인 반전이 있습니다. 일지(나의 본질 자리)에 酉(유금)가 있고, 12운성이 장생(長生)이에요. 년·월에서는 에너지가 수렴되는 '사(死)' 상태인데, 정작 본질에서는 장생 — 겉으로는 조용하지만 속에는 끊임없이 새로운 것을 만들어내고 싶은 강렬한 생명력이 숨어있습니다.
${HAS_TIME ? `
시주에서 특히 주목할 점이 있어요. 시간 丁(정화)은 편인 — 직관·영감·특수기술의 에너지가 '결과물' 자리에 있다는 뜻이에요. 나이 들수록 독창적인 아이디어와 창작 능력이 더 강해집니다. 납음이 노중화(炉中火/화로 안의 불)인 것도 의미심장해요. 사주 원국에는 화가 겉으로 안 보이는데, 시주 깊은 곳에 뜨거운 불꽃이 숨어있었던 겁니다.` : ''}

수(水)가 사주에 완전히 없다는 것도 큰 특징입니다. 수는 지혜, 유연성, 흐름을 상징하는데, 이게 없으면 한번 마음먹은 걸 꺾기 어렵고 감정의 유연한 전환이 잘 안 됩니다. 대신 현재 대운(丁巳)에서 화가 강하게 들어와 일간 己토를 도와주는 구조가 형성되어 있어요.`,
    },
    {
      id: 'personality', icon: '', title: '타고난 성격과 기질', visual: 'jijanggan',
      content: `겉으로 보이는 모습부터 봅시다. 12운성이 년지·월지 모두 '사(死)'예요. 에너지가 밖으로 발산되기보다 안으로 응축되는 상태입니다. "생각이 많은 사람", "좀 과묵하다"는 인상을 줍니다. 말수가 적은 건 할 말이 없어서가 아니라, 머릿속에서 이미 여러 번 정리하고 나서 말하는 타입이기 때문이에요.

지장간(地藏干)을 보면 속마음은 훨씬 치열합니다. 寅(인목) 안에 甲(정관: "제대로 해야 한다"), 丙(정인: "더 배우고 싶다"), 戊(겁재: "밀리면 안 된다") 세 목소리가 동시에 돌아가고 있어요. 이게 년지와 월지에 똑같이 반복됩니다.
${HAS_TIME ? `
시지 卯(묘목)의 지장간 乙(을목)은 칠살입니다. 칠살은 강한 압박이지만 동시에 추진력과 돌파력을 주는 별이에요. 결과물을 만들 때 "대충"이 안 되는 구조 — 무엇을 만들든 완성도에 집착하는 경향이 있습니다.` : ''}

일지 식신(酉/辛)이 장생이라 혼자만의 시간에 뭔가를 만들어내는 데 가장 큰 만족감을 느껴요. "내 손으로 무에서 유를 만드는 과정"에서 살아있음을 느끼는 사람입니다. 식신은 식복(食福)의 별이기도 해서 먹는 것에 관심이 높고 맛집 탐방이나 직접 요리를 좋아할 가능성이 높아요.

신살 중 원무(元武)가 있어서 속마음을 쉽게 드러내지 않습니다. 단점이 아니라 특성이에요. 다만 가까운 사람에게까지 벽을 세우면 관계가 피상적이 될 수 있으니, 신뢰하는 사람에게는 의식적으로 열어보세요.`,
    },
    {
      id: 'social', icon: '', title: '대인관계와 소통',
      content: `년간에 겁재(戊)가 있어요. 어릴 때부터 또래 사이에서 경쟁을 경험하며 자기 것을 지키는 법을 배운 사람입니다. 월간의 정관(甲)이 대인관계에서 가장 큰 영향을 미쳐요. 질서·예의·체면을 중시해서 선 넘는 행동을 극도로 싫어합니다.
${HAS_TIME ? `
시주의 칠살(卯/乙)은 대인관계에서 흥미로운 양면성을 줍니다. 겉으로는 조용하지만, 무시당하거나 부당한 대우를 받으면 예상 외로 강하게 반응해요. 칠살 에너지가 결과물 자리에 있으니, 특히 "자기가 만든 것"에 대한 비판에 민감할 수 있습니다. 건설적 피드백과 무례한 비난을 구분하는 연습이 도움이 됩니다.` : ''}

신살 중 오리(五离)가 있어서 모든 사람과 넓게 사귀기보다 소수의 신뢰할 수 있는 사람과 깊은 관계를 유지하는 타입이에요. 앞에 나서는 리더십보다 묵묵히 자기 일로 인정받는 스타일.

명폐(鸣吠) 길신으로 말과 글을 통한 영향력이 있어요. 대면보다 콘텐츠, 글, 제품을 통해 소통할 때 더 힘이 실립니다.`,
    },
    {
      id: 'career', icon: '', title: '직업운과 적성', visual: 'career_fit',
      content: `월간 정관이 투출해 있으니 직장생활과 인연이 깊어요. 완전한 프리랜서보다 소속+자율성 조합이 최적. IT 기업 개발자, 크리에이티브 에이전시, 안정적 수입원 있는 1인 사업이 맞습니다.

일지 식신(酉/辛)이 장생이니 무에서 유를 만드는 직업이 핵심 적성이에요. 개발, 디자인, 콘텐츠 제작, 기획 — 한 방이 아니라 꾸준한 결과물 축적형.
${HAS_TIME ? `
시주 편인(丁)이 결과물 자리에 있어서, 나이 들수록 전문성과 독창성이 강해집니다. 특히 남들이 안 하는 독특한 분야에서 자기만의 포지션을 만들 때 빛나요. 칠살(卯)의 추진력이 있어서 일단 방향이 정해지면 끝까지 밀고 나가는 힘도 있습니다.` : ''}

지장간에 정인(丙)이 2개 숨어있어서 학습 능력이 뛰어나요. "하고 싶어서" 배울 때 진짜 실력이 붙는 구조.

현재 대운(丁巳)은 정인 에너지가 강해서 사업보다 실력과 전문성을 쌓는 데 집중하는 게 유리합니다. 32세 이후 대운(戊午)부터 자기 사업이 궤도에 오를 수 있어요.`,
    },
    {
      id: 'wealth', icon: '', title: '재물운',
      content: `재성이 천간에 없어서 돈 자체가 최우선 동기는 아닙니다. 의미 있는 일을 먼저 선택하는 경향. 하지만 식신생재(食神生財)의 경로가 열려있어요 — "내가 만든 것의 가치를 인정받아서 버는 방식"이 가장 자연스럽습니다.
${HAS_TIME ? `
시주에 편인(丁)이 있는데, 편인이 식신을 극하는 '도식(倒食)' 관계가 될 수 있어요. 이건 "아이디어는 넘치는데 수익화로 연결하는 데 한 단계 더 노력이 필요하다"는 의미입니다. 만든 것을 세상에 내놓는 과정(마케팅, 영업, 가격 설정)을 의식적으로 배울 필요가 있어요.` : ''}

겁재(戊)가 년간에 있어서 친구나 지인 부탁에 쉽게 돈을 쓰는 경향. 보증이나 동업 시 금전 문제 특히 주의.

수(水) 부재로 재무관리 감각을 의식적으로 키워야 해요. 돈의 흐름을 시각화하는 습관 자체가 개운법. 재테크는 장기 투자형(부동산, 인덱스 펀드, 자기 사업 가치 성장)이 맞습니다.`,
    },
    {
      id: 'love', icon: '', title: '애정운과 연애 스타일',
      content: `일지(배우자 자리) 酉(유금/식신) — 배우자에게 뭔가 해주고 싶은 마음이 강해요. 요리, 선물, 상대가 필요한 걸 미리 챙기는 타입. 정관이 강해서 가볍게 만나는 걸 못 하고, 한번 사귀면 진지하게 갑니다.
${HAS_TIME ? `
시주(자녀·결과물 자리)에 칠살(卯/乙)이 있어요. 연애에서 이건 "상대방에게 자기도 모르게 높은 기준을 적용하는" 경향으로 나타납니다. 완벽한 관계를 추구하다 보면 작은 실망에도 크게 흔들릴 수 있어요. "완벽한 사람은 없다"는 걸 머리가 아니라 마음으로 받아들이는 게 연애의 과제입니다.` : ''}

이상형: 지적이고 깊이 있으면서도 함께 있으면 편한 사람. 외모보다 대화가 통하는 사람에게 마음이 갑니다.

결혼운: 다음 대운(戊午, 32~41세) 시기에 더 강해질 수 있어요. 지금은 자기를 키우는 시기.`,
    },
    {
      id: 'health', icon: '', title: '건강 주의사항', visual: 'health_oheng',
      content: `목(木) 과다 → 간·담낭·눈·근육·신경. 장시간 모니터 작업 시 눈 건강과 간 관리 특히 주의. 20-20-20 규칙(20분마다 20초간 6m 먼 곳)을 습관화하세요.

수(水) 완전 부재 → 신장·방광·귀·생식기. 하루 2L 이상 수분 섭취가 매우 중요. 30대부터 신장 정기 검진 추천.

금(金) 약함 → 폐·대장·피부·호흡기. 환절기 감기, 알레르기 비염 주의. 깊은 호흡 운동이 금 에너지를 보충해요.
${HAS_TIME ? `
시주 12운성이 病(병) — 말년 건강에 특히 주의가 필요합니다. 젊을 때부터 건강 습관을 꾸준히 잡아놓는 게 중요해요. 특히 수(水) 보충을 지금부터 생활화하세요.` : ''}

2026년 화 과잉 시기 → 심장·혈압·열 관련 주의. 시원한 음식(오이, 수박, 녹차)으로 밸런스. 최적 운동: 수영(수+금 동시 보충).`,
    },
    {
      id: 'year2026', icon: '', title: '2026년 운세',
      content: `올해는 이 사주에게 매우 중요한 해입니다.

대운 丁巳(정사) + 세운 丙午(병오) = 화(火) 에너지가 사상 최대로 들어옵니다. 원래 사주에는 화가 지장간에만 숨어있었는데, 대운과 세운 양쪽에서 화가 폭발적으로 밀려들어요.
${HAS_TIME ? '시주 납음이 노중화(炉中火)인 것과 맞물려서, 내면의 불꽃이 외부의 화 에너지와 공명하는 해입니다.' : ''}

화생토(火生土) — 일간 己토를 강하게 지원하는 해. 목의 극을 받던 기토가 화의 지원으로 한층 강해집니다.

기회: 직관과 영감 폭발. 새 기술을 배우면 놀라운 속도로 흡수. 콘텐츠 제작, 사업 시작, 작품 발표에 최적. 중요한 인연이 들어올 가능성 높음.

주의: 급한 결정 실수 주의(하루 재워놓기). 이것저것 손대지 말고 하나에 집중. 수분 섭취, 과로 금지, 수면 관리.`,
    },
    {
      id: 'mission', icon: '', title: '인생의 핵심 과제와 숨겨진 재능',
      content: `핵심 과제: "남의 기대(정관/목)"와 "내가 하고 싶은 것(식신/금)" 사이의 균형.
${HAS_TIME ? `
시주 편인(丁)이 결과물 자리에 있어서, 이 균형을 찾아가는 과정 자체가 독창적인 결과물이 됩니다. "남들이 안 하는 방식으로 자기만의 길을 만드는 사람" — 이게 이 사주의 최종 형태예요.` : ''}

공망 분석: 일공 寅卯(목) — "남의 요구에 매이지 말라". 년공 申酉(금) — "사회적 인정은 늦게 오지만 한꺼번에 돌아옴".

숨겨진 재능: 천은+음덕(위기 때 도움이 오는 체질), 명폐(말과 글의 별), 복생(진심으로 몰입할 때 복이 따름).

핵심: 남의 요구에 응하되, 반드시 자기만의 창작 시간을 확보하세요. 일지 장생이 보여주듯, 진짜 에너지원은 자기가 만들어내는 것에 있습니다.`,
    },
    {
      id: 'luck', icon: '', title: '개운법', visual: 'gaewoon',
      content: `오행 보완 — 수(水)·금(金) 보충이 핵심:
• 색상: 검정·남색(수) + 흰색·은색(금)
• 방위: 북(수)·서(금) 방향으로 책상/사무실 배치
• 음식: 해산물·콩·검은깨·미역(수) + 배·무·닭고기(금)
• 운동: 수영 최고! 요가·태극권도 좋음

행동 습관:
• 매일 아침 5분 깊은 호흡 → 금 에너지 활성화, 목의 압박 완화
• 주 1회 "내가 하고 싶은 것만 하는 날" → 식신 에너지 충전
• 감정 저널링 하루 3줄 → 수 에너지 보충
• 물 의식적으로 마시기 → 가장 쉬운 개운법

2026년 특별:
• 화 과잉 → 시원한 환경, 차분한 활동으로 밸런스
• 하나에 집중 → 편인의 산만함을 식신의 꾸준함으로 잡기
• 올해 인연 소중히 → 화의 해에 만난 사람은 중요한 관계가 될 가능성
• 남몰래 작은 선행 → 천은·음덕 활성화`,
    },
    {
      id: 'luckyProfile', icon: '', title: '나만의 럭키 프로필', visual: 'luckyProfile',
      content: `부족한 오행을 보충하는 방향으로 선정한 행운의 아이템입니다.

수(水)와 금(金)이 부족하므로, 파란색·검은색·흰색 계열이 일상에서 기운을 보충해줍니다. 행운의 숫자 3·7·12는 사주 원국의 주요 기둥과 공명하는 숫자예요.

방위는 동쪽(목)이 길합니다. 수요일은 수(水)의 날로 중요한 결정을 내리기에 좋은 요일이에요.

음식은 검은콩·미역·해산물 등 수 기운을 가진 음식이 특히 좋습니다. 매일 의식적으로 챙겨 드세요.`,
    },
  ];
}

// ─── MAIN PAGE ───
export function ResultPage() {
  const { sajuData: ctxData, input: ctxInput } = useSajuContext();
  const reportId = window.location.pathname.split('/').pop() || 'local';

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
  const v4Pillars = mapPillars(sajuData.pillars, sajuData.sipsung);
  const v4Elements = mapElements(sajuData.elements);
  const v4Unyoung = mapUnyoung12(sajuData.unyoung12, sajuData.pillars);
  const v4Daeun = mapDaeun(sajuData.daeun, input.birthYear);
  const v4Napeum = mapNapeum(sajuData.napeum);
  const v4Gilsin = mapSinSal(sajuData.gilsin);
  const v4Hyungsal = mapSinSal(sajuData.hyungsal);
  const v4Gongmang = mapGongmang(sajuData.gongmang);

  // 사주 오행 분포 기반 점수 산출 (데모 — 실제는 AI가 생성)
  const scores = useMemo(() => {
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
  }, [sajuData]);

  const radarData = (Object.entries(v4Elements) as [ElemKey, number][]).map(([k, v]) => ({
    subject: EKR[k].replace(/\(.*\)/, ''),
    value: v,
    fullMark: 100,
  }));

  const pillarCount = v4Pillars.length;

  const sections = getSections(hasBirthTime);

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
                  { t: '년주 年柱', d: '조상·사회', hl: false, dim: false },
                  { t: '월주 月柱', d: '부모·직장', hl: false, dim: false },
                  { t: '일주 日柱', d: '나·배우자', hl: true, dim: false },
                  { t: '시주 時柱', d: '자녀·말년', hl: false, dim: !hasBirthTime },
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
                  style={{ background: 'rgba(201,169,110,0.2)', color: '#E8D5A8' }}>
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
                  const ec = EC[elem];
                  return (
                    <div key={elem} className="flex items-center gap-2">
                      <span style={{ fontSize: 13 }}>{EHAN[elem]}</span>
                      <span className="text-right" style={{ width: 50, fontSize: 11, fontWeight: 700, color: ec.dark }}>
                        {EKR[elem]}
                      </span>
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 16, background: ec.light }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(val, 3)}%`,
                            background: `linear-gradient(90deg,${ec.med},${ec.main})`,
                            transition: 'width 1s',
                          }}
                        />
                      </div>
                      <span
                        className="text-right"
                        style={{ width: 32, fontSize: 11, fontWeight: 800, color: val === 0 ? '#c62828' : ec.dark }}
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

          {/* 12운성 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">12운성 — 에너지 상태</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12, lineHeight: 1.6 }}>
                인생 각 영역의 에너지 강도를 보여줘요. <span style={{ color: '#27ae60', fontWeight: 700 }}>높을수록 활발</span>하고, <span style={{ color: '#e74c3c', fontWeight: 700 }}>낮을수록 내면에 집중</span>하는 에너지예요.
              </p>

              {/* 종합 해석 */}
              <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(201,169,110,0.2)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#C9A96E', marginBottom: 4 }}>종합 해석</p>
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
                        {u.pillar.includes('일지') && <span style={{ fontSize: 9, color: '#C9A96E', fontWeight: 800 }}>핵심</span>}
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
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12 }}>10년 단위로 바뀌는 운의 큰 흐름이에요. <span style={{ fontWeight: 700, color: '#C9A96E' }}>현재 대운</span>이 강조되어 있어요.</p>

              {/* 현재 대운 해석 */}
              {getDaeunCurrentSummary(v4Daeun) && (
                <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(201,169,110,0.2)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#C9A96E', marginBottom: 4 }}>지금 이 시기의 의미</p>
                  <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{getDaeunCurrentSummary(v4Daeun)}</p>
                </div>
              )}

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
              <div className="card-alert-danger mt-3">
                <p className="text-caption text-func-danger font-semibold">
                  현재 丁巳(정사) 대운 + 2026 丙午(병오) 세운 = 화(火) 에너지 집중!
                </p>
              </div>
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
                사주의 가장 깊은 곳에 있는 근본 에너지예요. 각 기둥마다 고유한 에너지가 있고, <span style={{ fontWeight: 700, color: '#C9A96E' }}>일주 납음이 가장 중요</span>해요.
              </p>

              {/* 종합 해석 */}
              <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(201,169,110,0.2)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#C9A96E', marginBottom: 4 }}>종합 해석</p>
                <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{getNapeumSummary(v4Napeum)}</p>
              </div>

              <div className="space-y-2">
                {v4Napeum.map((n, i) => {
                  const isIlju = n.pillar === '일주';
                  return (
                    <div key={i} className="p-3 rounded-xl" style={{
                      background: isIlju ? '#FFF8E1' : '#faf7f2',
                      border: isIlju ? '2px solid #C9A96E' : '1px solid #e8e0d4',
                    }}>
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 24 }}>{n.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#6b5b47' }}>{n.hanja}</span>
                            <span style={{ fontSize: 11, color: '#a0937f', fontWeight: 600 }}>{n.kr}</span>
                            <span className="rounded" style={{ padding: '2px 8px', background: isIlju ? '#C9A96E' : '#C9A96E20', color: isIlju ? '#fff' : '#C9A96E', fontSize: 10, fontWeight: 700 }}>
                              {n.pillar}{isIlju ? ' ← 핵심' : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: '#a0937f', marginTop: 2 }}>{getNapeumPositionRole(n.pillar)}</div>
                          <div style={{ fontSize: 12, color: '#6b5b47', marginTop: 4, fontWeight: 500, lineHeight: 1.5 }}>{n.desc}</div>
                          <div style={{ fontSize: 11, color: isIlju ? '#8d6e00' : '#5c6bc0', marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${isIlju ? '#C9A96E80' : '#e0e0e0'}`, lineHeight: 1.6 }}>
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
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12 }}>
                사주에 타고난 특별한 에너지예요. <span style={{ color: '#2e7d32', fontWeight: 700 }}>길신</span>은 타고난 재능과 행운, <span style={{ color: '#e65100', fontWeight: 700 }}>흉살</span>은 주의하면 오히려 강점으로 바뀌는 에너지예요.
              </p>
              <div className="mb-4">
                <div className="text-label text-func-success mb-2">길신 — 타고난 재능</div>
                <div className="space-y-2">
                  {v4Gilsin.map((g, i) => (
                    <div key={i} className="p-2.5 rounded-lg" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#2e7d32' }}>{g.hanja}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#2e7d32' }}>{g.kr}</span>
                        <span style={{ fontSize: 10, color: '#4caf50' }}>— {g.desc}</span>
                      </div>
                      <p style={{ fontSize: 10, color: '#1b5e20', lineHeight: 1.5, paddingLeft: 2 }}>
                        {getGilsinActionTip(g.hanja)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-label text-func-warning mb-2">흉살 — 주의하면 강점</div>
                <div className="space-y-2">
                  {v4Hyungsal.map((h, i) => (
                    <div key={i} className="p-2.5 rounded-lg" style={{ background: '#fff3e0', border: '1px solid #ffe0b2' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#e65100' }}>{h.hanja}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#e65100' }}>{h.kr}</span>
                        <span style={{ fontSize: 10, color: '#f57c00' }}>— {h.desc}</span>
                      </div>
                      <p style={{ fontSize: 10, color: '#bf360c', lineHeight: 1.5, paddingLeft: 2 }}>
                        {getHyungsalActionTip(h.hanja)}
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
              <div className="space-y-2">
                {v4Gongmang.map((g, i) => (
                  <div key={i} className="p-3 rounded-xl" style={{ background: '#f3e5f5', border: '1px solid #e1bee7' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: '#6a1b9a' }}>{g.value}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#8e24aa' }}>{g.kr}</span>
                      <span className="rounded" style={{ padding: '1px 6px', background: '#e1bee7', color: '#6a1b9a', fontSize: 10 }}>
                        {g.basis}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#7b1fa2', marginBottom: 6, fontWeight: 600 }}>{g.meaning}</div>
                    <div style={{ fontSize: 10, color: '#6a1b9a', lineHeight: 1.6, paddingTop: 6, borderTop: '1px dashed #ce93d8' }}>
                      {getGongmangActionTip(g.basis)}
                    </div>
                  </div>
                ))}
              </div>
              {/* 이렇게 읽어요 */}
              <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3949ab', marginBottom: 3 }}>이렇게 읽어요</p>
                <p style={{ fontSize: 10, color: '#5c6bc0', lineHeight: 1.6 }}>
                  공망 = "비어있어서 자유로운 영역". 이 영역에서는 남들처럼 하려고 애쓰지 말고, 나만의 방식을 만드세요. 집착하면 허전하지만, 내려놓으면 예상치 못한 돌파구가 열려요.
                </p>
              </div>
            </div>
          </LocalFadeIn>

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
                  style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </div>
              </div>
            </button>
          </LocalFadeIn>

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
