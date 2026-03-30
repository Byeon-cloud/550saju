import { useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';

export function MyPage() {
  const navigate = useNavigate();
  const balance = 0;

  return (
    <div className="page-container min-h-screen">
      <FadeIn><h1 className="text-h1 mb-6" style={{ color: 'var(--text-primary)' }}>마이페이지</h1></FadeIn>
      <FadeIn delay={0.05}>
        <div className="card-gold text-center py-6 mb-5">
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>내 운(運) 잔액</p>
          <p className="text-display mt-1" style={{ color: 'var(--brand-gold-dark)' }}>{balance} 운</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-hint)' }}>(= {(balance * 550).toLocaleString()}원)</p>
          <Button size="sm" variant="gold" className="mt-4" onClick={() => navigate('/charge')}>충전하기</Button>
        </div>
      </FadeIn>
      <FadeIn delay={0.1}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <MenuItem label="보관함" desc="내 사주 리포트" onClick={() => navigate('/storage')} />
          <div className="divider-gradient" />
          <MenuItem label="결제 내역" desc="충전/사용 이력" onClick={() => {}} />
          <div className="divider-gradient" />
          <MenuItem label="프로필 관리" desc="저장된 프로필" onClick={() => {}} />
        </div>
      </FadeIn>
      <FadeIn delay={0.15}>
        <div className="card mt-3" style={{ padding: 0, overflow: 'hidden' }}>
          <MenuItem label="이용약관" onClick={() => {}} />
          <div className="divider-gradient" />
          <MenuItem label="개인정보처리방침" onClick={() => {}} />
          <div className="divider-gradient" />
          <MenuItem label="고객센터" onClick={() => {}} />
        </div>
      </FadeIn>
      <FadeIn delay={0.2}>
        <div className="mt-8 flex flex-col items-center gap-3">
          <button className="text-[12px] underline" style={{ color: 'var(--text-muted)' }}>로그아웃</button>
          <button className="text-[11px]" style={{ color: 'var(--text-hint)' }}>회원탈퇴</button>
        </div>
      </FadeIn>
      <p className="text-center text-[10px] mt-8" style={{ color: 'var(--text-hint)' }}>550사주 v1.0.0</p>
    </div>
  );
}

function MenuItem({ label, desc, onClick }: { label: string; desc?: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between py-3.5 px-[18px] text-left transition-colors"
      style={{ background: 'transparent' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div>
        <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {desc && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-hint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
