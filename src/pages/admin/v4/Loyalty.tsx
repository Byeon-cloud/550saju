/**
 * 관리자 v4 — 재방문 판 (2026-10-27)
 *   오너: '많이 접속하는 사람, 재접속, 웹을 홈 화면 앱으로 들고 있는 사람까지 보자'.
 *   숫자는 서버 adminLoyalty(functions/src/admin/loyalty.ts). 하루마다 그날 온 기기 명단(statsDevices)을 쌓아 기간으로 묶는다.
 *   기기 = 기기 영속 id(없으면 계정), 오너 기기는 빠진다. 결제는 결제 장부 기준(이벤트가 아님).
 *   읽는 순서: 요약 → 며칠 왔나 묶음(자주 올수록 사나) → 날짜별 다시 온 기기 → 새 기기 재방문 → 웹 홈 화면 앱 → 단골 목록
 */
import { useCallback, useEffect, useState } from 'react';
import { callAdmin, fmt, won, pct, shortDay } from './api';
import { Box, K, Table, Tile, Seg, grid } from './ui';
import { DayColumns, PLAT_COLOR } from './charts';

type P = 'app' | 'web';
interface Sum { devices: number; returning: number; avgDays: number; payers: number; revenue: number; returningPayers: number; standalone: number }
interface BucketRow { label: string; devices: number; inputs: number; payers: number; revenue: number; standalone: number }
interface Heavy { id: string; uid: string; p: P; days: number; first: string; last: string; standaloneDays: number; inputs: number; results: number; purchases: number; paid: number; orders: number; src: string }
interface DayRow { day: string; app: { visitors: number; returning: number; fresh: number }; web: { visitors: number; returning: number; fresh: number; standalone: number; standaloneFirst: number }; pwa: Record<string, number> }
interface Cohort { day: string; app: Record<string, number | null>; web: Record<string, number | null> }
interface LoyaltyData {
  from: string; to: string; days: number;
  summary: Record<P, Sum>;
  buckets: Record<P, BucketRow[]>;
  heavy: Heavy[]; daily: DayRow[]; cohorts: Cohort[]; pwa: Record<string, number>;
  missing: number; filledNow: number;
}

const PLAT_NAME: Record<P, string> = { app: '앱', web: '웹' };
const rate = (n: number | null | undefined, size: number) => (n == null ? '아직' : size ? `${Math.round((n / size) * 100)}% (${n})` : '-');

export function Loyalty() {
  const [days, setDays] = useState<14 | 30 | 60>(30);
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setBusy(true); setError('');
    callAdmin<LoyaltyData>('adminLoyalty', { days })
      .then(setData)
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setBusy(false));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const head = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
      <Seg value={days} onChange={setDays} options={[{ v: 14, label: '14일' }, { v: 30, label: '30일' }, { v: 60, label: '60일' }]} />
      {busy && <span style={{ fontSize: 13, color: K.mute }}>불러오는 중이에요. 처음 한 번은 기기 명단을 만드느라 1~2분 걸려요.</span>}
      {data && !busy && <button type="button" onClick={load} style={{ fontSize: 13, border: `1px solid ${K.line}`, background: K.surface, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>다시 불러오기</button>}
    </div>
  );
  if (error) return <div>{head}<p style={{ color: K.red, fontSize: 14 }}>불러오지 못했어요: {error}</p></div>;
  if (!data) return <div>{head}</div>;

  const S = data.summary;
  const pwa = data.pwa || {};
  const webStandaloneDays = data.daily.map((d) => d.web.standalone);

  return (
    <div>
      {head}
      <p style={{ fontSize: 13, color: K.mute, margin: '0 0 12px' }}>
        {data.from} ~ {data.to}. 기기 기준(같은 휴대폰은 한 명), 오너 기기 제외. 결제는 결제 장부 기준이에요.
        {data.missing > 0 && ` 아직 명단을 못 만든 날이 ${data.missing}일 있어요(다시 불러오면 더 채워요).`}
        {data.filledNow > 0 && ` 방금 ${data.filledNow}일 명단을 만들었어요.`}
      </p>

      {/* 1. 요약 */}
      <section style={{ ...grid(170), marginBottom: 16 }}>
        {(['app', 'web'] as P[]).map((p) => (
          <Tile key={`d${p}`} label={`${PLAT_NAME[p]} 온 기기`} value={fmt(S[p].devices)} sub={`평균 ${S[p].avgDays.toFixed(1)}일 왔어요`} />
        ))}
        {(['app', 'web'] as P[]).map((p) => (
          <Tile key={`r${p}`} label={`${PLAT_NAME[p]} 이틀 넘게 온 기기`} value={pct(S[p].returning, S[p].devices)} sub={`${fmt(S[p].returning)}대`} />
        ))}
        {(['app', 'web'] as P[]).map((p) => (
          <Tile key={`p${p}`} label={`${PLAT_NAME[p]} 결제한 기기`} value={fmt(S[p].payers)} sub={`그중 다시 온 기기 ${fmt(S[p].returningPayers)}대, ${won(S[p].revenue)}`} />
        ))}
        <Tile label="웹 홈 화면 앱으로 연 기기" value={fmt(S.web.standalone)} sub={`웹 기기의 ${pct(S.web.standalone, S.web.devices)}`} strong />
      </section>

      {/* 2. 며칠 왔나 */}
      <Box title="며칠 왔나 (자주 올수록 사나)" note="기간 안에 서로 다른 날 몇 번 왔는지로 묶었어요. 결제 비율은 그 묶음 기기 중 결제한 기기예요.">
        {(['app', 'web'] as P[]).map((p) => (
          <div key={p} style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: PLAT_COLOR[p], margin: '4px 0 6px' }}>{PLAT_NAME[p]}</p>
            <Table head={['온 날', '기기', '사주 입력', '결제한 기기', '결제 비율', '매출', ...(p === 'web' ? ['홈 화면 앱'] : [])]} align={['l', 'r', 'r', 'r', 'r', 'r', 'r']}
              rows={data.buckets[p].map((b) => [b.label, fmt(b.devices), pct(b.inputs, b.devices), fmt(b.payers), pct(b.payers, b.devices), b.revenue ? won(b.revenue) : '-', ...(p === 'web' ? [fmt(b.standalone)] : [])])} />
          </div>
        ))}
      </Box>

      {/* 3. 날짜별 */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 10, margin: '16px 0' }}>
        <DayColumns title="날짜별 다시 온 기기 (앞 30일 안에 온 적 있는 기기)" days={data.daily.map((d) => ({ day: d.day })) as any} fmt={fmt}
          series={[
            { key: 'app', label: '앱', color: PLAT_COLOR.app, get: (d: any) => data.daily.find((x) => x.day === d.day)?.app.returning || 0 },
            { key: 'web', label: '웹', color: PLAT_COLOR.web, get: (d: any) => data.daily.find((x) => x.day === d.day)?.web.returning || 0 },
          ]} />
        <DayColumns title="날짜별 웹 홈 화면 앱으로 연 기기" days={data.daily.map((d) => ({ day: d.day })) as any} fmt={fmt}
          series={[{ key: 'st', label: '홈 화면 앱', color: '#5B4A86', get: (d: any) => data.daily.find((x) => x.day === d.day)?.web.standalone || 0 }]} />
      </section>
      <Box title="날짜별 숫자" note="다시 온 비율 = 그날 온 기기 중 앞 30일 안에 한 번이라도 온 기기.">
        <Table head={['날짜', '앱 기기', '앱 다시 온', '웹 기기', '웹 다시 온', '웹 홈 화면 앱', '그중 처음']} align={['l', 'r', 'r', 'r', 'r', 'r', 'r']}
          rows={[...data.daily].reverse().map((d) => [shortDay(d.day), fmt(d.app.visitors), pct(d.app.returning, d.app.visitors), fmt(d.web.visitors), pct(d.web.returning, d.web.visitors), fmt(d.web.standalone), fmt(d.web.standaloneFirst)])} />
      </Box>

      {/* 4. 새 기기 재방문 */}
      <Box title="처음 온 기기가 다시 왔나" note="그날 처음 온 기기 중 그 뒤 1일, 7일, 14일, 30일 안에 한 번이라도 다시 온 비율. '아직'은 그만큼 날이 지나지 않았어요.">
        <Table head={['처음 온 날', '앱 새 기기', '1일', '7일', '14일', '30일', '웹 새 기기', '1일', '7일', '14일', '30일']} align={['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']}
          rows={[...data.cohorts].reverse().map((c) => [shortDay(c.day),
            fmt(Number(c.app.size) || 0), rate(c.app.d1, Number(c.app.size) || 0), rate(c.app.d7, Number(c.app.size) || 0), rate(c.app.d14, Number(c.app.size) || 0), rate(c.app.d30, Number(c.app.size) || 0),
            fmt(Number(c.web.size) || 0), rate(c.web.d1, Number(c.web.size) || 0), rate(c.web.d7, Number(c.web.size) || 0), rate(c.web.d14, Number(c.web.size) || 0), rate(c.web.d30, Number(c.web.size) || 0)])} />
      </Box>

      {/* 5. 웹 홈 화면 앱 */}
      <Box title="웹 홈 화면 앱 (휴대폰 홈 화면에 사주500을 두고 여는 손님)" note="홈의 안내 칸, 설치 창, 홈 화면 앱으로 처음 연 수. 아이폰은 설치 창이 없어 안내 시트로만 추가해요.">
        <section style={grid(150)}>
          <Tile label="안내 칸이 보임" value={fmt(pwa.cardView || 0)} />
          <Tile label="안내 칸 누름" value={fmt(pwa.cardClick || 0)} sub={pct(pwa.cardClick || 0, pwa.cardView || 0)} />
          <Tile label="추가하는 법 시트" value={fmt(pwa.guideOpen || 0)} />
          <Tile label="설치 창에서 설치" value={fmt((pwa.promptAccepted || 0) + (pwa.installed || 0))} sub={`취소 ${fmt(pwa.promptDismissed || 0)}`} />
          <Tile label="홈 화면 앱으로 처음 연 수" value={fmt(pwa.firstOpen || 0)} sub={`다시 연 수 ${fmt(pwa.open || 0)}`} strong />
          <Tile label="홈 화면 앱 기기(기간)" value={fmt(S.web.standalone)} sub={`하루 최대 ${fmt(Math.max(0, ...webStandaloneDays))}대`} />
        </section>
      </Box>

      {/* 6. 단골 */}
      <Box title="단골 40 (온 날 많은 순)" note="기기 번호 앞 8자와 계정(고객 찾기에서 찾을 수 있어요). 출처는 처음 붙은 유입이에요.">
        <Table head={['기기', '계정', '앱/웹', '온 날', '처음', '마지막', '홈 화면 앱', '결과', '구매', '결제', '출처']} align={['l', 'l', 'l', 'r', 'l', 'l', 'r', 'r', 'r', 'r', 'l']}
          rows={data.heavy.map((h) => [h.id, h.uid ? h.uid.slice(0, 10) : '-', PLAT_NAME[h.p], fmt(h.days), shortDay(h.first), shortDay(h.last), h.standaloneDays ? `${h.standaloneDays}일` : '-', fmt(h.results), fmt(h.purchases), h.paid ? won(h.paid) : '-', h.src || '-'])} />
      </Box>
    </div>
  );
}
