/* 마케팅 성과판 데이터 (읽기만) — 사용: node scripts/ops/dashboard_data.cjs [출력 폴더=scratch/dash]
 *   2026-10-19 — 큰 숫자는 서버 하루 요약 statsDaily(functions/src/admin/stats.ts)를 읽는다. 관리자 화면, 주간 보고와 같은 숫자.
 *     사람 수는 날마다 센 것(기기 기준, 오너 기기 제외), 기간 합은 날마다 센 것을 더한 값. 매출은 결제 장부(같은 주문 한 번, 오너 시험 결제 제외).
 *     오늘은 요약이 아직 없어 어제까지만 쓴다.
 *   시험별 세부(친구 초대, 궁합 초대장, 만세력, 오늘의 운세 반값)만 원본 analytics 를 따로 읽는다.
 *   daily.json     최근 35일 날마다: 연 사람, 사주 입력, 결과 받은 사람, 결제 시도, 충전한 사람, 매출(앱, 웹), 검색 유입, 알림 동의
 *   channels.json  최근 7일 처음 들어온 곳별: 연 사람, 사주 입력, 결과, 충전, 매출
 *   funnel.json    최근 7일과 그 전 7일의 단계별 사람 수
 *   experiments.json  docs/marketing/experiments.json 에 지금 숫자(now)를 채운 것 */
const fs = require('fs');
const path = require('path');
const { list, query } = require('./fs.cjs');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../../scratch/dash'));
fs.mkdirSync(OUT, { recursive: true });

const kstDay = (offset) => new Date(Date.now() + 9 * 3600e3 - offset * 864e5).toISOString().slice(0, 10);
const N = 35;
const days = []; for (let i = N; i >= 1; i--) days.push(kstDay(i)); // 어제까지

const side = (d, k) => (d?.app?.[k] || 0) + (d?.web?.[k] || 0);

(async () => {
  const all = await list('statsDaily');
  const byDay = new Map(all.map((d) => [d.__id, d]));
  const missing = days.filter((d) => !byDay.has(d));
  if (missing.length > 3) console.warn(`요약 없는 날 ${missing.length}일 (관리자 화면을 한 번 열거나 밤 작업이 채운다)`);

  const daily = days.map((day) => {
    const d = byDay.get(day) || {};
    return {
      day,
      opens: side(d, 'opens'),
      inputs: side(d, 'inputs'),
      results: side(d, 'results'),
      payTry: side(d, 'payTry'),
      payers: side(d, 'payers'),
      revenue: side(d, 'revenue'),
      revenueApp: d?.app?.revenue || 0,
      revenueWeb: d?.web?.revenue || 0,
      seoOpens: d?.channels?.seo?.visitors || 0,
      notiAgree: side(d, 'notiAgree'),
    };
  });

  // funnel: 최근 7일 vs 그 전 7일 (날마다 센 것을 더한 값)
  const sum = (from, to, key) => daily.slice(from, to).reduce((s, d) => s + d[key], 0);
  const steps = [['앱을 연 사람', 'opens'], ['사주 입력', 'inputs'], ['결과 받은 사람', 'results'], ['운이 모자라 결제로', 'payTry'], ['충전한 사람', 'payers']];
  const funnel = steps.map(([step, key], i) => ({ order: i + 1, step, now: sum(N - 7, N, key), prev: sum(N - 14, N - 7, key) }));

  // channels: 최근 7일
  const byCh = new Map();
  for (const day of days.slice(-7)) {
    for (const [src, r] of Object.entries(byDay.get(day)?.channels || {})) {
      const b = byCh.get(src) || { opens: 0, inputs: 0, results: 0, payers: 0, revenue: 0 };
      b.opens += r.visitors || 0; b.inputs += r.inputs || 0; b.results += r.results || 0; b.payers += r.payers || 0; b.revenue += r.revenue || 0;
      byCh.set(src, b);
    }
  }
  const channels = [...byCh.entries()].map(([source, b]) => ({ source, ...b }))
    .filter((c) => c.opens > 0 || c.payers > 0).sort((a, b) => b.opens - a.opens).slice(0, 12);

  // experiments: 지금 숫자 채우기
  const expFile = path.join(__dirname, '../../docs/marketing/experiments.json');
  const exps = fs.existsSync(expFile) ? JSON.parse(fs.readFileSync(expFile, 'utf8')) : [];
  const sinceSum = (from, key) => daily.filter((d) => d.day >= from).reduce((s, d) => s + d[key], 0);
  // 시험 세부용 원본 (해당 이벤트만, 읽기만)
  const rawSince = async (from, names) => {
    const ds = days.filter((d) => d >= from).concat([kstDay(0)]);
    const rows = [];
    for (let i = 0; i < ds.length; i += 10) {
      for (const name of names) {
        const r = await query({ from: [{ collectionId: 'analytics' }], where: { compositeFilter: { op: 'AND', filters: [
          { fieldFilter: { field: { fieldPath: 'day' }, op: 'IN', value: { arrayValue: { values: ds.slice(i, i + 10).map((d) => ({ stringValue: d })) } } } },
          { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: name } } }] } },
          select: { fields: ['name', 'did', 'uid', 'props', 'internal', 'day'].map((f) => ({ fieldPath: f })) } });
        rows.push(...r.filter((x) => !x.internal));
      }
    }
    return rows;
  };
  const who = (x) => x.did || x.uid || '?';
  const NOW = {
    seo_opens: async (e) => `${sinceSum(e.start, 'seoOpens')}명`,
    noti_agree: async (e) => `${sinceSum(e.start, 'notiAgree')}명`,
    payers_since: async (e) => `${sinceSum(e.start, 'payers')}명`,
    inv_visit: async (e) => {
      const r = await rawSince(e.start, ['inv_visit', 'inv_complete']);
      const visits = new Set(r.filter((x) => x.name === 'inv_visit' && Number(x.props?.isNew) === 1).map(who)).size;
      const granted = new Set(r.filter((x) => x.name === 'inv_complete' && x.props?.status === 'granted').map(who)).size;
      return `링크로 온 새 손님 ${visits}명, 인정 ${granted}명`;
    },
    cjoin: async (e) => {
      const r = await rawSince(e.start, ['share_complete', 'cjoin_answer']);
      const sent = r.filter((x) => x.name === 'share_complete' && x.props?.type === 'cjoin').length;
      const answered = new Set(r.filter((x) => x.name === 'cjoin_answer').map(who)).size;
      return `보낸 초대장 ${sent}장, 답한 사람 ${answered}명`;
    },
    manse: async (e) => {
      const r = await rawSince(e.start, ['manse_view']);
      const opened = new Set(r.filter((x) => Number(x.props?.ok) === 1).map(who)).size;
      const failed = r.filter((x) => Number(x.props?.ok) === 0).length;
      return `검색 ${sinceSum(e.start, 'seoOpens')}명, 바로 펼친 사람 ${opened}명${failed ? `, 입력 오류 ${failed}건` : ''}`;
    },
    daily_offer: async (e) => {
      const r = await rawSince(e.start, ['daily_offer_view', 'daily_offer_click', 'content_purchase']);
      const seen = new Set(r.filter((x) => x.name === 'daily_offer_view').map(who)).size;
      const clicked = new Set(r.filter((x) => x.name === 'daily_offer_click').map(who)).size;
      const bought = new Set(r.filter((x) => x.name === 'content_purchase' && x.props?.offer === 'first_daily').map(who)).size;
      return `카드 본 사람 ${seen}명, 누른 사람 ${clicked}명, 반값 구매 ${bought}명`;
    },
    channel_payers: async (e) => { const c = channels.find((c) => c.source === e.channel); return c ? `최근 7일 ${c.opens}명, 충전 ${c.payers}명` : '아직 없음'; },
  };
  const experiments = [];
  for (const e of exps) experiments.push({ ...e, now: NOW[e.metricKey] ? await NOW[e.metricKey](e) : (e.now || '—') });

  const updatedAt = new Date().toISOString();
  for (const [f, v] of [['daily.json', daily], ['channels.json', channels], ['funnel.json', funnel], ['experiments.json', experiments]]) {
    fs.writeFileSync(path.join(OUT, f), JSON.stringify(v));
  }
  fs.writeFileSync(path.join(OUT, 'updated.txt'), updatedAt);
  const last7 = daily.slice(-7);
  console.log(`저장 ${OUT}  최근 7일(어제까지, 하루 요약 기준): 연 사람 ${funnel[0].now}, 입력 ${funnel[1].now}, 결과 ${funnel[2].now}, 충전 ${funnel[4].now}, 매출 ${last7.reduce((s, d) => s + d.revenue, 0)}원, 출처 ${channels.length}개`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
