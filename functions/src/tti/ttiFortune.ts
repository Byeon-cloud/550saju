/**
 * 띠별 오늘의 운세 (2026-10-15 · 1.5.6)
 *
 *   왜: 혜택탭 캠페인으로 들어온 50~60대 8,300명 중 풀이를 받은 사람은 1~2%였다. 첫 화면이 '생년월일, 시간,
 *   이름, 성별을 넣어야' 운세가 나오는 구조라 10초 보고 나간다. 신문 띠별 운세처럼 띠만 누르면 바로 읽히게 한다.
 *
 *   구조
 *     - 서버가 하루 한 번 12띠 x 출생 연도 6개(1941~2012, 72줄, 10-16 오너: 29~40년생 줄은 빼고 띠마다 여섯)를 만들어 ttiFortune/{YYYY-MM-DD} 에 둔다.
 *       화면은 읽기만 한다(공개 읽기, 쓰기는 서버만). 사용자 수와 무관하게 하루 원가 약 100원.
 *     - 근거는 서버가 확정한다: 오늘 일진(lunar), 출생 연도 간지, 지지 관계(충, 육합, 삼합, 형, 해, 원진, 같은 띠),
 *       천간 십성, 띠별 좋은 시간과 조심할 시간(시진 경계 -30분 SSOT). AI 는 이 표로 문장만 쓴다.
 *     - 예약 실행 30분마다: 오늘 문서가 없으면 만든다(실패하면 30분 뒤 다시). 밤 10시 이후에는 내일 문서도 미리 만든다.
 */
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { Solar } from 'lunar-javascript';
import { createClaude, CLAUDE_MODEL } from '../shared/claudeClient';
import { logAnthropicUsage } from '../shared/aiUsageLog';
import { parseJsonResponse, TONE_FINAL_CHECK } from '../ai/promptsV3';
import { tenGod, sanitizeAiOutput } from '../ai/sajuFacts';

const ANTHROPIC_KEY = defineSecret('ANTHROPIC_API_KEY');
const MODEL = CLAUDE_MODEL.sonnet;

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
export const TTI_NAME: Record<string, string> = {
  子: '쥐띠', 丑: '소띠', 寅: '호랑이띠', 卯: '토끼띠', 辰: '용띠', 巳: '뱀띠',
  午: '말띠', 未: '양띠', 申: '원숭이띠', 酉: '닭띠', 戌: '개띠', 亥: '돼지띠',
};

/* 지지 관계 표 */
const CHUNG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const HAP6: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const HAE: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
const WONJIN: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '酉', 酉: '寅', 卯: '申', 申: '卯', 辰: '亥', 亥: '辰', 巳: '戌', 戌: '巳' };
const HYUNG = new Set(['寅巳', '巳寅', '巳申', '申巳', '寅申', '申寅', '丑戌', '戌丑', '戌未', '未戌', '丑未', '未丑', '子卯', '卯子']);
const JA_HYUNG = new Set(['辰', '午', '酉', '亥']);
const SAMHAP: string[][] = [['申', '子', '辰'], ['亥', '卯', '未'], ['寅', '午', '戌'], ['巳', '酉', '丑']];

/** 시진 경계 -30분 SSOT (2026-07-14 확정: 경계 :30) — 화면에 그대로 나가는 말 */
const HOUR_LABEL: Record<string, string> = {
  子: '밤 11시 반부터 새벽 1시 반', 丑: '새벽 1시 반부터 3시 반', 寅: '새벽 3시 반부터 5시 반', 卯: '아침 5시 반부터 7시 반',
  辰: '아침 7시 반부터 9시 반', 巳: '오전 9시 반부터 11시 반', 午: '낮 11시 반부터 1시 반', 未: '오후 1시 반부터 3시 반',
  申: '오후 3시 반부터 5시 반', 酉: '저녁 5시 반부터 7시 반', 戌: '저녁 7시 반부터 9시 반', 亥: '밤 9시 반부터 11시 반',
};
/** 깨어 있는 시간대 (좋은 시간, 조심할 시간은 이 안에서만 고른다) */
const AWAKE = ['辰', '巳', '午', '未', '申', '酉', '戌', '卯'];

/** 오늘 지지와 띠 지지의 관계 (여럿 겹칠 수 있다) */
export function branchRelations(today: string, tti: string): string[] {
  const out: string[] = [];
  if (today === tti) out.push(JA_HYUNG.has(tti) ? '같은 띠 날(자형)' : '같은 띠 날');
  if (CHUNG[tti] === today) out.push('충');
  if (HAP6[tti] === today) out.push('육합');
  if (today !== tti && SAMHAP.some((g) => g.includes(today) && g.includes(tti))) out.push('삼합');
  if (HYUNG.has(tti + today)) out.push('형');
  if (HAE[tti] === today) out.push('해');
  if (WONJIN[tti] === today) out.push('원진');
  return out;
}

/** 띠별 좋은 시간(육합, 삼합 시진 중 깨어 있는 때)과 조심할 시간(충 시진, 깨어 있을 때만) */
export function ttiHours(tti: string): { good: string; bad: string | null } {
  const cands = [HAP6[tti], ...(SAMHAP.find((g) => g.includes(tti)) || []).filter((z) => z !== tti)];
  const good = AWAKE.find((z) => cands.includes(z)) || cands[0];
  const c = CHUNG[tti];
  return { good: HOUR_LABEL[good], bad: AWAKE.includes(c) ? HOUR_LABEL[c] : null };
}

const yearGz = (y: number): string => GAN[(((y - 4) % 10) + 10) % 10] + ZHI[(((y - 4) % 12) + 12) % 12];
/** 띠마다 출생 연도 6개 — 1941~2012 (72년). 10-15 에 1929 까지 넓혔다가 10-16 오너 지시로 다시 여섯 */
export function ttiYears(tti: string): number[] {
  const out: number[] = [];
  for (let y = 1941; y <= 2012; y++) if (yearGz(y)[1] === tti) out.push(y);
  return out;
}

const SIP_HINT: Record<string, string> = {
  비견: '같은 기운(동료, 형제, 경쟁, 내 몫 지키기)', 겁재: '같은 기운(경쟁, 나가는 돈, 사람 사이 줄다리기)',
  식신: '내가 내는 기운(먹을 복, 재주, 여유)', 상관: '내가 내는 기운(말, 표현, 말실수)',
  편재: '내가 다스리는 기운(뜻밖의 돈, 일거리, 바깥 활동)', 정재: '내가 다스리는 기운(정해진 돈, 살림, 꼼꼼한 일)',
  '편관(칠살)': '나를 누르는 기운(압박, 급한 일, 몸 피로)', 정관: '나를 바르게 하는 기운(책임, 직장, 체면, 관공서)',
  편인: '나를 돕는 기운(생각, 눈치, 혼자 하는 공부)', 정인: '나를 돕는 기운(문서, 어른의 도움, 마음의 안정)',
};
const REL_HINT: Record<string, string> = {
  충: '정면으로 부딪힘(변동, 이동, 다툼, 계약과 먼 길은 신중)',
  육합: '짝을 이룸(도움, 약속, 사람과 잘 맞음)',
  삼합: '같은 무리로 묶임(협력, 일이 맞물려 풀림)',
  형: '서로 깎임(마찰, 서류 실수, 몸 다침 조심)',
  해: '은근히 어긋남(섭섭함, 오해)',
  원진: '괜히 밉고 서운함(감정 소모, 말다툼)',
  '같은 띠 날': '같은 기운이 겹침(고집, 했던 일 되풀이)',
  '같은 띠 날(자형)': '같은 기운이 겹쳐 스스로 꼬임(혼자 끙끙, 자책)',
};

function dayPillar(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getEightChar().getDay();
}

const ko = (gz: string): string => (GAN_KO[gz[0]] || '') + (ZHI_KO[gz[1]] || '');

/** AI 에 주는 확정표 */
export function ttiFactsTable(dateKey: string): { dayGz: string; text: string } {
  const dayGz = dayPillar(dateKey);
  const tStem = dayGz[0];
  const tBr = dayGz[1];
  const thisYear = Number(dateKey.slice(0, 4));
  const lines: string[] = [];
  for (const z of ZHI) {
    const rels = branchRelations(tBr, z);
    const h = ttiHours(z);
    lines.push(`\n[${z} ${TTI_NAME[z]}] 오늘 지지 ${tBr}(${ZHI_KO[tBr]})와의 관계: ${rels.length ? rels.map((r) => `${r} = ${REL_HINT[r]}`).join(', ') : '특별한 합충 없음(무난한 날)'}`);
    lines.push(`  좋은 시간: ${h.good}${h.bad ? ` / 조심할 시간: ${h.bad}` : ''}`);
    for (const y of ttiYears(z)) {
      const gz = yearGz(y);
      const sip = tenGod(gz[0], tStem);
      const ganLink = [
        ({ 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' } as Record<string, string>)[gz[0]] === tStem ? '천간합' : '',
        ({ 甲: '庚', 庚: '甲', 乙: '辛', 辛: '乙', 丙: '壬', 壬: '丙', 丁: '癸', 癸: '丁' } as Record<string, string>)[gz[0]] === tStem ? '천간충' : '',
      ].filter(Boolean).join(', ');
      lines.push(`  ${y}년생 ${gz}(${ko(gz)}), 올해 만 ${thisYear - y}세 무렵: 오늘 천간 ${tStem}은 ${sip} = ${SIP_HINT[sip] || ''}${ganLink ? `, ${ganLink}` : ''}`);
    }
  }
  return { dayGz, text: `오늘: ${dateKey}, 일진 ${dayGz}(${ko(dayGz)})일\n${lines.join('\n')}` };
}

const SYSTEM = `당신은 사주500 의 명리 풀이가입니다. 신문에 싣는 띠별 오늘의 운세를 씁니다. 읽는 사람은 대부분 50대와 60대이고 휴대폰으로 읽습니다.

## 근거
- 근거는 아래 확정표뿐입니다. 표의 관계(충, 육합, 삼합, 형, 해, 원진, 같은 띠)와 천간 십성, 시간만 씁니다. 표에 없는 길흉을 지어내지 않습니다.
- 띠 한 줄(head)은 그 띠의 지지 관계와 좋은 시간을 담습니다. 연도 줄은 그 해에 태어난 사람의 천간 십성을 근거로, 그 나이에 실제로 마음 쓰는 일(80대는 몸 돌보기와 끼니, 자식과 손주, 70대는 몸과 자식, 손주와 집안, 60대는 건강과 돈 관리와 자식 일, 50대는 일과 돈과 자녀, 40대는 일과 집안, 30대와 20대는 일과 사람과 연애, 10대는 공부와 친구) 하나에 붙여 씁니다.
- 같은 띠 안의 여섯 줄은 서로 다른 내용이어야 합니다. 다른 띠의 줄과도 같은 문장을 되풀이하지 않습니다.
- 같은 십성이 여러 띠에 나와도 같은 첫마디로 시작하지 않습니다. 그 띠의 오늘 관계(부딪힘, 짝, 같은 무리, 깎임, 어긋남, 서운함, 무난함)와 그 나이의 일을 엮어 줄마다 다르게 씁니다.
- head 는 띠를 주어로 씁니다. 형태: '오늘 {띠}는 {관계를 쉬운 말로} 날입니다. {좋은 시간} 사이에 ~하세요.' 띠와 글자를 함께 주어로 묶지('뱀띠와 술이 서운해지는') 않습니다.
- 다칠 일을 말할 때는 '발밑을 살피세요', '계단은 천천히'처럼 할 일로 씁니다.

## 쓰는 법
- head: 한두 문장, 45자 안팎. 오늘 이 띠에게 어떤 날인지와 좋은 시간을 표의 말 그대로 넣습니다. 예: '오늘 용띠는 술(戌)일과 정면으로 부딪히는 날입니다. 오후 3시 반부터 5시 반 사이에 중요한 일을 끝내세요.'
- 연도 줄: 한두 문장, 35~60자. 판단 하나와 오늘 할 일 하나. 예: '받을 돈 이야기는 오늘 꺼내도 됩니다. 문자보다 얼굴 보고 말하세요.'
- 한자는 head 에서 오늘 지지 한 글자만 괄호로 씁니다. 연도 줄에는 한자와 명리 용어(십성 이름, 충, 합 같은 말)를 쓰지 않습니다. 쉬운 생활 말로 씁니다.
- 겁주는 말(사고, 병, 이별, 망한다)과 확률, 보장 숫자는 쓰지 않습니다. 조심할 일도 무엇을 하면 되는지로 맺습니다.
- 평범한 한국어 문장으로 씁니다. 'A 대신 B', 말 순서를 뒤집은 문장, 명사로 끊는 문장, 시적인 비유를 쓰지 않습니다.
- 위 예는 모양만 보여 주는 것입니다. 예의 문장을 그대로 옮기지 않습니다.
- '대신', '반면'으로 문장을 잇지 않습니다. 두 문장으로 나눠 씁니다.
- 외래어(템포, 타이밍, 스트레스, 컨디션, 멘탈)를 쓰지 않습니다. 말투를 고칠 때는 고친 문장만 남기고 '~한 날이 아니라 ~한 날'처럼 고친 흔적을 쓰지 않습니다.

## 출력
JSON 하나만 출력합니다. 다른 말은 쓰지 않습니다.
{"tti":{"子":{"head":"...","years":{"1948":"...","1960":"..."}}, "丑":{...}, ... 12띠 모두}}
years 에는 표에 있는 연도 여섯 개를 전부 넣습니다.`;

export interface TtiDoc {
  date: string;
  dayGz: string;
  tti: Record<string, { head: string; years: Record<string, string> }>;
}

function complete(doc: any): boolean {
  if (!doc?.tti) return false;
  return ZHI.every((z) => {
    const t = doc.tti[z];
    return t && typeof t.head === 'string' && t.head.length >= 10 && ttiYears(z).every((y) => typeof t.years?.[String(y)] === 'string' && t.years[String(y)].length >= 10);
  });
}

export async function generateTtiFortune(apiKey: string, dateKey: string): Promise<TtiDoc> {
  const anthropic = createClaude(apiKey);
  const { dayGz, text } = ttiFactsTable(dateKey);
  const user = `## 확정표\n${text}\n${TONE_FINAL_CHECK}`;
  let best: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now();
    const msg: any = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 12000, // 84줄 (10-15 72줄에서 늘림)
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    });
    logAnthropicUsage('tti', MODEL, msg, t0, 'schedule');
    const raw = (msg.content || []).map((b: any) => b.text || '').join('');
    try {
      const parsed: any = sanitizeAiOutput(parseJsonResponse(raw));
      if (complete(parsed)) { best = parsed; break; }
      if (!best) best = parsed;
    } catch (e: any) {
      console.warn('[ttiFortune] parse fail', attempt, e?.message);
    }
  }
  if (!best?.tti) throw new Error('tti 생성 실패');
  // 빠진 줄은 비워 둔다 → 화면이 계산 문장으로 채운다
  const tti: TtiDoc['tti'] = {};
  for (const z of ZHI) {
    const t = best.tti[z] || {};
    const years: Record<string, string> = {};
    for (const y of ttiYears(z)) { const s = t.years?.[String(y)]; if (typeof s === 'string' && s.trim()) years[String(y)] = s.trim(); }
    tti[z] = { head: typeof t.head === 'string' ? t.head.trim() : '', years };
  }
  return { date: dateKey, dayGz, tti };
}

function kstDateKey(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600e3 + offsetDays * 86400e3);
  return d.toISOString().slice(0, 10);
}

/** 2026-10-17 오늘 운세가 새로 만들어지면 검색엔진(네이버, 빙)에 IndexNow 로 알린다. 열쇠는 사이트에 공개로 올린 파일(비밀 아님).
 *  scripts/seo/indexnow.cjs 와 같은 열쇠. 실패해도 운세 저장에는 영향 없음 */
const INDEXNOW_KEY = 'ac2c01bdca09a9ffa4ee6ee05f6eaa2c';
export async function pingIndexNow(urlList: string[]): Promise<void> {
  const body = JSON.stringify({ host: 'saju500.app', key: INDEXNOW_KEY, keyLocation: `https://saju500.app/${INDEXNOW_KEY}.txt`, urlList });
  for (const ep of ['https://searchadvisor.naver.com/indexnow', 'https://www.bing.com/indexnow']) {
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body });
      console.log('[indexnow]', ep, r.status);
    } catch (e: any) { console.warn('[indexnow] 실패', ep, e?.message); }
  }
}

/** 하루 최대 시도 — 매번 한두 줄씩 빠져도 30분마다 끝없이 다시 만들지 않게 (빠진 줄은 화면이 계산 문장으로 채운다) */
const MAX_TRIES = 4;

async function ensureDoc(apiKey: string, dateKey: string): Promise<void> {
  const db = admin.firestore();
  const ref = db.doc(`ttiFortune/${dateKey}`);
  const snap = await ref.get();
  const prev: any = snap.exists ? snap.data() : null;
  if (prev && complete(prev)) return;
  const tries = Number(prev?.tries || 0);
  if (tries >= MAX_TRIES) return;
  try {
    const doc = await generateTtiFortune(apiKey, dateKey);
    await ref.set({ ...doc, model: MODEL, tries: tries + 1, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`[ttiFortune] saved ${dateKey} ${doc.dayGz} complete=${complete(doc)}`);
    if (dateKey === kstDateKey(0)) await pingIndexNow(['https://saju500.app/unse/today/']);
    // 2026-10-19 미리보기 그림을 한 번 불러 CDN 에 올려 둔다 (처음 링크를 받은 사람이 그림 없는 미리보기를 보지 않게).
    //   주소에 판 번호(v=tries)를 붙여 다시 만들면 새 그림이 된다(og:image 와 앱 공유도 같은 번호). 완성본이나 마지막 시도일 때만
    if (complete(doc) || tries + 1 >= MAX_TRIES) {
      await fetch(`https://saju500.app/og/tti/${dateKey}.jpg?v=${tries + 1}`).then((r) => r.arrayBuffer()).catch(() => undefined);
    }
  } catch (e: any) {
    await ref.set({ date: dateKey, tries: tries + 1, lastError: String(e?.message || e).slice(0, 200) }, { merge: true });
    throw e;
  }
}

export const ensureTtiFortune = onSchedule(
  { schedule: '*/30 * * * *', timeZone: 'Asia/Seoul', secrets: [ANTHROPIC_KEY], timeoutSeconds: 540, memory: '512MiB', region: 'us-central1' },
  async () => {
    const key = ANTHROPIC_KEY.value();
    await ensureDoc(key, kstDateKey(0));
    const kstHour = new Date(Date.now() + 9 * 3600e3).getUTCHours();
    if (kstHour >= 22) await ensureDoc(key, kstDateKey(1));
  },
);
