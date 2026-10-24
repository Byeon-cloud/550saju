/**
 * 관리자 v4 — 전략 성과 (2026-10-24, 오너 지시 '어떤 전략은 며칠 했고 효율은 어땠는지')
 *   시험 목록(mktExperiments)과 광고비 장부(adSpend)는 서버 adminStrategyData(functions/src/admin/strategy.ts),
 *   들어온 사람, 사주 입력, 충전 화면, 결제, 매출은 하루 요약(statsDaily.channels, 기기의 그날 첫 출처)을 여기서 더한다.
 *   판정 기준(2026-10-20 마케팅 오더): 결제한 사람 한 명당 비용 4,000원 이하 키움, 1만 원까지 하나 바꿔 더, 넘으면 멈춤.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { callAdmin, fmt, pct, shortDay, won, SOURCE_NAME } from './api';
import type { DayStats } from './api';
import { Box, K, Table, Tile, grid } from './ui';

interface Experiment {
  id: string; name: string; hypothesis: string; channel: string; metricKey: string; start: string; end: string; status: string;
  costNote: string; target: string; next: string; now: string; order: number;
  /** 화면에서 고친 값. status, end 가 null 이면 고치지 않은 것('' 는 지운 것) */
  edit: { status: string | null; end: string | null; note: string; at: number } | null;
  syncedAt?: number;
}
interface Spend { id: string; day: string; channel: string; amount: number; imp: number; clk: number; note: string; source: string; updatedAt: number }
interface StrategyData { from: string; to: string; experiments: Experiment[]; spend: Spend[] }

const PAID = ['meta', 'naver', 'tossads'];
const ORGANIC = ['toss_app', '출처 없음', 'seo', 'email', 'invite', 'share', 'threads'];
const STATUSES = ['준비', '대기', '진행', '멈춤', '종료', '기각'];
const STATUS_RANK: Record<string, number> = { 진행: 0, 멈춤: 1, 준비: 2, 대기: 2, 종료: 3, 기각: 4 };
/** '진행(웹 라이브, 앱은 다음 번들)'처럼 덧붙인 상태도 앞 두 글자로 줄 세운다 */
const rankOf = (status: string) => STATUS_RANK[status.slice(0, 2)] ?? 5;
/** experiments.json 의 channel 에는 들어온 곳(utm_source) 말고 'web', '앱, 웹' 같은 플랫폼 메모도 섞여 있다. 들어온 곳만 숫자를 센다 */
const isSource = (c: string) => /^[a-z0-9_]{2,24}$/.test(c) && !['web', 'app', 'apps_in_toss', 'ait'].includes(c);
const SPEND_SOURCE: Record<string, string> = { naver_api: '네이버 API', meta_report: '메타 보고서', manual: '직접 넣음' };
const DAY_RE = /\d{4}-\d{2}-\d{2}/;
const chName = (c: string) => SOURCE_NAME[c] || (c === 'tossads' ? '토스애즈' : c === 'email' ? '메일' : c === 'creator' ? '크리에이터' : c);

const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

type Sum = { visitors: number; inputs: number; results: number; chargeOpen: number; payers: number; revenue: number; covered: number };
const emptySum = (): Sum => ({ visitors: 0, inputs: 0, results: 0, chargeOpen: 0, payers: 0, revenue: 0, covered: 0 });

/** 한 채널의 [from, to] 합 (사람 수는 날마다 센 것을 더한 값) */
function chSum(all: DayStats[], channel: string, from: string, to: string): Sum {
  const s = emptySum();
  for (const d of all) {
    if (d.day < from || d.day > to) continue;
    s.covered += 1;
    const r = d.channels?.[channel];
    if (!r) continue;
    s.visitors += r.visitors || 0; s.inputs += r.inputs || 0; s.results += r.results || 0;
    s.chargeOpen += r.chargeOpen || 0; s.payers += r.payers || 0; s.revenue += r.revenue || 0;
  }
  return s;
}
const spendSum = (spend: Spend[], channel: string, from: string, to: string) =>
  spend.filter((x) => x.channel === channel && x.day >= from && x.day <= to).reduce((a, x) => a + x.amount, 0);

/** 결제 한 명당 비용으로 판정 (비용이 없거나 적으면 판정하지 않는다) */
function verdict(cost: number, payers: number): { text: string; color: string } {
  if (!(cost > 0)) return { text: '-', color: K.mute };
  if (!payers) return cost >= 10000 ? { text: '멈춤 (결제 0)', color: K.red } : { text: '더 보기', color: K.mute };
  const per = cost / payers;
  if (per <= 4000) return { text: '키움', color: K.green };
  if (per <= 10000) return { text: '하나 바꿔 더', color: K.goldDeep };
  return { text: '멈춤', color: K.red };
}

export function Strategy({ all }: { all: DayStats[] }) {
  const [data, setData] = useState<StrategyData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setBusy(true); setError('');
    callAdmin<StrategyData>('adminStrategyData', { days: 180 })
      .then(setData)
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const today = todayKst();
  const firstLoaded = all.length ? all[0].day : today;

  const rows = useMemo(() => {
    if (!data) return [];
    return data.experiments.map((x) => {
      const status = x.edit?.status ?? x.status ?? '';
      const endRaw = x.edit?.end ?? x.end ?? '';
      const start = (x.start.match(DAY_RE) || [''])[0];
      const end = (endRaw.match(DAY_RE) || [''])[0];
      const started = !!start && start <= today && !['준비', '대기', '기각'].includes(status.slice(0, 2));
      // 앞날로 적은 끝 날짜(끝낼 예정)는 오늘까지만 센다
      const ended = !!end && end <= today;
      const until = ended ? end : today;
      const runDays = started ? Math.max(0, dayDiff(start, until) + 1) : 0;
      const clipped = started && start < firstLoaded;
      // 숫자와 비용을 같은 기간으로 센다(불러온 날보다 앞에서 시작했으면 둘 다 불러온 첫날부터)
      const from = clipped ? firstLoaded : start;
      const m = started && isSource(x.channel) ? chSum(all, x.channel, from, until) : null;
      const cost = started && isSource(x.channel) ? spendSum(data.spend, x.channel, from, until) : 0;
      return { x, status, start, end, ended, started, runDays, m, cost, clipped };
    }).sort((a, b) => rankOf(a.status) - rankOf(b.status) || (b.start || '').localeCompare(a.start || '') || a.x.id.localeCompare(b.x.id, 'en', { numeric: true }));
  }, [data, all, today, firstLoaded]);

  // 같은 채널을 함께 쓰는 진행 중 시험 (숫자가 겹친다)
  const shared = useMemo(() => {
    const n: Record<string, number> = {};
    rows.filter((r) => r.started && isSource(r.x.channel) && !r.ended).forEach((r) => { n[r.x.channel] = (n[r.x.channel] || 0) + 1; });
    return n;
  }, [rows]);

  // 유료 채널: 장부에 한 번이라도 있거나 기본 셋. 토스 앱(혜택탭 포인트 비용을 적어 둔 곳)처럼 원래 공짜로도 오는 곳은 광고 합계에서 뺀다
  const paid = useMemo(() => [...new Set([...PAID, ...(data?.spend || []).map((s) => s.channel)])].filter((c) => !ORGANIC.includes(c)), [data]);
  const loadedSpend = useMemo(() => (data?.spend || []).filter((s) => s.day >= firstLoaded), [data, firstLoaded]);
  const paidTotal = useMemo(() => {
    const t = { cost: 0, ...emptySum(), coPayers: 0, coDays: 0 };
    // 충전 화면 수는 하루 요약 계산 판 6부터 있다. '충전 화면 → 결제'는 그 칸이 있는 날만으로 센다(옛 판 날을 섞으면 100%를 넘기도 한다)
    const withCo = all.filter((d) => (d.v || 0) >= 6);
    t.coDays = withCo.length;
    for (const c of paid) {
      const s = chSum(all, c, firstLoaded, today);
      t.cost += spendSum(loadedSpend, c, firstLoaded, today);
      t.visitors += s.visitors; t.inputs += s.inputs; t.payers += s.payers; t.revenue += s.revenue;
      const co = chSum(withCo, c, firstLoaded, today);
      t.chargeOpen += co.chargeOpen; t.coPayers += co.payers;
    }
    return t;
  }, [paid, all, loadedSpend, firstLoaded, today]);

  // 날마다 유료 채널
  const dailyPaid = useMemo(() => {
    const out: { day: string; channel: string; cost: number | null; r: Sum }[] = [];
    for (const d of [...all].reverse()) {
      for (const c of paid) {
        const sp = loadedSpend.filter((s) => s.day === d.day && s.channel === c);
        const r = chSum([d], c, d.day, d.day);
        if (!sp.length && !r.visitors) continue;
        out.push({ day: d.day, channel: c, cost: sp.length ? sp.reduce((a, s) => a + s.amount, 0) : null, r });
      }
    }
    return out;
  }, [all, paid, loadedSpend]);

  // 채널 전체 (불러온 기간)
  const channels = useMemo(() => {
    const names = new Set<string>();
    all.forEach((d) => Object.keys(d.channels || {}).forEach((k) => names.add(k)));
    return [...names].map((c) => ({ c, s: chSum(all, c, firstLoaded, today), cost: spendSum(loadedSpend, c, firstLoaded, today) }))
      .filter((x) => x.s.visitors > 0 || x.cost > 0)
      .sort((a, b) => b.s.revenue - a.s.revenue || b.s.visitors - a.s.visitors);
  }, [all, loadedSpend, firstLoaded, today]);

  if (error) return <p style={{ color: K.red, fontSize: 14 }}>불러오지 못했어요: {error}</p>;
  if (!data) return <p style={{ fontSize: 14, color: K.mute }}>{busy ? '시험 목록과 광고비를 불러오는 중이에요.' : ''}</p>;

  const cell = (v: string, color?: string) => <span style={{ color: color || K.ink, fontWeight: color ? 700 : 400 }}>{v}</span>;

  return (
    <div>
      <Box title={`유료 광고 합계 (${shortDay(firstLoaded)} ~ 오늘)`}
        note="광고비는 광고비 장부, 나머지는 기기의 그날 첫 출처로 센 하루 요약을 더한 값이에요(같은 사람이 이틀 오면 두 번). 매출은 충전 완료 기록의 금액이에요. 기간은 위의 7일, 14일 등을 두 배로 불러온 범위예요.">
        <div style={grid(150)}>
          <Tile label="광고비" value={won(paidTotal.cost)} strong />
          <Tile label="광고로 온 매출" value={won(paidTotal.revenue)} sub={`결제 ${paidTotal.payers}명`} />
          <Tile label="매출 ÷ 광고비" value={pct(paidTotal.revenue, paidTotal.cost)} sub="100%를 넘어야 남아요" />
          <Tile label="결제 한 명당 광고비" value={paidTotal.payers ? won(paidTotal.cost / paidTotal.payers) : '-'} sub="4,000원 이하면 키움" />
          <Tile label="사주 입력 한 명당" value={paidTotal.inputs ? won(paidTotal.cost / paidTotal.inputs) : '-'} sub={`입력 ${fmt(paidTotal.inputs)}명`} />
          <Tile label="충전 화면 → 결제" value={pct(paidTotal.coPayers, paidTotal.chargeOpen)} sub={`충전 화면 ${fmt(paidTotal.chargeOpen)}명${paidTotal.coDays < all.length ? `, ${all.length}일 중 ${paidTotal.coDays}일` : ''}`} />
        </div>
      </Box>

      <Box title="전략별 성과"
        right={<button type="button" onClick={load} disabled={busy} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${K.line}`, background: K.surface, fontSize: 13, fontWeight: 700, color: K.ink, cursor: busy ? 'wait' : 'pointer' }}>{busy ? '불러오는 중…' : '새로 불러오기'}</button>}
        note="며칠은 시작한 날부터 끝난 날(없으면 오늘)까지예요. 채널이 없는 시험(화면 고침 등)은 숫자 대신 메모를 보세요. '앞 n일 빠짐'은 불러온 기간 앞에서 시작한 시험이에요. 위에서 60일을 고르면 더 앞까지 봅니다. 같은 채널을 함께 쓰는 시험은 숫자가 겹쳐요.">
        <Table
          head={['시험', '상태', '채널', '기간', '며칠', '비용', '들어옴', '사주 입력', '충전 화면', '결제', '매출', '결제 1명당', '매출÷비용', '판정']}
          align={['l', 'l', 'l', 'l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'l']}
          rows={rows.map(({ x, status, start, end, ended, started, runDays, m, cost, clipped }) => {
            const v = verdict(cost, m?.payers || 0);
            const missingFront = clipped ? Math.max(0, dayDiff(start, firstLoaded)) : 0;
            return [
              <span title={x.hypothesis}>{x.id} {x.name.length > 26 ? `${x.name.slice(0, 26)}…` : x.name}</span>,
              status || '-',
              x.channel ? (isSource(x.channel) ? `${chName(x.channel)}${shared[x.channel] > 1 && !ended ? ' (겹침)' : ''}${x.channel === 'toss_app' ? ' (공짜 유입 섞임)' : ''}` : `${x.channel.slice(0, 14)} (유입 아님)`) : '-',
              started ? `${shortDay(start)} ~ ${ended ? shortDay(end) : end ? `진행 중(${shortDay(end)} 끝 예정)` : '진행 중'}` : (x.start ? x.start.slice(0, 18) : '-'),
              started ? `${runDays}일` : '-',
              cost ? `${won(cost)}${clipped ? ' (불러온 기간)' : ''}` : (x.costNote ? x.costNote.slice(0, 16) : '-'),
              m ? fmt(m.visitors) : '-',
              m ? `${fmt(m.inputs)}${m.visitors ? ` (${pct(m.inputs, m.visitors)})` : ''}` : '-',
              m ? fmt(m.chargeOpen) : '-',
              m ? fmt(m.payers) : '-',
              m ? (m.revenue ? won(m.revenue) : '0원') : '-',
              m && cost && m.payers ? won(cost / m.payers) : '-',
              m && cost ? pct(m.revenue, cost) : '-',
              cell(clipped ? `${v.text} (앞 ${missingFront}일 빠짐)` : v.text, v.color),
            ];
          })}
        />
      </Box>

      <ExperimentEditor experiments={data.experiments} onSaved={load} />

      <Box title="날마다 유료 광고" note="'장부 없음'은 그날 광고로 들어온 사람은 있는데 광고비를 아직 안 넣은 날이에요. 아래에서 넣어 주세요.">
        <Table
          head={['날짜', '채널', '광고비', '들어옴', '사주 입력', '충전 화면', '결제', '매출', '입력 1명당']}
          align={['l', 'l', 'r', 'r', 'r', 'r', 'r', 'r', 'r']}
          rows={dailyPaid.map(({ day, channel, cost, r }) => [
            shortDay(day), chName(channel), cost == null ? (day === today ? cell('오늘(밤 9시에 넣음)') : cell('장부 없음', K.red)) : won(cost), fmt(r.visitors), fmt(r.inputs), fmt(r.chargeOpen), fmt(r.payers),
            r.revenue ? won(r.revenue) : '-', cost && r.inputs ? won(cost / r.inputs) : '-',
          ])}
        />
      </Box>

      <Box title="들어온 곳 전체 (불러온 기간)">
        <Table
          head={['들어온 곳', '들어옴', '사주 입력', '입력률', '충전 화면', '결제', '매출', '광고비', '결제 1명당']}
          align={['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']}
          rows={channels.map(({ c, s, cost }) => [
            chName(c), fmt(s.visitors), fmt(s.inputs), pct(s.inputs, s.visitors), fmt(s.chargeOpen), fmt(s.payers), s.revenue ? won(s.revenue) : '-',
            cost ? won(cost) : '-', cost && s.payers ? won(cost / s.payers) : '-',
          ])}
        />
      </Box>

      <SpendEditor spend={data.spend} onSaved={load} />
    </div>
  );
}

const input = { padding: '7px 9px', borderRadius: 8, border: `1px solid ${K.line}`, fontSize: 14, background: K.surface, color: K.ink } as const;
const btn = (primary = false) => ({ padding: '7px 12px', borderRadius: 8, border: `1px solid ${primary ? K.ink : K.line}`, background: primary ? K.ink : K.surface, color: primary ? '#F4EFE4' : K.ink, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }) as const;

function ExperimentEditor({ experiments, onSaved }: { experiments: Experiment[]; onSaved: () => void }) {
  const sorted = useMemo(() => [...experiments].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })), [experiments]);
  const [id, setId] = useState('');
  const x = sorted.find((e) => e.id === id) || null;
  const [status, setStatus] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  // 지금 보이는 값(화면에서 고친 값이 있으면 그것, 없으면 문서 값)
  const status0 = x ? (x.edit?.status ?? x.status ?? '') : '';
  const end0 = x ? (x.edit?.end ?? (x.end.match(DAY_RE) || [''])[0]) : '';
  const note0 = x?.edit?.note || '';
  // 칸을 채운 때의 값(기준). 저장은 이 기준과 달라진 칸만 보낸다
  const [base, setBase] = useState({ status: '', end: '', note: '' });
  const dirty = status !== base.status || end !== base.end || note !== base.note;
  useEffect(() => {
    if (!x) return;
    // 다른 시험을 골랐거나, 새로 불러온 값이 바뀌었는데 아직 손대지 않았으면 새 값으로 다시 채운다
    setStatus(status0); setEnd(end0); setNote(note0); setBase({ status: status0, end: end0, note: note0 }); setMsg('');
  }, [x?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!x || dirty) return;
    if (status0 === base.status && end0 === base.end && note0 === base.note) return;
    setStatus(status0); setEnd(end0); setNote(note0); setBase({ status: status0, end: end0, note: note0 });
  }, [status0, end0, note0]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!x || busy) return;
    if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) { setMsg('끝난 날은 2026-10-24 처럼 넣어 주세요'); return; }
    // 칸을 채운 뒤 다른 곳(문서 동기화, 다른 창)에서 값이 바뀌었으면 옛 값으로 덮지 않는다
    if (status0 !== base.status || end0 !== base.end) {
      setStatus(status0); setEnd(end0); setBase({ status: status0, end: end0, note: base.note });
      setMsg('그 사이 상태나 끝난 날이 바뀌었어요. 새 값으로 채웠으니 확인하고 다시 저장해 주세요');
      return;
    }
    setBusy(true); setMsg('');
    try {
      // 바꾼 칸만 보낸다. 메모만 고쳤는데 상태와 끝난 날까지 '화면 값'으로 굳으면 나중에 문서를 고쳐도 화면에 안 나온다
      const payload: Record<string, unknown> = { id: x.id };
      if (note !== base.note) payload.note = note;
      if (status !== base.status) payload.status = status;
      if (end !== base.end) payload.end = end;
      if (Object.keys(payload).length === 1) { setMsg('바꾼 것이 없어요'); return; }
      await callAdmin('adminSetExperiment', payload);
      setBase({ status, end, note }); // 저장한 값이 새 기준
      setMsg('저장했어요'); onSaved();
    } catch (e: any) { setMsg(`저장하지 못했어요: ${String(e?.message || e)}`); } finally { setBusy(false); }
  };
  return (
    <Box title="시험 하나 고치기" note="상태와 끝난 날, 메모는 이 화면에서 고친 값이 먼저 보여요(문서 동기화가 지우지 않아요). 새 시험은 docs/marketing/experiments.json 에 적고 scripts/ops/experiments_sync.cjs 로 올려요.">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={id} onChange={(e) => setId(e.target.value)} style={{ ...input, maxWidth: '100%' }} aria-label="시험 고르기">
          <option value="">시험 고르기</option>
          {sorted.map((e) => <option key={e.id} value={e.id}>{e.id} {e.name.slice(0, 30)}</option>)}
        </select>
      </div>
      {x && (
        <div style={{ marginTop: 10, background: K.surface, border: `1px solid ${K.line}`, borderRadius: 12, padding: 12, fontSize: 13.5, lineHeight: 1.7, color: K.ink2 }}>
          {x.hypothesis && <p style={{ margin: 0 }}><b>가설</b> {x.hypothesis}</p>}
          {x.target && <p style={{ margin: 0 }}><b>목표</b> {x.target}</p>}
          {x.costNote && <p style={{ margin: 0 }}><b>비용</b> {x.costNote}</p>}
          {x.now && <p style={{ margin: 0 }}><b>지금</b> {x.now}</p>}
          {x.next && <p style={{ margin: 0 }}><b>다음</b> {x.next}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
            <label style={{ fontSize: 13, color: K.mute }}>상태{' '}
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>
                {/* '진행(웹 라이브, 앱은 다음 번들)'처럼 문서에 덧붙인 상태도 그대로 고를 수 있게 맨 앞에 둔다 */}
                {(status0 && !STATUSES.includes(status0) ? [status0, ...STATUSES] : STATUSES).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13, color: K.mute }}>끝난 날{' '}
              <input value={end} onChange={(e) => setEnd(e.target.value.trim())} placeholder="2026-10-24" style={{ ...input, width: 120 }} />
            </label>
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="판정 메모 (왜 멈췄는지, 다음에 무엇을 바꿀지)" rows={2}
            style={{ ...input, width: '100%', marginTop: 8, boxSizing: 'border-box', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <button type="button" onClick={save} disabled={busy} style={btn(true)}>{busy ? '저장하는 중…' : '저장'}</button>
            {msg && <span style={{ fontSize: 13, color: msg.startsWith('저장했') ? K.green : K.red }}>{msg}</span>}
          </div>
        </div>
      )}
    </Box>
  );
}

function SpendEditor({ spend, onSaved }: { spend: Spend[]; onSaved: () => void }) {
  const [day, setDay] = useState(() => {
    const t = new Date(Date.now() + 9 * 3600e3 - 864e5);
    return t.toISOString().slice(0, 10);
  });
  const [channel, setChannel] = useState('meta');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState('');
  const recent = useMemo(() => [...spend].sort((a, b) => b.day.localeCompare(a.day) || a.channel.localeCompare(b.channel)).slice(0, 40), [spend]);
  const save = async (remove = false, target?: Spend) => {
    if (busy) return;
    const d = target ? target.day : day;
    const c = target ? target.channel : channel.trim().toLowerCase();
    const raw = String(amount).replace(/[,\s원]/g, '');
    const a = Number(raw);
    // '5만'처럼 숫자 아닌 글자가 섞이면 받지 않는다(글자를 지우면 5원으로 들어간다)
    if (!remove && !(/^\d+$/.test(raw) && a >= 0)) { setMsg('금액은 숫자로만 넣어 주세요(예: 7215 또는 7,215)'); return; }
    setBusy(true); setMsg('');
    try {
      await callAdmin('adminSetAdSpend', remove ? { day: d, channel: c, remove: true } : { day: d, channel: c, amount: a, note });
      setMsg(remove ? '지웠어요' : '저장했어요'); if (!remove) { setAmount(''); setNote(''); }
      onSaved();
    } catch (e: any) { setMsg(`저장하지 못했어요: ${String(e?.message || e)}`); } finally { setBusy(false); }
  };
  return (
    <Box title="광고비 장부" note="네이버는 scripts/ops/ad_spend_sync.cjs 가 API 로 채워요(매일 아침 성과판 작업). 메타와 토스애즈는 광고 관리자에서 본 하루 지출을 여기 넣어요. 같은 날, 같은 채널을 다시 넣으면 고쳐져요.">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={day} onChange={(e) => setDay(e.target.value.trim())} aria-label="날짜" style={{ ...input, width: 120 }} />
        <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="채널" style={input}>
          {['meta', 'naver', 'tossads', 'creator', 'toss_app'].map((c) => <option key={c} value={c}>{c === 'toss_app' ? '토스 혜택탭 포인트(앱 시험)' : chName(c)}</option>)}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="금액(원)" aria-label="금액" style={{ ...input, width: 110 }} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모(선택)" aria-label="메모" style={{ ...input, width: 160 }} />
        <button type="button" onClick={() => save(false)} disabled={busy} style={btn(true)}>{busy ? '저장하는 중…' : '넣기'}</button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('저장했') || msg.startsWith('지웠') ? K.green : K.red }}>{msg}</span>}
      </div>
      <div style={{ marginTop: 10 }}>
        <Table head={['날짜', '채널', '광고비', '노출', '클릭', '어디서', '메모', '']} align={['l', 'l', 'r', 'r', 'r', 'l', 'l', 'l']}
          rows={recent.map((s) => [
            s.day, chName(s.channel), won(s.amount), s.imp ? fmt(s.imp) : '-', s.clk ? fmt(s.clk) : '-', SPEND_SOURCE[s.source] || s.source || '-', s.note || '',
            <button type="button" onClick={() => { if (armed === s.id) { setArmed(''); save(true, s); } else setArmed(s.id); }}
              style={{ ...btn(), padding: '3px 8px', fontSize: 12.5, color: armed === s.id ? K.red : K.ink }}>{armed === s.id ? '한 번 더 누르면 지워요' : '지우기'}</button>,
          ])} />
      </div>
    </Box>
  );
}
