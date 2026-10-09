import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { ShareModal } from '@/components/share/ShareModal';
import { getProfiles, spendBalance, refundBalance, saveReport, generateId, getReport, markPendingSpend, clearPendingSpendByType, type LocalReport } from '@/services/storage/localStore';
import { generateWeeklyFortune, generateWeeklyDraft2026, generateWeeklyRefine2026 } from '@/services/ai/reportGenerator';
import { isAsyncReviewEnabled } from '@/services/progress/progressId';
import { getWeeklyPrice, getMonthlyPrice } from '@/constants/pricing';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AILoading } from '@/components/common/AILoading';
import { Solar } from 'lunar-javascript';
import { CHEONGAN_KO, JIJI_KO } from '@/constants/oheng';
import type { WeeklyDetailResponse } from '@/types/report';
import { WeeklyMockupView } from './WeeklyMockupView';
import {
  EXTENSION_THEME,
  ExtensionHero,
} from './extension/_chrome';

type Phase = 'select' | 'loading' | 'result';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 일진 간지(한자 '甲子') → 한글 읽기('갑자'). 매핑 없으면 '' (calculator SSOT 재사용). */
function ganjiToKo(ganji: string): string {
  if (!ganji || ganji.length < 2) return '';
  const gan = CHEONGAN_KO[ganji[0]];
  const ji = JIJI_KO[ganji[1]];
  if (!gan || !ji) return '';
  return `${gan}${ji}`;
}

/**
 * weekDays — 롤링 7일 (구매일 '오늘' 전날부터 7일).
 * i ∈ [-1..5] → 어제·오늘·내일·...(7개). 고정 월~일 절대 사용 안 함.
 * 예: 목요일 실행 → 수·목·금·토·일·월·화.
 * 각 일자의 일진 간지는 lunar-javascript: Solar.fromYmd(y,m,d).getLunar().getDayInGanZhi().
 */
function computeWeekDays(): { day: string; date: string; ganji: string; ganjiRead: string }[] {
  const base = new Date();
  const out: { day: string; date: string; ganji: string; ganjiRead: string }[] = [];
  for (let i = -1; i <= 5; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    let ganji = '';
    try {
      ganji = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate()).getLunar().getDayInGanZhi();
    } catch {
      ganji = '';
    }
    out.push({
      day: WEEKDAY_KO[d.getDay()],
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      ganji,
      ganjiRead: ganjiToKo(ganji),
    });
  }
  return out;
}

/** 선택 사주 → 프로필 id. 보관함 재진입(savedReport)은 리포트 id 라 이름·생년월일로 프로필을 역매칭. 못 찾으면 undefined. */
function resolveProfileId(p: LocalReport | null): string | undefined {
  if (!p) return undefined;
  const profiles = getProfiles();
  if (profiles.some((x) => x.id === p.id)) return p.id;
  const i = p.input;
  if (!i) return undefined;
  return profiles.find(
    (x) => x.name === p.name && x.input?.birthYear === i.birthYear && x.input?.birthMonth === i.birthMonth && x.input?.birthDay === i.birthDay,
  )?.id;
}

export function WeeklyPage() {
  usePageTitle('주간운세');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // 보관함에서 저장된 결과를 넘겨받은 경우
  const rawNavState = location.state as { savedResult?: WeeklyDetailResponse; savedReport?: LocalReport; profileId?: string } | undefined;
  // URL ?reportId= 폴백 — state 손실(새로고침/strict mode) 대비.
  const [searchParams] = useSearchParams();
  const reportIdFromUrl = searchParams.get('reportId');
  const reportFromUrl = useMemo(() => {
    if (!reportIdFromUrl) return null;
    try { return getReport(reportIdFromUrl); } catch { return null; }
  }, [reportIdFromUrl]);
  const navState = rawNavState?.savedReport
    ? rawNavState
    : (reportFromUrl ? { savedResult: reportFromUrl.aiResult as WeeklyDetailResponse, savedReport: reportFromUrl } : undefined);

  const [phase, setPhase] = useState<Phase>(navState?.savedResult ? 'result' : 'select');
  // 2026-09-17 — 입력 복귀(?profileId=)·타 콘텐츠 교차 이동(state.profileId) 시 사주 미리 선택
  const [selected, setSelected] = useState<LocalReport | null>(() => {
    if (navState?.savedReport) return navState.savedReport;
    const preId = rawNavState?.profileId || searchParams.get('profileId');
    if (!preId) return null;
    const p = getProfiles().find((x) => x.id === preId);
    return p ? (p as unknown as LocalReport) : null;
  });
  const [result, setResult] = useState<WeeklyDetailResponse | null>(navState?.savedResult || null);
  const [refining, setRefining] = useState(false); // ⚡ async 2차리뷰 — 초안 노출 후 다듬는 중
  const [showShare, setShowShare] = useState(false);
  const [shareReportId, setShareReportId] = useState<string>(navState?.savedReport?.id || '');
  const isAnalyzingRef = useRef(false);

  // 2026-09-17 — 출석 적립 + 일일/연속 보상 (오늘운세·꿈해몽과 동일 · 결과 도달 1회)
  const { mark } = useAttendanceOnResult();
  const attendanceFiredRef = useRef(false);
  useEffect(() => {
    if (phase !== 'result' || !result || attendanceFiredRef.current) return;
    attendanceFiredRef.current = true;
    import('@/services/storage/dailyReward').then((m) => m.processAttendanceRewards()).catch(() => {});
  }, [phase, result]);

  const reports = useMemo(() => getProfiles(), []);

  async function startAnalysis() {
    if (!selected) return;
    if (isAnalyzingRef.current || phase === 'loading') return;
    isAnalyzingRef.current = true;

    // 캐시 미사용 — 주간 윈도우(어제부터 7일)가 매일 이동하므로 contentType-only 캐시는 stale(지난주 데이터).
    //   재조회는 보관함(저장본)으로. 생성은 항상 현재 주 기준 새로. (월운 단일월과 동일 정책)
    const price = getWeeklyPrice().actualPrice; // 2026-06-29 NEW — 주간운세 정가 5운 (SSOT)
    if (!spendBalance(price)) {
      toast.show('잔액이 부족해요', 'warning');
      // 충전 복귀 시 선택 사주 유지 — ChargePage 는 state 를 넘기지 않으므로 query 로 (?profileId 미리 선택)
      navigate(`/charge?need=${price}`, { state: { message: `주간운세에 ${price}운이 필요해요`, returnTo: `/weekly?profileId=${encodeURIComponent((selected as any).id)}` } });
      isAnalyzingRef.current = false;
      return;
    }
    // 측정 — 운 차감 성공 직후 (fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'weekly', amount: price })).catch(() => {});
    // 머니세이프 — 생성 중 앱 종료로 결과 못 받으면 부팅 reconcile 이 자동환불.
    markPendingSpend('weekly', price);
    toast.show(`${price}운이 차감됐어요`, 'info');
    setPhase('loading');

    // 롤링 7일 일진 (어제부터 7일) 계산 → 서버로 전달
    const weekDays = computeWeekDays();

    setRefining(false);
    try {
      if (isAsyncReviewEnabled()) {
        // ⚡ async 2차리뷰 — 1차(draft) 즉시 노출 → 2차(refine) 백그라운드. 체감 로딩 반토막.
        const draftRes = await generateWeeklyDraft2026(selected.sajuData, weekDays);
        const rid = draftRes.reportId || generateId();
        setResult(draftRes.content);
        saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'weekly', aiResult: draftRes.content, createdAt: new Date().toISOString() });
        clearPendingSpendByType('weekly'); // draft = 결과 커밋(부팅 자동환불 제외)
        setShareReportId(rid);
        setRefining(true);
        setPhase('result');
        // 이벤트 v4 · 출석 마커 (KST 당일 1회 · 세션 dedupe)
        mark().catch(() => {/* non-blocking */});
        // 백그라운드 2차 보정 — 실패해도 draft 유지(무해·무차감이라 환불 X)
        void generateWeeklyRefine2026(selected.sajuData, weekDays, draftRes.content, rid)
          .then((ref) => {
            if (ref?.content) {
              setResult(ref.content);
              saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'weekly', aiResult: ref.content, createdAt: new Date().toISOString() });
            }
          })
          .catch((err) => console.warn('주간 보정 실패(초안 유지):', err))
          .finally(() => setRefining(false));
      } else {
        const res = await generateWeeklyFortune(selected.sajuData, weekDays);
        setResult(res.content);
        const rid = res.reportId || generateId();
        saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'weekly', aiResult: res.content, createdAt: new Date().toISOString() });
        clearPendingSpendByType('weekly'); // 결과 저장 완료 → 자동환불 대상 제외
        setShareReportId(rid);
        setPhase('result');
        mark().catch(() => {/* non-blocking */});
      }
    } catch (e: any) {
      console.error('주간운세 실패:', e);
      // AI 실패 시 클라이언트에서 즉시 환불
      refundBalance(price);
      clearPendingSpendByType('weekly'); // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
      setPhase('select');
      toast.show(`분석에 실패해서 ${price}운을 돌려드렸어요`, 'warning');
    } finally {
      isAnalyzingRef.current = false;
    }
  }

  // ─── 프로필 선택 ───
  if (phase === 'select') {
    if (reports.length === 0) {
      return (
        <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
          <Header title="주간운세" />
          <div className="px-5 pt-8 text-center space-y-4">
            <p className="text-h2 text-text-primary">먼저 사주를 분석해주세요</p>
            <p className="text-body-sm text-text-muted">사주 데이터가 있어야 주간운세를 볼 수 있어요.</p>
            <Button onClick={() => navigate('/input?from=home_body_weekly')} variant="gold" size="lg" fullWidth>사주 분석하러 가기</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen pb-tab-safe" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="주간운세" />
        <FadeIn>
          <ExtensionHero
            theme={EXTENSION_THEME.weekly}
            costLabel={getWeeklyPrice().isOnSale ? `${getWeeklyPrice().regularPrice}운→${getWeeklyPrice().actualPrice}운` : `${getWeeklyPrice().actualPrice}운`}
            eventLabel={getWeeklyPrice().isOnSale ? `이벤트 · ~${Number((getWeeklyPrice().saleEndDate || '').slice(5, 7))}/${Number((getWeeklyPrice().saleEndDate || '').slice(8, 10))}` : undefined}
            sub="오늘부터 7일 · 좋은 날과 조심할 날을 한눈에"
            rightLabel="週 · 오늘부터 7일"
          />
        </FadeIn>
        <div className="px-5 pt-5 space-y-5">
          <FadeIn delay={0.05}>
            <ProfilePicker onSelect={p => setSelected(p as unknown as LocalReport)} onNew={() => navigate('/input?new=1')} title="누구의 주간운세를 볼까요?" />
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
            <Button onClick={startAnalysis} variant="gold" size="lg" fullWidth>주간운세 보기 ({getWeeklyPrice().actualPrice}운)</Button>
          </div>
        )}
      </div>
    );
  }

  // ─── 로딩 ───
  if (phase === 'loading') {
    return <AILoading name={selected?.name} type="주간운세" sajuData={selected?.sajuData} steps={['이번 주 일진을 짚고 있어요', '요일별 운세 점수를 계산하고 있어요', '이번 주 핵심일을 찾고 있어요']} estimatedSeconds={50} />;
  }

  // ─── 결과 ───
  if (!result || !selected) return null;

  const days = Array.isArray(result.dailyBreakdown) ? result.dailyBreakdown : [];
  const periodLabel = days.length > 0 ? `${days[0].date} ~ ${days[days.length - 1].date}` : '';
  // 교차 CTA(월운세) 가격 — SSOT getMonthlyPrice (세일 시 정가→세일가)
  const monthlyPricing = getMonthlyPrice();
  const monthlyPriceLabel = monthlyPricing.isOnSale
    ? `${monthlyPricing.regularPrice}운→${monthlyPricing.actualPrice}운`
    : `${monthlyPricing.actualPrice}운`;

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="주간운세" />

      <WeeklyMockupView
        result={result}
        profile={selected}
        refining={refining}
        periodLabel={periodLabel}
        onChat={async () => {
          // 2026-09-17 fix — 기존 navigate('/chat') 은 목록으로만 가고 결과가 전달되지 않았음.
          //   월간과 동일하게 결과 컨텍스트를 방에 영구 저장 후 해당 방으로 직행 (보관함 재진입에도 복원).
          const { createChatRoom } = await import('@/services/storage/chatStore');
          const ctx = {
            type: 'weekly' as const,
            label: '주간운세',
            periodLabel,
            fullResult: result,
          };
          const room = createChatRoom(selected?.name || '나', 'free', ctx);
          navigate(`/chat/${room.id}`, { state: { profile: selected, contentContext: ctx } });
        }}
        onShare={() => setShowShare(true)}
        onMonthly={() => navigate('/monthly', { state: { profileId: resolveProfileId(selected) } })}
        monthlyPriceLabel={monthlyPriceLabel}
      />

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} name={selected?.name || ''} reportId={shareReportId || 'weekly'} />
    </div>
  );
}
