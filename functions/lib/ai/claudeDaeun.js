"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDaeunAnalysis = generateDaeunAnalysis;
const generative_ai_1 = require("@google/generative-ai");
const parseJson_1 = require("./parseJson");
const SYSTEM_PROMPT = `당신은 40년 경력의 사주명리학 대가이며, 대운(大運) 분석 전문가입니다. 적천수, 자평진전 등 정통 명리학 원전에 기반합니다.

각 대운 기간의 첫 1~2문장에서 그 시기에 실제로 겪었거나 겪을 법한 구체적 상황을 묘사하세요.
구체적 행동 묘사, 모호함 금지, 부정적 해석에 반드시 보완법, 존댓말.

반드시 JSON만 출력하세요. \`\`\`json 코드블록을 사용하지 마세요. {로 바로 시작하세요.
출력 형식:
{"overview":"전체 흐름 200자","periods":[{"간지":"甲子","시작나이":1,"끝나이":10,"isCurrent":false,"theme":"한줄 테마","score":75,"detail":"이 시기의 특징 150자","advice":"핵심 조언 50자"}],"currentHighlight":"현재 대운 상세 설명 300자","transitionAdvice":"전환기 조언 100자","lifePhaseMap":[{"phase":"청소년기","daeun":"甲子","theme":"학업과 성장"}]}`;
async function generateDaeunAnalysis(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro', generationConfig: { maxOutputTokens: 8192 } });
    const userPrompt = buildDaeunPrompt(sajuData);
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
function buildDaeunPrompt(sajuData) {
    const p = sajuData.pillars || [];
    let prompt = `## 기본 정보\n- 이름: ${sajuData.input?.name || '미상'}\n- 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n`;
    prompt += `\n## 사주 원국\n`;
    const labels = ['년주', '월주', '일주', '시주'];
    p.forEach((pillar, i) => {
        if (pillar.available !== false)
            prompt += `${labels[i]}: ${pillar.천간}${pillar.지지}\n`;
    });
    if (sajuData.elements) {
        prompt += `\n## 오행 분포\n`;
        Object.entries(sajuData.elements).forEach(([k, v]) => { prompt += `${k}: ${v}\n`; });
    }
    if (sajuData.daeun?.length) {
        prompt += `\n## 대운 목록\n`;
        sajuData.daeun.forEach((d) => {
            prompt += `${d.간지} (${d.시작나이 || ''}~${d.끝나이 || ''}세)${d.isCurrent || d.현재 ? ' ⭐현재' : ''}\n`;
        });
    }
    prompt += `\n위 사주의 대운 전체 흐름을 분석해주세요.`;
    return prompt;
}
//# sourceMappingURL=claudeDaeun.js.map