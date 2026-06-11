import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, useParams, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { SajuProvider } from '@/contexts/SajuContext';
import { TabBar } from '@/components/layout/TabBar';
import { BalanceBar } from '@/components/layout/BalanceBar';
import { ToastProvider } from '@/components/common/Toast';
import { HomePage } from '@/pages/HomePage';

/**
 * Home v5 Path 분기 env flag (2026-04-22)
 *   근거: docs/prd/홈v5_Path분기_레이아웃diff.md v3 §11 (a)
 *   기본 OFF — QA 통과 후 1% ramp, 준기 승인 후 100%
 *   `.env`: VITE_HOME_V5_ENABLED=1 로 ON
 */
const HOME_V5_ENABLED = import.meta.env.VITE_HOME_V5_ENABLED === '1';
const HomePageV5 = lazy(() => import('@/pages/HomePageV5').then(m => ({ default: m.HomePageV5 })));

// Lazy-loaded pages (코드 스플리팅)
const InputPage = lazy(() => import('@/pages/InputPage').then(m => ({ default: m.InputPage })));
const LoadingPage = lazy(() => import('@/pages/LoadingPage').then(m => ({ default: m.LoadingPage })));
const ResultPage = lazy(() => import('@/pages/result/ResultPage').then(m => ({ default: m.ResultPage })));
const DailyFortunePage = lazy(() => import('@/pages/DailyFortunePage').then(m => ({ default: m.DailyFortunePage })));
// 2026-05-07: 출시 후 공개 — import 보존 (관련 페이지 향후 복원용)
const CompatibilityPage = lazy(() => import('@/pages/CompatibilityPage').then(m => ({ default: m.CompatibilityPage })));
void CompatibilityPage;
const StoragePage = lazy(() => import('@/pages/StoragePage').then(m => ({ default: m.StoragePage })));
const ChargePage = lazy(() => import('@/pages/ChargePage').then(m => ({ default: m.ChargePage })));
const MyPage = lazy(() => import('@/pages/MyPage').then(m => ({ default: m.MyPage })));
const SharePage = lazy(() => import('@/pages/SharePage').then(m => ({ default: m.SharePage })));
const DreamPage = lazy(() => import('@/pages/DreamPage').then(m => ({ default: m.DreamPage })));
// #51 Sprint 2 — ChatPage 3-route 분리
const ChatListPage = lazy(() => import('@/pages/chat/ChatListPage').then(m => ({ default: m.ChatListPage })));
const ChatNewPage = lazy(() => import('@/pages/chat/ChatNewPage').then(m => ({ default: m.ChatNewPage })));
const ChatSessionPage = lazy(() => import('@/pages/chat/ChatSessionPage').then(m => ({ default: m.ChatSessionPage })));
// 2026-05-07: 출시 후 공개 — import 보존
const DaeunPage = lazy(() => import('@/pages/DaeunPage').then(m => ({ default: m.DaeunPage })));
const MonthlyPage = lazy(() => import('@/pages/MonthlyPage').then(m => ({ default: m.MonthlyPage })));
const CompatResultPage = lazy(() => import('@/pages/CompatResultPage').then(m => ({ default: m.CompatResultPage })));
const TojungPage = lazy(() => import('@/pages/TojungPage').then(m => ({ default: m.TojungPage })));
void DaeunPage; void MonthlyPage; void CompatResultPage; void TojungPage;
const PremiumSelectPage = lazy(() => import('@/pages/PremiumSelectPage').then(m => ({ default: m.PremiumSelectPage })));
// 폐기됨 (iframe srcDoc + regex 패턴) — _archive_/ 로 이동. 진본은 PremiumResult.tsx
const ChatPagePerfect = lazy(() => import('@/pages/ChatPagePerfect').then(m => ({ default: m.ChatPagePerfect })));
const TopicAnalysisPage = lazy(() => import('@/pages/TopicAnalysisPage').then(m => ({ default: m.TopicAnalysisPage })));
const TermsPage = lazy(() => import('@/pages/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const EventsPage = lazy(() => import('@/pages/EventsPage').then(m => ({ default: m.EventsPage })));
// 웹 단독 출시 — 사업자정보 공개페이지 (전자상거래법 제10조 · 앱인토스 진입 시 홈 redirect)
const BusinessInfoPage = lazy(() => import('@/pages/BusinessInfoPage').then(m => ({ default: m.BusinessInfoPage })));
// #saju-card-share Stage 2 — 만세력 카드 페이지 (lazy)
const SajuCardPage = lazy(() => import('@/pages/saju-card/SajuCardPage').then(m => ({ default: m.SajuCardPage })));
// 2026-05-29 — 오너 전용 어드민 대시보드 (lazy · uid 게이트)
const AdminPage = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })));

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

/** 페이지 이동 시 스크롤 상단 복원 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
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
            <Route path="/" element={HOME_V5_ENABLED ? <HomePageV5 /> : <HomePage />} />
            <Route path="/input" element={<InputPage />} />
            <Route path="/loading" element={<LoadingPage />} />
            <Route path="/result/:id" element={<ResultRouteGuard />} />
            <Route path="/daily" element={<DailyFortunePage />} />
            {/* 2026-05-07: 출시 후 공개 — 4종 (대운/월운/궁합/토정비결) URL 직접 진입 시 홈으로 redirect (코드 보존) */}
            <Route path="/compat" element={<Navigate to="/" replace />} />
            <Route path="/compat/result" element={<Navigate to="/" replace />} />
            <Route path="/daeun" element={<Navigate to="/" replace />} />
            <Route path="/monthly" element={<Navigate to="/" replace />} />
            <Route path="/tojung" element={<Navigate to="/" replace />} />
            {/* 2026-05-07 출시 후 복구
            <Route path="/compat" element={<CompatibilityPage />} />
            <Route path="/compat/result" element={<CompatResultPage />} />
            <Route path="/daeun" element={<DaeunPage />} />
            <Route path="/monthly" element={<MonthlyPage />} />
            <Route path="/tojung" element={<TojungPage />} />
            */}
            <Route path="/premium" element={<PremiumSelectPage />} />
            <Route path="/chat-perfect" element={<ChatPagePerfect />} />
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

export function App() {
  // 앱 시작 시 초기화
  useEffect(() => {
    // 0-a. 측정 — 앱 오픈 1회 (마운트 시 · fire-and-forget · UTM 캡처도 모듈 init 에서 함께)
    import('@/services/analytics').then(({ trackEvent }) => trackEvent('app_open', {})).catch(() => {});

    // 0. Firebase 익명 인증 — 모든 페이지에서 Cloud Functions 호출 가능하게
    import('@/services/auth/authService').then(({ ensureAuth }) => {
      ensureAuth();
    });

    // 0-a2. P0 CS fix (2026-06-11) — 생성 중 앱 종료로 결과 못 받은 차감 운 자동 환불.
    //   토스트는 ToastProvider 밖이라 불가 → 공지 플래그 저장, HomePage 마운트에서 안내.
    import('@/services/storage/localStore').then(({ reconcilePendingSpends }) => {
      const refunded = reconcilePendingSpends();
      if (refunded > 0) {
        try { localStorage.setItem('saju500:refund_notice', String(refunded)); } catch { /* noop */ }
      }
    }).catch(() => {});

    // 0-b. 2026-05-28 PM — 본인 프로필 중복 cleanup (1회 마이그레이션).
    //   기존: 새 사주 '본인' 추가 시 silent 로 myProfile 교체 → 본인 N명 누적.
    //   해결: 활성 myProfile 만 '본인' 유지, 나머지는 '가족' 자동 강등.
    import('@/services/storage/localStore').then(({ migrateOwnerDuplicates }) => {
      const { migrated } = migrateOwnerDuplicates();
      if (migrated > 0) {
        // eslint-disable-next-line no-console
        console.info(`[migrate] 본인 중복 ${migrated}개 → '가족'으로 강등`);
      }
    });

    // 1. 미지급 IAP 주문 복구
    import('@/services/payment/iapService').then(({ restorePendingPurchases }) => {
      restorePendingPurchases();
    });

    // 1-b. 출시 전 프로모션 테스트 트리거 (?_promotest=7day | launch)
    //   토스 정책: 출시 전 TEST_ 코드로 1회 호출해야 콘솔 "시작하기" 활성화.
    //   7일 출석은 실제 7일 걸려 테스트 불가 → 쿼리로 즉시 시뮬레이션.
    try {
      const pt = new URLSearchParams(window.location.search).get('_promotest');
      if (pt === '7day') {
        import('@/services/storage/dailyReward').then((m) =>
          m.simulate7DayCompletion().then((r) =>
            alert(`[7일 완주 프로모션 테스트] ${r.ok ? '[OK] TEST 호출 성공' : '[FAIL] ' + (r.reason || '')}`)
          )
        );
      } else if (pt === 'launch') {
        import('@/services/toss/tossPromotion').then((m) =>
          m.grantLaunchPromotion().then((r) =>
            alert(`[출시 프로모션 테스트] ${r.ok ? '[OK] TEST 호출 성공' : '[FAIL] ' + (r.reason || '')}`)
          )
        );
      }
    } catch { /* noop */ }

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

        // 뒤로가기 핸들러 — 페이지별 분기
        const currentPathRef = { value: window.location.pathname };
        // pathname 변경 감지
        const observer = new MutationObserver(() => {
          currentPathRef.value = window.location.pathname;
        });
        observer.observe(document.querySelector('head')!, { childList: true, subtree: true });
        // popstate로도 감지
        window.addEventListener('popstate', () => {
          currentPathRef.value = window.location.pathname;
        });
        // pushState/replaceState 감지
        const origPush = history.pushState;
        history.pushState = function (...args) {
          origPush.apply(this, args);
          currentPathRef.value = window.location.pathname;
        };
        const origReplace = history.replaceState;
        history.replaceState = function (...args) {
          origReplace.apply(this, args);
          currentPathRef.value = window.location.pathname;
        };

        if (mod.registerBackHandler) {
          mod.registerBackHandler(() => {
            const path = currentPathRef.value;
            // 홈/메인이면 앱 종료
            if (path === '/' || path === '/home') {
              mod.closeView?.();
              return;
            }
            // 결과 페이지면 홈으로 (SDK 콜백, Hook 사용 불가 — assign 사용)
            if (path.startsWith('/result')) {
              window.location.assign('/');
              return;
            }
            // 그 외 → 브라우저 뒤로가기
            window.history.back();
          });
        }
      }).catch(() => {});
    });
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SajuProvider>
          <ToastProvider>
          <ScrollToTop />
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
