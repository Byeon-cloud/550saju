"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDreamInterpretation = generateDreamInterpretation;
const generative_ai_1 = require("@google/generative-ai");
/**
 * 꿈해몽 — Gemini 2.5 Pro (소름 포인트 강화)
 */
async function generateDreamInterpretation(apiKey, category, dreamText, sajuData) {
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });
    let sajuContext = '';
    if (sajuData?.pillars) {
        const p = sajuData.pillars;
        const el = sajuData.elements || {};
        const sipsung = sajuData.sipsung?.map((s) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
        const currentDaeun = sajuData.daeun?.find((d) => d.isCurrent || d.현재);
        sajuContext = `## 이 사람의 사주 정보
일간: ${p[2]?.천간 || '미상'}(${p[2]?.천간읽기 || ''})
오행 분포: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
${Object.entries(el).filter(([, v]) => v === 0).map(([k]) => `→ ${k}이 없음: 무의식이 이 기운을 꿈으로 보충하려 할 수 있음`).join('\n')}
${Object.entries(el).filter(([, v]) => v >= 3).map(([k, v]) => `→ ${k}이 ${v}개 과다: 이 기운이 꿈에서 강렬하게 표현될 수 있음`).join('\n')}
십성: ${sipsung || '미상'}
현재 대운: ${currentDaeun ? `${currentDaeun.간지} (${currentDaeun.시작나이 || currentDaeun.나이범위 || ''}세~)` : '미상'}
이름: ${sajuData.input?.name || '미상'}, 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}

→ 반드시 이 사주의 오행·십성과 꿈의 상징을 연결하여 해석하세요.`;
    }
    const prompt = `당신은 명리학 + 꿈 해석 40년 경력의 전문가입니다.
"돈 주고 본 것 같아. 소름돋아." 수준의 꿈 해석을 하세요.

## ⭐ 가장 중요한 규칙
사용자가 입력한 꿈 내용의 키워드를 반드시 인용하면서 해석하세요.
"돼지 꿈"이면 돼지에 대해 해석. 절대 다른 상징으로 바꾸지 마세요.

## 사용자 입력
- 꿈 카테고리: ${category}
- 꿈 상세 내용: "${dreamText || '(구체적 내용 없음 — 카테고리 기반으로 해석)'}"

${sajuContext}

## 해석 규칙

### interpretation (500자 이상, 3단락)
**1단락 — 꿈의 핵심 상징 해석**
- 사용자 입력 키워드를 그대로 인용: "꿈에서 본 〇〇은..."
- 명리학 오행/12지지 관점에서 상징 분석
- 사주가 있으면: "일간이 〇〇인 분에게 이 꿈은 특별한 의미가 있어요"

**2단락 — 현실과의 연결 (소름 포인트)**
- 꿈이 현재 삶의 어떤 부분을 반영하는지 구체적으로
- 사주가 있으면: 현재 대운/오행 부족과 꿈의 상징 연결
  예: "수(水)가 없는 사주인데 물 꿈을 꾸셨다면, 무의식이 유연함과 지혜를 갈망하고 있어요"
  예: "식신이 강한데 음식 꿈을 꾸셨다면, 창작 욕구가 폭발 직전이에요"
  예: "현재 대운이 전환기라서 이런 꿈이 나오는 건 자연스러워요"

**3단락 — 전환과 메시지**
- 이 꿈이 보내는 메시지는 무엇인지
- 불안한 꿈도 긍정적 전환으로 ("끝이 아니라 변화의 신호")
- "앞으로 ~일 내에 관련된 기회/변화가 올 수 있어요"

### title
- 꿈의 핵심을 4~8글자로 (사용자 입력 키워드 포함)

### luckyAction (60자 이상)
- 구체적 행동 1가지 + 오행 보충 (색상/방향/시간대 중 2가지)
  예: "오늘 파란색 옷을 입고 동쪽으로 산책하세요. 수(水) 기운을 보충합니다."

### category
- 해석 유형: 재물/기회, 관계/내면, 전환/성장, 경고/조심, 건강/에너지 중 1개

## 출력 (JSON만)
{
  "title": "...",
  "interpretation": "...",
  "luckyAction": "...",
  "category": "..."
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