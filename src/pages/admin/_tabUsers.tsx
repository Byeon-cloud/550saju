// 어드민 — ④ 유저 탭 (2026-06-10)
//   DAU 시계열 + 리텐션 D1/D7(근사) + 방문빈도 분포 + 리워드 적립 현황
import { useMemo } from 'react';
import {
  ComposedChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import type { AdminData } from './_useAdminData';
import {
  C, Kpi, Section, Empty, CsvButton, DataTable, deltaPct, fmtNum, fmtPct, CONTENT_COLORS,
} from './_components';
import type { Col } from './_components';
import { buildCsv, downloadCsv, csvFilename } from './_csv';

const REWARD_LABEL: Record<string, string> = {
  daily: '데일리 출석', attend7: '7일 출석', streak3: '3일 연속', share: '공유 리워드',
  launch: '런칭 프로모', unknown: '기타',
};

export function TabUsers({ d }: { d: AdminData }) {
  const { cur, prev } = d;

  const dauSeries = useMemo(() => cur.days.map((day, i) => ({
    day: day.slice(5),
    cur: cur.dauByDay[i],
    prev: prev.dauByDay[i] ?? 0,
  })), [cur, prev]);

  const freqBars = useMemo(() => ([
    { label: '1회 방문', n: cur.visitFreq.once, pn: prev.visitFreq.once },
    { label: '2~3회', n: cur.visitFreq.few, pn: prev.visitFreq.few },
    { label: '4회 이상', n: cur.visitFreq.many, pn: prev.visitFreq.many },
  ]), [cur.visitFreq, prev.visitFreq]);

  const rewardRows = useMemo(() => {
    const kinds = new Set([...Object.keys(cur.rewardByKind), ...Object.keys(prev.rewardByKind)]);
    return Array.from(kinds).map((kind) => {
      const c = cur.rewardByKind[kind] ?? { count: 0, amount: 0 };
      const p = prev.rewardByKind[kind] ?? { count: 0, amount: 0 };
      return {
        label: REWARD_LABEL[kind] || kind,
        kind,
        count: c.count,
        amount: Math.round(c.amount * 100) / 100,
        prevCount: p.count,
        delta: deltaPct(c.count, p.count),
      };
    }).sort((a, b) => b.count - a.count);
  }, [cur.rewardByKind, prev.rewardByKind]);

  const rewardCols: Col[] = [
    { key: 'label', label: '리워드 종류' },
    { key: 'kind', label: 'kind', render: (v) => <span style={{ fontSize: 11, color: C.mute }}>{v}</span> },
    { key: 'count', label: '지급 건수', numeric: true },
    { key: 'amount', label: '지급 운 합계', numeric: true },
    { key: 'prevCount', label: '전기간', numeric: true },
    { key: 'delta', label: '증감', numeric: true, render: (v) => fmtPct(v) },
  ];

  const exportCsv = () => {
    const headers = ['리워드', 'kind', '지급건수', '지급운합계', '전기간건수'];
    const rows = rewardRows.map((r) => [r.label, r.kind, r.count, r.amount, r.prevCount]);
    downloadCsv(csvFilename('users_reward', cur.days[0], cur.days[cur.days.length - 1]), buildCsv(headers, rows));
  };

  return (
    <div>
      <Section title="유저 KPI" right={<CsvButton onClick={exportCsv} label="리워드 CSV" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="누적 가입" value={`${fmtNum(d.totalUsers)}명`} />
          <Kpi label="기간 고유 방문" value={`${fmtNum(cur.visitors)}명`} delta={deltaPct(cur.visitors, prev.visitors)} />
          <Kpi label="DAU 평균" value={`${fmtNum(cur.dauAvg)}명`} delta={deltaPct(cur.dauAvg, prev.dauAvg)} />
          <Kpi label="D1 재방문" value={fmtPct(cur.retention.d1Rate)} sub={`코호트 ${fmtNum(cur.retention.cohortD1)}명 · 근사치`} />
          <Kpi label="D7 재방문" value={fmtPct(cur.retention.d7Rate)} sub={`코호트 ${fmtNum(cur.retention.cohortD7)}명 · 근사치`} />
          <Kpi label="리워드 지급" value={`${fmtNum(cur.rewardTotal)}건`} delta={deltaPct(cur.rewardTotal, prev.rewardTotal)} />
        </div>
      </Section>

      <Section title="DAU 추이" caption="· 실선 = 현 기간 — 점선 = 직전 동일 기간 (기기 ID 기준 고유 방문)">
        {dauSeries.every((p) => p.cur === 0 && p.prev === 0) ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dauSeries} margin={{ left: 0, right: 8 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.mute }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: C.mute }} width={36} allowDecimals={false} />
                <Tooltip formatter={(v: any, name: any) => [`${fmtNum(Number(v))}명`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="cur" name="현 기간" stroke={C.gold} strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="prev" name="직전 기간" stroke={C.mute} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section
        title="성별 · 연령대 분포"
        caption="· 본인 사주 프로필(성별·출생연도)에서 파생 — 프로필 입력한 방문자만 집계. 괄호 = 결제 유저"
      >
        {(() => {
          const genderBars = [
            { label: '남성', n: cur.demoGender['M'] ?? 0, pay: cur.payingGender['M'] ?? 0 },
            { label: '여성', n: cur.demoGender['F'] ?? 0, pay: cur.payingGender['F'] ?? 0 },
          ];
          const AGE_ORDER = ['10대', '20대', '30대', '40대', '50대', '60대+'];
          const ageBars = AGE_ORDER
            .map((ab) => ({ label: ab, n: cur.demoAge[ab] ?? 0 }))
            .filter((b) => b.n > 0);
          const empty = genderBars.every((b) => b.n === 0) && ageBars.length === 0;
          if (empty) return <Empty text="아직 데이터 없음 — 사주 프로필을 입력한 방문이 누적되면 표시돼요" />;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
                <p style={{ fontSize: 11, color: C.mute, padding: '0 8px 6px' }}>성별 (고유 방문자)</p>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={genderBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={56} tick={{ fontSize: 12, fill: C.ink }} />
                    <Tooltip formatter={(v: any, _n: any, p: any) => [`${fmtNum(Number(v))}명 (결제 ${fmtNum(p?.payload?.pay ?? 0)}명)`, '방문자']} />
                    <Bar dataKey="n" radius={[0, 6, 6, 0]}>
                      <Cell fill="#5A7CA8" />
                      <Cell fill="#C88A95" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
                <p style={{ fontSize: 11, color: C.mute, padding: '0 8px 6px' }}>연령대 (고유 방문자)</p>
                <ResponsiveContainer width="100%" height={Math.max(110, ageBars.length * 32)}>
                  <BarChart data={ageBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={56} tick={{ fontSize: 12, fill: C.ink }} />
                    <Tooltip formatter={(v: any) => [`${fmtNum(Number(v))}명`, '방문자']} />
                    <Bar dataKey="n" radius={[0, 6, 6, 0]}>
                      {ageBars.map((_, i) => <Cell key={i} fill={CONTENT_COLORS[i % CONTENT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
      </Section>

      <Section
        title="방문빈도 분포"
        caption="· 기간 내 방문 '일수' 기준 (uid 우선, 비로그인은 sid) — 4회+ 비중이 코어 유저 신호"
      >
        {freqBars.every((b) => b.n === 0) ? <Empty /> : (
          <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={freqBars} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={76} tick={{ fontSize: 12, fill: C.ink }} />
                <Tooltip formatter={(v: any, _n: any, p: any) => [`${fmtNum(Number(v))}명 (전기간 ${fmtNum(p?.payload?.pn ?? 0)})`, '유저']} />
                <Bar dataKey="n" radius={[0, 6, 6, 0]}>
                  {freqBars.map((_, i) => <Cell key={i} fill={CONTENT_COLORS[i % CONTENT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section
        title="리워드 적립 현황 (reward_earned)"
        caption="· 리텐션 D1/D7 은 기간 윈도우 내 첫 방문일 기준 근사치 — 윈도우 이전 기존 유저도 '첫 방문'으로 집계됨. 정확한 코호트는 GA4 참조."
      >
        <DataTable columns={rewardCols} rows={rewardRows} initialSortKey="count" />
      </Section>
    </div>
  );
}
