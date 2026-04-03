import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from './Button';

interface LoginPromptProps {
  title?: string;
  description?: string;
  buttonLabel?: string;
  onLogin?: () => void;
  showBack?: boolean;
}

/**
 * 로그인 유도 — 중앙 모달
 * 보관함, 마이페이지 등 로그인 필요 페이지에서 사용
 */
export function LoginPrompt({
  title = '로그인이 필요해요',
  description = '로그인하면 분석 결과를 저장하고\n언제든 다시 볼 수 있어요.',
  buttonLabel = '로그인하기',
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
      {/* 반투명 배경 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => showBack && navigate(-1)} />

      {/* 중앙 카드 */}
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
          <p className="text-body-sm text-text-muted leading-relaxed whitespace-pre-line">
            {description}
          </p>

          <div className="mt-6 space-y-3">
            <Button fullWidth size="lg" onClick={onLogin}>
              {buttonLabel}
            </Button>

            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="w-full py-2 text-caption text-text-muted hover:text-text-secondary transition-colors"
              >
                돌아가기
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
