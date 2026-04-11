"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyFortune = generateMonthlyFortune;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        yearOverview: { type: generative_ai_1.SchemaType.STRING },
        bestMonth: { type: generative_ai_1.SchemaType.NUMBER },
        worstMonth: { type: generative_ai_1.SchemaType.NUMBER },
        months: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    month: { type: generative_ai_1.SchemaType.NUMBER }, score: { type: generative_ai_1.SchemaType.NUMBER },
                    theme: { type: generative_ai_1.SchemaType.STRING }, advice: { type: generative_ai_1.SchemaType.STRING },
                } } },
    },
};
async function generateMonthlyFortune(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 }, thinkingConfig: { thinkingBudget: 0 },
    });
    const r = await model.generateContent(buildPrompt(sajuData));
    return JSON.parse(r.response.text());
}
function buildPrompt(d) {
    const p = d.pillars || [];
    let saju = '';
    p.forEach((x, i) => { if (x.available !== false)
        saju += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
    const el = d.elements || {};
    const cd = d.daeun?.find((x) => x.isCurrent || x.현재);
    const now = new Date().getMonth() + 1;
    return `사주명리학 2026년 월별운세. 소름포인트 필수.
현재 ${now}월. 1~${now - 1}월은 "~했어요" 과거형, ${now}~12월은 "~할 거예요" 미래형으로.

예시:
- 3월(과거): "이 달에 예상치 못한 지출이 있었을 거예요. 특히 교제비 쪽에서요."
- 6월(미래): "직장에서 인정받을 일이 생길 거예요. 특히 상반기 노력이 결실을 맺어요."

${d.input?.name || '미상'} ${d.input?.gender === 'male' ? '남' : '여'}
사주: ${saju}
오행: 목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0}
${cd ? '현재대운: ' + cd.간지 : ''}

12개월 전부 구체적으로.`;
}
//# sourceMappingURL=claudeMonthly.js.map