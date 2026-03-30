import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';

const FEATURES = [
  { icon: '💕', title: '궁합', desc: '두 사람의 오행 궁합', price: '550원' },
  { icon: '📅', title: '대운', desc: '10년 단위 흐름', price: '550원' },
  { icon: '📆', title: '연도별', desc: '2026 상세 운세', price: '550원' },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="page-container flex flex-col min-h-screen">
      {/* 히어로 */}
      <FadeIn>
        <div className="text-center pt-12 pb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: 'linear-gradient(135deg, rgba(184,160,128,0.15), rgba(200,149,108,0.15))' }}>
            <span className="text-3xl">☯️</span>
          </div>
          <h1 className="text-display" style={{ color: 'var(--text-primary)' }}>550사주</h1>
          <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>
            전통 명리학 + AI가 만든 극상 퀄리티 사주 풀이
          </p>
        </div>
      </FadeIn>

      {/* 오늘의 운세 */}
      <FadeIn delay={0.1}>
        <button onClick={() => navigate('/daily')}
          className="card-gradient w-full text-left mt-2 hover:shadow-brand-lg transition-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-glow)' }}>
              <span className="text-[16px]">🔮</span>
            </span>
            <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>오늘의 운세</span>
            <span className="ml-auto badge badge-gold">무료</span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            오늘은 새로운 시작의 에너지가 감돌고 있어요.
            작은 변화가 큰 흐름을 바꿀 수 있는 날입니다...
          </p>
          <div className="flex items-center gap-1 mt-3" style={{ color: 'var(--brand-accent)' }}>
            <span className="text-[12px] font-semibold">자세히 보기</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>
      </FadeIn>

      {/* CTA */}
      <FadeIn delay={0.2} className="mt-5">
        <Button fullWidth size="lg" variant="gold" onClick={() => navigate('/input')}>
          내 사주 보기
        </Button>
        <p className="text-center text-[11px] mt-2" style={{ color: 'var(--text-hint)' }}>
          550원 · 10개 섹션 심층 분석
        </p>
      </FadeIn>

      {/* 크로스셀 */}
      <FadeIn delay={0.3} className="mt-6">
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {FEATURES.map((item) => (
            <button key={item.title} onClick={() => navigate('/input')}
              className="card flex-shrink-0 w-[130px] text-left hover:shadow-brand-md transition-all">
              <span className="text-[22px]">{item.icon}</span>
              <p className="text-[13px] font-bold mt-2" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
              <p className="text-[11px] font-bold mt-2" style={{ color: 'var(--brand-accent)' }}>{item.price}</p>
            </button>
          ))}
        </div>
      </FadeIn>

      <div className="flex-1" />

      <FadeIn delay={0.4}>
        <p className="text-center text-[10px] py-4" style={{ color: 'var(--text-hint)' }}>
          550사주 · 극상 AI 사주, 550원
        </p>
      </FadeIn>
    </div>
  );
}
