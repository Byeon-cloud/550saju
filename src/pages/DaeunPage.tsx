import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { DaeunTimeline } from '@/components/saju/DaeunTimeline';
import { ShareModal } from '@/components/share/ShareModal';
import { getReports, spendBalance, saveReport, generateId, getCachedResult, type LocalReport } from '@/services/storage/localStore';
import { generateDaeunAnalysis } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import type { DaeunAnalysisResponse } from '@/types/report';
import { stripMd } from '@/utils/format';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

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
  const location = useLocation();
  const toast = useToast();

  // 보관함에서 저장된 결과를 넘겨받은 경우
  const navState = location.state as { savedResult?: DaeunAnalysisResponse; savedReport?: LocalReport } | undefined;

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  const [selected, setSelected] = useState<LocalReport | null>(navState?.savedReport || null);
  const [result, setResult] = useState<DaeunAnalysisResponse | null>(navState?.savedResult || null);
  const [, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);

  const reports = useMemo(() => getReports(), []);

  async function startAnalysis() {
    if (!selected) return;

    // 캐시 확인
    const cached = getCachedResult(selected.name, selected.input.birthYear, selected.input.birthMonth, selected.input.birthDay, 'daeun');
    if (cached?.aiResult) {
      setResult(cached.aiResult);
      setPhase('result');
      toast.show('이전 분석 결과를 불러왔어요', 'info');
      return;
    }

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
      saveReport({ id: res.reportId || generateId(), name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'daeun', aiResult: res.content, createdAt: new Date().toISOString() });
      setPhase('result');
    } catch (e: any) {
      console.error('대운 분석 실패:', e);
      // 환불은 서버(Cloud Function) 트랜잭션 롤백에 위임 — 클라이언트 직접 환불 금지 (보안)
      setError('분석에 실패했어요. 잔액은 자동으로 복구돼요.');
      setPhase('select');
      toast.show('분석에 실패했어요. 잔액은 자동으로 복구돼요.', 'warning');
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
            <div className="card py-5 px-5 text-center" style={{ borderTop: '3px solid #C9A96E' }}>
              <p className="text-h1 text-text-primary">대운(大運) 해설</p>
              <p className="text-body-sm text-text-muted mt-2">10년 단위로 바뀌는 운의 흐름을 읽어드려요</p>
              <p className="text-caption text-text-hint mt-1">직업 · 연애 · 재물 · 건강 기간별 상세 분석</p>
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
    return <AILoading name={selected?.name} type="대운 해설" steps={['대운 주기를 계산하고 있어요', '각 대운의 오행 관계를 분석하고 있어요', '맞춤 해석을 작성하고 있어요']} />;
  }

  // ─── 결과 ───
  if (!result) return null;

  const periods = result.periods || [];

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="대운 해설" />
      <div className="px-5 pt-4 space-y-5">

        {/* 개요 */}
        <FadeIn>
          <div className="card py-6 px-5" style={{ borderLeft: '4px solid #C9A96E' }}>
            <p className="text-h2 text-text-primary mb-2">{selected?.name}님의 대운 흐름</p>
            {(result as any).keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(result as any).keywords.map((kw: string, i: number) => (
                  <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(201,169,110,0.1)', color: '#A08B6A', border: '1px solid rgba(201,169,110,0.2)' }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{stripMd(result.overview)}</p>
          </div>
        </FadeIn>

        {/* 대운 점수 흐름 차트 */}
        {periods.length > 0 && (
          <FadeIn delay={0.03}>
            <div className="card">
              <p className="text-h3 text-text-primary mb-1">대운별 점수 흐름</p>
              <p className="text-[10px] text-text-hint mb-3">10년 단위 운의 흐름</p>
              <div className="h-36 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={periods.map((p: any) => ({ name: `${p.시작나이}세`, 점수: p.score || 50 }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="daeunGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C9A96E" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#C9A96E" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-hint)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-disabled)' }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="점수" stroke="#C9A96E" strokeWidth={2}
                      fill="url(#daeunGrad)" dot={{ r: 2.5, fill: '#C9A96E', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FadeIn>
        )}

        {/* 타임라인 */}
        {selected?.sajuData?.daeun && (
          <FadeIn delay={0.05}>
            <div className="card">
              <p className="text-h3 text-text-primary mb-4">대운 타임라인</p>
              <DaeunTimeline daeunList={selected.sajuData.daeun} />
            </div>
          </FadeIn>
        )}

        {/* 현재 대운 하이라이트 */}
        {result.currentHighlight && (
          <FadeIn delay={0.1}>
            <div className="card-gold py-6 px-5">
              <p className="text-h2 text-text-primary mb-1">지금 이 시기는?</p>
              <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{stripMd(result.currentHighlight)}</p>
            </div>
          </FadeIn>
        )}

        {/* 기간별 상세 */}
        {periods.length > 0 && (
          <FadeIn delay={0.15}>
            <p className="text-h2 text-text-primary">기간별 상세 분석</p>
          </FadeIn>
        )}
        {periods.map((period, i) => (
          <FadeIn key={period.간지} delay={0.2 + i * 0.03}>
            <PeriodCard period={period} />
          </FadeIn>
        ))}

        {/* 전환기 조언 */}
        <FadeIn delay={0.3}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-2">대운 전환기 조언</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line">{stripMd(result.transitionAdvice)}</p>
          </div>
        </FadeIn>

        {/* 인생 시기 맵 */}
        {result.lifePhaseMap?.length > 0 && (
          <FadeIn delay={0.35}>
            <div className="card">
              <p className="text-h3 text-text-primary mb-4">인생 시기 맵</p>
              <div className="relative">
                {/* 연결선 */}
                <div className="absolute left-[18px] top-4 bottom-4 w-[2px]" style={{ background: 'rgba(201,169,110,0.2)' }} />
                <div className="space-y-4">
                  {result.lifePhaseMap.map((lp, i) => {
                    const currentDaeun = selected?.sajuData?.daeun?.find((x: any) => x.isCurrent || x.현재);
                    const isCurrent = currentDaeun && lp.daeun === currentDaeun.간지;
                    return (
                      <div key={i} className="flex items-start gap-3 relative">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${isCurrent ? 'ring-2 ring-offset-2' : ''}`}
                          style={{ background: isCurrent ? '#C9A96E' : 'rgba(201,169,110,0.1)', ringColor: '#C9A96E' }}>
                          <span className={`text-[11px] font-black ${isCurrent ? 'text-white' : 'text-brand-gold'}`}>{lp.daeun.charAt(0)}</span>
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-bold text-text-primary">{lp.phase}</p>
                            <span className="text-[11px] text-brand-gold font-semibold">{lp.daeun}</span>
                            {isCurrent && <span className="text-[9px] font-bold text-white bg-brand-gold rounded px-1.5 py-0.5">NOW</span>}
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">{stripMd(lp.theme)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-1.5 rounded-full bg-border-light overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${period.score}%`, background: scoreColor }} />
            </div>
            <span className="text-label font-bold" style={{ color: scoreColor }}>{period.score}</span>
          </div>
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
              {/* 4분야 점수 바 */}
              {(period as any).careerScore != null && (
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[
                    { label: '직업', score: (period as any).careerScore, color: '#1B2A4A' },
                    { label: '연애', score: (period as any).loveScore, color: '#E91E63' },
                    { label: '재물', score: (period as any).wealthScore, color: '#C9A96E' },
                    { label: '건강', score: (period as any).healthScore, color: '#2D8A4E' },
                  ].map(a => (
                    <div key={a.label} className="text-center">
                      <p className="text-[9px] text-text-hint mb-1">{a.label}</p>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${a.color}12` }}>
                        <motion.div className="h-full rounded-full" style={{ background: a.color }}
                          initial={{ width: 0 }} animate={{ width: `${Math.min(a.score || 0, 100)}%` }}
                          transition={{ duration: 0.8 }} />
                      </div>
                      <p className="text-[10px] font-bold mt-0.5" style={{ color: a.color }}>{a.score}</p>
                    </div>
                  ))}
                </div>
              )}
              {[
                { label: '직업/진로', value: period.career, color: '#1B2A4A' },
                { label: '연애/관계', value: period.love, color: '#E91E63' },
                { label: '재물',     value: period.wealth, color: '#C9A96E' },
                { label: '건강',     value: period.health, color: '#2D8A4E' },
              ].map(area => (
                <div key={area.label}>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mb-1"
                    style={{ background: `${area.color}12`, color: area.color }}>{area.label}</span>
                  <p>{stripMd(area.value)}</p>
                </div>
              ))}
              <div className="pt-2 border-t border-border-light">
                <p className="text-caption text-brand-gold font-semibold">{stripMd(period.advice)}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
