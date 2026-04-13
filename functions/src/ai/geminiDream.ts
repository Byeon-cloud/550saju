import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    interpretation: { type: SchemaType.STRING },
    luckyAction: { type: SchemaType.STRING },
    category: { type: SchemaType.STRING },
    verdict: { type: SchemaType.STRING },
    verdictScore: { type: SchemaType.NUMBER },
  },
};

/**
 * 꿈해몽 — Gemini 2.5 Flash (핵심 필드만 스키마)
 */
export async function generateDreamInterpretation(
  apiKey: string,
  category: string,
  dreamText: string,
  sajuData?: any,
): Promise<{ title: string; interpretation: string; luckyAction: string; category: string; verdict?: string; verdictScore?: number }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 } as any,
  } as any);

  let sajuContext = '';
  if (sajuData?.pillars) {
    const p = sajuData.pillars;
    const el = sajuData.elements || {};
    const sipsung = sajuData.sipsung?.map((s: any) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
    const currentDaeun = sajuData.daeun?.find((d: any) => d.isCurrent || d.현재);
    const missing = Object.entries(el).filter(([,v]) => v === 0).map(([k]) => k);
    const excess = Object.entries(el).filter(([,v]) => (v as number) >= 3).map(([k,v]) => `${k}(${v}개)`);

    sajuContext = `## 이 사람의 사주 정보 (반드시 해석에 연결!)
이름: ${sajuData.input?.name||'미상'}, 성별: ${sajuData.input?.gender==='male'?'남':'여'}
일간: ${p[2]?.천간 || '미상'}(${p[2]?.천간읽기 || ''})
오행: 목${el.목||0} 화${el.화||0} 토${el.토||0} 금${el.금||0} 수${el.수||0}
${missing.length ? `부족한 오행: ${missing.join(', ')} → 무의식이 꿈으로 보충하려 할 수 있음` : ''}
${excess.length ? `과다한 오행: ${excess.join(', ')} → 꿈에서 강렬하게 표현될 수 있음` : ''}
십성: ${sipsung || '미상'}
현재 대운: ${currentDaeun ? `${currentDaeun.간지}` : '미상'}`;
  }

  const prompt = `당신은 명리학 + 꿈 해석 40년 경력의 전문가입니다.

## 사용자 입력
- 카테고리: ${category}
- 꿈 내용: "${dreamText || '(카테고리 기반으로 해석)'}"

${sajuContext}

## 절대 규칙
- 사용자가 적은 꿈 내용의 키워드를 반드시 인용하면서 해석
- "돼지 꿈"이면 돼지에 대해 해석. 다른 상징으로 바꾸지 말 것
- 꿈 내용이 없으면 카테고리의 가장 흔한 꿈을 풍성하게 해석

## 각 필드 규칙

title: 6~12글자. 꿈의 핵심을 감성적으로 압축. 사용자 입력 키워드 포함.

interpretation: 반드시 600자 이상! 3단락으로 작성. 줄바꿈(\\n\\n)으로 구분.
  1단락(200자+): 꿈의 핵심 상징 해석. "꿈에서 보신 OO은..." 으로 시작. 명리학 오행 관점 분석.
  2단락(200자+): 현실 연결 + 소름 포인트. "혹시 요즘 ~한 상황이 아니신가요?" 형태 1~2개. ${sajuContext ? '사주 오행과 연결.' : ''}
  3단락(200자+): 이 꿈의 메시지. 불안한 꿈도 긍정적 전환. "앞으로 2~3주 내 변화가 올 수 있어요."

luckyAction: 80자 이상. 구체적 행동 1가지 + 오행 보충(색상, 방향, 시간대 중 2가지).
  예: "오늘 파란색 옷을 입고 동쪽으로 산책하세요. 수(水) 기운을 보충합니다."

category: 재물/기회, 관계/내면, 전환/성장, 경고/조심, 건강/에너지 중 1개

verdict: 20~30자. 한 줄 판정. 예: "재물과 기회가 찾아오는 길몽"

verdictScore: 1~100. 길몽 점수. 90+대길몽, 70-89길몽, 50-69보통, 30-49주의, 0-29흉몽`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('[geminiDream] Response length:', text.length);
    const parsed = JSON.parse(text);
    // 빈 interpretation 방어
    if (!parsed.interpretation || parsed.interpretation.length < 50) {
      console.warn('[geminiDream] interpretation too short, using fallback');
      parsed.interpretation = `"${dreamText || category}" 꿈은 무의식에서 중요한 메시지를 보내고 있습니다.\n\n이 꿈의 상징은 현재 당신의 삶에서 전환이 필요한 영역을 가리키고 있어요. 명리학에서 꿈은 오행의 흐름이 무의식을 통해 표현되는 것으로 봅니다. 꿈에서 느꼈던 감정이 현실의 어떤 상황과 연결되는지 떠올려보세요.\n\n앞으로 2~3주 내에 이 꿈과 관련된 변화의 신호가 올 수 있습니다. 마음을 열고 주변을 관찰해보세요. 이 꿈은 끝이 아니라 새로운 시작을 알리는 신호입니다.`;
    }
    if (!parsed.luckyAction || parsed.luckyAction.length < 20) {
      parsed.luckyAction = '오늘은 자신의 내면에 집중하는 시간을 가져보세요. 조용한 곳에서 10분간 명상하면 꿈의 메시지를 더 선명하게 이해할 수 있어요.';
    }
    return parsed;
  } catch (err: any) {
    console.error('[geminiDream] Failed:', err.message);
    return {
      title: category,
      interpretation: `"${dreamText || category}" 꿈은 무의식에서 중요한 메시지를 보내고 있습니다.\n\n이 꿈의 상징은 현재 당신의 삶에서 전환이 필요한 영역을 가리키고 있어요. 명리학에서 꿈은 오행의 흐름이 무의식을 통해 표현되는 것으로 봅니다.\n\n앞으로 2~3주 내에 이 꿈과 관련된 변화의 신호가 올 수 있습니다. 마음을 열고 주변을 관찰해보세요.`,
      luckyAction: '오늘은 자신의 내면에 집중하는 시간을 가져보세요. 조용한 곳에서 10분간 명상하면 꿈의 메시지를 더 선명하게 이해할 수 있어요.',
      category: '전환/성장',
      verdict: '변화를 알리는 꿈',
      verdictScore: 65,
    };
  }
}
