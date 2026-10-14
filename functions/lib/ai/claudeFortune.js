"use strict";
// Migrated from geminiFortune.ts on 2026-04-19 (Sonnet 4.6 v3).
// See commit 926ead2 + docs/prd/AI프롬프트_v3_Sonnet4.6.md
// v4.2 (2026-04-19): jsonrepair + retry-once (prod Daily JSON malformation 대응)
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDailyFortuneAnalysis = generateDailyFortuneAnalysis;
const promptsV3_1 = require("./promptsV3");
const claudeClient_1 = require("../shared/claudeClient");
const promptsV3_2 = require("./promptsV3");
const sajuFacts_1 = require("./sajuFacts");
const aiUsageLog_1 = require("../shared/aiUsageLog");
const MODEL = claudeClient_1.CLAUDE_MODEL.sonnet;
async function generateDailyFortuneAnalysis(apiKey, args) {
    const anthropic = (0, claudeClient_1.createClaude)(apiKey);
    const system = promptsV3_2.DAILY_FORTUNE_SYSTEM_V3;
    const user = (0, promptsV3_2.DAILY_FORTUNE_USER_V3)(args);
    // 1차 호출
    const meta1 = { repairUsed: false };
    try {
        const _t1 = Date.now(); // C7
        const msg = await anthropic.messages.create({
            model: MODEL,
            // 2026-10-03 5000→8000 — 운영 실측: callable 폴백 21/21 건이 5000 에서 잘림(stop_reason=max_tokens).
            //   index.ts 스트림 Sonnet 폴백(8000)과 일치. 과금은 실제 출력 토큰만 → 원가 변화는 잘리던 건에서만.
            max_tokens: 8000,
            system,
            messages: [{ role: 'user', content: user + promptsV3_1.TONE_FINAL_CHECK }],
        });
        (0, aiUsageLog_1.logAnthropicUsage)('daily', MODEL, msg, _t1, 'callable'); // C7 best-effort (truncated·cache 포함)
        const text = msg.content[0].text;
        const result = (0, promptsV3_2.parseJsonResponse)(text, meta1);
        if (meta1.repairUsed)
            console.info('[claudeFortune] jsonrepair 1차 발동 — 복구 성공');
        return (0, sajuFacts_1.sanitizeAiOutput)((0, sajuFacts_1.applyDailyMeetGlyphs)(result, args.sajuData)); // 2026-10-04 확정 글자 + 출력 정리
    }
    catch (e1) {
        console.warn('[claudeFortune] 1차 실패 → 재시도:', e1?.message);
        // 2차 호출 — 같은 요청으로 1회 재생성
        const meta2 = { repairUsed: false };
        const _t2 = Date.now(); // C7
        const msg = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 8000, // 2026-10-03 5000→8000 (위 1차 호출 주석 참조)
            system,
            messages: [{ role: 'user', content: user + promptsV3_1.TONE_FINAL_CHECK }],
        });
        (0, aiUsageLog_1.logAnthropicUsage)('daily', MODEL, msg, _t2, 'callable'); // C7 best-effort (truncated·cache 포함)
        const text = msg.content[0].text;
        const result = (0, promptsV3_2.parseJsonResponse)(text, meta2);
        console.info('[claudeFortune] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
        return (0, sajuFacts_1.sanitizeAiOutput)((0, sajuFacts_1.applyDailyMeetGlyphs)(result, args.sajuData));
    }
}
//# sourceMappingURL=claudeFortune.js.map