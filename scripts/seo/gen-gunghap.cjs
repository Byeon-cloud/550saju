/* 띠 궁합 검색 페이지 글 만들기 (2026-10-17, 시험 W4) — 사용: node scripts/seo/gen-gunghap.cjs [a-b ...]
 *   12띠 짝 78쌍(같은 띠 12 + 다른 띠 66). 두 띠의 관계(육합, 삼합, 충, 형, 해, 원진)와 오행은 계산으로 정하고 AI 는 문장만 쓴다.
 *   결과는 src/data/seo/gunghap.json (있는 쌍은 건너뛴다). 먼저 functions 빌드. 키는 시크릿에서 읽기만 하고 찍지 않는다.
 *   원가: 쌍 하나에 Sonnet 한 번(약 25~35원), 78쌍 약 2~3천 원. */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'src/data/seo/gunghap.json');
// AI 연결은 생성할 때만 불러온다 (build-seo-pages.mjs 가 이 파일의 pairs() 만 쓴다)
const lazy = () => ({ ...require(path.join(ROOT, 'functions/lib/shared/claudeClient.js')), ...require(path.join(ROOT, 'functions/lib/ai/promptsV3.js')), ...require(path.join(ROOT, 'functions/lib/ai/sajuFacts.js')) });
const { branchRelations, TTI_NAME } = require(path.join(ROOT, 'functions/lib/tti/ttiFortune.js'));

const ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SLUG = { 子: 'rat', 丑: 'ox', 寅: 'tiger', 卯: 'rabbit', 辰: 'dragon', 巳: 'snake', 午: 'horse', 未: 'goat', 申: 'monkey', 酉: 'rooster', 戌: 'dog', 亥: 'pig' };
const OH = { 子: '수', 丑: '토', 寅: '목', 卯: '목', 辰: '토', 巳: '화', 午: '화', 未: '토', 申: '금', 酉: '금', 戌: '토', 亥: '수' };
const SAENG = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' }; // 앞이 뒤를 낳는다
const GEUK = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' }; // 앞이 뒤를 누른다
const REL_PLAIN = {
  육합: '짝을 이루는 사이(서로 끌리고 약속이 잘 맞음)',
  삼합: '한편이 되는 사이(같은 방향을 보고 함께 일을 이룸)',
  충: '정면으로 부딪히는 사이(끌림도 크고 다툼도 큼, 생활 방식이 반대)',
  형: '서로 깎이는 사이(작은 마찰이 쌓이고 말이 날카로워짐)',
  해: '은근히 어긋나는 사이(섭섭함과 오해가 생김)',
  원진: '괜히 서운한 사이(이유 없이 밉다가도 정이 듦)',
};

/** 두 띠의 관계 — 방향이 있는 형(刑)도 양쪽을 다 본다 */
function pairRelations(a, b) {
  if (a === b) return [];
  const set = new Set([...branchRelations(a, b), ...branchRelations(b, a)].filter((r) => REL_PLAIN[r]));
  return ['육합', '삼합', '충', '형', '해', '원진'].filter((r) => set.has(r));
}
function pairLabel(a, b, rels) {
  if (a === b) return '같은 띠 궁합';
  const good = rels.includes('육합') || rels.includes('삼합');
  const bad = rels.some((r) => ['충', '원진', '형', '해'].includes(r));
  if (good && bad) return '끌리면서 맞춰 가는 궁합';
  if (rels.includes('육합')) return '짝이 잘 맞는 궁합';
  if (rels.includes('삼합')) return '한편이 되는 궁합';
  if (rels.includes('충')) return '정면으로 부딪히는 궁합';
  if (rels.includes('원진')) return '괜히 서운한 궁합';
  if (bad) return '조금씩 맞춰 가는 궁합';
  return '무난한 궁합';
}
function ohengLine(a, b) {
  const x = OH[a]; const y = OH[b]; const na = TTI_NAME[a]; const nb = TTI_NAME[b];
  if (x === y) return `두 띠 모두 ${x}의 기운이라 생각하는 방식이 비슷함`;
  if (SAENG[x] === y) return `${na}(${x})가 ${nb}(${y})를 낳아 주는 관계라 ${na}가 챙겨 주는 편`;
  if (SAENG[y] === x) return `${nb}(${y})가 ${na}(${x})를 낳아 주는 관계라 ${nb}가 챙겨 주는 편`;
  if (GEUK[x] === y) return `${na}(${x})가 ${nb}(${y})를 누르는 관계라 ${na}가 이끌고 ${nb}가 따르는 편`;
  return `${nb}(${y})가 ${na}(${x})를 누르는 관계라 ${nb}가 이끌고 ${na}가 따르는 편`;
}
function pairs() {
  const out = [];
  for (let i = 0; i < 12; i++) for (let j = i; j < 12; j++) {
    const a = ORDER[i]; const b = ORDER[j];
    const rels = pairRelations(a, b);
    out.push({ key: `${SLUG[a]}-${SLUG[b]}`, a, b, rels, label: pairLabel(a, b, rels), oheng: ohengLine(a, b), selfHyung: a === b && branchRelations(a, a).some((r) => r.includes('자형')) });
  }
  return out;
}

const SYSTEM = `당신은 사주500 의 명리 풀이가입니다. 검색으로 들어온 사람이 읽는 띠 궁합 글을 씁니다. 읽는 사람은 연애 상대, 배우자, 가족, 친구와의 궁합이 궁금한 20대부터 60대까지입니다.

## 근거
- 근거는 주어진 확정 정보뿐입니다: 두 띠의 관계(짝을 이루는 사이, 한편이 되는 사이, 정면으로 부딪히는 사이, 서로 깎이는 사이, 은근히 어긋나는 사이, 괜히 서운한 사이, 특별한 관계 없음, 같은 띠)와 오행 관계. 표에 없는 관계와 띠의 성격을 지어내지 않습니다.
- 판정은 주어진 궁합 이름을 그대로 따릅니다. 좋은 궁합을 깎아내리거나 부딪히는 궁합을 좋게 바꾸지 않습니다.
- '헤어진다', '결혼하면 안 된다', '최악', '천생연분' 같은 단정과 확률, 점수는 쓰지 않습니다. 부딪히는 궁합도 어떻게 하면 잘 지내는지로 맺습니다.
- 띠 궁합은 태어난 해 하나만 본 것이라 큰 흐름입니다. 이 점을 겸손하게 한 번 밝힙니다(head 끝이나 tip).

## 쓰는 법
- head: 세 문장, 120~180자. 첫 문장은 '{띠A}와 {띠B}는 ~한 궁합입니다.' 꼴로 판정을 밝히고, 두 띠의 관계를 쉬운 말로 풀고, 오행 관계로 누가 챙기고 이끄는 편인지 씁니다.
- love: 세 문장, 120~190자. 연인과 부부로 만났을 때 잘 맞는 점과 부딪히는 점, 결혼 생활에서 챙길 일.
- friend: 두 문장, 80~140자. 친구, 동료, 가족으로 만났을 때.
- tip: 두 문장, 70~130자. 두 사람이 잘 지내는 법 하나를 구체적인 행동으로(권유는 '~하세요').
- faq: 한 개. q 는 사람들이 실제로 검색하는 질문 꼴('쥐띠와 소띠는 결혼해도 괜찮나요?' 같은). a 는 두 문장.
- 명리 용어(지지, 육합, 삼합, 충, 형, 해, 원진, 상생, 상극)는 쓰지 않습니다. 오행은 '물(수)의 기운'처럼 쉬운 말로 씁니다. 한자는 쓰지 않습니다.
- 평범한 한국어 문장으로 씁니다. 'A 대신 B', '~라기보다', 말 순서를 뒤집은 문장, 명사로 끊는 문장, 시적인 비유를 쓰지 않습니다. 문장을 '대신', '반면', '한편'으로 시작하지 않습니다. 부정하고 뒤집는 문장('~가 아니라')도 쓰지 않고 뜻만 바로 씁니다.
- 외래어(타이밍, 스트레스, 컨디션, 에너지, 패턴, 타입, 케미)를 쓰지 않습니다. 가운뎃점(·)과 긴 줄표(—)를 쓰지 않습니다. '당신', '여러분'이라고 부르지 않습니다.
- 같은 쌍 안에서 같은 말을 되풀이하지 않습니다.

## 출력
JSON 하나만 출력합니다. 다른 말은 쓰지 않습니다.
{"head":"...","love":"...","friend":"...","tip":"...","faq":{"q":"...","a":"..."}}`;

const BANNED = [/·/, /—/, /(?:이|가) 아니라/, /라기보다/, /에너지|패턴|타입|타이밍|스트레스|컨디션|케미|멘탈/, /당신|여러분/, /천생연분|최악|헤어진다|안 된다/, /육합|삼합|원진|상극|상생/, /[一-龥]/];
function check(d) {
  const errs = [];
  const len = (s, a, b, k) => { const n = String(s || '').length; if (n < a || n > b) errs.push(`${k} ${n}자`); };
  len(d.head, 90, 240, 'head'); len(d.love, 90, 250, 'love'); len(d.friend, 55, 190, 'friend'); len(d.tip, 45, 180, 'tip');
  if (!d.faq || !d.faq.q || !d.faq.a) errs.push('faq');
  const all = JSON.stringify(d);
  for (const re of BANNED) if (re.test(all)) errs.push(`금지 ${re}`);
  return errs;
}

async function one(anthropic, p) {
  const { CLAUDE_MODEL, TONE_FINAL_CHECK, parseJsonResponse, sanitizeAiOutput } = lazy();
  const na = TTI_NAME[p.a]; const nb = TTI_NAME[p.b];
  const relText = p.a === p.b
    ? `같은 띠끼리${p.selfHyung ? ' (같은 기운이 겹쳐 고집이 부딪히고 스스로 꼬이기도 하는 띠)' : ' (같은 기운이 겹쳐 서로를 잘 알지만 같은 약점도 겹침)'}`
    : (p.rels.length ? p.rels.map((r) => REL_PLAIN[r]).join(', ') : '특별한 관계 없음(크게 끌리지도 부딪히지도 않아 노력한 만큼 가까워짐)');
  const user = `## 확정 정보
- 두 띠: ${na}와 ${nb}
- 궁합 이름(판정): ${p.label}
- 두 띠의 관계: ${relText}
- 오행: ${p.oheng}
${TONE_FINAL_CHECK}`;
  let last = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const msg = await anthropic.messages.create({ model: CLAUDE_MODEL.sonnet, max_tokens: 2500, system: SYSTEM, messages: [{ role: 'user', content: user }] });
    const raw = (msg.content || []).map((b) => b.text || '').join('');
    let d;
    try { d = sanitizeAiOutput(parseJsonResponse(raw)); } catch (e) { last = ['parse ' + e.message]; continue; }
    last = check(d);
    if (!last.length) return d;
    console.warn(`  ${p.key} 다시(${attempt + 1}): ${last.join(', ')}`);
  }
  throw new Error(`${p.key}: ${last.join(', ')}`);
}

module.exports = { pairs, SLUG, ORDER, REL_PLAIN };

if (require.main === module) (async () => {
  const out = execSync('npx firebase functions:secrets:access ANTHROPIC_API_KEY --project appintoss-saju', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const key = (out.split(/\r?\n/).find((l) => l.startsWith('sk-ant')) || '').trim();
  if (!key) { console.log('키 없음'); process.exit(1); }
  const anthropic = lazy().createClaude(key);
  const only = process.argv.slice(2);
  const doc = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { items: {} };
  const todo = pairs().filter((p) => (only.length ? only.includes(p.key) : !doc.items[p.key]));
  console.log(`만들 쌍 ${todo.length}개`);
  const t0 = Date.now();
  let i = 0; const fails = [];
  const worker = async () => {
    while (i < todo.length) {
      const p = todo[i++];
      try {
        const d = await one(anthropic, p);
        doc.items[p.key] = { label: p.label, rels: p.rels, oheng: p.oheng, ...d, generatedAt: new Date().toISOString() };
        fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
        console.log(`  ${p.key} ${p.label}`);
      } catch (e) { fails.push(p.key); console.error('  실패', e.message); }
    }
  };
  await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
  console.log(`끝 ${Math.round((Date.now() - t0) / 1000)}s, 실패 ${fails.length ? fails.join(' ') : '없음'}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
