/**
 * CS 계정 이관 도구 — 익명 uid 회전으로 보관함을 잃은 유저 복구
 * (2026-08-07 조혜미님 CS 대응으로 신설 · 향후 동일 CS 재사용)
 *
 * 배경: 익명 로그인 세션(IndexedDB)이 초기화되면 새 uid 가 발급되고,
 *   앱은 옛 uid 를 알 방법이 없어 서버에 데이터가 멀쩡히 있어도 못 찾는다.
 *   이 스크립트가 옛 uid → 새 uid 로 리포트를 **복사**해 연결을 되살린다.
 *   이미 배포된 앱의 bootSync 가 서버→로컬 복원을 하므로, 이관만 하면
 *   유저가 앱을 여는 순간 보관함이 돌아온다 (앱 업데이트 불필요).
 *
 * 안전장치:
 *   - 복사(원본 uid 데이터 보존) · 이미 있는 문서는 건너뜀
 *   - --dry 기본값: 실제 쓰기 전 반드시 미리보기
 *   - 결제 orderId 에 iapOrders 멱등 마킹 → 추후 IAP 자동복구의 이중지급 차단
 *   - 잔액은 건드리지 않음 (서버 balance 는 '누적 충전량'이라 복원 시 소비분까지 부활)
 *     → 운 보상은 어드민 CS 지급 경로로만
 *
 * 사용:
 *   node scripts/cs-migrate-uid.cjs --from <옛uid> --to <새uid>          # 미리보기
 *   node scripts/cs-migrate-uid.cjs --from <옛uid> --to <새uid> --apply  # 실제 실행
 */
const CONFIG_PATH = 'C:/Users/quswn/.config/configstore/firebase-tools.json';
const PROJECT = 'appintoss-saju';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)`;
const DOCS = `${BASE}/documents`;
const PREFIX = `projects/${PROJECT}/databases/(default)/documents`;

// firebase-tools 에 내장된 공개 OAuth 클라이언트 (CLI 로그인 자격 재사용)
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const OLD = flag('--from');
const NEW = flag('--to');
const APPLY = args.includes('--apply');

if (!OLD || !NEW) {
  console.log('사용: node scripts/cs-migrate-uid.cjs --from <옛uid> --to <새uid> [--apply]');
  process.exit(1);
}
if (OLD === NEW) { console.log('옛 uid 와 새 uid 가 같습니다.'); process.exit(1); }

const val = (v) => {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x); return o; }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return null;
};
const flat = (d) => { const o = {}; for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v); return o; };

(async () => {
  const cfg = require(CONFIG_PATH);
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const tok = await tr.json();
  if (!tok.access_token) { console.log('인증 실패 — firebase login 상태 확인 필요'); process.exit(1); }
  const H = { Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' };

  const get = async (p) => (await fetch(DOCS + p, { headers: H })).json();
  const commit = async (writes) => (await fetch(`${BASE}/documents:commit`, {
    method: 'POST', headers: H, body: JSON.stringify({ writes }),
  })).json();

  const readAll = async (uid, sub, mask) => {
    const out = []; let pt = '';
    do {
      const q = `/users/${uid}/${sub}?pageSize=100` + (pt ? `&pageToken=${pt}` : '') + (mask || '');
      const r = await get(q);
      out.push(...(r.documents || [])); pt = r.nextPageToken || '';
    } while (pt);
    return out;
  };

  console.log(`\n${APPLY ? '🔴 실제 실행' : '🔍 미리보기 (--apply 없음)'} | ${OLD} → ${NEW}\n`);

  // 1) 옛 uid 리포트
  const reports = await readAll(OLD, 'reports');
  const paidCnt = reports.map(flat).filter((x) => x.type === 'paid').length;
  const bodyCnt = reports.filter((d) => d.fields && (d.fields.aiResultJson || d.fields.aiResult)).length;
  console.log(`옛 uid 리포트: ${reports.length}건 (유료 ${paidCnt} · 본문보유 ${bodyCnt})`);

  // 2) 새 uid 에 이미 있는 문서 (스킵 대상)
  const existing = new Set((await readAll(NEW, 'reports', '&mask.fieldPaths=name')).map((d) => d.name.split('/').pop()));
  const todo = reports.filter((d) => !existing.has(d.name.split('/').pop()));
  console.log(`새 uid 기존: ${existing.size}건 → 복사 대상 ${todo.length}건\n`);

  if (!APPLY) {
    console.log('--- 복사될 문서 (상위 10건) ---');
    todo.slice(0, 10).forEach((d) => {
      const x = flat(d);
      console.log(`  ${x.contentType || '?'} | ${x.type || ''} | ${x.name || ''} | ${String(x.createdAt || '').slice(0, 10)}`);
    });
    const pays = await get(`/users/${OLD}/payments?pageSize=20`);
    console.log(`\n--- 결제 ${(pays.documents || []).length}건 (이관 + 멱등 마킹 예정) ---`);
    (pays.documents || []).forEach((p) => {
      const x = flat(p);
      console.log(`  ₩${x.amount} → +${x.paidUn}운+${x.bonusUn} | ${String(x.createdAt || '').slice(0, 10)} | ${x.status}`);
    });
    console.log('\n실제 실행하려면 --apply 를 붙이세요.');
    return;
  }

  // 3) 리포트 복사 — 개별 커밋 (exists:false 충돌이 배치 전체를 죽이지 않게)
  let copied = 0, failed = 0;
  const stamp = new Date().toISOString();
  for (const d of todo) {
    const id = d.name.split('/').pop();
    const res = await commit([{
      currentDocument: { exists: false },
      update: {
        name: `${PREFIX}/users/${NEW}/reports/${id}`,
        fields: {
          ...d.fields,
          migratedFromUid: { stringValue: OLD },
          migratedAt: { timestampValue: stamp },
        },
      },
    }]);
    if (res.error) { failed++; } else { copied++; }
    if (copied % 10 === 0 && copied) process.stdout.write(`  ...${copied}건\r`);
  }
  console.log(`리포트 복사: ${copied}건 성공 · ${failed}건 스킵/실패`);

  // 4) 결제 이관 + IAP 자동복구 멱등 마킹 (이중지급 차단)
  const pays = await get(`/users/${OLD}/payments?pageSize=20`);
  for (const p of (pays.documents || [])) {
    const oid = p.name.split('/').pop();
    await commit([{
      update: {
        name: `${PREFIX}/users/${NEW}/payments/${oid}`,
        fields: { ...p.fields, migratedFromUid: { stringValue: OLD }, migratedAt: { timestampValue: stamp } },
      },
    }]);
    await commit([{
      update: {
        name: `${PREFIX}/iapOrders/${oid}`,
        fields: {
          sku: p.fields.sku || { stringValue: 'unknown' },
          recoverCount: { integerValue: '1' },
          lastRecoveredUid: { stringValue: NEW },
          note: { stringValue: `cs-manual-migration ${stamp.slice(0, 10)}` },
        },
      },
    }]);
    console.log(`결제 이관 + 멱등 마킹: ${oid.slice(0, 28)}`);
  }

  // 5) 새 uid 에 이관 흔적 (잔액은 건드리지 않음 — 어드민 CS 지급 경로 사용)
  await commit([{
    update: { name: `${PREFIX}/users/${NEW}`, fields: { migratedFromUid: { stringValue: OLD }, migratedAt: { timestampValue: stamp } } },
    updateMask: { fieldPaths: ['migratedFromUid', 'migratedAt'] },
  }]);

  // 6) 검증
  const after = await readAll(NEW, 'reports', '&mask.fieldPaths=name');
  console.log(`\n✅ 검증 — 새 uid 리포트 총 ${after.length}건 (기대: ${existing.size + copied})`);
})().catch((e) => console.log('ERR', e.message));
