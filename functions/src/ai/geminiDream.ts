import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    interpretation: { type: SchemaType.STRING },
    luckyAction: { type: SchemaType.STRING },
    category: { type: SchemaType.STRING },
  },
  required: ['title', 'interpretation', 'luckyAction', 'category'],
};

/**
 * 꿈해몽 — Gemini 2.5 Flash + responseSchema (Pro → Flash 속도 개선)
 */
export async function generateDreamInterpretation(
  apiKey: string,
  category: string,
  dreamText: string,
  sajuData?: any,
): Promise<{ title: string; interpretation: string; luckyAction: string; category: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      maxOutputTokens: 4096,
    } as any,
    thinkingConfig: { thinkingBudget: 0 },
  } as any);

  const sajuContext = sajuData?.pillars
    ? `사주: 일간${sajuData.pillars?.[2]?.천간||'미상'} 오행목${sajuData.elements?.목||0}화${sajuData.elements?.화||0}토${sajuData.elements?.토||0}금${sajuData.elements?.금||0}수${sajuData.elements?.수||0} 대운${sajuData.daeun?.find((d:any)=>d.isCurrent)?.간지||'미상'}`
    : '';

  const prompt = `동양 명리학 기반 꿈 해석 전문가.

사용자 입력:
- 카테고리: ${category}
- 꿈 내용: "${dreamText || '(상세 없음)'}"
${sajuContext ? `- ${sajuContext}` : ''}

규칙:
1. 사용자가 입력한 꿈 내용의 키워드(동물/장소/상황 등)를 그대로 사용해 해석
2. 오행/음양 관점의 상징 분석 포함
3. 꿈에서 느낀 감정(무서움/기쁨 등) 해석에 반영
4. 나쁜 꿈도 긍정적 전환 해석
5. luckyAction은 색상/방향/시간대 포함해 구체적으로

title: 꿈 핵심 4~8글자 (입력 키워드 포함)
interpretation: 350자 이상 상세 해석 (\\n\\n으로 단락 구분)
luckyAction: 오늘의 구체적 행동 조언 (색상/방향/시간대 포함)
category: 재물/기회 | 관계/내면 | 전환/성장 | 경고/조심 | 건강/에너지 중 하나`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}
