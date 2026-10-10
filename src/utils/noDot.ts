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

/** 객체 안의 모든 문자열 값에 적용한 '새 사본'을 돌려준다 (키는 그대로, 원본 불변) */
export function stripDotsDeep<T>(v: T): T {
  if (typeof v === 'string') return stripMiddleDots(v) as unknown as T;
  if (Array.isArray(v)) {
    let changed = false;
    const out = v.map((x) => { const y = stripDotsDeep(x); if (y !== x) changed = true; return y; });
    return (changed ? out : v) as unknown as T;
  }
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const y = stripDotsDeep(x);
      if (y !== x) changed = true;
      out[k] = y;
    }
    return (changed ? out : v) as T;
  }
  return v;
}
