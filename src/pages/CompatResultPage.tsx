import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getReport, getPendingSpends } from '@/services/storage/localStore';
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

/* 2026-10-26 — 결제 한 건(장부 id)마다 생성은 한 번만.
 *   예전엔 결과를 받은 뒤 다른 화면에 갔다가 뒤로 오거나(웹은 새로고침도) 처음 넘어온 state 가 그대로 남아 있어,
 *   다시 마운트될 때마다 AI 를 새로 불렀다(로그인 계정은 서버가 3운을 또 깎고, 실패하면 이번에 내지도 않은 3운을 돌려줬다).
 *   이제 궁합 화면 세 곳(궁합, 받은 초대장, 보낸 초대장)이 장부 id(pendingId)를 넘기고, 결과 화면은 그 장부가 남아 있을 때만 만든다.
 *   생성 도중 다른 화면에 갔다가 앞으로 와서 다시 마운트돼도 같은 생성을 이어 받는다(메모리, 새로고침하면 비워짐).
 *   저장과 환불은 생성 쪽에서 한 번만 하고, 화면은 결과를 받아 그리거나 돌아가기만 한다. */
type CompatRun = { rid: string; content: CompatibilityResponse; saved: any };
const compatRuns = new Map<string, Promise<CompatRun>>();
/** 생성이 끝난 장부 id → 저장한 기록 id (같은 탭 새로고침 뒤에도 그 결과를 연다) */
const COMPAT_DONE_KEY = (pendingId: string) => `saju500:compat_done:${pendingId}`;
/** 실패해서 돌려준 장부 id (2026-10-27 — 장부가 없다는 것만으로 '처리 끝'을 판단하지 않는다) */
const COMPAT_HANDLED_KEY = (pendingId: string) => `saju500:compat_handled:${pendingId}`;
/** 장부 id 는 만든 시각(36진수)으로 시작한다(localStore.markPendingSpend). 5분 안의 것은 저장 공간이 가득 차
 *  장부만 못 적힌 경우일 수 있어 생성하고, 실패하면 화면이 넘긴 값만큼 돌려준다(검토 결함: 운만 빠지고 풀이도 환불도 없었다) */
const isFreshPendingId = (id: string) => {
  const t = parseInt(id.split('_')[0] || '', 36);
  return Number.isFinite(t) && Date.now() - t >= 0 && Date.now() - t < 5 * 60 * 1000;
};
const wasHandled = (id: string) => {
  try { return !!(sessionStorage.getItem(COMPAT_DONE_KEY(id)) || sessionStorage.getItem(COMPAT_HANDLED_KEY(id))); } catch { return false; }
};

function startCompatRun(
  pendingId: string,
  st: { person1: any; person2: any; relation: string; cost?: number },
  showToast: (text: string, type?: 'success' | 'info' | 'warning') => void,
): Promise<CompatRun> {
  return generateCompatibilityAnalysis(st.person1.sajuData, st.person2.sajuData, st.relation, pendingId)
    .then(async (res) => {
      const { saveReport, generateId, clearPendingSpend } = await import('@/services/storage/localStore');
      const rid = res.reportId || generateId();
      const saved = {
        id: rid,
        name: `${st.person1.name} × ${st.person2.name}`,
        input: { ...st.person1.input, relation: 'compat' } as any,
        sajuData: st.person1.sajuData,
        type: 'paid' as const,
        contentType: 'compat' as const,
        aiResult: res.content,
        ...({ partner: { name: st.person2.name, sajuData: st.person2.sajuData, input: st.person2.input }, relation: st.relation } as any),
        spentUn: Number(st.cost) || undefined, // 2026-10-15 보관함 'N운 사용' 장부 (궁합 화면이 넘긴 실제 차감액)
        createdAt: new Date().toISOString(),
      };
      saveReport(saved);
      clearPendingSpend(pendingId); // 결과 저장 완료 → 이 결제 건만 자동환불 대상에서 뺀다 (다른 궁합 결제의 장부는 그대로)
      try { sessionStorage.setItem(COMPAT_DONE_KEY(pendingId), rid); } catch { /* noop */ }
      return { rid, content: res.content, saved };
    })
    .catch(async (e) => {
      console.error('궁합 분석 실패:', e);
      compatRuns.delete(pendingId);
      // 2026-05-07 fix — AI 실패 시 클라이언트에서 즉시 환불
      // 2026-10-26 — 이 결제의 장부가 아직 있을 때만, 장부에 적힌 만큼 돌려준다 (이미 돌려줬거나 자동환불된 건은 다시 주지 않는다)
      const { refundBalance, clearPendingSpend, getPendingSpends: readPending } = await import('@/services/storage/localStore');
      const entry = readPending().find((p) => p.id === pendingId);
      // 2026-10-27 장부가 못 적힌 결제(저장 공간 가득, 5분 안, 아직 처리 안 함)도 화면이 넘긴 값만큼 돌려준다
      const unrecorded = !entry && !wasHandled(pendingId) && isFreshPendingId(pendingId);
      if (entry || unrecorded) {
        const paid = Number(entry?.amount) || Number(st.cost) || 0;
        if (paid > 0) refundBalance(paid);
        clearPendingSpend(pendingId); // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
        try { sessionStorage.setItem(COMPAT_HANDLED_KEY(pendingId), '1'); } catch { /* noop */ }
        // 2026-10-15 — 원본 오류 문구(영문 코드 등)는 로그로만, 화면은 사람 말로
        showToast(paid > 0 ? `풀이를 만들지 못해서 ${paid}운을 돌려드렸어요. 잠시 뒤 다시 시도해 주세요.` : '풀이를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'warning');
      } else {
        showToast('풀이를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'warning');
      }
      throw e;
    });
}

export function CompatResultPage() {
  usePageTitle('궁합 결과');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // 2026-05-07 — 진입 경로 2가지:
  //  (1) /compat 에서 입력 후: { person1, person2, relation, cost, pendingId }
  //  (2) /storage 에서 클릭 시 (재열람): { savedResult, savedReport }
  //  2026-10-26 — (1)은 결과 저장 직후 (2)로 바뀐다(히스토리 교체). 뒤로 오기와 새로고침은 저장본을 다시 연다
  const rawLocationState = location.state as
    | { person1: any; person2: any; relation: string; cost?: number; pendingId?: string }
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
        // 2026-10-17 — 상대방 정보가 없는 옛 복원본에 내 사주를 넣지 않는다(두 칸에 같은 팔자가 나왔다). 상대 칸은 비워 둔다
        person2: replayPartner || { name: replayReport?.name?.split(' × ')?.[1] || '상대', sajuData: null, input: null, missing: true },
        relation: replayReport?.relation || '연인',
      }
    : (rawState as { person1: any; person2: any; relation: string; cost?: number; pendingId?: string } | undefined);

  const [phase, setPhase] = useState<'loading' | 'result'>(isReplay ? 'result' : 'loading');
  const [result, setResult] = useState<CompatibilityResponse | null>(
    isReplay ? ((rawState as any).savedResult as CompatibilityResponse) : null,
  );
  const [, setLoadingStep] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [sending, setSending] = useState(false);
  // 2026-05-07 fix — 동적 reportId
  const [shareReportId, setShareReportId] = useState<string>(replayReport?.id || '');
  const called = useRef(isReplay);
  // 2026-10-26 — 이번에 저장한 기록 (히스토리를 재열람 모드로 바꿀 때 state 로 넣는다)
  const savedRef = useRef<any>(replayReport);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  // 실제 주소가 아직 이 화면일 때만 히스토리를 바꾼다. 페이지 전환 애니메이션(App.tsx AnimatePresence mode="wait") 동안
  //   떠나는 이 화면이 살아 있어, 그때 replace 하면 다음 화면의 히스토리 항목을 덮어쓴다 (TopicAnalysisPage B-1 과 같은 함정)
  const onThisRoute = () => mountedRef.current && typeof window !== 'undefined' && window.location.pathname === location.pathname;

  useEffect(() => {
    if (isReplay) return; // 재열람은 AI 호출 skip
    if (!state?.person1 || !state?.person2) {
      navigate('/compat', { replace: true });
      return;
    }
    if (called.current) return;
    called.current = true;

    const rawPendingId = (state as { pendingId?: unknown }).pendingId;
    const pendingId = typeof rawPendingId === 'string' ? rawPendingId : '';
    let run = pendingId ? compatRuns.get(pendingId) : undefined;
    if (!run) {
      // 2026-10-26 — 이 결제의 장부가 남아 있을 때만 새로 만든다. 장부가 없으면 이미 결과를 저장했거나 돌려준 결제다
      //   (뒤로 오기, 새로고침, 장부 id 가 없는 옛 state). 이때는 AI 를 부르지도, 운을 돌려주지도 않는다.
      //   2026-10-27 — 단, 5분 안에 만든 장부 id 가 아직 처리되지 않았으면(저장 공간이 가득 차 장부만 못 적힌 경우) 생성한다
      const ledgerHas = !!pendingId && getPendingSpends().some((p) => p.id === pendingId);
      const unrecorded = !!pendingId && !ledgerHas && !wasHandled(pendingId) && isFreshPendingId(pendingId);
      if (!pendingId || (!ledgerHas && !unrecorded)) {
        let doneId = '';
        try { doneId = pendingId ? sessionStorage.getItem(COMPAT_DONE_KEY(pendingId)) || '' : ''; } catch { /* noop */ }
        const done = doneId ? getReport(doneId) : null;
        if (done?.aiResult) {
          // 결과는 이미 저장됐다(생성 도중 다른 화면에 갔다가 새로고침한 경우) → 그 기록을 연다. 주소는 아래 effect 가 바꾼다
          savedRef.current = done;
          setResult(done.aiResult as CompatibilityResponse);
          setShareReportId(done.id);
          setPhase('result');
        } else {
          navigate('/compat', { replace: true });
        }
        return;
      }
      run = startCompatRun(pendingId, state as { person1: any; person2: any; relation: string; cost?: number }, toast.show);
      compatRuns.set(pendingId, run);
    }

    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 2500);

    run.then((r) => {
      savedRef.current = r.saved;
      setResult(r.content);
      setShareReportId(r.rid);
      setPhase('result');
    }).catch(() => {
      // 환불과 안내는 생성 쪽(startCompatRun)에서 한 번만 했다.
      //   궁합 화면으로는 아직 이 화면에 있을 때만, 히스토리를 바꿔서 보낸다(뒤로 와도 이 화면이 다시 열려 생성하지 않게)
      setTimeout(() => { if (onThisRoute()) navigate('/compat', { replace: true }); }, 3000);
    }).finally(() => clearInterval(interval));
  }, []);

  /* 2026-10-26 — 결과를 저장하면 지금 히스토리 항목을 재열람 모드(?reportId= + savedResult/savedReport)로 바꾼다.
   *   다른 화면(연애운, 사주대화, 다른 궁합)에 갔다가 뒤로 오거나 웹에서 새로고침하면 AI 를 다시 부르지 않고 저장본을 연다.
   *   같은 경로라 다시 마운트되지 않는다. 마운트 중이고 실제 주소가 이 화면일 때만 바꾼다(onThisRoute). */
  useEffect(() => {
    if (phase !== 'result' || !result || !shareReportId) return;
    if (isReplay) return; // 보관함이나 주소(?reportId=)로 연 재열람 — 히스토리에 이미 결과가 있다
    if (!onThisRoute()) return;
    const qs = new URLSearchParams(location.search);
    qs.set('reportId', shareReportId);
    navigate(`${location.pathname}?${qs.toString()}`, {
      replace: true,
      state: savedRef.current ? { savedResult: result, savedReport: savedRef.current } : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result, shareReportId]);

  /** 2026-10-17 궁합 보내기 (시험 E7) — 받는 사람이 점수와 총평을 직접 열어 보는 링크. 서버에 일부만 남긴다(생일 없음).
   *  링크를 만들지 못하면 예전 공유 창으로 돌아간다. */
  async function handleSend() {
    if (!state || !result || sending) return;
    setSending(true);
    try {
      const yearZhi = (sd: any) => {
        const z = String(sd?.pillars?.[0]?.지지 || '');
        const KO: Record<string, string> = { 자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳', 오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥' };
        return '子丑寅卯辰巳午未申酉戌亥'.includes(z) ? z : (KO[z] || '');
      };
      const { createCompatShareId } = await import('@/services/share/compatShare');
      const id = await createCompatShareId({
        n1: state.person1.name,
        n2: state.person2.name,
        rel: state.relation,
        score: result.overallScore,
        rtype: (result as any).relationshipType || '',
        summary: result.summary,
        cats: (result.categories || []).map((c) => ({ n: c.name, s: c.score })),
        good: (result.strengths || [])[0] || '',
        tti1: yearZhi(state.person1.sajuData),
        tti2: yearZhi(state.person2.sajuData),
      }, shareReportId || `${state.person1.name}-${state.person2.name}-${result.overallScore}`);
      const { shareCompatLink } = await import('@/utils/share');
      const via = await shareCompatLink({ id, n1: state.person1.name, n2: state.person2.name });
      if (via === 'clipboard') toast.show('링크를 복사했어요. 카카오톡이나 문자에 붙여 넣어 보내세요', 'success');
    } catch (e) {
      console.warn('[compat] 보내기 링크 실패, 예전 공유로', e);
      setShowShare(true);
    } finally {
      setSending(false);
    }
  }

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
          {state.person1?.sajuData?.pillars && state.person2?.sajuData?.pillars ? (
            <CompatProfilePair
              person1={{ name: state.person1.name, pillars: state.person1.sajuData.pillars, elements: state.person1.sajuData.elements }}
              person2={{ name: state.person2.name, pillars: state.person2.sajuData.pillars, elements: state.person2.sajuData.elements }}
              overallScore={result.overallScore}
              relation={state.relation}
            />
          ) : (
            <div style={{ background: '#FFFDF8', border: '1px solid #E1D7C4', borderRadius: 14, padding: '16px', fontSize: 15, lineHeight: 1.7, color: '#4B4238' }}>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#1A1612' }}>{result.overallScore}점</p>
              <p style={{ marginTop: 4 }}>이 기록은 예전에 다른 기기에서 옮겨 와서 상대방 사주 칸이 남아 있지 않아요. 점수와 풀이는 그대로예요.</p>
            </div>
          )}
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
            <Button onClick={handleSend} variant="gold" size="lg" fullWidth disabled={sending}>
              {sending ? '링크를 만드는 중이에요' : '궁합 결과 보내기'}
            </Button>
            <p className="text-center" style={{ fontSize: 13, color: '#6F6557', marginTop: -4 }}>
              받는 사람은 점수와 총평, 잘 맞는 점을 볼 수 있어요. 생일은 보내지 않아요.
            </p>
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
