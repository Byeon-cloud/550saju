import Anthropic from '@anthropic-ai/sdk';

export async function generateDaeunAnalysis(apiKey: string, sajuData: any): Promise<any> {
  const anthropic = new Anthropic({ apiKey });
  const prompt = buildPrompt(sajuData);

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
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

  return `당신은 명리학 40년 대가입니다. "돈 주고 본 것 같아. 소름돋아." 수준의 대운 분석.

⚠️ 현재 날짜: ${dateStr} — 반드시 이 기준으로 과거/현재/미래를 구분하세요.

## 사주 원국
${pillarsText}일간: ${p[2]?.천간 || '미상'}

## 오행 분포
목${el.목||0} 화${el.화||0} 토${el.토||0} 금${el.금||0} 수${el.수||0}
${Object.entries(el).filter(([,v]) => v === 0).map(([k]) => `→ ${k} 없음`).join('\n')}

## 십성: ${sipsung || '미상'}

## 대운 리스트
${daeunList}
현재 대운: ${currentDaeun ? `${currentDaeun.간지}` : '미상'}

## 이름: ${d.input?.name||'미상'}, 성별: ${d.input?.gender==='male'?'남':'여'}

## ⭐ 소름 포인트 필수
- 과거 대운: "~했을 가능성이 높습니다" (맞추면 소름)
- 현재 대운: "지금 느끼시는 ~한 감정은 이 대운 때문입니다"
- 미래 대운: "~세 무렵에 중요한 변화가 있을 거예요"

## 출력 (JSON만, 코드블록 없이)
{
  "overview": "200자 이상. 전체 대운 흐름의 핵심 패턴.",
  "periods": [{"간지": "甲子", "age": "1~10세", "theme": "4글자", "score": 1-10, "detail": "150자 이상. 구체적 묘사."}, ...],
  "currentHighlight": "200자 이상. 현재 대운의 소름 포인트.",
  "transitionAdvice": "100자 이상. 다음 대운 준비 조언."
}`;
}
