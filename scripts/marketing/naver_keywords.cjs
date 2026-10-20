/* 네이버 검색광고 키워드 도구 수집기 (2026-10-20)
 *
 *   하는 일
 *   1) keywords.cjs 의 키워드를 공백 빼고 5개씩 GET /keywordstool?hintKeywords=...&showDetail=1 로 보낸다.
 *      힌트 키워드 자체의 행은 전부, 연관 키워드는 묶음별 검색량(모바일+PC) 상위 30개까지 저장(새 키워드 발굴용).
 *   2) 주요 키워드(경쟁 묶음 제외) 40개 안팎의 모바일 1~5위 예상 입찰가를
 *      POST /estimate/average-position-bid/keyword 로 받는다.
 *   3) docs/marketing/data/naver_keywords_YYYYMMDD.json, 같은 이름 .csv(UTF-8 BOM) 로 저장.
 *
 *   값 규칙: 검색수가 '< 10' 문자열이면 5 로 바꾸고 pcLt10/mobileLt10 표시를 남긴다.
 *   키는 scripts/ads/naverApi.cjs 가 .secrets/naver_searchad.json 에서 읽는다(화면에 찍지 않음).
 *   읽기만 한다. 캠페인, 키워드, 입찰은 바꾸지 않는다.
 *
 *   실행: node scripts/marketing/naver_keywords.cjs
 */
const { call } = require('../ads/naverApi.cjs');
const { CATEGORIES, normalize, uniqueHints, checkOverlap, isFortuneIntent } = require('./keywords.cjs');
const { pause, sleep, stamp, kstDate, writeJson, writeCsv } = require('./_util.cjs');

const RELATED_PER_CATEGORY = 30;
const BID_TARGET = 40;
const BID_POSITIONS = [1, 2, 3, 4, 5];

const toNum = (v) => {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  if (String(v).includes('<')) return 5;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const isLt10 = (v) => typeof v === 'string' && v.includes('<');

function toRow(k) {
  const pc = toNum(k.monthlyPcQcCnt);
  const mobile = toNum(k.monthlyMobileQcCnt);
  return {
    keyword: k.relKeyword,
    pc, mobile, total: pc + mobile,
    pcLt10: isLt10(k.monthlyPcQcCnt), mobileLt10: isLt10(k.monthlyMobileQcCnt),
    pcClk: toNum(k.monthlyAvePcClkCnt), mobileClk: toNum(k.monthlyAveMobileClkCnt),
    pcCtr: toNum(k.monthlyAvePcCtr), mobileCtr: toNum(k.monthlyAveMobileCtr),
    plAvgDepth: toNum(k.plAvgDepth), compIdx: k.compIdx || '',
  };
}

/* 429, 5xx 는 2초, 4초, 6초 쉬고 세 번까지 다시. 그 밖의 오류는 바로 던진다 */
async function callRetry(method, uri, opts) {
  for (let i = 0; ; i++) {
    try { return await call(method, uri, opts); } catch (e) {
      const retryable = e.status === 429 || (e.status >= 500 && e.status < 600) || !e.status;
      if (!retryable || i >= 3) throw e;
      console.log(`  다시 시도 ${i + 1} (${e.status || '네트워크'})`);
      await sleep(2000 * (i + 1));
    }
  }
}

async function keywordTool(sends) {
  const r = await callRetry('GET', '/keywordstool', { query: { hintKeywords: sends.join(','), showDetail: '1' } });
  return (r && r.keywordList) || [];
}

async function main() {
  const started = new Date();
  const overlap = checkOverlap();
  if (overlap.length) console.log(`주의: 묶음 겹침 ${overlap.length}건 (합이 겹칠 수 있음)`);
  const hints = uniqueHints();
  const hintKeys = new Set(hints.map((h) => h.key));
  const catName = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));
  const errors = [];

  /* 힌트 행, 묶음별 연관 후보 */
  const hintRows = new Map(); // key → row
  const relatedByCat = new Map(CATEGORIES.map((c) => [c.id, new Map()])); // catId → key → {row, from:Set}

  /* 연관 키워드를 어느 묶음에서 찾았는지 섞이지 않게 묶음 안에서만 5개씩 나눈다 */
  const batches = [];
  for (const c of CATEGORIES) {
    const inCat = hints.filter((h) => h.categories[0] === c.id);
    for (let i = 0; i < inCat.length; i += 5) batches.push(inCat.slice(i, i + 5));
  }
  console.log(`키워드 도구: 힌트 ${hints.length}개, 요청 ${batches.length}번`);

  const absorb = (list, batch) => {
    for (const k of list) {
      const key = normalize(k.relKeyword);
      if (hintKeys.has(key)) {
        if (!hintRows.has(key)) hintRows.set(key, toRow(k));
        continue;
      }
      for (const h of batch) {
        for (const cid of h.categories) {
          const m = relatedByCat.get(cid);
          if (!m.has(key)) m.set(key, { row: toRow(k), from: new Set() });
          m.get(key).from.add(h.originals[0]);
        }
      }
    }
  };

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    try {
      absorb(await keywordTool(batch.map((h) => h.send)), batch);
    } catch (e) {
      /* 묶음 하나가 400 이면 어느 키워드 때문인지 하나씩 다시 보낸다 */
      console.log(`  요청 ${b + 1} 실패(${e.status}), 하나씩 다시`);
      for (const h of batch) {
        await pause();
        try { absorb(await keywordTool([h.send]), [h]); } catch (e2) {
          errors.push({ step: 'keywordstool', keyword: h.send, status: e2.status, message: String(e2.message).slice(0, 200) });
        }
      }
    }
    if ((b + 1) % 10 === 0 || b === batches.length - 1) console.log(`  ${b + 1}/${batches.length}`);
    await pause();
  }

  /* 힌트 행 정리: 응답에 없던 힌트는 noData 로 남긴다 */
  const hintsOut = hints.map((h) => {
    const row = hintRows.get(h.key);
    return {
      kind: 'hint', category: h.categories[0], categoryName: catName[h.categories[0]], categories: h.categories,
      originals: h.originals, sent: h.send,
      ...(row || { keyword: h.send, pc: 0, mobile: 0, total: 0, pcLt10: false, mobileLt10: false, pcClk: 0, mobileClk: 0, pcCtr: 0, mobileCtr: 0, plAvgDepth: 0, compIdx: '' }),
      noData: !row,
    };
  });

  /* 연관 키워드: 묶음별 (가) 검색량 상위 30 과 (나) 운세를 찾는 말(isFortuneIntent) 중 검색량 상위 30 을 합쳐 저장.
   *   (가)만 두면 로또, 복권, 별자리 같은 말이 대부분이라 새 키워드 발굴에는 (나)를 본다. 행마다 두 표시를 남긴다. */
  const relatedOut = [];
  for (const c of CATEGORIES) {
    const all = [...relatedByCat.get(c.id).entries()].sort((a, b) => b[1].row.total - a[1].row.total);
    const byVol = new Set(all.slice(0, RELATED_PER_CATEGORY).map(([k]) => k));
    const byFortune = new Set(all.filter(([, v]) => isFortuneIntent(v.row.keyword)).slice(0, RELATED_PER_CATEGORY).map(([k]) => k));
    for (const [k, v] of all) {
      if (!byVol.has(k) && !byFortune.has(k)) continue;
      relatedOut.push({
        kind: 'related', category: c.id, categoryName: c.name, ...v.row,
        topByVolume: byVol.has(k), fortuneIntent: isFortuneIntent(v.row.keyword), topFortune: byFortune.has(k),
        foundBy: [...v.from].slice(0, 5),
      });
    }
  }

  /* 새로 노릴 후보: 경쟁, 브랜드 묶음 빼고, 힌트(우리가 고른 말)와 운세 관련 연관 키워드 중
   *   월간 검색수(모바일+PC) 100 이상, 경쟁정도 낮음 먼저, 다음 중간, 각각 검색량 순으로 20개. 높음은 넣지 않는다. */
  const COMP_RANK = { '낮음': 0, '중간': 1 };
  const seenCand = new Set();
  const candidates = [...hintsOut.filter((h) => !h.noData), ...relatedOut.filter((r) => r.fortuneIntent)]
    .filter((r) => r.category !== 'rival' && r.category !== 'brand' && r.total >= 100 && r.compIdx in COMP_RANK)
    .sort((a, b) => COMP_RANK[a.compIdx] - COMP_RANK[b.compIdx] || b.total - a.total)
    .filter((r) => { const k = normalize(r.keyword); if (seenCand.has(k)) return false; seenCand.add(k); return true; })
    .slice(0, 20)
    .map((r) => ({ keyword: r.keyword, kind: r.kind, category: r.category, categoryName: r.categoryName, mobile: r.mobile, pc: r.pc, total: r.total, compIdx: r.compIdx, plAvgDepth: r.plAvgDepth, mobileClk: r.mobileClk, mobileCtr: r.mobileCtr }));

  /* 입찰가 대상: 경쟁 묶음 빼고 검색량 상위 30 + 묶음마다 상위 2개 보장 + 검색량 순으로 40개까지 */
  const pool = hintsOut.filter((h) => h.category !== 'rival' && !h.noData && h.total > 0).sort((a, b) => b.total - a.total);
  const chosen = new Map();
  for (const h of pool.slice(0, 30)) chosen.set(normalize(h.keyword), h);
  for (const c of CATEGORIES) {
    if (c.id === 'rival') continue;
    const inCat = pool.filter((h) => h.category === c.id);
    let have = inCat.filter((h) => chosen.has(normalize(h.keyword))).length;
    for (const h of inCat) { if (have >= 2) break; if (!chosen.has(normalize(h.keyword))) { chosen.set(normalize(h.keyword), h); have++; } }
  }
  for (const h of pool) { if (chosen.size >= BID_TARGET) break; if (!chosen.has(normalize(h.keyword))) chosen.set(normalize(h.keyword), h); }
  const mainKeys = new Set(chosen.keys());
  /* 후보 20개 중 아직 없는 것도 입찰가를 받는다(purpose: candidate) */
  for (const r of candidates) if (!chosen.has(normalize(r.keyword))) chosen.set(normalize(r.keyword), r);
  const bidTargets = [...chosen.values()];
  console.log(`예상 입찰가: 주요 ${mainKeys.size}개 + 후보 ${bidTargets.length - mainKeys.size}개, ${BID_POSITIONS.length}순위`);

  const bidMap = new Map(); // key → {1:bid,...}
  const bidOne = async (list) => {
    const items = list.flatMap((h) => BID_POSITIONS.map((p) => ({ key: h.keyword, position: p })));
    const r = await callRetry('POST', '/estimate/average-position-bid/keyword', { body: { device: 'MOBILE', items } });
    for (const e of (r && r.estimate) || []) {
      const key = normalize(e.keyword);
      if (!bidMap.has(key)) bidMap.set(key, {});
      bidMap.get(key)[e.position] = e.bid;
    }
  };
  for (let i = 0; i < bidTargets.length; i += 10) {
    const part = bidTargets.slice(i, i + 10);
    try { await bidOne(part); } catch (e) {
      console.log(`  입찰가 묶음 실패(${e.status}), 하나씩 다시`);
      for (const h of part) {
        await pause();
        try { await bidOne([h]); } catch (e2) { errors.push({ step: 'estimate', keyword: h.keyword, status: e2.status, message: String(e2.message).slice(0, 200) }); }
      }
    }
    await pause();
  }
  const bids = bidTargets.map((h) => ({
    keyword: h.keyword, purpose: mainKeys.has(normalize(h.keyword)) ? 'main' : 'candidate',
    category: h.category, categoryName: h.categoryName, mobile: h.mobile, pc: h.pc, compIdx: h.compIdx,
    bids: bidMap.get(normalize(h.keyword)) || null,
  }));
  const bidOf = (kw) => bidMap.get(normalize(kw)) || null;
  for (const r of hintsOut) r.mobileBid = bidOf(r.keyword);
  for (const r of relatedOut) r.mobileBid = bidOf(r.keyword);
  for (const r of candidates) r.mobileBid = bidOf(r.keyword);

  /* 묶음별 합(힌트 키워드만, 공백 뺀 같은 키워드는 한 번) */
  const categories = CATEGORIES.map((c) => {
    const rows = hintsOut.filter((h) => h.category === c.id);
    return {
      id: c.id, name: c.name, desc: c.desc,
      expressions: c.keywords.length, uniqueKeywords: rows.length,
      withData: rows.filter((r) => !r.noData).length,
      sumMobile: rows.reduce((s, r) => s + r.mobile, 0),
      sumPc: rows.reduce((s, r) => s + r.pc, 0),
      sumTotal: rows.reduce((s, r) => s + r.total, 0),
      noDataKeywords: rows.filter((r) => r.noData).map((r) => r.sent),
    };
  });

  const date = stamp(started);
  const out = {
    meta: {
      source: '네이버 검색광고 API 키워드 도구(/keywordstool) + 순위별 평균 입찰가 추정(/estimate/average-position-bid/keyword)',
      collectedAt: started.toISOString(), collectedDateKst: kstDate(started),
      period: '키워드 도구 값은 조회 시점 기준 최근 30일 월간 조회수와 월평균 클릭수, 클릭률이다(네이버 기준).',
      notes: [
        "검색수가 '< 10' 이면 5 로 바꿔 더했다(pcLt10, mobileLt10 = true).",
        '키워드는 공백을 뺀 형태로 보냈고 네이버도 공백 없이 돌려준다. 영문은 대문자로 돌아온다.',
        '묶음별 합은 힌트 키워드만 더한 값(연관 키워드 제외).',
        '연관 키워드는 묶음별로 (가) 검색량 상위 30개(topByVolume)와 (나) 운세를 찾는 말 중 검색량 상위 30개(topFortune)를 합쳐 저장했다. 운세 말 판정은 keywords.cjs isFortuneIntent 규칙(별자리, 타로, 로또, 복권은 제외).',
        'candidates = 새로 노릴 후보 20개: 경쟁, 브랜드 묶음 제외, 힌트와 운세 관련 연관 키워드 중 월간 검색수 100 이상, 경쟁정도 낮음 먼저 다음 중간, 각각 검색량 순. 높음은 넣지 않았다.',
        'compIdx(경쟁정도)는 광고 입찰 경쟁(낮음, 중간, 높음)이다. plAvgDepth 는 월평균 노출 광고 수.',
        `입찰가는 네이버가 추정한 모바일 1~5위 평균 입찰가(원). 대상은 purpose main = 경쟁 묶음을 뺀 힌트 검색량 상위 30개와 묶음마다 상위 2개, 그리고 검색량 순으로 ${BID_TARGET}개 안팎, purpose candidate = 후보 20개 중 main 에 없는 것.`,
        'noData = true 는 키워드 도구가 그 키워드의 행을 돌려주지 않은 것(검색이 거의 없거나 등록 불가 표현).',
      ],
      counts: { expressions: CATEGORIES.reduce((s, c) => s + c.keywords.length, 0), hints: hintsOut.length, related: relatedOut.length, candidates: candidates.length, bids: bids.length, errors: errors.length },
    },
    categories,
    hints: hintsOut,
    related: relatedOut,
    candidates,
    bids: { device: 'MOBILE', positions: BID_POSITIONS, keywords: bids },
    errors,
  };
  const jp = writeJson(`naver_keywords_${date}.json`, out);

  const header = ['구분', '묶음', '키워드', '입력 표현', '월간검색수_PC', '월간검색수_모바일', '월간검색수_합', 'PC_10미만', '모바일_10미만',
    '월평균클릭_PC', '월평균클릭_모바일', '클릭률_PC(%)', '클릭률_모바일(%)', '월평균노출광고수', '경쟁정도',
    '모바일입찰_1위', '모바일입찰_2위', '모바일입찰_3위', '모바일입찰_4위', '모바일입찰_5위', '운세관련', '연관_검색량상위30', '연관_운세말상위30', '찾은 힌트', '데이터없음'];
  const catOrder = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));
  const sortRows = (a, b) => catOrder[a.category] - catOrder[b.category] || b.total - a.total;
  const toCsv = (r) => [
    r.kind === 'hint' ? '힌트' : '연관', r.categoryName, r.keyword, r.originals ? r.originals.join(' / ') : '',
    r.pc, r.mobile, r.total, r.pcLt10 ? 'Y' : '', r.mobileLt10 ? 'Y' : '',
    r.pcClk, r.mobileClk, r.pcCtr, r.mobileCtr, r.plAvgDepth, r.compIdx,
    ...BID_POSITIONS.map((p) => (r.mobileBid && r.mobileBid[p] != null ? r.mobileBid[p] : '')),
    r.kind === 'hint' || r.fortuneIntent ? 'Y' : '', r.topByVolume ? 'Y' : '', r.topFortune ? 'Y' : '',
    r.foundBy ? r.foundBy.join(' / ') : '', r.noData ? 'Y' : '',
  ];
  const cp = writeCsv(`naver_keywords_${date}.csv`, header, [...[...hintsOut].sort(sortRows), ...[...relatedOut].sort(sortRows)].map(toCsv));

  console.log(`저장: ${jp}\n저장: ${cp}`);
  console.log(`힌트 ${hintsOut.length}(데이터 없음 ${hintsOut.filter((h) => h.noData).length}), 연관 ${relatedOut.length}, 후보 ${candidates.length}, 입찰가 ${bids.filter((b) => b.bids).length}/${bids.length}, 오류 ${errors.length}`);
  for (const c of categories) console.log(`  ${c.name}\t모바일 ${c.sumMobile.toLocaleString()}\tPC ${c.sumPc.toLocaleString()}`);
}

main().catch((e) => { console.error('실패:', e.status || '', String(e.message).slice(0, 300)); process.exit(1); });
