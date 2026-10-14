/**
 * 홈·결제 화면의 "내 사주 사실 한 줄" 엔진 (2026-10-10 · 홈 v9)
 *
 * 원칙 — 결제 후 실제 풀이와 엇갈리는 말을 하지 않는다.
 *   · 여기서 만드는 문장은 전부 만세력 계산으로 확정되는 '구조 사실'(십성·합·충·삼합·절입일)만 말한다.
 *     "가장 좋은 날/점수" 처럼 AI 가 정하는 값은 절대 미리 말하지 않는다 (주간 bestDay·월 점수 등은 AI 산출).
 *   · 오늘의 시간대만 예외 — 서버 todayHourWindows(functions/src/ai/sajuFacts.ts)와 같은 계산을 그대로 옮겨
 *     오늘의 운세 본문(서버가 같은 표를 AI 에 확정값으로 준다)과 같은 시간을 말한다. 바꾸면 양쪽 같이 바꿀 것.
 *   · 같은 사주·같은 날 = 항상 같은 문장. AI 호출 0.
 */
import { Solar } from 'lunar-javascript';
import { sipsungOf, type SipsungKo } from './todayHeadline';
import { CHEONGAN_KO, JIJI_KO } from '@/constants/oheng';
import { getIljuMeaning } from '@/constants/iljuMeaning';
import { findCurrentDaeun } from './daeunCurrent';
import type { SajuData, DaeUn } from '@/types/saju';

/* ── 기초 표 ── */
const GAN_OH: Record<string, string> = { 甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수' };
const BR_OH: Record<string, string> = { 子: '수', 丑: '토', 寅: '목', 卯: '목', 辰: '토', 巳: '화', 午: '화', 未: '토', 申: '금', 酉: '금', 戌: '토', 亥: '수' };
/** 지지 본기(정기) — 지지의 십성은 본기 천간으로 본다 */
const BRANCH_MAIN: Record<string, string> = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
const GAN_HAP: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
const JI_HAP: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const CHUNG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const SAMHAP: Array<{ set: [string, string, string]; oh: string }> = [
  { set: ['申', '子', '辰'], oh: '수' }, { set: ['亥', '卯', '未'], oh: '목' },
  { set: ['寅', '午', '戌'], oh: '화' }, { set: ['巳', '酉', '丑'], oh: '금' },
];
const OH_HANJA: Record<string, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };

export type StarCat = '비겁' | '식상' | '재성' | '관성' | '인성';
const CAT: Record<SipsungKo, StarCat> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
};
/** 유저에게 보이는 별 이름 (한자 대신 쉬운 말 · 한자노출 정책) */
const STAR_NAME: Record<StarCat, string> = {
  재성: '재물의 별', 관성: '자리와 명예의 별', 인성: '배움과 도움의 별', 식상: '표현과 재능의 별', 비겁: '사람과 경쟁의 별',
};
/** 별 → 생활에서 쓰는 운 이름 (홈 카드 한 줄, 2026-10-14) */
export const STAR_LUCK: Record<StarCat, string> = {
  재성: '재물운', 관성: '직장운', 인성: '공부운', 식상: '재능운', 비겁: '사람 운',
};

/* ── 작은 도구 ── */
/** 받침 있으면 a, 없으면 b — 한글 아닌 끝 글자(한자 등)는 b */
export function josa(word: string, a: string, b: string): string {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return b;
  const jong = code % 28;
  if (a === '으로' && jong === 8) return b; // ㄹ 받침 + 로
  return jong ? a : b;
}
function ganziKo(gz: string): string {
  return `${CHEONGAN_KO[gz[0]] ?? ''}${JIJI_KO[gz[1]] ?? ''}`;
}
function starOf(dayGan: string, ch: string): { sip: SipsungKo; cat: StarCat } | null {
  const stem = GAN_OH[ch] ? ch : BRANCH_MAIN[ch];
  if (!stem) return null;
  const sip = sipsungOf(dayGan, stem);
  return sip ? { sip, cat: CAT[sip] } : null;
}
function isFemale(s: SajuData): boolean {
  return (s?.input as any)?.gender !== 'male';
}
/** 연인의 별 — 여성 관성 / 남성 재성 (서버 reunionPlan 과 같은 규칙) */
function loveCat(s: SajuData): StarCat {
  return isFemale(s) ? '관성' : '재성';
}
function chartChars(s: SajuData): Array<{ ch: string; isDayGan: boolean }> {
  const out: Array<{ ch: string; isDayGan: boolean }> = [];
  (s?.pillars || []).forEach((p, i) => {
    if (!p || p.available === false) return;
    if (p.천간) out.push({ ch: p.천간, isDayGan: i === 2 });
    if (p.지지) out.push({ ch: p.지지, isDayGan: false });
  });
  return out;
}
function dayGanOf(s: SajuData): string { return String(s?.pillars?.[2]?.천간 || ''); }
function dayJiOf(s: SajuData): string { return String(s?.pillars?.[2]?.지지 || ''); }

/* ── 날짜 (전부 KST 'YYYY-MM-DD' 키) ── */
function kstParts(dateKey: string): [number, number, number] {
  const [y, m, d] = dateKey.split('-').map(Number);
  return [y, m, d];
}
function addDays(dateKey: string, n: number): string {
  const [y, m, d] = kstParts(dateKey);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = kstParts(a); const [y2, m2, d2] = kstParts(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
function weekdayOf(dateKey: string): string {
  const [y, m, d] = kstParts(dateKey);
  return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
function dayGz(dateKey: string): string {
  const [y, m, d] = kstParts(dateKey);
  return Solar.fromYmd(y, m, d).getLunar().getDayInGanZhi();
}
/** 그날 23:59 기준 월건 (절입 시각이 그날 안이면 새 달로 친다 — '12월 7일부터' 관례) */
function monthGzAtEnd(y: number, m: number, d: number): string {
  return Solar.fromYmdHms(y, m, d, 23, 59, 0).getLunar().getMonthInGanZhiExact();
}

export interface SajuMonth { gz: string; start: string; calMonth: number }
const monthCache = new Map<string, SajuMonth[]>();
/** 오늘 이후 시작하는 사주 달(절입일 기준) n개 */
export function upcomingSajuMonths(today: string, n = 12): SajuMonth[] {
  const key = `${today}:${n}`;
  const hit = monthCache.get(key);
  if (hit) return hit;
  const out: SajuMonth[] = [];
  let [y, m] = kstParts(today);
  for (let k = 0; k < n + 2 && out.length < n; k++) {
    // 절입은 매달 3~9일 사이 — 1일(이전 달)과 10일(새 달) 사이에서 첫 날을 찾는다
    const before = monthGzAtEnd(y, m, 1);
    for (let d = 2; d <= 10; d++) {
      const g = monthGzAtEnd(y, m, d);
      if (g !== before) {
        const start = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (daysBetween(today, start) > 0) out.push({ gz: g, start, calMonth: m });
        break;
      }
    }
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  monthCache.set(key, out);
  return out;
}

/* ── 오늘: 시간대 (서버 todayHourWindows 와 같은 계산) ── */
const SLOTS: Array<{ start: string; end: string; mid: number }> = [
  { start: '07:30', end: '09:30', mid: 8 }, { start: '09:30', end: '11:30', mid: 10 }, { start: '11:30', end: '13:30', mid: 12 },
  { start: '13:30', end: '15:30', mid: 14 }, { start: '15:30', end: '17:30', mid: 16 }, { start: '17:30', end: '19:30', mid: 18 },
  { start: '19:30', end: '21:30', mid: 20 }, { start: '21:30', end: '23:30', mid: 22 },
];
export interface HourWindows { peak: [string, string]; avoid: [string, string] }
export function todayHourWindows(dateKey: string, s: SajuData): HourWindows | null {
  try {
    const ma: any = s?.myeongriAnalysis || {};
    const yy = ma.용신; const h = ma.희신; const k = ma.기신;
    if (!yy) return null;
    const [y, m, d] = kstParts(dateKey);
    const dj = dayJiOf(s);
    const role = (o: string) => (o === yy ? 2 : o === h ? 1 : o === k ? -2 : 0);
    const scored = SLOTS.map((sl) => {
      const gz = Solar.fromYmdHms(y, m, d, sl.mid, 0, 0).getLunar().getTimeInGanZhi();
      let sc = role(GAN_OH[gz[0]]) + role(BR_OH[gz[1]]);
      if (dj && CHUNG[dj] === gz[1]) sc -= 2;
      return { start: sl.start, end: sl.end, sc };
    });
    let best = 0, bestI = 0;
    for (let i = 0; i < scored.length - 1; i++) { const v = scored[i].sc + scored[i + 1].sc; if (i === 0 || v > best) { best = v; bestI = i; } }
    const worst = [...scored].sort((a, b) => a.sc - b.sc)[0];
    return { peak: [scored[bestI].start, scored[bestI + 1].end], avoid: [worst.start, worst.end] };
  } catch { return null; }
}
/** '15:30' → '오후 3시 반' */
export function timeLabel(hhmm: string): string {
  const [hh, mm] = hhmm.split(':').map(Number);
  const per = hh < 12 ? '오전' : hh < 18 ? '오후' : hh < 21 ? '저녁' : '밤';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${per} ${h12}시${mm === 30 ? ' 반' : mm ? ` ${mm}분` : ''}`;
}
/** ['15:30','17:30'] → '오후 3시 반~5시 반' (같은 때면 뒤쪽 생략) */
export function rangeLabel([a, b]: [string, string]): string {
  const la = timeLabel(a); const lb = timeLabel(b);
  const pa = la.split(' ')[0]; const pb = lb.split(' ')[0];
  return pa === pb ? `${la}~${lb.slice(pb.length + 1)}` : `${la}~${lb}`;
}

/* ── 공개 API ── */
export interface TodayHook { avoid: string; peak: string; dayGz: string; dayGzKo: string }
/** 히어로: 오늘 조심할 시간대 + 좋은 시간대 (오늘의 운세 본문과 같은 값) */
export function todayHook(s: SajuData, today: string): TodayHook | null {
  const w = todayHourWindows(today, s);
  if (!w) return null;
  const gz = dayGz(today);
  return { avoid: rangeLabel(w.avoid), peak: rangeLabel(w.peak), dayGz: gz, dayGzKo: ganziKo(gz) };
}
/** 사주 없이도 쓰는 오늘 일진 */
export function todayGz(today: string): { gz: string; ko: string } {
  const gz = dayGz(today);
  return { gz, ko: ganziKo(gz) };
}

export type WeekKind = 'love-hap' | 'star-hap' | 'love' | 'ji-hap' | 'ji-chung';
export interface WeekFact { date: string; weekday: string; gz: string; text: string; kind: WeekKind; cat?: StarCat }
/** 이번 주(내일~6일 뒤) 가운데 구조 사실이 뚜렷한 하루 — 일간 합(연인의 별) > 일간 합 > 연인의 별 > 일지 합 > 일지 충 */
export function weekFact(s: SajuData, today: string): WeekFact | null {
  const dg = dayGanOf(s); const dj = dayJiOf(s);
  if (!dg) return null;
  const lc = loveCat(s);
  type Cand = { rank: number; date: string; gz: string; text: string; kind: WeekKind; cat?: StarCat };
  const cands: Cand[] = [];
  for (let i = 1; i <= 6; i++) {
    const date = addDays(today, i);
    const gz = dayGz(date);
    const st = starOf(dg, gz[0]);
    if (st && GAN_HAP[dg] === gz[0]) {
      cands.push(st.cat === lc
        ? { rank: 1, date, gz, text: '연인의 별과 짝(合)이 맞는 날', kind: 'love-hap' }
        : { rank: 2, date, gz, text: `${STAR_NAME[st.cat]}과 짝(合)이 맞는 날`, kind: 'star-hap', cat: st.cat });
    } else if (st?.cat === lc) {
      cands.push({ rank: 3, date, gz, text: '연인의 별이 들어오는 날', kind: 'love' });
    }
    if (dj && JI_HAP[dj] === gz[1]) cands.push({ rank: 4, date, gz, text: `태어난 날의 ${dj}${josa(JIJI_KO[dj] || '', '과', '와')} 짝(合)이 드는 날`, kind: 'ji-hap' });
    if (dj && CHUNG[dj] === gz[1]) cands.push({ rank: 5, date, gz, text: `태어난 날의 ${dj}${josa(JIJI_KO[dj] || '', '과', '와')} 부딪히는(沖) 날`, kind: 'ji-chung' });
  }
  if (cands.length === 0) return null;
  cands.sort((a, b) => a.rank - b.rank || a.date.localeCompare(b.date));
  const c = cands[0];
  return { date: c.date, weekday: weekdayOf(c.date), gz: c.gz, text: c.text, kind: c.kind, cat: c.cat };
}

export type MonthKind = 'samhap' | 'ji-hap' | 'ji-chung' | 'star-hap' | 'yongsin' | 'star';
export interface MonthFact { month: SajuMonth; gzKo: string; title: string; once: boolean; kind: MonthKind; cat?: StarCat }
/** 다음 사주 달의 구조 사실 — 삼합 완성 > 일지 합 > 일지 충 > 일간 합 > 용신 > 별 */
export function nextMonthFact(s: SajuData, today: string): MonthFact | null {
  const dg = dayGanOf(s); const dj = dayJiOf(s);
  if (!dg) return null;
  const mo = upcomingSajuMonths(today, 1)[0];
  if (!mo) return null;
  const mg = mo.gz[0]; const mb = mo.gz[1];
  const branches = (s.pillars || []).filter((p) => p && p.available !== false).map((p) => p.지지);
  const gzKo = ganziKo(mo.gz);
  for (const sh of SAMHAP) {
    if (!sh.set.includes(mb)) continue;
    if (sh.set.filter((b) => b !== mb).every((b) => branches.includes(b))) {
      return { month: mo, gzKo, once: true, title: `사주에 삼합(${sh.set.join('')})이 완성되는 달`, kind: 'samhap' };
    }
  }
  const jk = JIJI_KO[dj] || '';
  if (dj && JI_HAP[dj] === mb) return { month: mo, gzKo, once: true, title: `태어난 날의 ${dj}${josa(jk, '과', '와')} 짝(合)이 드는 달`, kind: 'ji-hap' };
  if (dj && CHUNG[dj] === mb) return { month: mo, gzKo, once: true, title: `태어난 날의 ${dj}${josa(jk, '과', '와')} 부딪히는(沖) 달`, kind: 'ji-chung' };
  const st = starOf(dg, mg);
  if (st && GAN_HAP[dg] === mg) return { month: mo, gzKo, once: false, title: `${STAR_NAME[st.cat]}과 짝(合)이 맞는 달`, kind: 'star-hap', cat: st.cat };
  const ma: any = s.myeongriAnalysis || {};
  if (ma.용신 && (BR_OH[mb] === ma.용신 || GAN_OH[mg] === ma.용신)) {
    return { month: mo, gzKo, once: false, title: `내 사주에 가장 필요한 기운(${OH_HANJA[ma.용신] || ma.용신})이 들어오는 달`, kind: 'yongsin' };
  }
  const sb = starOf(dg, mb);
  if (sb) return { month: mo, gzKo, once: false, title: `${STAR_NAME[sb.cat]}이 들어오는 달`, kind: 'star', cat: sb.cat };
  return null;
}

export interface LoveDday { month: SajuMonth; days: number; gzKo: string; hap: boolean; star: string }
/** 앞으로 12달 안에 연인의 별이 천간으로 들어오는 첫 달 (일간과 합이면 우선) */
export function loveDday(s: SajuData, today: string): LoveDday | null {
  const dg = dayGanOf(s);
  if (!dg) return null;
  const lc = loveCat(s);
  const months = upcomingSajuMonths(today, 12);
  const pick = months.find((m) => GAN_HAP[dg] === m.gz[0] && starOf(dg, m.gz[0])?.cat === lc)
    || months.find((m) => starOf(dg, m.gz[0])?.cat === lc);
  if (!pick) return null;
  return { month: pick, days: daysBetween(today, pick.start), gzKo: ganziKo(pick.gz), hap: GAN_HAP[dg] === pick.gz[0], star: pick.gz[0] };
}

export interface YearFact { year: number; gz: string; gzKo: string; star: string; ch: string; cat?: StarCat }
/** 대상 연도의 세운 — 지지 본기 / 천간 중 우선순위 높은 별 (재성 > 관성 > 인성 > 식상 > 비겁) */
export function yearFact(s: SajuData, year: number): YearFact | null {
  const dg = dayGanOf(s);
  const gz = Solar.fromYmd(year, 6, 1).getLunar().getYearInGanZhiExact();
  if (!dg) return { year, gz, gzKo: ganziKo(gz), star: '', ch: '' };
  const order: StarCat[] = ['재성', '관성', '인성', '식상', '비겁'];
  const cands = [gz[1], gz[0]]
    .map((ch) => ({ ch, st: starOf(dg, ch) }))
    .filter((x): x is { ch: string; st: { sip: SipsungKo; cat: StarCat } } => !!x.st);
  cands.sort((a, b) => order.indexOf(a.st.cat) - order.indexOf(b.st.cat));
  const top = cands[0];
  return { year, gz, gzKo: ganziKo(gz), star: top ? STAR_NAME[top.st.cat] : '', ch: top?.ch || '', cat: top?.st.cat };
}
/** 사주 없이도 쓰는 세운 간지 */
export function yearGz(year: number): { gz: string; ko: string } {
  const gz = Solar.fromYmd(year, 6, 1).getLunar().getYearInGanZhiExact();
  return { gz, ko: ganziKo(gz) };
}

/** 앞으로 12달 안에 이 별(들)이 천간이나 지지 본기로 처음 들어오는 사주 달 (홈 재물운, 합격이직운 카드) */
export function nextStarMonth(s: SajuData, today: string, cats: StarCat[]): { month: SajuMonth; days: number; cat: StarCat } | null {
  const dg = dayGanOf(s);
  if (!dg) return null;
  for (const m of upcomingSajuMonths(today, 12)) {
    const c = [starOf(dg, m.gz[0])?.cat, starOf(dg, m.gz[1])?.cat].find((x): x is StarCat => !!x && cats.includes(x));
    if (c) return { month: m, days: daysBetween(today, m.start), cat: c };
  }
  return null;
}

export function loveStars(s: SajuData): { count: number; chars: string[] } {
  const dg = dayGanOf(s); const lc = loveCat(s);
  const chars = chartChars(s).filter((c) => !c.isDayGan && starOf(dg, c.ch)?.cat === lc).map((c) => c.ch);
  return { count: chars.length, chars };
}

export function wealthStars(s: SajuData): { count: number; jeong: number; pyeon: number } {
  const dg = dayGanOf(s);
  let jeong = 0, pyeon = 0;
  for (const c of chartChars(s)) {
    if (c.isDayGan) continue;
    const st = starOf(dg, c.ch);
    if (st?.sip === '정재') jeong++;
    if (st?.sip === '편재') pyeon++;
  }
  return { count: jeong + pyeon, jeong, pyeon };
}

/** 시험·이직: 관성(자리)과 인성(공부)이 같은 기둥에 나란히 있는지 / 개수 */
export function examFact(s: SajuData): string {
  const dg = dayGanOf(s);
  const names = ['태어난 해', '태어난 달', '태어난 날', '태어난 시'];
  let gwan = 0, inn = 0;
  let together = '';
  (s.pillars || []).forEach((p, i) => {
    if (!p || p.available === false) return;
    const cats = [i === 2 ? undefined : starOf(dg, p.천간)?.cat, starOf(dg, p.지지)?.cat];
    if (cats.includes('관성') && cats.includes('인성') && !together) together = `${names[i]}(${p.천간}${p.지지})`;
    cats.forEach((c) => { if (c === '관성') gwan++; if (c === '인성') inn++; });
  });
  if (together) return `${together}에 시험과 자리의 별과 공부의 별이 나란히 있어요.`;
  if (gwan && inn) return `시험과 자리의 별 ${gwan}개, 공부의 별 ${inn}개가 함께 있는 사주예요.`;
  if (gwan) return `시험과 자리의 별이 ${gwan}개 있어요. 공부의 별이 들어오는 때를 짚어 드려요.`;
  if (inn) return `공부의 별이 ${inn}개 있어요. 시험과 자리의 별이 들어오는 때를 짚어 드려요.`;
  return '시험과 자리의 별이 들어오는 때를 짚어 드려요.';
}

/** 결혼: 일지(배우자 자리)에 앉은 별 */
export function spouseSeatFact(s: SajuData): string {
  const dg = dayGanOf(s); const dj = dayJiOf(s);
  const st = dj ? starOf(dg, dj) : null;
  if (!st) return '결혼 적기와 배우자 성향을 짚어 드려요.';
  return `배우자 자리(태어난 날 아래 글자)에 ${STAR_NAME[st.cat]}(${dj})이 앉아 있어요.`;
}

export interface Persona {
  dayGz: string;
  identity: string;
  pillars: string[];
  birthYearGz: string;
  daeun: Array<{ gz: string; age: number; year?: number }>;
  currentIdx: number;
  current?: { gz: string; from: number; to: number };
  nextYear?: number;
}
/** 사주책 표지·대운 띠용 */
export function persona(s: SajuData): Persona | null {
  const dg = dayGanOf(s); const dj = dayJiOf(s);
  if (!dg || !dj) return null;
  const meaning = getIljuMeaning(`${dg}${dj}`);
  const list: DaeUn[] = Array.isArray(s.daeun) ? s.daeun.filter((d) => d && d.간지).slice(0, 8) : [];
  const cur = findCurrentDaeun(s.daeun || [], (s.input as any)?.birthYear);
  const currentIdx = cur ? list.findIndex((d) => d.간지 === cur.간지 && d.시작나이 === cur.시작나이) : -1;
  const next = currentIdx >= 0 ? list[currentIdx + 1] : undefined;
  return {
    dayGz: `${dg}${dj}`,
    identity: meaning?.identity || '',
    pillars: (s.pillars || []).map((p) => (p && p.available !== false ? `${p.천간}${p.지지}` : '')),
    birthYearGz: s.pillars?.[0] ? `${s.pillars[0].천간}${s.pillars[0].지지}` : '',
    daeun: list.map((d) => ({ gz: d.간지, age: d.시작나이, year: d.시작년도 })),
    currentIdx,
    current: cur ? { gz: cur.간지, from: cur.시작나이, to: cur.끝나이 } : undefined,
    nextYear: next?.시작년도,
  };
}

/** 표시용 */
export function monthDayLabel(dateKey: string): string {
  const [, mm, dd] = kstParts(dateKey);
  return `${mm}월 ${dd}일`;
}
export { ganziKo };
