/**
 * 하루 요약 (2026-10-19) — 원본 기록을 날마다 한 장으로 접어 둔다. 관리자 화면, 성과판, 주간 보고가 이 한 장을 읽는다.
 *
 *   원본: analytics(방문과 행동, plat=web|ait), users/{uid}/payments(결제 장부), aiUsage(AI 비용), aiFailures,
 *         compensations + compensationLog(CS 지급), backofficeAlerts(서버 경보)
 *   요약: statsDaily/{YYYY-MM-DD} — 앱(app)과 웹(web)을 나눠 사람 수, 결제, 매출, 환불, 콘텐츠, 유입, AI 비용, CS, 경보
 *
 *   사람 세는 기준은 성과판(scripts/ops/dashboard_data.cjs)과 같다: 기기(did) 기준, 오너 기기(internal) 제외.
 *   매출은 이벤트가 아니라 결제 장부 기준(같은 주문번호는 한 번, 상태 confirmed, 확정 시각의 한국 날짜). 환불은 refundedAt 날짜.
 *   매일 0시 20분(한국)에 어제와 그제를 다시 만든다(늦게 들어온 기록 반영). 오늘 것은 화면을 열 때 바로 계산한다.
 *   원본 analytics 는 400일 보관(pruneRawAnalytics, 매월 1일). 요약은 계속 둔다. 매일 백업과 시점 복구는 별도로 켜져 있다.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { assertOwner, OWNER_UIDS } from './owner';

const STATS_VERSION = 3; // 2: 오너 시험 결제 제외 / 3: 이벤트별 건수(events), 재방문(retention)
const RAW_KEEP_DAYS = 400;

export const kstDayOf = (ms: number): string => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
export const kstToday = (): string => kstDayOf(Date.now());
export const addDays = (day: string, n: number): string => kstDayOf(Date.parse(`${day}T12:00:00+09:00`) + n * 864e5);
const tsMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'string') return Date.parse(v) || 0;
  if (typeof v === 'number') return v;
  if (v._seconds) return v._seconds * 1000;
  return 0;
};

// AI 토큰 단가(달러, 100만 토큰) — 관리자 화면 _useAdminData 와 같은 표. 캐시 읽기 0.1배, 캐시 쓰기 1.25배
const USD_KRW = 1400;
const PRICE: Record<string, { in: number; out: number }> = {
  opus: { in: 5, out: 25 }, sonnet: { in: 3, out: 15 }, haiku: { in: 1, out: 5 }, gemini: { in: 0.15, out: 0.6 },
  opus55: { in: 4, out: 20 }, sonnet55: { in: 2, out: 10 }, haiku55: { in: 0.1, out: 0.5 },
};
function aiCostKrw(u: any): number {
  const model = String(u.model || '');
  const g = /-5-\d/.test(model) ? '55' : '';
  const p = model.includes('opus') ? PRICE['opus' + g] : model.includes('sonnet') ? PRICE['sonnet' + g]
    : model.includes('haiku') ? PRICE['haiku' + g] : model.includes('gemini') ? PRICE.gemini : null;
  if (!p) return 0;
  const i = Number(u.inputTokens) || 0;
  const o = Number(u.outputTokens) || 0;
  const cr = Number(u.cacheReadTokens) || 0;
  const cw = Number(u.cacheWriteTokens) || 0;
  return ((i * p.in + cw * p.in * 1.25 + cr * p.in * 0.1 + o * p.out) / 1e6) * USD_KRW;
}

type Plat = 'app' | 'web';
export interface Side {
  visitors: number; newDevices: number; opens: number; inputs: number; results: number; payTry: number; chargeOpen: number;
  loginGate: number; logins: number;
  payers: number; newPayers: number; orders: number; revenue: number; refunds: number; refundAmount: number;
  shares: number; notiAgree: number;
}
const emptySide = (): Side => ({
  visitors: 0, newDevices: 0, opens: 0, inputs: 0, results: 0, payTry: 0, chargeOpen: 0, loginGate: 0, logins: 0,
  payers: 0, newPayers: 0, orders: 0, revenue: 0, refunds: 0, refundAmount: 0, shares: 0, notiAgree: 0,
});
export interface ContentRow { opens: number; results: number; purchases: number; un: number }
export interface ChannelRow { plat: Plat; visitors: number; inputs: number; results: number; payers: number; revenue: number }
export interface DayStats {
  day: string; v: number; builtAt: number; partial?: boolean;
  app: Side; web: Side;
  content: Record<string, { app: ContentRow; web: ContentRow }>;
  channels: Record<string, ChannelRow>;
  ai: { calls: number; fail: number; costKrw: number; byType: Record<string, { calls: number; fail: number; costKrw: number; ms: number }> };
  aiFailures: { total: number; byType: Record<string, number> };
  cs: { granted: number; grantedUn: number; claimed: number; claimedUn: number };
  alerts: { total: number; byKind: Record<string, number> };
  packages: Record<string, number>; // '앱 5000' → 건수
  /** 이벤트 이름별 건수 (사람 수가 아니라 기록 수) — 관리자 '기록 점검'이 끊긴 기록을 찾는 데 쓴다 */
  events: Record<string, { app: number; web: number }>;
  /** 그날 처음 온 기기(signup) 중 다음 날, 7일 안에 다시 온 기기. 미래 날이 아직이면 null */
  retention: Record<Plat, { cohort: number; d1: number | null; w1: number | null }>;
}

/** 하루치 계산에 공통으로 쓰는 작은 장부들 (여러 날을 만들 때 한 번만 읽는다) */
interface Ledger {
  orders: { uid: string; orderId: string; plat: Plat; amount: number; day: string; refundedDay: string | null; refundAmount: number; status: string }[];
  firstPayDay: Map<string, string>; // uid → 첫 결제 날
  comps: { createdDay: string; amount: number; claimedDay: string | null; target: string }[];
  compLog: { day: string; amount: number }[];
  alerts: { day: string; kind: string }[];
  /** 날짜 → (기기 → plat) 메모 (재방문 계산용, 한 번의 실행 안에서만) */
  whoMemo?: Map<string, Promise<Map<string, Plat>>>;
}

function whoOfDay(day: string, ledger: Ledger): Promise<Map<string, Plat>> {
  ledger.whoMemo ??= new Map();
  const hit = ledger.whoMemo.get(day);
  if (hit) return hit;
  const p = admin.firestore().collection('analytics').where('day', '==', day).select('uid', 'did', 'sid', 'plat', 'internal').get().then((snap) => {
    const m = new Map<string, Plat>();
    for (const d of snap.docs) {
      const e = d.data() as any;
      if (e.internal) continue;
      const who = String(e.did || e.uid || e.sid || '');
      if (who && !m.has(who)) m.set(who, e.plat === 'ait' ? 'app' : 'web');
    }
    return m;
  });
  ledger.whoMemo.set(day, p);
  return p;
}

async function loadLedger(): Promise<Ledger> {
  const db = admin.firestore();
  const [paySnap, compSnap, logSnap, alertSnap] = await Promise.all([
    db.collectionGroup('payments').get(),
    db.collection('compensations').get(),
    db.collection('compensationLog').get().catch(() => null),
    db.collection('backofficeAlerts').get(),
  ]);
  // 같은 주문번호가 여러 계정에 있으면(기기 이관, 결제이력 복구) 가장 먼저 확정된 한 건만
  const byOrder = new Map<string, Ledger['orders'][number]>();
  for (const d of paySnap.docs) {
    const p = d.data() as any;
    if (p.type && p.type !== 'charge') continue;
    const uid = d.ref.parent.parent?.id || '';
    if (OWNER_UIDS.includes(uid)) continue; // 오너 시험 결제는 매출이 아니다 (예전 화면과 같은 기준)
    const orderId = String(p.orderId || d.id);
    const status = String(p.status || '');
    if (status !== 'confirmed' && status !== 'refunded' && status !== 'partial_refund_review') continue;
    const at = tsMs(p.confirmedAt) || tsMs(p.createdAt);
    if (!at) continue;
    const row = {
      uid, orderId, status,
      plat: (p.pgProvider === 'iap' ? 'app' : 'web') as Plat,
      amount: Number(p.amount) || 0,
      day: kstDayOf(at),
      refundedDay: status === 'refunded' && tsMs(p.refundedAt) ? kstDayOf(tsMs(p.refundedAt)) : null,
      refundAmount: Number(p.cancelledAmount) || (status === 'refunded' ? Number(p.amount) || 0 : 0),
    };
    const prev = byOrder.get(orderId);
    if (!prev || row.day < prev.day) byOrder.set(orderId, row);
  }
  const orders = [...byOrder.values()];
  const firstPayDay = new Map<string, string>();
  for (const o of orders) {
    const f = firstPayDay.get(o.uid);
    if (!f || o.day < f) firstPayDay.set(o.uid, o.day);
  }
  const comps = compSnap.docs.map((d) => {
    const c = d.data() as any;
    const created = tsMs(c.updatedAt) || tsMs(c.createdAt);
    return {
      target: d.id,
      createdDay: created ? kstDayOf(created) : '',
      amount: Number(c.amount) || 0,
      claimedDay: c.claimed && tsMs(c.claimedAt) ? kstDayOf(tsMs(c.claimedAt)) : null,
    };
  });
  const compLog = (logSnap?.docs || []).map((d) => {
    const c = d.data() as any;
    return { day: tsMs(c.at) ? kstDayOf(tsMs(c.at)) : '', amount: Number(c.amount) || 0 };
  });
  const alerts = alertSnap.docs.map((d) => {
    const a = d.data() as any;
    const at = tsMs(a.at) || tsMs(a.createdAt) || tsMs(a.ts);
    return { day: at ? kstDayOf(at) : '', kind: String(a.kind || a.type || 'etc') };
  });
  return { orders, firstPayDay, comps, compLog, alerts };
}

const srcOf = (u: any): string => {
  if (!u || !u.source) return '출처 없음';
  if (u.source === 'toss_ref') return `토스 ${u.medium || ''}`.trim();
  return String(u.source).slice(0, 40);
};

/** 하루치 요약 계산 (저장은 하지 않는다) */
export async function computeDay(day: string, ledger: Ledger): Promise<DayStats> {
  const db = admin.firestore();
  const [evSnap, aiSnap, failSnap] = await Promise.all([
    db.collection('analytics').where('day', '==', day).select('name', 'uid', 'did', 'sid', 'props', 'utm', 'plat', 'internal', 'ts').get(),
    db.collection('aiUsage').where('day', '==', day).get(),
    db.collection('aiFailures').where('day', '==', day).get(),
  ]);

  const S: Record<Plat, Side> = { app: emptySide(), web: emptySide() };
  const sets: Record<Plat, Record<string, Set<string>>> = { app: {}, web: {} };
  const put = (p: Plat, k: string, who: string) => { (sets[p][k] ??= new Set()).add(who); };
  const content: DayStats['content'] = {};
  const crow = (t: string, p: Plat) => ((content[t] ??= { app: { opens: 0, results: 0, purchases: 0, un: 0 }, web: { opens: 0, results: 0, purchases: 0, un: 0 } })[p]);
  const contentPeople: Record<string, Set<string>> = {};

  // 기기별 첫 출처(그날 utm 이 처음 붙은 이벤트)
  const evs = evSnap.docs.map((d) => d.data() as any).filter((e) => !e.internal);
  evs.sort((a, b) => tsMs(a.ts) - tsMs(b.ts));
  const firstSrc = new Map<string, string>();
  const whoPlat = new Map<string, Plat>();
  for (const e of evs) {
    const who = String(e.did || e.uid || e.sid || '');
    if (!who) continue;
    const p: Plat = e.plat === 'ait' ? 'app' : 'web';
    if (!whoPlat.has(who)) whoPlat.set(who, p);
    if (!firstSrc.has(who) || (firstSrc.get(who) === '출처 없음' && e.utm?.source)) firstSrc.set(who, srcOf(e.utm));
    put(p, 'visitors', who);
    const props = e.props || {};
    switch (e.name) {
      case 'signup': put(p, 'newDevices', who); break;
      case 'app_open': put(p, 'opens', who); break;
      case 'profile_created': put(p, 'inputs', who); break;
      case 'content_result': {
        put(p, 'results', who);
        const t = String(props.type || 'etc');
        const k = `r:${t}:${p}`;
        if (!(contentPeople[k] ??= new Set()).has(who)) { contentPeople[k].add(who); crow(t, p).results += 1; }
        break;
      }
      case 'content_open': {
        const t = String(props.type || 'etc');
        const k = `o:${t}:${p}`;
        if (!(contentPeople[k] ??= new Set()).has(who)) { contentPeople[k].add(who); crow(t, p).opens += 1; }
        break;
      }
      case 'content_purchase': {
        const r = crow(String(props.type || 'etc'), p);
        r.purchases += 1; r.un += Number(props.amount) || 0;
        break;
      }
      case 'insufficient_balance': put(p, 'payTry', who); break;
      case 'charge_open': put(p, 'chargeOpen', who); break;
      case 'charge_login_gate': put(p, 'loginGate', who); break;
      case 'login_success': put(p, 'logins', who); break;
      case 'share_complete': put(p, 'shares', who); break;
      case 'noti_agree': if (!/denied|rejected/i.test(String(props.result || ''))) put(p, 'notiAgree', who); break;
      default:
    }
  }
  for (const p of ['app', 'web'] as Plat[]) {
    for (const [k, s] of Object.entries(sets[p])) (S[p] as any)[k] = s.size;
  }

  // 유입: 기기의 첫 출처별 (결제와 매출은 그날 charge_complete 이벤트로 출처에 붙인다 — 장부엔 출처가 없다)
  const channels: DayStats['channels'] = {};
  const chSets: Record<string, Record<string, Set<string>>> = {};
  for (const e of evs) {
    const who = String(e.did || e.uid || e.sid || '');
    if (!who) continue;
    const src = firstSrc.get(who) || '출처 없음';
    const row = (channels[src] ??= { plat: whoPlat.get(who) || 'web', visitors: 0, inputs: 0, results: 0, payers: 0, revenue: 0 });
    const cs = (chSets[src] ??= {});
    (cs.visitors ??= new Set()).add(who);
    if (e.name === 'profile_created') (cs.inputs ??= new Set()).add(who);
    if (e.name === 'content_result') (cs.results ??= new Set()).add(who);
    if (e.name === 'charge_complete') { (cs.payers ??= new Set()).add(who); row.revenue += Number(e.props?.amount) || 0; }
  }
  for (const [src, cs] of Object.entries(chSets)) {
    const row = channels[src];
    row.visitors = cs.visitors?.size || 0; row.inputs = cs.inputs?.size || 0;
    row.results = cs.results?.size || 0; row.payers = cs.payers?.size || 0;
  }

  // 결제 장부
  const packages: Record<string, number> = {};
  const payerSets: Record<Plat, Set<string>> = { app: new Set(), web: new Set() };
  for (const o of ledger.orders) {
    if (o.day === day) {
      S[o.plat].orders += 1;
      S[o.plat].revenue += o.amount;
      payerSets[o.plat].add(o.uid);
      const key = `${o.plat === 'app' ? '앱' : '웹'} ${o.amount}`;
      packages[key] = (packages[key] || 0) + 1;
    }
    if (o.refundedDay === day) { S[o.plat].refunds += 1; S[o.plat].refundAmount += o.refundAmount; }
  }
  for (const p of ['app', 'web'] as Plat[]) {
    S[p].payers = payerSets[p].size;
    S[p].newPayers = [...payerSets[p]].filter((u) => ledger.firstPayDay.get(u) === day).length;
  }

  // AI
  const ai: DayStats['ai'] = { calls: 0, fail: 0, costKrw: 0, byType: {} };
  for (const d of aiSnap.docs) {
    const u = d.data() as any;
    const t = String(u.type || 'etc');
    const krw = aiCostKrw(u);
    const slot = (ai.byType[t] ??= { calls: 0, fail: 0, costKrw: 0, ms: 0 });
    slot.calls += 1; slot.costKrw += krw; slot.ms += Number(u.ms) || 0;
    if (u.ok === false) { slot.fail += 1; ai.fail += 1; }
    ai.calls += 1; ai.costKrw += krw;
  }
  for (const s of Object.values(ai.byType)) { s.ms = s.calls ? Math.round(s.ms / s.calls) : 0; s.costKrw = Math.round(s.costKrw); }
  ai.costKrw = Math.round(ai.costKrw);
  const aiFailures: DayStats['aiFailures'] = { total: 0, byType: {} };
  for (const d of failSnap.docs) {
    const f = d.data() as any;
    const t = String(f.type || 'etc');
    aiFailures.total += 1; aiFailures.byType[t] = (aiFailures.byType[t] || 0) + 1;
  }

  // CS 지급 — 지급 기록(compensationLog)이 있으면 그것으로, 없던 시절은 장부의 마지막 지급 날로
  const cs = { granted: 0, grantedUn: 0, claimed: 0, claimedUn: 0 };
  const logToday = ledger.compLog.filter((l) => l.day === day);
  if (ledger.compLog.length > 0 && day >= (ledger.compLog.map((l) => l.day).sort()[0] || '9999')) {
    cs.granted = logToday.length; cs.grantedUn = logToday.reduce((s, l) => s + l.amount, 0);
  } else {
    const g = ledger.comps.filter((c) => c.createdDay === day);
    cs.granted = g.length; cs.grantedUn = g.reduce((s, c) => s + c.amount, 0);
  }
  const cl = ledger.comps.filter((c) => c.claimedDay === day);
  cs.claimed = cl.length; cs.claimedUn = cl.reduce((s, c) => s + c.amount, 0);

  // 이벤트별 건수
  const events: DayStats['events'] = {};
  for (const e of evs) {
    const p: Plat = e.plat === 'ait' ? 'app' : 'web';
    const n = String(e.name || '?').slice(0, 40);
    (events[n] ??= { app: 0, web: 0 })[p] += 1;
  }

  // 재방문: 그날 처음 온 기기(signup) → 다음 날, 그 뒤 7일 안
  const today = kstToday();
  const cohort: Record<Plat, Set<string>> = { app: new Set(), web: new Set() };
  for (const e of evs) if (e.name === 'signup') { const who = String(e.did || e.uid || e.sid || ''); if (who) cohort[e.plat === 'ait' ? 'app' : 'web'].add(who); }
  const retention: DayStats['retention'] = { app: { cohort: cohort.app.size, d1: null, w1: null }, web: { cohort: cohort.web.size, d1: null, w1: null } };
  if (cohort.app.size + cohort.web.size > 0) {
    const next = addDays(day, 1);
    if (next < today) {
      const seen1 = await whoOfDay(next, ledger);
      for (const p of ['app', 'web'] as Plat[]) retention[p].d1 = [...cohort[p]].filter((w) => seen1.has(w)).length;
    }
    if (addDays(day, 7) < today) {
      const weekSets = await Promise.all([1, 2, 3, 4, 5, 6, 7].map((i) => whoOfDay(addDays(day, i), ledger)));
      for (const p of ['app', 'web'] as Plat[]) retention[p].w1 = [...cohort[p]].filter((w) => weekSets.some((m) => m.has(w))).length;
    }
  }

  const alerts = { total: 0, byKind: {} as Record<string, number> };
  for (const a of ledger.alerts) if (a.day === day) { alerts.total += 1; alerts.byKind[a.kind] = (alerts.byKind[a.kind] || 0) + 1; }

  return {
    day, v: STATS_VERSION, builtAt: Date.now(), ...(day === kstToday() ? { partial: true } : {}),
    app: S.app, web: S.web, content, channels, ai, aiFailures, cs, alerts, packages, events, retention,
  };
}

/** 저장된 요약을 다시 만들어야 하나: 옛 계산 판이거나, 재방문 칸이 비었는데 이제 채울 수 있게 된 날 */
function stale(d: any, day: string): boolean {
  if (!d || (d.v || 0) < STATS_VERSION) return true;
  const today = kstToday();
  const r = d.retention || {};
  const has = (r.app?.cohort || 0) + (r.web?.cohort || 0) > 0;
  if (has && addDays(day, 7) < today && (r.app?.w1 == null || r.web?.w1 == null)) return true;
  if (has && addDays(day, 1) < today && (r.app?.d1 == null || r.web?.d1 == null)) return true;
  return false;
}

async function buildAndSave(days: string[]): Promise<number> {
  const ledger = await loadLedger();
  const db = admin.firestore();
  let n = 0;
  for (const day of days) {
    const st = await computeDay(day, ledger);
    if (day === kstToday()) continue; // 오늘 것은 저장하지 않는다(늘 바로 계산)
    await db.collection('statsDaily').doc(day).set(st);
    n += 1;
  }
  return n;
}

/** 매일 0시 20분(한국) — 어제와 그제를 다시 만든다 */
export const buildDailyStats = onSchedule(
  { schedule: '20 0 * * *', timeZone: 'Asia/Seoul', timeoutSeconds: 540, memory: '1GiB', retryCount: 1 },
  async () => {
    const t = kstToday();
    // 어제와 그제는 늘 다시, 그 전 120일 중 요약이 없는 날은 한 번에 40일까지 채운다(처음 켰을 때 밀린 날)
    const db = admin.firestore();
    const back: string[] = [];
    for (let i = 3; i <= 120; i += 1) back.push(addDays(t, -i));
    const snaps = await db.getAll(...back.map((d) => db.collection('statsDaily').doc(d)));
    const missing = back.filter((d, i) => !snaps[i].exists || stale(snaps[i].data() as any, d)).slice(0, 40);
    // 8일 전은 '7일 안 재방문'이 이제 확정된다 → 다시 만든다
    const n = await buildAndSave([...new Set([...missing.reverse(), addDays(t, -8), addDays(t, -2), addDays(t, -1)])]);
    console.info(`[buildDailyStats] ${n}일 저장 (밀린 날 ${missing.length})`);
  },
);

/** 매월 1일 4시 50분 — 400일 지난 원본 analytics 를 지운다(요약은 남는다) */
export const pruneRawAnalytics = onSchedule(
  { schedule: '50 4 1 * *', timeZone: 'Asia/Seoul', timeoutSeconds: 540, memory: '512MiB', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    const cutoff = addDays(kstToday(), -RAW_KEEP_DAYS);
    let removed = 0;
    for (let round = 0; round < 50; round += 1) {
      const snap = await db.collection('analytics').where('day', '<', cutoff).limit(400).select().get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      removed += snap.size;
    }
    console.info(`[pruneRawAnalytics] ${cutoff} 이전 ${removed}건 삭제`);
  },
);

/**
 * adminStats — 관리자 화면용 (오너 전용)
 *   { action: 'range', days }       → 지난 날들은 저장된 요약(없으면 만들어 저장), 오늘은 바로 계산
 *   { action: 'rebuild', from, to } → 그 사이 날들을 다시 만들어 저장 (최대 120일)
 *   { action: 'alerts' }            → 최근 서버 경보 40건, AI 실패 20건
 */
export const adminStats = onCall(
  { timeoutSeconds: 540, memory: '1GiB', cors: true },
  async (request) => {
    assertOwner(request);
    const db = admin.firestore();
    const action = String(request.data?.action || 'range');

    if (action === 'alerts') {
      const [al, af] = await Promise.all([
        db.collection('backofficeAlerts').get(),
        db.collection('aiFailures').orderBy('day', 'desc').limit(20).get().catch(() => null),
      ]);
      const alerts = al.docs.map((d) => {
        const a = d.data() as any;
        const at = tsMs(a.at) || tsMs(a.createdAt) || tsMs(a.ts);
        const { at: _a, createdAt: _c, ts: _t, ...rest } = a;
        return { id: d.id, at, kind: String(a.kind || a.type || 'etc'), detail: JSON.stringify(rest).slice(0, 300) };
      }).sort((x, y) => y.at - x.at).slice(0, 40);
      const failures = (af?.docs || []).map((d) => {
        const f = d.data() as any;
        return { day: f.day, type: f.type, stage: f.stage, message: String(f.message || '').slice(0, 200), uid: f.uid || '' };
      });
      return { alerts, failures };
    }

    if (action === 'rebuild') {
      const from = String(request.data?.from || '');
      const to = String(request.data?.to || addDays(kstToday(), -1));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new HttpsError('invalid-argument', '날짜 형식(YYYY-MM-DD)을 확인해 주세요');
      const days: string[] = [];
      for (let d = from; d <= to && days.length < 120; d = addDays(d, 1)) days.push(d);
      const n = await buildAndSave(days);
      return { ok: true, saved: n, from: days[0], to: days[days.length - 1] };
    }

    // range
    const want = Math.max(1, Math.min(120, Number(request.data?.days) || 30));
    const today = kstToday();
    const days: string[] = [];
    for (let i = want - 1; i >= 0; i -= 1) days.push(addDays(today, -i));
    const past = days.filter((d) => d !== today);
    const refs = past.map((d) => db.collection('statsDaily').doc(d));
    const snaps = refs.length ? await db.getAll(...refs) : [];
    const have = new Map<string, DayStats>();
    snaps.forEach((s) => { if (s.exists) have.set(s.id, s.data() as DayStats); });
    const missing = past.filter((d) => !have.has(d) || stale(have.get(d), d));
    const ledger = await loadLedger();
    for (const d of missing) {
      const st = await computeDay(d, ledger);
      await db.collection('statsDaily').doc(d).set(st);
      have.set(d, st);
    }
    const todayStats = await computeDay(today, ledger);
    return { days: [...past.map((d) => have.get(d)!), todayStats], builtNow: missing.length };
  },
);
