import { motion } from 'framer-motion';

interface Props {
  name: string;
  score: number;
  color?: string;
  delay?: number;
}

/** 궁합 카테고리별 점수 — 2026-10-11 무지개색 둥근 막대 → 이름 + 점수 한 줄, 아래 네모 끝 먹 막대 (이름 줄바꿈 방지) */
export function CompatScoreBar({ name, score, delay = 0 }: Props) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 15.5, fontWeight: 700, color: '#1A1612' }}>{name}</span>
        <span style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 18, fontWeight: 800, color: '#1A1612' }}>
          {score}<small style={{ fontSize: 12, color: '#6F6557', marginLeft: 2, fontWeight: 700 }}>점</small>
        </span>
      </div>
      <div className="hj-bar">
        <motion.i
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(score, 5)}%` }}
          transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
