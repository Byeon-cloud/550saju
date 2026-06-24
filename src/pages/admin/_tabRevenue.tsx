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

function pgLabel(pg: string): string {
  return pg === 'iap' ? '앱인토스 IAP' : pg === 'toss' ? '토스페이먼츠(웹)' : pg === 'unknown' ? '기타/미상' : pg;
}

// 결제 직전 진입경로(source) → 사람이 읽기 좋은 라벨
const SOURCE_TOPIC_KR: Record<string, string> = {
  love: '연애운', reunion: '재회운', marriage: '결혼운', wealth: '재물운', exam: '합격이직운',
  business: '사업운', health: '건강운', move: '이사운', moving: '이사운', study: '학업운', career: '직업운',
};
const SOURCE_LABEL: Record<string, string> = {
  premium: '종합사주', chat: '사주대화', dream: '꿈해몽', daily: '오늘운세',
  daeun: '대운', monthly: '월운', compat: '궁합', tojung: '토정비결', direct: '직접 진입',
};
function sourceLabel(src: string): string {
  if (src.startsWith('topic:')) {
    const tid = src.slice(6);
    return `주제·${SOURCE_TOPIC_KR[tid] || tid}`;
  }
  if (src.startsWith('need:')) return '잔액부족 유도';
  return SOURCE_LABEL[src] || src;
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

  // 결제 유발 콘텐츠 (전환 트리거) — charge_complete source 별 결제 건수 + 비율
  const triggerRows = useMemo(() => {
    const total = Object.values(cur.chargeBySource).reduce((s, n) => s + n, 0);
    return Object.entries(cur.chargeBySource)
      .map(([src, count]) => ({
        label: sourceLabel(src),
        count,
        share: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [cur.chargeBySource]);

  const triggerCols: Col[] = [
    { key: 'label', label: '진입경로' },
    { key: 'count', label: '결제 건수', numeric: true },
    { key: 'share', label: '비율', numeric: true, render: (v) => `${v}%` },
  ];

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

      <Section title="결제 건강 · LTV" caption="· payments 컬렉션 전수(전 기간) — 위 매출 KPI(기간 한정)와 달리 누적. 실패·환불·복구필요 포함">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="1인당 LTV" value={fmtWon(d.payHealth.avgLtv)} sub={`누적매출 ÷ 결제유저 ${fmtNum(d.payHealth.payerCount)}명`} accent />
          <Kpi label="누적 매출" value={fmtWon(d.totalRevenue)} sub={`성공 ${fmtNum(d.payHealth.confirmed)}건`} />
          <Kpi label="결제 실패" value={`${fmtNum(d.payHealth.failed)}건`} sub={(d.payHealth.confirmed + d.payHealth.failed) > 0 ? `실패율 ${Math.round((d.payHealth.failed / (d.payHealth.confirmed + d.payHealth.failed)) * 100)}%` : '—'} />
          <Kpi label="환불" value={`${fmtNum(d.payHealth.refundCount)}건`} sub={`환불액 ${fmtWon(d.payHealth.refundAmount)}`} />
          <Kpi label="복구 필요" value={`${fmtNum(d.payHealth.needsReconciliation)}건`} sub="승인됐으나 적립 미완 — 수동 확인" />
        </div>
        {Object.keys(d.payHealth.byPg).length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.mute }}>PG 채널별 매출:</span>
            {Object.entries(d.payHealth.byPg).sort((a, b) => b[1] - a[1]).map(([pg, amt]) => (
              <div key={pg} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: '6px 12px', fontSize: 12 }}>
                <span style={{ color: C.mute }}>{pgLabel(pg)}</span> <b style={{ color: C.goldDeep }}>{fmtWon(amt)}</b>
              </div>
            ))}
          </div>
        )}
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

      <Section title="결제 유발 콘텐츠 (전환 트리거)" caption="· charge_complete 의 진입경로(source) 기준 — 결제 직전 어떤 콘텐츠가 충전을 유발했나 · 비율 = 기간 내 충전 건수 점유율">
        {triggerRows.length === 0 ? <Empty /> : (
          <DataTable columns={triggerCols} rows={triggerRows} initialSortKey="count" />
        )}
      </Section>
    </div>
  );
}
