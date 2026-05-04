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

/** 나이 계산 (만 나이) */
export function calculateAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear;
}

/** AI 응답에 남아있을 수 있는 마크다운 서식을 strip */
export function stripMd(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')           // **bold**
    .replace(/(?<!\w)\*(?!\*)/g, '') // *italic*
    .replace(/^#+\s*/gm, '')        // # heading
    .replace(/`/g, '');             // `code`
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
  return String(text)
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
