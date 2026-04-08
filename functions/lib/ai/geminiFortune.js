"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDailyFortuneAI = generateDailyFortuneAI;
const generative_ai_1 = require("@google/generative-ai");
/**
 * 오늘의 운세 — Gemini 2.5 Flash (무료 티어)
 */
async function generateDailyFortuneAI(apiKey, answers, timeSlot, sajuSummary) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const timeContext = {
        dawn: '새벽 시간에 운세를 보고 있습니다. 이 시간까지 깨어있다면 중요한 고민이 있을 가능성이 높습니다.',
        morning: '아침에 하루를 시작하며 운세를 보고 있습니다.',
        afternoon: '오후 시간, 하루의 절반이 지난 시점에서 운세를 봅니다.',
        evening: '저녁, 하루를 마무리하는 시간에 운세를 봅니다.',
        night: '밤 늦은 시간에 운세를 보고 있습니다. 밤의 직감은 예리합니다.',
    };
    const personalContext = sajuSummary
        ? `이 사용자의 일간은 ${sajuSummary.ilgan}(${sajuSummary.oheng})입니다. ${sajuSummary.name}님에게 맞춤 운세를 제공하세요.`
        : '사주 정보가 없는 일반 사용자입니다.';
    const prompt = `당신은 따뜻하고 프로페셔널한 운세 전문가입니다.

${timeContext[timeSlot] || timeContext.morning}
${personalContext}
사용자 답변 인덱스: ${JSON.stringify(answers)}

오늘의 운세를 JSON으로 작성하세요:
{
  "grade": "A" ~ "D" (A가 최고),
  "gradeLabel": "등급 한국어 라벨",
  "summary": "3~4줄 운세 요약 (${timeSlot === 'dawn' ? '새벽의 고민을 다독여주는' : timeSlot === 'night' ? '밤의 직감을 살려주는' : '하루를 이끌어주는'} 톤)",
  "scores": {"love": 0-100, "career": 0-100, "wealth": 0-100, "health": 0-100},
  "lucky": {"color": "색 이름", "colorHex": "#HEX", "number": 숫자, "direction": "방위", "item": "아이템", "food": "음식"},
  "advice": "시간대에 맞는 한 줄 핵심 조언"
}

JSON만 출력하세요.`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('Gemini 응답 파싱 실패');
    return JSON.parse(jsonMatch[0]);
}
//# sourceMappingURL=geminiFortune.js.map