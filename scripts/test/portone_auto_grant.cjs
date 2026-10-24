/* 포트원 자동 채우기 시험 (2026-10-24) — 실제 서비스 데이터, 실제 포트원, 실제 메일 0
 *
 *   서버와 기기의 실제 TypeScript 파일을 빌드 없이 그대로 변환해 돌린다(functions/lib 를 건드리지 않는다).
 *     A. 판정 순수 함수 (functions/src/payment/autoGrantRules.ts)
 *     B. 서버 지급 공용 함수와 감시 (grantPortone.ts, portonePaidWatch.ts) — 가짜 Firestore(트랜잭션 충돌 재시도 포함), 가짜 포트원, 가짜 메일
 *     C. 기기 (src/services/storage/balanceAdjust.ts, firestoreSync.ts syncFromCloud) — 같은 가짜 Firestore, 가짜 localStorage
 *   사용: 루트에서  node scripts/test/portone_auto_grant.cjs   (자동 채우기, 결제 확인, 잔액 맞추기를 바꾸면 꼭 돌린다)
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../..');
const ts = require(path.join(ROOT, 'functions/node_modules/typescript'));

/* ── TS 파일 불러오기 (모듈마다 한 번, 가짜 모듈 바꿔 끼우기) ── */
const cache = new Map();
function loadTs(file, stubs) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  cache.set(file, m);
  m.require = (id) => {
    if (Object.prototype.hasOwnProperty.call(stubs, id)) return stubs[id];
    let p = null;
    if (id.startsWith('@/')) p = path.join(ROOT, 'src', id.slice(2));
    else if (id.startsWith('.')) p = path.resolve(path.dirname(file), id);
    if (p) {
      for (const cand of [p + '.ts', p + '.tsx', path.join(p, 'index.ts')]) if (fs.existsSync(cand)) return loadTs(cand, stubs);
      throw new Error(`불러올 수 없음 ${id} (${file})`);
    }
    return require(id);
  };
  m._compile(out, file);
  return m.exports;
}

/* ── 가짜 Firestore (서버 Admin 과 기기 웹 SDK 가 같은 저장소를 본다) ── */
const store = new Map(); // path → { data, ver }
let verSeq = 0;
let clock = Date.now();
const INC = Symbol('inc'); const TS = Symbol('ts'); const DEL = Symbol('del'); const UNION = Symbol('union');
const FieldValue = {
  increment: (n) => ({ [INC]: n }), serverTimestamp: () => ({ [TS]: true }), delete: () => ({ [DEL]: true }), arrayUnion: (...v) => ({ [UNION]: v }),
};
const mkTs = (ms) => ({ __ts: ms, toMillis: () => ms, toDate: () => new Date(ms) });
const isSpecial = (v) => v && typeof v === 'object' && (INC in v || TS in v || DEL in v || UNION in v);
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !isSpecial(v) && !('__ts' in v);
function applyVal(prev, v) {
  if (v && typeof v === 'object' && INC in v) return (Number(prev) || 0) + v[INC];
  if (v && typeof v === 'object' && TS in v) return mkTs(clock);
  if (v && typeof v === 'object' && UNION in v) return [...new Set([...(Array.isArray(prev) ? prev : []), ...v[UNION]])];
  return v;
}
function mergeInto(prev, data) {
  const out = { ...(prev || {}) };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && DEL in v) { delete out[k]; continue; }
    if (isPlain(v)) out[k] = mergeInto(isPlain(out[k]) ? out[k] : {}, v);
    else out[k] = applyVal(out[k], v);
  }
  return out;
}
function setDotted(obj, dotted, v) {
  const parts = dotted.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = isPlain(o[parts[i]]) ? { ...o[parts[i]] } : {}; o = o[parts[i]]; }
  const last = parts[parts.length - 1];
  if (v && typeof v === 'object' && DEL in v) delete o[last];
  else o[last] = applyVal(o[last], v);
}
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x, (k, v) => (v && v.__ts !== undefined ? { __ts: v.__ts } : v)), (k, v) => (v && typeof v === 'object' && v.__ts !== undefined ? mkTs(v.__ts) : v)));
const raw = (p) => store.get(p)?.data;
function writeDoc(p, data) { store.set(p, { data, ver: ++verSeq }); }
function opSet(p, data, opt) { writeDoc(p, opt && opt.merge ? mergeInto(raw(p), data) : mergeInto({}, data)); }
function opUpdate(p, data) { if (!store.has(p)) throw new Error('NOT_FOUND ' + p); const d = clone(raw(p)); for (const [k, v] of Object.entries(data)) setDotted(d, k, v); writeDoc(p, d); }
function opCreate(p, data) { if (store.has(p)) { const e = new Error('ALREADY_EXISTS ' + p); e.code = 6; throw e; } writeDoc(p, mergeInto({}, data)); }
const tick = () => new Promise((r) => setImmediate(r));

function adminSnap(p) {
  const e = store.get(p);
  return { exists: !!e, id: p.split('/').pop(), ref: adminDoc(p), data: () => (e ? clone(e.data) : undefined) };
}
function adminDoc(p) {
  const segs = p.split('/');
  return {
    path: p, id: segs[segs.length - 1],
    parent: { id: segs[segs.length - 2], parent: segs.length > 2 ? adminDoc(segs.slice(0, -2).join('/')) : null },
    get: async () => { await tick(); return adminSnap(p); },
    set: async (d, o) => { await tick(); opSet(p, d, o); },
    update: async (d) => { await tick(); opUpdate(p, d); },
    create: async (d) => { await tick(); opCreate(p, d); },
    delete: async () => { store.delete(p); },
    collection: (c) => adminCol(`${p}/${c}`),
  };
}
const matches = (data, filters) => filters.every(([f, op, v]) => {
  const x = data ? data[f] : undefined;
  if (op === '==') return x === v;
  if (op === 'array-contains') return Array.isArray(x) && x.includes(v);
  throw new Error('op ' + op);
});
function adminQuery(sel, filters, lim) {
  return {
    where: (f, op, v) => adminQuery(sel, [...filters, [f, op, v]], lim),
    limit: (n) => adminQuery(sel, filters, n),
    get: async () => {
      await tick();
      const docs = [...store.keys()].filter(sel).filter((k) => matches(raw(k), filters)).slice(0, lim || 1e9).map(adminSnap);
      return { empty: !docs.length, size: docs.length, docs };
    },
  };
}
const inCol = (c) => (k) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/');
function adminCol(c) {
  let n = 0;
  return { doc: (id) => adminDoc(`${c}/${id || 'auto' + (++verSeq) + '_' + (++n)}`), add: async (d) => { const r = adminDoc(`${c}/auto${++verSeq}`); await r.set(d); return r; }, ...adminQuery(inCol(c), [], 0) };
}
let txConflicts = 0;
async function runTransaction(fn) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const reads = new Map(); const writes = [];
    const tx = {
      get: async (ref) => { await tick(); const e = store.get(ref.path); reads.set(ref.path, e ? e.ver : 0); return adminSnap(ref.path); },
      set: (ref, d, o) => { writes.push(() => opSet(ref.path, d, o)); },
      update: (ref, d) => { writes.push(() => opUpdate(ref.path, d)); },
      create: (ref, d) => { writes.push(() => opCreate(ref.path, d)); },
      delete: (ref) => { writes.push(() => store.delete(ref.path)); },
    };
    const result = await fn(tx);
    await tick();
    const conflict = [...reads].some(([p, v]) => (store.get(p)?.ver || 0) !== v);
    if (conflict) { txConflicts++; continue; }
    for (const w of writes) w();
    return result;
  }
  throw new Error('transaction too much contention');
}
const fakeFirestore = () => ({
  doc: adminDoc, collection: adminCol,
  collectionGroup: (name) => adminQuery((k) => { const s = k.split('/'); return s.length >= 2 && s[s.length - 2] === name; }, [], 0),
  runTransaction,
  batch: () => { const ops = []; return { set: (r, d, o) => ops.push(() => opSet(r.path, d, o)), update: (r, d) => ops.push(() => opUpdate(r.path, d)), delete: (r) => ops.push(() => store.delete(r.path)), commit: async () => { await tick(); for (const o of ops) o(); } }; },
});
fakeFirestore.FieldValue = FieldValue;
fakeFirestore.Timestamp = { fromMillis: mkTs, now: () => mkTs(clock) };
const authUsers = new Map();
const fakeAdmin = {
  firestore: fakeFirestore,
  auth: () => ({ getUser: async (uid) => { await tick(); const u = authUsers.get(uid); if (!u) { const e = new Error('no user'); e.code = 'auth/user-not-found'; throw e; } return { uid, email: u.email || '', providerData: [] }; } }),
};

/* ── 가짜 포트원, 메일 ── */
let portoneItems = []; // 포트원 결제 (목록과 단건이 같은 것을 본다)
let portoneFail = false;
let lastListFrom = '';
global.fetch = async (url) => {
  await tick();
  if (portoneFail) return { ok: false, status: 503, text: async () => 'down', json: async () => ({}) };
  const u = String(url);
  if (u.startsWith('https://api.portone.io/payments?requestBody=')) {
    const body = JSON.parse(decodeURIComponent(u.split('requestBody=')[1]));
    lastListFrom = body.filter.from;
    const from = Date.parse(body.filter.from);
    const items = portoneItems.filter((p) => p.status === 'PAID' && Date.parse(p.statusChangedAt) >= from);
    return { ok: true, status: 200, json: async () => ({ items: items.slice(body.page.number * 100, body.page.number * 100 + 100) }), text: async () => '' };
  }
  const m = u.match(/^https:\/\/api\.portone\.io\/payments\/(.+)$/);
  if (m) {
    const p = portoneItems.find((x) => x.id === decodeURIComponent(m[1]));
    return p ? { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(p)), text: async () => '' } : { ok: false, status: 404, text: async () => 'nf', json: async () => ({}) };
  }
  throw new Error('fetch ' + u);
};
const mails = [];
let mailFail = false;
let referralCalls = 0;

const SERVER_STUBS = {
  'firebase-admin': fakeAdmin,
  'firebase-functions/v2/scheduler': { onSchedule: (_o, fn) => fn },
  'firebase-functions/params': { defineSecret: () => ({ value: () => 'TESTKEY' }) },
  '../pdf/mailPdf': { MAIL_APP_PASSWORD: {}, FROM_ADDR: 'from@test', mailTransport: () => ({ sendMail: async (m) => { await tick(); if (mailFail) throw new Error('smtp down'); mails.push(m); } }) },
  '../admin/owner': { OWNER_EMAILS: ['owner@test'], OWNER_UIDS: [] },
  '../referral/referral': { referralOnPurchase: async () => { referralCalls++; } },
};
const R = loadTs(path.join(ROOT, 'functions/src/payment/autoGrantRules.ts'), SERVER_STUBS);
const G = loadTs(path.join(ROOT, 'functions/src/payment/grantPortone.ts'), SERVER_STUBS);
const W = loadTs(path.join(ROOT, 'functions/src/payment/portonePaidWatch.ts'), SERVER_STUBS);
const { PACKAGE_MAP } = loadTs(path.join(ROOT, 'functions/src/shared/chargePackages.ts'), SERVER_STUBS);

/* ── 결과 ── */
let fails = 0; let passes = 0;
const ok = (name, cond, extra) => { if (cond) passes++; else fails++; console.log(cond ? 'PASS' : 'FAIL', name, !cond && extra !== undefined ? JSON.stringify(extra) : ''); };
const MIN = 60e3;

/* ═════════════ A. 판정 순수 함수 ═════════════ */
function baseInput(over = {}) {
  const uid = 'UserAAAA1234567890';
  return {
    now: clock, paymentId: `${uid.slice(0, 8)}_p7_x_1`,
    fresh: { status: 'PAID', channelType: 'LIVE', currency: 'KRW', amount: 2500, customDataUid: uid },
    listAmount: 2500, listCustomDataUid: uid, paidMs: clock - 25 * MIN,
    packageAmounts: Object.keys(PACKAGE_MAP).map(Number),
    authExists: true, ledger: [], manualHandled: false, ownerGrantAfterPay: false,
    grantedTodayWon: 0, grantedThisRun: 0, cfg: R.AUTO_GRANT_DEFAULT, ...over,
  };
}
function partA() {
  const d0 = R.decideAutoGrant(baseInput());
  ok('A1 조건을 다 맞으면 넣는다', d0.ok === true && d0.uid === 'UserAAAA1234567890', d0);
  const finalWith = (over, word) => { const d = R.decideAutoGrant(baseInput(over)); return !d.ok && d.final && d.reasons.some((r) => r.includes(word)); };
  const waitWith = (over, word) => { const d = R.decideAutoGrant(baseInput(over)); return !d.ok && !d.final && d.reasons.some((r) => r.includes(word)); };
  ok('A2 20분 안은 미룸', waitWith({ paidMs: clock - 15 * MIN }, '20분'));
  ok('A3 48시간 지나면 막힘', finalWith({ paidMs: clock - 49 * 3600e3 }, '48시간'));
  ok('A4 포트원 상태 PAID 아님 막힘', finalWith({ fresh: { ...baseInput().fresh, status: 'CANCELLED' } }, '결제 완료'));
  ok('A5 테스트 채널 막힘', finalWith({ fresh: { ...baseInput().fresh, channelType: 'TEST' } }, '실결제'));
  ok('A6 원화 아님 막힘', finalWith({ fresh: { ...baseInput().fresh, currency: 'USD' } }, '원화'));
  ok('A6b 통화 칸 없음도 막힘', finalWith({ fresh: { ...baseInput().fresh, currency: undefined } }, '원화'));
  ok('A7 묶음에 없는 금액 막힘', finalWith({ fresh: { ...baseInput().fresh, amount: 3000 }, listAmount: 3000 }, '묶음'));
  ok('A8 목록과 단건 금액이 다르면 막힘', finalWith({ listAmount: 5000 }, '금액이 달라'));
  ok('A9 회원 ID 없음 막힘', finalWith({ fresh: { ...baseInput().fresh, customDataUid: '' } }, '회원 ID 가 없어'));
  ok('A10 결제번호 앞 8자 다름 막힘', finalWith({ paymentId: 'Zzzzzzzz_p7_x_1' }, '앞 8자'));
  ok('A11 목록과 단건 회원 ID 다르면 막힘', finalWith({ listCustomDataUid: 'UserAAAA_other' }, '회원 ID 가 달라'));
  ok('A12 Auth 계정 없음 막힘', finalWith({ authExists: false }, '계정이 없어'));
  ok('A13 Auth 조회 실패는 미룸', waitWith({ authExists: null }, '계정 조회'));
  const row = (o) => ({ where: 'UserAAAA1234567890', status: 'pending', failReason: '', granted: false, refunded: false, ...o });
  ok('A14 장부 pending 은 넣는다', R.decideAutoGrant(baseInput({ ledger: [row({})] })).ok);
  ok('A15 장부 needs_reconciliation 은 넣는다', R.decideAutoGrant(baseInput({ ledger: [row({ status: 'needs_reconciliation' })] })).ok);
  ok('A16 장부 failed(통신 오류)는 넣는다', R.decideAutoGrant(baseInput({ ledger: [row({ status: 'failed', failReason: 'network_error: x' })] })).ok);
  for (const fr of ['amount_mismatch_2500_vs_5000', 'currency_USD', 'channel_TEST', 'customdata_uid_mismatch']) {
    ok(`A17 장부 failed(${fr}) 막힘`, finalWith({ ledger: [row({ status: 'failed', failReason: fr })] }, '불일치'));
  }
  ok('A18 지급 기록 있으면 막힘', finalWith({ ledger: [row({ status: 'confirmed', granted: true })] }, '지급 기록'));
  ok('A19 confirmedAt 만 있어도 막힘', finalWith({ ledger: [row({ status: 'failed', granted: true })] }, '지급 기록'));
  ok('A20 환불 기록 막힘', finalWith({ ledger: [row({ status: 'refunded', refunded: true })] }, '환불'));
  ok('A21 다른 계정 장부 기록 막힘', finalWith({ ledger: [row({ where: 'OtherAcct999' })] }, '다른 계정'));
  ok('A22 모르는 장부 상태 막힘', finalWith({ ledger: [row({ status: 'weird' })] }, '알 수 없어'));
  ok('A23 오너 직접 처리 막힘', finalWith({ manualHandled: true }, '직접 처리'));
  ok('A24 결제 뒤 오너 지급 기록 막힘', finalWith({ ownerGrantAfterPay: 'pay_missing 7운' }, '오너가'));
  ok('A25 오너 지급 기록 조회 실패는 미룸', waitWith({ ownerGrantAfterPay: null }, '오너 지급'));
  ok('A26 하루 상한 넘으면 막힘', finalWith({ grantedTodayWon: 48000 }, '상한'));
  ok('A27 하루 상한 딱 맞으면 넣는다', R.decideAutoGrant(baseInput({ grantedTodayWon: 47500 })).ok);
  ok('A28 이번 실행 건수 다 쓰면 미룸', waitWith({ grantedThisRun: 5 }, '건수'));
  ok('A29 꺼져 있으면 미룸', waitWith({ cfg: { ...R.AUTO_GRANT_DEFAULT, enabled: false } }, '꺼져'));

  const n = R.normalizeAutoGrantConfig;
  ok('A30 설정 문서 없으면 기본값', JSON.stringify(n(undefined)) === JSON.stringify({ enabled: true, maxPerRun: 5, dailyCapWon: 50000 }), n(undefined));
  ok('A31 enabled false 면 꺼짐', n({ enabled: false }).enabled === false);
  ok('A32 enabled 가 문자면 꺼짐', n({ enabled: 'yes' }).enabled === false);
  ok('A33 잘못된 숫자는 0', n({ maxPerRun: 'x', dailyCapWon: -5 }).maxPerRun === 0 && n({ dailyCapWon: -5 }).dailyCapWon === 0);
  ok('A34 상한 클램프', n({ maxPerRun: 999, dailyCapWon: 9e9 }).maxPerRun === 20 && n({ dailyCapWon: 9e9 }).dailyCapWon === 1000000);

  const lb = R.watchLookbackFrom;
  const now = clock;
  ok('A35 lastOkAt 없으면 48시간', lb(now, null) === now - 48 * 3600e3);
  ok('A36 최근 lastOkAt 이면 48시간', lb(now, now - 10 * MIN) === now - 48 * 3600e3);
  ok('A37 5일 멈췄으면 lastOkAt 1시간 앞부터', lb(now, now - 5 * 864e5) === now - 5 * 864e5 - 3600e3);
  ok('A38 30일 멈췄으면 14일까지만', lb(now, now - 30 * 864e5) === now - 14 * 864e5);

  const lr = R.ledgerRowOf('u1', { status: 'failed', confirmedAt: mkTs(1) });
  ok('A39 장부 줄: confirmedAt 이 있으면 지급', lr.granted === true && lr.refunded === false);
  ok('A40 장부 줄: 부분 환불 검토는 환불', R.ledgerRowOf('u1', { status: 'partial_refund_review' }).refunded === true);
}

/* ═════════════ B. 서버 ═════════════ */
const UID = 'WebUser01abcdefghij';
const UID2 = 'WebUser02abcdefghij';
function payment(id, uid, amount, paidAgoMin, over = {}) {
  const at = new Date(clock - paidAgoMin * MIN).toISOString();
  return { id, status: 'PAID', paidAt: at, statusChangedAt: at, amount: { total: amount }, currency: 'KRW', channel: { type: 'LIVE' }, customData: JSON.stringify({ uid, pkgId: 'p7' }), orderName: `사주500 충전`, method: { type: 'PaymentMethodEasyPay', provider: 'KAKAOPAY' }, customer: { email: '' }, ...over };
}
const bal = (uid) => raw(`users/${uid}`)?.balance || {};
const payDoc = (uid, pid) => raw(`users/${uid}/payments/${pid}`);
const alertDoc = (pid) => raw(`backofficeAlerts/portone_unconfirmed_${pid}`);
const resetServer = () => { store.clear(); mails.length = 0; portoneItems = []; portoneFail = false; mailFail = false; referralCalls = 0; authUsers.clear(); };

async function partB() {
  // B1 — 기본: 25분 지난 미지급 결제를 한 번만 넣는다
  resetServer();
  authUsers.set(UID, { email: 'guest@test' });
  writeDoc(`users/${UID}`, { balance: { paid: 1, bonus: 0, reward: 0 } });
  const P1 = `${UID.slice(0, 8)}_p7_aaa_1`;
  portoneItems = [payment(P1, UID, 2500, 25)];
  let r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B1 자동으로 한 번 넣음', r.granted === 1 && bal(UID).paid === 6 && bal(UID).bonus === 2, { r, bal: bal(UID) });
  const pd = payDoc(UID, P1);
  ok('B2 결제 문서 confirmed, grantedBy watch, 기기 전달 대기', pd.status === 'confirmed' && pd.grantedBy === 'watch' && pd.deviceCreditPending === true && pd.paidUn === 5 && pd.bonusUn === 2 && pd.amount === 2500 && pd.orderId === P1, pd);
  ok('B3 친구 초대 첫 결제 확인 한 번', referralCalls === 1, referralCalls);
  const ad = alertDoc(P1);
  ok('B4 경보에 autoGrantedAt, 메일 보낸 뒤 mailedAt', !!ad.autoGrantedAt && !!ad.mailedAt && ad.mailPending === false && !ad.mail, ad);
  ok('B5 오너 메일 한 통, 자동으로 넣었어요, 첫 알림은 그 안에', mails.length === 1 && /자동으로 넣었어요/.test(mails[0].text) && !/운이 들어가지 않은 웹 결제예요/.test(mails[0].text) && /guest@test/.test(mails[0].text), mails.map((m) => m.subject));
  ok('B6 하루 합계 2,500원', raw(`portoneAutoGrantDaily/${R.kstDay(clock)}`)?.won === 2500);
  ok('B7 끝까지 본 시각 lastOkAt', raw('config/portoneWatchState')?.lastOkAt === clock);
  r = await W.runPortonePaidWatch('TESTKEY', clock + 10 * MIN);
  ok('B8 다음 실행은 다시 넣지 않고 메일도 없음', r.granted === 0 && bal(UID).paid === 6 && mails.length === 1, { r, mails: mails.length });

  // B9 — 기기가 받아 가기: 한 기기에 한 번
  const [c1, c2] = await Promise.all([G.claimPortoneDeviceCredit(UID, P1), G.claimPortoneDeviceCredit(UID, P1)]);
  ok('B9 동시에 두 기기가 받아 가도 한 번만', [c1, c2].filter((c) => c.claimed).length === 1 && (c1.claimed ? c1 : c2).paidUn === 5 && (c1.claimed ? c1 : c2).bonusUn === 2, { c1, c2 });
  ok('B10 받아 간 뒤 deviceCreditPending false, 서버 잔액 그대로', payDoc(UID, P1).deviceCreditPending === false && bal(UID).paid === 6);

  // B11 — 손님 화면 확인과 감시가 같은 순간: 한 번만
  resetServer();
  authUsers.set(UID, {});
  const P2 = `${UID.slice(0, 8)}_p15_bbb_1`;
  const pay2 = payment(P2, UID, 5000, 30);
  portoneItems = [pay2];
  const pkg = PACKAGE_MAP[5000];
  const before = txConflicts;
  const [g1, g2] = await Promise.all([
    G.grantPortonePayment({ uid: UID, paymentId: P2, pay: pay2, pkg, amount: 5000, grantedBy: 'client' }),
    G.grantPortonePayment({ uid: UID, paymentId: P2, pay: pay2, pkg, amount: 5000, grantedBy: 'watch' }),
  ]);
  ok('B11 동시 지급은 한쪽만', [g1, g2].filter((g) => g.granted).length === 1 && bal(UID).paid === 10 && bal(UID).bonus === 5 && raw(`users/${UID}`).totalCharged === 10, { g1, g2, bal: bal(UID), conflicts: txConflicts - before });
  ok('B12 시험 저장소가 실제로 충돌을 만들었다(재시도)', txConflicts > before, txConflicts - before);
  const winner = g1.granted ? 'client' : 'watch';
  ok('B13 이긴 쪽만 grantedBy, watch 일 때만 기기 전달 대기', payDoc(UID, P2).grantedBy === winner && (payDoc(UID, P2).deviceCreditPending === true) === (winner === 'watch'), payDoc(UID, P2));
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B14 이미 지급된 결제는 감시가 경보도 지급도 안 함', r.freshAlerts === 0 && r.granted === 0 && bal(UID).paid === 10 && !alertDoc(P2));

  // B15 — 15분: 첫 알림만, 지급 없음. 25분 뒤 실행에 지급
  resetServer();
  authUsers.set(UID, {});
  const P3 = `${UID.slice(0, 8)}_p4_ccc_1`;
  portoneItems = [payment(P3, UID, 1500, 15)];
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B15 결제 뒤 15분: 첫 알림 메일, 지급 없음', r.freshAlerts === 1 && r.granted === 0 && !payDoc(UID, P3) && mails.length === 1 && /운이 들어가지 않은 웹 결제예요/.test(mails[0].text) && /20분/.test(mails[0].text), { r, m: mails.map((m) => m.subject) });
  r = await W.runPortonePaidWatch('TESTKEY', clock + 10 * MIN);
  ok('B16 10분 뒤(결제 뒤 25분) 지급', r.granted === 1 && bal(UID).paid === 3 && bal(UID).bonus === 1 && mails.length === 2 && /자동으로 넣었어요/.test(mails[1].text), { r, bal: bal(UID) });

  // B17 — 확인이 금액 불일치로 실패한 결제: 막힘, 이유 메일 한 번
  resetServer();
  authUsers.set(UID, {});
  const P4 = `${UID.slice(0, 8)}_p7_ddd_1`;
  portoneItems = [payment(P4, UID, 2500, 40)];
  writeDoc(`users/${UID}/payments/${P4}`, { orderId: P4, status: 'failed', failReason: 'amount_mismatch_2500_vs_5000', amount: 5000 });
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B17 불일치 실패는 넣지 않고 이유를 알림', r.granted === 0 && r.blocked === 1 && !bal(UID).paid && !!alertDoc(P4).autoGrantBlockedAt && mails.length === 1 && /자동으로 넣지 못했어요/.test(mails[0].text) && /불일치/.test(mails[0].text), { r, a: alertDoc(P4) });
  r = await W.runPortonePaidWatch('TESTKEY', clock + 10 * MIN);
  ok('B18 막힌 결제는 다시 보지도 알리지도 않음', r.blocked === 0 && r.granted === 0 && mails.length === 1);

  // B19 — 오너가 직접 처리로 표시: 조용히 넘어감
  resetServer();
  authUsers.set(UID, {});
  const P5 = `${UID.slice(0, 8)}_p7_eee_1`;
  portoneItems = [payment(P5, UID, 2500, 15)];
  await W.runPortonePaidWatch('TESTKEY', clock);
  opSet(`backofficeAlerts/portone_unconfirmed_${P5}`, { manualHandled: true }, { merge: true });
  r = await W.runPortonePaidWatch('TESTKEY', clock + 10 * MIN);
  ok('B19 manualHandled 면 넣지 않고 막힘 메일도 없음', r.granted === 0 && r.blocked === 0 && !payDoc(UID, P5) && mails.length === 1);

  // B20 — 결제 뒤 오너가 '고객 찾기와 운 넣기'로 넣었으면 막힘
  resetServer();
  authUsers.set(UID, {});
  const P6 = `${UID.slice(0, 8)}_p7_fff_1`;
  portoneItems = [payment(P6, UID, 2500, 30)];
  writeDoc('compensationLog/x1', { target: UID, uids: [UID], amount: 7, reason: 'pay_missing', at: mkTs(clock - 5 * MIN) });
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B20 결제 뒤 오너 지급 기록이 있으면 막힘', r.granted === 0 && r.blocked === 1 && /오너가 이 회원에게/.test(mails[0].text), mails.map((m) => m.text.slice(0, 80)));

  // B21 — 그사이 포트원에서 취소됨(목록은 PAID, 단건은 CANCELLED): 막힘
  resetServer();
  authUsers.set(UID, {});
  const P7 = `${UID.slice(0, 8)}_p7_ggg_1`;
  portoneItems = [payment(P7, UID, 2500, 30)];
  const realFetch = global.fetch;
  global.fetch = async (url) => { const res = await realFetch(url); if (/payments\/[^?]+$/.test(String(url))) { const j = await res.json(); j.status = 'CANCELLED'; return { ok: true, status: 200, json: async () => j, text: async () => '' }; } return res; };
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  global.fetch = realFetch;
  ok('B21 단건 조회가 취소면 넣지 않음', r.granted === 0 && r.blocked === 1 && !payDoc(UID, P7));

  // B22 — 계정 없음(탈퇴): 막힘
  resetServer();
  const P8 = `${UID.slice(0, 8)}_p7_hhh_1`;
  portoneItems = [payment(P8, UID, 2500, 30)];
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B22 Auth 계정이 없으면 막힘', r.granted === 0 && r.blocked === 1 && /계정이 없어요/.test(mails[0].text));

  // B23 — 하루 상한과 한 번 실행 상한
  resetServer();
  authUsers.set(UID, {}); authUsers.set(UID2, {});
  writeDoc('config/portoneAutoGrant', { dailyCapWon: 3000 });
  const P9 = `${UID.slice(0, 8)}_p7_iii_1`;
  const P10 = `${UID2.slice(0, 8)}_p7_jjj_1`;
  portoneItems = [payment(P9, UID, 2500, 30), payment(P10, UID2, 2500, 31)];
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B23 하루 상한 3,000원: 하나는 넣고 하나는 상한으로 막힘', r.granted === 1 && r.blocked === 1 && /상한/.test(mails[0].text), { r });
  resetServer();
  authUsers.set(UID, {}); authUsers.set(UID2, {});
  writeDoc('config/portoneAutoGrant', { maxPerRun: 1 });
  portoneItems = [payment(P9, UID, 2500, 30), payment(P10, UID2, 2500, 31)];
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  const r2 = await W.runPortonePaidWatch('TESTKEY', clock + 10 * MIN);
  ok('B24 한 번에 1건: 이번에 하나, 다음 실행에 하나', r.granted === 1 && r.blocked === 0 && r2.granted === 1 && bal(UID).paid === 5 && bal(UID2).paid === 5, { r, r2 });
  resetServer();
  authUsers.set(UID, {});
  writeDoc('config/portoneAutoGrant', { enabled: false });
  portoneItems = [payment(P9, UID, 2500, 30)];
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B25 꺼져 있으면 알림만(예전과 같은 할 일 안내)', r.granted === 0 && r.freshAlerts === 1 && /자동 채우기가 꺼져/.test(mails[0].text));

  // B26 — 메일 실패: mailedAt 없이 남고, 3시간 안엔 다시 보내지 않고, 3시간 뒤 다시 보낸다
  resetServer();
  authUsers.set(UID, {});
  const P11 = `${UID.slice(0, 8)}_p7_kkk_1`;
  portoneItems = [payment(P11, UID, 2500, 15)];
  mailFail = true;
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B26 메일 실패: 경보는 남고 mailPending 그대로, 실패 시각 기록', r.mail === 'failed' && alertDoc(P11).mailPending === true && !alertDoc(P11).mailedAt && raw('config/portoneWatchState').mailFailAt === clock, { r, a: alertDoc(P11) });
  mailFail = false;
  r = await W.runPortonePaidWatch('TESTKEY', clock + 10 * MIN); // 결제 뒤 25분 → 지급, 메일은 쉼
  ok('B27 실패 뒤 3시간 안: 지급은 하고 메일은 기다림', r.granted === 1 && r.mail === 'waiting' && mails.length === 0 && alertDoc(P11).mailPending === true, { r });
  r = await W.runPortonePaidWatch('TESTKEY', clock + 190 * MIN);
  ok('B28 3시간 뒤 다시 보냄(자동 지급 알림 포함), mailedAt', r.mail === 'sent' && mails.length === 1 && /자동으로 넣었어요/.test(mails[0].text) && !!alertDoc(P11).mailedAt && alertDoc(P11).mailPending === false && raw('config/portoneWatchState').mailFailAt === null, { r, n: mails.length });

  // B29 — 포트원 목록 조회 실패: 시간당 경보 한 번, 1시간 넘게 이어지면 메일 한 통, 다시 돌면 회복 알림
  resetServer();
  portoneFail = true;
  const t0 = clock;
  await W.runPortonePaidWatch('TESTKEY', t0);
  await W.runPortonePaidWatch('TESTKEY', t0 + 10 * MIN);
  const failDocs = [...store.keys()].filter((k) => k.startsWith('backofficeAlerts/portone_watch_fail_'));
  ok('B29 조회 실패 경보는 시간 단위 문서', failDocs.length >= 1 && failDocs.length <= 2 && raw(failDocs[0]).kind === 'portone_watch_fail' && mails.length === 0, failDocs);
  await W.runPortonePaidWatch('TESTKEY', t0 + 61 * MIN);
  await W.runPortonePaidWatch('TESTKEY', t0 + 71 * MIN);
  ok('B30 1시간 넘게 실패하면 오너 메일 한 통만', mails.length === 1 && /1시간 넘게/.test(mails[0].subject), mails.map((m) => m.subject));
  portoneFail = false;
  await W.runPortonePaidWatch('TESTKEY', t0 + 81 * MIN);
  ok('B31 다시 돌면 회복 알림, 실패 기록 지움', mails.length === 2 && /다시 돌아요/.test(mails[1].text) && raw('config/portoneWatchState').failSince === null, mails.map((m) => m.subject));

  // B32 — 감시가 5일 멈췄다 돌아오면 그 사이 결제까지 본다(48시간 넘은 결제는 알리기만)
  resetServer();
  authUsers.set(UID, {});
  writeDoc('config/portoneWatchState', { lastOkAt: clock - 5 * 864e5 });
  const P12 = `${UID.slice(0, 8)}_p7_lll_1`;
  portoneItems = [payment(P12, UID, 2500, 4 * 24 * 60)];
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B32 lastOkAt 1시간 앞부터 조회', Date.parse(lastListFrom) === clock - 5 * 864e5 - 3600e3, lastListFrom);
  ok('B33 4일 전 결제를 찾아 알리되 자동으로 넣지는 않음', r.freshAlerts === 1 && r.granted === 0 && r.blocked === 1 && /48시간/.test(mails[0].text) && !payDoc(UID, P12), { r });

  // B34 — 지급 직전 손님 화면이 먼저 넣은 경우: 해결 처리
  resetServer();
  authUsers.set(UID, {});
  const P13 = `${UID.slice(0, 8)}_p7_mmm_1`;
  const pay13 = payment(P13, UID, 2500, 15);
  portoneItems = [pay13];
  await W.runPortonePaidWatch('TESTKEY', clock); // 첫 알림
  await G.grantPortonePayment({ uid: UID, paymentId: P13, pay: pay13, pkg: PACKAGE_MAP[2500], amount: 2500, grantedBy: 'client' });
  r = await W.runPortonePaidWatch('TESTKEY', clock + 10 * MIN);
  ok('B34 앞서 알린 결제가 손님 화면에서 들어갔으면 해결 메일, 다시 넣지 않음', r.granted === 0 && r.resolved === 1 && bal(UID).paid === 5 && /이제 운이 들어갔어요/.test(mails[1].text), { r, bal: bal(UID) });

  // B35 — 다른 계정에 이관 사본이 있으면 막힘
  resetServer();
  authUsers.set(UID, {});
  const P14 = `${UID.slice(0, 8)}_p7_nnn_1`;
  portoneItems = [payment(P14, UID, 2500, 30)];
  writeDoc(`users/MovedAcct123/payments/${P14}`, { orderId: P14, status: 'pending' });
  r = await W.runPortonePaidWatch('TESTKEY', clock);
  ok('B35 다른 계정 장부 사본이 있으면 막힘', r.granted === 0 && r.blocked === 1 && /다른 계정/.test(mails[0].text));
}

/* ═════════════ C. 기기 ═════════════ */
// 가짜 브라우저
const ls = new Map();
global.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
const toasts = [];
global.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
global.Event = class { constructor(type) { this.type = type; } };
global.window = { dispatchEvent: (e) => { if (e.type === 'saju500:toast') toasts.push(e.detail.text); }, location: { search: '' } };
try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0 test' }, configurable: true }); } catch { /* noop */ }

const BAL_KEY = 'saju500_balance_v2';
const local = () => JSON.parse(ls.get(BAL_KEY) || '{"paid":0,"bonus":0,"reward":0}');
const localTotal = () => { const d = local(); return d.paid + d.bonus + d.reward; };
const fakeLocalStore = {
  addPaidBalance: (p, b) => { const d = local(); d.paid += p; d.bonus += b; ls.set(BAL_KEY, JSON.stringify(d)); },
  reclaimBalance: (p, b) => { const d = local(); const tp = Math.min(d.paid, p); const tb = Math.min(d.bonus, b); d.paid -= tp; d.bonus -= tb; ls.set(BAL_KEY, JSON.stringify(d)); return tp + tb; },
  getReports: () => [], saveReport: () => {}, generateId: () => 'id', mergeProfiles: () => {}, profilesFromReports: () => [],
  getDeletedReportIds: () => new Set(), getDeletedProfileKeys: () => new Set(),
};
let clientUid = UID;
const clientAuth = { get currentUser() { return clientUid ? { uid: clientUid, isAnonymous: false } : null; } };
// 웹 SDK 모양의 가짜 (같은 저장소)
const webSnap = (p) => { const e = store.get(p); return { id: p.split('/').pop(), exists: () => !!e, data: () => (e ? clone(e.data) : undefined) }; };
const join = (base, segs) => [base, ...segs].filter(Boolean).join('/');
const webFirestore = {
  doc: (_db, p, ...s) => ({ path: join(p, s) }),
  collection: (_db, p, ...s) => ({ path: join(p, s), col: true }),
  query: (c, ...cons) => ({ path: c.path, cons }),
  where: (f, op, v) => [f, op, v],
  getDoc: async (r) => { await tick(); return webSnap(r.path); },
  getDocs: async (q) => { await tick(); const docs = [...store.keys()].filter(inCol(q.path)).filter((k) => matches(raw(k), q.cons || [])).map(webSnap); return { empty: !docs.length, size: docs.length, docs }; },
  setDoc: async (r, d, o) => { await tick(); opSet(r.path, d, o); },
  updateDoc: async (r, d) => { await tick(); opUpdate(r.path, d); },
  deleteDoc: async (r) => { store.delete(r.path); },
  serverTimestamp: FieldValue.serverTimestamp, arrayUnion: FieldValue.arrayUnion,
  writeBatch: () => { const ops = []; return { set: (r, d, o) => ops.push(() => opSet(r.path, d, o)), update: (r, d) => ops.push(() => opUpdate(r.path, d)), delete: (r) => ops.push(() => store.delete(r.path)), commit: async () => { await tick(); for (const o of ops) o(); } }; },
};
// 서버 confirmPortonePayment 를 index.ts 와 같은 순서로 흉내 (포트원 검증은 통과했다고 본다)
let confirmCalls = 0;
let holdConfirm = null; // 서버가 넘겨준 뒤 응답이 오기 전 (C18)
let confirmCommitted = false;
async function fakeConfirm(data) {
  confirmCalls++;
  const uid = clientUid; const { paymentId, amount } = data;
  if (!paymentId.startsWith(uid.slice(0, 8))) throw new Error('본인 결제만 확인할 수 있어요');
  const ex = payDoc(uid, paymentId);
  if (ex && ex.status === 'confirmed') {
    if (ex.deviceCreditPending === true) {
      const c = await G.claimPortoneDeviceCredit(uid, paymentId);
      confirmCommitted = true;
      if (holdConfirm) await holdConfirm;
      if (c.claimed) return { success: true, message: 'ok', totalUn: c.totalUn, paidUn: c.paidUn, bonusUn: c.bonusUn, autoGranted: true };
    }
    return { success: true, message: '이미 처리된 결제예요' };
  }
  const pay = portoneItems.find((p) => p.id === paymentId);
  if (!pay) throw new Error('결제 확인에 실패했어요');
  const pkg = PACKAGE_MAP[amount];
  const g = await G.grantPortonePayment({ uid, paymentId, pay, pkg, amount, grantedBy: 'client' });
  if (!g.granted) { const c = await G.claimPortoneDeviceCredit(uid, paymentId); if (c.claimed) return { success: true, message: 'ok', totalUn: c.totalUn, paidUn: c.paidUn, bonusUn: c.bonusUn, autoGranted: true }; return { success: true, message: '이미 처리된 결제예요' }; }
  return { success: true, message: 'ok', totalUn: g.totalUn, paidUn: pkg.paidUn, bonusUn: pkg.bonusUn };
}
const CLIENT_STUBS = {
  'firebase/firestore': webFirestore,
  'firebase/functions': { getFunctions: () => ({}), httpsCallable: () => async (data) => ({ data: await fakeConfirm(data) }) },
  '@/services/auth/firebase': { db: {}, auth: clientAuth, app: {} },
  './localStore': fakeLocalStore,
  './chatStore': { mergeRestoredChatRooms: () => {}, getDeletedChatIds: () => new Set() },
  '@/lib/env': { isAppintosBuild: false },
  '@/services/payment/payerHistory': { markPaidOnce: () => {} },
  '@/services/payment/refundRequest': { rememberWebPayment: () => {} },
  '@/services/analytics': { trackEvent: () => {} },
};
function loadClient() {
  for (const k of [...cache.keys()]) if (k.includes(`${path.sep}src${path.sep}services${path.sep}`)) cache.delete(k); // 모듈 상태(한 번 가드) 새로
  return {
    A: loadTs(path.join(ROOT, 'src/services/storage/balanceAdjust.ts'), CLIENT_STUBS),
    S: loadTs(path.join(ROOT, 'src/services/storage/firestoreSync.ts'), CLIENT_STUBS),
  };
}
const resetClient = () => { resetServer(); ls.clear(); toasts.length = 0; confirmCalls = 0; clientUid = UID; window.location.search = ''; };

/** 감시가 넣은 결제 하나를 서버에 만든다 (결제 2,500원 → 5+2운) */
async function serverAutoGranted(pid, startPaid = 0) {
  writeDoc(`users/${UID}`, { balance: { paid: startPaid, bonus: 0, reward: 0 } });
  const pay = payment(pid, UID, 2500, 30);
  portoneItems.push(pay);
  await G.grantPortonePayment({ uid: UID, paymentId: pid, pay, pkg: PACKAGE_MAP[2500], amount: 2500, grantedBy: 'watch' });
}

async function partC() {
  // C1 — 결제 확인 응답의 paidUn 은 결제번호마다 한 번만 기기에 더한다
  resetClient();
  let { A } = loadClient();
  const Q1 = `${UID.slice(0, 8)}_p7_c1_1`;
  portoneItems = [payment(Q1, UID, 2500, 1)];
  A.rememberPortonePending(Q1, 2500);
  const a1 = await A.confirmPortoneAndCredit(Q1, 2500);
  const a2 = await A.confirmPortoneAndCredit(Q1, 2500);
  ok('C1 손님 화면 확인: 한 번 더하고, 다시 확인하면 이미 처리됨', a1.credited && !a2.credited && a2.paidUn == null && localTotal() === 7 && !A.isPortoneCreditedHere('nope') && A.isPortoneCreditedHere(Q1), { a1, a2, l: local() });
  ok('C2 적어 둔 결제번호는 확인 뒤 지움', !(JSON.parse(ls.get('saju500:portone_pending') || '[]')).length);

  // C3 — 확인이 끊겼던 결제: 다음에 열 때 다시 확인해 넣는다 (아직 서버 지급 전)
  resetClient();
  ({ A } = loadClient());
  const Q2 = `${UID.slice(0, 8)}_p4_c3_1`;
  portoneItems = [payment(Q2, UID, 1500, 5)];
  A.rememberPortonePending(Q2, 1500);
  A.rememberPortonePending('Other123_p4_x', 1500); // 다른 계정 결제번호는 부르지 않는다
  const n3 = await A.resumePortonePayments();
  ok('C3 이어 받기: 확인이 끊긴 결제를 넣음', n3 === 4 && localTotal() === 4 && toasts.some((t) => /4운을 넣었어요/.test(t)) && confirmCalls === 1, { n3, l: local(), toasts, confirmCalls });
  ok('C4 다른 계정 결제번호는 부르지 않고 남겨 둠', (JSON.parse(ls.get('saju500:portone_pending'))).some((x) => x.id === 'Other123_p4_x'));

  // C5 — 감시가 넣은 결제: 이 기기에 적어 둔 결제번호가 있어도, 없어도 한 번
  resetClient();
  ({ A } = loadClient());
  const Q3 = `${UID.slice(0, 8)}_p7_c5_1`;
  await serverAutoGranted(Q3);
  A.rememberPortonePending(Q3, 2500);
  const n5 = await A.resumePortonePayments();
  ok('C5 감시가 넣은 결제를 받아 옴(한 번), 서버 잔액은 그대로', n5 === 7 && localTotal() === 7 && payDoc(UID, Q3).deviceCreditPending === false && bal(UID).paid === 5, { n5, l: local() });
  ({ A } = loadClient()); // 새로 열기
  const n5b = await A.resumePortonePayments();
  ok('C6 다시 열어도 더 넣지 않음', n5b === 0 && localTotal() === 7);
  // 다른 기기(이 기기 기록 없음)
  ls.clear();
  ({ A } = loadClient());
  const n5c = await A.resumePortonePayments();
  ok('C7 다른 기기는 이미 받아 간 결제를 또 받지 않음', n5c === 0 && localTotal() === 0);

  // C8 — 다른 기기에서 처음 여는 경우: 서버 목록으로 받아 옴
  resetClient();
  ({ A } = loadClient());
  const Q4 = `${UID.slice(0, 8)}_p7_c8_1`;
  await serverAutoGranted(Q4);
  const n8 = await A.resumePortonePayments();
  ok('C8 이 기기에 결제 기록이 없어도 서버가 넣은 결제를 받아 옴', n8 === 7 && localTotal() === 7);

  // C9 — 충전 화면이 확인 중인 결제(주소의 portone_pid)는 건드리지 않음
  resetClient();
  ({ A } = loadClient());
  const Q5 = `${UID.slice(0, 8)}_p7_c9_1`;
  portoneItems = [payment(Q5, UID, 2500, 1)];
  A.rememberPortonePending(Q5, 2500);
  window.location.search = `?portone_pid=${Q5}&portone_amount=2500`;
  const n9 = await A.resumePortonePayments();
  ok('C9 주소의 결제번호는 충전 화면에 맡김', n9 === 0 && confirmCalls === 0);

  // C10 — 로그인 때 잔액 맞추기와 이어 받기가 같이 돌아도 두 번 더하지 않음 (새 기기, 서버 7운은 전부 감시가 넣은 몫)
  for (const order of ['sync-first', 'resume-first', 'together', 'login-noted']) {
    resetClient();
    const { A: A2, S } = loadClient();
    const Q6 = `${UID.slice(0, 8)}_p7_c10_${order}`;
    await serverAutoGranted(Q6);
    if (order === 'sync-first') { await S.syncFromCloud(UID); await A2.resumePortonePayments(); }
    else if (order === 'resume-first') { await A2.resumePortonePayments(); await S.syncFromCloud(UID); }
    else if (order === 'together') { await Promise.all([S.syncFromCloud(UID), A2.resumePortonePayments()]); }
    else { const p = S.syncFromCloud(UID); A2.noteLoginBalanceSync(p); await Promise.all([p, A2.resumePortonePayments()]); }
    ok(`C10 잔액 맞추기와 이어 받기(${order}): 서버 7운이 기기에도 7운`, localTotal() === 7, local());
  }

  // C11 — 다른 기기 충전분(손님 화면 확인)은 예전처럼 잔액 맞추기가 더한다
  resetClient();
  ({ A } = loadClient());
  let S2 = loadClient().S;
  ({ A } = { A: loadTs(path.join(ROOT, 'src/services/storage/balanceAdjust.ts'), CLIENT_STUBS) });
  writeDoc(`users/${UID}`, { balance: { paid: 10, bonus: 5, reward: 0 } });
  writeDoc(`users/${UID}/payments/${UID.slice(0, 8)}_p15_other`, { status: 'confirmed', pgProvider: 'portone', grantedBy: 'client', amount: 5000, paidUn: 10, bonusUn: 5 });
  await S2.syncFromCloud(UID);
  ok('C11 손님 화면 확인분은 그대로 잔액 맞추기로 (15운)', localTotal() === 15, local());

  // C12 — 감시 몫 + 다른 기기 충전분이 섞여도 합이 서버와 같다
  resetClient();
  const L3 = loadClient();
  const Q7 = `${UID.slice(0, 8)}_p7_c12_1`;
  await serverAutoGranted(Q7, 10); // 서버 10(다른 기기 충전) + 7(감시)
  await Promise.all([L3.S.syncFromCloud(UID), L3.A.resumePortonePayments()]);
  ok('C12 서버 17운 = 기기 17운', localTotal() === 17, local());

  // C13 — 목록을 못 읽으면 잔액 차이를 더하지 않는다 (두 번 더하지 않게)
  resetClient();
  const L4 = loadClient();
  await serverAutoGranted(`${UID.slice(0, 8)}_p7_c13_1`);
  const realGetDocs = webFirestore.getDocs;
  webFirestore.getDocs = async (q) => { if (/\/payments$/.test(q.path)) throw new Error('permission'); return realGetDocs(q); };
  await L4.S.syncFromCloud(UID);
  webFirestore.getDocs = realGetDocs;
  ok('C13 자동 채우기 목록 읽기 실패: 잔액 차이를 더하지 않음', localTotal() === 0, local());

  // C14 — 감시가 넣었는데 기기에 들어가기 전에 환불: 기기에서 뺄 몫이 없다
  resetClient();
  const L5 = loadClient();
  const Q8 = `${UID.slice(0, 8)}_p7_c14_1`;
  await serverAutoGranted(Q8);
  ls.set(BAL_KEY, JSON.stringify({ paid: 3, bonus: 0, reward: 0 })); // 다른 운 3
  opSet(`users/${UID}/payments/${Q8}`, { status: 'refunded' }, { merge: true });
  writeDoc(`users/${UID}/balanceAdjustments/${Q8}`, { paid: -5, bonus: -2, reason: 'portone_refund', paymentId: Q8, applied: false });
  const took = await L5.A.applyBalanceAdjustments(UID);
  ok('C14 안 들어간 결제의 환불은 기기 운을 빼지 않음(다른 운 3 그대로)', took === 0 && localTotal() === 3 && raw(`users/${UID}/balanceAdjustments/${Q8}`).applied === true, { took, l: local() });
  const n14 = await L5.A.resumePortonePayments();
  ok('C15 환불된 결제는 받아 오지도 않음', n14 === 0 && localTotal() === 3);

  // C16 — 받아 간 뒤 환불은 예전처럼 기기에서 뺀다
  resetClient();
  const L6 = loadClient();
  const Q9 = `${UID.slice(0, 8)}_p7_c16_1`;
  await serverAutoGranted(Q9);
  await L6.A.resumePortonePayments();
  opSet(`users/${UID}/payments/${Q9}`, { status: 'refunded' }, { merge: true });
  writeDoc(`users/${UID}/balanceAdjustments/${Q9}`, { paid: -5, bonus: -2, reason: 'portone_refund', paymentId: Q9, applied: false });
  const took16 = await L6.A.applyBalanceAdjustments(UID);
  ok('C16 받아 간 결제의 환불은 7운을 뺌', took16 === 7 && localTotal() === 0, { took16, l: local() });

  // C17 — 앱인토스 화면에서는 아무것도 하지 않는다
  resetClient();
  Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0 TossApp/5.0' }, configurable: true });
  const L7 = loadClient();
  await serverAutoGranted(`${UID.slice(0, 8)}_p7_c17_1`);
  const n17 = await L7.A.resumePortonePayments();
  Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0 test' }, configurable: true });
  ok('C17 토스 앱 화면: 이어 받기 안 함', n17 === 0 && confirmCalls === 0 && localTotal() === 0);

  // C18 — 서버가 기기에 넘긴 직후, 응답이 오기 전에 로그인 잔액 맞추기가 돌아도 두 번 더하지 않음 (withBalanceLock)
  resetClient();
  const L8 = loadClient();
  await serverAutoGranted(`${UID.slice(0, 8)}_p7_c18_1`);
  let release; holdConfirm = new Promise((r) => { release = r; }); confirmCommitted = false;
  const pResume = L8.A.resumePortonePayments();
  while (!confirmCommitted) await tick();
  const pSync = L8.S.syncFromCloud(UID);
  for (let i = 0; i < 50; i++) await tick(); // 차례가 없으면 이 사이 잔액 맞추기가 끝난다
  release(); holdConfirm = null;
  await Promise.all([pResume, pSync]);
  ok('C18 넘겨받는 중 잔액 맞추기: 서버 7운이 기기에도 7운', localTotal() === 7, local());
}

(async () => {
  partA();
  await partB();
  await partC();
  console.log(`\n${passes} PASS, ${fails} FAIL`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('시험 실패', e && e.stack ? e.stack : e); process.exit(1); });
