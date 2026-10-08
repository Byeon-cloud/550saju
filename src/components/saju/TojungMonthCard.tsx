import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { stripMd } from '@/utils/format';

interface Props {
  month: number;
  괘: string;
  괘의미: string;
  전통해석: string;
  현대해석: string;
  score: number;
  keyword: string;
  /** 2026-10-08 신년운세 7운 — 서버 일진 계산 좋은 날·조심할 날 + 이 달 할 일·피할 일 (없으면 미표시 · 옛 결과 호환) */
  goodDays?: string[];
  cautionDays?: string[];
  todo?: string;
  avoid?: string;
  delay?: number;
}

/** 토정비결 월별 카드 — 전통 괘 + 현대 해석 */
export function TojungMonthCard({ month, 괘, 괘의미, 전통해석, 현대해석, score, keyword, goodDays, cautionDays, todo, avoid, delay = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor = score >= 80 ? '#B8965A' : score >= 60 ? '#2D8A4E' : score >= 40 ? '#2D4470' : '#D32F2F';

  return (
    <motion.button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left card transition-all"
      style={{ borderLeft: `4px solid ${scoreColor}` }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${scoreColor}12` }}>
            <span className="text-h2 font-black" style={{ color: scoreColor }}>{month}</span>
          </div>
          <div>
            <p className="text-label text-text-primary font-bold">{month}월 · {keyword}</p>
            <p className="text-caption text-text-muted">{괘}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-h3 font-bold" style={{ color: scoreColor }}>{score}점</span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`text-text-hint transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {/* 괘 의미 */}
              <p className="text-caption text-text-muted italic">{stripMd(괘의미)}</p>

              {/* 전통 해석 — 고풍스러운 스타일 */}
              {/* 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). 배경 톤만 유지. */}
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(184,150,90,0.08)' }}>
                <p className="text-caption text-text-hint mb-1">한 줄로</p>
                <p className="text-body-sm text-text-secondary leading-relaxed" style={{ fontStyle: 'italic' }}>
                  {stripMd(전통해석)}
                </p>
              </div>

              {/* 현대 해석 */}
              <div>
                <p className="text-caption text-text-hint mb-1">자세한 풀이</p>
                <p className="text-body-sm text-text-secondary leading-relaxed">{stripMd(현대해석)}</p>
              </div>

              {/* 2026-10-08 — 이 달 할 일 · 피할 일 */}
              {(todo || avoid) && (
                <div className="space-y-1.5">
                  {todo && <p className="text-body-sm text-text-primary"><span className="font-bold" style={{ color: '#2D8A4E' }}>할 일 </span>{stripMd(todo)}</p>}
                  {avoid && <p className="text-body-sm text-text-primary"><span className="font-bold" style={{ color: '#D32F2F' }}>피할 일 </span>{stripMd(avoid)}</p>}
                </div>
              )}

              {/* 2026-10-08 — 좋은 날 · 조심할 날 (일진 × 용신 계산) */}
              {((goodDays && goodDays.length > 0) || (cautionDays && cautionDays.length > 0)) && (
                <div className="flex flex-wrap gap-1.5">
                  {(goodDays || []).map((d) => (
                    <span key={`g${d}`} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(45,138,78,0.10)', color: '#2D8A4E' }}>좋은 날 {d}</span>
                  ))}
                  {(cautionDays || []).map((d) => (
                    <span key={`c${d}`} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(211,47,47,0.08)', color: '#B23A3A' }}>조심 {d}</span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
