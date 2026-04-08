"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDaeunAnalysis = generateDaeunAnalysis;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const SYSTEM_PROMPT = `당신은 40년 경력의 사주명리학 대가이며, 특히 대운(大運) 분석의 최고 전문가입니다.

## 학술 기반
적천수(滴天髓), 자평진전(子平眞詮), 삼명통회(三命通會), 궁통보감(窮通寶鑑), 연해자평(淵海子平) 등 정통 명리학 원전에 기반합니다.

## ⭐ "소름 포인트" 규칙 (가장 중요)
각 대운 기간의 첫 2~3문장에서, 그 시기에 실제로 겪었거나 겪을 법한 구체적 상황을 묘사하세요.
과거 대운은 "그때 이런 일이 있었을 거예요"로, 현재/미래는 "지금 이런 느낌이실 거예요"로.

## 해석 원칙
1. 대운의 천간·지지가 원국과 어떤 관계(합·충·형·파·해)인지 분석
2. 대운 오행이 원국 오행 균형에 미치는 영향 설명
3. 각 대운이 직업/연애/재물/건강에 미치는 구체적 영향
4. 현재 대운은 800자 이상 심층 분석
5. 대운 전환기(±2년)의 변화 징후 상세 설명

## 해석 태도
- 구체적 행동 묘사 ("~할 수 있습니다" 모호함 금지)
- "왜" 설명 필수
- 부정적 해석에 반드시 보완법
- 존댓말 + 따뜻한 톤
- 각 기간 200자 이상, 현재 대운은 800자 이상

## 금기
- "죽음/큰 사고" 불안 조장 금지
- 12운성 '사(死)' = "내면 수렴 단계"

## 출력 형식 (JSON만)
{
  "overview": "대운 전체 흐름 개요 (500자+)",
  "periods": [
    {
      "간지": "甲子",
      "시작나이": 0,
      "끝나이": 9,
      "isCurrent": false,
      "theme": "한 줄 테마",
      "career": "직업/진로 영향 (200자+)",
      "love": "연애/관계 영향 (200자+)",
      "wealth": "재물 영향 (200자+)",
      "health": "건강 주의점 (100자+)",
      "score": 75,
      "advice": "해당 기간 핵심 조언 (100자+)"
    }
  ],
  "currentHighlight": "현재 대운 심층 해설 (800자+)",
  "transitionAdvice": "대운 전환기 조언 (300자+)",
  "lifePhaseMap": [
    {"phase": "청소년기", "daeun": "甲子", "theme": "학업과 성장"}
  ]
}`;
async function generateDaeunAnalysis(apiKey, sajuData) {
    const client = new sdk_1.default({ apiKey });
    const userPrompt = buildDaeunPrompt(sajuData);
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
function buildDaeunPrompt(sajuData) {
    const p = sajuData.pillars || [];
    let prompt = `## 기본 정보\n`;
    prompt += `- 이름: ${sajuData.input?.name || '미상'}\n`;
    prompt += `- 생년월일: ${sajuData.input?.birthYear}년 ${sajuData.input?.birthMonth}월 ${sajuData.input?.birthDay}일\n`;
    prompt += `- 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n`;
    prompt += `- 현재 나이: ${new Date().getFullYear() - (sajuData.input?.birthYear || 2000)}세\n`;
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
    if (sajuData.daeun?.length) {
        prompt += `\n## 대운 목록 (전체)\n`;
        sajuData.daeun.forEach((d) => {
            const mark = d.isCurrent || d.현재 ? ' ⭐현재' : '';
            prompt += `- ${d.간지} (${d.시작나이 || d.나이범위}세~${d.끝나이 || ''}세)${mark}\n`;
        });
    }
    if (sajuData.gilsin?.length) {
        prompt += `\n## 길신\n`;
        sajuData.gilsin.forEach((g) => { prompt += `- ${g.이름}\n`; });
    }
    if (sajuData.hyungsal?.length) {
        prompt += `\n## 흉살\n`;
        sajuData.hyungsal.forEach((h) => { prompt += `- ${h.이름}\n`; });
    }
    prompt += `\n위 사주 데이터를 바탕으로 대운(大運) 전체 흐름을 심층 분석해주세요. 각 대운 기간별로 직업/연애/재물/건강 영향을 구체적으로 작성하고, 현재 대운은 특별히 800자 이상 상세 분석해주세요.`;
    return prompt;
}
//# sourceMappingURL=claudeDaeun.js.map