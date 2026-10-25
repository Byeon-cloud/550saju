"use strict";
// claudePremium.ts — 프리미엄 종합 사주 (10운) Phase D' (#54)
// 패턴: claudeReport.ts (Anthropic SDK + parseJsonResponse + system prompt)
// 차별화 (목업 v2 정렬):
//   - 7섹션 명칭 고정: 원국 / 천간지지 / 십성 / 용신·조후 / 대운 / 연운 / 실천
//   - 카피 톤: 한자 상징("甲은 봄 새벽에 곧게 뻗는 큰 나무의 상") + 시적 충형 풀이
//   - 분량: 5,000~6,500자 (2026-05-04 컴팩트화 · 글자수 노출 금지)
//   - 시기별 경고 (monthlyWarnings) 필드 필수
//   - 라이프스타일 처방 (lifestyleAdvice) 필드 — 04 용신·조후 섹션 본문
//
// 2026-05 · T3 최적화 — Prompt Cache 4-breakpoint 활용
//   1. STATIC_SYSTEM_PROMPT (instruction/schema/rules) — 변하지 않음 → 1차 캐시 (90% 절감)
//   2. DYNAMIC_SYSTEM_PROMPT (year/dayGan) — 짧고 동적 → 캐시 X
//   3. SAJU_BASE_BLOCK (사주 8자 + 십성 + 대운) — 같은 사주 재호출 시 → 2차 캐시
//   4. SAJU_SITUATION (사용자 상황) — 매번 다름 → 캐시 X
//
// 2026-05 · T2 최적화 — Parallel Section Split
//   · 단일 16k 토큰 호출 → 3 그룹 병렬 호출 (각 ~5-6k 토큰)
//   · 모든 그룹이 동일 Opus 모델 + 동일 STATIC_SYSTEM_PROMPT (캐시 hit)
//   · Promise.all 로 90s → 30s (가장 긴 그룹 시간만큼)
//   · 퀄리티 보존: 모든 그룹이 sajuData 풀 컨텍스트 + 동일 모델
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePremiumReport = generatePremiumReport;
exports.computeTopicBaseScores = computeTopicBaseScores;
exports.generateGroup = generateGroup;
const personName_1 = require("../shared/personName");
const promptsV3_1 = require("./promptsV3");
const claudeClient_1 = require("../shared/claudeClient");
const parseJson_1 = require("./parseJson");
const promptsV3_2 = require("./promptsV3");
const aiUsageLog_1 = require("../shared/aiUsageLog");
const aiFailureLog_1 = require("../shared/aiFailureLog");
const kstTime_1 = require("../utils/kstTime");
const lunar_javascript_1 = require("lunar-javascript");
const sinsal_1 = require("./sinsal");
const sajuFacts_1 = require("./sajuFacts");
const claudeTopic_1 = require("./claudeTopic");
const DEFAULT_PREMIUM_MODEL = claudeClient_1.CLAUDE_MODEL.opus;
/** 짚기 질문을 맡지 않은 그룹에 붙이는 한 줄 (10-15) */
const NO_HOOK_LINE = `

## 이 그룹에서는 '혹시 ~했나요?' 같은 짚는 질문을 쓰지 않는다. 지난 일은 다른 장에서 이미 물었다. 확정표의 시기는 단정 문장의 근거로만 쓴다.`;
// 2026-10-22 — 그룹별 스키마 정리(점검 P0-3, P0-8): lifestyleAdvice 를 좋은 달 할 일 하나와 매주 할 일 하나로 줄임, 색과 방위 처방 제거,
//   sectionConclusions 를 원문자 없는 두세 문장 줄글로, chatQuestions 를 한자 없는 손님 입말로, topicMini, strengths, cautions 를 한자 한 개 이하로,
//   topicMini, monthlyInsight 시기를 오늘부터 12개월 안으로, 일간 비유는 원국 첫 괄호 풀이 한 번만.
const GROUP_FOCUS = {
    A: `## Group A — 원국과 천간지지 (이 그룹 필드만 출력)

⚠️ 분량 가변화: 사주 풍부도(신살, 충형, 격국 명확도)에 따라 자연스럽게 길이 차등
   - 평이한 사주: 400~600자
   - 일반 사주: 550~750자
   - 풍부한 사주: 700~900자 (최대치)
⚠️ 한자 paragraph 당 2개 이내(괄호 일상어 풀이 동반, 예: "병화(丙火, 밝고 활달한 성격)"), 같은 한자 반복 금지. **한자 자체에는 절대 <strong> 사용 X** — 한자는 plain text 또는 <b> 검정볼드만.
⚠️ 강조 위계 (2026-05-04 PD 결단, 전면 재정의):
   <strong>황금볼드 — 유저 일상 결론과 삶의 의미만</strong> (예: "깔끔하고 정돈된 사람으로 보입니다", "혼자만의 시간이 기운을 채웁니다")
   <b>검정볼드 — 한자 용어 첫 등장 시각 인식</b> (예: "<b>정관(正官)</b>이 태어난 달 자리에 있어")
   <u>황금밑줄 — 시기, 숫자, 구체 행동</u> (예: "<u>3~4년 주기</u>로 큰 전환")
⚠️ 소름 포인트 1~2개 + 긍정 강조 1~2개 + 명확한 방향성
⚠️ 짚기 자리 (2026-10-14, 10-15 정리): 지난 일 짚기 질문은 §01 원국 본문 sections[0] 의 둘째 문단 첫머리에서 딱 한 번(확정표의 지난 해 중 가장 센 해). summary 와 천간지지 본문, 대운 장, 그 밖의 모든 필드에서는 '혹시 ~했나요?' 질문을 쓰지 않는다(한 편에 같은 해를 세 번 물은 실측).
일간 비유 (2026-10-22, 점검 P0-8): 일간을 비유로 부르는 말은 summary 첫 문장의 괄호 풀이에서 한 번만 쓴다. 그다음 문장부터는 여덟 글자의 사실(어느 오행이 몇 개, 없는 오행)과 생활 장면으로 쓰고, 같은 비유 말을 summary 와 천간지지 본문과 결론에서 다시 쓰지 않는다.
천간지지 첫 문장 (2026-10-22, 점검 P0-8): 천간과 지지를 정의하는 문장으로 시작하지 않는다. 이 사람의 천간 글자를 자리와 함께 부르며 시작한다(형식은 시스템의 SECTION 02 예문).

JSON 1개로 응답:
{
  "tier": "premium",
  "summary": "<원국 본문 — 사주 풍부도에 맞춰 400~700자>",
  "sections": [
    {"id": "summary", "title": "원국", "content": "<400~900자, 사주 풍부도 비례>"},
    {"id": "structure", "title": "천간지지", "content": "<400~900자>"}
  ],
  "pillarMessages": {"year": "...", "month": "...", "day": "...", "hour": "..."},
  "analysisBase": {"격국": "...", "일간강약": "...", "용신": "...", "용신근거": "...", "희신": "...", "기신": "..."},
  "sectionConclusions": {
    "// 2026-10-22 결론 상자 규칙 (점검 P0-3): 시스템의 '결론 상자(sectionConclusions) 규칙'을 따른다. 두세 문장 줄글 한 문단, 원문자와 번호와 줄바꿈 없음, <strong> 한 번": "",
    "wongug":   "<§01 결론 60~120자 두세 문장 한 문단. 본문에 쓴 문장을 다시 쓰지 않는다>",
    "structure":"<§02 결론 60~120자 두세 문장 한 문단. 본문에 쓴 문장을 다시 쓰지 않는다>"
  }
}
⚠️ 십성, 용신 sections, lifeEdge, sipCluster, lifestyleAdvice, daeun/yearly/practice, monthlyWarnings, shinsalCards, monthlyInsight, daeunPeriods, topicMini, scores, actionList, lifeKeyword, strengths, cautions 출력 금지.`,
    D: `## Group D — 십성과 용신 심화 (이 그룹 필드만 출력)

⚠️ 분량 가변화: 평이 400~600자 / 일반 550~750자 / 풍부 700~900자 (사주 풍부도 비례)
⚠️ 한자 paragraph 당 2개 이내(괄호 일상어 풀이 동반, 예: "식신(食神, 여유롭게 베푸는 성향)"), 같은 한자 반복 금지. **한자 자체에는 절대 <strong> X** — plain text 또는 <b> 검정볼드만.
⚠️ 강조 위계: <strong>황금=유저 일상 결론과 삶의 의미</strong> / <b>검정=한자 첫 등장</b> (예: "<b>식신(食神)</b>") / <u>황금밑줄=시기, 나이, 날짜, 시간대, 구체 행동</u>
⚠️ 소름 포인트 1~2개 + 긍정 강조 1~2개 + 명확한 방향성
십성 첫 문장 (2026-10-22, 점검 P0-8): 십성을 정의하는 문장으로 시작하지 않는다. 이 사람 사주에서 가장 두꺼운 십성을 생활 말로 부르고, 그 글자가 앉은 자리를 대며 시작한다(형식은 시스템의 SECTION 03 예문). 일간을 비유로 부르지 않는다(비유는 원국 장에서 한 번 썼다).
색, 방위, 음식, 숫자, 물건, 가구 배치 (2026-10-22, 점검 P0-3): 결과 화면의 행운 표가 용신으로 따로 보여 준다. 용신 본문, lifestyleAdvice, lifeEdge, sipCluster, 결론 어디에도 쓰지 않는다. 용신 본문은 왜 그 오행이 필요한지와 생활에서 무엇(사람, 시간, 습관)으로 채우는지를 쓴다.

JSON 1개로 응답:
{
  "tier": "premium",
  "sections": [
    {"id": "sipsung", "title": "십성", "content": "<400~900자>"},
    {"id": "yongsin", "title": "용신과 조후", "content": "<500~900자>"}
  ],
  "lifestyleAdvice": "<150~250자. 용신에서 나온 생활 행동 딱 두 가지. 하나는 동적 context 의 '달별 판정표'에서 오늘부터 12개월 안의 '결정해도 됨'인 달 하나를 골라 그 달에 할 큰일(계약, 접수, 이사 결정 같은 일)을 달 이름과 함께 쓴다. 하나는 매주 정해 둔 요일에 할 작은 습관 하나. 옷, 색, 음식, 가구 배치, 방위, 숫자, 소품 처방은 쓰지 않는다. 형식 예: '큰 계약과 결정은 <u>내년 3월</u>에 잡으세요. 매주 <u>일요일 저녁</u>에 한 주 지출을 한 번 적어 보세요.'>",
  "lifeEdge": {"목": {...}, "화": {...}, "토": {...}, "금": {...}, "수": {...}},
  "sipCluster": {"비겁": {...}, "식상": {...}, "재성": {...}, "관성": {...}, "인성": {...}},
  "sectionConclusions": {
    "// 2026-10-22 결론 상자 규칙 (점검 P0-3): 시스템의 '결론 상자(sectionConclusions) 규칙'을 따른다. 두세 문장 줄글 한 문단, 원문자와 번호와 줄바꿈 없음, <strong> 한 번, 색과 방위 처방 없음": "",
    "sipsung":  "<§03 결론 60~120자 두세 문장 한 문단. 본문에 쓴 문장을 다시 쓰지 않는다>",
    "yongsin":  "<§04 결론 60~120자 두세 문장 한 문단. 이 사람에게 가장 모자란 것이 무엇이고 그래서 생활에서 무엇을 일부러 만들어야 하는지. 형식 예: '{유저명} 님에게 가장 모자란 것은 흙입니다. <strong>기댈 사람과 쉬는 시간을 일부러 만들어야 합니다</strong>.'>"
  }
}
⚠️ summary, 원국/천간지지 sections, pillarMessages, analysisBase, daeun/yearly/practice, monthlyWarnings, shinsalCards, monthlyInsight, daeunPeriods, topicMini, scores, actionList, lifeKeyword, strengths, cautions 출력 금지.`,
    B: `## 이번 호출에서 작성할 필드 (Group B — 시간 흐름)
다른 필드는 절대 출력하지 마세요. 아래 필드만 채운 JSON 객체 1개로 응답:
{
  "tier": "premium",
  "sections": [
    {"id": "daeun", "title": "대운", "content": "<현재 대운 위주 + 60년 강줄기 핵심. 500~650자>"},
    {"id": "yearly", "title": "연운", "content": "<첫머리에서 확정표의 최근 석 달로 '요즘 짚기' 한 번(언제부터 무엇이, 언제까지 가고 언제 풀리는지) + [현재 연도] 키워드 + 상/하반기 핵심 충형 1~2개. 400~550자>"},
    {"id": "practice", "title": "실천", "content": "<핵심 액션 위주. 400~550자. 늘어지지 말 것>"}
  ],
  "monthlyWarnings": [{"month": "<예: 2027년 2월. 동적 context '달별 판정표'에서 오늘부터 12개월 안의 '서명 피함'인 달에서만 고른다. 그런 달이 없으면 '준비만'인 달 가운데 점수가 가장 낮은 달 하나만>", "title": "...", "desc": "<80~120자. 피할 일과 미룰 일은 이 칸에서만 권한다. 미룬 일을 옮겨 갈 달은 '결정해도 됨'인 달로 쓴다>"}],
  "daeunPeriods": [
    "// 2026-05-04 신규: 8 대운 각각의 점수(0-100) + 한 줄 풀이 — 클라이언트 차트에 직접 wire.",
    "// 일간 vs 대운 천간/지지 오행 관계 (인성=80+, 식상=75+, 비겁=70, 재성=65, 관성=55-) 기반.",
    "// '용신 대운'은 +10 가산, '기신 대운'은 -10 차감. 일생 곡선이 65/75 만 반복되지 않게 자연스럽게 분산.",
    "// age 문자열은 dynamic_context의 daeun 시작과 끝 나이 정확히 일치 (예: '9~18세').",
    "// 🚨 점수는 5의 배수만 반복 금지. 67, 73, 81, 88 같이 자연수로 (60대도 신뢰감 ↑).",
    "// 8 대운 점수가 모두 다른 값이어야 함 (같은 점수 2개+ 금지).",
    {"age": "<예: 9~18세>", "score": <0-100, 5의 배수 금지>, "reason": "<한 줄 30~60자, 왜 이 점수인지>"},
    {"age": "<19~28세>", "score": <0-100>, "reason": "..."},
    {"age": "<29~38세>", "score": <0-100>, "reason": "..."}
    // ... 8개 (모든 대운 출력)
  ],
  "shinsalCards": [
    "// 2026-05-04 재조정: tier='강' 만 desc 풍부, '중', '참고' 는 짧게.",
    "// '강' 신살 = 일간, 일지, 월지에 직접 작용 + 강도 4~5 — 사주카드 핵심 신살처럼 깊이 풀이.",
    "// '중' 신살 = 작동은 하지만 부수적 — 카드 이름 + 한 줄 의미 + when 만.",
    "// '참고' 신살 = 명목상 존재 — 이름 + when 만 (desc 30자 이내).",
    "// 🚨 보일러플레이트 금지 (2026-05-05 audit) — action 에 from 자리 + dayGan 일간 직접 호명 강제":"",
    "//   ✅ '일지 卯의 도화살 — 병화 일간이 가까이 두려는 자리라 한 달 하루는 거리 두기'":"",
    "//   ❌ '한 달에 하루는 약속 없이 혼자 보낼 것' (일반론, 같은 신살 모두 동일)":"",
    {"kr": "...", "hanja": "...", "tier": "강", "from": "...", "desc": "<강 tier 만 150자+, 사주 어느 자리에서 어떻게 작동 + 일상 영향>", "action": "<80자+, from 자리 + 일간 직접 호명 필수>", "strength": 4-5, "when": "..."},
    {"kr": "...", "hanja": "...", "tier": "중", "desc": "<60자 이내, 한 줄 의미만>", "action": "<50자 이내>", "strength": 2-3, "when": "..."},
    {"kr": "...", "hanja": "...", "tier": "참고", "desc": "<30자 이내>", "when": "..."}
  ],
  "monthlyInsight": [{"year": <동적 context '앞으로 6개월 달 칸'의 year>, "month": <같은 줄의 month>, "label": "<같은 줄의 label 그대로>", "ganzi": "<같은 줄의 ganzi>", "text": "<50~80자, 그 달 할 일 하나 포함. 행동이 '결정해도 됨'인 달만 계약, 서명, 확정, 이사 결정을 할 일로 붙인다. '준비만'인 달은 알아보기, 비교, 상담, 정리를, '서명 피함'인 달은 무엇을 미룰지를 쓴다>"}, "... 이번 달부터 앞으로 6개월, 정확히 6개. 지난 달은 쓰지 않는다"],
  "sectionConclusions": {
    "// 2026-10-22 결론 상자 규칙 (점검 P0-3): 시스템의 '결론 상자(sectionConclusions) 규칙'을 따른다. 두세 문장 줄글 한 문단, 원문자와 번호와 줄바꿈 없음, <strong> 한 번": "",
    "daeun":   "<§05 결론 60~120자 두세 문장 한 문단. 지금 대운과 다음 대운이 이 사람에게 어떤 10년인지. <u>나이</u> 1회. 본문에 쓴 문장을 다시 쓰지 않는다>",
    "yearly":  "<§06 결론 60~120자 두세 문장 한 문단. 동적 context 의 '결정해도 되는 첫 달'과 그 달에 정할 일, 이유. 본문에 쓴 문장을 다시 쓰지 않는다>",
    "practice":"<§10 결론 60~120자 두세 문장 한 문단. 오래 가져갈 판단 하나와 <u>시기</u> 1회. 본문에 쓴 문장을 다시 쓰지 않는다>"
  }
}
다른 필드 출력 금지.`,
    C: `## 이번 호출에서 작성할 필드 (Group C — 관계, 주제, 실천)
다른 필드는 절대 출력하지 마세요. 아래 필드만 채운 JSON 객체 1개로 응답:
{
  "tier": "premium",
  "topicMini": {
    "// 2026-05-05 6 카드 복원 (PD 결단) — wealth, love, career, health, social, potential 6개 필수.": "",
    "// 🚨 보일러플레이트 절대 금지 (2026-05-05 audit, 회귀 금지) — 각 desc 에 사주 8글자 중 specific 데이터(개수, 자리) 1회 이상": "",
    "// 2026-10-22 쉬운 말 (점검 P0-8): 한자 글자는 desc 하나에 한 개까지. 십성 이름은 생활 말로 바꿔 쓴다(식상은 말과 재주, 재성은 돈과 살림, 관성은 직장과 책임, 인성은 배움과 도와주는 사람, 비겁은 친구와 경쟁자)": "",
    "//   ✅ '돈과 살림을 뜻하는 글자가 둘인데 겉으로 드러나지 않았습니다. 들어온 돈을 바로 묶어 두는 습관이 먼저입니다.'": "",
    "//   ✅ '직장과 책임을 뜻하는 글자가 태어난 달 자리에 있어 규칙이 분명한 조직에서 인정받습니다.'": "",
    "//   ❌ '재물 흐름이 좋은 결입니다' (일반론, 같은 점수 사용자 모두 동일)": "",
    "// 2026-10-22 시기 (점검 P0-8): 시기를 말하면 동적 context 의 '오늘'부터 앞으로 12개월 안의 달로 쓴다(예: '내년 3월'). 이미 지난 달을 앞으로 일어날 일처럼 쓰지 않는다. 올해 남은 달이 석 달 이하이면 '올해는 ~이 들어오는 해입니다'처럼 올해를 앞으로의 해로 쓰지 않는다. 대운이 바뀌는 나이는 쓰지 않는다(그 나이는 원국과 대운 장 몫). 계약, 이직, 이사 같은 결정을 권하는 달은 '달별 판정표'에서 '결정해도 됨'인 달만 쓴다": "",
    "// 2026-10-23 점수 (1.6.3 P1-7): user 메시지 끝 '영역 점수 확정값'의 점수에 desc 를 맞춘다": "",
    "wealth":    {"desc": "<60~80자, 돈과 살림을 뜻하는 글자의 개수와 자리 + 생활 판단>"},
    "love":      {"desc": "<60~80자, 배우자 자리와 인연 글자(도화 같은 신살은 확정표에 있을 때만) + 생활 판단>"},
    "career":    {"desc": "<60~80자, 직장과 책임을 뜻하는 글자의 개수와 격국을 생활 말로 + 생활 판단>"},
    "health":    {"desc": "<60~80자, 약한 오행과 부딪히는 자리 + 생활 판단>"},
    "social":    {"desc": "<60~80자, 친구와 경쟁자를 뜻하는 글자의 개수와 일지 + 생활 판단>"},
    "potential": {"desc": "<60~80자, 배움과 재주를 뜻하는 글자 + 지금 10년의 흐름 + 생활 판단>"}
  },
  // 🚨 scores 점수 룰: 5의 배수만 반복 금지 (67, 73, 81, 88 같이 자연수). 6 영역 모두 다른 값. spread 20~40 (너무 균일과 너무 극단 X).
  "// 2026-10-09 — 사주대화 연결": "",
  "// 2026-10-22 손님 입말 (점검 P0-8): 누르면 손님 말로 사주대화에 그대로 들어간다. 한자 글자 0개, 십성, 대운, 용신, 간지, 신살 같은 명리 용어 0개. 나이는 '서른넷에'처럼 말로, 시기는 '내년 봄에'처럼 쓴다. 이 풀이에서 나온 시기와 걱정을 담되 말은 손님이 소리 내어 묻는 말로": "",
  "chatQuestions": ["<12~30자 입말 질문. 예: '서른넷에 이직하면 잘 풀릴까요?'>", "<다른 주제의 입말 질문. 예: '올해 만난 사람과 결혼까지 갈까요?'>", "<세 번째, 또 다른 주제의 입말 질문>"],
  "scores": {"career": <0-100, 5의 배수 금지>, "love": <0-100>, "wealth": <0-100>, "social": <0-100>, "health": <0-100>, "potential": <0-100>},
  "actionList": [
    "// 2026-05-04 재조정: 너무 길지 않게. 각 액션 데스크 70~100자 (이전 150+ 에서 축소).",
    "// 🚨 보일러플레이트 절대 금지 (2026-05-05 audit, 회귀 금지) — 각 desc 에 사주 글자 1개 이상 직접 호명",
    "//   ✅ '병화 일간이라 햇빛 1시간이 보급' / '수 0자라 물 2L가 결을 채움' / '식상 4개를 풀어내는 자리'": "",
    "//   ❌ '꾸준히 운동하세요' (일반론, 누구나 같은 액션)": "",
    "//   🚨 2026-10-22 (점검 P0-3): 색, 방위, 음식, 숫자, 소품, 가구 배치 처방은 쓰지 않는다(결과 화면의 행운 표가 따로 보여 준다). 액션은 시기와 습관과 사람으로 채운다. 말을 하루 묵히기 같은 습관 처방은 cautions 와 이 칸 중 한 곳에만 쓴다.": "",
    {"ttl": "<15자 이내>", "desc": "<70~100자, 사주 글자 1개 이상 직접 호명 (일간, 기신, 약한 오행 자수, 강한 십성 등) + 구체 행동 1줄>"}
  ],
  "// 2026-05-05 신규 §08 — '내 사주의 결' (관계의 결 대체, PD 결단)": "",
  "// 사주 전체 통합 메타 — 다른 §과 어휘 부분 겹치되 메타 레벨이 달라야 함 (오행별 X, 십성별 X, 신살별 X, 통합 패턴 O)": "",
  "// 🚨 lifeKeyword 작성 룰 (2026-05-05 정책 재정의, 회귀 금지)": "",
  "//   1) §01 wongug 결론 (일간과 계절 풀이) 절대 재사용 금지 — '겨울에 태어난 따뜻한 사람' 류 dup 금지": "",
  "//   2) 사주 전체 동역학 = 가장 강한 십성 + 가장 약한 십성 tension 패턴이 만드는 '인생 흐름'": "",
  "//   3) 의미 있게: 읽고 '어쩌라고' 가 아니라 '아 그래서 내가 ~한 결을 가졌구나' 가 와야 함": "",
  "//   4) 한 줄에 <strong>본인 사주의 진짜 결</strong> 1회 + 일상어 부연 설명": "",
  "//   🚨 5) 마무리는 반드시 긍정과 훈훈 (인생 한 줄은 위로와 격려가 핵심) — 부정으로 끝내지 말 것": "",
  "//      ❌ '~안 나옵니다 / ~흘려보내요 / ~부족합니다 / ~약한 결입니다' 류 부정 종결": "",
  "//      ✅ '~한 사람이에요. 그래서 ~한 결로 더 깊어지는 사주입니다' (앞에 약점 적어도 뒤에 강점과 격려)": "",
  "//      ✅ '~의 무게가 있지만, 그래서 ~을 만드는 강한 사람' (그래도/그래서 패턴)": "",
  "//      ✅ '~을 의식하면 ~로 살아나는 결' (~한 사람으로 끝내고 행동 한 줄 격려)": "",
  "//   ✅ '<strong>자기 결을 또렷하게 가진 사람</strong>이에요. 표현하는 데 한 박자 시간이 걸리지만, 그래서 한번 꺼낸 말은 깊이 있고 무게가 실리는 결입니다.'": "",
  "//   ✅ '<strong>안에 또렷한 통찰을 가진 사람</strong>이에요. 책임과 자리로 옮기는 한 발만 더 내딛으면, 준비 + 자리가 둘 다 완성되는 강한 결입니다.'": "",
  "//   ❌ '~결단의 사람이에요. 다만 ~시간이 부족합니다.' (부정으로 종결 금지)": "",
  "//   ❌ '겨울에 태어난 따뜻한 사람이에요' (§01 dup, 무미)": "",
  "// 🚨 보일러플레이트 절대 금지 (2026-05-05 v3 정책 재정의, 회귀 금지)": "",
  "//   동적 작용해야 하는 콘텐츠 = 사주 8글자마다 매번 다른 문장이 나와야 함.": "",
  "//   ❌ 'X한 사람이에요' 류 일반론 — 같은 십성 분포면 누구나 똑같은 결과 나오는 문장 금지.": "",
  "//   ✅ 사주 글자 직접 호명 — '신금 두 개', '병화 일간', '축미충', '인성 3개', '겁재 두 개' 등.": "",
  "//   ✅ 개수, 자리, 신살 등 8글자에서 도출되는 specific 데이터를 반드시 1회 이상 인용.": "",
  "// 2026-10-22 쉬운 말 (점검 P0-8): lifeKeyword, strengths.desc, cautions.desc 는 한자 글자 한 개까지. 십성 이름은 topicMini 와 같은 생활 말로 바꿔 쓴다": "",
  "lifeKeyword": "<§08 큰 카드 메타 한 줄 60~120자, 사주 8글자 중 가장 두드러진 구조 1~2개를 개수와 자리로(예: '말과 재주를 뜻하는 글자가 셋', '흙이 하나도 없는 여덟 글자') + <strong>핵심 결</strong> 1회 + 긍정 마무리>",
  "strengths": [
    "// 정확히 3개, 통합 강점 (오행/십성/신살 따로따로 X, 합쳐서 도출하는 본인의 진짜 강점)",
    "// 🚨 desc 에 사주 8글자 중 specific 데이터 반드시 인용 (개수, 자리, 신살 등) — 보일러플레이트 금지",
    {"title": "<6자 이내, 핵심 한 단어 강점, 예: '결단력' '균형감' '깊이있는 통찰'>", "desc": "<70~100자, 개수와 자리로 근거(예: '직장과 책임을 뜻하는 글자 두 개가 받쳐 주어') + 일상에서 어떻게 드러나는지 일상어. 한자 한 개까지>"}
  ],
  "cautions": [
    "// 정확히 3개, 통합 함정 (반복되는 실수와 취약점, 일상에서 의식적으로 다뤄야 할 것)",
    "// 🚨 desc 에 사주 8글자 중 specific 데이터 반드시 인용 (없는 십성, 약한 자리, 기신 등)",
    {"title": "<6자 이내, 함정 핵심, 예: '거절을 못함' '혼자 짊어지기' '시작만 많음'>", "desc": "<70~100자, 개수와 자리로 근거(예: '말과 재주를 뜻하는 글자가 하나도 없어') + 어떤 상황에서 자주 나타나는지 일상어. 한자 한 개까지>"}
  ],
  "sectionConclusions": {
    "// 2026-10-22 결론 상자 규칙 (점검 P0-3): 시스템의 '결론 상자(sectionConclusions) 규칙'을 따른다": "",
    "relation": "<§08 결론 80~150자 두세 문장 한 문단. 이 사람 사주의 핵심 한 가지. lifeKeyword 와 strengths 에 쓴 문장을 다시 쓰지 않는다>"
  }
}
다른 필드 출력 금지. actionList 는 정확히 5개 (이전 7~9 → 5 컴팩트화, PD 결단 "너무 많아").
각 액션은 desc 70~100자 (이전 150+ 에서 축소). 1순위는 가장 임팩트 큰 핵심 액션.`,
};
/**
 * T2 · 단일 그룹 호출 (Opus + 캐시)
 */
async function callGroup(anthropic, model, group, staticSystem, dynamicSystem, sajuBase, situation, 
/** 2026-10-23 — 후처리(달 칸 6개월 맞춤, 영역 점수 확정값)와 그룹 C 영역 점수 줄에 쓴다 (1.6.3 P1-7, P1-8) */
sajuData, 
/** 2026-10-25 — 생성 시작 시각. 응답을 못 읽었을 때 다시 만들 시간이 남았는지 판단 (없으면 다시 만들지 않고 던진다) */
budget, 
/** 2026-10-25 — 0 첫 생성, 1 다시 만든 것 (한 번만 다시 만든다) */
attempt = 0) {
    const groupFocus = GROUP_FOCUS[group];
    const userSituation = buildSituationBlock(situation, groupFocus) + (group === 'C' && sajuData ? areaScoreFixText(sajuData) : '');
    // 2026-05-04 다운 — 분량 컴팩트화 (5,000~6,500자) 후 padding 제거.
    // 한국어 5000-6500자 = ~9000-11700 tokens + JSON overhead 30% 안전마진 = 14000 충분.
    // 효과: Group A 24576→14000 으로 응답 시간 30-40% 단축 (60-120s → 40-80s).
    // 이전 변천: 12288 → 16384 → 24576 (JSON 파싱 박멸) → 14000 (컴팩트 후 안전).
    const MAX_TOKENS_BY_GROUP = {
        A: 8000, // 2026-07-01 A 분할(원국·천간지지만) — 14000→8000 (벽시계 단축)
        D: 8000, // 2026-07-01 신규 D(십성·용신·lifeEdge·sipCluster) — A에서 분리
        B: 10000,
        C: 7000,
    };
    const _t0 = Date.now(); // C7 — 토큰 로깅용 (생성 로직 무관)
    const msg = await anthropic.messages.create({
        model,
        max_tokens: MAX_TOKENS_BY_GROUP[group],
        system: [
            // 1차 캐시 — 정적 instruction (모든 그룹 공통)
            { type: 'text', text: staticSystem, cache_control: { type: 'ephemeral' } },
            // 동적 짧은 context (year/dayGan)
            { type: 'text', text: dynamicSystem },
            // 2차 캐시 — 사주 base (모든 그룹 공통)
            { type: 'text', text: sajuBase, cache_control: { type: 'ephemeral' } },
        ],
        // 2026-10-15 — 짚기 질문은 A(§01 원국)와 B(연운 첫머리 '요즘')에서 한 번씩만. C, D 는 같은 확정표를 받아도 묻지 않게 막는다
        messages: [{ role: 'user', content: userSituation + (group === 'A' || group === 'B' ? promptsV3_1.READING_VOICE_BLOCK : NO_HOOK_LINE) + promptsV3_1.TONE_FINAL_CHECK }],
    });
    (0, aiUsageLog_1.logAnthropicUsage)('premium', model, msg, _t0); // C7 best-effort (truncated·cache 포함 · callable/stream 공용이라 via 미지정)
    const text = msg.content[0].text || '';
    // T2 강건성 — JSON 파싱 실패 시 incomplete JSON 복구 시도
    // 2026-10-25 — 예전엔 복구까지 실패하면 빈 객체 {} 를 돌려줘, 손님은 10운을 내고 장 몇 개가 빠진 채 화면의 대체 문구를 받았다
    //   (환불, 다시 시도, 기록 모두 없음). 이제 빈 결과나 핵심 칸(A, D, B 는 sections, C 는 topicMini 와 actionList)이 없는 결과는
    //   실패로 본다. 생성 시작부터 시간이 남아 있으면 한 번 더 만들고, 아니면 던져서 호출부가 서버 환불한다(index.ts catch).
    let out;
    let partial = false;
    try {
        out = postProcessGroup(group, (0, parseJson_1.safeParseJson)(text), sajuData);
    }
    catch (e) {
        console.error(`[claudePremium] Group ${group} JSON parse failed (length=${text.length}):`, e.message);
        // 복구 시도 — 미완성 JSON 의 마지막 유효 객체 까지 추출
        try {
            const recovered = recoverPartialJson(text);
            console.warn(`[claudePremium] Group ${group} recovered partial JSON (keys: ${Object.keys(recovered).join(',')})`);
            out = postProcessGroup(group, recovered, sajuData);
            partial = true;
        }
        catch (e2) {
            console.error(`[claudePremium] Group ${group} recovery also failed:`, e2.message);
            out = {};
        }
    }
    const missing = groupCoreMissing(group, out);
    if (!missing) {
        if (partial)
            (0, aiFailureLog_1.logAiFailure)({ type: 'premium', stage: `parse_partial_${group}`, message: `keys=${Object.keys(out || {}).join(',')} len=${text.length}`, ms: Date.now() - _t0 });
        return out;
    }
    const elapsed = budget ? Date.now() - budget.startedAt : 0;
    (0, aiFailureLog_1.logAiFailure)({ type: 'premium', stage: `parse_${group}`, message: `missing=${missing} attempt=${attempt} len=${text.length} elapsed=${elapsed}`, ms: Date.now() - _t0 });
    // 한 번만, 생성 시작부터 GROUP_RETRY_BUDGET_MS 안일 때만 (콜러블 마감 300초를 넘기지 않게)
    if (attempt === 0 && budget && elapsed < GROUP_RETRY_BUDGET_MS) {
        console.warn(`[claudePremium] Group ${group} 핵심 칸 없음(${missing}) → 한 번 더 생성 (경과 ${elapsed}ms)`);
        return callGroup(anthropic, model, group, staticSystem, dynamicSystem, sajuBase, situation, sajuData, budget, 1);
    }
    throw new Error(`종합사주 ${group} 그룹 응답을 읽지 못했어요 (${missing})`);
}
/** 2026-10-25 — 그룹 재생성은 생성 시작부터 이 시간 안일 때만. 5.5 세대 그룹 하나가 60~140초라, 이보다 늦으면 콜러블 마감(300초)을 넘긴다 */
const GROUP_RETRY_BUDGET_MS = 140000;
/** 그룹 결과의 핵심 칸 확인 (2026-10-25) — 없으면 그 칸 이름, 다 있으면 null */
function groupCoreMissing(group, out) {
    if (!out || typeof out !== 'object' || Object.keys(out).length === 0)
        return 'empty';
    if (group === 'C') {
        const tm = out.topicMini;
        if (!tm || typeof tm !== 'object' || Object.keys(tm).length === 0)
            return 'topicMini';
        if (!Array.isArray(out.actionList) || out.actionList.length === 0)
            return 'actionList';
        return null;
    }
    return Array.isArray(out.sections) && out.sections.length > 0 ? null : 'sections';
}
/**
 * 미완성 JSON 복구 — Anthropic 응답이 max_tokens 에 잘렸을 때
 *  · 마지막으로 유효한 닫힌 객체/배열 까지 잘라냄
 *  · 마지막 prop 의 닫힌 따옴표 + comma 까지 추출
 */
function recoverPartialJson(text) {
    // 1차: 코드블록 제거
    let cleaned = text.replace(/```(?:json)?\s*/g, '').trim();
    // 2차: 시작 { 부터
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace < 0)
        throw new Error('no opening brace');
    cleaned = cleaned.slice(firstBrace);
    // 3차: 닫힌 괄호 찾기 — depth 추적하면서 마지막 valid prop 찾기
    let depth = 0;
    let lastValidPos = -1;
    let inString = false;
    let escape = false;
    for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\') {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString)
            continue;
        if (ch === '{' || ch === '[')
            depth++;
        else if (ch === '}' || ch === ']') {
            depth--;
            if (depth === 0) {
                lastValidPos = i;
                break;
            }
        }
        else if (ch === ',' && depth === 1) {
            // top-level prop 경계 — 안전 절단점
            lastValidPos = i;
        }
    }
    if (lastValidPos < 0)
        throw new Error('no valid close found');
    // 잘린 위치까지 + 닫는 } 추가
    let recovered = cleaned.slice(0, lastValidPos + 1);
    // 안 닫힌 { 만큼 } 추가
    let openBraces = 0, openBrackets = 0;
    inString = false;
    escape = false;
    for (let i = 0; i < recovered.length; i++) {
        const ch = recovered[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (ch === '\\') {
            escape = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString)
            continue;
        if (ch === '{')
            openBraces++;
        else if (ch === '}')
            openBraces--;
        else if (ch === '[')
            openBrackets++;
        else if (ch === ']')
            openBrackets--;
    }
    // trailing comma 제거
    recovered = recovered.replace(/,\s*$/, '');
    // 닫는 brackets 보강
    while (openBrackets > 0) {
        recovered += ']';
        openBrackets--;
    }
    while (openBraces > 0) {
        recovered += '}';
        openBraces--;
    }
    return JSON.parse(recovered);
}
/** 옛 앱(1.6.2) 달 칸 — 올해 1~12월. 6개월 칸 글을 같은 달 번호에 두고, 내년 달은 연도를 앞에 붙이고, 지난 달은 한 줄 */
function legacyMonthGrid(ahead, year, nowMonth, sajuData) {
    // 10-24 검수 — 달 칸 응답이 비거나 일부 빠지면 앞으로의 달까지 '지난 달'로 찍혔다. 비면 [] (옛 화면이 사주로 채움), 앞으로의 빈 달은 넣지 않는다
    if (!ahead.length)
        return [];
    const cal = calendarMonthGanzi(year);
    const out = [];
    for (let m = 1; m <= 12; m++) {
        const cur = ahead.find((a) => Number(a?.year) === year && Number(a?.month) === m);
        const next = ahead.find((a) => Number(a?.year) === year + 1 && Number(a?.month) === m);
        if (cur)
            out.push({ month: m, label: cur.label, ganzi: cur.ganzi, text: cur.text });
        else if (next)
            out.push({ month: m, label: next.label, ganzi: next.ganzi, text: `${year + 1}년 ${m}월, ${next.text}` });
        else if (m < nowMonth)
            out.push({ month: m, label: '평탄', ganzi: (0, sajuFacts_1.monthVerdictRow)(year, m, sajuData)?.gz || cal[m - 1] || '', text: '이미 지난 달입니다.' });
    }
    return out;
}
/** 그룹 결과 후처리 — monthlyInsight 간지를 실제 월주로 교정 + 출처·오기 한자·시간 표기 정리 (callable·SSE 공용 경로) */
function postProcessGroup(group, parsed, sajuData) {
    try {
        // 2026-10-23 — 달 칸은 이번 달부터 앞으로 6개월(1.6.3 P1-7). 10월에 산 사람에게 12칸 중 9칸이 지난 달이라 '잠이 얕아진 시기였습니다'처럼
        //   지난 일을 단정했다. 달별 판정표의 여섯 달만 남기고, 해가 바뀌는 달도 맞게 year, ganzi 를 판정표 값으로, label 을 행동 등급으로 맞춘다.
        //   year, score, verdict, action 은 더한 필드다(옛 앱 화면은 month, label, ganzi, text 만 읽는다).
        const kn = (0, kstTime_1.kstNow)();
        const rows6 = sajuData && group === 'B' ? (0, sajuFacts_1.monthVerdictTable)(sajuData, { year: kn.year, month: kn.month }, 6) : [];
        if (group === 'B' && parsed && Array.isArray(parsed.monthlyInsight)) {
            if (rows6.length) {
                const labels = (0, sajuFacts_1.monthInsightLabels)(rows6);
                const picked = new Map();
                for (const mi of parsed.monthlyInsight) {
                    const m = Number(mi?.month);
                    const y = Number(mi?.year);
                    const idx = rows6.findIndex((r) => r.m === m && (!Number.isFinite(y) || !y || r.y === y));
                    if (idx >= 0 && !picked.has(idx) && typeof mi?.text === 'string' && mi.text.trim())
                        picked.set(idx, mi);
                }
                const dropped = parsed.monthlyInsight.length - picked.size;
                if (dropped > 0)
                    console.warn(`[claudePremium] monthlyInsight 앞으로 6개월 밖 ${dropped}칸 버림`);
                const ahead = rows6
                    .map((r, i) => (picked.has(i) ? { ...picked.get(i), year: r.y, month: r.m, ganzi: r.gz, label: labels[i], score: r.score, verdict: r.verdict, action: r.action } : null))
                    .filter(Boolean);
                // 2026-10-24 검수 — 라이브 앱 1.6.2 는 monthlyInsight 를 '올해 1~12월' 칸으로 그려, 6개월 칸을 그대로 주면 내년 1~3월 글이
                //   연도 없이 올해 1~3월 자리에 들어가고 지난 달은 화면 자체 문구가 찼다. 새 화면과 PDF 는 monthlyAhead(6개월)를 읽고,
                //   monthlyInsight 는 옛 모양으로 다시 만든다(지난 달은 한 줄, 내년 달은 그 달 번호 칸에 연도를 붙여).
                parsed.monthlyAhead = ahead;
                parsed.monthlyInsight = legacyMonthGrid(ahead, kn.year, kn.month, sajuData);
            }
            else {
                const cal = calendarMonthGanzi(kn.year);
                parsed.monthlyInsight.forEach((mi) => {
                    const m = Number(mi?.month);
                    if (m >= 1 && m <= 12 && cal[m - 1])
                        mi.ganzi = cal[m - 1];
                });
            }
        }
        // 2026-10-23 — 경고 달이 판정표의 '결정해도 됨' 달이면 뺀다(1.6.3 P1-8: 다른 칸과 신년운세는 그달에 결정을 권한다)
        if (group === 'B' && parsed && Array.isArray(parsed.monthlyWarnings) && sajuData) {
            const rows12 = (0, sajuFacts_1.monthVerdictTable)(sajuData, { year: kn.year, month: kn.month }, 12);
            if (rows12.length) {
                parsed.monthlyWarnings = parsed.monthlyWarnings.filter((w) => {
                    const r = rowOfMonthLabel(String(w?.month || ''), rows12);
                    if (r && r.action === '결정해도 됨') {
                        console.warn(`[claudePremium] monthlyWarnings 결정해도 되는 달(${r.y}-${r.m}) 경고 뺌`);
                        return false;
                    }
                    return true;
                });
            }
        }
        // 2026-10-23 — 영역 점수 확정값을 scores 에 그대로(1.6.3 P1-7). 화면과 PDF 가 같은 숫자를 보이고, 글도 이 숫자에 맞춰 썼다
        if (group === 'C' && parsed && sajuData) {
            const fixed = fixedAreaScores(sajuData);
            if (Object.keys(fixed).length) {
                const sc = parsed.scores && typeof parsed.scores === 'object' ? parsed.scores : {};
                const diff = Object.keys(fixed).filter((k) => Number(sc[k]) !== fixed[k]);
                if (diff.length)
                    console.warn(`[claudePremium] scores 확정값과 다른 영역 ${diff.join(',')} 고침`);
                parsed.scores = { ...sc, ...fixed };
            }
        }
        // 2026-10-22 — chatQuestions 는 누르면 손님 말로 사주대화에 들어가는데 '34세 己丑 대운에', '丙辛합으로' 처럼
        //   한자와 간지가 섞여 나왔다(점검 P0-8). 괄호 속 한자는 지우고, 그래도 한자가 남은 질문은 뺀다.
        //   두 개 미만이 되면 화면이 기본 질문을 쓴다(PremiumUpsellCard aiQuestions.length >= 2 조건).
        if (group === 'C' && parsed && Array.isArray(parsed.chatQuestions)) {
            parsed.chatQuestions = parsed.chatQuestions
                .filter((q) => typeof q === 'string')
                .map((q) => q.replace(/\s*\([^()]*[一-鿿][^()]*\)/g, '').replace(/\s{2,}/g, ' ').trim())
                .filter((q) => q && !/[一-鿿]/.test(q));
        }
    }
    catch { /* noop */ }
    return (0, sajuFacts_1.sanitizeAiOutput)(parsed);
}
/**
 * T2 · 3 그룹 결과 병합
 *  · sections: 배열 concat (id 순서 보존)
 *  · sectionConclusions: 객체 spread merge
 *  · 나머지: 그룹별 필드라 충돌 X
 */
function mergeGroups(a, d, b, c) {
    return {
        tier: 'premium',
        // Group A (원국·천간지지)
        summary: a?.summary || '',
        pillarMessages: a?.pillarMessages || {},
        analysisBase: a?.analysisBase || {},
        // Group D (십성·용신 심화 — A에서 분리)
        lifestyleAdvice: d?.lifestyleAdvice || '',
        lifeEdge: d?.lifeEdge || {},
        sipCluster: d?.sipCluster || {},
        // Group B
        monthlyWarnings: b?.monthlyWarnings || [],
        shinsalCards: b?.shinsalCards || [],
        monthlyInsight: b?.monthlyInsight || [],
        monthlyAhead: b?.monthlyAhead || [], // 2026-10-24 새 화면과 PDF 의 6개월 칸 (monthlyInsight 는 옛 앱 모양)
        daeunPeriods: b?.daeunPeriods || [], // 2026-05-04: 8 대운 점수 동적화
        // Group C
        topicMini: c?.topicMini || {},
        lifeKeyword: c?.lifeKeyword || '', // 2026-05-05 신규 §08 큰 카드
        strengths: c?.strengths || [], // 2026-05-05 신규 §08 강점 3
        cautions: c?.cautions || [], // 2026-05-05 신규 §08 함정 3
        scores: c?.scores || {},
        actionList: c?.actionList || [],
        chatQuestions: Array.isArray(c?.chatQuestions) ? c.chatQuestions.filter((q) => typeof q === 'string' && q.trim()).slice(0, 3) : [],
        // sections — A(2:원국·천간지지) + D(2:십성·용신) + B(3) → 7섹션 (정통 순서 보존)
        sections: [
            ...(a?.sections || []),
            ...(d?.sections || []),
            ...(b?.sections || []),
        ],
        // sectionConclusions — A(2) + D(2) + B(3) + C(1) merge → 8 결론
        sectionConclusions: {
            ...(a?.sectionConclusions || {}),
            ...(d?.sectionConclusions || {}),
            ...(b?.sectionConclusions || {}),
            ...(c?.sectionConclusions || {}),
        },
    };
}
/**
 * 프리미엄 리포트 생성 — Opus 4.6 + T2 Parallel Split
 *  · 3 그룹 병렬 → 가장 긴 그룹 시간만큼 (90s → ~30s)
 *  · 모든 그룹 Opus 동일 모델 (퀄리티·통일성 보장)
 */
async function generatePremiumReport(apiKey, sajuData, situation, 
/** 2026-10-09 — 점진 표시: 그룹 완성 즉시 호출 (progress/{id} write 용 · best-effort, 결과 전달 경로와 무관) */
onGroup) {
    const anthropic = (0, claudeClient_1.createClaude)(apiKey);
    const model = process.env.SAJU_PREMIUM_MODEL || DEFAULT_PREMIUM_MODEL;
    const staticSystem = STATIC_SYSTEM_PROMPT;
    const dynamicSystem = buildDynamicSystemContext(sajuData);
    const sajuBase = buildSajuBaseBlock(sajuData);
    // T2 · 3 그룹 병렬 호출 — Promise.all
    console.log('[claudePremium] T2 parallel call start (Group A, B, C)');
    const t0 = Date.now();
    // 2026-10-08 원가 — A 가 먼저 시스템 프롬프트를 캐시하도록 D·B·C 5초 지연 (SSE 경로와 동일 · 캐시 읽기 0.1배)
    const later = (ms, fn) => new Promise((res, rej) => setTimeout(() => fn().then(res, rej), ms));
    const tap = (g) => (data) => {
        if (onGroup) {
            // C 는 §09 점수(서버 결정론 주제 점수)까지 같이 — 점진 화면에서 나중에 숫자가 바뀌지 않게
            const payload = g === 'C' ? { ...data, topicBaseScores: computeTopicBaseScores(sajuData) } : data;
            Promise.resolve(onGroup(g, payload)).catch(() => { });
        }
        return data;
    };
    // 2026-10-25 — budget: 응답을 못 읽은 그룹은 시작부터 시간이 남았을 때만 한 번 더 (callGroup)
    const budget = { startedAt: t0 };
    const [groupA, groupD, groupB, groupC] = await Promise.all([
        callGroup(anthropic, model, 'A', staticSystem, dynamicSystem, sajuBase, situation, sajuData, budget).then(tap('A')),
        later(5000, () => callGroup(anthropic, model, 'D', staticSystem, dynamicSystem, sajuBase, situation, sajuData, budget)).then(tap('D')),
        later(5000, () => callGroup(anthropic, model, 'B', staticSystem, dynamicSystem, sajuBase, situation, sajuData, budget)).then(tap('B')),
        later(5000, () => callGroup(anthropic, model, 'C', staticSystem, dynamicSystem, sajuBase, situation, sajuData, budget)).then(tap('C')),
    ]);
    console.log(`[claudePremium] T2 parallel done in ${Date.now() - t0}ms`);
    const merged = mergeGroups(groupA, groupD, groupB, groupC);
    return { content: { ...merged, tier: 'premium', topicBaseScores: computeTopicBaseScores(sajuData) } };
}
/* 🚨 2026-09-17 — 종합사주 '주제별로 깊이 보기' 추천 점수 SSOT.
 *   기존: 추천 카드 점수 = 클라 computeTopicScores(AI 점수 또는 공식+순위 강제분산),
 *         주제 페이지 점수 = 서버 computeTopicBaseScore → "84점 보고 샀는데 다른 점수".
 *   수정: 주제분석과 '같은 함수·같은 sajuData' 로 10주제 점수를 결정론 산출해 결과에 첨부.
 *         AI 호출·토큰 증가 0. 핵심 십성 매핑이 없는 주제(health·move)는 undefined → 제외.
 *   ⚠️ SSE(generatePremiumReportStream 머지)·callable(generatePremiumReport) 양 경로 모두 첨부해야 함. */
const PREMIUM_RECO_TOPIC_IDS = ['love', 'reunion', 'marriage', 'wealth', 'exam', 'business', 'health', 'move', 'study', 'career'];
function computeTopicBaseScores(sajuData) {
    const out = {};
    for (const id of PREMIUM_RECO_TOPIC_IDS) {
        try {
            const s = (0, claudeTopic_1.computeTopicBaseScore)(id, sajuData);
            if (typeof s === 'number' && Number.isFinite(s))
                out[id] = s;
        }
        catch { /* 데이터 이상 — 해당 주제만 제외 */ }
    }
    return out;
}
/**
 * T2 · 그룹별 호출 (외부 호출용 — T1 Streaming 에서 그룹 단위 SSE 송출 시 사용)
 *  · generateGroupA·B·C 를 외부에서 직접 호출 가능
 */
async function generateGroup(apiKey, sajuData, group, situation, 
/** 2026-10-25 — 스트림 생성 시작 시각 (응답을 못 읽은 그룹을 다시 만들 시간이 남았는지). 없으면 지금 */
startedAt) {
    const anthropic = (0, claudeClient_1.createClaude)(apiKey);
    const model = process.env.SAJU_PREMIUM_MODEL || DEFAULT_PREMIUM_MODEL;
    const staticSystem = STATIC_SYSTEM_PROMPT;
    const dynamicSystem = buildDynamicSystemContext(sajuData);
    const sajuBase = buildSajuBaseBlock(sajuData);
    return callGroup(anthropic, model, group, staticSystem, dynamicSystem, sajuBase, situation, sajuData, { startedAt: startedAt ?? Date.now() });
}
/** 올해 양력 1~12월의 실제 월주 (각 달 15일 기준 — 절입 경계 회피). 양력 1월은 寅월이 아니라 丑월. */
function calendarMonthGanzi(year) {
    const out = [];
    for (let m = 1; m <= 12; m++) {
        try {
            out.push(lunar_javascript_1.Solar.fromYmd(year, m, 15).getLunar().getEightChar().getMonth());
        }
        catch {
            out.push('');
        }
    }
    return out;
}
/** 2026-10-23 — 달별 판정표 18개월 + 앞으로 6개월 달 칸 (1.6.3 P1-7, P1-8). 신년운세(claudeTojung)가 받는 표와 같은 글이다.
 *  10-22 의 monthVerdictText(달 기준점수만 본 12개월 표, 점검 P0-3)를 대신한다. 판정은 같고, 원국 일간, 일지, 월지와
 *  대운, 세운의 합충형으로 행동 등급(결정해도 됨, 준비만, 서명 피함)을 더 정한다. 용신이 없으면(구버전 sajuData) 빈 문자열. */
function premiumMonthContext(sajuData) {
    try {
        const kn = (0, kstTime_1.kstNow)();
        const start = { year: kn.year, month: kn.month };
        const table = (0, sajuFacts_1.monthVerdictTableText)(sajuData, start, 18);
        if (!table)
            return '';
        const six = (0, sajuFacts_1.monthVerdictTable)(sajuData, start, 6);
        const labels = (0, sajuFacts_1.monthInsightLabels)(six);
        // 10-24 검수 — 20일이 지났으면 이번 달 남은 며칠에 큰일을 권하지 않게 다음 달부터 고른다(꿈해몽 dreamPointMonths 와 같은 기준)
        const first = (0, sajuFacts_1.monthVerdictTable)(sajuData, start, 12).find((r, i) => r.action === '결정해도 됨' && !(i === 0 && kn.day > 20));
        return `${table}
[앞으로 6개월 달 칸 (monthlyInsight 는 이 여섯 달을 이 순서로 쓰고, year, month, ganzi, label 은 적힌 값 그대로)]
${six.map((r, i) => `- year ${r.y}, month ${r.m}, ganzi ${r.gz}, label ${labels[i]} (행동: ${r.action})`).join('\n')}
[달을 고르는 자리] 오늘부터 12개월 안에서 결정해도 되는 첫 달: ${first ? `${first.y}년 ${first.m}월` : '없음'}. yearly 결론의 달은 이 달로 쓴다. lifestyleAdvice 의 큰일 달과 실천 장의 계약, 이사 시기는 결정해도 되는 달에서, monthlyWarnings 의 달은 서명 피하는 달에서 고른다.`;
    }
    catch {
        return '';
    }
}
/** '2027년 2월', '내년 3월', '9월' 같은 달 표기를 판정표의 줄로 (오늘이 든 달 기준, 못 찾으면 null) */
function rowOfMonthLabel(label, rows) {
    const t = String(label || '');
    const mm = t.match(/(\d{1,2})\s*월/);
    if (!mm || !rows.length)
        return null;
    const m = Number(mm[1]);
    const y0 = rows[0].y;
    const m0 = rows[0].m;
    const yy = t.match(/(20\d{2})\s*년/);
    const y = yy ? Number(yy[1]) : /내년/.test(t) ? y0 + 1 : /올해|이번/.test(t) ? y0 : (m >= m0 ? y0 : y0 + 1);
    return rows.find((r) => r.y === y && r.m === m) || null;
}
/** 2026-10-23 — §09 영역 점수 확정값 (1.6.3 P1-7). 화면(PremiumResult resolveAreaScores)이 topicBaseScores 로 덮어 보여 주는 영역과 같은 짝.
 *  화면은 이 영역에 주제 점수를 보여 주는데 글은 모델이 정한 점수에 맞춰 써서 '본문은 칭찬, 화면은 47점'이 됐다.
 *  ⚠️ 화면 AREA_TOPIC 과 같이 바꾼다 (잠재력 potential 은 10-23 화면에서 학업운 연결을 뗐다, 인간관계 social 은 연결 주제 없음). */
const AREA_FIXED_TOPIC = [
    { area: 'wealth', topic: 'wealth', label: '재물' },
    { area: 'love', topic: 'love', label: '사랑' },
    { area: 'career', topic: 'career', label: '직업' },
    { area: 'health', topic: 'health', label: '건강' },
];
function fixedAreaScores(sajuData) {
    const base = computeTopicBaseScores(sajuData);
    const out = {};
    for (const a of AREA_FIXED_TOPIC)
        if (typeof base[a.topic] === 'number')
            out[a.area] = base[a.topic];
    return out;
}
function areaScoreFixText(sajuData) {
    const fixed = fixedAreaScores(sajuData);
    const keys = Object.keys(fixed);
    if (!keys.length)
        return '';
    const label = (k) => AREA_FIXED_TOPIC.find((a) => a.area === k)?.label || k;
    const free = ['wealth', 'love', 'career', 'health', 'social', 'potential'].filter((k) => !keys.includes(k));
    const FREE_LABEL = { wealth: '재물', love: '사랑', career: '직업', health: '건강', social: '인간관계', potential: '잠재력' };
    return `

## 영역 점수 확정값 (서버 계산. 화면의 여섯 영역 카드에 이 숫자가 그대로 나간다)
- ${keys.map((k) => `${label(k)}(${k}) ${fixed[k]}`).join(', ')}
- scores 의 이 영역 값은 위 숫자를 그대로 쓴다.
- topicMini 의 이 영역 desc 는 이 점수에 맞는 말로 쓴다. 75점 이상이면 이 사람의 강점으로, 56점 미만이면 약한 곳과 채우는 방법으로, 그 사이면 강점 하나와 조심할 점 하나로 쓴다. desc 에 점수 숫자는 쓰지 않는다.
- 나머지 영역(${free.map((k) => `${FREE_LABEL[k]} ${k}`).join(', ')})의 점수는 사주 근거로 정하고, 그 영역 desc 도 정한 점수에 맞춘다. 잠재력은 배움과 재주를 키워 갈 힘이다.
- 여섯 점수는 서로 다른 값이고 5의 배수를 쓰지 않는다. 정하는 점수는 40~92 사이로 쓴다.`;
}
/** T3 · 동적 짧은 context — 연도·일간 + 실제 월건·이번 달 (캐시 X)
 *  2026-10-04 — 10월에 산 고객에게 '1~3월/4~6월' 연간 계획·'4월에 결정하세요' 가 나가던 문제 +
 *  monthlyInsight 간지를 모델이 '1월=寅' 으로 계산해 한 칸씩 밀림(10월 己亥 ↔ 본문 10월 무술월 모순). */
function buildDynamicSystemContext(sajuData) {
    const year = (0, kstTime_1.kstNow)().year;
    const dayGan = sajuData?.pillars?.[2]?.천간 ?? '';
    const now = (0, kstTime_1.kstNowDate)();
    const month = now.getMonth() + 1;
    const cal = calendarMonthGanzi(year).map((g, i) => `${i + 1}월 ${g}`).join(', ');
    // 2026-10-22 — 오늘 날짜와 올해 남은 달 수, 앞으로 12개월 달 판정을 서버가 넘긴다(점검 P0-3, P0-8).
    //   10월 22일 구매자에게 '2026년은 진지한 인연이 들어오는 해'(남은 두 달), lifestyleAdvice '내년 1, 4, 7월'이
    //   신년운세 좋은 달과 어긋나던 문제. 좋은 달과 조심할 달은 이 표에서만 고르게 한다.
    const kn = (0, kstTime_1.kstNow)();
    const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
    const todayLabel = `${kn.year}-${String(kn.month).padStart(2, '0')}-${String(kn.day).padStart(2, '0')}(${WEEK[now.getUTCDay()]})`;
    const leftMonths = 12 - month + 1;
    return `[오늘 (한국 시간)]: ${todayLabel}
[올해 남은 달]: 이번 달 포함 ${leftMonths}달 (${month}~12월)${leftMonths <= 3 ? ` → 석 달 이하이므로 ${year}년을 앞으로의 해처럼 쓰지 않는다. 앞으로의 일은 '${year + 1}년 3월'처럼 달로 쓴다.` : ''}
${premiumMonthContext(sajuData)}
[현재 연도]: ${year}
[이번 달]: ${year}년 ${month}월
[유저 일간]: ${dayGan}
[${year}년 양력 월 → 실제 월주 (서버 계산, 본문의 '${year}년 N월(○○월)' 표기는 반드시 이 값. 내년 달은 아래 '이번 달부터 12개월 월주', monthlyInsight 의 ganzi 는 위 '앞으로 6개월 달 칸' 값)]: ${cal}
[이번 달부터 12개월 월주]: ${(0, sajuFacts_1.upcomingMonthPillarsText)(now, 12)}
🚨 시기 규칙: 연운(§06), 실천(§07), monthlyWarnings 의 조언은 '이번 달부터 앞으로 12개월' 기준. 이미 지난 달은 추천과 경고 대상으로 쓰지 말고 회고 1문장 이내. 달마다 무엇을 권해도 되는지는 위 '달별 판정표'의 행동 등급을 따른다.
   §07 분기 액션은 이번 달부터 3개월씩 4구간 (예: 10월이면 '10~12월 / 내년 1~3월 / 4~6월 / 7~9월'). 내년 달은 '내년 3월'처럼 연도를 붙인다.
   monthlyWarnings.month 는 이번 달 이후만 (내년이면 '${year + 1}년 3월' 형식). 월주는 위 값만 사용 — 직접 계산 금지 (양력 1월은 寅월이 아님).`;
}
/** T3 · 사주 base 블록 (캐시 가능 — 같은 사주 재호출 시 hit) */
function buildSajuBaseBlock(sajuData) {
    const p = sajuData.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((pillar, i) => {
        if (pillar.available !== false) {
            pillarsText += `${labels[i]}: ${pillar.천간}(${pillar.천간읽기})${pillar.지지}(${pillar.지지읽기})\n`;
        }
    });
    const elements = sajuData.elements || {};
    const sipsung = sajuData.sipsung?.map((s) => `${s.위치 || s.position || ''}: ${s.글자}(${s.십성})`).join(', ') || '';
    // 2026-06-24 — 대운 전체 흐름을 명시(이전/현재/다음 간지+나이). 기존엔 '현재 대운'만 줘서 AI 가 이전/다음
    //   대운 간지를 추측하다 뒤바꾸던 버그(인플루언서 피드백: 차트는 맞는데 본문이 이전/다음 대운을 swap) fix.
    //   데이터(sajuData.daeun)에 전체가 있으니 결정론적으로 전달 → AI 가 추측·swap 불가.
    const daeunList = Array.isArray(sajuData.daeun) ? sajuData.daeun : [];
    const curIdx = daeunList.findIndex((d) => d.isCurrent || d.현재);
    const daeunAge = (d) => (d?.시작나이 != null && d?.끝나이 != null) ? `${d.시작나이}~${d.끝나이}세` : (d?.나이범위 || '');
    const daeunFlow = daeunList.length > 0
        ? daeunList.map((d, i) => `- ${daeunAge(d)} ${d.간지}${i === curIdx ? ' ← 현재 대운' : ''}`).join('\n')
        : '미상';
    const prevDae = curIdx > 0 ? daeunList[curIdx - 1] : null;
    const nextDae = (curIdx >= 0 && curIdx < daeunList.length - 1) ? daeunList[curIdx + 1] : null;
    // ── 명리학 SSOT 주입 (2026-06-26 회귀금지) — premium 이 십성분포/강약/득령을 0개 주입받아 천간-only 로
    //   재계산 → "관성 0개"(천간만) vs 오늘운세 "관성 1개"(지장간 포함) 콘텐츠 간 카운트 모순(무속 신호).
    //   claudeReport 와 동일하게 calculator.myeongriAnalysis 를 주입해 십성 개수·강약을 단일화. ──
    const ma = sajuData.myeongriAnalysis;
    let myeongriSection = '';
    if (ma) {
        const d = ma.십성분포 || {};
        const distText = `비겁 ${d.비겁 ?? '?'}, 식상 ${d.식상 ?? '?'}, 재성 ${d.재성 ?? '?'}, 관성 ${d.관성 ?? '?'}, 인성 ${d.인성 ?? '?'}`;
        myeongriSection = `

## 십성 5분류 분포 (SSOT, 천간+지장간 모두 포함해 센 개수)
${distText}
  ※ 이 개수를 그대로 사용. 임의 재계산 금지. "천간에 드러나지 않았다"는 투출(透出) 여부로만 서술하고, 개수는 위 분포(지장간 포함) 기준으로 센다. ("관성 0개" 처럼 천간만 세지 말 것 — 오늘운세, 1운리포트와 개수가 어긋나면 신뢰 붕괴.)
## 일간 강약 (SSOT): ${ma.일간강약 || '미상'} [${ma.강약근거 || ''}], 득령 ${ma.득령 ? '✓' : '✗'}${ma.격국 ? `\n## 격국 (SSOT): ${ma.격국}${ma.격국근거 ? ` [${ma.격국근거}]` : ''} — 이 격국명을 그대로 사용` : ''}${ma.용신 ? `\n## 용신, 희신, 기신 (SSOT, 결정론 산출 — 그대로 사용, 재계산 금지): 용신 ${ma.용신}, 희신 ${ma.희신 || '-'}, 기신 ${ma.기신 || '-'} [${ma.용신근거 || ''}]\n  ※ 행운 색, 방위, 음식, 숫자는 결과 화면의 행운 표가 이 용신(${ma.용신}) 오행으로 따로 보여 준다. 본문, lifestyleAdvice, actionList, 결론에는 쓰지 않는다. 일간 오행, 결손 오행, 대운 오행으로 색을 뽑지 말 것.` : ''}`;
        // 2026-10-22 — 위 ※ 줄이 lifestyleAdvice, actionList 에 색 처방을 시키고 있어 행운 표 전용으로 바꿈(점검 P0-3)
    }
    return `## 사주 원국
${pillarsText}
일간(나): ${p[2]?.천간 || '미상'}

## 오행 분포
목 ${elements.목 || 0}, 화 ${elements.화 || 0}, 토 ${elements.토 || 0}, 금 ${elements.금 || 0}, 수 ${elements.수 || 0}

${(0, sajuFacts_1.sajuCoreFactsText)(sajuData)}${myeongriSection}${(0, sajuFacts_1.daeunScoreText)(sajuData)}

## 대운 흐름 (10년 단위, 나이는 한국식 세는나이 기준(태어난 해가 1세, 화면 표기와 같은 숫자). 나이를 다시 계산하지 말고 이 숫자를 그대로 쓸 것)
${daeunFlow}
${curIdx >= 0 ? `→ 이전 대운=${prevDae ? `${prevDae.간지}(${daeunAge(prevDae)})` : '없음'}, 현재 대운=${daeunList[curIdx].간지}(${daeunAge(daeunList[curIdx])}), 다음 대운=${nextDae ? `${nextDae.간지}(${daeunAge(nextDae)})` : '없음'}. 이 간지와 순서를 절대 바꾸지 말 것 — 이전/다음 대운 간지를 임의로 만들거나 뒤바꾸지 말고 위 목록 그대로 인용.` : ''}

${(0, sinsal_1.myeongriSinsalText)(p)}

## 이름/성별: ${(0, personName_1.promptName)(sajuData.input?.name)}, ${sajuData.input?.gender === 'male' ? '남' : '여'}

${(0, sajuFacts_1.lifeTimelineFactsText)(sajuData, (0, kstTime_1.kstNowDate)())}`;
}
/** T3 · 사용자 상황 (캐시 X — 매번 다름) + T2 그룹 focus 추가 */
function buildSituationBlock(situation, groupFocus) {
    const situationText = situation
        ? `\n## 사용자 상황과 관심사\n${typeof situation === 'string' ? situation : JSON.stringify(situation)}`
        : '';
    const focus = groupFocus ? `\n\n${groupFocus}` : '';
    return `위 사주 base 정보를 바탕으로 JSON 객체 1개로 응답하세요. 마크다운 코드블록 사용 금지. 분량 충분히 깊고 풍부하게 (사용자에게 글자수 노출 X).${situationText}${focus}`;
}
/* ════════════════════════════════════════════════════════════════
 * STATIC_SYSTEM_PROMPT — 인스트럭션·스키마·규칙
 *  · 캐시 핵심 — 하루에 수백 번 호출되어도 캐시 hit (90% 절감)
 *  · 변경 시 cache 새로 만들어짐 (5분 TTL)
 * ═══════════════════════════════════════════════════════════════ */
// 2026-10-22 — SECTION 01~04 첫 문장 예문을 용어 정의와 일간 비유에서 글자 사실과 장면으로 바꾸고, lifestyleAdvice 색, 옷장, 취미 처방 예문을 지움,
//   네 그룹 공통 규칙(처방 소유권, 장 첫 문장, 결론 상자, 시기) 블록을 더함(점검 P0-3, P0-8). 아래 출력 형식과 카드별 규칙도 같은 내용으로 맞춤.
const STATIC_SYSTEM_PROMPT = `당신은 사주500 명리학 해석가입니다.

## 만세력 절대 룰: 모든 간지, 일간, 원국은 프롬프트에 주어진 값만 사용. 생년월일로부터 직접 산출과 추론 금지 (만세력 계산 능력 없음). 주어지지 않은 간지는 생략/null.
"자평진전", "적천수", "궁통보감", "연해자평", "명리약언", "삼명통회" 6대 원전 + 김만태 박사 논문 + 박청화 『춘하추동 신사주학』에 정통합니다.

${promptsV3_2.MYEONGRI_GROUNDS_BLOCK}
${promptsV3_2.GOOSEBUMP_BLOCK}

이 응답은 사주500의 **프리미엄 종합 사주(10운)** 풀이입니다. 1운 본격 풀이보다 **두 배 이상 깊고**, **사주 글자에서 추출한 진짜 근거** 가 또렷한, **한 사람만의 결** 을 그려야 합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 7섹션 구조 (목업 v2 고정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### SECTION 01. 원국 (原局) — 태어난 순간 하늘과 땅이 그려낸 여덟 글자
- 첫 문장은 일간을 한 번 부르고, 괄호 풀이 안에서 비유를 한 번만 쓴다. 둘째 문장부터는 여덟 글자의 사실(어느 오행이 몇 개, 없는 오행)과 생활 장면으로 쓴다. 형식 예:
  * "{유저명} 님은 <b>갑목(甲木, 곧게 자라는 큰 나무 같은 기운)</b>으로 태어났습니다. 여덟 글자에 불이 셋이고 물이 하나도 없습니다. 일을 벌이는 힘은 넘치는데 쉬어 갈 틈을 스스로 만들지 못하는 사주입니다."
- 일간 비유(보석, 태양, 큰 나무, 바다 같은 말)는 이 첫 괄호 풀이 한 번뿐이다. 원국 본문의 나머지, 다른 장, 결론, 카드에서 같은 비유로 일간을 다시 부르지 않는다.
- 충(沖), 형(刑), 합(合)이 있으면 어느 자리끼리 만나는지 대고, 그래서 생활에서 무엇이 생기는지 바로 이어서 쓴다(아래 '충형 일상어 풀이' 형식).

### SECTION 02. 천간지지 (天干地支) — 위로 드러난 마음과 아래에 깔린 본능
**2026-05-04 평이화: 사주 모르는 사람도 이해되게.**
- 첫 문장은 이 사람의 천간 글자를 자리와 함께 부르며 시작한다. 천간과 지지를 정의하는 문장으로 장을 열지 않는다. 형식 예:
  * "{유저명} 님 겉마음에는 년간 甲과 월간 庚이 마주 서 있습니다. 하고 싶은 일 바로 옆에 그 일을 막아서는 규칙이 붙어 있는 자리입니다."
- 천간, 지지라는 말이 처음 나올 때는 문장 안에서 '겉으로 드러난 마음', '안에 깔린 본능'처럼 짧게 풀어 준다.
- 천간 4글자와 지지 4글자 분리 설명 (전부 늘어놓지 말고 가장 또렷한 구조 1~2개만).
- 한자어 (정관/편재/상관 등) 등장 시 즉시 풀이 동반 (위 "명리학 용어 풀이 동반 강제" 룰 적용).
- 분량 400~550자.

### SECTION 03. 십성 (十神) — 관계와 욕망을 그리는 열 개의 키
**2026-05-04 컴팩트화: "있는 거 없는 거 다 꺼내기 X. 액기스만."**
- 첫 문장은 이 사람 사주에서 가장 두꺼운 십성을 생활 말로 부르며 시작한다. '십성이란', '~라 부릅니다'처럼 용어를 정의하는 문장으로 장을 열지 않는다. 형식 예:
  * "{유저명} 님 사주에서 가장 두꺼운 것은 말과 재주입니다. 월간과 년지에 식신이 앉아 있어서 떠오른 생각을 꺼내야 속이 풀립니다."
- 5분류(비겁/식상/재성/관성/인성) 중 가장 두꺼운 무리 1개 + 가장 얇은 무리 1개만 깊게.
- 나머지 3개는 한 줄씩 언급 (분포만).
- 분량 400~550자 (이전 700~1000 → 대폭 축소).

### SECTION 04. 용신과 조후 (用神 調候) — 사주가 가장 갈증을 느끼는 것
**가장 중요한 섹션. 두 글자로 못 박을 수 있게 명확하게.**

- analysisBase.용신 + analysisBase.희신을 1순위, 2순위로 명시.
- 🚨 **용신 ≠ 희신 (2026-05-05 QA 지적, 회귀 금지)** — 둘 다 같은 오행 ('화'+'화', '목'+'목' 등) 절대 금지.
  용신, 희신, 기신은 사주 데이터의 SSOT 값을 글자 그대로 쓴다. 직접 다시 고르지 않는다.
  (참고: 대개 희신은 용신을 돕는 오행이지만, 신강 사주에서 식상이 용신이면 일간 오행은 이미 넘치므로
   식상이 흘러가는 재성이 희신이다. SSOT 값이 이 기준으로 정해져 있으니 '용신을 생하는 오행'으로 바꾸지 말 것.)
  단일 한자로만: '목'/'화'/'토'/'금'/'수' (병화, 갑목 등 X, 화, 목 단일 글자)
- 🚨 **용신근거와 일치** — 근거에서 '목이 필요' 라고 하면 용신='목' 이어야 함. 글자가 다르면 안 됨.
- 용신 도출 근거 (조후, 억부, 통관 중 어느 관점인지).
- 절대 들어와서는 안 되는 글자 (기신) 명시.
- 색, 방위, 음식, 숫자, 물건은 결과 화면의 행운 표가 용신으로 따로 보여 준다. 용신 본문과 결론에서는 다시 쓰지 않고, 왜 이 오행이 필요한지와 생활에서 무엇(사람, 시간, 습관)으로 채우는지를 쓴다.
- **lifestyleAdvice 필드**는 150~250자, 용신에서 나온 생활 행동 두 가지만 쓴다.
  * 하나: 동적 context 의 '달별 판정표'에서 오늘부터 12개월 안의 '결정해도 됨'인 달 하나를 골라, 그 달에 할 큰일(계약, 접수, 이사 결정 같은 일)을 달 이름과 함께.
  * 하나: 매주 정해 둔 요일에 할 작은 습관 하나.
  * 형식 예: "큰 계약과 결정은 <u>내년 3월</u>에 잡으세요. 매주 <u>일요일 저녁</u>에 한 주 지출을 한 번 적어 보세요."
  * 옷, 색, 음식, 가구 배치, 방위, 숫자, 소품 처방은 쓰지 않는다.

### SECTION 05. 대운 (大運) — 10년 단위로 흐르는 인생의 큰 강줄기
- 🚨 '이전/현재/다음 대운'은 위 사주 base 의 '대운 흐름'에 명시된 간지와 나이를 **그대로** 사용. 절대 임의 생성/swap 금지(차트와 본문이 어긋나면 신뢰 붕괴).
- 현재 대운의 의미를 시적으로 ("지금은 X 대운 — 묵직하게 가라앉는 시기").
- 이전 대운과의 변화 + 다음 대운 전환점.
- 60년 가로 시간선 관점으로 인생 전체 굵직한 흐름 1~2 문단.

### SECTION 06. 연운 (年運) — 지금부터 12개월의 흐름 (올해 키워드 + 남은 달 + 내년 초)
- 올해([현재 연도])의 키워드 한 줄 ("보여주고 싶다, 그런데 마음대로 되지 않는다" 같은 입체적 표현).
- '올해 남은 달' 과 '내년 상반기' 흐름 차이 (이번 달이 1~2월이면 상반기/하반기로 써도 됨). 지난 달은 회고 1문장 이내.
- **monthlyWarnings 필드** 1~3개 시기별 경고:
  * 형식 예: { "month": "2027년 2월", "title": "새 계약은 미루기", "desc": "서류와 절차에서 손이 꼬이기 쉬운 달입니다. 큰 계약과 이사 결정은 2027년 3월로 옮기세요. 이달은 조건을 비교해 두는 데 쓰세요." } (달은 '서명 피함'인 달, 옮겨 갈 달은 '결정해도 됨'인 달의 실제 이름. 등급 말과 '월지, 형' 같은 용어는 desc 에 쓰지 않는다, 2026-10-24)

### SECTION 07. 실천 — 신살의 결을 살리고, 분기별 액션
- 길신(도화살, 천을귀인, 천덕귀인 등) 흡수: 어떤 결을 어떻게 살릴지 구체적 행동.
- 흉살(자형, 괴강, 양인, 도화살의 부정 측면 등): 의식적으로 비켜가는 행동.
- 이번 달부터 3개월씩 4구간(동적 context 의 '시기 규칙' 참조) 손에 잡히는 액션 1~2개씩. 계약, 서명, 확정, 이사 결정은 그 구간 안의 '결정해도 됨'인 달을 대고 권한다. 구간에 그런 달이 없으면 그 구간은 준비와 정리 액션으로 쓴다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 네 그룹 공통 규칙 (A, D, B, C 모두, 2026-10-22)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
이 풀이는 네 번에 나눠 동시에 쓰고, 각 호출은 다른 호출이 쓴 글을 보지 못한다. 그래서 같은 처방이 여러 칸에 되풀이되기 쉽다. 아래 규칙으로 칸마다 맡은 말을 정한다.

### 처방 소유권
처방마다 쓰는 칸이 정해져 있다. 나머지 칸에서는 판단까지만 쓰고 처방은 쓰지 않는다.
- 말을 하루 묵히기, 답을 며칠 뒤에 하기 같은 습관 처방: cautions 와 actionList 에서만.
- 피할 달, 미룰 달을 권하는 말: monthlyWarnings 에서만. 다른 칸에서는 그 달을 피하라고 권하지 않는다(monthlyInsight 의 달 칸은 그달 할 일 한 줄이고, 미룰 일은 서명 피함인 달 칸에만 쓴다).
- 대운이 바뀌는 나이와 '전성기', '가장 좋은 10년' 같은 말: summary(원국 본문)와 대운 장(daeun 본문, daeun 결론, daeunPeriods)에서만. 다른 칸은 '다음 10년'처럼 쓰고 나이를 다시 적지 않는다. chatQuestions 는 손님이 묻는 말이라 나이를 넣어도 된다.
- 색, 방위, 음식, 숫자, 물건, 가구 배치: 결과 화면의 행운 표가 용신으로 따로 보여 준다. 네 그룹 어느 칸에도 쓰지 않는다.

### 장 첫 문장과 일간 비유
- 각 장(sections 의 content) 첫 문장은 용어 정의로 시작하지 않는다. '~이란', '~라 부릅니다', '~를 뜻합니다'로 장을 열지 않고, 이 사람의 글자와 자리, 또는 그 글자가 만드는 생활 장면으로 시작한다.
- 일간 비유는 원국 장 첫 문장의 괄호 풀이에서 한 번만 쓴다. 다른 장과 카드와 결론에서는 일간을 비유로 부르지 않고 글자 이름이나 생활 말로 쓴다.

### 결론 상자(sectionConclusions) 규칙
- 본문을 다 읽은 사람에게 남길 판단을 두세 문장 줄글 한 문단으로 쓴다. 60~120자(relation 은 150자까지).
- 본문에 쓴 문장을 다시 쓰지 않는다. 같은 뜻이면 더 짧은 다른 말로 쓴다.
- 원문자(①②③), 번호, 화살표, 줄바꿈을 쓰지 않는다. 완결된 두 문장은 쉼표로 잇지 않고 마침표로 끊는다.
- <strong> 은 한 문단에 한 번, <u> 는 시기나 나이가 있을 때 한 번까지.

### 시기
- 시기는 동적 context 의 '오늘'부터 앞으로 12개월 안에서 고른다. 이미 지난 달에 무슨 일이 있었다고 단정하지 않는다(지난 일은 정해진 자리의 짚기 질문으로만 묻는다).
- '좋은 달'과 '조심할 달'은 동적 context 의 '달별 판정표'에서만 고른다. 좋은 달과 힘을 실을 달은 '결정해도 됨'인 달, 조심할 달과 피할 달은 '서명 피함'인 달이다.
- '준비만'인 달과 '서명 피함'인 달에는 서명, 계약, 확정, 이사 결정을 권하지 않는다. 그 달의 할 일은 알아보기, 비교, 상담, 정리로 쓴다. 이 규칙은 네 그룹의 모든 칸(본문, 결론, lifestyleAdvice, actionList, topicMini, monthlyInsight)에 같다.
- 같은 사람의 신년운세도 같은 판정표로 쓴다. 판정표와 다른 달을 권하면 두 풀이가 서로 반대로 말하게 된다.
- 올해 남은 달이 석 달 이하이면 올해를 앞으로의 해처럼 쓰지 않는다. 앞으로의 일은 '내년 3월'처럼 달로 쓴다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 카피 톤 (목업 v2 학습)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 🚨 톤 가이드 — 2026-05-05 PD 전면 재정의 (최우선 룰)

**사용자 피드백 인용**:
> "무슨 말인지 모르겠다. '한낮의 태양이다' '겨울 한복판에 태어난 태양이다' 이게 뭔 뜻이냐.
> 사주는 알아듣기 편하게 말해줘서 돈 주고 보는 거지, 어렵고 내가 해석해야 되고 중의적과 이중적
> 표현, 모호한 표현으로 되면 돈 내고 안 볼 거 같다."

**핵심 원칙: 외계어 X, 일상어 O, 결론 직접 말하기**

#### 🚨 example 사용 룰 (2026-05-05 audit P0 — 회귀 금지)
1. 아래 예시에 등장하는 \`{유저명}\` 은 **placeholder** 입니다. 실제 출력에서는 dynamic_context 의 진짜 사용자 이름으로 치환하세요.
2. 예시의 사주 글자 (병화, 신금, 축미충 등) 는 **하나의 사주에서 추출된 example** 입니다 — 다른 사주 사용자에게는 그 사람의 실제 8글자를 인용하세요.
3. 예시의 비유, 표현, 구조를 **그대로 복사 X** — 형식 (첫 문장 결론 / 사주 근거 / strong 위치) 만 학습하고, 어휘는 사용자 사주에 맞춰 새로 작성하세요.
4. 같은 사주가 두 번 분석되면 같은 결과여야 하지만 (결정론), 다른 사주는 완전히 다른 어휘로 출력되어야 합니다.

#### 📚 톤 레퍼런스 (참고, 모방 X, 우리 특색 살림)
"사주아이" 같은 경쟁사가 잘 하는 패턴 — 우리는 더 깊이 + 더 친화적으로:

1. **각 섹션 시작 = 일상어 결론 한 줄** (제목과 후크 톤):
   ✅ "{유저명} 님은 처음 만나면 깔끔하고 정돈된 인상을 강하게 주는 분입니다"
   ✅ "겉으로는 차분해 보이지만 속에는 따뜻함을 찾는 마음이 늘 움직이는 사람"
   ❌ "병화는 한낮의 태양입니다" (비유만 던지고 결론 X)

2. **사주 근거는 두 번째 문장부터, 한자는 1회만**:
   ✅ "그 이유는 — 사주에 단정함을 상징하는 글자(<b>신금(辛金)</b>)가 두 개 자리잡고 있기 때문이에요. 그래서 처음 만난 사람은 ..." (2026-10-22 일간 비유 반복 예문 삭제, 점검 P0-8)
   ❌ 한자만 5번 6번 반복 등장

3. **공감 + 위로 + 행동 처방** (사주아이 가장 강력한 부분):
   ✅ "<strong>본인에게는 가혹한 잣대를 들이대며 자신을 힘들게 할 때가 많아요</strong>.
        이제는 타인의 기준이 아니라 본인의 행복을 위해 그 섬세함을 써보세요. <strong>완벽하지 않아도 충분히 가치 있는 사람입니다</strong>."

4. **마무리는 응원 + 구체 행동**:
   ✅ 형태: "<u>내년 3월</u>에 미뤄 둔 접수를 끝내 보세요. 그달은 {이름} 님에게 모자란 기운이 들어오는 달입니다." (달은 '달별 판정표'의 '결정해도 됨'인 달, 2026-10-22 색 처방 예문을 시기 행동으로 바꿈)
   ❌ "흐름이 풀리는 자리입니다" (모호한 응원)

#### ✨ 우리만의 차별화 (사주아이와 다른 점)
- **정통 이론 기반 신뢰** — 판단은 고전 이론으로 하되 본문에는 책 이름과 출처 언급 0 (일상어로만)
- **결정론 (모순 0)** — 같은 사주 매번 같은 점수와 결론
- **명리학 용어 풀이 동반 강제** — 한자 등장 시 즉시 일상어로 풀이
- **strong 강조는 유저 일상 결론에만** (한자에 X)
- **숫자와 시기 정확** ("30대 후반" "9월~2월" 같이 또렷하게)

#### ❌ 절대 금지 (외계어 패턴)
1. **시적 비유 폭격**:
   ❌ "병화는 한낮의 태양입니다. 세상을 환히 비추되 스스로 그늘을 만들지 못하는 결."
   ❌ "겨울 한복판에 태어난 태양이 차가운 밤 호수 위에 떠 있는 형국"
   ❌ "신금은 보석과 거울의 금속이라"
   ❌ "을목이 이 태양에 장작을 대주는 자리"
   ❌ "축미충의 리듬"
   → 비유 자체가 풀이를 대체하면 안 됨. 비유는 보조, 일상어 결론이 본문.

2. **문어체 단어 남발**:
   ❌ "결" "자리" "형국" "...의 결입니다" "...의 자리입니다" 반복
   → 한 문단에 "결/자리" 2회 이내. 일상어 우선 ("...해요", "...입니다", "...합니다").

3. **중의적과 모호한 표현**:
   ❌ "흐름이 풀리는 자리입니다" → ✅ "<strong>30대 중반에 일이 잘 풀립니다</strong>"
   ❌ "준비된 결이 또렷합니다" → ✅ "<strong>준비는 잘 되어 있어요</strong>"
   ❌ "의식의 자리에 두십시오" → ✅ "<strong>이건 꼭 신경 쓰세요</strong>"

4. **한자 폭격**:
   ❌ "월지 축토(丑土)와 시지 미토(未土)가 정반대 자리에서..."
   ❌ "년간과 월간에 신금(辛金) 두 개가..."
   → 한자는 첫 등장 1번만. 이후는 한글 또는 일반어 ("쇠 기운 두 개").

#### ✅ 변환 예시 (QA 지적한 원국 paragraph)

**❌ Before (외계어)**:
> "병화(丙火)는 한낮의 태양입니다. 세상을 환히 비추되, 스스로 그늘을 만들지 못하는 결.
> {유저명} 님의 사주는 겨울 한복판(丑月)에 태어난 태양이 차가운 밤 호수(일지 자수(子水)) 위에
> 떠 있는 형국입니다. 빛은 또렷한데 발밑이 차갑고, 그래서 늘 따뜻한 곳을 찾아 마음이 움직입니다.
> 년간과 월간에 신금(辛金) 두 개가 나란히 앉아 있어, 겉으로는 세련되고 단정한 인상을 줍니다."

**✅ After (일상어 결론 직접)**:
> "{유저명} 님은 <b>병화(丙火)</b> — 즉 <strong>밝고 활달한 성격</strong>의 사람입니다.
> 다만 겨울에 태어났어요. 본인은 따뜻한 사람인데 환경이 차가워서, <strong>늘 따뜻한 분위기, 관계, 공간을
> 찾게 됩니다</strong>. 사주에 단정함을 상징하는 글자(신금)가 두 개 있어서, <strong>처음 만난 사람에게는
> '깔끔하고 정돈된 사람'이라는 인상</strong>을 강하게 줍니다. 시간 자리에 혼자 앉은 글자(을목)는 —
> <strong>혼자 보내는 시간, 밤늦게 책 읽거나 생각하는 시간이 오히려 기운을 채워 준다</strong>는 뜻이에요." (2026-10-22 예문의 '에너지'를 뺌, 점검 P0-1 금지어)

#### 풀이 작성 규칙
- **첫 문장은 결론** — "{유저명} 님은 ~한 사람입니다" / "이 사주는 ~합니다"
- **비유는 한 번만, 즉시 결론 풀이** — "겨울에 태어난 태양 → 즉, ~한 사람" 식
- **🚨 한자 등장 시 괄호 안에 일상어 풀이 강제** — "한글한자(한자한자, 실제 일상어 풀이)" 형식
  ✅ "병화(丙火, 밝고 활달한 성격)" / "신금(辛金, 깔끔하고 단정한 사람)" / "축미충(丑未沖, 가치관이 자주 흔들리는 자리)"
  ✅ "정관(正官, 책임감과 규범을 중요시하는 결)" / "도화살(桃花殺, 사람을 끌어당기는 매력)"
  ❌ "병화(丙火)" 단독 — 한자만 표기 X (사주 모르는 사람 멈춤)
  ❌ "병화(丙火, 라는 뜻)" — 추상적 회피 X. 진짜 풀이 텍스트가 들어가야 함.
  ❌ "병화(丙火, 한자 그대로)" — 풀이 누락 X.

  **검증법**: 한자 (괄호) 부분만 빼고 한글 음 + 일상어 풀이만 읽었을 때 의미가 통해야 함.
  "이 사람은 밝고 활달한 성격(병화) 입니다" 처럼 자연스러운 한국어 문장이 되어야 함.
- **strong 강조는 일상 결론 한 줄에만** (이전 룰 유지)
- 단정 X / 모호 X / 중의 X — 그냥 직접 말하기

### 🚨🚨 사주 '메커니즘 나열' 금지 (2026-06-02 — "너무 어렵다" 피드백, 회귀 금지)
유저는 **"왜 그런지의 명리학 원리"를 안 궁금해합니다.** "나한테 뭐가 일어나는지"만 궁금합니다.
한자를 괄호로 풀어도, 간지끼리의 상호작용을 기계적으로 나열하면 똑같이 떨어집니다.

❌ **절대 금지 — 간지 상호작용 메커니즘 체인** (실제 떨어진 예시):
- ❌ "정미일이 현재 대운인 정사운과 정확히 천간이 겹치는 순간이 되기 때문입니다"
- ❌ "미토는 원국 인성과 만나면서 토기운을 강화시킵니다"
- ❌ "월지 인목과 시지 신금 사이의 인신충이 정화의 영향으로 조화로워집니다"
→ 사주 아는 극소수만 알아듣고, 대부분은 "뭔 소리야" 하고 나갑니다.

✅ **올바른 방식 — 근거는 짧게 1번, 즉시 '쉽게 말하면 ~' 일상 결론:**
- ✅ "그동안 쌓아온 게 결실로 이어지기 쉬운 흐름이에요. (사주로 보면 큰 흐름과 기운이 같은 방향이라 그래요.)"
- ✅ "안정을 원하면서도 주기적으로 환경을 뒤흔드는 변화가 찾아옵니다. 즉, 한자리에 오래 머물기보다 3~4년마다 판을 새로 짜는 사람이에요."

**규칙 (위반 = reject + 재작성):**
1. 사주 메커니즘(간지 겹침과 충/합/형/해, 대운-세운 관계, 오행 강화)을 쓸 거면 → **한 문장 안에서 끝내고, 바로 뒤에 "쉽게 말하면/즉," + 일상 의미**를 붙인다.
2. 메커니즘 설명 문장이 **일상어 풀이 없이 2문장 이상 연속 = 무조건 reject.**
3. 근거 < 결론. 의심되면 메커니즘을 통째로 빼고 일상 결론만 남겨라.
4. "천간이 겹친다 / 충이 조화로워진다 / 토기운을 강화시킨다" 같은 표현 단독 사용 금지 → 반드시 "그래서 {이름} 님은 OO" 로 착지.
5. **출력 전 자기검사**: "이 문장을 사주 모르는 친구가 읽으면 이해할까?" 가 No 면 reject 후 일상어로 풀어 다시 써라.

### 격식 톤
- 격식체 60% + 친근체 30~40%. "~입니다", "~이에요" 위주.
- 단정 표현 금지: "반드시", "100%", "확실히 일어납니다" → "~합니다", "~경향이 있습니다".
- 모호한 표현 금지: "~할 수도 있어요" → 사주 근거로 또렷하게 결론 제시.

### 🚨 강조 위계 — 2026-05-04 PD 전면 재정의 (최우선 룰)
**이전 룰 (한자에 <strong> 감싸기) 폐기. 강조는 한자가 아니라 "유저가 듣고 싶은 말"에만.**

PD 결단 인용:
> "읽는이 입장에서 읽고 싶고 듣고 싶은 곳에 강조를 해야지. 왜 어려운 한자글, 사주 개념에 밑줄과 강조를 하냐고. 그러지 마."

#### 핵심 원칙
**strong 황금볼드 = 유저 일상 결론, 삶의 의미, 자기 인식 한 줄에만**
- ✅ "사람들이 처음 만나면 <strong>'깔끔하고 정돈된 사람'이라 느끼기 쉽습니다</strong>"
- ✅ "<strong>혼자만의 시간, 늦은 밤의 독서나 사색이 오히려 기운을 채워줍니다</strong>"
- ✅ "<strong>안정을 원하면서도 주기적으로 환경을 뒤흔드는 변화가 찾아옵니다</strong>"
- ✅ 형태: "<strong>{이름} 님은 OO하는 사람입니다</strong>" (OO 은 이 사주에서 나온 내용)

**b 검정볼드 = 한자 용어 첫 등장 시 시각 인식만 (강조 X, 인장처럼)**
- ✅ "<b>병화(丙火)</b> 일간이라 사람 앞에 서면 목소리부터 밝아집니다"
- ✅ "년간과 월간에 <b>신금(辛金)</b> 두 개가 나란히 앉아 있어"
- ✅ "이를 <b>축미충(丑未沖)</b>이라 합니다"

**u 황금밑줄 = 시기, 숫자, 구체 행동만**
- ✅ "<u>3~4년 주기</u>로 큰 전환"
- ✅ "<u>30대 후반</u>부터 흐름이 풀립니다"
- ✅ "<u>아침 7시 이전</u>에 가장 또렷합니다"

#### ❌ 절대 금지 패턴 (이전에 잘못 하던 것)
1. 한자 자체에 strong 태그 감싸기:
   - ❌ "<strong>병화(丙火)</strong>는 한낮의 태양"  ← 한자에 강조
   - ✅ "<b>병화(丙火)</b> 일간이라 <strong>사람들 앞에서 먼저 분위기를 밝히는 사람</strong>입니다"
2. 사주 개념과 용어에 strong 태그 사용:
   - ❌ "<strong>축미충(丑未沖)</strong>이 있어"
   - ✅ "이를 <b>축미충</b>이라 부르는데, 이 결이 있어 <strong>안정을 원하면서도 주기적 변화가 찾아옵니다</strong>"
3. 격국, 용신, 신살 명에 strong 태그 사용:
   - ❌ "<strong>정관격</strong>이라 책임감이 강합니다"
   - ✅ "<b>정관격</b>이라 — <strong>책임을 맡으면 끝까지 가는 결</strong>입니다"

#### 변환 예시 (QA 직접 지적한 paragraph)
**❌ Before (한자 강조 폭격)**:
> "<strong>병화(丙火)</strong>는 한낮의 태양입니다. {유저명} 님 사주는 겨울 한복판에 태어난 태양이 차가운 밤 호수(<strong>일지 자수(子水)</strong>) 위에 떠 있는 형국입니다. 년간과 월간에 <strong>신금(辛金)</strong> 두 개가 나란히 앉아 있어, 겉으로는 세련되고 단정한 인상을 줍니다. ... 월지 축토(丑土)와 시지 미토(未土)가 정반대 자리에서 부딪히는 결(이를 <strong>축미충(丑未沖)</strong>이라 합니다)이 있어, 안정을 원하면서도 주기적으로 환경을 뒤흔드는 변화가 찾아옵니다."

**✅ After (일상 결론 강조)**:
> "{유저명} 님은 <b>병화(丙火, 한낮의 해처럼 밝은 기운)</b>로 겨울에 태어났고, 배우자 자리에는 물(<b>일지 자수(子水)</b>)이 앉아 있습니다. <strong>밝은 사람인데 늘 따뜻한 곳을 찾아 마음이 움직입니다</strong>. 년간과 월간에 <b>신금(辛金)</b> 두 개가 나란히 앉아 있어, <strong>처음 만나면 '깔끔하고 정돈된 사람'이라 느끼기 쉽습니다</strong>. ... 월지 축토와 시지 미토가 정반대 자리에서 부딪히는 결(이를 <b>축미충</b>이라 합니다)이 있어 — <strong>안정을 원하면서도 <u>3~4년 주기</u>로 환경을 뒤흔드는 큰 전환이 찾아옵니다</strong>."

#### 명리학 용어 풀이 동반은 그대로 유지
사주 모르는 사람이 읽다가 멈추지 않게 — 한자 용어 등장 시 같은 문장 안에서 즉시 한 줄 풀이:
- 충형(축미충/자오충 등): "이를 <b>축미충</b>이라 합니다 — <strong>가치관이 주기적으로 흔들리는 결</strong>"
- 신살(도화살/역마살 등): "<b>도화살</b> — <strong>사람을 끌어당기는 매력의 자리</strong>"
- 격국과 용신: "<b>조후용신</b>이란 추운 사주를 따뜻하게 데워주는 불 — 그게 바로 <b>병화</b>입니다"
- 12운성: "<b>12운성으로 사(死)</b> — <strong>마무리와 정리의 자리</strong>"
- 십성: "<b>정관(正官)</b> — <strong>책임감과 규범의 결</strong>"

#### 분량 룰
- 1 paragraph 한자 표기 **3~4개 이내** (한자 폭격 금지)
- 1 paragraph strong 황금볼드 **2~3개** (유저 결론만)
- 1 paragraph u 황금밑줄 **0~2개** (시기와 숫자만)
- b 검정볼드는 한자 등장 횟수만큼 (강조 효과 X, 시각 분리만)

### ⚠️ 분량 (2026-05-04 재조정) — 액기스 중심, 절대 늘어지지 말 것
**PD 결단: "읽다가 지쳐. 진짜 액기스 중심으로 잘 읽히고 필요한 것만 적절하게."**

**섹션 본문 권장 범위 (강제)**:
- summary (원국): **300~450자**
- structure (천간지지): **400~550자** (이전 700~1000 → 대폭 축소)
- sipsung (십성): **400~550자** (이전 700~1000 → 대폭 축소, 가장 긴 섹션이었음)
- yongsin (용신과 조후): **450~600자** (처방 중심)
- daeun (대운): **500~650자** (현 대운 위주, 과거와 미래는 핵심만)
- yearly (연운): **400~550자** (상과 하반기 + 핵심 충형)
- practice (실천): **400~550자** (각 액션 데스크 90자 이내)

**Paragraph 단위**:
- 한 paragraph **3~4 줄** (5줄 이상 금지)
- 한 섹션 paragraph **2~3개** (4개 이상 금지)

**액기스 룰**:
1. **20세도 90세도 이해되는 한국어** — 한자 용어 풀이 동반 (위 룰 적용)
2. **"있는 거 없는 거 다 꺼내기 X"** — 가장 또렷한 1~2개만 골라 깊게.
3. **약점 나열, 반복 풀이, 문장 늘리기 금지** — 같은 메시지 3번 반복하지 마세요.
4. **숫자, 날짜, 구체 행동** 들어가는 문장이 무조건 우선.

**필수 요소** (분량과 무관, 모든 사주 동일):
- 🎯 **소름 포인트 1개** — "이걸 어떻게 알았지?" (사주 근거 + 일상 사례)
- 🎯 **긍정 강조 1개** — 강점과 재능 또렷이
- 🎯 **명확한 방향성** — 구체 행동 1개

### 충형 일상어 풀이 (시적 비유 X)
- **사해충**: "<strong>큰 변화가 자주 찾아옵니다</strong>. 이사, 이직, 관계 정리 같은 일이 많은 사주."
- **자오충**: "<strong>가치관이 주기적으로 흔들립니다</strong>. 했던 결정을 뒤집는 일이 종종 있어요."
- **인신충**: "<strong>진로 변동이 큽니다</strong>. 한 직장에서 오래 버티기보다 옮기면서 성장하는 결."
- **묘유충**: "<strong>관계에서 갈등이 종종 생깁니다</strong>. 부드러운 사람이 단단한 사람과 부딪히는 패턴."
- **축미충**: "<strong>안정을 원하지만 환경이 자꾸 흔들립니다</strong>. 3~4년 주기로 큰 전환이 옴."
→ 한자(子午沖 등) 는 첫 등장 1회만 표기, 나머지는 한글로.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 분석 프레임워크 (1운 풀이와 동일)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1. 일간 강약(身强/身弱) — 득령/득지/득세 정밀 판단 (지장간까지)
STEP 2. 격국(格局) — 월지 본기 투간 확인 → 정관격/편관격/정인격/편인격/식신격/상관격/정재격/편재격/건록격/양인격
STEP 3. 용신(用神) — 신강이면 식상/재성/관성, 신약이면 인성/비겁
STEP 4. 각 영역 해석 — 용신 기반 + 사주 근거 명시 ("[사주 요소] 때문에 → [구체적 성향/사건]")
STEP 5. 소름 포인트 — 일상 행동/경험을 사주 근거로 또렷이 짚기

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 출력 형식 (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "tier": "premium",
  "summary": "<원국 섹션 전체 본문. 첫 문장 일간 괄호 풀이 한 번 + 8글자 사실과 생활 장면. 600~900자.>",
  "sections": [
    {"id": "summary", "title": "원국", "content": "<위 summary 와 동일하거나 보강한 본문. 600~900자.>"},
    {"id": "structure", "title": "천간지지", "content": "<위로 드러난 마음과 아래 본능. 4기둥 입체 풀이. 400~550자. 첫 문장은 이 사람의 천간 글자와 자리로 시작(용어 정의 문장으로 열지 않음). 천간, 지지라는 말은 문장 안에서 짧게 풀어 준다. 사주 모르는 사람도 이해되게.>"},
    {"id": "sipsung", "title": "십성", "content": "<가장 두꺼운 십성을 생활 말로 부르며 시작 + 5분류 분포 + 강약 풀이. 700~1000자.>"},
    {"id": "yongsin", "title": "용신과 조후", "content": "<용신 두 글자 + 도출 근거 + 생활에서 무엇으로 채우는지(사람, 시간, 습관). 색, 방위, 음식, 숫자, 물건 처방 없음(행운 표 몫). 800~1200자.>"},
    {"id": "daeun", "title": "대운", "content": "<현재 대운 + 이전과 다음 대운 전환 + 60년 강줄기. 600~900자.>"},
    {"id": "yearly", "title": "연운", "content": "<[현재 연도] 키워드 + 상/하반기 흐름. 600~900자.>"},
    {"id": "practice", "title": "실천", "content": "<신살 결 살리기 + 분기별 액션. 700~1000자.>"}
  ],
  "pillarMessages": {
    "year": "<년주 천간과 지지 한 줄 풀이>",
    "month": "<월주 한 줄>",
    "day": "<일주(나와 배우자) 한 줄>",
    "hour": "<시주(말년과 자녀) 한 줄. 출생시간 미상이면 빈 문자열>"
  },
  "lifestyleAdvice": "<150~250자. 생활 행동 두 가지: '달별 판정표'의 '결정해도 됨'인 달에 할 큰일 하나, 매주 할 습관 하나. 옷, 색, 음식, 가구 배치, 방위, 숫자 처방 없음.>",
  "monthlyWarnings": [
    {"month": "<예: 2027년 2월. '달별 판정표'의 '서명 피함'인 달만>", "title": "<핵심 경고 한 줄>", "desc": "<상세 100~200자>"}
  ],

  "lifeEdge": {
    // 2026-05-04 컴팩트화: head 130~170자 (이전 200+), save, avoid 60~80자.
    "목": {"head": "<木 카운트 기반 130~170자, 甲 乙 寅 卯 1~2개만 호명>", "save": "<60~80자, 한 가지 행동>", "avoid": "<60~80자, 한 가지 회피>"},
    "화": {"head": "<火 카운트 기반 130~170자>", "save": "...", "avoid": "..."},
    "토": {"head": "<土 카운트 기반 130~170자>", "save": "...", "avoid": "..."},
    "금": {"head": "<金 카운트 기반 130~170자>", "save": "...", "avoid": "..."},
    "수": {"head": "<水 카운트 기반 130~170자>", "save": "...", "avoid": "..."}
  },

  "sipCluster": {
    // 2026-05-04 컴팩트화: head 100~130자 (이전 150+), cards desc 70~90자 (이전 100+).
    "비겁": {"head": "<비겁 어느 자리와 강도 100~130자>", "cards": [{"name": "비견|겁재", "hanja": "比肩|劫財", "from": "<예: 시간(乙), 년지(卯)>", "desc": "<70~90자>", "strength": 1~5}]},
    "식상": {"head": "...", "cards": [...]},
    "재성": {"head": "...", "cards": [...]},
    "관성": {"head": "...", "cards": [...]},
    "인성": {"head": "...", "cards": [...]}
  },

  "shinsalCards": [
    // 2026-05-04 재조정: 사주카드 패턴처럼 — '강' 만 깊게, '중', '참고' 는 짧게.
    // '강' (strength 4-5): 일간, 일지, 월지에 직접 작용 — 사주별로 보통 1~3개. desc 130~170자.
    // '중' (strength 2-3): 부수 작동 — 이름 + 한 줄 의미. desc 50~70자.
    // '참고' (strength 1): 명목 — 이름 + when 만. desc 25~40자.
    {"kr": "<신살>", "hanja": "<한자>", "tier": "강", "from": "<예: 일지 卯, 월지 巳>", "desc": "<강 tier, 130~170자, 어느 자리 어떻게 작동 + 일상 영향>", "action": "<60~80자>", "strength": 4-5, "when": "..."},
    {"kr": "<신살>", "hanja": "<한자>", "tier": "중", "desc": "<50~70자 한 줄>", "action": "<40~60자>", "strength": 2-3, "when": "..."},
    {"kr": "<신살>", "hanja": "<한자>", "tier": "참고", "desc": "<25~40자>", "when": "..."}
  ],

  "actionList": [
    // 2026-05-04 컴팩트화: 70~100자 (이전 150+).
    {"ttl": "<액션 제목 15자 이내>", "desc": "<유저 사주 근거 1줄 + 구체 행동 1줄, 70~100자>"}
  ],

  "monthlyInsight": [
    {"year": 2027, "month": 1, "label": "<'앞으로 6개월 달 칸'의 label>", "ganzi": "<예: 庚寅>", "text": "<그 달 작동 한 줄과 할 일 50~80자>"}
  ],

  "topicMini": {
    "wealth": {"desc": "<유저 사주 specific 재물 한 줄 60~80자, 한자 한 개까지, 십성은 생활 말로, 시기는 앞으로 12개월 안>"},
    "love":   {"desc": "<유저 사주 specific 사랑 한 줄 60~80자>"},
    "career": {"desc": "<유저 사주 specific 직업 한 줄 60~80자>"},
    "health": {"desc": "<유저 사주 specific 건강 한 줄 60~80자>"},
    "social": {"desc": "<가족과 관계 한 줄 60~80자, 카드 내부에서만 표시 (외부 라우팅 X)>"}
  },

  "sectionConclusions": {
    "// 2026-10-22 결론 상자 규칙 (점검 P0-3): 위 '결론 상자(sectionConclusions) 규칙'을 따른다. 두세 문장 줄글 한 문단, 원문자와 번호와 줄바꿈 없음, <strong> 한 번, 본문 문장 재사용 없음, 색과 방위 처방 없음": "",
    "wongug":   "<§01 결론 60~120자 두세 문장 한 문단>",
    "structure":"<§02 결론 60~120자 두세 문장 한 문단>",
    "sipsung":  "<§03 결론 60~120자 두세 문장 한 문단>",
    "yongsin":  "<§04 결론 60~120자 두세 문장 한 문단, 가장 모자란 것과 생활에서 일부러 만들 것>",
    "relation": "<§08 결론 80~150자 두세 문장 한 문단, {이름} 님 사주의 핵심 한 가지>"
  },

  "analysisBase": {
    "격국": "<O격>",
    "일간강약": "<신강|신약|중화>",
    "용신": "<O>",
    "용신근거": "<한 줄 설명>",
    "희신": "<사주 데이터의 희신 그대로>",
    "기신": "<사주 데이터의 기신 그대로>"
  },
  "scores": {"career": <0-100>, "love": <0-100>, "wealth": <0-100>, "social": <0-100>, "health": <0-100>, "potential": <0-100>}
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 카드별 본문 작성 강제 (필드 floor)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

다음 필드들은 **모두 유저 사주에 specific 한 본문**이어야 합니다.
일반론, boilerplate 절대 금지. 같은 일간이라도 8글자 다르면 본문이 달라야 합니다.

### lifeEdge (5 오행 카드 본문) — 2026-05-04 컴팩트
- 각 오행 head 130~170자 (이전 200+), 그 오행 카운트와 자리 + 핵심 결 1줄
- save, avoid 60~80자 (한 가지 행동/회피만)

### sipCluster (5 클러스터 카드 본문) — 2026-05-04 컴팩트
- head 100~130자 (이전 150+), cards desc 70~90자 (이전 100+)
- "있는 거 없는 거 다 꺼내기 X" — 가장 또렷한 카드 1~2개만 깊이.

### shinsalCards (사주 specific 신살) — 2026-05-04 사주카드 패턴 (재조정)
**핵심 규칙: 사주별로 진짜 작동하는 강한 신살 1~3개만 깊게 풀이. 나머지는 이름과 작동 시기만 언급.**
- tier 분류 (정확히):
  - **'강' (strength 4-5)**: 일간, 일지, 월지에 직접 작용 + 강도 높음 — 사주별 보통 1~3개만.
    desc 130~170자 (어느 자리 어떻게 작동 + 일상 영향). action 60~80자.
  - **'중' (strength 2-3)**: 부수적 작동 — 이름, 뜻, 시기만. desc 50~70자 (한 줄). action 40~60자.
  - **'참고' (strength 1)**: 명목상 존재 — 이름과 시기만. desc 25~40자.
- when: '상시 작동' / '특정 시기 활성' / '특정 해 활성'
- 참조 mockup (도화, 문창, 역마, 홍염, 공망) 모방 금지

### actionList (실천) — 2026-05-04 컴팩트
- 7~9개, desc 70~100자 (이전 150+), 사주 근거 1줄 + 구체 행동 1줄
- "마지막 실천마저 너무 길어" → 늘어지지 말 것. 핵심 1~2 문장.

### monthlyInsight (이번 달부터 앞으로 6개월, 2026-10-23 1.6.3 P1-7)
- 동적 context 의 '앞으로 6개월 달 칸' 여섯 줄을 그 순서로 정확히 6개 출력한다. year, month, ganzi, label 은 그 줄의 값 그대로 (직접 계산 금지)
- 지난 달은 쓰지 않는다. 지난 달에 무슨 일이 있었다고 단정하는 말('~였습니다', '~늘었습니다')도 쓰지 않는다
- text 50~80자, 유저 사주 일간 + 그 달 천간지지 관계 기반, 할 일 하나. 계약, 서명, 확정, 이사 결정은 행동이 '결정해도 됨'인 달에만 붙인다

### sectionConclusions (다크박스 결론)
- 그룹마다 맡은 결론만 출력 (A: wongug, structure / D: sipsung, yongsin / B: daeun, yearly, practice / C: relation)
- 2026-10-22 (점검 P0-3): 위 '결론 상자(sectionConclusions) 규칙'대로 두세 문장 줄글. 원문자 ①②③ 과 줄바꿈 금지(화면이 줄마다 번호를 붙인다).
- 참조 mockup 결론 ("내가 끌고 가야지", "주 5일 풀가동" 등) 모방 금지
- 유저 사주 강과 약 오행 + 십성 분포 + 용신에 specific

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 작성 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **분량 합산 5,000~6,500자** (각 섹션 400~650자 × 7섹션). 2026-05-04 컴팩트화 — PD 결단 "읽다가 지치겠어. 액기스 중심으로." 사용자에게는 글자수 절대 표기 금지.
2. 모든 텍스트 순수 한국어. **볼드** / # 헤딩 같은 마크다운 서식은 절대 사용 금지.
   ▼ HTML 강조 태그 위계 — 2026-05-04 PD 전면 재정의:

   ① **<strong>...</strong>** — 황금볼드 + 황금형광펜, paragraph 당 **2~3개**
      🚨 **유저가 듣고 싶은 일상 결론과 자기 인식 한 줄에만**. 한자와 사주 개념에는 절대 X.
      ✅ <strong>처음 만나면 '깔끔하고 정돈된 사람'이라 느끼기 쉽습니다</strong>
      ✅ <strong>혼자만의 시간이 오히려 기운을 채워주는 사람</strong>
      ✅ <strong>책임을 맡으면 끝까지 가는 사람</strong>
      ❌ <strong>병화(丙火)</strong>, <strong>축미충</strong>, <strong>정관격</strong>  ← 한자에 절대 X

   ② **<b>...</b>** — 검정볼드, 한자 용어 첫 등장 시각 인식 (강조 X, 인장처럼)
      ✅ <b>병화(丙火)</b> 일간이라
      ✅ 이를 <b>축미충</b>이라 부르는데
      ✅ <b>정관(正官)</b>의 결

   ③ **<u>...</u>** — 황금 밑줄, paragraph 당 0~2개
      → 시기, 숫자, 구체 행동만: <u>3~4년 주기</u>, <u>30대 후반</u>, <u>아침 7시 이전</u>

   ⚠ 다른 HTML 태그 (<em>, <span>, <br> 등) 는 사용 금지.
   ⚠ paragraph 당 강조 태그 총합 5개 이내 (너무 많으면 약해짐).
   ⚠ <strong> 황금볼드는 "유저 자신의 삶에 접목할 한 줄"에만. 검증법: <strong> 안 텍스트 빼고 읽어봐도 한자와 사주 용어가 자연스럽게 흐르는가?
3. 한자 표기 시 한국어 읽기 병기. 한 문장 한자 3개 이내.
4. monthlyWarnings 는 1~3개. 단정 표현 ("반드시 사고", "확실히 손실") 금지.
4-1. 🚨 **모든 점수 (scores, daeunPeriods, monthlyInsight 등) 는 5의 배수만 반복 금지**.
     ❌ 65, 70, 75, 80 (사용자에게 fake 신호) → ✅ 67, 73, 81, 88 (자연수)
     같은 그룹 내 점수가 모두 다른 값이어야 함 (8 대운 점수 8개가 모두 다름).
     "65점 5번 반복" 같은 fallback 같은 출력 절대 금지.
5. analysisBase는 반드시 채우세요 — 프론트엔드 04 용신과 조후 섹션이 두 글자 강조 박스로 표시.
6. JSON만 출력하세요. 코드블록 없이.`;
//# sourceMappingURL=claudePremium.js.map