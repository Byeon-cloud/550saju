/* 꿈해몽 검색 페이지 글 만들기 (2026-10-17, 시험 E10) — 사용: node scripts/seo/gen-kkum.cjs [slug ...]
 *   목록은 scripts/seo/kkum-symbols.cjs, 결과는 src/data/seo/kkum.json (이미 있는 꿈은 건너뛴다. 다시 쓰려면 slug 를 넘긴다).
 *   먼저 functions 를 빌드(npm --prefix functions run build). 키는 시크릿에서 읽기만 하고 찍지 않는다.
 *   원가: 꿈 하나에 Sonnet 한 번(약 50~70원), 57개 약 3~4천 원. */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'src/data/seo/kkum.json');
const SYMBOLS = require('./kkum-symbols.cjs');
const { createClaude, CLAUDE_MODEL } = require(path.join(ROOT, 'functions/lib/shared/claudeClient.js'));
const { parseJsonResponse, TONE_FINAL_CHECK } = require(path.join(ROOT, 'functions/lib/ai/promptsV3.js'));
const { sanitizeAiOutput } = require(path.join(ROOT, 'functions/lib/ai/sajuFacts.js'));

const GRADES = ['대길몽', '길몽', '중립', '주의', '흉몽'];

const SYSTEM = `당신은 사주500 의 꿈 풀이가입니다. 검색으로 들어온 사람이 읽는 꿈해몽 글을 씁니다. 읽는 사람은 20대부터 70대까지이고, 꿈이 좋은 꿈인지 나쁜 꿈인지 빨리 알고 싶어서 왔습니다.

## 근거
- 한국에서 오래 전해 온 해몽(꿈풀이)에서 그 상징을 어떻게 읽어 왔는지를 바탕으로 씁니다. 지역과 책마다 다르게 읽는 상징은 흔한 풀이를 먼저 쓰고 '다르게 읽기도 합니다'라고 밝힙니다.
- 오행 정보가 주어진 상징만 오행으로 설명합니다. 주어지지 않은 상징에 오행을 붙이지 않습니다.
- 확률, 숫자 보장, '반드시 ~된다' 같은 단정은 쓰지 않습니다. 로또 번호, 날짜를 찍어 주지 않습니다.
- 태몽은 '태몽으로 보기도 합니다' 정도로만 쓰고, 아들 딸을 점치지 않습니다.
- 몸이 아픈 꿈, 피 꿈, 죽는 꿈은 겁주지 않습니다. 병을 말하지 않고, 마음이 쓰이면 몸 상태를 한 번 살펴보라는 정도의 할 일로 씁니다.
- 흉몽도 얼버무리지 않고 판정을 밝히되, 무엇을 조심하면 되는지로 맺습니다.

## 쓰는 법
- 판정은 다섯 가지 중 하나입니다: 대길몽, 길몽, 중립, 주의, 흉몽.
- summary: 두세 문장, 100~160자. 첫 문장에 판정을 밝힙니다('{꿈}은 대체로 길몽입니다.' 꼴). 어느 일(돈, 사랑, 일, 사람, 집안)과 이어지는지 씁니다.
- meaning: 세네 문장, 160~260자. 그 상징을 왜 그렇게 읽어 왔는지 씁니다.
- cases: 주어진 상황 하나마다 하나씩, 주어진 순서 그대로. title 은 주어진 문구 그대로 씁니다. text 는 두세 문장 90~150자로 그 상황의 판정과 뜻, 할 일 하나. grade 는 다섯 판정 중 하나. 상황마다 다른 내용을 씁니다.
- saju: 두세 문장, 110~180자. 같은 꿈도 꾼 사람의 사주에 따라 달리 읽히는 까닭을 씁니다. 오행 정보가 있으면 '그 기운이 모자란 사주에는 반가운 꿈, 이미 많은 사주에는 넘치는 일을 조심하라는 꿈'처럼 오행으로 설명하고, 오행 정보가 없으면 요즘 마음 쓰는 일과 사주의 흐름에 따라 읽는 법을 씁니다. 명리 용어는 오행(목, 화, 토, 금, 수)과 띠 이름만 씁니다.
- todo: 한두 문장. 이 꿈을 꾼 날 해 보면 좋은 일 하나(권유는 '~하세요', '~해 보세요').
- faq: 두 개. q 는 사람들이 실제로 검색하는 질문 꼴('뱀 꿈은 태몽인가요?', '이 꿈을 꾸면 복권을 사야 하나요?'). a 는 두 문장.
- 평범한 한국어 문장으로 씁니다. 'A 대신 B', 말 순서를 뒤집은 문장, 명사로 끊는 문장, 시적인 비유를 쓰지 않습니다. 문장을 '대신', '반면', '한편'으로 시작하지 않습니다. '~라기보다 ~' 꼴도 쓰지 않습니다. 부정하고 뒤집는 문장('~가 아니라', '~이 아니라')도 쓰지 않고 뜻만 바로 씁니다. 예: '죽는 꿈은 새로 태어나는 꿈으로 읽어 왔습니다.'
- 외래어(타이밍, 스트레스, 컨디션, 에너지, 패턴, 타입)를 쓰지 않습니다. 가운뎃점(·)과 긴 줄표(—)를 쓰지 않습니다. 한자는 오행 정보에 있는 글자만 괄호로 한 번 씁니다.
- '당신', '여러분'이라고 부르지 않습니다. 주어가 필요하면 '이 꿈은', '꿈을 꾼 사람은'으로 씁니다.

## 출력
JSON 하나만 출력합니다. 다른 말은 쓰지 않습니다.
{"grade":"길몽","summary":"...","meaning":"...","cases":[{"title":"...","grade":"길몽","text":"..."}],"saju":"...","todo":"...","faq":[{"q":"...","a":"..."},{"q":"...","a":"..."}]}`;

const BANNED = [/·/, /—/, /(?:이|가) 아니라/, /에너지|패턴|타입|타이밍|스트레스|컨디션|멘탈/, /당신|여러분/, /반드시/, /라기보다/];

function check(sym, d) {
  const errs = [];
  if (!d || typeof d !== 'object') return ['형식'];
  if (!GRADES.includes(d.grade)) errs.push('grade');
  const len = (s, a, b, k) => { const n = String(s || '').length; if (n < a || n > b) errs.push(`${k} ${n}자`); };
  len(d.summary, 70, 220, 'summary');
  len(d.meaning, 110, 340, 'meaning');
  len(d.saju, 80, 240, 'saju');
  len(d.todo, 15, 140, 'todo');
  if (!Array.isArray(d.cases) || d.cases.length !== sym.cases.length) errs.push('cases 개수');
  else d.cases.forEach((c, i) => {
    if (c.title !== sym.cases[i]) errs.push(`case ${i} 제목`);
    if (!GRADES.includes(c.grade)) errs.push(`case ${i} grade`);
    len(c.text, 50, 210, `case ${i}`);
  });
  if (!Array.isArray(d.faq) || d.faq.length !== 2 || d.faq.some((f) => !f.q || !f.a)) errs.push('faq');
  const all = JSON.stringify(d);
  for (const re of BANNED) if (re.test(all)) errs.push(`금지 ${re}`);
  return errs;
}

async function one(anthropic, sym) {
  const user = `## 꿈
${sym.name}
## 오행 정보
${sym.oheng || '(없음. 오행으로 설명하지 않는다)'}
## 상황 (이 순서와 문구 그대로 cases 에)
${sym.cases.map((c, i) => `${i + 1}. ${c}`).join('\n')}
${TONE_FINAL_CHECK}`;
  let last = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const msg = await anthropic.messages.create({ model: CLAUDE_MODEL.sonnet, max_tokens: 5000, system: SYSTEM, messages: [{ role: 'user', content: user }] });
    const raw = (msg.content || []).map((b) => b.text || '').join('');
    let d;
    try { d = sanitizeAiOutput(parseJsonResponse(raw)); } catch (e) { last = ['parse ' + e.message]; continue; }
    if (Array.isArray(d.cases)) d.cases.forEach((c, i) => { if (sym.cases[i] && String(c.title).replace(/\s/g, '') === sym.cases[i].replace(/\s/g, '')) c.title = sym.cases[i]; });
    last = check(sym, d);
    if (!last.length) return d;
    console.warn(`  ${sym.slug} 다시(${attempt + 1}): ${last.join(', ')}`);
  }
  throw new Error(`${sym.slug}: ${last.join(', ')}`);
}

(async () => {
  const out = execSync('npx firebase functions:secrets:access ANTHROPIC_API_KEY --project appintoss-saju', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const key = (out.split(/\r?\n/).find((l) => l.startsWith('sk-ant')) || '').trim();
  if (!key) { console.log('키 없음'); process.exit(1); }
  const anthropic = createClaude(key);
  const only = process.argv.slice(2);
  const doc = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { items: {} };
  const todo = SYMBOLS.filter((s) => (only.length ? only.includes(s.slug) : !doc.items[s.slug]));
  console.log(`만들 꿈 ${todo.length}개`);
  const t0 = Date.now();
  let i = 0; const fails = [];
  const worker = async () => {
    while (i < todo.length) {
      const sym = todo[i++];
      try {
        const d = await one(anthropic, sym);
        doc.items[sym.slug] = { ...d, generatedAt: new Date().toISOString() };
        fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
        console.log(`  ${sym.slug} ${d.grade}`);
      } catch (e) { fails.push(sym.slug); console.error('  실패', e.message); }
    }
  };
  await Promise.all([1, 2, 3, 4, 5].map(worker));
  console.log(`끝 ${Math.round((Date.now() - t0) / 1000)}s, 실패 ${fails.length ? fails.join(' ') : '없음'}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
