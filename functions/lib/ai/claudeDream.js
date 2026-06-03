"use strict";
// Migrated from geminiDream.ts on 2026-04-19 (Sonnet 4.6 v3).
// See commit 926ead2 + docs/prd/AI프롬프트_v3_Sonnet4.6.md
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDreamFreeGroupCall = buildDreamFreeGroupCall;
exports.buildDreamFreeCall = buildDreamFreeCall;
exports.generateDreamFree = generateDreamFree;
exports.generateDreamDeep = generateDreamDeep;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const promptsV3_1 = require("./promptsV3");
const MODEL = 'claude-sonnet-4-6';
function buildDreamFreeGroupCall(args, group) {
    const system = promptsV3_1.DREAM_FREE_SYSTEM_V3;
    if (!args.saju) {
        // 사주 없으면 단일 callable fallback 사용 (Group B 없음)
        const user = (0, promptsV3_1.DREAM_FREE_USER_NO_SAJU_V3)({
            dreamContent: args.dreamContent,
            userConcern: args.userConcern,
            category: args.category,
        });
        return { system, user, model: MODEL, maxTokens: 14000 };
    }
    const headerData = {
        name: args.saju.name,
        yearGanzi: args.saju.yearGanzi,
        monthGanzi: args.saju.monthGanzi,
        dayGanzi: args.saju.dayGanzi,
        timeGanzi: args.saju.timeGanzi,
        ilgan: args.saju.ilgan,
        ilganOheng: args.saju.ilganOheng,
        ohengDistribution: args.saju.ohengDistribution,
        yongsin: args.saju.yongsin,
        currentDaeun: args.saju.currentDaeun,
        dreamContent: args.dreamContent,
        userConcern: args.userConcern,
        category: args.category,
    };
    const user = group === 'A'
        ? (0, promptsV3_1.DREAM_FREE_USER_GROUP_A_V3)(headerData)
        : (0, promptsV3_1.DREAM_FREE_USER_GROUP_B_V3)(headerData);
    // 그룹별 토큰 분할 (2026-05-27 v10 — 안전 복원):
    //   v9 의 5500/5000 은 AI 가 JSON 못 끝내고 잘림 → 파싱 실패 → callable 폴백 → 1분 대기 회귀.
    //   A=7500 (무료 4섹션 + 충분한 안전 마진) · B=7000 (잠금 5섹션 + 안전 마진).
    //   문의 길이는 prompt 의 글자수 제한으로 잡고, maxTokens 는 safety net 으로.
    const maxTokens = group === 'A' ? 7500 : 7000;
    return { system, user, model: MODEL, maxTokens };
}
/**
 * 무료 꿈해몽 호출 파라미터 빌드 (system·user·model·maxTokens).
 * 스트리밍 SSE(generateDreamFreeStream)와 callable 이 동일 파라미터 공유 —
 * 프롬프트·모델·출력 100% 동일, 전송 방식만 다름 (콘텐츠 변경 위험 0).
 */
function buildDreamFreeCall(args) {
    const system = promptsV3_1.DREAM_FREE_SYSTEM_V3;
    const user = args.saju
        ? (0, promptsV3_1.DREAM_FREE_USER_WITH_SAJU_V3)({
            name: args.saju.name,
            yearGanzi: args.saju.yearGanzi,
            monthGanzi: args.saju.monthGanzi,
            dayGanzi: args.saju.dayGanzi,
            timeGanzi: args.saju.timeGanzi,
            ilgan: args.saju.ilgan,
            ilganOheng: args.saju.ilganOheng,
            ohengDistribution: args.saju.ohengDistribution,
            yongsin: args.saju.yongsin,
            currentDaeun: args.saju.currentDaeun,
            dreamContent: args.dreamContent,
            userConcern: args.userConcern,
            category: args.category,
        })
        : (0, promptsV3_1.DREAM_FREE_USER_NO_SAJU_V3)({
            dreamContent: args.dreamContent,
            userConcern: args.userConcern,
            category: args.category,
        });
    return { system, user, model: MODEL, maxTokens: 14000 };
}
/** 무료 꿈해몽 — 사주 있으면 withSaju, 없으면 noSaju */
async function generateDreamFree(apiKey, args) {
    const anthropic = new sdk_1.default({ apiKey });
    const { system, user } = buildDreamFreeCall(args);
    // ── 단일 호출 (작동 검증본 — 2그룹 분할은 무료 콘텐츠 누락 회귀로 롤백) ──
    // max_tokens 14000: 잠금 본문(lockedXxx.full)까지 무료 호출에서 전부 생성.
    // 블러잠금 SSOT — 결제 시 재호출 0, 블러만 제거. 느려도 콘텐츠 정확성 우선.
    const meta1 = { repairUsed: false };
    try {
        const msg = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 14000,
            temperature: 0.7,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: user }],
        });
        const text = msg.content[0].text;
        const result = (0, promptsV3_1.parseJsonResponse)(text, meta1);
        if (meta1.repairUsed)
            console.info('[claudeDreamFree] jsonrepair 1차 발동 — 복구 성공');
        return result;
    }
    catch (e1) {
        console.warn('[claudeDreamFree] 1차 실패 → temperature 0.5 로 재시도:', e1?.message);
        const meta2 = { repairUsed: false };
        const msg = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 14000,
            temperature: 0.5,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: user }],
        });
        const text = msg.content[0].text;
        const result = (0, promptsV3_1.parseJsonResponse)(text, meta2);
        console.info('[claudeDreamFree] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
        return result;
    }
}
/** 심층 꿈해몽 (유료 1운) — 1차 생성 후 2차 자기 리뷰 */
async function generateDreamDeep(apiKey, args) {
    const anthropic = new sdk_1.default({ apiKey });
    const system = promptsV3_1.DREAM_DEEP_SYSTEM_V3;
    const user = (0, promptsV3_1.DREAM_DEEP_USER_V3)({
        name: args.saju.name,
        sajuData: args.saju.fullSajuData ?? args.saju,
        dreamContent: args.dreamContent,
        category: args.category,
        freeResultSummary: args.freeResultSummary,
    });
    // 1차 생성 (파싱 실패 시 temperature 0.5 로 1회 재시도)
    let firstText;
    let firstJson;
    try {
        const meta1 = { repairUsed: false };
        const first = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 16384,
            temperature: 0.7,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: user }],
        });
        firstText = first.content[0].text;
        firstJson = (0, promptsV3_1.parseJsonResponse)(firstText, meta1);
        if (meta1.repairUsed)
            console.info('[claudeDreamDeep] 1차 jsonrepair 발동');
    }
    catch (e1) {
        console.warn('[claudeDreamDeep] 1차 실패 → 재시도:', e1?.message);
        const meta2 = { repairUsed: false };
        const retry = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 16384,
            temperature: 0.5,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: user }],
        });
        firstText = retry.content[0].text;
        firstJson = (0, promptsV3_1.parseJsonResponse)(firstText, meta2);
        console.info('[claudeDreamDeep] 2차 성공', meta2.repairUsed ? '(jsonrepair 발동)' : '');
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
                content: (0, promptsV3_1.SELF_REVIEW_V3)({
                    original: firstJson,
                    kind: 'dream-deep',
                    freeResult: args.freeResultSummary,
                }),
            },
        ],
    });
    const reviewText = review.content[0].text;
    try {
        return (0, promptsV3_1.parseJsonResponse)(reviewText);
    }
    catch {
        // 리뷰 파싱 실패 시 1차 결과 반환 (안전 fallback)
        return firstJson;
    }
}
//# sourceMappingURL=claudeDream.js.map