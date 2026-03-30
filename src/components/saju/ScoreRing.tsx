import { motion } from 'framer-motion';

interface ScoreRingProps {
  label: string;
  score: number;
  color: string;
  delay?: number;
  icon?: string;
}

export function ScoreRing({ label, score, color, delay = 0, icon }: ScoreRingProps) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[72px] h-[72px]">
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="4.5" />
          <motion.circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="4.5" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.6, delay, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon && <span className="text-[12px] leading-none mb-0.5">{icon}</span>}
          <motion.span
            className="text-[15px] font-black leading-none"
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.6, duration: 0.4 }}
          >
            {score}
          </motion.span>
        </div>
      </div>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}
