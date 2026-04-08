"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCompatibilityAnalysis = generateCompatibilityAnalysis;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const parseJson_1 = require("./parseJson");
const SYSTEM_PROMPT = `당신은 40년 경력의 사주명리학 대가이며, 궁합(宮合) 분석의 최고 전문가입니다.

## 학술 기반
적천수(滴天髓), 자평진전(子平眞詮), 삼명통회(三命通會), 궁통보감(窮通寶鑑) 등 정통 명리학 원전에 기반합니다.

## ⭐ "소름 포인트" 규칙
두 사람의 관계에서 실제로 느꼈을 구체적 상황을 묘사하세요.
"상대방이 결정을 미루면 당신이 먼저 정리해주는 패턴이 있을 거예요"처럼.

## 궁합 분석 원칙
1. 일간 관계 — 두 사람의 일간이 합(合)/극(剋)/생(生)/비(比) 어떤 관계인지
2. 오행 보완도 — 한 쪽에 부족한 오행을 상대가 채워주는지
3. 십성 교차 분석 — 상대의 일간이 내 사주에서 어떤 십성이 되는지
4. 지지 관계 — 합/충/형/파/해 분석
5. 대운 시너지 — 현재 두 사람의 대운이 어떤 관계인지

## 관계 유형별 해석 방향
- 연인/배우자: 감정적 교류, 성적 궁합(수위 조절), 가치관 일치, 결혼 적합도
- 썸: 발전 가능성, 서로의 매력 포인트, 주의할 첫인상 오류
- 친구: 신뢰도, 갈등 패턴, 오래 가는 비결
- 동료: 업무 시너지, 역할 분담, 충돌 지점
- 부모-자녀: 교육 방식, 소통 패턴, 서로의 기대
- 형제자매: 경쟁/협력 패턴, 갈등 포인트

## 해석 태도
- 구체적 행동 묘사, 모호함 금지
- 존댓말 + 따뜻한 톤
- 부정적 부분에 반드시 보완법
- 각 카테고리 300자 이상

## 금기
- "이별할 사주" 같은 불안 조장 금지
- "안 맞는 궁합"에도 보완법 + 장점 반드시 포함

## 출력 형식 (JSON만)
{
  "overallScore": 78,
  "summary": "궁합 총평 (500자+)",
  "categories": [
    {"id": "personality", "name": "성격 궁합", "score": 80, "description": "성격 궁합 상세 (300자+)"},
    {"id": "values", "name": "가치관", "score": 75, "description": "가치관 궁합 상세 (300자+)"},
    {"id": "communication", "name": "소통", "score": 82, "description": "소통 궁합 상세 (300자+)"},
    {"id": "emotion", "name": "감정", "score": 70, "description": "감정 궁합 상세 (300자+)"},
    {"id": "future", "name": "미래", "score": 85, "description": "미래 전망 상세 (300자+)"}
  ],
  "strengths": ["잘 맞는 점 1", "잘 맞는 점 2", "잘 맞는 점 3"],
  "challenges": ["주의할 점 1", "주의할 점 2", "주의할 점 3"],
  "advice": "종합 조언 (300자+)",
  "futureOutlook": "미래 전망 (200자+)",
  "ohengHarmony": {
    "person1Element": "목",
    "person2Element": "화",
    "relation": "상생",
    "description": "오행 조화 설명 (200자+)"
  }
}`;
async function generateCompatibilityAnalysis(apiKey, sajuData1, sajuData2, relation) {
    const client = new sdk_1.default({ apiKey });
    const userPrompt = buildCompatPrompt(sajuData1, sajuData2, relation);
    const message = await client.messages.create({
        model: 'claude-4-sonnet-20250514',
        max_tokens: 8000,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
    });
    const text = message.content[0].text;
    return (0, parseJson_1.safeParseJson)(text);
}
function buildPersonBlock(label, sajuData) {
    const p = sajuData.pillars || [];
    let block = `\n## ${label}\n`;
    block += `- 이름: ${sajuData.input?.name || '미상'}\n`;
    block += `- 생년월일: ${sajuData.input?.birthYear}년 ${sajuData.input?.birthMonth}월 ${sajuData.input?.birthDay}일\n`;
    block += `- 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}\n`;
    block += `\n### 사주 원국\n| 기둥 | 천간 | 지지 |\n|---|---|---|\n`;
    const labels = ['년주', '월주', '일주', '시주'];
    p.forEach((pillar, i) => {
        if (pillar.available !== false) {
            block += `| ${labels[i]} | ${pillar.천간}(${pillar.천간읽기}) | ${pillar.지지}(${pillar.지지읽기}) |\n`;
        }
    });
    if (sajuData.elements) {
        block += `\n### 오행 분포\n`;
        Object.entries(sajuData.elements).forEach(([k, v]) => { block += `- ${k}: ${v}\n`; });
    }
    if (sajuData.sipsung?.length) {
        block += `\n### 십성 배치\n`;
        sajuData.sipsung.forEach((s) => { block += `- ${s.위치}: ${s.글자} (${s.십성})\n`; });
    }
    const currentDaeun = sajuData.daeun?.find((d) => d.isCurrent || d.현재);
    if (currentDaeun) {
        block += `\n### 현재 대운\n- ${currentDaeun.간지}\n`;
    }
    return block;
}
function buildCompatPrompt(sajuData1, sajuData2, relation) {
    let prompt = `## 관계 유형: ${relation}\n`;
    prompt += buildPersonBlock('사람 1 (분석 요청자)', sajuData1);
    prompt += buildPersonBlock('사람 2', sajuData2);
    prompt += `\n위 두 사람의 사주를 비교 분석하여, "${relation}" 관계 관점에서 궁합을 JSON으로 작성해주세요.`;
    return prompt;
}
//# sourceMappingURL=claudeCompat.js.map