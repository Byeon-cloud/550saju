/** CS 2건 후속 조사 (읽기 전용 · 쓰기 0) — 유저A 옛 uid 상세 + 유저B tossUserKey 탐색 + 회전율 기저선 */
const CONFIG_PATH = 'C:/Users/quswn/.config/configstore/firebase-tools.json';
const P = 'appintoss-saju';
const BASE = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)`;
const DOCS = BASE + '/documents';
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const A_OLD = 'APEJhjgnkCXj4csnEExxe9dO8Ml2';
const B_KEY = 'gGo0ym20x5EMqRsLpqU9Sxk4ARw';

const val = (v) => {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return null;
};
const flat = (d) => { const o = {}; for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v); return o; };

(async () => {
  const cfg = require(CONFIG_PATH);
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token' }),
  });
  const H = { Authorization: 'Bearer ' + (await tr.json()).access_token, 'Content-Type': 'application/json' };
  const get = async (p) => (await fetch(DOCS + p, { headers: H })).json();
  const q = async (body) => (await fetch(DOCS + ':runQuery', { method: 'POST', headers: H, body: JSON.stringify(body) })).json();

  // ── 유저A 옛 uid 상세
  console.log('=== 유저A 옛 uid ' + A_OLD + ' ===');
  const a = flat(await get('/users/' + A_OLD));
  console.log('  balance:', JSON.stringify(a.balance ?? null), '| totalCharged:', a.totalCharged ?? '-', '| lastActiveAt:', a.lastActiveAt ?? '-');
  const apays = await get(`/users/${A_OLD}/payments?pageSize=30`);
  console.log('  payments:', (apays.documents || []).length, '건');
  (apays.documents || []).forEach((p) => { const x = flat(p); console.log(`    ₩${x.amount} +${x.paidUn}운+${x.bonusUn} ${String(x.createdAt || '').slice(0, 10)} ${x.status}`); });
  let areps = [], pt = '';
  do { const r = await get(`/users/${A_OLD}/reports?pageSize=100${pt ? '&pageToken=' + pt : ''}&mask.fieldPaths=type&mask.fieldPaths=contentType&mask.fieldPaths=name&mask.fieldPaths=createdAt`); areps.push(...(r.documents || [])); pt = r.nextPageToken || ''; } while (pt);
  const arows = areps.map(flat);
  console.log(`  reports: ${areps.length}건 (유료 ${arows.filter((r) => r.type === 'paid').length})`);
  const adates = arows.map((r) => String(r.createdAt || '').slice(0, 10)).sort();
  console.log(`  기간: ${adates[0] || '-'} ~ ${adates[adates.length - 1] || '-'}`);
  const anames = [...new Set(arows.map((r) => r.name).filter(Boolean))];
  console.log(`  프로필 이름 수: ${anames.length}개 (실명은 출력 생략)`);

  // ── 유저B: tossUserKey 필드 매칭 시도
  console.log('\n=== 유저B tossUserKey == ' + B_KEY.slice(0, 10) + '… 탐색 ===');
  const byKey = await q({ structuredQuery: {
    from: [{ collectionId: 'users' }],
    where: { fieldFilter: { field: { fieldPath: 'tossUserKey' }, op: 'EQUAL', value: { stringValue: B_KEY } } },
    limit: 5 } });
  const hits = (Array.isArray(byKey) ? byKey : []).filter((r) => r.document);
  if (!hits.length) console.log('  매칭 0건', byKey[0]?.error ? '(에러: ' + byKey[0].error.status + ')' : '');
  hits.forEach((r) => {
    const uid = r.document.name.split('/').pop(); const x = flat(r.document);
    console.log(`  발견: ${uid} | balance ${JSON.stringify(x.balance ?? null)} | lastActiveAt ${x.lastActiveAt ?? '-'}`);
  });

  // ── 회전율 기저선: 기간별 "리포트 0건 uid" 생성 수 (배포 전후 비교)
  console.log('\n=== 빈 uid 생성률 — 배포 전후 비교 ===');
  let users = [], pt2 = '';
  do { const r = await get('/users?pageSize=300' + (pt2 ? '&pageToken=' + pt2 : '') + '&mask.fieldPaths=createdAt'); users.push(...(r.documents || [])); pt2 = r.nextPageToken || ''; } while (pt2);
  const buckets = { '6/13~7/28 (기저 46일)': [x => x >= '2026-06-13' && x < '2026-07-29'], '7/29~8/13 (배포후 16일)': [x => x >= '2026-07-29'] };
  for (const [label, [fn]] of Object.entries(buckets)) {
    const inRange = users.filter((u) => fn(String(flat(u).createdAt || '')));
    let shells = 0;
    for (const u of inRange) {
      const uid = u.name.split('/').pop();
      const rr = await get(`/users/${uid}/reports?pageSize=1&mask.fieldPaths=type`);
      if (!(rr.documents || []).length) shells++;
    }
    console.log(`  ${label}: 신규 uid ${inRange.length}개 중 리포트 0건 ${shells}개`);
  }
})().catch((e) => console.log('ERR', e.message));
