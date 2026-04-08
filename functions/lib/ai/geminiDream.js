"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDreamInterpretation = generateDreamInterpretation;
const generative_ai_1 = require("@google/generative-ai");
/**
 * 꿈해몽 — Gemini 2.5 Pro (품질 강화)
 */
async function generateDreamInterpretation(apiKey, category, dreamText, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });
    const sajuContext = sajuData?.pillars
        ? `## 이 사람의 사주 정보
- 일간: ${sajuData.pillars?.[2]?.천간 || '미상'}
- 오행 분포: 목${sajuData.elements?.목 || 0} 화${sajuData.elements?.화 || 0} 토${sajuData.elements?.토 || 0} 금${sajuData.elements?.금 || 0} 수${sajuData.elements?.수 || 0}
- 현재 대운: ${sajuData.daeun?.find((d) => d.isCurrent)?.간지 || '미상'}
→ 이 사주의 오행에 맞춰 꿈을 다르게 해석하세요.`
        : '';
    const prompt = `당신은 동양 명리학 기반의 꿈 해석 전문가입니다.

## ⭐ 가장 중요한 규칙
사용자가 입력한 꿈 내용을 반드시 반영하세요.
"돼지 꿈"이라고 입력했으면 돼지에 대해 해석하세요. 절대 다른 동물로 바꾸지 마세요.
사용자가 적은 꿈의 세부 사항(장소, 느낌, 등장인물)을 해석에 그대로 반영하세요.

## 사용자 입력
- 꿈 카테고리: ${category}
- 꿈 상세 내용: "${dreamText || '(구체적 내용 없음)'}"

${sajuContext}

## 해석 규칙
1. 사용자가 묘사한 꿈의 키워드를 그대로 사용하여 해석하세요
2. 명리학의 오행/음양 관점에서 꿈의 상징을 분석하세요
3. "이런 꿈을 꿨다는 건..." 처럼 구체적으로 연결하세요
4. 꿈의 감정(두려움, 기쁨, 불안 등)도 해석에 포함하세요
5. 실생활 조언은 날짜/방향/색상 등 구체적으로
6. 불안 조장 금지. 나쁜 꿈도 긍정적 전환으로 해석

## 출력 (JSON만)
{
  "title": "꿈의 핵심을 4~8글자로 (사용자 입력 키워드 포함)",
  "interpretation": "400자 이상 상세 해석.\\n\\n단락 구분.\\n\\n사용자가 적은 꿈 내용을 반드시 인용하면서 해석.",
  "luckyAction": "오늘의 구체적 행동 조언 (색상/방향/시간대 포함)",
  "category": "해석 유형 (재물/기회, 관계/내면, 전환/성장, 경고/조심, 건강/에너지 중 1개)"
}`;
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
        return {
            title: category,
            interpretation: text,
            luckyAction: '오늘은 자신의 내면에 집중하는 시간을 가져보세요.',
            category: '종합',
        };
    }
}
//# sourceMappingURL=geminiDream.js.map