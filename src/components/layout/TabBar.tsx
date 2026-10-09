import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IconHome, IconSaju, IconChat, IconStorage, IconProfile } from '@/components/brand/Icons';

// 2026-04-21 마스터 개정 — "사주분석" 탭 제거 → "이벤트" 탭 신설.
// 사주 입력은 홈/보관함/콘텐츠 3지점에서 분산 진입.
const TABS = [
  { path: '/', label: '홈', Icon: IconHome },
  { path: '/events', label: '이벤트', Icon: IconSaju },
  { path: '/chat', label: '사주대화', Icon: IconChat, isCenter: true },
  { path: '/storage', label: '보관함', Icon: IconStorage },
  { path: '/my', label: '내 정보', Icon: IconProfile },
] as const;

// 2026-05-29 — /saju-card 추가: 페이지 자체 sticky 액션바(이미지 저장/공유하기)가 있어
//   전역 TabBar 가 그 위를 덮으면 두 버튼이 가려져 스크롤해도 안 보이는 버그 fix.
// 2026-09-17 — /weekly 추가: 월간(/monthly)과 동일 처리. 하단 sticky CTA(주간운세 보기)를 TabBar 가 덮던 문제 fix.
const HIDDEN = ['/loading', '/result', '/charge', '/compat', '/share', '/dream', '/input', '/terms', '/privacy', '/daeun', '/monthly', '/weekly', '/tojung', '/daily', '/saju-card', '/admin'];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  if (HIDDEN.some((p) => location.pathname.startsWith(p))) return null;
  // 2026-05-28 — 채팅 세션 페이지(/chat/:id)는 composer 가려지지 않도록 TabBar 숨김 (목록 /chat 만 표시)
  if (/^\/chat\/[^\/]+$/.test(location.pathname)) return null;

  return (
    <nav
      className="tabbar fixed bottom-0 inset-x-0 z-30 mx-auto max-w-mobile"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-3 mb-2 rounded-2xl backdrop-blur-xl"
        style={{ background: 'rgba(255,253,248,0.97)', border: '1px solid #E1D7C4', boxShadow: '0 8px 24px rgba(40,28,14,0.12)' }}>
        <div className="flex h-[64px] relative items-end">
          {TABS.map((tab) => {
            const active = tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);
            const { Icon } = tab;
            const isCenter = 'isCenter' in tab && tab.isCenter;

            // 가운데 사주분석 버튼 — 강조
            if (isCenter) {
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className="flex-1 flex flex-col items-center justify-center relative -mt-3"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                    style={{ background: active ? '#B8965A' : '#1A1612' }}
                  >
                    <Icon size={22} color="#FFFFFF" />
                  </motion.div>
                  <span className="text-[12px] mt-1 font-semibold" style={{ color: active ? '#1A1612' : '#6F6557' }}>
                    {tab.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 pb-2 min-h-[44px] relative"
                aria-label={tab.label}
              >
                <Icon
                  size={20}
                  color={active ? '#1A1612' : '#8B8070'}
                />
                <span className="text-[12px] font-semibold transition-colors duration-200" style={{ color: active ? '#1A1612' : '#6F6557', fontWeight: active ? 800 : 600 }}>
                  {tab.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 w-5 h-[3px] rounded-full bg-brand-gold"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
