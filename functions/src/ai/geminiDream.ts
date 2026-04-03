import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * 꿈해몽 — Gemini 2.5 Flash
 * 카테고리 + 상세 내용 + 사주 데이터 → 개인화된 해몽 결과
 * 1만 명이 같은 카테고리를 선택해도 1만 개의 다른 결과 생성
 */
export async function generateDreamInterpretation(
  apiKey: string,
  category: string,
  dreamText: string,
  sajuData?: any,
): Promise<{ title: string; interpretation: string; luckyAction: string; category: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });

  const sajuContext = sajuData
    ? `사용자의 사주 정보:
- 일간: ${sajuData.pillars?.[2]?.천간 || '미상'}
- 오행 분포: ${JSON.stringify(sajuData.elements || {})}
- 현재 대운: ${sajuData.daeun?.find((d: any) => d.isCurrent)?.간지 || '미상'}

이 사주의 오행 분포에 맞춰서 같은 꿈이라도 다르게 해석해주세요.
예: 수(水)가 부족한 사람이 물 꿈을 꾸면 "부족한 기운을 보충하라는 신호"로 해석.`
    : '사주 정보가 없습니다. 일반적인 명리학 해석으로 답변하세요.';

  const prompt = `당신은 동양 명리학과 꿈 해석에 능통한 전문가입니다.

${sajuContext}

꿈 카테고리: ${category}
꿈 상세 내용: ${dreamText || '(상세 내용 없음)'}
현재 시각: ${new Date().toLocaleString('ko-KR')}

## 해석 규칙
1. 명리학의 오행/음양 관점에서 꿈을 해석하세요
2. 꿈에서 느꼈을 감정까지 고려하세요
3. 구체적이고 개인화된 해석을 하세요 (뻔한 말 금지)
4. 실생활에 바로 적용할 수 있는 조언을 포함하세요
5. 사주 데이터가 있으면 반드시 오행 분포에 맞춘 맞춤 해석을 하세요
6. 불안을 조장하지 마세요. "죽음의 꿈"도 "전환/새 시작"으로 해석하세요.

## 출력 (JSON만)
{
  "title": "꿈 제목 (예: 큰 뱀이 집에 들어오는 꿈)",
  "interpretation": "300자 이상 상세 해석. 단락 구분은 \\n\\n으로.",
  "luckyAction": "오늘의 행동 조언 (1~2문장)",
  "category": "해석 카테고리 (예: 재물/기회, 관계/내면, 전환/성장 등)"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      title: category,
      interpretation: text,
      luckyAction: '오늘은 자신의 내면에 집중하는 시간을 가져보세요.',
      category: '종합',
    };
  }
}
