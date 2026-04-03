import { motion } from 'framer-motion';

interface Props {
  name: string;
  score: number;
  color?: string;
  delay?: number;
}

/** 궁합 카테고리별 수평 점수 바 */
export function CompatScoreBar({ name, score, color = '#C9A96E', delay = 0 }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-body-sm text-text-secondary w-16 flex-shrink-0 font-semibold">{name}</span>
      <div className="flex-1 h-3 rounded-full bg-bg-surface overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}CC, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(score, 5)}%` }}
          transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-h3 text-text-primary w-10 text-right">{score}</span>
    </div>
  );
}
