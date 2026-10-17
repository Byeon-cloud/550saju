/**
 * 친구 궁합 초대장 (2026-10-18, 시험 E21 — 돈이 거의 안 드는 바이럴, Co-Star·测测 合盘 방식)
 *
 *   궁합에서 상대 생일을 모를 때 '상대에게 직접 넣어 달라고 보내기'.
 *   1) 보내는 사람: createCompatInvite → compatInvites/{14자} 에 내 이름, 관계, 생년월일을 뺀 사주(기둥, 오행, 십성, 용신, 지장간, 성별)
 *   2) 받은 사람: getCompatInvite 로 '누가 보냈는지'만 보고, 자기 생일을 넣으면 answerCompatInvite
 *      → 서버가 규칙 계산으로 궁합 점수와 잘 맞는 점, 부딪히는 점을 만든다(AI 없음, 원가 0) → 두 사람 모두 무료로 본다
 *   3) 전체 풀이(3운)는 지금 궁합 화면 그대로. 서버는 상대의 생년월일을 뺀 사주만 넘겨준다(listMyCompatInvites, getCompatInvite).
 *   생년월일과 태어난 시각은 서버에도 남기지 않는다. 30일 뒤 정리(cleanupCompatShares), 탈퇴하면 지운다(deleteCompatSharesOf).
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomBytes } from 'crypto';

const KEEP_DAYS = 30;
const DAILY_LIMIT = 20;
const FV = admin.firestore.FieldValue;
const db = () => admin.firestore();
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const clean = (v: unknown, max: number) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
function newId(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = randomBytes(14);
  let s = '';
  for (let i = 0; i < 14; i++) s += A[b[i] % A.length];
  return s;
}
const validId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9]{14}$/.test(id);

const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const GAN_OH: Record<string, string> = { 甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토', 己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수' };
const OH_GEN: Record<string, string> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
const OH_CTRL: Record<string, string> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
const GAN_HAP = new Set(['甲己', '乙庚', '丙辛', '丁壬', '戊癸']);
const GAN_CHUNG = new Set(['甲庚', '乙辛', '丙壬', '丁癸']);
const JI_HAP = new Set(['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']);
const JI_CHUNG = new Set(['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']);
const WONJIN = new Set(['子未', '丑午', '寅酉', '卯申', '辰亥', '巳戌']);
const SAMHAP = [['申', '子', '辰'], ['巳', '酉', '丑'], ['寅', '午', '戌'], ['亥', '卯', '未']];
const pair = (set: Set<string>, a: string, b: string) => set.has(a + b) || set.has(b + a);
const samhap = (a: string, b: string) => a !== b && SAMHAP.some((g) => g.includes(a) && g.includes(b));

/** 한글로 들어온 간지도 한자로 (예전 저장본) */
const GAN_HANJA: Record<string, string> = { 갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊', 기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸' };
const ZHI_HANJA: Record<string, string> = { 자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳', 오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥' };
const toGan = (v: unknown) => { const t = String(v || ''); return GAN.includes(t) && t.length === 1 ? t : GAN_HANJA[t] || ''; };
const toZhi = (v: unknown) => { const t = String(v || ''); return ZHI.includes(t) && t.length === 1 ? t : ZHI_HANJA[t] || ''; };

/** 생년월일을 뺀 사주 — 궁합 풀이(claudeCompat)가 쓰는 항목만 */
function stripSaju(sd: any, name: string): any {
  const okP = Array.isArray(sd?.pillars) ? sd.pillars.slice(0, 4).map((p: any) => ({
    천간: toGan(p?.천간), 지지: toZhi(p?.지지),
    천간읽기: clean(p?.천간읽기, 2), 지지읽기: clean(p?.지지읽기, 2), available: p?.available !== false,
  })) : [];
  if (okP.length < 3 || !okP[2].천간 || !okP[2].지지) return null;
  const el = sd?.elements || {};
  const num = (v: unknown) => Math.max(0, Math.min(8, Number(v) || 0));
  const ma = sd?.myeongriAnalysis || {};
  const OHS = ['목', '화', '토', '금', '수'];
  const pick = (v: unknown) => (typeof v === 'string' && OHS.includes(v) ? v : undefined);
  return JSON.parse(JSON.stringify({
    pillars: okP,
    elements: { 목: num(el.목), 화: num(el.화), 토: num(el.토), 금: num(el.금), 수: num(el.수) },
    sipsung: Array.isArray(sd?.sipsung) ? sd.sipsung.slice(0, 12).map((s: any) => ({ 위치: clean(s?.위치 || s?.position, 6), 십성: clean(s?.십성, 6) })) : [],
    jijanggan: Array.isArray(sd?.jijanggan) ? sd.jijanggan.slice(0, 4).map((j: any) => ({ 지지: clean(j?.지지, 1), 지장간: Array.isArray(j?.지장간) ? j.지장간.slice(0, 3).map((g: any) => clean(g, 1)) : [] })) : [],
    myeongriAnalysis: { 용신: pick(ma.용신), 희신: pick(ma.희신), 기신: pick(ma.기신), 일간강약: clean(ma.일간강약, 8) || undefined },
    input: { name: clean(name, 12) || '이름 없음', gender: sd?.input?.gender === 'male' ? 'male' : 'female' },
  }));
}

/** 규칙 계산 궁합 (AI 없음) — 일간, 일지(배우자 자리), 띠, 오행 보완 */
export function quickCompat(a: any, b: any, n1: string, n2: string): { score: number; good: string[]; care: string[]; head: string } {
  const g1 = a.pillars[2].천간, g2 = b.pillars[2].천간;
  const j1 = a.pillars[2].지지, j2 = b.pillars[2].지지;
  const y1 = a.pillars[0]?.지지 || '', y2 = b.pillars[0]?.지지 || '';
  const o1 = GAN_OH[g1], o2 = GAN_OH[g2];
  let s = 68;
  const good: string[] = []; const care: string[] = [];
  if (pair(GAN_HAP, g1, g2)) { s += 12; good.push('타고난 성향이 서로 끌어당기는 짝이에요. 처음 만나도 낯설지 않은 사이예요.'); }
  else if (OH_GEN[o1] === o2 || OH_GEN[o2] === o1) { s += 7; good.push(OH_GEN[o1] === o2 ? `${n1} 님이 ${n2} 님을 자연스럽게 북돋아 주는 사이예요.` : `${n2} 님이 ${n1} 님을 자연스럽게 북돋아 주는 사이예요.`); }
  else if (o1 === o2) { s += 3; good.push('생각하는 방식이 닮아서 말이 잘 통해요.'); }
  if (pair(GAN_CHUNG, g1, g2)) { s -= 7; care.push('중요한 결정 앞에서 의견이 자주 갈려요. 한 번 더 듣고 정하면 좋아요.'); }
  else if (OH_CTRL[o1] === o2 || OH_CTRL[o2] === o1) { s -= 3; care.push(OH_CTRL[o1] === o2 ? `${n1} 님 말이 ${n2} 님에게 세게 들릴 때가 있어요.` : `${n2} 님 말이 ${n1} 님에게 세게 들릴 때가 있어요.`); }
  if (pair(JI_HAP, j1, j2)) { s += 10; good.push('함께 지내는 생활 방식이 잘 맞아요.'); }
  else if (samhap(j1, j2)) { s += 6; good.push('같이 있으면 힘이 모이는 사이예요.'); }
  if (pair(JI_CHUNG, j1, j2)) { s -= 9; care.push('가까이 지낼수록 생활 습관 차이가 드러나요. 각자의 시간을 지켜 주면 좋아요.'); }
  else if (pair(WONJIN, j1, j2)) { s -= 5; care.push('사소한 말에도 서운함이 쌓이는 사이라, 그때그때 풀면 좋아요.'); }
  if (y1 && y2) {
    if (pair(JI_HAP, y1, y2) || samhap(y1, y2)) { s += 4; good.push('띠끼리도 잘 어울려요.'); }
    else if (pair(JI_CHUNG, y1, y2)) { s -= 4; care.push('띠끼리는 부딪히는 사이라, 집안 어른 일에서 생각이 갈릴 수 있어요.'); }
  }
  // 오행 보완: 상대가 많이 가진 기운이 내가 가장 적은 기운이면
  const OHS = ['목', '화', '토', '금', '수'];
  const weak = (e: any) => OHS.reduce((m, k) => ((Number(e?.[k]) || 0) < (Number(e?.[m]) || 0) ? k : m), '목');
  const w1 = weak(a.elements), w2 = weak(b.elements);
  if ((Number(b.elements?.[w1]) || 0) >= 2) { s += 5; good.push(`${n1} 님에게 부족한 ${w1} 기운을 ${n2} 님이 채워 줘요.`); }
  if ((Number(a.elements?.[w2]) || 0) >= 2) { s += 5; good.push(`${n2} 님에게 부족한 ${w2} 기운을 ${n1} 님이 채워 줘요.`); }
  const score = Math.max(52, Math.min(96, Math.round(s)));
  const head = score >= 85 ? '서로 잘 맞는 편이에요. 함께할수록 힘이 붙는 사이예요.'
    : score >= 72 ? '대체로 잘 맞아요. 다른 점만 알고 있으면 편한 사이예요.'
      : score >= 62 ? '맞는 점과 다른 점이 반반이에요. 서로 맞춰 가는 사이예요.'
        : '서로 다른 점이 많아요. 다른 점을 알면 오히려 배울 게 많은 사이예요.';
  if (!good.length) good.push('크게 부딪히는 자리가 없어 무난하게 지낼 수 있어요.');
  return { score, good: good.slice(0, 3), care: care.slice(0, 2), head };
}

/** 보내는 사람 — 초대장 만들기 */
export const createCompatInvite = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const name = clean(request.data?.name, 12) || '나';
    const saju = stripSaju(request.data?.sajuData, name);
    if (!saju) throw new HttpsError('invalid-argument', '내 사주를 먼저 넣어 주세요');
    const limRef = db().doc(`users/${uid}/shareLog/${kstDay()}`);
    await db().runTransaction(async (tx) => {
      const s = await tx.get(limRef);
      const n = Number(s.data()?.compatInvite || 0);
      if (n >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', '오늘은 더 보낼 수 없어요. 내일 다시 보내 주세요');
      tx.set(limRef, { compatInvite: n + 1, updatedAt: FV.serverTimestamp() }, { merge: true });
    });
    const id = newId();
    await db().doc(`compatInvites/${id}`).set({
      fromUid: uid, n1: name, rel: clean(request.data?.relation, 10) || '', saju1: saju, status: 'open',
      createdAt: FV.serverTimestamp(), createdAtMs: Date.now(), expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + KEEP_DAYS * 864e5),
    });
    return { id };
  },
);

/** 받은 사람과 보낸 사람 — 초대장 보기. 남의 사주는 두 사람 중 하나일 때만, 답한 뒤에만 */
export const getCompatInvite = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid || '';
    const id = request.data?.id;
    if (!validId(id)) return { ok: false, reason: 'bad' };
    const s = await db().doc(`compatInvites/${id}`).get();
    if (!s.exists) return { ok: false, reason: 'gone' };
    const d = s.data() || {};
    const mine = uid && uid === d.fromUid;
    const answeredByMe = uid && uid === d.toUid;
    return {
      ok: true, n1: d.n1 || '', rel: d.rel || '', status: d.status || 'open', mine: !!mine, answeredByMe: !!answeredByMe,
      n2: (mine || answeredByMe) ? d.n2 || '' : '',
      result: (mine || answeredByMe) ? d.result || null : null,
      // 전체 풀이용 — 상대 사주(생년월일 없음)는 두 사람에게만
      other: answeredByMe ? d.saju1 || null : mine && d.status === 'answered' ? d.saju2 || null : null,
    };
  },
);

/** 받은 사람 — 내 생일(사주)을 넣고 무료 궁합 받기 */
export const answerCompatInvite = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const id = request.data?.id;
    if (!validId(id)) return { ok: false, reason: 'bad' };
    const name = clean(request.data?.name, 12) || '상대';
    const saju2 = stripSaju(request.data?.sajuData, name);
    if (!saju2) return { ok: false, reason: 'no_saju' };
    const ref = db().doc(`compatInvites/${id}`);
    return db().runTransaction(async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists) return { ok: false, reason: 'gone' };
      const d = s.data() || {};
      if (d.fromUid === uid) return { ok: false, reason: 'self' };
      if (d.status === 'answered') {
        return d.toUid === uid ? { ok: true, result: d.result, n1: d.n1, other: d.saju1 } : { ok: false, reason: 'taken' };
      }
      const result = quickCompat(d.saju1, saju2, d.n1 || '나', name);
      tx.update(ref, { toUid: uid, n2: name, saju2, result, status: 'answered', answeredAt: FV.serverTimestamp(), seenByFrom: false });
      return { ok: true, result, n1: d.n1, other: d.saju1 };
    });
  },
);

/** 보낸 사람 — 내가 보낸 초대장 (최근 10장). 새로 답이 온 것은 seen 처리 */
export const listMyCompatInvites = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const q = await db().collection('compatInvites').where('fromUid', '==', uid).limit(30).get();
    const items = q.docs.map((x) => ({ id: x.id, ...(x.data() as any) }))
      .sort((p, q2) => (q2.createdAtMs || 0) - (p.createdAtMs || 0)).slice(0, 10);
    const fresh = items.filter((x) => x.status === 'answered' && x.seenByFrom === false).map((x) => x.id);
    if (request.data?.markSeen && fresh.length) {
      const b = db().batch();
      fresh.forEach((fid) => b.update(db().doc(`compatInvites/${fid}`), { seenByFrom: true }));
      await b.commit();
    }
    return {
      items: items.map((x) => ({
        id: x.id, rel: x.rel || '', status: x.status, n2: x.n2 || '', score: x.result?.score ?? null, head: x.result?.head || '',
        good: x.result?.good || [], care: x.result?.care || [], createdAtMs: x.createdAtMs || 0,
        other: x.status === 'answered' ? x.saju2 || null : null, fresh: fresh.includes(x.id),
      })),
    };
  },
);
