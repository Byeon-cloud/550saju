import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getBalance } from '@/services/storage/localStore';
import { useMemo } from 'react';

/** 보여줄 페이지 — 탭 네비게이션이 있는 메인 페이지들만 */
const SHOW = ['/', '/storage', '/my', '/daily'];

/**
 * 글로벌 운(運) 잔액 바
 * 모든 페이지 상단에 로고 + 잔액 + 충전 버튼 고정
 * 사주아이 벤치마킹 — 항상 잔액이 보여야 사용자가 인지하고 충전으로 연결
 */
export function BalanceBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const balance = useMemo(() => getBalance(), [location.pathname]);

  // 메인 탭 페이지에서만 표시
  if (!SHOW.some((p) => location.pathname === p)) return null;

  return (
    <div className="balance-bar sticky top-0 z-30 mx-auto max-w-mobile"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between h-[48px] px-5 bg-white/95 backdrop-blur-xl border-b border-border-light">
        {/* 로고 */}
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="11" stroke="#1B2A4A" strokeWidth="1" fill="none" opacity="0.3" />
            <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#1B2A4A" />
            <circle cx="12" cy="7" r="2" fill="#C9A96E" />
            <circle cx="12" cy="17" r="2" fill="#1B2A4A" stroke="#C9A96E" strokeWidth="0.8" />
          </svg>
          <span className="text-h3 text-text-primary font-bold">사주</span>
          <span className="text-h3 text-brand-gold font-bold">500</span>
        </button>

        {/* ? 버튼 (홈에서만) + 잔액 + 충전 */}
        <div className="flex items-center gap-2">
          {location.pathname === '/' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => document.getElementById('about-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(27,42,74,0.06)' }}
            >
              <span className="text-[13px] font-bold text-text-muted">?</span>
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/charge')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full min-h-[36px]"
            style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.15)' }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
              <span className="text-[9px] font-black text-white">運</span>
            </div>
            <span className="text-[13px] font-bold text-text-primary">{balance}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
