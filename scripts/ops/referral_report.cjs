/* 친구 초대 집계 (2026-10-18, 읽기 전용) — 사용: node scripts/ops/referral_report.cjs [일수=14]
 *   코드별: 들어온 새 친구, 인정된 친구, 결제한 친구, 초대한 사람이 받은 운
 *   날짜별: 지급한 운(전체 상한 globalDailyUn 대비), 인정 수
 *   이상 징후: 한 코드에 같은 IP 해시로 들어온 새 손님이 많음, 직접 넣은 코드 비율이 높음, 들어온 수 대비 인정이 비정상으로 높음
 *   서버: functions/src/referral/referral.ts. 금액과 상한을 바꾸려면 Firestore config/referral 문서(배포 없이). */
const { list } = require('./fs.cjs');
const N = Number(process.argv[2] || 14);
(async () => {
  const codes = await list('referralCodes');
  const visits = await list('referralVisits');
  const daily = await list('referralDaily');
  const since = Date.now() - N * 864e5;
  const recentVisits = visits.filter((v) => Number(v.atMs) >= since);
  console.log(`[친구 초대] 코드 ${codes.length}개, 최근 ${N}일 링크로 들어온 기록 ${recentVisits.length}건 (새 손님 ${recentVisits.filter((v) => v.isNew).length}, 인정 ${recentVisits.filter((v) => v.completedBy).length})`);
  const top = codes.filter((c) => (c.visits || 0) + (c.qualified || 0) > 0)
    .sort((a, b) => (b.qualified || 0) - (a.qualified || 0) || (b.visits || 0) - (a.visits || 0)).slice(0, 20);
  console.log('\n코드     이름          새친구 인정 결제 받은운 한도초과');
  for (const c of top) console.log(`${c.__id}  ${String(c.name || '-').padEnd(12)} ${String(c.visits || 0).padStart(5)} ${String(c.qualified || 0).padStart(4)} ${String(c.purchased || 0).padStart(4)} ${String(c.earnedUn || 0).padStart(5)} ${String(c.cappedFriends || 0).padStart(6)}`);
  console.log('\n날짜        지급운 인정 결제');
  for (const d of daily.sort((a, b) => a.__id.localeCompare(b.__id)).slice(-N)) console.log(`${d.__id}  ${String(d.un || 0).padStart(5)} ${String(d.qualified || 0).padStart(4)} ${String(d.purchased || 0).padStart(4)}`);
  // 이상 징후
  const byCode = {};
  for (const v of recentVisits) (byCode[v.code] = byCode[v.code] || []).push(v);
  const flags = [];
  for (const [code, vs] of Object.entries(byCode)) {
    const ip = {};
    vs.filter((v) => v.isNew && v.ipHash).forEach((v) => { ip[v.ipHash] = (ip[v.ipHash] || 0) + 1; });
    const maxIp = Math.max(0, ...Object.values(ip));
    const manual = vs.filter((v) => v.manual).length;
    const done = vs.filter((v) => v.completedBy).length;
    if (maxIp >= 5) flags.push(`${code}: 같은 IP 로 새 손님 ${maxIp}명 (가족이면 정상, 많으면 확인)`);
    if (vs.length >= 5 && manual / vs.length > 0.6) flags.push(`${code}: 직접 넣은 코드 ${manual}/${vs.length}`);
    if (vs.length >= 3 && done / vs.length > 0.9) flags.push(`${code}: 들어온 ${vs.length}명 중 ${done}명 인정 (비정상으로 높음)`);
  }
  console.log('\n[이상 징후]', flags.length ? '\n' + flags.join('\n') : '없음');
})().catch((e) => { console.error(e); process.exit(1); });
