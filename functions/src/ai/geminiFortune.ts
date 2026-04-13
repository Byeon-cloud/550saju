import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    grade: { type: SchemaType.STRING },
    gradeLabel: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    scores: { type: SchemaType.OBJECT, properties: {
      love: { type: SchemaType.NUMBER }, career: { type: SchemaType.NUMBER },
      wealth: { type: SchemaType.NUMBER }, health: { type: SchemaType.NUMBER },
    } },
    lucky: { type: SchemaType.OBJECT, properties: {
      color: { type: SchemaType.STRING }, colorHex: { type: SchemaType.STRING },
      number: { type: SchemaType.NUMBER }, direction: { type: SchemaType.STRING },
      item: { type: SchemaType.STRING }, food: { type: SchemaType.STRING },
    } },
    advice: { type: SchemaType.STRING },
  },
};

/**
 * 오늘의 운세 — Gemini 2.5 Flash
 */
export async function generateDailyFortuneAI(
  apiKey: string,
  answers: number[],
  timeSlot: string,
  sajuSummary?: { ilgan: string; oheng: string; name: string },
  userConcern?: string,
): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 } as any,
  } as any);

  const timeLabels: Record<string, string> = {
    latenight: '자시(子時) — 수(水)의 깊은 기운. 이 시간까지 깨어있다면 중요한 고민이 있음.',
    dawn: '인시(寅時) — 목(木)의 움트는 기운. 하루의 방향을 잡는 시간.',
    morning: '오전 — 양(陽) 기운이 충만. 새로운 시작에 유리한 시간대.',
    noon: '오시(午時) — 화(火)의 절정. 직감이 또렷해지는 시간.',
    afternoon: '오후 — 금(金)의 수렴 기운. 판단력과 결정력이 좋아지는 시간.',
    evening: '저녁 — 하루를 정리하고 내일을 설계하는 시간.',
    night: '해시(亥時) — 수(水)의 시작. 밤의 직감이 낮보다 예리한 시간.',
  };

  const concernLabels = ['이직·진로', '연애·관계', '재정·투자', '체력·건강', '인간관계', '전반적 흐름'];
  const concern = answers.length > 0 ? concernLabels[answers[0]] || '전반적 흐름' : '전반적 흐름';

  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;

  // 유저가 직접 입력한 구체적 질문
  const userQuestionBlock = userConcern?.trim()
    ? `\n## ⭐⭐ 사용자가 직접 적은 질문 (반드시 summary에서 구체적으로 답변!!)
"${userConcern.trim()}"
→ 이 질문에 대해 사주와 오행 관점에서 구체적으로 답변하세요.
→ summary의 첫 문단에서 이 질문을 직접 언급하며 답변을 시작하세요.
→ 예: "면접이 걱정되시는군요. 오늘 사주의 흐름을 보면..."
→ 예: "재테크 타이밍이 궁금하시군요. 오늘의 금(金) 기운을 보면..."
→ 이 질문을 무시하면 안 됩니다!`
    : '';

  const prompt = `당신은 명리학 40년 경력의 운세 전문가입니다.
"돈 주고 본 것 같아. 소름돋아." — 이 반응이 나올 정도로 구체적이고 맞춤형으로 작성하세요.

## 오늘의 정보
날짜: ${dateStr}
시간대: ${timeLabels[timeSlot] || timeLabels.morning}
사용자의 관심 영역: ${concern}
${userQuestionBlock}

## 사주 정보
${sajuSummary ? `이름: ${sajuSummary.name}, 일간: ${sajuSummary.ilgan}(${sajuSummary.oheng})
→ ${sajuSummary.oheng} 일간의 특성을 오늘의 운세에 구체적으로 반영하세요.` : '사주 미등록 사용자 — 일반적이되 구체적인 운세 제공'}

## ⭐ 소름 포인트 (반드시 summary에 1~2개 포함)
- 시간대와 오행을 연결: "이 시간에 운세를 보셨다는 건, 수(水)의 직감이 작동하고 있다는 뜻이에요"
- 관심사와 사주를 연결: "${concern}이 신경 쓰이시는 이유가 사주에서 보여요"
- 구체적 시간/방향/숫자 조언: "오늘 3시 이후에 중요한 대화를 하세요"

## 작성 규칙
- grade: S(90+) > A(75+) > B(60+) > C(60 미만)
- gradeLabel: 시간대 반영 (새벽이면 "새벽의 축복", 밤이면 "밤의 지혜" 등)
- summary: 200자 이상.${userConcern?.trim() ? ' 첫 문단에서 사용자 질문에 구체적으로 답변.' : ''} 시간대 톤 + 사주 맞춤 해석 + 소름 포인트 포함. 줄바꿈(\\n) 사용.
- scores: 사주 오행에 기반한 구체적 점수 (무작위 금지)
- lucky: 사주 오행의 부족한 기운을 보충하는 색/방향/아이템 추천
- advice: ${userConcern?.trim() ? '사용자 질문에 대한 핵심 답변을 포함한' : timeSlot === 'night' ? '밤의 직감을 살려주는' : '하루를 이끌어주는'} 한 줄 핵심 조언 (30자 이상)`;

  try {
    const r = await model.generateContent(prompt);
    const text = r.response.text();
    console.log('[geminiFortune] Response length:', text.length);
    return JSON.parse(text);
  } catch (err: any) {
    console.error('[geminiFortune] Failed:', err.message);
    if (err.message?.includes('SAFETY')) throw new Error('안전 필터에 의해 차단됨');
    if (err.message?.includes('quota') || err.message?.includes('429')) throw new Error('API 호출 한도 초과');
    throw err;
  }
}
