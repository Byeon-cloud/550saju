"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWeeklyFortuneAnalysis = generateWeeklyFortuneAnalysis;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const promptsV3_1 = require("./promptsV3");
const MODEL = 'claude-sonnet-4-6';
async function generateWeeklyFortuneAnalysis(apiKey, args) {
    const anthropic = new sdk_1.default({ apiKey });
    const system = promptsV3_1.WEEKLY_FORTUNE_SYSTEM_V3;
    const user = (0, promptsV3_1.WEEKLY_FORTUNE_USER_V3)(args);
    // 1차 생성 (파싱 실패 시 temperature 0.5 로 1회 재시도)
    let firstText;
    let firstJson;
    try {
        const meta1 = { repairUsed: false };
        const first = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 16384,
            temperature: 0.7,
            system,
            messages: [{ role: 'user', content: user }],
        });
        firstText = first.content[0].text;
        firstJson = (0, promptsV3_1.parseJsonResponse)(firstText, meta1);
        if (meta1.repairUsed)
            console.info('[claudeWeekly] 1차 jsonrepair 발동');
    }
    catch (e1) {
        console.warn('[claudeWeekly] 1차 실패 → 재시도:', e1?.message);
        const meta2 = { repairUsed: false };
        const retry = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 16384,
            temperature: 0.5,
            system,
            messages: [{ role: 'user', content: user }],
        });
        firstText = retry.content[0].text;
        firstJson = (0, promptsV3_1.parseJsonResponse)(firstText, meta2);
        console.info('[claudeWeekly] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
    }
    // 2차 자기 리뷰
    const review = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 16384,
        system,
        messages: [
            { role: 'user', content: user },
            { role: 'assistant', content: firstText },
            {
                role: 'user',
                content: (0, promptsV3_1.SELF_REVIEW_V3)({ original: firstJson, kind: 'weekly' }),
            },
        ],
    });
    const reviewText = review.content[0].text;
    try {
        return (0, promptsV3_1.parseJsonResponse)(reviewText);
    }
    catch {
        return firstJson;
    }
}
//# sourceMappingURL=claudeWeekly.js.map