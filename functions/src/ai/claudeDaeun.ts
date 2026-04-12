import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overview: { type: SchemaType.STRING },
    periods: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      간지: { type: SchemaType.STRING }, age: { type: SchemaType.STRING },
      theme: { type: SchemaType.STRING }, score: { type: SchemaType.NUMBER },
      detail: { type: SchemaType.STRING },
    } } },
    currentHighlight: { type: SchemaType.STRING },
    transitionAdvice: { type: SchemaType.STRING },
  },
};

export async function generateDaeunAnalysis(apiKey: string, sajuData: any): Promise<any> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema, maxOutputTokens: 65536 } as any,
    thinkingConfig: { thinkingBudget: 0 },
  } as any);
  const r = await model.generateContent(buildPrompt(sajuData));
  return JSON.parse(r.response.text());
}

function buildPrompt(d: any): string {
  const p = d.pillars || [];
  const labels = ['년주', '월주', '일주', '시주'];
  let pillarsText = '';
  p.forEach((x: any, i: number) => {
    if (x.available !== false) pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기||''})${x.지지}(${x.지지읽기||''})\n`;
  });

  const el = d.elements || {};
  const sipsung = d.sipsung?.map((s: any) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';

  let daeunList = '';
  d.daeun?.forEach((x: any) => {
    daeunList += `- ${x.간지} (${x.시작나이||x.나이범위||''}세~${x.끝나이||''}세)${x.isCurrent||x.현재 ? ' ★현재' : ''}\n`;
  });

  const currentDaeun = d.daeun?.find((x: any) => x.isCurrent || x.현재);

  return `당신은 명리학 40년 대가입니다. "돈 주고 본 것 같아. 소름돋아." 수준의 대운 분석을 하세요.

## 이 사람의 사주 원국
${pillarsText}일간(나): ${p[2]?.천간 || '미상'} — 이 사람의 본질

## 오행 분포
목(木): ${el.목||0}, 화(火): ${el.화||0}, 토(土): ${el.토||0}, 금(金): ${el.금||0}, 수(水): ${el.수||0}
${Object.entries(el).filter(([,v]) => v === 0).map(([k]) => `→ ${k}이 없음 (대운에서 보충되면 인생 전환점)`).join('\n')}

## 십성 배치
${sipsung || '미상'}

## 대운 리스트
${daeunList}
현재 대운: ${currentDaeun ? `${currentDaeun.간지} (${currentDaeun.시작나이||currentDaeun.나이범위||''}세~)` : '미상'}

## 기본 정보
이름: ${d.input?.name||'미상'}, 성별: ${d.input?.gender==='male'?'남':'여'}

## ⭐ 분석 규칙

### overview (200자 이상)
- "이 사람의 인생은 __에서 __으로 흘러가는 물줄기입니다" 식의 비유로 시작
- 전체 대운 흐름의 핵심 패턴 요약 (어떤 시기에 전환점이 오는지)

### 각 periods의 detail (각 150자 이상)
- 그 대운의 간지가 사주 원국과 어떤 관계인지 (생/극/합)
- 구체적 묘사: "이 시기에 직장을 옮기거나", "예상치 못한 사람을 만나", "건강에 특히 주의가 필요한"
- 과거 대운: "~했을 가능성이 높습니다" (맞추면 소름)
- 현재 대운: "지금 느끼시는 ~한 감정은 이 대운 때문입니다"
- 미래 대운: "~세 무렵에 중요한 변화가 있을 거예요"
- score: 1~10 (사주와의 궁합)

### ⭐ 소름 포인트 (반드시 currentHighlight에 포함)
- 현재 대운의 오행이 사주에 미치는 영향을 일상 패턴으로 묘사
  예: "요즘 결정을 내릴 때 자꾸 망설이시죠? 현재 대운이 관성이라 그렇습니다"
  예: "최근 2~3년 사이에 '내가 왜 이 일을 하고 있지?'라는 생각이 들었다면..."
  예: "다음 대운이 오면 지금의 고민이 웃길 정도로 자연스럽게 풀립니다"
- 대운 전환기 ±2년의 체감 변화 묘사

### transitionAdvice (100자 이상)
- 현재 → 다음 대운으로 넘어가는 구체적 조언
- 시기, 방향, 행동 중 1가지 이상 포함`;
}
