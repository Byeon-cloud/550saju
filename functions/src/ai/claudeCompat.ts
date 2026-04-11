import Anthropic from '@anthropic-ai/sdk';
import { safeParseJson } from './parseJson';

export async function generateCompatibilityAnalysis(apiKey: string, sajuData1: any, sajuData2: any, relation: string): Promise<any> {
  const client = new Anthropic({ apiKey });
  const r = await client.messages.create({
    model: 'claude-4-sonnet-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildPrompt(sajuData1, sajuData2, relation) }],
  });
  return safeParseJson((r.content[0] as any).text);
}

function person(label: string, d: any): string {
  const p = d.pillars || [];
  let s = `${label}: ${d.input?.name||'미상'}(${d.input?.gender==='male'?'남':'여'}) `;
  p.forEach((x: any, i: number) => { if (x.available !== false) s += `${'년월일시'[i]}:${x.천간}${x.지지} `; });
  const el = d.elements || {};
  s += `오행:목${el.목||0}화${el.화||0}토${el.토||0}금${el.금||0}수${el.수||0}`;
  return s;
}

function buildPrompt(d1: any, d2: any, rel: string): string {
  return `사주궁합분석. 관계:${rel}
${person('1', d1)}
${person('2', d2)}
JSON만. 소름돋게:
{"overallScore":78,"summary":"150자소름포인트","categories":[{"id":"personality","name":"성격궁합","score":80,"description":"80자"},{"id":"values","name":"가치관","score":75,"description":"80자"},{"id":"communication","name":"소통","score":82,"description":"80자"},{"id":"emotion","name":"감정","score":70,"description":"80자"},{"id":"future","name":"미래","score":85,"description":"80자"}],"strengths":["30자","30자","30자"],"challenges":["30자","30자","30자"],"advice":"100자","futureOutlook":"80자","ohengHarmony":{"person1Element":"목","person2Element":"화","relation":"상생","description":"60자"}}`;
}
