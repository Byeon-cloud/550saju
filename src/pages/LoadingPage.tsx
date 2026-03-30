import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  '만세력을 계산하고 있어요...',
  '사주의 구조를 분석하고 있어요...',
  '오행의 균형을 살펴보고 있어요...',
  '대운의 흐름을 읽고 있어요...',
  '리포트를 작성하고 있어요...',
];

export function LoadingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((p) => (p < STEPS.length - 1 ? p + 1 : p));
    }, 3500);
    const timeout = setTimeout(() => {
      navigate('/result/demo', { replace: true });
    }, 7000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8"
      style={{ background: 'linear-gradient(180deg, var(--bg-cream), var(--bg-warm))' }}>

      {/* 오행 원 애니메이션 */}
      <div className="relative w-[120px] h-[120px] mb-10">
        {['#3A9D5C', '#E05252', '#D4952E', '#8B8B8B', '#4A8AD4'].map((color, i) => (
          <motion.div
            key={i}
            className="absolute w-5 h-5 rounded-full"
            style={{ background: color, top: '50%', left: '50%' }}
            animate={{
              x: [0, Math.cos((i * 72 - 90) * Math.PI / 180) * 40],
              y: [0, Math.sin((i * 72 - 90) * Math.PI / 180) * 40],
              scale: [0.5, 1, 0.5],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }}
          />
        ))}
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-[40px]"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        >
          ☯️
        </motion.div>
      </div>

      {/* 텍스트 */}
      <div className="h-12 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="text-[16px] font-bold text-center"
            style={{ color: 'var(--text-primary)' }}
          >
            {STEPS[step]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* 진행 바 */}
      <div className="flex gap-2 mt-8">
        {STEPS.map((_, i) => (
          <motion.div
            key={i}
            className="h-[5px] rounded-full"
            style={{ width: 32 }}
            animate={{
              background: i <= step
                ? 'linear-gradient(90deg, var(--brand-gold), var(--brand-accent))'
                : 'var(--border-main)',
            }}
            transition={{ duration: 0.5 }}
          />
        ))}
      </div>

      <p className="text-[11px] mt-6" style={{ color: 'var(--text-hint)' }}>잠시만 기다려주세요</p>
    </div>
  );
}
