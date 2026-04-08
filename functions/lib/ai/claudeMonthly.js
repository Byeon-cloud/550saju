"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyFortune = generateMonthlyFortune;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const SYSTEM_PROMPT = `당신은 40년 경력의 사주명리학 대가이며, 세운(歲運)과 월운(月運) 분석의 최고 전문가입니다.

## 학술 기반
적천수(滴天髓), 자평진전(子平眞詮), 궁통보감(窮通寶鑑) 등 정통 명리학 원전에 기반합니다.

## ⭐ "소름 포인트" 규칙
각 월의 첫 1~2문장에서, 그 달에 겪을 법한 구체적 상황이나 감정을 묘사하세요.
"3월에는 갑자기 오래된 인연이 연락해올 수 있어요"처럼 구체적으로.

## 해석 원칙
1. 2026년(丙午年)의 세운이 원국에 미치는 영향 먼저 분석
2. 각 월의 천간·지지가 원국+세운과 어떤 관계인지 분석
3. 월별로 직업/연애/재물 각각 한 줄씩 구체 조언
4. 최고의 달과 최악의 달을 명확히 지목하고 이유 설명
5. 럭키 데이, 럭키 아이템은 오행 기반으로 근거 있게

## 해석 태도
- 구체적 행동 묘사, 모호함 금지
- 존댓말 + 따뜻한 톤
- 각 월 200자 이상

## 금기
- "죽음/큰 사고" 불안 조장 금지
- 부정적 달에 반드시 대처법/보완법 포함

## 출력 형식 (JSON만)
{
  "yearOverview": "2026년 전체 개요 (500자+)",
  "bestMonth": 3,
  "worstMonth": 8,
  "months": [
    {
      "month": 1,
      "score": 75,
      "theme": "한 줄 테마",
      "advice": "월별 핵심 조언 (150자+)",
      "luckyDay": "15일, 23일",
      "luckyItem": "은 액세서리",
      "career": "직업운 한 줄",
      "love": "애정운 한 줄",
      "wealth": "재물운 한 줄",
      "caution": "주의사항 (100자+)"
    }
  ]
}`;
async function generateMonthlyFortune(apiKey, sajuData) {
    const client = new sdk_1.default({ apiKey });
    const userPrompt = buildMonthlyPrompt(sajuData);
    const message = await client.messages.create({
        model: 'claude-4-sonnet-20250514',
        max_tokens: 8000,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
    });
    const text = message.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');
    return JSON.parse(jsonMatch[0]);
}
function buildMonthlyPrompt(sajuData) {
    const p = sajuData.pillars || [];
    let prompt = `## 기본 정보\n`;
    prompt += `- 이름: ${sajuData.input?.name || '미상'}\n`;
    prompt += `- 생년월일: ${sajuData.input?.birthYear}년 ${sajuData.input?.birthMonth}월 ${sajuData.input?.birthDay}일\n`;
    prompt += `- 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n`;
    prompt += `- 분석 대상 연도: 2026년 (丙午年)\n`;
    prompt += `\n## 사주 원국\n| 기둥 | 천간 | 지지 |\n|---|---|---|\n`;
    const labels = ['년주', '월주', '일주', '시주'];
    p.forEach((pillar, i) => {
        if (pillar.available !== false) {
            prompt += `| ${labels[i]} | ${pillar.천간}(${pillar.천간읽기}) | ${pillar.지지}(${pillar.지지읽기}) |\n`;
        }
    });
    if (sajuData.elements) {
        prompt += `\n## 오행 분포\n`;
        Object.entries(sajuData.elements).forEach(([k, v]) => { prompt += `- ${k}: ${v}\n`; });
    }
    if (sajuData.sipsung?.length) {
        prompt += `\n## 십성 배치\n`;
        sajuData.sipsung.forEach((s) => { prompt += `- ${s.위치}: ${s.글자} (${s.십성})\n`; });
    }
    const currentDaeun = sajuData.daeun?.find((d) => d.isCurrent || d.현재);
    if (currentDaeun) {
        prompt += `\n## 현재 대운\n- ${currentDaeun.간지} (${currentDaeun.시작나이 || currentDaeun.나이범위}세~)\n`;
    }
    prompt += `\n2026년(丙午年) 12개월을 각각 상세 분석해주세요. 매월 천간·지지와 원국의 관계를 분석하고, 직업/연애/재물 각각 구체적 조언을 담아주세요.`;
    return prompt;
}
//# sourceMappingURL=claudeMonthly.js.map