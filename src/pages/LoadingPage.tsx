import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const LOADING_MESSAGES = [
  '사주 원국을 분석하고 있어요...',
  '오행의 균형을 살펴보고 있어요...',
  '십성 배치를 해석하고 있어요...',
  '대운의 흐름을 읽고 있어요...',
  '당신만의 풀이를 작성하고 있어요...',
];

export function LoadingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // TODO: 실제 AI 분석 호출
    // 임시로 3초 후 결과 페이지로 이동
    const timer = setTimeout(() => {
      navigate('/result/demo', { replace: true });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate, searchParams]);

  return (
    <div className="page-container flex flex-col items-center justify-center min-h-screen">
      <motion.div
        className="w-24 h-24 rounded-full border-4 border-brand-border border-t-brand-primary"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        className="mt-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {LOADING_MESSAGES.map((msg, i) => (
          <motion.p
            key={i}
            className="text-brand-muted text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.8 + 0.5, duration: 0.5 }}
          >
            {msg}
          </motion.p>
        ))}
      </motion.div>
    </div>
  );
}
