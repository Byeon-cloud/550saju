import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    yearOverview: { type: SchemaType.STRING },
    bestMonth: { type: SchemaType.NUMBER },
    worstMonth: { type: SchemaType.NUMBER },
    months: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      month: { type: SchemaType.NUMBER }, score: { type: SchemaType.NUMBER },
      theme: { type: SchemaType.STRING }, advice: { type: SchemaType.STRING },
      career: { type: SchemaType.STRING }, love: { type: SchemaType.STRING },
      wealth: { type: SchemaType.STRING }, luckyDay: { type: SchemaType.STRING },
      luckyItem: { type: SchemaType.STRING }, caution: { type: SchemaType.STRING },
    } } },
  },
};

export async function generateMonthlyFortune(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 } as any,
    thinkingConfig: { thinkingBudget: 0 },
  } as any);
  const r = await model.generateContent(buildPrompt(sajuData));
  return JSON.parse(r.response.text());
}

function buildPrompt(d: any): string {
  const p = d.pillars || [];
  let saju = '';
  p.forEach((x: any, i: number) => { if (x.available !== false) saju += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  const el = d.elements || {};
  const cd = d.daeun?.find((x: any) => x.isCurrent || x.현재);
  const now = new Date().getMonth() + 1;
  return `2026월별운세. 1~${now-1}월 과거형, ${now}~12월 미래형. ${d.input?.name||''} ${d.input?.gender==='male'?'남':'여'} 사주:${saju} 오행:목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0}${cd?' 대운:'+cd.간지:''} 12개월 각 career/love/wealth/luckyDay/luckyItem/caution 포함. 구체적.`;
}
