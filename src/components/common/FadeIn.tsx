import { type ReactNode, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  /** true이면 스크롤 시 뷰포트 진입할 때 등장 */
  scroll?: boolean;
}

export function FadeIn({ children, delay = 0, duration = 0.6, className, scroll = false }: FadeInProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.12 });

  if (scroll) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
