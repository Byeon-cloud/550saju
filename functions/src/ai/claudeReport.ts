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
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 } as any,
  });
  const r = await model.generateContent(buildUserPrompt(sajuData, situation));
  const parsed = JSON.parse(r.response.text());
  return { content: { ...parsed, summary: parsed.sections?.[0]?.content?.slice(0, 100) + '...' } };
}

function buildUserPrompt(sajuData: any, situation?: any): string {
  const p = sajuData.pillars || [];
  let prompt = `사주명리학 40년 대가. 12섹션 심층분석. 소름포인트 필수 — 각 섹션 첫 2문장에서 "어떻게 알았지?" 수준의 구체적 행동 패턴 묘사.

예시 소름포인트:
- "혼자 있는 시간을 좋아하면서도, 막상 혼자 있으면 불안해지는 타입이시죠?"
- "결정을 내릴 때 머리로는 이미 답을 알고 있는데, 마음이 따라주지 않는 경험이 많으셨을 거예요"

섹션ID: summary, personality, social, career, wealth, love, health, year2026, daeun, mission, luck, luckyProfile
각 섹션 content 150자 이상. careerFit 5개, monthlyFortune 12개월.

${sajuData.input?.birthYear}/${sajuData.input?.birthMonth}/${sajuData.input?.birthDay} ${sajuData.input?.gender==='male'?'남':'여'}\n사주: `;
  p.forEach((x: any, i: number) => { if (x.available !== false) prompt += `${'년월일시'[i]}:${x.천간}(${x.천간읽기})${x.지지}(${x.지지읽기}) `; });
  if (sajuData.sipsung?.length) { prompt += '\n십성: '; sajuData.sipsung.forEach((s: any) => { prompt += `${s.위치}:${s.글자}(${s.십성}) `; }); }
  const el = sajuData.elements || {};
  prompt += `\n오행: 목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0}`;
  const cd = sajuData.daeun?.find((d: any) => d.현재 || d.isCurrent);
  if (cd) prompt += `\n현재대운: ${cd.간지}`;
  if (situation?.concern) prompt += `\n고민: ${situation.concern}`;
  return prompt;
}
