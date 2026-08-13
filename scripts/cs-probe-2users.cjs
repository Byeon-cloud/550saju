/**
 * CS 2건 읽기 전용 조사 (2026-08-13) — 쓰기 호출 0
 *   유저A: 토스 deviceId 4c7f87e8d39a41fc17ead8b12f5df6125bbf5766c9eac1306f25deba877f391d (Android)
 *   유저B: 토스 deviceId 5fb4fce600b13e4a3e4f278eba0a0289677dc51ef8b6a819c73df1e0cabf0d3f / 익명키 gGo0ym20x5EMqRsLpqU9Sxk4ARw (iOS)
 *
 * 조회 경로:
 *   1) compensations/{deviceId} — 토스 deviceId 가 우리 DB 에 남는 유일한 곳. claimedByUid 로 옛 uid 역추적
 *   2) users/{익명키} 정확 + 전 유저 prefix 매칭 (키가 잘렸을 가능성)
 *   3) 발견 uid 의 users doc / payments / reports 실재 확인
 *   4) 영향 범위: 7/29 이후 생성된 빈 껍데기 uid 수 (회전 프록시)
 *   5) 백업 상태: PITR / backupSchedules 메타데이터 (읽기)
 */
const CONFIG_PATH = 'C:/Users/quswn/.config/configstore/firebase-tools.json';
const P = 'appintoss-saju';
const BASE = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)`;
const DOCS = BASE + '/documents';
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const A_DID = '4c7f87e8d39a41fc17ead8b12f5df6125bbf5766c9eac1306f25deba877f391d';
const B_DID = '5fb4fce600b13e4a3e4f278eba0a0289677dc51ef8b6a819c73df1e0cabf0d3f';
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
  const H = { Authorization: 'Bearer ' + (await tr.json()).access_token };
  const get = async (p) => (await fetch(DOCS + p, { headers: H })).json();
  const getRaw = async (url) => (await fetch(url, { headers: H })).json();

  // ── 1) compensations 장부에서 deviceId 흔적
  console.log('=== 1) compensations/{deviceId} ===');
  for (const [label, did] of [['유저A', A_DID], ['유저B', B_DID]]) {
    const d = await get('/compensations/' + did);
    if (d.error) { console.log(`  ${label}: 문서 없음 (${d.error.status})`); continue; }
    const x = flat(d);
    console.log(`  ${label}: 발견! ${JSON.stringify(x).slice(0, 300)}`);
  }
  // 전체 compensations 나열 (문서 수 적을 것) — claimedByUid 수집
  const comps = await get('/compensations?pageSize=100');
  console.log('  compensations 전체:', (comps.documents || []).length, '건');
  (comps.documents || []).forEach((d) => {
    const id = d.name.split('/').pop(); const x = flat(d);
    console.log(`    ${id.slice(0, 16)}… amount=${x.amount} claimed=${x.claimed} claimedByUid=${x.claimedByUid || '-'} at=${String(x.claimedAt || '').slice(0, 16)}`);
  });

  // ── 2) 익명키 조회 (정확 + prefix)
  console.log('\n=== 2) users/' + B_KEY + ' (정확) ===');
  const exact = await get('/users/' + B_KEY);
  if (exact.error) console.log('  없음 (' + exact.error.status + ')');
  else {
    const x = flat(exact);
    console.log('  발견! keys:', Object.keys(x).join(','), '| balance:', JSON.stringify(x.balance ?? null), '| lastActiveAt:', x.lastActiveAt ?? '-');
  }
  // prefix 매칭 (27자 — 잘렸을 가능성)
  let users = [], pt = '';
  do {
    const r = await get('/users?pageSize=300' + (pt ? '&pageToken=' + pt : '') + '&mask.fieldPaths=lastActiveAt&mask.fieldPaths=createdAt');
    users.push(...(r.documents || [])); pt = r.nextPageToken || '';
  } while (pt);
  const pre = users.filter((u) => u.name.split('/').pop().startsWith(B_KEY));
  console.log('  prefix 매칭:', pre.length, '건 —', pre.map((u) => u.name.split('/').pop()).join(', ') || '(없음)');

  // ── 3) 발견 uid 상세 (prefix 매칭분)
  for (const u of pre) {
    const uid = u.name.split('/').pop();
    console.log(`\n=== 3) ${uid} 상세 ===`);
    const doc = flat(await get('/users/' + uid));
    console.log('  keys:', Object.keys(doc).join(','), '| balance:', JSON.stringify(doc.balance ?? null), '| totalCharged:', doc.totalCharged ?? '-');
    console.log('  createdAt:', doc.createdAt ?? '-', '| lastActiveAt:', doc.lastActiveAt ?? '-');
    const pays = await get(`/users/${uid}/payments?pageSize=30`);
    console.log('  payments:', (pays.documents || []).length, '건');
    (pays.documents || []).forEach((p) => { const x = flat(p); console.log(`    ₩${x.amount} +${x.paidUn}운+${x.bonusUn} ${String(x.createdAt || '').slice(0, 10)} ${x.status}`); });
    let reps = [], p2 = '';
    do { const r = await get(`/users/${uid}/reports?pageSize=100${p2 ? '&pageToken=' + p2 : ''}&mask.fieldPaths=type&mask.fieldPaths=contentType&mask.fieldPaths=createdAt`); reps.push(...(r.documents || [])); p2 = r.nextPageToken || ''; } while (p2);
    const rows = reps.map(flat);
    const paid = rows.filter((r) => r.type === 'paid').length;
    const dates = rows.map((r) => String(r.createdAt || '').slice(0, 10)).sort();
    console.log(`  reports: ${reps.length}건 (유료 ${paid}) | 기간 ${dates[0] || '-'} ~ ${dates[dates.length - 1] || '-'}`);
  }

  // ── 4) 영향 범위 — 7/29 이후 생성된 빈 껍데기 (회전 프록시)
  console.log('\n=== 4) 영향 범위 (프록시) ===');
  console.log('  전체 users:', users.length, '명');
  let shellAfter = 0, shellList = [];
  for (const u of users) {
    const x = flat(u);
    const created = String(x.createdAt || '');
    if (created >= '2026-07-29') {
      // 빈 껍데기 판정: reports 0건
      const uid = u.name.split('/').pop();
      const rr = await get(`/users/${uid}/reports?pageSize=1&mask.fieldPaths=type`);
      const hasReports = (rr.documents || []).length > 0;
      if (!hasReports) { shellAfter++; shellList.push(uid.slice(0, 12) + '…(' + created.slice(5, 10) + ')'); }
    }
  }
  console.log('  7/29 이후 생성 + 리포트 0건 uid:', shellAfter, '건');
  console.log('  ', shellList.join(' '));

  // ── 5) 백업 상태 (메타데이터 읽기)
  console.log('\n=== 5) 백업 상태 ===');
  const dbMeta = await getRaw(`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)`);
  console.log('  PITR:', dbMeta.pointInTimeRecoveryEnablement ?? '(필드 없음)');
  console.log('  earliestVersionTime:', dbMeta.earliestVersionTime ?? '-');
  console.log('  versionRetentionPeriod:', dbMeta.versionRetentionPeriod ?? '-');
  const sched = await getRaw(`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/backupSchedules`);
  console.log('  backupSchedules:', JSON.stringify(sched).slice(0, 300));
})().catch((e) => console.log('ERR', e.message));
