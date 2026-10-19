/**
 * 관리자 v4 — 한눈에 (2026-10-19 고도화)
 *   읽는 순서: 기간 매출(가장 큰 숫자) → 핵심 지표 8칸(추세선, 앞 기간 대비) → 날짜별 매출과 방문 → 앱과 웹 나란히 →
 *   전환 깔때기(앱, 웹) → 재방문 → 확인할 일(서버 경보, AI 실패).
 *   숫자는 서버 하루 요약(statsDaily). 사람 수는 날마다 센 것을 더한 값.
 */
import { useEffect, useState } from 'react';
import { callAdmin, fmt, won, pct, sumSides, sideOf, timeText } from './api';
import type { DayStats, PlatFilter, Side } from './api';
import { Box, Table, K } from './ui';
import { Spark, DayColumns, Funnel, PLAT_COLOR } from './charts';

const delta = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
/** 증감 글자: 200% 넘게 늘면 'N배'로 (캠페인 날이 끼면 +9,846% 처럼 읽기 어렵다) */
const dText = (d: number): string => (d >= 200 ? `${Math.round(d / 100 + 1)}배` : `${Math.abs(d)}%`);
const ai = (d: DayStats) => d.ai?.costKrw || 0;

function Metric({ label, value, sub, d, upGood = true, spark, color }: { label: string; value: string; sub?: string; d: number | null; upGood?: boolean; spark?: number[]; color?: string }) {
  const good = d == null || d === 0 ? null : (d > 0) === upGood;
  return (
    <div style={{ background: K.surface, border: `1px solid ${K.line}`, borderRadius: 12, padding: '12px 14px', minWidth: 0 }}>
      <div style={{ fontSize: 13, color: K.mute }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: K.ink, whiteSpace: 'nowrap' }}>{value}</span>
        {d != null && (
          <span style={{ fontSize: 13, fontWeight: 700, color: good == null ? K.mute : good ? K.green : K.red, whiteSpace: 'nowrap' }}>
            {d > 0 ? '▲' : d < 0 ? '▼' : ''}{dText(d)}
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: K.mute, marginTop: 2 }}>{sub}</div>}
      {spark && <Spark values={spark} color={color} />}
    </div>
  );
}

export function Overview({ days, prev, plat }: { days: DayStats[]; prev: DayStats[]; plat: PlatFilter }) {
  const cur = sumSides(days, plat);
  const bef = sumSides(prev, plat);
  const app = sumSides(days, 'app');
  const web = sumSides(days, 'web');
  const appP = sumSides(prev, 'app');
  const webP = sumSides(prev, 'web');
  const aiCur = days.reduce((s, d) => s + ai(d), 0);
  const aiPrev = prev.reduce((s, d) => s + ai(d), 0);
  const net = cur.revenue - cur.refundAmount - aiCur;
  const netPrev = bef.revenue - bef.refundAmount - aiPrev;
  const conv = cur.visitors ? cur.payers / cur.visitors : 0;
  const convPrev = bef.visitors ? bef.payers / bef.visitors : 0;
  const arppu = cur.payers ? cur.revenue / cur.payers : 0;
  const arppuPrev = bef.payers ? bef.revenue / bef.payers : 0;
  const aiRate = cur.revenue ? aiCur / cur.revenue : 0;
  const aiRatePrev = bef.revenue ? aiPrev / bef.revenue : 0;
  const series = (f: (s: Side) => number) => days.map((d) => f(sideOf(d, plat)));
  const lineColor = plat === 'app' ? PLAT_COLOR.app : plat === 'web' ? PLAT_COLOR.web : '#8C8478';
  const rangeText = `${days[0]?.day || ''} ~ ${days[days.length - 1]?.day || ''}`;
  const platSeries = (get: (s: Side) => number) => [
    ...(plat !== 'web' ? [{ key: 'app', label: '앱', color: PLAT_COLOR.app, get: (d: DayStats) => get(d.app) }] : []),
    ...(plat !== 'app' ? [{ key: 'web', label: '웹', color: PLAT_COLOR.web, get: (d: DayStats) => get(d.web) }] : []),
  ];

  return (
    <div>
      {/* 1. 가장 큰 숫자: 기간 매출 */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ background: K.surface, border: `1px solid ${K.line}`, borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 13.5, color: K.mute }}>기간 매출 ({rangeText})</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: K.ink, lineHeight: 1.15 }}>{won(cur.revenue)}</span>
            {delta(cur.revenue, bef.revenue) != null && (
              <span style={{ fontSize: 15, fontWeight: 700, color: cur.revenue >= bef.revenue ? K.green : K.red }}>
                {cur.revenue >= bef.revenue ? '▲' : '▼'}{dText(delta(cur.revenue, bef.revenue) || 0)} 앞 기간 대비
              </span>
            )}
          </div>
          {plat === 'all' && cur.revenue > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
                <div style={{ width: `${(app.revenue / cur.revenue) * 100}%`, background: PLAT_COLOR.app }} />
                <div style={{ width: `${(web.revenue / cur.revenue) * 100}%`, background: PLAT_COLOR.web }} />
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: K.ink2, marginTop: 6 }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: PLAT_COLOR.app, marginRight: 6 }} />앱 {won(app.revenue)}</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: PLAT_COLOR.web, marginRight: 6 }} />웹 {won(web.revenue)}</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ background: K.surface, border: `1px solid ${K.line}`, borderRadius: 12, padding: '16px 18px', display: 'grid', gap: 10 }}>
          <Row k="남는 돈(매출 − 환불 − AI 비용)" v={won(net)} d={delta(net, netPrev)} />
          <Row k="AI 원가율(AI 비용 ÷ 매출)" v={cur.revenue ? `${Math.round(aiRate * 100)}%` : '매출 없음'} d={aiRatePrev ? Math.round(((aiRate - aiRatePrev) / aiRatePrev) * 100) : null} upGood={false} />
          <Row k="환불" v={`${won(cur.refundAmount)} (${fmt(cur.refunds)}건)`} d={null} />
          <p style={{ fontSize: 12, color: K.mute, margin: 0 }}>결제 수수료와 서버비는 빠져 있어요. 토스 앱 결제는 토스 몫을 떼기 전 금액이에요.</p>
        </div>
      </section>

      {/* 2. 핵심 지표 */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8, marginBottom: 18 }}>
        <Metric label="방문한 기기" value={fmt(cur.visitors)} d={delta(cur.visitors, bef.visitors)} spark={series((s) => s.visitors)} color={lineColor} />
        <Metric label="처음 온 기기" value={fmt(cur.newDevices)} d={delta(cur.newDevices, bef.newDevices)} spark={series((s) => s.newDevices)} color={lineColor} />
        <Metric label="사주 입력" value={fmt(cur.inputs)} sub={`방문 대비 ${pct(cur.inputs, cur.visitors)}`} d={delta(cur.inputs, bef.inputs)} spark={series((s) => s.inputs)} color={lineColor} />
        <Metric label="결과 받음" value={fmt(cur.results)} d={delta(cur.results, bef.results)} spark={series((s) => s.results)} color={lineColor} />
        <Metric label="결제한 사람" value={fmt(cur.payers)} sub={`처음 결제 ${fmt(cur.newPayers)}명, ${fmt(cur.orders)}건`} d={delta(cur.payers, bef.payers)} spark={series((s) => s.payers)} color={lineColor} />
        <Metric label="결제 전환율(결제 ÷ 방문)" value={cur.visitors ? `${(conv * 100).toFixed(conv < 0.01 ? 2 : 1)}%` : '-'} d={convPrev ? Math.round(((conv - convPrev) / convPrev) * 100) : null} />
        <Metric label="결제 한 명당 매출" value={cur.payers ? won(arppu) : '-'} d={delta(arppu, arppuPrev)} />
        <Metric label="AI 비용" value={won(aiCur)} d={delta(aiCur, aiPrev)} upGood={false} spark={days.map(ai)} />
      </section>

      {/* 3. 날짜별 */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 10, marginBottom: 18 }}>
        <DayColumns title="날짜별 매출" days={days} fmt={won} series={platSeries((s) => s?.revenue || 0)} />
        <DayColumns title="날짜별 방문한 기기" days={days} fmt={fmt} series={platSeries((s) => s?.visitors || 0)} />
      </section>

      {/* 4. 앱과 웹 나란히 */}
      <Box title="앱과 웹 나란히" note="괄호는 앞 같은 길이 기간 대비 증감이에요.">
        <Table head={['지표', '앱', '웹', '합계']} align={['l', 'r', 'r', 'r']} rows={[
          ['방문한 기기', both(app.visitors, appP.visitors), both(web.visitors, webP.visitors), fmt(app.visitors + web.visitors)],
          ['처음 온 기기', both(app.newDevices, appP.newDevices), both(web.newDevices, webP.newDevices), fmt(app.newDevices + web.newDevices)],
          ['사주 입력', both(app.inputs, appP.inputs), both(web.inputs, webP.inputs), fmt(app.inputs + web.inputs)],
          ['결과 받음', both(app.results, appP.results), both(web.results, webP.results), fmt(app.results + web.results)],
          ['운이 모자라 충전 화면으로', both(app.payTry, appP.payTry), both(web.payTry, webP.payTry), fmt(app.payTry + web.payTry)],
          ['결제 전 로그인 창', '해당 없음', both(web.loginGate, webP.loginGate), fmt(web.loginGate)],
          ['결제한 사람', both(app.payers, appP.payers), both(web.payers, webP.payers), fmt(app.payers + web.payers)],
          ['매출', bothWon(app.revenue, appP.revenue), bothWon(web.revenue, webP.revenue), won(app.revenue + web.revenue)],
          ['결제 한 명당 매출', app.payers ? won(app.revenue / app.payers) : '-', web.payers ? won(web.revenue / web.payers) : '-', cur.payers ? won(arppu) : '-'],
          ['환불', won(app.refundAmount), won(web.refundAmount), won(app.refundAmount + web.refundAmount)],
          ['보내기(공유) 한 사람', both(app.shares, appP.shares), both(web.shares, webP.shares), fmt(app.shares + web.shares)],
        ]} />
      </Box>

      {/* 5. 전환 깔때기 */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, marginBottom: 18 }}>
        {plat !== 'web' && <Funnel title="앱 전환 (방문한 기기 대비)" color={PLAT_COLOR.app} steps={[
          { label: '방문한 기기', value: app.visitors }, { label: '사주 입력', value: app.inputs }, { label: '결과 받음', value: app.results },
          { label: '충전 화면으로', value: app.payTry }, { label: '결제한 사람', value: app.payers },
        ]} />}
        {plat !== 'app' && <Funnel title="웹 전환 (방문한 기기 대비)" color={PLAT_COLOR.web} steps={[
          { label: '방문한 기기', value: web.visitors }, { label: '사주 입력', value: web.inputs }, { label: '결과 받음', value: web.results },
          { label: '충전 화면으로', value: web.payTry }, { label: '결제한 사람', value: web.payers },
        ]} />}
      </section>

      {/* 6. 재방문 */}
      <Retention days={days} />

      {/* 7. 확인할 일 */}
      <AlertsBox days={days} />
    </div>
  );
}

function Row({ k, v, d, upGood = true }: { k: string; v: string; d: number | null; upGood?: boolean }) {
  const good = d == null || d === 0 ? null : (d > 0) === upGood;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
      <span style={{ fontSize: 13.5, color: K.mute }}>{k}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: K.ink, whiteSpace: 'nowrap' }}>
        {v}{d != null && <span style={{ fontSize: 12.5, fontWeight: 700, marginLeft: 6, color: good == null ? K.mute : good ? K.green : K.red }}>{d > 0 ? '▲' : d < 0 ? '▼' : ''}{dText(d)}</span>}
      </span>
    </div>
  );
}
const chg = (c: number, p: number) => { if (!(p > 0)) return ''; const d = Math.round(((c - p) / p) * 100); return d >= 200 ? ` (${Math.round(d / 100 + 1)}배)` : ` (${d >= 0 ? '+' : ''}${d}%)`; };
const both = (c: number, p: number) => `${fmt(c)}${chg(c, p)}`;
const bothWon = (c: number, p: number) => `${won(c)}${chg(c, p)}`;

function Retention({ days }: { days: DayStats[] }) {
  const rows = days.filter((d) => d.retention && (d.retention.app.cohort + d.retention.web.cohort) > 0);
  const sum = (p: 'app' | 'web', k: 'cohort' | 'd1' | 'w1') => {
    let n = 0; let base = 0;
    for (const d of rows) { const r = d.retention![p]; if (k === 'cohort') n += r.cohort; else if (r[k] != null) { n += r[k] as number; base += r.cohort; } }
    return { n, base };
  };
  const line = (p: 'app' | 'web') => {
    const c = sum(p, 'cohort').n; const d1 = sum(p, 'd1'); const w1 = sum(p, 'w1');
    return [p === 'app' ? '앱' : '웹', fmt(c), d1.base ? `${pct(d1.n, d1.base)} (${fmt(d1.n)}/${fmt(d1.base)})` : '-', w1.base ? `${pct(w1.n, w1.base)} (${fmt(w1.n)}/${fmt(w1.base)})` : '아직'];
  };
  return (
    <Box title="재방문" note="그날 처음 온 기기 중 다음 날 다시 온 비율과, 그 뒤 7일 안에 한 번이라도 다시 온 비율이에요. 7일이 아직 안 지난 날은 빼고 계산해요. 토스 콘솔의 'D7 재방문'과 세는 방식이 달라 숫자가 다를 수 있어요.">
      {rows.length === 0 ? <p style={{ fontSize: 13.5, color: K.mute, margin: 0 }}>재방문 기록은 요약을 다시 만든 날부터 보여요.</p> : (
        <Table head={['', '처음 온 기기', '다음 날 다시', '7일 안에 다시']} align={['l', 'r', 'r', 'r']} rows={[line('app'), line('web')]} />
      )}
    </Box>
  );
}

function AlertsBox({ days }: { days: DayStats[] }) {
  const [data, setData] = useState<{ alerts: { id: string; at: number; kind: string; detail: string }[]; failures: { day: string; type: string; stage: string; message: string; uid: string }[] } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { callAdmin('adminStats', { action: 'alerts' }).then(setData).catch((e) => setErr(String(e?.message || e))); }, []);
  const aiFail = days.reduce((s, d) => s + (d.aiFailures?.total || 0) + (d.ai?.fail || 0), 0);
  const csUn = days.reduce((s, d) => s + (d.cs?.grantedUn || 0), 0);
  const KIND: Record<string, string> = { iap_refund: '토스 앱 결제 환불(운 회수함)', portone_partial_cancel: '웹 부분 취소(회수할 운 정해야 함)', gen_volume: '생성량 경보선(하루 전체)', daily_mail_full: '아침 메일 발송 한도 꽉 참', daily_mail_near_limit: '아침 메일 발송 한도 가까움' };
  return (
    <Box title="확인할 일" note="서버 경보는 사람이 봐야 하는 일만 남겨요(환불 회수, 부분 취소, 상한 도달, 메일 실패 등). 비어 있으면 괜찮은 거예요.">
      {err && <p style={{ color: K.red, fontSize: 13.5 }}>{err}</p>}
      <p style={{ fontSize: 13.5, color: K.ink2, margin: '0 0 8px' }}>기간 안 AI 실패 {fmt(aiFail)}건, CS로 넣은 운 {fmt(csUn)}운</p>
      <Table head={['언제', '종류', '내용']} rows={(data?.alerts || []).slice(0, 15).map((a) => [timeText(a.at), KIND[a.kind] || a.kind, a.detail.slice(0, 120)])} />
      {data && data.failures.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Table head={['날짜', '콘텐츠', '단계', '내용', '회원 ID']} rows={data.failures.slice(0, 10).map((f) => [f.day, f.type, f.stage, f.message.slice(0, 80), f.uid ? `${f.uid.slice(0, 8)}…` : ''])} />
        </div>
      )}
    </Box>
  );
}
