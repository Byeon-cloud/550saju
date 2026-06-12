// 어드민 — ⑤ AI 운영 탭 (2026-06-10)
//   type별 지연/에러 + SSE vs callable 분리 + 토큰 원가 테이블 + 매출 vs AI원가 마진
import { useMemo } from 'react';
import type { AdminData } from './_useAdminData';
import { USD_KRW } from './_useAdminData';
import {
  C, Kpi, Section, CsvButton, DataTable, deltaPct, fmtNum, fmtWon, CONTENT_LABEL,
} from './_components';
import type { Col } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';


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
  // 1건(생성물 1개)당 호출 수 — 병렬 분할·2차 리뷰 구조 반영 (2026-06-12)
  //   종합사주·1운 리포트 = 3그룹 병렬 / 오늘운세 = Haiku 3-way / 주제분석 = 1차+2차 자기리뷰
  const CALLS_PER_GEN: Record<string, number> = {
    premium: 3, report: 3, daily: 3, topic: 2, dream: 1, deepDream: 1, chat: 1,
    daeun: 1, monthly: 1, compat: 1, tojung: 1,
  };
  // 판매가 (운차감 × ₩500) — 무료는 0
  const PRICE_PER_GEN: Record<string, number> = {
    premium: 2500, report: 500, topic: 500, deepDream: 500, daily: 0, dream: 0, chat: 0,
    daeun: 2500, monthly: 1500, compat: 2500, tojung: 1500,
  };
  const costRows = useMemo(() =>
    Object.entries(cur.aiUsage).map(([type, v]) => {
      const gens = Math.max(1, Math.round(v.calls / (CALLS_PER_GEN[type] ?? 1)));
      const perGen = Math.round(v.costKrw / gens);
      const price = PRICE_PER_GEN[type];
      return {
        label: CONTENT_LABEL[type] || type,
        type,
        calls: v.calls,
        gens,
        inTok: v.inTok,
        outTok: v.outTok,
        costKrw: Math.round(v.costKrw),
        perGen,
        unitMargin: price != null && price > 0 ? price - perGen : null,
        fail: v.fail,
      };
    }).sort((a, b) => b.costKrw - a.costKrw),
  [cur.aiUsage]);

  const costCols: Col[] = [
    { key: 'label', label: '콘텐츠' },
    { key: 'calls', label: '호출', numeric: true },
    { key: 'gens', label: '생성 건(환산)', numeric: true },
    { key: 'costKrw', label: '원가 합(₩)', numeric: true, render: (v) => fmtWon(v) },
    { key: 'perGen', label: '1건당 원가', numeric: true, render: (v) => fmtWon(v) },
    { key: 'unitMargin', label: '1건당 마진(판매가−원가)', numeric: true, render: (v) => v == null ? '무료' : <b style={{ color: Number(v) >= 0 ? '#2D8A4E' : '#C0392B' }}>{fmtWon(v)}</b> },
    { key: 'fail', label: '실패', numeric: true },
  ];

  // ── 마진 — 콘텐츠별 운차감 매출(₩) vs AI 원가(₩) ──


  // ── KPI ──
  const totalDone = Object.values(cur.ai).reduce((a, v) => a + v.done, 0);
  const totalErr = Object.values(cur.ai).reduce((a, v) => a + v.errors, 0);
  const prevDone = Object.values(prev.ai).reduce((a, v) => a + v.done, 0);
  const errRate = totalDone + totalErr > 0 ? Math.round((totalErr / (totalDone + totalErr)) * 1000) / 10 : 0;
  const totalCost = Math.round(cur.aiUsageTotal.costKrw);
  const prevCost = Math.round(prev.aiUsageTotal.costKrw);


  const exportCsv = () => {
    const headers = ['콘텐츠', '호출', '생성건(환산)', '입력토큰', '출력토큰', '원가합₩', '1건당원가₩', '1건당마진₩'];
    const rows = costRows.map((r) => [r.label, r.calls, r.gens, r.inTok, r.outTok, r.costKrw, r.perGen, r.unitMargin ?? '무료']);
    downloadCsv(csvFilename('ai_ops', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section title="AI 운영 KPI" right={<CsvButton onClick={exportCsv} label="AI 원가 CSV" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="AI 호출 성공" value={`${fmtNum(totalDone)}건`} delta={deltaPct(totalDone, prevDone)} />
          <Kpi label="에러율" value={`${errRate}%`} sub={`에러 ${fmtNum(totalErr)}건`} />
          <Kpi label="토큰 원가 (실측)" value={fmtWon(totalCost)} delta={deltaPct(totalCost, prevCost)} accent />
          <Kpi label="1건당 원가 보기" value="아래 표" sub="합산 마진은 QA 호출이 섞여 무의미 — 단위 마진으로 판단" />
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
        caption={`· 단가: Opus $5/$25 · Sonnet $3/$15 · Haiku $1/$5 · Gemini Flash 근사 (per 1M tok) · 환율 ₩${USD_KRW}/$ · 캐시 할인 미반영(실청구는 이보다 낮음) — ⚠️ QA·테스트 호출 포함이라 합계보다 '1건당 원가'를 보세요. 실청구는 Anthropic 콘솔 교차검증.`}
      >
        <DataTable columns={costCols} rows={costRows} initialSortKey="costKrw" />
      </Section>

      {/* 합산 마진 테이블 제거 (2026-06-12) — 매출(이벤트 수집분)과 원가(QA 포함 전체)의 모수가 달라
          -101% 같은 무의미한 수치가 나오던 것. '토큰 원가' 표의 1건당 마진이 정확한 대체. */}
    </div>
  );
}
