import { FadeIn } from '@/components/common/FadeIn';

export function StoragePage() {
  return (
    <div className="page-container">
      <FadeIn>
        <h1 className="section-title mb-4">보관함</h1>
        <p className="text-brand-muted text-sm mb-6">나의 사주 리포트를 모아보세요</p>
      </FadeIn>
      <FadeIn delay={0.2}>
        <div className="card text-center py-12">
          <p className="text-brand-muted">Phase 1-C에서 구현 예정</p>
        </div>
      </FadeIn>
    </div>
  );
}
