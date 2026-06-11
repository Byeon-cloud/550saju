// EventsPage v4.1 전면 재작성 (2026-04-21)
// 스펙: 사주500_UI개편_09_이벤트_v4.md + 핸드오버 §1-C-7
// 블록 구조:
//   1. HeroBadge (출석 방법)
//   2. StreakWidget (3일 연속 · 이동윈도우)
//   3. Weekly 7칸 (7일 모두 → 토스포인트 100원)
//   4. InviteBlock (하루 3회 · 초대당 운 1)
//   5. CumulativeReceivedCard (지금까지 받은 운)
// v3 하단 CTA(오늘의 운세/꿈해몽) 완전 제거.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Header } from '@/components/layout/Header';
import { useToast } from '@/components/common/Toast';
import { HeroBadge } from '@/components/events/HeroBadge';
import { StreakWidget } from '@/components/events/StreakWidget';
import { CumulativeReceivedCard } from '@/components/events/CumulativeReceivedCard';
import { TierAToast } from '@/components/events/TierAToast';
import { TierBModal, type TierBKind } from '@/components/events/TierBModal';
import { onInviteReceived } from '@/services/events/eventsClient';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_BANNER_GROUP_ID } from '@/constants/config';

const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  navy: '#1D2D4A',
  muted: '#7A7269',              // SSOT --mute — D1 fix (2026-04-23)
  gold: '#B8965A',
  goldDark: '#8C6D3D',          // SSOT --gold-deep — D1 fix (2026-04-23)
  goldLight: 'rgba(184,150,90,0.14)', // SSOT soft gold — D1 fix (2026-04-23)
  line: '#EDEAE0',
  danger: '#C0392B',
} as const;
const SERIF = "'Noto Serif KR', serif";
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/* 날짜 유틸 */
function kstToday(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
function kstWeekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function kstDayIndex(): number {
  const d = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const g = d.getUTCDay(); // 0(일)~6(토)
  return g === 0 ? 6 : g - 1; // 월=0
}

export function EventsPage() {
  usePageTitle('이벤트');
  const { user } = useAuth();
  const uid = user?.uid;
  const toast = useToast();

  const [streak, setStreak] = useState(0);
  const [missedYesterday, setMissedYesterday] = useState(false);
  const [streakPulsing, setStreakPulsing] = useState(false);
  const [weekDoneDays, setWeekDoneDays] = useState<boolean[]>([false,false,false,false,false,false,false]);
  const [inviteCount, setInviteCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [tierAOpen, setTierAOpen] = useState(false);
  const [tierAMsg, setTierAMsg] = useState<string | undefined>(undefined);
  const [tierBOpen, setTierBOpen] = useState(false);
  const [tierBKind, setTierBKind] = useState<TierBKind>('tosspoint');

  const today = useMemo(() => kstToday(), []);
  const weekKey = useMemo(() => kstWeekKey(today), [today]);
  const todayIdx = useMemo(() => kstDayIndex(), []);

  /** Firestore 읽기 (streakAttendance · attendance · inviteEvents) */
  const refresh = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      // 1. streak
      const streakSnap = await getDoc(doc(db, `users/${uid}/streakAttendance/current`));
      const sd = (streakSnap.exists() ? streakSnap.data() : {}) as any;
      const cur = Number(sd?.currentStreak ?? 0);
      const lastDate: string | null = sd?.lastAttendedDate ?? null;
      setStreak(cur);
      // 끊김 감지: 어제 날짜 이전에 lastAttended 가 있었는데 오늘 아님
      const yesterday = new Date(new Date().getTime() + 9 * 60 * 60 * 1000 - 86400000)
        .toISOString().slice(0, 10);
      setMissedYesterday(Boolean(lastDate && lastDate < yesterday && cur >= 1));

      // 2. 주간 7일 출석
      const weekSnap = await getDocs(
        query(collection(db, `users/${uid}/attendance`), where('weekKey', '==', weekKey)),
      );
      const done = [false, false, false, false, false, false, false];
      weekSnap.forEach((d) => {
        const dateKey = (d.data() as any)?.dateKey as string | undefined;
        if (!dateKey) return;
        const dayObj = new Date(`${dateKey}T00:00:00Z`);
        const g = dayObj.getUTCDay();
        const idx = g === 0 ? 6 : g - 1;
        done[idx] = true;
      });
      setWeekDoneDays(done);

      // 3. 오늘 초대 카운트
      const inviteSnap = await getDoc(doc(db, `users/${uid}/inviteEvents/${today}`));
      setInviteCount(Number((inviteSnap.exists() ? (inviteSnap.data() as any)?.dailyCount : 0) ?? 0));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[EventsPage] refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, [uid, today, weekKey]);

  useEffect(() => { refresh(); }, [refresh]);

  const completedDays = weekDoneDays.filter(Boolean).length;
  const weekPct = Math.min(100, (completedDays / 7) * 100);

  /** 공유 버튼 핸들러 — 전 앱 통합 (inviteFriendsViaToss SSOT · 토스 contactsViral) */
  const onShareInvite = async () => {
    if (inviteCount >= 3) {
      toast.show('오늘 초대는 끝났어요 · 내일 다시 참여해주세요', 'info');
      return;
    }
    const inviteId = `invite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { inviteFriendsViaToss } = await import('@/services/share/shareReward');
    await inviteFriendsViaToss({
      // 친구 공유 실제 완료(sendViral) 시에만 서버 콜백 → 운 지급
      onReward: async () => {
        const res = await onInviteReceived({ inviteId });
        if (res?.granted) {
          setInviteCount(res.dailyCount ?? inviteCount + 1);
          setTierAMsg('운 1 들어왔어요');
          setTierAOpen(true);
        } else if (res?.reason === 'daily_cap') {
          toast.show('오늘 초대는 끝났어요 · 내일 다시 참여해주세요', 'info');
        }
      },
      onShared: () => toast.show('오늘 초대는 끝났어요 · 내일 다시 참여해주세요', 'info'),
      onCancel: () => { /* 유저 취소 — 무시 */ },
    });
  };

  const weekStatusCopy = useMemo(() => {
    if (completedDays === 0) return '이번 주 시작! 7일 모두 모으면 토스포인트 100원';
    if (completedDays < 7) return `${completedDays}일째 · 남은 ${7 - completedDays}일 더 모으면 토스포인트 100원`;
    return '이번 주 완성 · 토스포인트 100원 지급 완료';
  }, [completedDays]);

  // 3일 달성 펄스 (이 페이지 진입 시 표시 효과만) — markAttendance는 결과 페이지에서 호출됨
  useEffect(() => {
    if (streak === 3) {
      setStreakPulsing(true);
      const t = setTimeout(() => setStreakPulsing(false), 1200);
      return () => clearTimeout(t);
    }
  }, [streak]);

  return (
    <div style={{ background: C.paper, minHeight: '100vh', paddingBottom: 96 }}>
      <Header title="이벤트" />

      <div className="mx-auto" style={{ maxWidth: 460 }}>
        {/* 블록 1 — HeroBadge */}
        <HeroBadge />

        {/* 블록 2 — 3일 연속 streak 이동윈도우 */}
        <StreakWidget streak={streak} missedYesterday={missedYesterday} pulsing={streakPulsing} />

        {/* 블록 3 — 이번 주 출석 (7일 모두) */}
        <section className="mx-4 mt-4 rounded-2xl px-[18px] py-[18px]"
          style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(47,42,35,0.04)' }}>
          <header className="flex items-center gap-2.5 mb-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={C.gold} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 9h18" />
              <path d="M8 3v4M16 3v4" />
            </svg>
            <h3 className="text-[16px] font-bold" style={{ color: C.navy, fontFamily: SERIF }}>이번 주 출석</h3>
          </header>
          <p className="text-[12px] mb-4" style={{ color: C.muted, lineHeight: 1.5 }}>
            월~일 모두 체크하면 토스포인트 100원
          </p>

          {/* 7칸 그리드 */}
          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {WEEKDAYS.map((w, i) => {
              const done = weekDoneDays[i];
              const isToday = i === todayIdx;
              return (
                <div key={w} className="flex flex-col items-center gap-1 py-1">
                  <span className="text-[10px] font-medium"
                    style={{ color: done ? C.ink : isToday ? C.goldDark : C.muted,
                      fontWeight: isToday ? 600 : 500 }}>
                    {w}
                  </span>
                  <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center"
                    style={{
                      background: done ? C.gold : isToday ? C.goldLight : '#FFFFFF',
                      border: done ? `2px solid ${C.goldDark}` : isToday ? `2px solid ${C.goldDark}` : `2px dashed ${C.line}`,
                    }}>
                    {done ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 진행바 */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}>
            <div className="h-full transition-all" style={{ width: `${weekPct}%`, background: C.gold }} />
          </div>
          <p className="text-[12px] mt-2.5" style={{ color: C.muted }}>
            <strong style={{ color: C.ink }}>{completedDays}/7</strong> · {weekStatusCopy}
          </p>
        </section>

        {/* 블록 4 — 친구 초대 */}
        <section className="mx-4 mt-4 rounded-2xl px-[18px] py-[18px]"
          style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(47,42,35,0.04)' }}>
          <header className="flex items-center gap-2.5 mb-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke={C.gold} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <path d="M8.5 10.5l7-3.5M8.5 13.5l7 3.5" />
            </svg>
            <h3 className="text-[16px] font-bold" style={{ color: C.navy, fontFamily: SERIF }}>
              친구에게 사주500 소개하기
            </h3>
          </header>
          <p className="text-[12px] mb-4" style={{ color: C.muted, lineHeight: 1.5 }}>
            하루 3회 · 초대당 운 1
          </p>

          <button type="button" onClick={onShareInvite}
            disabled={inviteCount >= 3}
            className="w-full flex items-center justify-center gap-2.5 py-[18px] rounded-[14px] font-semibold text-[16px] transition"
            style={{
              background: inviteCount >= 3 ? '#EFE9DA' : C.gold,
              color: inviteCount >= 3 ? C.muted : '#fff',
              boxShadow: inviteCount >= 3 ? 'none' : '0 2px 6px rgba(184,150,90,0.3)',
              cursor: inviteCount >= 3 ? 'default' : 'pointer',
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={inviteCount >= 3 ? C.muted : '#fff'} strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>{inviteCount >= 3 ? '오늘 초대는 끝났어요' : '친구에게 공유하기'}</span>
          </button>
          <p className="text-[12px] text-center mt-3" style={{ color: C.muted }}>
            오늘 <strong style={{ color: C.ink }}>{inviteCount}/3</strong>회 · 일 3회 한도
          </p>
        </section>

        {/* 블록 5 — 누적 운 카드 (하단 CTA 교체) */}
        <CumulativeReceivedCard />

        {/* 배너광고 — 페이지 하단 (앱인토스 빌드 한정 · silent fallback) */}
        <div className="mt-2">
          <AdSlot unit={AD_BANNER_GROUP_ID} minHeight={90} />
        </div>
      </div>

      {/* Tier A 토스트 */}
      <TierAToast
        open={tierAOpen}
        message={tierAMsg}
        onClose={() => setTierAOpen(false)}
      />

      {/* Tier B 모달 */}
      <TierBModal
        open={tierBOpen}
        kind={tierBKind}
        onClose={() => setTierBOpen(false)}
      />

      {/* Loading state를 간단히 (UI 깜빡임 완화, 현재는 최소) */}
      {loading && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0">
          loading
        </div>
      )}

      {/* 참고: 부모 컴포넌트가 markAttendance 결과에 따라 Tier A/B 오픈 트리거 가능 */}
      {/* (결과 페이지 훅에서 sessionStorage 플래그 세팅 → 이 페이지 진입 시 open) */}
      <TrampolineFromSession
        onTierA={(msg) => { setTierAMsg(msg); setTierAOpen(true); }}
        onTierB={(kind) => { setTierBKind(kind); setTierBOpen(true); }}
      />
    </div>
  );
}

/**
 * 결과 페이지 → markAttendance 호출 후 streak/week 달성되면 sessionStorage 플래그 저장.
 * 이벤트 탭 이동 시 이 Trampoline 이 플래그 감지 → Tier A/B 오픈 트리거.
 * sessionStorage 이므로 같은 세션 내 1회만 표시됨.
 */
function TrampolineFromSession({
  onTierA, onTierB,
}: { onTierA: (msg?: string) => void; onTierB: (kind: TierBKind) => void }) {
  useEffect(() => {
    try {
      const tierA = sessionStorage.getItem('events_pending_tier_a');
      if (tierA) {
        sessionStorage.removeItem('events_pending_tier_a');
        onTierA(tierA);
      }
      const tierB = sessionStorage.getItem('events_pending_tier_b');
      if (tierB === 'tosspoint' || tierB === 'un_fallback') {
        sessionStorage.removeItem('events_pending_tier_b');
        onTierB(tierB as TierBKind);
      }
    } catch {/* noop */}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default EventsPage;
