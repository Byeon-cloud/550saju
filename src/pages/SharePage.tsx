import { useParams, useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';

export function SharePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="page-container min-h-screen flex flex-col items-center justify-center text-center">
      <FadeIn>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--bg-glow)' }}>
          <span className="text-[28px]">🔮</span>
        </div>
        <h1 className="text-h1" style={{ color: 'var(--text-primary)' }}>사주 리포트 공유</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>친구가 공유한 사주 리포트예요</p>
        <p className="text-[10px] mt-1 mb-6" style={{ color: 'var(--text-hint)' }}>ID: {id}</p>

        <div className="card w-full max-w-sm mb-6 text-left">
          <div className="skeleton h-4 w-3/4 mb-3" />
          <div className="skeleton h-3 w-full mb-2" />
          <div className="skeleton h-3 w-5/6 mb-2" />
          <div className="skeleton h-3 w-2/3" />
          <div className="divider-gradient my-4" />
          <p className="text-[11px] text-center" style={{ color: 'var(--text-hint)' }}>전체 내용은 직접 분석해보세요</p>
        </div>

        <Button fullWidth variant="gold" onClick={() => navigate('/input')}>내 사주도 보기</Button>
        <p className="text-[11px] font-bold mt-2" style={{ color: 'var(--brand-accent)' }}>550원</p>
      </FadeIn>
    </div>
  );
}
