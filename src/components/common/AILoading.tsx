import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SAJU_TIPS = [
  '사주에서 일간(日干)은 나 자신을 상징해요',
  '오행의 균형이 인생의 균형을 결정해요',
  '대운은 10년마다 바뀌는 큰 흐름이에요',
  '같은 사주도 대운에 따라 완전히 달라져요',
  '십성(十星)은 나와 세상의 관계를 보여줘요',
  '지장간은 겉으로 안 보이는 숨은 성격이에요',
  '공망은 집착을 버리면 오히려 자유로운 영역이에요',
  '납음은 사주의 가장 근본적인 에너지예요',
  '식신이 강하면 표현력과 창의력이 뛰어나요',
  '정관이 있으면 규율과 책임감이 강해요',
  '편재가 있으면 재물을 모으는 능력이 있어요',
  '인성이 강하면 학습 능력이 뛰어나요',
];

interface Props {
  name?: string;
  type?: string;
  steps?: string[];
}

export function AILoading({ name = '', type = '분석', steps }: Props) {
  const [tipIndex, setTipIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const defaultSteps = [
    '사주 데이터를 분석하고 있어요',
    '오행의 흐름을 읽고 있어요',
    '맞춤 해석을 작성하고 있어요',
  ];
  const loadingSteps = steps || defaultSteps;

  useEffect(() => {
    const tipTimer = setInterval(() => setTipIndex(i => (i + 1) % SAJU_TIPS.length), 3000);
    const stepTimer = setInterval(() => setStepIndex(i => Math.min(i + 1, loadingSteps.length - 1)), 8000);
    const clockTimer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { clearInterval(tipTimer); clearInterval(stepTimer); clearInterval(clockTimer); };
  }, []);

  const progress = Math.min(((stepIndex + 1) / loadingSteps.length) * 100, 95);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: 'var(--bg-page-gradient)' }}>
      {/* 이름 + 타입 */}
      <p className="text-caption text-text-muted mb-6">{name ? `${name}님의 ` : ''}{type}을 준비하고 있어요</p>

      {/* 태극 로딩 애니메이션 */}
      <motion.div
        className="w-20 h-20 mb-6 relative"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="38" stroke="#C9A96E" strokeWidth="2" opacity="0.2" />
          <circle cx="40" cy="40" r="38" stroke="#C9A96E" strokeWidth="2.5"
            strokeDasharray="239" strokeDashoffset={239 - (239 * progress / 100)}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
          <circle cx="40" cy="20" r="6" fill="#C9A96E" />
          <circle cx="40" cy="60" r="6" fill="#1B2A4A" />
        </svg>
      </motion.div>

      {/* 진행 단계 */}
      <AnimatePresence mode="wait">
        <motion.p
          key={stepIndex}
          className="text-h3 text-text-primary text-center mb-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
        >
          {loadingSteps[stepIndex]}...
        </motion.p>
      </AnimatePresence>

      {/* 프로그레스 바 */}
      <div className="w-48 h-1.5 bg-border-light rounded-full overflow-hidden mb-8">
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #C9A96E, #D4A843)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      {/* 사주 팁 — 기다리는 동안 읽을거리 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tipIndex}
          className="text-center px-6 py-4 rounded-2xl max-w-[300px]"
          style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.1)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-caption text-brand-gold font-semibold mb-1">알고 계셨나요?</p>
          <p className="text-body-sm text-text-secondary leading-relaxed">{SAJU_TIPS[tipIndex]}</p>
        </motion.div>
      </AnimatePresence>

      {elapsed > 15 && (
        <p className="text-[10px] text-text-hint mt-4">꼼꼼하게 풀이하고 있어요. 조금만 기다려주세요.</p>
      )}
    </div>
  );
}
