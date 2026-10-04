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
  [/七煞/g, '七殺'],
];
function fixTime(s: string): string {
  return s.replace(/(오전|오후)\s?(1[3-9]|2[0-3])시/g, (_m, _ap, h) => `오후 ${Number(h) - 12}시`);
}
export function sanitizeText(s: string): string {
  let t = s.replace(SOURCE_RE, '');
  for (const [re, to] of HANJA_FIX) t = t.replace(re, to);
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
