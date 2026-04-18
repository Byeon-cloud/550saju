import { Solar, type EightChar, type Lunar } from 'lunar-javascript';
import type { SajuInput, SajuData, Pillar, OhengDistribution, SipSung, JiJangGan, UnYoung, DaeUn, NaPeum, SinSal, GongMang, HyungChungHap, SipSungDistribution, MyeongriAnalysis, OhengType } from '@/types/saju';
import { CHEONGAN_OHENG, JIJI_OHENG, CHEONGAN_KO, JIJI_KO, CHEONGAN_EUMYANG, JIJI_EUMYANG } from '@/constants/oheng';

/**
 * lunar-javascript를 사용하여 사주 전체 데이터를 계산합니다.
 */
export function calculateSaju(input: SajuInput): SajuData {
  const solar = input.hasBirthTime
    ? Solar.fromYmdHms(input.birthYear, input.birthMonth, input.birthDay, input.birthHour!, input.birthMinute!, 0)
    : Solar.fromYmd(input.birthYear, input.birthMonth, input.birthDay);

  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();

  const pillars = extractPillars(ec, input.hasBirthTime);
  const elements = calculateElements(pillars);
  const sipsung = extractSipsung(ec, input.hasBirthTime);
  const jijanggan = extractJijanggan(ec, input.hasBirthTime);
  const unyoung12 = extractUnyoung12(ec, input.hasBirthTime);
  const daeun = extractDaeun(ec, input.gender === 'male' ? 1 : 0);
  const napeum = extractNapeum(ec, input.hasBirthTime);
  const gilsin = extractSinsal(lunar.getDayJiShen(), 'gilsin');
  const hyungsal = extractSinsal(lunar.getDayXiongSha(), 'hyungsal');
  const gongmang = extractGongmang(lunar);
  const currentDaeun = findCurrentDaeun(daeun, input.birthYear);
  const myeongriAnalysis = analyzeMyeongri(pillars, sipsung, input.hasBirthTime);

  return {
    input,
    pillars,
    elements,
    sipsung,
    jijanggan,
    unyoung12,
    daeun,
    napeum,
    gilsin,
    hyungsal,
    gongmang,
    currentDaeun,
    yearlyUn: getYearlyUn(new Date().getFullYear()),
    띠: lunar.getYearShengXiao(),
    myeongriAnalysis,
  };
}

function extractPillars(ec: EightChar, hasBirthTime: boolean): Pillar[] {
  const positions = ['year', 'month', 'day', 'time'] as const;
  const ganFns = [() => ec.getYearGan(), () => ec.getMonthGan(), () => ec.getDayGan(), () => ec.getTimeGan()];
  const zhiFns = [() => ec.getYearZhi(), () => ec.getMonthZhi(), () => ec.getDayZhi(), () => ec.getTimeZhi()];

  return positions.map((pos, i) => {
    const available = pos !== 'time' || hasBirthTime;
    const gan = available ? ganFns[i]() : '';
    const zhi = available ? zhiFns[i]() : '';

    return {
      position: pos,
      천간: gan,
      지지: zhi,
      천간읽기: gan ? (CHEONGAN_KO[gan] ?? gan) : '',
      지지읽기: zhi ? (JIJI_KO[zhi] ?? zhi) : '',
      천간오행: gan ? CHEONGAN_OHENG[gan] : '토',
      지지오행: zhi ? JIJI_OHENG[zhi] : '토',
      천간음양: gan ? CHEONGAN_EUMYANG[gan] : '양',
      지지음양: zhi ? JIJI_EUMYANG[zhi] : '양',
      available,
    } as Pillar;
  });
}

function calculateElements(pillars: Pillar[]): OhengDistribution {
  const dist: OhengDistribution = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const p of pillars) {
    if (!p.available) continue;
    if (p.천간오행) dist[p.천간오행]++;
    if (p.지지오행) dist[p.지지오행]++;
  }
  return dist;
}

function extractSipsung(ec: EightChar, hasBirthTime: boolean): SipSung[] {
  const result: SipSung[] = [
    { position: '년간', 글자: ec.getYearGan(), 십성: ec.getYearShiShenGan(), 십성한자: '', 의미: '' },
    { position: '월간', 글자: ec.getMonthGan(), 십성: ec.getMonthShiShenGan(), 십성한자: '', 의미: '' },
    { position: '일간', 글자: ec.getDayGan(), 십성: '일주', 십성한자: '日主', 의미: '나 자신' },
    { position: '년지', 글자: ec.getYearZhi(), 십성: ec.getYearShiShenZhi().join('/'), 십성한자: '', 의미: '' },
    { position: '월지', 글자: ec.getMonthZhi(), 십성: ec.getMonthShiShenZhi().join('/'), 십성한자: '', 의미: '' },
    { position: '일지', 글자: ec.getDayZhi(), 십성: ec.getDayShiShenZhi().join('/'), 십성한자: '', 의미: '' },
  ];
  if (hasBirthTime) {
    result.push(
      { position: '시간', 글자: ec.getTimeGan(), 십성: ec.getTimeShiShenGan(), 십성한자: '', 의미: '' },
      { position: '시지', 글자: ec.getTimeZhi(), 십성: ec.getTimeShiShenZhi().join('/'), 십성한자: '', 의미: '' },
    );
  }
  return result;
}

function extractJijanggan(ec: EightChar, hasBirthTime: boolean): JiJangGan[] {
  const result: JiJangGan[] = [
    { 지지: ec.getYearZhi(), 지장간: ec.getYearHideGan(), 십성: ec.getYearShiShenZhi() },
    { 지지: ec.getMonthZhi(), 지장간: ec.getMonthHideGan(), 십성: ec.getMonthShiShenZhi() },
    { 지지: ec.getDayZhi(), 지장간: ec.getDayHideGan(), 십성: ec.getDayShiShenZhi() },
  ];
  if (hasBirthTime) {
    result.push({ 지지: ec.getTimeZhi(), 지장간: ec.getTimeHideGan(), 십성: ec.getTimeShiShenZhi() });
  }
  return result;
}

function extractUnyoung12(ec: EightChar, hasBirthTime: boolean): UnYoung[] {
  const result: UnYoung[] = [
    { position: '년지', 운성: ec.getYearDiShi(), 운성한자: '', 의미: '' },
    { position: '월지', 운성: ec.getMonthDiShi(), 운성한자: '', 의미: '' },
    { position: '일지', 운성: ec.getDayDiShi(), 운성한자: '', 의미: '' },
  ];
  if (hasBirthTime) {
    result.push({ position: '시지', 운성: ec.getTimeDiShi(), 운성한자: '', 의미: '' });
  }
  return result;
}

function extractDaeun(ec: EightChar, genderFlag: number): DaeUn[] {
  const yun = ec.getYun(genderFlag);
  const daYuns = yun.getDaYun();

  return daYuns.map((d, i) => ({
    순번: i + 1,
    시작나이: d.getStartAge(),
    끝나이: d.getEndAge(),
    천간: d.getGanZhi().charAt(0),
    지지: d.getGanZhi().charAt(1),
    간지: d.getGanZhi(),
    isCurrent: false,
  }));
}

function findCurrentDaeun(daeunList: DaeUn[], birthYear: number): DaeUn | undefined {
  const currentAge = new Date().getFullYear() - birthYear;
  const found = daeunList.find(d => currentAge >= d.시작나이 && currentAge <= d.끝나이);
  if (found) found.isCurrent = true;
  return found;
}

function extractNapeum(ec: EightChar, hasBirthTime: boolean): NaPeum[] {
  const result: NaPeum[] = [
    { position: '년주', 납음: ec.getYearNaYin(), 납음한자: '', 의미: '' },
    { position: '월주', 납음: ec.getMonthNaYin(), 납음한자: '', 의미: '' },
    { position: '일주', 납음: ec.getDayNaYin(), 납음한자: '', 의미: '' },
  ];
  if (hasBirthTime) {
    result.push({ position: '시주', 납음: ec.getTimeNaYin(), 납음한자: '', 의미: '' });
  }
  return result;
}

function extractSinsal(list: string[], type: 'gilsin' | 'hyungsal'): SinSal[] {
  return list.map(name => ({
    이름: name,
    이름한자: name,
    의미: '',
    type,
  }));
}

function extractGongmang(lunar: Lunar): GongMang[] {
  return [
    { 기준: '년주', 순: '', 공망: lunar.getYearXunKong(), 의미: '' },
    { 기준: '일주', 순: '', 공망: lunar.getDayXunKong(), 의미: '' },
  ];
}

function getYearlyUn(year: number): { 천간: string; 지지: string; 간지: string } {
  const solar = Solar.fromYmd(year, 6, 1);
  const lunar = solar.getLunar();
  const yearGan = lunar.getYearGan();
  const yearZhi = lunar.getYearZhi();
  return { 천간: yearGan, 지지: yearZhi, 간지: `${yearGan}${yearZhi}` };
}

// ─── 명리학 구조 분석 ───

/** 오행상생: A가 B를 생하는 관계 */
const OHENG_SAENG: Record<string, OhengType> = {
  목: '화', 화: '토', 토: '금', 금: '수', 수: '목',
};

/** 십성 → 5분류 매핑 (중국어/한국어 모두 지원) */
const SIPSUNG_CATEGORY: Record<string, keyof SipSungDistribution> = {
  '比肩': '비겁', '劫財': '비겁', '비견': '비겁', '겁재': '비겁',
  '食神': '식상', '傷官': '식상', '식신': '식상', '상관': '식상',
  '正財': '재성', '偏財': '재성', '정재': '재성', '편재': '재성',
  '正官': '관성', '七殺': '관성', '偏官': '관성', '정관': '관성', '편관': '관성', '칠살': '관성',
  '正印': '인성', '偏印': '인성', '정인': '인성', '편인': '인성',
};

/** 지지 충(沖) 상대 */
const JIJI_CHUNG: Record<string, string> = {
  子: '午', 午: '子', 丑: '未', 未: '丑',
  寅: '申', 申: '寅', 卯: '酉', 酉: '卯',
  辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
};

/** 지지 육합(六合) 쌍 */
const JIJI_HAP_PAIRS: [string, string][] = [
  ['子', '丑'], ['寅', '亥'], ['卯', '戌'],
  ['辰', '酉'], ['巳', '申'], ['午', '未'],
];

/** 천간 오합(五合) 쌍 */
const CHEONGAN_HAP_PAIRS: [string, string][] = [
  ['甲', '己'], ['乙', '庚'], ['丙', '辛'],
  ['丁', '壬'], ['戊', '癸'],
];

/** 지지 형(刑) — 삼형살 + 자형 */
const JIJI_HYUNG_PAIRS: [string, string, string][] = [
  ['寅', '巳', '무은지형'], ['巳', '申', '무은지형'], ['寅', '申', '무은지형'],
  ['丑', '未', '무례지형'], ['未', '戌', '무례지형'], ['丑', '戌', '무례지형'],
  ['子', '卯', '무례지형'],
  ['辰', '辰', '자형'], ['午', '午', '자형'], ['酉', '酉', '자형'], ['亥', '亥', '자형'],
];

/** 득령 판단: 월지 오행이 일간을 생하거나 같은 오행이면 득령 */
function checkDeukryeong(ilganOheng: OhengType, woljiOheng: OhengType): boolean {
  if (ilganOheng === woljiOheng) return true;
  return OHENG_SAENG[woljiOheng] === ilganOheng; // 월지가 일간을 생
}

/** 십성 5분류 분포 카운트 */
function countSipsung(sipsung: SipSung[]): SipSungDistribution {
  const dist: SipSungDistribution = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const s of sipsung) {
    if (s.십성 === '일주' || s.십성 === '日主') continue;
    const parts = s.십성.split('/');
    for (const part of parts) {
      const cat = SIPSUNG_CATEGORY[part.trim()];
      if (cat) dist[cat]++;
    }
  }
  return dist;
}

/** 사주 내 형충합 관계 검출 */
function detectHyungChungHap(pillars: Pillar[], hasBirthTime: boolean): HyungChungHap[] {
  const results: HyungChungHap[] = [];
  const posLabels = ['년', '월', '일', '시'];
  const maxIdx = hasBirthTime ? 4 : 3;

  for (let i = 0; i < maxIdx; i++) {
    for (let j = i + 1; j < maxIdx; j++) {
      const z1 = pillars[i]?.지지;
      const z2 = pillars[j]?.지지;
      if (!z1 || !z2) continue;

      // 충(沖)
      if (JIJI_CHUNG[z1] === z2) {
        results.push({ type: '충', target: '지지', positions: [`${posLabels[i]}지`, `${posLabels[j]}지`], chars: [z1, z2], desc: `${z1}${z2}충(沖)` });
      }

      // 합(合)
      for (const [a, b] of JIJI_HAP_PAIRS) {
        if ((z1 === a && z2 === b) || (z1 === b && z2 === a)) {
          results.push({ type: '합', target: '지지', positions: [`${posLabels[i]}지`, `${posLabels[j]}지`], chars: [z1, z2], desc: `${z1}${z2}합(合)` });
        }
      }

      // 형(刑)
      for (const [a, b, name] of JIJI_HYUNG_PAIRS) {
        if ((z1 === a && z2 === b) || (z1 === b && z2 === a)) {
          results.push({ type: '형', target: '지지', positions: [`${posLabels[i]}지`, `${posLabels[j]}지`], chars: [z1, z2], desc: `${z1}${z2}형(刑) — ${name}` });
        }
      }
    }
  }

  // 천간합
  for (let i = 0; i < maxIdx; i++) {
    for (let j = i + 1; j < maxIdx; j++) {
      const g1 = pillars[i]?.천간;
      const g2 = pillars[j]?.천간;
      if (!g1 || !g2) continue;
      for (const [a, b] of CHEONGAN_HAP_PAIRS) {
        if ((g1 === a && g2 === b) || (g1 === b && g2 === a)) {
          results.push({ type: '합', target: '천간', positions: [`${posLabels[i]}간`, `${posLabels[j]}간`], chars: [g1, g2], desc: `${g1}${g2}합(合)` });
        }
      }
    }
  }

  return results;
}

/** 일간 강약 경향 추정 */
function estimateStrength(
  _ilganOheng: OhengType,
  deukryeong: boolean,
  dist: SipSungDistribution,
): { gangYak: MyeongriAnalysis['일간강약']; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // 득령 (가장 중요, 배점 3)
  if (deukryeong) { score += 3; reasons.push('득령(+3)'); }
  else { score -= 2; reasons.push('실령(-2)'); }

  // 비겁 — 동일 오행, 일간 돕기
  if (dist.비겁 > 0) { score += dist.비겁; reasons.push(`비겁${dist.비겁}(+${dist.비겁})`); }

  // 인성 — 일간을 생하는 오행
  if (dist.인성 > 0) { score += dist.인성; reasons.push(`인성${dist.인성}(+${dist.인성})`); }

  // 식상 — 일간 기운 소모
  if (dist.식상 > 0) { score -= dist.식상; reasons.push(`식상${dist.식상}(-${dist.식상})`); }

  // 재성 — 일간 기운 소모
  if (dist.재성 > 0) { score -= dist.재성; reasons.push(`재성${dist.재성}(-${dist.재성})`); }

  // 관성 — 일간 억압 (가중치)
  if (dist.관성 > 0) { score -= Math.round(dist.관성 * 1.5); reasons.push(`관성${dist.관성}(-${Math.round(dist.관성 * 1.5)})`); }

  const reason = reasons.join(', ');
  if (score >= 2) return { gangYak: '신강경향', reason };
  if (score <= -2) return { gangYak: '신약경향', reason };
  return { gangYak: '중화', reason };
}

/** 종합 명리학 분석 */
function analyzeMyeongri(pillars: Pillar[], sipsung: SipSung[], hasBirthTime: boolean): MyeongriAnalysis {
  const ilgan = pillars[2]?.천간 || '';
  const ilganOheng = pillars[2]?.천간오행 || '토';
  const wolji = pillars[1]?.지지 || '';
  const woljiOheng = pillars[1]?.지지오행 || '토';

  const deukryeong = checkDeukryeong(ilganOheng, woljiOheng);
  const sipsungDist = countSipsung(sipsung);
  const hyungchunghap = detectHyungChungHap(pillars, hasBirthTime);
  const { gangYak, reason } = estimateStrength(ilganOheng, deukryeong, sipsungDist);

  return {
    일간: ilgan,
    일간오행: ilganOheng,
    월령: wolji,
    월령오행: woljiOheng,
    득령: deukryeong,
    십성분포: sipsungDist,
    형충합: hyungchunghap,
    일간강약: gangYak,
    강약근거: reason,
  };
}
