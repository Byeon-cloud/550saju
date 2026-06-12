// AdminPage — 오너 전용 트래킹 대시보드 v3 (2026-06-10 전면 재설계)
//   셸: 오너 게이팅 + 헤더(요약 1줄·새로고침) + 기간 선택(7/14/30일 + 직전 기간 델타) + 7탭 네비
//   데이터: src/pages/admin/_useAdminData.ts (Firestore analytics + payments + aiUsage + users + reports)
//   탭: Overview / 매출 / 콘텐츠 / 유저 / AI 운영 / 광고·프로모 / 유입 — src/pages/admin/_tab*.tsx
//   ⚠️ 접근 제어(adminConfig OWNER_UIDS + firestore.rules isOwner) 변경 금지 · 읽기 전용 대시보드.
import { useState } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isOwner } from '@/services/admin/adminConfig';
import { useAdminData } from '@/pages/admin/_useAdminData';
import type { RangeDays, AdminData } from '@/pages/admin/_useAdminData';
import { C, Skeleton, fmtNum, fmtWon } from '@/pages/admin/_components';
import { TabOverview } from '@/pages/admin/_tabOverview';
import { TabRevenue } from '@/pages/admin/_tabRevenue';
import { TabContent } from '@/pages/admin/_tabContent';
import { TabUsers } from '@/pages/admin/_tabUsers';
import { TabAiOps } from '@/pages/admin/_tabAiOps';
import { TabAdsPromo } from '@/pages/admin/_tabAdsPromo';
import { TabAcquisition } from '@/pages/admin/_tabAcquisition';
import { TabCsGrant } from '@/pages/admin/_tabCsGrant';

type TabId = 'overview' | 'revenue' | 'content' | 'users' | 'aiops' | 'ads' | 'acquisition' | 'csgrant';

const TABS: { id: TabId; label: string; render: (d: AdminData) => ReactElement }[] = [
  { id: 'overview', label: 'Overview', render: (d) => <TabOverview d={d} /> },
  { id: 'revenue', label: '매출', render: (d) => <TabRevenue d={d} /> },
  { id: 'content', label: '콘텐츠', render: (d) => <TabContent d={d} /> },
  { id: 'users', label: '유저', render: (d) => <TabUsers d={d} /> },
  { id: 'aiops', label: 'AI 운영', render: (d) => <TabAiOps d={d} /> },
  { id: 'ads', label: '광고·프로모', render: (d) => <TabAdsPromo d={d} /> },
  { id: 'acquisition', label: '유입', render: (d) => <TabAcquisition d={d} /> },
  { id: 'csgrant', label: 'CS 지급', render: () => <TabCsGrant /> },
];

const RANGES: RangeDays[] = [7, 14, 30];

export function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const owner = isOwner(user?.uid, user?.email);

  // 오너 기기 마킹 (2026-06-12) — 이 기기의 이후 모든 이벤트는 internal:true 로 기록돼 집계에서 제외.
  //   '내가 둘러본 것까지 DAU·퍼널에 섞이는' 가짜 데이터 차단.
  if (owner) { try { localStorage.setItem('saju500:internal', '1'); } catch { /* noop */ } }

  const [range, setRange] = useState<RangeDays>(14);
  const [tab, setTab] = useState<TabId>('overview');
  const { data, busy, error, reload } = useAdminData(range, owner && !loading);

  // ─── 비오너 — uid 노출 (등록용 · 기존 동작 보존) ───
  if (!loading && !owner) {
    return (
      <div style={{ minHeight: '100vh', background: C.paper, padding: '40px 20px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>어드민 — 접근 권한 없음</h1>
        <p style={{ fontSize: 13, color: C.mute, marginTop: 12, lineHeight: 1.6 }}>
          <b>구글로 로그인하면 어떤 브라우저에서든 항상 열려요</b> (이메일 기준 영구 등록).<br />
          익명 세션 uid 는 쿠키가 지워질 때마다 바뀌어서 자꾸 풀리는 거예요.
        </p>
        <button
          type="button"
          onClick={async () => {
            try {
              const { signIn } = await import('@/services/auth/authService');
              await signIn('google');
              window.location.reload();
            } catch { /* 취소/실패 — 무시 */ }
          }}
          style={{
            marginTop: 14, padding: '12px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: C.gold, color: '#fff', fontSize: 14, fontWeight: 800,
          }}
        >
          구글로 로그인 (영구 등록)
        </button>
        <div style={{ marginTop: 16, padding: 14, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: C.mute, marginBottom: 6 }}>현재 로그인 uid</div>
          <code style={{ fontSize: 13, fontWeight: 700, color: C.goldDeep, wordBreak: 'break-all' }}>
            {user?.uid || '(로그인 필요 — 토스/소셜 로그인 후 새로고침)'}
          </code>
        </div>
        <button onClick={() => navigate('/')} style={{ marginTop: 20, fontSize: 13, color: C.gold, background: 'none', border: 'none', cursor: 'pointer' }}>
          ← 홈으로
        </button>
      </div>
    );
  }

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];
  const fetchedAtLabel = data
    ? data.fetchedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '-';

  return (
    // 앱 셸(max-width 520) 탈출 — 어드민은 데스크톱 풀폭 (2026-06-12 fix: 1080 설정이 셸에 갇혀 무용지물이던 것)
    <div style={{ minHeight: '100vh', background: C.paper, width: '100vw', position: 'relative', left: '50%', marginLeft: '-50vw' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 16px 80px' }}>
        {/* ─── 헤더 ─── */}
        <header style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>사주500 어드민</h1>
              <span style={{ fontSize: 11, color: C.mute }}>집계 {fetchedAtLabel}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 기간 토글 */}
              <div style={{ display: 'flex', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: range === r ? C.gold : 'transparent',
                      color: range === r ? '#FFFFFF' : C.mute,
                    }}
                  >
                    {r}일
                  </button>
                ))}
              </div>
              <button
                onClick={reload}
                disabled={busy}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 700, color: C.goldDeep,
                  background: C.surface, border: `1px solid ${C.gold}`, borderRadius: 10,
                  cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
                }}
              >
                {busy ? '집계 중…' : '새로고침'}
              </button>
              <button onClick={() => navigate('/')} style={{ fontSize: 12, color: C.mute, background: 'none', border: 'none', cursor: 'pointer' }}>← 홈</button>
            </div>
          </div>
          {/* 요약 1줄 */}
          {data && (
            <p style={{ fontSize: 12, color: C.mute, marginTop: 8 }}>
              기간 <b style={{ color: C.ink }}>{data.cur.days[0]} ~ {data.cur.days[data.cur.days.length - 1]}</b>
              {' · '}유저 <b style={{ color: C.ink }}>{fmtNum(data.totalUsers)}명</b>
              {' · '}오늘 매출 <b style={{ color: C.goldDeep }}>{fmtWon(data.todayRevenue)}</b>
              {' · '}기간 매출 <b style={{ color: C.goldDeep }}>{fmtWon(data.cur.revenue)}</b>
            </p>
          )}
        </header>

        {/* ─── 탭 네비 ─── */}
        <nav style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.line}`, marginBottom: 20, overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: tab === t.id ? 800 : 600, whiteSpace: 'nowrap',
                color: tab === t.id ? C.ink : C.mute, background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === t.id ? `2px solid ${C.gold}` : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* ─── 본문 ─── */}
        {error && (
          <div style={{ padding: '14px 16px', background: 'rgba(192,57,43,0.07)', border: '1px solid rgba(192,57,43,0.25)', borderRadius: 12, marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#C0392B', fontWeight: 700 }}>데이터 조회 실패</p>
            <p style={{ fontSize: 12, color: C.mute, marginTop: 4, wordBreak: 'break-all' }}>{error}</p>
            <button onClick={reload} style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: C.goldDeep, background: 'none', border: `1px solid ${C.gold}`, borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>
              다시 시도
            </button>
          </div>
        )}
        {busy && !data && <Skeleton />}
        {data && activeTab.render(data)}

        <p style={{ fontSize: 11, color: C.mute, marginTop: 24, lineHeight: 1.6 }}>
          · 집계는 실시간 클라이언트 계산 (새로고침/기간 변경 시 갱신) — 델타는 직전 동일 기간 대비<br />
          · 유입경로·체류시간·유저플로우 상세는 GA4(analytics.google.com) 참조
        </p>
      </div>
    </div>
  );
}
