"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSajuReport = generateSajuReport;
const generative_ai_1 = require("@google/generative-ai");
const sectionSchema = { type: generative_ai_1.SchemaType.OBJECT, properties: {
        id: { type: generative_ai_1.SchemaType.STRING }, title: { type: generative_ai_1.SchemaType.STRING }, content: { type: generative_ai_1.SchemaType.STRING },
    } };
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        sections: { type: generative_ai_1.SchemaType.ARRAY, items: sectionSchema },
        scores: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                career: { type: generative_ai_1.SchemaType.NUMBER }, love: { type: generative_ai_1.SchemaType.NUMBER }, wealth: { type: generative_ai_1.SchemaType.NUMBER },
                social: { type: generative_ai_1.SchemaType.NUMBER }, health: { type: generative_ai_1.SchemaType.NUMBER }, potential: { type: generative_ai_1.SchemaType.NUMBER },
            } },
        luckyProfile: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                colors: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
                colorNames: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
                numbers: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.NUMBER } },
                direction: { type: generative_ai_1.SchemaType.STRING }, day: { type: generative_ai_1.SchemaType.STRING },
                foods: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
                element: { type: generative_ai_1.SchemaType.STRING },
            } },
        careerFit: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    job: { type: generative_ai_1.SchemaType.STRING }, score: { type: generative_ai_1.SchemaType.NUMBER },
                } } },
        monthlyFortune: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    month: { type: generative_ai_1.SchemaType.NUMBER }, score: { type: generative_ai_1.SchemaType.NUMBER },
                } } },
        relationshipMap: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                work: { type: generative_ai_1.SchemaType.OBJECT, properties: { score: { type: generative_ai_1.SchemaType.NUMBER }, keyword: { type: generative_ai_1.SchemaType.STRING } } },
                friend: { type: generative_ai_1.SchemaType.OBJECT, properties: { score: { type: generative_ai_1.SchemaType.NUMBER }, keyword: { type: generative_ai_1.SchemaType.STRING } } },
                lover: { type: generative_ai_1.SchemaType.OBJECT, properties: { score: { type: generative_ai_1.SchemaType.NUMBER }, keyword: { type: generative_ai_1.SchemaType.STRING } } },
            } },
        wealthFlow: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                earning: { type: generative_ai_1.SchemaType.OBJECT, properties: { score: { type: generative_ai_1.SchemaType.NUMBER }, style: { type: generative_ai_1.SchemaType.STRING } } },
                spending: { type: generative_ai_1.SchemaType.OBJECT, properties: { score: { type: generative_ai_1.SchemaType.NUMBER }, style: { type: generative_ai_1.SchemaType.STRING } } },
                saving: { type: generative_ai_1.SchemaType.OBJECT, properties: { score: { type: generative_ai_1.SchemaType.NUMBER }, style: { type: generative_ai_1.SchemaType.STRING } } },
            } },
    },
};
async function generateSajuReport(apiKey, sajuData, situation, _reportType) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema },
    });
    const userPrompt = buildUserPrompt(sajuData, situation);
    const systemMsg = `사주명리학 40년 경력 대가로서 12섹션 분석. 소름 포인트: 각 섹션 첫 2문장에서 "어떻게 알았지?" 할 정도로 구체적 행동 패턴 묘사. 섹션 ID: summary, personality, social, career, wealth, love, health, year2026, daeun, mission, luck, luckyProfile. 각 섹션 content 200자 이상. careerFit 5개, monthlyFortune 12개월.`;
    const r = await model.generateContent(systemMsg + '\n\n' + userPrompt);
    const parsed = JSON.parse(r.response.text());
    return {
        content: {
            ...parsed,
            summary: parsed.sections?.[0]?.content?.slice(0, 100) + '...',
        },
    };
}
function buildUserPrompt(sajuData, situation) {
    const p = sajuData.pillars || [];
    let prompt = `생년월일: ${sajuData.input?.birthYear}/${sajuData.input?.birthMonth}/${sajuData.input?.birthDay}, 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n사주: `;
    p.forEach((x, i) => { if (x.available !== false)
        prompt += `${'년월일시'[i]}:${x.천간}(${x.천간읽기})${x.지지}(${x.지지읽기}) `; });
    if (sajuData.sipsung?.length) {
        prompt += '\n십성: ';
        sajuData.sipsung.forEach((s) => { prompt += `${s.위치}:${s.글자}(${s.십성}) `; });
    }
    if (sajuData.elements)
        prompt += `\n오행: 목${sajuData.elements.목} 화${sajuData.elements.화} 토${sajuData.elements.토} 금${sajuData.elements.금} 수${sajuData.elements.수}`;
    const cd = sajuData.daeun?.find((d) => d.현재 || d.isCurrent);
    if (cd)
        prompt += `\n현재 대운: ${cd.간지}`;
    if (situation?.concern)
        prompt += `\n고민: ${situation.concern}`;
    return prompt;
}
//# sourceMappingURL=claudeReport.js.map