/* 친구 초대 서버 로직 시험 — 가짜 Firestore/Auth 로 functions/lib/referral/referral.js 를 그대로 돌린다 (실제 서비스 데이터 0)
 *   사용: (cd functions && npx tsc -p .) 뒤 node scripts/test/referral_logic.cjs  — 초대 규칙(referral.ts)을 바꾸면 꼭 돌린다 */
const path = require('path');
const Module = require('module');
const FN = 'D:/550saju/functions';
const store = new Map();
let autoN = 0;
const INC = Symbol('inc'); const TS = Symbol('ts'); const UNION = Symbol('union');
const FieldValue = { increment: (n) => ({ [INC]: n }), serverTimestamp: () => ({ [TS]: true }), arrayUnion: (...v) => ({ [UNION]: v }), delete: () => undefined };
const mkTs = (ms) => ({ __isTs: true, toMillis: () => ms });
const special = (v) => v && typeof v === 'object' && (INC in v || TS in v || UNION in v);
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !special(v) && !v.__isTs;
function applyVal(prev, v) {
  if (v && typeof v === 'object' && INC in v) return (Number(prev) || 0) + v[INC];
  if (v && typeof v === 'object' && TS in v) return mkTs(Date.now());
  if (v && typeof v === 'object' && UNION in v) return [...new Set([...(Array.isArray(prev) ? prev : []), ...v[UNION]])];
  return v;
}
function merge(prev, data) {
  const out = { ...(prev || {}) };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (isPlain(v)) out[k] = merge(isPlain(out[k]) ? out[k] : {}, v);
    else out[k] = applyVal(out[k], v);
  }
  return out;
}
function setDotted(obj, dotted, v) {
  const parts = dotted.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = isPlain(o[parts[i]]) ? { ...o[parts[i]] } : {}; o = o[parts[i]]; }
  o[parts[parts.length - 1]] = applyVal(o[parts[parts.length - 1]], v);
}
function snap(p) {
  return { exists: store.has(p), id: p.split('/').pop(), ref: docRef(p), data: () => store.get(p) };
}
function docRef(p) {
  return {
    path: p, id: p.split('/').pop(),
    get: async () => snap(p),
    set: async (data, opt) => { store.set(p, opt && opt.merge ? merge(store.get(p), data) : merge({}, data)); },
    update: async (data) => { if (!store.has(p)) throw new Error('no doc ' + p); const d = { ...store.get(p) }; for (const [k, v] of Object.entries(data)) setDotted(d, k, v); store.set(p, d); },
    create: async (data) => { if (store.has(p)) throw new Error('exists ' + p); store.set(p, merge({}, data)); },
    delete: async () => { store.delete(p); },
    collection: (c) => colRef(`${p}/${c}`),
  };
}
function colRef(c) {
  const q = (filters, lim) => ({
    where: (f, op, v) => q([...filters, [f, op, v]], lim),
    limit: (n) => q(filters, n),
    get: async () => {
      const keys = [...store.keys()].filter((k) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/'));
      const val = (x) => (x && x.toMillis ? x.toMillis() : x);
      const docs = keys.filter((k) => filters.every(([f, op, v]) => {
        const x = store.get(k)[f];
        if (op === '==') return x === v;
        if (op === '<') return val(x) < val(v);
        return true;
      })).slice(0, lim || 1e9).map(snap);
      return { empty: !docs.length, size: docs.length, docs };
    },
  });
  return { doc: (id) => docRef(`${c}/${id || 'auto' + (++autoN)}`), add: async (d) => { const r = docRef(`${c}/auto${++autoN}`); await r.set(d); return r; }, ...q([], 0) };
}
const firestore = () => ({
  doc: docRef, collection: colRef,
  runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o), update: (r, d) => r.update(d), create: (r, d) => r.create(d), delete: (r) => r.delete() }),
  batch: () => { const ops = []; return { delete: (r) => ops.push(() => r.delete()), update: (r, d) => ops.push(() => r.update(d)), commit: async () => { for (const o of ops) await o(); } }; },
});
firestore.FieldValue = FieldValue;
firestore.Timestamp = { fromMillis: mkTs, now: () => mkTs(Date.now()) };
const users = new Map();
const fakeAdmin = {
  firestore,
  auth: () => ({
    getUser: async (uid) => { const u = users.get(uid); if (!u) throw new Error('no user'); return { metadata: { creationTime: new Date(u.created).toUTCString() }, providerData: u.providers || [] }; },
    verifyIdToken: async () => { throw new Error('bad token'); },
  }),
};
const origLoad = Module._load;
Module._load = function (req) { if (req === 'firebase-admin') return fakeAdmin; return origLoad.apply(this, arguments); };
const R = require(path.join(FN, 'lib/referral/referral.js'));

const call = (fn, uid, data = {}, provider = 'anonymous') => fn.run({ auth: { uid, token: { firebase: { sign_in_provider: provider } } }, data, rawRequest: { headers: { 'x-forwarded-for': '1.2.3.4' }, ip: '1.2.3.4' } });
let fails = 0;
const ok = (name, cond, extra) => { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); };
const keys = (prefix, kind) => [...store.keys()].filter((k) => k.startsWith(prefix) && (!kind || store.get(k).kind === kind));
const profile = (uid, y) => store.set(`users/${uid}/state/profiles`, { items: [{ name: 'x', input: { birthYear: y } }] });

(async () => {
  const now = Date.now();
  users.set('R1', { created: now - 90 * 864e5 });
  users.set('I1', { created: now - 60e3 });
  users.set('OLD', { created: now - 30 * 864e5 });
  const my = await call(R.getMyReferral, 'R1', { name: '나' });
  ok('코드 발급', /^[A-Z2-9]{6}$/.test(my.code), my.code);
  const v = await call(R.recordReferralVisit, 'I1', { code: my.code });
  ok('새 친구 방문 isNew', v.ok && v.isNew === true, v);
  const vOld = await call(R.recordReferralVisit, 'OLD', { code: my.code });
  ok('기존 손님 방문 isNew=false', vOld.ok && vOld.isNew === false, vOld);
  const vSelf = await call(R.recordReferralVisit, 'R1', { code: my.code });
  ok('자기 코드 self', vSelf.reason === 'self', vSelf);

  let c = await call(R.completeReferral, 'I1');
  ok('로그인 전 need_login', c.status === 'need_login', c);
  users.get('I1').providers = [{ providerId: 'google.com', uid: 'g-123' }];
  c = await call(R.completeReferral, 'I1', {}, 'google.com');
  ok('사주 없으면 no_saju', c.status === 'no_saju', c);
  profile('I1', 1999);
  c = await call(R.completeReferral, 'I1', {}, 'google.com');
  ok('지급 granted', c.status === 'granted' && c.inviteeUn === 3, c);
  ok('친구 적립 3운', keys('rewardGrants/I1/items/').length === 1 && store.get(keys('rewardGrants/I1/items/')[0]).amount === 3);
  ok('초대한 사람 적립 2운', keys('rewardGrants/R1/items/').length === 1 && store.get(keys('rewardGrants/R1/items/')[0]).amount === 2);
  const cd = store.get(`referralCodes/${my.code}`);
  ok('코드 장부 visits 1, qualified 1, earned 2', cd.visits === 1 && cd.qualified === 1 && cd.earnedUn === 2, cd);

  c = await call(R.completeReferral, 'I1', {}, 'google.com');
  ok('같은 사람 두 번 used', c.status === 'used', c);
  users.set('I2', { created: Date.now() - 30e3, providers: [{ providerId: 'google.com', uid: 'g-123' }] });
  await call(R.recordReferralVisit, 'I2', { code: my.code });
  profile('I2', 1999);
  c = await call(R.completeReferral, 'I2', {}, 'google.com');
  ok('같은 구글 계정을 다른 새 계정에 붙여도 used', c.status === 'used', c);
  users.get('OLD').providers = [{ providerId: 'oidc.kakao', uid: 'k-9' }];
  profile('OLD', 1980);
  c = await call(R.completeReferral, 'OLD', {}, 'oidc.kakao');
  ok('기존 손님은 로그인해도 not_new', c.status === 'not_new', c);

  let cl = await call(R.claimRewards, 'I1', {}, 'google.com');
  ok('친구 받기 3운 + 서버 잔액 반영', cl.amount === 3 && store.get('users/I1').balance.reward === 3, { cl, bal: store.get('users/I1') && store.get('users/I1').balance });
  cl = await call(R.claimRewards, 'I1', {}, 'google.com');
  ok('두 번 받기 0', cl.amount === 0, cl);
  cl = await call(R.claimRewards, 'R1');
  ok('초대한 사람 받기 2운, 익명이라 서버 잔액 없음', cl.amount === 2 && !store.has('users/R1'), cl);

  await R.referralOnPurchase('I1', 1, 1);
  ok('1운 충전은 보너스 없음', keys('rewardGrants/R1/items/', 'purchase').length === 0);
  await R.referralOnPurchase('I1', 3, 4);
  const pg = keys('rewardGrants/R1/items/', 'purchase');
  ok('첫 4운 충전 보너스 5운', pg.length === 1 && store.get(pg[0]).amount === 5, pg.map((k) => store.get(k).amount));
  cl = await call(R.claimRewards, 'R1');
  ok('7일 보류 중엔 0', cl.amount === 0, cl);
  store.get(pg[0]).availableAtMs = Date.now() - 1000;
  cl = await call(R.claimRewards, 'R1');
  ok('보류가 끝나면 5운', cl.amount === 5, cl);
  await R.referralOnPurchase('I1', 10, 15);
  ok('두 번째 충전 보너스 없음', keys('rewardGrants/R1/items/', 'purchase').length === 1);

  store.set('config/referral', { monthlyCap: 1 });
  users.set('I3', { created: Date.now() - 10e3, providers: [{ providerId: 'oidc.kakao', uid: 'k-77' }] });
  await call(R.recordReferralVisit, 'I3', { code: my.code });
  profile('I3', 2001);
  c = await call(R.completeReferral, 'I3', {}, 'oidc.kakao');
  ok('월 상한: 친구는 받고 초대한 사람은 없음', c.status === 'granted' && c.referrerCapped === true && keys('rewardGrants/R1/items/', 'referrer').length === 1, c);

  store.set('config/referral', { globalDailyUn: 5 });
  users.set('I4', { created: Date.now() - 10e3, providers: [{ providerId: 'apple.com', uid: 'a-1' }] });
  await call(R.recordReferralVisit, 'I4', { code: my.code });
  profile('I4', 2002);
  c = await call(R.completeReferral, 'I4', {}, 'apple.com');
  ok('하루 전체 상한: paused + 경보', c.status === 'paused' && keys('backofficeAlerts/').length > 0, c);
  store.set('config/referral', { enabled: false });
  c = await call(R.completeReferral, 'I4', {}, 'apple.com');
  ok('enabled:false 면 disabled', c.status === 'disabled', c);
  store.delete('config/referral');

  let cr = await call(R.creditLocalReward, 'I1', { kind: 'daily' }, 'google.com');
  ok('출석 0.1운 서버 반영', cr.ok && Math.abs(store.get('users/I1').balance.reward - 3.1) < 1e-9, { cr, bal: store.get('users/I1').balance });
  cr = await call(R.creditLocalReward, 'I1', { kind: 'daily' }, 'google.com');
  ok('출석 하루 두 번은 already', cr.reason === 'already', cr);
  cr = await call(R.creditLocalReward, 'R1', { kind: 'daily' });
  ok('익명은 anon', cr.reason === 'anon', cr);
  cr = await call(R.creditLocalReward, 'I1', { kind: 'streak3' }, 'google.com');
  ok('서버 출석 기록 없으면 streak3 not_yet', cr.reason === 'not_yet', cr);
  const d = (n) => new Date(Date.now() + 9 * 3600e3 - n * 864e5).toISOString().slice(0, 10);
  [0, 1, 2].forEach((n) => store.set(`users/I1/attendance/${d(n)}`, { at: 1 }));
  cr = await call(R.creditLocalReward, 'I1', { kind: 'streak3' }, 'google.com');
  ok('3일 연속이면 streak3 1운', cr.ok && Math.abs(store.get('users/I1').balance.reward - 4.1) < 1e-9, { cr, bal: store.get('users/I1').balance });

  await R.purgeReferralOf('I1');
  ok('탈퇴 파기', !store.has('referralVisits/I1') && keys('rewardGrants/I1/').length === 0);
  console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
