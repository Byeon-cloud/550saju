// Gemini API 호출 헬퍼 (generateContent, JSON 강제)
const MODEL = "gemini-2.5-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function geminiJSON(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 1.0, // 콘텐츠 생성=1.0(창의), 사실 분석/파싱=0.2(환각 방지)
): Promise<any> {
  const url = `${BASE}/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      // 2.5-flash 의 thinking 이 출력 토큰을 먹어 JSON 이 잘리는 문제 → thinking off
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini 빈 응답: ${JSON.stringify(data).slice(0, 500)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    // 혹시 코드펜스 등이 섞이면 정리 후 재시도
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(cleaned);
  }
}
