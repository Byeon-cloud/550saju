/* 구글 트렌드 수집기 (2026-10-20)
 *
 *   공식 API 가 없어 웹 화면이 쓰는 비공식 엔드포인트를 그대로 부른다.
 *     1) https://trends.google.com/?geo=KR 로 쿠키(NID)를 받는다.
 *     2) /trends/api/explore?req=... 로 위젯 토큰을 받는다(응답 앞의 )]}' 를 떼고 JSON).
 *     3) TIMESERIES 위젯의 request, token 으로 /trends/api/widgetdata/multiline 을 부른다.
 *   한국(geo KR), 2023-01-01~오늘(주 단위로 돌아옴), 한 번에 키워드 5개 비교.
 *   429 나 차단이면 단계마다 두 번까지만 다시 시도하고 포기한다(무리하게 반복하지 않는다). 포기하면 status 'blocked'.
 *   값은 요청 안에서 기간 중 가장 높은 지점을 100 으로 둔 상대값이고, 구글 표본 추출이라 검색이 적은 말은 0 이 많다.
 *
 *   결과: docs/marketing/data/google_trends_YYYYMMDD.json
 *   실행: node scripts/marketing/google_trends.cjs
 */
const { sleep, stamp, kstDate, writeJson } = require('./_util.cjs');

const START = '2023-01-01';
const SETS = [
  { id: 'main', keywords: ['신년운세', '오늘의 운세', '사주', '궁합', '꿈해몽'] },
  { id: 'more', keywords: ['신년운세', '토정비결', '만세력', '재회', '띠별 운세'] },
  /* 시즌 곡선용: 큰 말(사주, 만세력)이 섞이면 신년운세가 0~10 사이로 뭉개져서 신년 계열끼리만 따로 받는다 */
  { id: 'season', keywords: ['신년운세', '토정비결', '삼재'] },
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const HL = 'ko';
const TZ = '-540';

let cookie = '';
function keepCookies(res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const jar = new Map(cookie ? cookie.split('; ').map((c) => c.split('=').length > 1 ? [c.split('=')[0], c] : [c, c]) : []);
  for (const sc of list) { const kv = sc.split(';')[0]; jar.set(kv.split('=')[0], kv); }
  cookie = [...jar.values()].join('; ');
}

/* 429 와 차단(403, 5xx)은 두 번까지만 다시. 쉬는 시간 5초, 10초 */
async function get(url, label) {
  let last;
  for (let i = 0; i <= 2; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', ...(cookie ? { Cookie: cookie } : {}) }, redirect: 'follow' });
    keepCookies(res);
    const text = await res.text();
    if (res.ok) return text;
    last = { label, http: res.status, body: text.slice(0, 200).replace(/\s+/g, ' ') };
    if (![429, 403, 500, 502, 503].includes(res.status) || i === 2) break;
    console.log(`  ${label} ${res.status}, ${5 * (i + 1)}초 뒤 다시 (${i + 1}/2)`);
    await sleep(5000 * (i + 1));
  }
  const e = new Error(`${label} 실패 HTTP ${last.http}`); e.detail = last; throw e;
}
const parseGoogleJson = (t) => JSON.parse(t.slice(t.indexOf('{')));

async function fetchSet(set, time) {
  const req = { comparisonItem: set.keywords.map((k) => ({ keyword: k, geo: 'KR', time })), category: 0, property: '' };
  const ex = parseGoogleJson(await get(`https://trends.google.com/trends/api/explore?hl=${HL}&tz=${TZ}&req=${encodeURIComponent(JSON.stringify(req))}`, 'explore'));
  const w = (ex.widgets || []).find((x) => x.id === 'TIMESERIES');
  if (!w) throw Object.assign(new Error('TIMESERIES 위젯 없음'), { detail: { label: 'explore', widgets: (ex.widgets || []).map((x) => x.id) } });
  await sleep(1500);
  const ml = parseGoogleJson(await get(`https://trends.google.com/trends/api/widgetdata/multiline?hl=${HL}&tz=${TZ}&req=${encodeURIComponent(JSON.stringify(w.request))}&token=${encodeURIComponent(w.token)}`, 'multiline'));
  const tl = (ml.default && ml.default.timelineData) || [];
  return {
    set: set.id, keywords: set.keywords,
    resolution: w.request && w.request.resolution,
    timeline: tl.map((p) => ({
      date: new Date(Number(p.time) * 1000 + 9 * 3600e3).toISOString().slice(0, 10),
      label: p.formattedTime,
      values: Object.fromEntries(set.keywords.map((k, i) => [k, Array.isArray(p.value) ? p.value[i] : null])),
      ...(p.isPartial ? { isPartial: true } : {}),
    })),
    averages: Array.isArray(ml.default && ml.default.averages) ? Object.fromEntries(set.keywords.map((k, i) => [k, ml.default.averages[i]])) : null,
  };
}

async function main() {
  const started = new Date();
  const date = stamp(started);
  const today = kstDate(started);
  const time = `${START} ${today}`;
  const meta = {
    source: '구글 트렌드 비공식 엔드포인트 (trends.google.com/trends/api/explore → widgetdata/multiline)',
    collectedAt: started.toISOString(), collectedDateKst: today, geo: 'KR', time, hl: HL, tz: TZ,
    note: '값은 요청 하나 안에서 기간 중 가장 높은 지점(키워드 5개 통틀어)을 100 으로 둔 상대값이다. 검색 횟수가 아니다. '
      + '구글은 표본 추출 값이라 같은 조건으로 다시 받아도 조금씩 다르고, 한국 검색은 네이버 비중이 커서 구글 표본이 작다. 마지막 주는 진행 중(isPartial)일 수 있다. '
      + '모든 묶음에 신년운세를 넣어 묶음 사이 비교 기준으로 쓴다. season 묶음은 시즌 곡선용(신년 계열끼리만 비교해 해상도를 높임).',
  };

  const sets = [];
  const errors = [];
  try {
    await get('https://trends.google.com/?geo=KR', 'cookie');
  } catch (e) { errors.push(e.detail || { label: 'cookie', message: e.message }); }
  for (let i = 0; i < SETS.length; i++) {
    try {
      const r = await fetchSet(SETS[i], time);
      sets.push(r);
      console.log(`  ${SETS[i].id}: ${r.timeline.length}개 지점 (${r.resolution || '?'})`);
    } catch (e) {
      errors.push({ set: SETS[i].id, ...(e.detail || { message: e.message }) });
      console.log(`  ${SETS[i].id} 실패: ${e.message}`);
      break; // 막히면 다음 묶음도 막힐 가능성이 커서 더 부르지 않는다
    }
    if (i < SETS.length - 1) await sleep(4000);
  }
  const status = sets.length === SETS.length ? 'ok' : (sets.length ? 'partial' : 'blocked');
  const p = writeJson(`google_trends_${date}.json`, { meta, status, ...(status === 'blocked' ? { reason: '막힘: 구글이 요청을 거절함(429 또는 차단). 두 번 다시 시도 뒤 포기.' } : {}), sets, errors });
  console.log(`${status === 'blocked' ? '막힘' : '저장'}: ${p} (${status})`);
  if (status === 'blocked') process.exit(2);
}

main().catch((e) => { console.error('실패:', String(e.message).slice(0, 300)); process.exit(1); });
