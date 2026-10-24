/* 시험 목록 올리기 (2026-10-24) — docs/marketing/experiments.json → Firestore mktExperiments/{E번호}
 *   관리자 '전략 성과' 판이 읽는다. 문서의 기본 칸만 바꾸고(updateMask), 관리자 화면에서 고친 edit 칸은 그대로 둔다.
 *   사용: node scripts/ops/experiments_sync.cjs   (JSON 을 고칠 때마다 다시 돌린다. 지운 시험은 Firestore 에서 지우지 않는다) */
const fs = require('fs');
const path = require('path');
const { patchDoc } = require('./fs_write.cjs');

const DAY = /\d{4}-\d{2}-\d{2}/;
(async () => {
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/marketing/experiments.json'), 'utf8'));
  let n = 0;
  for (const [i, x] of list.entries()) {
    if (!/^E\d{1,3}[a-z]?$/.test(String(x.id || ''))) { console.log('건너뜀(번호 없음)', x.name); continue; }
    const start = String(x.start || '');
    const doc = {
      name: String(x.name || ''), hypothesis: String(x.hypothesis || ''), channel: String(x.channel || ''), metricKey: String(x.metricKey || ''),
      // 시작과 끝은 날짜(YYYY-MM-DD)만 쓴다. 날짜가 없는 시작(예: '1.6.3 출시 뒤')은 글 그대로 두고 화면이 '시작 전'으로 본다
      start: (start.match(DAY) || [start])[0].slice(0, 40), end: (String(x.end || '').match(DAY) || [''])[0],
      status: String(x.status || ''), costNote: String(x.cost || ''), target: String(x.target || ''), next: String(x.next || ''), now: String(x.now || ''),
      order: i, syncedAt: new Date(),
    };
    await patchDoc(`mktExperiments/${x.id}`, doc, { mask: true });
    n += 1;
  }
  console.log(`시험 ${n}개 올림`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
