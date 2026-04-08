import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { TojungMonthCard } from '@/components/saju/TojungMonthCard';
import { ShareModal } from '@/components/share/ShareModal';
import { getReports, spendBalance, type LocalReport } from '@/services/storage/localStore';
import { generateTojungBigyeol } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { TojungResponse } from '@/types/report';

type Phase = 'select' | 'loading' | 'result';

const LOADING_STEPS = [
  '올해의 상괘를 뽑고 있어요...',
  '월별 괘를 배치하고 있어요...',
  '전통 해석을 현대어로 풀고 있어요...',
  '개운 조언을 작성하고 있어요...',
];

const CATEGORY_ICONS: Record<string, string> = {
  총운: '☰', 금전운: '💰', 건강운: '💪', 직장운: '💼', 애정운: '💕', 결혼운: '💍',
};

export function TojungPage() {
  usePageTitle('토정비결');
  const navigate = useNavigate();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('select');
  const [selected, setSelected] = useState<LocalReport | null>(null);
  const [result, setResult] = useState<TojungResponse | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showShare, setShowShare] = useState(false);

  const reports = useMemo(() => getReports(), []);

  async function startAnalysis() {
    if (!selected) return;
    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '토정비결에 1운이 필요해요' } });
      return;
    }
    toast.show('1운이 차감됐어요', 'info');
    setPhase('loading');
    setLoadingStep(0);
    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 3000);

    try {
      const res = await generateTojungBigyeol(selected.sajuData);
      setResult(res.content);
      setPhase('result');
    } catch (e: any) {
      console.error('토정비결 실패:', e);
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
          <Header title="토정비결" />
          <div className="px-5 pt-8 text-center space-y-4">
            <p className="text-h2 text-text-primary">먼저 사주를 분석해주세요</p>
            <p className="text-body-sm text-text-muted">사주 데이터가 있어야 토정비결을 볼 수 있어요.</p>
            <Button onClick={() => navigate('/input')} variant="gold" size="lg" fullWidth>사주 분석하러 가기</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="토정비결" />
        <div className="px-5 pt-4 space-y-5">
          <FadeIn>
            <div className="py-6 px-5 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(201,169,110,0.2)' }}>
              <p className="text-caption text-brand-gold font-semibold">조선시대 이토정 선생의 전통 운세법</p>
              <p className="text-display text-text-primary mt-1">2026년 토정비결</p>
              <p className="text-body-sm text-text-muted mt-2">주역 64괘로 올해 12개월의 운세를 풀어드려요</p>
              <p className="text-caption text-text-hint mt-1">총운 · 금전 · 건강 · 직장 · 애정 · 결혼</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.05}>
            <ProfilePicker onSelect={r => setSelected(r)} onNew={() => navigate('/input?new=1')} title="누구의 토정비결을 볼까요?" />
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
            <Button onClick={startAnalysis} variant="gold" size="lg" fullWidth>토정비결 보기 (1운)</Button>
          </div>
        )}
      </div>
    );
  }

  // ─── 로딩 ───
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)' }}>
        <motion.div className="w-16 h-16 rounded-full border-3 border-border-light border-t-brand-gold mb-6"
          animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />
        <AnimatePresence mode="wait">
          <motion.p key={loadingStep} className="text-h3 text-text-primary"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {LOADING_STEPS[loadingStep]}
          </motion.p>
        </AnimatePresence>
        <p className="text-caption text-text-muted mt-2">{selected?.name}님의 토정비결을 작성하고 있어요</p>
      </div>
    );
  }

  // ─── 결과 ───
  if (!result) return null;

  const categories = Object.entries(result.yearOverview) as [string, string][];

  return (
    <div className="min-h-screen pb-20" style={{ background: 'linear-gradient(180deg, #F5F0E8 0%, #FFFFFF 30%)' }}>
      <Header title="토정비결" />
      <div className="px-5 pt-4 space-y-5">

        {/* 헤더 */}
        <FadeIn>
          <div className="text-center py-4">
            <p className="text-caption text-brand-gold font-semibold">2026년 토정비결</p>
            <p className="text-display text-text-primary">{selected?.name}님</p>
          </div>
        </FadeIn>

        {/* 6대 카테고리 그리드 */}
        <FadeIn delay={0.05}>
          <div className="grid grid-cols-2 gap-3">
            {categories.map(([key, value], i) => (
              <motion.div
                key={key}
                className="card py-4 px-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{CATEGORY_ICONS[key] || '☰'}</span>
                  <p className="text-label text-text-primary font-bold">{key}</p>
                </div>
                <p className="text-caption text-text-secondary leading-relaxed">{value}</p>
              </motion.div>
            ))}
          </div>
        </FadeIn>

        {/* 12개월 상세 */}
        <FadeIn delay={0.3}>
          <p className="text-h2 text-text-primary">월별 토정비결</p>
          <p className="text-caption text-text-muted">각 달을 눌러 전통 괘와 현대어 풀이를 확인하세요</p>
        </FadeIn>

        <div className="space-y-3">
          {result.months.map((m, i) => (
            <TojungMonthCard
              key={m.month}
              month={m.month}
              괘={m.괘}
              괘의미={m.괘의미}
              전통해석={m.전통해석}
              현대해석={m.현대해석}
              score={m.score}
              keyword={m.keyword}
              delay={0.35 + i * 0.03}
            />
          ))}
        </div>

        {/* 개운 조언 */}
        <FadeIn delay={0.7}>
          <div className="py-5 px-5 rounded-2xl" style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.15)' }}>
            <p className="text-h3 text-text-primary mb-2">올해의 개운 조언</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{result.luckyAdvice}</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.75}>
          <Button onClick={() => setShowShare(true)} variant="gold" size="lg" fullWidth>결과 공유하기</Button>
        </FadeIn>
      </div>

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} name={selected?.name || ''} reportId="tojung" />
    </div>
  );
}
