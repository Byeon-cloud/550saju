import { useNavigate, useParams } from 'react-router-dom';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { usePageTitle } from '@/hooks/usePageTitle';

/**
 * 공유 수신 페이지
 * 공유 링크를 받은 사람이 보는 페이지
 * 상위 2섹션 미리보기 + 나머지 블러 + 강력한 CTA
 */
export function SharePage() {
  usePageTitle('사주 결과 미리보기');
  const navigate = useNavigate();
  const { id: _shareId } = useParams();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page-gradient)' }}>
      <div className="h-safe-top" />
      <div className="px-5 pt-6 pb-8 space-y-5">

        {/* 로고 */}
        <FadeIn>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" stroke="#1B2A4A" strokeWidth="1" fill="none" opacity="0.3" />
              <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#1B2A4A" />
              <circle cx="12" cy="7" r="2" fill="#C9A96E" />
              <circle cx="12" cy="17" r="2" fill="#1B2A4A" stroke="#C9A96E" strokeWidth="0.8" />
            </svg>
            <span className="text-caption text-text-hint font-semibold">사주500</span>
          </div>
        </FadeIn>

        {/* 히어로 */}
        <FadeIn delay={0.03}>
          <div className="card-navy py-7 px-5">
            <p className="text-[10px] text-white/30 mb-1">사주 분석 결과</p>
            <h1 className="text-display text-white leading-snug">
              누군가 당신에게{'\n'}사주 결과를 공유했어요
            </h1>
            <p className="text-body-sm text-white/45 mt-3 leading-relaxed">
              12가지 심층 분석 중 일부를 미리 볼 수 있어요.
            </p>
          </div>
        </FadeIn>

        {/* 미리보기 카드 — 2섹션 */}
        <FadeIn delay={0.06}>
          <div className="card space-y-4">
            <div>
              <p className="text-label text-brand-gold font-semibold mb-1">사주 총평</p>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                일간이 己土(기토)로, 부드러운 흙과 같은 에너지를 가지고 있습니다.
                겉으로는 온화하고 수용적이지만, 그 안에 놀라운 생산력이 숨어있어요...
              </p>
            </div>
            <div className="h-px bg-border-light" />
            <div>
              <p className="text-label text-brand-gold font-semibold mb-1">타고난 성격</p>
              <p className="text-body-sm text-text-secondary leading-relaxed">
                회의 중에 말하기 전에 머릿속으로 3번은 정리하고 나서야 입을 여는 타입이에요.
                생각이 많은 사람이라는 인상을 주지만...
              </p>
            </div>
          </div>
        </FadeIn>

        {/* 블러 영역 — 궁금증 유발 */}
        <FadeIn delay={0.09}>
          <div className="card relative overflow-hidden">
            <div className="space-y-3" style={{ filter: 'blur(6px)' }}>
              <div className="h-3 w-3/4 rounded bg-text-hint/20" />
              <div className="h-3 w-full rounded bg-text-hint/15" />
              <div className="h-3 w-2/3 rounded bg-text-hint/20" />
              <div className="h-3 w-5/6 rounded bg-text-hint/10" />
              <div className="h-3 w-3/4 rounded bg-text-hint/15" />
              <div className="h-3 w-1/2 rounded bg-text-hint/20" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A96E" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <p className="text-label text-text-primary font-semibold">나머지 10개 섹션</p>
              <p className="text-caption text-text-muted mt-0.5">내 사주를 분석하면 전체를 볼 수 있어요</p>
            </div>
          </div>
        </FadeIn>

        {/* 포함 항목 미리보기 */}
        <FadeIn delay={0.12}>
          <div className="flex flex-wrap gap-2 justify-center">
            {['직업운', '재물운', '애정운', '건강', '대운', '월별 운세', '궁합', '개운법', '럭키 프로필'].map((item) => (
              <span key={item} className="px-3 py-1.5 rounded-full text-[11px] text-text-muted bg-bg-surface border border-border-light">
                {item}
              </span>
            ))}
          </div>
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.15}>
          <div className="space-y-3 pt-2">
            <Button variant="gold" fullWidth size="lg" onClick={() => navigate('/input')}>
              나도 내 사주 알아보기
            </Button>
            <p className="text-center text-[10px] text-text-hint">
              1운(500원) · 12가지 심층 분석 · 3분 완성
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full text-center text-caption text-text-muted py-2"
            >
              사주500 둘러보기
            </button>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
