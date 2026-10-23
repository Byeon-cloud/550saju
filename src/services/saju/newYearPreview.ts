/**
 * 신년운세 무료 미리 보기 (2026-10-17) — 결제 전에 그 해가 내 사주에 어떤 해인지, 좋은 달과 조심할 달, 꼭 기억할 날 하나.
 *
 *   서버 신년운세(functions/src/ai/claudeTojung.ts + sajuFacts.ts)와 같은 계산이다. 결제 뒤 풀이의 네 칸(좋은 달, 조심할 달),
 *   달 판정(괘의미), '한 해 꼭 기억할 날'은 서버가 이 계산으로 고정하므로, 미리 보기와 결제 뒤 내용이 어긋나지 않는다.
 *   2026-10-23 — 서버가 달별 판정표(sajuFacts.monthVerdictRow, 1.6.3 P1-8)로 좋은 달과 조심할 달을 고르게 바뀌어 같이 옮겼다.
 *     옮기기 전엔 예전 규칙(세운 역할만)이 남아 서윤 미리 보기가 좋은 달 6, 7월, 조심할 달 2, 3월인데 결제 뒤 네 칸은 1, 6, 7월과 2, 5월이었다.
 *   규칙을 바꿀 때는 같이 바꾼다:
 *     sajuFacts.ts 의 ganziRoleText, monthBaseScore, monthVerdictRow, scoreDaysOfMonth, dayPicksForYear,
 *     claudeTojung.ts 의 tojungTargetYear(화면은 TojungPage newYearTarget), yearPillar, monthPillar, planMonthRank, fixFourBox 의 머리 이름.
 *   대조 시험(AI 호출 없음): cd functions && npm run build, 그다음 루트에서 npx tsx scripts/test/newyear_preview_parity.ts
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
/* 아래 넷은 sajuFacts.ts 의 같은 이름 표와 같다 (달별 판정표에 쓰임) */
const JI_HAP6: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const GAN_CHUNG: Record<string, string> = { 甲: '庚', 庚: '甲', 乙: '辛', 辛: '乙', 丙: '壬', 壬: '丙', 丁: '癸', 癸: '丁' };
const JI_HYUNG = new Set(['寅巳', '巳寅', '巳申', '申巳', '寅申', '申寅', '丑戌', '戌丑', '戌未', '未戌', '丑未', '未丑', '子卯', '卯子']);
const JA_HYUNG = new Set(['辰', '午', '酉', '亥']);
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
export const ganziKo = (gz: string) => (gz && gz.length >= 2 ? `${GAN_KO[gz[0]] || ''}${ZHI_KO[gz[1]] || ''}` : '');

type Role = '용신' | '희신' | '기신' | '중립';
function roles(sd: SajuData) {
  const ma: any = sd?.myeongriAnalysis || {};
  return { y: ma.용신 as string | undefined, h: ma.희신 as string | undefined, k: ma.기신 as string | undefined };
}

/** 서버 claudeTojung monthPillar 와 같다 (그 달 15일의 월건) */
function monthPillar(y: number, m: number): string {
  try { return (Solar.fromYmd(y, m, 15).getLunar() as any).getEightChar().getMonth(); } catch { return ''; }
}
/** 서버 claudeTojung yearPillar 와 같다 (6월 1일의 년주) */
function yearPillar(y: number): string {
  try { return (Solar.fromYmd(y, 6, 1).getLunar() as any).getEightChar().getYear(); } catch { return ''; }
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

export type MonthVerdict = '도움' | '부담' | '섞임';
export type MonthAction = '결정해도 됨' | '준비만' | '서명 피함';
export interface MonthVerdictLite { y: number; m: number; gz: string; yearGz: string; daeunGz: string; verdict: MonthVerdict; action: MonthAction; score: number }

/**
 * 서버 sajuFacts.monthVerdictRow 의 판정, 행동 등급, 점수 (근거 문장 why 는 화면에 쓰지 않아 옮기지 않았다). 용신이 없으면 null.
 *   판정: 월건 천간과 지지의 용신 +2, 희신 +1, 기신 -2. 일지 충은 부담 하나, 합 -2.
 *         도움만 있으면 도움, 부담만 있으면 부담, 둘 다면 합 +2 이상 도움, -2 이하 부담, 그 사이와 둘 다 없으면 섞임.
 *   서명 피함 사유(strong): 일지 충, 일지나 월지와 형(형이면서 합인 巳申은 흔들림), 월건 천간이 일간을 치는 천간충.
 *   흔들림(shake): 월지 충, 일지나 월지와 巳申 형합, 일지나 월지와 자형 겹침, 그 해 대운 지지와 충, 그 달 세운 지지와 충(입춘 기준).
 *   행동: 서명 피함 사유가 있거나 (부담이고 합 -3 이하)면 서명 피함, 도움이고 흔들림이 없으면 결정해도 됨, 그 밖은 준비만.
 *   점수: monthBaseScore - 3 x (서명 피함 사유, 일지 충 제외) - 2 x 흔들림 + 일지 육합 2, 30~95, 5의 배수면 +1.
 */
export function monthVerdict(y: number, m: number, sd: SajuData): MonthVerdictLite | null {
  try {
    const { y: yong, h: hee, k: gi } = roles(sd);
    if (!yong) return null;
    const p: any[] = (sd as any)?.pillars || [];
    const dayGan = String(p[2]?.천간 || '');
    const ec = (Solar.fromYmd(y, m, 15).getLunar() as any).getEightChar();
    const gz: string = ec.getMonth(); const yearGz: string = ec.getYear();
    if (!gz || gz.length < 2) return null;
    const g = gz[0]; const b = gz[1];
    const roleVal = (o: string) => (o === yong ? 2 : o === hee ? 1 : o === gi ? -2 : 0);
    const rg = roleVal(GAN_OH[g]); const rb = roleVal(BR_OHENG[b]);
    const help = (rg > 0 ? 1 : 0) + (rb > 0 ? 1 : 0);
    let burden = (rg < 0 ? 1 : 0) + (rb < 0 ? 1 : 0);
    let net = rg + rb;
    const strong: string[] = []; const shake: string[] = [];
    let dayHap = false;
    // 서버 ROLE_PALACE 순서: 일지(2), 월지(1)
    for (const idx of [2, 1]) {
      const x = p[idx];
      if (!x || x.available === false || !x.지지) continue;
      const nb = String(x.지지);
      const chung = CHUNG_PAIR[nb] === b;
      const hyung = JI_HYUNG.has(nb + b);
      const hap = JI_HAP6[nb] === b;
      if (chung && idx === 2) { burden++; net -= 2; strong.push('일지충'); }
      else if (chung) shake.push('월지충');
      else if (hyung && hap) shake.push(idx === 2 ? '일지형합' : '월지형합');
      else if (hyung) strong.push(idx === 2 ? '일지형' : '월지형');
      else if (hap) { if (idx === 2) dayHap = true; }
      else if (nb === b && JA_HYUNG.has(b)) shake.push(idx === 2 ? '일지자형' : '월지자형');
    }
    if (dayGan && GAN_CHUNG[g] === dayGan) strong.push('천간충');
    const dy: any[] = Array.isArray((sd as any)?.daeun) ? (sd as any).daeun : [];
    const cur = dy.find((d) => typeof d?.간지 === 'string' && d.간지.length >= 2 && Number(d?.시작년도) <= y && y <= Number(d?.끝년도));
    const daeunGz = cur ? String(cur.간지) : '';
    if (daeunGz && CHUNG_PAIR[daeunGz[1]] === b) shake.push('대운충');
    if (yearGz && yearGz.length >= 2 && CHUNG_PAIR[yearGz[1]] === b) shake.push('세운충');
    const verdict: MonthVerdict = help > 0 && burden === 0 ? '도움'
      : burden > 0 && help === 0 ? '부담'
      : help > 0 && burden > 0 ? (net >= 2 ? '도움' : net <= -2 ? '부담' : '섞임')
      : '섞임';
    const action: MonthAction = strong.length || (verdict === '부담' && net <= -3) ? '서명 피함'
      : verdict === '도움' && !shake.length ? '결정해도 됨'
      : '준비만';
    let score = monthBaseScore(gz, sd);
    score -= 3 * strong.filter((s) => s !== '일지충').length; // 일지 충은 monthBaseScore 가 이미 -4
    score -= 2 * shake.length;
    if (dayHap) score += 2;
    score = Math.max(30, Math.min(95, score));
    if (score % 5 === 0) score += 1;
    return { y, m, gz, yearGz, daeunGz, verdict, action, score };
  } catch { return null; }
}

/**
 * 서버 claudeTojung planMonthRank 와 같은 좋은 달, 조심할 달 (결제 뒤 네 칸의 값).
 *   판정표가 있으면 좋은 달 = '결정해도 됨' 달 가운데 점수 높은 순 셋까지(같은 점수면 앞 달),
 *   하나도 없으면 '서명 피함'이 아닌 달 가운데 점수 높은 둘(goodIsDecide=false), 그래도 없으면 점수 가장 높은 한 달.
 *   조심할 달 = 좋은 달이 아닌 '서명 피함' 달 가운데 점수 낮은 순 셋까지, 없으면 좋은 달이 아닌 달 가운데 점수 가장 낮은 한 달.
 *   판정표가 없으면(옛 사주 데이터) 달 기준점수 상위 셋, 하위 둘. 이때 서버는 AI 가 준 최종 점수로 다시 고르므로 결제 뒤와 다를 수 있다.
 */
export function planMonths(ty: number, sd: SajuData): {
  good: number[]; caution: number[]; goodIsDecide: boolean; hasTable: boolean; rows: Record<number, MonthVerdictLite | null>;
} {
  const rows: Record<number, MonthVerdictLite | null> = {};
  for (let m = 1; m <= 12; m++) rows[m] = monthVerdict(ty, m, sd);
  const hasTable = Object.values(rows).every((r) => !!r);
  const base: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) { const gz = monthPillar(ty, m); base[m] = hasTable ? rows[m]!.score : gz ? monthBaseScore(gz, sd) : 66; }
  const all = Array.from({ length: 12 }, (_, i) => i + 1);
  const byHigh = (a: number, b: number) => base[b] - base[a] || a - b;
  const byLow = (a: number, b: number) => base[a] - base[b] || a - b;
  let good: number[]; let caution: number[]; let goodIsDecide = true;
  if (hasTable) {
    const decide = all.filter((m) => rows[m]!.action === '결정해도 됨');
    if (decide.length) good = [...decide].sort(byHigh).slice(0, 3);
    else { goodIsDecide = false; good = all.filter((m) => rows[m]!.action !== '서명 피함').sort(byHigh).slice(0, 2); }
    if (!good.length) good = [...all].sort(byHigh).slice(0, 1);
    const avoid = all.filter((m) => rows[m]!.action === '서명 피함' && !good.includes(m));
    caution = avoid.length ? [...avoid].sort(byLow).slice(0, 3) : all.filter((m) => !good.includes(m)).sort(byLow).slice(0, 1);
  } else {
    good = [...all].sort(byHigh).slice(0, 3);
    caution = all.filter((m) => !good.includes(m)).sort(byLow).slice(0, 2);
  }
  return { good: good.sort((a, b) => a - b), caution: caution.sort((a, b) => a - b), goodIsDecide, hasTable, rows };
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

/** 서버 dayPicksForYear 의 keyDates 와 같은 '한 해 꼭 기억할 날'(최대 6, 날짜순).
 *  같은 점수면 그 달 기준점수(monthBaseScore, 음력 달 간지) 높은 달 먼저 — 서버도 판정표 점수가 아닌 이 값을 쓴다 */
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
  /** 결제 뒤 네 칸 '좋은 달'의 달 (서버 planMonthRank 와 같다) */
  goodMonths: number[];
  /** 화면 이름 코드. '도움 기운이 강한 달'이면 미리 보기와 받은 미리 보기 둘 다 '좋은 달'로 보인다(결제 뒤 네 칸 머리와 같다).
   *  보내기 서버(functions/src/share/newYearShare.ts GOOD_LABELS)가 받는 값이라 이 값을 그대로 둔다. 옛 보낸 링크의 '도움 기운이 들어오는 달'은 '도움이 오는 달' */
  goodLabel: string;
  /** 좋은 달이 '결정해도 됨' 달에서 나왔는지 (아니면 결제 뒤 네 칸 설명에 계약을 붙이지 않는다) */
  goodIsDecide: boolean;
  /** 결제 뒤 네 칸 '조심할 달'의 달 */
  hardMonths: number[];
  keyDates: Array<{ m: number; d: number }>;
}

export function newYearPreview(year: number, sd: SajuData | null | undefined): NewYearPreview | null {
  if (!sd?.pillars?.length || !roles(sd).y) return null;
  try {
    const yearGz = yearPillar(year);
    const plan = planMonths(year, sd);
    return {
      yearGz, year: roleVerdict(yearGz, sd, '해'),
      goodMonths: plan.good, goodLabel: '도움 기운이 강한 달', goodIsDecide: plan.goodIsDecide,
      hardMonths: plan.caution, keyDates: yearKeyDates(year, sd),
    };
  } catch { return null; }
}
