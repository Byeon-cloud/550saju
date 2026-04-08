import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { CompatProfilePair } from '@/components/saju/CompatProfilePair';
import { CompatScoreBar } from '@/components/saju/CompatScoreBar';
import { ShareModal } from '@/components/share/ShareModal';
import { generateCompatibilityAnalysis } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { CompatibilityResponse } from '@/types/report';

const LOADING_STEPS = [
  '두 사람의 오행을 비교하고 있어요...',
  '일간 관계를 분석하고 있어요...',
  '십성 교차 분석 중...',
  '궁합 점수를 계산하고 있어요...',
  '맞춤 조언을 작성하고 있어요...',
];

const CATEGORY_COLORS: Record<string, string> = {
  personality: '#C9A96E',
  values: '#2D8A4E',
  communication: '#1565C0',
  emotion: '#D32F2F',
  future: '#7B1FA2',
};

export function CompatResultPage() {
  usePageTitle('궁합 결과');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const state = location.state as { person1: any; person2: any; relation: string } | undefined;

  const [phase, setPhase] = useState<'loading' | 'result'>('loading');
  const [result, setResult] = useState<CompatibilityResponse | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const called = useRef(false);

  useEffect(() => {
    if (!state?.person1 || !state?.person2) {
      navigate('/compat');
      return;
    }
    if (called.current) return;
    called.current = true;

    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 2500);

    generateCompatibilityAnalysis(
      state.person1.sajuData,
      state.person2.sajuData,
      state.relation,
    ).then(res => {
      setResult(res.content);
      setPhase('result');
    }).catch(async (e) => {
      console.error('궁합 분석 실패:', e);
      const { addRewardBalance } = await import('@/services/storage/localStore');
      addRewardBalance(1);
      toast.show('분석 실패 — 1운이 환불됐어요', 'warning');
      navigate('/compat');
    }).finally(() => clearInterval(interval));
  }, []);

  if (!state) return null;

  // ─── 로딩 ───
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--bg-page-gradient)' }}>
        <motion.div className="w-16 h-16 rounded-full border-3 border-border-light border-t-brand-gold mb-6"
          animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />

        {/* 두 사람 이름 */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-h2 text-text-primary">{state.person1.name}</span>
          <span className="text-caption text-text-muted">×</span>
          <span className="text-h2 text-text-primary">{state.person2.name}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.p key={loadingStep} className="text-body-sm text-text-muted"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {LOADING_STEPS[loadingStep]}
          </motion.p>
        </AnimatePresence>
      </div>
    );
  }

  // ─── 결과 ───
  if (!result) return null;

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="궁합 결과" />
      <div className="px-5 pt-4 space-y-5">

        {/* 프로필 페어 + 종합 점수 */}
        <FadeIn>
          <CompatProfilePair
            person1={{ name: state.person1.name, pillars: state.person1.sajuData.pillars, elements: state.person1.sajuData.elements }}
            person2={{ name: state.person2.name, pillars: state.person2.sajuData.pillars, elements: state.person2.sajuData.elements }}
            overallScore={result.overallScore}
            relation={state.relation}
          />
        </FadeIn>

        {/* 총평 */}
        <FadeIn delay={0.05}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-2">궁합 총평</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{result.summary}</p>
          </div>
        </FadeIn>

        {/* 오행 조화 */}
        <FadeIn delay={0.1}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">오행 조화</p>
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="text-center">
                <p className="text-h2 text-brand-gold">{result.ohengHarmony.person1Element}</p>
                <p className="text-caption text-text-muted">{state.person1.name}</p>
              </div>
              <div className="px-3 py-1.5 rounded-full" style={{
                background: result.ohengHarmony.relation === '상생' ? 'rgba(45,138,78,0.1)' : 'rgba(211,47,47,0.1)',
                color: result.ohengHarmony.relation === '상생' ? '#2D8A4E' : '#D32F2F',
              }}>
                <span className="text-label font-bold">{result.ohengHarmony.relation}</span>
              </div>
              <div className="text-center">
                <p className="text-h2 text-brand-gold">{result.ohengHarmony.person2Element}</p>
                <p className="text-caption text-text-muted">{state.person2.name}</p>
              </div>
            </div>
            <p className="text-body-sm text-text-secondary leading-relaxed">{result.ohengHarmony.description}</p>
          </div>
        </FadeIn>

        {/* 카테고리별 점수 */}
        <FadeIn delay={0.15}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-4">카테고리별 궁합</p>
            <div className="space-y-4">
              {result.categories.map((cat, i) => (
                <div key={cat.id}>
                  <CompatScoreBar
                    name={cat.name}
                    score={cat.score}
                    color={CATEGORY_COLORS[cat.id] || '#C9A96E'}
                    delay={i * 0.1}
                  />
                  <p className="text-caption text-text-muted mt-1 ml-[76px] leading-relaxed">{cat.description}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* 잘 맞는 점 */}
        <FadeIn delay={0.2}>
          <div className="card-gold">
            <p className="text-h3 text-text-primary mb-3">잘 맞는 점</p>
            <ul className="space-y-2">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-brand-gold mt-0.5">●</span>
                  <span className="text-body-sm text-text-secondary">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>

        {/* 주의할 점 */}
        <FadeIn delay={0.25}>
          <div className="card" style={{ borderLeft: '4px solid #D32F2F20' }}>
            <p className="text-h3 text-text-primary mb-3">주의할 점</p>
            <ul className="space-y-2">
              {result.challenges.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-func-danger mt-0.5">●</span>
                  <span className="text-body-sm text-text-secondary">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>

        {/* 종합 조언 */}
        <FadeIn delay={0.3}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-2">종합 조언</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{result.advice}</p>
          </div>
        </FadeIn>

        {/* 미래 전망 */}
        <FadeIn delay={0.35}>
          <div className="card-navy py-5 px-5">
            <p className="text-h3 text-white mb-2">미래 전망</p>
            <p className="text-body-sm text-white/70 leading-relaxed whitespace-pre-line">{result.futureOutlook}</p>
          </div>
        </FadeIn>

        {/* CTA — 공유 (가장 강조) */}
        <FadeIn delay={0.4}>
          <div className="space-y-3">
            <Button onClick={() => setShowShare(true)} variant="gold" size="lg" fullWidth>
              궁합 결과 공유하기
            </Button>
            <Button onClick={() => navigate('/compat')} variant="secondary" size="lg" fullWidth>
              다른 궁합 보기
            </Button>
          </div>
        </FadeIn>
      </div>

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        name={`${state.person1.name} × ${state.person2.name}`}
        reportId="compat"
        topScore={{ label: '궁합 점수', score: result.overallScore }}
      />
    </div>
  );
}
