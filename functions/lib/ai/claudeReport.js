"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSajuReport = generateSajuReport;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const parseJson_1 = require("./parseJson");
async function generateSajuReport(apiKey, sajuData, situation, _reportType) {
    const client = new sdk_1.default({ apiKey });
    const r = await client.messages.create({
        model: 'claude-4-sonnet-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildUserPrompt(sajuData, situation) }],
    });
    const parsed = (0, parseJson_1.safeParseJson)(r.content[0].text);
    return { content: { ...parsed, summary: parsed.sections?.[0]?.content?.slice(0, 100) + '...' } };
}
function buildUserPrompt(sajuData, situation) {
    const p = sajuData.pillars || [];
    let prompt = `사주명리학 대가. 12섹션 심층분석. 소름포인트필수. 각섹션 첫2문장에서 "어떻게알았지?"수준의 구체적행동묘사. JSON만출력.
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
    prompt += `\n\n{"sections":[{"id":"summary","title":"사주총평","content":"200자+"},{"id":"personality","title":"성격기질","content":""},{"id":"social","title":"대인관계","content":""},{"id":"career","title":"직업운","content":""},{"id":"wealth","title":"재물운","content":""},{"id":"love","title":"애정운","content":""},{"id":"health","title":"건강","content":""},{"id":"year2026","title":"2026운세","content":""},{"id":"daeun","title":"대운흐름","content":""},{"id":"mission","title":"핵심과제","content":""},{"id":"luck","title":"개운법","content":""},{"id":"luckyProfile","title":"럭키프로필","content":""}],"scores":{"career":0,"love":0,"wealth":0,"social":0,"health":0,"potential":0},"luckyProfile":{"colors":["#HEX"],"colorNames":["색"],"numbers":[1],"direction":"","day":"","foods":[""],"element":""},"careerFit":[{"job":"","score":80}],"monthlyFortune":[{"month":1,"score":75}],"relationshipMap":{"work":{"score":80,"keyword":""},"friend":{"score":80,"keyword":""},"lover":{"score":80,"keyword":""}},"wealthFlow":{"earning":{"score":80,"style":""},"spending":{"score":80,"style":""},"saving":{"score":80,"style":""}}}`;
    return prompt;
}
//# sourceMappingURL=claudeReport.js.map