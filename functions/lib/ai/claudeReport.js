"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSajuReport = generateSajuReport;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
/**
 * 사주 리포트 — Claude Sonnet 4.6
 * 핵심 유료 상품. "돈 주고 본 것 같아. 소름돋아." 수준.
 */
async function generateSajuReport(apiKey, sajuData, situation, _reportType) {
    const anthropic = new sdk_1.default({ apiKey });
    const prompt = buildUserPrompt(sajuData, situation);
    const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-20250414',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
        throw new Error('JSON 파싱 실패');
    const parsed = JSON.parse(jsonMatch[0]);
    return { content: { ...parsed, summary: parsed.sections?.[0]?.content?.slice(0, 100) + '...' } };
}
function buildUserPrompt(sajuData, situation) {
    const p = sajuData.pillars || [];
    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    let pillarsText = '';
    const labels = ['년주', '월주', '일주', '시주'];
    p.forEach((x, i) => {
        if (x.available !== false)
            pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기})${x.지지}(${x.지지읽기})\n`;
    });
    const el = sajuData.elements || {};
    const sipsung = sajuData.sipsung?.map((s) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
    const currentDaeun = sajuData.daeun?.find((d) => d.현재 || d.isCurrent);
    return `당신은 사주명리학 40년 대가입니다. 최고 퀄리티의 사주 리포트를 작성하세요.
"돈 주고 본 것 같아. 소름돋아." — 이 반응이 나올 정도로 구체적이고 개인화된 분석.

⚠️ 현재 날짜: ${dateStr} — 반드시 이 기준으로 과거/현재/미래를 구분하세요.

## 이 사람의 사주 원국
${pillarsText}일간(나): ${p[2]?.천간 || '미상'}
생년월일: ${sajuData.input?.birthYear}/${sajuData.input?.birthMonth}/${sajuData.input?.birthDay}
성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}

## 오행 분포
목(木): ${el.목 || 0}, 화(火): ${el.화 || 0}, 토(土): ${el.토 || 0}, 금(金): ${el.금 || 0}, 수(水): ${el.수 || 0}
${Object.entries(el).filter(([, v]) => v === 0).map(([k]) => `→ ${k} 없음 (주의)`).join('\n')}
${Object.entries(el).filter(([, v]) => v >= 3).map(([k, v]) => `→ ${k} ${v}개 과다`).join('\n')}

## 십성 배치
${sipsung || '미상'}

## 현재 대운
${currentDaeun ? `${currentDaeun.간지} (${currentDaeun.시작나이 || currentDaeun.나이범위 || ''}세~)` : '미상'}

${situation?.concern ? `## 현재 고민\n${situation.concern}` : ''}

## ⭐ 소름 포인트 (각 섹션에 1개 이상)
일상 행동 패턴을 사주 근거로 맞추세요:
- "혼자 있는 시간을 좋아하면서도, 막상 혼자 있으면 불안해지는 타입이시죠?"
- "결정을 내릴 때 머리로는 이미 답을 알고 있는데, 마음이 따라주지 않는 경험이 많으셨을 거예요"
- "주변에서 '너 왜 그렇게 참아?'라는 말을 자주 들으시죠?"

## 출력 형식 (JSON)
{
  "sections": [
    {"id": "summary", "title": "총평", "content": "200자 이상. 이 사람의 사주 핵심을 한 문단으로."},
    {"id": "personality", "title": "성격과 기질", "content": "200자 이상. 일간+월지 기반 성격 묘사. 소름포인트 필수."},
    {"id": "social", "title": "대인관계", "content": "200자 이상. 비겁/관성 기반 관계 패턴."},
    {"id": "career", "title": "직업과 적성", "content": "200자 이상. 식상/관성으로 적성 분석."},
    {"id": "wealth", "title": "재물운", "content": "200자 이상. 재성 위치와 강약."},
    {"id": "love", "title": "애정운", "content": "200자 이상. 일지(배우자궁) 분석."},
    {"id": "health", "title": "건강운", "content": "200자 이상. 오행 과다/부족→취약 장기."},
    {"id": "year2026", "title": "2026년 운세", "content": "200자 이상. 병오년과 사주의 상호작용."},
    {"id": "daeun", "title": "대운 흐름", "content": "200자 이상. 현재 대운의 의미와 다음 전환점."},
    {"id": "mission", "title": "인생 과제", "content": "200자 이상. 이 사주가 풀어야 할 숙제."},
    {"id": "luck", "title": "개운법", "content": "200자 이상. 오행 보충 방법 (색상/방향/음식/행동)."},
    {"id": "luckyProfile", "title": "행운 프로필", "content": "행운의 색상, 숫자, 방위, 음식 등."}
  ],
  "scores": {"career": 0-100, "love": 0-100, "wealth": 0-100, "social": 0-100, "health": 0-100, "potential": 0-100},
  "luckyProfile": {
    "colors": ["#hex1", "#hex2"], "colorNames": ["색상명1", "색상명2"],
    "numbers": [숫자1, 숫자2], "direction": "방위", "day": "요일",
    "foods": ["음식1", "음식2", "음식3"], "element": "보충 오행"
  },
  "careerFit": [{"job": "직업명", "score": 0-100}, ...5개],
  "monthlyFortune": [{"month": 1, "score": 0-100}, ...12개월],
  "relationshipMap": {
    "work": {"score": 0-100, "keyword": "한마디"},
    "friend": {"score": 0-100, "keyword": "한마디"},
    "lover": {"score": 0-100, "keyword": "한마디"}
  },
  "wealthFlow": {
    "earning": {"score": 0-100, "style": "벌기 스타일"},
    "spending": {"score": 0-100, "style": "쓰기 스타일"},
    "saving": {"score": 0-100, "style": "모으기 스타일"}
  }
}

JSON만 출력하세요. 코드블록 없이.`;
}
//# sourceMappingURL=claudeReport.js.map