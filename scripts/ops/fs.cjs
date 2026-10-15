/* 읽기 전용 Firestore 조회 도우미 — firebase-tools 로그인 세션 사용 (쓰기 호출 없음) */
const FT = 'C:/Users/quswn/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const { requireAuth } = require(FT + '/requireAuth.js');
const { Client } = require(FT + '/apiv2.js');
const BASE = '/v1/projects/appintoss-saju/databases/(default)/documents';
let client;
async function init() {
  if (client) return client;
  const { selectAccount } = require(FT + '/auth.js');
  const acc = selectAccount(undefined, 'D:/550saju');
  await requireAuth({ projectRoot: 'D:/550saju', project: 'appintoss-saju', user: acc && acc.user, tokens: acc && acc.tokens });
  client = new Client({ urlPrefix: 'https://firestore.googleapis.com', auth: true });
  return client;
}
const val = (v) => {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x); return o; }
  return null;
};
const flat = (d) => { const o = { __id: d.name.split('/').pop() }; for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v); return o; };
async function list(col, mask) {
  const c = await init();
  const out = []; let pt = '';
  do {
    const q = { pageSize: 300 };
    if (pt) q.pageToken = pt;
    const qs = new URLSearchParams(q);
    if (mask) for (const m of mask) qs.append('mask.fieldPaths', m);
    const r = await c.get(`${BASE}/${col}?${qs}`);
    out.push(...(r.body.documents || []).map(flat)); pt = r.body.nextPageToken || '';
  } while (pt);
  return out;
}
async function query(structuredQuery, parent = '') {
  const c = await init();
  const r = await c.post(`${BASE}${parent}:runQuery`, { structuredQuery });
  return (r.body || []).filter((x) => x.document).map((x) => flat(x.document));
}
module.exports = { list, query, init };
