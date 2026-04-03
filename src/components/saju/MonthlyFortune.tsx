import type { MonthlyFortune as MonthlyFortuneType } from '@/types/report';

interface Props {
  data: MonthlyFortuneType[];
}

/**
 * 2026 월별 운세 미니 바 — PRD v2 독자 기능
 * 12개월 가로 바, 점수 높은 월 하이라이트
 */
export function MonthlyFortune({ data }: Props) {
  const maxScore = Math.max(...data.map(d => d.score));

  return (
    <div className="space-y-3">
      <h4 className="text-h3 text-text-primary">월별 운세 흐름</h4>
      <div className="flex items-end gap-1 h-24">
        {data.map((m) => {
          const height = (m.score / 100) * 100;
          const isMax = m.score === maxScore;
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-tiny ${isMax ? 'text-brand-primary font-bold' : 'text-text-hint'}`}>
                {m.score}
              </span>
              <div
                className={`w-full rounded-t-sm transition-all duration-500 ${
                  isMax ? 'bg-brand-primary' : 'bg-brand-muted/40'
                }`}
                style={{ height: `${height}%`, minHeight: 4 }}
              />
              <span className={`text-tiny ${isMax ? 'text-brand-primary font-bold' : 'text-text-hint'}`}>
                {m.month}월
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
