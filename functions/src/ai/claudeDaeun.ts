import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overview: { type: SchemaType.STRING, description: '전체 대운 흐름 요약 100~200자' },
    periods: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      간지: { type: SchemaType.STRING }, 시작나이: { type: SchemaType.NUMBER }, 끝나이: { type: SchemaType.NUMBER },
      isCurrent: { type: SchemaType.BOOLEAN }, theme: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER },
      detail: { type: SchemaType.STRING, description: '이 시기 특징 80~150자' },
      advice: { type: SchemaType.STRING, description: '핵심 조언 30~50자' },
    } } },
    currentHighlight: { type: SchemaType.STRING, description: '현재 대운 심층 150~300자' },
    transitionAdvice: { type: SchemaType.STRING, description: '전환기 조언 60~100자' },
    lifePhaseMap: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      phase: { type: SchemaType.STRING }, daeun: { type: SchemaType.STRING }, theme: { type: SchemaType.STRING },
    } } },
  },
};

export async function generateDaeunAnalysis(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 } as any,
  });
  const prompt = buildPrompt(sajuData);
  const r = await model.generateContent('대운 분석. 구체적 묘사. overview 80자, detail 각60자, currentHighlight 100자. 간결하게.\n\n' + prompt);
  return JSON.parse(r.response.text());
}

function buildPrompt(d: any): string {
  const p = d.pillars || [];
  let s = `${d.input?.name || '미상'}, ${d.input?.gender === 'male' ? '남' : '여'}\n사주: `;
  p.forEach((x: any, i: number) => { if (x.available !== false) s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  if (d.elements) s += `\n오행: 목${d.elements.목}화${d.elements.화}토${d.elements.토}금${d.elements.금}수${d.elements.수}`;
  if (d.daeun?.length) { s += '\n대운: '; d.daeun.forEach((x: any) => { s += `${x.간지}(${x.시작나이||''}~${x.끝나이||''})${x.isCurrent?' ★':''} `; }); }
  return s;
}
