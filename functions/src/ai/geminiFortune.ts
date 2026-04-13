import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    grade: { type: SchemaType.STRING },
    gradeLabel: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    scores: { type: SchemaType.OBJECT, properties: {
      love: { type: SchemaType.NUMBER },
      career: { type: SchemaType.NUMBER },
      wealth: { type: SchemaType.NUMBER },
      health: { type: SchemaType.NUMBER },
    } },
    lucky: { type: SchemaType.OBJECT, properties: {
      color: { type: SchemaType.STRING },
      colorHex: { type: SchemaType.STRING },
      number: { type: SchemaType.NUMBER },
      direction: { type: SchemaType.STRING },
      item: { type: SchemaType.STRING },
      food: { type: SchemaType.STRING },
    } },
    advice: { type: SchemaType.STRING },
  },
  required: ['grade', 'gradeLabel', 'summary', 'scores', 'lucky', 'advice'],
};

/**
 * 오늘의 운세 — Gemini 2.5 Flash + responseSchema
 */
export async function generateDailyFortuneAI(
  apiKey: string,
  answers: number[],
  timeSlot: string,
  sajuSummary?: { ilgan: string; oheng: string; name: string },
  concern?: string,
): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      maxOutputTokens: 2048,
    } as any,
    thinkingConfig: { thinkingBudget: 0 },
  } as any);

  const timeContext: Record<string, string> = {
    dawn: '새벽',
    morning: '오전',
    noon: '점심',
    afternoon: '오후',
    evening: '저녁',
    night: '밤',
    latenight: '심야',
  };

  const personalContext = sajuSummary
    ? `사용자: ${sajuSummary.name}님, 일간 ${sajuSummary.ilgan}(${sajuSummary.oheng}). 맞춤 운세 제공.`
    : '사주 정보 없음. 일반 운세 제공.';

  const prompt = `따뜻하고 프로페셔널한 운세 전문가.

현재 시간대: ${timeContext[timeSlot] || timeSlot}
${personalContext}
${concern ? `사용자 고민: "${concern}"` : ''}

오늘의 운세 (고민이 있으면 summary와 advice에 반영):
- grade: A~D (A 최고, S 가능)
- gradeLabel: 등급 라벨 (예: "좋은 하루", "주의할 하루")
- summary: 3~4문장 운세 요약 (시간대와 사주에 맞게, 따뜻한 톤)
- scores: love/career/wealth/health 각 0~100
- lucky: color(이름)/colorHex(#HEX)/number(숫자)/direction(방위)/item/food
- advice: 시간대에 맞는 한 줄 핵심 조언`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}
