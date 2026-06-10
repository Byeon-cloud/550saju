// 어드민 — ⑦ 유입 탭 (2026-06-10)
//   utm_source별 방문·콘텐츠진입·충전 테이블(전환율) + direct 비율 + share_click 추이
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { AdminData } from './_useAdminData';
import {
  C, Kpi, Section, Empty, CsvButton, DataTable, deltaPct, fmtNum, fmtPct,
} from './_components';
import type { Col } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

export function TabAcquisition({ d }: { d: AdminData }) {
  const { cur, prev } = d;

  const utmRows = useMemo(() =>
    Object.entries(cur.utm).map(([source, v]) => ({
      source,
      visits: v.visits,
      contentOpens: v.contentOpens,
      openRate: v.visits > 0 ? Math.round((v.contentOpens / v.visits) * 100) : null,
      charges: v.charges,
      chargeRate: v.visits > 0 ? Math.round((v.charges / v.visits) * 1000) / 10 : null,
      prevVisits: prev.utm[source]?.visits ?? 0,
      delta: deltaPct(v.visits, prev.utm[source]?.visits ?? 0),
    })).sort((a, b) => b.visits - a.visits),
  [cur.utm, prev.utm]);

  const totalVisits = utmRows.reduce((a, r) => a + r.visits, 0);
  const directVisits = cur.utm['direct']?.visits ?? 0;
  const directRatio = totalVisits > 0 ? Math.round((directVisits / totalVisits) * 100) : null;

  const utmCols: Col[] = [
    { key: 'source', label: 'utm_source', render: (v) => <b style={{ color: C.ink, wordBreak: 'break-all' }}>{v}</b> },
    { key: 'visits', label: '방문(세션)', numeric: true },
    { key: 'contentOpens', label: '콘텐츠 진입', numeric: true },
    { key: 'openRate', label: '진입률', numeric: true, render: (v) => fmtPct(v) },
    { key: 'charges', label: '충전 완료', numeric: true },
    { key: 'chargeRate', label: '충전전환', numeric: true, render: (v) => (v == null ? '-' : `${v}%`) },
    { key: 'delta', label: '방문 증감', numeric: true, render: (v) => fmtPct(v) },
  ];

  const shareSeries = useMemo(() => cur.days.map((day, i) => ({
    day: day.slice(5),
    cur: cur.shareByDay[i],
    prev: prev.shareByDay[i] ?? 0,
  })), [cur, prev]);
  const hasShare = cur.shareClicks > 0 || prev.shareClicks > 0;

  const exportCsv = () => {
    const headers = ['utm_source', '방문', '콘텐츠진입', '진입률%', '충전완료', '충전전환%', '전기간방문'];
    const rows = utmRows.map((r) => [r.source, r.visits, r.contentOpens, r.openRate ?? '', r.charges, r.chargeRate ?? '', r.prevVisits]);
    downloadCsv(csvFilename('acquisition_utm', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section title="유입 KPI" right={<CsvButton onClick={exportCsv} label="유입 CSV" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="채널 수" value={`${fmtNum(utmRows.length)}개`} sub="utm_source 고유 (direct 포함)" />
          <Kpi label="direct 비율" value={fmtPct(directRatio)} sub={`direct ${fmtNum(directVisits)} / 전체 ${fmtNum(totalVisits)}`} />
          <Kpi label="공유 클릭" value={`${fmtNum(cur.shareClicks)}회`} delta={deltaPct(cur.shareClicks, prev.shareClicks)} />
        </div>
      </Section>

      <Section
        title="utm_source별 전환"
        caption="· utm 파라미터 없는 진입은 direct 로 집계 (?utm_source= 또는 ?ref= 로 캠페인 구분) · 충전전환 = 충전완료 ÷ 방문"
      >
        <DataTable columns={utmCols} rows={utmRows} initialSortKey="visits" />
      </Section>

      <Section title="공유 클릭 추이 (share_click)" caption="· 실선 = 현 기간 — 점선 = 직전 동일 기간">
        {!hasShare ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={shareSeries} margin={{ left: 0, right: 8 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: C.mute }} width={32} allowDecimals={false} />
                <Tooltip formatter={(v: any, name: any) => [`${fmtNum(Number(v))}회`, name === 'cur' ? '현 기간' : '직전 기간']} />
                <Line type="monotone" dataKey="cur" stroke={C.gold} strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="prev" stroke={C.mute} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>
    </div>
  );
}
