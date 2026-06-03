// v4.1 공용 — 로딩 상태 통일 (AI 로딩은 AIProgressLoader 사용).
// 기본 shimmer는 tailwind.config.js 에 이미 존재 (animate-shimmer).

export type SkeletonVariant = 'text' | 'card' | 'hero';

export interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  /** 반복 개수 (text·card variant 한정). */
  count?: number;
  className?: string;
}

export function LoadingSkeleton({
  variant = 'text',
  count = 1,
  className = '',
}: LoadingSkeletonProps) {
  if (variant === 'hero') {
    return (
      <div className={`animate-shimmer ${className}`}>
        <div className="h-3 w-20 rounded bg-gold-brown-soft/50" />
        <div className="mt-3 h-10 w-full rounded bg-gray-200" />
        <div className="mt-2 h-10 w-3/4 rounded bg-gray-200" />
        <div className="mt-5 h-4 w-full rounded bg-gray-100" />
        <div className="mt-2 h-4 w-5/6 rounded bg-gray-100" />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="animate-shimmer rounded-xl border border-gray-100 bg-paper p-5"
          >
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="mt-3 h-3 w-full rounded bg-gray-100" />
            <div className="mt-2 h-3 w-4/5 rounded bg-gray-100" />
            <div className="mt-2 h-3 w-3/5 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  // text
  return (
    <div className={`animate-shimmer space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-gray-100" style={{ width: `${90 - i * 8}%` }} />
      ))}
    </div>
  );
}

export default LoadingSkeleton;
