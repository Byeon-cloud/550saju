/**
 * 이번 달 좋은 날 (2026-10-17) — 월초 홈 예고용.
 *
 *   서버 월운세(functions/src/ai/sajuFacts.ts 의 scoreDaysOfMonth, monthDayPicks)와 같은 채점이다.
 *   홈에서 미리 보여 준 날짜가 월운세 결과의 '좋은 날'과 어긋나면 안 되므로 규칙을 바꿀 때는 두 곳을 같이 바꾼다.
 *   일진 × 용신, 희신, 기신 + 천을귀인 + 일지 충.
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
const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];

export interface GoodDay {
  /** 'M/D' */
  date: string;
  day: number;
  week: string;
  /** 쉬운 말 이유 (월운세 결과의 이유와 같은 말) */
  reason: string;
}

function scoreDays(year: number, m: number, sajuData: SajuData) {
  const ma: any = sajuData?.myeongriAnalysis || {};
  const y = ma.용신; const h = ma.희신; const k = ma.기신;
  const dayGan = String(sajuData?.pillars?.[2]?.천간 || '');
  const dayJi = String(sajuData?.pillars?.[2]?.지지 || '');
  const cheoneul = CHEONEUL[dayGan] || [];
  const role = (o: string) => (o === y ? 2 : o === h ? 1 : o === k ? -2 : 0);
  const out: Array<{ day: number; week: string; score: number; chung: boolean; reasons: string[] }> = [];
  const last = new Date(year, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const s = Solar.fromYmd(year, m, d);
    const gz = s.getLunar().getDayInGanZhi();
    const go = GAN_OH[gz[0]]; const bo = BR_OHENG[gz[1]];
    let score = role(go) + role(bo);
    const reasons: string[] = [];
    // 서버 plainWhy 와 같은 말: 용신 → '나에게 필요한', 희신 → '도움이 되는'
    const helps = Array.from(new Set([go, bo].filter((o) => o === y || o === h)));
    if (helps.length) reasons.push(helps.map((o) => (o === y ? `나에게 필요한 ${o}` : `도움이 되는 ${o}`)).join(', ') + ' 기운이 들어오는 날');
    if (cheoneul.includes(gz[1])) { score += 1; reasons.push('귀인의 도움이 닿는 날'); }
    const chung = !!dayJi && CHUNG_PAIR[dayJi] === gz[1];
    if (chung) score -= 2;
    out.push({ day: d, week: WEEK_KO[new Date(year, m - 1, d).getDay()], score, chung, reasons });
  }
  return out;
}

/** 서버 monthDayPicks 의 good 과 같은 날짜(최대 4, 날짜순). 사주가 없거나 용신이 없으면 빈 배열 */
export function monthGoodDays(year: number, month: number, sajuData: SajuData | null | undefined): GoodDay[] {
  if (!sajuData?.pillars?.length) return [];
  try {
    const days = scoreDays(year, month, sajuData);
    let good = days.filter((x) => !x.chung && x.score >= 3);
    if (good.length < 2) good = days.filter((x) => !x.chung && x.score >= 2);
    return good.sort((a, b) => b.score - a.score).slice(0, 4).sort((a, b) => a.day - b.day)
      .map((x) => ({ date: `${month}/${x.day}`, day: x.day, week: x.week, reason: x.reasons.join(', ') || '흐름이 순한 날' }));
  } catch { return []; }
}
