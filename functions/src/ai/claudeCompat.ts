import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overallScore: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
    categories: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      id: { type: SchemaType.STRING }, name: { type: SchemaType.STRING },
      score: { type: SchemaType.NUMBER }, description: { type: SchemaType.STRING },
    } } },
    strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    challenges: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    advice: { type: SchemaType.STRING },
    futureOutlook: { type: SchemaType.STRING },
    ohengHarmony: { type: SchemaType.OBJECT, properties: {
      person1Element: { type: SchemaType.STRING }, person2Element: { type: SchemaType.STRING },
      relation: { type: SchemaType.STRING }, description: { type: SchemaType.STRING },
    } },
  },
};

export async function generateCompatibilityAnalysis(apiKey: string, sajuData1: any, sajuData2: any, relation: string): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 } as any, thinkingConfig: { thinkingBudget: 0 }, } as any);
  const r = await model.generateContent(buildPrompt(sajuData1, sajuData2, relation));
  return JSON.parse(r.response.text());
}

function person(label: string, d: any): string {
  const p = d.pillars || [];
  let s = `${label}: ${d.input?.name||'미상'}(${d.input?.gender==='male'?'남':'여'}) `;
  p.forEach((x: any, i: number) => { if (x.available !== false) s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  const el = d.elements || {};
  s += `오행:목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0}`;
  return s;
}

function buildPrompt(d1: any, d2: any, rel: string): string {
  return `사주궁합분석. 소름포인트 필수. 관계:${rel}
${person('사람1', d1)}
${person('사람2', d2)}

카테고리: personality(성격궁합), values(가치관), communication(소통), emotion(감정), future(미래) 5개.
예시 소름포인트: "한 사람이 결정을 미루면 다른 사람이 먼저 정리해주는 패턴이 있을 거예요"

구체적으로 분석해주세요.`;
}
