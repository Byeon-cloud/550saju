import { useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';

export function StoragePage() {
  const navigate = useNavigate();
  const reports: { id: string; name: string; date: string; type: string }[] = [];

  return (
    <div className="page-container min-h-screen">
      <FadeIn><h1 className="text-h1 mb-6" style={{ color: 'var(--text-primary)' }}>보관함</h1></FadeIn>
      {reports.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
              style={{ background: 'var(--bg-warm)' }}>
              <span className="text-[36px]">📁</span>
            </div>
            <p className="text-h2" style={{ color: 'var(--text-primary)' }}>아직 분석한 사주가 없어요</p>
            <p className="text-[13px] mt-2 mb-6" style={{ color: 'var(--text-muted)' }}>첫 사주를 분석해보세요!</p>
            <Button variant="gold" onClick={() => navigate('/input')}>사주 분석하기</Button>
          </div>
        </FadeIn>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <button key={r.id} onClick={() => navigate(`/result/${r.id}`)}
              className="card w-full text-left hover:shadow-brand-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.date}</p>
                </div>
                <span className="badge badge-gold">{r.type}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
