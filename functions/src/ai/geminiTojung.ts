import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    yearOverview: { type: SchemaType.OBJECT, properties: {
      총운: { type: SchemaType.STRING }, 금전운: { type: SchemaType.STRING },
      건강운: { type: SchemaType.STRING }, 직장운: { type: SchemaType.STRING },
      애정운: { type: SchemaType.STRING }, 결혼운: { type: SchemaType.STRING },
    } },
    months: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      month: { type: SchemaType.NUMBER }, score: { type: SchemaType.NUMBER },
      keyword: { type: SchemaType.STRING }, interpretation: { type: SchemaType.STRING },
    } } },
    luckyAdvice: { type: SchemaType.STRING },
  },
};

export async function generateTojungBigyeol(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 } as any,
    thinkingConfig: { thinkingBudget: 0 },
  } as any);
  const now = new Date().getMonth() + 1;
  const r = await model.generateContent(`토정비결2026. ${now}월~12월. ` + buildPrompt(sajuData));
  return JSON.parse(r.response.text());
}

function buildPrompt(d: any): string {
  const p = d.pillars || [];
  let saju = '';
  p.forEach((x: any, i: number) => { if (x.available !== false) saju += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  const el = d.elements || {};
  return `${d.input?.name||''} ${d.input?.gender==='male'?'남':'여'} ${d.input?.birthYear}년생 사주:${saju} 오행:목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0}${d.띠?' 띠:'+d.띠:''} 소름돋게.`;
}
