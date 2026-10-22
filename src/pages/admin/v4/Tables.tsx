/**
 * 관리자 v4 — 매출, 유입, 콘텐츠와 AI 표 (2026-10-19)
 *   모두 하루 요약(statsDaily)을 기간만큼 더한 값. 표 아래 '내려받기'로 그대로 엑셀에 붙일 수 있다.
 */
import { fmt, won, pct, sideOf, CONTENT_NAME, AI_NAME, SOURCE_NAME } from './api';
import type { DayStats, PlatFilter, ChannelRow } from './api';
import { Box, Table, K } from './ui';
import { DayColumns, PLAT_COLOR } from './charts';
import { CHARGE_PACKAGES } from '@/constants/pricing';

/** 결제 금액 → 충전 묶음 이름 (2026-10-23, 오너 '그날 어떤 묶음이 몇 개 팔렸는지'). 지금 묶음 표에 없는 금액은 금액 그대로 */
const pkgName = (amount: number) => { const p = CHARGE_PACKAGES.find((x) => x.price === amount); return p ? `${p.un}운(${won(amount)})` : won(amount); };

function csv(name: string, head: string[], rows: (string | number)[][]) {
  const body = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const Down = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} style={{ fontSize: 13, color: K.goldDeep, background: 'none', border: 0, cursor: 'pointer', fontWeight: 700 }}>표 내려받기</button>
);

export function Revenue({ days, plat }: { days: DayStats[]; plat: PlatFilter }) {
  const rows = [...days].reverse().map((d) => {
    const s = sideOf(d, plat);
    return [d.day + (d.partial ? ' (진행 중)' : ''), d.app.orders, d.app.revenue, d.web.orders, d.web.revenue, s.refundAmount, s.payers, s.newPayers, d.ai?.costKrw || 0, d.cs?.grantedUn || 0];
  });
  const head = ['날짜', '앱 결제', '앱 매출', '웹 결제', '웹 매출', '환불', '결제한 사람', '처음 결제', 'AI 비용', 'CS로 넣은 운'];
  const tot = rows.reduce((t, r) => t.map((v, i) => (i === 0 ? '합계' : Number(v) + Number(r[i]))), ['합계', 0, 0, 0, 0, 0, 0, 0, 0, 0] as (string | number)[]);
  const pk: Record<string, number> = {};
  for (const d of days) for (const [k, v] of Object.entries(d.packages || {})) pk[k] = (pk[k] || 0) + v;
  const fmtRow = (r: (string | number)[]) => r.map((v, i) => (i === 0 ? v : [2, 4, 5, 8].includes(i) ? won(Number(v)) : fmt(Number(v))));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 10, marginBottom: 18 }}>
        <DayColumns title="날짜별 매출" days={days} fmt={won} series={[
          ...(plat !== 'web' ? [{ key: 'app', label: '앱', color: PLAT_COLOR.app, get: (d: DayStats) => d.app.revenue }] : []),
          ...(plat !== 'app' ? [{ key: 'web', label: '웹', color: PLAT_COLOR.web, get: (d: DayStats) => d.web.revenue }] : []),
        ]} />
        <DayColumns title="날짜별 AI 비용" days={days} fmt={won} series={[{ key: 'ai', label: 'AI 비용', color: '#7A6F60', get: (d: DayStats) => d.ai?.costKrw || 0 }]} />
      </div>
      <Box title="날짜별 표" right={<Down onClick={() => csv('매출', head, rows as any)} />} note="매출은 결제 장부 기준이에요(같은 주문은 한 번, 확정된 날). 환불은 환불된 날에 잡혀요(웹은 15분, 토스 앱 결제는 30분마다 확인해 운과 보너스를 거둬요).">
        <Table head={head} align={['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']} rows={[fmtRow(tot), ...rows.map(fmtRow)]} />
      </Box>
      <Box title="팔린 묶음 (기간 합계)">
        <Table head={['묶음', '건수']} align={['l', 'r']} rows={Object.entries(pk).sort((a, b) => b[1] - a[1]).map(([k, v]) => [`${k.split(' ')[0]} ${pkgName(Number(k.split(' ')[1]))}`, fmt(v)])} />
      </Box>
      <PackagesByDay days={days} plat={plat} />
    </div>
  );
}

/** 날짜별 팔린 묶음 (2026-10-23) — 하루 요약의 packages('앱 2500' → 건수)를 묶음 이름 칸으로 펼친다. 앱, 웹 거르기를 따른다 */
function PackagesByDay({ days, plat }: { days: DayStats[]; plat: PlatFilter }) {
  const want = (k: string) => plat === 'all' || (plat === 'app' ? k.startsWith('앱 ') : k.startsWith('웹 '));
  const amounts = Array.from(new Set(days.flatMap((d) => Object.keys(d.packages || {}).filter(want).map((k) => Number(k.split(' ')[1]) || 0)))).sort((a, b) => a - b);
  const head = ['날짜', ...amounts.map(pkgName), '합계'];
  const rows = [...days].reverse().map((d) => {
    const per = amounts.map((a) => Object.entries(d.packages || {}).filter(([k]) => want(k) && Number(k.split(' ')[1]) === a).reduce((t, [, v]) => t + v, 0));
    return [d.day + (d.partial ? ' (진행 중)' : ''), ...per, per.reduce((t, v) => t + v, 0)];
  }).filter((r) => Number(r[r.length - 1]) > 0);
  return (
    <Box title="날짜별 팔린 묶음" right={<Down onClick={() => csv('날짜별_묶음', head, rows as any)} />} note="결제 장부 기준(같은 주문은 한 번, 확정된 날). 판 묶음이 없는 날은 빼고 보여요. 위의 앱, 웹 거르기를 따라요.">
      <Table head={head} align={['l', ...amounts.map(() => 'r' as const), 'r']} rows={rows.map((r) => r.map((v, i) => (i === 0 ? v : fmt(Number(v)))))} />
    </Box>
  );
}

export function Channels({ days, plat }: { days: DayStats[]; plat: PlatFilter }) {
  const sum: Record<string, ChannelRow> = {};
  for (const d of days) for (const [src, r] of Object.entries(d.channels || {})) {
    if (plat !== 'all' && r.plat !== plat) continue;
    const t = (sum[src] ??= { plat: r.plat, visitors: 0, inputs: 0, results: 0, payers: 0, revenue: 0 });
    t.visitors += r.visitors; t.inputs += r.inputs; t.results += r.results; t.payers += r.payers; t.revenue += r.revenue;
  }
  const list = Object.entries(sum).sort((a, b) => b[1].visitors - a[1].visitors);
  const head = ['처음 들어온 곳', '앱/웹', '방문', '사주 입력', '입력 비율', '결과', '결제', '결제 비율', '매출'];
  const rows = list.map(([src, r]) => [SOURCE_NAME[src] || (src.startsWith('토스 ') ? `토스 ${src.slice(3).toLowerCase() === 'push' ? '푸시' : src.slice(3)}` : src), r.plat === 'app' ? '앱' : '웹', r.visitors, r.inputs, pct(r.inputs, r.visitors), r.results, r.payers, pct(r.payers, r.visitors), r.revenue]);
  return (
    <Box title="들어온 곳별" right={<Down onClick={() => csv('유입', head, rows as any)} />}
      note="기기가 그날 처음 utm(광고 주소 꼬리표)을 달고 들어온 곳으로 묶어요. 광고 주소에는 utm_source(naver, meta 등)를 꼭 붙여요. 날마다 센 것을 더한 값이라 같은 사람이 여러 날 오면 여러 번 세요. 매출은 충전 완료 이벤트 기준이라 매출 탭과 조금 다를 수 있어요.">
      <Table head={head} align={['l', 'l', 'r', 'r', 'r', 'r', 'r', 'r', 'r']}
        rows={rows.map((r) => r.map((v, i) => (i === 8 ? won(Number(v)) : typeof v === 'number' ? fmt(v) : v)))} />
    </Box>
  );
}

export function ContentAi({ days, plat }: { days: DayStats[]; plat: PlatFilter }) {
  const c: Record<string, { opens: number; results: number; purchases: number; un: number }> = {};
  for (const d of days) for (const [t, v] of Object.entries(d.content || {})) {
    const x = (c[t] ??= { opens: 0, results: 0, purchases: 0, un: 0 });
    for (const p of (plat === 'all' ? ['app', 'web'] : [plat]) as ('app' | 'web')[]) {
      const r = v[p]; if (!r) continue;
      x.opens += r.opens; x.results += r.results; x.purchases += r.purchases; x.un += r.un;
    }
  }
  const ai: Record<string, { calls: number; fail: number; costKrw: number; msSum: number }> = {};
  for (const d of days) for (const [t, v] of Object.entries(d.ai?.byType || {})) {
    const x = (ai[t] ??= { calls: 0, fail: 0, costKrw: 0, msSum: 0 });
    x.calls += v.calls; x.fail += v.fail; x.costKrw += v.costKrw; x.msSum += v.ms * v.calls;
  }
  const cHead = ['콘텐츠', '연 사람', '결과 받은 사람', '운 쓴 건수', '쓴 운'];
  const cRows = Object.entries(c).sort((a, b) => b[1].opens - a[1].opens).map(([t, v]) => [CONTENT_NAME[t] || t, v.opens, v.results, v.purchases, v.un]);
  const aHead = ['AI 작업', '부른 횟수', '실패', '비용', '한 번 평균 비용', '평균 시간(초)'];
  const aRows = Object.entries(ai).sort((a, b) => b[1].costKrw - a[1].costKrw).map(([t, v]) => [AI_NAME[t] || t, v.calls, v.fail, Math.round(v.costKrw), v.calls ? Math.round(v.costKrw / v.calls) : 0, v.calls ? Math.round(v.msSum / v.calls / 100) / 10 : 0]);
  return (
    <div>
      <Box title="콘텐츠별" right={<Down onClick={() => csv('콘텐츠', cHead, cRows as any)} />} note="사람 수는 날마다 센 것을 더한 값이에요. 쓴 운은 운을 차감한 기록 기준이에요(무료 이용은 0).">
        <Table head={cHead} align={['l', 'r', 'r', 'r', 'r']} rows={cRows.map((r) => r.map((v) => (typeof v === 'number' ? fmt(v) : v)))} />
      </Box>
      <Box title="AI 비용과 실패" right={<Down onClick={() => csv('AI', aHead, aRows as any)} />} note="토큰 단가로 계산한 추정 비용이에요(캐시 할인 반영, 1달러 1,400원). 실제 청구는 Anthropic 콘솔이 기준이에요.">
        <Table head={aHead} align={['l', 'r', 'r', 'r', 'r', 'r']} rows={aRows.map((r) => r.map((v, i) => (i === 3 || i === 4 ? won(Number(v)) : i === 5 ? String(v) : typeof v === 'number' ? fmt(v) : v)))} />
      </Box>
    </div>
  );
}
