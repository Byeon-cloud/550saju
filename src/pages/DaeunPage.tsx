import { useState, useMemo, useRef } from 'react';
import { NeedSaju } from '@/components/hanji/Hanji';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { DaeunTimeline } from '@/components/saju/DaeunTimeline';
import { ShareModal } from '@/components/share/ShareModal';
import { getProfiles, spendBalance, refundBalance, saveReport, generateId, getCachedResult, getReport, markPendingSpend, clearPendingSpendByType, type LocalReport } from '@/services/storage/localStore';
import { lookupCategory } from '@/constants/sipsungColor';
import { generateDaeunAnalysis } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import { FooterCTA } from '@/components/common/FooterCTA';
import type { DaeunAnalysisResponse } from '@/types/report';
import { sanitizeAiText } from '@/utils/format';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';
// Phase D'-4 Bundle 2 (#54) — mockup 진본 시각 정렬
import {
  EXTENSION_THEME,
  ExtensionHero,
  ExtensionUpsellCard,
  DaeunHeatGrid,
  type DaeunHeatRow,
} from './extension/_chrome';

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
  const rawNavState = location.state as { savedResult?: DaeunAnalysisResponse; savedReport?: LocalReport } | undefined;
  // 2026-05-28 — URL ?reportId= 폴백. state 손실(새로고침/strict mode) 대비.
  const [searchParams] = useSearchParams();
  const reportIdFromUrl = searchParams.get('reportId');
  const reportFromUrl = useMemo(() => {
    if (!reportIdFromUrl) return null;
    try { return getReport(reportIdFromUrl); } catch { return null; }
  }, [reportIdFromUrl]);
  const navState = rawNavState?.savedReport
    ? rawNavState
    : (reportFromUrl ? { savedResult: reportFromUrl.aiResult as DaeunAnalysisResponse, savedReport: reportFromUrl } : undefined);

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  const [selected, setSelected] = useState<LocalReport | null>(navState?.savedReport || null);
  const [result, setResult] = useState<DaeunAnalysisResponse | null>(navState?.savedResult || null);
  const [, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);
  // 2026-05-07 fix — 동적 reportId (이전엔 모든 사용자가 /share/daeun 으로 같은 URL)
  const [shareReportId, setShareReportId] = useState<string>(navState?.savedReport?.id || '');
  const isAnalyzingRef = useRef(false);

  const reports = useMemo(() => getProfiles(), []);

  async function startAnalysis() {
    if (!selected) return;
    if (isAnalyzingRef.current || phase === 'loading') return;
    isAnalyzingRef.current = true;

    // 캐시 확인
    const cached = getCachedResult(selected.name, selected.input.birthYear, selected.input.birthMonth, selected.input.birthDay, 'daeun');
    if (cached?.aiResult) {
      setResult(cached.aiResult);
      setPhase('result');
      toast.show('이전 분석 결과를 불러왔어요', 'info');
      isAnalyzingRef.current = false;
      return;
    }

    if (!spendBalance(1)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: '대운 해설에 1운이 필요해요' } });
      isAnalyzingRef.current = false;
      return;
    }

    // 측정 — 운 차감 성공 직후 (C1 · fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'daeun', amount: 1 })).catch(() => {});
    // 2026-06-18 머니세이프 — 생성 중 앱 종료로 결과 못 받으면 부팅 reconcile 이 5분 후 자동환불.
    markPendingSpend('daeun', 1);
    toast.show('1운이 차감됐어요', 'info');
    setPhase('loading');
    setLoadingStep(0);

    const interval = setInterval(() => {
      setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 3000);

    try {
      const res = await generateDaeunAnalysis(selected.sajuData);
      setResult(res.content);
      const rid = res.reportId || generateId();
      saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'daeun', aiResult: res.content, createdAt: new Date().toISOString() });
      clearPendingSpendByType('daeun'); // 결과 저장 완료 → 자동환불 대상 제외
      setShareReportId(rid);
      setPhase('result');
    } catch (e: any) {
      console.error('대운 분석 실패:', e);
      // 2026-05-07 fix — AI 실패 시 클라이언트에서 즉시 환불 (이전엔 환불 거짓말)
      refundBalance(1);
      clearPendingSpendByType('daeun'); // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
      setError('분석에 실패해서 1운을 돌려드렸어요. 잠시 후 다시 시도해주세요.');
      setPhase('select');
      toast.show('분석에 실패해서 1운을 돌려드렸어요', 'warning');
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
          <Header title="대운 해설" />
          <NeedSaju mark="運" desc="10년마다 바뀌는 큰 운을 내 사주로 짚어 드려요. 태어난 날과 시간만 있으면 돼요." onClick={() => navigate('/input?from=home_body_daewoon')} />
        </div>
      );
    }

    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="대운 해설" />
        {/* 2026-05-04 ExtensionHero 통일 (select phase 부터 적용) */}
        <FadeIn>
          <ExtensionHero
            theme={EXTENSION_THEME.daeun}
            sub="10년 단위로 바뀌는 운의 흐름, 직업, 연애, 재물, 건강"
            rightLabel="大運 10년 단위 큰 흐름"
          />
        </FadeIn>
        <div className="px-5 pt-5 space-y-5">

          <FadeIn delay={0.05}>
            <ProfilePicker
              onSelect={(p) => setSelected(p as unknown as LocalReport)}
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
            <Button onClick={startAnalysis} variant="gold" size="lg" fullWidth sub="1운">
              대운 분석하기
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── 로딩 ───
  if (phase === 'loading') {
    return <AILoading name={selected?.name} type="대운 해설" sajuData={selected?.sajuData} steps={['대운 주기를 계산하고 있어요', '각 대운의 오행 관계를 분석하고 있어요', '맞춤 해석을 작성하고 있어요']} />;
  }

  // ─── 결과 ───
  // 2026-05-05 AI 응답 누락·실패 fallback — MonthlyPage sipDist + dayHash 패턴 미러링
  // 빈 화면 방지: result 가 null 이거나 periods 비었을 때 사주 specific fallback
  const clamp100 = (n: number) => Math.max(40, Math.min(95, Math.round(n)));
  const sajuDaeun = selected?.sajuData?.daeun || [];
  const sipsung = (selected?.sajuData as any)?.sipsung || [];
  const sipDist = useMemo(() => {
    const d: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    // lunar 간체 십성(七杀·伤官 등)을 한국어 카테고리와 includes 비교하면 전부 미매칭 → 분포 0.
    //   SSOT lookupCategory(간체·번체·다중'/' 대응)로 카운트 (2026-06-13 fix).
    for (const s of sipsung) {
      for (const part of String(s?.십성 ?? '').split('/')) {
        const cat = lookupCategory(part);
        if (cat) d[cat]++;
      }
    }
    return d;
  }, [sipsung]);

  // AI 결과 없으면 사주 daeun + 십성 분포로 자체 fallback periods 생성
  const fallbackResult: DaeunAnalysisResponse | null = useMemo(() => {
    if (!selected || sajuDaeun.length === 0) return null;
    const dayHan = selected.sajuData?.pillars?.[2]?.천간 || '';
    const dayHash = dayHan.charCodeAt(0) % 7;
    const periodsFb: DaeunAnalysisResponse['periods'] = sajuDaeun.slice(0, 8).map((d, i) => {
      const base = 64 + (i * 3 + dayHash) % 11; // 사주별 미세 분기
      const careerScore = clamp100(base + sipDist.관성 * 3 + sipDist.인성 * 2 - 5 + (i % 4));
      const loveScore = clamp100(base + sipDist.재성 * 3 + sipDist.비겁 * 2 - 4 + ((dayHash + i) % 5));
      const wealthScore = clamp100(base + sipDist.재성 * 4 + sipDist.식상 * 2 - 7 + ((dayHash * 2 + i) % 6));
      const healthScore = clamp100(base + sipDist.인성 * 3 - sipDist.관성 + ((dayHash * 3 + i) % 7));
      const score = clamp100((careerScore + loveScore + wealthScore + healthScore) / 4);
      const ganji = `${d.천간}${d.지지}`;
      const themeText = d.isCurrent
        ? `현재 ${ganji} 대운 — 내 일간(${dayHan})과 ${ganji}의 흐름이 맞물리는 시기`
        : `${ganji} — ${d.시작나이}대의 큰 흐름`;
      return {
        간지: ganji,
        시작나이: d.시작나이,
        끝나이: d.끝나이,
        isCurrent: !!d.isCurrent,
        theme: themeText,
        career: `${ganji} 대운에서 일과 진로의 결은 ${sipDist.관성 >= 2 ? '책임과 자리가 따라오는 흐름' : '스스로 그림을 그려 나가는 흐름'}으로 풀립니다.`,
        love: `관계는 ${sipDist.재성 >= 2 ? '교류의 폭이 자연스럽게 넓어지는 시기' : '깊이를 다지는 시기'} — 내 일간(${dayHan})의 결을 잃지 않는 게 핵심.`,
        wealth: `재물 흐름은 ${sipDist.재성 >= 2 ? '들고 나는 폭이 큰' : '쌓아 가는'} 양상 — ${ganji}의 지지 ${d.지지}가 받쳐주는 자리.`,
        health: `건강은 ${sipDist.인성 >= 2 ? '회복과 정비에 강한' : '꾸준한 관리가 필요한'} 흐름 — 무리한 변화는 한 박자 늦추는 게 좋습니다.`,
        score,
        advice: d.isCurrent
          ? `지금 ${ganji} 대운의 핵심은 "${dayHan}일간의 본 결을 지키며 ${d.지지}의 환경을 받아들이기".`
          : `${ganji} 대운에서는 ${d.시작나이}세 시점의 큰 결정을 미리 그려두는 게 유리.`,
        careerScore,
        loveScore,
        wealthScore,
        healthScore,
      } as any;
    });
    const cur = sajuDaeun.find(d => d.isCurrent);
    return {
      overview: `${selected.name}님의 일간 ${dayHan}을 기준으로 본 8개 대운의 큰 흐름입니다. 각 시기의 점수는 사주 원국과의 합과 충 관계에서 산출된 상대값이며, 현재 대운의 환경을 어떻게 풀어가느냐가 평생의 운을 좌우합니다.`,
      periods: periodsFb,
      currentHighlight: cur
        ? `지금은 ${cur.천간}${cur.지지} 대운(${cur.시작나이}~${cur.끝나이}세) — 일간 ${dayHan}와 ${cur.천간}${cur.지지}의 만남이 만드는 흐름입니다. 이 시기의 환경을 받아들이는 태도가 다음 10년의 결을 결정합니다.`
        : `현재 진행 중인 대운 정보를 확인하세요.`,
      transitionAdvice: `대운 전환기(${cur ? cur.끝나이 : '?'}세 전후)에는 큰 결정을 한 박자 늦추세요. 환경이 바뀌는 자리이므로, 이전 대운의 관성으로 결정한 일은 새 대운에서 어긋나기 쉽습니다.`,
      lifePhaseMap: sajuDaeun.slice(0, 8).map((d, i) => ({
        phase: i < 2 ? '성장기' : i < 4 ? '확장기' : i < 6 ? '안정기' : '결실기',
        daeun: `${d.천간}${d.지지}`,
        theme: d.isCurrent ? '지금 머무는 자리' : `${d.시작나이}대의 흐름`,
      })),
    };
  }, [selected, sajuDaeun, sipDist]);

  if (!result && !fallbackResult) return null;
  const effectiveResult = result || fallbackResult!;

  const periods = effectiveResult.periods || [];

  // Phase D'-4 Bundle 2 — chrome theme + AI heatGrid (over-fit 방지: 응답 있을 때만)
  const daeunTheme = EXTENSION_THEME.daeun;
  const aiHeatGrid: DaeunHeatRow[] | null = Array.isArray((effectiveResult as any)?.heatGrid)
    ? ((effectiveResult as any).heatGrid as DaeunHeatRow[])
    : null;
  const aiHeatYearStart = Number((effectiveResult as any)?.heatYearStart ?? new Date().getFullYear());
  const ilganLabel =
    selected?.sajuData?.pillars?.[2]?.천간
      ? `${selected.sajuData.pillars[2].천간읽기 ?? ''}(${selected.sajuData.pillars[2].천간}) 일간`
      : undefined;
  const birthLabel = selected?.input
    ? `${selected.input.birthYear}년 ${selected.input.birthMonth}월 ${selected.input.birthDay}일`
    : '';

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="대운 해설" />

      {/* Phase D'-4 Bundle 2 — ExtensionHero (외부 Header와 공존) */}
      <FadeIn>
        <ExtensionHero
          theme={daeunTheme}
          sub={`${ilganLabel ?? ''}${birthLabel ? ', ' + birthLabel : ''}`}
          rightLabel="大運 10년 단위 큰 흐름"
        />
      </FadeIn>

      <div className="px-5 pt-4 space-y-5">

        {/* 개요 */}
        <FadeIn>
          {/* 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). */}
          <div className="card py-6 px-5">
            <p className="text-h2 text-text-primary mb-2">{selected?.name}님의 대운 흐름</p>
            {(effectiveResult as any).keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(effectiveResult as any).keywords.map((kw: string, i: number) => (
                  <span key={i} className="text-[13px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(184,150,90,0.1)', color: '#8C6D3D', border: '1px solid rgba(184,150,90,0.2)' }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(effectiveResult.overview) }} />
          </div>
        </FadeIn>

        {/* 대운 점수 흐름 차트 */}
        {periods.length > 0 && (
          <FadeIn delay={0.03}>
            <div className="card">
              <p className="text-h3 text-text-primary mb-1">대운별 점수 흐름</p>
              <p className="text-[12px] text-text-hint mb-3">10년 단위 운의 흐름</p>
              <div className="h-36 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={periods.map((p: any) => ({ name: `${p.시작나이}세`, 점수: p.score || 50 }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="daeunGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B8965A" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#B8965A" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-hint)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-disabled)' }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="점수" stroke="#B8965A" strokeWidth={2}
                      fill="url(#daeunGrad)" dot={{ r: 2.5, fill: '#B8965A', strokeWidth: 0 }} />
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
        {effectiveResult.currentHighlight && (
          <FadeIn delay={0.1}>
            <div className="card-gold py-6 px-5">
              <p className="text-h2 text-text-primary mb-1">지금 이 시기는?</p>
              <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(effectiveResult.currentHighlight) }} />
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
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(effectiveResult.transitionAdvice) }} />
          </div>
        </FadeIn>

        {/* 인생 시기 맵 */}
        {effectiveResult.lifePhaseMap?.length > 0 && (
          <FadeIn delay={0.35}>
            <div className="card">
              <p className="text-h3 text-text-primary mb-4">인생 시기 맵</p>
              <div className="relative">
                {/* 연결선 */}
                <div className="absolute left-[18px] top-4 bottom-4 w-[2px]" style={{ background: 'rgba(184,150,90,0.2)' }} />
                <div className="space-y-4">
                  {effectiveResult.lifePhaseMap.map((lp, i) => {
                    const currentDaeun = selected?.sajuData?.daeun?.find((x: any) => x.isCurrent || x.현재);
                    const isCurrent = currentDaeun && lp.daeun === currentDaeun.간지;
                    return (
                      <div key={i} className="flex items-start gap-3 relative">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${isCurrent ? 'ring-2 ring-offset-2 ring-brand-gold' : ''}`}
                          style={{ background: isCurrent ? '#B8965A' : 'rgba(184,150,90,0.1)' }}>
                          <span className={`text-[13px] font-black ${isCurrent ? 'text-white' : 'text-brand-gold'}`}>{lp.daeun.charAt(0)}</span>
                        </div>
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-bold text-text-primary">{lp.phase}</p>
                            <span className="text-[13px] text-brand-gold font-semibold">{lp.daeun}</span>
                            {isCurrent && <span className="text-[12px] font-bold text-white bg-brand-gold rounded px-1.5 py-0.5">NOW</span>}
                          </div>
                          <p className="text-[13px] text-text-muted mt-0.5" dangerouslySetInnerHTML={{ __html: sanitizeAiText(lp.theme) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </FadeIn>
        )}

        {/* Phase D'-4 Bundle 2 — DaeunHeatGrid (AI 응답 있을 때만, over-fit 방지) */}
        {aiHeatGrid && aiHeatGrid.length > 0 && (
          <FadeIn delay={0.38}>
            <div style={{ margin: '0 -20px' }}>
              <DaeunHeatGrid rows={aiHeatGrid} yearStart={aiHeatYearStart} />
            </div>
          </FadeIn>
        )}

        {/* 공유 */}
        <FadeIn delay={0.4}>
          <Button onClick={() => setShowShare(true)} variant="gold" size="lg" fullWidth>
            결과 공유하기
          </Button>
        </FadeIn>

        {/* Phase D'-4 Bundle 2 — ExtensionUpsellCard (단일 CTA, 작업 0 정렬) */}
        <FadeIn delay={0.42}>
          <ExtensionUpsellCard
            title="사주 전체에서 대운 흐름의 의미를 풀어드립니다"
            desc="대운 8칸이 사주 원국과 어떻게 맞물리는지, 평생의 결까지 한 번에."
            onTap={() => navigate('/charge?need=10')}
          />
        </FadeIn>

        {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) — Phase 누락 보강 2 패턴 */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평, 자평진전, 적천수, 궁통보감, 명리약언, 삼명통회) 기반
          </p>
          <p className="text-[13px] italic" style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
            사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
            <br />
            의료, 법률, 재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
          </p>
        </div>

        {/* 3-part Footer CTA (diff v3 §6) */}
        <FooterCTA pageKey="daeun" backTo="/" />
      </div>

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        name={selected?.name || ''}
        reportId={shareReportId || 'daeun'}
      />
    </div>
  );
}

// ─── 기간별 카드 (접기/펼치기) ───
function PeriodCard({ period }: { period: DaeunAnalysisResponse['periods'][0] }) {
  const [expanded, setExpanded] = useState(period.isCurrent);
  const scoreColor = period.score >= 75 ? '#B8965A' : period.score >= 50 ? '#4E7A57' : '#3A3128';

  return (
    <button onClick={() => setExpanded(!expanded)} className={`w-full text-left card transition-all ${period.isCurrent ? 'ring-2 ring-brand-gold' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: period.isCurrent ? '#B8965A' : `${scoreColor}15` }}>
            <span className={`text-h3 font-bold ${period.isCurrent ? 'text-white' : ''}`} style={!period.isCurrent ? { color: scoreColor } : {}}>
              {period.간지.charAt(0)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-h3 text-text-primary">{period.간지}</p>
              {period.isCurrent && <span className="badge-gold text-tiny">현재</span>}
            </div>
            <p className="text-caption text-text-muted">{period.시작나이}세 ~ {period.끝나이}세, {period.theme}</p>
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
                    { label: '직업', score: (period as any).careerScore, color: '#1A1612' },
                    { label: '연애', score: (period as any).loveScore, color: '#8C6D3D' },
                    { label: '재물', score: (period as any).wealthScore, color: '#B8965A' },
                    { label: '건강', score: (period as any).healthScore, color: '#4E7A57' },
                  ].map(a => (
                    <div key={a.label} className="text-center">
                      <p className="text-[12px] text-text-hint mb-1">{a.label}</p>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${a.color}12` }}>
                        <motion.div className="h-full rounded-full" style={{ background: a.color }}
                          initial={{ width: 0 }} animate={{ width: `${Math.min(a.score || 0, 100)}%` }}
                          transition={{ duration: 0.8 }} />
                      </div>
                      <p className="text-[12px] font-bold mt-0.5" style={{ color: a.color }}>{a.score}</p>
                    </div>
                  ))}
                </div>
              )}
              {[
                { label: '직업/진로', value: period.career, color: '#1A1612' },
                { label: '연애/관계', value: period.love, color: '#8C6D3D' },
                { label: '재물',     value: period.wealth, color: '#B8965A' },
                { label: '건강',     value: period.health, color: '#4E7A57' },
              ].map(area => (
                <div key={area.label}>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[12px] font-bold mb-1"
                    style={{ background: `${area.color}12`, color: area.color }}>{area.label}</span>
                  <p dangerouslySetInnerHTML={{ __html: sanitizeAiText(area.value) }} />
                </div>
              ))}
              <div className="pt-2 border-t border-border-light">
                <p className="text-caption text-brand-gold font-semibold" dangerouslySetInnerHTML={{ __html: sanitizeAiText(period.advice) }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
