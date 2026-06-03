import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getReport } from '@/services/storage/localStore';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { CompatProfilePair } from '@/components/saju/CompatProfilePair';
import { CompatScoreBar } from '@/components/saju/CompatScoreBar';
import { ShareModal } from '@/components/share/ShareModal';
import { generateCompatibilityAnalysis } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import { FooterCTA } from '@/components/common/FooterCTA';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import type { CompatibilityResponse } from '@/types/report';
import { sanitizeAiText } from '@/utils/format';
import { OHENG_MAP } from '@/constants/oheng';
// Phase D'-4 Bundle 2 후속 (#54) — mockup 진본 시각 정렬 (CompatResultPage)
import {
  EXTENSION_THEME,
  ExtensionHero,
  ExtensionUpsellCard,
  CompatTimeline,
  type CompatTimelineStep,
} from './extension/_chrome';

const LOADING_STEPS = [
  '두 사람의 오행을 비교하고 있어요...',
  '일간 관계를 분석하고 있어요...',
  '십성 교차 분석 중...',
  '궁합 점수를 계산하고 있어요...',
  '맞춤 조언을 작성하고 있어요...',
];

// 2026-05-05 SSOT — 수오행 컬러는 OHENG_MAP['수'].color (constants/oheng.ts) 에서 직접 호출
const CATEGORY_COLORS: Record<string, string> = {
  personality: '#B8965A',
  values: '#2D8A4E',
  communication: OHENG_MAP['수'].color,
  emotion: '#D32F2F',
  future: '#7B1FA2',
};

export function CompatResultPage() {
  usePageTitle('궁합 결과');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // 2026-05-07 — 진입 경로 2가지:
  //  (1) /compat 에서 입력 후: { person1, person2, relation }
  //  (2) /storage 에서 클릭 시 (재열람): { savedResult, savedReport }
  const rawLocationState = location.state as
    | { person1: any; person2: any; relation: string }
    | { savedResult: CompatibilityResponse; savedReport: any }
    | undefined;
  // 2026-05-28 — URL ?reportId= 폴백. state 손실(새로고침/strict mode) 대비.
  const [searchParams] = useSearchParams();
  const reportIdFromUrl = searchParams.get('reportId');
  const reportFromUrl = useMemo(() => {
    if (!reportIdFromUrl) return null;
    try { return getReport(reportIdFromUrl); } catch { return null; }
  }, [reportIdFromUrl]);
  const rawState = rawLocationState
    ? rawLocationState
    : (reportFromUrl ? { savedResult: reportFromUrl.aiResult as CompatibilityResponse, savedReport: reportFromUrl as any } : undefined);
  const isReplay = !!rawState && 'savedResult' in rawState && 'savedReport' in rawState;
  const replayReport = isReplay ? (rawState as any).savedReport : null;
  const replayPartner = replayReport?.partner; // saveReport 시 보존한 partner 정보
  const state = isReplay
    ? {
        person1: { name: replayReport?.name?.split(' × ')?.[0] || '나', sajuData: replayReport?.sajuData, input: replayReport?.input },
        person2: replayPartner || { name: replayReport?.name?.split(' × ')?.[1] || '상대', sajuData: replayReport?.sajuData, input: replayReport?.input },
        relation: replayReport?.relation || '연인',
      }
    : (rawState as { person1: any; person2: any; relation: string } | undefined);

  const [phase, setPhase] = useState<'loading' | 'result'>(isReplay ? 'result' : 'loading');
  const [result, setResult] = useState<CompatibilityResponse | null>(
    isReplay ? ((rawState as any).savedResult as CompatibilityResponse) : null,
  );
  const [, setLoadingStep] = useState(0);
  const [showShare, setShowShare] = useState(false);
  // 2026-05-07 fix — 동적 reportId
  const [shareReportId, setShareReportId] = useState<string>(replayReport?.id || '');
  const called = useRef(isReplay);

  useEffect(() => {
    if (isReplay) return; // 재열람은 AI 호출 skip
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
    ).then(async (res) => {
      setResult(res.content);
      const { saveReport, generateId } = await import('@/services/storage/localStore');
      const rid = res.reportId || generateId();
      saveReport({
        id: rid,
        name: `${state!.person1.name} × ${state!.person2.name}`,
        input: { ...state!.person1.input, relation: 'compat' } as any,
        sajuData: state!.person1.sajuData,
        type: 'paid',
        contentType: 'compat',
        aiResult: res.content,
        ...({ partner: { name: state!.person2.name, sajuData: state!.person2.sajuData, input: state!.person2.input }, relation: state!.relation } as any),
        createdAt: new Date().toISOString(),
      });
      setShareReportId(rid);
      setPhase('result');
    }).catch(async (e) => {
      console.error('궁합 분석 실패:', e);
      // 2026-05-07 fix — AI 실패 시 클라이언트에서 즉시 환불
      const { refundBalance } = await import('@/services/storage/localStore');
      refundBalance(1);
      const errMsg = e?.message || '알 수 없는 오류';
      toast.show(`분석에 실패해서 1운을 돌려드렸어요 (${errMsg})`, 'warning');
      setTimeout(() => navigate('/compat'), 3000);
    }).finally(() => clearInterval(interval));
  }, []);

  if (!state) return null;

  // ─── 로딩 ───
  if (phase === 'loading') {
    return <AILoading name={`${state.person1.name} × ${state.person2.name}`} type="궁합 분석" sajuData={state.person1?.sajuData} steps={['두 사람의 오행을 비교하고 있어요', '십성 관계를 분석하고 있어요', '궁합 점수를 계산하고 있어요']} />;
  }

  // ─── 결과 ───
  if (!result) return null;

  // Phase D'-4 후속 — chrome theme + AI timeline (over-fit 방지)
  const compatTheme = EXTENSION_THEME.compat;
  const aiTimeline: CompatTimelineStep[] | null = Array.isArray((result as any)?.timeline)
    ? ((result as any).timeline as CompatTimelineStep[])
    : null;

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="궁합 결과" />

      {/* Phase D'-4 후속 — ExtensionHero (合 인장 + 자주 그라디언트) */}
      <FadeIn>
        <ExtensionHero
          theme={compatTheme}
          crumb="사주 500 · 더 알아볼 주제 · 궁합"
          sub={`${state.person1.name} × ${state.person2.name} · ${state.relation}`}
          seal="合"
        />
      </FadeIn>

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

        {/* 키워드 + 관계유형 */}
        <FadeIn delay={0.03}>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {(result as any).relationshipType && (
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-full text-white"
                style={{ background: '#B8965A' }}>
                {(result as any).relationshipType}
              </span>
            )}
            {(result as any).keywords?.map((kw: string, i: number) => (
              <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(184,150,90,0.1)', color: '#8C6D3D', border: '1px solid rgba(184,150,90,0.2)' }}>
                {kw}
              </span>
            ))}
          </div>
        </FadeIn>

        {/* 총평 */}
        <FadeIn delay={0.05}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-2">궁합 총평</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.summary) }} />
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
            <p className="text-body-sm text-text-secondary leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.ohengHarmony.description) }} />
          </div>
        </FadeIn>

        {/* 카테고리별 점수 — 레이더 차트 + 상세 바 */}
        <FadeIn delay={0.15}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-4">카테고리별 궁합</p>

            {/* 레이더 차트 */}
            <div className="h-52 -mx-2 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={result.categories.map(cat => ({
                  name: cat.name,
                  점수: cat.score,
                  fullMark: 100,
                }))}>
                  <PolarGrid strokeOpacity={0.15} />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <Radar dataKey="점수" stroke="#B8965A" fill="#B8965A" fillOpacity={0.2} strokeWidth={2}
                    dot={{ r: 3, fill: '#B8965A', strokeWidth: 0 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 상세 바 */}
            <div className="space-y-4 border-t border-border-light pt-4">
              {result.categories.map((cat, i) => (
                <div key={cat.id}>
                  <CompatScoreBar
                    name={cat.name}
                    score={cat.score}
                    color={CATEGORY_COLORS[cat.id] || '#B8965A'}
                    delay={i * 0.1}
                  />
                  {/* 2026-05-04 ml-[76px] 제거 — 모바일에서 한 줄당 12-15자 좁아 가독성 손상 */}
                  <p className="text-caption text-text-muted mt-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeAiText(cat.description) }} />
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
                  <span className="text-body-sm text-text-secondary" dangerouslySetInnerHTML={{ __html: sanitizeAiText(s) }} />
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>

        {/* 주의할 점 */}
        <FadeIn delay={0.25}>
          {/* 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). */}
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">주의할 점</p>
            <ul className="space-y-2">
              {result.challenges.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-func-danger mt-0.5">●</span>
                  <span className="text-body-sm text-text-secondary" dangerouslySetInnerHTML={{ __html: sanitizeAiText(c) }} />
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>

        {/* 종합 조언 */}
        <FadeIn delay={0.3}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-2">종합 조언</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.advice) }} />
          </div>
        </FadeIn>

        {/* 미래 전망 */}
        <FadeIn delay={0.35}>
          {/* 2026-05-28 — 좌측 strip 제거 (AI 손톱 디자인). */}
          <div className="card py-5 px-5">
            <p className="text-h3 text-text-primary mb-2">미래 전망</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.futureOutlook) }} />
          </div>
        </FadeIn>

        {/* Phase D'-4 후속 — CompatTimeline (AI 응답 있을 때만, over-fit 방지) */}
        {aiTimeline && aiTimeline.length > 0 && (
          <FadeIn delay={0.35}>
            <div className="card py-5 px-5">
              <p className="text-h3 text-text-primary mb-4">관계의 시기별 결</p>
              <CompatTimeline steps={aiTimeline} />
            </div>
          </FadeIn>
        )}

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

        {/* Phase D'-4 후속 — ExtensionUpsellCard (단일 CTA) */}
        <FadeIn delay={0.42}>
          <ExtensionUpsellCard
            title="두 사주의 궁합과 평생 흐름까지 함께"
            desc="관계의 방향을 사주 전체에서 풀어드립니다. 시기·인연·동반의 자리까지."
            onTap={() => navigate('/charge?need=10')}
          />
        </FadeIn>

        {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) — Phase 누락 보강 2 패턴 */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평·자평진전·적천수·궁통보감·명리약언·삼명통회) 기반
          </p>
          <p className="text-[11px] italic" style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
            사주 풀이는 삶의 결을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
            <br />
            의료·법률·재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
          </p>
        </div>

        {/* 3-part Footer CTA (diff v3 §6) */}
        <FooterCTA pageKey="compat" backTo="/compat" />
      </div>

      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        name={`${state.person1.name} × ${state.person2.name}`}
        reportId={shareReportId || 'compat'}
        topScore={{ label: '궁합 점수', score: result.overallScore }}
      />
    </div>
  );
}
