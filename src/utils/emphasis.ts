/**
 * autoEmphasize — AI 본문에 강조(<strong>/<em>/<u>)를 자동 주입.
 * 2026-05-29 — DailyMockupView/TopicMockupView 의 인라인 로직을 공용화 (드리프트 방지).
 *
 * 위계: <strong> 황금 형광펜(긍정 결론) · <em> 번트오렌지(주의·경고) · <u> 골드 밑줄(시간·색·방위)
 *   AI 가 이미 태그를 넣었으면(<strong>/<em>) 해당 패스는 skip — 중복/중첩 방지.
 *   sanitizeAiText 와 함께 사용: sanitizeAiText(autoEmphasize(text))
 */
export function autoEmphasize(input: string): string {
  if (!input) return input;
  let text = String(input);

  // 1) 시간·색·방위 → <u>
  if (!/<u>/i.test(text)) {
    text = text.replace(/(?<!<u>)(오전|오후|저녁|밤|새벽|아침)\s*\d+(?:\s*[~∼-]\s*\d+)?\s*시(?:\s*이후)?/g, '<u>$&</u>');
    text = text.replace(/(?<!<u>)(?<!\d)\d{1,2}\s*[~∼-]\s*\d{1,2}\s*시/g, '<u>$&</u>');
    text = text.replace(/(?<!<u>)(\d{1,2}월\s*[~∼-]?\s*\d{1,2}월|\d{1,2}월)/g, '<u>$1</u>');
    text = text.replace(/(?<!<u>)(동남쪽|동북쪽|서남쪽|서북쪽|동쪽|서쪽|남쪽|북쪽|동남방|동북방|서남방|서북방)/g, '<u>$1</u>');
    text = text.replace(/(?<!<u>)(짙은 파란색|진한 파란색|연한 녹색|밝은 빨강|짙은 검은색|남보라|보라색|주황색|연두색|검은색|검정색|파란색|초록색|노란색|갈색|남색|회색|빨강|파랑|초록|노랑|검정|흰색|은색|금색)/g, '<u>$1</u>');
  }

  const splitSentences = (t: string) => t.split(/(?<=[다요네][.!?])\s+/);

  // 2) 주의·경고 절 → <em> (최대 2)
  if (!/<em>/i.test(text)) {
    const cautionTrigger = /주의|조심|피하|삼가|위험|긴장|갈등|충돌|불안|악화|심화|예민|상처|마찰|소진|과부하|무리|경계|흉/;
    const sentences = splitSentences(text);
    let emCount = 0;
    const emPhrases: string[] = [];
    for (const s of sentences) {
      if (emCount >= 2) break;
      if (!cautionTrigger.test(s)) continue;
      const clean = s.trim().replace(/[.!?]+$/, '');
      const lastComma = clean.lastIndexOf(',');
      let seg = lastComma !== -1 ? clean.slice(lastComma + 1).trim() : clean;
      if (!cautionTrigger.test(seg) || seg.length < 8 || seg.length > 46) {
        if (clean.length >= 8 && clean.length <= 46 && cautionTrigger.test(clean)) seg = clean;
        else continue;
      }
      if (/[<>]/.test(seg)) continue;
      emPhrases.push(seg);
      emCount++;
    }
    for (const p of emPhrases) {
      const idx = text.lastIndexOf(p);
      if (idx === -1) continue;
      const before = text.slice(Math.max(0, idx - 12), idx);
      if (/<(strong|u|em|b)>[^<]*$/.test(before)) continue;
      text = text.slice(0, idx) + `<em>${p}</em>` + text.slice(idx + p.length);
    }
  }

  // 3) 결론 절 → <strong> (최대 2)
  if (!/<strong>/i.test(text) && text.length >= 50) {
    const sentences = splitSentences(text);
    const conclusionEndings = [
      '(?:날|시간|자리|결|순간|것|점|곳|쪽|무기|핵심|정답|답|이유|방법|시점|구간|기회|신호|중심|기준|기억|감각|선택|순서|과제|상태|경향|특징|의미|시기|부분|영역|타이밍|강점|장점)\\s*(?:이에요|예요|입니다|이다|네요)',
      '(?:하세요|미루세요|집중하세요|정리하세요|만나세요|배치하세요|챙기세요|준비하세요|확인하세요|시도하세요|체크하세요|넘기세요|놓치지 마세요|유지하세요|시작하세요|마무리하세요|머물러 보세요|꺼내세요|살펴보세요|믿으세요|들어보세요|찾으세요|보충하세요|모으세요|끌어당기세요)',
      '(?:게 좋아요|필수예요|필요해요|중요해요|좋습니다|중요합니다|필요합니다|효율적입니다|적절합니다|좋은 자리예요|어울려요|솟아오릅니다|강화합니다|극대화됩니다|커집니다|높습니다|좋아집니다|수월합니다|핵심 과제입니다)',
    ];
    const conclusionPattern = new RegExp(`([가-힣\\sA-Za-z0-9, ~()]{8,32}(?:${conclusionEndings.join('|')}))[.!?]?$`);
    let strongCount = 0;
    const replacements: string[] = [];
    for (const sentence of sentences) {
      if (strongCount >= 2) break;
      const clean = sentence.trim().replace(/[.!?]+$/, '');
      const lastCommaIdx = clean.lastIndexOf(',');
      const segment = lastCommaIdx !== -1 ? clean.slice(lastCommaIdx + 1).trim() : clean;
      if (/[<>]/.test(segment)) continue;
      const m = segment.match(conclusionPattern);
      if (m && m[1].length >= 8 && m[1].length <= 32) {
        replacements.push(m[1].trim());
        strongCount++;
      }
    }
    for (const phrase of replacements) {
      if (/[<>]/.test(phrase)) continue;
      const idx = text.lastIndexOf(phrase);
      if (idx === -1) continue;
      const before = text.slice(Math.max(0, idx - 12), idx);
      if (/<(strong|u|em|b)>[^<]*$/.test(before)) continue;
      text = text.slice(0, idx) + `<strong>${phrase}</strong>` + text.slice(idx + phrase.length);
    }
  }

  return text;
}
