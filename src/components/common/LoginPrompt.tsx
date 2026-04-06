import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { WebLoginProvider } from '@/services/auth/authService';

interface LoginPromptProps {
  title?: string;
  description?: string;
  onLogin?: (provider?: WebLoginProvider) => void;
  showBack?: boolean;
}

/**
 * 로그인 유도 — 카카오/네이버/구글 선택
 * 보관함, 마이페이지, 결제 등 로그인 필요 페이지에서 사용
 */
export function LoginPrompt({
  title = '로그인이 필요해요',
  description = '로그인하면 분석 결과를 저장하고\n언제든 다시 볼 수 있어요.',
  onLogin,
  showBack = true,
}: LoginPromptProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => showBack && navigate(-1)} />

      <motion.div
        className="relative w-full max-w-[340px]"
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="rounded-3xl px-6 py-8 text-center"
          style={{ background: 'var(--bg-card)', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

          {/* 태극 아이콘 */}
          <motion.div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-5"
            style={{ background: 'rgba(201,169,110,0.1)' }}
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 350 }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" stroke="#1B2A4A" strokeWidth="1.2" fill="none" />
              <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#1B2A4A" />
              <circle cx="12" cy="7" r="2" fill="#C9A96E" />
              <circle cx="12" cy="17" r="2" fill="#1B2A4A" stroke="#C9A96E" strokeWidth="0.8" />
            </svg>
          </motion.div>

          <h3 className="text-h1 text-text-primary mb-2">{title}</h3>
          <p className="text-body-sm text-text-muted leading-relaxed whitespace-pre-line mb-6">
            {description}
          </p>

          {/* 소셜 로그인 버튼 3종 */}
          <div className="space-y-2.5">
            {/* 카카오 */}
            <button
              onClick={() => onLogin?.('kakao')}
              className="w-full h-[48px] rounded-xl flex items-center justify-center gap-2 font-semibold text-[15px] transition-transform active:scale-[0.98]"
              style={{ background: '#FEE500', color: '#191919' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.1a.3.3 0 00.46.33l4.66-3.08c.52.06 1.06.09 1.62.09 5.52 0 10-3.36 10-7.68S17.52 3 12 3z" />
              </svg>
              카카오로 시작하기
            </button>

            {/* 네이버 */}
            <button
              onClick={() => onLogin?.('naver')}
              className="w-full h-[48px] rounded-xl flex items-center justify-center gap-2 font-semibold text-[15px] text-white transition-transform active:scale-[0.98]"
              style={{ background: '#03C75A' }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="white">
                <path d="M13.56 10.7L6.17 0H0v20h6.44V9.3L13.83 20H20V0h-6.44z" />
              </svg>
              네이버로 시작하기
            </button>

            {/* 구글 */}
            <button
              onClick={() => onLogin?.('google')}
              className="w-full h-[48px] rounded-xl flex items-center justify-center gap-2 font-semibold text-[15px] border border-border transition-transform active:scale-[0.98]"
              style={{ background: '#FFFFFF', color: '#3D3427' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09A6.97 6.97 0 015.48 12c0-.72.13-1.42.36-2.09V7.07H2.18A11.96 11.96 0 001 12c0 1.94.46 3.77 1.18 5.09l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google로 시작하기
            </button>
          </div>

          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="w-full py-2 mt-4 text-caption text-text-muted hover:text-text-secondary transition-colors"
            >
              돌아가기
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
