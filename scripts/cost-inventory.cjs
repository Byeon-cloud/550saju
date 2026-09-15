/** GCP 비용 인벤토리 실측 (읽기 전용) — minInstances 0 이후 남은 비용 레버 파악
 *   ① Cloud Run 서비스 전체: memory / minInstanceCount / maxInstanceCount
 *   ② Cloud Scheduler 잡: 크론 빈도 (자주 도는 게 곧 비용)
 *   ③ Secret Manager: 활성 시크릿/버전 수 (버전당 과금) */
const CONFIG_PATH = 'C:/Users/quswn/.config/configstore/firebase-tools.json';
const PROJECT = 'appintoss-saju';
const REGION = 'us-central1';

(async () => {
  const cfg = require(CONFIG_PATH);
  const tr = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi', refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token' }) });
  const H = { Authorization: 'Bearer ' + (await tr.json()).access_token };
  const j = async (u) => (await fetch(u, { headers: H })).json();

  // ① Cloud Run 서비스 (Gen2 함수)
  console.log('=== ① Cloud Run 서비스 (memory / minInst / maxInst) ===');
  let svcs = [], pt = '';
  do {
    const r = await j(`https://run.googleapis.com/v2/projects/${PROJECT}/locations/${REGION}/services?pageSize=100${pt ? '&pageToken=' + pt : ''}`);
    svcs.push(...(r.services || [])); pt = r.nextPageToken || '';
  } while (pt);
  svcs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  let warm = [];
  for (const s of svcs) {
    const nm = (s.name || '').split('/').pop();
    const t = s.template || {};
    const mem = t.containers?.[0]?.resources?.limits?.memory || '?';
    const cpu = t.containers?.[0]?.resources?.limits?.cpu || '?';
    const minC = t.scaling?.minInstanceCount ?? 0;
    const maxC = t.scaling?.maxInstanceCount ?? '-';
    const conc = t.maxInstanceRequestConcurrency ?? '-';
    if (minC > 0) warm.push(nm);
    console.log(`  ${nm}  mem=${mem} cpu=${cpu} min=${minC}${minC > 0 ? ' ⚠️상시대기' : ''} max=${maxC} conc=${conc}`);
  }
  console.log(`  총 ${svcs.length}개 서비스 | 상시대기(min>0): ${warm.length ? warm.join(', ') : '없음 ✅'}`);

  // ② Cloud Scheduler
  console.log('\n=== ② Cloud Scheduler (크론 빈도) ===');
  const sch = await j(`https://cloudscheduler.googleapis.com/v1/projects/${PROJECT}/locations/${REGION}/jobs?pageSize=100`);
  const jobs = sch.jobs || [];
  if (!jobs.length) console.log('  ' + (sch.error ? '조회실패: ' + sch.error.status : '없음'));
  jobs.forEach((jb) => console.log(`  ${(jb.name || '').split('/').pop()} | schedule="${jb.schedule}" | tz=${jb.timeZone || '-'} | state=${jb.state}`));

  // ③ Secret Manager
  console.log('\n=== ③ Secret Manager (버전당 과금) ===');
  const secs = await j(`https://secretmanager.googleapis.com/v1/projects/${PROJECT}/secrets?pageSize=100`);
  const secrets = secs.secrets || [];
  if (!secrets.length) console.log('  ' + (secs.error ? '조회실패: ' + secs.error.status : '없음'));
  for (const s of secrets) {
    const nm = (s.name || '').split('/').pop();
    const vers = await j(`https://secretmanager.googleapis.com/v1/${s.name}/versions?pageSize=100`);
    const vlist = (vers.versions || []);
    const enabled = vlist.filter(v => v.state === 'ENABLED').length;
    console.log(`  ${nm} | 버전 ${vlist.length}개 (활성 ${enabled})${enabled > 1 ? ' ⚠️활성 다수' : ''}`);
  }
})().catch((e) => console.log('ERR', e.message));
