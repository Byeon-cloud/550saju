import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overallScore: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING, description: '궁합 총평 150~300자' },
    categories: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      id: { type: SchemaType.STRING }, name: { type: SchemaType.STRING },
      score: { type: SchemaType.NUMBER }, description: { type: SchemaType.STRING, description: '100~200자' },
    } } },
    strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    challenges: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    advice: { type: SchemaType.STRING, description: '종합 조언 100~200자' },
    futureOutlook: { type: SchemaType.STRING, description: '미래 전망 80~150자' },
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
    generationConfig: { responseMimeType: 'application/json', responseSchema } as any,
  });
  const prompt = buildPrompt(sajuData1, sajuData2, relation);
  const r = await model.generateContent('사주명리학 궁합 분석 전문가로서 두 사람의 궁합을 분석해주세요. 카테고리는 personality(성격), values(가치관), communication(소통), emotion(감정), future(미래) 5개.\n\n' + prompt);
  return JSON.parse(r.response.text());
}

function person(label: string, d: any): string {
  const p = d.pillars || [];
  let s = `\n${label}: ${d.input?.name || '미상'} (${d.input?.gender === 'male' ? '남' : '여'})\n사주: `;
  p.forEach((x: any, i: number) => { if (x.available !== false) s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  if (d.elements) s += `\n오행: 목${d.elements.목}화${d.elements.화}토${d.elements.토}금${d.elements.금}수${d.elements.수}`;
  return s;
}

function buildPrompt(d1: any, d2: any, rel: string): string {
  return `관계: ${rel}${person('사람1', d1)}${person('사람2', d2)}`;
}
