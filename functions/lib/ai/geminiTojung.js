"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTojungBigyeol = generateTojungBigyeol;
const generative_ai_1 = require("@google/generative-ai");
/**
 * 토정비결 — Gemini 2.5 Pro
 * 전통 토정비결 형식 + 현대어 해석
 */
async function generateTojungBigyeol(apiKey, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
    const userPrompt = buildTojungPrompt(sajuData);
    const prompt = `## 역할
당신은 토정비결(土亭秘訣)의 최고 전문가입니다. 이토정(李土亭, 이지함) 선생의 학문을 계승한 대가로서, 주역(周易) 64괘를 활용한 전통 토정비결을 현대어로 풀이합니다.

## 토정비결이란?
- 조선시대 이지함(李之菡, 호: 土亭)이 창시한 전통 운세법
- 생년/월/일의 상·중·하 3괘를 조합하여 올해의 운세를 풀이
- 12개월 각각에 대한 괘와 해석 포함
- 금전운, 건강운, 직장운, 애정운, 결혼운 등 6대 영역 분석

## 해석 원칙
1. 각 월에 주역 64괘 중 적절한 괘를 배정 (사주 기반)
2. 전통해석은 고풍스러운 한국어로 (2~3줄)
3. 현대해석은 친근한 해요체로 구체적 조언 (200자+)
4. 6대 영역은 올해 전체 운을 종합적으로 분석
5. 점수는 0-100 사이, 근거 있는 차등 배분

## 해석 태도
- 따뜻하고 격려하는 톤
- 부정적 월에 반드시 대처법 포함
- 존댓말 (해요체)
- "~할 수 있습니다" 모호함 금지

## 금기
- 죽음/사고 불안 조장 금지
- 극단적 불운 표현 금지

## 출력 (JSON만)
{
  "yearOverview": {
    "총운": "올해 전체 운세 (300자+)",
    "금전운": "금전운 상세 (200자+)",
    "건강운": "건강운 상세 (200자+)",
    "직장운": "직장운 상세 (200자+)",
    "애정운": "애정운 상세 (200자+)",
    "결혼운": "결혼운 상세 (200자+)"
  },
  "months": [
    {
      "month": 1,
      "괘": "수풍정(水風井)",
      "괘의미": "우물에서 맑은 물을 길어 올리는 형상",
      "전통해석": "정월에 대인을 만나니 기쁨이 있고, 근면하면 복이 저절로 오리라.",
      "현대해석": "새해 첫 달, 좋은 인연을 만날 수 있어요. 특히 윗사람의 도움이 클 달이에요. (200자+)",
      "score": 75,
      "keyword": "만남"
    }
  ],
  "luckyAdvice": "올해의 개운 조언 (300자+)"
}

${userPrompt}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error('JSON 파싱 실패');
        return JSON.parse(jsonMatch[0]);
    }
    catch {
        throw new Error('토정비결 AI 응답 파싱 실패');
    }
}
function buildTojungPrompt(sajuData) {
    const p = sajuData.pillars || [];
    let prompt = `## 분석 대상\n`;
    prompt += `- 이름: ${sajuData.input?.name || '미상'}\n`;
    prompt += `- 생년월일: ${sajuData.input?.birthYear}년 ${sajuData.input?.birthMonth}월 ${sajuData.input?.birthDay}일\n`;
    prompt += `- 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n`;
    prompt += `- 분석 연도: 2026년\n`;
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
    if (sajuData.띠)
        prompt += `\n## 띠: ${sajuData.띠}\n`;
    prompt += `\n위 정보를 바탕으로 2026년 토정비결을 작성해주세요. 12개월 각각에 적절한 주역 괘를 배정하고, 전통해석과 현대해석을 모두 포함해주세요.`;
    return prompt;
}
//# sourceMappingURL=geminiTojung.js.map