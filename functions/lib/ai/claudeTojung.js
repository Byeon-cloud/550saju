"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tojungTargetYear = tojungTargetYear;
exports.generateTojungBigyeol = generateTojungBigyeol;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const promptsV3_1 = require("./promptsV3");
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
/* 2026-10-08 — 신년운세 7운 프리미엄화 (오너: "7운 · 퀄리티 좋게").
 *   Sonnet 단일 → Opus 3그룹 병렬 (종합사주와 같은 모델·패턴):
 *     A = 한 해 총평(헤드라인·4박스·6분야 심층·결정 타이밍·개운) · B = 1~6월 · C = 7~12월
 *   달마다 '좋은 날·조심할 날'(일진 × 용신·희신·기신·천을귀인·일지충)과 달 기준 점수는 서버 확정값 →
 *   그룹 간 점수·판정이 엇갈리지 않고, 날짜는 만세력 그대로. */
const NEWYEAR_MODEL = process.env.SAJU_PREMIUM_MODEL || 'claude-opus-4-6';
async function callNyGroup(anthropic, shared, group, ty) {
    const user = nyGroupInstruction(group, ty);
    const MAX = { A: 9000, B: 9000, C: 9000 };
    for (let attempt = 0; attempt < 2; attempt++) {
        const t0 = Date.now();
        const msg = await anthropic.messages.create({
            model: NEWYEAR_MODEL,
            max_tokens: MAX[group],
            temperature: attempt === 0 ? 0.2 : 0.1,
            system: [{ type: 'text', text: shared, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: user }],
        });
        try {
            (0, aiUsageLog_1.logAnthropicUsage)('tojung', NEWYEAR_MODEL, msg, t0);
        }
        catch { /* best-effort */ }
        try {
            const parsed = (0, promptsV3_1.parseJsonResponse)(msg.content[0].text || '');
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
async function generateTojungBigyeol(apiKey, sajuData) {
    const anthropic = new sdk_1.default({ apiKey });
    const ty = tojungTargetYear();
    const ygz = yearPillar(ty);
    const picks = (0, sajuFacts_1.dayPicksForYear)(ty, sajuData);
    const shared = buildPrompt(sajuData, picks);
    const [a, b, c] = await Promise.all([
        callNyGroup(anthropic, shared, 'A', ty),
        callNyGroup(anthropic, shared, 'B', ty),
        callNyGroup(anthropic, shared, 'C', ty),
    ]);
    const months = [...(b.months || []), ...(c.months || [])]
        .filter((m) => Number(m?.month) >= 1 && Number(m?.month) <= 12)
        .sort((x, y) => Number(x.month) - Number(y.month));
    // 달 간지·역할·날짜·점수 앵커는 서버 확정값 (모델이 바꿔 써도 화면은 만세력 그대로)
    months.forEach((m) => {
        const mm = Number(m.month);
        const gz = monthPillar(ty, mm);
        if (gz) {
            m.괘 = `${gz}(${(0, sajuFacts_1.ganziKo)(gz)})월`;
            m.괘의미 = (0, sajuFacts_1.ganziRoleText)(gz, sajuData, '달');
            const base = (0, sajuFacts_1.monthBaseScore)(gz, sajuData);
            const sc = Number(m.score);
            m.score = Number.isFinite(sc) ? Math.max(base - 6, Math.min(base + 6, Math.round(sc))) : base;
        }
        m.goodDays = picks.perMonth[mm]?.good || [];
        m.cautionDays = picks.perMonth[mm]?.caution || [];
    });
    const merged = {
        ...a,
        months,
        keyDates: picks.keyDates,
        targetYear: ty,
        schemaVersion: 2,
    };
    merged.hexagram = {
        yearLabel: `${ty} ${(0, sajuFacts_1.ganziKo)(ygz)}년 · 신년운세`,
        glyph: ygz,
        name: `${(0, sajuFacts_1.ganziKo)(ygz)}년의 ${sajuData?.input?.name || '나'}`,
        oneLine: String(a.headline || ''),
        pullQuote: a.pullQuote ? String(a.pullQuote) : undefined,
    };
    return (0, sajuFacts_1.sanitizeAiOutput)(merged);
}
/** 그룹별 출력 지시 — 공유 컨텍스트(사주·확정값·톤)는 system 에 캐시 */
function nyGroupInstruction(group, ty) {
    if (group === 'A') {
        return `## 이번 응답 = 그룹 A (한 해 총평) 만. months 는 출력하지 마세요 (다른 그룹이 씀).
JSON 만 출력 (코드블록 없이):
{
  "headline": "${ty}년을 한 문장으로 (35~50자 · 세운과 원국 관계 근거 · 결론형)",
  "pullQuote": "기억에 남을 짧은 한마디 (20~30자)",
  "keywords": ["#키워드1","#키워드2","#키워드3"],
  "fourBox": [
    {"head": "상반기", "value": "6자 내외 핵심", "desc": "25자 내외 근거 (확정 월 기준점수·판정 인용)"},
    {"head": "하반기", "value": "6자 내외 핵심", "desc": "25자 내외 근거"},
    {"head": "좋은 달", "value": "기준점수 상위 3~4개 달 (예: 2·3·11·12월)", "desc": "25자 내외"},
    {"head": "조심할 달", "value": "기준점수 하위 2개 달", "desc": "25자 내외"}
  ],
  "categoryScores": {"총운": 정수, "금전운": 정수, "건강운": 정수, "직장운": 정수, "애정운": 정수, "결혼운": 정수},
  "yearOverview": {
    "총운": "400~500자 · 첫 문장 결론 → 세운·그 해 대운이 원국과 만나는 구조(근거 1~2개) → 상반기/하반기 흐름(구체 월) → 올해 가장 중요한 행동 1개",
    "금전운": "350~450자 · 돈이 들어오고 나가는 구체 장면 + 좋은 달·조심할 달(확정값) + 해야 할 것/피할 것",
    "건강운": "300~400자 · 약해지기 쉬운 몸·컨디션 패턴 + 조심할 달 + 생활 습관 1~2개 (의학적 진단 단정 금지)",
    "직장운": "350~450자 · 일·이직·평가·인간관계 장면 + 움직이기 좋은 달/버틸 달",
    "애정운": "350~450자 · 성별 기준(여성=관성, 남성=재성이 연인의 별) · 솔로/연애 중 둘 다 읽히게 · 인연이 들어오는 달",
    "결혼운": "300~400자 · 결혼·동거·관계 진전 흐름 · 단정 대신 조건과 시기"
  },
  "turningPoints": [
    {"when": "예: 2~3월", "title": "15자 내외 (결정·이동·관계 중 하나)", "desc": "120~180자 · 왜 이때인지(확정 월주 근거) + 무엇을 하면 좋은지"},
    {"when": "...", "title": "...", "desc": "..."},
    {"when": "...", "title": "...", "desc": "..."}
  ],
  "luckyAdvice": "300~400자 · 용신 기준 개운 습관 (색·방위·숫자는 상징으로 가볍게) + 꼭 기억할 날(확정값) 활용법"
}
점수 규칙: 0~100 정수, 5의 배수만 반복 금지, 분야마다 다른 값.
성별은 해석에만 반영 — '○○ 님은 여성이므로/남성이라' 같은 성별 설명 문장은 쓰지 말 것.`;
    }
    const range = group === 'B' ? [1, 6] : [7, 12];
    const monthsList = Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i).join('·');
    return `## 이번 응답 = 그룹 ${group} (${monthsList}월) 만. 총평·다른 달은 출력하지 마세요 (다른 그룹이 씀).
JSON 만 출력 (코드블록 없이):
{
  "months": [
    {"month": ${range[0]},
     "keyword": "4~6글자 (그 달의 핵심)",
     "score": "확정 '달 기준점수' ±4 안의 정수",
     "전통해석": "그 달을 한 줄로 (25~40자 · 읽기 쉬운 결론 · 4자 성어 1개까지 OK)",
     "현대해석": "300~400자 · ① 그 달 실제로 일어날 장면 2개(일·돈·관계·몸 중 두드러진 것) ② 근거: 확정 월주와 원국의 관계 1회 호명(괄호로 쉬운 풀이) ③ 이 달 '좋은 날'·'조심할 날'(확정값) 중 1~2개를 날짜로 언급하며 그날 무엇을 하면 좋은지",
     "todo": "이 달 꼭 할 일 한 문장 (40자 내외 · 구체 행동)",
     "avoid": "이 달 피할 일 한 문장 (40자 내외)"
    }, ... ${monthsList}월 모두 (${range[1] - range[0] + 1}개)
  ]
}
규칙: 달마다 다른 장면·다른 조언 (같은 문장 반복 금지) · 날짜는 확정값에 있는 것만 · 점수는 기준점수 ±4.`;
}
function buildPrompt(d, picks) {
    const p = d.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((x, i) => { if (x.available !== false)
        pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`; });
    const el = d.elements || {};
    const sipsung = d.sipsung?.map((s) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
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
        const days = pm ? ` · 좋은 날 ${pm.good.join(', ') || '없음'} · 조심할 날 ${pm.caution.join(', ') || '없음'}` : '';
        return `- ${i + 1}월 ${gz}(${(0, sajuFacts_1.ganziKo)(gz)}) : ${(0, sajuFacts_1.ganziRoleText)(gz, d, '달')} · 달 기준점수 ${(0, sajuFacts_1.monthBaseScore)(gz, d)}${days}`;
    }).join('\n');
    const keyDatesFact = (picks?.keyDates || []).map((k) => `${k.date} (${k.why})`).join(' · ');
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
    return `당신은 사주500 신년운세 해석가. ${promptsV3_1.MYEONGRI_GROUNDS_BLOCK}

${ty}년 ${yko}(${ygz})년 신년운세 — 사주 원국 + ${ty}년 세운·열두 달 월운에서 추출한 진짜 근거.

⚠️ 현재 날짜: ${dateStr} · 분석 대상: ${ty}년 1월~12월 (양력)

## 🚨 ${ty}년 확정값 (서버 계산 · 직접 계산 금지 · 이 값과 다른 간지·역할 서술 금지)
- ${ty}년 세운: ${(0, sajuFacts_1.ganziRoleText)(ygz, d, '해')}
- ${ty}년의 대운: ${tyDaeun?.간지 ? `${tyDaeun.간지}(${(0, sajuFacts_1.ganziKo)(String(tyDaeun.간지))}) 대운 · ${(0, sajuFacts_1.ganziRoleText)(String(tyDaeun.간지), d, '해')}` : '미상'}
- 열두 달 월주 (양력 달 기준 · 1월은 寅월이 아니라 丑월):
${monthsFact}
- 한 해 꼭 기억할 날 (서버 계산): ${keyDatesFact || '없음'}
- 날짜 판정 기준: 그날 일진이 용신·희신이면 좋은 날, 기신이 강하거나 일지와 충이면 조심할 날 (천을귀인 날 가점). 날짜는 위 값만 인용 — 새 날짜를 만들지 말 것.
- 귀인·신살이 걸리는 달 (원국에 '없음'인 신살은 '있다'고 쓰지 말 것):
${gwiin || '미산출'}
→ 각 달 score·keyword·풀이는 위 '도움/부담' 판정과 원국 형충합을 근거로. 판정이 '부담'인 달을 최고점으로 쓰지 말 것.

## 사주 원국
${pillarsText}일간: ${p[2]?.천간 || '미상'}

## 오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
## 십성: ${sipsung || '미상'}

## 대운 흐름 (10년 단위 · 나이는 만 나이 기준)
${daeunFlow}
${curIdx >= 0 ? `→ 이전 대운=${prevDae ? `${prevDae.간지}(${daeunAge(prevDae)})` : '없음'} · 현재 대운=${daeunList[curIdx].간지}(${daeunAge(daeunList[curIdx])}) · 다음 대운=${nextDae ? `${nextDae.간지}(${daeunAge(nextDae)})` : '없음'}. 이 간지·순서를 절대 바꾸지 말 것 — 이전/다음 대운 간지를 임의로 만들거나 뒤바꾸지 말고 위 대운 흐름 목록의 간지를 그대로 인용. swap 절대 금지.` : ''}

## 이름: ${d.input?.name || '미상'}, ${d.input?.gender === 'male' ? '남' : '여'}, ${d.input?.birthYear || ''}년생${d.띠 ? `, ${d.띠}띠` : ''}

## 출력 형식은 user 메시지의 그룹 지시를 따른다 (JSON만, 코드블록 없이)
⚠️ **점수 필드 룰 (2026-05-04 PD 결단)**: 모든 score (categoryScores·subScores·overallScore·monthlyScore·compatScore·careerScore 등) 는 **5의 배수만 반복 금지**. 65·70·75·80 같은 fake 신호 X. 67·73·81·88 같이 자연수로 출력. 같은 카테고리 안 점수가 모두 다른 값이어야 함.

🚨 **톤 룰 (2026-05-05 PD 결단 — 외계어 X · 일상어 O)**

사용자 피드백:
> '무슨 말인지 모르겠다. 한낮의 태양이다 / 겨울 한복판에 태어난 태양이다 / 형국이다 — 이게 뭔 뜻이냐.
>  사주는 알아듣기 편하게 말해줘서 돈 주고 보는 거지, 어렵고 모호한 표현이면 돈 안 낸다.'

❌ **절대 금지 패턴**:
1. 시적 비유 폭격: '한낮의 태양' '차가운 밤 호수' '장작을 대주는 자리' '~의 형국' — 비유가 풀이를 대체 X.
2. 문어체 단어 남발: '결' '자리' '형국' 한 문단 2회 이내.
3. 중의적·모호한 표현: '흐름이 풀리는 자리' → '30대 중반에 일이 잘 풀립니다'
   '준비된 결이 또렷' → '준비는 잘 되어 있어요' / '의식의 자리에 두십시오' → '꼭 신경 쓰세요'
4. 한자 폭격: 한자(丙火·신금·축미충 등) 첫 등장 1번만, 이후는 한글 또는 일상어.

📚 **"사주아이" 톤 레퍼 (참고 · 모방 X · 우리 특색 살림)**:
1. **각 섹션 시작 = 일상어 결론 한 줄** (제목 후크 톤)
   ✅ '겉으로는 차분해 보이지만 속에는 따뜻함을 찾는 마음이 늘 움직이는 분입니다'
2. **사주 근거는 두 번째 문장부터, 한자는 1회만** + 즉시 일상어 풀이
3. **공감 + 위로 + 행동 처방** (가장 강력)
   ✅ '<strong>본인에게는 가혹한 잣대를 들이대요</strong>. 이제는 본인 행복을 위해 그 섬세함을 써보세요. <strong>완벽하지 않아도 충분히 가치 있는 사람입니다</strong>.'
4. **마무리 = 응원 + 구체 행동** (행운 색·방위·시기 등 구체)

🚨 **한자 풀이 형식 강제 (2026-05-05 PD 결단 — '라는 뜻' 같은 회피 X)**:
한자 등장 시 괄호 안에 **실제 일상어 풀이 텍스트** 동반:
✅ '병화(丙火, 밝고 활달한 성격)' / '신금(辛金, 깔끔하고 단정한 사람)' / '축미충(丑未沖, 가치관이 자주 흔들리는 자리)'
✅ '정관(正官, 책임감과 규범을 중요시하는 결)' / '도화살(桃花殺, 사람을 끌어당기는 매력)'
❌ '병화(丙火)' 단독 — 풀이 X
❌ '병화(丙火, 라는 뜻)' / '병화(丙火, 한자 그대로)' — 추상적 회피 X. 진짜 풀이 텍스트.
검증법: 한자 (괄호) 부분만 빼고 일상어만 읽었을 때 자연스러운 한국어 문장이 되어야 함.


🚨 **어조 규칙 (2026-06-24 · 인플루언서 피드백 — 출력 본문 전체에 절대 준수)**
1. **애매·면피 표현 전면 금지**: "~일 수 있습니다 / ~인 편입니다 / ~경향이 있습니다 / ~듯합니다 / ~것 같습니다 / ~수도 있습니다" 류 0건. 모든 문장을 확신 있는 단정형으로 끝낸다.
2. **단정형**: "당신은 ~한 사람입니다." "이 시기는 ~한 때입니다."
3. **과거 적중(소름 훅)**: "혹시 예전에 ~한 일이 있지 않았나요?" "유독 ~할 때 ~하지 않으셨나요?" — 독자가 "어? 내 얘기네?" 하게.
4. **명령형 솔루션**: "앞으로는 이렇게 하세요." "~는 피하고 ~를 선택하세요." (애매한 권유 X, 분명한 지시 O)
5. **루즈함 차단**: 같은 메시지를 앞·중간·끝에서 반복 금지. 각 단락은 새 정보. 구구절절·동어반복 금지.


✨ **우리만의 차별화**:
- 고전 근거는 내부 판단용 — 본문에 책 이름·학파·'고서에 따르면' 언급 금지
- 결정론 (같은 사주 = 같은 결과)
- 한자 1회 등장 시 즉시 일상어 풀이 동반
- strong 강조는 유저 일상 결론에만
- 숫자·시기 또렷이 ('30대 후반' '9월~2월')


✅ **풀이 작성 규칙**:
- **첫 문장은 결론** ('{유저명} 님은 ~한 사람입니다')
- **비유는 한 번만, 즉시 결론 풀이** ('겨울에 태어난 태양 → 즉, ~한 사람')
- **한자 등장 직후 일상어 풀이 동반** ('병화(丙火) — 즉 밝고 활달한 성격')
- 단정 X / 모호 X / 중의 X — 그냥 직접 말하기.

✅ **변환 예시**:
- ❌ '도화살(桃花殺)이 강하게 작용합니다.'
- ✅ '<b>도화살(桃花殺)</b> — 즉 <strong>사람을 끌어당기는 매력</strong>이 강해요.'


🚨 **보일러플레이트 절대 금지 (2026-05-05 audit · 회귀 금지)**

동적 작용해야 하는 콘텐츠 = 사주 8글자마다 매번 다른 문장.

❌ 'X한 해입니다' / '평탄한 한 해' (근거 없는 일반론) — 같은 띠/같은 출생연도면 누구나 동일한 결과 금지.
❌ 주역 괘·토정비결 괘를 지어내지 말 것 — 근거는 위 확정 월주·세운·원국뿐.
✅ 사주 글자 + ${ty}년 세운(${ygz})과의 충돌·합 직접 호명 (예시 형식: '세운 + 일간 관계', '세운 지지와 일지의 합·충').
✅ 각 yearOverview 6운 / months 12개의 현대해석 에 사주 8글자 specific 데이터 또는 위 확정 월주·세운과의 충돌·합 1회 이상 직접 호명 mandatory.

🚨 **example 사용 룰 (회귀 금지)**:
프롬프트 예시의 사주 글자(병화·신금·축미충 등)는 example. 실제 사용자에게는 위 ## 사주 원국 의 진짜 8글자를 인용.
'{유저명}' placeholder 도 위 ## 이름 의 진짜 이름으로 치환.
같은 사주 = 같은 결과 (결정론) / 다른 사주 = 완전히 다른 어휘.


⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
}
//# sourceMappingURL=claudeTojung.js.map