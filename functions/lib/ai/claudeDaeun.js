"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDaeunAnalysis = generateDaeunAnalysis;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        overview: { type: generative_ai_1.SchemaType.STRING, description: '전체 대운 흐름 요약 100~200자' },
        periods: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    간지: { type: generative_ai_1.SchemaType.STRING }, 시작나이: { type: generative_ai_1.SchemaType.NUMBER }, 끝나이: { type: generative_ai_1.SchemaType.NUMBER },
                    isCurrent: { type: generative_ai_1.SchemaType.BOOLEAN }, theme: { type: generative_ai_1.SchemaType.STRING }, score: { type: generative_ai_1.SchemaType.NUMBER },
                    detail: { type: generative_ai_1.SchemaType.STRING, description: '이 시기 특징 80~150자' },
                    advice: { type: generative_ai_1.SchemaType.STRING, description: '핵심 조언 30~50자' },
                } } },
        currentHighlight: { type: generative_ai_1.SchemaType.STRING, description: '현재 대운 심층 150~300자' },
        transitionAdvice: { type: generative_ai_1.SchemaType.STRING, description: '전환기 조언 60~100자' },
        lifePhaseMap: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    phase: { type: generative_ai_1.SchemaType.STRING }, daeun: { type: generative_ai_1.SchemaType.STRING }, theme: { type: generative_ai_1.SchemaType.STRING },
                } } },
    },
};
async function generateDaeunAnalysis(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 },
    });
    const prompt = buildPrompt(sajuData);
    const r = await model.generateContent('사주명리학 대운 분석 전문가로서 구체적이고 소름돋는 분석을 해주세요.\n\n' + prompt);
    return JSON.parse(r.response.text());
}
function buildPrompt(d) {
    const p = d.pillars || [];
    let s = `${d.input?.name || '미상'}, ${d.input?.gender === 'male' ? '남' : '여'}\n사주: `;
    p.forEach((x, i) => { if (x.available !== false)
        s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
    if (d.elements)
        s += `\n오행: 목${d.elements.목}화${d.elements.화}토${d.elements.토}금${d.elements.금}수${d.elements.수}`;
    if (d.daeun?.length) {
        s += '\n대운: ';
        d.daeun.forEach((x) => { s += `${x.간지}(${x.시작나이 || ''}~${x.끝나이 || ''})${x.isCurrent ? ' ★' : ''} `; });
    }
    return s;
}
//# sourceMappingURL=claudeDaeun.js.map