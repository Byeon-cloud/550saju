import { motion } from 'framer-motion';

interface CareerFitVisProps {
  scores: { label: string; score: number; color: string }[];
}

export function CareerFitVis({ scores }: CareerFitVisProps) {
  return (
    <div className="space-y-2.5">
      {scores.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-[72px] text-[12px] font-semibold shrink-0"
            style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
          <div className="flex-1 h-[18px] rounded-full overflow-hidden"
            style={{ background: 'var(--bg-surface)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${item.color}AA, ${item.color})` }}
              initial={{ width: 0 }}
              animate={{ width: `${item.score}%` }}
              transition={{ duration: 1, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="w-8 text-right text-[12px] font-bold" style={{ color: item.color }}>
            {item.score}
          </span>
        </div>
      ))}
    </div>
  );
}
