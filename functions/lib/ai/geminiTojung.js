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
                    month: { type: generative_ai_1.SchemaType.NUMBER }, 괘: { type: generative_ai_1.SchemaType.STRING },
                    괘의미: { type: generative_ai_1.SchemaType.STRING }, 전통해석: { type: generative_ai_1.SchemaType.STRING },
                    현대해석: { type: generative_ai_1.SchemaType.STRING }, score: { type: generative_ai_1.SchemaType.NUMBER },
                    keyword: { type: generative_ai_1.SchemaType.STRING },
                } } },
        luckyAdvice: { type: generative_ai_1.SchemaType.STRING },
    },
};
async function generateTojungBigyeol(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 8192 },
    });
    const prompt = buildPrompt(sajuData);
    const r = await model.generateContent('토정비결 전문가로서 2026년 토정비결을 작성. 주역 64괘 활용. 전통해석은 고풍 문체, 현대해석은 해요체. 6대운 각 60자, 12개월 각 현대해석 50자.\n\n' + prompt);
    return JSON.parse(r.response.text());
}
function buildPrompt(d) {
    const p = d.pillars || [];
    let s = `${d.input?.name || '미상'}, ${d.input?.gender === 'male' ? '남' : '여'}, ${d.input?.birthYear}년생\n사주: `;
    p.forEach((x, i) => { if (x.available !== false)
        s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
    if (d.elements)
        s += `\n오행: 목${d.elements.목}화${d.elements.화}토${d.elements.토}금${d.elements.금}수${d.elements.수}`;
    if (d.띠)
        s += `\n띠: ${d.띠}`;
    return s;
}
//# sourceMappingURL=geminiTojung.js.map