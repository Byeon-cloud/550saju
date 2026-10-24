/* Firestore 쓰기 도우미 (2026-10-24) — firebase-tools 로그인 세션. 읽기는 fs.cjs, 쓰기는 이 파일만 쓴다.
 *   patchDoc('adSpend/2026-10-24_naver', { day, amount, ... }, { mask: true })  — mask 면 넘긴 칸만 바꾸고 나머지 칸은 둔다 */
const { init } = require('./fs.cjs');
const BASE = '/v1/projects/appintoss-saju/databases/(default)/documents';

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
  throw new Error(`못 쓰는 값: ${typeof v}`);
}

async function patchDoc(docPath, data, { mask = false } = {}) {
  const c = await init();
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)]));
  const qs = mask ? `?${Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')}` : '';
  const r = await c.request({ method: 'PATCH', path: `${BASE}/${docPath}${qs}`, body: { fields } });
  return r.body;
}

/** 문서 하나 읽기 (없으면 null). 값은 fs.cjs 와 같은 모양(평범한 JS 값) */
async function getDoc(docPath) {
  const c = await init();
  try {
    const r = await c.request({ method: 'GET', path: `${BASE}/${docPath}` });
    const val = (v) => {
      if (v == null) return null;
      if ('stringValue' in v) return v.stringValue;
      if ('integerValue' in v) return Number(v.integerValue);
      if ('doubleValue' in v) return v.doubleValue;
      if ('booleanValue' in v) return v.booleanValue;
      if ('timestampValue' in v) return v.timestampValue;
      if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
      if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
      return null;
    };
    return Object.fromEntries(Object.entries(r.body.fields || {}).map(([k, x]) => [k, val(x)]));
  } catch (e) {
    if (e.status === 404 || /404|NOT_FOUND/.test(String(e.message))) return null;
    throw e;
  }
}

module.exports = { patchDoc, getDoc, toValue };
