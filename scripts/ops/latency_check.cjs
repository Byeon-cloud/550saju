/* 유료 풀이 생성 시간과 화면 제한 시간 대조 (2026-10-23, 읽기만) — 사용: node latency_check.cjs [일수=7]
 *   10-14 모델 교체 뒤 웹 종합사주가 113~147초 걸리는데 화면 워치독은 120초라, 정상 풀이를 실패로 보고 기기에만 운을 돌려줬다
 *   (서버는 끝까지 만들고 깎음 → 손님 둘 피해, 10-23). 콘텐츠마다 화면이 기다리는 시간과 실제 생성 시간(ai_done ms)을 대조해
 *   p90 이 제한 시간의 60% 를 넘으면 '위험'으로 찍는다. 모델이나 effort 를 바꾼 뒤, 그리고 매일 밤 9시 광고 점검 때 같이 돌린다. */
const { query } = require('./fs.cjs');
// 화면이 실패로 보기 전까지 기다리는 시간(ms). 코드를 바꾸면 여기도 같이 고친다.
const LIMIT = {
  premium: 300000,   // src/pages/result/ResultPage.tsx 웹 SSE 워치독(10-23 120→300초, 그룹 도착마다 180초로 다시)
  report: 300000,    // 같은 화면 앱 callable 경로(10-23 240→300초)
  topic: 600000,     // TopicAnalysisPage 활동 기준 마감(TOPIC_STREAM_ABSOLUTE_CAP_MS), 반쪽 저장 뒤 늦은 완성본 승격
  tojung: 300000, monthly: 300000, weekly: 300000, compat: 300000, daeun: 300000, dream: 300000, chat: 300000, daily: 300000, // callable 300초
};
const days = Number(process.argv[2]) || 7;
const from = new Date(Date.now() + 9 * 3600e3 - (days - 1) * 864e5).toISOString().slice(0, 10);
(async () => {
  const done = (await query({ from: [{ collectionId: 'analytics' }], where: { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: 'ai_done' } } }, select: { fields: ['props', 'day', 'internal', 'plat'].map((f) => ({ fieldPath: f })) } }))
    .filter((e) => !e.internal && e.day >= from);
  console.log(`유료 풀이 생성 시간 ${from} 부터 (ai_done 기준, 오너 기기 제외)`);
  let warn = 0;
  for (const [type, limit] of Object.entries(LIMIT)) {
    const ms = done.filter((e) => e.props?.type === type).map((e) => Number(e.props.ms) || 0).sort((a, b) => a - b);
    if (!ms.length) continue;
    const q = (p) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))];
    const ratio = q(0.9) / limit;
    const flag = ratio > 0.6 ? '위험' : ratio > 0.45 ? '주의' : '괜찮음';
    if (ratio > 0.6) warn++;
    console.log(`  ${type.padEnd(8)} ${String(ms.length).padStart(3)}건  p50 ${Math.round(q(0.5) / 1000)}초  p90 ${Math.round(q(0.9) / 1000)}초  최대 ${Math.round(ms[ms.length - 1] / 1000)}초  제한 ${limit / 1000}초  → ${flag}`);
  }
  console.log(warn ? `위험 ${warn}건: 화면 제한 시간을 늘리거나 생성 시간을 줄여야 한다` : '위험 없음');
})().catch((e) => { console.error(e); process.exit(1); });
