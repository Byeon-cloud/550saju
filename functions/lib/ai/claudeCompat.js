"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCompatibilityAnalysis = generateCompatibilityAnalysis;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        overallScore: { type: generative_ai_1.SchemaType.NUMBER },
        summary: { type: generative_ai_1.SchemaType.STRING },
        categories: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    id: { type: generative_ai_1.SchemaType.STRING }, name: { type: generative_ai_1.SchemaType.STRING },
                    score: { type: generative_ai_1.SchemaType.NUMBER }, description: { type: generative_ai_1.SchemaType.STRING },
                } } },
        strengths: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
        challenges: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
        advice: { type: generative_ai_1.SchemaType.STRING },
        futureOutlook: { type: generative_ai_1.SchemaType.STRING },
        ohengHarmony: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                person1Element: { type: generative_ai_1.SchemaType.STRING }, person2Element: { type: generative_ai_1.SchemaType.STRING },
                relation: { type: generative_ai_1.SchemaType.STRING }, description: { type: generative_ai_1.SchemaType.STRING },
            } },
    },
};
async function generateCompatibilityAnalysis(apiKey, sajuData1, sajuData2, relation) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 16384 },
    });
    const r = await model.generateContent(buildPrompt(sajuData1, sajuData2, relation));
    return JSON.parse(r.response.text());
}
function person(label, d) {
    const p = d.pillars || [];
    let s = `${label}: ${d.input?.name || '미상'}(${d.input?.gender === 'male' ? '남' : '여'}) `;
    p.forEach((x, i) => { if (x.available !== false)
        s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
    const el = d.elements || {};
    s += `오행:목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0}`;
    return s;
}
function buildPrompt(d1, d2, rel) {
    return `사주궁합분석. 소름포인트 필수. 관계:${rel}
${person('사람1', d1)}
${person('사람2', d2)}

카테고리: personality(성격궁합), values(가치관), communication(소통), emotion(감정), future(미래) 5개.
예시 소름포인트: "한 사람이 결정을 미루면 다른 사람이 먼저 정리해주는 패턴이 있을 거예요"

구체적으로 분석해주세요.`;
}
//# sourceMappingURL=claudeCompat.js.map