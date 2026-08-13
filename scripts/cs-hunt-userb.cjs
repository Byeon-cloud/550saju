/** 유저B(iOS 결제자) 옛 uid 추적 — 읽기 전용 (2026-08-13)
 *   deviceId 5fb4fce6... / 익명키 gGo0ym20x5EMqRsLpqU9Sxk4ARw / iOS / 충전(결제) 이력 있음
 *   지금까지 실패: users/{익명키} 없음, tossUserKey 매칭 0, compensations/{deviceId} 없음.
 *   재시도: ① 익명키가 어느 필드/문서id 에든 있나 (truncated 가능성 포함 prefix)
 *          ② deviceId 가 어느 필드에든 있나
 *          ③ iOS 결제자 중 최근 버려진(활동 끊긴) 계정 후보 나열 (payments 보유 + reports 보유) */
const CONFIG_PATH = 'C:/Users/quswn/.config/configstore/firebase-tools.json';
const P = 'appintoss-saju';
const DOCS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const DID = '5fb4fce600b13e4a3e4f278eba0a0289677dc51ef8b6a819c73df1e0cabf0d3f';
const KEY = 'gGo0ym20x5EMqRsLpqU9Sxk4ARw';

const val = (v) => { if (v == null) return null; if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue; if ('booleanValue' in v) return v.booleanValue; if ('timestampValue' in v) return v.timestampValue; if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x); return o; } return null; };
const flat = (d) => { const o = {}; for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v); return o; };
const deepFind = (obj, needle) => { try { return JSON.stringify(obj).includes(needle); } catch { return false; } };

(async () => {
  const cfg = require(CONFIG_PATH);
  const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token' }) });
  const H = { Authorization: 'Bearer ' + (await tr.json()).access_token };
  const get = async (p) => (await fetch(DOCS + p, { headers: H })).json();

  let users = [], pt = '';
  do { const r = await get('/users?pageSize=300' + (pt ? '&pageToken=' + pt : '')); users.push(...(r.documents || [])); pt = r.nextPageToken || ''; } while (pt);
  console.log('전체 users:', users.length);

  // ① 익명키/deviceId 가 문서 id 또는 아무 필드에든 존재?
  const key20 = KEY.slice(0, 20);
  let hitField = [];
  for (const u of users) {
    const id = u.name.split('/').pop();
    const d = flat(u);
    if (id.startsWith(key20) || id.includes(KEY)) hitField.push(`docid=${id}`);
    if (deepFind(d, KEY)) hitField.push(`field(익명키)=${id}`);
    if (deepFind(d, DID)) hitField.push(`field(deviceId)=${id}`);
  }
  console.log('\n① 익명키/deviceId 직접 매칭:', hitField.length ? hitField.join(', ') : '없음');

  // ② iOS 결제자 중 활동 끊긴 후보 (payments 보유 + reports 보유 + lastActive 오래됨)
  console.log('\n② iOS 결제 계정 후보 (payments>0 · plat/iOS 흔적):');
  const cands = [];
  for (const u of users) {
    const uid = u.name.split('/').pop();
    const d = flat(u);
    const pays = await get(`/users/${uid}/payments?pageSize=20`);
    const pd = pays.documents || [];
    if (!pd.length) continue;
    // reports 수 + iOS 흔적
    const reps = await get(`/users/${uid}/reports?pageSize=100&mask.fieldPaths=type`);
    const rc = (reps.documents || []).length;
    const paid = pd.map(flat).reduce((s, x) => s + (x.paidUn || 0), 0);
    const bonus = pd.map(flat).reduce((s, x) => s + (x.bonusUn || 0), 0);
    const iosHint = deepFind(d, 'iOS') || deepFind(d, 'iphone') || deepFind(d, 'ios');
    cands.push({ uid, last: d.lastActiveAt || '-', reps: rc, pays: pd.length, paid, bonus, ios: iosHint });
  }
  // 최근활동 오래된 순 (버려진 계정 우선)
  cands.sort((a, b) => String(a.last).localeCompare(String(b.last)));
  cands.slice(0, 30).forEach((c) => console.log(`  ${c.uid} | last ${String(c.last).slice(0, 16)} | 리포트 ${c.reps} | 결제 ${c.pays}건(${c.paid}+${c.bonus}운) | iOS힌트 ${c.ios ? 'Y' : '-'}`));

  // ③ 8월 초 이후 활동 끊긴 결제자만 (유저B = 8/13 문의, 그 전 마지막 활동)
  console.log('\n③ 최근활동 8/1~8/13 이면서 결제자 (유저B 유력 시간대):');
  cands.filter((c) => String(c.last) >= '2026-07-25' && String(c.last) <= '2026-08-13').forEach((c) => console.log(`  ${c.uid} | last ${String(c.last).slice(0, 16)} | 리포트 ${c.reps} | ${c.paid}+${c.bonus}운`));
})().catch((e) => console.log('ERR', e.message));
