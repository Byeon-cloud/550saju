import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { path: '/', label: '홈', iconD: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { path: '/daily', label: '운세', iconD: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { path: '/storage', label: '보관함', iconD: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
  { path: '/my', label: '마이', iconD: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
] as const;

const HIDDEN = ['/input', '/loading', '/result', '/share'];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  if (HIDDEN.some((p) => location.pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 mx-auto max-w-mobile"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-2 mb-2 rounded-2xl bg-white/90 backdrop-blur-xl shadow-brand-lg border border-white/50">
        <div className="flex h-[58px]">
          {TABS.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                  active ? 'text-brand-gold-dark' : 'text-brand-muted'
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={active ? '2.2' : '1.8'} strokeLinecap="round" strokeLinejoin="round"
                  className="transition-all duration-200">
                  <path d={tab.iconD} />
                </svg>
                <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
