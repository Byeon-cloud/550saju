// 어드민 — ⑦ 유입 탭 (2026-06-10)
//   utm_source별 방문·콘텐츠진입·충전 테이블(전환율) + direct 비율 + share_click 추이
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { AdminData } from './_useAdminData';
import {
  C, Kpi, Section, Empty, CsvButton, DataTable, deltaPct, fmtNum, fmtPct,
} from './_components';
import type { Col } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

// 공유 페이지 경로 → 보기 좋은 라벨 (선택적 매핑 — 매칭 안 되면 raw 경로 노출)
const SHARE_PAGE_LABEL: Array<[RegExp, string]> = [
  [/^\/result\//, '종합사주 결과'],
  [/^\/topic\//, '주제분석 결과'],
  [/^\/daily/, '오늘운세'],
  [/^\/dream/, '꿈해몽'],
  [/^\/daeun/, '대운'],
  [/^\/monthly/, '월운'],
  [/^\/compat/, '궁합'],
  [/^\/tojung/, '토정비결'],
  [/^\/chat/, '사주대화'],
  [/^\/share\//, '공유 링크'],
  [/^\/?$/, '홈'],
];
const sharePageLabel = (path: string): string => {
  for (const [re, label] of SHARE_PAGE_LABEL) if (re.test(path)) return label;
  return path;
};

// 공유자 운 잔액대 — 표시 순서 고정 (집계 case 와 동일 밴드)
const BALANCE_BANDS = ['0', '1-3운', '4-9운', '10운+'] as const;

export function TabAcquisition({ d }: { d: AdminData }) {
  const { cur, prev } = d;

  const utmRows = useMemo(() =>
    Object.entries(cur.utm).map(([source, v]) => ({
      source,
      visits: v.visits,
      contentOpens: v.contentOpens,
      openRate: v.visits > 0 ? Math.round((v.contentOpens / v.visits) * 100) : null,
      charges: v.charges,
      chargeRate: v.visits > 0 ? Math.round((v.charges / v.visits) * 1000) / 10 : null,
      prevVisits: prev.utm[source]?.visits ?? 0,
      delta: deltaPct(v.visits, prev.utm[source]?.visits ?? 0),
    })).sort((a, b) => b.visits - a.visits),
  [cur.utm, prev.utm]);

  const totalVisits = utmRows.reduce((a, r) => a + r.visits, 0);
  const directVisits = cur.utm['direct']?.visits ?? 0;
  const directRatio = totalVisits > 0 ? Math.round((directVisits / totalVisits) * 100) : null;

  const utmCols: Col[] = [
    { key: 'source', label: 'utm_source', render: (v) => <b style={{ color: C.ink, wordBreak: 'break-all' }}>{v}</b> },
    { key: 'visits', label: '방문(세션)', numeric: true },
    { key: 'contentOpens', label: '콘텐츠 진입', numeric: true },
    { key: 'openRate', label: '진입률', numeric: true, render: (v) => fmtPct(v) },
    { key: 'charges', label: '충전 완료', numeric: true },
    { key: 'chargeRate', label: '충전전환', numeric: true, render: (v) => (v == null ? '-' : `${v}%`) },
    { key: 'delta', label: '방문 증감', numeric: true, render: (v) => fmtPct(v) },
  ];

  const shareSeries = useMemo(() => cur.days.map((day, i) => ({
    day: day.slice(5),
    cur: cur.shareByDay[i],
    done: cur.shareCompleteByDay?.[i] ?? 0,
    prev: prev.shareByDay[i] ?? 0,
  })), [cur, prev]);
  const hasShare = cur.shareClicks > 0 || prev.shareClicks > 0;

  // 바이럴 퍼널 v2 (2026-07-03) — 시도→성사→리워드→수신
  const shareRewardCount = cur.rewardByKind?.['share']?.count ?? 0;
  const completeRate = cur.shareClicks > 0 ? Math.round((cur.shareCompletes / cur.shareClicks) * 100) : null;
  const METHOD_LABEL: Record<string, string> = {
    toss_viral: '토스 친구초대 (SDK)', toss_share: '토스 공유', web_share: '웹 공유 (네이티브)',
    web_share_file: '이미지 공유', clipboard: '링크·이미지 복사', download: '이미지 저장',
  };
  const TYPE_LABEL: Record<string, string> = {
    invite: '친구초대 (리워드형)', result: '종합사주', topic: '주제분석', daily: '오늘운세',
    dream: '꿈해몽', card: '사주 카드', event_invite: '이벤트 초대', premium: '종합사주',
  };
  const methodRows = useMemo(() =>
    Object.entries(cur.shareCompleteByMethod ?? {})
      .map(([m, n]) => ({ label: METHOD_LABEL[m] ?? m, n }))
      .sort((a, b) => b.n - a.n),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [cur]);
  const typeRows = useMemo(() => {
    const clicks = cur.shareClickByType ?? {};
    const dones = cur.shareCompleteByType ?? {};
    const keys = Array.from(new Set([...Object.keys(clicks), ...Object.keys(dones)]));
    return keys.map((k) => ({
      label: TYPE_LABEL[k] ?? k,
      clicks: clicks[k] ?? 0,
      dones: dones[k] ?? 0,
      rate: (clicks[k] ?? 0) > 0 ? Math.round(((dones[k] ?? 0) / clicks[k]) * 100) : null,
    })).sort((a, b) => b.clicks - a.clicks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  // 구매·충전 일별 추이 (2026-06-27) — 폭증 감지용
  const purchaseSeries = useMemo(() => cur.days.map((day, i) => ({
    day: day.slice(5),
    구매: cur.purchasesByDay?.[i] ?? 0,
    충전: cur.chargesByDay?.[i] ?? 0,
  })), [cur]);
  const hasPurchaseSeries = (cur.purchasesByDay?.some((v) => v > 0)) || (cur.chargesByDay?.some((v) => v > 0));

  // 공유 분해 — 페이지별 분포 (건수 내림차순)
  const sharePageRows = useMemo(() =>
    Object.entries(cur.shareByPage).map(([page, count]) => ({
      page,
      label: sharePageLabel(page),
      count,
    })).sort((a, b) => b.count - a.count),
  [cur.shareByPage]);

  const sharePageCols: Col[] = [
    { key: 'label', label: '화면', render: (v, r) => (
      <span>
        <b style={{ color: C.ink }}>{v}</b>
        {r.label !== r.page && <span style={{ color: C.mute, fontSize: 11, marginLeft: 6, wordBreak: 'break-all' }}>{r.page}</span>}
      </span>
    ) },
    { key: 'count', label: '공유 건수', numeric: true, render: (v) => <b style={{ color: C.ink }}>{fmtNum(v)}건</b> },
  ];

  // 공유 분해 — 공유자 운 잔액대 (순서 고정 막대)
  const balanceBandRows = BALANCE_BANDS.map((band) => ({ band, count: cur.shareByBalanceBand[band] ?? 0 }));
  const balanceBandMax = Math.max(1, ...balanceBandRows.map((r) => r.count));
  const hasBalanceBand = balanceBandRows.some((r) => r.count > 0);

  const exportCsv = () => {
    const headers = ['utm_source', '방문', '콘텐츠진입', '진입률%', '충전완료', '충전전환%', '전기간방문'];
    const rows = utmRows.map((r) => [r.source, r.visits, r.contentOpens, r.openRate ?? '', r.charges, r.chargeRate ?? '', r.prevVisits]);
    downloadCsv(csvFilename('acquisition_utm', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section title="유입 KPI" right={<CsvButton onClick={exportCsv} label="유입 CSV" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="채널 수" value={`${fmtNum(utmRows.length)}개`} sub="utm_source 고유 (direct 포함)" />
          <Kpi label="direct 비율" value={fmtPct(directRatio)} sub={`direct ${fmtNum(directVisits)} / 전체 ${fmtNum(totalVisits)}`} />
        </div>
      </Section>

      <Section
        title="구매·충전 추이 (일별) — 폭증 감지"
        caption="· 콘텐츠구매 + 충전결제를 일별로. 특정 날 스파이크 = 유입 폭증 · 시간대·소스 정밀 분해는 adminInflowReport 함수(?key=&days=)"
      >
        {!hasPurchaseSeries ? <Empty text="아직 구매 데이터 없음" /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={purchaseSeries} margin={{ left: 0, right: 8 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: C.mute }} width={32} allowDecimals={false} />
                <Tooltip formatter={(v: any, name: any) => [`${fmtNum(Number(v))}건`, name]} />
                <Line type="monotone" dataKey="구매" stroke={C.gold} strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="충전" stroke="#5A7CA8" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section
        title="utm_source별 전환"
        caption="· 태그 링크는 그 source(?utm_source=threads 등) · 앱인토스 무태그 = toss_app(토스 내부/딥링크) · 웹 무태그 = direct · 충전전환 = 충전완료 ÷ 방문"
      >
        <DataTable columns={utmCols} rows={utmRows} initialSortKey="visits" />
      </Section>

      <Section
        title="공유 분해 (바이럴)"
        caption="· 한명당 평균 공유 = 총 공유 클릭 ÷ 공유한 유저 수 (값이 클수록 1인당 전파력↑) · 화면 = 공유 클릭이 발생한 페이지 경로 · 잔액대 = 공유 시점 공유자의 운 잔액"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
          <Kpi label="총 공유 클릭" value={`${fmtNum(cur.shareClicks)}회`} delta={deltaPct(cur.shareClicks, prev.shareClicks)} />
          <Kpi label="공유한 유저 수" value={`${fmtNum(cur.sharerCount)}명`} delta={deltaPct(cur.sharerCount, prev.sharerCount)} />
          <Kpi label="한명당 평균 공유" value={`${cur.sharesPerUser}회`} sub="총 공유 ÷ 공유 유저" />
        </div>

        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: C.mute, marginBottom: 8 }}>페이지별 공유 분포</h3>
          {sharePageRows.length === 0
            ? <Empty text="아직 페이지별 공유 데이터 없음" />
            : <DataTable columns={sharePageCols} rows={sharePageRows} initialSortKey="count" />}
        </div>

        <div>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: C.mute, marginBottom: 8 }}>공유자 운 잔액대</h3>
          {!hasBalanceBand
            ? <Empty text="아직 잔액대 데이터 없음" />
            : (
              <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '14px 16px' }}>
                {balanceBandRows.map((r) => (
                  <div key={r.band} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                    <span style={{ width: 56, fontSize: 12, fontWeight: 700, color: C.ink, flexShrink: 0 }}>{r.band}</span>
                    <div style={{ flex: 1, height: 14, background: '#F3EFE6', borderRadius: 7, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(r.count > 0 ? 3 : 0, Math.round((r.count / balanceBandMax) * 100))}%`, height: '100%', background: C.gold, borderRadius: 7 }} />
                    </div>
                    <span style={{ width: 70, fontSize: 12, color: C.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      <b>{fmtNum(r.count)}건</b>
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </Section>

      <Section
        title="바이럴 퍼널 (공유)"
        caption="· 시도 = 공유 버튼 클릭(share_click) — 성사 = 실제 공유 완료(share_complete: 토스 SDK sendViral·웹 공유 확정·복사) — 리워드 = 일 3회 한도 내 적립 — 수신 = 공유 링크로 들어온 방문(invite_received)"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }}>
          <Kpi label="공유 시도" value={fmtNum(cur.shareClicks)} />
          <Kpi label="공유 성사" value={fmtNum(cur.shareCompletes)} sub={completeRate != null ? `성사율 ${completeRate}%` : undefined} accent />
          <Kpi label="리워드 적립" value={fmtNum(shareRewardCount)} sub="일 3회 한도 내 (kind=share)" />
          <Kpi label="공유 유입" value={fmtNum(cur.inviteReceived)} sub="공유 링크 수신 방문" />
        </div>

        {/* 성사 경로별 — 토스 SDK vs 일반 공유 분해 (준기 요청 2026-07-03) */}
        {methodRows.length > 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '12px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, marginBottom: 8 }}>성사 경로별 (share_complete method)</div>
            {methodRows.map((r) => {
              const max = methodRows[0]?.n || 1;
              return (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 140, fontSize: 12, color: C.ink, flexShrink: 0 }}>{r.label}</span>
                  <div style={{ flex: 1, height: 14, background: '#F3EFE6', borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(3, Math.round((r.n / max) * 100))}%`, height: '100%', background: C.gold, borderRadius: 7 }} />
                  </div>
                  <span style={{ width: 56, fontSize: 12, color: C.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}><b>{fmtNum(r.n)}건</b></span>
                </div>
              );
            })}
          </div>
        )}

        {/* 종류별 시도→성사 — 친구초대(리워드형) vs 콘텐츠 공유 */}
        {typeRows.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <DataTable
              rows={typeRows}
              columns={[
                { key: 'label', label: '공유 종류', render: (v) => <b style={{ color: C.ink }}>{v}</b> },
                { key: 'clicks', label: '시도', numeric: true },
                { key: 'dones', label: '성사', numeric: true },
                { key: 'rate', label: '성사율', numeric: true, render: (v) => (v == null ? '-' : `${v}%`) },
              ] as Col[]}
            />
          </div>
        )}

        {!hasShare ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.mute, padding: '0 8px 6px' }}>일별 추이 — 골드 = 시도 · 그린 = 성사 · 점선 = 직전 기간 시도</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={shareSeries} margin={{ left: 0, right: 8 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: C.mute }} width={32} allowDecimals={false} />
                <Tooltip formatter={(v: any, name: any) => [`${fmtNum(Number(v))}회`, name === 'cur' ? '시도' : name === 'done' ? '성사' : '직전 기간']} />
                <Line type="monotone" dataKey="cur" stroke={C.gold} strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="done" stroke="#6FA08C" strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="prev" stroke={C.mute} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>
    </div>
  );
}
