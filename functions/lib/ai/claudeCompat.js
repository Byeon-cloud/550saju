"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCompatibilityAnalysis = generateCompatibilityAnalysis;
const generative_ai_1 = require("@google/generative-ai");
const responseSchema = {
    type: generative_ai_1.SchemaType.OBJECT,
    properties: {
        overallScore: { type: generative_ai_1.SchemaType.NUMBER },
        summary: { type: generative_ai_1.SchemaType.STRING },
        categories: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                    id: { type: generative_ai_1.SchemaType.STRING }, name: { type: generative_ai_1.SchemaType.STRING },
                    score: { type: generative_ai_1.SchemaType.NUMBER }, description: { type: generative_ai_1.SchemaType.STRING },
                } } },
        strengths: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
        challenges: { type: generative_ai_1.SchemaType.ARRAY, items: { type: generative_ai_1.SchemaType.STRING } },
        advice: { type: generative_ai_1.SchemaType.STRING },
        futureOutlook: { type: generative_ai_1.SchemaType.STRING },
        ohengHarmony: { type: generative_ai_1.SchemaType.OBJECT, properties: {
                person1Element: { type: generative_ai_1.SchemaType.STRING }, person2Element: { type: generative_ai_1.SchemaType.STRING },
                relation: { type: generative_ai_1.SchemaType.STRING }, description: { type: generative_ai_1.SchemaType.STRING },
            } },
    },
};
async function generateCompatibilityAnalysis(apiKey, sajuData1, sajuData2, relation) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 },
        thinkingConfig: { thinkingBudget: 0 },
    });
    const r = await model.generateContent(buildPrompt(sajuData1, sajuData2, relation));
    return JSON.parse(r.response.text());
}
function personDetail(label, d) {
    const p = d.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((x, i) => {
        if (x.available !== false)
            pillarsText += `  ${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`;
    });
    const el = d.elements || {};
    const sipsung = d.sipsung?.map((s) => `${s.위치}:${s.십성}`).join(', ') || '';
    return `### ${label}: ${d.input?.name || '미상'} (${d.input?.gender === 'male' ? '남' : '여'})
${pillarsText}  일간: ${p[2]?.천간 || '미상'}
  오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
  십성: ${sipsung || '미상'}`;
}
function buildPrompt(d1, d2, rel) {
    const relLabels = {
        'lover': '연인/배우자', 'friend': '친구', 'colleague': '직장동료',
        'family': '가족', 'business': '사업파트너',
    };
    const relLabel = relLabels[rel] || rel || '두 사람';
    return `당신은 명리학 40년 대가입니다. "돈 주고 본 것 같아. 소름돋아." 수준의 궁합 분석을 하세요.

## 관계 유형: ${relLabel}

${personDetail('사람 1', d1)}

${personDetail('사람 2', d2)}

## ⭐ 분석 규칙

### summary (200자 이상)
- 두 사람의 일간 관계(상생/상극/비화)를 먼저 설명
- 한 줄로 관계의 본질을 정의: "서로 ~하게 만드는 관계"
- ${relLabel} 관계에 맞는 톤으로

### categories — 5가지 (각 description 150자 이상)
- personality (성격 궁합): 일간 간의 관계 + 월지 비교
- values (가치관 궁합): 재성/관성 비교 → 돈/권력에 대한 시각 차이
- communication (소통 궁합): 식상/인성 비교 → 표현 방식 차이
- emotion (감정 궁합): 일지(배우자궁) 비교 → 감정 교류 패턴
- future (미래 궁합): 현재 대운 흐름에서 둘의 시너지

### ⭐ 소름 포인트 (각 category에 1개, 총 5개)
구체적 일상 패턴 묘사로 "이거 어떻게 알아?" 반응을 유도:
- "한 사람이 화가 나면 말을 안 하고, 다른 사람은 반대로 말이 많아지는 패턴이 있을 거예요"
- "중요한 결정을 할 때 한 사람은 직감, 다른 사람은 분석을 먼저 하시죠?"
- "둘이 같이 있으면 한 사람이 먼저 정리하고, 한 사람은 아이디어를 내는 역할이 자연스럽게 나뉘어요"
- "돈 쓰는 방식이 다를 거예요. 한 쪽은 저축형, 다른 쪽은 경험 투자형"
- "싸운 후 먼저 연락하는 사람이 항상 같은 쪽일 거예요"

### strengths / challenges (각 3개, 각 50자 이상)
- strengths: 이 관계의 장점을 사주 근거로 (예: "甲木과 己土의 합 → 끌어당기는 자석 같은 매력")
- challenges: 주의할 갈등 포인트 + 해결법까지 (예: "화 과다 조합 → 감정 충돌 시 쿨링타임 필요")

### advice (150자 이상)
- ${relLabel} 관계에 맞는 실용적 조언
- 구체적: 시기/방향/행동 중 1가지 이상

### futureOutlook (100자 이상)
- 향후 1~3년 이 관계의 전망 (대운 기반)

### ohengHarmony
- person1Element: 사람1 일간의 오행 (예: "木")
- person2Element: 사람2 일간의 오행
- relation: 상생/상극/비화 중 1개
- description: 100자 이상. 오행 관계가 일상에 미치는 영향`;
}
//# sourceMappingURL=claudeCompat.js.map