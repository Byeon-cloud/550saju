/**
 * 유입/구매 폭증 분석 리포트 (2026-06-27 · 트래킹 진단용)
 *
 * analytics 컬렉션을 KST day 버킷으로 긁어서:
 *   - plat별(web/ait) 고유 기기 수(DAU 근사)
 *   - 유입 source별(utm.source — toss_app/direct/threads/instagram…) 기기·세션 수
 *   - 구매(content_purchase·charge_complete) 총수 + source별 + plat별 + 시간대(KST)별
 *   - 신규 기기(해당 기간 첫 등장 did) 근사
 *
 * 실행 (functions 디렉터리에 firebase-admin 있음):
 *   1) gcloud auth application-default login        # 최초 1회 (ADC 발급)
 *   2) cd D:\550saju\functions
 *   3) node ../scripts/inflow-report.mjs 2026-06-26 2026-06-27
 *      (날짜 인자 생략 시 어제·오늘 KST 자동)
 *
 * ※ ADC 안 되면: 토스 콘솔 통계가 토스-내부 유입(discovery/검색/추천)의 authoritative 소스.
 */
import admin from 'firebase-admin';

const PROJECT = 'appintoss-saju';

function kstDay(d = new Date(), addDays = 0) {
  const t = new Date(d.getTime() + 9 * 3600e3 + addDays * 86400e3);
  return t.toISOString().slice(0, 10);
}

const argDays = process.argv.slice(2).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
const days = argDays.length ? argDays : [kstDay(new Date(), -1), kstDay()];

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

const PURCHASE = new Set(['content_purchase', 'charge_complete']);

function inc(map, key, by = 1) { map.set(key, (map.get(key) || 0) + by); }
function topRows(map, n = 20) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

async function main() {
  console.log(`\n=== 유입/구매 리포트 · KST day ∈ [${days.join(', ')}] · project=${PROJECT} ===\n`);

  // analytics where day in days (Firestore in: 최대 10개)
  const snap = await db.collection('analytics').where('day', 'in', days.slice(0, 10)).get();
  console.log(`analytics 문서 ${snap.size}건 로드\n`);

  const platDevices = new Map();        // plat -> Set(did)
  const sourceDevices = new Map();      // source -> Set(did)
  const sourceSessions = new Map();     // source -> Set(sid)
  const purchaseBySource = new Map();   // source -> count
  const purchaseByPlat = new Map();     // plat -> count
  const purchaseByHour = new Map();     // 'YYYY-MM-DD HH' (KST) -> count
  const purchaseByName = new Map();     // content_purchase|charge_complete -> count
  const allDevicesByDay = new Map();    // day -> Set(did)  (신규 근사용)
  let purchaseTotal = 0, internalSkipped = 0;

  snap.forEach((doc) => {
    const e = doc.data();
    if (e.internal) { internalSkipped++; return; }   // 오너 기기 제외
    const plat = e.plat || 'unknown';
    const did = e.did || e.uid || e.sid || 'unknown';
    const sid = e.sid || did;
    const source = (e.utm && e.utm.source) ? e.utm.source : (plat === 'ait' ? 'toss_app(untagged)' : 'direct(web)');
    const day = e.day || days[0];

    if (!platDevices.has(plat)) platDevices.set(plat, new Set());
    platDevices.get(plat).add(did);
    if (!sourceDevices.has(source)) sourceDevices.set(source, new Set());
    sourceDevices.get(source).add(did);
    if (!sourceSessions.has(source)) sourceSessions.set(source, new Set());
    sourceSessions.get(source).add(sid);
    if (!allDevicesByDay.has(day)) allDevicesByDay.set(day, new Set());
    allDevicesByDay.get(day).add(did);

    if (PURCHASE.has(e.name)) {
      purchaseTotal++;
      inc(purchaseBySource, source);
      inc(purchaseByPlat, plat);
      inc(purchaseByName, e.name);
      let hour = '??';
      try {
        const ms = e.ts && e.ts.toMillis ? e.ts.toMillis() : (e.ts && e.ts._seconds ? e.ts._seconds * 1000 : null);
        if (ms) { const k = new Date(ms + 9 * 3600e3); hour = k.toISOString().slice(0, 13).replace('T', ' '); }
      } catch { /* noop */ }
      inc(purchaseByHour, hour);
    }
  });

  console.log(`내부(오너) 기기 제외: ${internalSkipped}건\n`);

  console.log('── plat별 고유 기기 수 (DAU 근사) ──');
  for (const [p, set] of platDevices) console.log(`  ${p.padEnd(10)} ${set.size}`);

  console.log('\n── 유입 source별 (기기 / 세션) ──  ★ 폭증이 어디서 왔는지');
  const srcRows = [...sourceDevices.entries()].sort((a, b) => b[1].size - a[1].size);
  for (const [s, set] of srcRows) console.log(`  ${s.padEnd(24)} 기기 ${String(set.size).padStart(5)}  세션 ${sourceSessions.get(s)?.size ?? 0}`);

  console.log(`\n── 구매 이벤트 (content_purchase+charge_complete) 총 ${purchaseTotal}건 ──`);
  console.log('  [종류별]'); for (const [k, v] of topRows(purchaseByName)) console.log(`    ${k.padEnd(20)} ${v}`);
  console.log('  [source별]  ★ 구매한 사람이 어디서 왔나'); for (const [k, v] of topRows(purchaseBySource)) console.log(`    ${k.padEnd(24)} ${v}`);
  console.log('  [plat별]'); for (const [k, v] of topRows(purchaseByPlat)) console.log(`    ${k.padEnd(10)} ${v}`);
  console.log('  [시간대별 KST]  ★ 언제 터졌나'); for (const [k, v] of [...purchaseByHour.entries()].sort()) console.log(`    ${k}  ${'■'.repeat(Math.min(v, 60))} ${v}`);

  console.log('\n── 일자별 고유 기기 (신규 추세 참고) ──');
  for (const [d, set] of [...allDevicesByDay.entries()].sort()) console.log(`  ${d}  ${set.size}`);

  console.log('\n해석 가이드:');
  console.log('  · source=threads/instagram 등 → 그 채널 링크 유입 (utm 태그 됨)');
  console.log('  · source=toss_app(untagged) → 토스 내부(추천/검색) or 무태그 딥링크 — 토스 콘솔 통계 교차확인');
  console.log('  · source=direct(web) → 웹 직접 진입(무태그)');
  console.log('  · 폭증이 toss_app 에 몰렸으면 → 토스가 띄워준 것. 토스 개발자 콘솔 유입통계 확인.\n');
  process.exit(0);
}

main().catch((e) => { console.error('ERROR:', e?.message || e); console.error('\nADC 안 됐으면: gcloud auth application-default login 먼저.'); process.exit(1); });
