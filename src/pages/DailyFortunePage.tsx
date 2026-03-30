import { FadeIn } from '@/components/common/FadeIn';

export function DailyFortunePage() {
  return (
    <div className="page-container">
      <FadeIn>
        <h1 className="section-title mb-4">오늘의 운세</h1>
        <p className="text-brand-muted text-sm mb-6">매일 무료로 확인하세요</p>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="card text-center py-12">
          <p className="text-brand-muted">Phase 1-C에서 구현 예정</p>
        </div>
      </FadeIn>
    </div>
  );
}
