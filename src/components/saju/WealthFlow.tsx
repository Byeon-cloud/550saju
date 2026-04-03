import type { WealthFlow as WealthFlowType } from '@/types/report';

interface Props {
  data: WealthFlowType;
}

const STAGES = [
  { key: 'earning' as const, label: '벌기', color: '#C9A96E' },
  { key: 'spending' as const, label: '쓰기', color: '#D32F2F' },
  { key: 'saving' as const, label: '모으기', color: '#2D8A4E' },
];

/**
 * 재물 흐름도 — PRD v2 독자 기능
 * "벌기 → 쓰기 → 모으기" 3단계 + 점수/스타일
 */
export function WealthFlow({ data }: Props) {
  return (
    <div className="space-y-3">
      <h4 className="text-h3 text-text-primary">재물 흐름</h4>
      <div className="flex items-center gap-2">
        {STAGES.map((stage, i) => {
          const item = data[stage.key];
          return (
            <div key={stage.key} className="flex items-center gap-2 flex-1">
              <div className="card text-center flex-1 py-3 space-y-1">
                <div className="w-6 h-6 rounded-full mx-auto" style={{ background: `${stage.color}20`, border: `2px solid ${stage.color}` }} />
                <p className="text-label text-text-muted">{stage.label}</p>
                <p className="text-h2 text-brand-primary">{item.score}</p>
                <p className="text-tiny text-text-secondary">{item.style}</p>
              </div>
              {i < STAGES.length - 1 && (
                <span className="text-text-hint text-lg">→</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
