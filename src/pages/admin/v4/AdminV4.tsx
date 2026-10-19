/**
 * 관리자 v4 (2026-10-19) — 앱과 웹을 한 화면에서. 숫자는 서버 하루 요약(statsDaily), CS 는 고객 찾기.
 *   예전 화면(v3, 원본을 브라우저에서 전부 읽음)은 /admin?old=1 로 당분간 남겨 둔다.
 *   설계 문서: docs/handoff/2026-10-19_관리자_재설계.md
 */
import { useMemo, useState } from 'react';
import { useStats } from './api';
import type { PlatFilter } from './api';
import { K, Seg } from './ui';
import { Overview } from './Overview';
import { Customer } from './Customer';
import { Revenue, Channels, ContentAi } from './Tables';
import { TabReviews } from '../_tabReviews';
import { Tracking } from './Tracking';

type Tab = 'overview' | 'customer' | 'revenue' | 'channels' | 'content' | 'tracking' | 'reviews';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: '한눈에' },
  { id: 'customer', label: '고객 찾기와 운 넣기' },
  { id: 'revenue', label: '매출' },
  { id: 'channels', label: '들어온 곳' },
  { id: 'content', label: '콘텐츠와 AI' },
  { id: 'tracking', label: '기록 점검' },
  { id: 'reviews', label: '후기' },
];

export function AdminV4() {
  const [tab, setTab] = useState<Tab>(() => {
    try { return (sessionStorage.getItem('saju500:admin_tab') as Tab) || 'overview'; } catch { return 'overview'; }
  });
  const [range, setRange] = useState<7 | 14 | 30 | 60>(14);
  const [plat, setPlat] = useState<PlatFilter>('all');
  const needStats = tab !== 'customer' && tab !== 'reviews';
  // 증감 비교용으로 두 배를 받는다 (60일은 120일)
  const { data, busy, error, reload, builtNow } = useStats(range * 2, needStats);
  const { days, prev } = useMemo(() => {
    const all = data || [];
    return { days: all.slice(-range), prev: all.slice(-range * 2, -range) };
  }, [data, range]);
  const go = (t: Tab) => { setTab(t); try { sessionStorage.setItem('saju500:admin_tab', t); } catch { /* noop */ } };

  return (
    <div style={{ minHeight: '100vh', background: K.paper, width: '100vw', position: 'relative', left: '50%', marginLeft: '-50vw' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '18px 16px 80px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: K.ink, margin: 0 }}>사주500 관리자</h1>
          {needStats && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Seg value={plat} onChange={setPlat} options={[{ v: 'all', label: '전체' }, { v: 'app', label: '앱' }, { v: 'web', label: '웹' }]} />
              <Seg value={range} onChange={setRange} options={[{ v: 7, label: '7일' }, { v: 14, label: '14일' }, { v: 30, label: '30일' }, { v: 60, label: '60일' }]} />
              <button type="button" onClick={reload} disabled={busy}
                style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${K.line}`, background: K.surface, fontSize: 13.5, fontWeight: 700, color: K.ink, cursor: busy ? 'wait' : 'pointer' }}>
                {busy ? '불러오는 중…' : '새로 불러오기'}
              </button>
            </div>
          )}
        </header>

        <nav style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14, borderBottom: `1px solid ${K.line}` }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => go(t.id)}
              style={{ padding: '8px 12px', borderRadius: 8, border: 0, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 14.5, fontWeight: 800, background: tab === t.id ? K.ink : 'transparent', color: tab === t.id ? '#F4EFE4' : K.mute }}>
              {t.label}
            </button>
          ))}
          <a href="/admin?old=1" style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, color: K.mute, whiteSpace: 'nowrap' }}>예전 화면</a>
        </nav>

        {needStats && error && <p style={{ color: K.red, fontSize: 14 }}>불러오지 못했어요: {error}</p>}
        {needStats && !data && busy && (
          <p style={{ fontSize: 14, color: K.mute }}>숫자를 불러오는 중이에요. 요약이 없는 날이 있으면 처음 한 번은 1~2분 걸려요.</p>
        )}
        {needStats && builtNow > 0 && <p style={{ fontSize: 13, color: K.mute }}>요약이 없던 {builtNow}일을 방금 만들었어요.</p>}

        {tab === 'overview' && data && <Overview days={days} prev={prev} plat={plat} />}
        {tab === 'revenue' && data && <Revenue days={days} plat={plat} />}
        {tab === 'channels' && data && <Channels days={days} plat={plat} />}
        {tab === 'content' && data && <ContentAi days={days} plat={plat} />}
        {tab === 'tracking' && data && <Tracking days={days} />}
        {tab === 'customer' && <Customer />}
        {tab === 'reviews' && <TabReviews />}
      </div>
    </div>
  );
}
