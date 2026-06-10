// AdminPage — 오너 전용 대시보드 (2026-05-29)
//   접근: src/services/admin/adminConfig.ts OWNER_UIDS + firestore.rules isOwner()
//   데이터: Firestore analytics(이벤트) + collectionGroup(payments/reports) + users count
//   차트: recharts. 집계는 클라이언트(출시 초기 저트래픽). 향후 Cloud Function 일별 집계로 이관 가능.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { isOwner } from '@/services/admin/adminConfig';
import { db } from '@/services/auth/firebase';
import {
  collection, getDocs, query, where, orderBy, limit, collectionGroup,
} from 'firebase/firestore';

const C = {
  paper: '#F8F5EE', ink: '#1A1A1A', mute: '#7A7269', gold: '#B8965A', goldDeep: '#8C6D3D',
  line: '#E5DFD0', surface: '#FFFFFF',
};
const CONTENT_LABEL: Record<string, string> = {
  daily: '오늘운세', dream: '꿈해몽', topic: '주제분석', premium: '종합사주',
  report: '종합사주', chat: '사주대화',
  deepDream: '심층해몽', daeun: '대운', monthly: '월운', compat: '궁합', tojung: '토정비결',
};
const CONTENT_COLORS = ['#B5441F', '#1A1A1A', '#5A7CA8', '#B8965A', '#6FA08C', '#9C5A8A'];

// 콘텐츠 1건당 추정 AI 원가 (₩) — 토큰 추정 기반. ⚠️ 실제 청구는 Anthropic/GCP 콘솔로 교차검증.
//   Opus(종합/리포트) > Sonnet(주제·확장) > Gemini(무료 오늘운세/꿈해몽).
const AI_UNIT_COST: Record<string, number> = {
  report: 500,   // 종합사주(Opus) — basic/premium 평균
  premium: 550,  // 종합사주 프리미엄
  topic: 180,    // 주제분석(Sonnet)
  daeun: 180, monthly: 180, compat: 200, tojung: 180,
  dream: 80,     // 꿈해몽(무료 Gemini + 심층 Sonnet 평균)
  deepDream: 180,
  daily: 30,     // 오늘운세(Gemini · 일1회 캐시)
  chat: 60,      // 사주대화 1세션 평균
};
const DEFAULT_UNIT_COST = 150;
function estAiCost(reportsByType: Record<string, number>): number {
  return Object.entries(reportsByType).reduce((sum, [t, n]) => sum + n * (AI_UNIT_COST[t] ?? DEFAULT_UNIT_COST), 0);
}

// ─── 대시보드 v2 (2026-06-10) — AI 원가 실측 단가 (상수 · 어드민 추정용) ───
//   Opus in $5/M · out $25/M / Sonnet in $3/M · out $15/M / Gemini 무시 가능 수준.
const USD_KRW = 1400;
const TOKEN_PRICE_PER_M: Record<string, { in: number; out: number }> = {
  opus: { in: 5, out: 25 },
  sonnet: { in: 3, out: 15 },
};

interface Metrics {
  totalUsers: number;
  totalRevenue: number;       // 원
  todayRevenue: number;
  contentOpen: Record<string, number>;   // type → count
  contentResult: Record<string, number>;
  chargeComplete: number;
  dau: { day: string; users: number }[];  // 최근 7일
  reportsByType: Record<string, number>;
  rewardTotal: number;        // 지급 리워드 건수
  dailyRevenue: { day: string; won: number }[]; // 최근 14일 매출 추이
  // ─── 대시보드 v2 (2026-06-10) ───
  purchases: { label: string; count: number; un: number }[]; // content_purchase type(+topic)별
  adStats: { impression: number; click: number; nofill: number; fail: number };
  aiQuality: { type: string; count: number; avgMs: number; errors: number }[];
  retention: { d1Rate: number | null; d7Rate: number | null; cohortD1: number; cohortD7: number };
  repurchase: { rate: number | null; chargedUsers: number; repeatUsers: number };
  utmRows: { source: string; visits: number; charges: number }[];
  aiCost: { inputTokens: number; outputTokens: number; costKrw: number; calls: number } | null;
}

function kstDay(offset = 0): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000 + offset * 86400000);
  return kst.toISOString().slice(0, 10);
}

export function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const owner = isOwner(user?.uid);

  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!owner || loading) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const days7 = Array.from({ length: 7 }, (_, i) => kstDay(-6 + i));
        const today = kstDay();

        // 1) analytics 이벤트 — 최근 14일치 (집계용)
        const evSnap = await getDocs(
          query(collection(db, 'analytics'), where('day', '>=', kstDay(-13)), orderBy('day'), limit(5000)),
        );
        const contentOpen: Record<string, number> = {};
        const contentResult: Record<string, number> = {};
        const dauSet: Record<string, Set<string>> = {};
        let chargeComplete = 0;
        let rewardTotal = 0;
        // ─── 대시보드 v2 집계 버킷 ───
        const purchaseAgg: Record<string, { count: number; un: number }> = {}; // type(+topic) → 건수·운
        const adStats = { impression: 0, click: 0, nofill: 0, fail: 0 };
        const aiAgg: Record<string, { done: number; totalMs: number; errors: number }> = {};
        const visitDays: Record<string, Set<string>> = {};   // uid|sid → 방문 day 집합 (리텐션 근사)
        const chargeByUser: Record<string, number> = {};     // uid|sid → charge_complete 횟수 (재구매)
        const utmVisits: Record<string, Set<string>> = {};   // utm.source → 방문 sid 집합
        const utmCharges: Record<string, number> = {};       // utm.source → charge_complete 건수
        evSnap.forEach((d) => {
          const e = d.data() as any;
          const t = e.props?.type as string | undefined;
          const userKey = e.uid || e.sid || d.id;
          const utmSource = (e.utm?.source as string | undefined) || 'direct';
          if (e.name === 'content_open' && t) contentOpen[t] = (contentOpen[t] ?? 0) + 1;
          if (e.name === 'content_result' && t) contentResult[t] = (contentResult[t] ?? 0) + 1;
          if (e.name === 'charge_complete') {
            chargeComplete += 1;
            chargeByUser[userKey] = (chargeByUser[userKey] ?? 0) + 1;
            utmCharges[utmSource] = (utmCharges[utmSource] ?? 0) + 1;
          }
          if (e.name === 'reward_earned') rewardTotal += 1;
          if (e.name === 'page_view') {
            if (days7.includes(e.day)) (dauSet[e.day] ??= new Set()).add(e.sid || e.uid || d.id);
            if (e.day) (visitDays[userKey] ??= new Set()).add(e.day);
            (utmVisits[utmSource] ??= new Set()).add(e.sid || userKey);
          }
          // C1 — 콘텐츠 구매 (운 차감)
          if (e.name === 'content_purchase' && t) {
            const key = t === 'topic' && e.props?.topic ? `topic:${e.props.topic}` : t;
            const slot = (purchaseAgg[key] ??= { count: 0, un: 0 });
            slot.count += 1;
            slot.un += Number(e.props?.amount) || 0;
          }
          // C4 — 광고
          if (e.name === 'ad_impression') adStats.impression += 1;
          if (e.name === 'ad_click') adStats.click += 1;
          if (e.name === 'ad_nofill') adStats.nofill += 1;
          if (e.name === 'ad_fail') adStats.fail += 1;
          // C3 — AI 품질
          if (e.name === 'ai_done' && t) {
            const slot = (aiAgg[t] ??= { done: 0, totalMs: 0, errors: 0 });
            slot.done += 1;
            slot.totalMs += Number(e.props?.ms) || 0;
          }
          if (e.name === 'ai_error' && t) {
            const slot = (aiAgg[t] ??= { done: 0, totalMs: 0, errors: 0 });
            slot.errors += 1;
          }
        });
        const dau = days7.map((day) => ({ day: day.slice(5), users: dauSet[day]?.size ?? 0 }));

        // ─── 리텐션 근사 (14일 윈도우 · 첫 방문일 기준 D1/D7 재방문) ───
        const addDays = (day: string, n: number): string => {
          const dt = new Date(day + 'T00:00:00Z');
          dt.setUTCDate(dt.getUTCDate() + n);
          return dt.toISOString().slice(0, 10);
        };
        let d1Eligible = 0, d1Returned = 0, d7Eligible = 0, d7Returned = 0;
        Object.values(visitDays).forEach((days) => {
          const sorted = Array.from(days).sort();
          const first = sorted[0];
          if (!first) return;
          if (first <= kstDay(-1)) {
            d1Eligible += 1;
            if (days.has(addDays(first, 1))) d1Returned += 1;
          }
          if (first <= kstDay(-7)) {
            d7Eligible += 1;
            if (days.has(addDays(first, 7))) d7Returned += 1;
          }
        });
        const retention = {
          d1Rate: d1Eligible > 0 ? Math.round((d1Returned / d1Eligible) * 100) : null,
          d7Rate: d7Eligible > 0 ? Math.round((d7Returned / d7Eligible) * 100) : null,
          cohortD1: d1Eligible,
          cohortD7: d7Eligible,
        };

        // ─── 재구매 — charge_complete 2회+ 유저 비율 ───
        const chargedUsers = Object.keys(chargeByUser).length;
        const repeatUsers = Object.values(chargeByUser).filter((n) => n >= 2).length;
        const repurchase = {
          rate: chargedUsers > 0 ? Math.round((repeatUsers / chargedUsers) * 100) : null,
          chargedUsers,
          repeatUsers,
        };

        // ─── 유입 채널 — utm.source 별 방문(세션)·충전 ───
        const utmSources = new Set([...Object.keys(utmVisits), ...Object.keys(utmCharges)]);
        const utmRows = Array.from(utmSources)
          .map((source) => ({ source, visits: utmVisits[source]?.size ?? 0, charges: utmCharges[source] ?? 0 }))
          .sort((a, b) => b.visits - a.visits);

        // ─── 콘텐츠별 구매 막대 데이터 ───
        const purchases = Object.entries(purchaseAgg)
          .map(([key, v]) => {
            const label = key.startsWith('topic:')
              ? `주제·${key.slice(6)}`
              : (CONTENT_LABEL[key] || key);
            return { label, count: v.count, un: Math.round(v.un * 10) / 10 };
          })
          .sort((a, b) => b.count - a.count);

        // ─── AI 품질 rows ───
        const aiQuality = Object.entries(aiAgg)
          .map(([type, v]) => ({
            type,
            count: v.done,
            avgMs: v.done > 0 ? Math.round(v.totalMs / v.done) : 0,
            errors: v.errors,
          }))
          .sort((a, b) => b.count - a.count);

        // ─── AI 원가 (실측 · aiUsage 14일) — 서버 logAiUsage 가 기록 (C7) ───
        let aiCost: Metrics['aiCost'] = null;
        try {
          const usageSnap = await getDocs(
            query(collection(db, 'aiUsage'), where('day', '>=', kstDay(-13)), orderBy('day'), limit(5000)),
          );
          let inT = 0, outT = 0, usd = 0, calls = 0;
          usageSnap.forEach((d) => {
            const u = d.data() as any;
            const model = String(u.model || '');
            const i = Number(u.inputTokens) || 0;
            const o = Number(u.outputTokens) || 0;
            inT += i; outT += o; calls += 1;
            const price = model.includes('opus') ? TOKEN_PRICE_PER_M.opus
              : model.includes('sonnet') ? TOKEN_PRICE_PER_M.sonnet
              : null; // Gemini 등 — 무시 가능 수준
            if (price) usd += (i * price.in + o * price.out) / 1_000_000;
          });
          if (calls > 0) aiCost = { inputTokens: inT, outputTokens: outT, costKrw: Math.round(usd * USD_KRW), calls };
        } catch { /* aiUsage 미배포/권한 전 — noop */ }

        // 2) 매출 — collectionGroup(payments) confirmed + 일별 추이
        let totalRevenue = 0, todayRevenue = 0;
        const days14 = Array.from({ length: 14 }, (_, i) => kstDay(-13 + i));
        const revByDay: Record<string, number> = {};
        try {
          const paySnap = await getDocs(collectionGroup(db, 'payments'));
          paySnap.forEach((d) => {
            const p = d.data() as any;
            const amt = Number(p.amount) || 0;
            const isConfirmed = p.status === 'confirmed' || p.status === undefined;
            const isCharge = (p.type ?? 'charge') !== 'use' && (p.type ?? 'charge') !== 'refund';
            if (isConfirmed && isCharge && amt > 0) {
              totalRevenue += amt;
              const pday = (p.createdAt && String(p.createdAt).slice(0, 10)) || '';
              if (pday === today) todayRevenue += amt;
              if (days14.includes(pday)) revByDay[pday] = (revByDay[pday] ?? 0) + amt;
            }
          });
        } catch { /* collectionGroup 인덱스 필요 시 0 */ }
        const dailyRevenue = days14.map((day) => ({ day: day.slice(5), won: revByDay[day] ?? 0 }));

        // 3) 콘텐츠 생성 — collectionGroup(reports) by contentType
        const reportsByType: Record<string, number> = {};
        try {
          const repSnap = await getDocs(collectionGroup(db, 'reports'));
          repSnap.forEach((d) => {
            const r = d.data() as any;
            const t = r.contentType || 'report';
            reportsByType[t] = (reportsByType[t] ?? 0) + 1;
          });
        } catch { /* noop */ }

        // 4) 유저 수
        let totalUsers = 0;
        try {
          const uSnap = await getDocs(collection(db, 'users'));
          totalUsers = uSnap.size;
        } catch { /* noop */ }

        if (!cancelled) {
          setM({
            totalUsers, totalRevenue, todayRevenue, contentOpen, contentResult, chargeComplete, dau, reportsByType, rewardTotal, dailyRevenue,
            purchases, adStats, aiQuality, retention, repurchase, utmRows, aiCost,
          });
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || '데이터를 불러오지 못했어요');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [owner, loading]);

  // ⚠️ 훅은 모든 early return 보다 위에서 무조건 호출 (React #300 방지).
  const funnel = useMemo(() => {
    if (!m) return [];
    const totalOpen = Object.values(m.contentOpen).reduce((a, b) => a + b, 0);
    const totalResult = Object.values(m.contentResult).reduce((a, b) => a + b, 0);
    return [
      { step: '콘텐츠 진입', n: totalOpen },
      { step: '결과 도달', n: totalResult },
      { step: '충전 완료', n: m.chargeComplete },
    ];
  }, [m]);

  const contentBars = useMemo(() => {
    if (!m) return [];
    return Object.entries(m.contentOpen)
      .map(([type, n]) => ({ label: CONTENT_LABEL[type] || type, n }))
      .sort((a, b) => b.n - a.n);
  }, [m]);

  // 비오너 — uid 노출 (등록용)
  if (!loading && !owner) {
    return (
      <div style={{ minHeight: '100vh', background: C.paper, padding: '40px 20px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>어드민 — 접근 권한 없음</h1>
        <p style={{ fontSize: 13, color: C.mute, marginTop: 12, lineHeight: 1.6 }}>
          이 화면을 보려면 아래 <b>uid</b> 를 어드민으로 등록해야 해요.<br />
          (개발자에게 이 uid 를 전달 → adminConfig.ts + firestore.rules 에 추가 후 재배포)
        </p>
        <div style={{ marginTop: 16, padding: 14, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: C.mute, marginBottom: 6 }}>현재 로그인 uid</div>
          <code style={{ fontSize: 13, fontWeight: 700, color: C.goldDeep, wordBreak: 'break-all' }}>
            {user?.uid || '(로그인 필요 — 토스/소셜 로그인 후 새로고침)'}
          </code>
        </div>
        <button onClick={() => navigate('/')} style={{ marginTop: 20, fontSize: 13, color: C.gold, background: 'none', border: 'none', cursor: 'pointer' }}>
          ← 홈으로
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.paper, padding: '20px 16px 60px', maxWidth: 720, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>사주500 어드민</h1>
        <button onClick={() => navigate('/')} style={{ fontSize: 12, color: C.mute, background: 'none', border: 'none', cursor: 'pointer' }}>← 홈</button>
      </header>

      {busy && <p style={{ fontSize: 13, color: C.mute }}>집계 중…</p>}
      {err && <p style={{ fontSize: 13, color: '#C0392B' }}>{err}</p>}

      {m && (
        <>
          {/* KPI 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <Kpi label="누적 유저" value={`${m.totalUsers.toLocaleString()}명`} />
            <Kpi label="오늘 활성(방문)" value={`${m.dau[m.dau.length - 1]?.users ?? 0}명`} />
            <Kpi label="누적 매출" value={`₩${m.totalRevenue.toLocaleString()}`} accent />
            <Kpi label="오늘 매출" value={`₩${m.todayRevenue.toLocaleString()}`} accent />
          </div>

          {/* 손익(P&L) — 매출 vs 추정 AI원가 = 추정 기여이익 */}
          {(() => {
            const aiCost = estAiCost(m.reportsByType);
            const profit = m.totalRevenue - aiCost;
            const margin = m.totalRevenue > 0 ? Math.round((profit / m.totalRevenue) * 100) : 0;
            return (
              <Section title="손익 (누적 · 추정)">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <Kpi label="매출" value={`₩${m.totalRevenue.toLocaleString()}`} />
                  <Kpi label="추정 AI원가" value={`₩${Math.round(aiCost).toLocaleString()}`} />
                  <Kpi label="추정 기여이익" value={`₩${Math.round(profit).toLocaleString()}`} accent />
                </div>
                <div style={{ fontSize: 12, color: C.mute, textAlign: 'center' }}>
                  기여이익률 <b style={{ color: profit >= 0 ? C.goldDeep : '#C0392B' }}>{margin}%</b>
                  <span style={{ fontSize: 10, marginLeft: 6 }}>· AI원가는 추정(토큰 기반) · 인프라(GCP/Anthropic 고정비)·리워드 별도</span>
                </div>
              </Section>
            );
          })()}

          {/* 매출 추이 */}
          <Section title="매출 추이 (최근 14일)">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={m.dailyRevenue} margin={{ left: -8, right: 8 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.gold} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={C.gold} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: C.mute }} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => [`₩${Number(v).toLocaleString()}`, '매출']} />
                <Area type="monotone" dataKey="won" stroke={C.goldDeep} strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </Section>

          {/* 퍼널 */}
          <Section title="전환 퍼널 (최근 14일)">
            <div style={{ display: 'flex', gap: 8 }}>
              {funnel.map((f, i) => {
                const prev = i > 0 ? funnel[i - 1].n : f.n;
                const rate = prev > 0 ? Math.round((f.n / prev) * 100) : 100;
                return (
                  <div key={f.step} style={{ flex: 1, textAlign: 'center', padding: '12px 6px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: C.mute }}>{f.step}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.ink, marginTop: 4 }}>{f.n}</div>
                    {i > 0 && <div style={{ fontSize: 11, color: C.goldDeep, marginTop: 2 }}>{rate}%</div>}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 콘텐츠 인기 */}
          <Section title="콘텐츠 진입 인기 (최근 14일)">
            {contentBars.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={Math.max(120, contentBars.length * 44)}>
                <BarChart data={contentBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 12, fill: C.ink }} />
                  <Tooltip />
                  <Bar dataKey="n" radius={[0, 6, 6, 0]}>
                    {contentBars.map((_, i) => <Cell key={i} fill={CONTENT_COLORS[i % CONTENT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* DAU 7일 */}
          <Section title="일별 방문 (최근 7일)">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={m.dau} margin={{ left: -16, right: 8 }}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.mute }} />
                <YAxis tick={{ fontSize: 11, fill: C.mute }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Section>

          {/* 콘텐츠 생성(보관함 저장) by type */}
          <Section title="콘텐츠 생성 누적 (결제·무료 합산)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(m.reportsByType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <div key={t} style={{ padding: '8px 12px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 100, fontSize: 12 }}>
                  <b style={{ color: C.ink }}>{CONTENT_LABEL[t] || t}</b> <span style={{ color: C.goldDeep, fontWeight: 700 }}>{n}</span>
                </div>
              ))}
              {Object.keys(m.reportsByType).length === 0 && <Empty />}
            </div>
          </Section>

          {/* ─── 대시보드 v2 (2026-06-10) ─── */}

          {/* 콘텐츠별 구매 (운 차감) */}
          <Section title="콘텐츠별 구매 (최근 14일 · 운 차감)">
            {m.purchases.length === 0 ? <Empty /> : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(120, m.purchases.length * 40)}>
                  <BarChart data={m.purchases} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 11, fill: C.ink }} />
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}건 · ${p?.payload?.un ?? 0}운`, '구매']} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {m.purchases.map((_, i) => <Cell key={i} fill={CONTENT_COLORS[i % CONTENT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {m.purchases.map((p) => (
                    <span key={p.label} style={{ fontSize: 11, color: C.mute, padding: '4px 10px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 100 }}>
                      {p.label} <b style={{ color: C.goldDeep }}>{p.un}운</b>
                    </span>
                  ))}
                </div>
              </>
            )}
          </Section>

          {/* 광고 */}
          <Section title="광고 (최근 14일 · 앱인토스 배너)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <MiniStat label="노출" value={m.adStats.impression} />
              <MiniStat label="클릭" value={m.adStats.click} />
              <MiniStat label="노필" value={m.adStats.nofill} />
              <MiniStat label="실패" value={m.adStats.fail} />
            </div>
            <div style={{ fontSize: 12, color: C.mute }}>
              클릭률 <b style={{ color: C.goldDeep }}>
                {m.adStats.impression > 0 ? `${((m.adStats.click / m.adStats.impression) * 100).toFixed(1)}%` : '-'}
              </b>
              <span style={{ fontSize: 10, marginLeft: 6 }}>· 노출 0 이면 토스 콘솔 그룹ID/버전 문제 의심 (silent-hide 라 화면에선 안 보임)</span>
            </div>
          </Section>

          {/* AI 품질 */}
          <Section title="AI 품질 (최근 14일 · 지연/에러)">
            {m.aiQuality.length === 0 ? <Empty /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {m.aiQuality.map((q) => {
                  const total = q.count + q.errors;
                  const errRate = total > 0 ? Math.round((q.errors / total) * 100) : 0;
                  return (
                    <div key={q.type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12 }}>
                      <b style={{ color: C.ink, minWidth: 72 }}>{CONTENT_LABEL[q.type] || q.type}</b>
                      <span style={{ color: C.mute }}>{q.count}건</span>
                      <span style={{ color: C.goldDeep, fontWeight: 700 }}>{(q.avgMs / 1000).toFixed(1)}s 평균</span>
                      <span style={{ marginLeft: 'auto', color: errRate > 5 ? '#C0392B' : C.mute }}>
                        에러 {q.errors}건 ({errRate}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* AI 원가 (실측) */}
          <Section title="AI 원가 (실측 · 최근 14일)">
            {!m.aiCost ? (
              <p style={{ fontSize: 12, color: C.mute }}>aiUsage 데이터 없음 — functions 배포 후 호출 누적되면 표시</p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <Kpi label="추정 원가" value={`₩${m.aiCost.costKrw.toLocaleString()}`} accent />
                  <MiniStat label="입력 토큰" value={m.aiCost.inputTokens} />
                  <MiniStat label="출력 토큰" value={m.aiCost.outputTokens} />
                </div>
                <p style={{ fontSize: 10, color: C.mute }}>
                  · {m.aiCost.calls.toLocaleString()}회 호출 합산 · 단가 상수 Opus $5/$25 · Sonnet $3/$15 (per 1M tokens) · 환율 ₩{USD_KRW}/$ · Gemini 무시 가능 수준 제외 · 캐시 할인 미반영
                </p>
              </>
            )}
          </Section>

          {/* 리텐션 (근사) */}
          <Section title="리텐션 (근사 · 14일 윈도우)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
              <Kpi label={`D1 재방문 (코호트 ${m.retention.cohortD1}명)`} value={m.retention.d1Rate == null ? '-' : `${m.retention.d1Rate}%`} />
              <Kpi label={`D7 재방문 (코호트 ${m.retention.cohortD7}명)`} value={m.retention.d7Rate == null ? '-' : `${m.retention.d7Rate}%`} />
            </div>
            <p style={{ fontSize: 10, color: C.mute }}>
              · analytics 14일 윈도우 내 첫 방문일 기준 근사치 — 윈도우 이전 기존 유저도 "첫 방문"으로 집계됨. 정확한 코호트는 GA4 참조.
            </p>
          </Section>

          {/* 재구매 */}
          <Section title="재구매 (최근 14일 · 충전 2회 이상)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <Kpi label="재구매율" value={m.repurchase.rate == null ? '-' : `${m.repurchase.rate}%`} accent />
              <MiniStat label="충전 유저" value={m.repurchase.chargedUsers} />
              <MiniStat label="2회+ 유저" value={m.repurchase.repeatUsers} />
            </div>
          </Section>

          {/* 유입 채널 */}
          <Section title="유입 채널 (최근 14일 · utm_source)">
            {m.utmRows.length === 0 ? <Empty /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {m.utmRows.map((r) => (
                  <div key={r.source} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12 }}>
                    <b style={{ color: C.ink, minWidth: 80, wordBreak: 'break-all' }}>{r.source}</b>
                    <span style={{ color: C.mute }}>방문 {r.visits}</span>
                    <span style={{ marginLeft: 'auto', color: C.goldDeep, fontWeight: 700 }}>충전 {r.charges}건</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 10, color: C.mute, marginTop: 6 }}>· utm 파라미터 없는 진입은 direct 로 집계 (?utm_source= 또는 ?ref= 로 캠페인 구분)</p>
          </Section>

          <p style={{ fontSize: 11, color: C.mute, marginTop: 20, lineHeight: 1.6 }}>
            · 유입경로·체류시간·유저플로우 상세는 GA4(analytics.google.com)에서 확인<br />
            · 집계는 실시간 클라이언트 계산 (새로고침 시 갱신)
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ padding: '14px 16px', background: accent ? '#1A1A1A' : '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 14 }}>
      <div style={{ fontSize: 11, color: accent ? 'rgba(255,255,255,0.6)' : C.mute }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? '#F4D166' : C.ink, marginTop: 4 }}>{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: C.goldDeep, marginBottom: 10, letterSpacing: '0.02em' }}>{title}</h2>
      {children}
    </section>
  );
}
function Empty() {
  return <p style={{ fontSize: 12, color: C.mute }}>아직 데이터가 없어요 (사용 누적되면 표시)</p>;
}
function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: '10px 12px', background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 10, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: C.mute }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginTop: 2 }}>{value.toLocaleString()}</div>
    </div>
  );
}
