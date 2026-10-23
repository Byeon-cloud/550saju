/* 포트원 결제 완료인데 운이 안 들어간 웹 결제 찾기 (2026-10-23, 읽기만)
 *
 *   서버 watchPortonePaid(10분마다)와 같은 대조를 이 PC 에서 돌려 표로 본다. 쓰기 호출 없음(포트원도 조회 API 만).
 *   포트원 키는 표준입력으로만 받고 화면에 찍지 않는다.
 *
 *   사용: firebase functions:secrets:access PORTONE_V2_API_SECRET | node scripts/ops/portone_paid_check.cjs [--hours 48] [--full]
 *     --hours N  최근 N시간(기본 48, 최대 2160)
 *     --full     결제번호와 회원 ID 를 다 보여 준다(기본은 회원 ID 앞 6자만). 운을 넣을 때 오너 PC 에서만 쓴다.
 *
 *   판정: 포트원 PAID(실결제 채널) 중 우리 장부(users/{uid}/payments/{결제번호}, 이관 사본은 orderId 로)에 confirmed 가 없으면 '미지급'.
 *     결제 뒤 10분 안은 손님 화면이 아직 확인 중일 수 있어 '확인 중'으로 따로 센다. 취소, 부분 취소는 포트원 상태가 PAID 가 아니라 빠진다.
 */
const { init } = require('./fs.cjs');

const BASE = '/v1/projects/appintoss-saju/databases/(default)/documents';
const args = process.argv.slice(2);
const hi = args.indexOf('--hours');
const HOURS = Math.max(1, Math.min(2160, Number(hi >= 0 ? args[hi + 1] : 48) || 48));
const FULL = args.includes('--full');
const GRACE_MS = 10 * 60 * 1000;

const kst = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const val = (v) => {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return null;
};
const fields = (d) => { const o = {}; for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v); return o; };
const tsMs = (v) => (typeof v === 'string' ? Date.parse(v) || 0 : 0);

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { s += c; });
    process.stdin.on('end', () => resolve(s));
  });
}

async function getDocOrNull(c, path) {
  try { const r = await c.get(`${BASE}/${path}`); return r.body && r.body.fields ? fields(r.body) : null; } catch { return null; }
}

async function ledgerOf(c, uid, pid) {
  const rows = [];
  if (uid) {
    const d = await getDocOrNull(c, `users/${uid}/payments/${encodeURIComponent(pid)}`);
    if (d) {
      if (d.status === 'confirmed') return { status: 'confirmed', failReason: '', where: uid };
      rows.push({ status: String(d.status || ''), failReason: String(d.failReason || ''), where: uid, at: tsMs(d.lastAttemptAt) || tsMs(d.createdAt) });
    }
  }
  const r = await c.post(`${BASE}:runQuery`, { structuredQuery: {
    from: [{ collectionId: 'payments', allDescendants: true }],
    where: { fieldFilter: { field: { fieldPath: 'orderId' }, op: 'EQUAL', value: { stringValue: pid } } },
    limit: 5,
  } }).catch(() => ({ body: [] }));
  for (const x of (r.body || []).filter((y) => y.document)) {
    const d = fields(x.document);
    const parts = x.document.name.split('/');
    const where = parts[parts.indexOf('users') + 1] || '';
    if (d.status === 'confirmed') return { status: 'confirmed', failReason: '', where };
    rows.push({ status: String(d.status || ''), failReason: String(d.failReason || ''), where, at: tsMs(d.lastAttemptAt) || tsMs(d.createdAt) });
  }
  if (!rows.length) return { status: 'none', failReason: '', where: '' };
  rows.sort((a, b) => b.at - a.at);
  return rows[0];
}

(async () => {
  const raw = await readStdin();
  const key = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop() || '';
  if (!key) { console.error('포트원 키가 표준입력으로 오지 않았어요. firebase functions:secrets:access PORTONE_V2_API_SECRET | node scripts/ops/portone_paid_check.cjs'); process.exit(1); }
  console.log(`포트원 키 끝 네 자리 ${key.slice(-4)}, 최근 ${HOURS}시간`);

  const now = Date.now();
  const from = new Date(now - HOURS * 3600e3).toISOString();
  const items = [];
  for (let page = 0; page < 50; page++) {
    const body = { page: { number: page, size: 100 }, filter: { isTest: false, timestampType: 'STATUS_CHANGED_AT', from, until: new Date(now).toISOString(), status: ['PAID'] } };
    const res = await fetch('https://api.portone.io/payments?requestBody=' + encodeURIComponent(JSON.stringify(body)), { headers: { Authorization: `PortOne ${key}` } });
    if (!res.ok) { console.error('포트원 조회 실패', res.status, (await res.text().catch(() => '')).slice(0, 200)); process.exit(1); }
    const j = await res.json();
    items.push(...(j.items || []));
    if ((j.items || []).length < 100) break;
  }

  const c = await init();
  const rows = [];
  let confirmed = 0; let young = 0; let testCh = 0;
  for (const p of items) {
    const pid = String(p.id || '');
    if (!pid || p.status !== 'PAID') continue;
    if (p.channel && p.channel.type && p.channel.type !== 'LIVE') { testCh++; continue; }
    const paidMs = Date.parse(p.paidAt || p.statusChangedAt || '') || 0;
    let cd = p.customData;
    try { if (typeof cd === 'string') cd = JSON.parse(cd); } catch { cd = null; }
    const uid = cd && typeof cd.uid === 'string' && pid.startsWith(cd.uid.slice(0, 8)) ? cd.uid : '';
    const led = await ledgerOf(c, uid, pid);
    if (led.status === 'confirmed') { confirmed++; continue; }
    const isYoung = !paidMs || now - paidMs < GRACE_MS;
    if (isYoung) young++;
    const mm = await getDocOrNull(c, `backofficeAlerts/portone_uid_mismatch_${encodeURIComponent(pid)}`);
    const al = await getDocOrNull(c, `backofficeAlerts/portone_unconfirmed_${encodeURIComponent(pid)}`);
    const who = uid || pid.slice(0, 8);
    rows.push({
      '결제 시각(한국)': paidMs ? kst(paidMs) : '?',
      '금액': Number((p.amount && p.amount.total) || 0),
      '회원': FULL ? who : `${who.slice(0, 6)}…`,
      '결제번호': FULL ? pid : `${pid.slice(0, 6)}…${pid.slice(8)}`,
      '장부': led.status + (led.failReason ? ` (${led.failReason.slice(0, 40)})` : ''),
      '계정 불일치 거부': mm ? `돌아온 계정 ${FULL ? mm.callerUid8 : String(mm.callerUid8 || '').slice(0, 6) + '…'}${mm.callerAnon ? ' 익명' : ''}` : '',
      '서버 경보': al ? (al.resolvedAt ? '해결됨' : '보냄') : '',
      '판정': isYoung ? '확인 중일 수 있음(10분 안)' : '미지급',
    });
  }

  console.log(`포트원 결제 완료 ${items.length}건 (테스트 채널 ${testCh}건 제외) | 장부 confirmed ${confirmed}건 | 장부에 confirmed 없음 ${rows.length}건 (그중 10분 안 ${young}건)`);
  if (rows.length) console.table(rows);
  else console.log('미지급 결제 없음');
})().catch((e) => { console.error('실패', e && e.message ? e.message : e); process.exit(1); });
