/* 단계별 전환 퍼널 (읽기만) — 사용: node scripts/ops/funnel.cjs [일수=30] [출처필터]
 *   기기(did) 기준, 오너 기기 제외. 단계: 앱 열기 → 사주 입력 화면 → 사주 입력 완료 → 첫 결과 → 결제 시도(잔액 부족 또는 충전 화면) → 충전 완료
 *   출처: utm.source / medium / campaign (1.5.8 부터 토스 referrer 도 잡힘). 첫날 전환(같은 날 충전)도 따로. */
const { query } = require('./fs.cjs');
const N = Number(process.argv[2] || 30);
const FILTER = process.argv[3] || '';
const days = [];
for (let i = 1; i <= N; i++) days.push(new Date(Date.now() + 9 * 3600e3 - i * 864e5).toISOString().slice(0, 10));
const NAMES = ['app_open', 'page_view', 'profile_created', 'content_result', 'insufficient_balance', 'charge_open', 'charge_complete', 'content_purchase'];
(async () => {
  const rows = [];
  for (let i = 0; i < days.length; i += 10) {
    const chunk = days.slice(i, i + 10);
    for (const name of NAMES) {
      const r = await query({
        from: [{ collectionId: 'analytics' }],
        where: { compositeFilter: { op: 'AND', filters: [
          { fieldFilter: { field: { fieldPath: 'day' }, op: 'IN', value: { arrayValue: { values: chunk.map((d) => ({ stringValue: d })) } } } },
          { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: name } } },
        ] } },
        select: { fields: ['name', 'did', 'uid', 'props', 'internal', 'day', 'demo', 'utm'].map((f) => ({ fieldPath: f })) },
      });
      rows.push(...r.filter((x) => !x.internal));
    }
  }
  const who = (x) => x.did || x.uid || '?';
  const srcKey = (u) => (u ? [u.source || '?', u.medium || '', u.campaign || ''].filter(Boolean).join('/') : '없음');
  const first = new Map(); // 기기별 첫 방문일, 첫 출처
  for (const x of rows.sort((a, b) => (a.day < b.day ? -1 : 1))) {
    const d = who(x);
    if (!first.has(d)) first.set(d, { day: x.day, src: srcKey(x.utm) });
    else if (first.get(d).src === '없음' && x.utm) first.get(d).src = srcKey(x.utm);
  }
  const step = {
    open: (x) => x.name === 'app_open',
    inputView: (x) => x.name === 'page_view' && /^\/input/.test(String(x.props?.page_path || '')),
    inputDone: (x) => x.name === 'profile_created',
    result: (x) => x.name === 'content_result',
    payTry: (x) => x.name === 'insufficient_balance' || x.name === 'charge_open',
    paid: (x) => x.name === 'charge_complete',
  };
  const bySrc = new Map();
  for (const x of rows) {
    const d = who(x); const src = first.get(d)?.src || '없음';
    if (FILTER && !src.includes(FILTER)) continue;
    const b = bySrc.get(src) || Object.fromEntries(Object.keys(step).map((k) => [k, new Set()]));
    for (const [k, f] of Object.entries(step)) if (f(x)) b[k].add(d);
    bySrc.set(src, b);
  }
  const sameDayPaid = new Set(rows.filter((x) => x.name === 'charge_complete' && first.get(who(x))?.day === x.day).map(who));
  const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-');
  console.log(`최근 ${N}일 단계별 전환 (기기 수, 오너 제외, 첫 출처 기준)${FILTER ? ' 필터 ' + FILTER : ''}`);
  console.log('출처 | 열기 | 입력 화면 | 입력 완료 | 첫 결과 | 결제 시도 | 충전 | 열기→충전');
  const order = [...bySrc.entries()].sort((a, b) => b[1].open.size - a[1].open.size);
  const tot = Object.fromEntries(Object.keys(step).map((k) => [k, new Set()]));
  for (const [src, b] of order) {
    for (const k of Object.keys(step)) for (const d of b[k]) tot[k].add(d);
    if (b.open.size < 3 && b.paid.size === 0) continue;
    console.log(`${src} | ${b.open.size} | ${b.inputView.size} (${pct(b.inputView.size, b.open.size)}) | ${b.inputDone.size} (${pct(b.inputDone.size, b.inputView.size)}) | ${b.result.size} | ${b.payTry.size} | ${b.paid.size} | ${pct(b.paid.size, b.open.size)}`);
  }
  console.log(`합계 | ${tot.open.size} | ${tot.inputView.size} (${pct(tot.inputView.size, tot.open.size)}) | ${tot.inputDone.size} (${pct(tot.inputDone.size, tot.inputView.size)}) | ${tot.result.size} (${pct(tot.result.size, tot.open.size)}) | ${tot.payTry.size} | ${tot.paid.size} | ${pct(tot.paid.size, tot.open.size)}`);
  console.log(`입력 완료 → 충전 ${pct(tot.paid.size, tot.inputDone.size)}, 결제 시도 → 충전 ${pct(tot.paid.size, tot.payTry.size)}, 충전 중 첫날 ${sameDayPaid.size}/${tot.paid.size}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
