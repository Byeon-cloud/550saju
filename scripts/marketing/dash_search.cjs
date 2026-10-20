/* 성과판 '검색 수요' 판 데이터 — 사용: node scripts/marketing/dash_search.cjs [출력 폴더=scratch/dash]
 *   docs/marketing/data 의 가장 최근 수집분(search_summary, google_trends)과 네이버 광고에 들어간 키워드 목록을 읽어
 *   search_groups.json(묶음별 월간 검색량), search_keywords.json(노릴 키워드 표), season.json(신년 계열 주별 곡선)을 만든다.
 *   검색 수요는 한 달에 한 번 다시 수집한다(scripts/marketing/README 없음, docs/marketing/data/README.md 참고). */
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '../../docs/marketing/data');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../../scratch/dash'));
fs.mkdirSync(OUT, { recursive: true });
const latest = (prefix) => fs.readdirSync(DATA).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).sort().at(-1);

(async () => {
  const sumFile = latest('search_summary_');
  const s = JSON.parse(fs.readFileSync(path.join(DATA, sumFile), 'utf8'));
  const collected = s.meta.collectedDateKst;

  // 네이버 광고에 들어간 키워드 (읽기만)
  let adKw = new Set();
  try {
    const { call } = require('../ads/naverApi.cjs');
    const camps = await call('GET', '/ncc/campaigns');
    for (const c of camps.filter((c) => /사주500/.test(c.name))) {
      for (const g of await call('GET', '/ncc/adgroups', { query: { nccCampaignId: c.nccCampaignId } })) {
        for (const k of await call('GET', '/ncc/keywords', { query: { nccAdgroupId: g.nccAdgroupId } })) adKw.add(k.keyword);
      }
    }
  } catch (e) { console.warn('네이버 광고 키워드를 못 읽음:', e.message); }

  const groups = s.categories.filter((c) => c.id !== 'brand').map((c) => ({ group: c.name, mobile: c.mobile, pc: c.pc, total: c.total, top: c.top, collected }));

  const seen = new Set(); const kws = [];
  const push = (k, kind) => {
    if (seen.has(k.keyword)) return; seen.add(k.keyword);
    const b = k.mobileBid || {};
    kws.push({ keyword: k.keyword, group: k.category && k.categoryName ? k.categoryName : k.category, kind,
      mobile: k.mobile, pc: k.pc, comp: k.compIdx, bid1: b['1'] ?? null, bid3: b['3'] ?? null, bid5: b['5'] ?? null,
      onAds: adKw.has(k.keyword) ? '광고 중' : '', collected });
  };
  s.top30.forEach((k) => push(k, '검색량 상위'));
  s.candidates.forEach((k) => push(k, '경쟁 낮음'));

  const g = JSON.parse(fs.readFileSync(path.join(DATA, latest('google_trends_')), 'utf8'));
  const set = g.sets.find((x) => x.set === 'season');
  const season = set.timeline.filter((t) => t.date >= '2023-08-01').map((t) => ({ week: t.date, sinnyeon: t.values['신년운세'], tojeong: t.values['토정비결'], samjae: t.values['삼재'], partial: t.isPartial ? 1 : 0 }));

  for (const [f, v] of [['search_groups.json', groups], ['search_keywords.json', kws], ['season.json', season]]) fs.writeFileSync(path.join(OUT, f), JSON.stringify(v));
  console.log(`저장 ${OUT}  수집일 ${collected}, 묶음 ${groups.length}, 키워드 ${kws.length}(광고 중 ${kws.filter((k) => k.onAds).length}), 시즌 주 ${season.length}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
