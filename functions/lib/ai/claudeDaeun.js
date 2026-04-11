"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDaeunAnalysis = generateDaeunAnalysis;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const parseJson_1 = require("./parseJson");
async function generateDaeunAnalysis(apiKey, sajuData) {
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
    let daeunList = '';
    d.daeun?.forEach((x) => { daeunList += `${x.간지}(${x.시작나이 || ''}~${x.끝나이 || ''})${x.isCurrent ? ' ★' : ''} `; });
    return `사주명리학 대운분석. ${d.input?.name || '미상'} ${d.input?.gender === 'male' ? '남' : '여'}
사주: ${saju}
오행: 목${el.목 || 0}화${el.화 || 0}토${el.토 || 0}금${el.금 || 0}수${el.수 || 0}
대운: ${daeunList}
JSON만 출력. 소름돋게 구체적으로:
{"overview":"전체흐름80자","periods":[{"간지":"","age":"1~10세","theme":"8자","score":75,"detail":"각60자구체적","advice":"25자"}],"currentHighlight":"현재대운120자소름포인트","transitionAdvice":"전환기50자","lifePhaseMap":[{"phase":"청소년기","daeun":"甲子","theme":"8자"}]}`;
}
//# sourceMappingURL=claudeDaeun.js.map