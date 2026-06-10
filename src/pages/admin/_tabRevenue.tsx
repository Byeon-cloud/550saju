// 어드민 — ② 매출 탭 (2026-06-10)
//   일별 매출(전기간 점선 비교) + 충전 패키지 분포 + 콘텐츠별 운 차감 테이블 + 재구매율 + ARPU/ARPPU
import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import type { AdminData } from './_useAdminData';
import {
  C, Kpi, Section, Empty, CsvButton, DataTable, deltaPct, fmtNum, fmtWon, fmtPct,
  CONTENT_LABEL, CONTENT_COLORS,
} from './_components';
import type { Col } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

const UN_PRICE = 500; // 1운 = 500원 (추정매출 환산)

function purchaseLabel(key: string): string {
  return key.startsWith('topic:') ? `주제·${key.slice(6)}` : (CONTENT_LABEL[key] || key);
}

export function TabRevenue({ d }: { d: AdminData }) {
  const { cur, prev } = d;

  const arpu = cur.visitors > 0 ? Math.round(cur.revenue / cur.visitors) : 0;
  const arpuPrev = prev.visitors > 0 ? Math.round(prev.revenue / prev.visitors) : 0;
  const arppu = cur.payingUsers > 0 ? Math.round(cur.revenue / cur.payingUsers) : 0;
  const arppuPrev = prev.payingUsers > 0 ? Math.round(prev.revenue / prev.payingUsers) : 0;
  const repurchaseRate = cur.payingUsers > 0 ? Math.round((cur.repeatPayingUsers / cur.payingUsers) * 100) : null;
  const repurchasePrev = prev.payingUsers > 0 ? Math.round((prev.repeatPayingUsers / prev.payingUsers) * 100) : 0;

  // 일별 매출 — 현 기간 실선/면적 + 전기간 점선 (index 정렬)
  const revSeries = useMemo(() => cur.days.map((day, i) => ({
    day: day.slice(5),
    cur: cur.revenueByDay[i],
    prev: prev.revenueByDay[i] ?? 0,
  })), [cur, prev]);

  // 충전 패키지 분포
  const packageRows = useMemo(() => {
    const keys = new Set([...Object.keys(cur.packageDist), ...Object.keys(prev.packageDist)]);
    return Array.from(keys)
      .map((amt) => ({
        label: fmtWon(Number(amt)),
        amount: Number(amt),
        count: cur.packageDist[amt] ?? 0,
        prevCount: prev.packageDist[amt] ?? 0,
        revenue: (cur.packageDist[amt] ?? 0) * Number(amt),
      }))
      .sort((a, b) => a.amount - b.amount);
  }, [cur.packageDist, prev.packageDist]);

  // 콘텐츠별 운 차감 (topic 세분화)
  const purchaseRows = useMemo(() => {
    const keys = new Set([...Object.keys(cur.contentPurchase), ...Object.keys(prev.contentPurchase)]);
    return Array.from(keys).map((key) => {
      const c = cur.contentPurchase[key] ?? { count: 0, un: 0 };
      const p = prev.contentPurchase[key] ?? { count: 0, un: 0 };
      return {
        label: purchaseLabel(key),
        count: c.count,
        un: Math.round(c.un * 10) / 10,
        estWon: Math.round(c.un * UN_PRICE),
        prevCount: p.count,
        delta: deltaPct(c.count, p.count),
      };
    }).sort((a, b) => b.un - a.un);
  }, [cur.contentPurchase, prev.contentPurchase]);

  const purchaseCols: Col[] = [
    { key: 'label', label: '콘텐츠' },
    { key: 'count', label: '건수', numeric: true },
    { key: 'un', label: '운 합계', numeric: true },
    { key: 'estWon', label: '추정매출(₩)', numeric: true, render: (v) => fmtWon(v) },
    { key: 'prevCount', label: '전기간 건수', numeric: true },
    { key: 'delta', label: '증감', numeric: true, render: (v) => fmtPct(v) },
  ];

  const exportCsv = () => {
    const headers = ['콘텐츠', '건수', '운합계', '추정매출₩', '전기간건수'];
    const rows = purchaseRows.map((r) => [r.label, r.count, r.un, r.estWon, r.prevCount]);
    downloadCsv(csvFilename('revenue_content', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section title="매출 KPI" right={<CsvButton onClick={exportCsv} label="운차감 CSV" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="기간매출" value={fmtWon(cur.revenue)} delta={deltaPct(cur.revenue, prev.revenue)} accent />
          <Kpi label="충전 완료" value={`${fmtNum(cur.chargeComplete)}건`} delta={deltaPct(cur.chargeComplete, prev.chargeComplete)} />
          <Kpi label="ARPU" value={fmtWon(arpu)} delta={deltaPct(arpu, arpuPrev)} sub="기간매출 ÷ 고유 방문" />
          <Kpi label="ARPPU" value={fmtWon(arppu)} delta={deltaPct(arppu, arppuPrev)} sub="기간매출 ÷ 결제유저" />
          <Kpi label="재구매율" value={fmtPct(repurchaseRate)} delta={repurchaseRate == null ? undefined : deltaPct(repurchaseRate, repurchasePrev)} sub={`충전 2회+ ${cur.repeatPayingUsers}명 / 결제 ${cur.payingUsers}명`} />
          <Kpi label="운 차감 합계" value={`${fmtNum(Math.round(cur.contentPurchaseUn * 10) / 10)}운`} delta={deltaPct(cur.contentPurchaseUn, prev.contentPurchaseUn)} sub={`추정 ${fmtWon(cur.contentPurchaseUn * UN_PRICE)}`} />
        </div>
      </Section>

      <Section title="일별 매출" caption="· 실선 면적 = 현 기간 — 점선 = 직전 동일 기간 (같은 순번 날짜끼리 정렬)">
        {revSeries.every((p) => p.cur === 0 && p.prev === 0) ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={revSeries} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="revCurGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.gold} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={C.gold} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: C.mute }} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any, name: any) => [fmtWon(Number(v)), name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="cur" name="현 기간" stroke={C.goldDeep} strokeWidth={2} fill="url(#revCurGrad)" />
                <Line type="monotone" dataKey="prev" name="직전 기간" stroke={C.mute} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="충전 패키지 분포" caption="· payments(confirmed) 금액 단위로 분류 — 1운 ₩500 / 4운 ₩1,500 / 7운 ₩2,500 / 14운 ₩5,000">
        {packageRows.length === 0 ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={Math.max(120, packageRows.length * 44)}>
              <BarChart data={packageRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={76} tick={{ fontSize: 12, fill: C.ink }} />
                <Tooltip formatter={(v: any, _n: any, p: any) => [`${v}건 · ${fmtWon(p?.payload?.revenue ?? 0)}`, '충전']} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {packageRows.map((_, i) => <Cell key={i} fill={CONTENT_COLORS[i % CONTENT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="콘텐츠별 운 차감" caption={`· content_purchase 이벤트 집계 — 추정매출 = 운 × ₩${UN_PRICE} (충전 시점 매출과는 별개인 '소비' 지표) · 주제분석은 topic 별 세분화`}>
        <DataTable columns={purchaseCols} rows={purchaseRows} initialSortKey="un" />
      </Section>
    </div>
  );
}
