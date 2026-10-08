/**
 * sajuFacts — AI 에게 '계산'시키지 않고 서버가 결정론으로 주는 사주 사실 + 출력 정리 (2026-10-04)
 *
 * 배경 (10-04 고객 시점 전수 시식): 모델이 직접 계산한 사실이 틀려 사주를 아는 고객에게 신뢰를 잃는다.
 *   ① 월건을 올해 1~12월만 줘서, 10월에 받은 결과의 '내년 1~4월' 간지를 모델이 지어냄 (2027-01 辛丑 → '己丑')
 *   ② 귀인 표가 틀려(문창 '甲乙: 巳·午') 乙 일간에 '월지 巳 = 문창귀인' 오판 → 아키타입까지 오염
 *   ③ '오후 5~7시 = 수 기운 유시' 처럼 시진 오행을 틀림 (酉 = 금)
 *   ④ 본문에 '적천수에서 ~고 했는데' 출처 노출 (정책상 금지) · 相官格 같은 오기 한자
 * 해법: 사실은 표로 주고 "이 표에 없는 것은 쓰지 말 것", 출력은 sanitizeAiOutput 으로 마지막 정리.
 */
import { Solar } from 'lunar-javascript';

const BR_OHENG: Record<string, string> = {
  子: '수', 丑: '토', 寅: '목', 卯: '목', 辰: '토', 巳: '화', 午: '화', 未: '토', 申: '금', 酉: '금', 戌: '토', 亥: '수',
};
const OHENG_GAN: Record<string, [string, string]> = {
  목: ['甲', '乙'], 화: ['丙', '丁'], 토: ['戊', '己'], 금: ['庚', '辛'], 수: ['壬', '癸'],
};

/** 오행 → 대표 천간 2자 (오늘의 운세 '만나면 좋은 사람' 글자 SSOT) */
export function ohengGlyphs(oheng: string | undefined): [string, string] | null {
  return (oheng && OHENG_GAN[oheng]) || null;
}

/** 이번 달부터 count 개월 월건 (각 달 15일 = 절입 경계 회피) + 지난 달 안내. now 는 KST 값을 담은 Date */
export function upcomingMonthPillarsText(now: Date, count = 15): string {
  try {
    const y0 = now.getFullYear();
    const m0 = now.getMonth() + 1;
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const y = y0 + Math.floor((m0 - 1 + i) / 12);
      const m = ((m0 - 1 + i) % 12) + 1;
      const ec = Solar.fromYmd(y, m, 15).getLunar().getEightChar();
      const mz = ec.getMonth();
      out.push(`${y}년 ${m}월 ${mz}(${BR_OHENG[mz.slice(1)] || ''})${i === 0 ? ' ← 이번 달' : ''}`);
    }
    const past = m0 > 1 ? `\n※ ${y0}년 1~${m0 - 1}월은 이미 지난 달 — 추천·회피 시기로 쓰지 말 것 (과거 회고로만 언급 가능).` : '';
    return out.join(' · ') + past;
  } catch {
    return '';
  }
}

/* 귀인·신살 표 (정통 표 — 일간/일지·년지 기준) */
const CHEONEUL: Record<string, string[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'], 辛: ['寅', '午'], 壬: ['巳', '卯'], 癸: ['巳', '卯'],
};
const MUNCHANG: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const HAKDANG: Record<string, string> = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
const TAEGEUK: Record<string, string[]> = {
  甲: ['子', '午'], 乙: ['子', '午'], 丙: ['卯', '酉'], 丁: ['卯', '酉'], 戊: ['辰', '戌', '丑', '未'], 己: ['辰', '戌', '丑', '未'],
  庚: ['寅', '亥'], 辛: ['寅', '亥'], 壬: ['巳', '申'], 癸: ['巳', '申'],
};
/** 삼합 그룹별 도화·역마·화개 (기준 지지 → 해당 지지) */
const SAMHAP: Array<{ g: string[]; dohwa: string; yeokma: string; hwagae: string }> = [
  { g: ['申', '子', '辰'], dohwa: '酉', yeokma: '寅', hwagae: '辰' },
  { g: ['寅', '午', '戌'], dohwa: '卯', yeokma: '申', hwagae: '戌' },
  { g: ['巳', '酉', '丑'], dohwa: '午', yeokma: '亥', hwagae: '丑' },
  { g: ['亥', '卯', '未'], dohwa: '子', yeokma: '巳', hwagae: '未' },
];
const samhapOf = (br: string) => SAMHAP.find((s) => s.g.includes(br));

/**
 * 귀인·신살 확정표 — 원국(년·월·일·시지) + 현재 대운·올해 세운·다가오는 월 중 어디에 걸리는지.
 * pillars: [{지지}] 년·월·일·시 순서 (시 미상이면 3개). monthBranches: 다가오는 월 [{label, br}]
 */
export function gwiinFactsText(args: {
  dayGan: string;
  natal: Array<{ pos: string; br: string }>;
  daeunBranch?: string;
  daeunLabel?: string;
  yearBranch?: string;
  yearLabel?: string;
  now?: Date;
}): string {
  const { dayGan, natal } = args;
  if (!dayGan || !CHEONEUL[dayGan]) return '';
  const months: Array<{ label: string; br: string }> = [];
  try {
    const now = args.now || new Date();
    const y0 = now.getFullYear(); const m0 = now.getMonth() + 1;
    for (let i = 0; i < 15; i++) {
      const y = y0 + Math.floor((m0 - 1 + i) / 12); const m = ((m0 - 1 + i) % 12) + 1;
      const mz = Solar.fromYmd(y, m, 15).getLunar().getEightChar().getMonth();
      months.push({ label: `${y}년 ${m}월`, br: mz.slice(1) });
    }
  } catch { /* noop */ }
  const where = (targets: string[]) => {
    const parts: string[] = [];
    const natalHits = natal.filter((n) => targets.includes(n.br)).map((n) => `${n.pos} ${n.br}`);
    parts.push(natalHits.length ? `원국 보유(${natalHits.join(', ')})` : '원국 없음');
    if (args.daeunBranch && targets.includes(args.daeunBranch)) parts.push(`현재 대운 ${args.daeunLabel || args.daeunBranch} 에 걸림`);
    if (args.yearBranch && targets.includes(args.yearBranch)) parts.push(`올해 세운 ${args.yearLabel || args.yearBranch} 에 걸림`);
    const mh = months.filter((m) => targets.includes(m.br)).map((m) => m.label);
    if (mh.length) parts.push(`해당 월: ${mh.join('·')}`);
    return parts.join(' / ');
  };
  const lines: string[] = [];
  lines.push(`- 천을귀인(${CHEONEUL[dayGan].join('·')}): ${where(CHEONEUL[dayGan])}`);
  lines.push(`- 문창귀인(${MUNCHANG[dayGan]}): ${where([MUNCHANG[dayGan]])}`);
  lines.push(`- 학당귀인(${HAKDANG[dayGan]}): ${where([HAKDANG[dayGan]])}`);
  lines.push(`- 태극귀인(${TAEGEUK[dayGan].join('·')}): ${where(TAEGEUK[dayGan])}`);
  const dayBr = natal.find((n) => n.pos === '일지')?.br;
  const yearBr = natal.find((n) => n.pos === '년지')?.br;
  const bases = Array.from(new Set([dayBr, yearBr].filter(Boolean) as string[]));
  for (const base of bases) {
    const s = samhapOf(base);
    if (!s) continue;
    const label = base === dayBr && base === yearBr ? '일지·년지' : base === dayBr ? '일지' : '년지';
    lines.push(`- 도화(${label} ${base} 기준 → ${s.dohwa}): ${where([s.dohwa])}`);
    lines.push(`- 역마(${label} ${base} 기준 → ${s.yeokma}): ${where([s.yeokma])}`);
    lines.push(`- 화개(${label} ${base} 기준 → ${s.hwagae}): ${where([s.hwagae])}`);
  }
  return lines.join('\n');
}

/** 시진(時辰) 오행 — 한국 진태양시 보정 기준(경계 :30). 시간대 근거는 이 표로만 */
export const SIJIN_OHENG_LINE =
  '23:30~01:30 子(수) · 01:30~03:30 丑(토) · 03:30~05:30 寅(목) · 05:30~07:30 卯(목) · 07:30~09:30 辰(토) · ' +
  '09:30~11:30 巳(화) · 11:30~13:30 午(화) · 13:30~15:30 未(토) · 15:30~17:30 申(금) · 17:30~19:30 酉(금) · ' +
  '19:30~21:30 戌(토) · 21:30~23:30 亥(수)';

/* ── 출력 정리 ── */
const SOURCE_RE = /(?:자평진전|적천수천미|적천수|궁통보감|연해자평|명리약언|삼명통회|명리정종|난강망)파?\s*(?:에서는|에서도|에서|에 따르면|에선|에는|은|는|의 표현으로|의|이)?\s*/g;
const HANJA_FIX: Array<[RegExp, string]> = [
  [/相官格/g, '傷官格'], [/相官/g, '傷官'], [/偐財/g, '偏財'], [/偏才/g, '偏財'], [/正才/g, '正財'],
  [/七煞/g, '七殺'], [/花蓋/g, '華蓋'],
];
/* 검증 불가 보장 문구 — 프롬프트로 금지해도 경량 모델이 가끔 쓰는 상투구 (10-07 운영 실측: 배포 후 오늘의 운세 2건) */
const GUARANTEE_FIX: Array<[RegExp, string]> = [
  [/성공 확률이 (?:크게 |훨씬 |더 |한층 )?(?:높아집니다|높아져요|올라갑니다|올라가요|높습니다|높아요)/g, '한결 수월하게 풀리기 쉬워요'],
  [/(?:앞으로 |향후 )?3개월간 좋은 결과를 만듭니다/g, '좋은 흐름으로 이어지기 쉬워요'],
  [/합격률이 (?:두|2) ?배(?:입니다|예요|이에요)?/g, '합격 가능성을 높여주는 경로예요'],
];
function fixTime(s: string): string {
  return s.replace(/(오전|오후)\s?(1[3-9]|2[0-3])시/g, (_m, _ap, h) => `오후 ${Number(h) - 12}시`);
}
export function sanitizeText(s: string): string {
  let t = s.replace(SOURCE_RE, '');
  for (const [re, to] of HANJA_FIX) t = t.replace(re, to);
  for (const [re, to] of GUARANTEE_FIX) t = t.replace(re, to);
  t = fixTime(t);
  return t;
}
/** 결과 JSON 의 모든 문자열 정리 (키는 그대로) */
export function sanitizeAiOutput<T>(obj: T): T {
  const walk = (v: any): any => {
    if (typeof v === 'string') return sanitizeText(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o: any = {};
      for (const [k, x] of Object.entries(v)) o[k] = walk(x);
      return o;
    }
    return v;
  };
  try { return walk(obj); } catch { return obj; }
}

/* ── 오늘의 운세 '만나면 좋은/부딪힐/편한 사람' 글자 SSOT (2026-10-04) ──
 *   운영 실측: 최근 40건 중 20건이 프롬프트 예시(壬癸/庚辛/戊己)를 그대로 복사 — 일간 무관.
 *   을목·용신 수·희신 금·기신 토 사주에 '금=부딪힐 사람, 토=편한 사람' 으로 결정론 분석과 정반대가 나갔다.
 *   → 용신=끌어주는 사람, 희신=편안한 사람, 기신=부딪힐 사람으로 서버가 확정. */
const OHENG_TRAIT: Record<string, string> = {
  목: '다정하고 배우고 키우는 이야기를 즐기는',
  화: '밝고 표현이 많으며 추진력 있는',
  토: '듬직하고 현실적이며 약속을 잘 지키는',
  금: '원칙이 분명하고 결단이 빠르며 말이 직설적인',
  수: '차분하고 생각이 깊으며 잘 들어주는',
};
type MeetType = 'boost' | 'calm' | 'clash';
export function dailyMeetPlan(sajuData: any): Record<MeetType, { oheng: string; glyphs: [string, string]; trait: string }> | null {
  const ma = sajuData?.myeongriAnalysis || {};
  const pick = (o: string | undefined) => {
    const g = ohengGlyphs(o);
    return g && o ? { oheng: o, glyphs: g, trait: OHENG_TRAIT[o] || '' } : null;
  };
  const boost = pick(ma.용신); const calm = pick(ma.희신); const clash = pick(ma.기신);
  return boost && calm && clash ? { boost, calm, clash } : null;
}
export function dailyMeetGlyphJson(sajuData: any, type: MeetType): string {
  const plan = dailyMeetPlan(sajuData);
  if (!plan) return type === 'boost' ? '["(용신 오행 천간 2자)"]' : type === 'calm' ? '["(희신 오행 천간 2자)"]' : '["(기신 오행 천간 2자)"]';
  return JSON.stringify(plan[type].glyphs);
}
export function dailyMeetPromptBlock(sajuData: any): string {
  const plan = dailyMeetPlan(sajuData);
  if (!plan) return '';
  const row = (t: MeetType, label: string) =>
    `- ${label}: ${plan[t].oheng} 오행 (${plan[t].glyphs.join('·')}) — 생활에서 알아볼 단서: '${plan[t].trait}' 사람`;
  return `### B-2. meetPeople 글자·오행 = 확정값 (서버 계산 · 바꾸지 말 것)
${row('boost', 'boost(끌어주는 사람) = 용신')}
${row('calm', 'calm(편안한 사람) = 희신')}
${row('clash', 'clash(부딪힐 수 있는 사람) = 기신')}
- desc 는 위 '생활 단서'로 시작 (분위기·말투·행동). '임수 기운을 가진 사람' 처럼 독자가 알아볼 수 없는 표현 금지.
`;
}
/** 결과의 meetPeople glyphs·ohengHint 를 확정값으로 덮어씀 (모델이 예시를 베껴도 안전) */
export function applyDailyMeetGlyphs<T>(result: T, sajuData: any): T {
  try {
    const plan = dailyMeetPlan(sajuData);
    const r: any = result;
    if (!plan || !r || !Array.isArray(r.meetPeople)) return result;
    r.meetPeople.forEach((m: any) => {
      const t = m?.type as MeetType;
      if (t && plan[t]) { m.glyphs = [...plan[t].glyphs]; m.ohengHint = plan[t].oheng; }
    });
    return result;
  } catch { return result; }
}

/* ── 오늘 일진 판정 (2026-10-04) — 오늘의 운세 3그룹(A1·A2·B) 공통 전제 ──
 *   병렬 그룹이 각자 '오늘이 좋은 날인지'를 따로 판단해 서로 엇갈리고, 辛亥일(亥=수)에 '용신 수가 약해진다'
 *   같은 사실 오류가 났다. 일진 천간·지지가 용신/희신/기신 중 무엇인지 서버가 정해 모든 그룹에 같은 문장으로 준다. */
const GAN_OH: Record<string, string> = { 甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수' };
const GEN: Record<string, string> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };   // A 가 생하는 것
const CTRL: Record<string, string> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };  // A 가 극하는 것
export function todayYongsinLine(todayGanzi: string, sajuData: any): string {
  try {
    const ma = sajuData?.myeongriAnalysis || {};
    const y = ma.용신; const h = ma.희신; const k = ma.기신;
    if (!y || !todayGanzi || todayGanzi.length < 2) return '';
    const g = GAN_OH[todayGanzi[0]]; const b = BR_OHENG[todayGanzi[1]];
    if (!g || !b) return '';
    const role = (o: string) => (o === y ? '용신' : o === h ? '희신' : o === k ? '기신' : '중립');
    const r1 = role(g); const r2 = role(b);
    const good = [r1, r2].filter((r) => r === '용신' || r === '희신').length;
    const bad = [r1, r2].filter((r) => r === '기신').length;
    const verdict = good === 2 ? '도움 기운이 강한 날' : good >= 1 && bad >= 1 ? '도움과 부담이 섞인 날'
      : good === 1 ? '도움 기운이 들어오는 날' : bad >= 1 ? '부담 기운이 강한 날 (무리하지 않는 날)' : '무난한 날';
    const ys = (g === y || b === y) ? `용신(${y}) 오행이 직접 들어와 힘을 받는 날`
      : (GEN[g] === y || GEN[b] === y) ? `용신(${y})을 살려주는 기운이 들어오는 날`
      : (CTRL[g] === y || CTRL[b] === y) ? `용신(${y})이 눌리는 날`
      : `용신(${y})에 큰 변화가 없는 날`;
    return `- 오늘 일진 판정 (서버 계산 · 모든 섹션 공통 전제 · 반대 서술 금지): ${todayGanzi} = 천간 ${todayGanzi[0]}(${g}·${r1}) + 지지 ${todayGanzi[1]}(${b}·${r2}) → ${verdict} · ${ys}`;
  } catch { return ''; }
}

/* ── 간지 1개의 용신 역할 판정 (오늘 일진·세운·월운 공용) ── */
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
export function ganziKo(gz: string): string {
  return gz && gz.length >= 2 ? `${GAN_KO[gz[0]] || ''}${ZHI_KO[gz[1]] || ''}` : '';
}
/** '丁未 = 丁(화·중립) + 未(토·기신) → 부담 기운이 강한 해' 형태 (sajuData.myeongriAnalysis 용신·희신·기신 기준) */
export function ganziRoleText(gz: string, sajuData: any, unit: '해' | '달' | '날' = '달'): string {
  try {
    const ma = sajuData?.myeongriAnalysis || {};
    const y = ma.용신; const h = ma.희신; const k = ma.기신;
    if (!gz || gz.length < 2) return '';
    const g = GAN_OH[gz[0]]; const b = BR_OHENG[gz[1]];
    if (!g || !b) return gz;
    if (!y) return `${gz}(${g}·${b})`;
    const role = (o: string) => (o === y ? '용신' : o === h ? '희신' : o === k ? '기신' : '중립');
    const r1 = role(g); const r2 = role(b);
    const good = [r1, r2].filter((r) => r === '용신' || r === '희신').length;
    const bad = [r1, r2].filter((r) => r === '기신').length;
    const verdict = good === 2 ? `도움 기운이 강한 ${unit}` : good >= 1 && bad >= 1 ? `도움과 부담이 섞인 ${unit}`
      : good === 1 ? `도움 기운이 들어오는 ${unit}` : bad >= 1 ? `부담 기운이 강한 ${unit}` : `무난한 ${unit}`;
    return `${gz} = ${gz[0]}(${g}·${r1}) + ${gz[1]}(${b}·${r2}) → ${verdict}`;
  } catch { return gz; }
}

/* ── 날짜 단위 판정 (신년운세 '좋은 날·조심할 날' · 2026-10-08) ── */
const CHUNG_PAIR: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];
/** 그 해 각 달의 좋은 날(최대 3)·조심할 날(최대 2) + 한 해 꼭 기억할 날(최대 6) — 일진 × 용신·희신·기신·천을귀인·일지충 */
export function dayPicksForYear(year: number, sajuData: any): {
  perMonth: Record<number, { good: string[]; caution: string[] }>;
  keyDates: Array<{ date: string; why: string }>;
} {
  const out: Record<number, { good: string[]; caution: string[] }> = {};
  const all: Array<{ m: number; label: string; score: number; why: string }> = [];
  try {
    const ma = sajuData?.myeongriAnalysis || {};
    const y = ma.용신; const h = ma.희신; const k = ma.기신;
    const dayGan = String(sajuData?.pillars?.[2]?.천간 || '');
    const dayJi = String(sajuData?.pillars?.[2]?.지지 || '');
    const cheoneul = CHEONEUL[dayGan] || [];
    const role = (o: string) => (o === y ? 2 : o === h ? 1 : o === k ? -2 : 0);
    const roleName = (o: string) => (o === y ? `용신(${o})` : o === h ? `희신(${o})` : '');
    for (let m = 1; m <= 12; m++) {
      const days: Array<{ label: string; score: number; why: string; chung: boolean }> = [];
      const last = new Date(year, m, 0).getDate();
      for (let d = 1; d <= last; d++) {
        const s = Solar.fromYmd(year, m, d);
        const gz = s.getLunar().getDayInGanZhi();
        const go = GAN_OH[gz[0]]; const bo = BR_OHENG[gz[1]];
        let score = role(go) + role(bo);
        const why: string[] = [];
        const helpers = Array.from(new Set([roleName(go), roleName(bo)].filter(Boolean)));
        if (helpers.length) why.push(`${helpers.join('·')} 기운이 들어오는 날`);
        if (cheoneul.includes(gz[1])) { score += 1; why.push('천을귀인 날'); }
        const chung = !!dayJi && CHUNG_PAIR[dayJi] === gz[1];
        if (chung) { score -= 2; why.push(`일지 ${dayJi}와 부딪히는 날`); }
        if (go === k || bo === k) why.push(`기신(${k}) 기운이 강한 날`);
        days.push({ label: `${m}/${d}(${WEEK_KO[s.getWeek()]})`, score, why: [`${gz}(${ganziKo(gz)})일`, ...why].join(' · '), chung });
      }
      const good = days.filter((x) => !x.chung && x.score >= 3).sort((a, b) => b.score - a.score).slice(0, 3);
      const goodFallback = good.length ? good : days.filter((x) => !x.chung && x.score >= 2).sort((a, b) => b.score - a.score).slice(0, 3);
      const caution = days.filter((x) => x.score <= -3 || (x.chung && x.score <= -1)).sort((a, b) => a.score - b.score).slice(0, 2);
      const byDate = (a: { label: string }, b: { label: string }) => Number(a.label.split('/')[1].split('(')[0]) - Number(b.label.split('/')[1].split('(')[0]);
      out[m] = { good: [...goodFallback].sort(byDate).map((x) => x.label), caution: [...caution].sort(byDate).map((x) => x.label) };
      goodFallback.forEach((x) => all.push({ m, label: x.label, score: x.score, why: x.why }));
    }
  } catch { /* noop */ }
  // 한 해 꼭 기억할 날 — 점수 최상위, 달마다 1개까지, 최대 6
  const keyDates: Array<{ date: string; why: string }> = [];
  const usedMonth = new Set<number>();
  for (const x of all.sort((a, b) => b.score - a.score)) {
    if (keyDates.length >= 6) break;
    if (x.score < 3 || usedMonth.has(x.m)) continue;
    usedMonth.add(x.m);
    keyDates.push({ date: x.label, why: x.why });
  }
  keyDates.sort((a, b) => {
    const [am, ad] = a.date.split('(')[0].split('/').map(Number); const [bm, bd] = b.date.split('(')[0].split('/').map(Number);
    return am - bm || ad - bd;
  });
  return { perMonth: out, keyDates };
}

/** 달 기준 점수 (월주 × 용신·희신·기신 · 일지충·천을귀인) — 병렬 그룹 간 점수 일관성 앵커 */
export function monthBaseScore(gz: string, sajuData: any): number {
  try {
    const ma = sajuData?.myeongriAnalysis || {};
    const y = ma.용신; const h = ma.희신; const k = ma.기신;
    const role = (o: string) => (o === y ? 2 : o === h ? 1 : o === k ? -2 : 0);
    const dayGan = String(sajuData?.pillars?.[2]?.천간 || '');
    const dayJi = String(sajuData?.pillars?.[2]?.지지 || '');
    const sum = role(GAN_OH[gz[0]]) + role(BR_OHENG[gz[1]]);
    const table: Record<number, number> = { 4: 88, 3: 84, 2: 78, 1: 72, 0: 66, '-1': 61, '-2': 56, '-3': 51, '-4': 47 } as any;
    let s = table[Math.max(-4, Math.min(4, sum))] ?? 66;
    if (dayJi && CHUNG_PAIR[dayJi] === gz[1]) s -= 4;
    if ((CHEONEUL[dayGan] || []).includes(gz[1])) s += 2;
    s = Math.max(30, Math.min(95, s));
    if (s % 5 === 0) s += 1;
    return s;
  } catch { return 66; }
}
