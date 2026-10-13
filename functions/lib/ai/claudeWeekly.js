"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWeeklyFortune = generateWeeklyFortune;
exports.generateWeeklyDraft = generateWeeklyDraft;
exports.generateWeeklyRefine = generateWeeklyRefine;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const sajuFacts_1 = require("./sajuFacts");
const promptsV3_1 = require("./promptsV3"); // 2026-10-13 어조 마지막 점검 부착 (다른 콘텐츠와 통일)
const kstTime_1 = require("../utils/kstTime");
const aiUsageLog_1 = require("../shared/aiUsageLog"); // C7 원가 기록 (fire-and-forget)
/**
 * 주간운세 (이번 주 7일) — Claude Sonnet 4.6
 * 2026-06-29 NEW 출시 (5운). 오늘운세(1일)·월운(12개월 거시)와 시간 해상도로 분리된 "이번 주 7일 미시 흐름".
 *
 * weekDays = 클라(WeeklyPage)가 lunar-javascript 로 계산한 이번 주 월~일 7일:
 *   [{ day:'월', date:'6/30', ganji:'갑자', ganjiRead:'갑자' }, ...7]
 *   → 서버가 일진 간지를 추측하지 않고 정확한 간지를 그대로 AI 에 주입(만세력 정확성 보장).
 *
 * 퀄리티 레버(준기 결정): 1차 생성 → 2차 자기리뷰(체크리스트 자가 보정) → 반환.
 */
async function generateWeeklyFortune(apiKey, sajuData, weekDays) {
    const anthropic = new sdk_1.default({ apiKey });
    const days = Array.isArray(weekDays) && weekDays.length === 7 ? weekDays : fallbackWeek();
    const prompt = buildPrompt(sajuData, days);
    // ── 1차 생성 ──
    const _t1 = Date.now(); // C7
    const first = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        temperature: 0.1, // 결정론적 — 같은 사주 + 같은 주 = 같은 결과
        messages: [{ role: 'user', content: prompt + promptsV3_1.TONE_FINAL_CHECK }],
    });
    (0, aiUsageLog_1.logAnthropicUsage)('weekly', 'claude-sonnet-4-6', first, _t1, 'callable'); // C7 best-effort
    const firstText = first.content[0].text;
    // ── 2차 자기리뷰 (퀄리티 레버) ──
    const _t2 = Date.now(); // C7
    const review = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        temperature: 0.1,
        messages: [
            { role: 'user', content: prompt + promptsV3_1.TONE_FINAL_CHECK },
            { role: 'assistant', content: firstText },
            { role: 'user', content: buildReviewPrompt(days) + promptsV3_1.TONE_FINAL_CHECK },
        ],
    });
    (0, aiUsageLog_1.logAnthropicUsage)('weekly', 'claude-sonnet-4-6', review, _t2, 'callable'); // C7 best-effort
    const reviewText = review.content[0].text;
    const jsonMatch = reviewText.match(/\{[\s\S]*\}/) || firstText.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('JSON 파싱 실패');
    return (0, sajuFacts_1.sanitizeAiOutput)(JSON.parse(jsonMatch[0]));
}
/**
 * ⚡ async 2차리뷰 — draft (1차만). 주간 로딩 반토막: 1차 결과 즉시 반환.
 *   2차 보정은 별도 refine 콜(백그라운드)에서.
 */
async function generateWeeklyDraft(apiKey, sajuData, weekDays) {
    const anthropic = new sdk_1.default({ apiKey });
    const days = Array.isArray(weekDays) && weekDays.length === 7 ? weekDays : fallbackWeek();
    const prompt = buildPrompt(sajuData, days);
    const _t1 = Date.now(); // C7
    const first = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt + promptsV3_1.TONE_FINAL_CHECK }],
    });
    (0, aiUsageLog_1.logAnthropicUsage)('weekly', 'claude-sonnet-4-6', first, _t1, 'callable'); // C7 best-effort
    const firstText = first.content[0].text;
    const m = firstText.match(/\{[\s\S]*\}/);
    if (!m)
        throw new Error('주간운세 draft JSON 파싱 실패');
    return (0, sajuFacts_1.sanitizeAiOutput)(JSON.parse(m[0]));
}
/**
 * ⚡ async 2차리뷰 — refine (2차만). draft 를 받아 자가 점검·보정 → 최종본.
 *   🛡️ best-effort: 리뷰 파싱 실패 시 draft 그대로 반환(유저는 이미 draft 봤음·무해).
 */
async function generateWeeklyRefine(apiKey, sajuData, weekDays, draft) {
    const anthropic = new sdk_1.default({ apiKey });
    const days = Array.isArray(weekDays) && weekDays.length === 7 ? weekDays : fallbackWeek();
    const prompt = buildPrompt(sajuData, days);
    const _t2 = Date.now(); // C7
    const review = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        temperature: 0.1,
        messages: [
            { role: 'user', content: prompt + promptsV3_1.TONE_FINAL_CHECK },
            { role: 'assistant', content: JSON.stringify(draft) },
            { role: 'user', content: buildReviewPrompt(days) + promptsV3_1.TONE_FINAL_CHECK },
        ],
    });
    (0, aiUsageLog_1.logAnthropicUsage)('weekly', 'claude-sonnet-4-6', review, _t2, 'callable'); // C7 best-effort
    const reviewText = review.content[0].text;
    const m = reviewText.match(/\{[\s\S]*\}/);
    if (!m)
        return draft; // 리뷰 실패 → draft 유지
    return (0, sajuFacts_1.sanitizeAiOutput)(JSON.parse(m[0]));
}
/** weekDays 누락 시 폴백 — 구매일 전날부터 7일(요일 라벨만, 간지 미상). 정상 경로는 항상 클라가 7일 간지 동봉. */
function fallbackWeek() {
    const base = (0, kstTime_1.kstNowDate)(); // KST 오늘(UTC 필드에 KST 값) — 서버 UTC 라도 날짜 안 밀림
    const WD = ['일', '월', '화', '수', '목', '금', '토'];
    const out = [];
    for (let i = -1; i <= 5; i++) { // -1=어제(구매 전날) ~ +5 → 총 7일
        const d = new Date(base.getTime() + i * 86400000);
        out.push({ day: WD[d.getUTCDay()], date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, ganji: '미상', ganjiRead: '' });
    }
    return out;
}
function buildPrompt(d, days) {
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
    const weekTable = days
        .map((x) => `- ${x.day}요일 ${x.date}: 일진 ${x.ganji}(${x.ganjiRead || ''})`)
        .join('\n');
    const rangeStr = `${days[0]?.date} ~ ${days[6]?.date}`;
    return `당신은 사주500 명리학 해석가. ${promptsV3_1.MYEONGRI_GROUNDS_BLOCK}

주간운세 — 사주 원국 일간과 앞으로 7일 일진(日辰)의 충/합에서 추출한 진짜 근거.

⚠️ 운세 기간: ${rangeStr} (구매일 전날부터 7일, 아래 '7일 일진' 표의 날짜, 요일, 간지를 그대로 사용)
- 🚨 이 운세는 달력상 월~일 한 주가 아니라 '오늘(전날 포함) 기준으로 흘러가는 7일'(rolling 7일)이다. '이번 주(달력 주)'가 아니라 '이 7일' / '오늘부터 7일' 흐름으로 서술하라.
- 🚨 **시제(時制) 룰 — 절대 준수**: 이 7일은 '어제(첫날)'부터 시작한다. 즉 dailyBreakdown 의 **첫 항목(어제)과 오늘 이전의 날들은 이미 지나간 날**이다.
  **지난 날(어제~오늘 이전)** → body, action 을 **반드시 과거형**으로: "~였을 겁니다 / ~한 기운이 흘렀어요 / ~을 조심했어야 합니다 / ~하면 좋았어요 / ~한 하루였습니다". 절대 "~하세요 / ~을 조심하세요" 같은 미래와 명령형 X (이미 지난 날에게 명령할 수 없다).
  **오늘 이후(오늘 포함)** → **미래, 현재, 명령형**으로: "~하세요 / ~을 조심하세요 / ~한 기운이 흐릅니다 / ~한 날입니다".
  형태 예시 — 어제(첫날, 과거형): "어제는 OO했을 겁니다. OO은 피했어야 좋았어요."
  형태 예시 — 모레(미래형): "모레는 OO한 날입니다. OO을 먼저 해 보세요."
  (OO 은 그날 일진과 이 사주에서 실제로 나오는 내용으로 채운다. 예시 문장을 그대로 옮기지 말 것)
  7일 표에서 어느 날이 '오늘'인지: 첫 항목이 어제이므로 **두 번째 항목(index 1)이 오늘**. 그 앞은 과거형, 그날부터는 미래와 명령형.

## 사주 원국
${pillarsText}일간: ${ilgan}

## 오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
## 십성: ${sipsung || '미상'}
${d.myeongriAnalysis?.용신 ? `## 용신 (SSOT, 서버 확정, 종합사주와 신년운세와 같은 값): 용신 ${d.myeongriAnalysis.용신}, 희신 ${d.myeongriAnalysis.희신 || '미상'}, 기신 ${d.myeongriAnalysis.기신 || '미상'}. 개운 처방과 행운 색, 방위는 이 용신으로만. 다른 오행을 용신이라고 쓰지 말 것.` : ''}

## 이 7일 일진 (오늘 전날부터 흐르는 rolling 7일, 정확 계산 — 이 간지를 그대로 인용, 절대 임의로 바꾸지 말 것)
${weekTable}

## 날마다 일진과 원국의 관계 (서버 확정. 합, 충, 형, 해는 아래에 있는 것만 사실이다)
${days.map((x) => (0, sajuFacts_1.natalRelationsText)(x.ganji, d, `${x.day}요일 ${x.date}`)).filter(Boolean).join(String.fromCharCode(10))}
→ 위에 없는 합, 충, 형, 해를 지어내지 말 것. '부딪힌다'는 충이나 형으로 확정된 날에만, '묶인다'는 합으로 확정된 날에만 쓴다.

## 이름: ${d.input?.name || '미상'}, 성별: ${d.input?.gender === 'male' ? '남' : '여'}

## 출력 (JSON만, 코드블록 없이)
⚠️ **점수 룰 (PD 결단)**: 모든 score 는 5의 배수만 반복 금지. 67, 73, 81, 88 처럼 자연수. 7일 score 가 전부 다른 값이어야 함(평평한 그래프 X — 요일별 일진에 따라 굴곡).

🚨 **톤 룰 (외계어 X, 일상어 O)**
❌ 금지: 시적 비유 폭격('한낮의 태양' 류), 문어체('결', '자리', '형국' 한 문단 2회 이내), 모호/중의 표현, 한자 폭격.
✅ 각 문장 = 일상어 결론 먼저. 사주 근거는 두 번째 문장부터, 한자는 1회만 + 즉시 일상어 풀이.
🚨 **독자 = 사주를 1도 모르는 일반인.** 명리 용어(십성, 격국, 충, 합 등)를 문장의 주어/핵심으로 쓰지 말 것 — 주어는 항상 '쉬운 일상 결론'. 괄호 한자는 한 body 당 2개 이하(누적 금지). 누가 읽어도 한 번에 이해되는 짧고 단호한 문장으로.

🚨 **한자 풀이 강제**: 한자 등장 시 괄호 안에 실제 일상어 풀이.
✅ '갑자일(甲子日, 새 출발 기운이 강한 날)' / '신금(辛金, 깔끔하고 단정한 성격)' / '자오충(子午沖, 마음이 들뜨고 충돌이 잦은 때)'
❌ '갑자일(甲子日)' 단독 / '(라는 뜻)' 같은 회피 금지.

🚨 **어조 (인플루언서 피드백)**
1. 면피와 애매 표현 0건('~일 수 있습니다 / ~인 편입니다 / ~듯합니다' 금지). 단정형으로.
2. 단정형: "이 7일은 ~한 때입니다." "수요일은 ~하세요."
3. 소름 훅 1회: "혹시 최근에 ~하지 않으셨나요?"
4. 명령형 솔루션: "수요일엔 ~를 피하세요." (애매한 권유 X)
5. 동어반복 금지 — 7일이 서로 다른 정보.

🚨 **보일러플레이트 절대 금지** — 7일 각 body 는 그날 일진 간지 × 일간(${ilgan}) 충/합과 생극을 직접 호명. 근거 없는 일반론('좋은 날입니다') 금지.
✅ 예: '수요일 갑자일(甲子日)은 일간 ${ilgan}과 만나 OO합니다', '금요일은 일진이 일지와 부딪쳐 OO합니다' (OO 은 그날 실제로 생기는 일).

🚨 **example 룰**: 위 예시의 간지(갑자와 신금 등)는 example. 실제로는 ## 사주 원국 의 진짜 8글자 + ## 7일 일진 의 진짜 간지를 인용. '{유저명}' 은 진짜 이름으로. 같은 사주+같은 주 = 같은 결과.

{
  "keywords": ["이번주키워드1","키워드2","키워드3"],
  "weekHeadline": "이 7일(오늘부터 7일)을 한 줄로 (25자 이내, 일상어 결론 + 후크)",
  "weekTheme": "180자 이상. 이 7일(오늘부터 7일)의 핵심 테마. 🚨 왜 이런 흐름인지 — 이 7일 일진 전반 흐름 + 일간 ${ilgan} 기준 specific 호명 (보일러플레이트 금지).",
  "bestDay": "요일(월~일 중)",
  "cautionDay": "요일(월~일 중)",
  "keyDays": [
    {"day":"요일","date":"M/D","type":"best 또는 caution","reason":"80자 이상, 🚨 해당일 일진 간지 × 일간 ${ilgan} 직접 호명 + 구체 행동. 🚨 시제: 지난 날(어제~오늘 이전)을 가리키면 과거형('~였습니다 / ~했어야 합니다'), 오늘 이후면 미래와 명령형('~하세요')."}
  ],
  "dailyBreakdown": [
    {"day":"월","date":"M/D","ganji":"해당일 일진 간지(위 표 그대로)","score":1-100,"tone":"한 줄 요약(15자 이내)","body":"150자 이상, 🚨 그날 일진 간지 × 일간 ${ilgan} 충/합 직접 호명. 🚨 시제: 첫 항목(어제), 오늘 이전 날은 과거형('~였을 겁니다 / ~한 기운이 흘렀어요'), 오늘 이후는 미래와 현재형('~한 날입니다 / ~한 기운이 흐릅니다').","action":"행동팁 1가지, 🚨 지난 날이면 과거형('~했어야 좋았어요 / ~을 조심했어야 합니다'), 오늘 이후면 명령형('~하세요 / ~을 조심하세요')"}
  ],
  "weekLesson": "150자 이상. 이 7일(오늘부터 7일) 전체를 관통하는 교훈 + 실천 1가지(명령형). 🚨 시제: 지난 날(어제~오늘 이전)의 흐름을 짚을 땐 과거형('이번 7일 초반엔 ~한 기운이 흘렀습니다'), 실천 제안은 오늘 이후를 향한 명령형('남은 날엔 ~하세요')."
}

⚠️ keyDays 는 2~3개, dailyBreakdown 은 위 '7일 일진' 표 순서대로 7개 전부(첫날=구매 전날). score 는 dailyBreakdown 7일 곡선이 굴곡지게. 마크다운 서식(**볼드** 등) 절대 금지 — 순수 한국어.`;
}
function buildReviewPrompt(days) {
    return `위에서 네가 만든 주간운세 JSON 을 아래 체크리스트로 자가 점검하고, 어긴 부분을 모두 고쳐 **최종 JSON 만** 다시 출력하라 (코드블록과 설명 없이 JSON 만).

체크리스트:
1. dailyBreakdown 이 정확히 7개(월~일)이고, 각 day/date/ganji 가 위 '7일 일진' 표와 100% 일치하는가? (간지 임의 변경 0)
2. 각 dailyBreakdown.body 가 그날 일진 간지 × 일간 충/합을 직접 호명했는가? 근거 없는 일반론 0건?
3. 면피와 애매 표현('~일 수 있습니다 / ~인 편입니다 / ~듯합니다 / ~경향') 0건? 전부 단정형?
4. 한자 등장 시 괄호 일상어 풀이 동반? '(라는 뜻)' 류 회피 0건?
5. 글자수 floor 충족? (weekTheme 180자+, 각 body 150자+, weekLesson 150자+, keyDays reason 80자+)
6. score 7일이 5의 배수 반복 없이 서로 다른 자연수로 굴곡지는가?
7. weekHeadline 이 일상어 결론 + 후크인가? 시적 비유와 외계어 0건?
8. bestDay/cautionDay 가 월~일 중 하나이고 dailyBreakdown 점수와 모순 없는가?
9. 🚨 시제(時制): dailyBreakdown 의 **첫 항목(어제), 오늘 이전 날**의 body, action 이 모두 **과거형**('~였을 겁니다 / ~한 기운이 흘렀어요 / ~했어야 합니다 / ~하면 좋았어요')인가? 지난 날에 '~하세요 / ~을 조심하세요' 같은 미래와 명령형을 쓰지 않았는가? **오늘 이후**는 미래와 명령형인가? keyDays.reason, weekLesson 도 지난 날 언급 시 과거형인가?

고칠 게 없으면 그대로, 있으면 보정해서 최종 JSON 출력.`;
}
//# sourceMappingURL=claudeWeekly.js.map