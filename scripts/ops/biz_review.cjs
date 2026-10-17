/* 사업 점검 숫자 (2026-10-17, 읽기 전용) — 사용: node scripts/ops/biz_review.cjs
 *   1) 최근 30일 AI 원가 (aiUsage, 콘텐츠별, 모델 단가 2026-10 기준, 환율 1,400원)
 *   2) 최근 12주 주별 방문자, 새 기기, 사주 입력, 충전, 매출 (analytics)
 *   3) 재방문: 주마다 처음 온 기기 중 다음 주에 다시 온 비율
 *   4) 최근 30일 콘텐츠 결과와 구매 종류 */
const { query } = require('./fs.cjs');
const KRW = 1400;
const PRICE = { // $/1M (입력, 출력, 캐시 읽기)
  'claude-opus-5-5': [4, 20, 0.2], 'claude-sonnet-5-5': [2, 10, 0.2], 'claude-haiku-5-5': [0.1, 0.5, 0.01],
  'claude-opus-4-6': [5, 25, 0.5], 'claude-sonnet-4-6': [3, 15, 0.3], 'claude-haiku-4-5': [1, 5, 0.1],
};
const kstDay = (o) => new Date(Date.now() + 9 * 3600e3 - o * 864e5).toISOString().slice(0, 10);
const daysBack = (n) => { const a = []; for (let i = n - 1; i >= 0; i--) a.push(kstDay(i)); return a; };
async function byDays(collectionId, days, extra = [], fields = []) {
  const out = [];
  for (let i = 0; i < days.length; i += 10) {
    const chunk = days.slice(i, i + 10);
    const r = await query({ from: [{ collectionId }], where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'day' }, op: 'IN', value: { arrayValue: { values: chunk.map((d) => ({ stringValue: d })) } } } }, ...extra] } },
      ...(fields.length ? { select: { fields: fields.map((f) => ({ fieldPath: f })) } } : {}) });
    out.push(...r);
  }
  return out;
}
const nameIs = (n) => ({ fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: n } } });

(async () => {
  // 1) AI 원가
  const d30 = daysBack(30);
  const ai = await byDays('aiUsage', d30, [], ['type', 'model', 'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'ok', 'day']);
  const cost = {}; let total = 0;
  for (const x of ai) {
    const p = PRICE[x.model] || [2, 10, 0.2];
    const usd = ((x.inputTokens || 0) * p[0] + (x.outputTokens || 0) * p[1] + (x.cacheReadTokens || 0) * p[2] + (x.cacheWriteTokens || 0) * p[0] * 1.25) / 1e6;
    const k = x.type || '?';
    cost[k] = cost[k] || { calls: 0, krw: 0 }; cost[k].calls++; cost[k].krw += usd * KRW; total += usd * KRW;
  }
  console.log(`[AI 원가 최근 30일] 합계 ${Math.round(total).toLocaleString()}원, 호출 ${ai.length}`);
  console.log(Object.entries(cost).sort((a, b) => b[1].krw - a[1].krw).map(([k, v]) => `${k} ${v.calls}회 ${Math.round(v.krw).toLocaleString()}원`).join(' | '));

  // 2) 주별
  const d84 = daysBack(84);
  const rows = [];
  for (const n of ['app_open', 'signup', 'profile_created', 'charge_complete', 'content_result', 'content_purchase']) {
    const r = await byDays('analytics', d84, [nameIs(n)], ['name', 'did', 'uid', 'props', 'internal', 'day']);
    rows.push(...r.filter((x) => !x.internal));
  }
  const who = (x) => x.did || x.uid || '?';
  const weekOf = (day) => { const i = d84.indexOf(day); return i < 0 ? -1 : Math.floor(i / 7); };
  const W = 12; const weeks = Array.from({ length: W }, (_, i) => ({ i, from: d84[i * 7], open: new Set(), signup: new Set(), input: new Set(), payer: new Set(), revenue: 0, results: 0 }));
  for (const x of rows) {
    const w = weeks[weekOf(x.day)]; if (!w) continue;
    if (x.name === 'app_open') w.open.add(who(x));
    if (x.name === 'signup') w.signup.add(who(x));
    if (x.name === 'profile_created') w.input.add(who(x));
    if (x.name === 'content_result') w.results++;
    if (x.name === 'charge_complete') { w.payer.add(who(x)); w.revenue += Number(x.props?.amount) || 0; }
  }
  console.log('\n[주별] 시작일 | 연 기기 | 새 기기 | 입력 | 결과 | 충전 기기 | 매출');
  for (const w of weeks) console.log(`${w.from} | ${w.open.size} | ${w.signup.size} | ${w.input.size} | ${w.results} | ${w.payer.size} | ${w.revenue.toLocaleString()}원`);
  const rev = weeks.reduce((a, w) => a + w.revenue, 0);
  console.log(`12주 매출 합 ${rev.toLocaleString()}원, 마지막 4주 ${weeks.slice(-4).reduce((a, w) => a + w.revenue, 0).toLocaleString()}원`);

  // 3) 재방문 (처음 연 주 기준 다음 주에 다시 연 비율)
  const firstWeek = new Map();
  for (const x of rows.filter((r) => r.name === 'app_open').sort((a, b) => (a.day < b.day ? -1 : 1))) { const d = who(x); if (!firstWeek.has(d)) firstWeek.set(d, weekOf(x.day)); }
  const openWeeks = new Map();
  for (const x of rows.filter((r) => r.name === 'app_open')) { const d = who(x); (openWeeks.get(d) || openWeeks.set(d, new Set()).get(d)).add(weekOf(x.day)); }
  console.log('\n[재방문] 처음 온 주 | 새로 온 기기 | 다음 주에 다시 | 비율');
  for (let w = 0; w < W - 1; w++) {
    const coh = [...firstWeek.entries()].filter(([, fw]) => fw === w).map(([d]) => d);
    const back = coh.filter((d) => openWeeks.get(d)?.has(w + 1)).length;
    if (coh.length) console.log(`${weeks[w].from} | ${coh.length} | ${back} | ${((back / coh.length) * 100).toFixed(1)}%`);
  }
  // 입력한 사람의 재방문
  const inputters = new Set(rows.filter((r) => r.name === 'profile_created').map(who));
  const multiWeek = [...inputters].filter((d) => (openWeeks.get(d)?.size || 0) >= 2).length;
  console.log(`사주를 넣은 기기 ${inputters.size} 중 두 주 이상 온 기기 ${multiWeek} (${((multiWeek / Math.max(1, inputters.size)) * 100).toFixed(1)}%)`);

  // 4) 최근 30일 콘텐츠
  const last30 = new Set(d30);
  const cnt = (n, key) => { const o = {}; for (const x of rows.filter((r) => r.name === n && last30.has(r.day))) { const k = key(x); o[k] = (o[k] || 0) + 1; } return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  console.log('\n[30일 결과 종류]', JSON.stringify(cnt('content_result', (x) => x.props?.type)));
  console.log('[30일 구매 종류(운 차감)]', JSON.stringify(cnt('content_purchase', (x) => `${x.props?.type}${x.props?.topic ? ':' + x.props.topic : ''}/${x.props?.amount || ''}`)));
  console.log('[30일 충전 패키지]', JSON.stringify(cnt('charge_complete', (x) => `${x.props?.package || ''}/${x.props?.amount || ''}`)));
})().catch((e) => console.error('ERR', e.message));
