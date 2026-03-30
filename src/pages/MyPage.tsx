import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';

export function MyPage() {
  return (
    <div className="page-container">
      <FadeIn>
        <h1 className="section-title mb-6">마이페이지</h1>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="card mb-4">
          <p className="text-brand-muted text-sm">잔액</p>
          <p className="text-3xl font-bold text-brand-text mt-1">0운</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="flex flex-col gap-3">
          <Button variant="secondary" fullWidth>
            결제 내역
          </Button>
          <Button variant="secondary" fullWidth>
            로그아웃
          </Button>
        </div>
      </FadeIn>
    </div>
  );
}
