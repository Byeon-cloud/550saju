/**
 * 관리자 v4 — 기록 점검 (2026-10-19)
 *   우리가 남기는 이벤트(src/services/analytics.ts FIRESTORE_TRACKED)를 무리로 나눠, 기간 안 앱과 웹 건수, 마지막으로 들어온 날,
 *   '끊김 의심'(앞에선 들어오다 최근 3일 0건)을 보여 준다. 새 기능을 넣고 기록이 실제로 들어오는지 확인하는 곳.
 *   숫자는 하루 요약의 events(기록 수, 사람 수 아님).
 */
import { fmt } from './api';
import type { DayStats } from './api';
import { Box, Table, K } from './ui';

type Where = 'both' | 'app' | 'web';
const CATALOG: { group: string; items: [name: string, label: string, where: Where][] }[] = [
  { group: '방문', items: [
    ['app_open', '앱이나 웹을 열었다', 'both'], ['signup', '이 기기에서 처음 열었다', 'both'], ['page_view', '화면을 봤다', 'both'], ['cta_click', '버튼을 눌렀다', 'both'],
    ['web_intro_view', '웹 첫 손님 소개 카드가 보였다', 'web'],
  ] },
  { group: '사주 입력과 계정', items: [
    ['profile_created', '사주를 처음 넣었다', 'both'], ['input_leave', '입력을 끝내지 않고 나갔다', 'both'], ['input_blocked', '빈 칸이 있는데 시작을 눌렀다', 'both'],
    ['manse_view', '검색 페이지 만세력 칸에서 바로 펼쳤다', 'web'], ['login_success', '로그인했다', 'both'], ['login_fail', '웹 로그인이 실패했다', 'web'],
  ] },
  { group: '콘텐츠', items: [
    ['content_open', '콘텐츠를 열었다', 'both'], ['content_result', '결과를 받았다', 'both'], ['content_purchase', '운을 써서 샀다', 'both'],
    ['topic_open', '주제운 화면을 열었다', 'both'], ['topic_select', '주제운 결제를 확정했다', 'both'], ['tojung_preview_view', '신년운세 무료 미리 보기가 보였다', 'both'],
    ['tti_open', '띠별 운세를 열었다', 'both'], ['tti_year', '띠의 해를 골랐다', 'both'], ['tti_input', '띠 화면에서 생일을 넣었다', 'both'], ['tti_newyear', '띠 칸에서 신년운세로', 'both'], ['tti_compat', '띠 칸에서 궁합으로', 'both'],
  ] },
  { group: '홈 시즌 카드', items: [
    ['daily_offer_start', '첫 오늘의 운세 종합사주 반값이 열렸다', 'both'], ['daily_offer_view', '반값 카드가 보였다', 'both'], ['daily_offer_click', '반값 카드를 눌렀다', 'both'],
    ['month_picks_view', '이번 달 좋은 날 카드가 보였다', 'both'], ['month_picks_click', '그 카드에서 월운세로', 'both'],
    ['birthday_card_view', '생일 달 카드가 보였다', 'both'], ['birthday_card_click', '생일 카드에서 상품으로', 'both'],
    ['suneung_card_view', '수능 카드가 보였다(11/1~11/19)', 'both'], ['suneung_card_click', '수능 카드에서 합격이직운으로', 'both'],
  ] },
  { group: '결제', items: [
    ['insufficient_balance', '운이 모자라 충전으로 넘어갔다', 'both'], ['charge_open', '충전 화면을 열었다', 'both'], ['charge_free_first', '사주 없이 충전 화면에 와서 무료로', 'both'],
    ['charge_login_gate', '웹 결제 전 로그인 창이 떴다', 'web'], ['charge_complete', '충전이 끝났다(금액)', 'both'], ['charge_failed', '결제가 실패하거나 취소됐다', 'both'],
  ] },
  { group: '보내기와 초대', items: [
    ['share_click', '보내기를 눌렀다', 'both'], ['share_complete', '보내기가 끝났다', 'both'], ['share_view', '받은 링크를 열었다', 'both'], ['invite_received', '공유 링크로 들어왔다', 'both'],
    ['inv_page_view', '친구 초대 화면', 'both'], ['inv_visit', '초대 링크로 들어온 기록', 'both'], ['inv_welcome_view', '초대받은 친구 카드가 보였다', 'both'], ['inv_welcome_click', '그 카드 버튼', 'both'],
    ['inv_complete', '초대받은 친구가 받기를 눌렀다', 'both'], ['inv_claim', '초대 보상 운을 받았다', 'both'], ['cjoin_answer', '받은 궁합 초대장에 답했다', 'both'],
  ] },
  { group: '알림, 메일, 별점, 보상', items: [
    ['noti_agree', '매일 9시 알림 동의', 'app'], ['review_request', '토스 별점 창 요청', 'app'], ['mail_subscribe', '메일 알림 신청', 'web'], ['reward_earned', '보상 운 적립(출석 등)', 'both'], ['inquiry_sent', '웹 문의 양식으로 문의', 'web'],
  ] },
  { group: 'AI와 오류', items: [
    ['ai_done', 'AI 생성 끝', 'both'], ['ai_error', 'AI 생성 실패', 'both'], ['client_error', '화면 오류', 'both'], ['storage_full', '기기 저장 공간이 차서 옛 기록을 지움', 'both'],
  ] },
  { group: '앱 안 광고', items: [
    ['ad_impression', '광고가 보였다', 'app'], ['ad_click', '광고를 눌렀다', 'app'], ['ad_nofill', '광고가 없었다', 'app'], ['ad_fail', '광고 불러오기 실패', 'app'],
  ] },
];
// 실패나 오류 쪽은 0건이 좋은 것 — '아직 없음'을 문제로 보지 않는다
const ZERO_OK = new Set(['login_fail', 'charge_failed', 'ai_error', 'client_error', 'storage_full', 'input_blocked', 'ad_fail', 'ad_nofill']);

export function Tracking({ days }: { days: DayStats[] }) {
  const withEvents = days.filter((d) => d.events);
  const known = new Set(CATALOG.flatMap((g) => g.items.map((i) => i[0])));
  const total = (name: string, p: 'app' | 'web') => withEvents.reduce((s, d) => s + (d.events?.[name]?.[p] || 0), 0);
  const lastDay = (name: string) => { for (let i = withEvents.length - 1; i >= 0; i -= 1) { const e = withEvents[i].events?.[name]; if (e && e.app + e.web > 0) return withEvents[i].day; } return ''; };
  const recent = withEvents.slice(-3);
  const earlier = withEvents.slice(0, -3);
  const status = (name: string, where: Where) => {
    const n = total(name, 'app') + total(name, 'web');
    if (n === 0) return ZERO_OK.has(name) ? '없음(좋음)' : '아직 없음';
    const rec = recent.reduce((s, d) => s + (d.events?.[name]?.app || 0) + (d.events?.[name]?.web || 0), 0);
    const ear = earlier.reduce((s, d) => s + (d.events?.[name]?.app || 0) + (d.events?.[name]?.web || 0), 0);
    if (!ZERO_OK.has(name) && rec === 0 && ear >= 5) return '끊김 의심';
    if (where === 'app' && total(name, 'web') > 0) return '웹에서도 들어옴(확인)';
    if (where === 'web' && total(name, 'app') > 0) return '앱에서도 들어옴(확인)';
    return '정상';
  };
  const unknown = new Map<string, { app: number; web: number }>();
  for (const d of withEvents) for (const [n, v] of Object.entries(d.events || {})) if (!known.has(n)) { const u = unknown.get(n) || { app: 0, web: 0 }; u.app += v.app; u.web += v.web; unknown.set(n, u); }
  const flagged = CATALOG.flatMap((g) => g.items.filter(([n, , w]) => /끊김|확인/.test(status(n, w))).map(([n, l, w]) => `${l}(${n}): ${status(n, w)}`));

  if (withEvents.length === 0) return <p style={{ fontSize: 14, color: K.mute }}>기록 건수는 요약을 다시 만든 날부터 보여요. 잠시 뒤 새로 불러와 주세요.</p>;
  return (
    <div>
      <Box title="한 줄 요약" note="끊김 의심: 앞에서는 5건 넘게 들어오다가 최근 3일 0건. 앱 전용, 웹 전용 기록이 다른 쪽에서 들어오면 확인 표시를 해요. 숫자는 기록 건수예요(사람 수 아님).">
        <p style={{ fontSize: 14.5, color: flagged.length ? K.red : K.green, fontWeight: 700, margin: 0 }}>
          {flagged.length ? `살펴볼 기록 ${flagged.length}개` : '살펴볼 기록 없음'}
        </p>
        {flagged.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13.5, color: K.ink2 }}>{flagged.map((f) => <li key={f}>{f}</li>)}</ul>}
      </Box>
      {CATALOG.map((g) => (
        <Box key={g.group} title={g.group}>
          <Table head={['기록', '이름', '어디서', '앱', '웹', '마지막', '상태']} align={['l', 'l', 'l', 'r', 'r', 'l', 'l']}
            rows={g.items.map(([n, l, w]) => {
              const st = status(n, w);
              return [l, <code key="c" style={{ fontSize: 12, color: K.mute }}>{n}</code>, w === 'both' ? '앱, 웹' : w === 'app' ? '앱만' : '웹만', fmt(total(n, 'app')), fmt(total(n, 'web')), lastDay(n) || '-',
                <span key="s" style={{ color: /끊김|확인/.test(st) ? K.red : st === '아직 없음' ? K.mute : K.green, fontWeight: 700 }}>{st}</span>];
            })} />
        </Box>
      ))}
      {unknown.size > 0 && (
        <Box title="목록에 없는 기록" note="analytics.ts 에 새로 넣고 여기 분류에 아직 안 넣은 기록이에요.">
          <Table head={['이름', '앱', '웹']} align={['l', 'r', 'r']} rows={[...unknown.entries()].map(([n, v]) => [n, fmt(v.app), fmt(v.web)])} />
        </Box>
      )}
    </div>
  );
}
