/**
 * E2E — 과거 피해자 자동복구 2경로 검증 (2026-08-13). 테스트 데이터만 생성/삭제.
 *   경로1: 보상 이력 다리 — compensations/{deviceId}.claimedByUid 를 donor 로 삼아 회전 복구
 *   경로2: IAP 결제 이력 — recoverIapOrders 가 orderId 로 옛 uid 역추적 → 리포트+잔액 복구
 * 셋업은 admin(OAuth) 토큰으로 compensations/payments 기록(룰 우회), 함수 호출은 client 토큰(request.auth).
 */
const fs = require('fs');
const P = 'appintoss-saju';
const FS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const CALL = (name) => `https://us-central1-${P}.cloudfunctions.net/${name}`;
const rnd = (n) => require('crypto').randomBytes(n).toString('hex');

const env = fs.readFileSync('.env', 'utf8');
const API_KEY = (env.match(/VITE_FIREBASE_API_KEY=(\S+)/) || [])[1];
const cfg = require('C:/Users/quswn/.config/configstore/firebase-tools.json');

const anon = async () => { const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) }); const j = await r.json(); return { uid: j.localId, token: j.idToken }; };
const wr = async (tok, path, fields) => (await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })).json();
const gt = async (tok, path) => (await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer ' + tok } })).json();
const del = async (tok, path) => fetch(`${FS}/${path}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
const call = async (tok, name, data) => (await fetch(CALL(name), { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) })).json();

(async () => {
  const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token' }) });
  const ADMIN = (await tr.json()).access_token;

  // ───────── 경로1: 보상 이력 다리 ─────────
  const DID = ('e2e3' + rnd(32)).slice(0, 64);
  const don = await anon(); // 옛 계정 (보상 수령자)
  await wr(don.token, `users/${don.uid}/reports/e2ecomp01`, { name: { stringValue: 'E2E보상' }, contentType: { stringValue: 'report' }, type: { stringValue: 'paid' }, createdAt: { stringValue: new Date().toISOString() }, aiResultJson: { stringValue: '{"x":1}' } });
  await wr(don.token, `users/${don.uid}/state/balance`, { paid: { integerValue: '4' }, bonus: { integerValue: '1' }, reward: { integerValue: '0' }, updatedAt: { timestampValue: new Date().toISOString() } });
  // admin: compensations/{DID}.claimedByUid = 옛 계정
  await wr(ADMIN, `compensations/${DID}`, { claimedByUid: { stringValue: don.uid }, amount: { integerValue: '0' }, claimed: { booleanValue: true } });
  const nu = await anon(); // 새 계정 (회전)
  const r1 = await call(nu.token, 'registerDevicePassport', { deviceId: DID });
  const rep1 = await gt(nu.token, `users/${nu.uid}/reports/e2ecomp01`);
  const mir1 = await gt(nu.token, `users/${nu.uid}/state/balance`);
  const p1a = r1.result?.rotated === true && r1.result?.migratedReports === 1;
  const p1b = !rep1.error && rep1.fields?.migratedFromUid?.stringValue === don.uid;
  const p1c = !mir1.error && mir1.fields?.paid?.integerValue === '4';
  console.log('경로1 (보상다리) — 회전+리포트이관:', p1a ? '✅' : '❌ ' + JSON.stringify(r1.result ?? r1).slice(0, 120));
  console.log('경로1 — 리포트 복사:', p1b ? '✅' : '❌', '| 잔액 미러:', p1c ? '✅' : '❌');

  // ───────── 경로2: IAP 결제 이력 복구 ─────────
  const OID = 'e2e-' + rnd(12);
  const SKU = 'ait.0000025955.5d5bec27.6ee0778e2a.5185547787'; // 4운(3+1) — 서버 SKU_UN_MAP 존재
  const don2 = await anon(); // 옛 결제 계정
  await wr(don2.token, `users/${don2.uid}/reports/e2eiap01`, { name: { stringValue: 'E2E결제' }, contentType: { stringValue: 'report' }, type: { stringValue: 'paid' }, createdAt: { stringValue: new Date().toISOString() }, aiResultJson: { stringValue: '{"y":2}' } });
  // admin: 옛 계정의 payments/{OID} (recoverIapOrders 가 collectionGroup 으로 역추적)
  await wr(ADMIN, `users/${don2.uid}/payments/${OID}`, { orderId: { stringValue: OID }, sku: { stringValue: SKU }, status: { stringValue: 'confirmed' }, paidUn: { integerValue: '3' }, bonusUn: { integerValue: '1' } });
  const nu2 = await anon(); // 새 계정
  const r2 = await call(nu2.token, 'recoverIapOrders', { orders: [{ orderId: OID, sku: SKU, status: 'COMPLETED' }] });
  const rep2 = await gt(nu2.token, `users/${nu2.uid}/reports/e2eiap01`);
  const usr2 = await gt(nu2.token, `users/${nu2.uid}`);
  const p2a = (r2.result?.paidUn === 3) && (r2.result?.migratedReports === 1);
  const p2b = !rep2.error && rep2.fields?.migratedFromUid?.stringValue === don2.uid;
  const p2c = !usr2.error && Number(usr2.fields?.balance?.mapValue?.fields?.paid?.integerValue || 0) >= 3;
  console.log('\n경로2 (IAP복구) — 잔액지급+리포트이관:', p2a ? '✅' : '❌ ' + JSON.stringify(r2.result ?? r2).slice(0, 150));
  console.log('경로2 — 리포트 복사:', p2b ? '✅' : '❌', '| 서버잔액 지급:', p2c ? '✅' : '❌');

  // ───────── 정리 ─────────
  await del(ADMIN, `compensations/${DID}`);
  await del(ADMIN, `devices/${DID}`);
  await del(don.token, `users/${don.uid}/reports/e2ecomp01`); await del(don.token, `users/${don.uid}/state/balance`);
  await del(nu.token, `users/${nu.uid}/reports/e2ecomp01`); await del(nu.token, `users/${nu.uid}/state/balance`);
  await del(don2.token, `users/${don2.uid}/reports/e2eiap01`); await del(ADMIN, `users/${don2.uid}/payments/${OID}`);
  await del(nu2.token, `users/${nu2.uid}/reports/e2eiap01`); await del(ADMIN, `users/${nu2.uid}/payments/${OID}`); await del(ADMIN, `iapOrders/${OID}`);
  console.log('\n정리 완료');
  console.log((p1a && p1b && p1c && p2a && p2b && p2c) ? '\n🟢 두 경로 모두 PASS' : '\n🔴 FAIL');
})().catch((e) => console.log('ERR', e.message));
