"use strict";
// Migrated from geminiFortune.ts on 2026-04-19 (Sonnet 4.6 v3).
// See commit 926ead2 + docs/prd/AI프롬프트_v3_Sonnet4.6.md
// v4.2 (2026-04-19): jsonrepair + retry-once (prod Daily JSON malformation 대응)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDailyFortuneAnalysis = generateDailyFortuneAnalysis;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const promptsV3_1 = require("./promptsV3");
const MODEL = 'claude-sonnet-4-6';
async function generateDailyFortuneAnalysis(apiKey, args) {
    const anthropic = new sdk_1.default({ apiKey });
    const system = promptsV3_1.DAILY_FORTUNE_SYSTEM_V3;
    const user = (0, promptsV3_1.DAILY_FORTUNE_USER_V3)(args);
    // 1차 호출
    const meta1 = { repairUsed: false };
    try {
        const msg = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 5000,
            temperature: 0.7,
            system,
            messages: [{ role: 'user', content: user }],
        });
        const text = msg.content[0].text;
        const result = (0, promptsV3_1.parseJsonResponse)(text, meta1);
        if (meta1.repairUsed)
            console.info('[claudeFortune] jsonrepair 1차 발동 — 복구 성공');
        return result;
    }
    catch (e1) {
        console.warn('[claudeFortune] 1차 실패 → temperature 0.5 로 재시도:', e1?.message);
        // 2차 호출 — temperature 만 낮춰 sampling 변동성 감소
        const meta2 = { repairUsed: false };
        const msg = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 5000,
            temperature: 0.5,
            system,
            messages: [{ role: 'user', content: user }],
        });
        const text = msg.content[0].text;
        const result = (0, promptsV3_1.parseJsonResponse)(text, meta2);
        console.info('[claudeFortune] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
        return result;
    }
}
//# sourceMappingURL=claudeFortune.js.map