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
                    career: { type: generative_ai_1.SchemaType.STRING }, love: { type: generative_ai_1.SchemaType.STRING },
                    wealth: { type: generative_ai_1.SchemaType.STRING }, luckyDay: { type: generative_ai_1.SchemaType.STRING },
                    luckyItem: { type: generative_ai_1.SchemaType.STRING }, caution: { type: generative_ai_1.SchemaType.STRING },
                } } },
    },
};
async function generateMonthlyFortune(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 },
        thinkingConfig: { thinkingBudget: 0 },
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
    return `2026월별운세. 1~${now - 1}월 과거형, ${now}~12월 미래형. ${d.input?.name || ''} ${d.input?.gender === 'male' ? '남' : '여'} 사주:${saju} 오행:목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0}${cd ? ' 대운:' + cd.간지 : ''} 12개월 각 career/love/wealth/luckyDay/luckyItem/caution 포함. 구체적.`;
}
//# sourceMappingURL=claudeMonthly.js.map