/**
 * 읽기 전용 감사 — 유료 콘텐츠 소비량 vs 지급된 운 대조 (2026-08-07)
 *
 * 목적: "결제 4운인데 유료 12건" 이 이 유저만의 일인지, 전 유저 현상인지 확인.
 *   유료 리포트를 종류별로 세고, 각 콘텐츠의 **최저가**(세일가)를 곱해 필요한 운을 구한 뒤
 *   서버가 기록한 지급 운(paid+bonus)과 대조한다.
 *   최저가를 쓰는 이유: 구멍을 과장하지 않기 위해. 실제로는 이보다 더 많이 필요하다.
 *
 * ⚠️ 이 스크립트는 **읽기만** 한다. 쓰기 호출이 전혀 없다.
 * 사용: node scripts/cs-audit-readonly.cjs
 */
const CONFIG_PATH = 'C:/Users/quswn/.config/configstore/firebase-tools.json';
const DOCS = 'https://firestore.googleapis.com/v1/projects/appintoss-saju/databases/(default)/documents';
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

/** 콘텐츠별 최저가(운) — 세일가 기준. src/constants/pricing.ts SSOT 참조 */
const MIN_COST = {
  report: 5,    // 종합사주 정가 10, 세일 5
  premium: 5,
  topic: 1,     // 주제운 기본 1 (재물/연애/재회는 3)
  monthly: 5,   // 월운 정가 7, 세일 5
  weekly: 3,    // 주간 정가 5, 세일 3
  dream: 1,     // 꿈해몽 심층 1
  daeun: 5, compat: 3, tojung: 3,
};

const val = (v) => {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x); return o; }
  return null;
};
const flat = (d) => { const o = {}; for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v); return o; };

(async () => {
  const cfg = require(CONFIG_PATH);
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token' }),
  });
  const H = { Authorization: 'Bearer ' + (await tr.json()).access_token };
  const get = async (p) => (await fetch(DOCS + p, { headers: H })).json();

  let users = [], pt = '';
  do {
    const r = await get('/users?pageSize=300' + (pt ? '&pageToken=' + pt : ''));
    users.push(...(r.documents || [])); pt = r.nextPageToken || '';
  } while (pt);

  const byType = {};
  let needUn = 0, totPaid = 0, totBonus = 0, payDocs = 0, spendDocs = 0, chargeDocs = 0;
  const perUser = [];

  for (const u of users) {
    const uid = u.name.split('/').pop();
    const ud = flat(u);
    const granted = ((ud.balance?.paid) || 0) + ((ud.balance?.bonus) || 0);
    totPaid += (ud.balance?.paid) || 0;
    totBonus += (ud.balance?.bonus) || 0;

    let reps = [], p2 = '';
    do {
      const r = await get(`/users/${uid}/reports?pageSize=100${p2 ? '&pageToken=' + p2 : ''}&mask.fieldPaths=type&mask.fieldPaths=contentType`);
      reps.push(...(r.documents || [])); p2 = r.nextPageToken || '';
    } while (p2);

    let uNeed = 0, uPaidCnt = 0;
    reps.map(flat).filter((r) => r.type === 'paid').forEach((r) => {
      const ct = r.contentType || '?';
      byType[ct] = (byType[ct] || 0) + 1;
      const c = MIN_COST[ct] ?? 1;
      needUn += c; uNeed += c; uPaidCnt++;
    });

    const pays = await get(`/users/${uid}/payments?pageSize=100&mask.fieldPaths=type`);
    (pays.documents || []).forEach((d) => {
      const t = flat(d).type; payDocs++;
      if (t === 'spend' || t === 'use') spendDocs++;
      if (t === 'charge') chargeDocs++;
    });

    if (uPaidCnt > 0) perUser.push({ uid: uid.slice(0, 10), granted, uNeed, uPaidCnt, gap: uNeed - granted });
  }

  console.log('=== 유료 리포트 종류별 (전 유저) ===');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    const c = MIN_COST[k] ?? 1;
    console.log(`  ${k}: ${v}건 × 최저 ${c}운 = ${v * c}운`);
  });
  console.log('\n=== 총계 ===');
  console.log('필요 운 (최저가 기준):', needUn, '운');
  console.log('서버 기록 지급:', totPaid + totBonus, '운 (paid', totPaid, '+ bonus', totBonus, ')');
  console.log('설명 안 되는 차이:', needUn - (totPaid + totBonus), '운');
  console.log('\npayments 문서', payDocs, '건 | charge', chargeDocs, '· spend/use', spendDocs, '건');

  perUser.sort((a, b) => b.gap - a.gap);
  console.log('\n=== 격차 상위 15명 (필요운 - 지급운) ===');
  perUser.slice(0, 15).forEach((x) => console.log(`  ${x.uid}… 유료 ${x.uPaidCnt}건 = ${x.uNeed}운 필요 | 지급 ${x.granted}운 | 격차 ${x.gap}운`));
  const noGap = perUser.filter((x) => x.gap <= 0).length;
  console.log(`\n격차 없는 유저: ${noGap}명 / 유료 이용자 ${perUser.length}명`);
})().catch((e) => console.log('ERR', e.message));
