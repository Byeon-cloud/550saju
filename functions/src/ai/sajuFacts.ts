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
    const past = m0 > 1 ? `\n※ ${y0}년 1~${m0 - 1}월은 이미 지난 달 — 추천과 회피 시기로 쓰지 말 것 (과거 회고로만 언급 가능).` : '';
    return out.join(', ') + past;
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
    if (mh.length) parts.push(`해당 월: ${mh.join(', ')}`);
    return parts.join(' / ');
  };
  const lines: string[] = [];
  lines.push(`- 천을귀인(${CHEONEUL[dayGan].join(', ')}): ${where(CHEONEUL[dayGan])}`);
  lines.push(`- 문창귀인(${MUNCHANG[dayGan]}): ${where([MUNCHANG[dayGan]])}`);
  lines.push(`- 학당귀인(${HAKDANG[dayGan]}): ${where([HAKDANG[dayGan]])}`);
  lines.push(`- 태극귀인(${TAEGEUK[dayGan].join(', ')}): ${where(TAEGEUK[dayGan])}`);
  // 2026-10-13 도화, 역마, 화개는 일지 삼합 기준 하나로 — 앱 신살 카드(src/services/saju/sinsal.ts
  //   compute12Sinsal, 일지 기준)와 통일. 이전엔 년지 기준도 함께 넣어 화면 카드에 없는 도화를 AI 가 말했다.
  const dayBr = natal.find((n) => n.pos === '일지')?.br;
  const bases = dayBr ? [dayBr] : [];
  for (const base of bases) {
    const s = samhapOf(base);
    if (!s) continue;
    const label = '일지';
    lines.push(`- 도화(${label} ${base} 기준 → ${s.dohwa}): ${where([s.dohwa])}`);
    lines.push(`- 역마(${label} ${base} 기준 → ${s.yeokma}): ${where([s.yeokma])}`);
    lines.push(`- 화개(${label} ${base} 기준 → ${s.hwagae}): ${where([s.hwagae])}`);
  }
  return lines.join('\n');
}

/** 시진(時辰) 오행 — 한국 진태양시 보정 기준(경계 :30). 시간대 근거는 이 표로만 */
export const SIJIN_OHENG_LINE =
  '23:30~01:30 子(수), 01:30~03:30 丑(토), 03:30~05:30 寅(목), 05:30~07:30 卯(목), 07:30~09:30 辰(토), ' +
  '09:30~11:30 巳(화), 11:30~13:30 午(화), 13:30~15:30 未(토), 15:30~17:30 申(금), 17:30~19:30 酉(금), ' +
  '19:30~21:30 戌(토), 21:30~23:30 亥(수)';

/* ── 출력 정리 ── */
const SOURCE_RE = /(?:자평진전|적천수천미|적천수|궁통보감|연해자평|명리약언|삼명통회|명리정종|난강망)파?\s*(?:에서는|에서도|에서|에 따르면|에선|에는|은|는|의 표현으로|의|이)?\s*/g;
const HANJA_FIX: Array<[RegExp, string]> = [
  [/相官格/g, '傷官格'], [/相官/g, '傷官'], [/偐財/g, '偏財'], [/偏才/g, '偏財'], [/正才/g, '正財'],
  [/七煞/g, '七殺'], [/花蓋/g, '華蓋'],
];
/* 검증 불가 보장 문구 — 프롬프트로 금지해도 경량 모델이 가끔 쓰는 상투구 (10-07 운영 실측: 배포 후 오늘의 운세 2건) */
const GUARANTEE_FIX: Array<[RegExp, string]> = [
  [/성공 확률이 (?:크게 |훨씬 |더 |한층 )?(?:높아집니다|높아져요|올라갑니다|올라가요|높습니다|높아요)/g, '한결 수월하게 풀려요'],
  [/(?:앞으로 |향후 )?3개월간 좋은 결과를 만듭니다/g, '좋은 흐름으로 이어져요'],
  [/합격률이 (?:두|2) ?배(?:입니다|예요|이에요)?/g, '합격 가능성을 높여주는 경로예요'],
];
function fixTime(s: string): string {
  return s
    // '오후 14~17시' → '오후 2~5시' (2026-10-08 실측 잔존)
    .replace(/(오전|오후)\s?(1[3-9]|2[0-3])\s?~\s?(1[3-9]|2[0-4])시/g, (_m, _ap, a, b) => `오후 ${Number(a) - 12}~${Number(b) - 12}시`)
    .replace(/(오전|오후)\s?(1[3-9]|2[0-3])시/g, (_m, _ap, h) => `오후 ${Number(h) - 12}시`);
}
/* ── 가운뎃점(·) 제거 (2026-10-10 오너: "· 는 AI만 쓰는 문장 구조, 다 빼라") ──
 *   클라 utils/noDot.ts 와 같은 본문 (10-11 v3: 나열 사슬은 쉼표, 홀로 붙인 짝만 과/와) /
 *   한글 두 낱말 → '과/와' / 그 밖의 나열 → 쉼표 */
function josaGwa(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return '와';
  return code % 28 ? '과' : '와';
}
const PARTICLE_END = /[가-힣](은|는|을|를|에|에서|으로|에게|하고|하며|하는)$/;
/** 점 사이 말이 짧은 명사구(3낱말 이하, 조사로 끝나는 낱말 없음)면 같은 나열 사슬 */
function shortNounPhrase(span: string): boolean {
  const words = span.trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 3) return false;
  return !words.some((w) => (w.length >= 2 && PARTICLE_END.test(w)) || (w.length >= 3 && /의$/.test(w) && !/주의$/.test(w)));
}
function fixDotSeg(seg: string): string {
  const idx: number[] = [];
  for (let i = 0; i < seg.length; i++) if (seg[i] === '·') idx.push(i);
  if (!idx.length) return seg;
  const inChain = idx.map(() => false);
  for (let k = 0; k + 1 < idx.length; k++) {
    if (shortNounPhrase(seg.slice(idx[k] + 1, idx[k + 1]))) { inChain[k] = true; inChain[k + 1] = true; }
  }
  let out = '';
  let last = 0;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    let left = seg.slice(last, i);
    let rep = ', ';
    if (!inChain[k]) {
      const pm = left.match(/(?:^|[^가-힣])([가-힣]{1,6})$/);
      const nm = seg.slice(i + 1).match(/^[가-힣]{1,8}/);
      if (pm && nm) rep = josaGwa(pm[1]) + ' ';
    }
    if (rep === ', ') left = left.replace(/[ \t]+$/, '');
    out += left + rep;
    last = i + 1;
    if (rep === ', ') while (seg[last] === ' ' || seg[last] === '\t') last++;
  }
  return out + seg.slice(last);
}
export function stripMiddleDots(s: string): string {
  if (!s || s.indexOf('·') < 0) return s;
  let t = s.replace(/합격·이직/g, '합격 이직').replace(/이사·이동/g, '이사 이동');
  t = t.replace(/(^|\n)([ \t]*)·[ \t]+(?=\S)/g, '$1$2');
  t = t.replace(/([\u3400-\u9FFF\uF900-\uFAFF])\s*·\s*(?=[\u3400-\u9FFF\uF900-\uFAFF])/g, '$1 ');
  t = t.replace(/[ \t]+·[ \t]+/g, ', ');
  t = t.replace(/[^,.;:!?\n()[\]<>"'`{}|/=+*#—–]+/g, (seg) => (seg.indexOf('·') >= 0 ? fixDotSeg(seg) : seg));
  t = t.replace(/·/g, ', ');
  return t.replace(/, ,/g, ',');
}

/** 긴 줄표(—, ―) 제거 (2026-10-11 오너: AI 말투) — 줄머리 글머리표는 삭제, 끝에 매달린 것은 삭제, 그 밖은 쉼표 */
export function stripEmDashes(s: string): string {
  if (!s || (s.indexOf('—') < 0 && s.indexOf('―') < 0)) return s;
  let t = s.replace(/(^|\n)([ \t]*)[—―][ \t]+(?=\S)/g, '$1$2');
  t = t.replace(/[ \t]*[—―][ \t]*(?=\n|$)/g, '');
  t = t.replace(/[ \t]*[—―][ \t]*/g, ', ');
  return t.replace(/, ,/g, ',').replace(/,\s*\./g, '.');
}

/* 2026-10-11 — AI 티 나는 외래어, 과장어를 우리말로 (오너: "ai스러운 말투 없지??")
 *   에너지 → 기운 · 시너지 → 어울림 (모음 끝 → 받침 끝이라 조사를 함께 바꾼다)
 *   ~하는 타입 → ~하는 편 · 그 밖의 타입 → 유형 · 생활/소비/연애… 패턴 → 습관 · 그 밖의 패턴 → 경향 · 아이템 → 물건
 *   폭발합니다/폭발해요 → 크게 살아납니다/살아나요 · 폭발적으로 → 크게
 *   (받침 있는 말끼리 바꾸는 패턴, 타입, 아이템은 조사가 그대로 맞는다) — 서버 sajuFacts, 클라 noDot 같은 규칙 */
const VOWEL_TO_CONS_J: Record<string, string> = {
  '가': '이', '를': '을', '는': '은', '와': '과', '로': '으로', '야': '이야', '예요': '이에요', '라': '이라', '라서': '이라서',
  '라고': '이라고', '지만': '이지만', '여서': '이어서', '였': '이었', '며': '이며', '면': '이면', '나': '이나', '랑': '이랑', '든': '이든', '죠': '이죠', '다': '이다',
};
const J_ALT = '예요|라서|라고|지만|여서|가|를|는|와|로|야|라|였|며|면|나|랑|든|죠|다';
const ENERGY_RE = new RegExp(`에너지(${J_ALT})?(?![가-힣])|에너지(?=[가-힣])`, 'g');
const SYNERGY_RE = new RegExp(`시너지(${J_ALT})?(?![가-힣])|시너지(?=[가-힣])`, 'g');
export function plainTone(s: string): string {
  if (!s) return s;
  let t = s;
  if (t.indexOf('에너지') >= 0) {
    t = t.replace(/에너지원/g, '힘의 원천').replace(/에너지(가)? (있는|넘치)/g, (_m: string, g?: string, w?: string) => `활기${g ? '가' : ''} ${w}`);
    t = t.replace(ENERGY_RE, (_m: string, j?: string) => '기운' + (j ? (VOWEL_TO_CONS_J[j] ?? j) : ''));
  }
  if (t.indexOf('시너지') >= 0) t = t.replace(SYNERGY_RE, (_m: string, j?: string) => '어울림' + (j ? (VOWEL_TO_CONS_J[j] ?? j) : ''));
  if (t.indexOf('타입') >= 0) {
    t = t.replace(/(는|은|던|한|할|된|될|인|운|난|진) 타입/g, '$1 편');
    t = t.replace(/타입/g, '유형');
  }
  if (t.indexOf('패턴') >= 0) {
    t = t.replace(/(생활|수면|소비|지출|행동|연애|대화|식사|운동|업무|공부|학습) 패턴/g, '$1 습관');
    t = t.replace(/패턴/g, '경향');
  }
  if (t.indexOf('아이템') >= 0) t = t.replace(/아이템/g, '물건');
  if (t.indexOf('폭발') >= 0) {
    t = t.replace(/폭발합니다/g, '크게 살아납니다').replace(/폭발해요/g, '크게 살아나요').replace(/폭발한다/g, '크게 살아난다')
      .replace(/폭발하는/g, '크게 살아나는').replace(/폭발할/g, '크게 살아날').replace(/폭발했/g, '크게 살아났')
      .replace(/폭발하듯/g, '터지듯').replace(/폭발적으로/g, '크게').replace(/폭발적인/g, '큰').replace(/이 폭발(?![가-힣])/g, '이 크게 살아남')
      .replace(/([가-힣]) 폭발(?![가-힣])/g, (_m: string, c: string) => `${c}${(c.charCodeAt(0) - 0xAC00) % 28 ? '이' : '가'} 크게 살아남`);
  }
  return t;
}

export function sanitizeText(s: string): string {
  let t = plainTone(stripEmDashes(stripMiddleDots(s.replace(SOURCE_RE, ''))));
  for (const [re, to] of HANJA_FIX) t = t.replace(re, to);
  for (const [re, to] of GUARANTEE_FIX) t = t.replace(re, to);
  t = fixTime(t);
  // 2026-10-11 — '#오행보완' 같은 해시태그 키워드(SNS 티) → 낱말만
  if (t.length <= 24 && /^#+(?=[가-힣])/.test(t)) t = t.replace(/^#+/, '').trim();
  // 2026-10-11 — 서버 내부 앵커 '달 기준점수 91' 이 신년운세 본문에 샘 (화면 점수와도 다름) → 숫자째 지움
  t = t.replace(/\s?\(?(?:달\s?)?기준\s?점수\s?\d+\s?점?\)?(?:으로|로)?/g, '');
  // 2026-10-11 — 호칭 통일: '서윤 씨는' → '서윤 님은' (띄어 쓴 '씨'만, '날씨', '솜씨' 등 붙은 말은 그대로)
  t = t.replace(/([가-힣]{2,4}) 씨(는|가|의|에게|께서|도|를|와|과|,|\.|!|\?|\s|$)/g, (_m, nm: string, j: string) => {
    const jj = j === '는' ? '은' : j === '가' ? '이' : j === '를' ? '을' : j === '와' ? '과' : j;
    return `${nm} 님${jj}`;
  });
  return t;
}
/* 2026-10-11 — '서윤님은' → '서윤 님은' (호칭은 '이름 님').
 *   서버는 이름을 모르니 결과 전체에서 가장 자주 나온 'OO님' 하나만 이름으로 본다(2회 이상).
 *   부모님, 선생님, 고객님 같은 보통 말과 직함(…사, …장)은 건드리지 않는다. */
const NIM_RE = /(?<![가-힣])([가-힣]{2,4})님(?=[은이의을께과와도에게,.!?\s]|$)/g;
const NIM_STOP = /^(부모|선생|고객|사장|회장|대표|원장|교수|부장|과장|팀장|실장|차장|이사|국장|어머|아버|할머|할아버|시어머|시아버|장모|장인|아드|사모|사부|스승|하느|하나|부처|공주|왕자|도련|서방|선배|조상|형수|고모|이모|숙모|삼촌|작가|기사|감독|코치|당신|여러분|어르신|손님|따님)$/;
function topNameBeforeNim(strs: string[]): string | null {
  const cnt: Record<string, number> = {};
  for (const s of strs) {
    if (s.indexOf('님') < 0) continue;
    for (const m of s.matchAll(NIM_RE)) {
      const w = m[1];
      if (NIM_STOP.test(w) || /(사|장|생|객|독|치)$/.test(w)) continue;
      cnt[w] = (cnt[w] || 0) + 1;
    }
  }
  let best: string | null = null; let bc = 1;
  for (const [w, c] of Object.entries(cnt)) if (c > bc) { best = w; bc = c; }
  return best;
}
/** 2026-10-13 — 상대방 이름 호칭: 결과 안의 '도현의', '도현이' 처럼 님 없이 쓴 상대 이름을 '도현 님의', '도현 님이'로.
 *  이름을 아는 경우(주제분석 상대 정보)에만 쓰고, 이름 바로 뒤가 조사일 때만 바꾼다(다른 낱말 일부는 건드리지 않음).
 *  '님'은 받침이 있으니 가→이, 는→은, 를→을, 와→과, 야→이야 로 맞춘다. */
export function addNimToPartnerName<T>(obj: T, name?: string): T {
  const nm = String(name || '').trim();
  if (!/^[가-힣]{2,4}$/.test(nm)) return obj;
  const J: Record<string, string> = { 가: '이', 는: '은', 를: '을', 와: '과', 야: '이야', 의: '의', 이: '이', 은: '은', 을: '을', 과: '과', 에게: '에게', 도: '도', 께서: '께서', 한테: '한테', 과의: '과의', 와의: '과의' };
  const re = new RegExp(`(^|[^가-힣])${nm}(와의|과의|에게|께서|한테|가|는|를|와|야|의|이|은|을|과|도)(?=[^가-힣]|$)`, 'g');
  const fix = (t: string) => t.replace(re, (_m, pre: string, j: string) => `${pre}${nm} 님${J[j] ?? j}`);
  const walk = (v: any): any => typeof v === 'string' ? fix(v)
    : Array.isArray(v) ? v.map(walk) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;
  try { return walk(obj); } catch { return obj; }
}
/** 결과 JSON 의 모든 문자열 정리 (키는 그대로) */
export function sanitizeAiOutput<T>(obj: T): T {
  const strs: string[] = [];
  const collect = (v: any): void => {
    if (typeof v === 'string') strs.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  };
  let nm: string | null = null;
  try { collect(obj); nm = topNameBeforeNim(strs); } catch { nm = null; }
  const walk = (v: any): any => {
    if (typeof v === 'string') { const t = sanitizeText(v); return nm ? t.split(nm + '님').join(nm + ' 님') : t; }
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
    `- ${label}: ${plan[t].oheng} 오행 (${plan[t].glyphs.join(', ')}) — 생활에서 알아볼 단서: '${plan[t].trait}' 사람`;
  return `### B-2. meetPeople 글자와 오행 = 확정값 (서버 계산, 바꾸지 말 것)
${row('boost', 'boost(끌어주는 사람) = 용신')}
${row('calm', 'calm(편안한 사람) = 희신')}
${row('clash', 'clash(부딪힐 수 있는 사람) = 기신')}
- desc 는 위 '생활 단서'의 뜻을 살려 오늘 상황에 맞게 새로 쓴다 (단서 문장 그대로 복사 금지 — 같은 용신끼리 같은 문장이 나옴). '임수 기운을 가진 사람' 처럼 독자가 알아볼 수 없는 표현 금지.
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
    return `- 오늘 일진 판정 (서버 계산, 모든 섹션 공통 전제, 반대 서술 금지): ${todayGanzi} = 천간 ${todayGanzi[0]}(${g}, ${r1}) + 지지 ${todayGanzi[1]}(${b}, ${r2}) → ${verdict}, ${ys}`;
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
    if (!y) return `${gz}(${g}, ${b})`;
    const role = (o: string) => (o === y ? '용신' : o === h ? '희신' : o === k ? '기신' : '중립');
    const r1 = role(g); const r2 = role(b);
    const good = [r1, r2].filter((r) => r === '용신' || r === '희신').length;
    const bad = [r1, r2].filter((r) => r === '기신').length;
    const verdict = good === 2 ? `도움 기운이 강한 ${unit}` : good >= 1 && bad >= 1 ? `도움과 부담이 섞인 ${unit}`
      : good === 1 ? `도움 기운이 들어오는 ${unit}` : bad >= 1 ? `부담 기운이 강한 ${unit}` : `무난한 ${unit}`;
    return `${gz} = ${gz[0]}(${g}, ${r1}) + ${gz[1]}(${b}, ${r2}) → ${verdict}`;
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
        if (helpers.length) why.push(`${helpers.join(', ')} 기운이 들어오는 날`);
        if (cheoneul.includes(gz[1])) { score += 1; why.push('천을귀인 날'); }
        const chung = !!dayJi && CHUNG_PAIR[dayJi] === gz[1];
        if (chung) { score -= 2; why.push(`일지 ${dayJi}와 부딪히는 날`); }
        if (go === k || bo === k) why.push(`기신(${k}) 기운이 강한 날`);
        days.push({ label: `${m}/${d}(${WEEK_KO[s.getWeek()]})`, score, why: [`${gz}(${ganziKo(gz)})일`, ...why].join(', '), chung });
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
  // 2026-10-11 — 같은 일진(60일마다 돌아옴)만 여섯 번 뽑혀 이유가 전부 같았음 → 같은 일진은 두 번까지, 모자라면 채움
  //   같은 점수면 그 달 운(달 기준점수)이 좋은 달의 날을 먼저 — 풀이가 '최고의 달'로 꼽는 달이 빠지지 않게
  const monthBase: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    try { monthBase[m] = monthBaseScore(Solar.fromYmd(year, m, 15).getLunar().getMonthInGanZhi(), sajuData); } catch { monthBase[m] = 66; }
  }
  const sorted = all.sort((a, b) => b.score - a.score || (monthBase[b.m] || 0) - (monthBase[a.m] || 0));
  const gzCount: Record<string, number> = {};
  for (const pass of [2, 99]) {
    for (const x of sorted) {
      if (keyDates.length >= 6) break;
      if (x.score < 3 || usedMonth.has(x.m)) continue;
      const gzKey = x.why.slice(0, 2);
      if ((gzCount[gzKey] || 0) >= pass) continue;
      gzCount[gzKey] = (gzCount[gzKey] || 0) + 1;
      usedMonth.add(x.m);
      keyDates.push({ date: x.label, why: x.why });
    }
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

/* ── 오늘의 운세 공통 사실 (2026-10-08) — 병렬 그룹·모델 무관하게 같은 근거 ──
 *   A/B 시식: Haiku·Sonnet 모두 오행 생극을 가끔 거꾸로 씀('목이 금을 누른다' 등), 병렬 그룹끼리
 *   '오전에 결정' ↔ '오후 14~17시 회의는 반드시'처럼 시간대가 엇갈림 → 관계·시간대를 서버가 확정. */
const REL = (a: string, b: string): string => {
  if (!a || !b) return '';
  if (a === b) return `${a}, ${b} 같은 기운`;
  if (GEN[a] === b) return `${a}이(가) ${b}을(를) 생함(${a}생${b})`;
  if (GEN[b] === a) return `${b}이(가) ${a}을(를) 생함(${b}생${a})`;
  if (CTRL[a] === b) return `${a}이(가) ${b}을(를) 극함(${a}극${b})`;
  if (CTRL[b] === a) return `${b}이(가) ${a}을(를) 극함(${b}극${a})`;
  return '';
};
const JI_HAP6: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
export function todayRelationsText(todayGanzi: string, sajuData: any): string {
  try {
    if (!todayGanzi || todayGanzi.length < 2) return '';
    const dayGan = String(sajuData?.pillars?.[2]?.천간 || '');
    const dayJi = String(sajuData?.pillars?.[2]?.지지 || '');
    const me = GAN_OH[dayGan];
    const tg = GAN_OH[todayGanzi[0]]; const tb = BR_OHENG[todayGanzi[1]];
    const y = sajuData?.myeongriAnalysis?.용신;
    const female = (sajuData?.input?.gender || '') !== 'male';
    // 연인의 별: 여성=관성(일간을 극하는 오행), 남성=재성(일간이 극하는 오행)
    const partner = me ? (female ? Object.keys(CTRL).find((k) => CTRL[k] === me) : CTRL[me]) : undefined;
    const lines: string[] = [];
    if (me) lines.push(`- 오늘 기운 ↔ 일간 ${dayGan}(${me}): 천간 ${todayGanzi[0]}(${tg}) — ${REL(tg, me)} / 지지 ${todayGanzi[1]}(${tb}) — ${REL(tb, me)}`);
    if (y) lines.push(`- 오늘 기운 ↔ 용신(${y}): 천간 — ${REL(tg, y)} / 지지 — ${REL(tb, y)}`);
    if (partner) lines.push(`- 연인의 별(${female ? '여성: 관성' : '남성: 재성'} = ${partner}) ↔ 오늘 기운: 천간 — ${REL(tg, partner)} / 지지 — ${REL(tb, partner)}`);
    if (dayJi) {
      const r = CHUNG_PAIR[dayJi] === todayGanzi[1] ? `${dayJi}${todayGanzi[1]}충 (부딪힘)` : JI_HAP6[dayJi] === todayGanzi[1] ? `${dayJi}${todayGanzi[1]}합 (가까워짐)` : dayJi === todayGanzi[1] ? '같은 글자 (겹침)' : '합과 충 없음';
      lines.push(`- 일지 ${dayJi} ↔ 오늘 지지 ${todayGanzi[1]}: ${r}`);
    }
    return `### 오늘 오행 관계 확정표 (서버 계산, 생극 방향을 이 표와 반대로 쓰지 말 것)\n${lines.join('\n')}`;
  } catch { return ''; }
}

/* ── 원국과 만나는 글자의 십성, 합충 확정표 (2026-10-11) ──
 *   신년운세 시식: 세운 丁과 년간 癸를 '정임합에 준하는 간합'으로 지어냄(실제는 丁癸충), 庚申 대운에 '칠살'을 붙임(申 본기 庚 = 乙 일간의 정관).
 *   → 세운, 대운, 달 간지가 원국 여덟 글자와 맺는 합, 충, 형, 해와 십성을 서버가 정해 준다. 표에 없는 것은 쓰지 못하게. */
const YANG_GAN = new Set(['甲', '丙', '戊', '庚', '壬']);
const BR_MAIN: Record<string, string> = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
const GAN_HAP: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
const GAN_CHUNG: Record<string, string> = { 甲: '庚', 庚: '甲', 乙: '辛', 辛: '乙', 丙: '壬', 壬: '丙', 丁: '癸', 癸: '丁' };
const JI_HAE: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
const JI_HYUNG = new Set(['寅巳', '巳寅', '巳申', '申巳', '寅申', '申寅', '丑戌', '戌丑', '戌未', '未戌', '丑未', '未丑', '子卯', '卯子']);
const JA_HYUNG = new Set(['辰', '午', '酉', '亥']);
const SAMHAP_OH: Array<{ g: string[]; oh: string }> = [
  { g: ['申', '子', '辰'], oh: '수' }, { g: ['亥', '卯', '未'], oh: '목' }, { g: ['寅', '午', '戌'], oh: '화' }, { g: ['巳', '酉', '丑'], oh: '금' },
];
/** 일간 기준 십성 (편관은 '편관(칠살)') */
export function tenGod(dayGan: string, other: string): string {
  const d = GAN_OH[dayGan]; const o = GAN_OH[other];
  if (!d || !o) return '';
  const same = YANG_GAN.has(dayGan) === YANG_GAN.has(other);
  if (d === o) return same ? '비견' : '겁재';
  if (GEN[d] === o) return same ? '식신' : '상관';
  if (CTRL[d] === o) return same ? '편재' : '정재';
  if (CTRL[o] === d) return same ? '편관(칠살)' : '정관';
  if (GEN[o] === d) return same ? '편인' : '정인';
  return '';
}
const POS_NAME = ['년', '월', '일', '시'];
/** 한자 한 글자 읽기의 받침으로 와/과 */
const wa = (h: string): string => { const r = GAN_KO[h] || ZHI_KO[h] || ''; const c = r.charCodeAt(r.length - 1); return c >= 0xAC00 && (c - 0xAC00) % 28 ? '과' : '와'; };
/** 간지 하나가 원국 여덟 글자와 맺는 관계 */
export function natalRelations(gz: string, sajuData: any): { gan: string; ji: string; links: string[] } {
  const out = { gan: '', ji: '', links: [] as string[] };
  try {
    if (!gz || gz.length < 2) return out;
    const p: any[] = sajuData?.pillars || [];
    const dayGan = String(p[2]?.천간 || '');
    const g = gz[0]; const b = gz[1];
    out.gan = `${g}(${GAN_KO[g] || ''}) ${tenGod(dayGan, g) || '?'}`;
    out.ji = `${b}(${ZHI_KO[b] || ''}) ${tenGod(dayGan, BR_MAIN[b]) || '?'}`;
    p.forEach((x: any, i: number) => {
      if (!x || x.available === false) return;
      const ng = String(x.천간 || ''); const nb = String(x.지지 || '');
      const gpos = i === 2 ? '일간' : `${POS_NAME[i]}간`;
      if (ng && GAN_HAP[g] === ng) out.links.push(`${g}${ng}합(${gpos} ${ng}${wa(ng)} 묶임)`);
      if (ng && GAN_CHUNG[g] === ng) out.links.push(`${g}${ng}충(${gpos} ${ng}${wa(ng)} 부딪힘)`);
      if (!nb) return;
      const jpos = `${POS_NAME[i]}지`;
      if (nb === b) {
        out.links.push(`${b}${b} 겹침(${jpos}${JA_HYUNG.has(b) ? ', 자형' : ''})`);
        return;
      }
      if (CHUNG_PAIR[nb] === b) out.links.push(`${nb}${b}충(${jpos}와 부딪힘)`);
      if (JI_HAP6[nb] === b) out.links.push(`${nb}${b}합(${jpos}와 묶임)`);
      const sh = SAMHAP_OH.find((s) => s.g.includes(nb) && s.g.includes(b) && (s.g[1] === nb || s.g[1] === b));
      if (sh) out.links.push(`${nb}${b} 반합(${jpos}와 ${sh.oh} 기운으로 묶임)`);
      if (JI_HYUNG.has(nb + b)) out.links.push(`${nb}${b}형(${jpos}와 형)`);
      if (JI_HAE[nb] === b) out.links.push(`${nb}${b}해(${jpos}와 해)`);
    });
  } catch { /* noop */ }
  return out;
}
export function natalRelationsText(gz: string, sajuData: any, label: string): string {
  const r = natalRelations(gz, sajuData);
  if (!r.gan) return '';
  return `- ${label} ${gz}(${ganziKo(gz)}): 천간 ${r.gan}, 지지 ${r.ji}(지장간 본기 기준). 원국과 ${r.links.length ? r.links.join(', ') : '합과 충 없음'}`;
}

/** 오늘의 좋은 시간대·조심할 시간대 (한국 진태양시 :30 경계 시진 × 용신·희신·기신·일지충) */
export function todayHourWindows(date: string, sajuData: any): { peak: string; avoid: string; text: string } {
  try {
    const [y, m, d] = date.split('-').map(Number);
    const ma = sajuData?.myeongriAnalysis || {};
    const yy = ma.용신; const h = ma.희신; const k = ma.기신;
    if (!yy || !y) return { peak: '', avoid: '', text: '' };
    const dayJi = String(sajuData?.pillars?.[2]?.지지 || '');
    const role = (o: string) => (o === yy ? 2 : o === h ? 1 : o === k ? -2 : 0);
    // 낮 시간대 시진 (07:30~23:30) — 각 시진 가운데 시각으로 시주 산출
    const SLOTS: Array<{ start: string; end: string; mid: number }> = [
      { start: '07:30', end: '09:30', mid: 8 }, { start: '09:30', end: '11:30', mid: 10 }, { start: '11:30', end: '13:30', mid: 12 },
      { start: '13:30', end: '15:30', mid: 14 }, { start: '15:30', end: '17:30', mid: 16 }, { start: '17:30', end: '19:30', mid: 18 },
      { start: '19:30', end: '21:30', mid: 20 }, { start: '21:30', end: '23:30', mid: 22 },
    ];
    const scored = SLOTS.map((s) => {
      const gz = Solar.fromYmdHms(y, m, d, s.mid, 0, 0).getLunar().getTimeInGanZhi();
      let sc = role(GAN_OH[gz[0]]) + role(BR_OHENG[gz[1]]);
      if (dayJi && CHUNG_PAIR[dayJi] === gz[1]) sc -= 2;
      return { ...s, gz, sc };
    });
    // 최고 구간: 인접 2시진 합이 최대인 곳 (같으면 이른 시간)
    let best = 0, bestI = 0;
    for (let i = 0; i < scored.length - 1; i++) { const v = scored[i].sc + scored[i + 1].sc; if (i === 0 || v > best) { best = v; bestI = i; } }
    const pk = [scored[bestI], scored[bestI + 1]];
    const worst = [...scored].sort((a, b) => a.sc - b.sc)[0];
    const peak = `${pk[0].start}~${pk[1].end}`;
    const avoid = `${worst.start}~${worst.end}`;
    const text = `### 오늘 시간대 확정 (서버 계산, 모든 섹션 공통 — timeSlots, hourlyPeak, hourlyAvoid, doList, 본문이 이 값과 엇갈리면 안 됨)
- 가장 좋은 시간: ${peak} (${pk.map((x) => `${x.gz[1]}시 ${x.gz}`).join(', ')})
- 조심할 시간: ${avoid} (${worst.gz[1]}시 ${worst.gz})
- 시진별 점수: ${scored.map((x) => `${x.start} ${x.gz}:${x.sc}`).join(', ')}`;
    return { peak, avoid, text };
  } catch { return { peak: '', avoid: '', text: '' }; }
}

/* ── 재회운 타이밍·판정 확정표 (2026-10-08) ──
 *   재회운 출력은 ~14.8K자(다른 주제의 2배) · 실측 중앙 222초 → 본문(sections 등)과 카드 데이터(topicData)를
 *   두 호출로 나눠 병렬 생성한다. 두 호출이 시기·판정을 따로 고르면 '본문 적기 3월 ↔ 카드 적기 5월' 모순이 나므로
 *   월별 수치·적기·판정을 서버가 결정론으로 정해 양쪽에 같은 표로 준다 (같은 사주 = 같은 시기).
 *   근거: 월건 ↔ 용신·희신·기신(monthBaseScore) · 연인의 별(여성 관성/남성 재성)이 들어오는 달 ·
 *   월지 ↔ 상대 일지 합·충·원진 · 월지 ↔ 내 일지 합. 상대 에너지 = 월건이 상대 일간을 생·극하는 관계. */
const WONJIN_PAIR: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '酉', 酉: '寅', 卯: '申', 申: '卯', 辰: '亥', 亥: '辰', 巳: '戌', 戌: '巳' };
export const REUNION_PHASES = [
  { name: '충격기', period: '0~2개월', desc: '이별 직후 감정 혼란기. 현실 부정과 슬픔이 교차하는 시기' },
  { name: '거부기', period: '2~6개월', desc: '이별을 거부하며 연락 충동이 강한 시기. 분노와 그리움 반복' },
  { name: '회복기', period: '6~12개월', desc: '감정 정리가 시작되며 일상 회복이 진행되는 시기' },
  { name: '수용기', period: '12~18개월', desc: '이별을 받아들이고 객관적 시야가 생기는 시기. 재회 판단 가능' },
  { name: '장기 분리기', period: '18개월~', desc: '감정 완전 정리 후 새 관계 or 성숙한 재회가 가능한 시기' },
];
export interface ReunionPlan {
  text: string;
  monthly: Array<{ label: string; my: number; partner: number | null; chance: number }>;
  bestTiming: string;
  bestContactMonth: string;
  cautionMonths: string;
  verdict: '재회 추천' | '상황에 따라' | '새 인연 추천';
  contactAdvice: '지금 연락하기' | '기다리기' | '새출발';
  emotionCycle: '상승기' | '하강기' | '정체기';
  phaseIndex: number | null;
}
export function reunionPlan(args: {
  sajuData: any; partnerDay?: string | null; now: Date; score?: number; breakupYear?: number; breakupMonth?: number;
}): ReunionPlan | null {
  try {
    const { sajuData, partnerDay, now } = args;
    const dayGan = String(sajuData?.pillars?.[2]?.천간 || '');
    const dayJi = String(sajuData?.pillars?.[2]?.지지 || '');
    const me = GAN_OH[dayGan];
    if (!me) return null;
    const female = (sajuData?.input?.gender || '') !== 'male';
    const star = female ? Object.keys(CTRL).find((k) => CTRL[k] === me) : CTRL[me]; // 연인의 별 오행
    const starName = female ? '관성' : '재성';
    const ma = sajuData?.myeongriAnalysis || {};
    const pGan = partnerDay ? partnerDay.charAt(0) : '';
    const pJi = partnerDay ? partnerDay.charAt(1) : '';
    const pOh = GAN_OH[pGan];
    const relTo = (x: string, base: string) =>
      x === base ? 3 : GEN[x] === base ? 6 : GEN[base] === x ? 1 : CTRL[base] === x ? -1 : CTRL[x] === base ? -5 : 0;
    const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));
    const notFive = (n: number) => (n % 5 === 0 ? n + 1 : n);
    const y0 = now.getFullYear();
    const m0 = now.getMonth() + 1;
    const rel = (y: number, m: number) => (y === y0 ? `올해 ${m}월` : y === y0 + 1 ? `내년 ${m}월` : `${y}년 ${m}월`);
    const rows: Array<{ y: number; m: number; gz: string; my: number; partner: number | null; chance: number; why: string[] }> = [];
    for (let i = 0; i < 12; i++) {
      const y = y0 + Math.floor((m0 - 1 + i) / 12);
      const m = ((m0 - 1 + i) % 12) + 1;
      const gz = Solar.fromYmd(y, m, 15).getLunar().getEightChar().getMonth();
      const go = GAN_OH[gz[0]]; const bo = BR_OHENG[gz[1]]; const b = gz[1];
      const why: string[] = [];
      const my = monthBaseScore(gz, sajuData);
      if (ma.용신 && (go === ma.용신 || bo === ma.용신)) why.push('용신 달');
      else if (ma.기신 && (go === ma.기신 || bo === ma.기신)) why.push('기신 달');
      let bonus = 0;
      if (star && (go === star || bo === star)) { bonus += (go === star ? 4 : 0) + (bo === star ? 3 : 0); why.push(`연인의 별(${starName}, ${star}) 들어옴`); }
      if (pJi) {
        if (JI_HAP6[pJi] === b) { bonus += 5; why.push(`상대 일지 ${pJi}와 ${b} 합`); }
        else if (CHUNG_PAIR[pJi] === b) { bonus -= 6; why.push(`상대 일지 ${pJi}와 ${b} 충`); }
        else if (WONJIN_PAIR[pJi] === b) { bonus -= 3; why.push(`상대 일지 ${pJi}와 ${b} 원진`); }
      }
      if (dayJi && JI_HAP6[dayJi] === b) { bonus += 3; why.push(`내 일지 ${dayJi}와 ${b} 합`); }
      else if (dayJi && CHUNG_PAIR[dayJi] === b) why.push(`내 일지 ${dayJi}와 ${b} 충`);
      const partner = pOh
        ? notFive(clampN(66 + relTo(go, pOh) + relTo(bo, pOh) + (pJi && JI_HAP6[pJi] === b ? 4 : 0) - (pJi && CHUNG_PAIR[pJi] === b ? 5 : 0), 30, 95))
        : null;
      const chance = notFive(clampN(my * 0.7 + (partner ?? my) * 0.3 + bonus, 25, 95));
      rows.push({ y, m, gz, my, partner, chance, why });
    }
    let bi = 0;
    for (let i = 1; i < 11; i++) if (rows[i].chance + rows[i + 1].chance > rows[bi].chance + rows[bi + 1].chance) bi = i;
    const a = rows[bi]; const z = rows[bi + 1];
    const bestTiming = a.y === z.y
      ? (a.y === y0 ? `올해 ${a.m}~${z.m}월` : a.y === y0 + 1 ? `내년 ${a.m}~${z.m}월` : `${a.y}년 ${a.m}~${z.m}월`)
      : `${rel(a.y, a.m)}~${rel(z.y, z.m).replace(/^올해 /, '')}`;
    let ci = 0;
    rows.forEach((r, i) => { if (r.chance > rows[ci].chance) ci = i; });
    const bestContactMonth = rel(rows[ci].y, rows[ci].m);
    const low = rows.map((r, i) => ({ r, i })).sort((p, q) => p.r.chance - q.r.chance || p.i - q.i).slice(0, 2).sort((p, q) => p.i - q.i);
    const cautionMonths = low.map(({ r }) => rel(r.y, r.m)).join(', ');
    const score = typeof args.score === 'number' && Number.isFinite(args.score)
      ? args.score
      : Math.round(rows.reduce((s, r) => s + r.chance, 0) / rows.length);
    /* 판정 = 재회 점수 + 두 사람 사이 + 최고 달 세기. 점수만으론 못 가른다 (10-09 실측 재회 74건: 39건이 정확히 63점 ·
     *   모델 단독 판정은 93%가 '재회 추천' — 듣기 좋은 답으로 쏠림). 두 사람 일간 천간합·일지 합/충/원진은 사람마다 다르다. */
    const GANHAP: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
    const peak = Math.max(...rows.map((r) => r.chance));
    const parts: string[] = [`재회 점수 ${score}`];
    let vs = score;
    if (pGan && GANHAP[dayGan] === pGan) { vs += 5; parts.push(`일간 ${dayGan}${pGan} 천간합 +5`); }
    if (pJi && dayJi) {
      if (JI_HAP6[dayJi] === pJi) { vs += 5; parts.push(`일지 ${dayJi}${pJi} 합 +5`); }
      else if (CHUNG_PAIR[dayJi] === pJi) { vs -= 7; parts.push(`일지 ${dayJi}${pJi} 충 −7`); }
      else if (WONJIN_PAIR[dayJi] === pJi) { vs -= 4; parts.push(`일지 ${dayJi}${pJi} 원진 −4`); }
    }
    if (peak >= 85) { vs += 3; parts.push(`최고 달 ${peak} +3`); } else if (peak <= 65) { vs -= 3; parts.push(`최고 달 ${peak} −3`); }
    const verdict: ReunionPlan['verdict'] = vs >= 68 ? '재회 추천' : vs <= 62 ? '새 인연 추천' : '상황에 따라'; // 임계값: 300쌍 모의 분포 ≈ 30% · 49% · 21%
    const verdictWhy = `${parts.join(', ')} → ${vs}`;
    const contactAdvice: ReunionPlan['contactAdvice'] = verdict === '새 인연 추천' ? '새출발' : bi === 0 ? '지금 연락하기' : '기다리기';
    const trend = (rows[1].chance + rows[2].chance + rows[3].chance) / 3 - rows[0].chance;
    const emotionCycle: ReunionPlan['emotionCycle'] = trend > 4 ? '상승기' : trend < -4 ? '하강기' : '정체기';
    let phaseIndex: number | null = null;
    if (args.breakupYear && args.breakupMonth) {
      const gap = Math.max(0, (y0 - args.breakupYear) * 12 + (m0 - args.breakupMonth));
      phaseIndex = gap < 2 ? 0 : gap < 6 ? 1 : gap < 12 ? 2 : gap < 18 ? 3 : 4;
    }
    const lines = rows.map((r) =>
      `  ${r.y}년 ${r.m}월 ${r.gz}(${ganziKo(r.gz)}) — 나 ${r.my}${r.partner != null ? ` / 상대 ${r.partner}` : ''} / 재회 기운 ${r.chance}` +
      (r.why.length ? ` ${r.why.join(', ')}` : ''));
    const text = `
## 🔒 재회 타이밍과 판정 확정표 (서버 계산 — 본문과 데이터 모두 이 표와 다르게 쓰지 말 것)
- 판정: ${verdict} (근거: ${verdictWhy}, 68 이상 재회 추천 / 62 이하 새 인연 추천), 지금 할 일: ${contactAdvice}${contactAdvice === '기다리기' ? ` (${rel(a.y, a.m)}부터 움직인다 — 그 전엔 먼저 연락하지 않는다)` : ''}, 감정 흐름: ${emotionCycle}
- 재회 적기: ${bestTiming}, 첫 연락 최적 달: ${bestContactMonth}, 조심할 달: ${cautionMonths}${phaseIndex != null ? `\n- 이별 후 현재 단계: ${REUNION_PHASES[phaseIndex].name} (${REUNION_PHASES[phaseIndex].period})` : ''}
- 월별 (이번 달부터 12개월, 나의 에너지${pOh ? ' / 상대 에너지' : ''} / 재회 기운, 근거):
${lines.join('\n')}
→ '재회 가능성과 적기', '월별 재회 에너지 흐름', '재회 실전 전략', '재회 후 관계 변화 예측' 과 timeline 은 위 시기와 수치를 그대로 인용한다. 표에 없는 달을 적기로 만들지 말 것.
→ '새 인연 vs 재회 — 냉정한 비교' 의 최종 판정 = 위 판정. 근거 칸의 글자(합, 충, 원진, 연인의 별)를 본문에서 직접 짚어라.${verdict === '상황에 따라' ? `
→ '상황에 따라' 를 애매하게 쓰지 말 것 — 갈림길을 못 박는다: '${bestTiming}에 상대가 먼저 반응하면 재회, 그때도 조용하면 정리하세요' 처럼 기준과 시한을 단정.` : ''}${pOh ? '' : '\n→ 상대 생년월일이 없다 — 상대 에너지와 궁합 수치는 만들지 말 것.'}
`;
    return {
      text,
      monthly: rows.map((r) => ({ label: `${r.m}월`, my: r.my, partner: r.partner, chance: r.chance })),
      bestTiming, bestContactMonth, cautionMonths, verdict, contactAdvice, emotionCycle, phaseIndex,
    };
  } catch {
    return null;
  }
}

/** 재회운 topicData — 서버 확정값 채우기 (모델이 베끼던 고정 문구·간지·월별 수치 + 판정) */
export function fillReunionTopicData(td: any, plan: ReunionPlan | null, mine: Array<{ 천간?: string; 지지?: string }> | null, partner: { year: string; month: string; day: string } | null): any {
  const out: any = td && typeof td === 'object' ? td : {};
  if (plan) {
    out.monthlyEnergy = plan.monthly.map((x) => ({ month: x.label, myEnergy: x.my, partnerEnergy: x.partner, reunionChance: x.chance }));
    out.bestTiming = plan.bestTiming;
    out.bestContactMonth = plan.bestContactMonth;
    out.verdict = plan.verdict;
    out.contactAdvice = plan.contactAdvice;
    out.emotionCycle = plan.emotionCycle;
  }
  if (out.breakupDuration || plan?.phaseIndex != null) {
    const bd = out.breakupDuration && typeof out.breakupDuration === 'object' ? out.breakupDuration : {};
    const states: any[] = Array.isArray(bd.phases) ? bd.phases : [];
    bd.phases = REUNION_PHASES.map((p, i) => ({ ...p, myState: states[i]?.myState || '', partnerState: states[i]?.partnerState || '' }));
    if (plan?.phaseIndex != null) bd.currentPhaseIndex = plan.phaseIndex;
    const idx = Number(bd.currentPhaseIndex);
    if (Number.isInteger(idx) && idx >= 0 && idx < REUNION_PHASES.length) { bd.currentPhaseIndex = idx; bd.healingStage = REUNION_PHASES[idx].name; }
    out.breakupDuration = bd;
  }
  if (partner && mine && out.partnerProfile && typeof out.partnerProfile === 'object') {
    const pc = out.partnerProfile.pillarComparison && typeof out.partnerProfile.pillarComparison === 'object' ? out.partnerProfile.pillarComparison : {};
    const cell = (gan?: string, ji?: string) => (gan && ji ? { cheongan: gan, jiji: ji, oheng: GAN_OH[gan] || '' } : undefined);
    pc.myPillars = { year: cell(mine[0]?.천간, mine[0]?.지지), month: cell(mine[1]?.천간, mine[1]?.지지), day: cell(mine[2]?.천간, mine[2]?.지지) };
    pc.partnerPillars = { year: cell(partner.year[0], partner.year[1]), month: cell(partner.month[0], partner.month[1]), day: cell(partner.day[0], partner.day[1]) };
    if (!Array.isArray(pc.interactions)) pc.interactions = [];
    out.partnerProfile.pillarComparison = pc;
  }
  return out;
}
