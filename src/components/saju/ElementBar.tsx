import { motion } from 'framer-motion';
import type { OhengDistribution, OhengType } from '@/types/saju';
import { OHENG_MAP } from '@/constants/oheng';

interface ElementBarProps {
  elements: OhengDistribution;
}

const ORDER: OhengType[] = ['목', '화', '토', '금', '수'];
const EMOJI: Record<OhengType, string> = { 목: '🌳', 화: '🔥', 토: '⛰️', 금: '⚔️', 수: '💧' };

export function ElementBar({ elements }: ElementBarProps) {
  const max = Math.max(...Object.values(elements), 1);
  const total = Object.values(elements).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-3">
      {ORDER.map((key, idx) => {
        const info = OHENG_MAP[key];
        const count = elements[key] || 0;
        const pct = Math.round((count / total) * 100);
        const barPct = (count / max) * 100;
        const isEmpty = count === 0;

        return (
          <div key={key} className="flex items-center gap-2.5">
            <div className="w-[52px] flex items-center gap-1">
              <span className="text-[13px]">{EMOJI[key]}</span>
              <span className="text-[12px] font-bold" style={{ color: info.colorDark }}>{key}</span>
            </div>
            <div className="flex-1 h-[22px] rounded-full overflow-hidden relative"
              style={{ background: `${info.colorLight}` }}>
              <motion.div
                className="h-full rounded-full relative"
                style={{
                  background: isEmpty ? 'transparent' : `linear-gradient(90deg, ${info.color}CC, ${info.color})`,
                }}
                initial={{ width: 0 }}
                animate={{ width: isEmpty ? '0%' : `${Math.max(barPct, 8)}%` }}
                transition={{ duration: 1.2, delay: idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
              />
              {isEmpty && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium"
                  style={{ color: 'var(--text-hint)' }}>없음</span>
              )}
            </div>
            <div className="w-[52px] text-right">
              <span className="text-[13px] font-black" style={{ color: isEmpty ? 'var(--text-hint)' : info.colorDark }}>
                {count}
              </span>
              <span className="text-[10px] ml-0.5" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
