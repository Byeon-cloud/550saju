/* 마케팅 성과판 데이터 (읽기만) — 사용: node scripts/ops/dashboard_data.cjs [출력 폴더=scratch/dash]
 *   analytics 이벤트(기기 did 기준, 오너 기기 internal 제외)로 만든다. 날짜는 analytics 의 day(한국 날짜).
 *   daily.json     최근 35일 날마다: 연 사람, 사주 입력, 결과 받은 사람, 결제 시도, 충전한 사람, 매출(앱, 웹), 검색 유입, 알림 동의
 *   channels.json  최근 7일 첫 출처별: 연 사람, 사주 입력, 결과, 충전, 매출
 *   funnel.json    최근 7일과 그 전 7일의 단계별 사람 수
 *   experiments.json  docs/marketing/experiments.json 에 지금 숫자(now)를 채운 것
 *   매출은 charge_complete 의 amount 합(앱 = pg iap, 웹 = pg portone). 환불은 빼지 않는다(콘솔 정산과 다를 수 있음). */
const fs = require('fs');
const path = require('path');
const { query } = require('./fs.cjs');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../../scratch/dash'));
fs.mkdirSync(OUT, { recursive: true });

const kstDay = (offset) => new Date(Date.now() + 9 * 3600e3 - offset * 864e5).toISOString().slice(0, 10);
const N = 35;
const days = []; for (let i = N - 1; i >= 0; i--) days.push(kstDay(i));
const NAMES = ['app_open', 'page_view', 'profile_created', 'content_result', 'insufficient_balance', 'charge_open', 'charge_complete', 'noti_agree', 'share_complete', 'inv_visit', 'inv_complete', 'cjoin_answer'];

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
        select: { fields: ['name', 'did', 'uid', 'props', 'internal', 'day', 'utm'].map((f) => ({ fieldPath: f })) },
      });
      rows.push(...r.filter((x) => !x.internal));
    }
  }
  const who = (x) => x.did || x.uid || '?';
  const srcOf = (u) => {
    if (!u || !u.source) return '출처 없음';
    if (u.source === 'toss_ref') return `토스 ${u.medium || ''}`.trim();
    return u.source;
  };
  // 기기별 첫 출처
  const first = new Map();
  for (const x of [...rows].sort((a, b) => (a.day < b.day ? -1 : 1))) {
    const d = who(x);
    if (!first.has(d)) first.set(d, srcOf(x.utm));
    else if (first.get(d) === '출처 없음' && x.utm) first.set(d, srcOf(x.utm));
  }
  const isInput = (x) => x.name === 'profile_created';
  const isPayTry = (x) => x.name === 'insufficient_balance'; // 운이 모자라 결제로 넘어간 사람 (충전 화면을 그냥 연 사람은 뺀다 — 결과 받은 사람보다 많아져 단계가 뒤집혔다)
  const amount = (x) => Number(x.props?.amount) || 0;

  // daily
  const daily = days.map((day) => {
    const r = rows.filter((x) => x.day === day);
    const ppl = (f) => new Set(r.filter(f).map(who)).size;
    const charges = r.filter((x) => x.name === 'charge_complete');
    return {
      day,
      opens: ppl((x) => x.name === 'app_open'),
      inputs: ppl(isInput),
      results: ppl((x) => x.name === 'content_result'),
      payTry: ppl(isPayTry),
      payers: new Set(charges.map(who)).size,
      revenue: charges.reduce((s, x) => s + amount(x), 0),
      revenueApp: charges.filter((x) => x.props?.pg !== 'portone').reduce((s, x) => s + amount(x), 0),
      revenueWeb: charges.filter((x) => x.props?.pg === 'portone').reduce((s, x) => s + amount(x), 0),
      seoOpens: ppl((x) => x.name === 'app_open' && x.utm?.source === 'seo'),
      notiAgree: ppl((x) => x.name === 'noti_agree' && x.props?.result !== 'DENIED' && x.props?.result !== 'denied'),
    };
  });

  // funnel: 최근 7일 vs 그 전 7일
  const win = (a, b) => new Set(days.slice(a, b));
  const cur = win(N - 7, N); const prev = win(N - 14, N - 7);
  const steps = [
    ['앱을 연 사람', (x) => x.name === 'app_open'],
    ['사주 입력', isInput],
    ['결과 받은 사람', (x) => x.name === 'content_result'],
    ['운이 모자라 결제로', isPayTry],
    ['충전한 사람', (x) => x.name === 'charge_complete'],
  ];
  const funnel = steps.map(([step, f], i) => ({
    order: i + 1, step,
    now: new Set(rows.filter((x) => cur.has(x.day) && f(x)).map(who)).size,
    prev: new Set(rows.filter((x) => prev.has(x.day) && f(x)).map(who)).size,
  }));

  // channels: 최근 7일, 첫 출처 기준
  const byCh = new Map();
  for (const x of rows.filter((x) => cur.has(x.day))) {
    const ch = first.get(who(x)) || '출처 없음';
    const b = byCh.get(ch) || { opens: new Set(), inputs: new Set(), results: new Set(), payers: new Set(), revenue: 0 };
    if (x.name === 'app_open') b.opens.add(who(x));
    if (isInput(x)) b.inputs.add(who(x));
    if (x.name === 'content_result') b.results.add(who(x));
    if (x.name === 'charge_complete') { b.payers.add(who(x)); b.revenue += amount(x); }
    byCh.set(ch, b);
  }
  const channels = [...byCh.entries()].map(([source, b]) => ({ source, opens: b.opens.size, inputs: b.inputs.size, results: b.results.size, payers: b.payers.size, revenue: b.revenue }))
    .filter((c) => c.opens > 0 || c.payers > 0).sort((a, b) => b.opens - a.opens).slice(0, 12);

  // experiments: 지금 숫자 채우기
  const expFile = path.join(__dirname, '../../docs/marketing/experiments.json');
  const exps = fs.existsSync(expFile) ? JSON.parse(fs.readFileSync(expFile, 'utf8')) : [];
  const sinceSum = (from, key) => daily.filter((d) => d.day >= from).reduce((s, d) => s + d[key], 0);
  const NOW = {
    seo_opens: (e) => `${sinceSum(e.start, 'seoOpens')}명`,
    noti_agree: (e) => `${sinceSum(e.start, 'notiAgree')}명`,
    payers_since: (e) => `${sinceSum(e.start, 'payers')}명`,
    // 2026-10-18 E15 친구 초대, E16 궁합 초대장
    inv_visit: (e) => {
      const since = rows.filter((x) => x.day >= e.start);
      const visits = new Set(since.filter((x) => x.name === 'inv_visit' && Number(x.props?.isNew) === 1).map(who)).size;
      const granted = new Set(since.filter((x) => x.name === 'inv_complete' && x.props?.status === 'granted').map(who)).size;
      return `링크로 온 새 손님 ${visits}명, 인정 ${granted}명`;
    },
    cjoin: (e) => {
      const since = rows.filter((x) => x.day >= e.start);
      const sent = since.filter((x) => x.name === 'share_complete' && x.props?.type === 'cjoin').length;
      const answered = new Set(since.filter((x) => x.name === 'cjoin_answer').map(who)).size;
      return `보낸 초대장 ${sent}장, 답한 사람 ${answered}명`;
    },
    channel_payers: (e) => { const c = channels.find((c) => c.source === e.channel); return c ? `최근 7일 ${c.opens}명, 충전 ${c.payers}명` : '아직 없음'; },
  };
  const experiments = exps.map((e) => ({ ...e, now: NOW[e.metricKey] ? NOW[e.metricKey](e) : (e.now || '—') }));

  const updatedAt = new Date().toISOString();
  for (const [f, v] of [['daily.json', daily], ['channels.json', channels], ['funnel.json', funnel], ['experiments.json', experiments]]) {
    fs.writeFileSync(path.join(OUT, f), JSON.stringify(v));
  }
  fs.writeFileSync(path.join(OUT, 'updated.txt'), updatedAt);
  const last7 = daily.slice(-7);
  console.log(`저장 ${OUT}  최근 7일: 연 사람 ${funnel[0].now}, 입력 ${funnel[1].now}, 결과 ${funnel[2].now}, 충전 ${funnel[4].now}, 매출 ${last7.reduce((s, d) => s + d.revenue, 0)}원, 출처 ${channels.length}개`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
