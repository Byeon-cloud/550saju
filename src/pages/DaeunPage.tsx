import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { DaeunTimeline } from '@/components/saju/DaeunTimeline';
import { ShareModal } from '@/components/share/ShareModal';
import { getReports, spendBalance, type LocalReport } from '@/services/storage/localStore';
import { generateDaeunAnalysis } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { DaeunAnalysisResponse } from '@/types/report';

type Phase = 'select' | 'loading' | 'result';

const LOADING_STEPS = [
  '대운 주기를 계산하고 있어요...',
  '각 대운의 오행 관계를 분석하고 있어요...',
  '현재 대운의 의미를 해석하고 있어요...',
  '전환기 조언을 작성하고 있어요...',
  '리포트를 완성하고 있어요...',
];

export function DaeunPage() {
  usePageTitle('대운 해설');
  const navigate = useNavigate();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('select');
  const [selected, setSelected] = useState<LocalReport | null>(null);
  const [result, setResult] = useState<DaeunAnalysisResponse | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);

  const reports = useMemo(() => getReports(), []);

  async function startAnalysis() {
    if (!selected) return;

    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '대운 해설에 1운이 필요해요' } });
      return;
    }

    toast.show('1운이 차감됐어요', 'info');
    setPhase('loading');
    setLoadingStep(0);

    const interval = setInterval(() => {
      setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 3000);

    try {
      const res = await generateDaeunAnalysis(selected.sajuData);
      setResult(res.content);
      setPhase('result');
    } catch (e: any) {
      console.error('대운 분석 실패:', e);
      setError(e.message || '분석에 실패했어요. 다시 시도해주세요.');
      setPhase('select');
      toast.show('분석에 실패했어요', 'warning');
    } finally {
      clearInterval(interval);
    }
  }

  // ─── 프로필 선택 ───
  if (phase === 'select') {
    if (reports.length === 0) {
      return (
        <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
          <Header title="대운 해설" />
          <div className="px-5 pt-8 text-center space-y-4">
            <p className="text-h2 text-text-primary">먼저 사주를 분석해주세요</p>
            <p className="text-body-sm text-text-muted">사주 데이터가 있어야 대운 해설을 볼 수 있어요.</p>
            <Button onClick={() => navigate('/input')} variant="gold" size="lg" fullWidth>사주 분석하러 가기</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="대운 해설" />
        <div className="px-5 pt-4 space-y-5">
          <FadeIn>
            <div className="card-navy py-5 px-5 text-center">
              <p className="text-h1 text-white">대운(大運) 해설</p>
              <p className="text-body-sm text-white/60 mt-2">10년 단위로 바뀌는 운의 흐름을 읽어드려요</p>
              <p className="text-caption text-white/40 mt-1">직업 · 연애 · 재물 · 건강 기간별 상세 분석</p>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <ProfilePicker
              onSelect={(r) => setSelected(r)}
              onNew={() => navigate('/input?new=1')}
              title="누구의 대운을 볼까요?"
            />
          </FadeIn>

          {selected && (
            <FadeIn delay={0.1}>
              <div className="card-gold py-3 px-4 flex items-center justify-between mb-2">
                <p className="text-body-sm text-text-primary">
                  <span className="font-bold">{selected.name}</span>님 선택됨
                </p>
                <button onClick={() => setSelected(null)} className="text-caption text-text-muted">변경</button>
              </div>
            </FadeIn>
          )}

          {error && <p className="text-caption text-func-danger text-center">{error}</p>}
        </div>

        {selected && (
          <div className="sticky-cta-bottom">
            <Button onClick={startAnalysis} variant="gold" size="lg" fullWidth>
              대운 분석하기 (1운)
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── 로딩 ───
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center"
        style={{ background: 'var(--bg-page-gradient)' }}>
        <motion.div
          className="w-16 h-16 rounded-full border-3 border-border-light border-t-brand-gold mb-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
        <AnimatePresence mode="wait">
          <motion.p
            key={loadingStep}
            className="text-h3 text-text-primary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {LOADING_STEPS[loadingStep]}
          </motion.p>
        </AnimatePresence>
        <p className="text-caption text-text-muted mt-2">{selected?.name}님의 대운을 분석하고 있어요</p>
      </div>
    );
  }

  // ─── 결과 ───
  if (!result) return null;

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="대운 해설" />
      <div className="px-5 pt-4 space-y-5">

        {/* 개요 */}
        <FadeIn>
          <div className="card-navy py-6 px-5">
            <p className="text-h2 text-white mb-1">{selected?.name}님의 대운 흐름</p>
            <p className="text-body-sm text-white/70 leading-relaxed whitespace-pre-line">{result.overview}</p>
          </div>
        </FadeIn>

        {/* 타임라인 */}
        {selected?.sajuData.daeun && (
          <FadeIn delay={0.05}>
            <div className="card">
              <p className="text-h3 text-text-primary mb-4">대운 타임라인</p>
              <DaeunTimeline daeunList={selected.sajuData.daeun} />
            </div>
          </FadeIn>
        )}

        {/* 현재 대운 하이라이트 */}
        <FadeIn delay={0.1}>
          <div className="card-gold py-6 px-5">
            <p className="text-h2 text-text-primary mb-1">지금 이 시기는?</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{result.currentHighlight}</p>
          </div>
        </FadeIn>

        {/* 기간별 상세 */}
        <FadeIn delay={0.15}>
          <p className="text-h2 text-text-primary">기간별 상세 분석</p>
        </FadeIn>
        {result.periods.map((period, i) => (
          <FadeIn key={period.간지} delay={0.2 + i * 0.03}>
            <PeriodCard period={period} />
          </FadeIn>
        ))}

        {/* 전환기 조언 */}
        <FadeIn delay={0.3}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-2">대운 전환기 조언</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{result.transitionAdvice}</p>
          </div>
        </FadeIn>

        {/* 인생 시기 맵 */}
        {result.lifePhaseMap?.length > 0 && (
          <FadeIn delay={0.35}>
            <p className="text-h3 text-text-primary mb-3">인생 시기 맵</p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5">
              {result.lifePhaseMap.map((lp, i) => (
                <div key={i} className="flex-shrink-0 card py-3 px-4 min-w-[120px] text-center">
                  <p className="text-caption text-text-muted">{lp.phase}</p>
                  <p className="text-h3 text-brand-gold mt-1">{lp.daeun}</p>
                  <p className="text-caption text-text-secondary mt-0.5">{lp.theme}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        )}

        {/* 공유 */}
        <FadeIn delay={0.4}>
          <Button onClick={() => setShowShare(true)} variant="gold" size="lg" fullWidth>
            결과 공유하기
          </Button>
        </FadeIn>
      </div>

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        name={selected?.name || ''}
        reportId="daeun"
      />
    </div>
  );
}

// ─── 기간별 카드 (접기/펼치기) ───
function PeriodCard({ period }: { period: DaeunAnalysisResponse['periods'][0] }) {
  const [expanded, setExpanded] = useState(period.isCurrent);
  const scoreColor = period.score >= 75 ? '#C9A96E' : period.score >= 50 ? '#2D8A4E' : '#2D4470';

  return (
    <button onClick={() => setExpanded(!expanded)} className={`w-full text-left card transition-all ${period.isCurrent ? 'ring-2 ring-brand-gold' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: period.isCurrent ? '#C9A96E' : `${scoreColor}15` }}>
            <span className={`text-h3 font-bold ${period.isCurrent ? 'text-white' : ''}`} style={!period.isCurrent ? { color: scoreColor } : {}}>
              {period.간지.charAt(0)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-h3 text-text-primary">{period.간지}</p>
              {period.isCurrent && <span className="badge-gold text-tiny">현재</span>}
            </div>
            <p className="text-caption text-text-muted">{period.시작나이}세 ~ {period.끝나이}세 · {period.theme}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-h3 font-bold" style={{ color: scoreColor }}>{period.score}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`text-text-hint transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="mt-4 space-y-3 text-body-sm text-text-secondary leading-relaxed">
              <div><p className="text-caption text-text-hint mb-0.5">직업/진로</p><p>{period.career}</p></div>
              <div><p className="text-caption text-text-hint mb-0.5">연애/관계</p><p>{period.love}</p></div>
              <div><p className="text-caption text-text-hint mb-0.5">재물</p><p>{period.wealth}</p></div>
              <div><p className="text-caption text-text-hint mb-0.5">건강</p><p>{period.health}</p></div>
              <div className="pt-2 border-t border-border-light">
                <p className="text-caption text-brand-gold font-semibold">{period.advice}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
