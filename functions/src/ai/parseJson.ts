/**
 * AI 응답에서 JSON을 안전하게 추출 — Gemini/Claude 모두 대응
 */
export function safeParseJson(text: string): any {
  // 1. 코드블록 제거
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 2. 앞뒤 설명 텍스트 제거 — { 로 시작하는 부분부터
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);

  // 3. 마지막 } 이후 텍스트 제거
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace >= 0) cleaned = cleaned.slice(0, lastBrace + 1);

  if (!cleaned.startsWith('{')) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');
  }

  // 4. 제어 문자 제거
  cleaned = cleaned.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

  // 5. 파싱 시도
  try {
    return JSON.parse(cleaned);
  } catch {
    // 6. trailing comma 복구
    try {
      const fixed = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      return JSON.parse(fixed);
    } catch {
      // 7. 잘린 JSON — 마지막 유효한 위치까지
      try {
        let depth = 0;
        let lastValid = 0;
        for (let i = 0; i < cleaned.length; i++) {
          if (cleaned[i] === '{' || cleaned[i] === '[') depth++;
          if (cleaned[i] === '}' || cleaned[i] === ']') {
            depth--;
            if (depth === 0) { lastValid = i + 1; break; }
          }
        }
        if (lastValid > 0) return JSON.parse(cleaned.slice(0, lastValid));
      } catch {}

      throw new Error('JSON 파싱 실패');
    }
  }
}
