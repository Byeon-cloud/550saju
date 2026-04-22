import { useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { MonthlyFortune } from '@/components/saju/MonthlyFortune';

import { ShareModal } from '@/components/share/ShareModal';
import { getProfiles, spendBalance, saveReport, generateId, getCachedResult, type LocalReport } from '@/services/storage/localStore';
import { generateMonthlyFortune2026 } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import { FooterCTA } from '@/components/common/FooterCTA';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import type { MonthlyDetailResponse, MonthlyDetail } from '@/types/report';
import { stripMd } from '@/utils/format';

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
  const location = useLocation();
  const toast = useToast();

  // 보관함에서 저장된 결과를 넘겨받은 경우
  const navState = location.state as { savedResult?: MonthlyDetailResponse; savedReport?: LocalReport } | undefined;

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  const [selected, setSelected] = useState<LocalReport | null>(navState?.savedReport || null);
  const [result, setResult] = useState<MonthlyDetailResponse | null>(navState?.savedResult || null);
  const [, setLoadingStep] = useState(0);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const isAnalyzingRef = useRef(false);

  const reports = useMemo(() => getProfiles(), []);

  async function startAnalysis() {
    if (!selected) return;
    if (isAnalyzingRef.current || phase === 'loading') return;
    isAnalyzingRef.current = true;

    // 캐시 확인
    const cached = getCachedResult(selected.name, selected.input.birthYear, selected.input.birthMonth, selected.input.birthDay, 'monthly');
    if (cached?.aiResult) {
      setResult(cached.aiResult);
      setPhase('result');
      toast.show('이전 분석 결과를 불러왔어요', 'info');
      isAnalyzingRef.current = false;
      return;
    }

    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '월별 운세에 1운이 필요해요' } });
      isAnalyzingRef.current = false;
      return;
    }
    toast.show('1운이 차감됐어요', 'info');
    setPhase('loading');
    setLoadingStep(0);
    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 3000);

    try {
      const res = await generateMonthlyFortune2026(selected.sajuData);
      setResult(res.content);
      saveReport({ id: res.reportId || generateId(), name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'monthly', aiResult: res.content, createdAt: new Date().toISOString() });
      setPhase('result');
    } catch (e: any) {
      console.error('월별 운세 실패:', e);
      // 환불은 서버(Cloud Function) 트랜잭션 롤백에 위임 — 클라이언트 직접 환불 금지 (보안)
      setPhase('select');
      toast.show('분석에 실패했어요. 잔액은 자동으로 복구돼요.', 'warning');
    } finally {
      clearInterval(interval);
      isAnalyzingRef.current = false;
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
            <div className="card py-5 px-5 text-center" style={{ borderTop: '3px solid #B8965A' }}>
              <p className="text-h1 text-text-primary">2026 월별 운세</p>
              <p className="text-body-sm text-text-muted mt-2">올해 12개월, 좋은 달과 조심할 달을 한눈에</p>
              <p className="text-caption text-text-hint mt-1">매월 직업 · 연애 · 재물 운세 + 럭키 아이템</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.05}>
            <ProfilePicker onSelect={p => setSelected(p as unknown as LocalReport)} onNew={() => navigate('/input?new=1')} title="누구의 월별 운세를 볼까요?" />
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
          <div className="card py-6 px-5" style={{ borderLeft: '4px solid #B8965A' }}>
            <p className="text-h2 text-text-primary mb-2">{selected?.name}님의 2026년</p>
            {(result as any).keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(result as any).keywords.map((kw: string, i: number) => (
                  <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(184,150,90,0.1)', color: '#A08B6A', border: '1px solid rgba(184,150,90,0.2)' }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{stripMd(result.yearOverview)}</p>
          </div>
        </FadeIn>

        {/* 12개월 한눈에 보기 — 도트 히트맵 */}
        <FadeIn delay={0.03}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">한눈에 보는 12개월</p>
            <div className="grid grid-cols-6 gap-2">
              {result.months.map((m) => {
                const dotColor = m.score >= 80 ? '#B8965A' : m.score >= 60 ? '#2D8A4E' : m.score >= 40 ? '#A08B6A' : '#D32F2F';
                const opacity = Math.max(0.3, m.score / 100);
                const isBest = m.month === result.bestMonth;
                const isWorst = m.month === result.worstMonth;
                return (
                  <div key={m.month} className="flex flex-col items-center gap-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isBest ? 'ring-2 ring-offset-1 ring-brand-gold' : ''} ${isWorst ? 'ring-2 ring-offset-1 ring-func-danger' : ''}`}
                      style={{ background: dotColor, opacity }}>
                      <span className="text-[10px] font-black text-white">{m.score}</span>
                    </div>
                    <span className="text-[9px] text-text-hint">{m.month}월</span>
                    {isBest && <span className="text-[8px] text-brand-gold font-bold">BEST</span>}
                    {isWorst && <span className="text-[8px] text-func-danger font-bold">주의</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>

        {/* 흐름 차트 */}
        <FadeIn delay={0.05}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">월별 운세 흐름</p>
            <p className="text-[10px] text-text-hint mb-3">12개월 점수 추이</p>
            <div className="h-36 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.map(d => ({ name: `${d.month}월`, 점수: d.score }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="monthlyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B8965A" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#B8965A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-hint)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-disabled)' }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="점수" stroke="#B8965A" strokeWidth={2}
                    fill="url(#monthlyGrad)"
                    dot={{ r: 2.5, fill: '#B8965A', strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: '#B8965A', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeIn>

        {/* 바 차트 */}
        <FadeIn delay={0.08}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-4">월별 점수 비교</p>
            <MonthlyFortune data={chartData} />
          </div>
        </FadeIn>

        {/* 최고/최악 달 */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 gap-3">
            {bestMonth && (
              <div className="card-gold py-4 px-4 text-center">
                <div className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center"
                  style={{ background: 'rgba(184,150,90,0.15)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#B8965A" stroke="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" />
                  </svg>
                </div>
                <p className="text-caption text-text-muted">최고의 달</p>
                <p className="text-display text-brand-gold">{bestMonth.month}월</p>
                <p className="text-caption text-text-secondary mt-1">{bestMonth.theme}</p>
              </div>
            )}
            {worstMonth && (
              <div className="card py-4 px-4 text-center border-2 border-func-danger/20">
                <div className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center"
                  style={{ background: 'rgba(211,47,47,0.08)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" strokeWidth="2">
                    <path d="M12 9v4m0 4h.01M12 2L2 22h20L12 2z" />
                  </svg>
                </div>
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

        {/* 3-part Footer CTA (diff v3 §6) */}
        <FooterCTA pageKey="monthly" backTo="/" />
      </div>

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} name={selected?.name || ''} reportId="monthly" />
    </div>
  );
}

function MonthCard({ month: m, expanded, onToggle }: { month: MonthlyDetail; expanded: boolean; onToggle: () => void }) {
  const scoreColor = m.score >= 80 ? '#B8965A' : m.score >= 60 ? '#2D8A4E' : m.score >= 40 ? '#2D4470' : '#D32F2F';

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
              <p className="leading-relaxed">{stripMd(m.advice)}</p>
              {/* 3분야 점수 바 */}
              {(m as any).careerScore != null && (
                <div className="grid grid-cols-3 gap-3 mb-1">
                  {[
                    { label: '직업운', score: (m as any).careerScore, color: '#1565C0' },
                    { label: '애정운', score: (m as any).loveScore, color: '#E91E63' },
                    { label: '재물운', score: (m as any).wealthScore, color: '#B8965A' },
                  ].map(a => (
                    <div key={a.label} className="text-center">
                      <p className="text-[9px] text-text-hint mb-1">{a.label}</p>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${a.color}12` }}>
                        <motion.div className="h-full rounded-full" style={{ background: a.color }}
                          initial={{ width: 0 }} animate={{ width: `${Math.min(a.score || 0, 100)}%` }}
                          transition={{ duration: 0.6 }} />
                      </div>
                      <p className="text-[10px] font-bold mt-0.5" style={{ color: a.color }}>{a.score}</p>
                    </div>
                  ))}
                </div>
              )}
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
                  <p className="text-caption text-func-danger font-semibold">{stripMd(m.caution)}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
