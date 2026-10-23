/* 신년운세 무료 미리 보기 대조 시험 (2026-10-23)
 *   미리 보기(src/services/saju/newYearPreview.ts, 화면 NewYearPreviewCard)와 서버 신년운세(functions/lib)가 같은 사주, 같은 대상 연도에서
 *   좋은 달, 조심할 달, 그 해 판정, 꼭 기억할 날을 똑같이 내는지 본다. AI 호출 없음: claudeClient 를 가짜 연결로 바꿔 원가 0.
 *   사용: (cd functions && npm run build) 뒤 루트에서  npx tsx scripts/test/newyear_preview_parity.ts
 *   사주는 화면과 같은 클라 calculateSaju 로 만든다. 서버 generateTojung 은 화면이 보낸 sajuData 를 그대로 쓴다(index.ts).
 *   서버 규칙(sajuFacts monthVerdictRow, monthBaseScore, dayPicksForYear, claudeTojung planMonthRank)을 바꾸면 꼭 돌린다. */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { Solar } from 'lunar-javascript';
import { calculateSaju } from '../../src/services/saju/calculator';
import { newYearPreview, monthVerdict, yearKeyDates, roleVerdict, planMonths } from '../../src/services/saju/newYearPreview';
import { kstToday } from '../../src/utils/kstDate';
import type { SajuData, SajuInput } from '../../src/types/saju';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FN = path.join(ROOT, 'functions');
const req = createRequire(import.meta.url);

/* ── 서버 쪽: functions/lib 의 실제 코드. 원가 기록과 Claude 연결만 가짜로 ── */
const stub = (rel: string, exports: any) => {
  const p = req.resolve(path.join(FN, rel));
  (req.cache as any)[p] = { id: p, filename: p, loaded: true, exports };
};
stub('lib/shared/aiUsageLog.js', { logAiUsage() {}, logAnthropicUsage() {} });
let fakeCalls = 0;
const reply = (obj: any) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 0, output_tokens: 0 } });
function fakeCreate(params: any) {
  fakeCalls++;
  const text = String(params?.messages?.[0]?.content || '');
  const g = (text.match(/그룹 ([ABC])/) || [])[1];
  if (g === 'A') {
    // 네 칸 설명은 비워 둔다 → 서버 문장(좋은 달 설명은 goodIsDecide 에 따라 다름)이 그대로 드러난다
    return reply({
      headline: '시험 문장입니다', pullQuote: '시험', keywords: ['시험', '대조', '확인'],
      fourBox: [{ head: '상반기', value: '', desc: '' }, { head: '하반기', value: '', desc: '' }, { head: '좋은 달', value: '', desc: '' }, { head: '조심할 달', value: '', desc: '' }],
      categoryScores: { 총운: 71, 금전운: 72, 건강운: 73, 직장운: 74, 애정운: 76, 결혼운: 77 },
      yearOverview: { 총운: '시험' }, turningPoints: [], luckyAdvice: '시험',
    });
  }
  const from = g === 'C' ? 7 : 1;
  return reply({ months: Array.from({ length: 6 }, (_, i) => ({ month: from + i, keyword: '시험', score: 50, 전통해석: '시험', 현대해석: '시험', todo: '시험', avoid: '시험' })) });
}
stub('lib/shared/claudeClient.js', {
  CLAUDE_MODEL: { opus: 'stub-opus', sonnet: 'stub-sonnet', haiku: 'stub-haiku' },
  CONVERSATIONAL: {},
  createClaude: () => ({ messages: { create: async (p: any) => fakeCreate(p) } }),
});
const tojung = req(path.join(FN, 'lib/ai/claudeTojung.js'));
const facts = req(path.join(FN, 'lib/ai/sajuFacts.js'));

/* ── 사람 고르기: 서윤 + 생년월일, 시간, 성별을 달리한 사람들. 용신 오행이 고르게 ── */
function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = mulberry32(20261023);
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
type Person = { label: string; sd: SajuData };
const seoyun: SajuData = JSON.parse(fs.readFileSync(path.join(ROOT, 'scratch/qa_samples/seoyun_saju.json'), 'utf8'));
const people: Person[] = [{ label: '서윤(저장본 1996-05-14 06:30 여)', sd: seoyun }];
{
  const sIn = seoyun.input as SajuInput;
  people.push({ label: '서윤(클라 calculateSaju 다시 계산)', sd: calculateSaju(sIn) });
}
const OH = ['목', '화', '토', '금', '수'];
const PER_OH = 7;
const byOh: Record<string, Person[]> = { 목: [], 화: [], 토: [], 금: [], 수: [] };
const candidates: Person[] = [];
for (let i = 0; i < 600; i++) {
  const hasTime = rnd() > 0.25;
  const lunar = rnd() < 0.12;
  const input: SajuInput = {
    name: `시험${i}`, relation: '본인', gender: rnd() < 0.5 ? 'male' : 'female',
    birthYear: ri(1950, 2008), birthMonth: ri(1, 12), birthDay: ri(1, lunar ? 29 : 28),
    calendarType: lunar ? 'lunar' : 'solar', hasBirthTime: hasTime,
    ...(hasTime ? { birthHour: ri(0, 23), birthMinute: ri(0, 59) } : {}),
  } as any;
  let sd: SajuData;
  try { sd = calculateSaju(input); } catch { continue; }
  const yong = (sd as any)?.myeongriAnalysis?.용신;
  const t = `${input.birthYear}-${String(input.birthMonth).padStart(2, '0')}-${String(input.birthDay).padStart(2, '0')}${lunar ? '(음력)' : ''} ${hasTime ? `${String(input.birthHour).padStart(2, '0')}:${String(input.birthMinute).padStart(2, '0')}` : '시간 모름'} ${input.gender === 'male' ? '남' : '여'} 용신 ${yong || '없음'}`;
  candidates.push({ label: t, sd });
}
// 용신마다 PER_OH 명: 시간 모름 둘 이상, 남녀 섞이게
for (const oh of OH) {
  const pool = candidates.filter((c) => (c.sd as any).myeongriAnalysis?.용신 === oh);
  const noTime = pool.filter((c) => c.sd.pillars?.[3]?.available === false).slice(0, 2);
  const rest = pool.filter((c) => !noTime.includes(c));
  const male = rest.filter((c) => c.sd.input?.gender === 'male');
  const female = rest.filter((c) => c.sd.input?.gender !== 'male');
  const pick: Person[] = [...noTime];
  while (pick.length < PER_OH && (male.length || female.length)) {
    const from = pick.length % 2 ? female : male;
    const x = (from.length ? from : male.length ? male : female).shift();
    if (x) pick.push(x);
  }
  byOh[oh] = pick;
  people.push(...pick);
}
// 드문 갈래(결정해도 되는 달이 없는 해, 서명 피하는 달이 없는 해)도 들어가게 몇 명 더
const years = [2026, 2027, 2028, 2029, 2030, 2031, 2032];
const used = new Set(people.map((p) => p.label));
const extra = (pred: (sd: SajuData) => boolean, n: number) => {
  for (const c of candidates) { if (n <= 0) break; if (!used.has(c.label) && pred(c.sd)) { people.push(c); used.add(c.label); n--; } }
};
extra((sd) => [2026, 2027, 2028].some((y) => { const r = tojung.planMonthRank(y, sd); return r.hasTable && !r.goodIsDecide; }), 3);
extra((sd) => [2026, 2027, 2028].some((y) => { const r = tojung.planMonthRank(y, sd); return r.hasTable && !Object.values(r.rows).some((x: any) => x?.action === '서명 피함'); }), 3);

/* ── 비교 ── */
const bad: string[] = [];
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const check = (ok: boolean, msg: string) => { if (!ok) bad.push(msg); };
const stat = { monthRows: 0, yearPlans: 0, noDecide: 0, noAvoid: 0, actions: { '결정해도 됨': 0, '준비만': 0, '서명 피함': 0 } as Record<string, number>, e2e: 0, changedVsOld: 0 };

// 1) 순수 계산: 해마다 열두 달 판정, 좋은 달과 조심할 달, 꼭 기억할 날, 그 해 판정
for (const pp of people) {
  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      const s = facts.monthVerdictRow(y, m, pp.sd);
      const c = monthVerdict(y, m, pp.sd);
      stat.monthRows++;
      if (s) stat.actions[s.action]++;
      check(!!s === !!c, `${pp.label} ${y}-${m} 판정표 유무 서버 ${!!s} 클라 ${!!c}`);
      if (s && c) {
        for (const k of ['gz', 'yearGz', 'daeunGz', 'verdict', 'action', 'score'] as const) {
          check(s[k] === (c as any)[k], `${pp.label} ${y}-${m} ${k} 서버 ${s[k]} 클라 ${(c as any)[k]}`);
        }
      }
    }
    const sr = tojung.planMonthRank(y, pp.sd);
    const cr = planMonths(y, pp.sd);
    stat.yearPlans++;
    if (sr.hasTable && !sr.goodIsDecide) stat.noDecide++;
    if (sr.hasTable && !Object.values(sr.rows).some((x: any) => x?.action === '서명 피함')) stat.noAvoid++;
    check(eq(sr.good, cr.good), `${pp.label} ${y} 좋은 달 서버 ${sr.good} 클라 ${cr.good}`);
    check(eq(sr.caution, cr.caution), `${pp.label} ${y} 조심할 달 서버 ${sr.caution} 클라 ${cr.caution}`);
    check(sr.goodIsDecide === cr.goodIsDecide && sr.hasTable === cr.hasTable, `${pp.label} ${y} goodIsDecide/hasTable 다름`);
    const sk = facts.dayPicksForYear(y, pp.sd).keyDates.map((k: any) => String(k.date).split('(')[0]);
    const ck = yearKeyDates(y, pp.sd).map((k) => `${k.m}/${k.d}`);
    check(eq(sk, ck), `${pp.label} ${y} 꼭 기억할 날 서버 ${sk} 클라 ${ck}`);
    const ygz = tojung.yearPillar ? tojung.yearPillar(y) : Solar.fromYmd(y, 6, 1).getLunar().getEightChar().getYear();
    const pv = newYearPreview(y, pp.sd);
    check(!!pv && pv.yearGz === ygz, `${pp.label} ${y} 세운 간지 다름`);
    const rv = roleVerdict(ygz, pp.sd, '해');
    const clientYearText = rv ? `${ygz} = ${ygz[0]}(${rv.g}, ${rv.r1}) + ${ygz[1]}(${rv.b}, ${rv.r2}) → ${rv.verdict}` : '';
    check(facts.ganziRoleText(ygz, pp.sd, '해') === clientYearText, `${pp.label} ${y} 그 해 판정 서버 ${facts.ganziRoleText(ygz, pp.sd, '해')} 클라 ${clientYearText}`);
  }
}

// 1-2) 드문 갈래 덮기(합성 사주): 실제 사람 여섯의 원국에 용신, 희신, 기신 60가지 조합을 바꿔 끼우고,
//      일지가 빠진 데이터(일지 충 달이 없어 '서명 피하는 달 없는 해'가 생김), 대운 연도가 없는 옛 저장본, 용신 없는 데이터도 넣는다
const synth = { plans: 0, noDecide: 0, noAvoid: 0, goodFallback1: 0, noYong: 0 };
{
  const base = [people[0], ...OH.map((o) => byOh[o][0]).filter(Boolean)].slice(0, 6);
  const variants: Array<{ label: string; sd: SajuData }> = [];
  for (const pp of base) {
    for (const yo of OH) for (const he of OH) for (const gi of OH) {
      if (yo === he || yo === gi || he === gi) continue;
      const sd = JSON.parse(JSON.stringify(pp.sd));
      sd.myeongriAnalysis = { ...sd.myeongriAnalysis, 용신: yo, 희신: he, 기신: gi };
      variants.push({ label: `${pp.label} 합성 ${yo}/${he}/${gi}`, sd });
      if (yo === '토' && he === '화') {
        const noDayJi = JSON.parse(JSON.stringify(sd)); noDayJi.pillars[2].지지 = '';
        variants.push({ label: `${pp.label} 합성 일지 없음`, sd: noDayJi });
        const oldDaeun = JSON.parse(JSON.stringify(sd)); oldDaeun.daeun = (oldDaeun.daeun || []).map((x: any) => { const { 시작년도: _a, 끝년도: _b, ...r } = x; return r; });
        variants.push({ label: `${pp.label} 합성 대운 연도 없음`, sd: oldDaeun });
        const onlyYong = JSON.parse(JSON.stringify(sd)); onlyYong.myeongriAnalysis = { ...onlyYong.myeongriAnalysis, 희신: undefined, 기신: undefined };
        variants.push({ label: `${pp.label} 합성 용신만`, sd: onlyYong });
        const noYong = JSON.parse(JSON.stringify(sd)); noYong.myeongriAnalysis = { ...noYong.myeongriAnalysis, 용신: undefined };
        variants.push({ label: `${pp.label} 합성 용신 없음`, sd: noYong });
      }
    }
  }
  for (const v of variants) {
    for (const y of [2026, 2027, 2028]) {
      for (let m = 1; m <= 12; m++) {
        const s = facts.monthVerdictRow(y, m, v.sd); const c = monthVerdict(y, m, v.sd);
        check(!!s === !!c, `${v.label} ${y}-${m} 판정표 유무 다름`);
        if (s && c) for (const k of ['gz', 'yearGz', 'daeunGz', 'verdict', 'action', 'score'] as const) check(s[k] === (c as any)[k], `${v.label} ${y}-${m} ${k} 서버 ${s[k]} 클라 ${(c as any)[k]}`);
      }
      const sr = tojung.planMonthRank(y, v.sd); const cr = planMonths(y, v.sd);
      synth.plans++;
      if (!sr.hasTable) synth.noYong++;
      if (sr.hasTable && !sr.goodIsDecide) synth.noDecide++;
      if (sr.hasTable && !Object.values(sr.rows).some((x: any) => x?.action === '서명 피함')) synth.noAvoid++;
      if (sr.hasTable && !Object.values(sr.rows).some((x: any) => x?.action !== '서명 피함')) synth.goodFallback1++;
      check(eq(sr.good, cr.good) && eq(sr.caution, cr.caution) && sr.goodIsDecide === cr.goodIsDecide && sr.hasTable === cr.hasTable,
        `${v.label} ${y} 서버 ${sr.good}/${sr.caution}/${sr.goodIsDecide} 클라 ${cr.good}/${cr.caution}/${cr.goodIsDecide}`);
      if (y === 2027) {
        const sk = facts.dayPicksForYear(y, v.sd).keyDates.map((k: any) => String(k.date).split('(')[0]);
        const ck = yearKeyDates(y, v.sd).map((k) => `${k.m}/${k.d}`);
        check(eq(sk, ck), `${v.label} ${y} 꼭 기억할 날 서버 ${sk} 클라 ${ck}`);
        const pv = newYearPreview(y, v.sd);
        check(!!pv === !!(v.sd as any).myeongriAnalysis?.용신, `${v.label} 용신 없을 때 미리 보기는 숨겨야 함`);
      }
    }
  }
}

// 예전 미리 보기 규칙(10-23 이전, 세운 역할만) — 서윤 전후 비교와 바뀐 사람 수 세기용
function oldPreview(y: number, sd: SajuData) {
  const months = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, v: roleVerdict((Solar.fromYmd(y, i + 1, 15).getLunar() as any).getEightChar().getMonth(), sd, '달')?.verdict || '' }));
  let good = months.filter((x) => x.v === '도움 기운이 강한 달').map((x) => x.m);
  if (!good.length) good = months.filter((x) => x.v === '도움 기운이 들어오는 달').map((x) => x.m);
  return { good, hard: months.filter((x) => x.v === '부담 기운이 강한 달').map((x) => x.m) };
}

// 2) 끝까지: 서버 generateTojungBigyeol 을 가짜 연결로 돌려 결제 뒤 화면 값(네 칸, 꼭 기억할 날, 대상 연도, 달 판정)과 미리 보기 값 비교.
//    '오늘'을 바꿔 가며 대상 연도 규칙(서버 kstNow, 화면 kstToday)이 같은지도 본다. UTC 시각으로 KST 자정 앞뒤를 넣는다
const NOWS: Array<{ label: string; ms: number }> = [
  { label: '실제 지금', ms: Date.now() },
  { label: 'KST 2026-09-30 23:59 (UTC 14:59)', ms: Date.UTC(2026, 8, 30, 14, 59) },
  { label: 'KST 2026-10-01 00:30 (UTC 09-30 15:30)', ms: Date.UTC(2026, 8, 30, 15, 30) },
  { label: 'KST 2027-10-01 08:00 (UTC 09-30 23:00)', ms: Date.UTC(2027, 8, 30, 23, 0) },
];
const realNow = Date.now;
const realWarn = console.warn;
const lines: string[] = [];
async function main() {
  console.warn = () => {}; // 서버 측정용 로그(가짜 응답이라 '서버 문장으로 교체' 등이 쏟아진다)는 끈다
  for (const sc of NOWS) {
    Date.now = () => sc.ms;
    const [cy, cm] = kstToday().split('-').map(Number);
    const clientTY = cm >= 10 ? cy + 1 : cy; // TojungPage newYearTarget 과 같은 식
    const serverTY = tojung.tojungTargetYear();
    check(clientTY === serverTY, `${sc.label} 대상 연도 서버 ${serverTY} 화면 ${clientTY}`);
    const runs = await Promise.all(people.map(async (pp) => ({ pp, out: await tojung.generateTojungBigyeol('no-key-stub', JSON.parse(JSON.stringify(pp.sd))) })));
    for (const { pp, out } of runs) {
      stat.e2e++;
      const pv = newYearPreview(clientTY, pp.sd);
      if (!pv) { bad.push(`${sc.label} ${pp.label} 미리 보기 없음`); continue; }
      const fb = (h: string) => (out.fourBox || []).find((x: any) => x.head === h);
      const cardGoodLabel = pv.goodLabel === '도움 기운이 강한 달' ? '좋은 달' : '도움이 오는 달'; // NewYearPreviewCard 와 같은 식
      check(out.targetYear === clientTY, `${sc.label} ${pp.label} 결과 대상 연도 ${out.targetYear} 화면 ${clientTY}`);
      check(out.hexagram?.glyph === pv.yearGz, `${sc.label} ${pp.label} 세운 간지 결과 ${out.hexagram?.glyph} 미리 보기 ${pv.yearGz}`);
      check(!!fb(cardGoodLabel), `${sc.label} ${pp.label} 좋은 달 이름 '${cardGoodLabel}' 이 결과 네 칸 머리에 없음`);
      check(fb('좋은 달')?.value === `${pv.goodMonths.join(', ')}월`, `${sc.label} ${pp.label} 좋은 달 결과 ${fb('좋은 달')?.value} 미리 보기 ${pv.goodMonths.join(', ')}월`);
      check(fb('조심할 달')?.value === `${pv.hardMonths.join(', ')}월`, `${sc.label} ${pp.label} 조심할 달 결과 ${fb('조심할 달')?.value} 미리 보기 ${pv.hardMonths.join(', ')}월`);
      const goodDesc = pv.goodIsDecide ? '계약과 큰 결정은 이 달들에 잡아 보세요' : '준비해 둔 일을 하나씩 꺼내기 좋아요';
      check(fb('좋은 달')?.desc === goodDesc, `${sc.label} ${pp.label} 좋은 달 설명(goodIsDecide) 결과 ${fb('좋은 달')?.desc}`);
      const ok = (out.keyDates || []).map((k: any) => String(k.date).split('(')[0]);
      const pk = pv.keyDates.map((k) => `${k.m}/${k.d}`);
      check(eq(ok, pk), `${sc.label} ${pp.label} 꼭 기억할 날 결과 ${ok} 미리 보기 ${pk}`);
      // 화면이 쓰는 꼭 기억할 날 첫 날과 개수
      check(pk[0] === ok[0] && pk.length === ok.length, `${sc.label} ${pp.label} 꼭 기억할 날 첫 날, 개수 다름`);
      // 결과 달 카드의 판정과 행동 등급(서버가 판정표로 붙임)
      for (const m of out.months || []) {
        const c = monthVerdict(clientTY, Number(m.month), pp.sd);
        check(!!c && m.verdict === c.verdict && m.action === c.action, `${sc.label} ${pp.label} ${m.month}월 결과 판정 ${m.verdict}/${m.action} 미리 보기 ${c?.verdict}/${c?.action}`);
      }
      const old = oldPreview(clientTY, pp.sd);
      if (sc.label === '실제 지금') {
        if (!eq(old.good, pv.goodMonths) || !eq(old.hard, pv.hardMonths)) stat.changedVsOld++;
        if (pp.label.startsWith('서윤')) {
          lines.push(`${pp.label} ${clientTY}년: 예전 미리 보기 좋은 달 ${old.good.join(', ') || '없음'}월, 조심할 달 ${old.hard.join(', ') || '없음'}월`
            + ` → 새 미리 보기 좋은 달 ${pv.goodMonths.join(', ')}월, 조심할 달 ${pv.hardMonths.join(', ')}월, 꼭 기억할 날 ${pk.join(', ')}, 그 해 ${pv.year?.verdict}`
            + ` / 결제 뒤 네 칸 ${fb('좋은 달')?.value}, ${fb('조심할 달')?.value}, 꼭 기억할 날 ${ok.join(', ')}`);
        }
      }
    }
  }
  Date.now = realNow;
  console.warn = realWarn;

  const ohCount = OH.map((o) => `${o} ${people.filter((p) => (p.sd as any).myeongriAnalysis?.용신 === o).length}`).join(', ');
  const noTime = people.filter((p) => p.sd.pillars?.[3]?.available === false).length;
  const lunarN = people.filter((p) => (p.sd.input as any)?.calendarType === 'lunar').length;
  const males = people.filter((p) => p.sd.input?.gender === 'male').length;
  console.log(`사람 ${people.length}명 (용신 ${ohCount} / 시간 모름 ${noTime} / 음력 입력 ${lunarN} / 남 ${males}, 여 ${people.length - males})`);
  console.log(`순수 계산 비교: 달 판정 ${stat.monthRows}칸(결정해도 됨 ${stat.actions['결정해도 됨']}, 준비만 ${stat.actions['준비만']}, 서명 피함 ${stat.actions['서명 피함']}), 해 계획 ${stat.yearPlans}개(결정해도 되는 달 없는 해 ${stat.noDecide}, 서명 피하는 달 없는 해 ${stat.noAvoid}), 대상 연도 ${years.join(', ')}`);
  console.log(`합성 사주(드문 갈래): 해 계획 ${synth.plans}개(결정해도 되는 달 없는 해 ${synth.noDecide}, 서명 피하는 달 없는 해 ${synth.noAvoid}, 모든 달이 서명 피함인 해 ${synth.goodFallback1}, 용신 없음 ${synth.noYong})`);
  console.log(`끝까지 비교: 서버 신년운세 ${stat.e2e}건(오늘 ${NOWS.length}가지), 가짜 연결 호출 ${fakeCalls}회, 실제 AI 호출 0`);
  console.log(`예전 미리 보기 규칙과 좋은 달이나 조심할 달이 달라진 사람: ${stat.changedVsOld}/${people.length}`);
  lines.forEach((l) => console.log(l));
  console.log(`어긋남 ${bad.length}건`);
  bad.slice(0, 40).forEach((b) => console.log('  - ' + b));
  process.exit(bad.length ? 1 : 0);
}
main().catch((e) => { Date.now = realNow; console.warn = realWarn; console.error(e); process.exit(2); });
