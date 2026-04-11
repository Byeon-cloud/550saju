"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDaeunAnalysis = generateDaeunAnalysis;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        overview: { type: generative_ai_1.SchemaType.STRING },
        periods: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    간지: { type: generative_ai_1.SchemaType.STRING }, age: { type: generative_ai_1.SchemaType.STRING },
                    theme: { type: generative_ai_1.SchemaType.STRING }, score: { type: generative_ai_1.SchemaType.NUMBER },
                    detail: { type: generative_ai_1.SchemaType.STRING },
                } } },
        currentHighlight: { type: generative_ai_1.SchemaType.STRING },
        transitionAdvice: { type: generative_ai_1.SchemaType.STRING },
    },
};
async function generateDaeunAnalysis(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 },
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
    let daeunList = '';
    d.daeun?.forEach((x) => { daeunList += `${x.간지}(${x.시작나이 || ''}~${x.끝나이 || ''})${x.isCurrent ? ' ★' : ''} `; });
    return `대운분석. ${d.input?.name || ''} ${d.input?.gender === 'male' ? '남' : '여'} 사주:${saju} 오행:목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0} 대운:${daeunList} 소름돋게 구체적으로.`;
}
//# sourceMappingURL=claudeDaeun.js.map