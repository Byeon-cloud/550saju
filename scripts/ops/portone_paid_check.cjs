/* 포트원 결제 완료인데 운이 안 들어간 웹 결제 찾기, 자동 채우기 대상 보기 (2026-10-23, 10-24 자동 채우기, 읽기만)
 *
 *   서버 watchPortonePaid(10분마다)와 같은 대조를 이 PC 에서 돌려 표로 본다. 쓰기 호출 없음(포트원도 조회 API 만, Firestore 와 Auth 도 읽기만).
 *   자동 채우기 판정은 서버와 같은 파일(functions/src/payment/autoGrantRules.ts)을 그대로 읽어 쓴다(빌드 없이 바로 변환).
 *   포트원 키는 표준입력으로만 받고 화면에 찍지 않는다(끝 네 자리만).
 *
 *   사용: firebase functions:secrets:access PORTONE_V2_API_SECRET | node scripts/ops/portone_paid_check.cjs [--hours 48] [--full]
 *     --hours N  최근 N시간(기본 48, 최대 2160)
 *     --full     결제번호와 회원 ID 를 다 보여 준다(기본은 회원 ID 앞 6자만). 운을 넣을 때 오너 PC 에서만 쓴다.
 *
 *   판정: 포트원 PAID(실결제 채널) 중 우리 장부(users/{uid}/payments/{결제번호}, 이관 사본은 orderId 로)에 지급 기록이 없으면 '미지급'.
 *     결제 뒤 10분 안은 손님 화면이 아직 확인 중일 수 있어 '확인 중'으로 따로 센다. 취소, 부분 취소는 포트원 상태가 바뀌어 조회에서 빠진다.
 *     '자동 채우기' 칸: 지금 감시가 돈다면 넣을지(대상), 못 넣는 이유(막힘), 나중에 다시 볼지(대기). 감시는 결제 뒤 20분부터 넣는다.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { init } = require('./fs.cjs');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '/v1/projects/appintoss-saju/databases/(default)/documents';
const FT = 'C:/Users/quswn/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const args = process.argv.slice(2);
const hi = args.indexOf('--hours');
const HOURS = Math.max(1, Math.min(2160, Number(hi >= 0 ? args[hi + 1] : 48) || 48));
const FULL = args.includes('--full');
const GRACE_MS = 10 * 60 * 1000;

/** 서버 TypeScript 파일을 빌드 없이 불러온다 (외부 모듈을 쓰지 않는 순수 파일만) */
function loadTs(rel) {
  const ts = require(path.join(ROOT, 'functions/node_modules/typescript'));
  const file = path.join(ROOT, rel);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(out, file);
  return m.exports;
}
const R = loadTs('functions/src/payment/autoGrantRules.ts');
const { PACKAGE_MAP } = loadTs('functions/src/shared/chargePackages.ts');

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
const tsMs = (v) => (typeof v === 'string' ? Date.parse(v) || 0 : typeof v === 'number' ? v : 0);
const customUid = (p) => { let cd = p && p.customData; try { if (typeof cd === 'string') cd = JSON.parse(cd); } catch { cd = null; } return cd && typeof cd.uid === 'string' ? cd.uid : ''; };

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { s += c; });
    process.stdin.on('end', () => resolve(s));
  });
}

/** 문서 읽기 — 없으면 null, 읽기 실패는 throw (판정에서 '모름'으로 다루려고) */
async function getDoc(c, p) {
  try {
    const r = await c.get(`${BASE}/${p}`);
    return r.body && r.body.fields ? fields(r.body) : {};
  } catch (e) {
    if (e && (e.status === 404 || /404|not found/i.test(String(e.message || '')))) return null;
    throw e;
  }
}

/** 서버 ledgerRowsOf 와 같은 대조 (같은 문서는 한 번만) */
async function ledgerRows(c, uid, pid) {
  const rows = new Map();
  if (uid) {
    const d = await getDoc(c, `users/${uid}/payments/${encodeURIComponent(pid)}`);
    if (d) rows.set(`users/${uid}/payments/${pid}`, { ...R.ledgerRowOf(uid, d), at: tsMs(d.lastAttemptAt) || tsMs(d.createdAt) });
  }
  const r = await c.post(`${BASE}:runQuery`, { structuredQuery: {
    from: [{ collectionId: 'payments', allDescendants: true }],
    where: { fieldFilter: { field: { fieldPath: 'orderId' }, op: 'EQUAL', value: { stringValue: pid } } },
    limit: 5,
  } });
  for (const x of (r.body || []).filter((y) => y.document)) {
    const d = fields(x.document);
    const parts = x.document.name.split('/documents/')[1].split('/');
    const where = parts[parts.indexOf('users') + 1] || '';
    rows.set(parts.join('/'), { ...R.ledgerRowOf(where, d), at: tsMs(d.lastAttemptAt) || tsMs(d.createdAt) });
  }
  return [...rows.values()];
}

function ledgerSummary(rows) {
  const g = rows.find((r) => r.granted);
  if (g) return { status: 'confirmed', failReason: '', where: g.where };
  if (!rows.length) return { status: 'none', failReason: '', where: '' };
  const last = [...rows].sort((a, b) => b.at - a.at)[0];
  return { status: last.status, failReason: last.failReason, where: last.where };
}

let authClient;
/** Firebase Auth 계정이 있나 (읽기만): true, false, 조회 실패 null */
async function authExists(uid) {
  if (!uid) return false;
  try {
    if (!authClient) { const { Client } = require(FT + '/apiv2.js'); authClient = new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', auth: true }); }
    const r = await authClient.post('/v1/projects/appintoss-saju/accounts:lookup', { localId: [uid] });
    return Array.isArray(r.body && r.body.users) && r.body.users.length > 0;
  } catch { return null; }
}

/** 결제 뒤 오너가 이 회원에게 운을 넣은 기록 (서버 ownerGrantAfter 와 같은 기준) */
async function ownerGrantAfter(c, uid, paidMs) {
  try {
    const r = await c.post(`${BASE}:runQuery`, { structuredQuery: {
      from: [{ collectionId: 'compensationLog' }],
      where: { fieldFilter: { field: { fieldPath: 'uids' }, op: 'ARRAY_CONTAINS', value: { stringValue: uid } } },
      limit: 50,
    } });
    for (const x of (r.body || []).filter((y) => y.document)) {
      const d = fields(x.document);
      const at = tsMs(d.at);
      if (at && at >= paidMs - 60e3) return `${d.reason || 'other'} ${Number(d.amount) || 0}운, ${kst(at)}`;
    }
    const comp = await getDoc(c, `compensations/${encodeURIComponent(uid)}`);
    const cAt = comp ? tsMs(comp.updatedAt) || tsMs(comp.createdAt) : 0;
    if (comp && cAt >= paidMs - 60e3) return `보상 장부 ${Number(comp.amount) || 0}운, ${kst(cAt)}`;
    return false;
  } catch { return null; }
}

async function portone(key, url) {
  const res = await fetch(url, { headers: { Authorization: `PortOne ${key}` } });
  if (!res.ok) throw new Error(`포트원 조회 실패 ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return res.json();
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
    const j = await portone(key, 'https://api.portone.io/payments?requestBody=' + encodeURIComponent(JSON.stringify(body)));
    items.push(...(j.items || []));
    if ((j.items || []).length < 100) break;
  }

  const c = await init();
  const cfg = R.normalizeAutoGrantConfig(await getDoc(c, 'config/portoneAutoGrant'));
  const state = (await getDoc(c, 'config/portoneWatchState')) || {};
  const daily = (await getDoc(c, `portoneAutoGrantDaily/${R.kstDay(now)}`)) || {};
  let grantedTodayWon = Number(daily.won) || 0;
  let grantedThisRun = 0;
  console.log(`자동 채우기 설정: ${cfg.enabled ? '켜짐' : '꺼짐'}, 한 번에 ${cfg.maxPerRun}건, 하루 ${cfg.dailyCapWon.toLocaleString('ko-KR')}원 (오늘 자동으로 넣은 금액 ${grantedTodayWon.toLocaleString('ko-KR')}원)`);
  if (state.lastOkAt) console.log(`감시가 마지막으로 끝까지 본 시각 ${kst(Number(state.lastOkAt))}${state.failSince ? `, 조회 실패 중(${kst(Number(state.failSince))}부터)` : ''}`);

  const rows = [];
  let confirmed = 0; let young = 0; let testCh = 0; let target = 0;
  // 감시와 같은 순서(포트원 목록 순서)로 본다 — 한 번에 넣는 건수 상한이 순서를 따른다
  for (const p of items) {
    const pid = String(p.id || '');
    if (!pid || p.status !== 'PAID') continue;
    if (p.channel && p.channel.type && p.channel.type !== 'LIVE') { testCh++; continue; }
    const paidMs = Date.parse(p.paidAt || p.statusChangedAt || '') || 0;
    const listUid = customUid(p);
    const uid = listUid && pid.startsWith(listUid.slice(0, 8)) ? listUid : '';
    const led = await ledgerRows(c, uid, pid);
    const sum = ledgerSummary(led);
    if (sum.status === 'confirmed') { confirmed++; continue; }
    const isYoung = !paidMs || now - paidMs < GRACE_MS;
    if (isYoung) young++;
    const mm = await getDoc(c, `portoneUidMismatch/${encodeURIComponent(pid)}`).catch(() => null);
    const al = await getDoc(c, `backofficeAlerts/portone_unconfirmed_${encodeURIComponent(pid)}`).catch(() => null);
    const amount = Number((p.amount && p.amount.total) || 0);

    // 자동 채우기 판정 (감시와 같은 규칙)
    let auto;
    if (!cfg.enabled) auto = '꺼짐';
    else if (al && al.autoGrantedAt) auto = '이미 자동으로 넣음';
    else if (al && al.manualHandled) auto = '오너 직접 처리 표시';
    else if (al && al.autoGrantBlockedAt) auto = `막힘(앞서 알림): ${(al.autoGrantBlocked || []).join('; ')}`;
    else if (isYoung) auto = '대기: 결제 뒤 10분 안';
    else if (now - paidMs < R.AUTO_GRANT_MIN_AGE_MS) auto = '대기: 결제 뒤 20분 안';
    else {
      const one = await portone(key, `https://api.portone.io/payments/${encodeURIComponent(pid)}`).catch((e) => ({ __err: e.message }));
      if (one.__err) auto = `대기: ${one.__err.slice(0, 60)}`;
      else {
        const freshUid = customUid(one);
        const d = R.decideAutoGrant({
          now, paymentId: pid,
          fresh: { status: one.status, channelType: one.channel && one.channel.type, currency: one.currency, amount: Number(one.amount && one.amount.total), customDataUid: freshUid },
          listAmount: amount, listCustomDataUid: listUid, paidMs,
          packageAmounts: Object.keys(PACKAGE_MAP).map(Number),
          authExists: await authExists(freshUid), ledger: led, manualHandled: !!(al && al.manualHandled),
          ownerGrantAfterPay: freshUid ? await ownerGrantAfter(c, freshUid, paidMs) : false,
          grantedTodayWon, grantedThisRun, cfg,
        });
        if (d.ok) {
          target++; grantedThisRun++; grantedTodayWon += amount;
          auto = '대상: 다음 감시 실행에 넣음';
        } else auto = `${d.final ? '막힘' : '대기'}: ${d.reasons.join('; ')}`;
      }
    }

    const who = uid || pid.slice(0, 8);
    rows.push({
      '결제 시각(한국)': paidMs ? kst(paidMs) : '?',
      '금액': amount,
      '회원': FULL ? who : `${who.slice(0, 6)}…`,
      '결제번호': FULL ? pid : `${pid.slice(0, 6)}…${pid.slice(8)}`,
      '장부': sum.status + (sum.failReason ? ` (${sum.failReason.slice(0, 40)})` : ''),
      '계정 불일치 거부': mm ? `돌아온 계정 ${FULL ? mm.callerUid8 : String(mm.callerUid8 || '').slice(0, 6) + '…'}${mm.callerAnon ? ' 익명' : ''}` : '',
      '서버 경보': al ? (al.resolvedAt ? '해결됨' : al.mailedAt ? '메일 보냄' : al.mailPending ? '메일 대기' : '남김') : '',
      '판정': isYoung ? '확인 중일 수 있음(10분 안)' : '미지급',
      '자동 채우기': auto,
    });
  }

  console.log(`포트원 결제 완료 ${items.length}건 (테스트 채널 ${testCh}건 제외) | 장부 지급 ${confirmed}건 | 장부에 지급 없음 ${rows.length}건 (그중 10분 안 ${young}건) | 자동 채우기 대상 ${target}건`);
  if (rows.length) console.table(rows);
  else console.log('미지급 결제 없음');
})().catch((e) => { console.error('실패', e && e.message ? e.message : e); process.exit(1); });
