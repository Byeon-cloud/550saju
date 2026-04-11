import Anthropic from '@anthropic-ai/sdk';
import { safeParseJson } from './parseJson';

export async function generateDaeunAnalysis(apiKey: string, sajuData: any): Promise<any> {
  const client = new Anthropic({ apiKey });
  const r = await client.messages.create({
    model: 'claude-4-sonnet-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: buildPrompt(sajuData) }],
  });
  return safeParseJson((r.content[0] as any).text);
}

function buildPrompt(d: any): string {
  const p = d.pillars || [];
  let saju = '';
  p.forEach((x: any, i: number) => { if (x.available !== false) saju += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  const el = d.elements || {};
  let daeunList = '';
  d.daeun?.forEach((x: any) => { daeunList += `${x.간지}(${x.시작나이||''}~${x.끝나이||''})${x.isCurrent?' ★':''} `; });

  return `사주명리학 대운분석. ${d.input?.name||'미상'} ${d.input?.gender==='male'?'남':'여'}
사주: ${saju}
오행: 목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0}
대운: ${daeunList}
JSON만 출력. 소름돋게 구체적으로:
{"overview":"전체흐름80자","periods":[{"간지":"","age":"1~10세","theme":"8자","score":75,"detail":"각60자구체적","advice":"25자"}],"currentHighlight":"현재대운120자소름포인트","transitionAdvice":"전환기50자","lifePhaseMap":[{"phase":"청소년기","daeun":"甲子","theme":"8자"}]}`;
}
