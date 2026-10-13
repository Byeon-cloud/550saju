/**
 * 가운뎃점(·) 제거 (2026-10-11, 오너: "· 는 AI만 쓰는 문장 구조, 다 빼라")
 *   서버 functions/src/ai/sajuFacts.ts stripMiddleDots 와 같은 규칙.
 *   새 풀이는 서버에서 이미 빠져 오고, 이 함수는 예전에 저장된 풀이를 '보여 줄 때만' 정리한다
 *   (보관함 원본은 건드리지 않는다).
 *   규칙: 상품명(합격·이직, 이사·이동 → 띄어쓰기) / 줄머리 글머리표 삭제 / 한자·한자 → 띄어쓰기 /
 *         한글 두 낱말 → '과/와' / 그 밖의 나열 → 쉼표
 */
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
      .replace(/감정 폭발로/g, '감정이 터져').replace(/감정 폭발/g, '감정 터짐').replace(/폭발하듯/g, '터지듯').replace(/폭발적으로/g, '크게').replace(/폭발적인/g, '큰').replace(/이 폭발(?![가-힣])/g, '이 크게 살아남')
      .replace(/([가-힣]) 폭발(?![가-힣])/g, (_m: string, c: string) => `${c}${(c.charCodeAt(0) - 0xAC00) % 28 ? '이' : '가'} 크게 살아남`);
  }
  return t;
}

/* 이름을 모르는 기록(복원본 등)은 풀이 안에서 가장 자주 나온 'OO님'(2회 이상)을 이름으로 본다.
 *   부모님, 선생님, 고객님 같은 보통 말과 직함(…사, …장)은 제외 (서버 sajuFacts 와 같은 규칙) */
// 구형 iOS WebView 는 lookbehind 정규식에서 모듈 전체가 깨지므로 앞 글자를 잡는 방식으로
const NIM_RE = /(^|[^가-힣])([가-힣]{2,4})님(?=[은이의을께과와도에게,.!?\s]|$)/g;
const NIM_STOP = /^(부모|선생|고객|사장|회장|대표|원장|교수|부장|과장|팀장|실장|차장|이사|국장|어머|아버|할머|할아버|시어머|시아버|장모|장인|아드|사모|사부|스승|하느|하나|부처|공주|왕자|도련|서방|선배|조상|형수|고모|이모|숙모|삼촌|작가|기사|감독|코치|당신|여러분|어르신|손님|따님)$/;
function guessNameBeforeNim(v: unknown): string | null {
  const cnt: Record<string, number> = {};
  const visit = (x: unknown): void => {
    if (typeof x === 'string') {
      if (x.indexOf('님') < 0) return;
      for (const m of x.matchAll(NIM_RE)) {
        const w = m[2];
        if (NIM_STOP.test(w) || /(사|장|생|객|독|치)$/.test(w)) continue;
        cnt[w] = (cnt[w] || 0) + 1;
      }
    } else if (Array.isArray(x)) x.forEach(visit);
    else if (x && typeof x === 'object') Object.values(x as Record<string, unknown>).forEach(visit);
  };
  try { visit(v); } catch { return null; }
  let best: string | null = null; let bc = 1;
  for (const [w, c] of Object.entries(cnt)) if (c > bc) { best = w; bc = c; }
  return best;
}

/** 객체 안의 모든 문자열 값에 적용한 '새 사본'을 돌려준다 (키는 그대로, 원본 불변)
 *  name 을 주면 예전 풀이의 '당신'을 '이름 님'으로 (당신, 님 모두 받침으로 끝나 조사가 그대로 맞는다) */
export function stripDotsDeep<T>(v: T, name?: string): T {
  const nm = name && name.length <= 10 && !/복원|×|분석/.test(name) ? name : '';
  const guessed = nm ? null : guessNameBeforeNim(v);
  const nmKeys = nm && /^[가-힣]{2,4}$/.test(nm) ? (nm.length === 3 ? [nm, nm.slice(1)] : [nm]) : guessed ? [guessed] : [];
  const fix = (s: string): string => {
    let t = plainTone(stripEmDashes(stripMiddleDots(s)));
    if (t.length <= 24 && /^#+(?=[가-힣])/.test(t)) t = t.replace(/^#+/, '').trim();
    if (nm && t.indexOf('당신') >= 0) t = t.replace(/당신/g, `${nm} 님`);
    // 호칭은 '이름 님' (예전 풀이의 '서윤님은' → '서윤 님은'). 성까지 쓴 이름이면 이름만 쓴 경우도 함께
    if (nmKeys.length && t.indexOf('님') >= 0) for (const n of nmKeys) t = t.split(`${n}님`).join(`${n} 님`);
    return t;
  };
  const walk = (x: unknown): unknown => {
    if (typeof x === 'string') return fix(x);
    if (Array.isArray(x)) {
      let changed = false;
      const out = x.map((y) => { const z = walk(y); if (z !== y) changed = true; return z; });
      return changed ? out : x;
    }
    if (x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
      let changed = false;
      const out: Record<string, unknown> = {};
      for (const [k, y] of Object.entries(x as Record<string, unknown>)) {
        const z = walk(y);
        if (z !== y) changed = true;
        out[k] = z;
      }
      return changed ? out : x;
    }
    return x;
  };
  return walk(v) as T;
}
