import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { FadeIn } from '@/components/common/FadeIn';
import { Button } from '@/components/common/Button';
import { ProfilePicker } from '@/components/common/ProfilePicker';
import { ShareModal } from '@/components/share/ShareModal';
import { getProfiles, spendBalance, refundBalance, saveReport, generateId, getReport, markPendingSpend, clearPendingSpendByType, type LocalReport } from '@/services/storage/localStore';
import { generateMonthlyFortune2026, generateMonthlyDraft2026, generateMonthlyRefine2026, type MonthInfo } from '@/services/ai/reportGenerator';
import { subscribeProgress } from '@/services/progress/progressClient';
import { makeProgressId, isProgressiveEnabled, isAsyncReviewEnabled } from '@/services/progress/progressId';
import { getMonthlyPrice } from '@/constants/pricing';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
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
 * 선택 가능한 13개월 — 지난 6개월 + 이번 달 + 앞으로 6개월 (예: 7월이면 1월~내년 1월).
 * 지난 달은 과거형 회고(서버 시제 룰), 미래 달은 미래형. 기본 선택 = 이번 달.
 * 7/31에 사도 8월 고르면 손해 0 · 지난 5월 회고도 가능.
 */
function buildMonthOptions(): { year: number; month: number; label: string; isPast: boolean; isCurrent: boolean }[] {
  const base = new Date();
  const out: { year: number; month: number; label: string; isPast: boolean; isCurrent: boolean }[] = [];
  for (let i = -6; i <= 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    out.push({ year, month, label: `${year}년 ${month}월`, isPast: i < 0, isCurrent: i === 0 });
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

export function MonthlyPage() {
  usePageTitle('월별 운세');
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // 보관함에서 저장된 결과를 넘겨받은 경우
  const rawNavState = location.state as { savedResult?: MonthlyDetailResponse; savedReport?: LocalReport; profileId?: string } | undefined;
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
  // 2026-09-17 — 입력 복귀(?profileId=)·주간운세 교차 이동(state.profileId) 시 사주 미리 선택
  const [selected, setSelected] = useState<LocalReport | null>(() => {
    if (navState?.savedReport) return navState.savedReport;
    const preId = rawNavState?.profileId || searchParams.get('profileId');
    if (!preId) return null;
    const p = getProfiles().find((x) => x.id === preId);
    return p ? (p as unknown as LocalReport) : null;
  });
  const [result, setResult] = useState<MonthlyDetailResponse | null>(navState?.savedResult || null);
  // 🛡️ 점진 로딩 — M1/M2 그룹이 도착하는 대로 누적(부분). 최종 result 도착 전 조기 렌더용.
  const [partial, setPartial] = useState<Partial<MonthlyDetailResponse> | null>(null);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);
  // ⚡ async 2차리뷰 — draft 노출 후 refine(2차) 백그라운드 진행 중 표시 ("다듬는 중")
  const [refining, setRefining] = useState(false);
  // 선택한 달 인덱스 (monthOptions 기준) — 기본 = 이번 달 (과거6+현재+미래6 배열의 현재월 위치)
  const [monthIdx, setMonthIdx] = useState(() => {
    const i = monthOptions.findIndex((o) => o.isCurrent);
    return i >= 0 ? i : 6;
  });
  const [showShare, setShowShare] = useState(false);
  const [shareReportId, setShareReportId] = useState<string>(navState?.savedReport?.id || '');
  const isAnalyzingRef = useRef(false);

  // 2026-09-17 — 출석 적립 + 일일/연속 보상 (오늘운세·꿈해몽과 동일 · 결과 도달 1회).
  //   점진 로딩(partial)만 도착한 상태는 제외 — 이후 실패·환불될 수 있어 최종/초안 result 도착 시점에만.
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

    // ★머니패스(차감 금액 7) — 절대 변경 금지. 이미 7운으로 맞춰져 있음.
    const price = getMonthlyPrice().actualPrice; // 월운 정가 7운 (SSOT)
    if (!spendBalance(price)) {
      toast.show('잔액이 부족해요', 'warning');
      // 충전 복귀 시 선택 사주 유지 — ChargePage 는 state 를 넘기지 않으므로 query 로 (?profileId 미리 선택)
      navigate(`/charge?need=${price}`, { state: { message: `월별 운세에 ${price}운이 필요해요`, returnTo: `/monthly?profileId=${encodeURIComponent((selected as any).id)}` } });
      isAnalyzingRef.current = false;
      return;
    }
    // 측정 — 운 차감 성공 직후 (fire-and-forget)
    import('@/services/analytics').then((a) => a.trackEvent('content_purchase', { type: 'monthly', amount: price })).catch(() => {});
    // 머니세이프 — 생성 중 앱 종료로 결과 못 받으면 부팅 reconcile 이 자동환불.
    markPendingSpend('monthly', price);
    toast.show(`${price}운이 차감됐어요`, 'info');
    setPartial(null);
    setPhase('loading');

    // 선택월 간지 계산 → 서버로 전달 (서버는 간지 추측 X · 만세력 정확성)
    const opt = monthOptions[monthIdx] ?? monthOptions[0];
    const monthInfo = computeMonthInfo(opt.year, opt.month);

    // 🛡️ 점진 로딩(additive) — M1(흐름) 도착 시 결과창 조기 진입 + M2 스켈레톤.
    //   구독 실패/OFF 면 아무 일도 안 일어나고 기존대로 완성본 도착 후 진입(폴백). 머니 로직 무관.
    const progressId = isProgressiveEnabled() ? makeProgressId() : undefined;
    if (progressId) {
      subRef.current?.unsubscribe();
      subRef.current = subscribeProgress(progressId, {
        onGroup: (_key, data) => {
          setPartial((prev) => ({ ...(prev || {}), ...(data as object) }));
          setPhase((p) => (p === 'loading' ? 'result' : p)); // 첫 그룹 도착 → 조기 진입
        },
      });
    }

    setRefining(false);
    try {
      if (isAsyncReviewEnabled()) {
        // ⚡ async 2차리뷰 — 1차(draft) 즉시 노출 → 2차(refine) 백그라운드. 체감 로딩 반토막.
        const draftRes = await generateMonthlyDraft2026(selected.sajuData, monthInfo);
        const rid = draftRes.reportId || generateId();
        setResult(draftRes.content);
        saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'monthly', aiResult: draftRes.content, createdAt: new Date().toISOString() });
        clearPendingSpendByType('monthly'); // draft = 결과 커밋(부팅 자동환불 제외)
        setShareReportId(rid);
        setRefining(true);
        setPhase('result');
        // 이벤트 v4 · 출석 마커 (KST 당일 1회 · 세션 dedupe)
        mark().catch(() => {/* non-blocking */});
        // 백그라운드 2차 보정 — 실패해도 draft 유지(무해·무차감이라 환불 X)
        void generateMonthlyRefine2026(selected.sajuData, monthInfo, draftRes.content, rid)
          .then((ref) => {
            if (ref?.content) {
              setResult(ref.content);
              saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'monthly', aiResult: ref.content, createdAt: new Date().toISOString() });
            }
          })
          .catch((err) => console.warn('월별 보정 실패(초안 유지):', err))
          .finally(() => setRefining(false));
      } else {
        const res = await generateMonthlyFortune2026(selected.sajuData, monthInfo, progressId);
        setResult(res.content);
        const rid = res.reportId || generateId();
        saveReport({ id: rid, name: selected.name, input: selected.input, sajuData: selected.sajuData, type: 'paid', contentType: 'monthly', aiResult: res.content, createdAt: new Date().toISOString() });
        clearPendingSpendByType('monthly'); // 결과 저장 완료 → 자동환불 대상 제외
        setShareReportId(rid);
        setPhase('result');
        mark().catch(() => {/* non-blocking */});
      }
    } catch (e: any) {
      console.error('월별 운세 실패:', e);
      // AI 실패 시 클라이언트에서 즉시 환불
      refundBalance(price);
      clearPendingSpendByType('monthly'); // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
      setPartial(null);
      setPhase('select');
      toast.show(`분석에 실패해서 ${price}운을 돌려드렸어요`, 'warning');
    } finally {
      subRef.current?.unsubscribe();
      subRef.current = null;
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
            eventLabel={getMonthlyPrice().isOnSale ? `이벤트 · ~${Number((getMonthlyPrice().saleEndDate || '').slice(5, 7))}/${Number((getMonthlyPrice().saleEndDate || '').slice(8, 10))}` : undefined}
            sub="원하는 한 달을 골라 깊게 · 상순·중순·하순까지"
            rightLabel="月運 · 한 달의 흐름"
          />
        </FadeIn>
        <div className="px-5 pt-5 space-y-5">
          {/* 프로필 미선택 시에만 피커 — 선택하면 월 선택이 메인 콘텐츠가 되어 눈에 확 띄게 */}
          {!selected && (
            <FadeIn delay={0.05}>
              <ProfilePicker onSelect={p => setSelected(p as unknown as LocalReport)} onNew={() => navigate('/input?new=1')} title="누구의 월별 운세를 볼까요?" />
            </FadeIn>
          )}
          {selected && (
            <>
              <FadeIn delay={0.05}>
                <div className="card-gold py-3 px-4 flex items-center justify-between">
                  <p className="text-body-sm text-text-primary"><span className="font-bold">{selected.name}</span>님 선택됨</p>
                  <button onClick={() => setSelected(null)} className="text-caption text-text-muted">변경</button>
                </div>
              </FadeIn>

              {/* 월 선택 — 프로필 선택 후 메인 콘텐츠. 과거 6 + 이번 달 + 미래 6 (강조 테두리로 눈에 띄게) */}
              <FadeIn delay={0.1}>
                <div className="card py-4 px-4" style={{ border: `1.5px solid ${ACCENT}` }}>
                  <p className="text-h3 text-text-primary mb-1">어느 달의 운세를 볼까요?</p>
                  <p className="text-[11px] text-text-hint mb-3">지난 6개월부터 앞으로 6개월까지 — 원하는 달을 골라 깊게 풀어드려요. <span style={{ color: ACCENT, fontWeight: 700 }}>지난 달은 회고, 앞으로는 미래 흐름</span>으로 읽어드려요.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {monthOptions.map((o, i) => {
                      const active = i === monthIdx;
                      return (
                        <button
                          key={`${o.year}-${o.month}`}
                          onClick={() => setMonthIdx(i)}
                          className="py-2.5 rounded-xl text-center transition-all relative"
                          style={
                            active
                              ? { background: ACCENT, color: '#fff', boxShadow: '0 2px 8px rgba(181,68,31,0.25)' }
                              : { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid rgba(0,0,0,0.06)', opacity: o.isPast ? 0.72 : 1 }
                          }
                        >
                          <span className="block text-[11px] opacity-70" style={active ? { color: 'rgba(255,255,255,0.85)' } : undefined}>{o.year}</span>
                          <span className="block text-body-sm font-bold">{o.month}월</span>
                          {o.isCurrent && (
                            <span className="block text-[11px] mt-0.5" style={active ? { color: 'rgba(255,255,255,0.9)' } : { color: ACCENT }}>이번 달</span>
                          )}
                          {o.isPast && (
                            <span className="block text-[11px] mt-0.5" style={active ? { color: 'rgba(255,255,255,0.85)' } : { color: 'var(--text-muted)' }}>지난 달</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </FadeIn>
            </>
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
  //   점진: 최종 result 우선, 없으면 partial(M1 등 도착분). loading=true 면 미도착 섹션 스켈레톤.
  const view = (result ?? partial) as MonthlyDetailResponse | null;
  if (!view) return null;

  const monthLabel = view.month ? `${view.year}년 ${view.month}월` : (monthOptions[monthIdx]?.label || '');
  const ilganLabel =
    selected?.sajuData?.pillars?.[2]?.천간
      ? `${selected.sajuData.pillars[2].천간읽기 ?? ''}(${selected.sajuData.pillars[2].천간}) 일간`
      : undefined;

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-page-gradient)' }}>
      <Header title="월별 운세" />
      <FadeIn>
        <MonthlyMockupView
          result={view}
          loading={!result}
          refining={refining}
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
              fullResult: (result ?? view),
            };
            const room = createChatRoom(selected?.name || '나', 'free', ctx);
            navigate(`/chat/${room.id}`, { state: { profile: selected, contentContext: ctx } });
          }}
          onTopic={(topicId) => {
            // 2026-09-17 — 공용 계약: 주제 페이지가 같은 사주를 미리 선택하도록 profileId 전달
            navigate(`/topic/${topicId}`, { state: { profileId: resolveProfileId(selected) } });
          }}
          onTopics={() => navigate('/#home-topics')}
        />
      </FadeIn>

      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} name={selected?.name || ''} reportId={shareReportId || 'monthly'} />
    </div>
  );
}
