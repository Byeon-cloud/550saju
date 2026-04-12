import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI 사주 대화 — Gemini 2.5 Pro
 * "돈 주고 사주 보는 것 같아. 소름돋아." 수준의 품질
 */
export async function generateChatAnswerAI(
  apiKey: string,
  question: string,
  sajuData: any,
  chatHistory: Array<{ role: string; content: string }>,
  timeSlot?: string,
): Promise<{ answer: string; keywords: string[] }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any,
  });

  // 사주 데이터를 최대한 상세하게 전달
  let sajuContext = '사주 정보가 없습니다. 일반 명리학 상식으로 답변하세요.';
  if (sajuData) {
    const p = sajuData.pillars || [];
    const labels = ['년주', '월주', '일주', '시주'];
    let pillarsText = '';
    p.forEach((pillar: any, i: number) => {
      if (pillar.available !== false) {
        pillarsText += `${labels[i]}: ${pillar.천간}(${pillar.천간읽기})${pillar.지지}(${pillar.지지읽기})\n`;
      }
    });

    const elements = sajuData.elements || {};
    const sipsung = sajuData.sipsung?.map((s: any) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
    const currentDaeun = sajuData.daeun?.find((d: any) => d.isCurrent || d.현재);

    sajuContext = `## 이 사람의 사주 원국
${pillarsText}
일간(나): ${p[2]?.천간 || '미상'} — 이 사람의 본질적 성격을 결정하는 글자

## 오행 분포
목(木): ${elements.목 || 0}, 화(火): ${elements.화 || 0}, 토(土): ${elements.토 || 0}, 금(金): ${elements.금 || 0}, 수(水): ${elements.수 || 0}
${Object.entries(elements).filter(([, v]) => v === 0).map(([k]) => `→ ${k}이 없음 (주의 필요)`).join('\n')}
${Object.entries(elements).filter(([, v]) => (v as number) >= 3).map(([k, v]) => `→ ${k}이 ${v}개로 과다 (특징적)`).join('\n')}

## 십성 배치
${sipsung || '미상'}

## 현재 대운
${currentDaeun ? `${currentDaeun.간지} (${currentDaeun.시작나이 || currentDaeun.나이범위}세~)` : '미상'}

## 기본 정보
이름: ${sajuData.input?.name || '미상'}, 성별: ${sajuData.input?.gender === 'male' ? '남' : '여'}`;
  }

  const historyText = chatHistory.length > 0
    ? '## 이전 대화\n' + chatHistory.slice(-8).map(h => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.content}`).join('\n') + '\n\n'
    : '';

  const timeLabels: Record<string, string> = {
    latenight: '새벽 (0~5시)', dawn: '이른 아침 (5~7시)', morning: '오전 (7~12시)',
    noon: '점심 (12~14시)', afternoon: '오후 (14~18시)', evening: '저녁 (18~21시)', night: '밤 (21~24시)',
  };
  const timeText = timeSlot ? `현재 시간: ${timeLabels[timeSlot] || timeSlot}\n` : '';

  const prompt = `## 당신은 누구인가
당신은 명리학 40년 경력의 사주 전문가예요. 실제 사주 카페에서 1:1 상담하듯 대화해요.
"돈 주고 사주 보는 것 같아. 소름돋아." — 이 반응이 나올 정도로 구체적이고 정확하게 말해요.

## ⭐ 가장 중요한 규칙: 질문에 직접 답변할 것
- 사용자가 "미팅이 있는데 어떨까요?"라고 물으면 → 미팅에 대해 답하세요. 다른 주제로 빠지지 마세요.
- 사용자가 "연애운 어때요?"라고 물으면 → 연애운을 사주 기반으로 바로 분석하세요.
- 질문과 관련 없는 "어떤 부분이 궁금하세요?" 같은 되물음 금지. 질문에 바로 답하세요.
- "명리학에서는~", "질문 자체에 답이~" 같은 철학적 서두 절대 금지

## 절대 하지 말 것
- "좋은 질문이에요", "~에 대한 이야기네요", "조금 더 구체적으로 여쭤봐도 될까요?" 금지
- "~할 수 있습니다", "~일 수도 있어요" 같은 모호한 표현 금지
- 사주 데이터 없이 추상적인 이야기 금지
- 질문과 무관한 주제로 대화 전환 금지
- 500자 초과 금지

## 반드시 할 것
- 첫 문장에서 질문에 대한 사주 기반 답변을 바로 시작하세요
- 예: "미팅 질문" → "오늘 오후는 일간 기준으로 관성(官星)이 활성화되는 시간이라, 상대방에게 신뢰감을 줄 수 있는 타이밍이에요."
- 예: "이직 고민" → "현재 대운이 식상운이라 새로운 환경에서 능력이 더 잘 발휘될 수 있어요. 특히 올 하반기가 좋은 타이밍이에요."
- 사주 근거를 자연스럽게 녹여서 (예: "일간이 甲木이라...", "월지 酉金이 있어서...")
- 실용적이고 구체적인 조언 (날짜/시간대/방향/색상 중 1가지 이상 포함)
- 존댓말, 따뜻하지만 전문가다운 톤
- 2~3단락으로 구성: ① 핵심 답변(사주 근거) → ② 구체적 조언 → ③ 자연스러운 후속 질문 또는 마무리

## 소름 포인트 만드는 법 ⭐
대화 흐름에서 1~2개를 자연스럽게 삽입하세요:
- 오행에 수(水)가 없으면: "결정을 내릴 때 직감보다 자료를 찾아보고 싶어지시는 편 아닌가요?"
- 오행에 화(火)가 과다하면: "감정 기복이 심하다는 말을 들으신 적 있으시죠? 실제론 누구보다 열정적인 건데."
- 식신이 강하면: "맛있는 거 좋아하시거나, 만들고 표현하는 데서 기쁨을 찾으시죠?"
- 비겁이 강하면: "혼자서도 잘 하지만 협업에서 더 빛나는 분이세요."
- 관성이 없으면: "규칙에 얽매이는 걸 싫어하시고, 자기만의 방식이 있으시죠?"
- 현재 대운과 질문을 연결: "지금 대운이 〇〇운이라서 이런 고민이 생기는 게 딱 맞는 시기예요"
- 연도/나이 구체적 언급: "올해 하반기, 특히 8~9월 사이에 변화가 생길 가능성이 높아요"

${timeText}
${sajuContext}

${historyText}## 사용자 질문
${question}

## 대화 이어가기
- 답변 끝에 자연스럽게 관련된 후속 질문 1개를 던지세요 (사주 근거를 담은 구체적 질문)
- 예: "이직 고민 → 현재 대운이 언제 바뀌는지 궁금하세요?" / "연애 → 올해 인연의 기운이 언제 오는지 볼까요?"
- 단, 사용자가 "고마워", "알겠어", "도움됐어" 등 만족 표현을 하면 따뜻하게 마무리 + 새 주제 제안
- keywords 3개: 대화 맥락에 맞는 구체적인 후속 질문 (절대 일반적인 것 금지)

## 출력 (JSON만)
{
  "answer": "답변",
  "keywords": ["후속질문1", "후속질문2", "후속질문3"]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { answer: parsed.answer, keywords: parsed.keywords || [] };
  } catch {
    return { answer: text, keywords: ['올해 재물운은?', '연애운 궁금해요', '건강 쪽도 봐주세요'] };
  }
}
