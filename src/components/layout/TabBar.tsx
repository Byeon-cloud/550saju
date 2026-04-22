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

const HIDDEN = ['/loading', '/result', '/charge', '/compat', '/share', '/dream', '/input', '/terms', '/privacy', '/daeun', '/monthly', '/tojung', '/daily'];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  if (HIDDEN.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <nav
      className="tabbar fixed bottom-0 inset-x-0 z-30 mx-auto max-w-mobile"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-3 mb-2 rounded-2xl bg-white/95 backdrop-blur-xl shadow-lg border border-white/60">
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
                    style={{ background: active ? '#B8965A' : '#1B2A4A' }}
                  >
                    <Icon size={22} color="#FFFFFF" />
                  </motion.div>
                  <span className={`text-[10px] mt-1 font-semibold ${active ? 'text-brand-gold' : 'text-text-hint'}`}>
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
                  color={active ? '#B8965A' : '#A8B1C1'}
                />
                <span className={`text-[10px] font-semibold transition-colors duration-200 ${
                  active ? 'text-brand-gold' : 'text-text-hint'
                }`}>
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
