"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTojungBigyeol = generateTojungBigyeol;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const parseJson_1 = require("./parseJson");
async function generateTojungBigyeol(apiKey, sajuData) {
    const client = new sdk_1.default({ apiKey });
    const r = await client.messages.create({
        model: 'claude-4-sonnet-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(sajuData) }],
    });
    return (0, parseJson_1.safeParseJson)(r.content[0].text);
}
function buildPrompt(d) {
    const p = d.pillars || [];
    let saju = '';
    p.forEach((x, i) => { if (x.available !== false)
        saju += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
    const el = d.elements || {};
    return `토정비결 전문가. 2026년 토정비결. ${d.input?.name || '미상'} ${d.input?.gender === 'male' ? '남' : '여'} ${d.input?.birthYear}년생
사주: ${saju}
오행: 목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0}
${d.띠 ? '띠: ' + d.띠 : ''}
주역 64괘 기반 토정비결. JSON만:
{"yearOverview":{"총운":"100자","금전운":"60자","건강운":"60자","직장운":"60자","애정운":"60자","결혼운":"60자"},"months":[{"month":1,"괘":"수풍정(水風井)","괘의미":"15자","전통해석":"고풍문체30자","현대해석":"해요체80자소름포인트","score":75,"keyword":"만남"}],"luckyAdvice":"80자"}`;
}
//# sourceMappingURL=geminiTojung.js.map