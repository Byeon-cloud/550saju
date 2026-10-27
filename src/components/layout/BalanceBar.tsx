import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getBalance, BALANCE_CHANGED_EVENT } from '@/services/storage/localStore';
import { useEffect, useRef, useState } from 'react';
import { onAuthChange } from '@/services/auth/authService';
import { isAppsInToss } from '@/services/payment/iapService';

/** 웹만 로그인 상태를 보여 준다 (앱은 토스 계정이라 로그인 개념이 없다). 빌드 상수로 앱 번들에서는 늘 false */
const SHOW_WEB_ACCOUNT = import.meta.env.VITE_BUILD_TARGET !== 'appintos';

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
  // 2026-10-18 잔액이 늘면 칩이 한 번 부풀고 '+N운' 이 떠오른다 (motion.css mo-pop, mo-float-up)
  const [balance, setBal] = useState(() => getBalance());
  const [gain, setGain] = useState<{ n: number; k: number } | null>(null);
  const prev = useRef(balance);
  useEffect(() => {
    const sync = () => {
      // 칩이 안 보이는 화면(충전 등)에선 기억만 두고, 보이는 화면에 돌아왔을 때 늘어난 만큼 보여 준다
      if (!SHOW.some((p) => location.pathname === p)) return;
      const next = getBalance();
      const diff = Math.round((next - prev.current) * 10) / 10;
      prev.current = next;
      setBal(next);
      if (diff > 0) setGain({ n: diff, k: Date.now() });
    };
    sync();
    window.addEventListener(BALANCE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(BALANCE_CHANGED_EVENT, sync);
  }, [location.pathname]);
  useEffect(() => {
    if (!gain) return;
    const t = setTimeout(() => setGain(null), 1300);
    return () => clearTimeout(t);
  }, [gain]);
  // 2026-10-27 지인 VOC '로그인했는지 안 했는지 한눈에 알 수 없음, 내 정보가 아래에 빠져 있어 찾기 어려움'
  //   → 웹은 위 띠에 '로그인'(손님) 또는 이름 첫 글자 동그라미(로그인됨)를 두고 누르면 내 정보로
  const [account, setAccount] = useState<{ member: boolean; initial: string } | null>(null);
  useEffect(() => {
    if (!SHOW_WEB_ACCOUNT || isAppsInToss()) return;
    return onAuthChange((u) => {
      if (!u || u.isAnonymous) { setAccount({ member: false, initial: '' }); return; }
      const nm = (u.displayName || u.email || '').trim();
      setAccount({ member: true, initial: nm ? nm.slice(0, 1).toUpperCase() : '나' });
    });
  }, []);

  // 메인 탭 페이지에서만 표시
  if (!SHOW.some((p) => location.pathname === p)) return null;

  return (
    <div className="balance-bar sticky top-0 z-30 mx-auto max-w-mobile"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between h-[52px] px-5 backdrop-blur-xl"
        style={{ background: 'rgba(244,239,228,0.94)', borderBottom: '1px solid #E1D7C4' }}>
        {/* 로고 */}
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 tap-pad">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="11" stroke="#1A1612" strokeWidth="1" fill="none" opacity="0.3" />
            <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#1A1612" />
            <circle cx="12" cy="7" r="2" fill="#B8965A" />
            <circle cx="12" cy="17" r="2" fill="#1A1612" stroke="#B8965A" strokeWidth="0.8" />
          </svg>
          <span className="text-h3 font-bold" style={{ color: '#1A1612' }}>사주</span>
          <span className="text-h3 font-bold" style={{ color: '#8C6D3D' }}>500</span>
        </button>

        {/* ? 버튼 (홈에서만) + 웹 로그인 상태 + 잔액 + 충전 */}
        <div className="flex items-center gap-2">
          {/* 빌드 상수를 먼저 봐서 앱 번들에서는 이 버튼 코드가 통째로 빠진다 (10-25 웹 로그인 코드 반려 대응) */}
          {SHOW_WEB_ACCOUNT && account && location.pathname !== '/my' && (
            account.member ? (
              <button type="button" onClick={() => navigate('/my')} aria-label="내 정보, 로그인되어 있어요"
                className="tap-pad flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: 16, background: '#1A1612', color: '#F4EFE4', fontSize: 14, fontWeight: 800, border: 0 }}>
                {account.initial}
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/my')} aria-label="로그인하고 기록 지키기"
                className="tap-pad"
                style={{ minHeight: 34, padding: '0 11px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(26,22,18,0.35)', color: '#1A1612', fontSize: 14, fontWeight: 800 }}>
                로그인
              </button>
            )
          )}
          {location.pathname === '/' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => document.getElementById('voices-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              aria-label="후기 섹션으로 이동"
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(26,22,18,0.06)' }}
            >
              <span className="text-[14px] font-bold" style={{ color: '#4B4238' }}>?</span>
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/charge')}
            className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-full min-h-[36px]"
            style={{ background: '#FFFDF8', border: '1px solid #E1D7C4' }}
          >
            {gain && (
              <span key={gain.k} aria-hidden="true" className="mo-float-up"
                style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 2px)', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#8C6D3D', whiteSpace: 'nowrap', textShadow: '0 0 6px #F4EFE4, 0 0 2px #F4EFE4' }}>
                +{gain.n}운
              </span>
            )}
            <div className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: '#8C6D3D' }}>
              <span className="text-[13px] font-black text-white">運</span>
            </div>
            <span key={gain?.k ?? 0} className={`text-[14px] font-bold inline-block${gain ? ' mo-pop' : ''}`} style={{ color: '#1A1612' }}>{balance}운</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8965A" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
