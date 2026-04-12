import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { SajuProvider } from '@/contexts/SajuContext';
import { TabBar } from '@/components/layout/TabBar';
import { BalanceBar } from '@/components/layout/BalanceBar';
import { ToastProvider } from '@/components/common/Toast';
import { HomePage } from '@/pages/HomePage';

// Lazy-loaded pages (코드 스플리팅)
const InputPage = lazy(() => import('@/pages/InputPage').then(m => ({ default: m.InputPage })));
const LoadingPage = lazy(() => import('@/pages/LoadingPage').then(m => ({ default: m.LoadingPage })));
const ResultPage = lazy(() => import('@/pages/ResultPage').then(m => ({ default: m.ResultPage })));
const DailyFortunePage = lazy(() => import('@/pages/DailyFortunePage').then(m => ({ default: m.DailyFortunePage })));
const CompatibilityPage = lazy(() => import('@/pages/CompatibilityPage').then(m => ({ default: m.CompatibilityPage })));
const StoragePage = lazy(() => import('@/pages/StoragePage').then(m => ({ default: m.StoragePage })));
const ChargePage = lazy(() => import('@/pages/ChargePage').then(m => ({ default: m.ChargePage })));
const MyPage = lazy(() => import('@/pages/MyPage').then(m => ({ default: m.MyPage })));
const SharePage = lazy(() => import('@/pages/SharePage').then(m => ({ default: m.SharePage })));
const DreamPage = lazy(() => import('@/pages/DreamPage').then(m => ({ default: m.DreamPage })));
const ChatPage = lazy(() => import('@/pages/ChatPage').then(m => ({ default: m.ChatPage })));
const DaeunPage = lazy(() => import('@/pages/DaeunPage').then(m => ({ default: m.DaeunPage })));
const MonthlyPage = lazy(() => import('@/pages/MonthlyPage').then(m => ({ default: m.MonthlyPage })));
const CompatResultPage = lazy(() => import('@/pages/CompatResultPage').then(m => ({ default: m.CompatResultPage })));
const TojungPage = lazy(() => import('@/pages/TojungPage').then(m => ({ default: m.TojungPage })));
const TopicAnalysisPage = lazy(() => import('@/pages/TopicAnalysisPage').then(m => ({ default: m.TopicAnalysisPage })));
const TermsPage = lazy(() => import('@/pages/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));

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

function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg-page)' }}>
      <div className="w-14 h-14 rounded-2xl bg-bg-surface flex items-center justify-center mb-4">
        <span className="text-h1 text-brand-gold">?</span>
      </div>
      <h2 className="text-h2 text-text-primary mb-2">페이지를 찾을 수 없어요</h2>
      <p className="text-body-sm text-text-muted mb-6">주소가 잘못되었거나, 삭제된 페이지입니다.</p>
      <a href="/" className="px-6 py-3 rounded-xl text-h3 text-white font-semibold"
        style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
        홈으로 돌아가기
      </a>
    </div>
  );
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
            <Route path="/" element={<HomePage />} />
            <Route path="/input" element={<InputPage />} />
            <Route path="/loading" element={<LoadingPage />} />
            <Route path="/result/:id" element={<ResultPage />} />
            <Route path="/daily" element={<DailyFortunePage />} />
            <Route path="/compat" element={<CompatibilityPage />} />
            <Route path="/compat/result" element={<CompatResultPage />} />
            <Route path="/daeun" element={<DaeunPage />} />
            <Route path="/monthly" element={<MonthlyPage />} />
            <Route path="/tojung" element={<TojungPage />} />
            <Route path="/topic/:topicId" element={<TopicAnalysisPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/charge" element={<ChargePage />} />
            <Route path="/my" element={<MyPage />} />
            <Route path="/share/:id" element={<SharePage />} />
            <Route path="/dream" element={<DreamPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
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
    // 1. 미지급 IAP 주문 복구
    import('@/services/payment/iapService').then(({ restorePendingPurchases }) => {
      restorePendingPurchases();
    });

    // 2. 앱인토스 전용 초기화
    import('@/services/payment/iapService').then(({ isAppsInToss }) => {
      if (!isAppsInToss()) return;

      const sdkName = '@apps-in-toss/' + 'web-framework';
      import(/* @vite-ignore */ sdkName).then((mod: any) => {
        // 네비바 충전 버튼
        mod.partner?.addAccessoryButton?.({
          id: 'charge',
          title: '충전',
          icon: { name: 'icon-coin-mono' },
        });
        mod.tdsEvent?.addEventListener?.('navigationAccessoryEvent', {
          onEvent: ({ id }: { id: string }) => {
            if (id === 'charge') window.location.href = '/charge';
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
            // 결과 페이지면 홈으로
            if (path.startsWith('/result')) {
              window.location.href = '/';
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
