import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    yearOverview: { type: SchemaType.OBJECT, properties: {
      총운: { type: SchemaType.STRING, description: '60자' },
      금전운: { type: SchemaType.STRING, description: '40자' },
      건강운: { type: SchemaType.STRING, description: '40자' },
      직장운: { type: SchemaType.STRING, description: '40자' },
      애정운: { type: SchemaType.STRING, description: '40자' },
      결혼운: { type: SchemaType.STRING, description: '40자' },
    } },
    months: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      month: { type: SchemaType.NUMBER }, 괘: { type: SchemaType.STRING },
      괘의미: { type: SchemaType.STRING, description: '15자' },
      전통해석: { type: SchemaType.STRING, description: '30자 고풍 문체' },
      현대해석: { type: SchemaType.STRING, description: '50자 해요체' },
      score: { type: SchemaType.NUMBER }, keyword: { type: SchemaType.STRING },
    } } },
    luckyAdvice: { type: SchemaType.STRING, description: '60자' },
  },
};

export async function generateTojungBigyeol(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 6144 } as any,
  });
  const r = await model.generateContent('토정비결 전문가. 2026년. 주역 64괘. 전통해석 고풍, 현대해석 해요체. 간결하게.\n\n' + buildPrompt(sajuData));
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
