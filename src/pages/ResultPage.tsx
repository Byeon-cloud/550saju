import { useParams } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';

export function ResultPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="page-container">
      <FadeIn>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand-text">사주 풀이 리포트</h1>
          <p className="text-brand-muted text-sm mt-1">리포트 ID: {id}</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="card text-center py-12">
          <p className="text-brand-muted">
            결과 페이지 구현 예정
          </p>
          <p className="text-brand-muted text-sm mt-2">
            PillarCard, ElementRadar, ScoreRing, DaeunTimeline 등
            <br />
            인포그래픽 컴포넌트가 여기에 들어갑니다
          </p>
        </div>
      </FadeIn>
    </div>
  );
}
