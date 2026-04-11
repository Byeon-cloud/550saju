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
    } } },
  },
};

export async function generateMonthlyFortune(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 } as any, thinkingConfig: { thinkingBudget: 0 }, } as any);
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

  return `사주명리학 2026년 월별운세. 소름포인트 필수.
현재 ${now}월. 1~${now-1}월은 "~했어요" 과거형, ${now}~12월은 "~할 거예요" 미래형으로.

예시:
- 3월(과거): "이 달에 예상치 못한 지출이 있었을 거예요. 특히 교제비 쪽에서요."
- 6월(미래): "직장에서 인정받을 일이 생길 거예요. 특히 상반기 노력이 결실을 맺어요."

${d.input?.name||'미상'} ${d.input?.gender==='male'?'남':'여'}
사주: ${saju}
오행: 목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0}
${cd ? '현재대운: '+cd.간지 : ''}

12개월 전부 구체적으로.`;
}
