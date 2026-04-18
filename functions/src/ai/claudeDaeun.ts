import Anthropic from '@anthropic-ai/sdk';

export async function generateDaeunAnalysis(apiKey: string, sajuData: any): Promise<any> {
  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt(sajuData);

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (msg.content[0] as any).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON 파싱 실패');
  return JSON.parse(jsonMatch[0]);
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
  d.daeun?.forEach((x: any) => { daeunList += `- ${x.간지} (${x.시작나이||x.나이범위||''}세~${x.끝나이||''}세)${x.isCurrent||x.현재 ? ' ★현재' : ''}\n`; });
  const currentDaeun = d.daeun?.find((x: any) => x.isCurrent || x.현재);
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월`;

  // 대운 periods를 사주 데이터에서 직접 구성
  const periodsTemplate = (d.daeun || []).map((du: any) => {
    const isCurrent = du.isCurrent || du.현재 || false;
    return `{"간지":"${du.간지}","시작나이":${du.시작나이||0},"끝나이":${du.끝나이||0},"isCurrent":${isCurrent},"theme":"4글자 키워드","career":"80자 이상 직업운","love":"80자 이상 연애운","wealth":"80자 이상 재물운","health":"80자 이상 건강운","score":1~100,"careerScore":0-100,"loveScore":0-100,"wealthScore":0-100,"healthScore":0-100,"advice":"50자 이상 조언"}`;
  }).join(',\n    ');

  return `명리학 40년 대가. "소름돋는" 대운 분석.

⚠️ 현재 날짜: ${dateStr}

## 사주 원국
${pillarsText}일간: ${p[2]?.천간 || '미상'}

## 오행: 목${el.목||0} 화${el.화||0} 토${el.토||0} 금${el.금||0} 수${el.수||0}
## 십성: ${sipsung || '미상'}
## 대운 리스트
${daeunList}
## 이름: ${d.input?.name||'미상'}, ${d.input?.gender==='male'?'남':'여'}

## ⭐ 소름 포인트
- 과거 대운: "~했을 가능성이 높습니다"
- 현재 대운: "지금 느끼시는 ~한 감정은 이 대운 때문입니다"
- 미래 대운: "~세 무렵에 변화가"

## 출력 (JSON만, 코드블록 없이)
⚠️ periods의 간지/시작나이/끝나이/isCurrent는 아래 값을 그대로 사용하세요.
{
  "keywords": ["#사주핵심키워드1","#키워드2","#키워드3"],
  "overview": "200자 이상. 전체 대운 흐름.",
  "periods": [
    ${periodsTemplate}
  ],
  "currentHighlight": "200자 이상. 현재 대운 소름 포인트.",
  "transitionAdvice": "100자 이상. 다음 대운 준비 조언.",
  "lifePhaseMap": [
    {"phase":"성장기","daeun":"간지","theme":"키워드"},
    {"phase":"도약기","daeun":"간지","theme":"키워드"},
    {"phase":"전성기","daeun":"간지","theme":"키워드"},
    {"phase":"수확기","daeun":"간지","theme":"키워드"}
  ]
}

⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
}
