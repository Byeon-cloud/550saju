import type { LuckyProfile as LuckyProfileType } from '@/types/report';

interface Props {
  data: LuckyProfileType;
}

/**
 * 나만의 럭키 프로필 — PRD v2 독자 기능
 * SNS 공유 트리거: 인스타 스토리에 올리기 좋은 카드 디자인
 */
export function LuckyProfile({ data }: Props) {
  return (
    <div className="card-gold space-y-4">
      <h3 className="text-h2 text-text-primary">나만의 럭키 프로필</h3>

      {/* 행운 컬러 */}
      <div>
        <p className="text-label text-text-muted mb-2">행운의 컬러</p>
        <div className="flex gap-3">
          {data.colors.map((color, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full shadow-sm" style={{ background: color }} />
              <span className="text-body-sm text-text-secondary">{data.colorNames[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 행운 숫자 */}
      <div>
        <p className="text-label text-text-muted mb-2">행운의 숫자</p>
        <div className="flex gap-3">
          {data.numbers.map((n, i) => (
            <div key={i} className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center text-h3">
              {n}
            </div>
          ))}
        </div>
      </div>

      {/* 방위 + 요일 */}
      <div className="flex gap-6">
        <div>
          <p className="text-label text-text-muted mb-1">행운 방위</p>
          <p className="text-h3 text-text-primary">{data.direction}</p>
        </div>
        <div>
          <p className="text-label text-text-muted mb-1">행운 요일</p>
          <p className="text-h3 text-text-primary">{data.day}</p>
        </div>
        <div>
          <p className="text-label text-text-muted mb-1">보충 오행</p>
          <p className="text-h3 text-text-primary">{data.element}</p>
        </div>
      </div>

      {/* 행운 음식 */}
      <div>
        <p className="text-label text-text-muted mb-2">행운의 음식</p>
        <div className="flex gap-2 flex-wrap">
          {data.foods.map((food, i) => (
            <span key={i} className="badge-gold text-caption px-3 py-1">{food}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
