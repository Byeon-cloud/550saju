/* 웹 결제 단계별 이탈 (읽기만) — 사용: node scripts/ops/pay_funnel.cjs 2026-10-20 2026-10-26
 *   충전 화면을 연 기기마다 충전 화면 → 결제하기 → 로그인 → 결제 수단 → 완료(또는 실패)까지 어디서 멈췄는지 센다.
 *   앱 안 브라우저(iab, 10-21 부터 기록)와 광고 출처로 나눈다. 오너 기기(internal)와 앱(plat ait)은 뺀다. */
const { query } = require('./fs.cjs');

const [from, to] = process.argv.slice(2);
if (!from || !to) { console.log('사용: node scripts/ops/pay_funnel.cjs 2026-10-20 2026-10-26'); process.exit(1); }
const days = [];
for (let d = new Date(from + 'T00:00:00Z'); d <= new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
const ADS = new Set(['meta', 'naver', 'tossads', 'instagram', 'facebook', 'creator', 'google', 'kakao']);
const NAMES = ['charge_open', 'cta_click', 'login_success', 'login_fail', 'charge_failed', 'charge_complete'];

(async () => {
  const rows = [];
  for (const day of days) {
    const r = await query({
      from: [{ collectionId: 'analytics' }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'day' }, op: 'EQUAL', value: { stringValue: day } } },
        { fieldFilter: { field: { fieldPath: 'name' }, op: 'IN', value: { arrayValue: { values: NAMES.map((n) => ({ stringValue: n })) } } } },
      ] } },
      select: { fields: ['name', 'did', 'uid', 'props', 'utm', 'internal', 'plat', 'iab', 'ts'].map((f) => ({ fieldPath: f })) },
    });
    rows.push(...r.filter((x) => !x.internal && x.plat !== 'ait'));
  }
  rows.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const byDev = new Map();
  for (const x of rows) { const k = x.did || x.uid; if (!k) continue; if (!byDev.has(k)) byDev.set(k, []); byDev.get(k).push(x); }

  const STEPS = ['충전 화면', '결제하기 누름', '로그인 성공(또는 이미 로그인)', '결제 수단 누름', '결제 완료'];
  const groups = new Map();
  const add = (g, reached, failed, noKakao) => {
    if (!groups.has(g)) groups.set(g, { n: STEPS.map(() => 0), failed: 0, noKakao: 0 });
    const o = groups.get(g); for (let i = 0; i < reached; i++) o.n[i]++; o.failed += failed ? 1 : 0; o.noKakao += noKakao ? 1 : 0;
  };
  for (const ev of byDev.values()) {
    const i0 = ev.findIndex((x) => x.name === 'charge_open');
    if (i0 < 0) continue;
    const after = ev.slice(i0);
    const label = (x) => String(x.props?.label || '');
    const payClick = after.findIndex((x) => x.name === 'cta_click' && /원 결제하기/.test(label(x)));
    const methodClick = after.findIndex((x) => x.name === 'cta_click' && /^(카카오페이|신용과 체크카드)/.test(label(x)));
    const login = after.findIndex((x) => x.name === 'login_success');
    const done = after.some((x) => x.name === 'charge_complete');
    const failed = after.some((x) => x.name === 'charge_failed');
    // 10-21 결제 수단 화면의 '카카오페이를 안 쓰세요?'(토스 앱 안내) 누름
    const noKakao = after.some((x) => x.name === 'cta_click' && /^카카오페이를 안 쓰세요/.test(label(x)));
    let reached = 1;
    if (payClick >= 0) reached = 2;
    if (reached === 2 && (login >= 0 || methodClick >= 0)) reached = 3;
    if (methodClick >= 0) reached = 4;
    if (done) reached = 5;
    const src = String((ev.find((x) => x.utm?.source) || {}).utm?.source || '').toLowerCase();
    const iab = (ev.find((x) => x.iab) || {}).iab || '일반 브라우저(또는 10-21 전 기록)';
    add('전체', reached, failed, noKakao);
    add('출처: ' + (ADS.has(src) ? '광고 ' + src : src ? '기타 ' + src : '출처 없음'), reached, failed, noKakao);
    add('브라우저: ' + iab, reached, failed, noKakao);
  }
  console.log(`웹 결제 단계 ${from} ~ ${to} (기기 수, 오너 기기와 앱 제외)\n[묶음] ${STEPS.join(' / ')} / 결제 실패 기록 / 카카오페이 없음 누름`);
  for (const [g, o] of [...groups.entries()].sort((a, b) => b[1].n[0] - a[1].n[0])) console.log(`  ${g}: ${o.n.join(' / ')} / ${o.failed} / ${o.noKakao}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
