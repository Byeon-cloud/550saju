// 어드민 — ⑥ 광고·프로모 탭 (2026-06-10)
//   ad 4종 카운트 + CTR + fill rate + 진단 캡션 + 리워드 kind별 추이
import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { AdminData } from './_useAdminData';
import {
  C, Kpi, Section, Empty, CsvButton, MiniStat, DataTable, deltaPct, fmtNum, fmtWon,
} from './_components';
import type { Col } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

// 내부 운 리워드 (실지급 원화 아님 — 운 단위 적립)
const REWARD_TREND_KINDS = ['attend7', 'daily', 'streak3', 'share'];
const REWARD_COLORS: Record<string, string> = {
  attend7: '#B5441F', daily: '#B8965A', streak3: '#5A7CA8', share: '#6FA08C',
};
const REWARD_LABEL: Record<string, string> = {
  attend7: '7일 출석 완주', daily: '데일리 출석 (0.1운)', streak3: '3일 연속 (1운)', share: '공유 리워드',
};

// 토스 프로모 실지급(원화) — kind 가 'promo_' 로 시작. amount 는 원(₩).
//   코드 매칭으로 사람이 읽을 라벨 부여 (테스트 프로모는 '(테스트)' 부기).
function promoLabel(kind: string): string {
  const test = kind.includes('TEST_') ? ' (테스트)' : '';
  if (kind.includes('01KTRSZ')) return `첫출석 10원 프로모${test}`;
  if (kind.includes('01KPQJ')) return `7일 완주 100원 프로모${test}`;
  return `${kind}${test}`;
}

export function TabAdsPromo({ d }: { d: AdminData }) {
  const { cur, prev } = d;
  const ad = cur.adStats;
  const adPrev = prev.adStats;

  const ctr = ad.impression > 0 ? Math.round((ad.click / ad.impression) * 1000) / 10 : null;
  const ctrPrev = adPrev.impression > 0 ? Math.round((adPrev.click / adPrev.impression) * 1000) / 10 : 0;
  const fillDen = ad.impression + ad.nofill;
  const fillRate = fillDen > 0 ? Math.round((ad.impression / fillDen) * 1000) / 10 : null;

  // 리워드 kind별 일별 추이
  const rewardSeries = useMemo(() => cur.days.map((day, i) => {
    const point: Record<string, any> = { day: day.slice(5) };
    REWARD_TREND_KINDS.forEach((kind) => {
      point[kind] = cur.rewardKindByDay[kind]?.[i] ?? 0;
    });
    return point;
  }), [cur]);
  const hasReward = REWARD_TREND_KINDS.some((k) => (cur.rewardKindByDay[k] ?? []).some((n) => n > 0));

  // 프로모 실지급(토스 원화) — rewardByKind 에서 kind.startsWith('promo_') 만 모음.
  //   amount = 원(₩) 합. 항목별 {라벨, 건수, 지급액(₩)} + 총 지급액(₩).
  const promoRows = useMemo(() => {
    return Object.entries(cur.rewardByKind)
      .filter(([kind]) => kind.startsWith('promo_'))
      .map(([kind, v]) => ({ label: promoLabel(kind), count: v.count, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [cur]);
  const promoTotalAmount = useMemo(() => promoRows.reduce((s, r) => s + r.amount, 0), [promoRows]);
  const promoTotalCount = useMemo(() => promoRows.reduce((s, r) => s + r.count, 0), [promoRows]);
  const promoCols: Col<{ label: string; count: number; amount: number }>[] = [
    { key: 'label', label: '프로모' },
    { key: 'count', label: '건수', numeric: true },
    { key: 'amount', label: '지급액(₩)', numeric: true, render: (v: number) => fmtWon(v) },
  ];

  const exportCsv = () => {
    const headers = ['지표', '현 기간', '직전 기간'];
    const rows: (string | number)[][] = [
      ['광고 노출', ad.impression, adPrev.impression],
      ['광고 클릭', ad.click, adPrev.click],
      ['노필(nofill)', ad.nofill, adPrev.nofill],
      ['로드 실패', ad.fail, adPrev.fail],
      ['CTR%', ctr ?? '', ctrPrev],
      ['Fill rate%', fillRate ?? '', ''],
      ...REWARD_TREND_KINDS.map((k) => [
        `리워드 ${REWARD_LABEL[k]}`,
        cur.rewardByKind[k]?.count ?? 0,
        prev.rewardByKind[k]?.count ?? 0,
      ] as (string | number)[]),
    ];
    downloadCsv(csvFilename('ads_promo', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section title="광고 KPI (앱인토스 배너)" right={<CsvButton onClick={exportCsv} label="광고 CSV" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
          <MiniStat label="노출 (impression)" value={ad.impression} delta={deltaPct(ad.impression, adPrev.impression)} />
          <MiniStat label="클릭 (click)" value={ad.click} delta={deltaPct(ad.click, adPrev.click)} />
          <MiniStat label="노필 (nofill)" value={ad.nofill} delta={deltaPct(ad.nofill, adPrev.nofill)} />
          <MiniStat label="실패 (fail)" value={ad.fail} delta={deltaPct(ad.fail, adPrev.fail)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="CTR" value={ctr == null ? '-' : `${ctr}%`} delta={ctr == null ? undefined : deltaPct(ctr, ctrPrev)} sub="클릭 ÷ 노출" />
          <Kpi label="Fill rate" value={fillRate == null ? '-' : `${fillRate}%`} sub="노출 ÷ (노출+노필)" />
        </div>
        {ad.impression === 0 && (
          <p style={{ fontSize: 11, color: C.down, marginTop: 8, lineHeight: 1.6, padding: '8px 12px', background: 'rgba(192,57,43,0.06)', borderRadius: 8 }}>
            노출 0건 — 토스 콘솔 광고 지면(그룹ID)·앱 버전 매칭 문제 의심. silent-hide 라 사용자 화면에서는 빈 영역으로만 보임 → 토스 개발자 콘솔에서 지면 상태 확인 필요.
          </p>
        )}
      </Section>

      <Section
        title="프로모 지급 (토스 원화)"
        caption="· reward_earned 이벤트 중 kind 가 promo_ 로 시작 — 토스를 통해 실제 원화로 지급된 프로모. 지급액 단위는 원(₩)."
      >
        {promoRows.length === 0 ? <Empty text="프로모 실지급 내역 없음 — 토스 프로모 지급이 누적되면 표시돼요" /> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
              <Kpi label="총 지급액 (₩)" value={fmtWon(promoTotalAmount)} sub={`${fmtNum(promoTotalCount)}건 · 토스 실지급`} accent />
            </div>
            <DataTable columns={promoCols} rows={promoRows} initialSortKey="amount" />
          </>
        )}
      </Section>

      <Section
        title="리워드 적립 추이 (내부 운 · kind별 일별)"
        caption="· reward_earned 이벤트 (내부 운 적립 — 실지급 원화 아님) — daily(데일리 출석 0.1운) / streak3(3일 연속 1운) / attend7(7일 출석 완주) / share(공유 리워드)"
      >
        {!hasReward ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rewardSeries} margin={{ left: 0, right: 8 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: C.mute }} width={32} allowDecimals={false} />
                <Tooltip formatter={(v: any, name: any) => [`${fmtNum(Number(v))}건`, REWARD_LABEL[String(name)] || name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => REWARD_LABEL[String(v)] || v} />
                {REWARD_TREND_KINDS.map((kind) => (
                  <Line key={kind} type="monotone" dataKey={kind} stroke={REWARD_COLORS[kind]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>
    </div>
  );
}
