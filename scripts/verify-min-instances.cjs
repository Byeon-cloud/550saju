/** Cloud Run 실제 minInstanceCount 검증 (읽기 전용) — 배포 후 5개 함수가 0인지 확인 */
const CONFIG_PATH = 'C:/Users/quswn/.config/configstore/firebase-tools.json';
const PROJECT = 'appintoss-saju';
const REGION = 'us-central1';
const FNS = ['generatePremiumReportStream', 'generateDreamFreeStream', 'generateTopicAnalysisStream', 'generateDailyFortuneStream'];

(async () => {
  const cfg = require(CONFIG_PATH);
  const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token' }) });
  const H = { Authorization: 'Bearer ' + (await tr.json()).access_token };

  console.log('=== Cloud Run minInstanceCount 검증 ===\n');
  let allZero = true;
  for (const fn of FNS) {
    // Gen2 함수는 소문자 서비스명으로 매핑됨
    const svc = fn.toLowerCase();
    const url = `https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services/${svc}`;
    const r = await (await fetch(url, { headers: H })).json();
    if (r.error) { console.log(`  ${fn}: 조회 실패 (${r.error.status}) ${r.error.message?.slice(0, 60) || ''}`); allZero = false; continue; }
    const minC = r.template?.scaling?.minInstanceCount ?? 0; // 0 이면 필드 생략됨
    const maxC = r.template?.scaling?.maxInstanceCount ?? '-';
    const traffic = (r.traffic || []).map(t => `${(t.revision || t.type || '').split('/').pop()}=${t.percent ?? 0}%`).join(',');
    const ready = (r.conditions || []).find(c => c.type === 'Ready')?.state || '?';
    const ok = minC === 0;
    if (!ok) allZero = false;
    console.log(`  ${ok ? '✅' : '❌'} ${fn}`);
    console.log(`       minInstanceCount=${minC} | maxInstanceCount=${maxC} | Ready=${ready} | traffic: ${traffic}`);
  }
  console.log('\n' + (allZero ? '🟢 5개 함수 전부 minInstanceCount=0 확인' : '🔴 일부 미반영 — 위 ❌ 확인'));
})().catch((e) => console.log('ERR', e.message));
