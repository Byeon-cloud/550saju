// 어드민 — ⑤ AI 운영 탭 (2026-06-10)
//   type별 지연/에러 + SSE vs callable 분리 + 토큰 원가 테이블 + 매출 vs AI원가 마진
import { useMemo } from 'react';
import type { AdminData } from './_useAdminData';
import { USD_KRW } from './_useAdminData';
import {
  C, Kpi, Section, CsvButton, DataTable, deltaPct, fmtNum, fmtWon, fmtPct, CONTENT_LABEL,
} from './_components';
import type { Col } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

const UN_PRICE = 500;

export function TabAiOps({ d }: { d: AdminData }) {
  const { cur, prev } = d;

  // ── type별 지연/에러 (analytics ai_done/ai_error) ──
  const latencyRows = useMemo(() =>
    Object.entries(cur.ai).map(([type, v]) => {
      const total = v.done + v.errors;
      return {
        label: CONTENT_LABEL[type] || type,
        type,
        count: v.done,
        avgS: v.done > 0 ? Math.round(v.totalMs / v.done / 100) / 10 : 0,
        maxS: Math.round(v.maxMs / 100) / 10,
        errors: v.errors,
        errRate: total > 0 ? Math.round((v.errors / total) * 100) : 0,
      };
    }).sort((a, b) => b.count - a.count),
  [cur.ai]);

  const latencyCols: Col[] = [
    { key: 'label', label: '콘텐츠' },
    { key: 'count', label: '성공', numeric: true },
    { key: 'avgS', label: '평균(s)', numeric: true, render: (v) => v.toFixed(1) },
    { key: 'maxS', label: '최대(s)', numeric: true, render: (v) => v.toFixed(1) },
    { key: 'errors', label: '에러', numeric: true },
    {
      key: 'errRate', label: '에러율', numeric: true,
      render: (v) => <span style={{ color: v > 5 ? C.down : C.ink, fontWeight: v > 5 ? 700 : 400 }}>{v}%</span>,
    },
  ];

  // ── mode 분리 (sse vs callable) ──
  const modeRows = useMemo(() => {
    const out: { label: string; mode: string; count: number; avgS: number; errors: number }[] = [];
    Object.entries(cur.ai).forEach(([type, v]) => {
      Object.entries(v.modes).forEach(([mode, m]) => {
        out.push({
          label: CONTENT_LABEL[type] || type,
          mode,
          count: m.done,
          avgS: m.done > 0 ? Math.round(m.totalMs / m.done / 100) / 10 : 0,
          errors: m.errors,
        });
      });
    });
    return out.sort((a, b) => b.count - a.count);
  }, [cur.ai]);

  const modeCols: Col[] = [
    { key: 'label', label: '콘텐츠' },
    { key: 'mode', label: 'mode', render: (v) => <span style={{ fontSize: 11, fontWeight: 700, color: v === 'sse' ? C.goldDeep : C.mute }}>{v}</span> },
    { key: 'count', label: '성공', numeric: true },
    { key: 'avgS', label: '평균(s)', numeric: true, render: (v) => v.toFixed(1) },
    { key: 'errors', label: '에러', numeric: true },
  ];

  // ── 토큰 원가 (aiUsage) ──
  const costRows = useMemo(() =>
    Object.entries(cur.aiUsage).map(([type, v]) => ({
      label: CONTENT_LABEL[type] || type,
      type,
      calls: v.calls,
      inTok: v.inTok,
      outTok: v.outTok,
      costKrw: Math.round(v.costKrw),
      fail: v.fail,
    })).sort((a, b) => b.costKrw - a.costKrw),
  [cur.aiUsage]);

  const costCols: Col[] = [
    { key: 'label', label: '콘텐츠' },
    { key: 'calls', label: '호출', numeric: true },
    { key: 'inTok', label: '입력 토큰', numeric: true },
    { key: 'outTok', label: '출력 토큰', numeric: true },
    { key: 'costKrw', label: '원가(₩)', numeric: true, render: (v) => fmtWon(v) },
    { key: 'fail', label: '실패', numeric: true },
  ];

  // ── 마진 — 콘텐츠별 운차감 매출(₩) vs AI 원가(₩) ──
  const marginRows = useMemo(() => {
    // 운차감을 base type 으로 합산 (topic:xxx → topic)
    const revByType: Record<string, number> = {};
    Object.entries(cur.contentPurchase).forEach(([key, v]) => {
      const base = key.startsWith('topic:') ? 'topic' : key;
      revByType[base] = (revByType[base] ?? 0) + v.un * UN_PRICE;
    });
    const types = new Set([...Object.keys(revByType), ...Object.keys(cur.aiUsage)]);
    return Array.from(types).map((type) => {
      const rev = Math.round(revByType[type] ?? 0);
      const cost = Math.round(cur.aiUsage[type]?.costKrw ?? 0);
      const margin = rev - cost;
      return {
        label: CONTENT_LABEL[type] || type,
        rev,
        cost,
        margin,
        marginRate: rev > 0 ? Math.round((margin / rev) * 100) : null,
      };
    }).sort((a, b) => b.rev - a.rev);
  }, [cur.contentPurchase, cur.aiUsage]);

  const marginCols: Col[] = [
    { key: 'label', label: '콘텐츠' },
    { key: 'rev', label: '운차감 매출(₩)', numeric: true, render: (v) => fmtWon(v) },
    { key: 'cost', label: 'AI 원가(₩)', numeric: true, render: (v) => fmtWon(v) },
    {
      key: 'margin', label: '마진(₩)', numeric: true,
      render: (v) => <span style={{ color: v >= 0 ? C.up : C.down, fontWeight: 700 }}>{fmtWon(v)}</span>,
    },
    { key: 'marginRate', label: '마진율', numeric: true, render: (v) => fmtPct(v) },
  ];

  // ── KPI ──
  const totalDone = Object.values(cur.ai).reduce((a, v) => a + v.done, 0);
  const totalErr = Object.values(cur.ai).reduce((a, v) => a + v.errors, 0);
  const prevDone = Object.values(prev.ai).reduce((a, v) => a + v.done, 0);
  const errRate = totalDone + totalErr > 0 ? Math.round((totalErr / (totalDone + totalErr)) * 1000) / 10 : 0;
  const totalCost = Math.round(cur.aiUsageTotal.costKrw);
  const prevCost = Math.round(prev.aiUsageTotal.costKrw);
  const totalMarginRev = marginRows.reduce((a, r) => a + r.rev, 0);

  const exportCsv = () => {
    const headers = ['콘텐츠', '호출', '입력토큰', '출력토큰', '원가₩', '운차감매출₩', '마진₩'];
    const byLabel: Record<string, { label: string; calls: number; inTok: number; outTok: number; costKrw: number; rev: number; margin: number }> = {};
    costRows.forEach((r) => {
      byLabel[r.label] = { label: r.label, calls: r.calls, inTok: r.inTok, outTok: r.outTok, costKrw: r.costKrw, rev: 0, margin: -r.costKrw };
    });
    marginRows.forEach((r) => {
      const slot = (byLabel[r.label] ??= { label: r.label, calls: 0, inTok: 0, outTok: 0, costKrw: r.cost, rev: 0, margin: 0 });
      slot.rev = r.rev;
      slot.margin = r.margin;
    });
    const rows = Object.values(byLabel).map((r) => [r.label, r.calls, r.inTok, r.outTok, r.costKrw, r.rev, r.margin]);
    downloadCsv(csvFilename('ai_ops', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section title="AI 운영 KPI" right={<CsvButton onClick={exportCsv} label="AI 원가 CSV" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="AI 호출 성공" value={`${fmtNum(totalDone)}건`} delta={deltaPct(totalDone, prevDone)} />
          <Kpi label="에러율" value={`${errRate}%`} sub={`에러 ${fmtNum(totalErr)}건`} />
          <Kpi label="토큰 원가 (실측)" value={fmtWon(totalCost)} delta={deltaPct(totalCost, prevCost)} accent />
          <Kpi label="운차감 매출 vs 원가" value={fmtWon(totalMarginRev - totalCost)} sub={`매출 ${fmtWon(totalMarginRev)} − 원가 ${fmtWon(totalCost)}`} />
        </div>
      </Section>

      <Section title="콘텐츠별 지연 · 에러" caption="· analytics ai_done(ms)/ai_error 기준 — 에러율 5% 초과 빨강">
        <DataTable columns={latencyCols} rows={latencyRows} initialSortKey="count" />
      </Section>

      <Section title="SSE vs callable 분리" caption="· props.mode 미기록 호출은 callable 로 집계 — SSE 배포 후 비교용">
        <DataTable columns={modeCols} rows={modeRows} initialSortKey="count" />
      </Section>

      <Section
        title="토큰 원가 (aiUsage 실측)"
        caption={`· 단가 상수 Opus $5/$25 · Sonnet $3/$15 (per 1M tokens) · 환율 ₩${USD_KRW}/$ — 캐시 할인 미반영, Gemini 제외(무시 가능 수준). 실제 청구는 Anthropic 콘솔로 교차검증.`}
      >
        <DataTable columns={costCols} rows={costRows} initialSortKey="costKrw" />
      </Section>

      <Section
        title="콘텐츠별 마진 (운차감 매출 − AI 원가)"
        caption={`· 매출 = content_purchase 운 × ₩${UN_PRICE} (소비 기준 — 충전 매출과 별개) · 원가 = aiUsage 토큰 실측 — 무료 콘텐츠는 매출 0이라 마진 음수 정상`}
      >
        <DataTable columns={marginCols} rows={marginRows} initialSortKey="rev" />
      </Section>
    </div>
  );
}
