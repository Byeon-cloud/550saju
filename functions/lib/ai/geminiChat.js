"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChatAnswerAI = generateChatAnswerAI;
const generative_ai_1 = require("@google/generative-ai");
/**
 * AI 사주 대화 — Gemini 2.5 Pro
 * 시간대 반응형 + 학술 기반 프롬프트
 */
async function generateChatAnswerAI(apiKey, question, sajuData, chatHistory, timeSlot) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });
    const sajuContext = sajuData
        ? `사용자의 사주 정보:
- 이름: ${sajuData.input?.name || '미상'}
- 일간: ${sajuData.pillars?.[2]?.천간 || '미상'}
- 오행 분포: ${JSON.stringify(sajuData.elements || {})}
- 현재 대운: ${sajuData.daeun?.find((d) => d.isCurrent)?.간지 || '미상'}
- 년주: ${sajuData.pillars?.[0]?.천간 || ''}${sajuData.pillars?.[0]?.지지 || ''}
- 월주: ${sajuData.pillars?.[1]?.천간 || ''}${sajuData.pillars?.[1]?.지지 || ''}
- 일주: ${sajuData.pillars?.[2]?.천간 || ''}${sajuData.pillars?.[2]?.지지 || ''}
`
        : '사주 정보가 없습니다. 일반적인 명리학 상식으로 답변하세요.';
    const historyText = chatHistory.length > 0
        ? '이전 대화:\n' + chatHistory.slice(-6).map(h => `${h.role}: ${h.content}`).join('\n') + '\n\n'
        : '';
    const timeContext = timeSlot ? `현재 시간대: ${timeSlot}. 시간대에 맞는 톤으로 대화하세요.\n` : '';
    const prompt = `## 역할
당신은 사주명리학에 능통한 AI 상담사입니다.
카카오톡으로 대화하듯 자연스럽고 따뜻하게 답합니다.

## 학술 기반
적천수(滴天髓), 자평진전(子平眞詮), 삼명통회(三命通會), 궁통보감(窮通寶鑑), 연해자평(淵海子平) 등 정통 명리학 원전에 기반해 해석합니다.
적절한 경우 근거 원전을 자연스럽게 언급하세요.

## 시간대
${timeContext}

## 사주 정보
${sajuContext}

${historyText}## 사용자 질문
${question}

## 규칙
- 짧고 명확하게 (250자 이내)
- 공감 먼저, 분석 다음, 조언 마지막
- 사주 근거를 밝히되 쉬운 말로
- 역질문으로 대화를 이어가세요
- 불안 조장 금지
- 존댓말, 따뜻한 톤

## 출력 (JSON만)
{
  "answer": "답변 텍스트",
  "keywords": ["후속질문1", "후속질문2", "후속질문3"]
}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return { answer: parsed.answer, keywords: parsed.keywords || [] };
    }
    catch {
        return { answer: text, keywords: ['더 자세히 알려줘', '다른 질문할게', '오늘 운세 알려줘'] };
    }
}
//# sourceMappingURL=geminiChat.js.map