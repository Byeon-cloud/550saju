/* 퍼널 깊이 보기 (2026-10-17, 읽기 전용) — 사용: node scripts/ops/funnel_deep.cjs [일수=14]
 *   첫 화면 클릭, 띠 표, 입력, 결과, 결제 화면 이탈을 기기(did) 단위로 쪼갠다. 오너 기기(internal)는 뺀다. */
const { query } = require('./fs.cjs');
const N = Number(process.argv[2] || 14);
const kstDay = (o) => new Date(Date.now() + 9 * 3600e3 - o * 864e5).toISOString().slice(0, 10);
const days = []; for (let i = N - 1; i >= 0; i--) days.push(kstDay(i));
const NAMES = ['app_open', 'page_view', 'tti_open', 'tti_input', 'tti_year', 'tti_newyear', 'tti_compat', 'profile_created', 'content_open', 'content_result', 'insufficient_balance', 'charge_open', 'charge_failed', 'charge_complete', 'cta_click', 'noti_agree', 'content_purchase'];

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
        select: { fields: ['name', 'did', 'uid', 'props', 'internal', 'day', 'utm', 'ts', 'createdAt'].map((f) => ({ fieldPath: f })) },
      });
      rows.push(...r.filter((x) => !x.internal));
    }
  }
  const who = (x) => x.did || x.uid || '?';
  const by = (f) => { const m = new Map(); for (const x of rows.filter(f)) { const k = who(x); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const ppl = (f) => by(f).size;
  const top = (arr, n = 12) => Object.entries(arr.reduce((o, k) => ((o[k] = (o[k] || 0) + 1), o), {})).sort((a, b) => b[1] - a[1]).slice(0, n);
  const P = (x) => x.props || {};

  const openers = by((x) => x.name === 'app_open');
  const inputters = by((x) => x.name === 'profile_created');
  const resulters = by((x) => x.name === 'content_result');
  console.log(`기간 ${days[0]}~${days[days.length - 1]} (${N}일)`);
  console.log('연 사람', openers.size, '입력', inputters.size, '결과', resulters.size, '결제 화면(운 모자람)', ppl((x) => x.name === 'insufficient_balance'), '충전 화면', ppl((x) => x.name === 'charge_open'), '충전', ppl((x) => x.name === 'charge_complete'));

  // 첫 화면에서 무엇을 눌렀나 (홈 cta)
  const homeCta = rows.filter((x) => x.name === 'cta_click' && (P(x).page === '/' || P(x).page === ''));
  console.log('\n[홈에서 누른 것 (사람 수 기준 아님, 클릭 수)]', homeCta.length);
  console.log(top(homeCta.map((x) => String(P(x).label || '').slice(0, 30)), 20));
  // 홈에서 아무것도 안 누른 사람
  const clickers = new Set(rows.filter((x) => x.name === 'cta_click').map(who));
  const pv = by((x) => x.name === 'page_view');
  const onlyHome = [...openers.keys()].filter((d) => !clickers.has(d));
  console.log('\n연 사람 중 아무 버튼도 안 누른 사람', onlyHome.length, `(${Math.round((onlyHome.length / Math.max(1, openers.size)) * 100)}%)`);
  // 띠 표
  console.log('\n[띠 표] 띠 누름', ppl((x) => x.name === 'tti_open'), '태어난 해 누름', ppl((x) => x.name === 'tti_year'), '띠 화면에서 생일 넣기', ppl((x) => x.name === 'tti_input'), '내년 띠운→신년', ppl((x) => x.name === 'tti_newyear'), '가족 띠→궁합', ppl((x) => x.name === 'tti_compat'));
  console.log(' tti_input step', top(rows.filter((x) => x.name === 'tti_input').map((x) => P(x).step || P(x).src || '?')));
  // 들른 화면
  console.log('\n[들른 화면 (사람 수)]');
  const pageP = {};
  for (const x of rows.filter((x) => x.name === 'page_view')) { const p = String(P(x).page_path || '').replace(/\/[A-Za-z0-9_-]{8,}$/, '/:id').replace(/\?.*$/, ''); (pageP[p] = pageP[p] || new Set()).add(who(x)); }
  console.log(Object.entries(pageP).map(([p, s]) => [p, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 15));
  // 입력까지 간 사람의 입력 화면 도달률
  const inputPage = pageP['/input'] ? pageP['/input'].size : 0;
  console.log(`\n입력 화면 연 사람 ${inputPage} → 입력 완료 ${inputters.size} (${Math.round((inputters.size / Math.max(1, inputPage)) * 100)}%)`);
  // 결과 종류
  console.log('\n[결과 종류]', top(rows.filter((x) => x.name === 'content_result').map((x) => P(x).type)));
  console.log('[구매 종류]', top(rows.filter((x) => x.name === 'content_purchase').map((x) => `${P(x).type}${P(x).topic ? ':' + P(x).topic : ''}`)));
  console.log('[운 모자람 종류]', top(rows.filter((x) => x.name === 'insufficient_balance').map((x) => `${P(x).type}/${P(x).needed}`)));
  console.log('[결제 실패 이유]', top(rows.filter((x) => x.name === 'charge_failed').map((x) => `${P(x).reason || '?'}/${P(x).package || ''}`)));
  console.log('[충전 패키지]', top(rows.filter((x) => x.name === 'charge_complete').map((x) => `${P(x).package || ''}/${P(x).amount || ''}`)));
  console.log('[아침 알림 동의]', top(rows.filter((x) => x.name === 'noti_agree').map((x) => P(x).result)));
  // 결과 받은 사람이 다음에 누른 것
  const afterRes = rows.filter((x) => x.name === 'cta_click' && resulters.has(who(x)) && String(P(x).page || '') !== '/');
  console.log('\n[결과 받은 사람이 누른 것 (홈 밖)]', top(afterRes.map((x) => `${String(P(x).page || '').replace(/\/[A-Za-z0-9_-]{8,}$/, '/:id').slice(0, 20)} ${String(P(x).label || '').slice(0, 24)}`), 15));
})().catch((e) => console.error(e.message));
