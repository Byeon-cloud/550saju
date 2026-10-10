import type { RelationshipMap as RelMapType } from '@/types/report';

interface Props {
  data: RelMapType;
}

const LABELS = {
  work: { label: '직장', color: '#3A3128' },
  friend: { label: '친구', color: '#4E7A57' },
  lover: { label: '연인', color: '#B8965A' },
} as const;

/**
 * 관계 유형 차트 — PRD v2 독자 기능
 * 직장/친구/연인 3영역 점수 + 키워드
 */
export function RelationshipMap({ data }: Props) {
  return (
    <div className="space-y-3">
      <h4 className="text-h3 text-text-primary">관계 유형</h4>
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((key) => {
          const item = data[key];
          const { label, color } = LABELS[key];
          return (
            <div key={key} className="card text-center space-y-2 py-4">
              <div className="w-8 h-8 rounded-full mx-auto flex items-center justify-center"
                style={{ background: `${color}15` }}>
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              </div>
              <p className="text-caption text-text-muted">{label}</p>
              <p className="text-h1 text-brand-primary">{item.score}</p>
              <p className="text-label text-text-secondary">{item.keyword}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
