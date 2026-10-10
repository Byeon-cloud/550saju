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

export function stripMiddleDots(s: string): string {
  if (!s || s.indexOf('·') < 0) return s;
  let t = s;
  t = t.replace(/합격·이직/g, '합격 이직').replace(/이사·이동/g, '이사 이동');
  t = t.replace(/(^|\n)([ \t]*)·[ \t]+(?=\S)/g, '$1$2');
  t = t.replace(/([㐀-鿿豈-﫿])\s*·\s*(?=[㐀-鿿豈-﫿])/g, '$1 ');
  t = t.replace(/(?<![가-힣·])([가-힣]{1,6})·([가-힣]{1,8})(?![가-힣]*·)/g, (_m, a: string, b: string) => `${a}${josaGwa(a)} ${b}`);
  t = t.replace(/[ \t]*·[ \t]*/g, ', ');
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
