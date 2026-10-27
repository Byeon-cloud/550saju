/**
 * 재방문과 단골, 웹 홈 화면 앱 (2026-10-27, 관리자 '재방문' 판, 오너 전용)
 *
 *   오너: '많이 접속하는 사람, 재접속, 웹을 홈 화면 앱으로 들고 있는 사람까지 보자'.
 *   하루 요약(statsDaily)은 그날 숫자만 있어 '며칠 왔나', '다시 왔나'를 기간으로 볼 수 없다.
 *   그래서 하루마다 그날 온 기기 명단을 따로 둔다: statsDevices/{날짜} = { v, devices: { 기기: 줄 }, pwa: { 이벤트: 건수 } }.
 *   기기 = did(기기 영속 id) → 없으면 uid → sid (stats.ts computeDay 와 같은 규칙), 오너 기기(internal)는 뺀다.
 *   명단은 매일 밤 buildDailyStats 가 어제와 그제 것을 만들고, 이 함수가 비어 있는 날을 한 번에 20일까지 채운다.
 *   결제는 이벤트가 아니라 결제 장부(stats.ts loadLedger, 오너 시험 결제 제외)를 uid 로 붙인다.
 */
import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { assertOwner } from './owner';
import { kstToday, addDays, loadLedger, type Ledger } from './stats';

const ROSTER_V = 1;
type P = 'app' | 'web';

/** 명단 한 줄 (짧은 이름으로 문서 크기를 줄인다) */
export interface RosterRow {
  p: 'a' | 'w';
  /** 그날 이벤트 수 */
  n: number;
  /** 웹 홈 화면 앱(disp standalone)으로 연 적 있음 */
  st?: 1;
  /** 그날 처음 온 기기(signup) */
  nw?: 1;
  /** 사주 입력 */
  in?: 1;
  /** 결과 받은 수 */
  rs?: number;
  /** 콘텐츠 구매 수 */
  pu?: number;
  /** uid (결제 장부를 붙이려고, 오너 전용 문서). 문서를 줄이려고 그날 충전이나 구매 흐름이 있었거나 결과를 두 번 넘게 받은 기기만 */
  u?: string;
  /** 그날 처음 붙은 유입 출처 */
  src?: string;
}
interface RosterDoc { v: number; devices: Record<string, RosterRow>; pwa: Record<string, number> }

const PWA_KEYS: Record<string, (props: any) => string | null> = {
  a2hs_card_view: () => 'cardView',
  a2hs_card_click: () => 'cardClick',
  a2hs_guide_open: () => 'guideOpen',
  a2hs_prompt_result: (p) => (p?.outcome === 'accepted' ? 'promptAccepted' : p?.outcome === 'installed' ? 'installed' : p?.outcome === 'dismissed' ? 'promptDismissed' : null),
  pwa_open: (p) => (Number(p?.first) === 1 ? 'firstOpen' : 'open'),
};

/** 이날 결제가 있었을 수 있는 기기 (uid 를 남길 기기) */
const MONEY_EVENTS = new Set(['charge_open', 'charge_view', 'pay_sheet_open', 'charge_complete', 'content_purchase', 'insufficient_balance']);

const srcOf = (u: any): string => {
  if (!u || !u.source) return '';
  if (u.source === 'toss_ref') return `토스 ${u.medium || ''}`.trim();
  return String(u.source).slice(0, 30);
};

/** 하루 명단 계산 (원본 analytics 를 그날 것만 읽는다) */
export async function computeRoster(day: string): Promise<RosterDoc> {
  const db = admin.firestore();
  const snap = await db.collection('analytics').where('day', '==', day)
    .select('name', 'uid', 'did', 'sid', 'plat', 'internal', 'disp', 'utm', 'props', 'ts').get();
  const devices: Record<string, RosterRow> = {};
  const pwa: Record<string, number> = {};
  const uidOf = new Map<string, string>();
  const money = new Set<string>();
  for (const d of snap.docs) {
    const e = d.data() as any;
    if (e.internal) continue;
    const who = String(e.did || e.uid || e.sid || '').slice(0, 64);
    if (!who) continue;
    const r = (devices[who] ??= { p: e.plat === 'ait' ? 'a' : 'w', n: 0 });
    r.n += 1;
    if (e.uid && !uidOf.has(who)) uidOf.set(who, String(e.uid));
    if (MONEY_EVENTS.has(e.name)) money.add(who);
    if (!r.src && e.utm?.source) r.src = srcOf(e.utm);
    if (e.disp === 'standalone' && r.p === 'w') r.st = 1;
    switch (e.name) {
      case 'signup': r.nw = 1; break;
      case 'profile_created': r.in = 1; break;
      case 'content_result': r.rs = (r.rs || 0) + 1; break;
      case 'content_purchase': r.pu = (r.pu || 0) + 1; break;
      default: break;
    }
    const k = PWA_KEYS[e.name]?.(e.props);
    if (k) pwa[k] = (pwa[k] || 0) + 1;
  }
  for (const [who, r] of Object.entries(devices)) {
    const u = uidOf.get(who);
    if (u && (money.has(who) || (r.rs || 0) >= 2)) r.u = u;
  }
  return { v: ROSTER_V, devices, pwa };
}

/** 명단 저장 (오늘 것은 저장하지 않는다 — 하루가 끝나지 않았다) */
export async function saveRoster(day: string): Promise<void> {
  if (day >= kstToday()) return;
  const r = await computeRoster(day);
  await admin.firestore().collection('statsDevices').doc(day).set(r);
}

interface Bucket { label: string; min: number; max: number }
const BUCKETS: Bucket[] = [
  { label: '하루', min: 1, max: 1 }, { label: '2일', min: 2, max: 2 }, { label: '3~4일', min: 3, max: 4 },
  { label: '5~7일', min: 5, max: 7 }, { label: '8~14일', min: 8, max: 14 }, { label: '15일 넘게', min: 15, max: 9999 },
];

/**
 * adminLoyalty — { days: 7~60 }
 *   기간 안 기기를 며칠 왔는지로 묶고(결제한 사람, 매출, 사주 입력), 단골 목록, 날짜별 다시 온 기기, 새 기기의 1일, 7일, 14일, 30일 재방문,
 *   웹 홈 화면 앱(그날 홈 화면 앱으로 연 기기, 처음 연 기기, 안내 칸과 설치 창 결과)
 */
export const adminLoyalty = onCall(
  { timeoutSeconds: 540, memory: '1GiB', cors: true },
  async (request) => {
    assertOwner(request);
    const db = admin.firestore();
    const want = Math.max(7, Math.min(60, Number(request.data?.days) || 30));
    const today = kstToday();
    const LOOK = 30; // '다시 왔나'를 보려고 기간 앞 30일도 읽는다
    const allDays: string[] = [];
    for (let i = want + LOOK - 1; i >= 0; i -= 1) allDays.push(addDays(today, -i));
    const winDays = allDays.slice(-want);

    // 1) 명단 읽기, 없는 날 채우기(지난날은 한 번에 20일까지, 오늘은 늘 바로 계산)
    const past = allDays.filter((d) => d !== today);
    const snaps = await db.getAll(...past.map((d) => db.collection('statsDevices').doc(d)));
    const roster = new Map<string, RosterDoc>();
    snaps.forEach((s) => { if (s.exists && (s.data() as RosterDoc).v >= ROSTER_V) roster.set(s.id, s.data() as RosterDoc); });
    const missing = past.filter((d) => !roster.has(d));
    // 기간 안 날부터, 최근 날부터 채운다
    const order = [...missing.filter((d) => winDays.includes(d)).reverse(), ...missing.filter((d) => !winDays.includes(d)).reverse()];
    const fill = order.slice(0, 20);
    for (const d of fill) {
      const r = await computeRoster(d);
      await db.collection('statsDevices').doc(d).set(r);
      roster.set(d, r);
    }
    roster.set(today, await computeRoster(today));
    const stillMissing = past.filter((d) => !roster.has(d));

    // 2) 결제 장부 (uid → 기간 안 결제 금액, 건수, 첫 결제일)
    const ledger: Ledger = await loadLedger();
    const from = winDays[0];
    const payByUid = new Map<string, { amount: number; orders: number }>();
    for (const o of ledger.orders) {
      if (o.day < from || o.day > today) continue;
      const x = payByUid.get(o.uid) || { amount: 0, orders: 0 };
      x.amount += o.amount; x.orders += 1;
      payByUid.set(o.uid, x);
    }

    // 3) 기기별 모으기
    interface Agg { p: P; days: string[]; st: number; first: string; last: string; inputs: number; results: number; purchases: number; uids: Set<string>; src: string; events: number }
    const agg = new Map<string, Agg>();
    const seenBefore = new Map<string, string>(); // 기기 → 처음 본 날(읽은 범위 안)
    const daily: Array<{ day: string; app: { visitors: number; returning: number; fresh: number }; web: { visitors: number; returning: number; fresh: number; standalone: number; standaloneFirst: number }; pwa: Record<string, number> }> = [];
    const standaloneSeen = new Set<string>();
    for (const day of allDays) {
      const r = roster.get(day);
      const inWin = winDays.includes(day);
      const row = { day, app: { visitors: 0, returning: 0, fresh: 0 }, web: { visitors: 0, returning: 0, fresh: 0, standalone: 0, standaloneFirst: 0 }, pwa: r?.pwa || {} };
      for (const [who, d] of Object.entries(r?.devices || {})) {
        const p: P = d.p === 'a' ? 'app' : 'web';
        const before = seenBefore.has(who);
        if (!before) seenBefore.set(who, day);
        if (d.st) {
          if (inWin) { row.web.standalone += 1; if (!standaloneSeen.has(who)) row.web.standaloneFirst += 1; }
          standaloneSeen.add(who);
        }
        if (!inWin) continue;
        const side = row[p];
        side.visitors += 1;
        if (before) side.returning += 1; else side.fresh += 1;
        const a = agg.get(who) || { p, days: [], st: 0, first: day, last: day, inputs: 0, results: 0, purchases: 0, uids: new Set<string>(), src: '', events: 0 };
        a.days.push(day); a.last = day; a.events += d.n;
        if (d.st) a.st += 1;
        if (d.in) a.inputs += 1;
        a.results += d.rs || 0; a.purchases += d.pu || 0;
        if (d.u) a.uids.add(d.u);
        if (!a.src && d.src) a.src = d.src;
        agg.set(who, a);
      }
      if (inWin) daily.push(row);
    }
    const paidOf = (a: Agg) => {
      let amount = 0, orders = 0;
      for (const u of a.uids) { const x = payByUid.get(u); if (x) { amount += x.amount; orders += x.orders; } }
      return { amount, orders };
    };

    // 4) 며칠 왔나 묶음
    const buckets: Record<P, Array<{ label: string; devices: number; inputs: number; payers: number; revenue: number; standalone: number }>> = { app: [], web: [] };
    for (const p of ['app', 'web'] as P[]) {
      for (const b of BUCKETS) {
        const xs = [...agg.values()].filter((a) => a.p === p && a.days.length >= b.min && a.days.length <= b.max);
        let payers = 0, revenue = 0;
        for (const a of xs) { const x = paidOf(a); if (x.amount > 0) { payers += 1; revenue += x.amount; } }
        buckets[p].push({ label: b.label, devices: xs.length, inputs: xs.filter((a) => a.inputs > 0).length, payers, revenue, standalone: xs.filter((a) => a.st > 0).length });
      }
    }

    // 5) 단골 목록 (온 날 많은 순, 같으면 이벤트 많은 순) 40명
    const heavy = [...agg.entries()]
      .sort((x, y) => y[1].days.length - x[1].days.length || y[1].events - x[1].events)
      .slice(0, 40)
      .map(([who, a]) => {
        const x = paidOf(a);
        return {
          id: who.slice(0, 8), uid: [...a.uids][0] || '', p: a.p, days: a.days.length, first: seenBefore.get(who) || a.first, last: a.last,
          standaloneDays: a.st, inputs: a.inputs, results: a.results, purchases: a.purchases, paid: x.amount, orders: x.orders, src: a.src || '',
        };
      });

    // 6) 새 기기 재방문 (기간 안에 처음 온 날 기준, 그 뒤 1일, 7일, 14일, 30일 안에 다시)
    const cohorts: Array<{ day: string; app: Record<string, number | null>; web: Record<string, number | null> }> = [];
    const setCache = new Map<string, Set<string>>();
    const daySet = (d: string) => {
      let x = setCache.get(d);
      if (!x) { x = new Set(Object.keys(roster.get(d)?.devices || {})); setCache.set(d, x); }
      return x;
    };
    for (const day of winDays) {
      if (day === today) continue;
      // 처음 온 기기 = 읽은 범위(기간 앞 30일 포함)에서 이날 처음 보인 기기. 웹에는 signup 이벤트가 없어 nw 를 쓰지 않는다
      const devs = Object.entries(roster.get(day)?.devices || {}).filter(([w]) => seenBefore.get(w) === day);
      const c: { day: string; app: Record<string, number | null>; web: Record<string, number | null> } = { day, app: { size: 0 }, web: { size: 0 } };
      for (const p of ['app', 'web'] as P[]) {
        const ws = devs.filter(([, d]) => (d.p === 'a' ? 'app' : 'web') === p).map(([w]) => w);
        c[p].size = ws.length;
        for (const [k, n] of [['d1', 1], ['d7', 7], ['d14', 14], ['d30', 30]] as const) {
          if (addDays(day, n) >= today) { c[p][k] = null; continue; } // 아직 그만큼 지나지 않음
          const later: Set<string>[] = [];
          for (let i = 1; i <= n; i += 1) later.push(daySet(addDays(day, i)));
          c[p][k] = ws.filter((w) => later.some((s) => s.has(w))).length;
        }
      }
      cohorts.push(c);
    }

    // 7) 요약
    const sum = (p: P) => {
      const xs = [...agg.values()].filter((a) => a.p === p);
      const ret = xs.filter((a) => a.days.length >= 2);
      let payers = 0, revenue = 0, retPayers = 0;
      for (const a of xs) { const x = paidOf(a); if (x.amount > 0) { payers += 1; revenue += x.amount; if (a.days.length >= 2) retPayers += 1; } }
      return { devices: xs.length, returning: ret.length, avgDays: xs.length ? xs.reduce((s, a) => s + a.days.length, 0) / xs.length : 0, payers, revenue, returningPayers: retPayers, standalone: xs.filter((a) => a.st > 0).length };
    };
    const pwaTotals: Record<string, number> = {};
    for (const d of daily) for (const [k, n] of Object.entries(d.pwa)) pwaTotals[k] = (pwaTotals[k] || 0) + n;

    return {
      from, to: today, days: want,
      summary: { app: sum('app'), web: sum('web') },
      buckets, heavy, daily, cohorts, pwa: pwaTotals,
      missing: stillMissing.filter((d) => winDays.includes(d)).length,
      filledNow: fill.length,
    };
  },
);
