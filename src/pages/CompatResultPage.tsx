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
import { ReviewAsk } from '@/components/common/ReviewAsk';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import type { CompatibilityResponse } from '@/types/report';
import { sanitizeAiText } from '@/utils/format';
import { OHENG_MAP } from '@/constants/oheng';
import { YiGi, Tag, GhostButton } from '@/components/hanji/Hanji';
import { openChatWithResult } from '@/components/common/NextStepsCard';
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
  values: '#4E7A57',
  communication: OHENG_MAP['수'].color,
  emotion: '#B04A38',
  future: '#7A5C7E',
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
      const { saveReport, generateId, clearPendingSpendByType } = await import('@/services/storage/localStore');
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
        spentUn: Number((state as any)?.cost) || undefined, // 2026-10-15 보관함 'N운 사용' 장부 (궁합 화면이 넘긴 실제 차감액)
        createdAt: new Date().toISOString(),
      });
      clearPendingSpendByType('compat'); // 결과 저장 완료 → 자동환불 대상 제외
      setShareReportId(rid);
      setPhase('result');
    }).catch(async (e) => {
      console.error('궁합 분석 실패:', e);
      // 2026-05-07 fix — AI 실패 시 클라이언트에서 즉시 환불
      const { refundBalance, clearPendingSpendByType } = await import('@/services/storage/localStore');
      // 2026-10-14 — 가격 변경(1 → 2운) 뒤에도 실제로 낸 만큼 돌려준다 (예전 화면에서 넘어온 상태는 1운)
      const paid = Number((state as any)?.cost) || 1;
      refundBalance(paid);
      clearPendingSpendByType('compat'); // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
      // 2026-10-15 — 원본 오류 문구(영문 코드 등)는 로그로만, 화면은 사람 말로
      toast.show(`풀이를 만들지 못해서 ${paid}운을 돌려드렸어요. 잠시 뒤 다시 시도해 주세요.`, 'warning');
      setTimeout(() => navigate('/compat'), 3000);
    }).finally(() => clearInterval(interval));
  }, []);

  if (!state) return null;

  // ─── 로딩 ───
  if (phase === 'loading') {
    return <AILoading name={`${state.person1.name} × ${state.person2.name}`} type="궁합 분석" sajuData={state.person1?.sajuData} steps={['두 사람의 오행을 비교하고 있어요', '십성 관계를 분석하고 있어요', '궁합 점수를 계산하고 있어요']} estimatedSeconds={80} />;
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
          crumb="두 사람 궁합"
          sub={`${state.person1.name} × ${state.person2.name}, ${state.relation}`}
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
              <Tag gold>{(result as any).relationshipType}</Tag>
            )}
            {(result as any).keywords?.map((kw: string, i: number) => (
              <Tag key={i}>{String(kw).replace(/^#+/, '')}</Tag>
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
              <Tag seal={result.ohengHarmony.relation !== '상생'}>{result.ohengHarmony.relation}</Tag>
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
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 13, fill: 'var(--text-secondary)' }} />
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
                  <p className="mt-2" style={{ fontSize: 14.5, lineHeight: 1.75, color: '#4B4238', wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: sanitizeAiText(cat.description) }} />
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* 잘 맞는 점 / 주의할 점 — 2026-10-11 금빛, 빨강 동그라미 글머리 두 카드 → 책력의 宜忌 표 하나 */}
        <FadeIn delay={0.2}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-3">두 사람이 살릴 점과 조심할 점</p>
            <YiGi
              good={(result.strengths || []).map((s) => sanitizeAiText(s))}
              bad={(result.challenges || []).map((c) => sanitizeAiText(c))}
              goodLabel="잘 맞는 점"
              badLabel="주의할 점"
              html
            />
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
              <p className="text-h3 text-text-primary mb-4">관계의 시기별 흐름</p>
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
          {/* 2026-10-04 — 기존: 충전 페이지로 보내는 막다른 CTA. 관계에 맞는 다음 콘텐츠로 연결 */}
          {(() => {
            const rel = String(state.relation || '');
            const next = /이별/.test(rel)
              ? { title: '다시 만날 수 있을까요?', desc: '재회운에서 두 사람의 흐름과 다가갈 시기를 짚어드려요.', to: '/topic/reunion' }
              : /배우자/.test(rel)
                ? { title: '부부의 앞으로 흐름이 궁금하다면', desc: '결혼운에서 두 분의 생활과 시기 흐름을 더 깊게 봐드려요.', to: '/topic/marriage' }
                : /연인|썸/.test(rel)
                  ? { title: '이 관계, 더 깊게 보고 싶다면', desc: '연애운에서 지금 관계의 흐름과 시기를 자세히 풀어드려요.', to: '/topic/love' }
                  : { title: '내 사주 전체가 궁금하다면', desc: '종합사주에서 성격, 관계, 시기까지 처음부터 끝까지 읽어드려요.', to: '/premium' };
            return <ExtensionUpsellCard title={next.title} desc={next.desc} onTap={() => navigate(next.to)} />;
          })()}
        </FadeIn>

        {/* 2026-10-10 — 실제 후기 수집 (저장된 결과에만) */}
        {shareReportId && (
          <ReviewAsk contentType="compat" contentLabel="궁합" reportKey={shareReportId} style={{ margin: '24px 0 0' }} />
        )}

        {/* P0-D · 출처 + 디스클레이머 (앱인토스 검수 §6-05) — Phase 누락 보강 2 패턴 */}
        <div className="mt-8 text-center space-y-1">
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            한국 명리학 6대 원전(연해자평, 자평진전, 적천수, 궁통보감, 명리약언, 삼명통회) 기반
          </p>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
            사주 풀이는 삶의 기운을 살피는 참고 자료이며, 모든 결정은 본인의 몫입니다.
            <br />
            의료, 법률, 재정 등 전문적 판단이 필요한 사안은 해당 분야 전문가의 상담을 권해드립니다.
          </p>
        </div>

        {/* 2026-10-13 — 'OO 전체로' + '종합사주 N운' 하단 버튼 제거(05-21 오너: 뜻이 불명확, 업셀은 위 카드 하나) → 이 궁합을 들고 사주대화로 */}
        <div style={{ marginTop: 24 }}>
          <GhostButton
            onClick={() => { void openChatWithResult({ navigate, name: state.person1?.name || '나', profile: state.person1, ctx: { type: 'compat', label: `${state.person1.name} × ${state.person2.name} 궁합`, relation: state.relation, partnerName: state.person2.name, fullResult: result } }); }}
            ariaLabel="이 궁합으로 사주대화 이어가기"
          >
            이 궁합으로 사주대화 이어가기
          </GhostButton>
        </div>
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
