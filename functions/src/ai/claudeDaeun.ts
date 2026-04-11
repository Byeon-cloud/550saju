import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overview: { type: SchemaType.STRING },
    periods: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      간지: { type: SchemaType.STRING }, age: { type: SchemaType.STRING },
      theme: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER },
      detail: { type: SchemaType.STRING },
    } } },
    currentHighlight: { type: SchemaType.STRING },
    transitionAdvice: { type: SchemaType.STRING },
  },
};

export async function generateDaeunAnalysis(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 } as any,
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
  let daeunList = '';
  d.daeun?.forEach((x: any) => { daeunList += `${x.간지}(${x.시작나이||''}~${x.끝나이||''})${x.isCurrent?' ★':''} `; });
  return `대운분석. ${d.input?.name||''} ${d.input?.gender==='male'?'남':'여'} 사주:${saju} 오행:목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0} 대운:${daeunList} 소름돋게 구체적으로.`;
}
