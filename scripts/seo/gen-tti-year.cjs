/* 띠별 신년운세 생성 (한 번 돌려 src/data/seo/tti-{연도}.json 에 남긴다) — 사용: node scripts/seo/gen-tti-year.cjs 2027
 *   근거와 문장 규칙은 functions/src/tti/ttiYear.ts. 먼저 functions 를 빌드(npm --prefix functions run build).
 *   키는 시크릿에서 읽기만 하고 찍지 않는다. 원가는 Sonnet 한 번(몇십 원). */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const year = Number(process.argv[2] || 2027);
(async () => {
  const out = execSync('npx firebase functions:secrets:access ANTHROPIC_API_KEY --project appintoss-saju', { cwd: path.join(__dirname, '../..'), stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const key = (out.split(/\r?\n/).find((l) => l.startsWith('sk-ant')) || '').trim();
  if (!key) { console.log('키 없음'); process.exit(1); }
  const { generateTtiYear, ttiYearFactsTable } = require('../../functions/lib/tti/ttiYear.js');
  console.log(ttiYearFactsTable(year).text.split('\n').slice(0, 12).join('\n'));
  const t0 = Date.now();
  const doc = await generateTtiYear(key, year);
  const file = path.join(__dirname, `../../src/data/seo/tti-${year}.json`);
  fs.writeFileSync(file, JSON.stringify({ ...doc, generatedAt: new Date().toISOString() }, null, 1));
  console.log('저장', file, Math.round((Date.now() - t0) / 1000) + 's');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
