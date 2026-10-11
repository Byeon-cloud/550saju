import { useState, useMemo, useRef } from 'react';
import { NeedSaju } from '@/components/hanji/Hanji';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { TojungMonthCard } from '@/components/saju/TojungMonthCard';
import { ShareModal } from '@/components/share/ShareModal';
import { getProfiles, spendBalance, refundBalance, saveReport, generateId, getCachedResult, getReport, markPendingSpend, clearPendingSpendByType, type LocalReport } from '@/services/storage/localStore';
import { generateTojungBigyeol } from '@/services/ai/reportGenerator';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import { FooterCTA } from '@/components/common/FooterCTA';
import { ReviewAsk } from '@/components/common/ReviewAsk';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import type { TojungResponse } from '@/types/report';
import { stripMd, sanitizeAiText } from '@/utils/format';
import { kstToday } from '@/utils/kstDate';
// Phase D'-4 Bundle 2 (#54) — mockup 진본 시각 정렬
import {
  EXTENSION_THEME,
  ExtensionHero,
  ExtensionUpsellCard,
  TojungHexagramCard,
  TojungFourBox,
  type TojungFourItem,
} from './extension/_chrome';

type Phase = 'select' | 'loading' | 'result';

/** 2026-10-09 — 점진 표시: 그룹(A 총평 · B 1~6월 · C 7~12월) 도착분 머지 */
function mergeNyGroup(prev: any, data: any): any {
  const p = prev || {};
  const months: any[] = Array.isArray(p.months) ? [...p.months] : [];
  for (const m of Array.isArray(data?.months) ? data.months : []) {
    const i = months.findIndex((x: any) => Number(x?.month) === Number(m?.month));
    if (i >= 0) months[i] = m; else months.push(m);
  }
  months.sort((a: any, b: any) => Number(a.month) - Number(b.month));
  const { months: _ignored, ...rest } = data || {};
  void _ignored;
  return { ...p, ...rest, months };
}

/** 아직 안 온 자리 — 내용 대신 '쓰는 중' shimmer (나중에 글이 바뀌지 않게) */
function NySkeleton({ label, lines = 3, height = 12 }: { label: string; lines?: number; height?: number }) {
  return (
    <div className="card" aria-live="polite">
      <style>{`@keyframes ny-shimmer{0%{background-position:-240px 0}100%{background-position:240px 0}}`}</style>
      <p className="text-[13.5px] font-bold mb-2.5" style={{ color: '#1A1612' }}>{label}</p>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{
          height, width: `${[100, 92, 76, 88][i % 4]}%`, borderRadius: 6, marginBottom: 8,
          background: 'linear-gradient(90deg, rgba(140,109,61,0.07) 0%, rgba(140,109,61,0.16) 50%, rgba(140,109,61,0.07) 100%)',
          backgroundSize: '480px 100%', animation: 'ny-shimmer 1.4s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}

/* 2026-10-07 — '토정비결' → '신년운세' 재출시 (경로 /tojung · contentType 'tojung' 유지).
 *   대상 연도 = 10월부터 내년 (서버 claudeTojung.tojungTargetYear 와 같은 규칙).
 *   2026-10-08 오너 "7운 · 퀄리티 좋게" → 7운 프리미엄 (Opus 3그룹 · 달마다 좋은 날/조심할 날 · 결정 타이밍). */
const NEWYEAR_PRICE = 7;
function newYearTarget(): number {
  const [y, m] = kstToday().split('-').map(Number);
  return m >= 10 ? y + 1 : y;
}
const TY = newYearTarget();

const LOADING_STEPS = [
  `${TY}년 세운과 사주를 맞춰보고 있어요...`,
  '365일 일진에서 좋은 날과 조심할 날을 고르고 있어요...',
  '열두 달 흐름을 달마다 풀고 있어요...',
  '결정 타이밍과 개운 조언을 정리하고 있어요...',
];

const CATEGORY_ICONS: Record<string, string> = {
  총운: '總', 금전운: '財', 건강운: '健', 직장운: '職', 애정운: '愛', 결혼운: '婚',
};
const CATEGORY_COLORS: Record<string, string> = {
  // 2026-10-10 v9 — 분야마다 다른 색(분홍·초록·파랑) → 금 하나 (이 색 저 색 금지)
  총운: '#8C6D3D', 금전운: '#8C6D3D', 건강운: '#8C6D3D', 직장운: '#8C6D3D', 애정운: '#8C6D3D', 결혼운: '#8C6D3D',
};

export function TojungPage() {
  usePageTitle(`${TY} 신년운세`);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // 보관함에서 저장된 결과를 넘겨받은 경우
  const rawNavState = location.state as { savedResult?: TojungResponse; savedReport?: LocalReport } | undefined;
  // 2026-05-28 — URL ?reportId= 폴백. state 손실(새로고침/strict mode) 대비.
  const [searchParams] = useSearchParams();
  const reportIdFromUrl = searchParams.get('reportId');
  const reportFromUrl = useMemo(() => {
    if (!reportIdFromUrl) return null;
    try { return getReport(reportIdFromUrl); } catch { return null; }
  }, [reportIdFromUrl]);
  const navState = rawNavState?.savedReport
    ? rawNavState
    : (reportFromUrl ? { savedResult: reportFromUrl.aiResult as TojungResponse, savedReport: reportFromUrl } : undefined);

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  const [selected, setSelected] = useState<LocalReport | null>(navState?.savedReport || null);
  const [result, setResult] = useState<TojungResponse | null>(navState?.savedResult || null);
  const [, setLoadingStep] = useState(0);
  const [showShare, setShowShare] = useState(false);
  // 2026-05-07 fix — 동적 reportId
  const [shareReportId, setShareReportId] = useState<string>(navState?.savedReport?.id || '');
  const isAnalyzingRef = useRef(false);
  // 2026-10-09 — 점진 표시 (생성 중 도착 그룹부터 화면에)
  const [arrivedNy, setArrivedNy] = useState<Record<'A' | 'B' | 'C', boolean>>({ A: true, B: true, C: true });
  const partialMode = !(arrivedNy.A && arrivedNy.B && arrivedNy.C);

  const reports = useMemo(() => getProfiles(), []);

  async function startAnalysis() {
    if (!selected) return;
    if (isAnalyzingRef.current || phase === 'loading') return;
    isAnalyzingRef.current = true;

    // 캐시 확인 — 이전에 분석한 적 있으면 무료로 바로 보여줌
    const cached = getCachedResult(selected.name, selected.input.birthYear, selected.input.birthMonth, selected.input.birthDay, 'tojung');
    if (cached?.aiResult && Number((cached.aiResult as any)?.targetYear) === TY && Number((cached.aiResult as any)?.schemaVersion) >= 2) {
      setResult(cached.aiResult);
      setPhase('result');
      toast.show('이전 분석 결과를 불러왔어요', 'info');
      isAnalyzingRef.current = false;
      return;
    }

    if (!spendBalance(NEWYEAR_PRICE)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate('/charge', { state: { message: `${TY} 신년운세에 ${NEWYEAR_PRICE}운이 필요해요` } });
      isAnalyzingRef.current = false;
      return;
    }
    // 측정 — 운 차감 성공 직후 (C1 · fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'tojung', amount: NEWYEAR_PRICE })).catch(() => {});
    // 2026-06-18 머니세이프 — 생성 중 앱 종료로 결과 못 받으면 부팅 reconcile 이 5분 후 자동환불.
    markPendingSpend('tojung', NEWYEAR_PRICE);
    toast.show(`${NEWYEAR_PRICE}운이 차감됐어요`, 'info');
    setPhase('loading');
    setLoadingStep(0);
    const interval = setInterval(() => setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 3000);

    // 2026-10-09 — 점진 표시: 서버가 총평·1~6월·7~12월을 완성하는 대로 progress/{id} 에 쓰고 여기서 구독.
    //   첫 그룹이 오면 결과 화면으로 넘어가고, 안 온 자리는 스켈레톤. 결제·저장·환불 경로는 그대로.
    let progressSub: { unsubscribe: () => void } | null = null;
    let progressId: string | undefined;
    let settled = false;
    setArrivedNy({ A: false, B: false, C: false });
    try {
      const [{ makeProgressId }, { subscribeProgress }] = await Promise.all([
        import('@/services/progress/progressId'),
        import('@/services/progress/progressClient'),
      ]);
      progressId = makeProgressId();
      progressSub = subscribeProgress(progressId, {
        onGroup: (g, data) => {
          if (settled || !['A', 'B', 'C'].includes(g)) return;
          setResult((prev) => mergeNyGroup(prev, data) as TojungResponse);
          setArrivedNy((prev) => ({ ...prev, [g]: true }));
          setPhase('result');
        },
      });
    } catch { /* 점진 표시는 부가 기능 */ }

    try {
      const res = await generateTojungBigyeol(selected.sajuData, progressId);
      settled = true;
      setResult(res.content);
      setArrivedNy({ A: true, B: true, C: true });
      const rid = res.reportId || generateId();
      saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'tojung', aiResult: res.content, createdAt: new Date().toISOString() });
      clearPendingSpendByType('tojung'); // 결과 저장 완료 → 자동환불 대상 제외
      setShareReportId(rid);
      setPhase('result');
    } catch (e: any) {
      settled = true;
      setArrivedNy({ A: true, B: true, C: true });
      setResult(null);
      console.error('신년운세 실패:', e);
      // 2026-05-07 fix — AI 실패 시 클라이언트에서 즉시 환불
      refundBalance(NEWYEAR_PRICE);
      clearPendingSpendByType('tojung'); // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
      setPhase('select');
      toast.show(`분석에 실패해서 ${NEWYEAR_PRICE}운을 돌려드렸어요`, 'warning');
    } finally {
      clearInterval(interval);
      progressSub?.unsubscribe();
      isAnalyzingRef.current = false;
    }
  }

  // ─── 프로필 선택 ───
  if (phase === 'select') {
    if (reports.length === 0) {
      return (
        <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
          <Header title="신년운세" />
          <NeedSaju mark="歲" desc={`${TY}년 열두 달을 내 사주로 미리 봐요. 태어난 날과 시간만 있으면 돼요.`} onClick={() => navigate('/input?from=home_body_tojung')} />
        </div>
      );
    }

    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="신년운세" />
        {/* 2026-05-04 ExtensionHero 통일 (select phase 부터 적용) */}
        <FadeIn>
          <ExtensionHero
            theme={EXTENSION_THEME.tojung}
            sub={`${TY}년 한 해를 내 사주로 열두 달 미리 봅니다`}
            rightLabel={`歲 ${TY}`}
          />
        </FadeIn>
        <div className="px-5 pt-5 space-y-5">
          <FadeIn delay={0.05}>
            <ProfilePicker onSelect={p => setSelected(p as unknown as LocalReport)} onNew={() => navigate('/input?new=1')} title={`누구의 ${TY} 신년운세를 볼까요?`} />
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
            <Button onClick={startAnalysis} variant="gold" size="lg" fullWidth sub={`${NEWYEAR_PRICE}운`}>{TY} 신년운세 보기</Button>
          </div>
        )}
      </div>
    );
  }

  // ─── 로딩 ───
  if (phase === 'loading') {
    return <AILoading name={selected?.name} type={`${TY} 신년운세`} sajuData={selected?.sajuData} steps={[`${TY}년 세운과 사주를 맞춰보고 있어요`, '365일 일진에서 좋은 날과 조심할 날을 고르고 있어요', '열두 달 흐름을 달마다 풀고 있어요', '결정 타이밍과 개운 조언을 정리하고 있어요']} estimatedSeconds={100} />;
  }

  // ─── 결과 ───
  if (!result) return null;

  const categories = Object.entries(result.yearOverview || {}) as [string, string][];
  const monthsArr: any[] = Array.isArray((result as any).months) ? (result as any).months : [];
  // 대상 연도 — 신년운세(10-07~)는 targetYear 를 담고, 옛 토정비결 결과는 없음 → 2026 토정비결로 표기
  const resultYear = Number((result as any)?.targetYear) || 0;
  const isLegacyTojung = !resultYear;

  // Phase D'-4 Bundle 2 — chrome theme + AI hexagram/fourBox (over-fit 방지: 응답 있을 때만)
  const tojungTheme = EXTENSION_THEME.tojung;
  const aiHex = (result as any)?.hexagram;
  const aiFourBox: TojungFourItem[] | null = Array.isArray((result as any)?.fourBox)
    ? ((result as any).fourBox as TojungFourItem[])
    : null;

  return (
    <div className="min-h-screen pb-20" style={{ background: 'linear-gradient(180deg, #F5F0E8 0%, #FFFFFF 30%)' }}>
      <Header title={isLegacyTojung ? '토정비결' : '신년운세'} />

      {/* Phase D'-4 Bundle 2 — ExtensionHero (歲 인장 + 네이비 그라디언트) */}
      <FadeIn>
        <ExtensionHero
          theme={tojungTheme}
          crumb={isLegacyTojung ? '토정비결' : `${resultYear} 신년운세`}
          sub={isLegacyTojung ? '한 해를 열두 달로 나눠 봅니다.' : `${resultYear}년 세운과 열두 달 월운을 내 사주에 맞춰 봅니다.`}
          seal="歲"
        />
      </FadeIn>

      {/* Phase D'-4 Bundle 2 — TojungHexagramCard (本卦 + glyph + pull, AI 응답 있을 때만) */}
      {aiHex && (
        <FadeIn delay={0.04}>
          <TojungHexagramCard
            yearLabel={String(aiHex.yearLabel ?? (isLegacyTojung ? '2026 병오년' : `${resultYear}년`)).replace(/,\s*(?=신년운세|토정비결)/, ' ')}
            glyph={String(aiHex.glyph ?? '')}
            name={String(aiHex.name ?? '')}
            oneLine={stripMd(String(aiHex.oneLine ?? aiHex.summary ?? ''))}
            pullQuote={aiHex.pullQuote ? String(aiHex.pullQuote) : undefined}
          />
        </FadeIn>
      )}

      {/* Phase D'-4 Bundle 2 — TojungFourBox (상반기/하반기/길월/주의월, AI 응답 있을 때만) */}
      {aiFourBox && aiFourBox.length === 4 && (
        <FadeIn delay={0.06}>
          <TojungFourBox items={aiFourBox} />
        </FadeIn>
      )}

      <div className="px-5 pt-4 space-y-5">

        {/* 2026-10-09 — 점진 표시 진행 바 (총평 · 1~6월 · 7~12월) */}
        {partialMode && (
          <div className="sticky z-40" style={{ top: 56 }}>
            <div className="rounded-xl px-3.5 py-3" style={{ background: 'linear-gradient(135deg, #F4F7FC 0%, #EAF0F8 100%)', border: '1px solid rgba(140,109,61,0.22)', boxShadow: '0 2px 8px rgba(140,109,61,0.10)' }}>
              <p className="text-[13.5px] font-bold mb-1.5" style={{ color: '#1A1612' }}>
                신년운세를 쓰는 중이에요, {(arrivedNy.A ? 1 : 0) + (arrivedNy.B ? 1 : 0) + (arrivedNy.C ? 1 : 0)}/3 도착
              </p>
              <div className="flex gap-1 mb-1.5">
                {(['A', 'B', 'C'] as const).map((g) => (
                  <div key={g} className="flex-1 rounded-full" style={{ height: 4, background: arrivedNy[g] ? '#1A1612' : 'rgba(140,109,61,0.16)', transition: 'background 0.4s' }} />
                ))}
              </div>
              <p className="text-[13px] leading-snug" style={{ color: '#4A5E80' }}>한 해 총평, 1~6월, 7~12월 순서 없이, 다 쓰는 대로 채워져요.</p>
            </div>
          </div>
        )}

        {/* 헤더 */}
        <FadeIn>
          <div className="text-center py-4">
            <p className="text-caption text-brand-gold font-semibold">{isLegacyTojung ? '2026년 토정비결' : `${resultYear}년 신년운세`}</p>
            <p className="text-display text-text-primary">{selected?.name} 님</p>
          </div>
        </FadeIn>

        {/* 키워드 태그 */}
        {(result as any).keywords?.length > 0 && (
          <FadeIn delay={0.03}>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {(result as any).keywords.map((kw: string, i: number) => (
                <span key={i} className="text-[13px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(184,150,90,0.1)', color: '#8C6D3D', border: '1px solid rgba(184,150,90,0.2)' }}>
                  {kw}
                </span>
              ))}
            </div>
          </FadeIn>
        )}

        {/* 6대 카테고리 그리드 */}
        {partialMode && !arrivedNy.A && <NySkeleton label="분야별 한 해 풀이를 쓰고 있어요" lines={4} />}
        <FadeIn delay={0.05}>
          {/* 2026-10-10 v9 가독성 — 긴 글을 좁은 두 칸에 넣지 않는다 (한 칸) */}
          <div className="grid grid-cols-1 gap-3">
            {categories.map(([key, value], i) => {
              const catColor = CATEGORY_COLORS[key] || '#B8965A';
              const catScore = (result as any).categoryScores?.[key];
              return (
                <motion.div
                  key={key}
                  className="card py-4 px-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${catColor}12` }}>
                      <span className="text-[13.5px] font-black" style={{ color: catColor }}>{CATEGORY_ICONS[key] || '總'}</span>
                    </div>
                    <p className="text-label text-text-primary font-bold flex-1">{key}</p>
                    {catScore != null && (
                      <span className="text-[13.5px] font-black" style={{ color: catColor }}>{catScore}</span>
                    )}
                  </div>
                  {catScore != null && (
                    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: `${catColor}10` }}>
                      <motion.div className="h-full rounded-full" style={{ background: catColor }}
                        initial={{ width: 0 }} animate={{ width: `${Math.min(catScore, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }} />
                    </div>
                  )}
                  <p className="text-caption text-text-secondary leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeAiText(value) }} />
                </motion.div>
              );
            })}
          </div>
        </FadeIn>

        {/* 12개월 점수 흐름 */}
        {partialMode && monthsArr.length < 12 ? <NySkeleton label="열두 달 흐름을 모으고 있어요" lines={2} height={22} /> : (
        <FadeIn delay={0.25}>
          <div className="card">
            <p className="text-h3 text-text-primary mb-1">월별 운세 흐름</p>
            <p className="text-[13px] text-text-hint mb-3">1월~12월 점수 흐름</p>
            <div className="h-36 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.months.map((m: any) => ({ name: String(m.month), 점수: m.score || 5 }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tojungGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B8965A" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#B8965A" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  {/* 2026-10-07 — 점수는 1~100 인데 축이 0~10 이라 선이 위로 잘렸음 */}
                  <XAxis dataKey="name" interval={0} tick={{ fontSize: 12, fill: 'var(--text-hint)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-disabled)' }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="점수" stroke="#B8965A" strokeWidth={2}
                    fill="url(#tojungGrad)"
                    dot={{ r: 2.5, fill: '#B8965A', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeIn>
        )}

        {/* 2026-10-08 — 결정 타이밍 (7운 프리미엄) */}
        {Array.isArray((result as any).turningPoints) && (result as any).turningPoints.length > 0 && (
          <FadeIn delay={0.27}>
            <div className="card">
              <p className="text-h3 text-text-primary mb-1">올해의 결정 타이밍</p>
              <p className="text-[13px] text-text-hint mb-3">움직이기 좋은 때와 그 이유</p>
              <div className="space-y-3">
                {((result as any).turningPoints as Array<{ when: string; title: string; desc: string }>).map((tp, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 text-[13.5px] font-bold px-2.5 py-1 rounded-lg h-fit"
                      style={{ background: 'rgba(140,109,61,0.08)', color: '#1A1612', whiteSpace: 'nowrap' }}>{tp.when}</div>
                    <div className="min-w-0">
                      <p className="text-label text-text-primary font-bold">{stripMd(String(tp.title || ''))}</p>
                      <p className="text-body-sm text-text-secondary leading-relaxed mt-0.5" dangerouslySetInnerHTML={{ __html: sanitizeAiText(String(tp.desc || '')) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}

        {/* 2026-10-08 — 한 해 꼭 기억할 날 (서버 일진 계산) */}
        {Array.isArray((result as any).keyDates) && (result as any).keyDates.length > 0 && (
          <FadeIn delay={0.29}>
            <div className="card">
              <p className="text-h3 text-text-primary mb-1">{resultYear}년 꼭 기억할 날</p>
              <p className="text-[13px] text-text-hint mb-3">내 사주에 도움 기운이 가장 크게 들어오는 날, 중요한 약속, 결정, 시작에</p>
              <div className="grid grid-cols-2 gap-2">
                {((result as any).keyDates as Array<{ date: string; why: string }>).map((k, i) => (
                  <div key={i} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(184,150,90,0.08)', border: '1px solid rgba(184,150,90,0.18)' }}>
                    <p className="text-[15px] font-black" style={{ color: '#8C6D3D' }}>{k.date}</p>
                    <p className="text-[13px] text-text-muted leading-snug mt-0.5">{k.why}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}

        {/* 12개월 상세 */}
        <FadeIn delay={0.3}>
          <p className="text-h2 text-text-primary">{isLegacyTojung ? '월별 토정비결' : '달마다 미리 보기'}</p>
          <p className="text-caption text-text-muted">각 달을 눌러 자세한 풀이를 확인하세요</p>
        </FadeIn>

        <div className="space-y-3">
          {partialMode && !arrivedNy.B && <NySkeleton label="1~6월 풀이를 쓰고 있어요" lines={3} />}
          {monthsArr.map((m, i) => (
            <TojungMonthCard
              key={m.month}
              month={m.month}
              괘={m.괘}
              괘의미={m.괘의미}
              전통해석={m.전통해석}
              현대해석={m.현대해석}
              score={m.score}
              keyword={m.keyword}
              goodDays={(m as any).goodDays}
              cautionDays={(m as any).cautionDays}
              todo={(m as any).todo}
              avoid={(m as any).avoid}
              delay={0.35 + i * 0.03}
            />
          ))}
          {partialMode && !arrivedNy.C && <NySkeleton label="7~12월 풀이를 쓰고 있어요" lines={3} />}
        </div>

        {/* 개운 조언 — 점진 표시 중 총평(A) 도착 전엔 숨김 */}
        {!!result.luckyAdvice && (
        <FadeIn delay={0.7}>
          <div className="py-5 px-5 rounded-2xl" style={{ background: 'rgba(184,150,90,0.06)', border: '1px solid rgba(184,150,90,0.15)' }}>
            <p className="text-h3 text-text-primary mb-2">{isLegacyTojung ? '올해의 개운 조언' : `${resultYear}년 개운 조언`}</p>
            <p className="text-body-sm text-text-secondary leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: sanitizeAiText(result.luckyAdvice) }} />
          </div>
        </FadeIn>
        )}

        {!partialMode && (
        <FadeIn delay={0.75}>
          <Button onClick={() => setShowShare(true)} variant="gold" size="lg" fullWidth>결과 공유하기</Button>
        </FadeIn>
        )}

        {/* Phase D'-4 Bundle 2 — ExtensionUpsellCard (단일 CTA) */}
        <FadeIn delay={0.78}>
          {/* 2026-10-07 — 충전 페이지(막다른 길) 대신 종합사주로 */}
          <ExtensionUpsellCard
            title="한 해를 넘어 내 사주 전체가 궁금하다면"
            desc="종합사주에서 성격, 관계, 대운까지 처음부터 끝까지 읽어드려요."
            onTap={() => navigate('/premium')}
          />
        </FadeIn>

        {/* 2026-10-10 — 실제 후기 수집 (3그룹 다 도착 + 저장된 뒤) */}
        {!partialMode && shareReportId && (
          <ReviewAsk contentType="tojung" contentLabel="신년운세" reportKey={shareReportId} style={{ margin: '24px 0 0' }} />
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

        {/* 3-part Footer CTA (diff v3 §6) */}
        <FooterCTA pageKey="tojung" backTo="/" />
      </div>

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} name={selected?.name || ''} reportId={shareReportId || 'tojung'} />
    </div>
  );
}
