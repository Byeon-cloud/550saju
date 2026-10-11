/**
 * 구형 iOS(16.3 이하) WebView 는 lookbehind 정규식((?<!…), (?<=…))을 만드는 순간 SyntaxError 를 던진다.
 * 빌드(esbuild)가 이런 정규식을 new RegExp(...) 로 바꿔 두기 때문에 페이지는 열리지만,
 * 강조 처리 함수가 도는 순간 결과 화면이 통째로 오류가 된다 (오늘의 운세, 꿈해몽, 주제 풀이).
 * 그래서 '바로 앞 글자' 확인은 정규식 대신 여기서 한다. 새 코드에서도 lookbehind 는 쓰지 않는다.
 */

/** re 에 맞는 곳을 <u> 로 감싼다. 바로 앞이 '<u>' 면 그대로 두고, noDigitBefore 면 앞이 숫자일 때도 그대로 둔다. */
export function underlineMatches(
  text: string,
  re: RegExp,
  noDigitBefore = false,
  render?: (m: string, groups: string[]) => string,
): string {
  return text.replace(re, (m: string, ...rest: unknown[]) => {
    const off = rest[rest.length - 2] as number;
    const all = rest[rest.length - 1] as string;
    if (all.slice(Math.max(0, off - 3), off) === '<u>') return m;
    if (noDigitBefore && off > 0 && /\d/.test(all.charAt(off - 1))) return m;
    return render ? render(m, rest.slice(0, -2) as string[]) : `<u>${m}</u>`;
  });
}

/** 문장 끝(ends 의 첫 묶음) 뒤 공백에서 자른다. 예: splitAfter(t, /([다요네][.!?])\s+/g) */
export function splitAfter(text: string, ends: RegExp): string[] {
  return text.replace(ends, '$1\u0001').split('\u0001');
}
