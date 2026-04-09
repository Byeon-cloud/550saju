"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCompatibilityAnalysis = generateCompatibilityAnalysis;
const generative_ai_1 = require("@google/generative-ai");
const parseJson_1 = require("./parseJson");
const SYSTEM_PROMPT = `당신은 사주명리학 궁합(宮合) 분석 전문가입니다.
두 사람의 일간 관계, 오행 보완도, 십성 교차를 분석하세요. 구체적 묘사, 모호함 금지.

출력 (JSON만):
{"overallScore":78,"summary":"궁합 총평 200자","categories":[{"id":"personality","name":"성격 궁합","score":80,"description":"150자"},{"id":"values","name":"가치관","score":75,"description":"150자"},{"id":"communication","name":"소통","score":82,"description":"150자"},{"id":"emotion","name":"감정","score":70,"description":"150자"},{"id":"future","name":"미래","score":85,"description":"150자"}],"strengths":["잘 맞는 점1","2","3"],"challenges":["주의할 점1","2","3"],"advice":"종합 조언 150자","futureOutlook":"미래 전망 100자","ohengHarmony":{"person1Element":"목","person2Element":"화","relation":"상생","description":"오행 조화 100자"}}`;
async function generateCompatibilityAnalysis(apiKey, sajuData1, sajuData2, relation) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { maxOutputTokens: 8192 } });
    const userPrompt = buildCompatPrompt(sajuData1, sajuData2, relation);
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await model.generateContent(SYSTEM_PROMPT + '\n\n' + userPrompt);
            return (0, parseJson_1.safeParseJson)(result.response.text());
        }
        catch (retryErr) {
            if (attempt === 1)
                throw retryErr;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw new Error("재시도 실패");
}
function buildPersonBlock(label, sajuData) {
    const p = sajuData.pillars || [];
    let block = `\n### ${label}\n이름: ${sajuData.input?.name || '미상'}, 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n사주: `;
    const labels = ['년', '월', '일', '시'];
    p.forEach((pillar, i) => {
        if (pillar.available !== false)
            block += `${labels[i]}주:${pillar.천간}${pillar.지지} `;
    });
    if (sajuData.elements)
        block += `\n오행: 목${sajuData.elements.목} 화${sajuData.elements.화} 토${sajuData.elements.토} 금${sajuData.elements.금} 수${sajuData.elements.수}`;
    return block;
}
function buildCompatPrompt(sajuData1, sajuData2, relation) {
    return `## 관계: ${relation}${buildPersonBlock('사람 1', sajuData1)}${buildPersonBlock('사람 2', sajuData2)}\n\n두 사람의 궁합을 분석해주세요.`;
}
//# sourceMappingURL=claudeCompat.js.map