/**
 * 관리자 v4 — 한눈에 (2026-10-19)
 *   고른 기간의 합과 그 전 같은 길이 기간 대비 증감, 오늘(진행 중), 날짜별 매출과 결과, 단계별 전환, 서버 경보.
 */
import { useEffect, useState } from 'react';
import { callAdmin, fmt, won, pct, sumSides, sideOf, timeText } from './api';
import type { DayStats, PlatFilter } from './api';
import { Box, Tile, Bars, Table, grid, K } from './ui';

const delta = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

export function Overview({ days, prev, plat }: { days: DayStats[]; prev: DayStats[]; plat: PlatFilter }) {
  const cur = sumSides(days, plat);
  const before = sumSides(prev, plat);
  const aiCost = days.reduce((s, d) => s + (d.ai?.costKrw || 0), 0);
  const aiPrev = prev.reduce((s, d) => s + (d.ai?.costKrw || 0), 0);
  const today = days[days.length - 1];
  const t = today ? sideOf(today, plat) : null;
  const net = cur.revenue - cur.refundAmount - aiCost;

  const steps: [string, number, number][] = [
    ['방문한 기기', sumSides(days, 'app').visitors, sumSides(days, 'web').visitors],
    ['사주 입력', sumSides(days, 'app').inputs, sumSides(days, 'web').inputs],
    ['결과 받음', sumSides(days, 'app').results, sumSides(days, 'web').results],
    ['운이 모자라 충전으로', sumSides(days, 'app').payTry, sumSides(days, 'web').payTry],
    ['결제한 사람', sumSides(days, 'app').payers, sumSides(days, 'web').payers],
  ];

  return (
    <div>
      {t && (
        <Box title={`오늘 (${today.day}, 지금까지)`}>
          <div style={grid(140)}>
            <Tile label="방문한 기기" value={fmt(t.visitors)} />
            <Tile label="사주 입력" value={fmt(t.inputs)} />
            <Tile label="결과 받음" value={fmt(t.results)} />
            <Tile label="결제한 사람" value={fmt(t.payers)} sub={`${fmt(t.orders)}건`} />
            <Tile label="매출" value={won(t.revenue)} strong sub={plat === 'all' ? `앱 ${won(today.app.revenue)}, 웹 ${won(today.web.revenue)}` : undefined} />
            <Tile label="AI 비용" value={won(today.ai?.costKrw || 0)} />
          </div>
        </Box>
      )}

      <Box title={`기간 합 (${days[0]?.day || ''} ~ ${days[days.length - 1]?.day || ''})`} note="사람 수는 날마다 센 것을 더한 값이에요(같은 사람이 이틀 오면 두 번). 증감은 바로 앞 같은 길이 기간과 비교해요. 남는 돈은 매출에서 환불과 AI 비용만 뺀 대략값이에요(결제 수수료, 서버비 제외).">
        <div style={grid(150)}>
          <Tile label="방문한 기기" value={fmt(cur.visitors)} delta={delta(cur.visitors, before.visitors)} />
          <Tile label="새 기기" value={fmt(cur.newDevices)} delta={delta(cur.newDevices, before.newDevices)} />
          <Tile label="사주 입력" value={fmt(cur.inputs)} delta={delta(cur.inputs, before.inputs)} />
          <Tile label="결과 받음" value={fmt(cur.results)} delta={delta(cur.results, before.results)} />
          <Tile label="결제한 사람" value={fmt(cur.payers)} sub={`처음 결제 ${fmt(cur.newPayers)}명, ${fmt(cur.orders)}건`} delta={delta(cur.payers, before.payers)} />
          <Tile label="매출" value={won(cur.revenue)} strong delta={delta(cur.revenue, before.revenue)} />
          <Tile label="환불" value={won(cur.refundAmount)} sub={`${fmt(cur.refunds)}건`} />
          <Tile label="AI 비용" value={won(aiCost)} delta={delta(aiCost, aiPrev)} />
          <Tile label="남는 돈(대략)" value={won(net)} />
          <Tile label="결제 한 명당 매출" value={cur.payers ? won(cur.revenue / cur.payers) : '-'} />
        </div>
      </Box>

      <Box title="날짜별 매출">
        <Bars days={days} fmt={won} series={[
          ...(plat !== 'web' ? [{ name: '앱', color: K.app, get: (d: DayStats) => d.app?.revenue || 0 }] : []),
          ...(plat !== 'app' ? [{ name: '웹', color: K.web, get: (d: DayStats) => d.web?.revenue || 0 }] : []),
        ]} />
      </Box>

      <Box title="날짜별 결과 받은 사람">
        <Bars days={days} fmt={fmt} series={[
          ...(plat !== 'web' ? [{ name: '앱', color: K.app, get: (d: DayStats) => d.app?.results || 0 }] : []),
          ...(plat !== 'app' ? [{ name: '웹', color: K.web, get: (d: DayStats) => d.web?.results || 0 }] : []),
        ]} />
      </Box>

      <Box title="단계별 전환 (앱과 웹)" note="방문한 기기 대비 비율이에요. 결과 받음에는 예전에 사주를 넣어 둔 사람도 들어가서 사주 입력보다 클 수 있어요. 결제한 사람은 결제 장부 기준이에요.">
        <Table head={['단계', '앱', '앱 방문 대비', '웹', '웹 방문 대비']} align={['l', 'r', 'r', 'r', 'r']}
          rows={steps.map(([name, a, w], i) => [name, fmt(a), i ? pct(a, steps[0][1]) : '', fmt(w), i ? pct(w, steps[0][2]) : ''])} />
      </Box>

      <AlertsBox days={days} />
    </div>
  );
}

function AlertsBox({ days }: { days: DayStats[] }) {
  const [data, setData] = useState<{ alerts: { id: string; at: number; kind: string; detail: string }[]; failures: { day: string; type: string; stage: string; message: string; uid: string }[] } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { callAdmin('adminStats', { action: 'alerts' }).then(setData).catch((e) => setErr(String(e?.message || e))); }, []);
  const aiFail = days.reduce((s, d) => s + (d.aiFailures?.total || 0) + (d.ai?.fail || 0), 0);
  return (
    <Box title="서버 경보와 AI 실패" note="경보는 결제 부분 취소, 익명 생성 상한, 초대 보상 상한, 메일 실패처럼 사람이 봐야 하는 일이에요. 비어 있으면 괜찮은 거예요.">
      {err && <p style={{ color: K.red, fontSize: 13.5 }}>{err}</p>}
      <p style={{ fontSize: 13.5, color: K.ink2, margin: '0 0 8px' }}>기간 안 AI 실패 {fmt(aiFail)}건</p>
      <Table head={['언제', '종류', '내용']} rows={(data?.alerts || []).slice(0, 15).map((a) => [timeText(a.at), a.kind, a.detail.slice(0, 120)])} />
      {data && data.failures.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Table head={['날짜', '콘텐츠', '단계', '내용', '회원 ID']} rows={data.failures.slice(0, 10).map((f) => [f.day, f.type, f.stage, f.message.slice(0, 80), f.uid ? `${f.uid.slice(0, 8)}…` : ''])} />
        </div>
      )}
    </Box>
  );
}
