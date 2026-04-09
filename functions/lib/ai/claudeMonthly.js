"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyFortune = generateMonthlyFortune;
const generative_ai_1 = require("@google/generative-ai");
const summarySchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        yearOverview: { type: generative_ai_1.SchemaType.STRING, description: '2026년 개요 80자' },
        bestMonth: { type: generative_ai_1.SchemaType.NUMBER },
        worstMonth: { type: generative_ai_1.SchemaType.NUMBER },
        months: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    month: { type: generative_ai_1.SchemaType.NUMBER }, score: { type: generative_ai_1.SchemaType.NUMBER },
                    theme: { type: generative_ai_1.SchemaType.STRING, description: '15자' },
                    advice: { type: generative_ai_1.SchemaType.STRING, description: '40자' },
                    career: { type: generative_ai_1.SchemaType.STRING, description: '15자' },
                    love: { type: generative_ai_1.SchemaType.STRING, description: '15자' },
                    wealth: { type: generative_ai_1.SchemaType.STRING, description: '15자' },
                    caution: { type: generative_ai_1.SchemaType.STRING, description: '20자' },
                    luckyDay: { type: generative_ai_1.SchemaType.STRING }, luckyItem: { type: generative_ai_1.SchemaType.STRING },
                } } },
    },
};
async function generateMonthlyFortune(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema: summarySchema, maxOutputTokens: 8192 },
    });
    const r = await model.generateContent('사주 월운 전문가. 2026년 12개월. 간결하게.\n\n' + buildPrompt(sajuData));
    return JSON.parse(r.response.text());
}
function buildPrompt(d) {
    const p = d.pillars || [];
    let s = `${d.input?.name || '미상'}, ${d.input?.gender === 'male' ? '남' : '여'}\n사주: `;
    p.forEach((x, i) => { if (x.available !== false)
        s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
    if (d.elements)
        s += `\n오행: 목${d.elements.목}화${d.elements.화}토${d.elements.토}금${d.elements.금}수${d.elements.수}`;
    const cd = d.daeun?.find((x) => x.isCurrent || x.현재);
    if (cd)
        s += `\n현재 대운: ${cd.간지}`;
    return s;
}
//# sourceMappingURL=claudeMonthly.js.map