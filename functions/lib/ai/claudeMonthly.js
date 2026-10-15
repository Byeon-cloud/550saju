"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyFortune = generateMonthlyFortune;
exports.generateMonthlyDraft = generateMonthlyDraft;
exports.generateMonthlyRefine = generateMonthlyRefine;
const claudeClient_1 = require("../shared/claudeClient");
const sajuFacts_1 = require("./sajuFacts");
const promptsV3_1 = require("./promptsV3"); // 2026-10-13 어조 마지막 점검 부착 (다른 콘텐츠와 통일)
const kstTime_1 = require("../utils/kstTime");
/** 2026-10-15 프롬프트 캐싱 — 2차 다듬기 호출이 1차 프롬프트를 그대로 다시 보내므로, 첫 사용자 메시지를
 *  캐시해 두 번째 호출이 5% 값으로 읽게 한다(Sonnet 5.5 캐시 읽기 0.05배). 내용은 그대로. 운영 기록상 월운과 주간은 캐시 0%였다. */
const cachedPrompt = (prompt) => [{ type: 'text', text: prompt + promptsV3_1.TONE_FINAL_CHECK, cache_control: { type: 'ephemeral' } }];
const aiUsageLog_1 = require("../shared/aiUsageLog"); // C7 원가 기록 (fire-and-forget)
/** 2026-10-13 — 다른 콘텐츠와 같은 복구 파서(코드블록 제거, 문자열 안 줄바꿈 이스케이프, jsonrepair). 실패 시 null */
const tryParse = (text) => { try {
    return (0, promptsV3_1.parseJsonResponse)(text);
}
catch {
    return null;
} };
/**
 * 월별 운세 (2026-07-01).
 *  - onGroup 없음(progressId 미전달·점진 OFF) → 🛡️ 기존 검증된 단일 콜(FULL) 그대로 = 회귀 위험 0.
 *  - onGroup 있음(점진 ON) → M1(흐름)/M2(분야) 2그룹 병렬 + 그룹 완성 시 onGroup 콜백.
 *    · M1 = keywords·headline·theme·periods (펼친 §01·02 — 먼저 도착, 가벼움)
 *    · M2 = wealth·love·career·health·luckyDays·cautionDays·gaewoon (접힌 §03~05 — 백그라운드)
 *  - 🛡️ 두 경로 모두 머지본을 그대로 반환(callable 머니 경로·저장·환불 무변경). 각 그룹 1차+2차 리뷰 유지.
 */
async function generateMonthlyFortune(apiKey, sajuData, monthInfo, onGroup) {
    const info = normalizeMonthInfo(monthInfo);
    if (!onGroup) {
        // 점진 미사용 — 기존 단일 콜 경로(검증됨). year/month 만 권위값 보정.
        const full = await generateMonthlyGroup(apiKey, sajuData, info, 'FULL');
        return enforceDayPicks({ ...(full || {}), year: info.year, month: info.month }, (0, sajuFacts_1.monthDayPicks)(info.year, info.month, sajuData));
    }
    const [m1, m2] = await Promise.all([
        generateMonthlyGroup(apiKey, sajuData, info, 'M1').then((r) => { try {
            onGroup('M1', r);
        }
        catch { /* noop */ } return r; }),
        generateMonthlyGroup(apiKey, sajuData, info, 'M2').then((r) => { try {
            onGroup('M2', r);
        }
        catch { /* noop */ } return r; }),
    ]);
    // year/month 는 서버 권위값으로 강제 (AI 가 임의로 바꿔도 보정)
    return enforceDayPicks({ ...(m1 || {}), ...(m2 || {}), year: info.year, month: info.month }, (0, sajuFacts_1.monthDayPicks)(info.year, info.month, sajuData));
}
/* 2026-10-15 품질 점검 — 좋은 날, 조심할 날의 근거를 모델이 지어냈다(11/22 庚子 를 '상관 기운의 날'로, 실제는 그달 가장 좋은 날).
 *   서버가 신년운세와 같은 일진 채점으로 고르고(monthDayPicks), 모델은 이유만 생활 말로 푼다. 표와 다른 날짜가 나오면 서버 값으로 덮어쓴다. */
function plainWhy(why) {
    return why
        .replace(/^\d+\/\d+\(.\),\s*/, '')
        .replace(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]\(([가-힣]{2})\)일/, '$1일')
        .replace(/용신\(([목화토금수])\)/g, '나에게 필요한 $1')
        .replace(/희신\(([목화토금수])\)/g, '도움이 되는 $1')
        .replace(/기신\(([목화토금수])\) 기운이 강한 날/g, '나와 맞지 않는 $1 기운이 강한 날')
        .replace(/천을귀인 날/g, '귀인의 도움이 닿는 날')
        .replace(/일지 .와 부딪히는 날/g, '태어난 날 글자와 부딪히는 날');
}
function enforceDayPicks(res, picks) {
    if (!res || typeof res !== 'object')
        return res;
    const norm = (x) => String(x || '').replace(/\s/g, '').replace(/\(.\)/g, '');
    const ok = (arr, allowed) => Array.isArray(arr) && arr.length > 0
        && arr.every((it) => norm(it?.date).split(/[~,]/).every((part) => allowed.has(part)));
    const r = res;
    if (picks.good.length && (r.luckyDays !== undefined || r.cautionDays !== undefined)) {
        if (!ok(r.luckyDays, new Set(picks.good.map((x) => x.date))))
            r.luckyDays = picks.good.map((x) => ({ date: x.date, reason: plainWhy(x.why) }));
        if (picks.caution.length && !ok(r.cautionDays, new Set(picks.caution.map((x) => x.date))))
            r.cautionDays = picks.caution.map((x) => ({ date: x.date, reason: plainWhy(x.why) }));
    }
    return res;
}
function dayPicksBlock(info, d) {
    const pk = (0, sajuFacts_1.monthDayPicks)(info.year, info.month, d);
    if (!pk.good.length && !pk.caution.length)
        return '';
    return `

## 이 달 좋은 날과 조심할 날 (서버 계산, 그날 일진과 이 사주의 용신, 기신, 일지 관계로 골랐다)
- 좋은 날: ${pk.good.map((x) => x.why).join(' / ') || '없음'}
- 조심할 날: ${pk.caution.map((x) => x.why).join(' / ') || '없음'}
→ luckyDays, cautionDays 의 date 는 위 날짜만, 하루씩(범위 금지) 쓴다. reason 은 위 이유를 생활 말로 풀고 그날 할 일이나 피할 일 하나를 붙인다. 다른 날짜와 다른 일진을 지어내지 않는다. 상순, 중순, 하순 본문에서 날짜를 말할 때도 이 표의 날짜만 쓴다.`;
}
/** 그룹 1개(M1/M2/FULL) — 1차 생성 + 2차 자기리뷰 → 파싱 */
async function generateMonthlyGroup(apiKey, sajuData, info, group) {
    const anthropic = (0, claudeClient_1.createClaude)(apiKey);
    const prompt = buildPrompt(sajuData, info, group);
    const maxTokens = group === 'FULL' ? 10000 : group === 'M1' ? 6000 : 7000;
    // ── 1차 생성 ──
    const _t1 = Date.now(); // C7
    const first = await anthropic.messages.create({
        model: claudeClient_1.CLAUDE_MODEL.sonnet,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: cachedPrompt(prompt) }],
    });
    (0, aiUsageLog_1.logAnthropicUsage)('monthly', claudeClient_1.CLAUDE_MODEL.sonnet, first, _t1, 'callable'); // C7 best-effort
    const firstText = first.content[0].text;
    // ── 2차 자기리뷰 (퀄리티 레버) ──
    const _t2 = Date.now(); // C7
    const review = await anthropic.messages.create({
        model: claudeClient_1.CLAUDE_MODEL.sonnet,
        max_tokens: maxTokens,
        messages: [
            { role: 'user', content: cachedPrompt(prompt) },
            { role: 'assistant', content: firstText },
            { role: 'user', content: buildReviewPrompt(info, group) + promptsV3_1.TONE_FINAL_CHECK },
        ],
    });
    (0, aiUsageLog_1.logAnthropicUsage)('monthly', claudeClient_1.CLAUDE_MODEL.sonnet, review, _t2, 'callable'); // C7 best-effort
    const reviewText = review.content[0].text;
    const parsed = tryParse(reviewText) ?? tryParse(firstText);
    if (!parsed)
        throw new Error(`월별 운세 ${group} JSON 파싱 실패`);
    return (0, sajuFacts_1.sanitizeAiOutput)(parsed);
}
/**
 * ⚡ async 2차리뷰 — draft (1차만). 로딩 반토막용: 1차 결과를 즉시 클라에 반환 → 유저 조기 열람.
 *  FULL 스키마로 1차 생성. 2차 리뷰는 별도 refine 콜(백그라운드)에서. 머지·year/month 보정 동일.
 */
async function generateMonthlyDraft(apiKey, sajuData, monthInfo) {
    const anthropic = (0, claudeClient_1.createClaude)(apiKey);
    const info = normalizeMonthInfo(monthInfo);
    const prompt = buildPrompt(sajuData, info, 'FULL');
    const _t1 = Date.now(); // C7
    const first = await anthropic.messages.create({
        model: claudeClient_1.CLAUDE_MODEL.sonnet,
        max_tokens: 10000,
        messages: [{ role: 'user', content: cachedPrompt(prompt) }],
    });
    (0, aiUsageLog_1.logAnthropicUsage)('monthly', claudeClient_1.CLAUDE_MODEL.sonnet, first, _t1, 'callable'); // C7 best-effort
    const firstText = first.content[0].text;
    const draft = tryParse(firstText);
    if (!draft)
        throw new Error('월별 운세 draft JSON 파싱 실패');
    draft.year = info.year;
    draft.month = info.month;
    return enforceDayPicks((0, sajuFacts_1.sanitizeAiOutput)(draft), (0, sajuFacts_1.monthDayPicks)(info.year, info.month, sajuData)); // 2026-10-11 — 초안 경로가 정리기를 안 거쳐 '씨', 줄표, 외래어가 그대로 나갔음
}
/**
 * ⚡ async 2차리뷰 — refine (2차만). draft 를 받아 자가 점검·보정 → 최종본.
 *  🛡️ best-effort: 리뷰 파싱 실패 시 draft 그대로 반환(유저는 이미 draft 를 봤으므로 무해).
 */
async function generateMonthlyRefine(apiKey, sajuData, monthInfo, draft) {
    const anthropic = (0, claudeClient_1.createClaude)(apiKey);
    const info = normalizeMonthInfo(monthInfo);
    const prompt = buildPrompt(sajuData, info, 'FULL');
    const _t2 = Date.now(); // C7
    const review = await anthropic.messages.create({
        model: claudeClient_1.CLAUDE_MODEL.sonnet,
        max_tokens: 10000,
        messages: [
            { role: 'user', content: cachedPrompt(prompt) },
            { role: 'assistant', content: JSON.stringify(draft) },
            { role: 'user', content: buildReviewPrompt(info, 'FULL') + promptsV3_1.TONE_FINAL_CHECK },
        ],
    });
    (0, aiUsageLog_1.logAnthropicUsage)('monthly', claudeClient_1.CLAUDE_MODEL.sonnet, review, _t2, 'callable'); // C7 best-effort
    const reviewText = review.content[0].text;
    const refined = tryParse(reviewText);
    const picks = (0, sajuFacts_1.monthDayPicks)(info.year, info.month, sajuData);
    if (!refined)
        return enforceDayPicks((0, sajuFacts_1.sanitizeAiOutput)({ ...draft, year: info.year, month: info.month }), picks); // 리뷰 실패 → draft 유지
    refined.year = info.year;
    refined.month = info.month;
    return enforceDayPicks((0, sajuFacts_1.sanitizeAiOutput)(refined), picks);
}
/** monthInfo 누락/불완전 시 폴백 — 이번 달 기준(간지 미상). 정상 경로는 항상 클라가 간지 동봉. */
function normalizeMonthInfo(monthInfo) {
    const now = (0, kstTime_1.kstNow)();
    const year = Number(monthInfo?.year) || now.year;
    const month = Number(monthInfo?.month) || now.month;
    return {
        year,
        month,
        label: monthInfo?.label || `${year}년 ${month}월`,
        wolGanji: monthInfo?.wolGanji || '미상',
        yearGanji: monthInfo?.yearGanji || '미상',
    };
}
function buildPrompt(d, info, group) {
    const p = d.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((x, i) => {
        if (x.available !== false)
            pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`;
    });
    const el = d.elements || {};
    const sipsung = d.sipsung?.map((s) => `${s.위치 || s.position || ''}: ${s.글자}(${s.십성})`).join(', ') || '';
    const ilgan = p[2]?.천간 || '미상';
    // 2026-06-26 — 대운 전체 흐름 명시(이전/현재/다음 간지+나이). 데이터 없이 추측 방지.
    const daeunList = Array.isArray(d.daeun) ? d.daeun : [];
    const curIdx = daeunList.findIndex((x) => x.isCurrent || x.현재);
    const daeunAge = (x) => (x?.시작나이 != null && x?.끝나이 != null) ? `${x.시작나이}~${x.끝나이}세` : (x?.나이범위 || '');
    const daeunFlow = daeunList.length > 0
        ? daeunList.map((x, i) => `- ${daeunAge(x)} ${x.간지}${i === curIdx ? ' ← 현재 대운' : ''}`).join('\n')
        : '미상';
    const prevDae = curIdx > 0 ? daeunList[curIdx - 1] : null;
    const nextDae = (curIdx >= 0 && curIdx < daeunList.length - 1) ? daeunList[curIdx + 1] : null;
    // 현재 시점 대비 선택월 시제 (과거/이번달/미래) + 이번달이면 오늘(일) 기준 '달 안' 시제 분리
    const now = (0, kstTime_1.kstNow)();
    const nowY = now.year;
    const nowM = now.month;
    const nowD = now.day; // 현재 일(1~31) — 이번달 선택 시 달 안 과거/현재/미래 분기 기준
    const selKey = info.year * 12 + info.month;
    const nowKey = nowY * 12 + nowM;
    const tense = selKey < nowKey ? '과거' : selKey === nowKey ? '이번달' : '미래';
    const tenseRule = tense === '과거'
        ? `${info.label}은 이미 완전히 지나간 달이다. 🚨🚨 모든 문장을 과거형 회고체로만 써라 — "~한 시기였습니다 / ~한 흐름이 흘렀어요 / ~했어야 좋았어요 / ~한 달이었습니다". theme, periods(상순, 중순, 하순), 4영역(재물/애정/직업/건강), 길일, 주의일, 개운 처방 전부 과거형. "~하세요 / ~할 거예요 / ~한 때입니다 / ~하면 좋아요" 같은 현재, 미래, 명령형 절대 금지(이미 지난 달엔 명령할 수 없다). 개운 처방도 "~했다면 좋았을 겁니다" 회고형으로.`
        : tense === '이번달'
            ? `${info.label}은 지금 흐르는 달이고, 🚨🚨 오늘은 ${info.month}월 ${nowD}일이다. 이 달 안에서도 오늘(${nowD}일)을 기준으로 시제를 정확히 갈라라:
  오늘(${nowD}일)보다 앞선 구간과 날짜 → 반드시 과거형("~였습니다 / ~한 흐름이 흘렀어요 / ~했어야 좋았어요")
  오늘(${nowD}일)이 포함된 구간 → 현재형("지금 ~ / 오늘부터 ~")
  오늘(${nowD}일) 이후 구간과 날짜 → 미래와 명령형("~하세요 / ~할 거예요 / ~한 시기가 됩니다")
  ⚠️ 구간 판정: 상순=1~10일, 중순=11~20일, 하순=21일~말일. 각 구간이 ${nowD}일보다 완전히 이전이면 과거형, ${nowD}일을 포함하면 현재형(단 그 구간 안 ${nowD}일 이전 얘기는 과거형), 완전히 이후면 미래형. luckyDays, cautionDays 도 각 날짜가 ${nowD}일보다 이전이면 과거형("~했던 날"), ${nowD}일 이후면 미래와 명령형("~할 날 / ~하세요").`
            : `${info.label}은 앞으로 올 미래의 달 → 전부 미래형("~할 거예요 / ~한 시기가 됩니다 / ~하세요")으로.`;
    // 그 달의 일수 (길일·주의일 날짜 범위 가이드)
    const daysInMonth = new Date(info.year, info.month, 0).getDate();
    // 🛡️ 점진 그룹별 출력 스키마 (2026-07-01) — 공유 톤/근거 규칙은 동일, OUTPUT 만 분리.
    //   FULL=단일 콜(점진 OFF·검증됨) / M1=흐름(keywords·headline·theme·periods) / M2=분야(4영역·길흉일·개운).
    const m1Fields = `"year": ${info.year},
  "month": ${info.month},
  "keywords": ["이달핵심키워드1","키워드2","키워드3"],
  "headline": "${info.label}을 한 줄로 (25자 이내, 일상어 결론 + 후크)",
  "theme": "180자 이상. 이 달의 핵심 테마. 🚨 왜 이런 달인지 — 월간지 ${info.wolGanji} × 일간 ${ilgan} 충/합 + 세운 ${info.yearGanji} 흐름 직접 호명 (보일러플레이트 금지).",
  "periods": [
    {"phase":"상순","dateRange":"${info.month}/1~${info.month}/10","score":1-100,"body":"120자 이상, 🚨 월간지 ${info.wolGanji} × 일간 ${ilgan} 작용 + 구체 행동"},
    {"phase":"중순","dateRange":"${info.month}/11~${info.month}/20","score":1-100,"body":"120자 이상, 🚨 사주 specific 호명 + 구체 행동"},
    {"phase":"하순","dateRange":"${info.month}/21~${info.month}/${daysInMonth}","score":1-100,"body":"120자 이상, 🚨 사주 specific 호명 + 구체 행동"}
  ]`;
    const m2Fields = `"wealth": {"score":1-100,"body":"80자 이상, 🚨 사주 재성/식상 또는 ${info.wolGanji} 직접 호명"},
  "love":   {"score":1-100,"body":"80자 이상, 🚨 사주 재성/관성/도화 또는 ${info.wolGanji} 직접 호명"},
  "career": {"score":1-100,"body":"80자 이상, 🚨 사주 관성/인성 또는 ${info.wolGanji} 직접 호명"},
  "health": {"score":1-100,"body":"80자 이상, 🚨 사주 오행 균형 또는 ${info.wolGanji} 직접 호명"},
  "luckyDays": [
    {"date":"${info.month}/D 또는 ${info.month}/D~${info.month}/D","reason":"왜 좋은 날인지 (그날 일진 흐름 + 행동)"}
  ],
  "cautionDays": [
    {"date":"${info.month}/D 또는 ${info.month}/D~${info.month}/D","reason":"왜 조심할 날인지 (그날 일진 흐름 + 회피 행동)"}
  ],
  "gaewoon": "120자 이상. 이 달 개운 처방 — 구체 행동(행운 색, 방위, 시간대, 습관) 명령형으로. 🚨 사주 용신/오행 보완 근거 1회."`;
    const fieldList = group === 'FULL'
        ? 'headline, theme, periods, wealth, love, career, health, gaewoon'
        : group === 'M1'
            ? 'keywords, headline, theme, periods'
            : 'wealth, love, career, health, luckyDays, cautionDays, gaewoon';
    const schemaBlock = group === 'FULL'
        ? `{\n  ${m1Fields},\n  ${m2Fields}\n}`
        : group === 'M1'
            ? `{\n  ${m1Fields}\n}`
            : `{\n  ${m2Fields}\n}`;
    const periodsRule = 'periods score';
    const domainsRule = '4영역 score';
    const scoreRule = group === 'FULL' ? 'periods, 4영역 score' : group === 'M1' ? periodsRule : domainsRule;
    const luckyRule = group === 'M1' ? '' : `⚠️ luckyDays, cautionDays 는 각각 2~3개. 모든 날짜는 ${info.month}월 1~${info.month}월 ${daysInMonth}일 범위 안. `;
    const tailRule = `${luckyRule}${scoreRule} 가 평평하지 않게 굴곡(5의 배수 반복 금지와 자연수). 마크다운 서식(**볼드** 등) 절대 금지 — 순수 한국어.`;
    return `당신은 사주500 명리학 해석가. ${promptsV3_1.MYEONGRI_GROUNDS_BLOCK}

${info.label} 한 달 심층 운세 — 사주 원국 일간과 그 달의 월간지와 세운간지 충/합에서 추출한 진짜 근거.

⚠️ 분석 대상: 오직 ${info.label} 한 달만 깊게. 다른 달과 연간 전체 흐름 X.
⚠️ 시제: ${tenseRule}
⚠️ 그 달은 ${info.month}월 1일~${info.month}월 ${daysInMonth}일까지. 길일, 주의일, 시기는 반드시 이 날짜 범위 안에서.

## 사주 원국
${pillarsText}일간: ${ilgan}

## 오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
${(0, sajuFacts_1.sajuCoreFactsText)(d)}${dayPicksBlock(info, d)}
${d.myeongriAnalysis?.용신 ? `## 용신 (SSOT, 서버 확정, 종합사주와 신년운세와 같은 값): 용신 ${d.myeongriAnalysis.용신}, 희신 ${d.myeongriAnalysis.희신 || '미상'}, 기신 ${d.myeongriAnalysis.기신 || '미상'}. 개운 처방과 행운 색, 방위는 이 용신으로만. 다른 오행을 용신이라고 쓰지 말 것.` : ''}

## 선택한 달의 간지 (정확 계산 — 이 간지를 그대로 인용, 절대 임의로 바꾸지 말 것)
- 월간지: ${info.wolGanji} (${info.label}의 월주)
- 세운간지(올해): ${info.yearGanji}

## 이 달 간지와 원국의 관계 (서버 확정. 합, 충, 형, 해는 아래에 있는 것만 사실이다)
${(0, sajuFacts_1.natalRelationsText)(info.wolGanji, d, '이 달')}
${(0, sajuFacts_1.natalRelationsText)(info.yearGanji, d, '올해 세운')}
${group !== 'M2' ? `
${(0, sajuFacts_1.lifeTimelineFactsText)(d, (0, kstTime_1.kstNowDate)())}
→ 짚기 자리 (2026-10-14): theme 첫머리에서 위 확정표의 최근 석 달로 '요즘 짚기'를 한 번 한다(언제부터 어느 영역이 마음 쓰였는지, 그 흐름이 이 달에 어떻게 이어지거나 풀리는지). 다른 필드에서는 다시 묻지 않는다.` : ''}
→ 위에 없는 합, 충, 형, 해를 지어내지 말 것. '부딪힌다'는 충이나 형으로 확정된 것에만, '묶인다'는 합으로 확정된 것에만 쓴다. (2026-10-13 卯戌합을 '부딪힘'으로 쓴 사례)

## 대운 흐름 (10년 단위, 나이는 한국식 세는나이 기준(태어난 해가 1세, 화면 표기와 같은 숫자). 나이를 다시 계산하지 말고 이 숫자를 그대로 쓸 것)
${daeunFlow}
${curIdx >= 0 ? `→ 이전 대운=${prevDae ? `${prevDae.간지}(${daeunAge(prevDae)})` : '없음'}, 현재 대운=${daeunList[curIdx].간지}(${daeunAge(daeunList[curIdx])}), 다음 대운=${nextDae ? `${nextDae.간지}(${daeunAge(nextDae)})` : '없음'}. 이 간지와 순서를 절대 바꾸지 말 것.` : ''}

## 이름: ${d.input?.name || '미상'}, 성별: ${d.input?.gender === 'male' ? '남' : '여'}

## 출력 (JSON만, 코드블록 없이)
⚠️ **점수 필드 룰 (2026-05-04 PD 결단)**: 모든 score (periods, wealth, love, career, health) 는 **5의 배수만 반복 금지**. 65, 70, 75, 80 같은 fake 신호 X. 67, 73, 81, 88 같이 자연수로. 같은 응답 안 점수가 모두 다른 값이어야 함.

🚨 **톤 룰 (2026-05-05 PD 결단 — 외계어 X, 일상어 O)**

사용자 피드백:
> '무슨 말인지 모르겠다. 한낮의 태양이다 / 형국이다 — 이게 뭔 뜻이냐.
>  사주는 알아듣기 편하게 말해줘서 돈 주고 보는 거지, 어렵고 모호한 표현이면 돈 안 낸다.'

❌ **절대 금지 패턴**:
1. 시적 비유 폭격: '한낮의 태양' '차가운 밤 호수' '~의 형국' — 비유가 풀이를 대체 X.
2. 문어체 단어 남발: '결' '자리' '형국' 한 문단 2회 이내.
3. 중의적과 모호한 표현: '흐름이 풀리는 자리' → '이 달 중순에 일이 잘 풀립니다'
4. 한자 폭격: 한자(丙火, 신금, 축미충 등) 첫 등장 1번만, 이후는 한글 또는 일상어.
5. **독자 = 사주를 1도 모르는 일반인.** 명리 용어(십성, 격국, 충, 합 등)를 문장의 주어/핵심으로 쓰지 말 것 — 주어는 항상 '쉬운 일상 결론'. 괄호 한자는 한 body/블록당 2개 이하(누적 금지). 누가 읽어도 한 번에 이해되는 짧고 단호한 문장으로.

📚 **"사주아이" 톤 레퍼 (참고, 모방 X, 우리 특색 살림)**:
1. **각 섹션 시작 = 일상어 결론 한 줄** (제목 후크 톤)
2. **사주 근거는 두 번째 문장부터, 한자는 1회만** + 즉시 일상어 풀이
3. **공감 + 위로 + 행동 처방** (가장 강력)
4. **마무리 = 응원 + 구체 행동** (행운 날짜, 방위, 시기 등 구체)

🚨 **한자 풀이 형식 강제 (2026-05-05 PD 결단 — '라는 뜻' 같은 회피 X)**:
한자 등장 시 괄호 안에 **실제 일상어 풀이 텍스트** 동반:
✅ '병화(丙火, 밝고 활달한 성격)' / '갑오월(甲午月, 추진력이 강하게 도는 달)' / '축미충(丑未沖, 가치관이 자주 흔들리는 때)'
✅ '정관(正官, 책임감과 규범을 중요시하는 성향)' / '도화살(桃花殺, 사람을 끌어당기는 매력)'
❌ '병화(丙火)' 단독 — 풀이 X
❌ '병화(丙火, 라는 뜻)' / '병화(丙火, 한자 그대로)' — 추상적 회피 X. 진짜 풀이 텍스트.
검증법: 한자 (괄호) 부분만 빼고 일상어만 읽었을 때 자연스러운 한국어 문장이 되어야 함.

🚨 **어조 규칙 (2026-06-24, 인플루언서 피드백 — 출력 본문 전체에 절대 준수)**
1. **애매와 면피 표현 전면 금지**: "~일 수 있습니다 / ~인 편입니다 / ~경향이 있습니다 / ~듯합니다 / ~것 같습니다 / ~수도 있습니다" 류 0건. 모든 문장을 확신 있는 단정형으로.
2. **단정형**: "이 달은 ~한 때입니다." "${info.month}월 중순엔 ~합니다."
3. **과거 적중(소름 훅) 1회**: "혹시 예전에 ~한 일이 있지 않았나요?" — 독자가 "어? 내 얘기네?" 하게.
4. **명령형 솔루션**: "이 달엔 ~는 피하고 ~를 선택하세요." (애매한 권유 X, 분명한 지시 O)
5. **루즈함 차단**: 같은 메시지를 앞, 중간, 끝에서 반복 금지. 각 단락은 새 정보.

✨ **우리만의 차별화**:
- 고전 이론은 판단 근거로만 — 본문에 책 이름, '고서에 따르면' 같은 출처 언급 0 (책 이름은 자동 삭제돼 문장이 깨짐, 출력은 일상어)
- 결정론 (같은 사주 + 같은 달 = 같은 결과)
- 한자 1회 등장 시 즉시 일상어 풀이 동반
- strong 강조는 유저 일상 결론에만
- 숫자와 날짜 또렷이 ('${info.month}월 중순' '${info.month}/15~${info.month}/20')

🚨 **보일러플레이트 절대 금지 (2026-05-05 audit, 회귀 금지)**

동적 작용해야 하는 콘텐츠 = 사주 8글자마다 매번 다른 문장.

❌ 'X한 달이 됩니다' / '재물운이 좋습니다' (근거 없는 일반론).
✅ 사주 글자 + 월간지(${info.wolGanji}), 세운간지(${info.yearGanji}) 충돌과 합 직접 호명 예: '${info.wolGanji}월이 일간 ${ilgan}과 만나 OO합니다', '${info.wolGanji}월이 일지와 부딪쳐 OO합니다' (OO 은 이 사주에서 실제로 생기는 일로 채운다).
✅ ${fieldList} 전부에 사주 8글자 specific 데이터(개수, 자리, 충형, 신살) 또는 월간지/세운간지를 1회 이상 직접 호명 mandatory.

🚨 **example 사용 룰 (회귀 금지)**:
프롬프트 예시의 사주 글자(병화, 신금, 축미충 등)는 example. 실제로는 위 ## 사주 원국 의 진짜 8글자 + 위 월간지(${info.wolGanji}), 세운간지(${info.yearGanji}) 를 인용.
'{유저명}' placeholder 도 위 ## 이름 의 진짜 이름으로 치환.
같은 사주 + 같은 달 = 같은 결과 (결정론) / 다른 사주 = 완전히 다른 어휘.

${schemaBlock}

${tailRule}${group !== 'M2' ? promptsV3_1.READING_VOICE_BLOCK : ''}`;
}
function buildReviewPrompt(info, group) {
    const daysInMonth = new Date(info.year, info.month, 0).getDate();
    // 🚨 시제 검사 (최우선) — 지난 달=과거형 / 이번 달=오늘 기준 분리 / 미래 달=미래형
    const now = (0, kstTime_1.kstNow)();
    const selKey = info.year * 12 + info.month;
    const nowKey = now.year * 12 + now.month;
    const tenseCheck = selKey < nowKey
        ? `🚨 시제(최우선): 이 달은 이미 지난 달이다. theme, periods, 4영역, 길흉일, 개운 모든 문장이 과거형 회고체("~였습니다/~흘렀어요/~했어야 좋았어요")인가? "~하세요/~할 거예요/~한 때입니다" 같은 현재, 미래, 명령형이 하나라도 있으면 전부 과거형으로 고쳐라.`
        : selKey === nowKey
            ? `🚨 시제(최우선): 오늘은 ${info.month}월 ${now.day}일이다. ${now.day}일보다 앞선 구간과 날짜(상순 1~10, 중순 11~20, 하순 21~말 중 해당분 + ${now.day}일 이전 길흉일)는 과거형("~였습니다"), ${now.day}일 이후는 미래와 명령형("~하세요")으로 정확히 갈렸는가? 안 맞으면 고쳐라.`
            : `🚨 시제(최우선): 이 달은 미래의 달이다. 모든 문장이 미래형("~할 거예요/~됩니다/~하세요")인가?`;
    const fullChecklist = `1. periods 가 정확히 3개(상순, 중순, 하순)이고 각 dateRange 가 ${info.month}월 날짜 범위(${info.month}/1 ~ ${info.month}/${daysInMonth}) 안인가?
2. theme, periods, wealth, love, career, health, gaewoon 이 월간지 ${info.wolGanji} 또는 세운 ${info.yearGanji} 또는 사주 8글자를 직접 호명했는가? 근거 없는 일반론 0건?
3. 면피와 애매 표현('~일 수 있습니다 / ~인 편입니다 / ~듯합니다 / ~경향') 0건? 전부 단정형?
4. 한자 등장 시 괄호 일상어 풀이 동반? '(라는 뜻)' 류 회피 0건?
5. 글자수 floor 충족? (theme 180자+, 각 periods.body 120자+, 4영역 각 body 80자+, gaewoon 120자+)
6. 모든 score 가 5의 배수 반복 없이 서로 다른 자연수로 굴곡지는가?
7. headline 이 일상어 결론 + 후크인가? 시적 비유와 외계어 0건?
8. luckyDays, cautionDays 가 각 2~3개이고 모든 date 가 ${info.month}월 범위 안인가?
9. keywords 3개, year=${info.year}, month=${info.month} 그대로인가? (월과 연도 임의 변경 0)`;
    const checklist = group === 'FULL' ? fullChecklist : group === 'M1' ? `1. periods 가 정확히 3개(상순, 중순, 하순)이고 각 dateRange 가 ${info.month}월 날짜 범위(${info.month}/1 ~ ${info.month}/${daysInMonth}) 안인가?
2. theme, periods 가 월간지 ${info.wolGanji} 또는 세운 ${info.yearGanji} 또는 사주 8글자를 직접 호명했는가? 근거 없는 일반론 0건?
3. 면피와 애매 표현('~일 수 있습니다 / ~인 편입니다 / ~듯합니다 / ~경향') 0건? 전부 단정형?
4. 한자 등장 시 괄호 일상어 풀이 동반? '(라는 뜻)' 류 회피 0건?
5. 글자수 floor 충족? (theme 180자+, 각 periods.body 120자+)
6. periods score 가 5의 배수 반복 없이 서로 다른 자연수로 굴곡지는가?
7. headline 이 일상어 결론 + 후크인가? 시적 비유와 외계어 0건?
8. keywords 가 3개이고 year=${info.year}, month=${info.month} 그대로인가? (월과 연도 임의 변경 0)` : `1. 면피와 애매 표현('~일 수 있습니다 / ~인 편입니다 / ~듯합니다 / ~경향') 0건? 전부 단정형?
2. wealth, love, career, health, gaewoon 이 월간지 ${info.wolGanji} 또는 세운 ${info.yearGanji} 또는 사주 8글자를 직접 호명했는가? 근거 없는 일반론 0건?
3. 한자 등장 시 괄호 일상어 풀이 동반? '(라는 뜻)' 류 회피 0건?
4. 글자수 floor 충족? (4영역 각 body 80자+, gaewoon 120자+)
5. 4영역(wealth, love, career, health) score 가 5의 배수 반복 없이 서로 다른 자연수로 굴곡지는가?
6. luckyDays, cautionDays 가 각 2~3개이고 모든 date 가 ${info.month}월 범위(${info.month}/1 ~ ${info.month}/${daysInMonth}) 안인가?`;
    return `위에서 네가 만든 ${info.label} 월별 운세 ${group} JSON 을 아래 체크리스트로 자가 점검하고, 어긴 부분을 모두 고쳐 **최종 JSON 만** 다시 출력하라 (코드블록과 설명 없이 JSON 만).

체크리스트:
${checklist}
${tenseCheck}

고칠 게 없으면 그대로, 있으면 보정해서 최종 JSON 출력.`;
}
//# sourceMappingURL=claudeMonthly.js.map