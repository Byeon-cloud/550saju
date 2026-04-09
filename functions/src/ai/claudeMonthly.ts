import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const summarySchema = {
  type: SchemaType.OBJECT,
  properties: {
    yearOverview: { type: SchemaType.STRING, description: '2026년 개요 80자' },
    bestMonth: { type: SchemaType.NUMBER },
    worstMonth: { type: SchemaType.NUMBER },
    months: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      month: { type: SchemaType.NUMBER }, score: { type: SchemaType.NUMBER },
      theme: { type: SchemaType.STRING, description: '15자' },
      advice: { type: SchemaType.STRING, description: '40자' },
      career: { type: SchemaType.STRING, description: '15자' },
      love: { type: SchemaType.STRING, description: '15자' },
      wealth: { type: SchemaType.STRING, description: '15자' },
      caution: { type: SchemaType.STRING, description: '20자' },
      luckyDay: { type: SchemaType.STRING }, luckyItem: { type: SchemaType.STRING },
    } } },
  },
};

export async function generateMonthlyFortune(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema: summarySchema, maxOutputTokens: 8192 } as any,
  });
  const r = await model.generateContent('사주 월운 전문가. 2026년 12개월. 간결하게.\n\n' + buildPrompt(sajuData));
  return JSON.parse(r.response.text());
}

function buildPrompt(d: any): string {
  const p = d.pillars || [];
  let s = `${d.input?.name || '미상'}, ${d.input?.gender === 'male' ? '남' : '여'}\n사주: `;
  p.forEach((x: any, i: number) => { if (x.available !== false) s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  if (d.elements) s += `\n오행: 목${d.elements.목}화${d.elements.화}토${d.elements.토}금${d.elements.금}수${d.elements.수}`;
  const cd = d.daeun?.find((x: any) => x.isCurrent || x.현재);
  if (cd) s += `\n현재 대운: ${cd.간지}`;
  return s;
}
