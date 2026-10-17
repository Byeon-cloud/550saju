/**
 * 신년운세 무료 미리 보기 (2026-10-17) — 결제 전에 그 해가 내 사주에 어떤 해인지, 도움이 큰 달과 조심할 달, 꼭 기억할 날 하나.
 *
 *   서버 신년운세(functions/src/ai/claudeTojung.ts + sajuFacts.ts)와 같은 계산이다. 결제 뒤 풀이 화면의 달 판정(괘의미)과
 *   '한 해 꼭 기억할 날'은 서버가 이 계산으로 고정하므로, 미리 보기와 결제 뒤 내용이 어긋나지 않는다.
 *   규칙을 바꿀 때는 sajuFacts.ts 의 ganziRoleText, monthBaseScore, scoreDaysOfMonth, dayPicksForYear 와 같이 바꾼다.
 */
import { Solar } from 'lunar-javascript';
import type { SajuData } from '@/types/saju';

const BR_OHENG: Record<string, string> = {
  子: '수', 丑: '토', 寅: '목', 卯: '목', 辰: '토', 巳: '화', 午: '화', 未: '토', 申: '금', 酉: '금', 戌: '토', 亥: '수',
};
const GAN_OH: Record<string, string> = { 甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수' };
const CHEONEUL: Record<string, string[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'], 辛: ['寅', '午'], 壬: ['巳', '卯'], 癸: ['巳', '卯'],
};
const CHUNG_PAIR: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
export const ganziKo = (gz: string) => (gz && gz.length >= 2 ? `${GAN_KO[gz[0]] || ''}${ZHI_KO[gz[1]] || ''}` : '');

type Role = '용신' | '희신' | '기신' | '중립';
function roles(sd: SajuData) {
  const ma: any = sd?.myeongriAnalysis || {};
  return { y: ma.용신 as string | undefined, h: ma.희신 as string | undefined, k: ma.기신 as string | undefined };
}

/** 서버 ganziRoleText 의 판정 부분 ('도움 기운이 강한 달' 등). 용신이 없으면 null */
export function roleVerdict(gz: string, sd: SajuData, unit: '해' | '달'): { verdict: string; r1: Role; r2: Role; g: string; b: string } | null {
  const { y, h, k } = roles(sd);
  if (!gz || gz.length < 2 || !y) return null;
  const g = GAN_OH[gz[0]]; const b = BR_OHENG[gz[1]];
  if (!g || !b) return null;
  const role = (o: string): Role => (o === y ? '용신' : o === h ? '희신' : o === k ? '기신' : '중립');
  const r1 = role(g); const r2 = role(b);
  const good = [r1, r2].filter((r) => r === '용신' || r === '희신').length;
  const bad = [r1, r2].filter((r) => r === '기신').length;
  const verdict = good === 2 ? `도움 기운이 강한 ${unit}` : good >= 1 && bad >= 1 ? `도움과 부담이 섞인 ${unit}`
    : good === 1 ? `도움 기운이 들어오는 ${unit}` : bad >= 1 ? `부담 기운이 강한 ${unit}` : `무난한 ${unit}`;
  return { verdict, r1, r2, g, b };
}

/** 서버 monthBaseScore 와 같다 */
function monthBaseScore(gz: string, sd: SajuData): number {
  try {
    const { y, h, k } = roles(sd);
    const role = (o: string) => (o === y ? 2 : o === h ? 1 : o === k ? -2 : 0);
    const dayGan = String(sd?.pillars?.[2]?.천간 || '');
    const dayJi = String(sd?.pillars?.[2]?.지지 || '');
    const sum = role(GAN_OH[gz[0]]) + role(BR_OHENG[gz[1]]);
    const table: Record<string, number> = { 4: 88, 3: 84, 2: 78, 1: 72, 0: 66, '-1': 61, '-2': 56, '-3': 51, '-4': 47 } as any;
    let s = table[String(Math.max(-4, Math.min(4, sum)))] ?? 66;
    if (dayJi && CHUNG_PAIR[dayJi] === gz[1]) s -= 4;
    if ((CHEONEUL[dayGan] || []).includes(gz[1])) s += 2;
    s = Math.max(30, Math.min(95, s));
    if (s % 5 === 0) s += 1;
    return s;
  } catch { return 66; }
}

/** 서버 scoreDaysOfMonth 와 같은 점수와 이유 앞머리(간지) */
function scoreDays(year: number, m: number, sd: SajuData) {
  const { y, h, k } = roles(sd);
  const dayGan = String(sd?.pillars?.[2]?.천간 || '');
  const dayJi = String(sd?.pillars?.[2]?.지지 || '');
  const cheoneul = CHEONEUL[dayGan] || [];
  const role = (o: string) => (o === y ? 2 : o === h ? 1 : o === k ? -2 : 0);
  const out: Array<{ m: number; d: number; gz: string; score: number; chung: boolean }> = [];
  const last = new Date(year, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const gz = Solar.fromYmd(year, m, d).getLunar().getDayInGanZhi();
    let score = role(GAN_OH[gz[0]]) + role(BR_OHENG[gz[1]]);
    if (cheoneul.includes(gz[1])) score += 1;
    const chung = !!dayJi && CHUNG_PAIR[dayJi] === gz[1];
    if (chung) score -= 2;
    out.push({ m, d, gz, score, chung });
  }
  return out;
}

/** 서버 dayPicksForYear 의 keyDates 와 같은 '한 해 꼭 기억할 날'(최대 6, 날짜순) */
export function yearKeyDates(year: number, sd: SajuData): Array<{ m: number; d: number }> {
  const all: Array<{ m: number; d: number; gz: string; score: number }> = [];
  try {
    for (let m = 1; m <= 12; m++) {
      const days = scoreDays(year, m, sd);
      const good = days.filter((x) => !x.chung && x.score >= 3).sort((a, b) => b.score - a.score).slice(0, 3);
      const pick = good.length ? good : days.filter((x) => !x.chung && x.score >= 2).sort((a, b) => b.score - a.score).slice(0, 3);
      pick.forEach((x) => all.push(x));
    }
  } catch { return []; }
  const base: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    try { base[m] = monthBaseScore((Solar.fromYmd(year, m, 15).getLunar() as any).getMonthInGanZhi(), sd); } catch { base[m] = 66; }
  }
  const sorted = all.sort((a, b) => b.score - a.score || (base[b.m] || 0) - (base[a.m] || 0));
  const keys: Array<{ m: number; d: number }> = [];
  const usedMonth = new Set<number>();
  const gzCount: Record<string, number> = {};
  for (const pass of [2, 99]) {
    for (const x of sorted) {
      if (keys.length >= 6) break;
      if (x.score < 3 || usedMonth.has(x.m)) continue;
      if ((gzCount[x.gz] || 0) >= pass) continue;
      gzCount[x.gz] = (gzCount[x.gz] || 0) + 1;
      usedMonth.add(x.m);
      keys.push({ m: x.m, d: x.d });
    }
  }
  return keys.sort((a, b) => a.m - b.m || a.d - b.d);
}

export interface NewYearPreview {
  yearGz: string;
  year: ReturnType<typeof roleVerdict>;
  /** 결제 뒤 풀이의 달 판정이 '도움 기운이 강한 달'인 달 (없으면 '도움 기운이 들어오는 달') */
  goodMonths: number[];
  goodLabel: string;
  /** '부담 기운이 강한 달' */
  hardMonths: number[];
  keyDates: Array<{ m: number; d: number }>;
}

export function newYearPreview(year: number, sd: SajuData | null | undefined): NewYearPreview | null {
  if (!sd?.pillars?.length || !roles(sd).y) return null;
  try {
    const yearGz = (Solar.fromYmd(year, 6, 1).getLunar() as any).getEightChar().getYear();
    const months = Array.from({ length: 12 }, (_, i) => {
      const gz = (Solar.fromYmd(year, i + 1, 15).getLunar() as any).getEightChar().getMonth();
      return { m: i + 1, v: roleVerdict(gz, sd, '달')?.verdict || '' };
    });
    let goodLabel = '도움 기운이 강한 달';
    let goodMonths = months.filter((x) => x.v === goodLabel).map((x) => x.m);
    if (!goodMonths.length) { goodLabel = '도움 기운이 들어오는 달'; goodMonths = months.filter((x) => x.v === goodLabel).map((x) => x.m); }
    const hardMonths = months.filter((x) => x.v === '부담 기운이 강한 달').map((x) => x.m);
    return { yearGz, year: roleVerdict(yearGz, sd, '해'), goodMonths, goodLabel, hardMonths, keyDates: yearKeyDates(year, sd) };
  } catch { return null; }
}
