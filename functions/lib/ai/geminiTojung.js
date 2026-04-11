"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTojungBigyeol = generateTojungBigyeol;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        yearOverview: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                총운: { type: generative_ai_1.SchemaType.STRING }, 금전운: { type: generative_ai_1.SchemaType.STRING },
                건강운: { type: generative_ai_1.SchemaType.STRING }, 직장운: { type: generative_ai_1.SchemaType.STRING },
                애정운: { type: generative_ai_1.SchemaType.STRING }, 결혼운: { type: generative_ai_1.SchemaType.STRING },
            } },
        months: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    month: { type: generative_ai_1.SchemaType.NUMBER }, score: { type: generative_ai_1.SchemaType.NUMBER },
                    keyword: { type: generative_ai_1.SchemaType.STRING }, interpretation: { type: generative_ai_1.SchemaType.STRING },
                } } },
        luckyAdvice: { type: generative_ai_1.SchemaType.STRING },
    },
};
async function generateTojungBigyeol(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 },
        thinkingConfig: { thinkingBudget: 0 },
    });
    const now = new Date().getMonth() + 1;
    const r = await model.generateContent(`토정비결2026. ${now}월~12월. ` + buildPrompt(sajuData));
    return JSON.parse(r.response.text());
}
function buildPrompt(d) {
    const p = d.pillars || [];
    let saju = '';
    p.forEach((x, i) => { if (x.available !== false)
        saju += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
    const el = d.elements || {};
    return `${d.input?.name || ''} ${d.input?.gender === 'male' ? '남' : '여'} ${d.input?.birthYear}년생 사주:${saju} 오행:목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0}${d.띠 ? ' 띠:' + d.띠 : ''} 소름돋게.`;
}
//# sourceMappingURL=geminiTojung.js.map