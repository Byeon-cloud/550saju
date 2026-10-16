/* 충전 화면을 연 사람은 누구인가 (2026-10-17, 읽기 전용) — 사주 입력 여부, 직전에 본 화면 */
const { query } = require('./fs.cjs');
const N = Number(process.argv[2] || 14);
const kstDay = (o) => new Date(Date.now() + 9 * 3600e3 - o * 864e5).toISOString().slice(0, 10);
const days = []; for (let i = N - 1; i >= 0; i--) days.push(kstDay(i));
(async () => {
  const rows = [];
  for (let i = 0; i < days.length; i += 10) {
    const chunk = days.slice(i, i + 10);
    for (const name of ['page_view', 'profile_created', 'charge_open', 'charge_complete', 'insufficient_balance', 'content_result']) {
      const r = await query({ from: [{ collectionId: 'analytics' }], where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'day' }, op: 'IN', value: { arrayValue: { values: chunk.map((d) => ({ stringValue: d })) } } } },
        { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: name } } }] } },
        select: { fields: ['name', 'did', 'uid', 'props', 'internal', 'day', 'ts', 'createdAt'].map((f) => ({ fieldPath: f })) } });
      rows.push(...r.filter((x) => !x.internal));
    }
  }
  const who = (x) => x.did || x.uid || '?';
  const t = (x) => Date.parse(x.createdAt || x.ts || 0) || 0;
  const chargers = new Set(rows.filter((x) => x.name === 'charge_open').map(who));
  const inputters = new Set(rows.filter((x) => x.name === 'profile_created').map(who));
  const resulters = new Set(rows.filter((x) => x.name === 'content_result').map(who));
  const insuff = new Set(rows.filter((x) => x.name === 'insufficient_balance').map(who));
  const buyers = new Set(rows.filter((x) => x.name === 'charge_complete').map(who));
  const c = [...chargers];
  console.log('충전 화면 연 사람', c.length, '| 이 기간 사주 입력함', c.filter((d) => inputters.has(d)).length, '| 결과 받음', c.filter((d) => resulters.has(d)).length, '| 운 모자라서 옴', c.filter((d) => insuff.has(d)).length, '| 산 사람', c.filter((d) => buyers.has(d)).length);
  // 충전 화면 직전에 본 화면
  const pv = rows.filter((x) => x.name === 'page_view').sort((a, b) => t(a) - t(b));
  const prev = {};
  for (const d of c) {
    const mine = pv.filter((x) => who(x) === d);
    const i = mine.findIndex((x) => /^\/charge/.test(String(x.props?.page_path || '')));
    const p = i > 0 ? String(mine[i - 1].props?.page_path || '').replace(/\?.*$/, '').replace(/\/[A-Za-z0-9_-]{8,}$/, '/:id') : (i === 0 ? '(첫 화면이 충전)' : '?');
    prev[p] = (prev[p] || 0) + 1;
  }
  console.log('충전 직전 화면', Object.entries(prev).sort((a, b) => b[1] - a[1]).slice(0, 10));
  // 충전 화면에서 나간 뒤
  const next = {};
  for (const d of c) {
    const mine = pv.filter((x) => who(x) === d);
    const i = mine.findIndex((x) => /^\/charge/.test(String(x.props?.page_path || '')));
    const n = i >= 0 && mine[i + 1] ? String(mine[i + 1].props?.page_path || '').replace(/\?.*$/, '').replace(/\/[A-Za-z0-9_-]{8,}$/, '/:id') : '(나감)';
    next[n] = (next[n] || 0) + 1;
  }
  console.log('충전 다음 화면', Object.entries(next).sort((a, b) => b[1] - a[1]).slice(0, 10));
})().catch((e) => console.error(e.message));
