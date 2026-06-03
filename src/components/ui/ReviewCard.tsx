// v4.1 공용 — 홈 후기 캐러셀 / 후기 페이지 카드.
// 스펙: homepage_redesign_spec.md §6 / input_payment_review_pages_spec.md C

export interface ReviewCardProps {
  /** 페르소나 (예: "민지 27"). */
  persona: string;
  /** 0~5 · 0.5 단위. */
  stars: number;
  /** 1~2줄 짧은 스니펫 (홈 캐러셀용). */
  snippet: string;
  /** 컨텍스트 (예: "이직 전", "연애 고민"). */
  context?: string;
  /** 블러잠금 CTA 클릭 핸들러 (있으면 "전체 읽기 · 500원" 오버레이 표시). */
  onUnlock?: () => void;
  className?: string;
}

export function ReviewCard({
  persona,
  stars,
  snippet,
  context,
  onUnlock,
  className = '',
}: ReviewCardProps) {
  return (
    <article
      className={`min-w-[260px] max-w-[300px] snap-start bg-paper border border-gray-100 rounded-xl p-4 ${className}`}
    >
      <header className="flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">{persona}</span>
        {context ? <span className="text-xs text-gray-500">· {context}</span> : null}
      </header>
      <Stars value={stars} className="mt-1" />
      <p className="mt-3 text-sm text-gray-700 leading-[1.7] line-clamp-3">{snippet}</p>
      {onUnlock ? (
        <button
          type="button"
          onClick={onUnlock}
          className="mt-3 w-full h-[44px] rounded-lg bg-white border border-ink text-sm font-semibold hover:bg-gray-100 transition"
        >
          전체 읽기 · 500원
        </button>
      ) : null}
    </article>
  );
}

/** 소형 별점 (0.5 단위 · gold-brown 16px) */
function Stars({ value, className = '' }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(5, value));
  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5;
  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      aria-label={`${clamped}점 / 5점`}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const state = i < full ? 'full' : i === full && half ? 'half' : 'empty';
        return <Star key={i} state={state} />;
      })}
    </div>
  );
}

function Star({ state }: { state: 'full' | 'half' | 'empty' }) {
  if (state === 'full') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#B8965A" aria-hidden>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
      </svg>
    );
  }
  if (state === 'half') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id="halfGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor="#B8965A" />
            <stop offset="50%" stopColor="#D4C4A8" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"
          fill="url(#halfGrad)"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#D4C4A8" fillOpacity="0.4" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

export default ReviewCard;
