import { useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { ShareModal } from '@/components/share/ShareModal';
import { getProfiles, spendBalance, refundBalance, saveReport, generateId, getReport, markPendingSpend, clearPendingSpendByType, type LocalReport } from '@/services/storage/localStore';
import { generateMonthlyFortune2026, type MonthInfo } from '@/services/ai/reportGenerator';
import { getMonthlyPrice } from '@/constants/pricing';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import { Solar } from 'lunar-javascript';
import type { MonthlyDetailResponse } from '@/types/report';
import { MonthlyMockupView } from './MonthlyMockupView'; // 2026-07-01 결과 phase 오늘운세급 재구축
import {
  EXTENSION_THEME,
  ExtensionHero,
} from './extension/_chrome';

type Phase = 'select' | 'loading' | 'result';

const ACCENT = '#B5441F'; // 월운 확장색 (CLAUDE.md 톤 SSOT)

/**
 * 선택 가능한 12개월 — 이번 달 포함 앞으로 12개월(예: 2026/6 ~ 2027/5).
 * 7/31에 사도 8월 고르면 손해 0. 기본 선택 = 이번 달.
 */
function buildMonthOptions(): { year: number; month: number; label: string }[] {
  const base = new Date();
  const out: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    out.push({ year, month, label: `${year}년 ${month}월` });
  }
  return out;
}

/**
 * 선택월의 월간지·세운간지 — lunar-javascript 로 정확 계산.
 * ★월주는 절기 기준이라 그 달 15일로 계산(절기 경계 안전).
 *   const s = Solar.fromYmd(year, month, 15).getLunar();
 *   월간지 = s.getMonthInGanZhi(); 세운간지 = s.getYearInGanZhi();
 */
function computeMonthInfo(year: number, month: number): MonthInfo {
  let wolGanji = '';
  let yearGanji = '';
  try {
    const s = Solar.fromYmd(year, month, 15).getLunar();
    wolGanji = s.getMonthInGanZhi();
    yearGanji = s.getYearInGanZhi();
  } catch {
    wolGanji = '';
    yearGanji = '';
  }
  return { year, month, label: `${year}년 ${month}월`, wolGanji, yearGanji };
}

export function MonthlyPage() {
  usePageTitle('월별 운세');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // 보관함에서 저장된 결과를 넘겨받은 경우
  const rawNavState = location.state as { savedResult?: MonthlyDetailResponse; savedReport?: LocalReport } | undefined;
  // URL ?reportId= 폴백. state 손실(새로고침/strict mode) 대비.
  const [searchParams] = useSearchParams();
  const reportIdFromUrl = searchParams.get('reportId');
  const reportFromUrl = useMemo(() => {
    if (!reportIdFromUrl) return null;
    try { return getReport(reportIdFromUrl); } catch { return null; }
  }, [reportIdFromUrl]);
  const navState = rawNavState?.savedReport
    ? rawNavState
    : (reportFromUrl ? { savedResult: reportFromUrl.aiResult as MonthlyDetailResponse, savedReport: reportFromUrl } : undefined);

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  const [selected, setSelected] = useState<LocalReport | null>(navState?.savedReport || null);
  const [result, setResult] = useState<MonthlyDetailResponse | null>(navState?.savedResult || null);
  // 선택한 달 인덱스 (monthOptions 기준) — 기본 = 이번 달(0)
  const [monthIdx, setMonthIdx] = useState(0);
  const [showShare, setShowShare] = useState(false);
  const [shareReportId, setShareReportId] = useState<string>(navState?.savedReport?.id || '');
  const isAnalyzingRef = useRef(false);

  const reports = useMemo(() => getProfiles(), []);

  async function startAnalysis() {
    if (!selected) return;
    if (isAnalyzingRef.current || phase === 'loading') return;
    isAnalyzingRef.current = true;

    // ★머니패스(차감 금액 7) — 절대 변경 금지. 이미 7운으로 맞춰져 있음.
    const price = getMonthlyPrice().actualPrice; // 월운 정가 7운 (SSOT)
    if (!spendBalance(price)) {
      toast.show('잔액이 부족해요', 'warning');
      navigate(`/charge?need=${price}`, { state: { message: `월별 운세에 ${price}운이 필요해요`, returnTo: '/monthly' } });
      isAnalyzingRef.current = false;
      return;
    }
    // 측정 — 운 차감 성공 직후 (fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'monthly', amount: price })).catch(() => {});
    // 머니세이프 — 생성 중 앱 종료로 결과 못 받으면 부팅 reconcile 이 자동환불.
    markPendingSpend('monthly', price);
    toast.show(`${price}운이 차감됐어요`, 'info');
    setPhase('loading');

    // 선택월 간지 계산 → 서버로 전달 (서버는 간지 추측 X · 만세력 정확성)
    const opt = monthOptions[monthIdx] ?? monthOptions[0];
    const monthInfo = computeMonthInfo(opt.year, opt.month);

    try {
      const res = await generateMonthlyFortune2026(selected.sajuData, monthInfo);
      setResult(res.content);
      const rid = res.reportId || generateId();
      saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'monthly', aiResult: res.content, createdAt: new Date().toISOString() });
      clearPendingSpendByType('monthly'); // 결과 저장 완료 → 자동환불 대상 제외
      setShareReportId(rid);
      setPhase('result');
    } catch (e: any) {
      console.error('월별 운세 실패:', e);
      // AI 실패 시 클라이언트에서 즉시 환불
      refundBalance(price);
      clearPendingSpendByType('monthly'); // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
      setPhase('select');
      toast.show(`분석에 실패해서 ${price}운을 돌려드렸어요`, 'warning');
    } finally {
      isAnalyzingRef.current = false;
    }
  }

  // ─── 프로필 선택 + 월 선택 ───
  if (phase === 'select') {
    if (reports.length === 0) {
      return (
        <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
          <Header title="월별 운세" />
          <div className="px-5 pt-8 text-center space-y-4">
            <p className="text-h2 text-text-primary">먼저 사주를 분석해주세요</p>
            <p className="text-body-sm text-text-muted">사주 데이터가 있어야 월별 운세를 볼 수 있어요.</p>
            <Button onClick={() => navigate('/input?from=home_body_monthly')} variant="gold" size="lg" fullWidth>사주 분석하러 가기</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="월별 운세" />
        <FadeIn>
          <ExtensionHero
            theme={EXTENSION_THEME.monthly}
            costLabel={getMonthlyPrice().isOnSale ? `${getMonthlyPrice().regularPrice}운→${getMonthlyPrice().actualPrice}운` : `${getMonthlyPrice().actualPrice}운`}
            sub="원하는 한 달을 골라 깊게 · 상순·중순·하순까지"
            rightLabel="月運 · 한 달의 흐름"
          />
        </FadeIn>
        <div className="px-5 pt-5 space-y-5">
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

          {/* 월 선택 — 이번 달 포함 앞으로 12개월 중 1개 택1 (기본 = 이번 달) */}
          {selected && (
            <FadeIn delay={0.14}>
              <div className="card py-4 px-4">
                <p className="text-h3 text-text-primary mb-1">어느 달을 볼까요?</p>
                <p className="text-[11px] text-text-hint mb-3">이번 달부터 앞으로 12개월 중 한 달을 골라 깊게 풀어드려요.</p>
                <div className="grid grid-cols-3 gap-2">
                  {monthOptions.map((o, i) => {
                    const active = i === monthIdx;
                    return (
                      <button
                        key={`${o.year}-${o.month}`}
                        onClick={() => setMonthIdx(i)}
                        className="py-2.5 rounded-xl text-center transition-all"
                        style={
                          active
                            ? { background: ACCENT, color: '#fff', boxShadow: '0 2px 8px rgba(181,68,31,0.25)' }
                            : { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid rgba(0,0,0,0.06)' }
                        }
                      >
                        <span className="block text-[11px] opacity-70" style={active ? { color: 'rgba(255,255,255,0.85)' } : undefined}>{o.year}</span>
                        <span className="block text-body-sm font-bold">{o.month}월</span>
                        {i === 0 && (
                          <span className="block text-[11px] mt-0.5" style={active ? { color: 'rgba(255,255,255,0.9)' } : { color: ACCENT }}>이번 달</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </FadeIn>
          )}
        </div>
        {selected && (
          <div className="sticky-cta-bottom">
            <Button onClick={startAnalysis} variant="gold" size="lg" fullWidth>
              {monthOptions[monthIdx]?.label} 운세 보기 ({getMonthlyPrice().actualPrice}운)
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── 로딩 ───
  if (phase === 'loading') {
    return <AILoading name={selected?.name} type="월별 운세" sajuData={selected?.sajuData} steps={['선택한 달의 월간지를 짚고 있어요', '상순·중순·하순 흐름을 계산하고 있어요', '맞춤 조언을 작성하고 있어요']} />;
  }

  // ─── 결과 (단일월 심층 — 오늘운세급 MonthlyMockupView) ───
  if (!result) return null;

  const monthLabel = result.month ? `${result.year}년 ${result.month}월` : '';
  const ilganLabel =
    selected?.sajuData?.pillars?.[2]?.천간
      ? `${selected.sajuData.pillars[2].천간읽기 ?? ''}(${selected.sajuData.pillars[2].천간}) 일간`
      : undefined;

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="월별 운세" />
      <FadeIn>
        <MonthlyMockupView
          result={result}
          profile={selected as any}
          monthLabel={monthLabel}
          ilganLabel={ilganLabel}
          onShare={() => setShowShare(true)}
          onChat={async () => {
            // 결과 컨텍스트 영구 저장 (보관함 재진입에도 복원) — Daily/Topic 패턴 정렬
            const { createChatRoom } = await import('@/services/storage/chatStore');
            const ctx = {
              type: 'monthly' as const,
              label: monthLabel ? `${monthLabel} 운세` : '월별 운세',
              fullResult: result,
            };
            const room = createChatRoom(selected?.name || '나', 'free', ctx);
            navigate(`/chat/${room.id}`, { state: { profile: selected, contentContext: ctx } });
          }}
          onTopic={(topicId) => navigate(`/topic/${topicId}`)}
          onTopics={() => navigate('/#home-topics')}
        />
      </FadeIn>

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} name={selected?.name || ''} reportId={shareReportId || 'monthly'} />
    </div>
  );
}
