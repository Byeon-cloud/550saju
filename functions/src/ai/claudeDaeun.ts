import Anthropic from '@anthropic-ai/sdk';

export async function generateDaeunAnalysis(apiKey: string, sajuData: any): Promise<any> {
  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt(sajuData);

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    temperature: 0.1, // 결정론적 — 같은 사주 = 같은 결과
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
⚠️ **점수 필드 룰 (2026-05-04 준기 결단)**: 모든 score (categoryScores·subScores·overallScore·monthlyScore·compatScore·careerScore 등) 는 **5의 배수만 반복 금지**. 65·70·75·80 같은 fake 신호 X. 67·73·81·88 같이 자연수로 출력. 같은 카테고리 안 점수가 모두 다른 값이어야 함.

🚨 **톤 룰 (2026-05-05 준기 PD 결단 — 외계어 X · 일상어 O)**

준기 지인 직접 피드백:
> '무슨 말인지 모르겠다. 한낮의 태양이다 / 겨울 한복판에 태어난 태양이다 / 형국이다 — 이게 뭔 뜻이냐.
>  사주는 알아듣기 편하게 말해줘서 돈 주고 보는 거지, 어렵고 모호한 표현이면 돈 안 낸다.'

❌ **절대 금지 패턴**:
1. 시적 비유 폭격: '한낮의 태양' '차가운 밤 호수' '장작을 대주는 자리' '~의 형국' — 비유가 풀이를 대체 X.
2. 문어체 단어 남발: '결' '자리' '형국' 한 문단 2회 이내.
3. 중의적·모호한 표현: '흐름이 풀리는 자리' → '30대 중반에 일이 잘 풀립니다'
   '준비된 결이 또렷' → '준비는 잘 되어 있어요' / '의식의 자리에 두십시오' → '꼭 신경 쓰세요'
4. 한자 폭격: 한자(丙火·신금·축미충 등) 첫 등장 1번만, 이후는 한글 또는 일상어.

📚 **"사주아이" 톤 레퍼 (참고 · 모방 X · 우리 특색 살림)**:
1. **각 섹션 시작 = 일상어 결론 한 줄** (제목 후크 톤)
   ✅ '겉으로는 차분해 보이지만 속에는 따뜻함을 찾는 마음이 늘 움직이는 분입니다'
2. **사주 근거는 두 번째 문장부터, 한자는 1회만** + 즉시 일상어 풀이
3. **공감 + 위로 + 행동 처방** (가장 강력)
   ✅ '<strong>본인에게는 가혹한 잣대를 들이대요</strong>. 이제는 본인 행복을 위해 그 섬세함을 써보세요. <strong>완벽하지 않아도 충분히 가치 있는 사람입니다</strong>.'
4. **마무리 = 응원 + 구체 행동** (행운 색·방위·시기 등 구체)

✨ **우리만의 차별화**:
- 6대 원전 학술 인용 1회 자연스럽게
- 결정론 (같은 사주 = 같은 결과)
- 한자 1회 등장 시 즉시 일상어 풀이 동반
- strong 강조는 유저 일상 결론에만
- 숫자·시기 또렷이 ('30대 후반' '9월~2월')


✅ **풀이 작성 규칙**:
- **첫 문장은 결론** ('이혜지 님은 ~한 사람입니다')
- **비유는 한 번만, 즉시 결론 풀이** ('겨울에 태어난 태양 → 즉, ~한 사람')
- **한자 등장 직후 일상어 풀이 동반** ('병화(丙火) — 즉 밝고 활달한 성격')
- 단정 X / 모호 X / 중의 X — 그냥 직접 말하기.

✅ **변환 예시**:
- ❌ '도화살(桃花殺)이 강하게 작용합니다.'
- ✅ '<b>도화살(桃花殺)</b> — 즉 <strong>사람을 끌어당기는 매력</strong>이 강해요.'


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
