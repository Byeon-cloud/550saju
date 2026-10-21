/* 유료 광고 성과 판정 (읽기만) — 사용: node ad_report.cjs 2026-10-20 2026-10-27 [광고비JSON]
 *   광고(utm_source=meta, naver)로 들어온 기기를 소재(utm_content)와 노출 위치(utm_term), 나이대(본인 사주 출생 연도)로 나눠
 *   연 사람, 사주 입력, 결과, 충전한 사람, 충전 매출을 센다. 오너 기기(internal) 제외, 사람 수는 기기(did) 기준.
 *   광고비JSON(선택): {"meta": 70000, "naver": 70000} 처럼 주면 한 명당 비용까지 낸다.
 *   판정 기준(2026-10-20 마케팅 오더): 충전한 사람 한 명당 광고비 4,000원 이하 키움, 4,000~10,000원 하나 바꿔 1주 더, 10,000원 넘으면 멈춤.
 *   2026-10-20 이전 기록에는 utm_content 가 없다(그날 웹 배포부터 남는다). */
const { query } = require('./fs.cjs');
const [from, to, spendArg] = process.argv.slice(2);
if (!from || !to) { console.log('사용: node ad_report.cjs 시작일 끝일 [{"meta":70000}]'); process.exit(1); }
const spend = spendArg ? JSON.parse(spendArg) : {};
const AD_SOURCES = new Set(['meta', 'naver', 'tossads', 'instagram', 'facebook']);
const NAMES = ['app_open', 'page_view', 'profile_created', 'content_result', 'content_purchase', 'charge_complete', 'manse_view', 'tti_open', 'seo_view', 'tojung_preview_view', 'charge_open'];
const days = [];
for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d = new Date(d.getTime() + 864e5)) days.push(d.toISOString().slice(0, 10));

(async () => {
  const rows = [];
  for (const day of days) {
    const r = await query({
      from: [{ collectionId: 'analytics' }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'day' }, op: 'EQUAL', value: { stringValue: day } } },
        { fieldFilter: { field: { fieldPath: 'name' }, op: 'IN', value: { arrayValue: { values: NAMES.map((n) => ({ stringValue: n })) } } } },
      ] } },
      select: { fields: ['name', 'did', 'uid', 'props', 'utm', 'demo', 'internal', 'plat', 'day', 'ts'].map((f) => ({ fieldPath: f })) },
    });
    rows.push(...r.filter((x) => !x.internal));
  }
  rows.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const who = (x) => x.did || x.uid || '?';
  // 기기의 첫 광고 출처 (태그가 이어진 방문 carried 포함)
  const first = new Map();
  const age = new Map();
  for (const x of rows) {
    const s = String(x.utm?.source || '').toLowerCase();
    if (AD_SOURCES.has(s) && !first.has(who(x))) first.set(who(x), { source: s, campaign: x.utm.campaign || '-', content: x.utm.content || '(소재 기록 없음)', term: x.utm.term || '-' });
    if (x.demo?.ab) age.set(who(x), x.demo.ab);
  }
  const groups = { source: new Map(), content: new Map(), term: new Map(), age: new Map() };
  const bump = (m, k, w, x) => {
    const g = m.get(k) || { opens: new Set(), inputs: new Set(), results: new Set(), payers: new Set(), revenue: 0 };
    g.opens.add(w);
    if (x.name === 'profile_created') g.inputs.add(w);
    if (x.name === 'content_result' || x.name === 'manse_view' || x.name === 'tojung_preview_view') g.results.add(w); // 2026-10-21 무료 결과(만세력, 신년 미리 보기)도 결과로
    if (x.name === 'charge_open') (g.charge ||= new Set()).add(w);
    if (x.name === 'charge_complete') { g.payers.add(w); g.revenue += Number(x.props?.amount) || 0; }
    m.set(k, g);
  };
  for (const x of rows) {
    const w = who(x); const f = first.get(w);
    if (!f) continue;
    bump(groups.source, f.source, w, x);
    bump(groups.content, `${f.source} ${f.content}`, w, x);
    bump(groups.term, `${f.source} ${f.term}`, w, x);
    bump(groups.age, `${f.source} ${age.get(w) || '나이 모름'}`, w, x);
  }
  const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '-');
  const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;
  console.log(`광고 성과 ${from} ~ ${to} (오너 기기 제외, 기기 수)`);
  for (const [title, m] of [['출처', groups.source], ['소재', groups.content], ['노출 위치', groups.term], ['나이대(본인 사주)', groups.age]]) {
    console.log(`\n[${title}]  연 사람 / 사주 입력 / 결과(무료 포함) / 충전 화면 / 충전 / 매출`);
    for (const [k, g] of [...m.entries()].sort((a, b) => b[1].opens.size - a[1].opens.size)) {
      console.log(`  ${k}: ${g.opens.size} / ${g.inputs.size} (${pct(g.inputs.size, g.opens.size)}) / ${g.results.size} / ${g.charge ? g.charge.size : 0} / ${g.payers.size} / ${won(g.revenue)}`);
    }
  }
  if (Object.keys(spend).length) {
    console.log('\n[판정] 충전한 사람 한 명당 광고비 (4,000원 이하 키움, 1만 원 넘으면 멈춤)');
    for (const [src, cost] of Object.entries(spend)) {
      const g = groups.source.get(src);
      const payers = g ? g.payers.size : 0; const inputs = g ? g.inputs.size : 0;
      const per = payers ? cost / payers : null;
      const verdict = per == null ? '판정 불가(충전 0)' : per <= 4000 ? '키움' : per <= 10000 ? '하나 바꿔 1주 더' : '멈춤';
      console.log(`  ${src}: 광고비 ${won(cost)}, 사주 입력 ${inputs}명(한 명당 ${inputs ? won(cost / inputs) : '-'}), 충전 ${payers}명(한 명당 ${per ? won(per) : '-'}), 매출 ${won(g ? g.revenue : 0)} → ${verdict}`);
    }
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
