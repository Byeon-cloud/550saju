import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    yearOverview: { type: SchemaType.STRING },
    bestMonth: { type: SchemaType.NUMBER },
    worstMonth: { type: SchemaType.NUMBER },
    months: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: {
      month: { type: SchemaType.NUMBER }, score: { type: SchemaType.NUMBER },
      theme: { type: SchemaType.STRING }, advice: { type: SchemaType.STRING },
      career: { type: SchemaType.STRING }, love: { type: SchemaType.STRING },
      wealth: { type: SchemaType.STRING }, luckyDay: { type: SchemaType.STRING },
      luckyItem: { type: SchemaType.STRING }, caution: { type: SchemaType.STRING },
    } } },
  },
};

export async function generateMonthlyFortune(apiKey: string, sajuData: any): Promise<any> {
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
  const currentDaeun = d.daeun?.find((x: any) => x.isCurrent || x.현재);
  const now = new Date().getMonth() + 1;

  return `당신은 명리학 40년 대가입니다. "돈 주고 본 것 같아. 소름돋아." 수준의 2026년 월별 운세를 작성하세요.

## 이 사람의 사주 원국
${pillarsText}일간(나): ${p[2]?.천간 || '미상'}

## 오행 분포
목(木): ${el.목||0}, 화(火): ${el.화||0}, 토(土): ${el.토||0}, 금(金): ${el.금||0}, 수(水): ${el.수||0}
${Object.entries(el).filter(([,v]) => v === 0).map(([k]) => `→ ${k} 부족: 해당 오행이 강한 달에 보충 기회`).join('\n')}
${Object.entries(el).filter(([,v]) => (v as number) >= 3).map(([k,v]) => `→ ${k} ${v}개 과다: 해당 오행이 겹치는 달에 주의`).join('\n')}

## 십성 배치
${sipsung || '미상'}

## 현재 대운
${currentDaeun ? `${currentDaeun.간지} (${currentDaeun.시작나이||currentDaeun.나이범위||''}세~)` : '미상'}

## 기본 정보
이름: ${d.input?.name||'미상'}, 성별: ${d.input?.gender==='male'?'남':'여'}

## ⭐ 작성 규칙

### 시제 (필수)
- 1~${now-1}월: 과거형 ("~했을 가능성이 높습니다", "~한 경험이 있었을 거예요")
- ${now}월: 현재형 ("지금 ~하고 계신다면", "이번 달은~")
- ${now+1}~12월: 미래형 ("~할 거예요", "~가 예상됩니다")

### yearOverview (200자 이상)
- 2026년 전체 흐름을 한 문단으로 (어느 시기에 상승/하강인지)
- 사주 원국과 2026 병오(丙午)년의 상호작용 설명

### 각 month 항목
- theme: 그 달의 핵심 키워드 (4~8글자)
- advice: 100자 이상. 그 달의 월지와 일간의 관계에서 나오는 구체적 조언
- career: 80자 이상. 직장/사업 관련 구체적 예측 ("이직 기회가", "프로젝트 완성의")
- love: 80자 이상. 연애/관계 예측 ("새 인연이 6월 중순~", "기존 관계 갈등 후 회복")
- wealth: 80자 이상. 재물/투자 조언 ("지출 주의", "투자 적기")
- luckyDay: 그 달에서 가장 좋은 날짜 범위
- luckyItem: 사주 오행에 맞는 행운 아이템
- caution: 그 달의 주의점 (건강/관계/재물 중 1가지)
- score: 1~10

### ⭐ 소름 포인트 (각 달의 advice에 1개씩)
- 과거 달: "이 시기에 ~한 일이 있었을 거예요" (사주 근거로 맞추기)
  예: "3월에 예상치 못한 지출이 있었을 수 있어요. 월지가 일간을 극하는 달이었거든요"
- 현재 달: "지금 느끼시는 ~한 감정은 이 달의 기운 때문이에요"
- 미래 달: 구체적 시기+행동 ("8월 15~20일 사이에 중요한 제안이 올 수 있어요")`;
}
