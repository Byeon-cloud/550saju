/* 네이버 데이터랩 검색어 트렌드 수집기 (2026-10-20)
 *
 *   API: POST https://openapi.naver.com/v1/datalab/search
 *        헤더 X-Naver-Client-Id, X-Naver-Client-Secret
 *        본문 { startDate, endDate, timeUnit, keywordGroups:[{groupName, keywords}] (요청당 그룹 5개, 그룹당 키워드 20개), device, ages, gender }
 *   자격 증명: 사주500 네이버 로그인 앱. Client ID 는 .env VITE_NAVER_CLIENT_ID 와 같고,
 *        Client Secret 은 Firebase Auth 공급자 설정 'oidc.naver' 에 있다(functions/src/auth/naverAuth.ts 가 getProviderConfig 로 읽는 값).
 *        이 PC 에는 ADC 가 없어서 scripts/ops/fs.cjs 처럼 firebase-tools 로그인 세션으로
 *        Identity Toolkit admin v2 (oauthIdpConfigs/oidc.naver) 를 읽는다. 값은 화면에 찍지 않는다.
 *   막힐 때: 이 앱에 데이터랩 API 사용이 켜져 있지 않으면 401 errorCode 024 (Scopes are Empty) 가 난다.
 *        그러면 우회하지 않고 막힘 기록만 남긴다. 오너가 developers.naver.com > 내 애플리케이션 > 사주500 앱 >
 *        API 설정 > 사용 API 에 '데이터랩(검색어트렌드)' 를 추가하면 같은 명령으로 다시 돌리면 된다.
 *
 *   받는 것: 2023-01-01~오늘, 주 단위. 대표 그룹(keywords.cjs TREND_GROUPS)을 세 묶음으로 나눠
 *        전체, 20대(3,4), 30대(5,6), 40대(7,8), 50대(9,10), 60대 이상(11), 남성, 여성 으로 각각 받는다.
 *        모든 묶음에 '신년운세' 를 넣어 묶음 사이 비교 기준으로 쓴다.
 *   결과: docs/marketing/data/naver_trend_YYYYMMDD.json
 *
 *   실행: node scripts/marketing/naver_datalab.cjs
 */
const { TREND_GROUPS } = require('./keywords.cjs');
const { pause, sleep, stamp, kstDate, writeJson } = require('./_util.cjs');

const FT = 'C:/Users/quswn/AppData/Roaming/npm/node_modules/firebase-tools/lib';
const START = '2023-01-01';
const URL = 'https://openapi.naver.com/v1/datalab/search';

const SETS = [
  { id: 'main', groups: ['신년운세', '오늘의 운세', '사주', '궁합', '꿈해몽'] },
  { id: 'more', groups: ['신년운세', '토정비결', '만세력', '재회', '삼재'] },
  { id: 'love', groups: ['신년운세', '연애운'] },
];
const SEGMENTS = [
  { id: 'all', label: '전체' },
  { id: 'age20', label: '20대', ages: ['3', '4'] },
  { id: 'age30', label: '30대', ages: ['5', '6'] },
  { id: 'age40', label: '40대', ages: ['7', '8'] },
  { id: 'age50', label: '50대', ages: ['9', '10'] },
  { id: 'age60', label: '60대 이상', ages: ['11'] },
  { id: 'male', label: '남성', gender: 'm' },
  { id: 'female', label: '여성', gender: 'f' },
];

const OWNER_ACTION = '오너가 developers.naver.com 내 애플리케이션 > 사주500(네이버 로그인 앱) > API 설정 > 사용 API 에서 데이터랩(검색어트렌드) 추가 필요. 추가 뒤 `node scripts/marketing/naver_datalab.cjs` 를 다시 돌리면 된다.';

async function naverCreds() {
  const { requireAuth } = require(FT + '/requireAuth.js');
  const { Client } = require(FT + '/apiv2.js');
  const { selectAccount } = require(FT + '/auth.js');
  const acc = selectAccount(undefined, 'D:/550saju');
  await requireAuth({ projectRoot: 'D:/550saju', project: 'appintoss-saju', user: acc && acc.user, tokens: acc && acc.tokens });
  const c = new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', auth: true });
  const b = (await c.get('/admin/v2/projects/appintoss-saju/oauthIdpConfigs/oidc.naver')).body || {};
  const clientId = String(b.clientId || '');
  const clientSecret = String(b.clientSecret || '');
  if (!clientId || !clientSecret) throw new Error('oidc.naver 설정에 clientId 또는 clientSecret 이 없음');
  return { clientId, clientSecret };
}

async function datalab(creds, body) {
  for (let i = 0; ; i++) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Naver-Client-Id': creds.clientId, 'X-Naver-Client-Secret': creds.clientSecret },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
    if (res.ok) return data;
    const err = new Error(`데이터랩 ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    err.status = res.status; err.data = data;
    if ((res.status === 429 || res.status >= 500) && i < 2) { await sleep(2000 * (i + 1)); continue; }
    throw err;
  }
}

async function main() {
  const started = new Date();
  const date = stamp(started);
  const endDate = kstDate(started);
  const groupDef = Object.fromEntries(TREND_GROUPS.map((g) => [g.name, g]));
  const note = '데이터랩 값(ratio)은 요청 하나 안에서 기간 중 가장 많이 검색된 지점을 100 으로 둔 상대값이다. 검색 횟수가 아니다. '
    + '나이대와 성별은 요청마다 따로 100 으로 맞춰지므로 서로 다른 요청(예: 20대와 50대)의 숫자 크기를 직접 비교하면 안 되고, 같은 요청 안의 그룹끼리 비교하거나 곡선 모양(언제 오르고 내리는지)을 비교한다. '
    + '모든 묶음에 신년운세 그룹을 넣어 두었으므로 신년운세 대비 비율로 묶음 사이를 이을 수 있다.';

  const base = {
    meta: {
      source: '네이버 데이터랩 검색어 트렌드 API (openapi.naver.com/v1/datalab/search)',
      collectedAt: started.toISOString(), collectedDateKst: endDate,
      startDate: START, endDate, timeUnit: 'week', note,
      groups: TREND_GROUPS, sets: SETS, segments: SEGMENTS,
    },
  };

  let creds;
  try { creds = await naverCreds(); } catch (e) {
    const p = writeJson(`naver_trend_${date}.json`, { ...base, status: 'blocked', reason: '자격 증명 읽기 실패', error: String(e.message).slice(0, 300) });
    console.log(`막힘: 자격 증명 읽기 실패 (${String(e.message).slice(0, 200)})\n기록: ${p}`);
    process.exit(2);
  }
  console.log(`자격 증명: Client ID 끝 ${creds.clientId.slice(-4)}`);

  const requests = [];
  for (const seg of SEGMENTS) {
    for (const set of SETS) {
      const body = {
        startDate: START, endDate, timeUnit: 'week',
        keywordGroups: set.groups.map((g) => ({ groupName: g, keywords: groupDef[g].keywords.slice(0, 20) })),
      };
      if (seg.ages) body.ages = seg.ages;
      if (seg.gender) body.gender = seg.gender;
      try {
        const r = await datalab(creds, body);
        requests.push({ set: set.id, segment: seg.id, segmentLabel: seg.label, body, results: r.results || [] });
        console.log(`  ${seg.label} ${set.id} 완료`);
      } catch (e) {
        const code = e.data && e.data.errorCode;
        if (e.status === 401 || e.status === 403 || code === '024') {
          const p = writeJson(`naver_trend_${date}.json`, {
            ...base, status: 'blocked',
            reason: '이 네이버 앱에 데이터랩(검색어트렌드) API 사용이 켜져 있지 않음',
            error: { http: e.status, errorCode: code || null, errorMessage: (e.data && e.data.errorMessage) || null },
            ownerAction: OWNER_ACTION,
          });
          console.log(`막힘: HTTP ${e.status} errorCode ${code || '-'} (${(e.data && e.data.errorMessage) || ''})\n${OWNER_ACTION}\n기록: ${p}`);
          process.exit(2);
        }
        requests.push({ set: set.id, segment: seg.id, segmentLabel: seg.label, body, error: { http: e.status || null, message: String(e.message).slice(0, 300) } });
        console.log(`  ${seg.label} ${set.id} 실패 ${e.status || ''}`);
      }
      await pause();
    }
  }
  const ok = requests.filter((r) => !r.error).length;
  const p = writeJson(`naver_trend_${date}.json`, { ...base, status: ok === requests.length ? 'ok' : (ok ? 'partial' : 'failed'), requests });
  console.log(`저장: ${p} (성공 ${ok}/${requests.length})`);
}

main().catch((e) => { console.error('실패:', String(e.message).slice(0, 300)); process.exit(1); });
