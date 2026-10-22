/**
 * 관리자 v4 — 메일 판 (2026-10-22)
 *   웹의 아침 운세 메일(무료, 매일 7시)과 광고성 소식 동의를 본다. 숫자는 서버 adminMailReport(functions/src/admin/mailReport.ts).
 *   흐름: 신청 칸이 보임 → 펼침(홈 한 줄) → 신청 누름 → 신청 완료 / 실패 → 매일 보냄 → 메일 링크로 들어옴 → 풀이 → 충전 → 결제
 */
import { useCallback, useEffect, useState } from 'react';
import { callAdmin, shortDay } from './api';
import { Box, K, Table, Tile, grid } from './ui';

interface MailDay {
  day: string; views: number; opens: number; submits: number; subs: number; fails: number;
  newSubs: number; unsubs: number; newAdConsent: number; sent: number; failed: number; skipped: number;
  clickers: number; results: number; chargeOpen: number; payers: number; revenue: number;
}
interface MailReport {
  from: string; to: string;
  totals: { subscribers: number; active: number; withdrawn: number; adConsent: number; adWithdrawn: number; subPayers: number; subOrders: number; subRevenue: number };
  bySource: Record<string, { all: number; active: number }>;
  byAge: Record<string, number>;
  leadSource: Record<string, number>;
  funnelSource: Record<string, Record<string, number>>;
  failWhy: Record<string, number>;
  byCampaign: Record<string, number>;
  days: MailDay[];
}

const SOURCE_LABEL: Record<string, string> = {
  home: '홈 한 줄', my: '내 정보', daily_result: '오늘의 운세 결과 아래', daily_empty: '오늘의 운세(사주 없음)',
  premium_pdf: '종합사주 결과지 메일', newyear_tojung_empty: '신년운세 마감 알림', daily_mail: '아침 운세 메일 신청 때', '-': '모름',
};
const label = (k: string) => SOURCE_LABEL[k] || k;
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const sum = (a: MailDay[], k: keyof MailDay) => a.reduce((s, d) => s + (Number(d[k]) || 0), 0);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '-');

export function Mail() {
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [data, setData] = useState<MailReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setBusy(true); setError('');
    callAdmin<MailReport>('adminMailReport', { days })
      .then(setData)
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setBusy(false));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p style={{ color: K.red, fontSize: 14 }}>불러오지 못했어요: {error}</p>;
  if (!data) return <p style={{ fontSize: 14, color: K.mute }}>{busy ? '메일 숫자를 불러오는 중이에요.' : ''}</p>;
  const t = data.totals;
  const ds = data.days;
  const recent = [...ds].reverse();
  const views = sum(ds, 'views'); const submits = sum(ds, 'submits'); const subsDone = sum(ds, 'subs');
  const clickers = sum(ds, 'clickers'); const sent = sum(ds, 'sent');

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {([30, 60, 90] as const).map((n) => (
          <button key={n} type="button" onClick={() => setDays(n)}
            style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${K.line}`, background: days === n ? K.ink : K.surface, color: days === n ? '#F4EFE4' : K.ink, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
            {n}일
          </button>
        ))}
        <button type="button" onClick={load} disabled={busy}
          style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${K.line}`, background: K.surface, fontSize: 13.5, fontWeight: 700, color: K.ink, cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? '불러오는 중…' : '새로 불러오기'}
        </button>
        <span style={{ fontSize: 12.5, color: K.mute }}>{data.from} ~ {data.to}, 웹만(앱은 9시 토스 알림)</span>
      </div>

      <Box title="지금 구독" note="구독과 동의는 서버 장부(dailyMailSubs, emailLeads) 기준, 오너 계정 제외. 결제는 신청한 뒤의 결제 장부만 셉니다.">
        <div style={grid(150)}>
          <Tile label="받는 사람" value={`${t.active}명`} sub={`그만 받음 ${t.withdrawn}명`} strong />
          <Tile label="광고성 소식 동의" value={`${t.adConsent}명`} sub={`철회 ${t.adWithdrawn}명`} />
          <Tile label="구독자 중 결제" value={`${t.subPayers}명`} sub={`${t.subOrders}건, ${won(t.subRevenue)}`} />
          <Tile label={`${days}일 보낸 메일`} value={`${sent}통`} sub={`실패 ${sum(ds, 'failed')}, 건너뜀 ${sum(ds, 'skipped')}`} />
          <Tile label={`${days}일 메일로 들어온 사람`} value={`${clickers}명`} sub={`보낸 메일 대비 ${pct(clickers, sent)}`} />
        </div>
      </Box>

      <Box title={`신청 흐름 (${days}일, 기기 수)`} note="신청 칸 기록은 10월 22일부터 남깁니다(그 전 날은 0으로 보입니다). 신청 완료는 화면 기록, 새 구독은 서버 장부라 둘이 조금 다를 수 있어요.">
        <div style={grid(130)}>
          <Tile label="신청 칸이 보임" value={`${views}`} />
          <Tile label="홈 한 줄 펼침" value={`${sum(ds, 'opens')}`} />
          <Tile label="신청 누름" value={`${submits}`} sub={`보임 대비 ${pct(submits, views)}`} />
          <Tile label="신청 완료" value={`${subsDone}`} sub={`누름 대비 ${pct(subsDone, submits)}`} />
          <Tile label="실패" value={`${sum(ds, 'fails')}`} />
        </div>
      </Box>

      <Box title="날마다">
        <Table
          head={['날짜', '보임', '누름', '완료', '새 구독', '그만', '광고 동의', '보냄', '실패', '들어옴', '풀이', '충전 화면', '결제', '매출']}
          align={['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']}
          rows={recent.map((d) => [shortDay(d.day), d.views, d.submits, d.subs, d.newSubs, d.unsubs, d.newAdConsent, d.sent, d.failed, d.clickers, d.results, d.chargeOpen, d.payers, d.revenue ? won(d.revenue) : '-'])}
        />
      </Box>

      <Box title="어디서 신청했나">
        <Table head={['신청 자리', '전체', '지금 받는 사람']} align={['l', 'r', 'r']}
          rows={Object.entries(data.bySource).sort((a, b) => b[1].all - a[1].all).map(([k, v]) => [label(k), v.all, v.active])} />
      </Box>

      <Box title="신청 칸 자리별 흐름 (기기 수)">
        <Table head={['자리', '보임', '펼침', '누름', '완료', '실패']} align={['l', 'r', 'r', 'r', 'r', 'r']}
          rows={Object.entries(data.funnelSource).map(([k, v]) => [label(k), v.mail_signup_view || 0, v.mail_signup_open || 0, v.mail_signup_submit || 0, v.mail_subscribe || 0, v.mail_signup_fail || 0])} />
      </Box>

      <div style={grid(300)}>
        <Box title="나이대(구독자 출생 연도)">
          <Table head={['나이대', '사람']} align={['l', 'r']} rows={Object.entries(data.byAge).sort().map(([k, v]) => [k, v])} />
        </Box>
        <Box title="메일 링크별 들어온 사람">
          <Table head={['링크', '사람']} align={['l', 'r']}
            rows={Object.entries(data.byCampaign).map(([k, v]) => [k === 'ilju_daily' ? '내 사주로 오늘 전체 풀이' : k === 'ilju_daily_tti' ? '띠별 운세' : k, v])} />
        </Box>
        <Box title="광고성 동의를 받은 자리">
          <Table head={['자리', '사람']} align={['l', 'r']} rows={Object.entries(data.leadSource).map(([k, v]) => [label(k), v])} />
        </Box>
        <Box title="신청 실패 까닭">
          <Table head={['까닭', '번']} align={['l', 'r']} rows={Object.entries(data.failWhy).map(([k, v]) => [k, v])} />
        </Box>
      </div>
    </div>
  );
}
