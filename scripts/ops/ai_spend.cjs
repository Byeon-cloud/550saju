/* 최근 하루 AI 사용액 (aiUsage 토큰 x 단가, 읽기만) */
const { query } = require('./fs.cjs');
const PRICE = require('./price.json');
const priceOf = (m) => PRICE[Object.keys(PRICE).find((k) => String(m).startsWith(k))] || [0, 0, 0, 0];
(async () => {
  const days = [];
  for (let i = 1; i <= 7; i++) days.push(new Date(Date.now() + 9 * 3600e3 - i * 864e5).toISOString().slice(0, 10));
  const rows = await query({ from: [{ collectionId: 'aiUsage' }], where: { fieldFilter: { field: { fieldPath: 'day' }, op: 'IN', value: { arrayValue: { values: days.map((d) => ({ stringValue: d })) } } } }, select: { fields: ['day', 'type', 'model', 'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'].map((f) => ({ fieldPath: f })) } });
  const byDay = {};
  for (const r of rows) {
    const [pi, pcw, pcr, po] = priceOf(r.model);
    const usd = ((+r.inputTokens || 0) * pi + (+r.cacheWriteTokens || 0) * pcw + (+r.cacheReadTokens || 0) * pcr + (+r.outputTokens || 0) * po) / 1e6;
    byDay[r.day] = byDay[r.day] || { n: 0, usd: 0 }; byDay[r.day].n++; byDay[r.day].usd += usd;
  }
  let tot = 0;
  for (const d of Object.keys(byDay).sort()) { console.log(d, '호출', byDay[d].n, '달러', byDay[d].usd.toFixed(2)); tot += byDay[d].usd; }
  console.log('7일 평균 하루 달러', (tot / 7).toFixed(2), '→ 1000달러로 약', Math.round(1000 / (tot / 7)), '일');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
