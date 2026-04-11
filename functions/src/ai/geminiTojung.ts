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
      month: { type: SchemaType.NUMBER }, 괘: { type: SchemaType.STRING },
      괘의미: { type: SchemaType.STRING }, 전통해석: { type: SchemaType.STRING },
      현대해석: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER },
      keyword: { type: SchemaType.STRING },
    } } },
    luckyAdvice: { type: SchemaType.STRING },
  },
};

export async function generateTojungBigyeol(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 } as any, thinkingConfig: { thinkingBudget: 0 }, } as any);
  const currentMonth = new Date().getMonth() + 1; // 1~12
  const r = await model.generateContent(`토정비결 전문가. 2026년. 주역64괘. 전통해석 고풍문체, 현대해석 해요체. 소름돋게 구체적으로. ${currentMonth}월~12월만 생성 (${currentMonth-1}월 이전은 제외).\n\n` + buildPrompt(sajuData));
  return JSON.parse(r.response.text());
}

function buildPrompt(d: any): string {
  const p = d.pillars || [];
  let s = `${d.input?.name || '미상'}, ${d.input?.gender === 'male' ? '남' : '여'}, ${d.input?.birthYear}년생\n사주: `;
  p.forEach((x: any, i: number) => { if (x.available !== false) s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  const el = d.elements || {};
  s += `\n오행: 목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0}`;
  if (d.띠) s += `\n띠: ${d.띠}`;
  return s;
}
