import Anthropic from '@anthropic-ai/sdk';
import { safeParseJson } from './parseJson';

export async function generateMonthlyFortune(apiKey: string, sajuData: any): Promise<any> {
  const client = new Anthropic({ apiKey });
  const r = await client.messages.create({
    model: 'claude-4-sonnet-20250514',
    max_tokens: 3072,
    messages: [{ role: 'user', content: buildPrompt(sajuData) }],
  });
  return safeParseJson((r.content[0] as any).text);
}

function buildPrompt(d: any): string {
  const p = d.pillars || [];
  let saju = '';
  p.forEach((x: any, i: number) => { if (x.available !== false) saju += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  const el = d.elements || {};
  const cd = d.daeun?.find((x: any) => x.isCurrent || x.현재);

  return `사주명리학 2026월별운세. ${d.input?.name||'미상'} ${d.input?.gender==='male'?'남':'여'}
사주: ${saju}
오행: 목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0}
${cd ? '현재대운: '+cd.간지 : ''}
JSON만 출력. 12개월 각 구체적으로:
{"yearOverview":"80자","bestMonth":3,"worstMonth":8,"months":[{"month":1,"score":75,"theme":"10자","advice":"40자소름포인트"}]}`;
}
