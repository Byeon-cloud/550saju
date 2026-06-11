// 어드민 대시보드 — 데이터 fetch + 기간별 집계 훅 (2026-06-10)
//   기간(7/14/30일) + 직전 동일 기간을 한 번에 fetch → 모든 KPI 증감 델타 산출.
//   ⚠️ 읽기 전용 — 오너 게이팅·firestore.rules 보안 모델 변경 없음. 쿼리 패턴(day >= X, orderBy day)도 기존과 동일 (신규 인덱스 불필요).
import { useCallback, useEffect, useState } from 'react';
import { db } from '@/services/auth/firebase';
import {
  collection, getDocs, query, where, orderBy, limit, collectionGroup,
} from 'firebase/firestore';

export type RangeDays = 7 | 14 | 30;

// ─── AI 토큰 단가 (어드민 추정용 상수 · 캐시 할인 미반영) ───
export const USD_KRW = 1400;
export const TOKEN_PRICE_PER_M: Record<string, { in: number; out: number }> = {
  opus: { in: 5, out: 25 },
  sonnet: { in: 3, out: 15 },
};

// ─── KST 날짜 유틸 ───
export function kstDayFromMs(ms: number): string {
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function kstDay(offset = 0): string {
  return kstDayFromMs(Date.now() + offset * 86400000);
}

// ─── 타입 ───
export interface RawEvent {
  day: string; name: string; uid: string; sid: string; props: any; utm?: any;
  did?: string;                                    // 기기 영속 ID (2026-06-12)
  demo?: { g?: string; ab?: string };              // 성별·연령대 (본인 프로필 파생)
}

export interface AiTypeAgg {
  done: number; errors: number; totalMs: number; maxMs: number;
  modes: Record<string, { done: number; errors: number; totalMs: number }>;
}

export interface AiUsageAgg {
  calls: number; inTok: number; outTok: number; costKrw: number; ok: number; fail: number;
}

export interface PeriodAgg {
  days: string[];                                  // 기간 내 KST day 배열 (오름차순)
  // 매출 (payments confirmed)
  revenue: number;
  revenueByDay: number[];
  packageDist: Record<string, number>;             // 충전 금액(₩) → 건수
  // 충전 이벤트
  chargeOpen: number;
  chargeComplete: number;
  chargeAmount: number;                            // charge_complete props.amount 합 (₩)
  payingUsers: number;
  repeatPayingUsers: number;                       // 충전 2회+
  payingUserKeys: string[];                        // 신규 결제유저 산출용 (cur vs prev 비교)
  // 방문
  pageViews: number;
  visitors: number;                                // 고유 uid|sid
  appOpens: number;
  dauByDay: number[];
  dauAvg: number;
  // 콘텐츠
  contentOpen: Record<string, number>;
  contentResult: Record<string, number>;
  contentPurchase: Record<string, { count: number; un: number }>; // key: type 또는 topic:xxx
  contentOpenTotal: number;
  contentResultTotal: number;
  contentPurchaseTotal: number;
  contentPurchaseUn: number;                       // 운 차감 합계
  topicSelect: Record<string, number>;
  // 공유·리워드
  shareClicks: number;
  shareByDay: number[];
  rewardByKind: Record<string, { count: number; amount: number }>;
  rewardKindByDay: Record<string, number[]>;       // kind → 일별 건수
  rewardTotal: number;
  // 광고
  adStats: { impression: number; click: number; nofill: number; fail: number };
  // AI 품질 (analytics ai_done/ai_error)
  ai: Record<string, AiTypeAgg>;
  // AI 원가 (aiUsage 컬렉션)
  aiUsage: Record<string, AiUsageAgg>;             // type → 집계
  aiUsageTotal: { calls: number; inTok: number; outTok: number; costKrw: number };
  // 유저 행동
  visitFreq: { once: number; few: number; many: number }; // 1회 / 2-3회 / 4회+ (방문일수 기준)
  retention: { d1Rate: number | null; d7Rate: number | null; cohortD1: number; cohortD7: number };
  // 유입
  utm: Record<string, { visits: number; contentOpens: number; charges: number }>;
  // CTA 클릭 (2026-06-12 · 전역 위임 수집)
  cta: Record<string, number>;                     // label → 클릭 수
  ctaTotal: number;
  // 인구통계 (2026-06-12 · 본인 프로필 파생 — 고유 방문자 기준)
  demoGender: Record<string, number>;              // 'M'|'F' → 고유 유저 수
  demoAge: Record<string, number>;                 // '20대' 등 → 고유 유저 수
  payingGender: Record<string, number>;            // 결제 유저의 성별 분포
}

export interface AdminData {
  totalUsers: number;
  totalRevenue: number;                            // 누적 (전 기간)
  todayRevenue: number;
  reportsByType: Record<string, number>;           // 콘텐츠 생성 누적
  cur: PeriodAgg;
  prev: PeriodAgg;
  rawEvents: RawEvent[];                           // 현 기간 원본 이벤트 (CSV)
  fetchedAt: Date;
}

// ─── 빈 집계 버킷 ───
function emptyAgg(days: string[]): PeriodAgg {
  return {
    days,
    revenue: 0, revenueByDay: days.map(() => 0), packageDist: {},
    chargeOpen: 0, chargeComplete: 0, chargeAmount: 0, payingUsers: 0, repeatPayingUsers: 0, payingUserKeys: [],
    pageViews: 0, visitors: 0, appOpens: 0, dauByDay: days.map(() => 0), dauAvg: 0,
    contentOpen: {}, contentResult: {}, contentPurchase: {},
    contentOpenTotal: 0, contentResultTotal: 0, contentPurchaseTotal: 0, contentPurchaseUn: 0,
    topicSelect: {},
    shareClicks: 0, shareByDay: days.map(() => 0),
    rewardByKind: {}, rewardKindByDay: {}, rewardTotal: 0,
    adStats: { impression: 0, click: 0, nofill: 0, fail: 0 },
    ai: {},
    aiUsage: {}, aiUsageTotal: { calls: 0, inTok: 0, outTok: 0, costKrw: 0 },
    visitFreq: { once: 0, few: 0, many: 0 },
    retention: { d1Rate: null, d7Rate: null, cohortD1: 0, cohortD7: 0 },
    utm: {},
    cta: {}, ctaTotal: 0,
    demoGender: {}, demoAge: {}, payingGender: {},
  };
}

function addDays(day: string, n: number): string {
  const dt = new Date(day + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** payments 문서의 결제 day (KST) — confirmedAt 우선, createdAt 폴백. Timestamp/string/number 모두 처리 */
function paymentDay(p: any): string {
  const v = p.confirmedAt ?? p.createdAt;
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (typeof v?.toDate === 'function') return kstDayFromMs(v.toDate().getTime());
  if (typeof v === 'number') return kstDayFromMs(v);
  if (typeof v?.seconds === 'number') return kstDayFromMs(v.seconds * 1000);
  return '';
}

/** analytics 이벤트 1건을 해당 기간 버킷에 누적 */
function accumulateEvent(agg: PeriodAgg, e: RawEvent, dayIdx: number, scratch: PeriodScratch): void {
  const t = e.props?.type as string | undefined;
  // 2026-06-12 — did(기기 영속) 우선: 익명 유저가 세션마다 새 사람으로 집계되던 것 fix
  const userKey = e.uid || e.did || e.sid || 'anon';
  const dauKey = e.did || e.uid || e.sid || 'anon';
  const utmSource = (e.utm?.source as string | undefined) || 'direct';
  const utmSlot = (agg.utm[utmSource] ??= { visits: 0, contentOpens: 0, charges: 0 });

  // 인구통계 — 어떤 이벤트든 demo 첨부돼 있으면 최신값 기록 (고유 유저 기준 마감 시 집계)
  if (e.demo && (e.demo.g || e.demo.ab)) scratch.demoByUser[userKey] = e.demo;

  switch (e.name) {
    case 'page_view': {
      agg.pageViews += 1;
      scratch.visitorSet.add(userKey);
      (scratch.dauSets[dayIdx] ??= new Set()).add(dauKey);
      (scratch.visitDays[userKey] ??= new Set()).add(e.day);
      (scratch.utmVisitSets[utmSource] ??= new Set()).add(dauKey);
      break;
    }
    case 'cta_click': {
      const label = (e.props?.label as string | undefined) || '';
      if (label) { agg.cta[label] = (agg.cta[label] ?? 0) + 1; agg.ctaTotal += 1; }
      break;
    }
    case 'app_open': agg.appOpens += 1; break;
    case 'content_open':
      if (t) { agg.contentOpen[t] = (agg.contentOpen[t] ?? 0) + 1; agg.contentOpenTotal += 1; utmSlot.contentOpens += 1; }
      break;
    case 'content_result':
      if (t) { agg.contentResult[t] = (agg.contentResult[t] ?? 0) + 1; agg.contentResultTotal += 1; }
      break;
    case 'content_purchase': {
      if (!t) break;
      const key = t === 'topic' && e.props?.topic ? `topic:${e.props.topic}` : t;
      const slot = (agg.contentPurchase[key] ??= { count: 0, un: 0 });
      const un = Number(e.props?.amount) || 0;
      slot.count += 1; slot.un += un;
      agg.contentPurchaseTotal += 1; agg.contentPurchaseUn += un;
      break;
    }
    case 'charge_open': agg.chargeOpen += 1; break;
    case 'charge_complete': {
      agg.chargeComplete += 1;
      agg.chargeAmount += Number(e.props?.amount) || 0;
      scratch.chargeByUser[userKey] = (scratch.chargeByUser[userKey] ?? 0) + 1;
      utmSlot.charges += 1;
      break;
    }
    case 'topic_select': {
      const topic = e.props?.topic as string | undefined;
      if (topic) agg.topicSelect[topic] = (agg.topicSelect[topic] ?? 0) + 1;
      break;
    }
    case 'share_click': {
      agg.shareClicks += 1;
      if (dayIdx >= 0) agg.shareByDay[dayIdx] += 1;
      break;
    }
    case 'reward_earned': {
      const kind = (e.props?.kind as string | undefined) || 'unknown';
      const slot = (agg.rewardByKind[kind] ??= { count: 0, amount: 0 });
      slot.count += 1;
      slot.amount += Number(e.props?.amount) || 0;
      agg.rewardTotal += 1;
      if (dayIdx >= 0) {
        (agg.rewardKindByDay[kind] ??= agg.days.map(() => 0))[dayIdx] += 1;
      }
      break;
    }
    case 'ad_impression': agg.adStats.impression += 1; break;
    case 'ad_click': agg.adStats.click += 1; break;
    case 'ad_nofill': agg.adStats.nofill += 1; break;
    case 'ad_fail': agg.adStats.fail += 1; break;
    case 'ai_done': {
      if (!t) break;
      const slot = (agg.ai[t] ??= { done: 0, errors: 0, totalMs: 0, maxMs: 0, modes: {} });
      const ms = Number(e.props?.ms) || 0;
      slot.done += 1; slot.totalMs += ms; if (ms > slot.maxMs) slot.maxMs = ms;
      const mode = (e.props?.mode as string | undefined) || 'callable';
      const mslot = (slot.modes[mode] ??= { done: 0, errors: 0, totalMs: 0 });
      mslot.done += 1; mslot.totalMs += ms;
      break;
    }
    case 'ai_error': {
      if (!t) break;
      const slot = (agg.ai[t] ??= { done: 0, errors: 0, totalMs: 0, maxMs: 0, modes: {} });
      slot.errors += 1;
      const mode = (e.props?.mode as string | undefined) || 'callable';
      const mslot = (slot.modes[mode] ??= { done: 0, errors: 0, totalMs: 0 });
      mslot.errors += 1;
      break;
    }
  }
}

interface PeriodScratch {
  visitorSet: Set<string>;
  dauSets: Record<number, Set<string>>;
  visitDays: Record<string, Set<string>>;
  chargeByUser: Record<string, number>;
  utmVisitSets: Record<string, Set<string>>;
  demoByUser: Record<string, { g?: string; ab?: string }>;  // 2026-06-12 인구통계
}

/** scratch → 최종 집계 마감 (방문자·DAU·리텐션·재구매·방문빈도·utm visits) */
function finalizeAgg(agg: PeriodAgg, scratch: PeriodScratch): void {
  agg.visitors = scratch.visitorSet.size;
  agg.dauByDay = agg.days.map((_, i) => scratch.dauSets[i]?.size ?? 0);
  const activeDays = agg.dauByDay.filter((n) => n > 0);
  agg.dauAvg = activeDays.length > 0
    ? Math.round(agg.dauByDay.reduce((a, b) => a + b, 0) / agg.days.length)
    : 0;

  // 방문빈도 분포 (기간 내 방문 일수 기준)
  Object.values(scratch.visitDays).forEach((days) => {
    const n = days.size;
    if (n <= 1) agg.visitFreq.once += 1;
    else if (n <= 3) agg.visitFreq.few += 1;
    else agg.visitFreq.many += 1;
  });

  // 리텐션 근사 — 기간 윈도우 내 첫 방문일 기준 D1/D7 재방문
  const lastDay = agg.days[agg.days.length - 1] || kstDay();
  let d1E = 0, d1R = 0, d7E = 0, d7R = 0;
  Object.values(scratch.visitDays).forEach((days) => {
    const first = Array.from(days).sort()[0];
    if (!first) return;
    if (addDays(first, 1) <= lastDay) {
      d1E += 1;
      if (days.has(addDays(first, 1))) d1R += 1;
    }
    if (addDays(first, 7) <= lastDay) {
      d7E += 1;
      if (days.has(addDays(first, 7))) d7R += 1;
    }
  });
  agg.retention = {
    d1Rate: d1E > 0 ? Math.round((d1R / d1E) * 100) : null,
    d7Rate: d7E > 0 ? Math.round((d7R / d7E) * 100) : null,
    cohortD1: d1E, cohortD7: d7E,
  };

  // 재구매
  agg.payingUserKeys = Object.keys(scratch.chargeByUser);
  agg.payingUsers = agg.payingUserKeys.length;
  agg.repeatPayingUsers = Object.values(scratch.chargeByUser).filter((n) => n >= 2).length;

  // utm visits
  Object.entries(scratch.utmVisitSets).forEach(([source, set]) => {
    (agg.utm[source] ??= { visits: 0, contentOpens: 0, charges: 0 }).visits = set.size;
  });

  // 인구통계 마감 (2026-06-12) — 고유 유저 기준 성별·연령 분포 + 결제 유저 성별
  Object.entries(scratch.demoByUser).forEach(([userKey, demo]) => {
    if (demo.g) agg.demoGender[demo.g] = (agg.demoGender[demo.g] ?? 0) + 1;
    if (demo.ab) agg.demoAge[demo.ab] = (agg.demoAge[demo.ab] ?? 0) + 1;
    if (demo.g && scratch.chargeByUser[userKey]) {
      agg.payingGender[demo.g] = (agg.payingGender[demo.g] ?? 0) + 1;
    }
  });
}

/** aiUsage 1건 누적 */
function accumulateUsage(agg: PeriodAgg, u: any): void {
  const type = String(u.type || 'unknown');
  const model = String(u.model || '');
  const i = Number(u.inputTokens) || 0;
  const o = Number(u.outputTokens) || 0;
  const price = model.includes('opus') ? TOKEN_PRICE_PER_M.opus
    : model.includes('sonnet') ? TOKEN_PRICE_PER_M.sonnet
    : null; // Gemini 등 — 무시 가능 수준
  const krw = price ? ((i * price.in + o * price.out) / 1_000_000) * USD_KRW : 0;
  const slot = (agg.aiUsage[type] ??= { calls: 0, inTok: 0, outTok: 0, costKrw: 0, ok: 0, fail: 0 });
  slot.calls += 1; slot.inTok += i; slot.outTok += o; slot.costKrw += krw;
  if (u.ok === false) slot.fail += 1; else slot.ok += 1;
  agg.aiUsageTotal.calls += 1;
  agg.aiUsageTotal.inTok += i;
  agg.aiUsageTotal.outTok += o;
  agg.aiUsageTotal.costKrw += krw;
}

// ─────────────────────────────────────────────────────────
// 훅 — 기간 선택 시 현 기간 + 직전 동일 기간 동시 집계
// ─────────────────────────────────────────────────────────
export function useAdminData(range: RangeDays, enabled: boolean) {
  const [data, setData] = useState<AdminData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const today = kstDay();
        const curDays = Array.from({ length: range }, (_, i) => kstDay(-(range - 1) + i));
        const prevDays = Array.from({ length: range }, (_, i) => kstDay(-(2 * range - 1) + i));
        const fetchStart = prevDays[0];
        const curStart = curDays[0];

        const cur = emptyAgg(curDays);
        const prev = emptyAgg(prevDays);
        const curScratch: PeriodScratch = { visitorSet: new Set(), dauSets: {}, visitDays: {}, chargeByUser: {}, utmVisitSets: {}, demoByUser: {} };
        const prevScratch: PeriodScratch = { visitorSet: new Set(), dauSets: {}, visitDays: {}, chargeByUser: {}, utmVisitSets: {}, demoByUser: {} };
        const rawEvents: RawEvent[] = [];

        // 1) analytics — 현+전 기간 (최대 60일) 한 번에 fetch
        const evSnap = await getDocs(
          query(collection(db, 'analytics'), where('day', '>=', fetchStart), orderBy('day'), limit(10000)),
        );
        evSnap.forEach((doc) => {
          const e = doc.data() as any;
          const ev: RawEvent = {
            day: e.day || '', name: e.name || '', uid: e.uid || '', sid: e.sid || '',
            props: e.props, utm: e.utm, did: e.did || '', demo: e.demo,
          };
          if (ev.day >= curStart) {
            const idx = curDays.indexOf(ev.day);
            accumulateEvent(cur, ev, idx, curScratch);
            rawEvents.push(ev);
          } else if (ev.day >= fetchStart) {
            const idx = prevDays.indexOf(ev.day);
            accumulateEvent(prev, ev, idx, prevScratch);
          }
        });
        finalizeAgg(cur, curScratch);
        finalizeAgg(prev, prevScratch);

        // 2) payments — confirmed 누적 + 기간별 (collectionGroup 전체 fetch — 저트래픽 초기 운영 전제)
        let totalRevenue = 0, todayRevenue = 0;
        try {
          const paySnap = await getDocs(collectionGroup(db, 'payments'));
          paySnap.forEach((doc) => {
            const p = doc.data() as any;
            const amt = Number(p.amount) || 0;
            const isConfirmed = p.status === 'confirmed' || p.status === undefined;
            const isCharge = (p.type ?? 'charge') !== 'use' && (p.type ?? 'charge') !== 'refund';
            if (!isConfirmed || !isCharge || amt <= 0) return;
            totalRevenue += amt;
            const pday = paymentDay(p);
            if (pday === today) todayRevenue += amt;
            const ci = curDays.indexOf(pday);
            if (ci >= 0) {
              cur.revenue += amt;
              cur.revenueByDay[ci] += amt;
              cur.packageDist[String(amt)] = (cur.packageDist[String(amt)] ?? 0) + 1;
            } else {
              const pi = prevDays.indexOf(pday);
              if (pi >= 0) {
                prev.revenue += amt;
                prev.revenueByDay[pi] += amt;
                prev.packageDist[String(amt)] = (prev.packageDist[String(amt)] ?? 0) + 1;
              }
            }
          });
        } catch { /* collectionGroup 인덱스 필요 시 0 — noop */ }

        // 3) aiUsage — 현+전 기간 토큰 원가
        try {
          const usageSnap = await getDocs(
            query(collection(db, 'aiUsage'), where('day', '>=', fetchStart), orderBy('day'), limit(10000)),
          );
          usageSnap.forEach((doc) => {
            const u = doc.data() as any;
            const uday = String(u.day || '');
            if (uday >= curStart) accumulateUsage(cur, u);
            else if (uday >= fetchStart) accumulateUsage(prev, u);
          });
        } catch { /* aiUsage 미배포/권한 전 — noop */ }

        // 4) reports 누적 (콘텐츠 생성)
        const reportsByType: Record<string, number> = {};
        try {
          const repSnap = await getDocs(collectionGroup(db, 'reports'));
          repSnap.forEach((doc) => {
            const r = doc.data() as any;
            const t = r.contentType || 'report';
            reportsByType[t] = (reportsByType[t] ?? 0) + 1;
          });
        } catch { /* noop */ }

        // 5) 유저 수
        let totalUsers = 0;
        try {
          const uSnap = await getDocs(collection(db, 'users'));
          totalUsers = uSnap.size;
        } catch { /* noop */ }

        if (!cancelled) {
          setData({ totalUsers, totalRevenue, todayRevenue, reportsByType, cur, prev, rawEvents, fetchedAt: new Date() });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '데이터를 불러오지 못했어요');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, range, reloadKey]);

  return { data, busy, error, reload };
}
