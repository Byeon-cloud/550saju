import { motion } from 'framer-motion';

interface LoadingProps {
  message?: string;
}

export function Loading({ message = '분석 중...' }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <motion.div
        className="w-16 h-16 rounded-full border-4 border-brand-border border-t-brand-primary"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <p className="text-brand-muted text-sm">{message}</p>
    </div>
  );
}
