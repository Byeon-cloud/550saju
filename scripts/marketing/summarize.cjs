/* 검색 수요 원자료 요약 (2026-10-20)
 *   docs/marketing/data 의 가장 최근 naver_keywords, naver_trend, google_trends 파일을 읽어
 *   docs/marketing/data/README.md 와 search_summary_YYYYMMDD.json(성과판 대시보드용 핵심 숫자)을 만든다.
 *   숫자는 전부 파일에서 계산한다. README 를 손으로 고치면 다음 실행 때 덮어쓴다.
 *
 *   실행: node scripts/marketing/summarize.cjs
 */
const fs = require('fs');
const path = require('path');
const { OUT_DIR, latest, writeJson, stamp } = require('./_util.cjs');

const fmt = (n) => (n == null ? '' : Number(n).toLocaleString('ko-KR'));
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '');
const read = (p) => (p ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
const base = (p) => (p ? path.basename(p) : '(없음)');

const kwPath = latest('naver_keywords_');
const trPath = latest('naver_trend_');
const gtPath = latest('google_trends_');
const kw = read(kwPath);
const tr = read(trPath);
const gt = read(gtPath);
if (!kw) { console.error('naver_keywords 파일이 없다. 먼저 node scripts/marketing/naver_keywords.cjs'); process.exit(1); }

/* ---------- 1. 묶음별 합 ---------- */
const catRows = kw.categories.map((c) => {
  const top = kw.hints.filter((h) => h.category === c.id).sort((a, b) => b.total - a.total)[0];
  return { ...c, top: top ? top.keyword : '' };
});
const sumAll = catRows.filter((c) => c.id !== 'rival');

/* ---------- 2. 검색량 상위 30 (경쟁 묶음 제외 힌트) ---------- */
const top30 = kw.hints.filter((h) => h.category !== 'rival' && !h.noData).sort((a, b) => b.total - a.total).slice(0, 30);
const bidCell = (b, p) => (b && b[p] != null ? fmt(b[p]) : '');

/* ---------- 4. 시즌 곡선 ---------- */
/* series: [{date:'YYYY-MM-DD', v:number}] 주 단위. 시즌 Y = Y-08-01 ~ (Y+1)-04-30.
 *   평소 값  = 그 시즌 8~9월 값의 중앙값(자료가 없으면 다음 해 8~9월)
 *   기준선 r = 평소 값 + (정점 - 평소 값) x r
 *   오르기 시작 = 10% 기준선 이상이 정점까지 이어지는 첫 주(한 주 빠지는 것은 봐줌, 두 주 연속 빠지면 끊김)
 *   크게 오름   = 같은 방식, 25% 기준선
 *   정점        = 시즌 안 가장 큰 값의 첫 주
 *   내려옴      = 정점 뒤 처음으로 두 주 연속 25% 기준선 아래가 된 첫 주
 *   평소로      = 정점 뒤 시즌 끝(4월 30일)까지 계속 10% 기준선 아래인 첫 주
 *   진행 중인 시즌(자료 끝이 4월 30일 전)은 판정하지 않고 마지막 주 값과 지난해 같은 주 값만 남긴다. */
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function seasonCurves(series) {
  if (!series.length) return [];
  const first = series[0].date;
  const last = series[series.length - 1].date;
  const years = [...new Set(series.map((p) => Number(p.date.slice(0, 4))))];
  const augSep = (y) => series.filter((p) => p.date >= `${y}-08-01` && p.date <= `${y}-09-30`).map((p) => p.v);
  const valueNear = (date) => {
    const t = Date.parse(date);
    let best = null;
    for (const p of series) { const d = Math.abs(Date.parse(p.date) - t); if (!best || d < best.d) best = { d, p }; }
    return best && best.d <= 4 * 86400e3 ? best.p : null;
  };
  const out = [];
  for (const y of [years[0] - 1, ...years]) {
    const from = `${y}-08-01`;
    const to = `${y + 1}-04-30`;
    const win = series.filter((p) => p.date >= from && p.date <= to);
    if (!win.length) continue;
    const startCut = first > from;
    const endCut = last < to;
    const lastPt = win[win.length - 1];
    if (endCut) {
      const ly = valueNear(new Date(Date.parse(lastPt.date) - 364 * 86400e3).toISOString().slice(0, 10));
      out.push({ season: `${y}~${y + 1}`, from, to, inProgress: true, latest: { date: lastPt.date, v: lastPt.v }, sameWeekLastYear: ly ? { date: ly.date, v: ly.v } : null });
      continue;
    }
    let pi = 0;
    win.forEach((p, i) => { if (p.v > win[pi].v) pi = i; });
    const peak = win[pi];
    const baseVals = augSep(y).length ? augSep(y) : augSep(y + 1);
    const baseline = median(baseVals) ?? 0;
    const res = { season: `${y}~${y + 1}`, from, to, baseline, peak: peak.date, peakValue: peak.v, startCut };
    if (!(peak.v > baseline)) { out.push({ ...res, note: '정점이 평소 값보다 크지 않음' }); continue; }
    const line = (r) => baseline + (peak.v - baseline) * r;
    const riseFrom = (r) => {
      const thr = line(r);
      let start = pi; let dips = 0; let broke = false;
      for (let j = pi - 1; j >= 0; j--) {
        if (win[j].v >= thr) { start = j; dips = 0; } else if (++dips >= 2) { broke = true; break; }
      }
      return !broke && startCut ? null : win[start].date;
    };
    res.rise10 = riseFrom(0.1);
    res.rise25 = riseFrom(0.25);
    const t25 = line(0.25);
    const after = win.slice(pi + 1);
    const fi = after.findIndex((p, i) => p.v < t25 && (i + 1 >= after.length || after[i + 1].v < t25));
    res.fall25 = fi >= 0 ? after[fi].date : null;
    const t10 = line(0.1);
    let back = null;
    for (let k = win.length - 1; k > pi; k--) { if (win[k].v < t10) back = win[k].date; else break; }
    res.back10 = back;
    out.push(res);
  }
  return out;
}

let seasonSource = null;
const seasonByKeyword = {};
if (tr && tr.status === 'ok' && Array.isArray(tr.requests)) {
  const r = tr.requests.find((x) => x.set === 'more' && x.segment === 'all');
  if (r) {
    seasonSource = `네이버 데이터랩 (${base(trPath)}, 묶음 more, 전체)`;
    for (const g of r.results) seasonByKeyword[g.title] = seasonCurves(g.data.map((d) => ({ date: d.period, v: d.ratio })));
  }
}
if (!seasonSource && gt && gt.sets) {
  const s = gt.sets.find((x) => x.set === 'season');
  if (s) {
    seasonSource = `구글 트렌드 (${base(gtPath)}, 묶음 season: ${s.keywords.join(', ')})`;
    for (const k of s.keywords) seasonByKeyword[k] = seasonCurves(s.timeline.map((p) => ({ date: p.date, v: p.values[k] })));
  }
}

/* ---------- README ---------- */
const L = [];
const P = (s = '') => L.push(s);
const collected = kw.meta.collectedDateKst;
P('# 검색 수요 원자료');
P();
P(`마케팅 판단용으로 모은 검색 수요 원자료다. 이 문서는 \`node scripts/marketing/summarize.cjs\` 가 파일을 읽어 만든다(숫자는 전부 파일에서 계산, 손으로 고치면 다음 실행 때 덮어쓴다). 마지막 요약: ${collected} 수집분.`);
P();
P('## 파일');
P();
P('| 파일 | 뜻 |');
P('|---|---|');
P(`| \`${base(kwPath)}\` | 네이버 검색광고 키워드 도구. 우리 키워드(힌트) ${fmt(kw.meta.counts.hints)}개의 월간 검색수(PC, 모바일), 월평균 클릭수, 클릭률, 노출 광고 수, 경쟁정도. 묶음별 연관 키워드(검색량 상위 30, 운세 말 상위 30), 새로 노릴 후보 20, 모바일 1~5위 예상 입찰가 ${fmt(kw.meta.counts.bids)}개. |`);
P(`| \`${base(kwPath).replace('.json', '.csv')}\` | 위 JSON 의 힌트와 연관 키워드를 한 표로. UTF-8 BOM 이라 엑셀에서 바로 열린다. |`);
P(`| \`${base(trPath)}\` | 네이버 데이터랩 검색어 트렌드(2023-01-01~, 주 단위, 대표 그룹, 나이대, 성별). 상태: **${tr ? tr.status : '파일 없음'}** |`);
P(`| \`${base(gtPath)}\` | 구글 트렌드(한국, 2023-01-01~, 주 단위, 5개씩 비교). 상태: **${gt ? gt.status : '파일 없음'}** |`);
P(`| \`search_summary_YYYYMMDD.json\` | 아래 핵심 숫자만 모은 것(성과판 대시보드용). |`);
P();
P('## 다시 돌리기');
P();
P('```');
P('node scripts/marketing/naver_keywords.cjs   # 1~2분. 네이버 검색광고 API, 읽기만(캠페인, 입찰 안 바꿈)');
P('node scripts/marketing/naver_datalab.cjs    # 네이버 앱에 데이터랩 API 가 켜진 뒤');
P('node scripts/marketing/google_trends.cjs    # 막히면(429) 하루 뒤 다시. 반복해서 두드리지 않는다');
P('node scripts/marketing/summarize.cjs        # 이 문서와 search_summary 다시 만들기');
P('```');
P();
P('키워드 목록과 묶음, 트렌드 대표 그룹, 운세 말 판정 규칙은 `scripts/marketing/keywords.cjs` 에 있다. 파일 이름의 날짜는 한국 시각 수집일이다. 같은 날 다시 돌리면 덮어쓴다.');
P();
P('## 데이터 한계');
P();
P('- **키워드 도구는 최근 30일 기준 월간 값이다.** 이번 값은 10월 중순 기준이라 신년운세, 토정비결, 수능처럼 철이 있는 말은 정점(12월 말~1월 초)보다 훨씬 작게 잡혀 있다. 시즌 크기는 4번 곡선으로 따로 본다.');
P("- 검색수가 '< 10' 이면 5 로 바꿔 더했다. 묶음 합은 키워드끼리 겹치는 사람(예: '오늘의운세'와 '띠별운세'를 둘 다 친 사람)을 빼지 못한 단순 합이다.");
P('- 경쟁정도(낮음, 중간, 높음)는 광고 입찰 경쟁이지 검색 결과 경쟁이 아니다. 예상 입찰가는 네이버 추정치라 실제 낙찰가와 다를 수 있다. 70원으로 나온 칸은 최저 입찰가 수준이다.');
P('- 데이터랩 값은 요청 하나 안에서 기간 중 최대값을 100 으로 둔 상대값이다. 나이대, 성별은 요청마다 따로 100 이라 크기를 서로 비교하면 안 되고 곡선 모양만 비교한다.');
P('- 구글 트렌드도 상대값이고 표본 추출이라 다시 받으면 조금씩 다르다. 한국은 네이버 검색 비중이 커서 구글 표본이 작고, 작은 말은 0 이 많다.');
P('- 연관 키워드의 운세 말 판정과 후보 20 은 규칙으로 고른 것이라 운세를 찾는 말이 아닌 것도 섞일 수 있다(예: 퇴사, 동지, 오행팔찌 같은 말).');
P('- 같은 연관 키워드가 여러 묶음에서 나오면 묶음마다 한 줄씩 들어간다(CSV 와 JSON related). 연관 키워드 검색량을 더할 때는 키워드로 한 번만 센다.');
P();
P('## 이번 수집 결과');
P();
P(`- 네이버 키워드 도구: **성공** (${collected}). 힌트 ${fmt(kw.meta.counts.hints)}개(데이터 없음 ${fmt(kw.hints.filter((h) => h.noData).length)}), 연관 ${fmt(kw.meta.counts.related)}행, 후보 ${fmt(kw.meta.counts.candidates)}개, 입찰가 ${fmt(kw.bids.keywords.filter((b) => b.bids).length)}/${fmt(kw.bids.keywords.length)}개, 오류 ${fmt(kw.errors.length)}건.`);
if (tr) {
  if (tr.status === 'blocked') {
    const e = tr.error || {};
    P(`- 네이버 데이터랩: **막힘**. ${typeof e === 'object' ? `HTTP ${e.http || '?'}, errorCode ${e.errorCode || '-'}, "${e.errorMessage || ''}"` : e}. ${tr.reason || ''}.`);
    P(`  - 할 일: ${tr.ownerAction || '자격 증명 확인'}`);
  } else {
    P(`- 네이버 데이터랩: **${tr.status}** (요청 ${fmt((tr.requests || []).length)}번, 성공 ${fmt((tr.requests || []).filter((r) => !r.error).length)}번).`);
  }
} else P('- 네이버 데이터랩: 파일 없음(아직 안 돌림).');
if (gt) P(`- 구글 트렌드: **${gt.status === 'ok' ? '성공' : gt.status === 'blocked' ? '막힘' : gt.status}**. 묶음 ${gt.sets.length}개(${gt.sets.map((s) => `${s.set}: ${s.keywords.join(', ')}`).join(' / ')}), 주 ${fmt(gt.sets[0] ? gt.sets[0].timeline.length : 0)}개 지점.`);
else P('- 구글 트렌드: 파일 없음.');
P();

P('## 1. 묶음별 월간 검색량 합 (네이버, 최근 30일)');
P();
P('| 묶음 | 키워드 수 | 모바일 | PC | 합 | 모바일 비중 | 가장 큰 키워드 |');
P('|---|---:|---:|---:|---:|---:|---|');
for (const c of catRows) P(`| ${c.name} | ${c.uniqueKeywords} | ${fmt(c.sumMobile)} | ${fmt(c.sumPc)} | ${fmt(c.sumTotal)} | ${pct(c.sumMobile, c.sumTotal)} | ${c.top} |`);
const tm = sumAll.reduce((s, c) => s + c.sumMobile, 0);
const tp = sumAll.reduce((s, c) => s + c.sumPc, 0);
P(`| 경쟁 뺀 합 | ${sumAll.reduce((s, c) => s + c.uniqueKeywords, 0)} | ${fmt(tm)} | ${fmt(tp)} | ${fmt(tm + tp)} | ${pct(tm, tm + tp)} | |`);
P();
P('키워드 수는 공백을 뺀 고유 키워드 수다. 오늘운세 묶음은 \'오늘의운세\' 한 말이 대부분을 차지한다(2번 표).');
P();

P('## 2. 검색량 상위 30 (경쟁 묶음 제외, 우리 키워드)');
P();
P('| # | 키워드 | 묶음 | 모바일 | PC | 경쟁정도 | 노출 광고 수 | 모바일 입찰 1위 | 2위 | 3위 | 4위 | 5위 |');
P('|---:|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|');
top30.forEach((h, i) => P(`| ${i + 1} | ${h.keyword} | ${h.categoryName} | ${fmt(h.mobile)} | ${fmt(h.pc)} | ${h.compIdx} | ${h.plAvgDepth} | ${bidCell(h.mobileBid, 1)} | ${bidCell(h.mobileBid, 2)} | ${bidCell(h.mobileBid, 3)} | ${bidCell(h.mobileBid, 4)} | ${bidCell(h.mobileBid, 5)} |`));
P();
P('입찰가 단위는 원(네이버 추정 평균 입찰가, 모바일).');
P();

const cand = kw.candidates || [];
const nLow = cand.filter((c) => c.compIdx === '낮음').length;
P('## 3. 검색량은 큰데 경쟁이 낮은 후보 20');
P();
P(`고른 방법: 경쟁, 브랜드 묶음을 빼고 우리 키워드와 운세 관련 연관 키워드 중 월간 검색수(모바일+PC) 100 이상인 것에서 경쟁정도 '낮음'을 검색량 순으로 먼저, 모자라면 '중간'으로 채웠다. 이번에는 '낮음'이 ${nLow}개뿐이라 나머지 ${cand.length - nLow}개는 '중간'이다.`);
P();
P('| # | 키워드 | 출처 | 묶음 | 모바일 | PC | 경쟁정도 | 노출 광고 수 | 모바일 입찰 1위 | 3위 | 5위 |');
P('|---:|---|---|---|---:|---:|---|---:|---:|---:|---:|');
cand.forEach((c, i) => P(`| ${i + 1} | ${c.keyword} | ${c.kind === 'hint' ? '우리 목록' : '연관'} | ${c.categoryName} | ${fmt(c.mobile)} | ${fmt(c.pc)} | ${c.compIdx} | ${c.plAvgDepth} | ${bidCell(c.mobileBid, 1)} | ${bidCell(c.mobileBid, 3)} | ${bidCell(c.mobileBid, 5)} |`));
P();

P('## 4. 신년 계열 시즌 곡선 (주 단위)');
P();
if (seasonSource) {
  P(`자료: ${seasonSource}. ${seasonSource.startsWith('구글') ? '네이버 데이터랩이 막혀 있어 구글 값으로 계산했다. 데이터랩이 켜지면 같은 명령으로 네이버 값으로 바뀐다.' : ''}`);
  P();
  P('정한 규칙: 시즌은 8월 1일~다음 해 4월 30일. 평소 값 = 그 시즌 8~9월 값의 중앙값, 기준선 = 평소 값 + (정점 - 평소 값) x 10% 또는 25%. **오르기 시작** = 10% 기준선 이상이 정점까지 이어지는 첫 주(한 주 빠지는 것은 봐주고 두 주 연속 빠지면 끊김), **크게 오름** = 같은 방식 25%, **정점** = 시즌 최대값 주, **내려옴** = 정점 뒤 처음 두 주 연속 25% 기준선 아래가 된 첫 주, **평소로** = 정점 뒤 시즌 끝까지 계속 10% 기준선 아래인 첫 주. 날짜는 그 주의 시작일(구글은 일요일 시작). 값은 상대값(100 = 이 묶음 전체 기간 최대).');
  P();
  for (const [k, list] of Object.entries(seasonByKeyword)) {
    P(`**${k}**`);
    P();
    P('| 시즌 | 평소 값 | 오르기 시작(10%) | 크게 오름(25%) | 정점 (값) | 내려옴(25%) | 평소로(10%) | 비고 |');
    P('|---|---:|---|---|---|---|---|---|');
    for (const s of list) {
      if (s.inProgress) {
        P(`| ${s.season} | | | | | | | 진행 중. 마지막 주 ${s.latest.date} 값 ${s.latest.v}${s.sameWeekLastYear ? `, 지난해 같은 주 ${s.sameWeekLastYear.date} 값 ${s.sameWeekLastYear.v}` : ''} |`);
        continue;
      }
      const note = [s.startCut ? '자료가 2023-01-01 부터라 오르는 구간 없음' : '', s.note || ''].filter(Boolean).join(', ');
      P(`| ${s.season} | ${s.baseline} | ${s.rise10 || '-'} | ${s.rise25 || '-'} | ${s.peak} (${s.peakValue}) | ${s.fall25 || '-'} | ${s.back10 || '-'} | ${note} |`);
    }
    P();
  }
} else {
  P('시즌 곡선을 낼 트렌드 자료가 없다(데이터랩과 구글 모두 실패).');
  P();
}

P('## 5. 경쟁 서비스 이름 검색량 (참고, 네이버 최근 30일)');
P();
P('| 키워드 | 모바일 | PC | 경쟁정도 |');
P('|---|---:|---:|---|');
for (const h of kw.hints.filter((x) => x.category === 'rival').sort((a, b) => b.total - a.total)) P(`| ${h.keyword} | ${fmt(h.mobile)} | ${fmt(h.pc)} | ${h.compIdx} |`);
P();
const brand = kw.hints.filter((x) => x.category === 'brand').sort((a, b) => b.total - a.total);
P(`우리 이름: ${brand.map((h) => `${h.keyword} ${h.mobileLt10 ? '10 미만' : fmt(h.mobile)}(모바일)`).join(', ')}.`);
P();

if (gt && gt.sets && gt.sets.length) {
  P('## 6. 구글 트렌드 기간 평균 (참고, 상대값)');
  P();
  for (const s of gt.sets) if (s.averages) P(`- ${s.set}: ${Object.entries(s.averages).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  P();
  P('같은 묶음 안에서만 비교한다. 구글 기준 기간 평균이라 네이버 검색량 순서와 다를 수 있다.');
  P();
}

fs.writeFileSync(path.join(OUT_DIR, 'README.md'), L.join('\n'), 'utf8');

/* ---------- 대시보드용 요약 ---------- */
const summary = {
  meta: { builtAt: new Date().toISOString(), from: { naverKeywords: base(kwPath), naverTrend: base(trPath), googleTrends: base(gtPath) }, collectedDateKst: collected },
  status: { naverKeywords: 'ok', naverTrend: tr ? tr.status : 'missing', googleTrends: gt ? gt.status : 'missing', naverTrendOwnerAction: tr && tr.ownerAction ? tr.ownerAction : null },
  categories: catRows.map((c) => ({ id: c.id, name: c.name, keywords: c.uniqueKeywords, mobile: c.sumMobile, pc: c.sumPc, total: c.sumTotal, top: c.top })),
  top30: top30.map((h) => ({ keyword: h.keyword, category: h.categoryName, mobile: h.mobile, pc: h.pc, compIdx: h.compIdx, plAvgDepth: h.plAvgDepth, mobileBid: h.mobileBid || null })),
  candidates: cand,
  season: { source: seasonSource, rule: '오르기 시작=정점 10% 이상 연속 첫 주, 크게 오름=25%, 내려옴=정점 뒤 25% 아래 첫 주, 평소로=시즌 끝까지 10% 아래 첫 주', byKeyword: seasonByKeyword },
};
const sp = writeJson(`search_summary_${stamp()}.json`, summary);
console.log(`README: ${path.join(OUT_DIR, 'README.md')}\n요약: ${sp}`);
