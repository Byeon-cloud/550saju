"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTojungBigyeol = generateTojungBigyeol;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        yearOverview: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                총운: { type: generative_ai_1.SchemaType.STRING }, 금전운: { type: generative_ai_1.SchemaType.STRING },
                건강운: { type: generative_ai_1.SchemaType.STRING }, 직장운: { type: generative_ai_1.SchemaType.STRING },
                애정운: { type: generative_ai_1.SchemaType.STRING }, 결혼운: { type: generative_ai_1.SchemaType.STRING },
            } },
        months: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    month: { type: generative_ai_1.SchemaType.NUMBER }, score: { type: generative_ai_1.SchemaType.NUMBER },
                    keyword: { type: generative_ai_1.SchemaType.STRING }, interpretation: { type: generative_ai_1.SchemaType.STRING },
                } } },
        luckyAdvice: { type: generative_ai_1.SchemaType.STRING },
    },
};
async function generateTojungBigyeol(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 },
        thinkingConfig: { thinkingBudget: 0 },
    });
    const r = await model.generateContent(buildPrompt(sajuData));
    return JSON.parse(r.response.text());
}
function buildPrompt(d) {
    const p = d.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((x, i) => {
        if (x.available !== false)
            pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`;
    });
    const el = d.elements || {};
    const sipsung = d.sipsung?.map((s) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
    const currentDaeun = d.daeun?.find((x) => x.isCurrent || x.현재);
    const now = new Date().getMonth() + 1;
    return `당신은 토정비결의 대가입니다. 토정 이지함 선생의 전통을 잇는 정통 토정비결을 작성하세요.
"돈 주고 본 것 같아. 소름돋아." 수준의 퀄리티.

## 토정비결이란
조선 중기 토정 이지함(1517~1578)이 창시한 점술서. 태세(太歲), 월건(月建), 일진(日辰)의 3수(三數)를 조합하여 한 해의 운세를 예측합니다. 사주명리와 결합하면 더 정밀한 해석이 가능합니다.

## 이 사람의 사주 원국
${pillarsText}일간(나): ${p[2]?.천간 || '미상'}

## 오행 분포
목(木): ${el.목 || 0}, 화(火): ${el.화 || 0}, 토(土): ${el.토 || 0}, 금(金): ${el.금 || 0}, 수(水): ${el.수 || 0}

## 십성 배치
${sipsung || '미상'}

## 현재 대운
${currentDaeun ? `${currentDaeun.간지} (${currentDaeun.시작나이 || currentDaeun.나이범위 || ''}세~)` : '미상'}

## 기본 정보
이름: ${d.input?.name || '미상'}, 성별: ${d.input?.gender === 'male' ? '남' : '여'}, ${d.input?.birthYear || ''}년생${d.띠 ? `, ${d.띠}띠` : ''}

## 2026년 = 병오(丙午)년
- 병(丙) = 양화(陽火), 오(午) = 말(馬)
- 이 해의 전체 기운: 화(火)의 에너지가 매우 강한 해

## ⭐ 작성 규칙

### yearOverview — 6가지 운 (각 150자 이상)
- 총운: 2026 병오년과 이 사람 사주의 종합 궁합. "올해는 ~한 해입니다" 시작.
- 금전운: 재성(財星)과 병오년의 관계. 구체적 시기/금액대 언급.
- 건강운: 오행 부족/과다 기반 취약 장기. "특히 ~월에 주의"
- 직장운: 관성(官星)/식상과의 관계. 이직/승진 타이밍.
- 애정운: 일지와 병오의 관계. 새 인연/기존 관계 예측.
- 결혼운: 배우자궁(일지)의 상태. 결혼 적기 여부.

### months — 12개월 (${now}~12월 집중, 1~${now - 1}월은 회고형)
- keyword: 그 달의 핵심 한 마디 (4~6글자)
- interpretation: 120자 이상. 토정비결 전통의 시적 표현 + 현실적 해석.
  예: "높은 산에 구름이 걷히니 멀리 보이는 형상이라 — 그간 막혀있던 일이 갑자기 풀리는 달입니다"
- score: 1~10 (사주와 월지의 실제 관계 기반)

### ⭐ 소름 포인트 (yearOverview에 2개, months에 3개 이상)
- 과거 월: "올해 3월에 ~한 일이 있었을 거예요. 월지가 일간을 극하던 달이었거든요"
- 일상 패턴: "올해 들어서 유독 피곤하다고 느끼셨다면, 병오의 화기가 원인이에요"
- 미래 예측: 구체적 날짜/행동 ("9월 보름 전후로 좋은 소식이")
- 띠(生肖)와 연결: "${d.띠 || ''}띠인 분이 올해 병오년을 만나면..."

### luckyAdvice (100자 이상)
- 올해 전체의 개운법 (색상, 방향, 숫자, 행동 중 2가지 이상)`;
}
//# sourceMappingURL=geminiTojung.js.map