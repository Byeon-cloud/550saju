// 어드민 — ③ 콘텐츠 탭 (2026-06-10)
//   콘텐츠별 퍼널 테이블(open→result→purchase 전환율) + topic_select 인기 + 생성 누적
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { AdminData } from './_useAdminData';
import {
  C, Section, Empty, CsvButton, DataTable, deltaPct, fmtNum, fmtPct,
  CONTENT_LABEL, CONTENT_COLORS,
} from './_components';
import type { Col } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

export function TabContent({ d }: { d: AdminData }) {
  const { cur, prev } = d;

  // 콘텐츠별 퍼널 — purchase 는 topic:xxx 를 base type 으로 합산
  const purchaseByType = useMemo(() => {
    const out: Record<string, number> = {};
    Object.entries(cur.contentPurchase).forEach(([key, v]) => {
      const base = key.startsWith('topic:') ? 'topic' : key;
      out[base] = (out[base] ?? 0) + v.count;
    });
    return out;
  }, [cur.contentPurchase]);

  const funnelRows = useMemo(() => {
    const types = new Set([
      ...Object.keys(cur.contentOpen), ...Object.keys(cur.contentResult), ...Object.keys(purchaseByType),
    ]);
    return Array.from(types).map((t) => {
      const open = cur.contentOpen[t] ?? 0;
      const result = cur.contentResult[t] ?? 0;
      const purchase = purchaseByType[t] ?? 0;
      return {
        label: CONTENT_LABEL[t] || t,
        open,
        result,
        resultRate: open > 0 ? Math.round((result / open) * 100) : null,
        purchase,
        purchaseRate: result > 0 ? Math.round((purchase / result) * 100) : null,
        prevOpen: prev.contentOpen[t] ?? 0,
        delta: deltaPct(open, prev.contentOpen[t] ?? 0),
      };
    }).sort((a, b) => b.open - a.open);
  }, [cur, prev, purchaseByType]);

  const funnelCols: Col[] = [
    { key: 'label', label: '콘텐츠' },
    { key: 'open', label: '진입', numeric: true },
    { key: 'result', label: '결과 도달', numeric: true },
    { key: 'resultRate', label: '도달률', numeric: true, render: (v) => fmtPct(v) },
    { key: 'purchase', label: '구매(운)', numeric: true },
    { key: 'purchaseRate', label: '구매전환', numeric: true, render: (v) => fmtPct(v) },
    { key: 'delta', label: '진입 증감', numeric: true, render: (v) => fmtPct(v) },
  ];

  // topic_select 인기 주제
  const topicBars = useMemo(() =>
    Object.entries(cur.topicSelect)
      .map(([topic, n]) => ({ label: topic, n, prevN: prev.topicSelect[topic] ?? 0 }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12),
  [cur.topicSelect, prev.topicSelect]);

  // 생성 누적 (reports)
  const reportChips = useMemo(() =>
    Object.entries(d.reportsByType)
      .map(([t, n]) => ({ label: CONTENT_LABEL[t] || t, n }))
      .sort((a, b) => b.n - a.n),
  [d.reportsByType]);

  const exportCsv = () => {
    const headers = ['콘텐츠', '진입', '결과도달', '도달률%', '구매', '구매전환%', '전기간진입'];
    const rows = funnelRows.map((r) => [r.label, r.open, r.result, r.resultRate ?? '', r.purchase, r.purchaseRate ?? '', r.prevOpen]);
    downloadCsv(csvFilename('content_funnel', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section
        title="콘텐츠별 퍼널 (진입 → 결과 → 구매)"
        right={<CsvButton onClick={exportCsv} label="퍼널 CSV" />}
        caption="· 도달률 = 결과/진입 · 구매전환 = 구매/결과 (무료 콘텐츠는 구매 0 정상) · 주제분석 구매는 topic 합산"
      >
        <DataTable columns={funnelCols} rows={funnelRows} initialSortKey="open" />
      </Section>

      <Section title="인기 주제 (topic_select)" caption="· 주제분석 진입 시 선택 이벤트 — 어떤 운을 가장 궁금해하는지">
        {topicBars.length === 0 ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={Math.max(120, topicBars.length * 36)}>
              <BarChart data={topicBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={80} tick={{ fontSize: 12, fill: C.ink }} />
                <Tooltip formatter={(v: any, _n: any, p: any) => [`${fmtNum(Number(v))}회 (전기간 ${fmtNum(p?.payload?.prevN ?? 0)})`, '선택']} />
                <Bar dataKey="n" radius={[0, 6, 6, 0]}>
                  {topicBars.map((_, i) => <Cell key={i} fill={CONTENT_COLORS[i % CONTENT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section title="콘텐츠 생성 누적 (결제·무료 합산)" caption="· reports 컬렉션 contentType 기준 — 전 기간 누적">
        {reportChips.length === 0 ? <Empty /> : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {reportChips.map((r) => (
              <div key={r.label} style={{ padding: '8px 14px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 100, fontSize: 12 }}>
                <b style={{ color: C.ink }}>{r.label}</b>{' '}
                <span style={{ color: C.goldDeep, fontWeight: 700 }}>{fmtNum(r.n)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
