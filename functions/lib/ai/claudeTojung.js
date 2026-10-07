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
async function generateTojungBigyeol(apiKey, sajuData) {
    const anthropic = new sdk_1.default({ apiKey });
    const prompt = buildPrompt(sajuData);
    const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000, // 2026-09-16 — 8192 는 잘림 위험 구간(대운이 동일 값에서 파손). 천장만 상향(내용 불변).
        temperature: 0.1, // 결정론적 — 같은 사주 = 같은 결과
        messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0].text;
    const parsed = (0, promptsV3_1.parseJsonResponse)(text) || {};
    const ty = tojungTargetYear();
    const ygz = yearPillar(ty);
    // 달 간지·역할은 서버 확정값으로 덮어씀 (모델이 바꿔 써도 화면은 실제 만세력)
    if (Array.isArray(parsed.months)) {
        parsed.months.forEach((m) => {
            const mm = Number(m?.month);
            if (mm >= 1 && mm <= 12) {
                const gz = monthPillar(ty, mm);
                if (gz) {
                    m.괘 = `${gz}(${(0, sajuFacts_1.ganziKo)(gz)})월`;
                    m.괘의미 = (0, sajuFacts_1.ganziRoleText)(gz, sajuData, '달');
                }
            }
        });
    }
    parsed.targetYear = ty;
    parsed.hexagram = {
        yearLabel: `${ty} ${(0, sajuFacts_1.ganziKo)(ygz)}년 · 신년운세`,
        glyph: ygz,
        name: `${(0, sajuFacts_1.ganziKo)(ygz)}년의 ${sajuData?.input?.name || '나'}`,
        oneLine: String(parsed.headline || ''),
        pullQuote: parsed.pullQuote ? String(parsed.pullQuote) : undefined,
    };
    return (0, sajuFacts_1.sanitizeAiOutput)(parsed);
}
function buildPrompt(d) {
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
        return `- ${i + 1}월 ${gz}(${(0, sajuFacts_1.ganziKo)(gz)}) : ${(0, sajuFacts_1.ganziRoleText)(gz, d, '달')}`;
    }).join('\n');
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

## 출력 (JSON만, 코드블록 없이)
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


{
  "headline": "${ty}년을 한 문장으로 (35~50자 · 세운과 원국 관계 근거)",
  "pullQuote": "기억에 남을 짧은 한마디 (20~30자)",
  "fourBox": [
    {"head": "상반기", "value": "6자 내외 핵심", "desc": "20자 내외 근거"},
    {"head": "하반기", "value": "6자 내외 핵심", "desc": "20자 내외 근거"},
    {"head": "좋은 달", "value": "예: 3·6·11월 (확정 월주 '도움' 판정 기준)", "desc": "20자 내외"},
    {"head": "조심할 달", "value": "예: 2·8월 (확정 월주 '부담' 판정 기준)", "desc": "20자 내외"}
  ],
  "keywords": ["#사주핵심키워드1","#키워드2","#키워드3"],
  "categoryScores": {"총운": "0-100 정수", "금전운": "0-100 정수", "건강운": "0-100 정수", "직장운": "0-100 정수", "애정운": "0-100 정수", "결혼운": "0-100 정수"},
  "yearOverview": {
    "총운": "150자 이상 · 🚨 사주 specific + 병오년 호명", "금전운": "150자 이상 · 🚨 재성/식상 직접 호명", "건강운": "150자 이상 · 🚨 약한 오행 직접 호명",
    "직장운": "150자 이상 · 🚨 관성 직접 호명", "애정운": "150자 이상 · 🚨 도화살/배우자궁 직접 호명", "결혼운": "150자 이상 · 🚨 일지/관성 직접 호명"
  },
  "months": [
    {"month": 1, "괘": "(서버가 채움 — 빈 문자열)", "괘의미": "(서버가 채움 — 빈 문자열)",
     "전통해석": "그 달을 한 줄로 (25~40자 · 4자 성어 1개까지 OK · 고풍체 금지 — 읽기 쉬운 한 줄)",
     "현대해석": "100자 이상. 그 달에 실제로 일어날 장면 (직장·연애·돈·건강) + 할 일 1개 · 🚨 위 확정 월주와 원국의 관계 1회 이상 호명",
     "score": 1-100, "keyword": "4~6글자"}, ...12개월 (1월~12월)
  ],
  "luckyAdvice": "100자 이상. 올해 개운법."
}

⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
}
//# sourceMappingURL=claudeTojung.js.map