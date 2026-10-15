/* 혜택탭 캠페인 사흘 시험 판정 (읽기만) — 사용: node campaign_funnel.cjs 2026-10-17 2026-10-19
 *   기준(오너 합의, 10-15): 띠 운세를 연 사람 중 오늘의 운세를 받은 사람 10% 이상, 사주 입력 3% 이상.
 *   사람 수는 기기(did) 기준, 오너 기기(internal) 제외. */
const { query } = require('./fs.cjs');
const [from, to] = process.argv.slice(2);
if (!from || !to) { console.log('사용: node campaign_funnel.cjs 시작일 끝일 (YYYY-MM-DD)'); process.exit(1); }
const days = [];
for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d = new Date(d.getTime() + 864e5)) days.push(d.toISOString().slice(0, 10));
const NAMES = ['app_open', 'tti_open', 'tti_year', 'tti_input', 'tti_newyear', 'tti_compat', 'content_result', 'content_purchase', 'charge_complete', 'noti_agree'];
(async () => {
  const rows = [];
  for (const day of days) {
    const r = await query({
      from: [{ collectionId: 'analytics' }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'day' }, op: 'EQUAL', value: { stringValue: day } } },
        { fieldFilter: { field: { fieldPath: 'name' }, op: 'IN', value: { arrayValue: { values: NAMES.map((n) => ({ stringValue: n })) } } } },
      ] } },
      select: { fields: ['name', 'did', 'uid', 'props', 'internal', 'plat', 'day'].map((f) => ({ fieldPath: f })) },
    });
    rows.push(...r.filter((x) => !x.internal));
  }
  const who = (x) => x.did || x.uid || '?';
  const people = (pred) => new Set(rows.filter(pred).map(who));
  const open = people((x) => x.name === 'app_open');
  const tti = people((x) => x.name === 'tti_open');
  const ttiYear = people((x) => x.name === 'tti_year');
  const ttiInput = people((x) => x.name === 'tti_input');
  const dailyResult = people((x) => x.name === 'content_result' && x.props?.type === 'daily');
  const anyResult = people((x) => x.name === 'content_result');
  const purchase = people((x) => x.name === 'content_purchase');
  const charge = people((x) => x.name === 'charge_complete');
  const noti = people((x) => x.name === 'noti_agree' && /newAgreement|alreadyAgreed/.test(String(x.props?.result || '')));
  const ttiTo = (set) => [...tti].filter((d) => set.has(d)).length;
  const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '-');
  console.log(`기간 ${from} ~ ${to} (오너 기기 제외, 기기 수)`);
  console.log(`앱 연 사람 ${open.size}`);
  console.log(`띠 운세 연 사람 ${tti.size} (앱 연 사람의 ${pct(tti.size, open.size)})`);
  console.log(`  그중 태어난 해 고름 ${ttiTo(ttiYear)} (${pct(ttiTo(ttiYear), tti.size)})`);
  console.log(`  그중 생일 넣기 누름 ${ttiTo(ttiInput)} (${pct(ttiTo(ttiInput), tti.size)})`);
  console.log(`  그중 오늘의 운세 받음 ${ttiTo(dailyResult)} (${pct(ttiTo(dailyResult), tti.size)})  기준 10%`);
  console.log(`  그중 아무 결과나 받음 ${ttiTo(anyResult)} (${pct(ttiTo(anyResult), tti.size)})`);
  console.log(`오늘의 운세 받은 사람 전체 ${dailyResult.size}, 알림 동의 ${noti.size} (${pct(noti.size, dailyResult.size)})`);
  console.log(`운을 쓴 사람 ${purchase.size}, 충전한 사람 ${charge.size} (앱 연 사람의 ${pct(charge.size, open.size)})`);
  const byStep = {};
  for (const x of rows.filter((x) => x.name === 'tti_input')) { const k = `${x.props?.src || '?'}/${x.props?.step || '?'}`; byStep[k] = (byStep[k] || 0) + 1; }
  console.log('생일 넣기 누른 자리', JSON.stringify(byStep));
  console.log('판정: 오늘의 운세 받음 10% 이상이면 계속, 3% 미만이면 중단. 사주 입력 비율은 위 생일 넣기 누름과 결과 받음 사이');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
