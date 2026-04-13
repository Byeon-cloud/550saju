"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMonthlyFortune = generateMonthlyFortune;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
async function generateMonthlyFortune(apiKey, sajuData) {
    const anthropic = new sdk_1.default({ apiKey });
    const prompt = buildPrompt(sajuData);
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
function buildPrompt(d) {
    const p = d.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((x, i) => {
        if (x.available !== false)
            pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기 || ''})${x.지지}(${x.지지읽기 || ''})\n`;
    });
    const el = d.elements || {};
    const sipsung = d.sipsung?.map((s) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
    const currentDaeun = d.daeun?.find((x) => x.isCurrent || x.현재);
    const now = new Date().getMonth() + 1;
    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월`;
    return `당신은 명리학 40년 대가입니다. "소름돋는" 2026년 월별 운세.

⚠️ 현재 날짜: ${dateStr}
- 1~${now - 1}월: 과거형 ("~했을 거예요")
- ${now}월: 현재형 ("지금 ~하고 계신다면")
- ${now + 1}~12월: 미래형 ("~할 거예요")

## 사주 원국
${pillarsText}일간: ${p[2]?.천간 || '미상'}

## 오행: 목${el.목 || 0} 화${el.화 || 0} 토${el.토 || 0} 금${el.금 || 0} 수${el.수 || 0}
## 십성: ${sipsung || '미상'}
## 현재 대운: ${currentDaeun ? currentDaeun.간지 : '미상'}
## 이름: ${d.input?.name || '미상'}, 성별: ${d.input?.gender === 'male' ? '남' : '여'}

## 출력 (JSON만, 코드블록 없이)
{
  "yearOverview": "200자 이상. 2026 병오년 전체 흐름.",
  "bestMonth": 숫자,
  "worstMonth": 숫자,
  "months": [
    {"month": 1, "score": 1-100, "theme": "4~6글자", "advice": "100자 이상",
     "career": "80자 이상", "love": "80자 이상", "wealth": "80자 이상",
     "luckyDay": "날짜 범위", "luckyItem": "아이템", "caution": "주의점"}, ...12개월
  ]
}`;
}
//# sourceMappingURL=claudeMonthly.js.map