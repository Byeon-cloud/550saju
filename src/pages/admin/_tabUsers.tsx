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

// 실제 발생하는 reward_earned kind 만 (2026-06-18 정확성 — auto_refund 는 환불이라 집계 제외, launch 는 미발생 유령 라벨 제거)
const REWARD_LABEL: Record<string, string> = {
  daily: '데일리 출석 (0.1운)', streak3: '3일 연속 (1운)', attend7: '7일 출석 (토스)', share: '공유 리워드 (0.5운)',
  unknown: '기타',
};

/** 그라데이션 히어로 카드 — 핵심 결론을 평어로 (2026-06-18 · 레퍼런스 디자인 언어). */
function HeroCard({ grad, label, big, sub }: { grad: string; label: string; big: string; sub?: string }) {
  return (
    <div style={{ background: grad, borderRadius: 18, padding: '18px 20px', color: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.10)' }}>
      <p style={{ fontSize: 12.5, opacity: 0.88, margin: 0, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, margin: '7px 0 2px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{big}</p>
      {sub && <p style={{ fontSize: 12, opacity: 0.82, margin: 0 }}>{sub}</p>}
    </div>
  );
}

export function TabUsers({ d }: { d: AdminData }) {
  const { cur, prev } = d;

  const dauSeries = useMemo(() => cur.days.map((day, i) => ({
    day: day.slice(5),
    cur: cur.dauByDay[i],
    prev: prev.dauByDay[i] ?? 0,
  })), [cur, prev]);

  // 신규 vs 재방문 (2026-06-18) — 신규 결제유저와 동일 패턴. 현 기간 방문자 중 직전기간 미방문 = 신규.
  const newVisitors = useMemo(() => {
    const prevSet = new Set(prev.visitorKeys);
    return cur.visitorKeys.filter((k) => !prevSet.has(k)).length;
  }, [cur.visitorKeys, prev.visitorKeys]);
  const returningVisitors = Math.max(0, cur.visitors - newVisitors);
  const newRate = cur.visitors > 0 ? Math.round((newVisitors / cur.visitors) * 100) : null;

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
      {(() => {
        const gM = cur.demoGender['M'] ?? 0, gF = cur.demoGender['F'] ?? 0;
        const gTot = gM + gF;
        const AGE_ORDER = ['10대', '20대', '30대', '40대', '50대', '60대+'];
        const topAge = AGE_ORDER.map((ab) => ({ ab, n: cur.demoAge[ab] ?? 0 })).sort((a, b) => b.n - a.n)[0];
        const ageTot = AGE_ORDER.reduce((s, ab) => s + (cur.demoAge[ab] ?? 0), 0);
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
            <HeroCard
              grad="linear-gradient(135deg,#2bb673,#3cc888)"
              label="신규 vs 재방문 (이 기간)"
              big={cur.visitors > 0 ? `신규 ${newRate}%` : '데이터 없음'}
              sub={cur.visitors > 0 ? `신규 ${fmtNum(newVisitors)}명 · 재방문 ${fmtNum(returningVisitors)}명` : '방문이 누적되면 표시'}
            />
            <HeroCard
              grad="linear-gradient(135deg,#3b9ad6,#5ab0e0)"
              label="성비 (남 : 여)"
              big={gTot > 0 ? `${Math.round((gM / gTot) * 100)}% : ${Math.round((gF / gTot) * 100)}%` : '데이터 없음'}
              sub={gTot > 0 ? `사주 프로필 입력 ${fmtNum(gTot)}명 기준` : '프로필 데이터 누적 중'}
            />
            <HeroCard
              grad="linear-gradient(135deg,#7c5cd6,#9b6ef0)"
              label="핵심 연령대"
              big={topAge && topAge.n > 0 ? topAge.ab : '데이터 없음'}
              sub={topAge && topAge.n > 0 && ageTot > 0 ? `전체의 ${Math.round((topAge.n / ageTot) * 100)}% 차지` : '프로필 데이터 누적 중'}
            />
          </div>
        );
      })()}

      <Section title="유저 KPI" right={<CsvButton onClick={exportCsv} label="리워드 CSV" />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          <Kpi label="누적 가입" value={`${fmtNum(d.totalUsers)}명`} />
          <Kpi label="기간 고유 방문" value={`${fmtNum(cur.visitors)}명`} delta={deltaPct(cur.visitors, prev.visitors)} />
          <Kpi label="신규 방문" value={`${fmtNum(newVisitors)}명`} sub={newRate == null ? '직전기간 대비 첫 방문' : `전체 방문의 ${newRate}%`} accent />
          <Kpi label="재방문" value={`${fmtNum(returningVisitors)}명`} sub="직전기간에도 왔던 유저 (충성)" />
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
        caption="· 본인 사주 프로필(성별·출생연도)에서 파생. 성별 카드에 '구매 전환율'(결제자÷방문자) 직접 표시 — 어느 성별이 결제로 전환되는지 한눈에"
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
                {/* 2026-06-22 — 성별 '구매 전환'을 카드로 직접 노출 (기존: 툴팁 호버에만 숨음).
                    "어느 성별이 결제로 전환되는지"를 한눈에 — 성별 타겟 마케팅 의사결정용. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '4px 8px 2px' }}>
                  {genderBars.map((b, i) => {
                    const conv = b.n > 0 ? Math.round((b.pay / b.n) * 100) : 0;
                    return (
                      <div key={b.label} style={{ background: 'rgba(184,150,90,0.08)', borderRadius: 10, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, color: C.mute }}>{b.label} 구매 전환</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: i === 0 ? '#5A7CA8' : '#C88A95' }}>
                          {conv}%
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.mute, marginLeft: 4 }}>
                            (결제 {fmtNum(b.pay)} / 방문 {fmtNum(b.n)}명)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
