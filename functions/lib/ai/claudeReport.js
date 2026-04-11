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
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 }, thinkingConfig: { thinkingBudget: 0 },
    });
    const r = await model.generateContent(buildUserPrompt(sajuData, situation));
    const parsed = JSON.parse(r.response.text());
    return { content: { ...parsed, summary: parsed.sections?.[0]?.content?.slice(0, 100) + '...' } };
}
function buildUserPrompt(sajuData, situation) {
    const p = sajuData.pillars || [];
    let prompt = `사주명리학 40년 대가. 12섹션 심층분석. 소름포인트 필수 — 각 섹션 첫 2문장에서 "어떻게 알았지?" 수준의 구체적 행동 패턴 묘사.

예시 소름포인트:
- "혼자 있는 시간을 좋아하면서도, 막상 혼자 있으면 불안해지는 타입이시죠?"
- "결정을 내릴 때 머리로는 이미 답을 알고 있는데, 마음이 따라주지 않는 경험이 많으셨을 거예요"

섹션ID: summary, personality, social, career, wealth, love, health, year2026, daeun, mission, luck, luckyProfile
각 섹션 content 150자 이상. careerFit 5개, monthlyFortune 12개월.

${sajuData.input?.birthYear}/${sajuData.input?.birthMonth}/${sajuData.input?.birthDay} ${sajuData.input?.gender === 'male' ? '남' : '여'}\n사주: `;
    p.forEach((x, i) => { if (x.available !== false)
        prompt += `${'년월일시'[i]}:${x.천간}(${x.천간읽기})${x.지지}(${x.지지읽기}) `; });
    if (sajuData.sipsung?.length) {
        prompt += '\n십성: ';
        sajuData.sipsung.forEach((s) => { prompt += `${s.위치}:${s.글자}(${s.십성}) `; });
    }
    const el = sajuData.elements || {};
    prompt += `\n오행: 목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0}`;
    const cd = sajuData.daeun?.find((d) => d.현재 || d.isCurrent);
    if (cd)
        prompt += `\n현재대운: ${cd.간지}`;
    if (situation?.concern)
        prompt += `\n고민: ${situation.concern}`;
    return prompt;
}
//# sourceMappingURL=claudeReport.js.map