/* config/portoneAutoGrant 켜고 끄기 — node scripts/ops/set_autogrant.cjs on|off (firebase-tools 로그인 세션, 2026-10-24 자동 채우기 배포 과도기용) */
const { init } = require('D:/550saju/scripts/ops/fs.cjs');
const BASE = '/v1/projects/appintoss-saju/databases/(default)/documents';
(async () => {
  const on = process.argv[2] === 'on';
  const c = await init();
  const body = { fields: { enabled: { booleanValue: on }, maxPerRun: { integerValue: '5' }, dailyCapWon: { integerValue: '50000' }, updatedBy: { stringValue: 'claude-deploy-1024' }, updatedAt: { timestampValue: new Date().toISOString() } } };
  const r = await c.request({ method: 'PATCH', path: `${BASE}/config/portoneAutoGrant`, body });
  const f = r.body.fields || {};
  console.log('enabled', f.enabled?.booleanValue, 'maxPerRun', f.maxPerRun?.integerValue, 'dailyCapWon', f.dailyCapWon?.integerValue);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
