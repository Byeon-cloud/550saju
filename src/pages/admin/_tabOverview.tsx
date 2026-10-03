// 어드민 — ① Overview 탭 (2026-06-10)
//   KPI 그리드(델타) + 매출/DAU 듀얼 시계열 + 전환 퍼널 + 원본 이벤트 CSV
import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { AdminData } from './_useAdminData';
import { C, Kpi, Section, Empty, CsvButton, deltaPct, fmtNum, fmtWon } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

export function TabOverview({ d }: { d: AdminData }) {
  const { cur, prev } = d;

  // 신규 결제유저 — 기간 내 결제 유저 중 첫 결제가 이 기간인 유저 (결제 장부 전체 이력 기준 · 2026-10-03)
  const newPayers = cur.newPayingUsers;

  const arppu = cur.payingUsers > 0 ? Math.round(cur.revenue / cur.payingUsers) : 0;
  const arppuPrev = prev.payingUsers > 0 ? Math.round(prev.revenue / prev.payingUsers) : 0;
  const contentGen = cur.contentResultTotal;

  // 듀얼 시계열 — 매출(좌) + DAU(우) 하나로 단순화 (2026-06-12 준기 피드백)
  //   DAU = 그날 앱을 쓴 유저 — 방문로그(있으면)와 생성기록(과거 복원) 중 큰 값.
  //   행동로그 수집 이전 기간도 생성기록으로 채워져 끊기지 않음.
  const dualSeries = useMemo(() => cur.days.map((day, i) => ({
    day: day.slice(5),
    revenue: cur.revenueByDay[i],
    dau: Math.max(cur.dauByDay[i] ?? 0, cur.genUsersByDay[i] ?? 0),
  })), [cur]);
  const dauUnifiedAvg = useMemo(() => {
    const merged = cur.days.map((_, i) => Math.max(cur.dauByDay[i] ?? 0, cur.genUsersByDay[i] ?? 0));
    return merged.length ? Math.round(merged.reduce((a, b) => a + b, 0) / merged.length * 10) / 10 : 0;
  }, [cur]);
  const dauUnifiedPrevAvg = useMemo(() => {
    const merged = prev.days.map((_, i) => Math.max(prev.dauByDay[i] ?? 0, prev.genUsersByDay[i] ?? 0));
    return merged.length ? Math.round(merged.reduce((a, b) => a + b, 0) / merged.length * 10) / 10 : 0;
  }, [prev]);

  // 전환 퍼널 5단계
  const funnel = useMemo(() => ([
    { step: '방문(고유)', n: cur.visitors, pn: prev.visitors },
    { step: '콘텐츠 진입', n: cur.contentOpenTotal, pn: prev.contentOpenTotal },
    { step: '결과 도달', n: cur.contentResultTotal, pn: prev.contentResultTotal },
    { step: '충전 진입', n: cur.chargeOpen, pn: prev.chargeOpen },
    { step: '결제 완료', n: cur.payOrders, pn: prev.payOrders },
  ]), [cur, prev]);

  const exportRawCsv = () => {
    const headers = ['day', 'name', 'uid', 'sid', 'props'];
    const rows = d.rawEvents.map((e) => [e.day, e.name, e.uid, e.sid, e.props ? JSON.stringify(e.props) : '']);
    downloadCsv(csvFilename('raw_events', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };
  const exportKpiCsv = () => {
    const headers = ['지표', '현 기간', '직전 기간', '증감%'];
    const rows: (string | number)[][] = [
      ['기간매출(₩)', cur.revenue, prev.revenue, deltaPct(cur.revenue, prev.revenue) ?? ''],
      ['DAU평균', cur.dauAvg, prev.dauAvg, deltaPct(cur.dauAvg, prev.dauAvg) ?? ''],
      ['방문 고유', cur.visitors, prev.visitors, deltaPct(cur.visitors, prev.visitors) ?? ''],
      ['결제유저', cur.payingUsers, prev.payingUsers, deltaPct(cur.payingUsers, prev.payingUsers) ?? ''],
      ['신규 결제유저', newPayers, prev.newPayingUsers, deltaPct(newPayers, prev.newPayingUsers) ?? ''],
      ['ARPPU(₩)', arppu, arppuPrev, deltaPct(arppu, arppuPrev) ?? ''],
      ['콘텐츠 생성', contentGen, prev.contentResultTotal, deltaPct(contentGen, prev.contentResultTotal) ?? ''],
      ['결제 건수(주문 고유)', cur.payOrders, prev.payOrders, deltaPct(cur.payOrders, prev.payOrders) ?? ''],
    ];
    downloadCsv(csvFilename('overview_kpi', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section
        title="핵심 KPI"
        right={<div style={{ display: 'flex', gap: 6 }}><CsvButton onClick={exportKpiCsv} label="KPI CSV" /><CsvButton onClick={exportRawCsv} label="원본 이벤트 CSV" /></div>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="총매출 (누적)" value={fmtWon(d.totalRevenue)} accent />
          <Kpi label="기간매출" value={fmtWon(cur.revenue)} delta={deltaPct(cur.revenue, prev.revenue)} accent />
          <Kpi label="DAU 평균" value={`${dauUnifiedAvg}명`} delta={deltaPct(dauUnifiedAvg, dauUnifiedPrevAvg)} sub="그날 앱을 쓴 유저 (방문+생성 통합)" />
          <Kpi label="신규 결제유저" value={`${fmtNum(newPayers)}명`} delta={deltaPct(newPayers, prev.newPayingUsers)} sub={`결제유저 ${cur.payingUsers}명 중 첫 결제 (전체 결제 이력 기준)`} />
          <Kpi label="ARPPU" value={fmtWon(arppu)} delta={deltaPct(arppu, arppuPrev)} sub="기간매출 ÷ 결제유저" />
          <Kpi label="콘텐츠 생성" value={`${fmtNum(contentGen)}건`} delta={deltaPct(contentGen, prev.contentResultTotal)} sub="content_result 기준" />
          <Kpi label="이탈률" value={cur.bounceRate == null ? '-' : `${cur.bounceRate}%`} delta={cur.bounceRate != null && prev.bounceRate != null ? deltaPct(cur.bounceRate, prev.bounceRate) : undefined} sub="페이지 1개만 보고 떠난 세션 비율" />
        </div>
      </Section>

      <Section title="매출 · DAU 추이" caption="· 좌축 매출(₩) 면적 — 우축 DAU(명). DAU = 그날 앱을 쓴 유저 (방문 로그 + 생성 기록 통합 — 과거도 끊김 없음)">
        {dualSeries.every((p) => p.revenue === 0 && p.dau === 0) ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={dualSeries} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="ovRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.gold} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={C.gold} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} interval="preserveStartEnd" />
                <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: C.mute }} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="dau" orientation="right" tick={{ fontSize: 10, fill: C.mute }} width={36} allowDecimals={false} />
                <Tooltip formatter={(v: any, name: any) => name === '매출' ? [fmtWon(Number(v)), name] : [`${fmtNum(Number(v))}명`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="rev" type="monotone" dataKey="revenue" name="매출" stroke={C.goldDeep} strokeWidth={2} fill="url(#ovRevGrad)" />
                <Line yAxisId="dau" type="monotone" dataKey="dau" name="DAU" stroke={C.ink} strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="전환 퍼널" caption="· 방문은 고유 방문자 수 · 결제 완료는 결제 장부의 고유 주문 수 · 나머지는 이벤트 건수 기준 — 단계별 %는 직전 단계 대비 전환율">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {funnel.map((f, i) => {
            const prevN = i > 0 ? funnel[i - 1].n : f.n;
            const rate = prevN > 0 ? Math.round((f.n / prevN) * 100) : null;
            return (
              <div key={f.step} style={{ flex: '1 1 120px', textAlign: 'center', padding: '14px 8px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, minWidth: 110 }}>
                <div style={{ fontSize: 11, color: C.mute }}>{f.step}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginTop: 4 }}>{fmtNum(f.n)}</div>
                {i > 0 && (
                  <div style={{ fontSize: 11, color: C.goldDeep, fontWeight: 700, marginTop: 2 }}>
                    {rate == null ? '-' : `${rate}%`}
                  </div>
                )}
                <div style={{ fontSize: 10, color: C.mute, marginTop: 2 }}>전기간 {fmtNum(f.pn)}</div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
