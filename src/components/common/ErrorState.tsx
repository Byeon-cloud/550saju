import { motion } from 'framer-motion';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/**
 * Error State — 네트워크 오류, 로딩 실패 등
 */
export function ErrorState({
  title = '문제가 발생했어요',
  description = '네트워크 연결을 확인하고 다시 시도해주세요',
  onRetry,
}: ErrorStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20 px-8 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="w-16 h-16 rounded-2xl bg-func-danger/10 flex items-center justify-center mb-5"
        animate={{ x: [0, -4, 4, -4, 4, 0] }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </motion.div>
      <h3 className="text-h2 text-text-primary mb-2">{title}</h3>
      <p className="text-body-sm text-text-muted max-w-[280px]">{description}</p>
      {onRetry && (
        <div className="mt-6">
          <Button variant="secondary" onClick={onRetry}>다시 시도</Button>
        </div>
      )}
    </motion.div>
  );
}
