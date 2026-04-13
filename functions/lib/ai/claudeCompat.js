"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCompatibilityAnalysis = generateCompatibilityAnalysis;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
async function generateCompatibilityAnalysis(apiKey, sajuData1, sajuData2, relation) {
    const anthropic = new sdk_1.default({ apiKey });
    const prompt = buildPrompt(sajuData1, sajuData2, relation);
    const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('JSON 파싱 실패');
    return JSON.parse(jsonMatch[0]);
}
function personDetail(label, d) {
    const p = d.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let t = '';
    p.forEach((x, i) => { if (x.available !== false)
        t += `  ${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`; });
    const el = d.elements || {};
    const sip = d.sipsung?.map((s) => `${s.위치}:${s.십성}`).join(', ') || '';
    return `### ${label}: ${d.input?.name || '미상'} (${d.input?.gender === 'male' ? '남' : '여'})\n${t}  일간: ${p[2]?.천간 || '미상'}\n  오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}\n  십성: ${sip}`;
}
function buildPrompt(d1, d2, rel) {
    const relLabels = { lover: '연인/배우자', friend: '친구', colleague: '직장동료', family: '가족', business: '사업파트너' };
    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
    return `명리학 40년 대가. "소름돋는" 궁합 분석.

⚠️ 현재 날짜: ${dateStr}
관계 유형: ${relLabels[rel] || rel || '두 사람'}

${personDetail('사람 1', d1)}

${personDetail('사람 2', d2)}

## ⭐ 소름 포인트 (각 카테고리 1개, 총 5개)
일상 패턴 묘사:
- "한 사람이 화나면 말을 안 하고, 다른 사람은 반대로 말이 많아지시죠?"
- "돈 쓰는 방식이 다를 거예요. 한 쪽은 저축형, 다른 쪽은 경험 투자형"
- "싸운 후 먼저 연락하는 사람이 항상 같은 쪽일 거예요"

## 출력 (JSON만, 코드블록 없이)
{
  "overallScore": 0-100,
  "summary": "200자 이상. 두 사람의 관계 본질.",
  "categories": [
    {"id": "personality", "name": "성격 궁합", "score": 0-100, "description": "150자 이상"},
    {"id": "values", "name": "가치관 궁합", "score": 0-100, "description": "150자 이상"},
    {"id": "communication", "name": "소통 궁합", "score": 0-100, "description": "150자 이상"},
    {"id": "emotion", "name": "감정 궁합", "score": 0-100, "description": "150자 이상"},
    {"id": "future", "name": "미래 궁합", "score": 0-100, "description": "150자 이상"}
  ],
  "strengths": ["50자 이상씩 3개"],
  "challenges": ["50자 이상씩 3개"],
  "advice": "150자 이상. 실용적 조언.",
  "futureOutlook": "100자 이상. 향후 1~3년.",
  "ohengHarmony": {
    "person1Element": "오행", "person2Element": "오행",
    "relation": "상생/상극/비화", "description": "100자 이상"
  }
}`;
}
//# sourceMappingURL=claudeCompat.js.map