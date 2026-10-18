// DailyFortunePage — #57 Sprint 2 UI 개편 (2026-04-24)
// 스펙: docs/mockups/사주500_UI개편_03_결과.md §10 (오늘운세 고유 레이아웃) · §6 (UpsellCard) · §7 (AdBanner)
// 핸드오프: §2-10
//
// 결과 구조 (§10):
//   - 상단 day-tile 96px 풀폭 · 좌 "M/D" Display 40 · 우 일주(60갑자) 한자
//   - L1 요약 (한자 32px + 점수 + 3~5문장)
//   - L2 본문 (오늘의 톤 + 시간대 흐름 압축)
//   - L3 심층 [축소] 1문단 (4영역 mini grid + reason)
//   - L4 "오늘 해볼 3가지" 고정 (체크리스트 3개 + 한 줄)
//   - AdBanner — build === 'appintos' && tier === 'free' 만
//   - 주간·월간 추천 카드 (DailyMockupView · 2026-09-17 복구, 과잉 금지)
//
// 과금 (2026-09-17 준기 결정 · 회귀 금지):
//   - 하루(KST) 1회 무료 → 두 번째부터 1운 (확인 모달 후 차감 · 실패 시 즉시 환불)
//   - 같은 날 같은 프로필 기록이 있으면 재생성 없이 그 결과를 연다 (무료 · 보관함 중복 0)
//   - 보관함에서 기존 결과 다시 열기는 무료
//
// 보존 (절대 삭제 금지):
//   - DailyRewardBadge (P2-5)
//   - SSOT 토큰 (#41 sweep + D1 fix)
//   - Flippable 정적화 (#39) — 결과 phase에서 SajuMiniCard 제거 (day-tile로 대체) · 재플립 추가 금지

import { kstToday } from '@/utils/kstDate';
import { INK_HERO_BG } from '@/components/hanji/Hanji';
import { ReviewAsk } from '@/components/common/ReviewAsk';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Solar } from 'lunar-javascript';
import { Header } from '@/components/layout/Header';
import { AdSlot } from '@/components/ads/AdSlot';
import { DarkHeader } from '@/components/layout/DarkHeader';
import { FadeIn } from '@/components/common/FadeIn';
import { AILoading } from '@/components/common/AILoading';
import { ErrorState } from '@/components/common/ErrorState';
import { ProfileSelector } from '@/components/common/ProfileSelector';
import { SajuMiniCard, type PillarData } from '@/components/saju/SajuMiniCard';
import { DailyRewardBadge } from '@/components/common/DailyRewardBadge';
import { DailyNotiButton } from '@/components/common/DailyNotiButton';
import { MonthGoodDays } from '@/components/home/MonthGoodDays';
import { DailyMailSignup } from '@/components/daily/DailyMailSignup';
import { InviteWelcomeCard } from '@/components/invite/InviteWelcomeCard';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import { useToast } from '@/components/common/Toast'; // 2026-05-27 — 공유 리워드 토스트용 재추가
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import {
  getProfiles,
  getReport,
  getReports,
  saveReport,
  generateId,
  getBalance,
  spendBalance,
  refundBalance,
  markPendingSpend,
  clearPendingSpend,
  getPendingSpends,
  type LocalReport,
  type SajuProfile,
} from '@/services/storage/localStore';
// 2026-09-17 — 1일 1회 무료 → 이후 1운. useFreePass 는 React 훅이 아니라 이름만 use* → 별칭으로 호출
import {
  hasFreePass,
  useFreePass as consumeFreePass,
  restoreFreePass,
  subscribeFreePass,
} from '@/services/storage/dailyFreePass';
import { generateDailyFortune, generateDailyFortuneStream } from '@/services/ai/reportGenerator';
import { getTopicPrice, formatPriceLabel, getMonthlyPrice } from '@/constants/pricing';
import { TOPIC_REGISTRY, type TopicId } from '@/constants/topics';
import { stripMd } from '@/utils/format';
import type { OhengType } from '@/types/saju';
import { CHEONGAN_KO, JIJI_KO } from '@/constants/oheng';
// 점수 SSOT + AI 프롬프트 baseScores100 전달
import { NextStepsCard, openChatWithResult } from '@/components/common/NextStepsCard';
import { computeDailyBase100 } from '@/utils/sajuScores';
// DailyMockupView 단일 호출 (legacy chrome 폐기 · 2026-05-06)
import { DailyMockupView, DAILY_TOPIC_GROUPS } from './daily/DailyMockupView';

/* ══════════════════════════════════════════════════════════════════
 * 토큰 / 매핑
 * ═════════════════════════════════════════════════════════════════ */

const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

/** 천간(10간) → 오행 */
const STEM_TO_OHENG: Record<string, OhengType> = {
  甲: '목', 乙: '목',
  丙: '화', 丁: '화',
  戊: '토', 己: '토',
  庚: '금', 辛: '금',
  壬: '수', 癸: '수',
};

type Phase = 'select' | 'loading' | 'result' | 'error';

interface DateInfo {
  date: string;
  weekday: string;
  ganzi: string;
  label: string;
}

/* ══════════════════════════════════════════════════════════════════
 * Page
 * ═════════════════════════════════════════════════════════════════ */
export function DailyFortunePage() {
  usePageTitle('오늘의 운세');
  useSeoMeta({
    description: '오늘의 운세를 명리학으로 하루 1회 무료로 풀이해드려요. 매일 보는 나의 운세, 사주500.',
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { mark } = useAttendanceOnResult();
  const toast = useToast();

  // 2026-05-07 fix — 보관함 → /daily 진입 시 location.state 로 savedResult/savedReport 전달
  // (Daeun/Monthly/Tojung/Compat 와 동일 패턴. 이전엔 ?reportId query 만 봐서 입력화면 떨어졌음)
  const navState = location.state as { savedResult?: any; savedReport?: any } | undefined;

  const profiles: SajuProfile[] = useMemo(() => getProfiles(), []);
  const hasAnyProfile = profiles.length > 0;

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => {
    // navState 의 savedReport 가 있으면 그 input 으로 매칭되는 프로필 우선
    if (navState?.savedReport?.input) {
      const r = navState.savedReport.input;
      // 2026-10-17 — 생일만 보면 생일이 같은 가족이 있을 때 다른 사람으로 열렸다 → 기록의 프로필 id, 이름+생일 순
      const pid = (navState.savedReport as any)?.profileId;
      const byId = pid ? profiles.find((p) => p.id === pid) : undefined;
      const sameBirth = (p: SajuProfile) => p.input?.birthYear === r.birthYear && p.input?.birthMonth === r.birthMonth && p.input?.birthDay === r.birthDay;
      const matched = byId
        || profiles.find((p) => sameBirth(p) && p.name === navState.savedReport?.name)
        || profiles.find(sameBirth);
      if (matched) return matched.id;
    }
    // 2026-10-17 — 가족 사주를 새로 넣고 돌아오면(?profileId=) 그 사람으로
    const qp = searchParams.get('profileId');
    if (qp && profiles.some((p) => p.id === qp)) return qp;
    const self = profiles.find((p) => !p.relation || p.relation === '본인');
    return (self ?? profiles[0])?.id ?? null;
  });
  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  // savedReport 가 있으면 (aiResult 비어도) result phase 강제 — 입력 화면 회귀 절대 차단
  const [phase, setPhase] = useState<Phase>(navState?.savedReport ? 'result' : 'select');
  const [result, setResult] = useState<any>(navState?.savedResult ?? null);
  const [apiError, setApiError] = useState('');
  // 2026-09-17 — 화면에 띄운 결과의 날짜(KST)·과금 구분. 보관함 과거 기록은 그날 날짜/일진으로 헤더 표시.
  const [resultDateKey, setResultDateKey] = useState<string | null>(
    () => (navState?.savedReport ? reportDateKey(navState.savedReport) : null),
  );
  const [resultTier, setResultTier] = useState<'free' | 'paid'>(
    navState?.savedReport?.type === 'paid' ? 'paid' : 'free',
  );
  // 생성(스트리밍) 진행 중 — §07 스켈레톤·추천 카드 노출 판단용
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  // 2026-06-18 퍼널 — 오늘운세 결과 도달 시 content_result 발사 (무료 퍼널 완성 · /result 자동발사 경로 밖)
  const dailyResultTrackedRef = useRef(false);
  useEffect(() => {
    if (result && !dailyResultTrackedRef.current) {
      dailyResultTrackedRef.current = true;
      import('@/services/analytics').then((a) => a.trackEvent('content_result', { type: 'daily' })).catch(() => {});
    }
  }, [result]);
  // 결과 도달 시 출석 적립과 조회 기록 (출시 프로모션 50원은 2026-10 종료로 지급 호출 제거)
  useEffect(() => {
    if (phase === 'result') {
      // 2026-06-02 — 출석 적립 + 일일/연속 보상 자동 지급 (콘텐츠 이용 시, 클라 잔액 적립)
      import('@/services/storage/dailyReward').then(m => m.processAttendanceRewards());
      // LIVE BEST 조회 기록 (24h 디듀프)
      import('@/services/liveBest').then(m => m.recordTopicView('daily')).catch(() => {});
    }
  }, [phase]);
  const [streamProgress, setStreamProgress] = useState<{ chunks: number; chars: number; elapsedMs: number } | null>(null);
  const isAnalyzingRef = useRef(false);

  // 프로필 전환 시 결과 초기화 (단, ?reportId 또는 navState.savedResult 진입 직후엔 복원 결과 보존)
  const reportIdFromUrl = searchParams.get('reportId');
  // 2026-05-07 fix — navState.savedReport 가 있으면 mount 시 cleanup 차단 (보관함 진입 보호)
  const restoreFromNavStateRef = useRef(!!navState?.savedReport);
  useEffect(() => {
    // ?reportId 가 있으면 이 effect 가 cleanup 하지 않음 (복원 effect 가 result 세팅)
    if (reportIdFromUrl) return;
    // navState.savedResult 로 mount 한 직후 (1회 limit) cleanup skip
    if (restoreFromNavStateRef.current) {
      restoreFromNavStateRef.current = false;
      return;
    }
    setResult(null);
    setPhase('select');
    setApiError('');
  }, [selectedProfileId, reportIdFromUrl]);

  /* P0 fix (2026-05-06 회귀 차단 #2) — 보관함 → 오늘의 운세 결과 복원
   * 변경: deps [reportIdFromUrl] (race condition 차단) + restoreOnceRef (1회 가드)
   * + r.aiResult 비어도 phase='result' 강제 (입력 페이지 회귀 절대 차단) */
  const restoreOnceRef = useRef(false);
  useEffect(() => {
    if (restoreOnceRef.current) return;
    if (!reportIdFromUrl) return;
    restoreOnceRef.current = true;
    try {
      const r = getReport(reportIdFromUrl);
      console.log('[DailyFortunePage] reportId 복원 시도:', reportIdFromUrl, '→', !!r, '/aiResult:', !!r?.aiResult);
      if (!r) return;
      // aiResult 비어도 phase 전이 (회귀 차단 — 입력 페이지로 절대 떨어지지 않게)
      if (r.aiResult) setResult(r.aiResult);
      setResultDateKey(reportDateKey(r));
      setResultTier(r.type === 'paid' ? 'paid' : 'free');
      setPhase('result');
      // 해당 리포트의 프로필로 selectedProfileId 도 정렬 (없으면 무시)
      // 2026-10-17 — 프로필 id, 이름+생일, 생일 순 (생일이 같은 가족 구분)
      const sameBirthR = (p: SajuProfile) => p.input?.birthYear === r.input?.birthYear && p.input?.birthMonth === r.input?.birthMonth && p.input?.birthDay === r.input?.birthDay;
      const matchingProfile = (r.profileId ? profiles.find((p) => p.id === r.profileId) : undefined)
        || profiles.find((p) => sameBirthR(p) && p.name === r.name)
        || profiles.find(sameBirthR);
      if (matchingProfile && matchingProfile.id !== selectedProfileId) {
        setSelectedProfileId(matchingProfile.id);
      }
    } catch (e) {
      console.error('[DailyFortunePage] reportId 복원 실패:', e);
    }
  }, [reportIdFromUrl]);

  // 2026-09-17 KST 통일 — 기기 로컬시각 1회 스냅샷이면 자정을 넘겨도 전날 날짜·일진으로 남았음.
  //   todayKey = KST 'YYYY-MM-DD' · 포커스/화면 복귀/자정 넘김/무료 패스 변경 시 재계산.
  const [todayKey, setTodayKey] = useState(() => kstToday());
  const [freePassAvailable, setFreePassAvailable] = useState(() => hasFreePass('daily'));
  const [reportsVersion, setReportsVersion] = useState(0); // 저장 직후 '오늘 기록' 재조회 트리거
  useEffect(() => {
    const refresh = () => {
      const k = kstToday();
      setTodayKey((prev) => (prev === k ? prev : k));
      setFreePassAvailable(hasFreePass('daily'));
      setReportsVersion((v) => v + 1); // 화면 복귀 시 '오늘 기록'·'만드는 중' 재조회
    };
    // 무료 생성 도중 앱이 닫혀 결과를 못 받은 경우 → 무료 1회 되돌림 (유료 pending 자동환불과 같은 취지)
    recoverStaleInflights();
    refresh();
    return subscribeFreePass(refresh);
  }, []);
  const dateInfo = useMemo(() => buildDateInfo(todayKey), [todayKey]);
  // 결과 헤더용 — 보관함에서 연 과거 기록이면 그날 날짜/일진
  const resultDateInfo = useMemo(
    () => (resultDateKey && resultDateKey !== todayKey ? buildDateInfo(resultDateKey) : dateInfo),
    [resultDateKey, todayKey, dateInfo],
  );
  // 선택 프로필의 오늘(KST) 완성 기록 — 있으면 CTA 가 '다시 보기'(무료)
  const todayReport = useMemo(
    () => (selectedProfile
      ? findTodayDailyReports(selectedProfile, todayKey).find((r) => isCompleteDailyResult(r.aiResult)) ?? null
      : null),
    // reportsVersion·phase — 저장/화면 전환 후 localStorage 재조회용 트리거
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProfile, todayKey, reportsVersion, phase],
  );
  // 2026-09-18 — 같은 프로필·날짜 생성이 이전 화면(백그라운드)에서 진행 중인지. 진행 중이면 3초마다 재조회 →
  //   끝나 저장되면 CTA 가 '다시 보기' 로 바뀜 (진행 중 재결제 차단은 requestAnalyze/confirmPaidAnalyze)
  const dailyInProgress = useMemo(
    () => (selectedProfile && !todayReport ? isDailyInProgress(selectedProfile.id, todayKey) : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProfile, todayKey, todayReport, reportsVersion, phase],
  );
  useEffect(() => {
    if (!dailyInProgress || phase !== 'select') return;
    const t = window.setInterval(() => {
      recoverStaleInflights();
      setReportsVersion((v) => v + 1);
    }, 3000);
    return () => window.clearInterval(t);
  }, [dailyInProgress, phase]);
  const balance = getBalance();

  /* ─── 오늘의 운세 시작 — 과금 분기 (2026-09-17 준기 결정 · 회귀 금지) ───
   *   ① 오늘(KST) 같은 프로필의 완성 기록 있음 → 재생성 X, 그 결과를 연다 (무료 · 보관함 중복 0)
   *      기록이 __partial/불완전이면 ②③ 규칙으로 재생성하되 같은 id 로 덮어써 중복 방지
   *   ② 무료 패스 남음 → 무료 패스 사용 후 생성 (실패 시 restoreFreePass)
   *   ③ 무료 패스 소진 → 확인 모달 → 1운 차감 + pending 마킹 후 생성 (실패 시 즉시 환불)
   *   ※ 2026-09-18 — 같은 프로필·날짜 생성이 진행 중(/daily 를 떠나도 백그라운드로 계속됨)이면 ②③ 대신 안내만
   *      (저장 전 재진입 → 오늘 기록 없음 → '· 1운' 재결제되던 이중 결제 차단)
   *   (4월 afb9483 의 "무료 1회 → 이후 1운" 이 재작성 중 유실돼 무제한 무료였던 것을 복구) */
  function requestAnalyze() {
    const profile = selectedProfile;
    if (!profile?.sajuData) return;
    if (isAnalyzingRef.current) return;
    const key = kstToday();
    if (key !== todayKey) setTodayKey(key);
    const todays = findTodayDailyReports(profile, key);
    const done = todays.find((r) => isCompleteDailyResult(r.aiResult));
    if (done) {
      setApiError('');
      setResult(done.aiResult);
      setResultDateKey(key);
      setResultTier(done.type === 'paid' ? 'paid' : 'free');
      setPhase('result');
      return;
    }
    recoverStaleInflights();
    if (isDailyInProgress(profile.id, key)) {
      toast.show('오늘의 운세를 만드는 중이에요. 잠시 후 다시 열어주세요', 'info');
      return;
    }
    // 무료권을 쓴 날 = key (runAnalyze 실패 시 restoreFreePass('daily', dateKey) 로 같은 날만 복구)
    if (hasFreePass('daily') && consumeFreePass('daily')) {
      void runAnalyze({ profile, tier: 'free', dateKey: key, reuseId: todays[0]?.id });
      return;
    }
    setFreePassAvailable(false);
    setShowPayConfirm(true);
  }

  /** ③ 확인 모달 '1운으로 보기' — 잔액 부족이면 충전으로 */
  function confirmPaidAnalyze() {
    setShowPayConfirm(false);
    const profile = selectedProfile;
    if (!profile?.sajuData) return;
    if (isAnalyzingRef.current) return;
    const key = kstToday();
    // 모달이 떠 있는 사이 자정이 지나 무료 패스가 새로 생겼거나 오늘 기록이 생겼으면 재판정 (불필요한 차감 방지)
    const todays = findTodayDailyReports(profile, key);
    if (todays.some((r) => isCompleteDailyResult(r.aiResult)) || hasFreePass('daily')) {
      requestAnalyze();
      return;
    }
    // 이중 결제 방지 — 모달이 떠 있는 사이 같은 프로필·날짜 생성이 진행 중이면 차감하지 않음
    recoverStaleInflights();
    if (isDailyInProgress(profile.id, key)) {
      toast.show('오늘의 운세를 만드는 중이에요. 잠시 후 다시 열어주세요', 'info');
      return;
    }
    if (!spendBalance(1)) {
      import('@/services/analytics').then((a) => a.trackEvent('insufficient_balance', { type: 'daily', needed: 1 })).catch(() => {});
      navigate('/charge?need=1', { state: { message: '오늘의 운세에 1운이 필요해요', returnTo: '/daily' } });
      return;
    }
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'daily', amount: 1 })).catch(() => {});
    // 머니세이프 — 생성 중 앱 종료 시 부팅 reconcile 이 자동환불. 저장 성공 시 해제. (Dream·Topic 동일 패턴)
    //   type 에 프로필·날짜 태그 → isDailyInProgress 가 '같은 프로필 결제 생성 진행 중' 판정에 사용
    const pendingId = markPendingSpend(`daily:${profile.id}:${key}`, 1);
    void runAnalyze({ profile, tier: 'paid', dateKey: key, reuseId: todays[0]?.id, pendingId });
  }

  /* ─── 오늘의 운세 호출 ─── (호출부가 무료 패스 사용/1운 차감을 끝낸 뒤 진입) */
  async function runAnalyze({
    profile,
    tier,
    dateKey,
    reuseId,
    pendingId,
  }: {
    profile: SajuProfile;
    tier: 'free' | 'paid';
    dateKey: string;
    /** 오늘 불완전 기록이 있으면 그 id 로 덮어씀 */
    reuseId?: string;
    /** 유료 차감 pending id — 저장 성공 시 해제, 실패 시 해제 후 즉시 환불 */
    pendingId?: string;
  }) {
    isAnalyzingRef.current = true;
    setIsGenerating(true);
    setResultTier(tier);
    setResultDateKey(dateKey);
    setPhase('loading');
    setApiError('');
    // 진행 마커 — 화면을 떠나도 생성은 계속되므로 재진입 시 이중 시작/결제 차단 + 이탈 시 무료 1회 복구용
    const inflightId = beginInflight(profile.id, dateKey, tier);
    const dayInfo = buildDateInfo(dateKey);
    const tomorrowInfo = buildDateInfo(shiftDateKey(dateKey, 1));

    try {
      // STEP 2A — 종합사주 base 점수 (subScores ±2 한도 강제용)
      const baseScores100 = computeDailyBase100(profile.sajuData);
      const callPayload = {
        name: profile.name || '',
        sajuData: profile.sajuData,
        date: dayInfo.date,
        weekday: dayInfo.weekday,
        todayGanzi: dayInfo.ganzi,
        baseScores100,
        tomorrowGanzi: tomorrowInfo.ganzi,
        tomorrowDate: tomorrowInfo.date,
      };

      // 2026-05-06 v2 — Streaming SSE + timeout 강제 + 자세한 로그
      // P0 fix: 로딩만 되고 결과 안 옴 → SSE Promise hang 시 90초 timeout + callable 폴백
      let res: any;
      let streamingDone = false;
      setStreamProgress(null);
      const sseStartedAt = Date.now();

      console.log('[DailyFortune] analyze() 시작');

      await new Promise<void>((resolve) => {
        let resolved = false;
        const finish = (reason: string) => {
          if (resolved) return;
          resolved = true;
          console.log(`[DailyFortune] SSE finish: ${reason} (${Date.now() - sseStartedAt}ms)`);
          resolve();
        };
        // 90초 timeout — SSE 가 결과 못 주면 강제 callable 폴백
        const timeoutId = setTimeout(() => {
          console.warn('[DailyFortune] SSE 90s timeout → callable 폴백');
          finish('timeout');
        }, 90_000);
        // 2026-06-11 P0 — 'done' 이벤트 유실 방어: A1·A2·B 3그룹이 모두 도착했으면
        //   결과는 이미 완전함. done 이 8초 내 안 오면 그룹 머지본으로 자체 완료
        //   (기존엔 90초 대기 후 callable 재생성 → 유저 90초+ 대기 + AI 비용 2배).
        let allGroupsGraceId: ReturnType<typeof setTimeout> | null = null;
        // 첫 chunk 30초 timeout — 첫 chunk 안 오면 streaming 안 작동 가정
        const firstChunkTimeoutId = setTimeout(() => {
          if (!resolved) {
            console.warn('[DailyFortune] SSE 30s 첫 chunk 미도달 → callable 폴백');
            finish('first-chunk-timeout');
          }
        }, 30_000);

        let phaseTransitioned = false;
        // v6.1 · 3 그룹 (A1/A2/B) 누적 머지 — A1 도착 시 첫 paint (~6s)
        const groupBuffer: Record<string, any> = { A1: null, A2: null, B: null, A: null };
        generateDailyFortuneStream(callPayload, {
          onStart: () => console.log('[DailyFortune] SSE start'),
          onPartial: ({ partial, totalChars, group }) => {
            // ⭐ Progressive Render — 3 그룹 머지된 partial 갱신
            try {
              clearTimeout(firstChunkTimeoutId);
              if (!partial || typeof partial !== 'object') return;
              setResult(partial);
              // Group A1 의 핵심 키 (title·subScores) 도달 시 즉시 전이
              const hasMinKeys =
                partial.title || partial.headline ||
                partial.scoreHeadline || partial.todayNarrative ||
                partial.subScores;
              if (!phaseTransitioned && hasMinKeys) {
                phaseTransitioned = true;
                setPhase('result');
                console.log('[DailyFortune] 첫 partial → phase=result 전이', { group, chars: totalChars });
              }
            } catch (err) {
              console.error('[DailyFortune] onPartial throw (가드됨):', err);
            }
          },
          onGroup: ({ group, data, elapsedMs }) => {
            // Group 완료 — partial 보다 정확한 fully-parsed 데이터.
            // A1·A2·B 어떤 순서로 도착해도 머지.
            try {
              clearTimeout(firstChunkTimeoutId);
              groupBuffer[group] = data;
              const merged: any = {
                ...(groupBuffer.A1 || {}),
                ...(groupBuffer.A2 || {}),
                ...(groupBuffer.B || {}),
                ...(groupBuffer.A || {}), // legacy fallback
              };
              setResult(merged);
              if (!phaseTransitioned) {
                phaseTransitioned = true;
                setPhase('result');
              }
              console.log(`[DailyFortune] Group ${group} 완료 (${elapsedMs}ms) → 머지 갱신`);
              // 3그룹 완비 → done 유실 대비 8초 유예 자체 완료
              if (groupBuffer.A1 && groupBuffer.A2 && groupBuffer.B && !resolved && !allGroupsGraceId) {
                allGroupsGraceId = setTimeout(() => {
                  if (resolved) return;
                  const full: any = { ...(groupBuffer.A1 || {}), ...(groupBuffer.A2 || {}), ...(groupBuffer.B || {}) };
                  console.warn('[DailyFortune] done 미수신 — 3그룹 머지본으로 자체 완료');
                  res = full;
                  streamingDone = true;
                  setResult(full);
                  if (!phaseTransitioned) { phaseTransitioned = true; setPhase('result'); }
                  clearTimeout(timeoutId);
                  finish('all-groups-grace');
                }, 8_000);
              }
            } catch (err) {
              console.error('[DailyFortune] onGroup throw (가드됨):', err);
            }
          },
          onProgress: (info) => {
            clearTimeout(firstChunkTimeoutId);
            setStreamProgress(info);
          },
          onDone: ({ result: streamResult, cached }) => {
            console.log('[DailyFortune] SSE done', { cached, hasResult: !!streamResult });
            clearTimeout(timeoutId);
            clearTimeout(firstChunkTimeoutId);
            if (allGroupsGraceId) clearTimeout(allGroupsGraceId);
            if (streamResult) {
              res = streamResult;
              streamingDone = true;
              // 완전한 결과로 갱신 (partial/group → final)
              setResult(streamResult);
              if (!phaseTransitioned) setPhase('result');
            }
            finish('done');
          },
          onError: (msg) => {
            console.warn('[DailyFortune] SSE error → callable 폴백:', msg);
            clearTimeout(timeoutId);
            clearTimeout(firstChunkTimeoutId);
            finish('sse-error');
          },
        }).catch((e) => {
          console.warn('[DailyFortune] SSE throw → callable 폴백:', e?.message);
          clearTimeout(timeoutId);
          clearTimeout(firstChunkTimeoutId);
          finish('sse-throw');
        });
      });

      // SSE 실패 시 callable 폴백
      if (!streamingDone) {
        console.log('[DailyFortune] callable 폴백 시작');
        try {
          res = await generateDailyFortune(callPayload);
          console.log('[DailyFortune] callable 응답 도달', { hasResult: !!res });
        } catch (retryErr: any) {
          const msg = String(retryErr?.message || '');
          const is500 = msg.includes('500') || msg.includes('Internal server error') || msg.includes('api_error');
          if (is500) {
            console.warn('[DailyFortune] callable 일시 500 → 1초 후 재시도');
            await new Promise((r) => setTimeout(r, 1000));
            res = await generateDailyFortune(callPayload);
          } else {
            throw retryErr;
          }
        }
      }
      console.log('[DailyFortune] analyze() 응답 확보', { hasResult: !!res, keys: res ? Object.keys(res).slice(0, 5) : [] });

      // 응답 검증 완화 (2026-05-06) — title 또는 todayNarrative 또는 subScores 중 하나라도 있으면 OK
      // 이전: overallScore/score 강제 → 누락 시 throw → "로딩만 됨" 버그 원인
      if (!res || typeof res !== 'object') {
        throw new Error('응답 데이터를 받지 못했어요');
      }
      const hasMinContent =
        ('title' in res) || ('headline' in res) ||
        ('todayNarrative' in res) || ('subScores' in res) ||
        ('overallScore' in res) || ('score' in res);
      if (!hasMinContent) {
        console.error('[DailyFortune] 응답 형식 미달:', Object.keys(res));
        throw new Error('응답 데이터가 비어있어요. 다시 시도해주세요.');
      }

      // 2026-09-18 안전망 — 이 생성이 도는 사이 같은 프로필·날짜 완성 기록이 먼저 저장됐으면(다른 탭 등)
      //   유료 = 이중 결제 → 1운 즉시 환불 후 기존 결과를 연다. 무료 = 그 기록을 덮어써 보관함 중복 0.
      const existing = findTodayDailyReports(profile, dateKey).find((r) => isCompleteDailyResult(r.aiResult)) ?? null;
      if (tier === 'paid' && existing) {
        if (pendingId) clearPendingSpend(pendingId); // 즉시 환불하므로 해제 (부팅 이중환불 방지)
        refundBalance(1);
        setResult(existing.aiResult);
        setResultTier(existing.type === 'paid' ? 'paid' : 'free');
        setPhase('result');
        toast.show('이미 받은 오늘의 운세가 있어 1운을 돌려드렸어요', 'info');
        setReportsVersion((v) => v + 1);
        return;
      }

      setResult(res);
      setPhase('result');
      if (tier === 'paid') toast.show('1운이 차감됐어요', 'info');

      // 이벤트 v4 출석 마커 (KST 당일 1회) — 보존
      mark().catch(() => {/* non-blocking */});

      try {
        // 2026-09-17 — 불완전 기록이 있었으면 같은 id 로 덮어씀(중복 0) · profileId/__fortuneDate 로 '오늘 기록' 정확 매칭
        saveReport({
          id: existing?.id || reuseId || generateId(),
          name: profile.name,
          input: profile.input,
          sajuData: profile.sajuData,
          type: existing?.type === 'paid' ? 'paid' : tier,
          contentType: 'daily',
          aiResult: { ...res, __fortuneDate: dateKey },
          createdAt: new Date().toISOString(),
          profileId: profile.id,
          spentUn: existing?.type === 'paid' || tier === 'paid' ? 1 : 0, // 2026-10-15 보관함 장부 (하루 1회 무료, 두 번째부터 1운)
        });
        if (pendingId) clearPendingSpend(pendingId); // 저장 완료 → 자동환불 대상 제외
      } catch {
        /* 저장 실패(용량초과 등) — 유료면 pending 유지 → 부팅 reconcile 자동환불 (Dream·Topic 동일 패턴) */
      }
      setReportsVersion((v) => v + 1);
    } catch (e: any) {
      console.error('[DailyFortune] 실패:', e);
      // 2026-05-29 — e.message(영문 기술오류) 노출 금지. 항상 친절 카피.
      // 2026-09-17 — 결과를 못 드렸으면 받은 만큼 즉시 되돌리고, 안내 문구도 실제와 맞춤.
      if (tier === 'paid') {
        if (pendingId) clearPendingSpend(pendingId); // 즉시 환불하므로 해제 (부팅 이중환불 방지)
        refundBalance(1);
        setApiError('오늘의 운세를 살피는 데 잠시 문제가 생겼어요. 차감된 1운은 바로 돌려드렸어요.');
      } else {
        restoreFreePass('daily', dateKey); // 무료권 쓴 날 = dateKey · 자정 넘겨 실패하면 새 날 무료권은 건드리지 않음
        setApiError('오늘의 운세를 살피는 데 잠시 문제가 생겼어요. 오늘 무료 1회는 그대로 남아 있어요.');
      }
      setResult(null);
      setPhase('error');
    } finally {
      endInflight(inflightId);
      isAnalyzingRef.current = false;
      setIsGenerating(false);
    }
  }

  // 결과 phase 일 때 DarkHeader (PremiumResult 패턴 통일), 그 외 기본 Header
  const isResultPhase = phase === 'result' && !!selectedProfile;
  // 2026-10-17 웹 아침 일주 운세 메일 (앱은 DailyNotiButton 토스 알림) — 고른 사주의 생일로 미리 채운다
  const mailPrefill = (() => {
    const inp: any = (selectedProfile as any)?.input;
    if (!inp?.birthYear) return undefined;
    const p2 = (n: number) => String(n).padStart(2, '0');
    return { birth: `${inp.birthYear}${p2(inp.birthMonth)}${p2(inp.birthDay)}`, calendar: (inp.calendarType === 'lunar' ? 'lunar' : 'solar') as 'solar' | 'lunar', name: (selectedProfile as any)?.name || '' };
  })();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      {isResultPhase ? (
        <DarkHeader
          title={selectedProfile?.name ? `${selectedProfile.name} 님의 오늘의 운세` : '내 오늘의 운세'}
          subtitle={resultTier === 'paid' ? '오늘 하루를 일곱 장으로' : '무료로 읽는 오늘 하루 일곱 장'}
          chip={resultTier === 'paid' ? '1운' : '무료'}
          chipVariant={resultTier === 'paid' ? 'gold' : 'free'}
        />
      ) : (
        <Header title="오늘의 운세" />
      )}
      {/* result phase = 풀 width (daily-mockup 자체 padding 사용 · 종합사주 패턴) */}
      <div
        className={isResultPhase ? 'pb-[120px] mx-auto' : 'px-5 pt-4 pb-[120px] mx-auto'}
        style={{ maxWidth: 520 }}
      >
        {/* P2-5 · 데일리 리워드 배지 — result phase 에서는 숨김 (2026-05-06)
            DarkHeader 아래 중복 정보 제거. select phase 에서만 노출. */}
        {hasAnyProfile && !isResultPhase && <DailyRewardBadge className="mb-4" />}
        {/* 매일 아침 운세 알림 동의 (2026-06-13 · 앱인토스 + templateCode 설정 시에만 노출). 2026-10-16 — 결과 화면에선 위 대신 끝에 */}
        {hasAnyProfile && !isResultPhase && <DailyNotiButton className="mb-4" />}

        <AnimatePresence mode="wait">
          {!hasAnyProfile && (
            <motion.div
              key="no-profile"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <ProfileSelector
                profiles={profiles}
                selectedId={selectedProfileId}
                onChange={setSelectedProfileId}
                onCreateNew={() => navigate('/input?from=daily')}
              />
              <p
                className="text-body-sm"
                style={{ color: 'var(--text-muted)', textAlign: 'center' }}
              >
                오늘의 운세는 사주 기반이에요. 생년월일만 넣으면 1분이면 돼요.
              </p>
              {/* 2026-10-17 웹 아침 일주 운세 메일 — 무료 사주 넣기 아래 (앱은 그리지 않음) */}
              <DailyMailSignup source="daily_empty" style={{ marginTop: 8 }} />
            </motion.div>
          )}

          {hasAnyProfile && phase === 'select' && (
            <SelectView
              key="select"
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onProfileChange={setSelectedProfileId}
              onCreateNew={() => navigate('/input?new=1&from=daily')}
              profile={selectedProfile}
              dateInfo={dateInfo}
              ctaLabel={todayReport ? '오늘의 운세 다시 보기' : dailyInProgress ? '오늘의 운세를 만드는 중이에요' : freePassAvailable ? '무료로 오늘의 운세 보기' : '1운으로 오늘의 운세 보기'}
              tierChip={todayReport ? '다시 보기는 무료' : dailyInProgress ? '만드는 중' : freePassAvailable ? '하루 1회 무료' : '두 번째부터 1운'}
              onAnalyze={requestAnalyze}
            />
          )}

          {hasAnyProfile && phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AILoading
                name={selectedProfile?.name ?? ''}
                type="오늘의 운세"
                sajuData={selectedProfile?.sajuData}
                steps={[
                  '오늘 간지와 사주를 교차하고 있어요',
                  '4영역 점수를 계산하고 있어요',
                  '시간대별 흐름을 정리하고 있어요',
                ]}
                streamProgress={streamProgress}
              />
            </motion.div>
          )}

          {hasAnyProfile && phase === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ErrorState
                title="해석을 가져오지 못했어요"
                subtitle={apiError || '잠시 후 다시 시도해주세요'}
                onRetry={requestAnalyze}
                onBack={() => setPhase('select')}
                backLabel="선택 화면으로"
                showRefundNote={false}
              />
            </motion.div>
          )}

          {hasAnyProfile && phase === 'result' && result && selectedProfile && (
            <ResultView
              key="result"
              result={result}
              profile={selectedProfile}
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              onProfileChange={setSelectedProfileId}
              onCreateNew={() => navigate('/input?new=1&from=daily')}
              dateInfo={resultDateInfo}
              tier={resultTier}
              isGenerating={isGenerating}
              // 2026-09-17 — 주간(5운)·월간(7운) 2026-06-29 출시 → 추천 카드 복구
              // 2026-09-18 — 보던 프로필 유지 (쿼리 형태 = 충전 페이지 왕복 후에도 유지 · Weekly/MonthlyPage 가 ?profileId 로 미리 선택)
              onWeeklyUpsell={() => navigate(`/weekly?profileId=${encodeURIComponent(selectedProfile.id)}`)}
              onMonthlyUpsell={() => navigate(`/monthly?profileId=${encodeURIComponent(selectedProfile.id)}`)}
              onRetry={requestAnalyze}
            />
          )}
        </AnimatePresence>

        {/* 2026-10-18 친구 초대로 처음 온 사람 — 첫 운세를 받은 바로 이 자리에서 초대 선물 받기 */}
        {hasAnyProfile && phase === 'result' && result && !isGenerating && !(result as any).__partial && (
          <InviteWelcomeCard padding="24px 20px 0" />
        )}
        {/* 2026-10-16 — 다 읽은 끝에서 내일 아침 알림 권하기 (동의했으면 안 보임) */}
        {hasAnyProfile && phase === 'result' && result && selectedProfile && !isGenerating && !(result as any).__partial && (
          <DailyNotiButton variant="closing" className="mt-6" />
        )}
        {/* 2026-10-17 월초(1~7일) 이번 달 좋은 날 — 아침 알림으로 바로 여기 오는 사람에게도 */}
        {hasAnyProfile && phase === 'result' && result && selectedProfile && !isGenerating && !(result as any).__partial && (
          <MonthGoodDays sajuData={selectedProfile.sajuData} name={selectedProfile.name || '나'} price={getMonthlyPrice().actualPrice}
            profileId={selectedProfile.id} source="daily" padding="24px 20px 0" />
        )}
        {hasAnyProfile && phase === 'result' && result && selectedProfile && !isGenerating && !(result as any).__partial && (
          <div className="px-5"><DailyMailSignup prefill={mailPrefill} source="daily_result" style={{ marginTop: 24 }} /></div>
        )}

        {/* 2026-10-10 — 실제 후기 수집 (생성 끝난 뒤 · 사람·날짜당 한 번) */}
        {hasAnyProfile && phase === 'result' && result && selectedProfile && !isGenerating && !(result as any).__partial && (
          <ReviewAsk contentType="daily" contentLabel="오늘의 운세"
            reportKey={`daily:${selectedProfile.id}:${(result as any).__fortuneDate || todayKey}`}
            style={{ margin: '28px 0 0' }} />
        )}

        {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) */}
        <div className="mt-10 text-center space-y-1">
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평, 자평진전, 적천수, 궁통보감, 명리약언, 삼명통회) 기반
          </p>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            사주는 삶의 기운을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
          </p>
        </div>
      </div>

      {/* 2026-09-17 — 무료 1회 소진 후 1운 확인 (앱인토스: window.confirm 금지 → Modal · Topic 결제확인과 동일 스타일) */}
      <Modal
        isOpen={showPayConfirm}
        onClose={() => setShowPayConfirm(false)}
        title="오늘 무료 운세를 이미 받았어요"
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: '#3D3D3D', lineHeight: 1.65, marginBottom: 8, wordBreak: 'keep-all' }}>
            1운으로{' '}
            <strong style={{ color: '#A37A2E' }}>
              {selectedProfile?.name ? `${selectedProfile.name} 님의 ` : ''}오늘의 운세
            </strong>
            를 볼까요?
          </p>
          <ul style={{ fontSize: 13, color: '#5C4A2E', lineHeight: 1.7, paddingLeft: 0, listStyle: 'none', wordBreak: 'keep-all' }}>
            {balance >= 1 ? (
              <li>현재 잔액 {balance}운 → 차감 후 {Math.round((balance - 1) * 10) / 10}운</li>
            ) : (
              <li>현재 잔액 {balance}운, 1운이 필요해요</li>
            )}
            <li>받은 결과는 보관함에 저장되고, 오늘 다시 열 때는 차감되지 않아요</li>
            <li>무료 1회는 매일 자정(한국시간)에 다시 생겨요</li>
          </ul>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" fullWidth onClick={() => setShowPayConfirm(false)}>
            취소
          </Button>
          <Button variant="gold" fullWidth onClick={confirmPaidAnalyze}>
            {balance >= 1 ? '1운으로 보기' : '충전하러 가기'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * SelectView — 진입 화면 (프로필 선택 + 분석 시작)
 * ═════════════════════════════════════════════════════════════════ */
function SelectView({
  profiles,
  selectedProfileId,
  onProfileChange,
  onCreateNew,
  profile,
  dateInfo,
  ctaLabel,
  tierChip,
  onAnalyze,
}: {
  profiles: SajuProfile[];
  selectedProfileId: string | null;
  onProfileChange: (id: string) => void;
  onCreateNew: () => void;
  profile: SajuProfile | null;
  dateInfo: DateInfo;
  /** 무료 있음 '무료로 ~ 보기' / 소진 '1운으로 ~ 보기' / 오늘 기록 있음 '다시 보기' */
  ctaLabel: string;
  /** 히어로 과금 칩 */
  tierChip: string;
  onAnalyze: () => void;
}) {
  const pillars = useMemo(() => (profile ? buildPillars(profile) : []), [profile]);
  const hasSajuData = pillars.length === 4 && !!profile?.sajuData;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <FadeIn>
        <ProfileSelector
          profiles={profiles}
          selectedId={selectedProfileId}
          onChange={onProfileChange}
          onCreateNew={onCreateNew}
        />
      </FadeIn>

      {/* Hero — ExtensionHero 패턴 통일 (gradient + 한자 워터마크 + seal + crumb + tier) */}
      <FadeIn delay={0.05}>
        <header
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '18px 20px 28px',
            color: '#FFFFFF',
            background: INK_HERO_BG, // 2026-10-10 v9 먹 머리
            borderRadius: 16,
          }}
        >
          <span
            aria-hidden
            style={{
              display: 'none', // 2026-10-10 v9 — 큰 한자 워터마크 제거
              position: 'absolute',
              right: -18,
              bottom: -40,
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 220,
              fontWeight: 900,
              color: 'rgba(255,255,255,0.07)',
              lineHeight: 1,
              pointerEvents: 'none',
              letterSpacing: '-0.05em',
            }}
          >
            日
          </span>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              right: 18,
              top: 18,
              width: 44,
              height: 44,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.30)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 22,
              fontWeight: 800,
              color: '#FFFFFF',
            }}
          >
            日
          </div>
          <div
            style={{
              fontSize: 13,
              opacity: 0.78,
              marginBottom: 8,
              letterSpacing: '0.02em',
              position: 'relative',
            }}
          >
            {dateInfo.label} 오늘의 운세
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              fontSize: 13.5,
              opacity: 0.92,
              flexWrap: 'wrap',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <span style={{ background: 'rgba(255,255,255,0.22)', padding: '3px 10px', borderRadius: 2, fontSize: 13, fontWeight: 600 }}>
              일진 운세
            </span>
            <span style={{ background: 'rgba(255,255,255,0.14)', padding: '3px 10px', borderRadius: 2, fontSize: 13 }}>
              {tierChip}
            </span>
          </div>
          <h2
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 22,
              fontWeight: 700,
              marginTop: 14,
              letterSpacing: '-0.02em',
              lineHeight: 1.4,
              position: 'relative',
            }}
          >
            {profile?.name ? `${profile.name} 님의` : '나의'}<br />
            오늘 운세를 풀어드릴게요
          </h2>
          <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 4, position: 'relative' }}>
            일주와 오늘 간지의 작용, 용신과 대운 흐름까지 함께 살펴볼게요.
          </div>
        </header>
      </FadeIn>

      {/* 만세력 미리보기 — 라벨 "내 만세력" + 부제 萬歲曆 (사주카드 톤 통일) */}
      {hasSajuData && (
        <FadeIn delay={0.1}>
          <section className="card-secondary">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <p className="sec-title" style={{ margin: 0 }}>내 만세력</p>
              <span style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--brand-gold)',
                letterSpacing: '0.06em',
              }}>
                萬歲曆
              </span>
            </div>
            <SajuMiniCard pillars={pillars} />
          </section>
        </FadeIn>
      )}

      <div className="sticky-cta-bottom">
        <button className="cta-gold" onClick={onAnalyze} disabled={!hasSajuData}>
          {ctaLabel}
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ResultView — 새 §10 레이아웃 (day-tile + L1~L4 축소형 + Ad + Upsell)
 * ═════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
 * ResultView (v5 2026-05-06) — mockup HTML 진본 픽셀-퍼펙트 카피.
 *   ProfileSelector 만 보존 (다른 프로필 전환), 나머지는 DailyMockupView 단일 호출.
 *   legacy 카드/필드 (sajuTone·todayConnection·oneLiner·radarScores·ohengComparison·
 *   sajuConnection·interpretation·timeline·actionAdvice) 전수 삭제.
 * ═════════════════════════════════════════════════════════════════ */
function ResultView({
  result,
  profile,
  // ProfileSelector 제거 (2026-05-06) — 이하 props 미사용 (호출부 호환 위해 시그니처 유지)
  profiles: _profiles,
  selectedProfileId: _selectedProfileId,
  onProfileChange: _onProfileChange,
  onCreateNew: _onCreateNew,
  dateInfo,
  tier,
  isGenerating,
  onWeeklyUpsell,
  onMonthlyUpsell,
  onRetry: _onRetry,
}: {
  result: any;
  profile: SajuProfile;
  profiles: SajuProfile[];
  selectedProfileId: string | null;
  onProfileChange: (id: string) => void;
  onCreateNew: () => void;
  dateInfo: DateInfo;
  /** 이 결과가 무료 1회인지 1운 추가 이용인지 (헤더 태그) */
  tier: 'free' | 'paid';
  /** 스트리밍 생성 진행 중 — §07 스켈레톤·추천 카드 노출 판단 */
  isGenerating: boolean;
  onWeeklyUpsell: () => void;
  onMonthlyUpsell: () => void;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  // 2026-05-28 PM — toast 미사용 (공유는 shareResult 직접 호출 · 알림 자체 처리). useToast 호출 자체 보존 위해 void.
  void useToast;

  // 오늘 일진 → 한글 읽기 + 오행
  const dayStem = dateInfo.ganzi?.[0] ?? '';
  const todayOheng: OhengType = useMemo(() => getDayOheng(dateInfo.ganzi), [dateInfo.ganzi]);
  const todayGanReading = useMemo(() => {
    const map: Record<string, string> = {
      甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
      己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
    };
    return map[dayStem] || '';
  }, [dayStem]);

  // 내 일간
  const myGan = profile?.sajuData?.pillars?.[2]?.천간 || '';
  const myGanReading = profile?.sajuData?.pillars?.[2]?.천간읽기 || '';
  const myOheng: OhengType = (profile?.sajuData?.pillars?.[2]?.천간오행 as OhengType) || '토';

  // relationLabel 폐기 (2026-05-07) — DailyMockupView 가 getOhengRelation() 으로 직접 일상어 라벨 생성

  // 헤더 날짜 라벨 (예: "2026년 5월 6일 화요일 · 병진일(丙辰)")
  const dateLabel = useMemo(() => {
    try {
      const d = new Date((dateInfo?.date || '') + 'T00:00:00');
      if (isNaN(d.getTime())) return dateInfo?.label || '';
      const yy = d.getFullYear();
      const mm = d.getMonth() + 1;
      const dd = d.getDate();
      // 2026-10-14 — 천간만 읽어 '신일(辛酉)'로 나오던 것 → 두 글자 모두 '신유일(辛酉)'
      const gzKo = dateInfo?.ganzi ? `${CHEONGAN_KO[dateInfo.ganzi[0]] ?? ''}${JIJI_KO[dateInfo.ganzi[1]] ?? ''}` : '';
      const ganziLabel = dateInfo?.ganzi ? ` ${gzKo || todayGanReading}일(${dateInfo.ganzi})` : '';
      return `${yy}년 ${mm}월 ${dd}일 ${dateInfo?.weekday || ''}요일${ganziLabel}`;
    } catch {
      return dateInfo?.label || '';
    }
  }, [dateInfo, todayGanReading]);

  // 공유 핸들러 — 결과 페이지 공유 = OG 바이럴 (앱 홍보용 · 보상 X).
  //   2026-05-28 PM 정책 분리: 결과 페이지 공유는 shareResult (OG 이미지 송출).
  //   친구 초대는 이벤트 탭 surface 만 사용 (services/share/invite.shareInvite · 2026-10-14 공유 보상 종료).
  // 2026-10-19 — '친구에게 공유하기'는 먼저 '오늘 운세 한 장'(폰 한 화면, 캡처용)으로. 그 화면에서 링크나 이미지로 보낸다
  //   (오너: 퍼지는 건 한 캡처). 결과 화면 목업은 그대로.
  const handleShare = async () => {
    navigate('/daily/card', { state: { result, name: profile?.name || '나', dateLabel: dateInfo.label || dateLabel, ganzi: dateInfo.ganzi || '', ganziKo: '' } });
  };

  // §07 4영역 카드 클릭 → 관계/일/건강 sub-picker bottom sheet (2026-05-07)
  const [topicPicker, setTopicPicker] = useState<'love' | 'career' | 'health' | null>(null);
  const closePicker = () => setTopicPicker(null);
  // 2026-09-17 — 라벨·설명은 10주제 SSOT(TOPIC_REGISTRY), 묶음은 DAILY_TOPIC_GROUPS(카드 가격 표기와 공용)
  const SUB_TOPICS: Record<'love' | 'career' | 'health', Array<{ id: TopicId; label: string; desc: string }>> = {
    love: toSubTopics(DAILY_TOPIC_GROUPS.love),
    career: toSubTopics(DAILY_TOPIC_GROUPS.career),
    health: toSubTopics(DAILY_TOPIC_GROUPS.health),
  };
  // 주제 이동 시 지금 보고 있는 프로필을 넘김 → TopicAnalysisPage 가 미리 선택
  const goTopic = (id: TopicId) => navigate(`/topic/${id}`, { state: { profileId: profile.id } });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* ProfileSelector 제거 (2026-05-06) — DarkHeader 에 이미 "이혜찌 님" 표시,
          result phase 에서 프로필 전환 불필요 (전환은 home 으로 돌아가서). */}

      {/* §07 4영역 sub-picker bottom sheet */}
      <AnimatePresence>
        {topicPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePicker}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
              }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed', left: 0, right: 0, bottom: 0,
                background: '#fff',
                borderRadius: '20px 20px 0 0',
                padding: '20px 20px calc(28px + env(safe-area-inset-bottom))',
                zIndex: 1001,
                maxWidth: 520, margin: '0 auto',
                boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
              }}
            >
              <div style={{
                width: 36, height: 4, borderRadius: 2,
                background: '#E5DFD0', margin: '0 auto 16px',
              }} />
              <h3 style={{
                fontFamily: "'Noto Serif KR', serif",
                fontSize: 17, fontWeight: 700, color: '#1A1A1A',
                marginBottom: 4,
              }}>
                {topicPicker === 'love' ? '사람 관계에서 어떤 부분이 궁금하세요?'
                  : topicPicker === 'career' ? '일에서 어떤 부분이 궁금하세요?'
                  : '건강에서 어떤 부분이 궁금하세요?'}
              </h3>
              <p style={{ fontSize: 13.5, color: '#6F6557', marginBottom: 16 }}>
                고른 주제 화면으로 이동해요. 운이 차감되기 전에 한 번 더 확인해드려요.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUB_TOPICS[topicPicker]?.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { closePicker(); goTopic(t.id); }}
                    style={{
                      background: '#FAF7EE',
                      border: '1px solid rgba(184,150,90,0.18)',
                      borderRadius: 12, padding: '14px 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', font: 'inherit', textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div>
                      <div style={{
                        fontFamily: "'Noto Serif KR', serif",
                        fontSize: 15, fontWeight: 700, color: '#1A1A1A',
                      }}>{t.label}</div>
                      <div style={{ fontSize: 13.5, color: '#6F6557', marginTop: 2 }}>{t.desc}</div>
                    </div>
                    {/* 2026-10-15 — 금색 글자 + 금색 바탕 가격 칸 → 먹 글자 (금색은 누르는 버튼에만) */}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1612', flexShrink: 0, marginLeft: 10 }}>
                      {formatPriceLabel(getTopicPrice(t.id))}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={closePicker}
                style={{
                  marginTop: 12, width: '100%',
                  background: 'transparent', border: 'none',
                  fontSize: 13, color: '#6F6557', padding: 12,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* mockup 진본 픽셀-퍼펙트 카피 (DailyMockupView 단일 호출) */}
      <DailyMockupView
        result={result}
        profile={profile}
        dateLabel={dateLabel}
        todayGanzi={dateInfo.ganzi || ''}
        todayGanReading={todayGanReading}
        todayOheng={todayOheng}
        myGan={myGan}
        myGanReading={myGanReading}
        myOheng={myOheng}
        priceTag={tier === 'paid' ? '1운 추가 이용' : '오늘 1회 무료'}
        isGenerating={isGenerating}
        onUpsell={onWeeklyUpsell}
        onMonthly={onMonthlyUpsell}
        onShare={handleShare}
        onChat={async () => {
          // 2026-05-28 PM — contentContext 영구 저장 (보관함 재진입에도 복원)
          const { createChatRoom } = await import('@/services/storage/chatStore');
          const ctx = {
            type: 'daily' as const,
            label: '오늘의 운세',
            fullResult: result,
            date: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), // 2026-10-17 같은 날 다시 물으면 같은 방
          };
          const room = createChatRoom(profile?.name || '나', 'free', ctx);
          navigate(`/chat/${room.id}`, {
            state: {
              profile,
              contentContext: ctx,
            },
          });
        }}
        nextSteps={(() => {
          // 2026-10-09 — 오늘 풀이에서 이어지는 주제 1 + 사주대화 질문 3 (서버 nextHooks)
          const nh = (result as any)?.nextHooks;
          if (!nh) return undefined;
          return (
            <NextStepsCard
              title="오늘 풀이에서 이어지는 이야기"
              topics={nh.topic && nh.topic.id ? [nh.topic] : []}
              questions={Array.isArray(nh.chatQuestions) ? nh.chatQuestions : []}
              onTopic={(id) => goTopic(id)}
              onAsk={(q) => { void openChatWithResult({ navigate, name: profile?.name || '나', profile, ctx: { type: 'daily', label: '오늘의 운세', fullResult: result }, question: q }); }}
            />
          );
        })()}
        onTopicClick={(topicId) => {
          // 4영역 클릭 → sub-picker (관계/일/건강) 또는 직접 (재물)
          // wealth: 직접 / love(관계): 연애·결혼·재회·궁합 / career(일): 직업·시험·사업 / health(건강): 체질·이사
          if (topicId === 'wealth') {
            goTopic('wealth');
            return;
          }
          setTopicPicker(topicId);
        }}
      />
      {/* 2026-05-28 — 무료 콘텐츠 결과 페이지 하단 광고 (앱인토스 빌드 게이트는 AdSlot 안)
          2026-10-15 — AdSlot 에는 tier 게이트가 없어 1운을 내고 본 결과에도 광고가 붙었다 → 무료로 본 결과만 */}
      {tier !== 'paid' && (
        <div style={{ padding: '0 16px 24px' }}>
          <AdSlot />
        </div>
      )}
    </motion.div>
  );
}


/* ── 날짜 (KST · 2026-09-17) ──
 *   'YYYY-MM-DD'(KST) 문자열 기준으로만 계산 → 기기 시간대와 무관하게 같은 날짜·요일·일진. */
function buildDateInfo(dateKey: string): DateInfo {
  const [y, m, d] = dateKey.split('-').map(Number);
  const weekday = WEEKDAY_KR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
  let ganzi = '';
  try {
    const ec = Solar.fromYmd(y, m, d).getLunar().getEightChar();
    ganzi = `${ec.getDayGan()}${ec.getDayZhi()}`;
  } catch {
    ganzi = '';
  }
  return { date: dateKey, weekday, ganzi, label: `${m}월 ${d}일 ${weekday}요일` };
}

/** STEP 2A — 내일 일진 (mockup §07 tomorrow 카드용) 등 날짜 이동 */
function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 기록의 운세 날짜(KST) — 신규 저장본은 __fortuneDate, 이전 저장본은 createdAt 의 KST 날짜 */
function reportDateKey(r: { createdAt?: string | number; aiResult?: any } | null | undefined): string | null {
  const fd = r?.aiResult?.__fortuneDate;
  if (typeof fd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fd)) return fd;
  const t = r?.createdAt != null ? new Date(r.createdAt).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/* ── 오늘 기록 매칭 (2026-09-17 · 같은 날 같은 프로필 재생성/중복 저장 방지) ── */
function isSameProfileReport(r: LocalReport, p: SajuProfile): boolean {
  if (r.profileId && r.profileId === p.id) return true;
  // 이전 저장본(profileId 없음)·프로필 재저장으로 id 가 바뀐 경우 — 이름+생년월일시로 판정
  const a = r.input;
  const b = p.input;
  if (!a || !b) return false;
  return (r.name || '') === (p.name || '')
    && a.birthYear === b.birthYear
    && a.birthMonth === b.birthMonth
    && a.birthDay === b.birthDay
    && (a.calendarType ?? null) === (b.calendarType ?? null)
    && (a.birthHour ?? null) === (b.birthHour ?? null);
}

/** 오늘(KST) 이 프로필의 오늘의 운세 기록 — 최신순 */
function findTodayDailyReports(profile: SajuProfile, dateKey: string): LocalReport[] {
  try {
    return getReports().filter(
      (r) => r.contentType === 'daily' && reportDateKey(r) === dateKey && isSameProfileReport(r, profile),
    );
  } catch {
    return [];
  }
}

/** 다시 열어도 되는 완성 결과인지 — __partial 이거나 본문/세부가 비면 재생성 대상.
 *  (점수만 빠진 저장본은 §07 대체 표시로 충분 → 다시 열기(무료) 쪽으로 판정해 불필요한 1운 차감 방지) */
function isCompleteDailyResult(res: any): boolean {
  if (!res || typeof res !== 'object' || res.__partial) return false;
  const s = res.subScores;
  const hasScores = !!s && typeof s === 'object' && (s.wealth !== undefined || s.love !== undefined);
  const hasBody = !!(res.title || res.headline || res.todayNarrative || res.scoreHeadline);
  const hasDetail = (Array.isArray(res.timeSlots) && res.timeSlots.length > 0)
    || (Array.isArray(res.doList) && res.doList.length > 0)
    || !!res.luckyProfile || !!res.dailyQuote;
  return hasBody && (hasScores || hasDetail);
}

/* ── 생성 진행 마커 (2026-09-17 → 09-18 확장) ──
 *   ① 이탈 복구: 무료 패스는 생성 시작 때 쓰므로 도중에 앱이 닫히면 결과 없이 무료 1회만 사라짐
 *      → 해제 안 된 채 5분 지난 무료 마커 = 이탈 → 그날 무료 1회 복구 (유료는 pending spend 자동환불)
 *   ② 이중 결제 방지: /daily 를 떠나도 생성은 백그라운드로 계속됨 → 저장 전 재진입하면 오늘 기록이 없어
 *      '· 1운' 으로 또 결제될 수 있었음 → 같은 프로필·날짜 마커(5분 내)가 있으면 새로 시작/결제하지 않음 */
const INFLIGHT_KEY = 'saju500:daily_inflight';
const INFLIGHT_STALE_MS = 5 * 60 * 1000; // localStore pending spend 만료와 동일

interface DailyInflight {
  id: string;
  profileId: string;
  date: string;
  tier: 'free' | 'paid';
  ts: number;
}

function readInflights(): DailyInflight[] {
  try {
    const list = JSON.parse(localStorage.getItem(INFLIGHT_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeInflights(list: DailyInflight[]): void {
  try {
    if (list.length === 0) localStorage.removeItem(INFLIGHT_KEY);
    else localStorage.setItem(INFLIGHT_KEY, JSON.stringify(list.slice(-10)));
  } catch { /* noop */ }
}

function beginInflight(profileId: string, date: string, tier: 'free' | 'paid'): string {
  const id = `${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  writeInflights([...readInflights(), { id, profileId, date, tier, ts: Date.now() }]);
  return id;
}

function endInflight(id: string): void {
  writeInflights(readInflights().filter((m) => m.id !== id));
}

/** 같은 프로필·날짜 생성이 진행 중인지 (5분 내) — 진행 마커 + 프로필·날짜 태그된 유료 pending 둘 다 확인 */
function isDailyInProgress(profileId: string, date: string): boolean {
  const now = Date.now();
  const fresh = (ts: number) => now - Number(ts || 0) < INFLIGHT_STALE_MS;
  if (readInflights().some((m) => m.profileId === profileId && m.date === date && fresh(m.ts))) return true;
  try {
    return getPendingSpends().some((p) => p.type === `daily:${profileId}:${date}` && fresh(p.ts));
  } catch {
    return false;
  }
}

/** 5분 넘게 해제 안 된 마커 정리 — 무료였으면 그날 무료 1회 복구 (날짜가 지났으면 restoreFreePass 가 무시) */
function recoverStaleInflights(): void {
  const now = Date.now();
  const list = readInflights();
  const stale = list.filter((m) => now - Number(m.ts || 0) >= INFLIGHT_STALE_MS);
  if (stale.length === 0) return;
  writeInflights(list.filter((m) => now - Number(m.ts || 0) < INFLIGHT_STALE_MS));
  for (const m of stale) {
    if (m.tier === 'free') restoreFreePass('daily', m.date);
  }
}

function toSubTopics(ids: readonly TopicId[]): Array<{ id: TopicId; label: string; desc: string }> {
  return ids.map((id) => ({ id, label: TOPIC_REGISTRY[id].label, desc: TOPIC_REGISTRY[id].subCopy }));
}

function getDayOheng(ganzi: string): OhengType {
  const stem = ganzi?.[0] ?? '';
  return STEM_TO_OHENG[stem] ?? '토';
}

function buildPillars(
  profile: SajuProfile,
  pillarMessages?: Record<string, string | null>,
): PillarData[] {
  const raw = profile.sajuData?.pillars ?? [];
  const labels: Array<'년' | '월' | '일' | '시'> = ['년', '월', '일', '시'];
  const messageKeys = ['year', 'month', 'day', 'hour'];
  const ordered: PillarData[] = raw.map((p: any, i: number) => ({
    label: labels[i] ?? '년',
    gan: String(p?.천간 ?? ''),
    ji: String(p?.지지 ?? ''),
    ohengGan: (p?.천간오행 ?? '토') as OhengType,
    ohengJi: (p?.지지오행 ?? '토') as OhengType,
    ganRead: p?.천간읽기 ? String(p.천간읽기) : undefined,
    jiRead: p?.지지읽기 ? String(p.지지읽기) : undefined,
    shipsin: p?.십성 ?? undefined,
    connection: pillarMessages?.[messageKeys[i]]
      ? stripMd(String(pillarMessages[messageKeys[i]]))
      : undefined,
    unavailable: p?.available === false,
  }));
  return [...ordered].reverse();
}
