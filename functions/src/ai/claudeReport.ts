import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const sectionSchema = { type: SchemaType.OBJECT, properties: {
  id: { type: SchemaType.STRING }, title: { type: SchemaType.STRING }, content: { type: SchemaType.STRING },
} };

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    sections: { type: SchemaType.ARRAY, items: sectionSchema },
    scores: { type: SchemaType.OBJECT, properties: {
      career: { type: SchemaType.NUMBER }, love: { type: SchemaType.NUMBER }, wealth: { type: SchemaType.NUMBER },
      social: { type: SchemaType.NUMBER }, health: { type: SchemaType.NUMBER }, potential: { type: SchemaType.NUMBER },
    } },
    luckyProfile: { type: SchemaType.OBJECT, properties: {
      colors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      colorNames: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      numbers: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } },
      direction: { type: SchemaType.STRING }, day: { type: SchemaType.STRING },
      foods: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      element: { type: SchemaType.STRING },
    } },
    careerFit: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      job: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER },
    } } },
    monthlyFortune: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      month: { type: SchemaType.NUMBER }, score: { type: SchemaType.NUMBER },
    } } },
    relationshipMap: { type: SchemaType.OBJECT, properties: {
      work: { type: SchemaType.OBJECT, properties: { score: { type: SchemaType.NUMBER }, keyword: { type: SchemaType.STRING } } },
      friend: { type: SchemaType.OBJECT, properties: { score: { type: SchemaType.NUMBER }, keyword: { type: SchemaType.STRING } } },
      lover: { type: SchemaType.OBJECT, properties: { score: { type: SchemaType.NUMBER }, keyword: { type: SchemaType.STRING } } },
    } },
    wealthFlow: { type: SchemaType.OBJECT, properties: {
      earning: { type: SchemaType.OBJECT, properties: { score: { type: SchemaType.NUMBER }, style: { type: SchemaType.STRING } } },
      spending: { type: SchemaType.OBJECT, properties: { score: { type: SchemaType.NUMBER }, style: { type: SchemaType.STRING } } },
      saving: { type: SchemaType.OBJECT, properties: { score: { type: SchemaType.NUMBER }, style: { type: SchemaType.STRING } } },
    } },
  },
};

export async function generateSajuReport(apiKey: string, sajuData: any, situation: any, _reportType: string): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema } as any,
  });
  const userPrompt = buildUserPrompt(sajuData, situation);
  const systemMsg = `사주명리학 40년 경력 대가로서 12섹션 분석. 소름 포인트: 각 섹션 첫 2문장에서 "어떻게 알았지?" 할 정도로 구체적 행동 패턴 묘사. 섹션 ID: summary, personality, social, career, wealth, love, health, year2026, daeun, mission, luck, luckyProfile. 각 섹션 content 200자 이상. careerFit 5개, monthlyFortune 12개월.`;
  const r = await model.generateContent(systemMsg + '\n\n' + userPrompt);
  const parsed = JSON.parse(r.response.text());
  return {
    content: {
      ...parsed,
      summary: parsed.sections?.[0]?.content?.slice(0, 100) + '...',
    },
  };
}

function buildUserPrompt(sajuData: any, situation?: any): string {
  const p = sajuData.pillars || [];
  let prompt = `생년월일: ${sajuData.input?.birthYear}/${sajuData.input?.birthMonth}/${sajuData.input?.birthDay}, 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n사주: `;
  p.forEach((x: any, i: number) => { if (x.available !== false) prompt += `${'년월일시'[i]}:${x.천간}(${x.천간읽기})${x.지지}(${x.지지읽기}) `; });
  if (sajuData.sipsung?.length) { prompt += '\n십성: '; sajuData.sipsung.forEach((s: any) => { prompt += `${s.위치}:${s.글자}(${s.십성}) `; }); }
  if (sajuData.elements) prompt += `\n오행: 목${sajuData.elements.목} 화${sajuData.elements.화} 토${sajuData.elements.토} 금${sajuData.elements.금} 수${sajuData.elements.수}`;
  const cd = sajuData.daeun?.find((d: any) => d.현재 || d.isCurrent);
  if (cd) prompt += `\n현재 대운: ${cd.간지}`;
  if (situation?.concern) prompt += `\n고민: ${situation.concern}`;
  return prompt;
}
