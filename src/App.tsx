import { Suspense, useEffect, useRef } from 'react';
import { lazyWithReload, clearChunkReloadFlag } from '@/lib/lazyWithReload';
import { resolveBackAction } from '@/services/toss/backNavigation';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { DesktopBrandPanel } from '@/components/layout/DesktopBrandPanel';
import { SajuProvider } from '@/contexts/SajuContext';
import { TabBar } from '@/components/layout/TabBar';
import { BalanceBar } from '@/components/layout/BalanceBar';
import { ToastProvider } from '@/components/common/Toast';
import { HomePage } from '@/pages/HomePage';

/* 2026-10-13 — 홈 v5 시안(HomePageV5, env flag OFF 로 한 번도 켜지지 않음)은 v9 홈으로 대체되어 삭제 */

// Lazy-loaded pages (코드 스플리팅)
const InputPage = lazyWithReload(() => import('@/pages/InputPage').then(m => ({ default: m.InputPage })));
const ResultPage = lazyWithReload(() => import('@/pages/result/ResultPage').then(m => ({ default: m.ResultPage })));
const DailyFortunePage = lazyWithReload(() => import('@/pages/DailyFortunePage').then(m => ({ default: m.DailyFortunePage })));
// 2026-05-07: 출시 후 공개 — import 보존 (관련 페이지 향후 복원용)
const CompatibilityPage = lazyWithReload(() => import('@/pages/CompatibilityPage').then(m => ({ default: m.CompatibilityPage })));
void CompatibilityPage;
const StoragePage = lazyWithReload(() => import('@/pages/StoragePage').then(m => ({ default: m.StoragePage })));
const ChargePage = lazyWithReload(() => import('@/pages/ChargePage').then(m => ({ default: m.ChargePage })));
const MyPage = lazyWithReload(() => import('@/pages/MyPage').then(m => ({ default: m.MyPage })));
const SharePage = lazyWithReload(() => import('@/pages/SharePage').then(m => ({ default: m.SharePage })));
const DreamPage = lazyWithReload(() => import('@/pages/DreamPage').then(m => ({ default: m.DreamPage })));
// #51 Sprint 2 — ChatPage 3-route 분리
const ChatListPage = lazyWithReload(() => import('@/pages/chat/ChatListPage').then(m => ({ default: m.ChatListPage })));
const ChatNewPage = lazyWithReload(() => import('@/pages/chat/ChatNewPage').then(m => ({ default: m.ChatNewPage })));
const ChatSessionPage = lazyWithReload(() => import('@/pages/chat/ChatSessionPage').then(m => ({ default: m.ChatSessionPage })));
// 2026-05-07: 출시 후 공개 — import 보존
const DaeunPage = lazyWithReload(() => import('@/pages/DaeunPage').then(m => ({ default: m.DaeunPage })));
const MonthlyPage = lazyWithReload(() => import('@/pages/MonthlyPage').then(m => ({ default: m.MonthlyPage })));
const WeeklyPage = lazyWithReload(() => import('@/pages/WeeklyPage').then(m => ({ default: m.WeeklyPage }))); // 2026-06-29 NEW 주간운세
const CompatResultPage = lazyWithReload(() => import('@/pages/CompatResultPage').then(m => ({ default: m.CompatResultPage })));
const TojungPage = lazyWithReload(() => import('@/pages/TojungPage').then(m => ({ default: m.TojungPage })));
void DaeunPage; void CompatResultPage; void TojungPage; // MonthlyPage 는 2026-06-29 /monthly 라우트에서 사용 중
const PremiumSelectPage = lazyWithReload(() => import('@/pages/PremiumSelectPage').then(m => ({ default: m.PremiumSelectPage })));
// 폐기됨 (iframe srcDoc + regex 패턴) — _archive_/ 로 이동. 진본은 PremiumResult.tsx
const TopicAnalysisPage = lazyWithReload(() => import('@/pages/TopicAnalysisPage').then(m => ({ default: m.TopicAnalysisPage })));
const TermsPage = lazyWithReload(() => import('@/pages/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazyWithReload(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const EventsPage = lazyWithReload(() => import('@/pages/EventsPage').then(m => ({ default: m.EventsPage })));
// 웹 단독 출시 — 사업자정보 공개페이지 (전자상거래법 제10조 · 앱인토스 진입 시 홈 redirect)
const BusinessInfoPage = lazyWithReload(() => import('@/pages/BusinessInfoPage').then(m => ({ default: m.BusinessInfoPage })));
// #saju-card-share Stage 2 — 만세력 카드 페이지 (lazy)
const SajuCardPage = lazyWithReload(() => import('@/pages/saju-card/SajuCardPage').then(m => ({ default: m.SajuCardPage })));
// 2026-05-29 — 오너 전용 어드민 대시보드 (lazy · uid 게이트)
const AdminPage = lazyWithReload(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })));

/** 페이지 전환 애니메이션 — 토스 스타일 */
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1],
};

/** 로딩 폴백 — 미니멀 */
function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="w-8 h-8 rounded-full border-2 border-border-light border-t-brand-gold animate-spin" />
    </div>
  );
}

/**
 * NotFound — E3 (앱인토스 심사 직결 · P0)
 *   근거: docs/prd/PC_인수인계_2026_04_21_단일본.md §7.3
 *   - a href 대신 useNavigate → SPA 이동 (앱인토스/웹 공통 안전)
 *   - SSOT 컬러 (--gold #B8965A) — 구 gold gradient 제거
 *   - replace: true — 잘못된 URL 을 히스토리에 남기지 않음
 */
function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg-page)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(184,150,90,0.10)' }}>
        <span className="text-h1" style={{ color: '#B8965A' }}>?</span>
      </div>
      <h2 className="text-h2 text-text-primary mb-2">페이지를 찾을 수 없어요</h2>
      <p className="text-body-sm text-text-muted mb-6">주소가 잘못되었거나, 삭제된 페이지입니다.</p>
      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="px-6 py-3 rounded-xl text-h3 text-white font-semibold"
        style={{ background: '#B8965A' }}
      >
        홈으로 돌아가기
      </button>
    </div>
  );
}

/**
 * ResultRouteGuard — /result/:id id 형식 검증 (E3 잔여 2)
 *   근거: docs/prd/PC_인수인계_2026_04_21_단일본.md §7.3 "라우팅 타입 보강: /result/:id id 형식 검증"
 *   허용 형식: base36 영숫자 4~32자 (generateId = Date.now().toString(36) + random.toString(36).slice(2,8))
 *   invalid 시 / 로 replace redirect.
 */
const RESULT_ID_RE = /^[a-z0-9]{4,32}$/i;
function ResultRouteGuard() {
  const { id } = useParams<{ id: string }>();
  if (!id || !RESULT_ID_RE.test(id)) {
    return <Navigate to="/" replace />;
  }
  return <ResultPage />;
}

/** 라우트 플래그 — /admin 은 PC 브랜드 셸(폰프레임 스크롤) 제외 (100vw 탈출 레이아웃과 충돌) */
function RouteFlags() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.documentElement.dataset.admin = pathname.startsWith('/admin') ? '1' : '0';
  }, [pathname]);
  return null;
}

/** 페이지 이동 시 스크롤 상단 복원 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    // PC 폰프레임 모드 — 스트립이 자체 스크롤 컨테이너라 컨테이너도 상단 복원 (2026-06-12)
    document.querySelector('.app-container')?.scrollTo?.(0, 0);
    // 2026-06-12 P0 — trackPageView 호출부가 0건이라 page_view/content_open/content_result 퍼널 전멸이던 fix
    import('@/services/analytics').then(a => a.trackPageView(pathname)).catch(() => {});
  }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="min-h-screen"
      >
        <Suspense fallback={<PageFallback />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/input" element={<InputPage />} />
            {/* 2026-10-14 — 쓰이지 않던 LoadingPage(생성은 결과 화면이 직접) 삭제. 옛 주소는 홈으로 */}
            <Route path="/loading" element={<Navigate to="/" replace />} />
            <Route path="/result/:id" element={<ResultRouteGuard />} />
            <Route path="/daily" element={<DailyFortunePage />} />
            {/* 2026-06-29: 월운세·주간운세 NEW 출시. 나머지 3종(대운/궁합/토정)은 lockdown 유지 */}
            <Route path="/monthly" element={<MonthlyPage />} />
            <Route path="/weekly" element={<WeeklyPage />} />
            {/* 2026-10-04: 궁합 공개 (고객 시점 시식·수리 후). 대운·토정비결은 lockdown 유지 — URL 직접 진입 시 홈 redirect */}
            <Route path="/compat" element={<CompatibilityPage />} />
            <Route path="/compat/result" element={<CompatResultPage />} />
            <Route path="/daeun" element={<Navigate to="/" replace />} />
            {/* 2026-10-07: 토정비결 → 신년운세 재출시 (대상 연도 자동 · 서버 확정 월주) */}
            <Route path="/tojung" element={<TojungPage />} />
            {/* 2026-05-07 출시 후 복구 (월운은 위에서 이미 해제)
            <Route path="/daeun" element={<DaeunPage />} />
            */}
            <Route path="/premium" element={<PremiumSelectPage />} />
            <Route path="/topic" element={<TopicAnalysisPage />} />
            <Route path="/topic/:topicId" element={<TopicAnalysisPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/charge" element={<ChargePage />} />
            <Route path="/my" element={<MyPage />} />
            {/* 2026-05-29 — type-aware 공유 URL 매칭 fix. shareResult 는 /share/{type}/{id} ·
                /share/topic/{topicId}/{id} 를 생성하는데 기존 /share/:id (1세그먼트) 만 있어 사람 클릭 시 404.
                topic(4세그)·일반(3세그)·legacy(2세그) 모두 SharePage 로. (renderShareOg 가 봇 OG 별도 처리) */}
            {/* 2026-05-29 — 오너 전용 어드민 (uid 게이트 · 비오너는 uid 노출 화면) */}
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/share/topic/:topicId/:id" element={<SharePage />} />
            <Route path="/share/:type/:id" element={<SharePage />} />
            <Route path="/share/:id" element={<SharePage />} />
            <Route path="/dream" element={<DreamPage />} />
            {/* #51 Sprint 2 — /chat 3-route 분리 (new 라우트가 :sessionId보다 먼저) */}
            <Route path="/chat" element={<ChatListPage />} />
            <Route path="/chat/new" element={<ChatNewPage />} />
            <Route path="/chat/:sessionId" element={<ChatSessionPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/events" element={<EventsPage />} />
            {/* 웹 단독 출시 — 사업자정보 공개페이지 (BusinessInfoPage 내부에서 앱인토스 시 홈 redirect) */}
            <Route path="/business" element={<BusinessInfoPage />} />
            {/* #saju-card-share — 만세력 카드 (프로필 단위) */}
            <Route path="/saju-card/:profileId" element={<SajuCardPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * CS 보상 자동 수령 (앱인토스 전용) — compensations/{deviceId} 장부 기반.
 *   어드민이 deviceId 로 운을 지급 → 고객 앱이 이걸 호출해 paid 잔액에 적립.
 *   2026-06-15 — 부팅 1회 가드를 12초 throttle 로 교체 + 포그라운드 복귀마다 호출.
 *   (토스 웹뷰가 백그라운드→복귀 시 살아있어, 어드민이 나중에 넣은 운도 재열람 때 받게.)
 */
async function runCsCompensationCheck(): Promise<void> {
  try {
    const { isAppsInToss } = await import('@/services/payment/iapService');
    if (!isAppsInToss()) return;
    const w = window as unknown as { __saju500CompCheckedAt?: number };
    const now = Date.now();
    if (w.__saju500CompCheckedAt && now - w.__saju500CompCheckedAt < 12000) return; // 12초 throttle
    w.__saju500CompCheckedAt = now;
    const mod: any = await import('@apps-in-toss/web-framework');
    const deviceId: string | undefined = mod?.getDeviceId?.();
    if (!deviceId) return;
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app } = await import('@/services/auth/firebase');
    const { ensureAuth } = await import('@/services/auth/authService');
    await ensureAuth();
    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'claimCompensation');
    const r: any = await fn({ deviceId });
    const amount = Number(r?.data?.amount) || 0;
    const wipeTopics: string[] = Array.isArray(r?.data?.wipeTopics) ? r.data.wipeTopics : [];
    if (amount > 0) {
      const { addPaidBalance, removeTopicReports } = await import('@/services/storage/localStore');
      addPaidBalance(amount, 0);
      // 잘못 생성됐던 주제 결과 동반 정리 (보관함 + 캐시) — 재열람 시 혼란 방지
      if (wipeTopics.length > 0) removeTopicReports(wipeTopics);
      try { localStorage.setItem('saju500:comp_notice', String(amount)); } catch { /* noop */ }
    }
  } catch { /* noop — 다음 기회 재시도 */ }
}

export function App() {
  // 앱인토스 뒤로가기 이벤트 구독 해제 핸들 (graniteEvent.addEventListener 반환값)
  const backUnsubRef = useRef<(() => void) | null>(null);
  // 포그라운드 복귀마다 CS 보상 재확인 (어드민이 나중에 넣은 운도 앱 재열람 때 수령)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') runCsCompensationCheck(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 앱 시작 시 초기화
  useEffect(() => {
    // 0-z. 청크 자동리로드 플래그 해제 — 여기까지 왔다는 건 앱이 정상 마운트됐다는 뜻.
    //   다음에 또 청크 로드가 실패하면 (다음 배포 등) 다시 1회 리로드를 받을 수 있게 초기화.
    clearChunkReloadFlag();

    // 0-a. 측정 — 앱 오픈 1회 (마운트 시 · fire-and-forget · UTM 캡처도 모듈 init 에서 함께)
    import('@/services/analytics').then(({ trackEvent }) => {
      trackEvent('app_open', {});
      // 2026-06-18 — 기기 최초 부팅 1회 signup (신규 유저 first-seen → 정확한 코호트/신규 집계)
      try {
        if (!localStorage.getItem('saju500:signed_up')) {
          localStorage.setItem('saju500:signed_up', '1');
          trackEvent('signup', {});
        }
      } catch { /* noop */ }
      // 2026-06-22 마케팅 측정 — 공유링크(ref=share) 수신 진입 1회 invite_received (바이럴 K-factor).
      //   세션당 1회 가드. utm.source='share' 는 captureUtm 이 이미 전 이벤트에 첨부.
      //   2026-06-24 — granted:0(수신 단계는 아직 리워드 미지급) 차원 추가. 후속 적립과 구분.
      try {
        const ref = new URLSearchParams(window.location.search).get('ref');
        if (ref === 'share' && !sessionStorage.getItem('saju500:invite_fired')) {
          sessionStorage.setItem('saju500:invite_fired', '1');
          trackEvent('invite_received', { granted: 0, reason: 'inbound_share' });
        }
      } catch { /* noop */ }
    }).catch(() => {});

    // 0. Firebase 익명 인증 — 모든 페이지에서 Cloud Functions 호출 가능하게
    import('@/services/auth/authService').then(({ ensureAuth }) => {
      ensureAuth();
    });

    // 0-a2. P0 CS fix (2026-06-11) — 생성 중 앱 종료로 결과 못 받은 차감 운 자동 환불.
    //   토스트는 ToastProvider 밖이라 불가 → 공지 플래그 저장, HomePage 마운트에서 안내.
    //   2026-06-12 보강: 튕긴 직후 바로 재진입하면 pending 이 아직 5분 미만이라 부팅 체크를
    //   통과 못 함 → 다음 재시작까지 환불이 밀리던 빈틈. 만료 시점 이후 같은 세션에서 재검사.
    import('@/services/storage/localStore').then(({ reconcilePendingSpends, PENDING_EXPIRE_MS }) => {
      const settle = (refunded: number) => {
        if (refunded > 0) {
          try { localStorage.setItem('saju500:refund_notice', String(refunded)); } catch { /* noop */ }
        }
      };
      settle(reconcilePendingSpends());
      // 만료(12분) + 여유 15초 후 재검사 (성공 생성은 clearPendingSpend 로 이미 해제돼 영향 0)
      const recheck = window.setTimeout(() => settle(reconcilePendingSpends()), PENDING_EXPIRE_MS + 15000);
      window.addEventListener('beforeunload', () => window.clearTimeout(recheck), { once: true });
    }).catch(() => {});

    // 0-a2b. 주제 결과 반쪽(__partial) 자가치유 (2026-10-04) — 마감에 잘려 반쪽만 저장된 결과를 서버 완성본으로
    //   같은 기록 id 그대로 승격(재차감 0). 반쪽 기록이 없으면 네트워크 0. 실측: 재회운 79% 가 반쪽 박제였다.
    window.setTimeout(() => {
      import('@/pages/topic/topicPartialHeal').then((m) => m.healPartialTopicReports()).catch(() => {});
    }, 4000);

    // 0-a3b. 종합사주 결과복구 (2026-06-18) — 생성 중 앱 종료로 결과 못 받은 경우(미해결 premium 차감 <5분)
    //   서버('recovery' 필드)에서 끌어와 보관함에 복원 (재생성 0). 못 찾으면 위 reconcile 자동환불로 degrade.
    //   pending 있을 때만 서버 호출 → 정상 부팅엔 네트워크 0.
    import('@/services/storage/localStore').then(async (m) => {
      const pend = m.getPendingSpends().find((p) => p.type === 'premium' && (Date.now() - p.ts) < m.PENDING_EXPIRE_MS);
      if (!pend) return;
      const [{ getFunctions, httpsCallable }, { app }, { ensureAuth }] = await Promise.all([
        import('firebase/functions'), import('@/services/auth/firebase'), import('@/services/auth/authService'),
      ]);
      await ensureAuth();
      const fn = httpsCallable(getFunctions(app, 'us-central1'), 'recoverPremiumResult');
      const r: any = await fn({});
      const data = r?.data;
      if (data?.found && data.content && data.sajuData) {
        m.saveReport({
          id: data.reportId || m.generateId(),
          name: data.sajuData?.input?.name || '나',
          input: data.sajuData?.input,
          sajuData: data.sajuData,
          type: 'paid',
          contentType: 'report',
          createdAt: new Date().toISOString(),
          aiResult: data.reportType === 'premium' ? { ...data.content, tier: 'premium' } : data.content,
        });
        m.clearPendingSpendByType('premium'); // 결과 복구됨 → 환불 대신 결과 전달
        try { localStorage.setItem('saju500:premium_recovered', '1'); } catch { /* noop */ }
      }
    }).catch(() => { /* noop — 실패 시 reconcile 자동환불 유지 */ });

    // 0-a4. 🛂 기기 여권 (2026-08-13 · 앱인토스 전용) — deviceId→uid 등록 + uid 회전 시 보관함 자동 복원.
    //   익명 uid 는 웹뷰 저장소에 묶여 저장소가 비워지면 회전하고, 옛 uid 를 잇는 고리가 없어
    //   CS 마다 수동 추적해야 했다(조혜미 케이스 등 3건). 토스 deviceId 는 기기 영속이라
    //   매 부팅 등록해두면 회전 직후 서버가 직전 uid 를 찾아 보관함+잔액 미러를 자동 이관한다.
    //   결제 무관 전 유저 커버. ⚠️ 순서: passport(미러 seed) → 보상 수령 → IAP 복구.
    //     보상이 먼저 적립되면 seed 가드(paid>1)가 미러 복원을 거부하므로 반드시 passport 를 앞에 둔다.
    const passportDone = import('@/services/storage/devicePassport')
      .then(({ runDevicePassportCheck }) => runDevicePassportCheck())
      .catch(() => { /* noop — 안전망, 부팅 크리티컬 아님 */ });

    // 0-a3. CS 보상 자동 수령 (2026-06-11 · 앱인토스 전용) — 부팅 시 1회, passport(미러 seed) 이후.
    //   2026-06-15 — 토스 웹뷰는 백그라운드→복귀해도 살아있어 'once per boot' 가드론 첫 1회만 돌아
    //   어드민이 운을 나중에 넣어도 재열람 시 수령이 안 되던 문제. → 포그라운드 복귀마다 재확인(아래 visibility effect).
    //   2026-08-13 — passportDone 이후로 이동: 미러 잔액이 먼저 복원되고 그 위에 보상이 가산돼야 정확.
    passportDone.then(() => runCsCompensationCheck());
    // 0-a4b. 로컬 사주가 비었으면 서버 미러에서 되살리기 (2026-10-14 · 계정은 그대로인데 저장소만 빈 경우)
    passportDone
      .then(() => import('@/services/storage/firestoreSync'))
      .then((m) => m.restoreProfilesIfEmpty())
      .catch(() => { /* noop */ });

    // 0-b. 2026-05-28 PM — 본인 프로필 중복 cleanup (1회 마이그레이션).
    //   기존: 새 사주 '본인' 추가 시 silent 로 myProfile 교체 → 본인 N명 누적.
    //   해결: 활성 myProfile 만 '본인' 유지, 나머지는 '가족' 자동 강등.
    import('@/services/storage/localStore').then(({ migrateOwnerDuplicates, dedupeTwinReports }) => {
      const { migrated } = migrateOwnerDuplicates();
      if (migrated > 0) {
        // eslint-disable-next-line no-console
        console.info(`[migrate] 본인 중복 ${migrated}개 → '가족'으로 강등`);
      }
      // 보관함 twin 잉여 1회 정리 (2026-08-13 이중저장 버그 기존 피해 청소)
      const { removed } = dedupeTwinReports();
      if (removed > 0) console.info(`[migrate] 보관함 중복 사본 ${removed}건 정리`);
    });

    // 1. 미지급 IAP 주문 복구
    import('@/services/payment/iapService').then(({ restorePendingPurchases }) => {
      restorePendingPurchases();
    });

    /* 1-a. 🚨 IAP 결제 이력 기반 잔액 복구 (2026-08-07 · CS "운도 보관함도 전부 사라졌어요")
     *   잔액은 localStorage 가 주 저장소라 기기 저장소가 초기화되면 충전한 운이 사라진다.
     *   토스 IAP 주문 이력은 토스 계정 기준이라 기기·익명 uid 와 무관하게 남으므로,
     *   "결제했지만 이 uid 가 받은 적 없는 주문"을 서버가 판정해 재지급한다(중복·어뷰징 판정도 서버).
     *   인증 이후에 호출해야 request.auth 가 실려서 ensureAuth 뒤에 둔다. 실패는 무해(다음 부팅 재시도). */
    passportDone
      .then(() => import('@/services/auth/authService'))
      .then(({ ensureAuth }) => ensureAuth())
      .then(() => import('@/services/payment/iapService'))
      .then(({ restoreCompletedPurchases }) => restoreCompletedPurchases())
      .then((r) => {
        if (r && (r.un > 0 || r.reports > 0)) {
          try { localStorage.setItem('saju500:iap_recovered_notice', String(r.un)); } catch { /* noop */ }
          console.info(`[IAP복구] 결제 ${r.granted}건, +${r.un}운, 보관함 ${r.reports}건 복원`);
        }
      })
      .catch(() => { /* noop */ });

    // 1-b. 출시 전 프로모션 테스트 트리거 (?_promotest=7day | launch) — 개발 서버 전용
    //   토스 정책: 출시 전 TEST_ 코드로 1회 호출해야 콘솔 "시작하기" 활성화. (launch 50원은 2026-10 종료로 제거)
    //   2026-09-17 보안 fix: 이 블록이 실서비스 번들에 그대로 있어 누구나 쿼리 하나로
    //   launch=LIVE 코드 실지급(50원) · 7day=출석 없이 실지급(100원) + 실제 출석 기록 삭제가 가능했고, alert() 도 썼다.
    //   → import.meta.env.DEV 상수 폴딩으로 프로덕션 번들에서 경로 자체 제거 + TEST_ 코드 전용 함수만 호출
    //     (출석 기록·보상 장부 무변경). 토스앱 QR 실기기 TEST 호출은 MyPage 디버그 시트(VITE_DEBUG_TOOLS=1 빌드)로.
    if (import.meta.env.DEV) {
      try {
        const pt = new URLSearchParams(window.location.search).get('_promotest');
        if (pt === '7day') {
          import('@/services/toss/tossPromotion').then(async (m) => {
            const r = await m.test7DayPromotion();
            console.info(
              `[promotest:${pt}] ${r.ok ? 'TEST_ 코드 호출 성공' : 'TEST_ 코드 호출 실패: ' + m.describePromoFailure(r.reason)}`,
            );
          });
        }
      } catch { /* noop */ }
    }

    // 2. 앱인토스 전용 초기화
    import('@/services/payment/iapService').then(({ isAppsInToss }) => {
      if (!isAppsInToss()) return;

      import('@apps-in-toss/web-framework').then((mod: any) => {
        // 네비바 충전 버튼
        mod.partner?.addAccessoryButton?.({
          id: 'charge',
          title: '충전',
          icon: { name: 'icon-coin-mono' },
        });
        mod.tdsEvent?.addEventListener?.('navigationAccessoryEvent', {
          onEvent: ({ id }: { id: string }) => {
            // SDK 이벤트 콜백 (Hook 사용 불가) — assign 으로 SPA navigation 강등 (앱인토스 웹뷰 안전)
            if (id === 'charge') window.location.assign('/charge');
          },
        });

        /* 뒤로가기 핸들러 — 페이지별 분기 (2026-07-28 SDK 2.10.7 기준 재작성)
         *
         * 🚨 구 코드는 `mod.registerBackHandler` 를 호출했는데 이 API 는 SDK 에 **존재한 적이 없다**
         *   (2.6.2·2.10.7 양쪽 타입 정의 대조 확인). `if (mod.registerBackHandler)` 가드에 막혀
         *   조용히 스킵돼 뒤로가기 커스텀 동작이 한 번도 실행되지 않았음. 정식 API 는 graniteEvent.
         *   함께 있던 MutationObserver(head 감시) + history.pushState/replaceState 몽키패칭도
         *   제거한다 — 콜백 안에서 window.location.pathname 을 그때그때 읽으면 항상 최신이라
         *   불필요했고, React Router 의 history 조작과 충돌할 수 있는 위험 코드였다.
         *
         * ⚠️ 공식 문서: "onEvent — 뒤로가기 버튼이 눌리면 호출돼요. **기본 뒤로가기는 차단돼요.**"
         *   → 구독하는 순간 기본 동작이 사라지므로 **모든 경로를 우리가 처리해야 한다.**
         *   한 갈래라도 빠뜨리면 유저가 그 화면에 갇힌다. 아래 분기는 전 경로를 덮고,
         *   마지막 fallback 까지 반드시 어딘가로 이동하도록 설계됨. (문서 권장대로 onError 필수)
         */
        const unsubscribeBack: (() => void) | undefined =
          mod.graniteEvent?.addEventListener?.('backEvent', {
            onEvent: () => {
              // 판정은 순수 함수(backNavigation.ts)에 위임 — 전 경로 자동 검증 대상.
              // 여기서는 '실행'만 한다. SDK 콜백이라 Hook 사용 불가 → location.assign 사용.
              try {
                const action = resolveBackAction(window.location.pathname, window.history.length);
                if (action.kind === 'close') { mod.closeView?.(); return; }
                if (action.kind === 'home') { window.location.assign('/'); return; }
                window.history.back();
              } catch {
                // 어떤 이유로든 실패해도 최소한 홈으로 빠져나갈 수 있게 (갇힘 방지 최후 보루)
                try { window.location.assign('/'); } catch { /* noop */ }
              }
            },
            onError: () => {
              // 이벤트 파이프라인 오류 — 기본 뒤로가기가 차단된 상태이므로 최소 동작을 보장한다
              try { window.history.back(); } catch { /* noop */ }
            },
          });
        // 문서 권장: 등록된 리스너는 해제. 앱 전역 1회 구독이라 언마운트=앱 종료지만 규약대로 정리.
        backUnsubRef.current = typeof unsubscribeBack === 'function' ? unsubscribeBack : null;
      }).catch(() => {});
    });
    // 문서 권장 — 언마운트 시 리스너 해제 (미해제 시 중복 구독 위험)
    return () => {
      try { backUnsubRef.current?.(); } catch { /* noop */ }
      backUnsubRef.current = null;
    };
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SajuProvider>
          <ToastProvider>
          <ScrollToTop />
          <RouteFlags />
          <DesktopBrandPanel />
          <div className="app-container">
            <BalanceBar />
            <AnimatedRoutes />
            <TabBar />
          </div>
        </ToastProvider>
        </SajuProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
