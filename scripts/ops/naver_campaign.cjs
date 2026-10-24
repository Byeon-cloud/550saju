/* 네이버 검색광고 캠페인 켜고 끄기 (2026-10-25) — node scripts/ops/naver_campaign.cjs off|on|status
 *   off: 모든 캠페인 userLock=true(멈춤, 지우지 않음. 묶음, 키워드, 소재는 그대로 남는다), on: 다시 켬, status: 상태만 본다.
 *   켜는 것(on)은 돈을 다시 쓰는 일이라 오너 확인 뒤에만. 키는 .secrets/naver_searchad.json(화면에 찍지 않음). */
const { call } = require('../ads/naverApi.cjs');
(async () => {
  const cmd = process.argv[2] || 'status';
  if (!['on', 'off', 'status'].includes(cmd)) { console.log('사용: node scripts/ops/naver_campaign.cjs off|on|status'); process.exit(1); }
  const camps = await call('GET', '/ncc/campaigns');
  for (const c of camps) {
    if (cmd === 'status') { console.log(c.name, c.status, c.statusReason || '', 'userLock', c.userLock, '하루 예산', c.dailyBudget); continue; }
    const r = await call('PUT', `/ncc/campaigns/${c.nccCampaignId}`, { query: { fields: 'userLock' }, body: { nccCampaignId: c.nccCampaignId, userLock: cmd === 'off' } });
    console.log(r.name, '→', r.status, r.statusReason || '', 'userLock', r.userLock);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
