import { Solar, type EightChar, type Lunar } from 'lunar-javascript';
import type { SajuInput, SajuData, Pillar, OhengDistribution, SipSung, JiJangGan, UnYoung, DaeUn, NaPeum, SinSal, GongMang, HyungChungHap, SipSungDistribution, MyeongriAnalysis, OhengType } from '@/types/saju';
import { CHEONGAN_OHENG, JIJI_OHENG, CHEONGAN_KO, JIJI_KO, CHEONGAN_EUMYANG, JIJI_EUMYANG } from '@/constants/oheng';
import { correctKoreanSolarTime } from './timeCorrection';

/**
 * lunar-javascript를 사용하여 사주 전체 데이터를 계산합니다.
 *
 * ⚠️ 진태양시 보정 (2026-05) — 한국 출생자 시주 정확도 보장
 *  · 한국 표준시(KST) - 32분 = 서울 진태양시
 *  · 서머타임 기간(1948-51, 55-60) 추가 -60분
 *  · 출생시간 미입력 시 보정 X (시주 자체 미산출)
 */
export function calculateSaju(input: SajuInput): SajuData {
  const solar = input.hasBirthTime
    ? (() => {
        // 한국 진태양시 보정 적용 (입력 KST → 진태양시)
        const [y, mo, d, h, mi, s] = correctKoreanSolarTime(
          input.birthYear,
          input.birthMonth,
          input.birthDay,
          input.birthHour!,
          input.birthMinute!,
          0,
        );
        return Solar.fromYmdHms(y, mo, d, h, mi, s);
      })()
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
  // 2026-06-02 fix — lunar-javascript 가 간체자 십성(七杀·劫财·正财·偏财·伤官) 출력하는데
  //   기존엔 번체(七殺·劫財·正財·偏財·傷官)만 있어 미매칭→미카운트 → 십성분포·강약·격국 오류.
  //   간체 변형 전부 추가 (운성 간체 버그와 동일 클래스).
  '比肩': '비겁', '劫財': '비겁', '劫财': '비겁', '비견': '비겁', '겁재': '비겁',
  '食神': '식상', '傷官': '식상', '伤官': '식상', '식신': '식상', '상관': '식상',
  '正財': '재성', '偏財': '재성', '正财': '재성', '偏财': '재성', '정재': '재성', '편재': '재성',
  '正官': '관성', '七殺': '관성', '七杀': '관성', '偏官': '관성', '정관': '관성', '편관': '관성', '칠살': '관성',
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

/**
 * 2026-06-02 — 강약·격국 판정 전용 가중 십성 카운트 (준기 결정: 지장간 할인).
 *  · 천간 + 지지 본기(지장간 배열 [0]) = 1.0 (힘 있음 · 투출/본기)
 *  · 지지 여기·중기(지장간 배열 [1],[2]) = 0.3 (숨은 글자 · 힘 약함)
 *  근거: 정통 명리학(자평진전·적천수)은 통근/투출을 본기·여기로 차등. 기존엔 지장간을
 *        투출과 동일 가중(+1)해 인성/비겁이 부풀어 종격·신강으로 오판(예: 여름 庚 신강 오판).
 *  ⚠️ 표시용 countSipsung(전부 1) 은 유지 — 사용자 노출 십성분포는 "보유 개수" 의미라 그대로.
 */
const HIDDEN_QI_WEIGHT = 0.3;
function countSipsungWeighted(sipsung: SipSung[]): SipSungDistribution {
  const dist: SipSungDistribution = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const s of sipsung) {
    if (s.십성 === '일주' || s.십성 === '日主') continue;
    const isJiji = typeof s.position === 'string' && s.position.endsWith('지'); // 년지/월지/일지/시지
    const parts = s.십성.split('/');
    parts.forEach((part, idx) => {
      const cat = SIPSUNG_CATEGORY[part.trim()];
      if (!cat) return;
      // 천간(단일) 또는 지지 본기([0]) → 1.0 / 지지 여기·중기 → 할인
      const w = (!isJiji || idx === 0) ? 1.0 : HIDDEN_QI_WEIGHT;
      dist[cat] += w;
    });
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
/**
 * 일간 강약 판정 (자평진전 정통 3단계)
 *
 * 정통 명리 자평진전 / 적천수 분석법:
 *  · 득령(得令): 월지가 일간을 생(生)하거나 비조(比助) → +3
 *  · 득지(得地): 일지가 일간을 부조 (비겁/인성 오행) → +2
 *  · 득세(得勢): 천간 통근 (지지에 같은 오행 뿌리) → +2 per 통근
 *  · 비겁/인성 → 일간 보강 (+)
 *  · 식상/재성/관성 → 일간 소모 (-)
 *
 * 등급: 매우신강 / 신강경향 / 중화 / 신약경향 / 매우신약
 */
function estimateStrength(
  ilganOheng: OhengType,
  deukryeong: boolean,
  dist: SipSungDistribution,
  pillars?: Pillar[],
): { gangYak: MyeongriAnalysis['일간강약']; reason: string; score: number } {
  let score = 0;
  const reasons: string[] = [];

  // 1단계: 득령 (월령 — 가장 중요)
  if (deukryeong) { score += 3; reasons.push('득령(+3)'); }
  else { score -= 2; reasons.push('실령(-2)'); }

  // 2단계: 득지 (일지가 일간 부조 — 비겁 또는 인성 오행)
  if (pillars) {
    const dayJiOheng = pillars[2]?.지지오행 as OhengType | undefined;
    const ilganOhengTyped = ilganOheng as OhengType;
    if (dayJiOheng) {
      const SS_REV: Record<OhengType, OhengType> = {
        목: '수', 화: '목', 토: '화', 금: '토', 수: '금',
      };
      // 일지가 일간과 같은 오행 (비겁) 또는 일간을 생하는 오행 (인성)
      const isDeukJi = dayJiOheng === ilganOhengTyped || SS_REV[ilganOhengTyped] === dayJiOheng;
      if (isDeukJi) { score += 2; reasons.push('득지(+2)'); }
      else { reasons.push('실지'); }
    }

    // 3단계: 득세 (천간 통근 — 천간이 지지에 뿌리 가짐)
    // 일간이 지지 어딘가 같은 오행 또는 자기를 생하는 오행에 뿌리내리면 통근
    let tonggeun = 0;
    for (const p of pillars) {
      if (p?.available === false) continue;
      const jiOheng = p.지지오행 as OhengType | undefined;
      if (!jiOheng) continue;
      // 일지는 이미 득지에서 처리 — 년/월/시 지만
      if (p === pillars[2]) continue;
      const SS_REV: Record<OhengType, OhengType> = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
      if (jiOheng === ilganOhengTyped || SS_REV[ilganOhengTyped] === jiOheng) {
        tonggeun++;
      }
    }
    if (tonggeun > 0) { score += tonggeun * 2; reasons.push(`득세(통근×${tonggeun})(+${tonggeun * 2})`); }
  }

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
  // 등급 세분 (매우신강·신강경향·중화·신약경향·매우신약)
  if (score >= 6) return { gangYak: '신강경향', reason: '매우신강 · ' + reason, score };
  if (score >= 2) return { gangYak: '신강경향', reason, score };
  if (score <= -6) return { gangYak: '신약경향', reason: '매우신약 · ' + reason, score };
  if (score <= -2) return { gangYak: '신약경향', reason, score };
  return { gangYak: '중화', reason, score };
}

/**
 * 격국 판정 (자평진전 §10 기반 · audit 1 P0-3)
 *  · 월지의 십성을 1차 격국 후보로 사용 (월령 십성)
 *  · 천간에 투간(透干) 했는지 확인 (있으면 정격, 없으면 변격 검토)
 *  · 변격: 종격 (특정 십성 ≥ 4) · 양인격 (비겁 강 + 양일간) · 건록격 (월지가 일간과 동일 오행)
 *  · 정격 8종: 식신·상관·편재·정재·정관·칠살·정인·편인
 */
function analyzeGyeokguk(
  pillars: Pillar[],
  sipsung: SipSung[],
  sipsungDist: SipSungDistribution,
  ilgan: string,
  ilganOheng: OhengType,
  woljiOheng: OhengType,
  strengthScore = 0,
): { 격국: string; 격국근거: string } {
  // 월지 본기 십성 추출 (지지 십성은 "본기/여기/중기" 형태 → 첫 글자=본기. 2026-06-02 fix: 통째 조회 시 formalMap 매칭 실패).
  const woljiSipsungRaw = sipsung.find((s) => s.position === '월지')?.십성 || '';
  const woljiSipsung = woljiSipsungRaw.split('/')[0].trim();
  // 간체→번체 정규화 (formalMap 키 정합)
  const SIP_S2T: Record<string, string> = { '七杀': '七殺', '劫财': '劫財', '正财': '正財', '偏财': '偏財', '伤官': '傷官' };
  const woljiSipsungNorm = SIP_S2T[woljiSipsung] || woljiSipsung;

  // 1) 종격 판정 (2026-06-02 미세조정 · 준기 지시)
  //   종격 = 일간이 한쪽으로 완전히 쏠려 거스를 수 없는 극단 구조. 단순 "십성 ≥4" 만으론 부족(정격 오판).
  //   조건: 십성 가중 ≥4 + **일간강약이 극단**(점수로 확인)일 때만.
  //     · 비겁/인성 dominant → 일간 극강(score ≥ +6, 매우신강) 이어야 종왕격/종강격.
  //     · 식상/재성/관성 dominant → 일간 극약(score ≤ -6, 매우신약) 이어야 종아/종재/종관격.
  const SIP_KEYS: Array<keyof SipSungDistribution> = ['비겁', '식상', '재성', '관성', '인성'];
  for (const k of SIP_KEYS) {
    const v = sipsungDist[k] || 0;
    if (v >= 4) {
      const isStrongSide = (k === '비겁' || k === '인성');
      const extremeOk = isStrongSide ? strengthScore >= 6 : strengthScore <= -6;
      if (!extremeOk) continue; // 극단 아니면 종격 X → 일반격(아래)으로
      const variantMap: Record<string, string> = {
        비겁: '종왕격',
        식상: '종아격(從兒格)',
        재성: '종재격(從財格)',
        관성: '종관격(從官格)',
        인성: '종강격',
      };
      return { 격국: variantMap[k] || '종격', 격국근거: `${k} ${v}자 + 일간 극단(${isStrongSide ? '매우신강' : '매우신약'}) — 한쪽으로 완전히 쏠린 종격` };
    }
  }

  // 2) 양인격: 일간이 양일간(甲丙戊庚壬) + 월지가 양인 자리
  const yangIlgan = ['甲', '丙', '戊', '庚', '壬'].includes(ilgan);
  const yangInJi: Record<string, string> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
  const wolji = pillars[1]?.지지 || '';
  if (yangIlgan && yangInJi[ilgan] === wolji) {
    return { 격국: '양인격(羊刃格)', 격국근거: `${ilgan} 일간 + 월지 ${wolji} (양인 자리) — 추진력·전문성 강한 변격` };
  }

  // 3) 건록격: 월지 = 일간 본기 (일간과 같은 오행, 같은 음양)
  const lookgokJi: Record<string, string> = {
    甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
    己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
  };
  if (lookgokJi[ilgan] === wolji) {
    return { 격국: '건록격(建祿格)', 격국근거: `월지 ${wolji} 가 ${ilgan} 일간의 본기 자리 — 자기 결로 사는 변격` };
  }

  // 4) 정격 8종 (월지 십성 → 격국명)
  const formalMap: Record<string, string> = {
    비견: '비겁격',
    겁재: '비겁격',
    식신: '식신격',
    상관: '상관격',
    편재: '편재격',
    정재: '정재격',
    편관: '편관격(칠살격)',
    정관: '정관격',
    편인: '편인격',
    정인: '정인격',
  };
  // 십성 中(번체)→韓 변환 (formalMap 키 정합). 2026-06-02 fix.
  const SIP_C2K: Record<string, string> = {
    '比肩': '비견', '劫財': '겁재', '食神': '식신', '傷官': '상관',
    '正財': '정재', '偏財': '편재', '正官': '정관', '七殺': '편관', '偏官': '편관',
    '正印': '정인', '偏印': '편인',
  };
  const woljiKorean = SIP_C2K[woljiSipsungNorm] || woljiSipsungNorm;
  const formal = formalMap[woljiKorean];
  if (formal) {
    // 천간 투간 확인 — 월지 본기 십성이 천간에 같은 십성으로 투간했는지 (간체 정규화 후 비교)
    const normSip = (x: string) => SIP_S2T[(x || '').trim()] || (x || '').trim();
    const tugan = sipsung.some((s) =>
      ['년간', '월간', '시간'].includes(s.position) && normSip(s.십성) === woljiSipsungNorm
    );
    return {
      격국: formal,
      격국근거: tugan
        ? `월지 ${wolji} 본기 ${woljiKorean} 천간 투간 — 정격 ${formal}`
        : `월지 ${wolji} 본기 ${woljiKorean} 기반 (천간 투간 X) — ${formal} 경향`,
    };
  }

  // fallback (월지 십성 매핑 실패)
  void ilganOheng;
  void woljiOheng;
  return { 격국: '판정 보류', 격국근거: '월지 십성이 명확하지 않아 격국 판정 보류' };
}

/**
 * 용신(用神) 결정론적 산출 (2026-06-26 보강1) — 행운 색/방위 SSOT 단일화.
 * 콘텐츠마다 AI가 용신을 재추론해 색이 갈리던 문제 → calculator 1회 산출 + 전 프롬프트 주입.
 * 알고리즘: ① 조후 우선(겨울+화전무→화 / 여름+수전무→수) ② 부억(신강/중화강=식상 설기·희신 재성 / 신약/중화약=인성 생조·희신 생용신).
 * 검산: 온하우스(목 신강)=화·토·수, 검증(화 중화약)=목·수·금 — 둘 다 Opus 종합사주 AI 도출과 정확히 일치.
 */
function analyzeYongsin(
  ilganOheng: OhengType,
  wolji: string,
  gangYak: MyeongriAnalysis['일간강약'],
  strengthScore: number,
  pillars: Pillar[],
): { 용신: OhengType; 희신: OhengType; 기신: OhengType; 용신근거: string } {
  const SAENG: Record<string, OhengType> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' }; // X가 생하는 오행
  const GEUK: Record<string, OhengType> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };  // X가 극하는 오행
  const SAENG_BY: Record<string, OhengType> = { 화: '목', 토: '화', 금: '토', 수: '금', 목: '수' }; // X를 생하는 오행(인성)

  // 원국 오행 분포 (천간 + 지지 본기)
  const cnt: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  pillars.forEach((p) => {
    if (p?.천간오행) cnt[p.천간오행] = (cnt[p.천간오행] || 0) + 1;
    if (p?.지지오행) cnt[p.지지오행] = (cnt[p.지지오행] || 0) + 1;
  });

  const 식상 = SAENG[ilganOheng];
  const 재성 = GEUK[ilganOheng];
  const 인성 = SAENG_BY[ilganOheng];

  const winter = ['亥', '子', '丑'].includes(wolji);
  const summer = ['巳', '午', '未'].includes(wolji);

  let 용신: OhengType, 희신: OhengType, 기신: OhengType, 용신근거: string;

  if (winter && (cnt['화'] || 0) === 0) {
    용신 = '화'; 희신 = '목'; 기신 = '수';
    용신근거 = `${wolji}월 겨울 출생 + 원국에 화(火) 전무 — 조후로 데우는 화가 용신`;
  } else if (summer && (cnt['수'] || 0) === 0) {
    용신 = '수'; 희신 = '금'; 기신 = '토';
    용신근거 = `${wolji}월 여름 출생 + 원국에 수(水) 전무 — 조후로 식히는 수가 용신`;
  } else {
    const strong = gangYak === '신강경향' || (gangYak === '중화' && strengthScore >= 0);
    if (strong) {
      용신 = 식상; 희신 = 재성; 기신 = 인성;
      용신근거 = `${gangYak === '중화' ? '중화(약간 강)' : '신강'} — ${식상}(식상)으로 설기하고 ${재성}(재성)이 흐름을 잇는 것이 핵심`;
    } else {
      용신 = 인성; 희신 = SAENG_BY[인성]; 기신 = 재성;
      용신근거 = `${gangYak === '중화' ? '중화(약간 약)' : '신약'} — ${인성}(인성)으로 일간을 생조해 받쳐주는 것이 1순위`;
    }
  }

  return { 용신, 희신, 기신, 용신근거 };
}

/** 종합 명리학 분석 */
function analyzeMyeongri(pillars: Pillar[], sipsung: SipSung[], hasBirthTime: boolean): MyeongriAnalysis {
  const ilgan = pillars[2]?.천간 || '';
  const ilganOheng = pillars[2]?.천간오행 || '토';
  const wolji = pillars[1]?.지지 || '';
  const woljiOheng = pillars[1]?.지지오행 || '토';

  const deukryeong = checkDeukryeong(ilganOheng, woljiOheng);
  const sipsungDist = countSipsung(sipsung);                  // 표시용 (지장간 전부 1)
  const sipsungWeighted = countSipsungWeighted(sipsung);      // 강약·격국 판정용 (지장간 할인)
  const hyungchunghap = detectHyungChungHap(pillars, hasBirthTime);
  // 2026-06-02 — 강약·격국은 지장간 할인 가중치로 판정 (종격/신강 오판 fix).
  const { gangYak, reason, score: strengthScore } = estimateStrength(ilganOheng, deukryeong, sipsungWeighted, pillars);
  const { 격국, 격국근거 } = analyzeGyeokguk(pillars, sipsung, sipsungWeighted, ilgan, ilganOheng, woljiOheng, strengthScore);
  const { 용신, 희신, 기신, 용신근거 } = analyzeYongsin(ilganOheng, wolji, gangYak, strengthScore, pillars);

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
    격국,
    격국근거,
    용신,
    희신,
    기신,
    용신근거,
  };
}
