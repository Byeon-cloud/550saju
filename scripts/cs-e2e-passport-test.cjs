/**
 * 기기 여권 E2E 검증 (2026-08-13) — 프로덕션에서 실제 흐름 재현
 *
 * 시나리오 (= uid 회전 사고의 재현):
 *   1. 익명 계정 A 생성 → 테스트 리포트 1건 + 잔액 미러 저장 (rules 상 owner 권한)
 *   2. A 가 여권 등록 (registerDevicePassport, 테스트 deviceId)
 *   3. 익명 계정 B 생성 (= 저장소 초기화 후 새 uid) → 같은 deviceId 로 여권 호출
 *   4. 기대: migratedReports=1 · B 의 reports 에 사본 · B 의 state/balance 에 미러 사본
 *   5. 정리: 자기 소유 테스트 문서 삭제 (owner 권한 — 타 유저 데이터 접근 0)
 *
 * 테스트 데이터만 만들고 지운다. 실유저 데이터는 읽지도 쓰지도 않는다.
 */
const fs = require('fs');
const P = 'appintoss-saju';
const FS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const FN = `https://us-central1-${P}.cloudfunctions.net/registerDevicePassport`;
// 테스트 전용 deviceId — 실행마다 랜덤(격리) + 시나리오별 분리(쿨다운/누적 uid 간섭 방지).
//   e2e 접두 hex64. 이전 실행의 device 문서와 절대 겹치지 않게 매번 새로 생성.
const rndHex = (n) => require('crypto').randomBytes(n).toString('hex');
const DID_1 = ('e2e1' + rndHex(32)).slice(0, 64); // 시나리오1 (A,B)
const DID_2 = ('e2e2' + rndHex(32)).slice(0, 64); // 시나리오2 (C,D)

// .env 에서 API 키 (클라 공개키 — identitytoolkit 익명 가입용)
const env = fs.readFileSync('.env', 'utf8');
const API_KEY = (env.match(/VITE_FIREBASE_API_KEY=(\S+)/) || [])[1];
if (!API_KEY) { console.log('API_KEY 없음'); process.exit(1); }

const anonSignup = async () => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error('익명가입 실패: ' + JSON.stringify(j).slice(0, 120));
  return { uid: j.localId, token: j.idToken };
};
const fsWrite = async (token, path, fields) =>
  (await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })).json();
const fsGet = async (token, path) =>
  (await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer ' + token } })).json();
const fsDelete = async (token, path) =>
  fetch(`${FS}/${path}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
const callPassport = async (token, did) => {
  const r = await fetch(FN, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { deviceId: did } }) });
  return r.json();
};

(async () => {
  // 1) 계정 A — 리포트 + 잔액 미러
  const A = await anonSignup();
  console.log('A uid:', A.uid);
  const w1 = await fsWrite(A.token, `users/${A.uid}/reports/e2etest01`, {
    name: { stringValue: 'E2E테스트' }, contentType: { stringValue: 'daily' }, type: { stringValue: 'free' },
    createdAt: { stringValue: new Date().toISOString() }, aiResultJson: { stringValue: '{"test":true}' },
  });
  if (w1.error) { console.log('A 리포트 write 실패:', w1.error.status); return; }
  const w2 = await fsWrite(A.token, `users/${A.uid}/state/balance`, {
    paid: { integerValue: '2' }, bonus: { integerValue: '1' }, reward: { doubleValue: 0.5 },
    updatedAt: { timestampValue: new Date().toISOString() },
  });
  console.log('A 데이터 생성:', w1.error ? 'FAIL' : 'OK', '/ 미러:', w2.error ? 'FAIL(' + w2.error.status + ')' : 'OK');

  // 2) A 여권 등록
  const r1 = await callPassport(A.token, DID_1);
  console.log('A 여권 등록:', JSON.stringify(r1.result ?? r1).slice(0, 150));

  // 3) 계정 B (회전 시뮬레이션) — 같은 deviceId
  const B = await anonSignup();
  console.log('B uid:', B.uid);
  const r2 = await callPassport(B.token, DID_1);
  console.log('B 여권 호출:', JSON.stringify(r2.result ?? r2).slice(0, 200));

  // 4) 검증
  const rep = await fsGet(B.token, `users/${B.uid}/reports/e2etest01`);
  const mir = await fsGet(B.token, `users/${B.uid}/state/balance`);
  const repOk = !rep.error && rep.fields?.migratedVia?.stringValue === 'device-passport';
  const mirOk = !mir.error && mir.fields?.paid?.integerValue === '2';
  console.log('\n검증 — 리포트 이관:', repOk ? '✅' : '❌ ' + JSON.stringify(rep).slice(0, 120));
  console.log('검증 — 잔액 미러 이관:', mirOk ? '✅' : '❌ ' + JSON.stringify(mir).slice(0, 120));

  // ── 시나리오 2 (P0 회귀): 리포트 0건 + 잔액만 있는 유저 → 회전 → 잔액 미러 복원돼야 함
  const C = await anonSignup();
  await fsWrite(C.token, `users/${C.uid}/state/balance`, {
    paid: { integerValue: '5' }, bonus: { integerValue: '2' }, reward: { integerValue: '0' },
    updatedAt: { timestampValue: new Date().toISOString() },
  });
  await callPassport(C.token, DID_2); // C 등록 (리포트 0건)
  const D = await anonSignup();
  const rD = await callPassport(D.token, DID_2); // D 회전
  const mirD = await fsGet(D.token, `users/${D.uid}/state/balance`);
  const rotOk = rD.result?.rotated === true && rD.result?.migratedReports === 0;
  const mir0Ok = !mirD.error && mirD.fields?.paid?.integerValue === '5';
  console.log('\n시나리오2 (0리포트) — rotated+0건:', rotOk ? '✅' : '❌ ' + JSON.stringify(rD.result ?? rD).slice(0, 120));
  console.log('시나리오2 — 잔액 미러 이관:', mir0Ok ? '✅' : '❌ ' + JSON.stringify(mirD).slice(0, 120));

  // 정리 — 자기 소유 문서만
  await fsDelete(A.token, `users/${A.uid}/reports/e2etest01`);
  await fsDelete(A.token, `users/${A.uid}/state/balance`);
  await fsDelete(B.token, `users/${B.uid}/reports/e2etest01`);
  await fsDelete(B.token, `users/${B.uid}/state/balance`);
  await fsDelete(C.token, `users/${C.uid}/state/balance`);
  await fsDelete(D.token, `users/${D.uid}/state/balance`);
  console.log('\n정리 완료 (테스트 문서 삭제)');
  console.log(repOk && mirOk && rotOk && mir0Ok ? '\n🟢 E2E PASS (2 시나리오)' : '\n🔴 E2E FAIL');
})().catch((e) => console.log('ERR', e.message));
