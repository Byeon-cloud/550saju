/**
 * 관리자 v4 — 어디서 사나 (2026-10-19, 오너: 홈에서 뭘 가장 많이 누르나, 유료 전환은 어디서 가장 많이 일어나나)
 *   하루 요약(statsDaily v4)의 homeClicks, purchaseFrom, chargeFrom 을 기간만큼 더한다.
 *   - 홈 버튼: 누른 수, 누른 세션, 그 세션에서 그 뒤 결제(운 사용이나 충전)까지 간 세션, 결제 전환율
 *   - 운을 쓴 건의 시작점: 그 세션에서 마지막으로 누른 홈 버튼(없으면 처음 들어온 화면)
 *   - 충전이 시작된 화면: 어떤 콘텐츠에서 운이 모자라 충전했나
 */
import { fmt, won, pct, CONTENT_NAME } from './api';
import type { DayStats, PlatFilter } from './api';
import { Box, Table, K } from './ui';

const TOPIC: Record<string, string> = { love: '연애운', reunion: '재회운', marriage: '결혼운', wealth: '재물운', exam: '합격이직운', business: '사업운', health: '건강운', move: '이사운', study: '공부운', career: '직업운' };
function sourceName(src: string): string {
  if (src.startsWith('topic:')) return `${TOPIC[src.slice(6)] || src.slice(6)} 화면`;
  if (src.startsWith('need:')) return `운 부족 안내 (${src.slice(5)}운 필요)`;
  if (src === 'direct') return '충전 화면 바로 (홈 잔액, 내 정보)';
  return `${CONTENT_NAME[src] || src} 화면`;
}

export function Paths({ days, plat }: { days: DayStats[]; plat: PlatFilter }) {
  const plats: ('app' | 'web')[] = plat === 'all' ? ['app', 'web'] : [plat];
  const home: Record<string, { clicks: number; sess: number; conv: number; app: number; web: number }> = {};
  const from: Record<string, { n: number; un: number }> = {};
  const charge: Record<string, { n: number; amount: number }> = {};
  for (const d of days) {
    for (const [label, v] of Object.entries(d.homeClicks || {})) {
      const h = (home[label] ??= { clicks: 0, sess: 0, conv: 0, app: 0, web: 0 });
      for (const p of plats) { h.clicks += v[p]?.clicks || 0; h.sess += v[p]?.sess || 0; h.conv += v[p]?.conv || 0; h[p] += v[p]?.clicks || 0; }
    }
    for (const [k, v] of Object.entries(d.purchaseFrom || {})) { const r = (from[k] ??= { n: 0, un: 0 }); for (const p of plats) { r.n += v[p]?.n || 0; r.un += v[p]?.un || 0; } }
    for (const [k, v] of Object.entries(d.chargeFrom || {})) { const r = (charge[k] ??= { n: 0, amount: 0 }); for (const p of plats) { r.n += v[p]?.n || 0; r.amount += v[p]?.amount || 0; } }
  }
  const homeRows = Object.entries(home).filter(([, v]) => v.clicks > 0).sort((a, b) => b[1].clicks - a[1].clicks);
  const bestConv = Object.entries(home).filter(([, v]) => v.sess >= 5 && v.conv > 0).sort((a, b) => b[1].conv / b[1].sess - a[1].conv / a[1].sess).slice(0, 6);
  const fromRows = Object.entries(from).filter(([, v]) => v.n > 0).sort((a, b) => b[1].un - a[1].un);
  const chargeRows = Object.entries(charge).filter(([, v]) => v.n > 0).sort((a, b) => b[1].amount - a[1].amount);
  const hasData = days.some((d) => d.homeClicks);

  if (!hasData) return <p style={{ fontSize: 14, color: K.mute }}>이 항목은 요약을 다시 만든 날부터 보여요. 몇 분 뒤 새로 불러와 주세요.</p>;
  return (
    <div>
      {bestConv.length > 0 && (
        <Box title="결제로 잘 이어지는 홈 버튼" note="누른 세션이 다섯 이상인 버튼 중 결제 전환율이 높은 순이에요.">
          <Table head={['버튼', '누른 세션', '그 뒤 결제', '결제 전환율']} align={['l', 'r', 'r', 'r']}
            rows={bestConv.map(([label, v]) => [label, fmt(v.sess), fmt(v.conv), pct(v.conv, v.sess)])} />
        </Box>
      )}
      <Box title="홈에서 누른 것" note="버튼 글자로 묶었어요(글자가 바뀌면 다른 줄로 보여요). 결제 전환율은 그 버튼을 누른 세션 중 같은 세션에서 그 뒤 운을 쓰거나 충전한 비율이에요.">
        <Table head={['버튼', '누른 수', '앱', '웹', '누른 세션', '그 뒤 결제', '결제 전환율']} align={['l', 'r', 'r', 'r', 'r', 'r', 'r']}
          rows={homeRows.slice(0, 30).map(([label, v]) => [label, fmt(v.clicks), fmt(v.app), fmt(v.web), fmt(v.sess), fmt(v.conv), pct(v.conv, v.sess)])} />
      </Box>
      <Box title="운을 쓴 건은 어디서 시작했나" note="운을 쓴(콘텐츠를 산) 건마다, 같은 세션에서 마지막으로 누른 홈 버튼이에요. 홈을 거치지 않았으면 그 세션이 처음 들어온 화면이에요(광고나 검색, 공유 링크).">
        <Table head={['시작점', '건수', '쓴 운']} align={['l', 'r', 'r']} rows={fromRows.slice(0, 25).map(([k, v]) => [k, fmt(v.n), `${fmt(v.un)}운`])} />
      </Box>
      <Box title="충전은 어느 화면에서 시작했나" note="충전을 마친 건마다 충전 화면에 오기 직전 콘텐츠예요. 운이 모자라 넘어온 경우가 대부분이에요.">
        <Table head={['화면', '건수', '금액']} align={['l', 'r', 'r']} rows={chargeRows.map(([k, v]) => [sourceName(k), fmt(v.n), won(v.amount)])} />
      </Box>
    </div>
  );
}
