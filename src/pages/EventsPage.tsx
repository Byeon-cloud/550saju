// EventsPage v4.1 전면 재작성 (2026-04-21)
// 스펙: 사주500_UI개편_09_이벤트_v4.md + 핸드오버 §1-C-7
// 블록 구조:
//   1. HeroBadge (출석 방법)
//   2. StreakWidget (3일 연속 · 이동윈도우)
//   3. 7일 연속 출석 7칸 (7일 연속마다 → 토스포인트 100원 · 앱인토스만)
//   4. InviteBlock (보상 없는 토스 공유 · 2026-10-14 공유 리워드 종료)
//   5. CumulativeReceivedCard (지금까지 받은 운)
// v3 하단 CTA(오늘의 운세/꿈해몽) 완전 제거.
//
// 2026-09-17 — 장부 통일 (준기 "원래 기획대로"):
//   실제 운 지급이 기기(localStorage)에서 일어나므로 이 페이지의 모든 숫자는 기기 장부에서 읽는다.
//   · 연속 출석·7일 진행: dailyReward.getAttendanceSnapshot()
//   · 친구 초대: services/share/invite.shareInvite (보상 없음)
//   · 누적 받은 운: dailyReward.getRewardLedger()
//   구 동작: 서버 STUB 장부(streakAttendance · attendance 월~일 · inviteEvents · rewardClaims)를 읽어
//   7칸이 차면 실제 지급 여부와 무관하게 "지급 완료" 로 고정 표시됐다 (실측 11주 허위 표시).
//   7일 토스포인트는 요일 무관 연속 7일마다 반복 지급 — 월~일 달력이 아니라 실제 판정과 같은 진행을 보여준다.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Header } from '@/components/layout/Header';
import { HeroBadge } from '@/components/events/HeroBadge';
import { StreakWidget } from '@/components/events/StreakWidget';
import { CumulativeReceivedCard } from '@/components/events/CumulativeReceivedCard';
import { TierAToast } from '@/components/events/TierAToast';
import { TierBModal, type TierBKind } from '@/components/events/TierBModal';
import {
  ATTEND_CYCLE_DAYS,
  EVENTS_PENDING_TIER_A_KEY,
  EVENTS_PENDING_TIER_B_KEY,
  REWARD_LEDGER_CHANGED_EVENT,
  getAttendanceSnapshot,
  getRewardLedger,
  retryPendingAttend7Reward,
} from '@/services/storage/dailyReward';
import { cachedInviteRules } from '@/services/referral/referral';
import { useNavigate } from 'react-router-dom';
import { PROMO, seedLegacyPromoLedger } from '@/services/toss/tossPromotion';
import { isAppsInToss } from '@/services/payment/iapService';
import { trackEvent } from '@/services/analytics';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_BANNER_GROUP_ID } from '@/constants/config';
import { moVars } from '@/components/motion/Motion';

const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  navy: '#1A1612',
  muted: '#6F6557',              // SSOT --mute — D1 fix (2026-04-23)
  gold: '#B8965A',
  goldDark: '#8C6D3D',          // SSOT --gold-deep — D1 fix (2026-04-23)
  goldLight: 'rgba(184,150,90,0.14)', // SSOT soft gold — D1 fix (2026-04-23)
  line: '#EDEAE0',
  danger: '#C0392B',
} as const;
const SERIF = "'Noto Serif KR', serif";
const TOSSPOINT_7DAY = PROMO.ATTEND_7DAY.amount;

export function EventsPage() {
  usePageTitle('이벤트');
  const navigate = useNavigate();
  // 토스포인트는 토스 앱(앱인토스)에서만 지급 가능 — 웹에서는 7일 블록 숨김 (지급 판정과 같은 기준)
  const inToss = useMemo(() => isAppsInToss(), []);

  const [snapshot, setSnapshot] = useState(() => getAttendanceSnapshot());
  const [attend7PaidCount, setAttend7PaidCount] = useState(() => getRewardLedger().counts.attend7);
  const [streakPulsing, setStreakPulsing] = useState(false);

  const [tierAOpen, setTierAOpen] = useState(false);
  const [tierAMsg, setTierAMsg] = useState<string | undefined>(undefined);
  const [tierBOpen, setTierBOpen] = useState(false);
  const [tierBKind, setTierBKind] = useState<TierBKind>('tosspoint');

  /** 기기 장부 다시 읽기 */
  const refresh = useCallback(() => {
    setSnapshot(getAttendanceSnapshot());
    setAttend7PaidCount(getRewardLedger().counts.attend7);
  }, []);

  useEffect(() => {
    refresh();
    // 지급 성공·출석 적립 시 즉시 갱신 + 화면 복귀(날짜 변경) 시 갱신
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener(REWARD_LEDGER_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(REWARD_LEDGER_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // 2026-06-24 — 이벤트 페이지 진입 계측 (출석·리워드 페이지 사용량 · 기존 트래킹 0건). 마운트 1회.
  // 2026-09-17 — 진입 시 장부 이전(구 토스포인트 지급 기록 1회) + 토스포인트 지급 대기분 재시도 (앱인토스만 실동작).
  useEffect(() => {
    trackEvent('content_open', { type: 'event' });
    seedLegacyPromoLedger().catch(() => {});
    retryPendingAttend7Reward().catch(() => {});
  }, []);

  /** 친구 초대 (2026-10-18) — 보상 있는 초대는 /invite (services/referral). 금액은 서버 규칙, 없으면 기본값 */
  const inviteRules = cachedInviteRules() || { referrerUn: 2, inviteeUn: 3 };

  /* ─── 7일 연속 출석 (토스포인트) 표시 — 실제 판정(연속 일수)과 같은 기준 ─── */
  const filled7 = snapshot.cycle7Filled;
  const weekPct = Math.min(100, (filled7 / ATTEND_CYCLE_DAYS) * 100);
  // 오늘 칸: 오늘 출석했으면 채운 마지막 칸, 아직이면 다음 칸
  const todayCell = snapshot.attendedToday ? filled7 - 1 : filled7;
  const paidToday = snapshot.cycle7CompletedToday && snapshot.cycle7PaidOn === snapshot.today;
  // 지급 대기는 완주한 날에만 유효 (토스 서버 날짜 = 완주일일 때만 지급 · 지난 사이클은 재시도 때 해제)
  const pendingToday = snapshot.cycle7CompletedToday && snapshot.cycle7Pending === snapshot.today;

  const weekStatusCopy = useMemo(() => {
    if (snapshot.cycle7CompletedToday) {
      if (paidToday) return `7일 연속 완주, 토스포인트 ${TOSSPOINT_7DAY}원 지급 완료`;
      if (pendingToday) return `7일 연속 완주, 토스포인트 ${TOSSPOINT_7DAY}원 지급 대기 중이에요`;
      return '7일 연속 완주, 내일부터 새 7일이 시작돼요';
    }
    if (filled7 === 0) {
      return snapshot.broken
        ? `연속이 끊겼어요, 오늘부터 다시 7일 이으면 토스포인트 ${TOSSPOINT_7DAY}원`
        : `오늘부터 7일 이어서 출석하면 토스포인트 ${TOSSPOINT_7DAY}원`;
    }
    if (snapshot.attendedToday) {
      return `${filled7}일째, ${ATTEND_CYCLE_DAYS - filled7}일 더 이어지면 토스포인트 ${TOSSPOINT_7DAY}원`;
    }
    return `${filled7}일째까지 이어졌어요, 오늘 결과 하나 보면 ${filled7 + 1}일째`;
  }, [snapshot, filled7, paidToday, pendingToday]);

  // 3일 달성 펄스 — 오늘 운 1 을 받은 날 이 페이지 진입 시 표시 효과만
  useEffect(() => {
    if (snapshot.attendedToday && snapshot.streak3Filled === 3 && snapshot.streak3PaidToday) {
      setStreakPulsing(true);
      const t = setTimeout(() => setStreakPulsing(false), 1200);
      return () => clearTimeout(t);
    }
  }, [snapshot.attendedToday, snapshot.streak3Filled, snapshot.streak3PaidToday]);

  return (
    <div style={{ background: C.paper, minHeight: '100vh', paddingBottom: 96 }}>
      <Header title="이벤트" />

      <div className="mx-auto" style={{ maxWidth: 460 }}>
        {/* 블록 1 — HeroBadge */}
        <HeroBadge />

        {/* 블록 2 — 3일 연속 streak 이동윈도우 */}
        <StreakWidget snapshot={snapshot} pulsing={streakPulsing} />

        {/* 블록 3 — 7일 연속 출석 → 토스포인트 (앱인토스만) */}
        {inToss ? (
          <section className="mx-4 mt-4 rounded-2xl px-[18px] py-[18px]"
            style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(47,42,35,0.04)' }}>
            <header className="flex items-center gap-2.5 mb-1">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={C.gold} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 9h18" />
                <path d="M8 3v4M16 3v4" />
              </svg>
              <h3 className="text-[16px] font-bold" style={{ color: C.navy, fontFamily: SERIF }}>7일 연속 출석</h3>
            </header>
            <p className="text-[13.5px] mb-4" style={{ color: C.muted, lineHeight: 1.5 }}>
              요일 상관없이 7일 이어서 출석할 때마다 토스포인트 {TOSSPOINT_7DAY}원. 하루 빠지면 1일째부터 다시 세요.
            </p>

            {/* 7칸 그리드 — 현재 7일 사이클 진행 */}
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {Array.from({ length: ATTEND_CYCLE_DAYS }, (_, i) => {
                const done = i < filled7;
                const isToday = i === todayCell && todayCell < ATTEND_CYCLE_DAYS;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 py-1">
                    <span className="text-[13px] font-medium"
                      style={{ color: done ? C.ink : isToday ? C.goldDark : C.muted,
                        fontWeight: isToday ? 600 : 500 }}>
                      {isToday ? '오늘' : `${i + 1}일`}
                    </span>
                    {/* 2026-10-18 채운 칸은 차례로 떠오르고, 오늘 칸은 마지막에 도장 찍듯 (motion.css) */}
                    <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center${done ? (snapshot.attendedToday && i === filled7 - 1 ? ' mo-stamp' : ' mo-rise') : ''}`}
                      style={{
                        ...(done ? (snapshot.attendedToday && i === filled7 - 1 ? moVars({ d: filled7 * 50 + 160 }) : moVars({ i })) : null),
                        background: done ? C.ink : isToday ? C.goldLight : '#FFFFFF', // 2026-10-10 v9 상태 표시는 먹
                        border: done ? `2px solid ${C.ink}` : isToday ? `2px solid ${C.goldDark}` : `2px dashed ${C.line}`,
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
              <div className="h-full transition-all mo-grow" style={{ width: `${weekPct}%`, background: C.ink }} />
            </div>
            <p className="text-[13.5px] mt-2.5" style={{ color: C.muted }} aria-live="polite">
              <strong style={{ color: C.ink }}>{filled7}/{ATTEND_CYCLE_DAYS}</strong>, {weekStatusCopy}
            </p>
            {attend7PaidCount > 0 ? (
              <p className="text-[13.5px] mt-1.5" style={{ color: C.muted }}>
                지금까지 <strong style={{ color: C.ink }}>{attend7PaidCount}회</strong> 받았어요
              </p>
            ) : null}
          </section>
        ) : null}

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
              친구 초대하고 운 받기
            </h3>
          </header>
          <p className="text-[13.5px] mb-4" style={{ color: C.muted, lineHeight: 1.5 }}>
            {`친구가 내 링크로 들어와 사주를 넣으면 나 ${inviteRules.referrerUn}운, 친구 ${inviteRules.inviteeUn}운을 드려요. 친구가 처음 충전하면 더 드려요.`}
          </p>

          <button type="button" onClick={() => { trackEvent('cta_click', { label: '이벤트 친구 초대', page: '/events' }); navigate('/invite'); }}
            className="w-full flex items-center justify-center gap-2.5 py-[18px] rounded-[14px] font-semibold text-[16px] transition"
            style={{
              background: 'linear-gradient(180deg, #D2B477 0%, #B8965A 100%)',
              color: '#17110A',
              boxShadow: '0 8px 18px rgba(140,109,61,.22)',
              cursor: 'pointer',
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#17110A" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>친구 초대하러 가기</span>
          </button>
        </section>

        {/* 블록 5 — 누적 운 카드 (하단 CTA 교체) */}
        <CumulativeReceivedCard showTossPoint={inToss} />

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

      {/* 결과 화면에서 기기 보상 지급(3일 연속 운 1 · 7일 토스포인트 성공) 시 남긴 플래그 → 이 페이지 진입 시 알림 */}
      <TrampolineFromSession
        onTierA={(msg) => { setTierAMsg(msg); setTierAOpen(true); }}
        onTierB={(kind) => { setTierBKind(kind); setTierBOpen(true); }}
      />
    </div>
  );
}

/**
 * 기기 보상 지급 시(dailyReward.processAttendanceRewards · retryPendingAttend7Reward) sessionStorage 플래그 저장.
 * 이벤트 탭 이동 시 이 Trampoline 이 플래그 감지 → Tier A/B 오픈 트리거.
 * sessionStorage 이므로 같은 세션 내 1회만 표시됨. 서버 markAttendance 결과로는 플래그를 세우지 않는다.
 */
function TrampolineFromSession({
  onTierA, onTierB,
}: { onTierA: (msg?: string) => void; onTierB: (kind: TierBKind) => void }) {
  useEffect(() => {
    const consume = () => {
      try {
        const tierA = sessionStorage.getItem(EVENTS_PENDING_TIER_A_KEY);
        if (tierA) {
          sessionStorage.removeItem(EVENTS_PENDING_TIER_A_KEY);
          onTierA(tierA);
        }
        const tierB = sessionStorage.getItem(EVENTS_PENDING_TIER_B_KEY);
        if (tierB === 'tosspoint' || tierB === 'un_fallback') {
          sessionStorage.removeItem(EVENTS_PENDING_TIER_B_KEY);
          onTierB(tierB as TierBKind);
        }
      } catch {/* noop */}
    };
    consume();
    // 이 페이지에 머무는 동안 지급 재시도가 성공해도(진입 시 retryPendingAttend7Reward) 바로 알림 — 장부 변경 때마다 다시 확인
    window.addEventListener(REWARD_LEDGER_CHANGED_EVENT, consume);
    return () => window.removeEventListener(REWARD_LEDGER_CHANGED_EVENT, consume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default EventsPage;
