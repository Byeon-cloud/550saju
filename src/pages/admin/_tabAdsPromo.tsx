// 어드민 — ⑥ 광고·프로모 탭 (2026-06-10)
//   ad 4종 카운트 + CTR + fill rate + 진단 캡션 + 리워드 kind별 추이
import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { AdminData } from './_useAdminData';
import {
  C, Kpi, Section, Empty, CsvButton, MiniStat, deltaPct, fmtNum,
} from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

const REWARD_TREND_KINDS = ['attend7', 'daily', 'streak3', 'share'];
const REWARD_COLORS: Record<string, string> = {
  attend7: '#B5441F', daily: '#B8965A', streak3: '#5A7CA8', share: '#6FA08C',
};
const REWARD_LABEL: Record<string, string> = {
  attend7: '7일 출석', daily: '데일리', streak3: '3일 연속', share: '공유',
};

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
        title="리워드 적립 추이 (kind별 일별)"
        caption="· reward_earned 이벤트 — attend7(7일 출석) / daily(데일리) / streak3(3일 연속) / share(공유)"
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
