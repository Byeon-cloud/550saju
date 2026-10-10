// Phase A (#54) — extracted from ResultPage.tsx (lines 29-727)
// Types · constants · mappers · DBs · interpretation helpers
// 0 behavior change vs original

import { calculateSaju } from '@/services/saju/calculator';
import { findCurrentDaeun } from '@/services/saju/daeunCurrent';
import { CHEONGAN_OHENG, CHEONGAN_KO, JIJI_KO, JIJI_OHENG } from '@/constants/oheng';
import type { OhengType, Pillar, SajuData, DaeUn, SipSung, UnYoung, NaPeum, SinSal, GongMang } from '@/types/saju';

// ─── Element color config ───
export type ElemKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export interface ElemColor {
  main: string;
  light: string;
  med: string;
  dark: string;
  grad: string;
}

export const EC: Record<ElemKey, ElemColor> = {
  wood: { main: '#4E7A57', light: '#E7EFE6', med: '#a5d6a7', dark: '#355A3E', grad: 'linear-gradient(135deg,#E7EFE6,#c8e6c9)' },
  fire: { main: '#B04A38', light: '#F6E5E0', med: '#ef9a9a', dark: '#8A3326', grad: 'linear-gradient(135deg,#F6E5E0,#ffcdd2)' },
  earth: { main: '#B07F38', light: '#F5EBD9', med: '#ffe082', dark: '#8A6226', grad: 'linear-gradient(135deg,#F5EBD9,#ffecb3)' },
  metal: { main: '#7D7870', light: '#EEECE8', med: '#e0e0e0', dark: '#57534D', grad: 'linear-gradient(135deg,#EEECE8,#e0e0e0)' },
  water: { main: '#3E5F82', light: '#E4EAF1', med: '#90caf9', dark: '#2A4560', grad: 'linear-gradient(135deg,#E4EAF1,#bbdefb)' },
};
export const EKR: Record<ElemKey, string> = { wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)' };
export const EHAN: Record<ElemKey, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };

// ─── 오행 한글→영문 변환 ───
export const OHENG_TO_ELEM: Record<OhengType, ElemKey> = { 목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water' };
export const OHENG_KR_LABEL: Record<OhengType, string> = { 목: '목', 화: '화', 토: '토', 금: '금', 수: '수' };

// ─── Demo data generator ───
export function getDemoData(): SajuData {
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
export interface V4Pillar {
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

export interface V4Unyoung {
  pillar: string;
  value: string;
  kr: string;
  color: string;
  meaning: string;
}

export interface V4Daeun {
  age: string;
  gz: string;
  kr: string;
  elem: ElemKey;
  label: string;
  period: string;
  current?: boolean;
  /** 2026-05-04: AI 또는 명리학적 계산으로 산출된 점수 (0-100). 없으면 클라이언트 fallback. */
  score?: number;
  /** AI 가 보낸 한 줄 풀이 (대운 추이 차트 캡션용) */
  scoreReason?: string;
}

export interface V4Napeum {
  pillar: string;
  hanja: string;
  kr: string;
  icon: string;
  desc: string;
}

export interface V4SinSal {
  hanja: string;
  kr: string;
  desc: string;
  source: string; // 어떤 기준의 신살인지 (예: "일주")
}

export interface V4GongMang {
  basis: string;
  value: string;
  kr: string;
  meaning: string;
  category: string;
  tip: string;
}

export interface V4Elements {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
}

// ─── Data mapping functions ───
export const POSITION_LABELS: Record<string, { label: string; sub: string; desc: string }> = {
  year: { label: '년주', sub: '年柱', desc: '조상, 사회, 어린시절' },
  month: { label: '월주', sub: '月柱', desc: '부모, 직장, 청년기' },
  day: { label: '일주', sub: '日柱', desc: '나, 배우자, 중년기' },
  time: { label: '시주', sub: '時柱', desc: '자녀, 말년, 결과물' },
};

export function mapPillars(pillars: Pillar[], sipsung: SipSung[]): V4Pillar[] {
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

export function mapElements(elements: Record<OhengType, number>): V4Elements {
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

export function getUnyoungColor(value: string): string {
  // Map Chinese 12운성 values to colors
  const green = ['長生', '长生', '冠帶', '冠带', '臨官', '临官', '帝旺'];
  const orange = ['衰', '病', '墓', '絶', '绝', '養', '养', '胎'];
  const red = ['死'];
  if (green.some(v => value.includes(v))) return '#27ae60';
  if (red.some(v => value.includes(v))) return '#e74c3c';
  if (orange.some(v => value.includes(v))) return '#e67e22';
  return '#8b7e6f';
}

export function getUnyoungKr(value: string): string {
  const map: Record<string, string> = {
    '長生': '장생', '长生': '장생', '沐浴': '목욕', '冠帶': '관대', '冠带': '관대',
    '臨官': '임관', '临官': '임관', '帝旺': '제왕', '衰': '쇠',
    '病': '병', '死': '사', '墓': '묘', '絶': '절', '绝': '절',
    '胎': '태', '養': '양', '养': '양',
  };
  return map[value] ?? value;
}

export function getUnyoungMeaning(value: string, position: string): string {
  const kr = getUnyoungKr(value);
  const posLabel = position;
  if (kr === '장생') return `${posLabel}에서 생명력이 넘침! 끊임없이 새로운 것을 만들어내는 에너지.`;
  if (kr === '사') {
    if (posLabel.includes('년')) return '에너지가 내면으로 수렴. 겉으로 과시하기보다 내면의 깊이를 추구합니다.';
    if (posLabel.includes('월')) return '직장과 사회에서도 내면 지향. 겉으로 드러내지 않는 실력자 타입.';
    return '에너지가 내면으로 수렴되는 상태.';
  }
  if (kr === '병') return '결과물과 말년 영역의 에너지가 약해지는 단계. 건강 관리와 무리하지 않는 페이스 조절이 중요.';
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

export function mapUnyoung12(unyoung: UnYoung[], pillars: Pillar[]): V4Unyoung[] {
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

/**
 * AI daeunPeriods 응답 형식 (선택 · 없으면 fallback 사용):
 * [{ age: '9~18세', score: 65, reason: '한 줄 풀이' }, ...]
 */
export interface AiDaeunPeriod {
  age?: string;
  score?: number;
  reason?: string;
}

export function mapDaeun(
  daeunList: DaeUn[],
  birthYear: number,
  aiPeriods?: AiDaeunPeriod[],
): V4Daeun[] {
  // 2026-07 fix — 렌더 최종 방어선: 저장/네비 state 로 넘어온 stale isCurrent 를 오늘 기준으로 재계산.
  //   (유저 제보 "기축대운인데 무자대운 표시" — 저장 시점 플래그가 렌더까지 그대로 오던 문제)
  findCurrentDaeun(daeunList, birthYear);
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
    const ageStr = `${d.시작나이}~${d.끝나이}세`;
    // AI score 매칭 — age 문자열 기준
    const aiMatch = aiPeriods?.find((p) => p.age && p.age.replace(/\s/g, '') === ageStr.replace(/\s/g, ''));
    return {
      age: ageStr,
      gz: d.간지,
      kr: `${ganKr}${zhiKr}`,
      elem,
      label,
      // 시작나이는 세는나이 → 실제 연도 = 출생연 + 나이 - 1. 신규 데이터는 시작년도 필드 우선 (2026-07 +1년 어긋남 fix)
      period: `${d.시작년도 ?? (birthYear + d.시작나이 - 1)}~${d.끝년도 ?? (birthYear + d.끝나이 - 1)}`,
      current: d.isCurrent,
      score: typeof aiMatch?.score === 'number' && aiMatch.score >= 0 && aiMatch.score <= 100
        ? aiMatch.score
        : undefined,
      scoreReason: aiMatch?.reason,
    };
  });
}

export function getNapeumIcon(napeum: string): string {
  if (napeum.includes('火') || napeum.includes('화')) return '火';
  if (napeum.includes('水') || napeum.includes('수')) return '水';
  if (napeum.includes('土') || napeum.includes('토')) return '土';
  if (napeum.includes('金') || napeum.includes('금')) return '金';
  if (napeum.includes('木') || napeum.includes('목')) return '木';
  return '音';
}

export function getNapeumDesc(napeum: string): string {
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

export function getNapeumPracticalTip(napeum: string): string {
  const tips: Record<string, string> = {
    '城头土': '큰 그림을 보는 능력이 강해요. 전략적 사고, 기획, 관리에 유리하고 남들이 못 보는 기회를 포착하는 타입이에요.',
    '城頭土': '큰 그림을 보는 능력이 강해요. 전략적 사고, 기획, 관리에 유리하고 남들이 못 보는 기회를 포착하는 타입이에요.',
    '大溪水': '깊이 파고드는 능력이 뛰어나요. 한 분야를 오래 파면 전문가가 되고, 연구, 분석, 학습에 재능이 있어요.',
    '大驿土': '사람들이 자연스럽게 모이는 체질이에요. 네트워킹, 커뮤니티, 서비스업에 강하고, 인맥이 재산이 되는 타입이에요.',
    '大驛土': '사람들이 자연스럽게 모이는 체질이에요. 네트워킹, 커뮤니티, 서비스업에 강하고, 인맥이 재산이 되는 타입이에요.',
    '炉中火': '겉으론 조용하지만 작업에 몰입하면 폭발적 집중력을 보여줘요. 창작, 예술, 개발에 강점이에요.',
    '爐中火': '겉으론 조용하지만 작업에 몰입하면 폭발적 집중력을 보여줘요. 창작, 예술, 개발에 강점이에요.',
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

export function mapNapeum(napeumList: NaPeum[]): V4Napeum[] {
  return napeumList.map(n => ({
    pillar: n.position,
    hanja: n.납음,
    kr: n.납음한자 || n.납음,
    icon: getNapeumIcon(n.납음),
    desc: getNapeumDesc(n.납음),
  }));
}

// ─── 신살 한글 읽기 + 설명 데이터베이스 ───
export const SINSAL_KR: Record<string, string> = {
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
  // 12신살 + 주요 신살 (한글 매핑 누락 방지)
  桃花殺: '도화살', 桃花: '도화', 紅艶殺: '홍염살', 紅艷殺: '홍염살', 紅艶: '홍염', 紅艷: '홍염',
  華蓋殺: '화개살', 華蓋: '화개', 空亡: '공망', 將星: '장성', 攀鞍: '반안', 歲驛: '세역',
  亡神: '망신', 月空: '월공', 驛馬殺: '역마살',
  // 일진 길흉신 추가
  相日: '상일', 死神: '사신', 死氣: '사기', 死气: '사기',
  時陰: '시음', 时阴: '시음', 陰錯: '음착', 阴错: '음착',
  陽錯: '양착', 阳错: '양착', 母倉日: '모창일', 母仓日: '모창일',
  天后: '천후', 玄武: '현무', 大時: '대시', 大时: '대시',
  小耗: '소모', 小時: '소시', 小时: '소시', 月害神: '월해신',
  月厭日: '월염일', 月厭神: '월염신',
  孤辰: '고진', 寡宿: '과숙', 紅鸞: '홍란', 红鸾: '홍란',
  天喜星: '천희성',
  // 일진 추가 (lunar-javascript 결과에서 자주 등장하는 한자만)
  王日: '왕일', 宝光: '보광', 寶光: '보광', 月建: '월건', 月恩: '월은',
  天醫日: '천의일', 天医日: '천의일', 福生日: '복생일', 旺日: '왕일',
  四相: '사상', 平日: '평일', 收日: '수일', 開日: '개일', 开日: '개일',
  滿日: '만일', 满日: '만일', 成日: '성일', 除日: '제일',
  建日: '건일', 閉日: '폐일', 闭日: '폐일',
  天牢: '천뢰', 司命: '사명', 玄武日: '현무일', 黑道: '흑도',
  黄道: '황도', 黃道: '황도', 黑黄道: '흑황도', 黑黃道: '흑황도',
  亥日: '해일', 子日: '자일', 寅日: '인일', 卯日: '묘일',
  辰日: '진일', 巳日: '사일', 午日: '오일', 未日: '미일',
  申日: '신일', 酉日: '유일', 戌日: '술일', 丑日: '축일',
  // 귀인계
  天乙貴人: '천을귀인', 天乙贵人: '천을귀인', 文昌貴人: '문창귀인', 文昌贵人: '문창귀인',
  學堂貴人: '학당귀인', 学堂贵人: '학당귀인', 月德貴人: '월덕귀인', 月德贵人: '월덕귀인',
  福星貴人: '복성귀인', 福星贵人: '복성귀인', 太極貴人: '태극귀인', 太极贵人: '태극귀인',
  金輿: '금여', 金舆: '금여', 金輿祿: '금여록', 金舆禄: '금여록',
  // 흉살
  魁罡: '괴강', 魁罡殺: '괴강살', 羊刃: '양인', 羊刃殺: '양인살', 陽刃: '양인', 阳刃: '양인',
  白虎殺: '백호살', 湯火殺: '탕화살', 湯火: '탕화', 天羅: '천라', 地網: '지망',
  鬼門: '귀문', 鬼門殺: '귀문살', 怨嗔: '원진', 怨嗔殺: '원진살',
};

export const SINSAL_DESC: Record<string, string> = {
  // 길신 — 구체적 설명
  天恩: '위기 때 예상 못한 도움이 들어오는 기운. 귀인이 알아서 찾아오는 체질',
  陰德: '남몰래 베푼 선행이 복으로 돌아오는 운. 드러내지 않을수록 더 커짐', 阴德: '남몰래 베푼 선행이 복으로 돌아오는 운. 드러내지 않을수록 더 커짐',
  福生: '타고난 복 체질. 큰 노력 없이도 자연스럽게 좋은 기회가 따르는 편',
  除神: '장애물과 방해를 제거하는 힘. 난관을 돌파하는 추진력이 있음',
  玉堂: '학문과 배움에서 귀인을 만남. 자격증과 학위 취득에 유리',
  鳴吠: '말과 글로 사람을 움직이는 힘. 콘텐츠, 발표, 설득에 재능', 鸣吠: '말과 글로 사람을 움직이는 힘. 콘텐츠, 발표, 설득에 재능',
  天德: '하늘이 보호하는 기운. 큰 위기에서도 무사히 넘기는 수호 에너지',
  月德: '매월 꾸준히 들어오는 소소한 행운. 복리처럼 쌓이는 타입',
  天喜: '경사스러운 일이 잘 찾아옴. 결혼, 승진, 합격 등 기쁜 소식과 인연',
  天赦: '실수해도 용서받는 운. 위기를 기회로 전환하는 능력',
  天福: '타고난 복이 깊음. 물질적과 정신적 풍요가 함께 따르는 기운',
  天巫: '영적 감각이 뛰어남. 직감이 정확하고 사람의 속마음을 잘 읽음',
  福德: '덕을 베풀수록 복이 커지는 구조. 나눔이 곧 투자',
  聖心: '마음이 순수하고 선한 에너지. 진심이 통하는 관계를 맺음', 圣心: '마음이 순수하고 선한 에너지. 진심이 통하는 관계를 맺음',
  五合: '화합하는 힘. 사람들을 연결하고 중재하는 능력이 뛰어남',
  六合: '인연을 맺는 힘이 강함. 좋은 파트너와 동료를 만나는 운',
  天成: '하고자 하는 일이 자연스럽게 이루어지는 기운',
  天官: '사회적 지위와 명예를 얻는 힘. 승진과 인정과 인연이 깊음',
  母倉: '양육과 보살핌의 에너지. 사람을 키우고 성장시키는 데 재능', 母仓: '양육과 보살핌의 에너지. 사람을 키우고 성장시키는 데 재능',
  天馬: '이동과 변화에서 기회를 잡음. 여행, 이직, 이사가 행운으로 연결', 天马: '이동과 변화에서 기회를 잡음. 여행, 이직, 이사가 행운으로 연결',
  解神: '복잡한 문제를 풀어내는 힘. 갈등 해결과 중재에 강점',
  驛馬: '활동적 에너지. 움직일수록 운이 트이는 타입', 驿马: '활동적 에너지. 움직일수록 운이 트이는 타입',
  陽德: '베풀면 되돌아오는 기운. 밝고 따뜻한 에너지가 주변에 전파', 阳德: '베풀면 되돌아오는 기운. 밝고 따뜻한 에너지가 주변에 전파',
  生氣: '생명력과 활력이 넘침. 새로운 시작에 유리한 기운', 生气: '생명력과 활력이 넘침. 새로운 시작에 유리한 기운',
  時德: '때를 잘 만나는 운. 타이밍이 잘 맞아떨어지는 사람', 时德: '때를 잘 만나는 운. 타이밍이 잘 맞아떨어지는 사람',
  天醫: '치유의 기운. 의료, 상담, 힐링 분야에 적성이 있음', 天医: '치유의 기운. 의료, 상담, 힐링 분야에 적성이 있음',
  守日: '지키는 힘이 강함. 맡은 일을 끝까지 완수하는 끈기',
  三合: '세 가지 기운이 조화를 이룸. 팀워크와 협업에서 빛남',
  要安: '안정의 기운. 혼란 속에서도 중심을 잡는 능력',
  不將: '조용히 실력을 쌓는 타입. 겉으로 드러나지 않지만 실속이 있음', 不将: '조용히 실력을 쌓는 타입. 겉으로 드러나지 않지만 실속이 있음',
  普護: '두루 보호받는 기운. 위험한 상황에서도 안전한 편', 普护: '두루 보호받는 기운. 위험한 상황에서도 안전한 편',
  // 일진 길흉신 의미 보강 (lunar-javascript 자주 등장)
  王日: '왕성한 기운이 도는 자리. 큰 결정, 발표, 승부수에 유리한 시기',
  寶光: '귀한 인연과 자산이 들어오는 자리. 모임, 축하, 소개에 적극',
  宝光: '귀한 인연과 자산이 들어오는 자리. 모임, 축하, 소개에 적극',
  月建: '한 달의 기준이 되는 자리. 월초 계획과 체크리스트가 흐름을 좌우',
  月恩: '주변의 도움이 들어오는 자리. 어려운 일은 혼자 끌고가지 마세요',
  四相: '사방에서 작용하는 자리. 균형 감각이 핵심',
  平日: '평탄과 안정의 자리. 큰 변화보다 일상 정돈에 좋은 시기',
  收日: '거두는 자리. 미뤄둔 마무리와 정산에 적합',
  開日: '열림의 자리. 새 만남과 새 기회에 문이 열림',
  开日: '열림의 자리. 새 만남과 새 기회에 문이 열림',
  滿日: '가득 차는 자리. 결과물 확인과 발표에 유리',
  满日: '가득 차는 자리. 결과물 확인과 발표에 유리',
  成日: '이루어지는 자리. 계약, 결정, 성사에 흐름이 맞음',
  除日: '비우고 정리하는 자리. 불필요한 것 끊기에 좋음',
  建日: '시작과 기초를 세우는 자리. 새 일, 이사, 계약에 길함',
  閉日: '닫는 자리. 새 일보다 마무리와 휴식이 흐름',
  闭日: '닫는 자리. 새 일보다 마무리와 휴식이 흐름',
  天牢: '갇히는 결. 큰 약속과 법적 일은 하루 묵혔다 결정',
  司命: '운명을 주관하는 자리. 큰 결정 전 한 박자 늦추는 연습',
  黃道: '길한 기운이 도는 자리. 적극적 행동에 흐름이 받쳐줌',
  黄道: '길한 기운이 도는 자리. 적극적 행동에 흐름이 받쳐줌',
  黑道: '주의가 필요한 자리. 큰 결정과 여행은 다음 시기로',
  // 일진 길흉신 의미 보강 (lunar-javascript 자주 등장)
  相日: '서로 도움을 주고받는 자리. 협업, 중재, 소개에 유리한 기운',
  死神: '의식적으로 거리를 두면 강점. 무리한 일정과 과로를 가장 경계할 자리',
  死氣: '활기가 떨어지는 자리. 충분한 휴식과 회복 루틴이 필요한 결',
  死气: '활기가 떨어지는 자리. 충분한 휴식과 회복 루틴이 필요한 결',
  時陰: '겉으로 드러내지 않는 결. 안에서 다듬는 일, 연구, 기록에 강점',
  时阴: '겉으로 드러내지 않는 결. 안에서 다듬는 일, 연구, 기록에 강점',
  孤辰: '혼자 있는 시간이 자산이 되는 결. 사색, 창작, 집중 시간을 의식적으로',
  寡宿: '관계의 결이 얇아 깊은 한두 명의 인연이 평생 자산이 되는 자리',
  紅鸞: '인연, 결혼, 만남의 자리. 좋은 인연이 들어오기 쉬운 시기',
  红鸾: '인연, 결혼, 만남의 자리. 좋은 인연이 들어오기 쉬운 시기',
  陰錯: '의도와 결과가 어긋나기 쉬운 자리. 큰 결정 전 한 번 더 검토 필요',
  阴错: '의도와 결과가 어긋나기 쉬운 자리. 큰 결정 전 한 번 더 검토 필요',
  陽錯: '겉으로는 풀린 듯 보이나 본질이 흔들리는 결. 형식보다 내용 우선',
  阳错: '겉으로는 풀린 듯 보이나 본질이 흔들리는 결. 형식보다 내용 우선',
  小耗: '작은 누수가 쌓여 큰 손실이 되는 자리. 고정비와 소액 지출 점검',
  天喜星: '경사와 인연이 들어오는 자리. 모임, 소개, 축하 자리에 적극',
  // 흉살 — 구체적 설명
  月破: '계획이 중간에 깨지기 쉬움. 중요한 일은 백업 플랜 필수',
  大耗: '예상 밖 지출이 발생하기 쉬움. 재정 관리에 각별히 주의',
  災煞: '갑작스러운 사건과 사고에 주의. 안전 불감증이 가장 큰 적', 灾煞: '갑작스러운 사건과 사고에 주의. 안전 불감증이 가장 큰 적',
  天火: '급격한 감정 폭발 주의. 분노 조절과 스트레스 관리가 과제',
  月厌: '주변의 질투나 시기를 받기 쉬움. 성과를 드러내기보다 겸손함이 보호막', 月厭: '주변의 질투나 시기를 받기 쉬움. 성과를 드러내기보다 겸손함이 보호막',
  地火: '가정과 거주 환경에서 문제가 생기기 쉬움. 이사와 인테리어 신중하게',
  五虛: '체력이 바닥나기 쉬운 체질. 규칙적 운동과 충분한 수면이 필수', 五虚: '체력이 바닥나기 쉬운 체질. 규칙적 운동과 충분한 수면이 필수',
  五離: '오해가 생기기 쉬운 체질. 커뮤니케이션에 의식적 노력 필요', 五离: '오해가 생기기 쉬운 체질. 커뮤니케이션에 의식적 노력 필요',
  元武: '속마음을 잘 드러내지 않는 성향. 신뢰하는 사람에겐 열어보는 연습',
  白虎: '급하게 행동하면 다치기 쉬움. 침착함과 안전이 최우선',
  朱雀: '말실수가 큰 화를 부를 수 있음. "한 번 더 생각하고 말하기" 습관화',
  勾陳: '법적 문제와 계약 분쟁에 주의. 전문가 도움을 받는 게 안전', 勾陈: '법적 문제와 계약 분쟁에 주의. 전문가 도움을 받는 게 안전',
  天吏: '관공서와 기관과의 일에 지연 가능. 서류는 미리미리 준비',
  天賊: '도난과 사기 주의. 재물 관리와 보안에 신경 쓸 것', 天贼: '도난과 사기 주의. 재물 관리와 보안에 신경 쓸 것',
  重日: '같은 실수를 반복하기 쉬움. 패턴을 인식하고 의식적으로 바꿀 것',
  復日: '지나간 문제가 재발할 수 있음. 근본 원인을 해결해야 반복 안 됨', 复日: '지나간 문제가 재발할 수 있음. 근본 원인을 해결해야 반복 안 됨',
  歸忌: '귀가와 복귀 시 주의. 여행 후 컨디션 관리 중요', 归忌: '귀가와 복귀 시 주의. 여행 후 컨디션 관리 중요',
  血忌: '건강 검진 꼼꼼히. 특히 혈액과 순환계통 관리',
  血支: '출혈과 수술 주의. 날카로운 것 취급 시 조심',
  月刑: '대인관계에서 마찰이 생기기 쉬움. 양보가 최선의 전략',
  月害: '뜻밖의 방해가 들어올 수 있음. 플랜B 항상 준비',
  遊禍: '외출과 여행 중 사고 주의. 교통 안전 최우선', 游祸: '외출과 여행 중 사고 주의. 교통 안전 최우선',
  九空: '계획이 공중분해될 수 있음. 구두 약속보다 문서 확인',
  致死: '무리한 일정 금지. 과로가 가장 큰 적',
  天罡: '강한 에너지가 폭발할 수 있음. 분노를 제어하는 연습',
  河魁: '예민한 감정 기복에 주의. 명상과 호흡 등 안정 루틴 추천',
  受死: '에너지가 극도로 떨어지는 시기. 무리하지 말고 쉬어갈 것',
  往亡: '방향 감각을 잃기 쉬움. 중요한 결정은 하루 묵혔다가',
  劫煞: '재물 손실에 주의. 투자, 보증, 대출 신중하게', 겁살: '재물 손실에 주의. 투자, 보증, 대출 신중하게',
};

export const SINSAL_TIP: Record<string, string> = {
  // 길신 실전 활용
  天恩: '어려울 때 주변에 도움을 요청하세요. 예상치 못한 귀인이 나타날 확률이 높아요',
  陰德: '남몰래 선행을 베풀면 더 큰 복으로 돌아와요. 기부와 봉사 활동 추천', 阴德: '남몰래 선행을 베풀면 더 큰 복으로 돌아와요. 기부와 봉사 활동 추천',
  福生: '감사 일기를 쓰면 복의 체질이 더 강해져요. 긍정 에너지를 의식적으로 유지하세요',
  除神: '장애물을 만나도 쉽게 돌파하는 힘이 있어요. 어려운 프로젝트에 자원하세요',
  玉堂: '배움과 학문에서 귀인이 나타나요. 자격증과 학위 취득에 유리한 운이에요',
  鳴吠: '글쓰기, 발표, SNS 등 표현 활동에 재능이 있어요. 적극적으로 의견을 내세요', 鸣吠: '글쓰기, 발표, SNS 등 표현 활동에 재능이 있어요. 적극적으로 의견을 내세요',
  天德: '큰 위기에서도 안전하게 넘기는 수호 에너지예요. 과감한 도전에 유리해요',
  月德: '매월 꾸준히 소소한 행운이 따라요. 복권보다 꾸준한 투자가 잘 맞아요',
  天喜: '경사스러운 기회가 잘 찾아와요. 모임이나 네트워킹에 적극 참여하세요',
  天赦: '실수에서 배우는 게 빠른 편이에요. 두려워 말고 새로운 시도를 하세요',
  天福: '베풀수록 더 많이 들어오는 구조예요. 인색하지 않게 나누세요',
  天巫: '명상과 직관 훈련을 하면 감각이 더 날카로워져요. 첫인상을 믿으세요',
  五合: '팀 프로젝트와 협업에서 리더십을 발휘하세요. 사람을 모으는 힘이 있어요',
  六合: '소개팅과 네트워킹에 적극적으로 나서세요. 좋은 인연이 올 확률이 높아요',
  天成: '시작한 일은 대부분 완성되는 기운. 망설이지 말고 행동으로 옮기세요',
  天官: '승진, 자격, 인정이 필요한 시기에 도전하면 유리해요',
  母倉: '후배와 팀원을 이끄는 역할이 잘 맞아요. 멘토링에 시간을 투자하세요', 母仓: '후배와 팀원을 이끄는 역할이 잘 맞아요. 멘토링에 시간을 투자하세요',
  天馬: '출장, 여행, 이사 등 움직임이 행운을 불러와요. 가만히 있지 마세요', 天马: '출장, 여행, 이사 등 움직임이 행운을 불러와요. 가만히 있지 마세요',
  解神: '주변 갈등을 중재하는 역할을 맡아보세요. 신뢰를 얻는 좋은 기회에요',
  驛馬: '해외와 지방 활동이 유리해요. 한 곳에 머물기보다 다양한 경험을 쌓으세요', 驿马: '해외와 지방 활동이 유리해요. 한 곳에 머물기보다 다양한 경험을 쌓으세요',
  生氣: '새 프로젝트를 시작하기에 좋은 기운. 신규 도전에 과감하게 뛰어드세요', 生气: '새 프로젝트를 시작하기에 좋은 기운. 신규 도전에 과감하게 뛰어드세요',
  天醫: '건강 관련 학습과 봉사가 잘 맞아요. 주변의 아픈 사람을 돌보면 덕이 쌓여요', 天医: '건강 관련 학습과 봉사가 잘 맞아요. 주변의 아픈 사람을 돌보면 덕이 쌓여요',
  // 흉살 대처법
  月破: '중요한 약속과 계약은 꼭 서면으로. 구두 약속은 깨지기 쉬워요',
  大耗: '비상금을 꼭 따로 빼놓으세요. 충동구매 금지, 큰 지출은 하루 묵혔다가 결정',
  災煞: '안전벨트와 헬멧 착용 생활화. 위험한 활동은 보험 확인 후에', 灾煞: '안전벨트와 헬멧 착용 생활화. 위험한 활동은 보험 확인 후에',
  天火: '화가 날 때 10초 세고 말하세요. 분노 조절 앱이나 명상이 도움이 돼요',
  月厌: '성과를 자랑하기보다 겸손하게. SNS 과시도 자제하는 게 좋아요', 月厭: '성과를 자랑하기보다 겸손하게. SNS 과시도 자제하는 게 좋아요',
  地火: '집 안 화재 예방 점검. 전기장판과 가스 등 안전 체크',
  五虛: '체력이 바닥날 때가 있어요. 규칙적 운동과 충분한 수면이 최고의 보약이에요', 五虚: '체력이 바닥날 때가 있어요. 규칙적 운동과 충분한 수면이 최고의 보약이에요',
  五離: '오해가 생기기 쉬운 체질이에요. 중요한 말은 카톡보다 직접 만나서 하세요', 五离: '오해가 생기기 쉬운 체질이에요. 중요한 말은 카톡보다 직접 만나서 하세요',
  元武: '속마음을 감추는 편인데, 가까운 사람에겐 먼저 마음을 열어보세요',
  白虎: '급한 결정은 피하고, 운전과 운동 시 안전에 주의하세요. 침착함이 무기예요',
  朱雀: '한 번 더 생각하고 말하는 습관을 들이세요. 말실수가 큰 화를 부를 수 있어요',
  勾陳: '법적 문제와 문서 작업은 전문가 도움을 받으세요. 혼자 처리하면 빠지기 쉬워요', 勾陈: '법적 문제와 문서 작업은 전문가 도움을 받으세요. 혼자 처리하면 빠지기 쉬워요',
  天吏: '계약서와 문서는 하루 묵혔다 결정하세요. 급하게 사인하면 후회할 수 있어요',
  天賊: '비밀번호와 보안 정기 점검. 낯선 링크 클릭 금지, 보이스피싱 주의', 天贼: '비밀번호와 보안 정기 점검. 낯선 링크 클릭 금지, 보이스피싱 주의',
  重日: '같은 실수를 했다면 일기에 적어두세요. 패턴을 인식하는 게 첫걸음이에요',
  復日: '과거 문제가 되살아나면 이번엔 근본 원인을 해결하세요', 复日: '과거 문제가 되살아나면 이번엔 근본 원인을 해결하세요',
  歸忌: '장거리 이동 후엔 충분히 쉬세요. 무리하면 컨디션이 확 떨어져요', 归忌: '장거리 이동 후엔 충분히 쉬세요. 무리하면 컨디션이 확 떨어져요',
  血忌: '정기 건강검진 꼭 받으세요. 특히 혈액검사와 심혈관 체크',
  月刑: '직장과 가정에서 충돌이 생기면 한 발 물러서세요. 양보가 이기는 전략이에요',
  月害: '플랜B를 항상 준비해두세요. 예상치 못한 방해가 들어올 수 있어요',
  九空: '구두 약속은 믿지 마세요. 중요한 건 반드시 문서와 기록으로 남기세요',
  致死: '무리한 일정은 용기 있게 거절하세요. 건강이 최우선이에요',
  受死: '이 시기엔 쉬어가는 게 전략이에요. 큰 결정은 미루세요',
  天罡: '운동과 명상으로 강한 에너지를 긍정적으로 방출하세요',
};

export function getSinsalKr(hanja: string): string {
  return SINSAL_KR[hanja] ?? hanja;
}

export function mapSinSal(list: SinSal[]): V4SinSal[] {
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

export function mapGongmang(list: GongMang[], dayOheng: OhengType, dayGan?: string): V4GongMang[] {
  // 오행 상생상극 관계로 십성 카테고리 결정
  const SANGSAENG_MAP: Record<OhengType, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  const SANGGEUK_MAP: Record<OhengType, OhengType> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };

  // 일간 한자 → 한글 음
  const GAN_TO_KR_LOCAL: Record<string, string> = {
    甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
    己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
  };
  const ganKr = dayGan ? (GAN_TO_KR_LOCAL[dayGan] || dayGan) : '';
  const ganRef = dayGan ? `${ganKr}(${dayGan}) 일간` : '';

  function getSipsungCategory(targetOheng: OhengType): string {
    if (targetOheng === dayOheng) return '비겁';
    if (SANGSAENG_MAP[dayOheng] === targetOheng) return '식상';
    if (SANGGEUK_MAP[dayOheng] === targetOheng) return '재성';
    if (SANGGEUK_MAP[targetOheng] === dayOheng) return '관성';
    if (SANGSAENG_MAP[targetOheng] === dayOheng) return '인성';
    return '';
  }

  // 공망 자리(年/月/日/時) 컨텍스트 매핑
  function getPositionContext(기준: string): { positionKr: string; nuance: string } {
    if (기준.includes('년')) return { positionKr: '年(초년과 뿌리)', nuance: '초년, 가문, 사회 출발' };
    if (기준.includes('월')) return { positionKr: '月(직장과 청년기)', nuance: '직장, 청년기, 형제 인연' };
    if (기준.includes('일')) return { positionKr: '日(나와 배우자궁)', nuance: '나의 본질과 배우자 자리' };
    if (기준.includes('시')) return { positionKr: '時(말년과 자녀)', nuance: '말년, 결과, 자녀' };
    return { positionKr: '', nuance: '' };
  }

  function buildDesc(category: string, posCtx: { positionKr: string; nuance: string }): { desc: string; tip: string } {
    const subjPrefix = ganRef ? `${ganRef}이 ` : '';
    const posPrefix = posCtx.positionKr ? `${posCtx.positionKr} 자리에 ` : '';
    switch (category) {
      case '비겁':
        return {
          desc: `${subjPrefix}${posPrefix}비겁 공망 — 동료, 형제, 자아 영역이 비어 있어 남에게 기대기보다 스스로 서는 힘이 강해요${posCtx.nuance ? ` (${posCtx.nuance})` : ''}.`,
          tip: '혼자서도 잘하는 타입이에요. 동료 관계에서 기대를 줄이고 독립적으로 성취하면 오히려 큰 결과를 얻어요',
        };
      case '식상':
        return {
          desc: `${subjPrefix}${posPrefix}식상 공망 — 표현, 창작, 소통 영역이 비어 있어 남들처럼 표현하면 답답하지만, 나만의 방식을 찾으면 차별화됩니다.`,
          tip: '남들의 표현법을 따라하지 마세요. 자기만의 독특한 방식으로 표현할 때 오히려 강력한 개성이 돼요',
        };
      case '재성':
        return {
          desc: `${subjPrefix}${posPrefix}재성 공망 — 재물과 실리 영역이 비어 있어 돈에 집착하면 오히려 새어나가고, 자유롭게 접근할 때 뜻밖의 경로로 들어옵니다.`,
          tip: '재물에 대한 집착을 내려놓으세요. 하고 싶은 일에 몰입하면 돈은 자연스럽게 따라오는 구조예요',
        };
      case '관성':
        return {
          desc: `${subjPrefix}${posPrefix}관성 공망 — 직장과 사회적 지위 영역이 비어 있어 조직에서 인정받으려 애쓰기보다, 자기 브랜드를 키우면 더 빛납니다.`,
          tip: '대기업과 공무원 같은 안정적 경로보다, 프리랜서, 창업, 자기 사업이 더 잘 맞을 수 있어요. 틀에 얽매이지 마세요',
        };
      case '인성':
        return {
          desc: `${subjPrefix}${posPrefix}인성 공망 — 학문, 배움, 어머니 영역이 비어 있어 정규 교육보다 독학과 실전 경험이 더 빛나는 체질이에요.`,
          tip: '정석적인 공부법에 답답함을 느낄 수 있어요. 실전에서 몸으로 배우는 방식이 훨씬 효율적이에요',
        };
      default:
        return { desc: '', tip: '' };
    }
  }

  return list.map(g => {
    const chars = g.공망.split('');
    const krParts = chars.map(c => JIJI_KO[c] ?? c).join('');
    const elemParts = chars.map(c => {
      const oh = JIJI_OHENG[c];
      return oh ? OHENG_KR_LABEL[oh] : '';
    }).filter(Boolean);
    const elemStr = elemParts.length > 0 ? ` (${[...new Set(elemParts)].join(', ')})` : '';

    // 공망 지지들의 오행으로 십성 카테고리 결정
    const ohengSet = [...new Set(chars.map(c => JIJI_OHENG[c]).filter(Boolean))] as OhengType[];
    const categories = [...new Set(ohengSet.map(oh => getSipsungCategory(oh)))].filter(Boolean);
    const primaryCategory = categories[0] || '';
    const posCtx = getPositionContext(g.기준 || '');
    const built = primaryCategory ? buildDesc(primaryCategory, posCtx) : { desc: '', tip: '' };

    const personalMeaning = built.desc
      || g.의미
      || '비어있는 에너지 — 의식적 보완이 필요합니다';

    return {
      basis: `${g.기준} 공망`,
      value: g.공망,
      kr: `${krParts}${elemStr}`,
      meaning: personalMeaning,
      category: primaryCategory, // 추가 필드
      tip: built.tip || '비어있는 영역이지만, 집착을 내려놓으면 오히려 자유로운 영역이 돼요.',
    };
  });
}

// ─── 해석 가이드 헬퍼 ───

export function getUnyoungEnergyLevel(kr: string): number {
  const scores: Record<string, number> = {
    '제왕': 5, '장생': 5, '임관': 4, '관대': 4, '목욕': 3,
    '양': 2, '태': 2, '쇠': 2, '묘': 1, '병': 1, '사': 1, '절': 0,
  };
  return scores[kr] ?? 2;
}

export function getUnyoungPositionContext(pillar: string): string {
  if (pillar.includes('년')) return '초년과 사회';
  if (pillar.includes('월')) return '직장과 청년기';
  if (pillar.includes('일')) return '나의 본질';
  if (pillar.includes('시')) return '말년과 결과';
  return '';
}

export function getUnyoungSummary(items: V4Unyoung[]): string {
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
    return '전체적으로 에너지가 안으로 수렴되는 구조예요. 조용하지만 깊이있는 타입으로, 독서, 사색, 창작 등 내면을 채우는 활동에서 힘을 얻어요.';
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

export function getDaeunCurrentSummary(daeunList: V4Daeun[]): string {
  const current = daeunList.find(d => d.current);
  if (!current) return '';
  const nextIdx = daeunList.findIndex(d => d.current) + 1;
  const next = nextIdx < daeunList.length ? daeunList[nextIdx] : null;
  const elemDesc: Record<ElemKey, string> = {
    wood: '성장과 확장의 시기예요. 새로운 시작, 배움, 도전이 자연스러운 시기입니다.',
    fire: '열정과 표현의 시기예요. 적극적으로 나서고, 자기 PR에 유리한 시기입니다.',
    earth: '안정과 축적의 시기예요. 기반을 다지고 내실을 챙기는 게 중요해요.',
    metal: '결실과 정리의 시기예요. 불필요한 것을 정리하고 핵심에 집중하세요.',
    water: '지혜와 유연함의 시기예요. 관찰하고 기다리며, 기회를 포착하세요.',
  };
  let text = `지금은 ${current.gz}(${current.kr}) 대운 — ${EKR[current.elem]} 에너지가 지배하는 ${current.age} 시기예요.\n${elemDesc[current.elem]}`;
  if (next) {
    text += `\n\n다음 대운(${next.gz})부터는 ${EKR[next.elem]} 에너지로 전환돼요.`;
  }
  return text;
}

export function getNapeumSummary(items: V4Napeum[]): string {
  const ilju = items.find(n => n.pillar === '일주');
  if (!ilju) {
    return items.length > 0 ? `${items[0].hanja}의 에너지가 기본 바탕이에요.` : '';
  }
  const practical = getNapeumPracticalTip(ilju.hanja);
  return `당신의 근본 에너지는 '${ilju.hanja}'예요. ${ilju.desc}\n\n실생활에서는? ${practical}`;
}

export function getNapeumPositionRole(pillar: string): string {
  const roles: Record<string, string> = {
    '년주': '조상에게서 물려받은 에너지',
    '월주': '사회에서 발현되는 에너지',
    '일주': '나의 가장 근본적인 에너지',
    '시주': '말년에 나타나는 에너지',
  };
  return roles[pillar] ?? '';
}

export function getGilsinActionTip(name: string): string {
  return SINSAL_TIP[name] ?? '이 길신의 에너지를 의식적으로 활용해보세요';
}

export function getHyungsalActionTip(name: string): string {
  return SINSAL_TIP[name] ?? '이 부분을 의식적으로 주의하면 오히려 강점으로 바뀌어요';
}

// getGongmangActionTip — 공망 정보가 V4GongMang.tip에 포함되어 더 이상 사용되지 않음
