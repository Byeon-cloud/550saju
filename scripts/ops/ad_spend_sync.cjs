/* 광고비 장부(adSpend) 채우기 (2026-10-24) — 관리자 '전략 성과' 판(functions/src/admin/strategy.ts)이 읽는다.
 *   node scripts/ops/ad_spend_sync.cjs naver [시작일] [끝일]      네이버 검색광고 API: 날마다 지출(salesAmt), 노출, 클릭, 광고 그룹별 지출
 *   node scripts/ops/ad_spend_sync.cjs set 채널 날짜 금액 [메모]     메타, 토스애즈처럼 광고 관리자 화면에서 본 하루 지출을 직접 넣기
 *   기본 기간은 7일 전부터 오늘(한국)까지. 오늘 값은 하루가 끝나기 전이라 다음 실행 때 다시 고쳐진다(같은 문서를 덮어쓴다).
 *   문서 이름은 {날짜}_{채널}. 관리자 화면에서 넣은 값과 같은 문서라 마지막에 넣은 값이 남는다. */
const { patchDoc, getDoc } = require('./fs_write.cjs');

const kst = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => kst(Date.parse(`${d}T12:00:00+09:00`) + n * 864e5);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

async function naver(from, to) {
  const { call } = require('../ads/naverApi.cjs');
  const camps = await call('GET', '/ncc/campaigns');
  const groups = [];
  for (const c of camps) groups.push(...(await call('GET', '/ncc/adgroups', { query: { nccCampaignId: c.nccCampaignId } })));
  if (!groups.length) { console.log('네이버 광고 그룹이 없어요'); return; }
  const today = kst();
  const nameOf = new Map(groups.map((g) => [g.nccAdgroupId, g.name]));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    // 그날 돈을 쓴 묶음 번호를 장부에 남겨 두고 다시 물을 때 더한다. 지금 목록만 물으면 지운 묶음의 지출이 지난 날에서 빠진다
    const prev = await getDoc(`adSpend/${d}_naver`);
    const ids = [...new Set([...groups.map((g) => g.nccAdgroupId), ...Object.keys(prev?.groupIds || {})])];
    const r = await call('GET', '/stats', {
      query: { ids: ids.join(','), fields: JSON.stringify(['impCnt', 'clkCnt', 'salesAmt']), timeRange: JSON.stringify({ since: d, until: d }) },
    });
    const by = new Map((r.data || []).map((x) => [x.id, x]));
    let amount = 0; let imp = 0; let clk = 0; const perGroup = {}; const groupIds = {};
    for (const id of ids) {
      const s = by.get(id) || {};
      amount += Number(s.salesAmt) || 0; imp += Number(s.impCnt) || 0; clk += Number(s.clkCnt) || 0;
      if (Number(s.salesAmt) > 0) {
        groupIds[id] = Math.round(Number(s.salesAmt));
        perGroup[nameOf.get(id) || prev?.groupIdNames?.[id] || id] = Math.round(Number(s.salesAmt));
      }
    }
    amount = Math.round(amount);
    if (!amount && !imp) { console.log(`${d} 네이버 지출 없음 (장부에 쓰지 않음)`); continue; }
    // 지난 날 값이 크게 줄면(묶음을 지워 API 가 못 돌려주는 경우 등) 덮어쓰지 않는다. --force 로만 덮는다
    if (prev && prev.source === 'naver_api' && d < today && amount < (Number(prev.amount) || 0) * 0.95 && !process.argv.includes('--force')) {
      console.log(`${d} 네이버 ${amount}원이 장부 ${prev.amount}원보다 적어 그대로 둠(--force 로 덮어쓰기)`);
      continue;
    }
    const groupIdNames = Object.fromEntries(Object.keys(groupIds).map((id) => [id, nameOf.get(id) || prev?.groupIdNames?.[id] || id]));
    await patchDoc(`adSpend/${d}_naver`, {
      day: d, channel: 'naver', amount, imp, clk, groups: perGroup, groupIds, groupIdNames, source: 'naver_api',
      note: d === today ? '오늘, 진행 중' : '', updatedAt: new Date(),
    });
    console.log(`${d} 네이버 ${amount.toLocaleString('ko-KR')}원, 노출 ${imp}, 클릭 ${clk}`);
  }
}

async function setOne(channel, day, amount, note) {
  if (!/^[a-z0-9_]{2,24}$/.test(channel)) throw new Error('채널은 영어 소문자, 숫자, 밑줄(예: meta, tossads)');
  if (!DAY_RE.test(day) || day > kst()) throw new Error('날짜는 오늘이나 그 전, YYYY-MM-DD');
  const won = Math.round(Number(String(amount).replace(/[^\d.]/g, '')));
  if (!(won >= 0) || won > 10_000_000) throw new Error('금액은 0원부터 1,000만 원까지');
  await patchDoc(`adSpend/${day}_${channel}`, { day, channel, amount: won, source: 'manual', note: note || '', updatedAt: new Date() });
  console.log(`${day} ${channel} ${won.toLocaleString('ko-KR')}원 넣음`);
}

(async () => {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  if (cmd === 'naver') {
    const to = b && DAY_RE.test(b) ? b : kst();
    const from = a && DAY_RE.test(a) ? a : addDays(to, -7);
    await naver(from, to);
  } else if (cmd === 'set') {
    await setOne(String(a || '').toLowerCase(), b, c, d);
  } else {
    console.log('사용: node scripts/ops/ad_spend_sync.cjs naver [시작일] [끝일]\n      node scripts/ops/ad_spend_sync.cjs set meta 2026-10-24 7215 [메모]');
    process.exit(1);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
