"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCompatibilityAnalysis = generateCompatibilityAnalysis;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        overallScore: { type: generative_ai_1.SchemaType.NUMBER },
        summary: { type: generative_ai_1.SchemaType.STRING, description: '궁합 총평 150~300자' },
        categories: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    id: { type: generative_ai_1.SchemaType.STRING }, name: { type: generative_ai_1.SchemaType.STRING },
                    score: { type: generative_ai_1.SchemaType.NUMBER }, description: { type: generative_ai_1.SchemaType.STRING, description: '100~200자' },
                } } },
        strengths: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
        challenges: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
        advice: { type: generative_ai_1.SchemaType.STRING, description: '종합 조언 100~200자' },
        futureOutlook: { type: generative_ai_1.SchemaType.STRING, description: '미래 전망 80~150자' },
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
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 },
    });
    const prompt = buildPrompt(sajuData1, sajuData2, relation);
    const r = await model.generateContent('사주명리학 궁합 분석 전문가로서 두 사람의 궁합을 분석해주세요. 카테고리는 personality(성격), values(가치관), communication(소통), emotion(감정), future(미래) 5개.\n\n' + prompt);
    return JSON.parse(r.response.text());
}
function person(label, d) {
    const p = d.pillars || [];
    let s = `\n${label}: ${d.input?.name || '미상'} (${d.input?.gender === 'male' ? '남' : '여'})\n사주: `;
    p.forEach((x, i) => { if (x.available !== false)
        s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
    if (d.elements)
        s += `\n오행: 목${d.elements.목}화${d.elements.화}토${d.elements.토}금${d.elements.금}수${d.elements.수}`;
    return s;
}
function buildPrompt(d1, d2, rel) {
    return `관계: ${rel}${person('사람1', d1)}${person('사람2', d2)}`;
}
//# sourceMappingURL=claudeCompat.js.map