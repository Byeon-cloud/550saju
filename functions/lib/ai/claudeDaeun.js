"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDaeunAnalysis = generateDaeunAnalysis;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        overview: { type: generative_ai_1.SchemaType.STRING, description: '전체 대운 흐름 요약' },
        periods: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    간지: { type: generative_ai_1.SchemaType.STRING }, age: { type: generative_ai_1.SchemaType.STRING },
                    theme: { type: generative_ai_1.SchemaType.STRING }, score: { type: generative_ai_1.SchemaType.NUMBER },
                    detail: { type: generative_ai_1.SchemaType.STRING }, advice: { type: generative_ai_1.SchemaType.STRING },
                } } },
        currentHighlight: { type: generative_ai_1.SchemaType.STRING, description: '현재 대운 심층 분석' },
        transitionAdvice: { type: generative_ai_1.SchemaType.STRING },
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
    d.daeun?.forEach((x) => { daeunList += `${x.간지}(${x.시작나이 || ''}~${x.끝나이 || ''})${x.isCurrent ? ' ★현재' : ''} `; });
    return `사주명리학 40년 대가로서 대운(大運) 분석. 소름포인트 필수 — "어떻게 알았지?" 수준으로 구체적 행동 패턴 묘사.

예시 소름포인트:
- "20대 초반에 갑자기 환경을 바꾸고 싶었던 적이 있으시죠? 그때가 바로 대운 전환기였어요"
- "이 시기에 어떤 분야든 '내가 최고'라는 자신감이 차올랐을 거예요"

${d.input?.name || '미상'} ${d.input?.gender === 'male' ? '남' : '여'}
사주: ${saju}
오행: 목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0}
대운: ${daeunList}

구체적이고 소름돋게 분석해주세요.`;
}
//# sourceMappingURL=claudeDaeun.js.map