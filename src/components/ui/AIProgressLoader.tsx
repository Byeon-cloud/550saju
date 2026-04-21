// v4.1 공용 — AI 생성 대기 전용 로딩.
// 사양: docs/design_system_v4_consolidated.md §3 / ux_writing_global_copy_book.md §8
// "퀄리티 > 속도" 원칙 — 로딩을 의미 있게.

import { useEffect, useState } from 'react';

export type AIStage = 'analyze' | 'synthesize' | 'compose' | 'refine';

/**
 * stage별 프리셋 — 호출부가 특정 stage를 지정하면 그 문구가 먼저 나오고
 * 이후 나머지 단계가 순차 순환 (백그라운드 전환 전까지).
 */
const STAGE_COPY: Record<AIStage, string[]> = {
  analyze: [
    '사주 원국을 읽는 중',
    '오행과 신살을 정돈하는 중',
    '당신의 오늘과 잇는 중',
    '풀이를 다듬는 중',
  ],
  synthesize: [
    '결제를 확인했어요',
    '6대 원전을 펼치는 중',
    '당신의 사주와 꿈을 엮는 중',
    '정성 풀이로 다듬는 중',
  ],
  compose: [
    '오늘의 기운을 읽는 중',
    '당신의 사주에 맞춰 다듬는 중',
  ],
  refine: [
    '풀이를 다듬는 중',
    '마지막으로 한 번 더 검토하는 중',
  ],
};

export interface AIProgressLoaderProps {
  stage?: AIStage;
  /** 단계 전환 간격 (ms). 기본 4000. */
  intervalMs?: number;
  /** 직접 넣는 커스텀 단계 문구 (stage 무시). */
  steps?: string[];
  className?: string;
}

export function AIProgressLoader({
  stage = 'analyze',
  intervalMs = 4000,
  steps,
  className = '',
}: AIProgressLoaderProps) {
  const sequence = steps && steps.length > 0 ? steps : STAGE_COPY[stage];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (sequence.length <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % sequence.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [sequence, intervalMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center py-10 ${className}`}
    >
      <div className="relative w-10 h-10">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-gold-brown/20"
        />
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-brown animate-spin-slow"
        />
      </div>
      <p className="mt-5 text-base font-semibold text-ink">{sequence[idx]}</p>
      <div className="mt-3 flex gap-1">
        {sequence.map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              i === idx ? 'bg-gold-brown' : 'bg-gold-brown-soft/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default AIProgressLoader;
