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
  webVisitors?: number; webInputs?: number; hasStats?: boolean;
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
  daily_after: '오늘의 운세 다 읽은 바로 아래', newyear_tojung: '신년운세 화면 마감 알림', saju_card: '사주 카드(만세력) 아래', tojung_preview: '신년운세 미리 보기 아래',
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
  // 신청 비율은 하루 요약이 있는 날만으로 센다(오늘은 요약이 아직 없어 신청만 늘고 분모가 비어 비율이 부푼다)
  const withStats = ds.filter((d) => d.hasStats);
  const webInputs = sum(withStats, 'webInputs'); const newSubs = sum(withStats, 'newSubs'); const newAd = sum(withStats, 'newAdConsent');

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
          <Tile label="사주 넣은 웹 손님" value={`${webInputs}명`} sub="하루 요약을 더한 값" />
          <Tile label="그중 메일 받기 신청" value={pct(newSubs, webInputs)} sub={`새 구독 ${newSubs}명, 광고 동의 ${newAd}명`} strong />
        </div>
      </Box>

      <MailList />

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

/* 2026-10-24 오너 지시 '이메일 누가 우리한테 줬는지, 싫어하는 사람은 취소, 메일 뭐뭐 있는지 보이는 곳, CSV 내려받기'
 *   메일 준 사람 명단. 기본은 주소를 가리고, '주소 전부 보기'와 CSV 내려받기는 서버가 접근 기록(adminAudit)을 남긴다. */
interface MailRow {
  uid: string; owner: boolean; email: string; emailFull?: string; adEmailFull?: string; firstDay: string;
  daily: 'on' | 'off' | null; dailyDay: string; dailyOffDay: string; dailySource: string; age: string; ilju: string;
  ad: 'on' | 'off' | 'none' | null; adDay: string; adOffDay: string; adSource: string;
  inquiryDay?: string; inquiries?: number;
  paid: number; payCount: number;
}
type Filter = 'all' | 'daily' | 'ad' | 'off';
const FILTER_LABEL: Record<Filter, string> = { all: '전체', daily: '아침 메일 받는 중', ad: '광고 동의', off: '받지 않음' };

const dailyText = (r: MailRow) => r.daily === 'on' ? `받음 (${shortDay(r.dailyDay || r.firstDay)}부터)` : r.daily === 'off' ? `그만 (${r.dailyOffDay ? shortDay(r.dailyOffDay) : '-'})` : '-';
const adText = (r: MailRow) => r.ad === 'on' ? `동의 (${r.adDay ? shortDay(r.adDay) : '-'})` : r.ad === 'off' ? `철회 (${r.adOffDay ? shortDay(r.adOffDay) : '-'})` : r.ad === 'none' ? '없음(결과지 메일만)' : '-';
const whereText = (r: MailRow) => (r.dailySource || r.adSource ? label(r.dailySource || r.adSource) : r.inquiries ? '웹 문의(답장용)' : '-');

function matches(r: MailRow, f: Filter): boolean {
  return f === 'all' ? true : f === 'daily' ? r.daily === 'on' : f === 'ad' ? r.ad === 'on' : r.daily !== 'on' && r.ad !== 'on';
}

/** 엑셀에서 한글이 깨지지 않게 BOM 을 붙이고, 칸 안의 쉼표와 따옴표, 줄바꿈은 따옴표로 감싼다 */
function downloadCsv(rows: MailRow[], filter: Filter) {
  // = + - @ 로 시작하는 칸은 엑셀이 수식으로 읽는다. 손님이 넣은 메일 주소가 수식으로 실행되지 않게 앞에 ' 를 붙인다
  const q = (v: unknown) => {
    let t = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  // 광고 동의 명단의 '메일' 칸은 동의한 주소(emailLeads)다. 아침 메일 주소와 다를 수 있어 그대로 쓰면 동의 없는 주소에 광고가 간다
  const head = ['처음 준 날', '메일', '광고 받을 주소(동의한 주소)', '아침 메일', '아침 메일 시작', '아침 메일 그만', '광고성 소식', '광고 동의 날', '광고 철회 날', '신청한 자리', '웹 문의', '나이대', '메일 준 뒤 결제 건', '메일 준 뒤 결제 금액', '계정 번호', '오너 계정'];
  const adAddr = (r: MailRow) => (r.ad === 'on' ? r.adEmailFull || '' : '');
  const body = rows.map((r) => [
    r.firstDay, filter === 'ad' ? adAddr(r) : (r.emailFull || r.email), adAddr(r),
    r.daily === 'on' ? '받음' : r.daily === 'off' ? '그만' : '', r.dailyDay, r.dailyOffDay,
    r.ad === 'on' ? '동의' : r.ad === 'off' ? '철회' : r.ad === 'none' ? '없음' : '', r.adDay, r.adOffDay,
    whereText(r), r.inquiries ? `${r.inquiries}건 (${r.inquiryDay || '-'})` : '', r.age, r.payCount, r.paid, r.uid, r.owner ? '오너' : '',
  ].map(q).join(','));
  const csv = '﻿' + [head.join(','), ...body].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `사주500_메일명단_${FILTER_LABEL[filter].replace(/\s/g, '')}_${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function MailList() {
  const [rows, setRows] = useState<MailRow[] | null>(null);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState<Record<string, string>>({});
  const [armed, setArmed] = useState('');
  const [msg, setMsg] = useState('');
  const fetchRows = useCallback(async (withFull: boolean, purpose = 'view', show = true) => {
    const r = await callAdmin<{ rows: MailRow[] }>('adminMailList', withFull ? { full: true, purpose } : {});
    if (show) { setRows(r.rows); setFull(withFull); }
    return r.rows;
  }, []);
  const load = useCallback(() => {
    setBusy(true); setError('');
    fetchRows(false).catch((e) => setError(String(e?.message || e))).finally(() => setBusy(false));
  }, [fetchRows]);
  useEffect(() => { load(); }, [load]);

  const reveal = async (uid: string) => {
    try {
      const r = await callAdmin<{ email: string; adEmail?: string }>('adminMailList', { reveal: uid });
      setShown((m) => ({ ...m, [uid]: r.adEmail && r.adEmail !== r.email ? `${r.email} (광고: ${r.adEmail})` : r.email }));
    } catch (e: any) { setMsg(`주소를 불러오지 못했어요: ${String(e?.message || e)}`); }
  };
  const showAll = async () => {
    if (full) { setFull(false); setShown({}); setRows((rs) => (rs || []).map(({ emailFull: _e, adEmailFull: _a, ...r }) => r)); return; }
    setBusy(true); setMsg('');
    try { await fetchRows(true, 'view'); } catch (e: any) { setMsg(`주소를 불러오지 못했어요: ${String(e?.message || e)}`); } finally { setBusy(false); }
  };
  const csv = async () => {
    setBusy(true); setMsg('');
    try {
      // 내려받을 때마다 서버에서 새로 받는다(그 사이 수신 거부한 사람이 빠지게, 접근 기록이 남게). 화면은 가린 그대로 둔다
      const fresh = await fetchRows(true, 'csv', false);
      const pick = fresh.filter((r) => matches(r, filter));
      downloadCsv(pick, filter);
      setMsg(`${FILTER_LABEL[filter]} ${pick.length}명을 내려받았어요`);
    } catch (e: any) { setMsg(`내려받지 못했어요: ${String(e?.message || e)}`); } finally { setBusy(false); }
  };
  const optOut = async (uid: string) => {
    setMsg('');
    let done = '';
    try {
      const r = await callAdmin<{ done: string[]; accounts?: number }>('adminMailOptOut', { uid, scope: 'all', reason: '관리자 화면에서 오너가 끊음' });
      done = r.done.length
        ? `메일을 끊었어요${(r.accounts || 0) > 1 ? `(같은 주소를 쓰는 계정 ${r.accounts}개 모두)` : ''}. 다음 메일부터 보내지 않아요.`
        : '이미 받지 않는 사람이에요.';
      setMsg(done);
      setShown((m) => { const n = { ...m }; delete n[uid]; return n; }); // 끊은 사람의 '보기' 주소도 화면에서 지운다
    } catch (e: any) { setMsg(`끊지 못했어요: ${String(e?.message || e)}`); return; }
    // 명단 새로 고침이 실패해도 끊은 것은 끊은 것이다
    try { await fetchRows(full, 'view'); } catch { setMsg(`${done} 명단은 '새로 불러오기'를 눌러 주세요.`); }
  };

  if (error) return <Box title="메일 준 사람"><p style={{ color: K.red, fontSize: 14 }}>불러오지 못했어요: {error}</p></Box>;
  if (!rows) return <Box title="메일 준 사람"><p style={{ fontSize: 14, color: K.mute }}>{busy ? '명단을 불러오는 중이에요.' : ''}</p></Box>;
  const real = rows.filter((r) => !r.owner);
  const dailyOn = real.filter((r) => r.daily === 'on').length;
  const adOn = real.filter((r) => r.ad === 'on').length;
  const off = real.filter((r) => r.daily !== 'on' && r.ad !== 'on').length;
  const inq = real.filter((r) => (r.inquiries || 0) > 0).length;
  const payers = real.filter((r) => r.payCount > 0).length;
  const list = rows.filter((r) => matches(r, filter));
  const smallBtn = (on = false) => ({ padding: '5px 10px', borderRadius: 8, border: `1px solid ${on ? K.ink : K.line}`, background: on ? K.ink : K.surface, color: on ? '#F4EFE4' : K.ink, fontSize: 13, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }) as const;

  return (
    <>
      <Box title="메일 준 사람"
        right={<button type="button" onClick={load} disabled={busy} style={smallBtn()}>{busy ? '불러오는 중…' : '새로 불러오기'}</button>}
        note="주소는 기본으로 가려 둬요. '주소 전부 보기', 한 사람 '보기', CSV 내려받기는 누가 언제 봤는지 서버에 남아요(개인정보 접근 기록). 광고성 메일(할인, 신년운세 소식)은 '광고 동의' 명단에만 보낼 수 있어요. 아침 메일만 신청했거나 결과지, 문의로만 주소를 준 사람에게 광고를 보내면 법 위반이에요. 내려받은 파일은 쓴 뒤 지워 주세요. '그만 보내기'는 문의로 메일을 그만 받고 싶다고 한 손님에게 써요(아침 메일과 광고성 소식 둘 다, 같은 주소를 쓰는 다른 계정까지 끊어요). 그만 받은 사람의 주소는 처리방침대로 지우고 기록만 남겨요.">
        <div style={grid(140)}>
          <Tile label="메일 준 사람" value={`${real.length}명`} sub="오너 계정 빼고" strong />
          <Tile label="아침 메일 받는 중" value={`${dailyOn}명`} />
          <Tile label="광고성 소식 동의" value={`${adOn}명`} sub={`메일 준 사람의 ${pct(adOn, real.length)}`} />
          <Tile label="받지 않음" value={`${off}명`} sub={`그만 받음, 결과지만, 문의만(문의 ${inq}명)`} />
          <Tile label="메일 준 뒤 결제" value={`${payers}명`} sub={won(real.reduce((a, r) => a + r.paid, 0))} />
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '10px 0 8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {(Object.keys(FILTER_LABEL) as Filter[]).map((v) => (
            <button key={v} type="button" onClick={() => setFilter(v)} style={smallBtn(filter === v)}>{FILTER_LABEL[v]}</button>
          ))}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={showAll} disabled={busy} style={smallBtn(full)}>{full ? '주소 가리기' : '주소 전부 보기'}</button>
          <button type="button" onClick={csv} disabled={busy || !list.length} style={smallBtn()}>CSV 내려받기 ({FILTER_LABEL[filter]} {list.length}명)</button>
        </div>
        {msg && <p style={{ fontSize: 13, color: msg.includes('못') ? K.red : K.green, margin: '0 0 8px' }}>{msg}</p>}
        <Table
          head={['처음 준 날', '메일', '아침 메일', '광고성 소식', '신청한 자리', '문의', '나이대', '메일 준 뒤 결제', '']}
          align={['l', 'l', 'l', 'l', 'l', 'l', 'l', 'r', 'l']}
          rows={list.map((r) => [
            r.firstDay ? shortDay(r.firstDay) : '-',
            <span>
              {r.emailFull || shown[r.uid] || r.email || '(그만 받음, 주소 숨김)'}{r.adEmailFull && r.adEmailFull !== r.emailFull ? ` (광고: ${r.adEmailFull})` : ''}{r.owner ? ' (오너)' : ''}{' '}
              {!r.emailFull && !shown[r.uid] && !!r.email && <button type="button" onClick={() => reveal(r.uid)} style={{ border: 0, background: 'none', color: K.goldDeep, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>보기</button>}
            </span>,
            dailyText(r), adText(r), whereText(r), r.inquiries ? `${r.inquiries}건` : '-', r.age || '-',
            r.payCount ? `${r.payCount}건 ${won(r.paid)}` : '-',
            r.daily === 'on' || r.ad === 'on'
              ? <button type="button" onClick={() => { if (armed === r.uid) { setArmed(''); optOut(r.uid); } else setArmed(r.uid); }}
                  style={{ padding: '3px 8px', borderRadius: 8, border: `1px solid ${K.line}`, background: K.surface, fontSize: 12.5, fontWeight: 700, color: armed === r.uid ? K.red : K.ink, cursor: 'pointer' }}>
                  {armed === r.uid ? '한 번 더 누르면 끊어요' : '그만 보내기'}
                </button>
              : '',
          ])}
        />
      </Box>
      <MailKinds />
    </>
  );
}

/** 우리가 손님에게 보내는 메일 (서버 코드 기준, 2026-10-24) */
function MailKinds() {
  return (
    <Box title="우리가 보내는 메일" note="보내는 주소는 모두 사주500 메일 하나예요. 광고성 메일에는 제목 앞 (광고), 밤 9시부터 아침 8시까지 보내지 않음, 보내는 곳(주라벨 주식회사, 주소, 연락처), 수신 거부 링크와 메일 앱의 한 번 누르기 거부가 들어가 있어요. 광고성 동의는 2년마다 다시 확인해야 해요(첫 동의 10월 17일, 2028년 10월 전에 확인 메일).">
      <Table
        head={['메일', '언제', '누구에게', '광고', '그만 받기', '서버 코드']}
        align={['l', 'l', 'l', 'l', 'l', 'l']}
        rows={[
          ['아침 일주 운세', '매일 아침 7시', '아침 메일 신청자(웹)', '아님(신청한 운세)', '메일 아래 수신 거부, 한 번 누르기', 'ilju/iljuDaily.ts sendDailyMail'],
          ['아침 메일 신청 확인', '신청 바로', '신청한 사람', '아님', '같음', 'ilju/iljuDaily.ts subscribeDailyMail'],
          ['광고성 소식 동의 확인', '동의 바로', '동의한 사람', '아님(동의 처리 안내)', '수신 거부 링크', 'mail/marketingMail.ts'],
          ['종합사주 결과지(PDF)', '손님이 메일로 받기를 누를 때', '그 손님(하루 5통까지)', '아님', '광고 동의했으면 그만 받기 링크', 'pdf/mailPdf.ts'],
          ['2027 신년운세 출시 기념가 마감', '11월 28일 오전 10시 한 번', '광고성 소식 동의한 사람', '(광고)', '수신 거부 링크, 한 번 누르기', 'mail/marketingMail.ts sendNewYearDeadlineMail'],
          ['웹 문의 답장', '오너가 관리자에서 답장할 때', '문의에 메일을 남긴 사람', '아님', '-', 'support/inquiry.ts'],
        ]}
      />
    </Box>
  );
}
