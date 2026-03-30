import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="page-container flex flex-col items-center justify-center min-h-screen gap-8">
      <FadeIn>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-brand-text tracking-tight">
            550사주
          </h1>
          <p className="text-brand-muted mt-3 text-lg">
            극상 AI 사주, 550원
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button fullWidth size="lg" onClick={() => navigate('/input')}>
            사주 보러 가기
          </Button>
          <Button
            fullWidth
            size="md"
            variant="secondary"
            onClick={() => navigate('/daily')}
          >
            오늘의 무료운세
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.4}>
        <p className="text-brand-muted text-xs text-center mt-4">
          전통 명리학 + AI가 만든 극상 퀄리티 사주 풀이
        </p>
      </FadeIn>
    </div>
  );
}
