"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tojungTargetYear = tojungTargetYear;
exports.generateTojungBigyeol = generateTojungBigyeol;
const personName_1 = require("../shared/personName");
const claudeClient_1 = require("../shared/claudeClient");
const promptsV3_1 = require("./promptsV3");
const promptsV3_2 = require("./promptsV3");
const kstTime_1 = require("../utils/kstTime");
const lunar_javascript_1 = require("lunar-javascript");
const sajuFacts_1 = require("./sajuFacts");
const aiUsageLog_1 = require("../shared/aiUsageLog");
/* 2026-10-07 — '토정비결' → '신년운세' 재출시.
 *   기존: '2026 병오년' 하드코딩(10월 구매자에게 끝나가는 해) + 월 간지를 모델이 계산 + '주역 64괘 중 하나'를
 *   달마다 고르게 함 — 실제 토정비결은 144괘 산식이라 근거 없는 '전통' 연출이었다.
 *   현재: 대상 연도 = 10월부터 내년(그 전엔 올해) · 세운·12개월 월주·용신 역할·그 해 대운·귀인 달을 서버가 계산.
 *   응답 키(months[].괘/괘의미/전통해석/현대해석)는 유지 — 예전 보관함 결과·화면 호환. 괘 자리엔 실제 월주가 들어간다. */
function tojungTargetYear() {
    const n = (0, kstTime_1.kstNow)();
    return n.month >= 10 ? n.year + 1 : n.year;
}
function monthPillar(y, m) {
    try {
        return lunar_javascript_1.Solar.fromYmd(y, m, 15).getLunar().getEightChar().getMonth();
    }
    catch {
        return '';
    }
}
function yearPillar(y) {
    try {
        return lunar_javascript_1.Solar.fromYmd(y, 6, 1).getLunar().getEightChar().getYear();
    }
    catch {
        return '';
    }
}
function planMonthRank(ty, d) {
    const base = {};
    for (let m = 1; m <= 12; m++) {
        const gz = monthPillar(ty, m);
        base[m] = gz ? (0, sajuFacts_1.monthBaseScore)(gz, d) : 66;
    }
    const all = Array.from({ length: 12 }, (_, i) => i + 1);
    const good = [...all].sort((a, b) => base[b] - base[a] || a - b).slice(0, 3);
    const caution = all.filter((m) => !good.includes(m)).sort((a, b) => base[a] - base[b] || a - b).slice(0, 2);
    const gMin = Math.min(...good.map((m) => base[m]));
    const cMax = Math.max(...caution.map((m) => base[m]));
    return { base, good: good.sort((a, b) => a - b), caution: caution.sort((a, b) => a - b), gMin, cMax, ok: gMin - cMax >= 2 };
}
/** 최종 달 점수로 좋은 달(상위 3), 조심할 달(하위 2) — 같은 점수면 기준점수 높은 달, 그다음 앞 달 */
function rankFromScores(ms, rank) {
    const rows = ms.map((m) => ({ m: Number(m.month), s: Number(m.score) })).filter((x) => x.m >= 1 && x.m <= 12 && Number.isFinite(x.s));
    if (rows.length < 12)
        return { good: rank.good, caution: rank.caution };
    const good = [...rows].sort((a, b) => b.s - a.s || (rank.base[b.m] || 0) - (rank.base[a.m] || 0) || a.m - b.m).slice(0, 3).map((x) => x.m);
    const caution = rows.filter((x) => !good.includes(x.m)).sort((a, b) => a.s - b.s || (rank.base[a.m] || 0) - (rank.base[b.m] || 0) || a.m - b.m).slice(0, 2).map((x) => x.m);
    return { good: good.sort((a, b) => a - b), caution: caution.sort((a, b) => a - b) };
}
/* 2026-10-22 — 네 칸 desc 에 명리 용어, 한자, 달 숫자가 들어오면 서버 문장으로 바꾼다(점검 P0-6, 8-1 #3: 50대는 네 칸만 읽고 나간다) */
const FOURBOX_BANNED = /용신|희신|기신|구신|한신|비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|비겁|식상|재성|관성|인성|십성|신약|신강|천간|지지|기운|[一-鿿]|\d{1,2}\s*월/;
function fixFourBox(raw, sel) {
    const list = Array.isArray(raw) ? raw : [];
    const find = (re) => list.find((x) => re.test(String(x?.head || '')));
    const clean = (s, fallback, tag) => {
        const t = String(s || '').trim();
        if (t && !FOURBOX_BANNED.test(t))
            return t;
        console.warn(`[newyear] fourBox ${tag} 서버 문장으로 교체: ${t.slice(0, 40)}`);
        return fallback;
    };
    const half = (from, to, head, re) => {
        const ai = find(re);
        const gIn = sel.good.filter((m) => m >= from && m <= to);
        const cIn = sel.caution.filter((m) => m >= from && m <= to);
        const fbDesc = gIn.length ? `${gIn.join(', ')}월에 힘을 모으면 일이 잘 풀려요`
            : cIn.length ? `${cIn.join(', ')}월에는 큰 결정을 미뤄 두세요`
                : '서두르지 않으면 무난하게 지나가요';
        const fbValue = gIn.length > cIn.length ? '풀리는 시기' : gIn.length < cIn.length ? '다지는 시기' : '고른 시기';
        return { head, value: clean(ai?.value, fbValue, `${head} value`), desc: clean(ai?.desc, fbDesc, `${head} desc`) };
    };
    const g = find(/좋은|길월/);
    const c = find(/조심|주의/);
    return [
        half(1, 6, '상반기', /상반기/),
        half(7, 12, '하반기', /하반기/),
        { head: '좋은 달', value: `${sel.good.join(', ')}월`, desc: clean(g?.desc, '계약과 큰 결정은 이 달들에 잡아 보세요', '좋은 달 desc') },
        { head: '조심할 달', value: `${sel.caution.join(', ')}월`, desc: clean(c?.desc, '큰 지출과 서명은 좋은 달로 미뤄요', '조심할 달 desc') },
    ];
}
/** 2026-10-22 — 날짜 뒤에 주말 표시(점검 P0-6: '1/10(일)', '8/7(토)'에 계약과 면접을 잡으라고 했다). sajuFacts 가 이미 붙였으면 그대로 */
function markWeekend(label) {
    return /주말/.test(label) ? label : String(label).replace(/\((토|일)\)/, '($1, 주말)');
}
/** 2026-10-22 — 측정용 로그: 주말 날짜와 계약, 면접, 결재, 서명이 한 문장에 붙은 수(점검 P0-6 측정) */
function countWeekendDeals(ty, ms) {
    let n = 0;
    for (const m of ms) {
        const text = [m?.현대해석, m?.todo, m?.avoid].map((x) => String(x || '')).join(' ');
        for (const sent of text.split(/[.!?]\s*/)) {
            if (!/계약|면접|결재|서명/.test(sent))
                continue;
            const re = /(\d{1,2})\s*(?:월\s*|\/)(\d{1,2})\s*일?/g;
            let hit;
            while ((hit = re.exec(sent))) {
                const wd = new Date(ty, Number(hit[1]) - 1, Number(hit[2])).getDay();
                if (wd === 0 || wd === 6) {
                    n++;
                    break;
                }
            }
        }
    }
    return n;
}
/* 2026-10-08 — 신년운세 7운 프리미엄화 (오너: "7운 · 퀄리티 좋게").
 *   Sonnet 단일 → Opus 3그룹 병렬 (종합사주와 같은 모델·패턴):
 *     A = 한 해 총평(헤드라인·4박스·6분야 심층·결정 타이밍·개운) · B = 1~6월 · C = 7~12월
 *   달마다 '좋은 날·조심할 날'(일진 × 용신·희신·기신·천을귀인·일지충)과 달 기준 점수는 서버 확정값 →
 *   그룹 간 점수·판정이 엇갈리지 않고, 날짜는 만세력 그대로. */
const NEWYEAR_MODEL = process.env.SAJU_PREMIUM_MODEL || claudeClient_1.CLAUDE_MODEL.opus;
const NY_NO_HOOK_LINE = `

## 이 그룹에서는 '혹시 ~했나요?' 같은 짚는 질문을 쓰지 않는다(총운에서 한 번 했다). 확정표의 시기는 단정 문장의 근거로만 쓴다.`;
const NY_ABS_TIME_LINE = `

## 시점 표기: 시기는 '2026년 8월', '2027년 3월'처럼 연도를 붙여 쓴다. '작년', '올해', '내년' 같은 상대 표현은 쓰지 않는다. 독자는 지금(현재 날짜) 이 글을 읽는다. '장면이 보여요' 같은 신점 말투는 쓰지 않는다.`;
async function callNyGroup(anthropic, shared, group, ty, rank) {
    const user = nyGroupInstruction(group, ty, rank);
    const MAX = { A: 9000, B: 9000, C: 9000 };
    for (let attempt = 0; attempt < 2; attempt++) {
        const t0 = Date.now();
        const msg = await anthropic.messages.create({
            model: NEWYEAR_MODEL,
            max_tokens: MAX[group],
            system: [{ type: 'text', text: shared, cache_control: { type: 'ephemeral' } }],
            // 2026-10-15 — 짚기 질문은 A 의 총운 한 곳만. 월별 그룹(B, C)은 묻지 않고, 시기는 '작년, 올해' 대신 연도로 쓴다(독자는 2026년에 2027년 운세를 읽는다)
            messages: [{ role: 'user', content: user + (group === 'A' ? promptsV3_1.READING_VOICE_BLOCK : NY_NO_HOOK_LINE) + NY_ABS_TIME_LINE + promptsV3_1.TONE_FINAL_CHECK }],
        });
        try {
            (0, aiUsageLog_1.logAnthropicUsage)('tojung', NEWYEAR_MODEL, msg, t0);
        }
        catch { /* best-effort */ }
        try {
            const parsed = (0, promptsV3_2.parseJsonResponse)(msg.content[0].text || '');
            if (group === 'A' && parsed?.yearOverview && parsed?.headline)
                return parsed;
            if (group !== 'A' && Array.isArray(parsed?.months) && parsed.months.length >= 5)
                return parsed;
            console.warn(`[newyear] group ${group} 필드 부족 (attempt ${attempt + 1})`);
        }
        catch (e) {
            console.warn(`[newyear] group ${group} 파싱 실패 (attempt ${attempt + 1}):`, e?.message);
        }
    }
    throw new Error(`신년운세 ${group} 그룹 생성 실패`);
}
async function generateTojungBigyeol(apiKey, sajuData, 
/** 2026-10-09 — 점진 표시: 그룹 완성 즉시 (A=총평 · B=1~6월 · C=7~12월) — best-effort */
onGroup) {
    const anthropic = (0, claudeClient_1.createClaude)(apiKey);
    const ty = tojungTargetYear();
    const ygz = yearPillar(ty);
    const picks = (0, sajuFacts_1.dayPicksForYear)(ty, sajuData);
    // 2026-10-22 — 좋은 달과 조심할 달을 먼저 정해 세 그룹에 같이 넘긴다(점검 P0-6)
    const rank = planMonthRank(ty, sajuData);
    const shared = buildPrompt(sajuData, picks, rank);
    // 2026-10-08 원가 — 세 그룹이 같은 공유 프롬프트(~1.2만 토큰)를 동시에 보내면 서로 캐시를 못 읽고 셋 다 '캐시 쓰기'(입력가 1.25배)로
    //   과금됐다(실측 755원/건, cacheRead 0). A 가 먼저 프롬프트를 캐시하도록 B·C 를 5초 늦게 출발 → B·C 는 캐시 읽기(0.1배).
    const later = (ms, fn) => new Promise((res, rej) => setTimeout(() => fn().then(res, rej), ms));
    // 달 간지·역할·날짜·점수 앵커는 서버 확정값 (모델이 바꿔 써도 화면은 만세력 그대로) — 그룹 단위로 적용(점진 표시 = 최종본)
    const finishMonths = (arr) => {
        const ms = (Array.isArray(arr) ? arr : [])
            .filter((m) => Number(m?.month) >= 1 && Number(m?.month) <= 12)
            .sort((x, y) => Number(x.month) - Number(y.month));
        ms.forEach((m) => {
            const mm = Number(m.month);
            const gz = monthPillar(ty, mm);
            if (gz) {
                m.괘 = `${gz}(${(0, sajuFacts_1.ganziKo)(gz)})월`;
                m.괘의미 = (0, sajuFacts_1.ganziRoleText)(gz, sajuData, '달');
                const base = (0, sajuFacts_1.monthBaseScore)(gz, sajuData);
                const sc = Number(m.score);
                m.score = Number.isFinite(sc) ? Math.max(base - 6, Math.min(base + 6, Math.round(sc))) : base;
                // 2026-10-22 — 서버가 정한 좋은 달은 다른 달보다 높게, 조심할 달은 낮게 묶는다(점검 P0-6). 모든 경계가 기준점수 ±6 안이다
                if (rank.ok) {
                    const isG = rank.good.includes(mm);
                    const isC = rank.caution.includes(mm);
                    m.score = isG ? Math.max(m.score, rank.gMin) : Math.min(m.score, rank.gMin - 1);
                    if (isC)
                        m.score = Math.min(m.score, rank.cMax);
                    else if (!isG)
                        m.score = Math.max(m.score, rank.cMax + 1);
                }
            }
            // 2026-10-22 — 첫 문장이 '2027년 N월은', 'N월의'로 시작하면 그 머리를 뗀다(점검 P0-6, 3-1 #18: 달 이름은 카드 머리에 이미 있다)
            if (typeof m.현대해석 === 'string') {
                const lead = new RegExp(`^\\s*(?:${ty}년\\s*)?${mm}월(?:은|의|에는|엔|에)?\\s+`);
                if (lead.test(m.현대해석)) {
                    console.warn(`[newyear] ${mm}월 첫머리 제거`);
                    m.현대해석 = m.현대해석.replace(lead, '');
                }
            }
            m.goodDays = picks.perMonth[mm]?.good || [];
            m.cautionDays = picks.perMonth[mm]?.caution || [];
        });
        return ms;
    };
    const head = (a, sel) => {
        const h = { ...a, keyDates: picks.keyDates, targetYear: ty, schemaVersion: 2 };
        // 2026-10-22 — 네 칸의 좋은 달과 조심할 달 value 는 서버 값으로 덮어쓴다(점검 P0-6). A 먼저 보일 때는 미리 정한 달, 합칠 때는 최종 점수
        h.fourBox = fixFourBox(a?.fourBox, sel || { good: rank.good, caution: rank.caution });
        h.hexagram = {
            yearLabel: `${ty} ${(0, sajuFacts_1.ganziKo)(ygz)}년, 신년운세`,
            glyph: ygz,
            name: `${(0, sajuFacts_1.ganziKo)(ygz)}년의 ${(0, personName_1.realName)(sajuData?.input?.name) || '나'}`,
            oneLine: String(a.headline || ''),
            pullQuote: a.pullQuote ? String(a.pullQuote) : undefined,
        };
        return h;
    };
    const emit = (g, data) => {
        if (onGroup)
            Promise.resolve(onGroup(g, (0, sajuFacts_1.sanitizeAiOutput)(data))).catch(() => { });
    };
    const [a, b, c] = await Promise.all([
        callNyGroup(anthropic, shared, 'A', ty, rank).then((x) => { emit('A', head(x)); return x; }),
        later(5000, () => callNyGroup(anthropic, shared, 'B', ty, rank)).then((x) => { emit('B', { months: finishMonths(x?.months) }); return x; }),
        later(5000, () => callNyGroup(anthropic, shared, 'C', ty, rank)).then((x) => { emit('C', { months: finishMonths(x?.months) }); return x; }),
    ]);
    const months = finishMonths([...(b.months || []), ...(c.months || [])]);
    // 2026-10-22 — 합친 뒤 최종 달 점수로 좋은 달(상위 3), 조심할 달(하위 2)을 다시 정해 네 칸에 덮어쓴다(점검 P0-6)
    const sel = rankFromScores(months, rank);
    if (sel.good.join() !== rank.good.join() || sel.caution.join() !== rank.caution.join()) {
        console.warn(`[newyear] 미리 정한 달과 최종 점수가 다름: 좋은 ${rank.good}→${sel.good}, 조심 ${rank.caution}→${sel.caution}`);
    }
    try {
        const wk = countWeekendDeals(ty, months);
        if (wk)
            console.warn(`[newyear] 주말 날짜에 계약, 면접, 서명이 붙은 문장 ${wk}개`);
    }
    catch { /* 측정용 */ }
    const merged = { ...head(a, sel), months };
    return (0, sajuFacts_1.sanitizeAiOutput)(merged);
}
/** 그룹별 출력 지시 — 공유 컨텍스트(사주·확정값·톤)는 system 에 캐시 */
function nyGroupInstruction(group, ty, rank) {
    const goodStr = `${rank.good.join(', ')}월`;
    const cautionStr = `${rank.caution.join(', ')}월`;
    if (group === 'A') {
        // 2026-10-22 — headline 은 서버가 정한 좋은 달을 넣은 25~35자, fourBox desc 는 용어 없는 쉬운 말 20~30자(점검 P0-6)
        return `## 이번 응답 = 그룹 A (한 해 총평) 만. months 는 출력하지 마세요 (다른 그룹이 씀).
JSON 만 출력 (코드블록 없이):
{
  "headline": "${ty}년을 한 문장으로 (25~35자). 서버가 정한 좋은 달(${goodStr}) 가운데 한 달을 숫자로 넣고, 그달부터 무엇이 풀리는지 쓰고, '~해입니다'로 맺는다",
  "pullQuote": "기억에 남을 짧은 한마디 (20~30자)",
  "keywords": ["키워드1","키워드2","키워드3"],
  "fourBox": [
    {"head": "상반기", "value": "6자 내외 핵심 (쉬운 말)", "desc": "1~6월이 어떤지 20~30자, ~해요로 끝나는 쉬운 말"},
    {"head": "하반기", "value": "6자 내외 핵심 (쉬운 말)", "desc": "7~12월이 어떤지 20~30자, ~해요로 끝나는 쉬운 말"},
    {"head": "좋은 달", "value": "${goodStr}", "desc": "이 달들에 무엇이 잘 되는지 20~30자, ~해요로 끝나는 쉬운 말"},
    {"head": "조심할 달", "value": "${cautionStr}", "desc": "이 달들에 무엇을 미루면 좋은지 20~30자, ~해요로 끝나는 쉬운 말"}
  ],
  "categoryScores": {"총운": 정수, "금전운": 정수, "건강운": 정수, "직장운": 정수, "애정운": 정수, "결혼운": 정수},
  "yearOverview": {
    "총운": "400~500자, 첫 문장 결론 → 둘째 문장에서 확정표의 올해나 최근 석 달로 '지난 일 짚기' 한 번(그 흐름이 ${ty}년에 어떻게 바뀌는지로 잇는다) → 세운과 그 해 대운이 원국과 만나는 구조(근거 1~2개) → 상반기/하반기 흐름(구체 월) → 올해 가장 중요한 행동 1개",
    "금전운": "350~450자, 돈이 들어오고 나가는 구체 장면 + 좋은 달과 조심할 달(확정값) + 해야 할 것/피할 것",
    "건강운": "300~400자, 약해지기 쉬운 몸과 컨디션 패턴 + 조심할 달 + 생활 습관 1~2개 (의학적 진단 단정 금지)",
    "직장운": "350~450자, 일, 이직, 평가, 인간관계 장면 + 움직이기 좋은 달/버틸 달",
    "애정운": "350~450자, 성별 기준(여성=관성, 남성=재성이 연인의 별), 솔로/연애 중 둘 다 읽히게, 인연이 들어오는 달",
    "결혼운": "300~400자, 결혼, 동거, 관계 진전 흐름, 조건과 시기로 쓴다"
  },
  "turningPoints": [
    {"when": "예: 2~3월", "title": "15자 내외 (결정, 이동, 관계 중 하나)", "desc": "120~180자, 왜 이때인지(확정 월주 근거) + 무엇을 하면 좋은지"},
    {"when": "...", "title": "...", "desc": "..."},
    {"when": "...", "title": "...", "desc": "..."}
  ],
  "luckyAdvice": "300~400자, 용신 기준 개운 습관 (색, 방위, 숫자는 상징으로 가볍게) + 꼭 기억할 날(확정값) 활용법"
}
점수 규칙: 0~100 정수, 5의 배수만 반복 금지, 분야마다 다른 값.
성별은 해석에만 반영 — '○○ 님은 여성이므로/남성이라' 같은 성별 설명 문장은 쓰지 말 것.
네 칸(fourBox) 규칙: 50대 손님은 이 네 칸만 읽고 나가는 일이 많다. desc 에는 용신, 희신, 기신, 십성 이름(정관, 식신 같은 말), 신약, 신강, 천간, 지지, '기운', 한자, 달 숫자를 쓰지 않는다. 일, 돈, 사람, 몸에서 실제로 생기는 일로 쓴다. 말투 예: '서류와 계약이 술술 풀려요', '큰돈 나갈 일은 좋은 달로 미뤄요'. 좋은 달과 조심할 달의 value 는 위 값 그대로 쓴다(서버가 다시 맞춘다).
총운과 분야별 풀이에서 '좋은 달', '가장 좋은 달'로 부르는 달은 ${goodStr}, '조심할 달'로 부르는 달은 ${cautionStr}뿐이다. 분야별로 다른 달을 말할 때는 그 달에 할 일로 쓴다.`;
    }
    const range = group === 'B' ? [1, 6] : [7, 12];
    const monthsList = Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i).join(', ');
    // 2026-10-22 — 이 그룹에 든 좋은 달, 조심할 달(서버가 정함). 좋은 달 첫 문장은 좋은 일로(점검 P0-6, 7-2 #5: 86점 7월이 '무거운 책임'으로 시작했다)
    const gIn = rank.good.filter((m) => m >= range[0] && m <= range[1]);
    const cIn = rank.caution.filter((m) => m >= range[0] && m <= range[1]);
    const rankLine = [
        gIn.length ? `- 서버가 정한 좋은 달 가운데 이 그룹 달: ${gIn.join(', ')}월. 이 달들은 score 를 기준점수 이상으로 주고, 현대해석 첫 문장을 그달에 생길 좋은 일로 시작한다. 첫 문장에 '버티', '무거운', '부담', '잠그', '조심' 같은 말을 쓰지 않는다.` : '',
        cIn.length ? `- 서버가 정한 조심할 달 가운데 이 그룹 달: ${cIn.join(', ')}월. 이 달들은 score 를 기준점수 이하로 준다.` : '',
    ].filter(Boolean).join('\n');
    // 2026-10-22 — 현대해석: 첫 문장은 장면, 세 요소 순서는 달마다 바꿈, 괄호 풀이 처음 한 번, '기운' 한 달 한 번, 보장 말 금지, 주말 규칙(점검 P0-6)
    //   사자성어 예에서 '고진감래'를 뺐다(점검 3-2: 명언식 맺음 금지 목록에 든다)
    return `## 이번 응답 = 그룹 ${group} (${monthsList}월) 만. 총평과 다른 달은 출력하지 마세요 (다른 그룹이 씀).
JSON 만 출력 (코드블록 없이):
{
  "months": [
    {"month": ${range[0]},
     "keyword": "4~6글자 (그 달의 핵심)",
     "score": "확정 '달 기준점수' ±4 안의 정수",
     "전통해석": "그 달을 한 줄로 (25~40자, 읽기 쉬운 결론). 사자성어는 꼭 맞을 때만, 한국에서 흔히 쓰는 것(전화위복, 유비무환 등)만, 열두 달 통틀어 세 번까지, 같은 성어 반복 금지",
     "현대해석": "300~400자. 세 가지를 담는다. 장면: 그 달에 실제로 생길 일 2개(일, 돈, 관계, 몸 중 두드러진 것). 근거: 확정 월주와 원국의 관계 한 번. 날짜: 이 달 좋은 날과 조심할 날(확정값) 가운데 1~2개와 그날 할 일. 세 가지의 순서는 달마다 바꾼다. 첫 문장은 그달에 생길 장면으로 시작한다",
     "todo": "이 달 꼭 할 일 한 문장 (40자 내외, 구체 행동)",
     "avoid": "이 달 피할 일 한 문장 (40자 내외)"
    }, ... ${monthsList}월 모두 (${range[1] - range[0] + 1}개)
  ]
}
${rankLine ? `${rankLine}\n` : ''}규칙:
- 달마다 다른 장면과 다른 조언 (같은 문장 반복 금지), 날짜는 확정값에 있는 것만, 점수는 기준점수 ±4.
- 현대해석 첫 문장을 '${ty}년 N월은', 'N월은', 'N월의'로 시작하지 않는다. 달 이름은 화면 카드 머리에 이미 있다.
- 달마다 같은 틀로 맺지 않는다. 날짜 두 개를 '~하세요', '~마세요'로 나란히 놓는 끝맺음은 이 응답의 여섯 달 가운데 한 달까지.
- 한자 용어의 괄호 풀이는 이 응답에서 그 용어가 처음 나올 때 한 번만 붙인다. 다시 나오면 한글 읽기만 쓴다.
- '기운'이라는 말은 한 달 풀이(전통해석, 현대해석, todo, avoid 합쳐서)에 한 번까지 쓴다.
- 결과를 보장하는 말('반드시', '틀림없이', '무조건', '뒤탈이 없다')은 쓰지 않는다. 날짜에는 그날 무엇이 잘 정리되는지와 할 일을 쓴다. 예: 'N월 D일(월)은 서류가 깔끔하게 정리되는 날입니다. 서명할 일이 있으면 이날로 잡으세요.'
- 확정값에서 '주말' 표시가 붙은 날(토, 일)에는 계약, 면접, 결재, 서명을 붙이지 않는다. 주말에는 계획 적기, 만남, 정리, 쉬기를 붙인다. 계약과 서명은 평일인 좋은 날에 붙인다. 본문에 날짜를 쓸 때는 '1월 10일(일)'처럼 요일만 괄호에 쓴다.`;
}
function buildPrompt(d, picks, rank) {
    const p = d.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((x, i) => { if (x.available !== false)
        pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`; });
    const el = d.elements || {};
    const sipsung = d.sipsung?.map((s) => `${s.위치 || s.position || ''}: ${s.글자}(${s.십성})`).join(', ') || '';
    // 2026-06-26 — 대운 전체 흐름 명시(이전/현재/다음 간지+나이). 기존엔 '현재 대운'만 줘서 AI 가 이전/다음
    //   대운 간지를 데이터 없이 추측하다 뒤바꾸던 버그 fix (claudePremium.ts buildSajuBase 패턴 복제).
    const daeunList = Array.isArray(d.daeun) ? d.daeun : [];
    const curIdx = daeunList.findIndex((x) => x.isCurrent || x.현재);
    const daeunAge = (x) => (x?.시작나이 != null && x?.끝나이 != null) ? `${x.시작나이}~${x.끝나이}세` : (x?.나이범위 || '');
    const daeunFlow = daeunList.length > 0
        ? daeunList.map((x, i) => `- ${daeunAge(x)} ${x.간지}${i === curIdx ? ' ← 현재 대운' : ''}`).join('\n')
        : '미상';
    const prevDae = curIdx > 0 ? daeunList[curIdx - 1] : null;
    const nextDae = (curIdx >= 0 && curIdx < daeunList.length - 1) ? daeunList[curIdx + 1] : null;
    const nowKst = (0, kstTime_1.kstNow)();
    const dateStr = `${nowKst.year}년 ${nowKst.month}월`;
    const ty = tojungTargetYear();
    const ygz = yearPillar(ty);
    const yko = (0, sajuFacts_1.ganziKo)(ygz);
    const monthsFact = Array.from({ length: 12 }, (_, i) => {
        const gz = monthPillar(ty, i + 1);
        const pm = picks?.perMonth?.[i + 1];
        // 2026-10-22 — 토, 일 날짜에 '주말' 표시를 붙여 넘긴다(점검 P0-6 주말 규칙). 화면의 goodDays 값은 그대로
        const days = pm ? ` 좋은 날 ${pm.good.map(markWeekend).join(', ') || '없음'}, 조심할 날 ${pm.caution.map(markWeekend).join(', ') || '없음'}` : '';
        const rel = (0, sajuFacts_1.natalRelations)(gz, d);
        const relText = rel.gan ? `, 십성 천간 ${rel.gan} 지지 ${rel.ji}, 원국과 ${rel.links.length ? rel.links.join(', ') : '합과 충 없음'}` : '';
        return `- ${i + 1}월 ${gz}(${(0, sajuFacts_1.ganziKo)(gz)}) : ${(0, sajuFacts_1.ganziRoleText)(gz, d, '달')}, 달 기준점수 ${(0, sajuFacts_1.monthBaseScore)(gz, d)}${relText}${days}`;
    }).join('\n');
    const keyDatesFact = (picks?.keyDates || []).map((k) => `${markWeekend(k.date)} (${k.why})`).join(', ');
    // 2026-10-22 — 서버가 정한 좋은 달, 조심할 달, 반기별 요약(점검 P0-6). 세 그룹이 같은 달을 말하게 공유 프롬프트에 둔다
    //   같은 때 월주 안내 줄의 '~이 아니라' 꼴, 시점 표기 줄과 결혼운 칸의 '대신' 꼴도 바로 적는 꼴로 고쳤다(점검 3장: 모델은 본문 꼴을 따라 한다)
    const halfLine = (from, to, name) => {
        if (!rank)
            return '';
        const g = rank.good.filter((m) => m >= from && m <= to);
        const c = rank.caution.filter((m) => m >= from && m <= to);
        return `${name}(${from}~${to}월) 좋은 달 ${g.length ? g.join(', ') + '월' : '없음'}, 조심할 달 ${c.length ? c.join(', ') + '월' : '없음'}`;
    };
    const rankFact = rank
        ? `- 서버가 정한 좋은 달(열두 달 점수 상위 셋): ${rank.good.join(', ')}월, 조심할 달(하위 둘): ${rank.caution.join(', ')}월. 화면의 달 점수 순서도 이와 같다.
- ${halfLine(1, 6, '상반기')} / ${halfLine(7, 12, '하반기')}`
        : '';
    const tyDaeun = daeunList.find((x) => Number(x?.시작년도) <= ty && ty <= Number(x?.끝년도));
    const gwiin = (() => {
        try {
            const posNames = ['년지', '월지', '일지', '시지'];
            const natal = p.map((x, i) => (x && x.available !== false && x.지지 ? { pos: posNames[i], br: String(x.지지) } : null)).filter(Boolean);
            return (0, sajuFacts_1.gwiinFactsText)({
                dayGan: String(p[2]?.천간 || ''), natal,
                daeunBranch: tyDaeun?.간지 ? String(tyDaeun.간지).slice(1) : undefined, daeunLabel: tyDaeun?.간지 ? `${tyDaeun.간지} 대운` : undefined,
                yearBranch: ygz ? ygz.slice(1) : undefined, yearLabel: ygz ? `${ty}년 ${ygz}` : undefined,
                now: new Date(ty, 0, 15),
            });
        }
        catch {
            return '';
        }
    })();
    return `당신은 사주500 신년운세 해석가. ${promptsV3_2.MYEONGRI_GROUNDS_BLOCK}

${ty}년 ${yko}(${ygz})년 신년운세 — 사주 원국 + ${ty}년 세운과 열두 달 월운에서 추출한 진짜 근거.

⚠️ 현재 날짜: ${dateStr}, 분석 대상: ${ty}년 1월~12월 (양력)

## 🚨 ${ty}년 확정값 (서버 계산, 직접 계산 금지, 이 값과 다른 간지와 역할 서술 금지)
- ${ty}년 세운: ${(0, sajuFacts_1.ganziRoleText)(ygz, d, '해')}
- ${ty}년의 대운: ${tyDaeun?.간지 ? `${tyDaeun.간지}(${(0, sajuFacts_1.ganziKo)(String(tyDaeun.간지))}) 대운, ${(0, sajuFacts_1.ganziRoleText)(String(tyDaeun.간지), d, '해')}` : '미상'}
- 세운과 대운이 원국 여덟 글자와 만나는 십성과 합충 (서버 계산):
${(0, sajuFacts_1.natalRelationsText)(ygz, d, `${ty}년 세운`)}
${tyDaeun?.간지 ? (0, sajuFacts_1.natalRelationsText)(String(tyDaeun.간지), d, `${tyDaeun.간지} 대운`) : ''}
${(0, sajuFacts_1.lifeTimelineFactsText)(d, (0, kstTime_1.kstNowDate)())}
- 🚨 십성 이름과 합, 충, 형, 해는 위 확정표와 아래 열두 달 줄에 적힌 것만 쓴다. 표에 없는 합이나 충, 표와 다른 십성 이름을 지어내지 말 것 (천간끼리 합과 충을 특히 주의).
- '기준점수'라는 말과 그 숫자는 풀이에 쓰지 않는다 (점수 앵커일 뿐, 화면 점수와 다르다).
- 열두 달 월주 (양력 달 기준. 양력 1월의 월주는 丑월, 2월부터 寅월):
${monthsFact}
${rankFact ? `${rankFact}\n` : ''}- 한 해 꼭 기억할 날 (서버 계산): ${keyDatesFact || '없음'}
- 날짜 판정 기준: 그날 일진이 용신과 희신이면 좋은 날, 기신이 강하거나 일지와 충이면 조심할 날 (천을귀인 날 가점). 날짜는 위 값만 인용 — 새 날짜를 만들지 말 것.
- 날짜 뒤 '주말' 표시는 토요일과 일요일이다. 주말인 날에는 계약, 면접, 결재, 서명을 붙이지 않고 계획 적기, 만남, 정리, 쉬기를 붙인다.
- 귀인과 신살이 걸리는 달 (원국에 '없음'인 신살은 '있다'고 쓰지 말 것):
${gwiin || '미산출'}
→ 각 달 score, keyword, 풀이는 위 '도움/부담' 판정과 원국 형충합을 근거로. 판정이 '부담'인 달을 최고점으로 쓰지 말 것.

## 사주 원국
${pillarsText}일간: ${p[2]?.천간 || '미상'}

## 오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
${(0, sajuFacts_1.sajuCoreFactsText)(d)}

## 대운 흐름 (10년 단위, 나이는 한국식 세는나이 기준(태어난 해가 1세, 화면 표기와 같은 숫자). 나이를 다시 계산하지 말고 이 숫자를 그대로 쓸 것)
${daeunFlow}
${curIdx >= 0 ? `→ 이전 대운=${prevDae ? `${prevDae.간지}(${daeunAge(prevDae)})` : '없음'}, 현재 대운=${daeunList[curIdx].간지}(${daeunAge(daeunList[curIdx])}), 다음 대운=${nextDae ? `${nextDae.간지}(${daeunAge(nextDae)})` : '없음'}. 이 간지와 순서를 절대 바꾸지 말 것 — 이전/다음 대운 간지를 임의로 만들거나 뒤바꾸지 말고 위 대운 흐름 목록의 간지를 그대로 인용. swap 절대 금지.` : ''}

## 이름: ${(0, personName_1.promptName)(d.input?.name)}, ${d.input?.gender === 'male' ? '남' : '여'}, ${d.input?.birthYear || ''}년생${d.띠 ? `, ${d.띠}띠` : ''}

## 출력 형식은 user 메시지의 그룹 지시를 따른다 (JSON만, 코드블록 없이)
⚠️ **점수 필드 룰 (2026-05-04 PD 결단)**: 모든 score (categoryScores, subScores, overallScore, monthlyScore, compatScore, careerScore 등) 는 **5의 배수만 반복 금지**. 65, 70, 75, 80 같은 fake 신호 X. 67, 73, 81, 88 같이 자연수로 출력. 같은 카테고리 안 점수가 모두 다른 값이어야 함.

🚨 **톤 룰 (2026-05-05 PD 결단 — 외계어 X, 일상어 O)**

사용자 피드백:
> '무슨 말인지 모르겠다. 한낮의 태양이다 / 겨울 한복판에 태어난 태양이다 / 형국이다 — 이게 뭔 뜻이냐.
>  사주는 알아듣기 편하게 말해줘서 돈 주고 보는 거지, 어렵고 모호한 표현이면 돈 안 낸다.'

❌ **절대 금지 패턴**:
1. 시적 비유 폭격: '한낮의 태양' '차가운 밤 호수' '장작을 대주는 자리' '~의 형국' — 비유가 풀이를 대체 X.
2. 문어체 단어 남발: '결' '자리' '형국' 한 문단 2회 이내.
3. 중의적과 모호한 표현: '흐름이 풀리는 자리' → '30대 중반에 일이 잘 풀립니다'
   '준비된 결이 또렷' → '준비는 잘 되어 있어요' / '의식의 자리에 두십시오' → '꼭 신경 쓰세요'
4. 한자 폭격: 한자(丙火, 신금, 축미충 등) 첫 등장 1번만, 이후는 한글 또는 일상어.

📚 **"사주아이" 톤 레퍼 (참고, 모방 X, 우리 특색 살림)**:
1. **각 섹션 시작 = 일상어 결론 한 줄** (제목 후크 톤)
   ✅ '겉으로는 차분해 보이지만 속에는 따뜻함을 찾는 마음이 늘 움직이는 분입니다'
2. **사주 근거는 두 번째 문장부터, 한자는 1회만** + 즉시 일상어 풀이
3. **공감 + 위로 + 행동 처방** (가장 강력)
   ✅ '<strong>본인에게는 가혹한 잣대를 들이대요</strong>. 이제는 본인 행복을 위해 그 섬세함을 써보세요. <strong>완벽하지 않아도 충분히 가치 있는 사람입니다</strong>.'
4. **마무리 = 응원 + 구체 행동** (행운 색, 방위, 시기 등 구체)

🚨 **한자 풀이 형식 강제 (2026-05-05 PD 결단 — '라는 뜻' 같은 회피 X)**:
한자 등장 시 괄호 안에 **실제 일상어 풀이 텍스트** 동반:
✅ '병화(丙火, 밝고 활달한 성격)' / '신금(辛金, 깔끔하고 단정한 사람)' / '축미충(丑未沖, 가치관이 자주 흔들리는 자리)'
✅ '정관(正官, 책임감과 규범을 중요시하는 결)' / '도화살(桃花殺, 사람을 끌어당기는 매력)'
❌ '병화(丙火)' 단독 — 풀이 X
❌ '병화(丙火, 라는 뜻)' / '병화(丙火, 한자 그대로)' — 추상적 회피 X. 진짜 풀이 텍스트.
검증법: 한자 (괄호) 부분만 빼고 일상어만 읽었을 때 자연스러운 한국어 문장이 되어야 함.


🚨 **어조 규칙 (2026-06-24, 인플루언서 피드백 — 출력 본문 전체에 절대 준수)**
1. **애매와 면피 표현 전면 금지**: "~일 수 있습니다 / ~할 수 있어요 / ~하기 쉬워요 / ~인 편입니다 / ~경향이 있습니다 / ~듯합니다 / ~것 같습니다 / ~수도 있습니다" 류 0건. 모든 문장을 확신 있는 단정형으로 끝낸다.
   사주를 꿰뚫어 보는 사람처럼 단호하게: ❌ "이 달은 지출이 늘기 쉬워요" → ✅ "3월엔 돈이 새는 구멍이 생깁니다. 카드 한도부터 줄이세요." (겁주기와 불행 단정은 금지, 내 편인 어른 말투)
2. **단정형**: "{이름} 님은 OO한 사람입니다." "이 시기는 ~한 때입니다."
3. **과거 적중(소름 훅)**: "혹시 예전에 ~한 일이 있지 않았나요?" "유독 ~할 때 ~하지 않으셨나요?" — 독자가 "어? 내 얘기네?" 하게.
4. **명령형 솔루션**: "앞으로는 이렇게 하세요." "~는 피하고 ~를 선택하세요." (애매한 권유 X, 분명한 지시 O)
5. **루즈함 차단**: 같은 메시지를 앞, 중간, 끝에서 반복 금지. 각 단락은 새 정보. 구구절절과 동어반복 금지.


✨ **우리만의 차별화**:
- 고전 근거는 내부 판단용 — 본문에 책 이름, 학파, '고서에 따르면' 언급 금지
- 결정론 (같은 사주 = 같은 결과)
- 한자 1회 등장 시 즉시 일상어 풀이 동반
- strong 강조는 유저 일상 결론에만
- 숫자와 시기 또렷이 ('30대 후반' '9월~2월')


✅ **풀이 작성 규칙**:
- **첫 문장은 결론** ('{유저명} 님은 ~한 사람입니다')
- **비유는 한 번만, 즉시 결론 풀이** ('겨울에 태어난 태양 → 즉, ~한 사람')
- **한자 등장 직후 일상어 풀이 동반** ('병화(丙火) — 즉 밝고 활달한 성격')
- 단정 X / 모호 X / 중의 X — 그냥 직접 말하기.

✅ **변환 예시**:
- ❌ '도화살(桃花殺)이 강하게 작용합니다.'
- ✅ '<b>도화살(桃花殺)</b> — 즉 <strong>사람을 끌어당기는 매력</strong>이 강해요.'


🚨 **보일러플레이트 절대 금지 (2026-05-05 audit, 회귀 금지)**

동적 작용해야 하는 콘텐츠 = 사주 8글자마다 매번 다른 문장.

❌ 'X한 해입니다' / '평탄한 한 해' (근거 없는 일반론) — 같은 띠/같은 출생연도면 누구나 동일한 결과 금지.
❌ 주역 괘와 토정비결 괘를 지어내지 말 것 — 근거는 위 확정 월주, 세운, 원국뿐.
✅ 사주 글자 + ${ty}년 세운(${ygz})과의 충돌과 합 직접 호명 (예시 형식: '세운 + 일간 관계', '세운 지지와 일지의 합과 충').
✅ 각 yearOverview 6운 / months 12개의 현대해석 에 사주 8글자 specific 데이터 또는 위 확정 월주와 세운과의 충돌과 합 1회 이상 직접 호명 mandatory.

🚨 **example 사용 룰 (회귀 금지)**:
프롬프트 예시의 사주 글자(병화, 신금, 축미충 등)는 example. 실제 사용자에게는 위 ## 사주 원국 의 진짜 8글자를 인용.
'{유저명}' placeholder 도 위 ## 이름 의 진짜 이름으로 치환.
같은 사주 = 같은 결과 (결정론) / 다른 사주 = 완전히 다른 어휘.


⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
}
//# sourceMappingURL=claudeTojung.js.map