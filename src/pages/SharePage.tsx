import { useParams } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';

export function SharePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="page-container">
      <FadeIn>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-brand-text">공유된 사주 리포트</h1>
          <p className="text-brand-muted text-sm mt-1">공유 ID: {id}</p>
        </div>
      </FadeIn>
      <FadeIn delay={0.2}>
        <div className="card text-center py-12">
          <p className="text-brand-muted">Phase 1-C에서 구현 예정</p>
        </div>
      </FadeIn>
    </div>
  );
}
