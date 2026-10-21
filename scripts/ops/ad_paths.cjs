/* 광고 손님 동선 (읽기만) — 사용: node ad_paths.cjs 2026-10-20 2026-10-21
 *   광고(utm_source=meta, naver, tossads)로 들어온 기기마다 이벤트 순서를 모아, 단계별 도달 수와 마지막으로 본 화면을 센다.
 *   판정 숫자(ad_report.cjs)가 '왜'를 못 보여 줄 때 쓴다. 오너 기기 제외. */
const { query } = require('./fs.cjs');
const [from, to] = process.argv.slice(2);
const AD = new Set(['meta', 'naver', 'tossads', 'instagram', 'facebook']);
const days = [];
for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d = new Date(d.getTime() + 864e5)) days.push(d.toISOString().slice(0, 10));
(async () => {
  const rows = [];
  for (const day of days) {
    const r = await query({
      from: [{ collectionId: 'analytics' }],
      where: { fieldFilter: { field: { fieldPath: 'day' }, op: 'EQUAL', value: { stringValue: day } } },
      select: { fields: ['name', 'did', 'uid', 'props', 'utm', 'internal', 'plat', 'ts', 'path', 'page'].map((f) => ({ fieldPath: f })) },
    });
    rows.push(...r.filter((x) => !x.internal));
  }
  rows.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const who = (x) => x.did || x.uid || '?';
  const src = new Map();
  for (const x of rows) { const s = String(x.utm?.source || '').toLowerCase(); if (AD.has(s) && !src.has(who(x))) src.set(who(x), s + ' ' + (x.utm?.content || '-')); }
  const per = new Map();
  for (const x of rows) { const w = who(x); if (!src.has(w)) continue; const a = per.get(w) || []; a.push(x); per.set(w, a); }
  const STEPS = ['page_view', 'tti_open', 'cta_click', 'profile_created', 'manse_view', 'tojung_preview_view', 'content_result', 'daily_offer_view', 'content_open', 'charge_open', 'charge_login_gate', 'login_success', 'charge_failed', 'charge_complete', 'content_purchase'];
  const bySrc = new Map();
  for (const [w, evs] of per) {
    const s = src.get(w).split(' ')[0];
    const g = bySrc.get(s) || { n: 0, step: {}, last: {}, pages: {}, cta: {}, dur: [] };
    g.n++;
    const names = new Set(evs.map((e) => e.name));
    for (const st of STEPS) if (names.has(st)) g.step[st] = (g.step[st] || 0) + 1;
    const pv = evs.filter((e) => e.name === 'page_view');
    const lastP = (pv[pv.length - 1]?.props?.path || pv[pv.length - 1]?.path || '?');
    g.last[lastP] = (g.last[lastP] || 0) + 1;
    for (const p of new Set(pv.map((e) => e.props?.path || e.path || '?'))) g.pages[p] = (g.pages[p] || 0) + 1;
    for (const e of evs.filter((e) => e.name === 'cta_click')) { const l = String(e.props?.label || '?').slice(0, 30); g.cta[l] = (g.cta[l] || 0) + 1; }
    const t0 = Date.parse(evs[0].ts), t1 = Date.parse(evs[evs.length - 1].ts);
    if (t0 && t1) g.dur.push((t1 - t0) / 1000);
    bySrc.set(s, g);
  }
  const top = (o, n = 10) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(', ');
  for (const [s, g] of bySrc) {
    g.dur.sort((a, b) => a - b);
    const med = g.dur.length ? g.dur[Math.floor(g.dur.length / 2)] : 0;
    console.log(`\n== ${s}: 기기 ${g.n}, 머문 시간 중앙값 ${Math.round(med)}초, 10초 미만 ${g.dur.filter((d) => d < 10).length}`);
    console.log('  단계: ' + STEPS.filter((st) => g.step[st]).map((st) => `${st} ${g.step[st]}`).join(' > '));
    console.log('  본 화면: ' + top(g.pages, 12));
    console.log('  마지막 화면: ' + top(g.last, 8));
    console.log('  누른 버튼: ' + top(g.cta, 10));
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
