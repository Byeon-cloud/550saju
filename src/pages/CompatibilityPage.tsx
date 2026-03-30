import { FadeIn } from '@/components/common/FadeIn';

export function CompatibilityPage() {
  return (
    <div className="page-container">
      <FadeIn>
        <h1 className="section-title mb-4">궁합</h1>
      </FadeIn>
      <FadeIn delay={0.2}>
        <div className="card text-center py-12">
          <p className="text-brand-muted">MVP 이후 구현 예정</p>
        </div>
      </FadeIn>
    </div>
  );
}
