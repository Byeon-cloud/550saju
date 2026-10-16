/**
 * 매일 아침 일주 운세 메일 (2026-10-17, 시험 E15 · 오너 제안 '메일로 묶어 두기')
 *
 *   원가 설계: 사람마다 AI 로 쓰면 오늘의 운세 한 건이 약 106원(5.5 세대 실측)이라 구독자 1,000명이면 한 달 300만 원이 넘는다.
 *   그래서 60일주(태어난 날의 간지) 각각의 오늘 운세를 하루 한 번만 만든다(Sonnet 6번, 하루 약 400원, 한 달 약 1.2만 원 고정).
 *   구독자가 한 명도 없으면 만들지 않는다. 같은 일주끼리는 같은 글을 받고, 내 사주 전체 풀이는 앱의 오늘의 운세(하루 한 번 무료)로 잇는다.
 *
 *   근거는 서버 확정표: 오늘 일진, 일간과 오늘 천간의 십성, 일지와 오늘 지지의 관계(충, 육합, 삼합, 형, 해, 원진), 일지 기준 좋은 시간.
 *   iljuDaily/{날짜} 에 저장. 구독은 dailyMailSubs/{uid} (메일, 일주, 출생 연도만. 생일 전체는 남기지 않는다).
 *   보내는 계정은 pdf/mailPdf.ts (구글 워크스페이스 하루 약 2,000통 → 구독 1,500명에서 신청을 멈추고 경보).
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { Solar, Lunar } from 'lunar-javascript';
import { createClaude, CLAUDE_MODEL } from '../shared/claudeClient';
import { logAnthropicUsage } from '../shared/aiUsageLog';
import { parseJsonResponse, TONE_FINAL_CHECK } from '../ai/promptsV3';
import { tenGod, sanitizeAiOutput } from '../ai/sajuFacts';
import { branchRelations, ttiHours } from '../tti/ttiFortune';
import { MAIL_APP_PASSWORD, FROM_ADDR, BIZ_LINE, mailTransport, newUnsubToken, normalizeEmail, unsubUrl } from '../pdf/mailPdf';

const ANTHROPIC_KEY = defineSecret('ANTHROPIC_API_KEY');
const MODEL = CLAUDE_MODEL.sonnet;
const MAX_SUBS = 1500;
const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const GAN_KO: Record<string, string> = { 甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무', 己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계' };
const ZHI_KO: Record<string, string> = { 子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사', 午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해' };
const ko = (gz: string) => (GAN_KO[gz[0]] || '') + (ZHI_KO[gz[1]] || '');
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** 60갑자 순서 */
export const GAPJA: string[] = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);
const kstKey = (offset = 0) => new Date(Date.now() + 9 * 3600e3 + offset * 864e5).toISOString().slice(0, 10);
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function dayPillarOf(y: number, m: number, d: number): string {
  return Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getEightChar().getDay();
}
/** 생일(8자리) → 일주. 음력이면 양력으로 바꿔 계산 (calculator.toSolarInput 과 같은 규칙) */
export function iljuOfBirth(birth: string, calendar: 'solar' | 'lunar', leap = false): { ilju: string; year: number } | null {
  if (!/^\d{8}$/.test(birth)) return null;
  const y = Number(birth.slice(0, 4)); const m = Number(birth.slice(4, 6)); const d = Number(birth.slice(6, 8));
  if (y < 1900 || y > 2030 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  try {
    let sy = y; let sm = m; let sd = d;
    if (calendar === 'lunar') {
      const s = Lunar.fromYmd(y, leap ? -m : m, d).getSolar();
      sy = s.getYear(); sm = s.getMonth(); sd = s.getDay();
    } else {
      const t = new Date(Date.UTC(y, m - 1, d));
      if (t.getUTCMonth() !== m - 1) return null;
    }
    return { ilju: dayPillarOf(sy, sm, sd), year: y };
  } catch { return null; }
}

const SIP_PLAIN: Record<string, string> = {
  비견: '나와 같은 기운(내 몫 지키기, 동료와 경쟁)', 겁재: '나와 같은 기운(경쟁, 나가는 돈)',
  식신: '내가 내는 기운(먹을 복, 재주, 여유)', 상관: '내가 내는 기운(말과 표현, 말실수)',
  편재: '내가 다스리는 기운(뜻밖의 돈, 바깥 일)', 정재: '내가 다스리는 기운(정해진 돈, 살림)',
  '편관(칠살)': '나를 누르는 기운(급한 일, 압박, 몸 피로)', 정관: '나를 바르게 하는 기운(책임, 직장, 체면)',
  편인: '나를 돕는 기운(생각, 눈치, 혼자 하는 공부)', 정인: '나를 돕는 기운(문서, 어른의 도움, 마음의 안정)',
};
const REL_PLAIN: Record<string, string> = {
  충: '오늘과 정면으로 부딪힘(변동, 다툼, 먼 길과 계약은 신중)', 육합: '오늘과 짝을 이룸(도움, 약속이 잘 맞음)',
  삼합: '오늘과 한편이 됨(협력, 일이 맞물려 풀림)', 형: '오늘과 서로 깎임(마찰, 서류 실수, 몸 다침 조심)',
  해: '오늘과 은근히 어긋남(섭섭함, 오해)', 원진: '오늘이 괜히 밉고 서운함(감정 소모)',
  '같은 띠 날': '오늘과 같은 글자(같은 기운이 겹쳐 고집)', '같은 띠 날(자형)': '오늘과 같은 글자(스스로 꼬임)',
};

export function iljuFacts(dateKey: string): { dayGz: string; rows: Array<{ ilju: string; line: string; hour: string }> } {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dayGz = dayPillarOf(y, m, d);
  const rows = GAPJA.map((ij) => {
    const sip = tenGod(ij[0], dayGz[0]);
    const rels = branchRelations(dayGz[1], ij[1]);
    const h = ttiHours(ij[1]);
    const line = `${ij}(${ko(ij)}) 일주: 오늘 천간 ${dayGz[0]}은 ${sip} = ${SIP_PLAIN[sip] || ''} / 일지 ${ij[1]}와 오늘 지지 ${dayGz[1]}: ${rels.length ? rels.map((r) => REL_PLAIN[r] || r).join(', ') : '특별한 관계 없음(무난함)'} / 좋은 시간 ${h.good}`;
    return { ilju: ij, line, hour: h.good };
  });
  return { dayGz, rows };
}

const SYSTEM = `당신은 사주500 의 명리 풀이가입니다. 아침 메일로 받는 일주별 오늘의 운세를 씁니다. 읽는 사람은 30대부터 70대까지이고 휴대폰 메일로 읽습니다.

## 근거
- 근거는 확정표뿐입니다. 일주마다 적힌 오늘 천간의 십성, 일지와 오늘 지지의 관계, 좋은 시간만 씁니다. 표에 없는 길흉을 지어내지 않습니다.
- 같은 십성이나 같은 관계가 여러 일주에 나와도 같은 첫마디와 같은 문장을 쓰지 않습니다. 일주마다 다르게 씁니다.

## 쓰는 법
- head: 한 문장, 30~50자. '오늘은 ~한 날입니다.' 꼴로 그 일주에게 어떤 날인지.
- body: 두 문장, 70~120자. 일, 돈, 사람 가운데 하나에 붙여 판단 하나와 할 일 하나. 권유는 '~하세요'.
- care: 한 문장, 20~40자. 오늘 조심할 일 하나를 할 일로('~는 내일로 미루세요').
- 명리 용어(십성 이름, 충, 합, 형, 해, 원진, 일지, 천간)와 한자는 쓰지 않습니다. 쉬운 생활 말로 씁니다.
- 겁주는 말(사고, 병, 이별, 망한다)과 확률, 보장 숫자를 쓰지 않습니다.
- 평범한 한국어 문장으로 씁니다. 'A 대신 B', '~라기보다', 말 순서를 뒤집은 문장, 명사로 끊는 문장, 시적인 비유를 쓰지 않습니다. 부정하고 뒤집는 문장('~가 아니라')도 쓰지 않습니다.
- 외래어(타이밍, 스트레스, 컨디션, 에너지, 패턴)와 가운뎃점(·), 긴 줄표(—)를 쓰지 않습니다.

## 출력
JSON 하나만 출력합니다. 키는 확정표의 일주 한자 그대로입니다.
{"甲子":{"head":"...","body":"...","care":"..."}, ...}`;

type IljuEntry = { head: string; body: string; care: string; hour: string };

function okEntry(e: any): boolean {
  return e && [e.head, e.body, e.care].every((s: any) => typeof s === 'string' && s.trim().length >= 8);
}

export async function generateIljuDaily(apiKey: string, dateKey: string): Promise<{ date: string; dayGz: string; ilju: Record<string, IljuEntry> }> {
  const anthropic = createClaude(apiKey);
  const { dayGz, rows } = iljuFacts(dateKey);
  const [y, m, d] = dateKey.split('-').map(Number);
  const head = `오늘: ${y}년 ${m}월 ${d}일 ${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}요일, 일진 ${dayGz}(${ko(dayGz)})일`;
  const out: Record<string, IljuEntry> = {};
  const chunks: typeof rows[] = [];
  for (let i = 0; i < 60; i += 10) chunks.push(rows.slice(i, i + 10));
  const one = async (chunk: typeof rows) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const t0 = Date.now();
      const msg: any = await anthropic.messages.create({
        model: MODEL, max_tokens: 3500, system: SYSTEM,
        messages: [{ role: 'user', content: `## 확정표\n${head}\n${chunk.map((r) => r.line).join('\n')}\n${TONE_FINAL_CHECK}` }],
      });
      logAnthropicUsage('ilju', MODEL, msg, t0, 'schedule');
      try {
        const parsed: any = sanitizeAiOutput(parseJsonResponse((msg.content || []).map((b: any) => b.text || '').join('')));
        let n = 0;
        for (const r of chunk) {
          const e = parsed?.[r.ilju];
          if (okEntry(e)) { out[r.ilju] = { head: e.head.trim(), body: e.body.trim(), care: e.care.trim(), hour: r.hour }; n++; }
        }
        if (n === chunk.length) return;
      } catch (e: any) {
        console.warn('[ilju] parse fail', attempt, e?.message);
      }
    }
  };
  // 첫 묶음을 먼저 보내 시스템 프롬프트 캐시를 만든 뒤 나머지를 보낸다 (병렬 동시 출발 = 캐시 읽기 0 함정)
  await one(chunks[0]);
  await Promise.all(chunks.slice(1).map((c, i) => new Promise<void>((res) => setTimeout(() => one(c).then(() => res(), () => res()), i * 400))));
  return { date: dateKey, dayGz, ilju: out };
}

async function activeSubCount(db: admin.firestore.Firestore): Promise<number> {
  const agg = await db.collection('dailyMailSubs').where('active', '==', true).count().get();
  return agg.data().count;
}

async function ensureIlju(db: admin.firestore.Firestore, key: string, dateKey: string): Promise<any | null> {
  const ref = db.doc(`iljuDaily/${dateKey}`);
  const snap = await ref.get();
  const prev: any = snap.exists ? snap.data() : null;
  if (prev?.ilju && Object.keys(prev.ilju).length >= 60) return prev;
  if (Number(prev?.tries || 0) >= 3) return prev;
  const doc = await generateIljuDaily(key, dateKey);
  const merged = { ...doc, ilju: { ...(prev?.ilju || {}), ...doc.ilju } };
  await ref.set({ ...merged, tries: Number(prev?.tries || 0) + 1, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return merged;
}

/* ── 구독 ── */
export const subscribeDailyMail = onCall(
  { secrets: [MAIL_APP_PASSWORD], timeoutSeconds: 30, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const email = normalizeEmail(request.data?.email);
    if (!email) throw new HttpsError('invalid-argument', '메일 주소를 다시 확인해 주세요');
    if (request.data?.consent !== true) throw new HttpsError('invalid-argument', '메일 받기에 동의해 주세요');
    const cal = request.data?.calendar === 'lunar' ? 'lunar' : 'solar';
    const got = iljuOfBirth(String(request.data?.birth || '').replace(/\D/g, ''), cal, !!request.data?.leap);
    if (!got) throw new HttpsError('invalid-argument', '생년월일 8자리를 다시 확인해 주세요');
    const name = String(request.data?.name || '').replace(/[<>]/g, '').trim().slice(0, 10);
    const db = admin.firestore();
    const day = kstKey(0);
    const limRef = db.doc(`users/${uid}/mailLog/${day}`);
    await db.runTransaction(async (tx) => {
      const s = await tx.get(limRef);
      const n = Number(s.data()?.daily || 0);
      if (n >= 3) throw new HttpsError('resource-exhausted', '오늘은 더 신청할 수 없어요. 내일 다시 시도해 주세요');
      tx.set(limRef, { daily: n + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
    const ref = db.doc(`dailyMailSubs/${uid}`);
    const prev = (await ref.get()).data() || {};
    if (!prev.active && (await activeSubCount(db)) >= MAX_SUBS) {
      await db.collection('backofficeAlerts').add({ kind: 'daily_mail_full', at: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
      throw new HttpsError('resource-exhausted', '지금은 신청이 많아 잠시 받지 않아요. 곧 다시 열어 드릴게요');
    }
    const token: string = prev.unsubToken || newUnsubToken();
    await ref.set({
      uid, email, ilju: got.ilju, birthYear: got.year, name, active: true, unsubToken: token,
      consentDay: day, consentAt: admin.firestore.FieldValue.serverTimestamp(), source: String(request.data?.source || '').slice(0, 30),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 신청 확인 메일 (오늘 글이 이미 있으면 첫 운세를 바로 넣는다)
    const today = (await db.doc(`iljuDaily/${day}`).get()).data() as any;
    const entry: IljuEntry | undefined = today?.ilju?.[got.ilju];
    const m = mailFor({ uid, token, name, ilju: got.ilju, dateKey: day, dayGz: today?.dayGz || '', entry, welcome: true, consentDay: day });
    try {
      await mailTransport().sendMail({ from: `"사주500" <${FROM_ADDR}>`, to: email, subject: m.subject, text: m.text, html: m.html, headers: m.headers });
    } catch (e: any) {
      console.error('[dailyMail] 신청 메일 실패', e?.code || '', e?.message || e);
      throw new HttpsError('internal', '메일을 보내지 못했어요. 주소를 확인하고 다시 시도해 주세요');
    }
    return { ok: true, ilju: got.ilju, iljuKo: ko(got.ilju) };
  },
);

function mailFor(p: { uid: string; token: string; name: string; ilju: string; dateKey: string; dayGz: string; entry?: IljuEntry; welcome?: boolean; consentDay: string }) {
  const [y, mo, d] = p.dateKey.split('-').map(Number);
  const wd = WEEK[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const who = p.name ? `${p.name} 님` : '';
  const ijKo = `${ko(p.ilju)} 일주`;
  const link = 'https://saju500.app/daily?utm_source=email&utm_medium=daily&utm_campaign=ilju_daily';
  const tti = 'https://saju500.app/unse/today/?utm_source=email&utm_medium=daily&utm_campaign=ilju_daily_tti';
  const unsub = unsubUrl(p.uid, p.token, 'daily');
  const subject = p.welcome
    ? `[사주500] ${who ? who + ', ' : ''}매일 아침 ${ijKo} 운세를 보내 드릴게요`
    : `[사주500] ${mo}월 ${d}일 ${ijKo} 오늘의 운세${p.entry ? `: ${p.entry.head.replace(/[.]$/, '')}` : ''}`.slice(0, 90);
  const dayLine = p.dayGz ? `${mo}월 ${d}일 ${wd}요일, ${ko(p.dayGz)}(${p.dayGz})일` : `${mo}월 ${d}일 ${wd}요일`;
  const intro = p.welcome
    ? `${who ? who + '은 ' : ''}태어난 날의 간지가 ${ko(p.ilju)}(${p.ilju})예요. 내일부터 매일 아침 7시에 ${ijKo}의 오늘 운세를 보내 드려요.`
    : '';
  const bodyText = p.entry
    ? [p.entry.head, p.entry.body, `좋은 시간: ${p.entry.hour}`, `조심할 일: ${p.entry.care}`]
    : ['내일 아침 첫 운세를 보내 드릴게요.'];
  const text = [
    ...(intro ? [intro, ''] : []),
    `${dayLine}, ${ijKo}`,
    ...bodyText,
    '',
    `같은 일주라도 태어난 달과 시간이 다르면 하루가 달라요. 내 사주 여덟 글자로 오늘 전체 풀이 보기(하루 한 번 무료): ${link}`,
    `오늘의 띠별 운세: ${tti}`,
    '',
    `${p.consentDay}에 사주500 아침 운세 메일을 신청하셔서 보내 드려요. 그만 받으려면: ${unsub}`,
    BIZ_LINE,
  ].join('\n');
  const html = `<div style="font-family:Pretendard,-apple-system,sans-serif;font-size:15.5px;line-height:1.8;color:#1A1612;max-width:560px">
${intro ? `<p>${esc(intro)}</p>` : ''}
<p style="font-size:13.5px;color:#6F6557;margin:0">${esc(dayLine)}</p>
<p style="font-family:'Noto Serif KR',serif;font-size:19px;font-weight:700;line-height:1.5;margin:4px 0 10px">${esc(ijKo)}${p.entry ? `<br>${esc(p.entry.head)}` : ''}</p>
${p.entry ? `<p>${esc(p.entry.body)}</p>
<table style="border-collapse:collapse;font-size:15px;margin:6px 0 4px"><tr><td style="padding:4px 14px 4px 0;color:#6F6557;white-space:nowrap">좋은 시간</td><td style="padding:4px 0"><b>${esc(p.entry.hour)}</b></td></tr>
<tr><td style="padding:4px 14px 4px 0;color:#6F6557;white-space:nowrap">조심할 일</td><td style="padding:4px 0">${esc(p.entry.care)}</td></tr></table>` : '<p>내일 아침 첫 운세를 보내 드릴게요.</p>'}
<p style="margin:22px 0 6px;font-size:14.5px;color:#4B4238">같은 일주라도 태어난 달과 시간이 다르면 하루가 달라요.</p>
<p style="margin:0 0 10px"><a href="${link}" style="display:inline-block;background:#B8965A;color:#17110A;font-weight:800;text-decoration:none;padding:12px 20px;border-radius:12px">내 사주로 오늘 전체 풀이 보기 (하루 한 번 무료)</a></p>
<p style="margin:0"><a href="${tti}" style="color:#7A5C2E;font-weight:700">오늘의 띠별 운세 보기</a></p>
<p style="font-size:12px;color:#8A8073;margin-top:28px;line-height:1.7">${esc(p.consentDay)}에 사주500 아침 운세 메일을 신청하셔서 보내 드려요. 더 받지 않으려면 <a href="${unsub}" style="color:#8A8073">수신 거부</a>를 눌러 주세요.<br>${esc(BIZ_LINE)}</p>
</div>`;
  return { subject, text, html, headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
}

/* ── 매일 06:30 글 만들기, 07:00 보내기 ── */
export const ensureIljuDaily = onSchedule(
  { schedule: '30 6 * * *', timeZone: 'Asia/Seoul', secrets: [ANTHROPIC_KEY], timeoutSeconds: 540, memory: '512MiB', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    if ((await activeSubCount(db)) === 0) { console.log('[ilju] 구독자 0, 만들지 않음'); return; }
    const doc = await ensureIlju(db, ANTHROPIC_KEY.value(), kstKey(0));
    console.log('[ilju] 오늘 일주', Object.keys(doc?.ilju || {}).length, '/ 60');
  },
);

export const sendDailyMail = onSchedule(
  { schedule: '0 7 * * *', timeZone: 'Asia/Seoul', secrets: [ANTHROPIC_KEY, MAIL_APP_PASSWORD], timeoutSeconds: 1800, memory: '512MiB', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    const subs = await db.collection('dailyMailSubs').where('active', '==', true).get();
    if (subs.empty) { console.log('[dailyMail] 구독자 0'); return; }
    const dateKey = kstKey(0);
    const doc = await ensureIlju(db, ANTHROPIC_KEY.value(), dateKey); // 06:30 에 못 만들었으면 여기서
    const transport = mailTransport();
    let sent = 0; let skipped = 0; let failed = 0;
    for (const s of subs.docs) {
      const d = s.data();
      const email = normalizeEmail(d.email);
      const entry: IljuEntry | undefined = doc?.ilju?.[d.ilju];
      if (!email || !entry) { skipped++; continue; }
      const mark = db.doc(`dailyMailLog/${dateKey}/sent/${s.id}`);
      try { await mark.create({ at: admin.firestore.FieldValue.serverTimestamp() }); } catch { skipped++; continue; }
      let token: string = d.unsubToken;
      if (!token) { token = newUnsubToken(); await s.ref.set({ unsubToken: token }, { merge: true }); }
      const m = mailFor({ uid: s.id, token, name: d.name || '', ilju: d.ilju, dateKey, dayGz: doc.dayGz, entry, consentDay: d.consentDay || '' });
      try {
        await transport.sendMail({ from: `"사주500" <${FROM_ADDR}>`, to: email, subject: m.subject, text: m.text, html: m.html, headers: m.headers });
        sent++;
      } catch (e: any) {
        failed++;
        await mark.set({ ok: false, err: String(e?.message || e).slice(0, 120) }, { merge: true });
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    await db.doc(`dailyMailLog/${dateKey}`).set({ sent, skipped, failed, total: subs.size, ranAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (subs.size > 1200) await db.collection('backofficeAlerts').add({ kind: 'daily_mail_near_limit', subs: subs.size, at: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    console.log('[dailyMail]', { sent, skipped, failed, total: subs.size });
  },
);
