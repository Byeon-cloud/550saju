/** 숫자를 원화 형식으로 포맷 */
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

/** 운(運) 잔액 포맷 */
export function formatUn(un: number): string {
  return `${un}운`;
}

/** 날짜를 YYYY.MM.DD 형식으로 포맷 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

/** 생년월일 포맷 */
export function formatBirthDate(year: number, month: number, day: number): string {
  return `${year}년 ${month}월 ${day}일`;
}

// (2026-07 제거) calculateAge — 주석은 "만 나이"라면서 실제론 연나이를 반환하던 오표기 dead code (사용처 0).
//   나이가 필요하면 utils/saju-format.ts 의 만나이/세는나이 헬퍼를 쓸 것. 대운 비교는 services/saju/daeunCurrent.ts SSOT.

/** HTML 엔티티 디코드 (&lt; → < 등). AI 가 종종 태그를 이스케이프해서 보냄. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

/**
 * AI 응답을 순수 plain text 로 변환 (마크다운 + 모든 HTML 태그 + 엔티티 제거).
 * 2026-05-29 — 기존엔 HTML 태그를 "보존" 했으나, AI 가 `&lt;strong&gt;` 처럼 이스케이프해 보내면
 *   결과 화면(종합사주 등)에 `<strong>` 글자가 그대로 노출되는 버그 발생. plain-text 생산기로 전환.
 *   강조(bold)가 필요한 곳은 sanitizeAiText (화이트리스트 + 엔티티 디코드) 를 쓸 것.
 */
export function stripMd(text: unknown): string {
  if (text === null || text === undefined || text === '') return '';
  // 2026-05-07 fix — 객체/배열 입력 방어 (.replace is not a function 에러 방지).
  const str = typeof text === 'string' ? text : String(text);
  return decodeHtmlEntities(str)
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^<>]*>/g, '') // 모든 HTML 태그 제거 (raw <strong> 노출 박멸)
    .replace(/\*\*/g, '')           // **bold**
    .replace(/(?<!\w)\*(?!\*)/g, '') // *italic*
    .replace(/^#+\s*/gm, '')        // # heading
    .replace(/`/g, '')              // `code`
    .trim();
}

/**
 * AI 응답 텍스트 sanitize (2026-05-04)
 *  - 안전 태그(`<strong>`, `<b>`, `<em>`, `<i>`, `<u>`, `<br>`)만 보존, 나머지 HTML 태그는 strip
 *    (LifeEdgeList 등에서 AI 가 보낸 `<strong>축토(丑土)</strong>` raw text 노출 버그 차단)
 *  - markdown bold/italic strip
 *  - 양끝 공백 trim
 *
 * dangerouslySetInnerHTML 로 렌더할 때 사용하면 안전 — XSS 위험이 있는 `<script>`, `<iframe>`,
 * `<style>`, `on*` 핸들러 등은 모두 제거.
 */
export function sanitizeAiText(text: string | undefined | null): string {
  if (!text) return '';
  const ALLOWED = /^(strong|b|em|i|u|br)$/i;
  // 2026-05-29 — 0) 엔티티 디코드 먼저. AI 가 `&lt;strong&gt;` 로 이스케이프해 보내면
  //   화이트리스트 정규식이 못 잡아 raw 태그가 글자로 노출됨. 디코드 후 화이트리스트로 안전 처리.
  return decodeHtmlEntities(String(text))
    // 1) 안전 태그 화이트리스트만 통과 — 그 외 모든 HTML 태그 strip
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g, (full, tagName) => {
      return ALLOWED.test(tagName) ? full.replace(/\s[^<>]*/g, '') : '';
    })
    // 2) markdown bold/italic
    .replace(/\*\*/g, '')
    .replace(/(?<!\w)\*(?!\*)/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/`/g, '')
    .trim();
}
