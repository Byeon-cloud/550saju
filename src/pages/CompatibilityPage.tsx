import { useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';

export function CompatibilityPage() {
  const navigate = useNavigate();
  return (
    <div className="page-container min-h-screen flex flex-col items-center justify-center text-center">
      <FadeIn>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'linear-gradient(135deg, #FFF0F0, #FFE8E8)' }}>
          <span className="text-[40px]">💕</span>
        </div>
        <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>궁합 분석</h1>
        <p className="text-[13px] mt-2 mb-8 max-w-[280px] mx-auto" style={{ color: 'var(--text-muted)' }}>
          두 사람의 사주를 비교해서 오행 궁합, 성격 궁합, 관계 궁합을 분석해드려요.
        </p>
        <Button variant="gold" onClick={() => navigate('/input')}>궁합 분석 시작</Button>
        <p className="text-[11px] font-bold mt-3" style={{ color: 'var(--brand-accent)' }}>1운 (550원)</p>
      </FadeIn>
    </div>
  );
}
