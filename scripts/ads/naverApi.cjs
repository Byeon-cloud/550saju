/* 네이버 검색광고 API 도우미 (2026-10-19) — 키는 D:\550saju\.secrets\naver_searchad.json (git 제외). 값은 화면에 찍지 않는다.
 *   서명: base64(HMAC-SHA256(secretKey, `${timestamp}.${method}.${uri}`)), uri 는 쿼리 없는 경로 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const KEY = JSON.parse(fs.readFileSync(path.join(__dirname, '../../.secrets/naver_searchad.json'), 'utf8'));
const BASE = 'https://api.searchad.naver.com';

async function call(method, uri, { query, body } = {}) {
  const ts = String(Date.now());
  const sig = crypto.createHmac('sha256', KEY.secretKey).update(`${ts}.${method}.${uri}`).digest('base64');
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const res = await fetch(BASE + uri + qs, {
    method,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Timestamp': ts, 'X-API-KEY': KEY.accessLicense, 'X-Customer': String(KEY.customerId), 'X-Signature': sig },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) { const e = new Error(`${method} ${uri} ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`); e.status = res.status; e.data = data; throw e; }
  return data;
}
module.exports = { call, customerId: String(KEY.customerId) };
