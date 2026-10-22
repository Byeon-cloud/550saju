/**
 * 'X가 아니라 Y' 문장 고치기 (2026-10-22, 점검 P0-1)
 *   꿈해몽은 TONE_FINAL_CHECK 에 '아니라 0개' 규칙이 있어도 한 편에 5~6번 쓴다(같은 꿈 두 번 실측).
 *   20~30대가 AI 글로 알아보는 첫 꼴이라, 응답의 문자열 칸에서 그 문장만 모아 Sonnet 에 '지울 덩어리'만 고르게 하고 지우는 건 서버가 한다.
 *   문장을 통째로 다시 쓰게 하면 Haiku 가 '~되기보다'로 바꾸거나 낱말을 잘라 문장을 깨뜨렸다(실측 3회 중 2회). 덩어리는 원문 글자 그대로여야 하고
 *   낱말 첫머리에서 시작해 '아니라 '로 끝나야 지운다. 검사를 못 넘거나, 호출이 실패하거나 8초를 넘으면 원문 그대로 둔다(본 응답을 막지 않는다).
 */
import { createClaude, CLAUDE_MODEL } from './claudeClient';
import { logAnthropicUsage } from './aiUsageLog';

const MARK = '아니라';
const MAX_SENTENCES = 12;
const TIMEOUT_MS = 8000;

const SYSTEM = `한국어 문장에서 지울 부분을 골라 주는 편집자다.
받은 문장마다 'X가 아니라 Y', 'X이 아니라 Y', 'X는 게 아니라 Y' 꼴이 있다. 부정하는 쪽인 X 와 그 뒤의 조사와 '아니라'까지를 한 덩어리로 골라, 그 덩어리를 지우면 남은 문장이 Y 만 말하는 자연스러운 한 문장이 되게 한다.
- 덩어리는 문장에 있는 글자 그대로, 띄어쓰기와 쉼표까지 똑같이 옮긴다. 낱말 중간에서 시작하지 않는다. '아니라' 뒤의 띄어쓰기 한 칸이나 쉼표까지 넣는다.
- X 를 꾸미는 말(예: '아픈 이별이 아니라 '의 '아픈')도 덩어리에 넣는다. 그래야 남은 문장이 끊기지 않는다.
- 입력과 같은 개수, 같은 순서의 JSON 문자열 배열로만 답한다. 다른 말은 쓰지 않는다.
예: 입력 ["피가 나지 않았으니 아픈 이별이 아니라 묵은 것이 정리되는 흐름입니다."] → 답 ["아픈 이별이 아니라 "]`;

type Hit = { holder: any; key: string | number; sentence: string };

/** 문자열 칸을 돌며 '아니라'가 든 문장을 모은다. 문장은 마침표, 물음표, 느낌표, 줄바꿈 단위 */
function collect(node: any, out: Hit[], depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 8) return;
  const keys: Array<string | number> = Array.isArray(node) ? node.map((_: unknown, i: number) => i) : Object.keys(node);
  for (const k of keys) {
    const v = (node as any)[k];
    if (typeof v === 'string') {
      if (!v.includes(MARK)) continue;
      const parts = v.match(/[^.?!\n]+[.?!]*|\n+/g) || [];
      for (const p of parts) {
        const s = p.trim();
        if (s.includes(MARK)) out.push({ holder: node, key: k, sentence: s });
      }
    } else if (v && typeof v === 'object') {
      collect(v, out, depth + 1);
    }
  }
}

/** 지울 덩어리 검사: 문장 안에 그대로 있고, 낱말 첫머리에서 시작해 '아니라' 와 띄어쓰기(또는 쉼표)로 끝나고, 문장의 60% 를 넘지 않는다 */
function cutFrom(orig: string, chunk: unknown): string | null {
  if (typeof chunk !== 'string' || !chunk) return null;
  if (!/아니라[,\s]\s*$/.test(chunk)) return null;
  const at = orig.indexOf(chunk);
  if (at < 0 || chunk.length > orig.length * 0.6) return null;
  if (at > 0 && !/[\s,(>]/.test(orig[at - 1])) return null;
  if (/<\/?(strong|b|u)>/.test(chunk)) return null; // 태그 짝이 깨지지 않게 태그를 걸친 덩어리는 건너뛴다
  const fixed = (orig.slice(0, at) + orig.slice(at + chunk.length)).replace(/\s{2,}/g, ' ');
  if (fixed.includes(MARK) || fixed.trim().length < 8) return null;
  return fixed;
}

/** result 안의 '아니라' 문장을 고쳐 제자리에 넣는다. 고친 문장 수를 돌려준다 (실패는 0) */
export async function repairAniraSentences(apiKey: string, result: unknown, usageType: string): Promise<number> {
  try {
    const hits: Hit[] = [];
    collect(result, hits);
    if (!hits.length) return 0;
    const batch = hits.slice(0, MAX_SENTENCES);
    const anthropic = createClaude(apiKey);
    const t0 = Date.now();
    const call = anthropic.messages.create({
      model: CLAUDE_MODEL.sonnet,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(batch.map(h => h.sentence)) }],
    } as any);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const msg: any = await Promise.race([
      call,
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('toneRepair timeout')), TIMEOUT_MS); }),
    ]).finally(() => { if (timer) clearTimeout(timer); });
    logAnthropicUsage(usageType, CLAUDE_MODEL.sonnet, msg, t0, 'callable');
    const text = String(msg?.content?.[0]?.text || '');
    const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
    const arr = JSON.parse(json);
    if (!Array.isArray(arr) || arr.length !== batch.length) return 0;
    let fixedN = 0;
    batch.forEach((h, i) => {
      const fixed = cutFrom(h.sentence, arr[i]);
      if (!fixed) return;
      const cur = h.holder[h.key];
      if (typeof cur !== 'string' || !cur.includes(h.sentence)) return;
      h.holder[h.key] = cur.replace(h.sentence, fixed);
      fixedN++;
    });
    console.info(`[toneRepair] ${usageType} 아니라 ${hits.length}문장 중 ${fixedN} 고침`, fixedN < batch.length ? JSON.stringify(arr).slice(0, 300) : '');
    return fixedN;
  } catch (e: any) {
    console.warn('[toneRepair] 건너뜀:', e?.message);
    return 0;
  }
}
