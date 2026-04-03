import { type ReactNode, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  /** true이면 스크롤 시 뷰포트 진입할 때 등장 */
  scroll?: boolean;
  /** 방향: 'up' | 'down' | 'left' | 'right' */
  direction?: 'up' | 'down' | 'left' | 'right';
}

const DIRECTION_MAP = {
  up: { y: 16, x: 0 },
  down: { y: -16, x: 0 },
  left: { y: 0, x: 16 },
  right: { y: 0, x: -16 },
};

/**
 * FadeIn — Material Design 3 모션 토큰 기반
 * duration: 300-500ms (MD3 medium)
 * easing: emphasized decelerate [0.05, 0.7, 0.1, 1.0]
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 0.45,
  className,
  scroll = false,
  direction = 'up',
}: FadeInProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const { x, y } = DIRECTION_MAP[direction];

  // MD3 emphasized decelerate
  const ease = [0.05, 0.7, 0.1, 1.0] as const;

  if (scroll) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y, x }}
        animate={isInView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y, x }}
        transition={{ duration, delay, ease }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y, x }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
