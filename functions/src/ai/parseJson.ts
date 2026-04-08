/**
 * AI 응답에서 JSON을 안전하게 추출
 * Claude/Gemini가 가끔 깨진 JSON을 반환하므로 견고하게 처리
 */
export function safeParseJson(text: string): any {
  // 1. 코드블록 제거
  let cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // 2. JSON 객체 추출
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');

  let jsonStr = match[0];

  // 3. 일반적인 JSON 깨짐 복구
  // 제어 문자 제거 (탭, 줄바꿈은 유지)
  jsonStr = jsonStr.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

  // 4. 파싱 시도
  try {
    return JSON.parse(jsonStr);
  } catch (e1) {
    // 5. trailing comma 복구 시도
    try {
      const fixed = jsonStr
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      return JSON.parse(fixed);
    } catch (e2) {
      // 6. 잘린 JSON 복구 — 마지막 완전한 프로퍼티까지만
      try {
        // 열린 중괄호/대괄호 수 세서 닫아주기
        let depth = 0;
        let lastValid = 0;
        for (let i = 0; i < jsonStr.length; i++) {
          if (jsonStr[i] === '{' || jsonStr[i] === '[') depth++;
          if (jsonStr[i] === '}' || jsonStr[i] === ']') {
            depth--;
            if (depth === 0) { lastValid = i + 1; break; }
          }
        }
        if (lastValid > 0) {
          return JSON.parse(jsonStr.slice(0, lastValid));
        }
      } catch {}

      throw new Error(`JSON 파싱 실패: ${(e1 as Error).message}`);
    }
  }
}
