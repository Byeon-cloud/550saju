/* 60일주 검색 페이지 글 만들기 (2026-10-17) — 사용: node scripts/seo/gen-ilju.cjs [갑자 ...]
 *   근거는 ilju-facts.cjs 확정표(12운성, 지장간, 배우자 자리 십성, 일주 신살, 천지합 짝). AI 는 문장만.
 *   결과 src/data/seo/ilju.json (있는 일주는 건너뛴다). 먼저 functions 빌드. 키는 시크릿에서 읽기만 하고 찍지 않는다.
 *   원가: 일주 하나에 Sonnet 한 번(약 40~60원), 60개 약 3천 원. */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { GAPJA, iljuFacts, factsText } = require('./ilju-facts.cjs');

const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'src/data/seo/ilju.json');
const lazy = () => ({ ...require(path.join(ROOT, 'functions/lib/shared/claudeClient.js')), ...require(path.join(ROOT, 'functions/lib/ai/promptsV3.js')), ...require(path.join(ROOT, 'functions/lib/ai/sajuFacts.js')) });

const SYSTEM = `당신은 사주500 의 명리 풀이가입니다. '갑자일주', '병오일주 특징'처럼 일주를 검색한 사람이 읽는 일주론 글을 씁니다. 읽는 사람은 사주를 조금 아는 20~40대와 처음 보는 사람이 섞여 있습니다.

## 근거
- 근거는 확정표뿐입니다: 일간과 일지의 오행과 음양, 일지(배우자 자리)의 본기 십성, 지장간, 12운성, 일주 신살, 천지합 짝 일주, 부딪히는 지지. 표에 없는 신살과 성격을 지어내지 않습니다.
- 명리에서 전해 오는 일주론의 큰 흐름을 따르되, 그 일주를 가진 사람이 실제로 겪는 모습(말투, 일하는 방식, 연애에서 생기는 일)으로 씁니다.
- 일주 하나로 사람 전체가 정해지지 않습니다. 월지와 시주, 대운에 따라 달라진다는 점을 한 번만 짧게 밝힙니다(summary 끝이나 faq).
- 겁주는 말(이혼, 단명, 망한다, 박복)과 확률, 보장, '반드시'는 쓰지 않습니다. 괴강, 백호, 양인 같은 신살도 겁주지 않고 그 힘을 어떻게 쓰면 좋은지로 씁니다.
- 아들 딸, 결혼 나이를 점치지 않습니다.

## 쓰는 법
- summary: 두 문장, 90~140자. 첫 문장은 '{일주}는 ~한 일주입니다.' 꼴.
- personality: 네 문장, 200~300자. 일간과 일지의 관계, 12운성으로 본 힘의 결을 쉬운 말로 풀어 성격과 장점, 약점을 씁니다.
- love: 세 문장, 150~230자. 배우자 자리(일지)의 십성으로 연애와 결혼에서 끌리는 사람, 생기는 일, 챙길 일.
- work: 세 문장, 150~230자. 잘 맞는 일과 돈을 대하는 방식.
- care: 두 문장, 90~150자. 조심할 점을 할 일로.
- sinsal: 신살이 있으면 두 문장(그 신살이 이 일주에 주는 힘과 쓰는 법), 없으면 빈 문자열.
- faq: 두 개. q 는 실제 검색 질문 꼴('갑자일주는 연애할 때 어떤가요?', '갑자일주와 잘 맞는 일주는?'). 잘 맞는 일주 질문에는 표의 천지합 짝을 답합니다. a 는 두 문장.
- 명리 용어는 일주, 일간, 일지, 오행(목, 화, 토, 금, 수), 십성 이름, 12운성 이름, 신살 이름까지만 쓰고, 처음 나올 때 괄호로 뜻을 풉니다('정인(나를 돕는 기운)'). 한자는 일주 이름에만 한 번 씁니다.
- 평범한 한국어 문장으로 씁니다. 'A 대신 B', '~라기보다', 말 순서를 뒤집은 문장, 명사로 끊는 문장, 시적인 비유를 쓰지 않습니다. 부정하고 뒤집는 문장('~가 아니라')도 쓰지 않고 뜻만 바로 씁니다. 'A하기보다 B한다'처럼 둘을 견주는 문장도 쓰지 않고 맞는 쪽만 씁니다. 문장을 '대신', '반면', '한편'으로 시작하지 않습니다.
- 외래어(타이밍, 스트레스, 컨디션, 에너지, 패턴, 타입, 스타일, 리더십, 카리스마, 스케일)와 가운뎃점(·), 긴 줄표(—)를 쓰지 않습니다. '당신', '여러분'이라고 부르지 않습니다.

## 출력
JSON 하나만 출력합니다.
{"summary":"...","personality":"...","love":"...","work":"...","care":"...","sinsal":"...","faq":[{"q":"...","a":"..."},{"q":"...","a":"..."}]}`;

const BANNED = [/·/, /—/, /(?:이|가) 아니라/, /라기보다/, /에너지|패턴|타입|타이밍|스트레스|컨디션|스타일|리더십|카리스마|멘탈|스케일|시너지|밸런스/, /라기보다/, /당신|여러분/, /이혼|단명|박복|망한다|반드시/];
function check(f, d) {
  const errs = [];
  const len = (s, a, b, k) => { const n = String(s || '').length; if (n < a || n > b) errs.push(`${k} ${n}자`); };
  len(d.summary, 60, 200, 'summary'); len(d.personality, 150, 400, 'personality'); len(d.love, 110, 320, 'love'); len(d.work, 110, 320, 'work'); len(d.care, 60, 220, 'care');
  if (f.sinsal.length && String(d.sinsal || '').length < 40) errs.push('sinsal 빠짐');
  if (!Array.isArray(d.faq) || d.faq.length !== 2 || d.faq.some((x) => !x.q || !x.a)) errs.push('faq');
  const all = JSON.stringify(d);
  for (const re of BANNED) if (re.test(all)) errs.push(`금지 ${re}`);
  return errs;
}

/** 한자만 든 괄호와 맨 한자를 걷는다 (summary 첫 일주 이름 한 번은 남긴다) */
function stripHanja(d) {
  const H = /[一-鿿]/;
  const clean = (t) => String(t || '').replace(/\(\s*[一-鿿]{1,4}\s*\)/g, '').replace(/[一-鿿]+/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  let first = true;
  for (const k of ['summary', 'personality', 'love', 'work', 'care', 'sinsal']) {
    if (k === 'summary' && first) {
      const m = String(d.summary || '').match(/^([가-힣]{2})\(([一-鿿]{2})\)/);
      d.summary = m ? m[0] + clean(String(d.summary).slice(m[0].length)) : clean(d.summary);
      first = false;
    } else d[k] = clean(d[k]);
  }
  d.faq = (d.faq || []).map((x) => ({ q: clean(x.q), a: clean(x.a) }));
  void H;
}

/** 'A하기보다 B' 문장만 골라 같은 뜻으로 고쳐 쓴다 (오너: 'A 대신 B' 꼴 금지) */
async function fixGiboda(anthropic, d) {
  const { CLAUDE_MODEL, parseJsonResponse } = lazy();
  const fields = ['summary', 'personality', 'love', 'work', 'care', 'sinsal'];
  const bad = [];
  for (const k of fields) for (const sn of String(d[k] || '').split(/(?<=[.?!])\s+/)) if (/기보다/.test(sn)) bad.push(sn);
  for (const x of d.faq || []) for (const sn of String(x.a).split(/(?<=[.?!])\s+/)) if (/기보다/.test(sn)) bad.push(sn);
  if (!bad.length) return d;
  const msg = await anthropic.messages.create({ model: CLAUDE_MODEL.sonnet, max_tokens: 1500,
    system: "주어진 한국어 문장을 같은 뜻으로 고쳐 쓴다. '~기보다', '~라기보다', '대신', '~가 아니라'처럼 둘을 견주는 말을 쓰지 않고 맞는 쪽만 말한다. 말투(~입니다, ~하세요)는 그대로. JSON 배열 하나만 출력: [{\"from\":\"원문\",\"to\":\"고친 문장\"}]",
    messages: [{ role: 'user', content: JSON.stringify(bad) }] });
  // parseJsonResponse 는 배열의 첫 항목만 돌려주므로 배열은 직접 읽는다
  const raw = (msg.content || []).map((b) => b.text || '').join('');
  let pairs = [];
  try { pairs = JSON.parse((raw.match(/\[[\s\S]*\]/) || ['[]'])[0]); } catch { try { const o = parseJsonResponse(raw); pairs = Array.isArray(o) ? o : [o]; } catch { return d; } }
  if (!Array.isArray(pairs)) return d;
  const norm = (x) => String(x || '').replace(/\s+/g, ' ').trim();
  const swap = (t) => { let o = norm(t); for (const pr of pairs) if (pr && pr.from && pr.to && !/기보다/.test(pr.to)) o = o.split(norm(pr.from)).join(norm(pr.to)); return o; };
  for (const k of fields) d[k] = swap(d[k]);
  d.faq = (d.faq || []).map((x) => ({ q: x.q, a: swap(x.a) }));
  return d;
}

async function one(anthropic, f) {
  const { CLAUDE_MODEL, TONE_FINAL_CHECK, parseJsonResponse, sanitizeAiOutput } = lazy();
  const user = `## 확정표\n${factsText(f)}\n${TONE_FINAL_CHECK}`;
  let last = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const msg = await anthropic.messages.create({ model: CLAUDE_MODEL.sonnet, max_tokens: 4000, system: SYSTEM, messages: [{ role: 'user', content: user }] });
    let d;
    try { d = sanitizeAiOutput(parseJsonResponse((msg.content || []).map((b) => b.text || '').join(''))); } catch (e) { last = ['parse ' + e.message]; continue; }
    if (!f.sinsal.length) d.sinsal = '';
    stripHanja(d);
    last = check(f, d);
    if (!last.length) return await fixGiboda(anthropic, d);
    console.warn(`  ${f.ko} 다시(${attempt + 1}): ${last.join(', ')}`);
  }
  throw new Error(`${f.ko}: ${last.join(', ')}`);
}

(async () => {
  const out = execSync('npx firebase functions:secrets:access ANTHROPIC_API_KEY --project appintoss-saju', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const key = (out.split(/\r?\n/).find((l) => l.startsWith('sk-ant')) || '').trim();
  if (!key) { console.log('키 없음'); process.exit(1); }
  const anthropic = lazy().createClaude(key);
  if (process.argv[2] === '--fix') { // 남은 '~기보다' 문장만 다시 고친다
    const doc0 = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    for (const [gz, d] of Object.entries(doc0.items)) {
      stripHanja(d);
      for (let t = 0; t < 2 && /기보다/.test(JSON.stringify(d)); t++) Object.assign(d, await fixGiboda(anthropic, d));
      if (/기보다/.test(JSON.stringify(d))) console.log('  남음', gz);
    }
    fs.writeFileSync(OUT, JSON.stringify(doc0, null, 1));
    console.log('고침 끝'); return;
  }
  const only = process.argv.slice(2);
  const doc = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { items: {} };
  const todo = GAPJA.map(iljuFacts).filter((f) => (only.length ? only.includes(f.ko) : !doc.items[f.gz]));
  console.log(`만들 일주 ${todo.length}개`);
  const t0 = Date.now(); let i = 0; const fails = [];
  const worker = async () => {
    while (i < todo.length) {
      const f = todo[i++];
      try { doc.items[f.gz] = { ...(await one(anthropic, f)), generatedAt: new Date().toISOString() }; fs.writeFileSync(OUT, JSON.stringify(doc, null, 1)); console.log('  ' + f.ko); }
      catch (e) { fails.push(f.ko); console.error('  실패', e.message); }
    }
  };
  await Promise.all([1, 2, 3, 4, 5].map(worker));
  console.log(`끝 ${Math.round((Date.now() - t0) / 1000)}s, 실패 ${fails.length ? fails.join(' ') : '없음'}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
