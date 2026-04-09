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
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 } as any,
  });
  const prompt = buildPrompt(sajuData);
  const r = await model.generateContent('토정비결 전문가로서 2026년 토정비결을 작성. 주역 64괘 활용. 전통해석은 고풍 문체, 현대해석은 해요체. 6대운 각 60자, 12개월 각 현대해석 50자.\n\n' + prompt);
  return JSON.parse(r.response.text());
}

function buildPrompt(d: any): string {
  const p = d.pillars || [];
  let s = `${d.input?.name || '미상'}, ${d.input?.gender === 'male' ? '남' : '여'}, ${d.input?.birthYear}년생\n사주: `;
  p.forEach((x: any, i: number) => { if (x.available !== false) s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  if (d.elements) s += `\n오행: 목${d.elements.목}화${d.elements.화}토${d.elements.토}금${d.elements.금}수${d.elements.수}`;
  if (d.띠) s += `\n띠: ${d.띠}`;
  return s;
}
