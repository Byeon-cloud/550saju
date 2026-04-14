"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChatAnswerAI = generateChatAnswerAI;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        answer: { type: generative_ai_1.SchemaType.STRING },
        keywords: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
    },
    required: ['answer', 'keywords'],
};
/**
 * AI 사주 대화 — Gemini 2.5 Pro + responseSchema
 * "돈 주고 사주 보는 것 같아. 소름돋아." 수준의 품질
 */
async function generateChatAnswerAI(apiKey, question, sajuData, chatHistory, timeSlot) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            maxOutputTokens: 8192,
        },
    });
    let sajuContext = '사주 정보가 없습니다. 일반 명리학 상식으로 답변하세요.';
    if (sajuData) {
        const p = sajuData.pillars || [];
        const labels = ['년주', '월주', '일주', '시주'];
        let pillarsText = '';
        p.forEach((pillar, i) => {
            if (pillar.available !== false) {
                pillarsText += `${labels[i]}: ${pillar.천간}(${pillar.천간읽기})${pillar.지지}(${pillar.지지읽기})\n`;
            }
        });
        const elements = sajuData.elements || {};
        const sipsung = sajuData.sipsung?.map((s) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
        const currentDaeun = sajuData.daeun?.find((d) => d.isCurrent || d.현재);
        sajuContext = `## 사주 원국
${pillarsText}
일간(나): ${p[2]?.천간 || '미상'}

## 오행 분포
목${elements.목 || 0} 화${elements.화 || 0} 토${elements.토 || 0} 금${elements.금 || 0} 수${elements.수 || 0}
${Object.entries(elements).filter(([, v]) => v === 0).map(([k]) => `→ ${k} 없음`).join('\n')}
${Object.entries(elements).filter(([, v]) => v >= 3).map(([k, v]) => `→ ${k} ${v}개 과다`).join('\n')}

## 십성: ${sipsung || '미상'}
## 현재 대운: ${currentDaeun ? `${currentDaeun.간지} (${currentDaeun.시작나이 || currentDaeun.나이범위}세~)` : '미상'}
## 이름/성별: ${sajuData.input?.name || '미상'}, ${sajuData.input?.gender === 'male' ? '남' : '여'}`;
    }
    const historyText = chatHistory.length > 0
        ? '## 이전 대화\n' + chatHistory.slice(-6).map(h => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.content}`).join('\n') + '\n\n'
        : '';
    const timeLabels = {
        latenight: '새벽', dawn: '이른아침', morning: '오전', noon: '점심',
        afternoon: '오후', evening: '저녁', night: '밤',
    };
    const prompt = `당신은 명리학 40년 경력의 사주 전문가. 1:1 상담하듯 대화해요.
목표: "돈 주고 사주 보는 것 같아. 소름돋아."

## 핵심 규칙
- 질문에 직접 답변. 첫 문장부터 사주 기반 답변 시작
- "어떤 부분이~", "더 구체적으로~" 되물음 금지
- "좋은 질문이에요", "~일 수도 있어요" 모호한 표현 금지
- 답변 400~600자 (충분히 깊이 있게, 돈 주고 상담받는 느낌)
- 사주 근거 자연스럽게: "일간이 甲木이라...", "현재 대운이..."
- 핵심 분석 + 구체적 조언 + 시기/방향 제시 포함

## 소름 포인트 공식 (매 답변 1개 이상 필수)
오행 분포로 이 사람의 실생활 패턴을 묘사:
- 수(水) 없으면: "결정할 때 직감보다 분석에 의존하는 편이시죠?"
- 식신 강하면: "표현하거나 만드는 것에 재능 있으시죠?"
- 대운과 질문 연결: "지금 대운 전환기라 이런 고민이 자연스러운 시기예요"
- 오행 과다/부족과 질문 연결: "木이 강해서 조직에서 답답함을 느끼실 수 있어요"
- 십성과 성격 연결: "편재가 있어 사업 감각이 있지만, 정재가 약해 관리에 주의"

## 현재 시간: ${timeLabels[timeSlot || ''] || '불명'}
${sajuContext}

${historyText}## 질문
${question}

답변(400~600자, 끝에 자연스러운 후속 질문 1개 포함)과 키워드 3개를 반환하세요.
사용자가 "고마워", "알겠어" 등 만족 표현 시 → keywords는 새 주제 제안으로.

⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    return {
        answer: parsed.answer || '',
        keywords: parsed.keywords || ['올해 재물운은?', '연애운 궁금해요', '건강 쪽도 봐주세요'],
    };
}
//# sourceMappingURL=geminiChat.js.map