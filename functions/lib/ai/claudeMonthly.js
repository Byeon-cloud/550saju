"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyFortune = generateMonthlyFortune;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const parseJson_1 = require("./parseJson");
async function generateMonthlyFortune(apiKey, sajuData) {
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
    const cd = d.daeun?.find((x) => x.isCurrent || x.현재);
    return `사주명리학 2026월별운세. ${d.input?.name || '미상'} ${d.input?.gender === 'male' ? '남' : '여'}
사주: ${saju}
오행: 목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0}
${cd ? '현재대운: ' + cd.간지 : ''}
현재 ${new Date().getMonth() + 1}월. ${new Date().getMonth() + 1}월~12월만 분석(지난달 제외). JSON만:
{"yearOverview":"80자","bestMonth":3,"worstMonth":8,"months":[{"month":${new Date().getMonth() + 1},"score":75,"theme":"10자","advice":"40자소름포인트"}]}`;
}
//# sourceMappingURL=claudeMonthly.js.map