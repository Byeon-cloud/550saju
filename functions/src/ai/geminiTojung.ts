import Anthropic from '@anthropic-ai/sdk';

export async function generateTojungBigyeol(apiKey: string, sajuData: any): Promise<any> {
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
  p.forEach((x: any, i: number) => { if (x.available !== false) pillarsText += `${labels[i]}: ${x.천간}(${x.천간읽기||''})${x.지지}(${x.지지읽기||''})\n`; });
  const el = d.elements || {};
  const sipsung = d.sipsung?.map((s: any) => `${s.위치}: ${s.글자}(${s.십성})`).join(', ') || '';
  const currentDaeun = d.daeun?.find((x: any) => x.isCurrent || x.현재);
  const now = new Date().getMonth() + 1;
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월`;

  return `토정비결 대가. "소름돋는" 2026 병오년 토정비결.

⚠️ 현재 날짜: ${dateStr}

## 사주 원국
${pillarsText}일간: ${p[2]?.천간 || '미상'}

## 오행: 목${el.목||0} 화${el.화||0} 토${el.토||0} 금${el.금||0} 수${el.수||0}
## 십성: ${sipsung || '미상'}
## 현재 대운: ${currentDaeun ? currentDaeun.간지 : '미상'}
## 이름: ${d.input?.name||'미상'}, ${d.input?.gender==='male'?'남':'여'}, ${d.input?.birthYear||''}년생${d.띠 ? `, ${d.띠}띠` : ''}

## 출력 (JSON만, 코드블록 없이)
{
  "keywords": ["#사주핵심키워드1","#키워드2","#키워드3"],
  "categoryScores": {"총운": "0-100 정수", "금전운": "0-100 정수", "건강운": "0-100 정수", "직장운": "0-100 정수", "애정운": "0-100 정수", "결혼운": "0-100 정수"},
  "yearOverview": {
    "총운": "150자 이상", "금전운": "150자 이상", "건강운": "150자 이상",
    "직장운": "150자 이상", "애정운": "150자 이상", "결혼운": "150자 이상"
  },
  "months": [
    {"month": 1, "괘": "주역 64괘 중 하나 (예: 地天泰)", "괘의미": "괘의 뜻 한 줄 (예: 하늘과 땅이 교류하여 모든 것이 형통함)",
     "전통해석": "80자 이상. 토정비결 전통 시적 표현 (고풍스럽게, 4자 성어 활용)",
     "현대해석": "80자 이상. 현대어로 구체적 상황 묘사 (직장, 연애, 금전 등)",
     "score": 1-100, "keyword": "4~6글자"}, ...12개월
  ],
  "luckyAdvice": "100자 이상. 올해 개운법."
}

⚠️ 작성 규칙: 모든 텍스트는 순수 한국어로. 마크다운 서식(**볼드**, *이탤릭*, # 헤딩, \`코드\`)을 절대 사용하지 마. 강조가 필요하면 "따옴표"나 문맥으로 표현해.`;
}
