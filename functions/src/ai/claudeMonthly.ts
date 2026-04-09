import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    yearOverview: { type: SchemaType.STRING, description: '2026년 전체 운세 100~200자' },
    bestMonth: { type: SchemaType.NUMBER },
    worstMonth: { type: SchemaType.NUMBER },
    months: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      month: { type: SchemaType.NUMBER }, score: { type: SchemaType.NUMBER },
      theme: { type: SchemaType.STRING, description: '이달 테마 10~20자' },
      advice: { type: SchemaType.STRING, description: '핵심 조언 60~100자' },
      luckyDay: { type: SchemaType.STRING }, luckyItem: { type: SchemaType.STRING },
      career: { type: SchemaType.STRING }, love: { type: SchemaType.STRING },
      wealth: { type: SchemaType.STRING }, caution: { type: SchemaType.STRING },
    } } },
  },
};

export async function generateMonthlyFortune(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema } as any,
  });
  const prompt = buildPrompt(sajuData);
  const r = await model.generateContent('사주명리학 월운 분석 전문가로서 2026년 12개월 운세를 분석해주세요.\n\n' + prompt);
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
