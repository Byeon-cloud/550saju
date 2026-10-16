/* 누가 돈을 내는가 (읽기만): 최근 N일 analytics 의 app_open / content_result / content_purchase / charge_complete
 *   기기(did) 기준, 오너 기기 제외. demo(성별, 연령대)와 utm, plat 로 나눔. */
const { query } = require('./fs.cjs');
const N = Number(process.argv[2] || 60);
const days = [];
for (let i = 1; i <= N; i++) days.push(new Date(Date.now() + 9 * 3600e3 - i * 864e5).toISOString().slice(0, 10));
const NAMES = ['app_open', 'content_result', 'content_purchase', 'charge_complete', 'share_complete'];
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
        select: { fields: ['name', 'did', 'uid', 'props', 'internal', 'plat', 'day', 'demo', 'utm'].map((f) => ({ fieldPath: f })) },
      });
      rows.push(...r.filter((x) => !x.internal));
    }
  }
  const who = (x) => x.did || x.uid || '?';
  // 기기별 대표 속성(가장 최근 demo, utm)
  const attr = new Map();
  for (const x of rows) {
    const a = attr.get(who(x)) || {};
    if (x.demo && !a.demo) a.demo = x.demo;
    if (x.utm && !a.utm) a.utm = x.utm;
    if (!a.first || x.day < a.first) a.first = x.day;
    a.plat = a.plat || x.plat;
    attr.set(who(x), a);
  }
  const set = (pred) => new Set(rows.filter(pred).map(who));
  const opened = set((x) => x.name === 'app_open');
  const result = set((x) => x.name === 'content_result');
  const bought = set((x) => x.name === 'content_purchase');
  const charged = set((x) => x.name === 'charge_complete');
  const shared = set((x) => x.name === 'share_complete');
  const ageOf = (d) => { const a = attr.get(d)?.demo; return (a && (a.ab || a.age || a.ageBand)) || '모름'; };
  const genOf = (d) => { const a = attr.get(d)?.demo; return (a && (a.gender || a.g)) || '모름'; };
  const srcOf = (d) => { const u = attr.get(d)?.utm; return (u && (u.source || u.utm_source || u.s)) || '없음'; };
  const tab = (setX, f) => { const t = {}; for (const d of setX) { const k = f(d); t[k] = (t[k] || 0) + 1; } return t; };
  console.log(`최근 ${N}일 (오너 기기 제외, 기기 수)`);
  console.log('앱 연 기기', opened.size, '결과 받은 기기', result.size, '운 쓴 기기', bought.size, '충전 기기', charged.size, '공유 기기', shared.size);
  console.log('demo 샘플', JSON.stringify([...attr.values()].find((a) => a.demo)?.demo || null), 'utm 샘플', JSON.stringify([...attr.values()].find((a) => a.utm)?.utm || null));
  for (const [label, f] of [['연령대', ageOf], ['성별', genOf], ['유입 utm', srcOf]]) {
    const all = tab(opened, f); const res = tab(result, f); const ch = tab(charged, f); const bo = tab(bought, f);
    console.log(`\n[${label}] 앱 연 / 결과 받음 / 운 씀 / 충전  (충전율)`);
    for (const k of Object.keys(all).sort((a, b) => all[b] - all[a]).slice(0, 12)) {
      console.log(`  ${k}: ${all[k]} / ${res[k] || 0} / ${bo[k] || 0} / ${ch[k] || 0}  (${((100 * (ch[k] || 0)) / all[k]).toFixed(2)}%)`);
    }
  }
  // 충전한 사람들의 첫 방문일과 충전까지 날짜
  const firstCharge = new Map();
  for (const x of rows.filter((x) => x.name === 'charge_complete')) { const d = who(x); if (!firstCharge.has(d) || x.day < firstCharge.get(d)) firstCharge.set(d, x.day); }
  const lag = [...firstCharge.entries()].map(([d, day]) => Math.round((new Date(day) - new Date(attr.get(d)?.first || day)) / 864e5));
  console.log('\n충전까지 걸린 날(첫 방문 기준)', JSON.stringify(lag.sort((a, b) => a - b)));
  const buyTypes = {}; for (const x of rows.filter((x) => x.name === 'content_purchase')) { const k = x.props?.type || '?'; buyTypes[k] = (buyTypes[k] || 0) + (Number(x.props?.amount) || 0); }
  console.log('운을 쓴 콘텐츠(운 합)', JSON.stringify(buyTypes));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
