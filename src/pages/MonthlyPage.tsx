import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { MonthlyFortune } from '@/components/saju/MonthlyFortune';

import { ShareModal } from '@/components/share/ShareModal';
import { getReports, spendBalance, saveReport, generateId, type LocalReport } from '@/services/storage/localStore';
import { generateMonthlyFortune2026 } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import type { MonthlyDetailResponse, MonthlyDetail } from '@/types/report';

type Phase = 'select' | 'loading' | 'result';

const LOADING_STEPS = [
  '2026년 세운을 분석하고 있어요...',
  '월별 천간·지지를 대조하고 있어요...',
  '매월 운세 점수를 계산하고 있어요...',
  '맞춤 조언을 작성하고 있어요...',
];

export function MonthlyPage() {
  usePageTitle('2026 월별 운세');
  const navigate = useNavigate();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('select');
  const [selected, setSelected] = useState<LocalReport | null>(null);
  const [result, setResult] = useState<MonthlyDetailResponse | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);

  const reports = useMemo(() => getReports(), []);

  async function startAnalysis() {
    if (!selected) return;
    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '월별 운세에 1운이 필요해요' } });
      return;
    }
    toast.show('1운이 차감됐어요', 'info');
    setPhase('loading');
    setLoadingStep(0);
    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 3000);

    try {
      const res = await generateMonthlyFortune2026(selected.sajuData);
      setResult(res.content);
      saveReport({ id: res.reportId || generateId(), name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'monthly', createdAt: new Date().toISOString() });
      setPhase('result');
    } catch (e: any) {
      console.error('월별 운세 실패:', e);
      const { addRewardBalance } = await import('@/services/storage/localStore');
      addRewardBalance(1);
      setPhase('select');
      toast.show('분석 실패 — 1운이 환불됐어요', 'warning');
    } finally {
      clearInterval(interval);
    }
  }

  // ─── 프로필 선택 ───
  if (phase === 'select') {
    if (reports.length === 0) {
      return (
        <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
          <Header title="2026 월별 운세" />
          <div className="px-5 pt-8 text-center space-y-4">
            <p className="text-h2 text-text-primary">먼저 사주를 분석해주세요</p>
            <p className="text-body-sm text-text-muted">사주 데이터가 있어야 월별 운세를 볼 수 있어요.</p>
            <Button onClick={() => navigate('/input')} variant="gold" size="lg" fullWidth>사주 분석하러 가기</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="2026 월별 운세" />
        <div className="px-5 pt-4 space-y-5">
          <FadeIn>
            <div className="card-navy py-5 px-5 text-center">
              <p className="text-h1 text-white">2026 월별 운세</p>
              <p className="text-body-sm text-white/60 mt-2">올해 12개월, 좋은 달과 조심할 달을 한눈에</p>
              <p className="text-caption text-white/40 mt-1">매월 직업 · 연애 · 재물 운세 + 럭키 아이템</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.05}>
            <ProfilePicker onSelect={r => setSelected(r)} onNew={() => navigate('/input?new=1')} title="누구의 월별 운세를 볼까요?" />
          </FadeIn>
          {selected && (
            <FadeIn delay={0.1}>
              <div className="card-gold py-3 px-4 flex items-center justify-between">
                <p className="text-body-sm text-text-primary"><span className="font-bold">{selected.name}</span>님 선택됨</p>
                <button onClick={() => setSelected(null)} className="text-caption text-text-muted">변경</button>
              </div>
            </FadeIn>
          )}
        </div>
        {selected && (
          <div className="sticky-cta-bottom">
            <Button onClick={startAnalysis} variant="gold" size="lg" fullWidth>월별 운세 보기 (1운)</Button>
          </div>
        )}
      </div>
    );
  }

  // ─── 로딩 ───
  if (phase === 'loading') {
    return <AILoading name={selected?.name} type="월별 운세" steps={['2026년 세운을 분석하고 있어요', '월별 운세 점수를 계산하고 있어요', '맞춤 조언을 작성하고 있어요']} />;
  }

  // ─── 결과 ───
  if (!result) return null;

  const bestMonth = result.months.find(m => m.month === result.bestMonth);
  const worstMonth = result.months.find(m => m.month === result.worstMonth);
  const chartData = result.months.map(m => ({ month: m.month, score: m.score }));

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="2026 월별 운세" />
      <div className="px-5 pt-4 space-y-5">

        {/* 연간 개요 */}
        <FadeIn>
          <div className="card-navy py-6 px-5">
            <p className="text-h2 text-white mb-1">{selected?.name}님의 2026년</p>
            <p className="text-body-sm text-white/70 leading-relaxed whitespace-pre-line">{result.yearOverview}</p>
          </div>
        </FadeIn>

        {/* 바 차트 */}
        <FadeIn delay={0.05}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-4">월별 운세 점수</p>
            <MonthlyFortune data={chartData} />
          </div>
        </FadeIn>

        {/* 최고/최악 달 */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 gap-3">
            {bestMonth && (
              <div className="card-gold py-4 px-4 text-center">
                <p className="text-caption text-text-muted">최고의 달</p>
                <p className="text-display text-brand-gold">{bestMonth.month}월</p>
                <p className="text-caption text-text-secondary mt-1">{bestMonth.theme}</p>
              </div>
            )}
            {worstMonth && (
              <div className="card py-4 px-4 text-center border-2 border-func-danger/20">
                <p className="text-caption text-text-muted">조심할 달</p>
                <p className="text-display text-func-danger">{worstMonth.month}월</p>
                <p className="text-caption text-text-secondary mt-1">{worstMonth.theme}</p>
              </div>
            )}
          </div>
        </FadeIn>

        {/* 12개월 상세 */}
        <FadeIn delay={0.15}>
          <p className="text-h2 text-text-primary">월별 상세 분석</p>
        </FadeIn>
        {result.months.map((m, i) => (
          <FadeIn key={m.month} delay={0.2 + i * 0.02}>
            <MonthCard month={m} expanded={expandedMonth === m.month} onToggle={() => setExpandedMonth(expandedMonth === m.month ? null : m.month)} />
          </FadeIn>
        ))}

        <FadeIn delay={0.5}>
          <Button onClick={() => setShowShare(true)} variant="gold" size="lg" fullWidth>결과 공유하기</Button>
        </FadeIn>
      </div>

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} name={selected?.name || ''} reportId="monthly" />
    </div>
  );
}

function MonthCard({ month: m, expanded, onToggle }: { month: MonthlyDetail; expanded: boolean; onToggle: () => void }) {
  const scoreColor = m.score >= 80 ? '#C9A96E' : m.score >= 60 ? '#2D8A4E' : m.score >= 40 ? '#2D4470' : '#D32F2F';

  return (
    <button onClick={onToggle} className="w-full text-left card transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${scoreColor}12` }}>
            <span className="text-h2 font-black" style={{ color: scoreColor }}>{m.month}</span>
          </div>
          <div>
            <p className="text-h3 text-text-primary">{m.month}월 · {m.theme}</p>
            <p className="text-caption text-text-muted">{m.career}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-h3 font-bold" style={{ color: scoreColor }}>{m.score}</span>
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
            <div className="mt-4 space-y-3 text-body-sm text-text-secondary">
              <p className="leading-relaxed">{m.advice}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center py-2 rounded-lg bg-bg-surface"><p className="text-caption text-text-hint">직업운</p><p className="text-caption font-semibold text-text-primary mt-0.5">{m.career}</p></div>
                <div className="text-center py-2 rounded-lg bg-bg-surface"><p className="text-caption text-text-hint">애정운</p><p className="text-caption font-semibold text-text-primary mt-0.5">{m.love}</p></div>
                <div className="text-center py-2 rounded-lg bg-bg-surface"><p className="text-caption text-text-hint">재물운</p><p className="text-caption font-semibold text-text-primary mt-0.5">{m.wealth}</p></div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 py-2 px-3 rounded-lg bg-bg-surface">
                  <p className="text-caption text-text-hint">행운의 날</p>
                  <p className="text-caption font-semibold text-brand-gold">{m.luckyDay}</p>
                </div>
                <div className="flex-1 py-2 px-3 rounded-lg bg-bg-surface">
                  <p className="text-caption text-text-hint">럭키 아이템</p>
                  <p className="text-caption font-semibold text-brand-gold">{m.luckyItem}</p>
                </div>
              </div>
              {m.caution && (
                <div className="py-2 px-3 rounded-lg" style={{ background: 'rgba(211,47,47,0.05)' }}>
                  <p className="text-caption text-func-danger font-semibold">{m.caution}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
