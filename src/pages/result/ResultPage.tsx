// Phase A (#54) — slimmed main from ResultPage.tsx (lines 2278-3420)
// Phase C (#54) — props 시그니처 + L1~L4 블러 분기 + 블러 해제 애니메이션 + 4 chrome mount
// Main component only — types/atoms/visuals/chrome extracted to siblings

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasNativeNavBack } from '@/lib/env';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import { computeTopicScores } from '@/utils/sajuScores';
import { useSajuContext } from '@/contexts/SajuContext';
import { Header } from '@/components/layout/Header';
import { ErrorState } from '@/components/common/ErrorState';
import { FooterCTA } from '@/components/common/FooterCTA';
import { ReviewAsk } from '@/components/common/ReviewAsk';
import { useToast } from '@/components/common/Toast';
import { AILoading } from '@/components/common/AILoading';
import {
  getReport, getReports, getMyProfile, saveReport, refundBalance,
  type LocalReport,
} from '@/services/storage/localStore';
// 2026-05-29 C1 fix — 프리미엄 SSE 실패 시 환불 금액 산정 (세일 반영).
import { getPremiumPrice } from '@/constants/pricing';
import type { OhengType } from '@/types/saju';
import {
  getDemoData,
  mapPillars, mapElements, mapUnyoung12, mapDaeun, mapNapeum, mapSinSal, mapGongmang,
  getUnyoungSummary, getUnyoungEnergyLevel, getUnyoungPositionContext,
  getDaeunCurrentSummary, getNapeumSummary, getNapeumPositionRole, getNapeumPracticalTip,
  getGilsinActionTip, getHyungsalActionTip,
  EC, EHAN, EKR,
  type ElemKey,
} from './_data';
import { LocalFadeIn, ScoreRing, PillarCard } from './_atoms';
import { ReportSection, type SectionData } from './_visuals';
import {
  PaywallBar,
  ShareSheet,
  UpsellCard,
  AdBanner,
  BlurredSection,
  resolveUnlockTarget,
  type UpsellContentType,
  type UnlockContentKey,
} from './_ui_chrome';
import { PremiumResult } from './types/PremiumResult';

/** 2026-10-09 — 종합사주 그룹 점진 머지. 그룹마다 sections·sectionConclusions 가 따로 오므로 spread 만 하면
 *  나중 그룹 sections 가 앞 그룹 것을 덮는다(§02 본문이 사라졌다 다시 나타남). id 기준 합치고 정통 순서로 정렬. */
const PREMIUM_SECTION_ORDER = ['summary', 'structure', 'sipsung', 'yongsin', 'daeun', 'yearly', 'shinsal', 'practice'];
function mergePremiumGroup(prev: any, data: any): any {
  const p = prev || {};
  const d = data || {};
  const secs: any[] = Array.isArray(p.sections) ? [...p.sections] : [];
  for (const sec of Array.isArray(d.sections) ? d.sections : []) {
    const i = secs.findIndex((x: any) => x?.id && x.id === sec?.id);
    if (i >= 0) secs[i] = sec; else secs.push(sec);
  }
  const rank = (x: any) => { const r = PREMIUM_SECTION_ORDER.indexOf(String(x?.id || '')); return r < 0 ? 99 : r; };
  secs.sort((a: any, b: any) => rank(a) - rank(b));
  return {
    ...p,
    ...d,
    sections: secs,
    sectionConclusions: { ...(p.sectionConclusions || {}), ...(d.sectionConclusions || {}) },
  };
}
import { ResultErrorBoundary } from '@/components/common/ResultErrorBoundary';

/* ══════════════════════════════════════════════════════════════════
 * Phase C — Props 시그니처 + 결과 게이트 도출 (서버 기반, 클라이언트 임시 unlock 금지)
 * ═════════════════════════════════════════════════════════════════ */
export interface ResultPageProps {
  /** 외부 강제 — 미지정 시 report.type 기반 자체 도출 */
  tier?: 'free' | 'paid';
  /** 외부 강제 — 미지정 시 tier === 'free' 기반 자체 도출 */
  locked?: boolean;
  /** 외부 강제 — 미지정 시 tier === 'free' 자동 도출 */
  adEligible?: boolean;
}

interface ResultGate {
  tier: 'free' | 'paid';
  locked: boolean;
  adEligible: boolean;
  /** UpsellCard 카피 매핑용 */
  upsellType: UpsellContentType;
}

/**
 * 서버 응답 게이트 — Sprint 1 #20 E13 status === 'confirmed' 활용
 *  - report.type === 'paid' → tier='paid', locked=false (결제 완료, 전체 해제)
 *  - 그 외 → tier='free', locked=true (미결제, L3·L4 블러)
 *  - 클라이언트 임시 unlock state 금지 (locked는 useState 아닌 useMemo)
 */
/* ══════════════════════════════════════════════════════════════════
 * Premium 모드 다크 헤더 — HeroCard 다크 그라디언트와 자연스럽게 연결
 *  · 좌: 뒤로(←) / 우: 공유 버튼 / 가운데: 비움 (HeroCard 가 이름·일간 자체 보유)
 *  · sticky top + 골드 라인 하단 (사주대화 헤더 톤 정렬)
 * ═════════════════════════════════════════════════════════════════ */
function PremiumDarkHeader({
  name,
  onShareTap: _onShareTap,
}: {
  name?: string;
  onShareTap: () => void;
}) {
  // mockup .header 진본 — 좌: ← / 중: title + sub / 우: badge "10운"
  return (
    <header
      style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #2a2520 100%)',
        color: '#fff',
        padding: '14px 20px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid rgba(212,175,55,0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* 앱인토스: 토스 내비바 뒤로가기와 중복 → 숨김 (2026-09-16 심사 반려 · env.ts hasNativeNavBack) */}
      {!hasNativeNavBack && (
        <button
          type="button"
          onClick={() => window.history.back()}
          aria-label="뒤로"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            opacity: 0.85,
            fontSize: 22,
            lineHeight: 1,
            padding: '4px 6px',
            cursor: 'pointer',
          }}
        >
          ←
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 0,
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name ? `${name} 님의 사주 풀이` : '사주 풀이'}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#E8D9B8',
            marginTop: 2,
            letterSpacing: '0.05em',
          }}
        >
          PREMIUM · 10섹션 종합 풀이
        </div>
      </div>
      <div
        style={{
          background: 'linear-gradient(135deg, #E8D9B8 0%, #B8965A 100%)',
          color: '#1a1a1a',
          fontSize: 10,
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: 100,
          letterSpacing: '0.08em',
          flexShrink: 0,
        }}
      >
        {getPremiumPrice().actualPrice}운
      </div>
    </header>
  );
}

function deriveResultGate(report: LocalReport | null): ResultGate {
  const tier: 'free' | 'paid' = report?.type === 'paid' ? 'paid' : 'free';
  const locked = tier === 'free';
  const adEligible = tier === 'free';

  // UpsellCard 카피 매핑 (paid 결과에만 노출)
  const ct = report?.contentType ?? 'report';
  let upsellType: UpsellContentType = 'report';
  if (ct === 'topic') upsellType = 'topic';
  else if (ct === 'daeun') upsellType = 'daewoon';
  else if (ct === 'monthly') upsellType = 'wolun';
  else if (ct === 'compat') upsellType = 'gunghap';
  else if (ct === 'tojung') upsellType = 'tojeong';
  else if (ct === 'deepDream') upsellType = 'dream_paid';

  return { tier, locked, adEligible, upsellType };
}

// ─── MAIN PAGE ───
export function ResultPage(props: ResultPageProps = {}) {
  const { sajuData: ctxData, input: ctxInput } = useSajuContext();
  const reportId = window.location.pathname.split('/').pop() || 'local';
  const { mark: markAttendance } = useAttendanceOnResult();
  const navigate = useNavigate();
  const toast = useToast();
  // P0-3 (2026-06-22) — 결제 결과가 로컬에 없을 때 서버 자동복원 트리거 + 복원 후 리렌더용.
  const [restoreTick, setRestoreTick] = useState(0);
  const restoreAttemptedRef = useRef(false);
  // 2026-07-14 P0 CS — 서버 복원 시도가 끝났는지. 끝났는데도 리포트가 없으면 '빈 페이지' 대신 복구 화면.
  const [restoreSettled, setRestoreSettled] = useState(false);

  // 이벤트 v4 · 출석·프로모 — 2026-10-03: 실제 결과가 화면에 있을 때만 (아래 attendanceFiredRef effect).
  //   기존엔 마운트 즉시 실행 → 없는 결과 주소('결과를 불러오지 못했어요')에서도 출석·0.1운이 적립됐다
  //   (출석은 7일 토스포인트 100원 조건이라 돈 경로).
  const attendanceFiredRef = useRef(false);

  // /result/local 진입 차단 — 옛날 legacy layout 폴백 노출 방지 (사용자 강력 요청)
  // 이 경로는 LoadingPage 에러 폴백으로만 진입 가능했으나 폴백 자체 제거됨
  // 직접 URL 입력 등으로 진입 시 → 홈으로 리다이렉트
  useEffect(() => {
    if (reportId === 'local') {
      navigate('/', { replace: true });
    }
  }, [reportId, navigate]);

  // 🚨 P0-3 (2026-06-22) — 결제 결과가 로컬에 없으면(기기 저장소 비워짐 등) 서버에서 자동 복원.
  //   기존: getReport(id)===null 이면 데모/타프로필로 폴백 → "결제했는데 결과 안 보임/엉뚱한 화면".
  //   이제 진입 즉시 restoreLibraryFromServer 로 본문까지 복원 후 재조회(리렌더). fresh(새 생성)·local 제외.
  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    if (!reportId || reportId === 'local') return;
    if (/[?&]fresh=1\b/.test(window.location.search)) { setRestoreSettled(true); return; } // 새 생성 모드는 복원 대상 아님
    if (getReport(reportId)) { setRestoreSettled(true); return; } // 이미 로컬에 있으면 복원 불필요
    restoreAttemptedRef.current = true;
    // 🚨 복원이 영영 안 끝나도(네트워크 순단·익명 인증 대기로 callable 이 pending 유지) 유저가
    //   빈 페이지에 갇히지 않도록 상한을 둔다 → 상한 초과 시 '결과 복구' 화면으로 전환.
    const settleTimer = setTimeout(() => setRestoreSettled(true), 6000);
    import('@/services/storage/firestoreSync')
      .then(({ restoreLibraryFromServer }) => restoreLibraryFromServer())
      .then((n) => { if (n > 0) setRestoreTick((t) => t + 1); })
      .catch(() => { /* 복원 실패 — 아래 '결과 복구' 화면이 받는다 */ })
      .finally(() => { clearTimeout(settleTimer); setRestoreSettled(true); });
    return () => clearTimeout(settleTimer);
  }, [reportId]);

  /** 서버 재복원 수동 재시도 (복구 화면의 버튼) */
  const retryRestore = useCallback(() => {
    setRestoreSettled(false);
    import('@/services/storage/firestoreSync')
      .then(({ restoreLibraryFromServer }) => restoreLibraryFromServer())
      .then((n) => {
        if (n > 0) { setRestoreTick((t) => t + 1); toast.show('결과를 복구했어요', 'success'); }
        else toast.show('복구할 결과를 찾지 못했어요', 'warning');
      })
      .catch(() => toast.show('복구에 실패했어요. 잠시 후 다시 시도해주세요', 'warning'))
      .finally(() => setRestoreSettled(true));
  }, [toast]);

  const sajuData = useMemo(() => {
    // 1. Context에 데이터 있으면 사용 (InputPage → Loading → Result 플로우)
    if (ctxData) return ctxData;
    // 2. URL의 리포트 ID로 localStorage에서 조회 (보관함에서 클릭 등)
    if (reportId && reportId !== 'local') {
      const report = getReport(reportId);
      if (report) return report.sajuData;
    }
    // 3. 내 프로필 우선, 없으면 최근 리포트
    const myProfile = getMyProfile();
    if (myProfile) return myProfile.sajuData;
    const reports = getReports();
    if (reports.length > 0) return reports[0].sajuData;
    // 4. 데모 데이터
    try { return getDemoData(); } catch { return null; }
    // restoreTick: P0-3 서버 복원 성공 시 재평가 → getReport(reportId) 가 복원분을 집음
  }, [ctxData, reportId, restoreTick]);

  if (!sajuData) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="사주 리포트" />
        <ErrorState
          title="데이터를 불러올 수 없어요"
          description="사주 입력 후 다시 시도해주세요"
          onRetry={() => navigate('/input')}
        />
      </div>
    );
  }

  // 이름/입력: context → localStorage → 사주데이터 내장 → 기본값
  const loadedReport = reportId ? getReport(reportId) : null;

  /* ── Phase 3 (2026-05-27) · Fresh SSE 모드 — 오늘의 운세 패턴
   *   결제 직진 진입(`/result/:id?fresh=1&type=premium|basic`) 시 ResultPage 가
   *   직접 SSE 구동 → 그룹 도착마다 점진 렌더. PremiumResult 가 partial-safe
   *   (`aiResult ?? {}` + 모든 sub-component 방어) 라 빈 객체로 시작해도 안전. */
  const _qs = window.location.search;
  const isFreshMode = /[?&]fresh=1\b/.test(_qs);
  const freshType: 'premium' | 'basic' = /[?&]type=premium\b/.test(_qs) ? 'premium' : 'basic';
  const [streamingAiResult, setStreamingAiResult] = useState<any>(isFreshMode ? {} : null);
  // 2026-06-02 QA — 그룹 도착 추적 (A/B/C). 미도착 그룹 자리에 포맷 스켈레톤 렌더 → "툭 튀어나옴" 제거.
  const [arrivedGroups, setArrivedGroups] = useState<Record<'A' | 'D' | 'B' | 'C', boolean>>({ A: false, D: false, B: false, C: false });
  // 2026-05-29 C1 fix — SSE 실패 시 환불 + 에러 카드. (기존: onError 가 __error 만 set → 환불 0 + AILoading 영구 멈춤)
  const [streamError, setStreamError] = useState<string | null>(null);
  const refundedRef = useRef(false);
  const streamStartedRef = useRef(false);
  const streamSettledRef = useRef(false); // 2026-06-22 — onDone(성공)·환불(실패) 중 settle 됐는지 (워치독 가드)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // streamingAiResult 최신값을 effect 의 async 클로저에서 안전하게 읽기 위한 ref 미러
  const streamingAiResultRef = useRef<any>(streamingAiResult);
  useEffect(() => { streamingAiResultRef.current = streamingAiResult; }, [streamingAiResult]);

  // 2026-07-01 — 완성본 전달 공통 경로 (SSE onDone · 앱인토스 callable · recovery 모두 이걸로). 한 번만.
  const deliverReport = useCallback((finalAi: any) => {
    if (streamSettledRef.current) return;
    streamSettledRef.current = true;
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    setStreamingAiResult(finalAi);
    setArrivedGroups({ A: true, D: true, B: true, C: true });
    try {
      saveReport({
        id: reportId,
        name: (sajuData as any)?.input?.name || '나',
        input: (sajuData as any)?.input,
        sajuData: sajuData as any,
        type: 'paid',
        contentType: 'report',
        createdAt: new Date().toISOString(),
        aiResult: finalAi as any,
      });
      // 결과 영속 완료 → premium pending 해제 (부팅 자동환불 대상 제외)
      import('@/services/storage/localStore').then(m => m.clearPendingSpendByType('premium')).catch(() => {});
    } catch { /* noop — UI 는 streamingAiResult 로 이미 렌더됨 */ }
    // URL 정리 (fresh 쿼리 제거 — 새로고침 시 재생성 방지)
    navigate(window.location.pathname, { replace: true });
  }, [reportId, sajuData, navigate]);

  // 차감액 산정: premium = 세일 반영 actualPrice, basic = 1운. 1회만 환불 (refundedRef 가드).
  // 🚨 2026-07-01 — 환불 전에 recovery 먼저: 서버가 이미 완성·저장(generatePremiumReportStream recovery 블롭)했으면
  //   재생성 0 으로 그대로 전달 → "서버 성공·전달 실패 → 환불+'분석실패'+토큰낭비" 근본 차단(준기 지적).
  const handleStreamFailure = useCallback(async (_msg: string) => {
    if (streamSettledRef.current || refundedRef.current) return;
    if (freshType === 'premium') {
      try {
        const { recoverPremiumResult } = await import('@/services/ai/reportGenerator');
        const rec = await recoverPremiumResult();
        const recOk = !!(rec?.found && rec.content) && (() => {
          try { return !!rec.sajuData?.pillars && JSON.stringify(rec.sajuData.pillars) === JSON.stringify((sajuData as any)?.pillars); }
          catch { return false; }
        })();
        if (recOk && !streamSettledRef.current && !refundedRef.current) {
          deliverReport({ ...(rec.content as any), tier: 'premium' as const });
          return; // 환불 X — 유저는 이미 만든 결과를 받음 (토큰 회수)
        }
      } catch { /* noop → 환불로 진행 */ }
    }
    if (streamSettledRef.current || refundedRef.current) return;
    refundedRef.current = true;
    streamSettledRef.current = true;
    if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; }
    const refundAmount = freshType === 'premium' ? getPremiumPrice().actualPrice : 1;
    try { refundBalance(refundAmount); } catch { /* noop */ }
    // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
    import('@/services/storage/localStore').then(m => m.clearPendingSpendByType('premium')).catch(() => {});
    setStreamError(`분석에 실패해서 ${refundAmount}운을 돌려드렸어요. 잠시 후 다시 시도해주세요.`);
  }, [freshType, sajuData, deliverReport]);

  useEffect(() => {
    if (!isFreshMode || loadedReport || streamStartedRef.current || !sajuData) return;
    streamStartedRef.current = true;
    // 🚨 2026-06-22 CRITICAL — wall-clock 워치독(최종 안전망). 연결 hang(reader 무한대기)·부분그룹 도착 후
    //   멈춤 등 gotTerminal/catch 가 못 잡는 '진짜 멈춤'에서, 완료/실패 신호가 전혀 없으면 강제
    //   실패처리(환불 + 에러카드) → "로딩만 길고 결과 안 나옴" 영구 멈춤을 근본 차단.
    // 2026-06-24 — 180→120초 단축. 정상 종합사주 생성 상한 ~80-90초라 120초는 정상을 안 자르고 끊김 꼬리만 컷
    //   (토스 P99 로딩 150초 = 끊긴 채 워치독까지 매달린 값 → 천장을 120초로 낮춰 P99 직접 절감).
    watchdogRef.current = setTimeout(() => {
      if (!streamSettledRef.current) handleStreamFailure('시간 초과 — 응답이 너무 오래 걸렸어요');
    }, 120000);
    (async () => {
      try {
        const mod = await import('@/services/ai/reportGenerator');
        // 🚨 2026-07-01 — 토스 웹뷰는 장시간 SSE 스트림을 조기종료(종합사주 "안 나옴"·토큰낭비 직접 원인).
        //   앱인토스는 SSE 끄고 안정적 callable(단일 요청·완성본 한 번에)로 직행. 웹만 SSE(점진 렌더) 유지.
        const { isAppsInToss } = await import('@/services/payment/iapService');
        if (freshType === 'premium' && isAppsInToss()) {
          // callable await 는 self-bounding(완료/타임아웃 시 resolve/throw) → SSE용 120s watchdog 을 240s 안전망으로
          //   교체. 드물게 느린 Opus(150s+) 케이스도 안 잘리고 완성본 전달. 진짜 hang 만 240s 후 recovery→환불.
          if (watchdogRef.current) clearTimeout(watchdogRef.current);
          watchdogRef.current = setTimeout(() => {
            if (!streamSettledRef.current) handleStreamFailure('시간 초과(callable)');
          }, 240000);
          // 2026-10-09 — 점진 표시: 서버가 그룹 완성마다 progress/{id} 에 쓰고, 여기서 구독해 도착한 섹션부터 보여준다
          //   (나머지는 '작성 중' 스켈레톤). 완성본 전달·환불 경로는 그대로 — 구독 실패해도 기존처럼 완성본으로.
          let progressSub: { unsubscribe: () => void } | null = null;
          let progressId: string | undefined;
          try {
            const [{ makeProgressId }, { subscribeProgress }] = await Promise.all([
              import('@/services/progress/progressId'),
              import('@/services/progress/progressClient'),
            ]);
            progressId = makeProgressId();
            progressSub = subscribeProgress(progressId, {
              onGroup: (g, data) => {
                if (streamSettledRef.current || !['A', 'D', 'B', 'C'].includes(g)) return;
                setStreamingAiResult((prev: any) => mergePremiumGroup(prev, data));
                setArrivedGroups((prev) => (prev[g as 'A'] ? prev : { ...prev, [g]: true }));
              },
            });
          } catch { /* 점진 표시는 부가 기능 */ }
          try {
            const { content } = await mod.generateReport(sajuData as any, undefined, 'premium', progressId);
            deliverReport({ ...(content as any), tier: 'premium' as const });
          } catch (e: any) {
            console.error('[ResultPage:fresh callable] 예외:', e?.message);
            await handleStreamFailure(e?.message || 'callable exception');
          } finally {
            progressSub?.unsubscribe();
          }
          return;
        }
        const fn = freshType === 'premium' ? mod.generatePremiumReportStream : mod.generateReportStream;
        await fn(sajuData as any, undefined, {
          onGroup: (_g: 'A' | 'D' | 'B' | 'C', data: any) => {
            // 그룹 단위 머지 (필드 누적). tier='premium' 표식은 final 에서 박음
            setStreamingAiResult((prev: any) => mergePremiumGroup(prev, data));
            setArrivedGroups((prev) => (prev[_g] ? prev : { ...prev, [_g]: true }));
          },
          onDone: ({ content }: { reportId: string; content: any }) => {
            const finalAi = freshType === 'premium'
              ? { ...(content as any), tier: 'premium' as const }
              : content;
            deliverReport(finalAi); // 완성본 전달(영속·pending해제·URL정리 공통)
          },
          onError: (msg: string) => {
            console.warn('[ResultPage:fresh SSE] 실패:', msg);
            // 2026-07-01 — 스트리밍 중 에러 → handleStreamFailure 가 recovery 우선 시도(가능하면 전달, 안 되면 환불).
            if (!streamSettledRef.current) handleStreamFailure(msg);
          },
        });
      } catch (e: any) {
        console.error('[ResultPage:fresh SSE] 예외:', e?.message);
        const hasPartial = Object.keys(streamingAiResultRef.current || {}).length > 0;
        if (!hasPartial) handleStreamFailure(e?.message || 'stream exception');
      }
    })();
    return () => { if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreshMode, freshType, sajuData, reportId]);

  // 2026-05-28 v3 — Fresh SSE 모드 정책 재정의:
  //   v1: 첫 필드 도착까지 AILoading (60-90초 답답)
  //   v2: 5초 후 강제 결과 진입 (빈 페이지 + 1분 빈 스켈레톤 — 더 안 좋음)
  //   v3: AILoading 유지 (첫 그룹 도착까지) → 결과 페이지 진입 시점엔 이미 첫 그룹(A) 데이터 있음
  //       AILoading 자체가 충분히 풍성 (사주 미니카드 + 5단계 인디케이터 + 명리학 팁) — user 읽을거리 충분.
  //       첫 group 도착 시 (Opus 14K ≈ 40-60초) 결과 페이지로 자연스럽게 전환.
  const isPremiumStreaming =
    isFreshMode && freshType === 'premium' && !loadedReport;
  // 2026-06-02 QA — fresh 스트리밍(premium+basic 공통) 빈-상태 게이트.
  //   기존: premium 만 AILoading 게이트 → basic(1운) fresh 는 빈 데이터로 렌더 시작 → "흰 화면 → 섹션 툭" 발생.
  //   수정: premium·basic 모두 첫 그룹 도착 전엔 AILoading 풀스크린 → 절대 빈 페이지 안 보임.
  const isFreshStreaming = isFreshMode && !loadedReport;
  // premium 스트리밍 진행 중(전 그룹 도착 전) — 상단 배너 게이트용
  const isPremiumStreamingIncomplete =
    isPremiumStreaming && !(arrivedGroups.A && arrivedGroups.D && arrivedGroups.B && arrivedGroups.C);
  // 2026-06-24 — 인플루언서 피드백: 부분 결과를 먼저 보여주면 fallback→AI 로 '읽는 도중 내용이 바뀌어' 혼란
  //   ("로딩중이었구나"). → 완성본만 노출. 전 그룹(A·B·C) 도착 전엔 premium·basic 모두 AILoading 유지(절대 부분 X).
  // 4그룹(premium A·D·B·C) — D 는 premium 전용. basic(claudeReport)은 A·B·C 만이라 freshType 분기.
  const allGroupsArrived = arrivedGroups.A && arrivedGroups.B && arrivedGroups.C && (freshType !== 'premium' || arrivedGroups.D);
  const isFreshStreamingIncomplete = isFreshStreaming && !allGroupsArrived;

  // effective storedReport — 저장된 게 우선, 없고 fresh 모드면 streaming 합성
  const storedReport: LocalReport | null = loadedReport ?? (streamingAiResult ? ({
    id: reportId,
    name: (sajuData as any)?.input?.name || '나',
    input: (sajuData as any)?.input,
    sajuData: sajuData as any,
    type: 'paid',
    contentType: 'report',
    createdAt: new Date().toISOString(),
    aiResult: streamingAiResult,
  } as unknown as LocalReport) : null);

  // 결과가 실제로 있을 때 1회 — 출석 마커 + 출시 프로모션(50원·앱인토스) + 일일/연속 보상.
  //   fresh 생성은 전 그룹 도착 후(중도 실패·환불 건 제외). 보관함 재진입 등 모든 결과 도달 커버.
  const hasRealResult = !!storedReport && (!isFreshMode || allGroupsArrived);
  useEffect(() => {
    if (!hasRealResult || attendanceFiredRef.current) return;
    attendanceFiredRef.current = true;
    markAttendance().catch(() => {/* non-blocking */});
    import('@/services/toss/tossPromotion').then(m => m.grantLaunchPromotion());
    import('@/services/storage/dailyReward').then(m => m.processAttendanceRewards());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRealResult]);

  // ── Phase C · 결과 게이트 도출 (서버 응답 기준)
  const gate = useMemo(() => deriveResultGate(storedReport), [storedReport]);
  const tier = props.tier ?? gate.tier;
  const locked = props.locked ?? gate.locked;
  const adEligible = props.adEligible ?? gate.adEligible;
  const upsellType = gate.upsellType;

  // ── Phase D · ContentType별 unlock 경로 + 비용 라벨
  const unlockKey = useMemo<UnlockContentKey>(() => {
    const ct = storedReport?.contentType ?? 'report';
    if (ct === 'topic') return 'topic';
    if (ct === 'daeun') return 'daewoon';
    if (ct === 'monthly') return 'wolun';
    if (ct === 'compat') return 'gunghap';
    if (ct === 'tojung') return 'tojeong';
    if (ct === 'dream' || ct === 'deepDream') return 'dream_free';
    // 'report' 는 1운 base. 종합 사주(10운)은 별도 케이스 — 현재는 report로 통일
    return 'report';
  }, [storedReport]);
  const unlockTarget = useMemo(
    () => resolveUnlockTarget(unlockKey, window.location.pathname),
    [unlockKey],
  );

  // ── Phase C · 블러 해제 토스트 (locked: true → false 전환 1회)
  const prevLockedRef = useRef(locked);
  useEffect(() => {
    if (prevLockedRef.current && !locked) {
      toast.show('사주 전체가 풀렸어요', 'success');
    }
    prevLockedRef.current = locked;
  }, [locked, toast]);

  function handleUnlock() {
    navigate(unlockTarget.route);
  }
  // Phase D' 작업 0 (2026-04-26): handlePartialUnlock 제거 — 10운 결제 후 1운 추가 결제 = UX 모순

  // ── Phase D · 프리미엄 7섹션 분기 (paid + report + !locked)
  //   aiResult 는 line ~202 에서 도출 — isPremiumLayout 도출은 그 시점 이후
  //   여기서는 인라인 도출만 (storedReport 직접 참조)
  const _premAi: any = storedReport?.aiResult;
  // 2026-05-27 — Fresh SSE 모드(premium)면 강제 true: streaming 중엔 sections 미완(<7)·tier 미세팅
  //   이라 false 로 떨어져 PremiumResult 가 렌더 0 → 흰 페이지. PremiumResult 자체가
  //   partial-safe(aiResult ?? {} + 모든 sub-component 방어) 라 빈 데이터로도 안전.
  const isPremiumLayout =
    tier === 'paid' &&
    !locked &&
    (storedReport?.contentType ?? 'report') === 'report' &&
    (
      (isFreshMode && freshType === 'premium') ||
      _premAi?.tier === 'premium' ||
      (_premAi?.sections?.length ?? 0) >= 7
    );

  // 2026-06-02 LIVE BEST — 종합사주(premium) 결과 도달 시 조회 1회 기록 (24h 디듀프).
  useEffect(() => {
    if (isPremiumLayout) {
      import('@/services/liveBest').then((m) => m.recordTopicView('premium')).catch(() => {});
    }
  }, [isPremiumLayout]);

  // 2026-05-07 fix — 1운 결과 페이지 컨셉 제거 (출시 모델: 종합사주는 10운 premium만).
  // basic tier (옛 1운 결과) 진입 시 홈으로 redirect — 디자인 자체 노출 X.
  // ⚠️ Fresh SSE 모드(2026-05-27): 스트리밍 중엔 부분 데이터(sections<7)라 isPremiumLayout=false
  //    일 수 있음 → 그 시점 redirect 하면 결과 페이지가 home 으로 튕김. fresh 모드 가드.
  const shouldRedirectLegacy =
    !isFreshMode &&
    tier === 'paid' && !locked && !isPremiumLayout &&
    (storedReport?.contentType ?? 'report') === 'report';
  useEffect(() => {
    if (shouldRedirectLegacy) {
      navigate('/', { replace: true });
    }
  }, [shouldRedirectLegacy, navigate]);

  const name = ctxInput?.name || storedReport?.name || sajuData.input?.name || '사용자';
  const input = ctxInput || storedReport?.input || sajuData.input;
  const hasBirthTime = input.hasBirthTime;
  // 2026-05-07: dateStr/genderStr/zodiac/birthTimeStr — basic UI 삭제로 미사용 (PremiumResult가 자체 처리)
  const _dateStr = `${input.birthYear}년 ${input.birthMonth}월 ${input.birthDay}일`;
  const _genderStr = input.gender === 'male' ? '남' : '여';
  void _dateStr; void _genderStr;

  // AI 결과 로드 — 저장된 리포트에서 aiResult 추출 (mapDaeun 등 v4 매핑이 참조)
  const aiResult = storedReport?.aiResult;

  // Map data to v4 formats
  // 전통 명리학 순서: 시주→일주→월주→년주 (왼쪽→오른쪽)
  const v4Pillars = mapPillars([...sajuData.pillars].reverse(), sajuData.sipsung);
  const v4Elements = mapElements(sajuData.elements);
  const v4Unyoung = mapUnyoung12(sajuData.unyoung12, sajuData.pillars);
  // 2026-05-04 동적화 — AI 응답의 daeunPeriods (8 대운별 score+reason) 전달.
  // AI 가 안 보내거나 일부만 보내도 mapDaeun 내부에서 매칭 안 되는 항목은 score=undefined → 클라이언트 fallback.
  const aiDaeunPeriods = (aiResult as any)?.daeunPeriods;
  const v4Daeun = mapDaeun(sajuData.daeun, input.birthYear, aiDaeunPeriods);
  const v4Napeum = mapNapeum(sajuData.napeum);
  const v4Gilsin = mapSinSal(sajuData.gilsin);
  const v4Hyungsal = mapSinSal(sajuData.hyungsal);
  const dayOhengForGM = sajuData.pillars[2]?.천간오행 ?? '토' as OhengType;
  const dayGanForGM = sajuData.pillars[2]?.천간 ?? '';
  const v4Gongmang = mapGongmang(sajuData.gongmang, dayOhengForGM, dayGanForGM);

  // 점수: AI 결과 우선, 없으면 오행 기반 추정
  // 통일된 명리학 가중치 점수 — sajuScores.ts (모든 페이지 공유)
  const scores = useMemo((): Record<string, number> => {
    return computeTopicScores({
      sajuData,
      aiScores: aiResult?.scores,
    });
  }, [sajuData, aiResult]);

  // 격국/용신 분석 기반 (AI가 반환한 analysisBase)
  const analysisBase = aiResult?.analysisBase;

  const radarData = (Object.entries(v4Elements) as [ElemKey, number][]).map(([k, v]) => ({
    subject: EKR[k].replace(/\(.*\)/, ''),
    value: v,
    fullMark: 100,
  }));

  const pillarCount = v4Pillars.length;

  // 섹션: AI 결과에서만 가져옴 (더미 데이터 없음)
  const sections: SectionData[] = useMemo(() => {
    // Array.isArray 가드 — sections 가 배열 아닌 truthy(문자열 등)면 .map 이 ResultPage 자체를 크래시(로컬 바운더리 밖). 2026-06-24
    if (Array.isArray(aiResult?.sections) && aiResult.sections.length > 0) {
      // 2026-05-28 — social(대인관계) 매핑 제거 (SSOT 10주제 정렬). AI sections 에서 social 안 보냄.
      const SECTION_VISUALS: Record<string, string> = {
        summary: 'oheng_structure', structure: '', personality: 'jijanggan',
        career: 'career_fit', wealth: 'wealthFlow',
        health: 'health_oheng', luck: 'luckyProfile',
        challenge: 'challenge_vis', mission: 'challenge_vis', gaewoon: 'gaewoon',
        daeun: 'daeun_vis', daeun_flow: 'daeun_vis',
        love: '', year2026: 'monthlyFortune', luckyProfile: 'luckyProfile',
      };
      return aiResult.sections.map((s: any) => ({
        id: s.id,
        icon: '',
        title: s.title,
        keyInsight: s.keyInsight || '',
        content: s.content,
        visual: SECTION_VISUALS[s.id] || (s.id.startsWith('year') ? 'monthlyFortune' : ''),
      }));
    }
    // AI 결과 없으면 빈 배열 — 사주 원국/오행/대운 등 기본 차트만 표시
    return [];
  }, [aiResult]);

  // 2026-05-07: zodiac / birthTimeStr — basic UI 삭제로 미사용
  const _zodiac = sajuData?.띠 ? `${sajuData.띠}띠` : '';
  const _birthTimeStr = hasBirthTime && input.birthHour !== undefined
    ? `${input.birthHour}시`
    : null;
  void _zodiac; void _birthTimeStr;

  const [showShareModal, setShowShareModal] = useState(false);

  // 최고 점수 항목 (공유 카드에 표시)
  const topScoreEntry = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
  const topScoreLabel = { career: '직업운', love: '애정운', wealth: '재물운', health: '건강운', potential: '잠재력' }[topScoreEntry[0]] || '';

  // Premium 결과는 line 1197 의 <PremiumResult /> 가 담당 (props 기반 React JSX 진본)
  // 폐기 이력: ResultPagePremiumV2.tsx (iframe srcDoc + regex string-replace) → _archive_/ 로 이동
  // 회귀 금지: iframe srcDoc, regex string replacement, mockup HTML embed, buildXxxFallback 류

  // 2026-05-28 v3 — Premium fresh SSE 첫 그룹 도착 전 → AILoading 풀스크린 (user 피드백:
  //   "로딩페이지에서 어느정도 시간 끌고 결과페이지 받았을때 읽을거리가 그래도 많게").
  //   첫 그룹(Opus 14K) ≈ 40-60초. AILoading 동안 사주 미니카드 + 5단계 + 팁 충분히 노출.
  //   첫 group 도착 시 자동으로 결과 페이지로 전환 → 그 시점엔 §01~§04 데이터 있음.
  // 2026-05-29 C1 fix — SSE 실패 시 AILoading 무한 멈춤 대신 환불 안내 + 재시도/홈 카드.
  if (streamError) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="사주 리포트" />
        <ErrorState
          title="분석에 실패했어요"
          description={streamError}
          onRetry={() => navigate('/', { replace: true })}
          retryLabel="홈으로"
        />
      </div>
    );
  }

  // 2026-06-24 — 인플루언서 피드백 반영(2026-06-15 '즉시 노출' 결정 폐기): premium·basic 모두 전 그룹 도착
  //   전엔 풀스크린 AILoading 유지 → '완성본'만 노출. 부분/ fallback 본문을 먼저 보여주고 나중에 AI 로 바꾸던
  //   것이 "읽는 도중 내용이 바뀜" 혼란의 원인이었음. A(14K)가 병목이라 어차피 대기시간은 비슷하고, 틀린 본문
  //   노출이 사라짐. AILoading 은 사주 미니카드 + 단계 인디케이터 + 팁으로 충분히 풍성(대기 체감 완화).
  /* 🚨 2026-07-14 P0 CS fix — "프리미엄 사주 다시 보면 빈 화면만 나와요" (재현 확정)
   *   증상: 결제한 리포트가 기기 저장소에 없으면(스토리지 소실·익명 uid 회전으로 서버 복원 실패 등)
   *     storedReport=null → tier='free' → isPremiumLayout=false → PremiumResult 미렌더.
   *     그런데 free 용 basic 섹션은 2026-05-07 에 전부 `{false && …}` 로 비활성 → **아무것도 안 남음**.
   *     shouldRedirectLegacy 도 tier==='paid' 조건이라 안 걸려 리다이렉트조차 없음.
   *     → 결제 유저에게 '헤더 한 줄뿐인 빈 페이지'가 그대로 노출됐다 (에러·원인·복구수단 0).
   *   fix: 복원 시도가 끝났는데도 보여줄 결과가 없으면 → 빈 페이지 금지, 명시적 복구 화면.
   *   회귀 금지: 결과가 없을 때 free 레이아웃으로 조용히 강등시키지 말 것. */
  const reportMissing =
    !isFreshMode && reportId !== 'local' && !storedReport && restoreSettled;
  if (reportMissing) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-page-gradient)' }}>
        <Header title="사주 리포트" />
        <ErrorState
          title="결과를 불러오지 못했어요"
          description="이 기기에 저장된 풀이가 사라졌어요. 아래에서 복구를 시도하거나 보관함에서 다시 열어보세요. 결제하신 운은 그대로 남아 있고, 결과가 끝내 복구되지 않으면 고객문의로 알려주시면 바로 도와드릴게요."
          onRetry={retryRestore}
          retryLabel="결과 복구하기"
        />
        <div className="max-w-mobile mx-auto px-5 pb-10 flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/storage')}
            className="flex-1 py-3 rounded-xl text-h3 font-semibold"
            style={{ background: 'rgba(184,150,90,0.12)', color: '#8C6D3D' }}
          >
            보관함 열기
          </button>
          <button
            type="button"
            onClick={() => navigate('/my')}
            className="flex-1 py-3 rounded-xl text-h3 font-semibold"
            style={{ background: 'rgba(184,150,90,0.12)', color: '#8C6D3D' }}
          >
            고객문의
          </button>
        </div>
      </div>
    );
  }

  const anyGroupArrived = arrivedGroups.A || arrivedGroups.D || arrivedGroups.B || arrivedGroups.C;
  if (isFreshStreamingIncomplete && !(freshType === 'premium' && anyGroupArrived)) {
    const arrivedCount = (arrivedGroups.A ? 1 : 0) + (arrivedGroups.D ? 1 : 0) + (arrivedGroups.B ? 1 : 0) + (arrivedGroups.C ? 1 : 0);
    const isPrem = freshType === 'premium';
    return (
      <AILoading
        name={name}
        type={isPrem ? '종합 사주 분석' : '사주 리포트 분석'}
        sajuData={sajuData}
        estimatedSeconds={isPrem ? 100 : 85}
        premiumNote={arrivedCount > 0 ? `정밀 분석 ${arrivedCount}/${isPrem ? 4 : 3} 단계 완료 — 마지막을 마무리하고 있어요` : undefined}
        steps={isPrem ? [
          '사주 8자와 오행 구조를 분석하고 있어요',
          '십성과 용신·조후를 도출하고 있어요',
          '대운과 올해 흐름을 짚고 있어요',
          '관계와 실천 전략을 정리하고 있어요',
          '종합 리포트를 완성하고 있어요',
        ] : [
          '사주 8자 구조를 분석하고 있어요',
          '용신과 격국을 도출하고 있어요',
          '성격과 기질을 읽고 있어요',
          '올해 흐름을 짚고 있어요',
          '리포트 본문을 작성하고 있어요',
        ]}
      />
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--bg-page-gradient)',
      }}
    >
      {/* 2026-05-07 — Premium 전용. Basic Header 제거 */}
      <PremiumDarkHeader name={name} onShareTap={() => setShowShareModal(true)} />

      {/* 공유 시트 (Phase B ShareSheet wrapper — Sprint 1 ShareModal forward, P2-1 블러 OG 보존) */}
      <ShareSheet
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        name={name}
        reportId={reportId}
        topScore={{ label: topScoreLabel, score: topScoreEntry[1] }}
      />

      <div className="max-w-mobile mx-auto pb-24">
        <div>

          {/* Time missing banner — Basic 모드 전용 (Premium 은 HeroCard 안에서 처리) */}
          {!isPremiumLayout && !hasBirthTime && (
            <LocalFadeIn>
              <div className="card-alert-warning">
                <p className="text-h3 text-func-warning">출생시간이 입력되지 않았습니다</p>
                <p className="text-caption text-text-secondary mt-1 leading-relaxed">
                  현재 3기둥 6글자로 분석 중이에요. 출생시간을 입력하면 <b>시주(時柱)</b>가 추가되어 더 정밀한 분석이 가능합니다.
                </p>
              </div>
            </LocalFadeIn>
          )}

          {/* 2026-05-07 — 1운 basic 카드 섹션 통째 삭제 (출시 모델: 종합사주 10운 premium 만) */}
          {false && (
          <>
          {/* 사주팔자 구조 해설 */}
          <LocalFadeIn>
            <div className="card space-y-3">
              <h2 className="text-h3 text-text-primary">사주팔자(四柱八字)란?</h2>
              <p className="text-caption text-text-muted leading-relaxed">
                태어난 <b className="text-text-secondary">해·월·일·시</b>의 네 기둥(四柱), 각 기둥의 천간(위)·지지(아래) 여덟 글자(八字).
                {hasBirthTime ? ' 4기둥 8글자 완전판으로 분석합니다.' : ' 출생시간 미상으로 3기둥 6글자로 분석합니다.'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-center text-caption text-text-muted">
                <div className="p-2.5 rounded-xl bg-bg-surface">
                  <div className="text-label text-text-secondary mb-0.5">↑ 천간 天干</div>
                  <div>하늘의 기운 · 겉으로 드러나는 나</div>
                </div>
                <div className="p-2.5 rounded-xl bg-bg-surface">
                  <div className="text-label text-text-secondary mb-0.5">↓ 지지 地支</div>
                  <div>땅의 기운 · 내면에 숨겨진 나</div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center text-tiny text-text-muted">
                {([
                  { t: '시주 時柱', d: '자녀·말년', hl: false, dim: !hasBirthTime },
                  { t: '일주 日柱', d: '나·배우자', hl: true, dim: false },
                  { t: '월주 月柱', d: '부모·직장', hl: false, dim: false },
                  { t: '년주 年柱', d: '조상·사회', hl: false, dim: false },
                ] as const).map((x, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg ${x.hl ? 'bg-gold-bg border-[1.5px] border-brand-gold/30' : x.dim ? 'border border-dashed border-border opacity-60' : 'bg-bg-surface'}`}
                  >
                    <div className={`text-tiny font-bold ${x.hl ? 'text-brand-gold' : 'text-text-secondary'}`}>
                      {x.t}{x.hl ? ' ★' : ''}
                    </div>
                    <div className={x.hl ? 'text-brand-gold/70' : ''}>{x.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </LocalFadeIn>

          {/* 만세력 원국 — 네이비 카드 */}
          <LocalFadeIn delay={80}>
            <div className="card-navy py-6 px-4">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-h3 text-white">만세력 원국</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(184,150,90,0.2)', color: '#E8D5A8' }}>
                  {hasBirthTime ? '4기둥 8글자' : '3기둥 6글자'}
                </span>
              </div>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${pillarCount}, 1fr)` }}>
                {v4Pillars.map((p, i) => (
                  <PillarCard key={i} p={p} index={i} total={pillarCount} />
                ))}
              </div>
              <div className="text-center mt-3 text-caption text-white/50">
                일간 <span className="text-h2 text-brand-gold-light">
                  {sajuData!.pillars[2].천간}({sajuData!.pillars[2].천간읽기})
                </span> = 나 자신
              </div>
            </div>
          </LocalFadeIn>

          {/* 오행 밸런스 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-3">오행 밸런스</h2>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e8e0d4" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b5b47', fontSize: 11, fontWeight: 600 }} />
                    <Radar
                      dataKey="value" stroke="#c9b99a" fill="#c9b99a" fillOpacity={0.2}
                      strokeWidth={2} dot={{ r: 3, fill: '#B8965A', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {(Object.entries(v4Elements) as [ElemKey, number][]).map(([elem, val]) => {
                  const ecB = EC[elem];
                  return (
                    <div key={elem} className="flex items-center gap-2">
                      <span style={{ fontSize: 13 }}>{EHAN[elem]}</span>
                      <span className="text-right" style={{ width: 50, fontSize: 11, fontWeight: 700, color: ecB.dark }}>
                        {EKR[elem]}
                      </span>
                      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 16, background: ecB.light }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(val, 3)}%`,
                            background: `linear-gradient(90deg,${ecB.med},${ecB.main})`,
                            transition: 'width 1s',
                          }}
                        />
                      </div>
                      <span
                        className="text-right"
                        style={{ width: 32, fontSize: 11, fontWeight: 800, color: val === 0 ? '#c62828' : ecB.dark }}
                      >
                        {val === 0 ? '없음!' : val}
                      </span>
                    </div>
                  );
                })}
              </div>
              {v4Elements.water === 0 && (
                <div className="card-alert-warning mt-3">
                  <p className="text-caption text-func-warning font-semibold">
                    수(水) 에너지 완전 부재 — 개운법에서 보충 방법을 꼭 확인하세요
                  </p>
                </div>
              )}
            </div>
          </LocalFadeIn>

          {/* 격국·용신 분석 — AI 분석 결과가 있을 때만 */}
          {analysisBase && (() => {
            // ─── 격국 해석 데이터 ───
            const GYEOKGUK_INFO: Record<string, { summary: string; personality: string; good: string; caution: string }> = {
              정인격: {
                summary: '학문과 배움을 통해 성장하는 구조의 사주',
                personality: '지적 호기심이 강하고 배움에 끌리는 타입이에요. 책·강의·자격증 등 공부를 통해 안정감을 얻고, 남에게 가르치는 일에서 보람을 느끼는 구조예요.',
                good: '학습 능력이 뛰어나 전문직·교육직에 유리하고, 어머니·스승 같은 귀인이 잘 나타나요',
                caution: '생각이 많아 행동이 느려질 수 있고, 너무 안전한 길만 선택하려는 경향 주의',
              },
              편인격: {
                summary: '독특한 시각과 직관으로 승부하는 구조의 사주',
                personality: '남들과 다른 감각이 있어요. 정석보다 독학, 체계보다 직관으로 움직이며, 예술·기술·영적 분야에서 두각을 나타내는 타입이에요.',
                good: '창의력과 직관이 뛰어나 남들이 못 보는 기회를 포착할 수 있어요',
                caution: '끈기 부족과 변덕이 약점이 될 수 있어요. 한 가지에 집중하는 연습이 필요해요',
              },
              정관격: {
                summary: '규칙과 질서 속에서 안정적으로 성장하는 구조의 사주',
                personality: '책임감이 강하고 규칙을 중시해요. 조직에서 인정받으며 승진하는 정통 엘리트 코스가 잘 맞는 타입이에요. 공직·대기업·전문직과 인연이 깊어요.',
                good: '사회적 신뢰와 지위를 자연스럽게 얻는 구조. 공직·대기업에서 강점',
                caution: '지나친 원칙주의가 관계를 딱딱하게 만들 수 있어요. 유연성을 의식적으로 키우세요',
              },
              편관격: {
                summary: '강한 압박을 에너지로 전환하는 구조의 사주',
                personality: '외부 압박과 경쟁 속에서 오히려 힘을 발휘하는 타입이에요. 위기 상황에서 진가를 보이며, 리더십과 추진력이 강해요. 군인·경찰·사업가 기질이 있어요.',
                good: '위기관리 능력이 탁월하고, 강한 추진력으로 큰 성과를 낼 수 있어요',
                caution: '스트레스를 받으면 공격적이 될 수 있어요. 감정 조절과 휴식이 중요해요',
              },
              식신격: {
                summary: '창작과 표현을 통해 가치를 만드는 구조의 사주',
                personality: '무언가를 만들어내는 데 천부적 재능이 있어요. 요리·글쓰기·디자인·콘텐츠 등 창작 활동에서 행복을 느끼고, 자연스럽게 재물도 따라와요.',
                good: '창작·표현 분야에서 자연스럽게 돈이 벌리는 구조. 프리랜서·창작자에 적합',
                caution: '게으름과 안주가 적. 현재에 만족하면 성장이 멈출 수 있어요',
              },
              상관격: {
                summary: '기존 틀을 깨고 혁신하는 구조의 사주',
                personality: '권위에 도전하고 새로운 방식을 만들어내는 반골 기질이에요. 기존 질서에 답답함을 느끼고, 남들이 생각 못한 방법으로 문제를 해결하는 타입이에요.',
                good: '혁신적 아이디어로 새 시장을 개척하는 능력. 스타트업·예술·IT에 강점',
                caution: '말실수와 대인관계 충돌 주의. 특히 윗사람과의 갈등이 생기기 쉬워요',
              },
              정재격: {
                summary: '꾸준한 노력으로 안정적 부를 쌓는 구조의 사주',
                personality: '계획적이고 성실해요. 한방보다 꾸준한 축적을 선호하고, 정직한 노력이 재물로 연결되는 타입이에요. 저축과 장기 투자에 적합한 구조예요.',
                good: '안정적 수입과 자산 축적에 유리. 장기적으로 부를 이루는 구조',
                caution: '지나친 절약이 기회를 놓치게 할 수 있어요. 전략적 소비도 필요해요',
              },
              편재격: {
                summary: '기회를 포착해 큰 재물을 다루는 구조의 사주',
                personality: '투자 감각이 있고 기회를 보면 과감하게 움직이는 타입이에요. 사업·무역·투자에서 두각을 나타내며, 돈의 흐름을 읽는 감각이 남다른 구조예요.',
                good: '사업 수완이 뛰어나고, 큰 돈을 다루는 능력이 있어요. 투자·무역에 유리',
                caution: '도박성 투자와 과소비 주의. 리스크 관리를 의식적으로 해야 해요',
              },
              비견격: {
                summary: '독립적인 힘으로 자기 길을 개척하는 구조의 사주',
                personality: '자존심이 강하고 남에게 기대지 않는 타입이에요. 독립심과 경쟁심이 강하며, 혼자서도 잘 해내는 추진력이 있어요. 독립 사업이나 1인 기업에 적합해요.',
                good: '독립적으로 성취하는 능력이 탁월. 창업·프리랜서에서 강점',
                caution: '고집과 타협 부족이 약점. 협력하면 더 큰 성과를 낼 수 있어요',
              },
              겁재격: {
                summary: '승부욕과 경쟁에서 힘을 발휘하는 구조의 사주',
                personality: '지기 싫어하는 성격이에요. 경쟁 상황에서 폭발적인 에너지를 보이며, 위기를 기회로 바꾸는 힘이 있어요. 영업·스포츠·투자 분야와 인연이 깊어요.',
                good: '위기 상황에서 오히려 강해지는 구조. 경쟁이 치열한 분야에서 두각',
                caution: '재물 손실과 인간관계 충돌 주의. 욕심을 조절하는 것이 핵심 과제',
              },
              건록격: {
                summary: '본인의 힘이 충만해 자립형으로 성공하는 구조의 사주',
                personality: '에너지가 넘치고 자기 확신이 강한 타입이에요. 남에게 의존하지 않고 자기 힘으로 일어서며, 실행력이 뛰어나요.',
                good: '자수성가형. 본인 역량으로 안정적 성공을 이루는 구조',
                caution: '독선적이 되기 쉬움. 다른 사람 의견을 듣는 열린 태도가 중요',
              },
              양인격: {
                summary: '강렬한 에너지를 어떻게 쓰느냐가 인생을 결정하는 구조의 사주',
                personality: '에너지가 매우 강하고 카리스마가 있어요. 잘 쓰면 리더, 잘못 쓰면 갈등의 원인이 되는 양날의 검 같은 구조예요.',
                good: '강한 리더십과 결단력. 군인·경찰·외과의·사업가로 대성할 수 있어요',
                caution: '분노 조절이 최대 과제. 에너지를 운동이나 사업으로 승화시키세요',
              },
            };

            // 오행 해석 데이터
            const OHENG_MEANING: Record<string, { name: string; symbol: string; nature: string; color: string; season: string; direction: string; goodWith: string; lifestyle: string }> = {
              목: { name: '목(木)', symbol: '木', nature: '성장·생명·인자함', color: '#2D8A4E', season: '봄', direction: '동쪽', goodWith: '녹색 식물, 나무 소품, 동쪽 배치', lifestyle: '아침 산책, 녹색 채소, 원목 가구 활용' },
              화: { name: '화(火)', symbol: '火', nature: '열정·표현·예의', color: '#D32F2F', season: '여름', direction: '남쪽', goodWith: '붉은색 포인트, 밝은 조명, 남향 생활', lifestyle: '유산소 운동, 매운맛 음식, 사교 활동' },
              토: { name: '토(土)', symbol: '土', nature: '안정·포용·신뢰', color: '#E8B82A', season: '환절기', direction: '중앙', goodWith: '황토색 소품, 도자기, 안정적 공간', lifestyle: '규칙적 생활, 잡곡밥, 명상·산책' },
              금: { name: '금(金)', symbol: '金', nature: '결단·정의·절제', color: '#4A4A4A', season: '가을', direction: '서쪽', goodWith: '금속 소품, 흰색 인테리어, 서쪽 배치', lifestyle: '호흡 운동, 현미·배, 미니멀 정리' },
              수: { name: '수(水)', symbol: '水', nature: '지혜·유연·적응', color: '#1565E0', season: '겨울', direction: '북쪽', goodWith: '물 관련 소품, 검은색 포인트, 수족관', lifestyle: '수영·반신욕, 해산물·검은콩, 독서·명상' },
            };

            // 신강/신약 해석
            const gangYakDetail: Record<string, { meaning: string; good: string; caution: string; strategy: string }> = {
              신강: {
                meaning: '일간(나)의 힘이 사주에서 강한 위치에 있어요. 주변 환경보다 내 에너지가 더 세서, 스스로 길을 개척하는 주도형 사주예요.',
                good: '자기 주장이 뚜렷하고 추진력이 강해요. 리더십·독립 사업·자기 브랜드에 유리해요',
                caution: '남의 말을 안 듣는 고집, 무리한 확장, 건강 과신이 약점이에요',
                strategy: '용신(부족한 오행)을 채워 에너지를 분산시키고, 협력자를 두는 것이 핵심이에요',
              },
              신약: {
                meaning: '일간(나)의 힘이 사주에서 약한 편이에요. 주변 환경의 영향을 많이 받지만, 그만큼 적응력과 관찰력이 뛰어난 구조예요.',
                good: '눈치가 빠르고 겸손해서 귀인이 잘 나타나요. 팀워크·조직·파트너십에 유리해요',
                caution: '우유부단함, 자신감 부족, 남 눈치 보기가 약점이에요',
                strategy: '용신(나를 도와주는 오행)을 보강해 자신감과 에너지를 높이는 것이 핵심이에요',
              },
              중화: {
                meaning: '일간(나)의 힘이 적절히 균형 잡혀 있어요. 상황에 따라 유연하게 대처하는 능력이 있는 이상적 구조예요.',
                good: '유연성이 높아 다양한 환경에 적응 가능. 치우침 없이 안정적 인생을 살 수 있어요',
                caution: '특출난 강점이 없어 보일 수 있어요. 의식적으로 전문 분야를 정해 깊이 파는 것이 중요',
                strategy: '용신으로 약간의 에너지 보정을 하면 더 큰 성과를 낼 수 있어요',
              },
            };

            const gyeokInfo = GYEOKGUK_INFO[analysisBase.격국];
            const gangYak = gangYakDetail[analysisBase.일간강약] || gangYakDetail['중화'];
            const yongOheng = OHENG_MEANING[analysisBase.용신];
            const huiOheng = analysisBase.희신 ? OHENG_MEANING[analysisBase.희신] : null;
            const giOheng = analysisBase.기신 ? OHENG_MEANING[analysisBase.기신] : null;
            const gangYakColor = analysisBase.일간강약 === '신강' ? '#D32F2F' : analysisBase.일간강약 === '신약' ? '#1565E0' : '#E8B82A';

            return (
            <LocalFadeIn delay={80}>
              <div className="card py-5 px-4">
                <h2 className="text-h3 text-text-primary mb-1">격국·용신 분석</h2>
                <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12, lineHeight: 1.6 }}>
                  사주의 구조(격국)를 파악하고, 균형을 맞춰줄 핵심 오행(용신)을 도출했어요. 아래 분석이 개운법·직업·건강의 근거가 됩니다.
                </p>

                {/* ────── 1. 격국 ────── */}
                <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid #e8e0d4' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(135deg, #f8f5ef, #f0ebe3)' }}>
                    <div>
                      <p style={{ fontSize: 10, color: '#a0937f', fontWeight: 600 }}>격국 — 사주의 구조 유형</p>
                      <p style={{ fontSize: 20, fontWeight: 900, color: '#3D3427', marginTop: 2 }}>{analysisBase.격국}</p>
                    </div>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #1B2A4A, #243656)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, color: '#E8D5A8', fontWeight: 800 }}>格</span>
                    </div>
                  </div>
                  {gyeokInfo ? (
                    <div className="px-4 py-3 space-y-2.5" style={{ background: '#fff' }}>
                      <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7, fontWeight: 600 }}>{gyeokInfo.summary}</p>
                      <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.75 }}>{gyeokInfo.personality}</p>
                      <div className="flex gap-2">
                        <div className="flex-1 p-2.5 rounded-lg" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#2e7d32', marginBottom: 2 }}>이런 점이 좋아요</p>
                          <p style={{ fontSize: 10, color: '#2e7d32', lineHeight: 1.6 }}>{gyeokInfo.good}</p>
                        </div>
                        <div className="flex-1 p-2.5 rounded-lg" style={{ background: '#fff3e0', border: '1px solid #ffe0b2' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#e65100', marginBottom: 2 }}>주의할 점</p>
                          <p style={{ fontSize: 10, color: '#e65100', lineHeight: 1.6 }}>{gyeokInfo.caution}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-3" style={{ background: '#fff' }}>
                      <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.7 }}>
                        {analysisBase.격국} 구조의 사주예요. 사주의 핵심 에너지 흐름을 결정하는 구조로, 아래 용신과 함께 해석하면 전체 그림이 보여요.
                      </p>
                    </div>
                  )}
                </div>

                {/* ────── 2. 일간 강약 ────── */}
                <div className="rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${gangYakColor}25` }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: `${gangYakColor}08` }}>
                    <div>
                      <p style={{ fontSize: 10, color: '#a0937f', fontWeight: 600 }}>일간 강약 — 나의 에너지 세기</p>
                      <p style={{ fontSize: 20, fontWeight: 900, color: gangYakColor, marginTop: 2 }}>{analysisBase.일간강약}</p>
                    </div>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${gangYakColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, color: gangYakColor, fontWeight: 800 }}>力</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2.5" style={{ background: '#fff' }}>
                    <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.75 }}>{gangYak.meaning}</p>
                    <div className="flex gap-2">
                      <div className="flex-1 p-2.5 rounded-lg" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#2e7d32', marginBottom: 2 }}>강점</p>
                        <p style={{ fontSize: 10, color: '#2e7d32', lineHeight: 1.6 }}>{gangYak.good}</p>
                      </div>
                      <div className="flex-1 p-2.5 rounded-lg" style={{ background: '#fff3e0', border: '1px solid #ffe0b2' }}>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#e65100', marginBottom: 2 }}>약점</p>
                        <p style={{ fontSize: 10, color: '#e65100', lineHeight: 1.6 }}>{gangYak.caution}</p>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg" style={{ background: '#f5f0e8', border: '1px dashed #d4cbb8' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B8965A', marginBottom: 2 }}>대응 전략</p>
                      <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.6 }}>{gangYak.strategy}</p>
                    </div>
                  </div>
                </div>

                {/* ────── 3. 용신 ────── */}
                <div className="rounded-xl overflow-hidden mb-3" style={{ border: '2px solid rgba(184,150,90,0.3)', boxShadow: '0 2px 12px rgba(184,150,90,0.1)' }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(135deg, rgba(184,150,90,0.1), rgba(140,109,61,0.15))' }}>
                    <div>
                      <p style={{ fontSize: 10, color: '#B8965A', fontWeight: 600 }}>용신 — 사주 균형의 열쇠</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p style={{ fontSize: 22, fontWeight: 900, color: yongOheng?.color || '#B8965A' }}>{analysisBase.용신}</p>
                        {yongOheng && <span style={{ fontSize: 11, color: '#8b7e6f' }}>{yongOheng.nature}</span>}
                      </div>
                    </div>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #B8965A, #b8965a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(184,150,90,0.3)' }}>
                      <span style={{ fontSize: 18, color: '#fff', fontWeight: 800 }}>神</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-3" style={{ background: '#fff' }}>
                    {/* 용신 = 뭐가 좋다는 거야? 해석 */}
                    <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #f5f0e8, #ede5d5)', border: '1px solid rgba(184,150,90,0.2)' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#B8965A', marginBottom: 4 }}>이게 뭔 뜻이에요?</p>
                      <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.75 }}>
                        당신의 사주에는 <b style={{ color: yongOheng?.color || '#B8965A' }}>{analysisBase.용신}({yongOheng?.name || analysisBase.용신})</b> 에너지가 가장 필요해요.
                        {analysisBase.일간강약 === '신강'
                          ? ` ${analysisBase.일간강약}(에너지 과잉) 사주이기 때문에, ${analysisBase.용신} 에너지로 넘치는 힘을 적절히 분산시켜야 균형이 잡혀요.`
                          : analysisBase.일간강약 === '신약'
                            ? ` ${analysisBase.일간강약}(에너지 부족) 사주이기 때문에, ${analysisBase.용신} 에너지가 나를 도와주고 힘을 채워줘요.`
                            : ` ${analysisBase.용신} 에너지를 보충하면 사주의 균형이 더 완성돼요.`
                        }
                      </p>
                    </div>

                    {/* 용신근거 */}
                    {analysisBase.용신근거 && (
                      <div className="p-2.5 rounded-lg" style={{ background: '#faf7f2', border: '1px dashed #d4cbb8' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B8965A', marginBottom: 2 }}>산출 근거</p>
                        <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.7 }}>{analysisBase.용신근거}</p>
                      </div>
                    )}

                    {/* 실생활 활용법 */}
                    {yongOheng && (
                      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${yongOheng.color}25` }}>
                        <div className="px-3 py-2" style={{ background: `${yongOheng.color}08` }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: yongOheng.color }}>
                            {analysisBase.용신}({yongOheng.name}) 에너지 보충법 — 이렇게 활용하세요
                          </p>
                        </div>
                        <div className="px-3 py-2.5 space-y-1.5" style={{ background: '#fff' }}>
                          <div className="flex items-start gap-2">
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a0937f', width: 40, flexShrink: 0 }}>방위</span>
                            <span style={{ fontSize: 11, color: '#6b5b47' }}>{yongOheng.direction} 방향이 유리 — 책상·침대를 {yongOheng.direction}으로 배치</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a0937f', width: 40, flexShrink: 0 }}>계절</span>
                            <span style={{ fontSize: 11, color: '#6b5b47' }}>{yongOheng.season}에 운이 상승, 중요한 일은 이 시기에</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a0937f', width: 40, flexShrink: 0 }}>소품</span>
                            <span style={{ fontSize: 11, color: '#6b5b47' }}>{yongOheng.goodWith}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a0937f', width: 40, flexShrink: 0 }}>생활</span>
                            <span style={{ fontSize: 11, color: '#6b5b47' }}>{yongOheng.lifestyle}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ────── 4. 희신·기신 ────── */}
                {(analysisBase.희신 || analysisBase.기신) && (
                  <div className="flex gap-2 mb-3">
                    {analysisBase.희신 && (
                      <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #c8e6c9' }}>
                        <div className="px-3 py-2" style={{ background: '#e8f5e9' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#2e7d32' }}>희신 — 용신을 돕는 오행</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span style={{ fontSize: 18, fontWeight: 900, color: huiOheng?.color || '#2D8A4E' }}>{analysisBase.희신}</span>
                            {huiOheng && <span style={{ fontSize: 9, color: '#4caf50' }}>{(huiOheng as any).nature}</span>}
                          </div>
                        </div>
                        <div className="px-3 py-2" style={{ background: '#fff' }}>
                          <p style={{ fontSize: 10, color: '#2e7d32', lineHeight: 1.6 }}>
                            용신({analysisBase.용신})을 옆에서 돕는 오행이에요. {analysisBase.희신} 에너지가 많은 환경에 있으면 용신의 효과가 배가돼요.
                          </p>
                        </div>
                      </div>
                    )}
                    {analysisBase.기신 && (
                      <div className="flex-1 rounded-xl overflow-hidden" style={{ border: '1px solid #ffcdd2' }}>
                        <div className="px-3 py-2" style={{ background: '#ffebee' }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: '#c62828' }}>기신 — 균형을 깨는 오행</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span style={{ fontSize: 18, fontWeight: 900, color: giOheng?.color || '#D32F2F' }}>{analysisBase.기신}</span>
                            {giOheng && <span style={{ fontSize: 9, color: '#ef5350' }}>{(giOheng as any).nature}</span>}
                          </div>
                        </div>
                        <div className="px-3 py-2" style={{ background: '#fff' }}>
                          <p style={{ fontSize: 10, color: '#c62828', lineHeight: 1.6 }}>
                            사주 균형을 무너뜨리는 오행이에요. {analysisBase.기신} 에너지가 과하면 건강·재물·관계에 부정적 영향이 생길 수 있어요.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ────── 5. 종합 요약 — "그래서 나는?" ────── */}
                <div className="p-3.5 rounded-xl" style={{ background: 'linear-gradient(135deg, #1B2A4A, #243656)', boxShadow: '0 2px 12px rgba(27,42,74,0.15)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#E8D5A8', marginBottom: 6 }}>한 줄 요약 — 그래서 나는?</p>
                  <p style={{ fontSize: 12, color: '#fff', lineHeight: 1.8 }}>
                    {gyeokInfo
                      ? `${analysisBase.격국} + ${analysisBase.일간강약} = ${gyeokInfo.summary.replace('구조의 사주', '')}사주이며, `
                      : `${analysisBase.격국} 구조의 사주이며, `
                    }
                    <b style={{ color: '#E8D5A8' }}>{analysisBase.용신}({yongOheng?.name || analysisBase.용신})</b> 에너지를 보충하면 부족한 부분이 채워져요.
                    {analysisBase.희신 && <> <span style={{ color: '#a5d6a7' }}>{analysisBase.희신}(희신)</span>은 나를 돕고,</>}
                    {analysisBase.기신 && <> <span style={{ color: '#ef9a9a' }}>{analysisBase.기신}(기신)</span>은 조심해야 해요.</>}
                    {yongOheng && <> 일상에서 <b style={{ color: '#E8D5A8' }}>{yongOheng.direction} 방향, {yongOheng.season}철, {yongOheng.lifestyle.split(',')[0]}</b>을 의식하면 운이 좋아져요.</>}
                  </p>
                </div>
              </div>
            </LocalFadeIn>
            );
          })()}

          {/* 12운성 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">12운성 — 에너지 상태</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12, lineHeight: 1.6 }}>
                인생 각 영역의 에너지 강도를 보여줘요. <span style={{ color: '#27ae60', fontWeight: 700 }}>높을수록 활발</span>하고, <span style={{ color: '#e74c3c', fontWeight: 700 }}>낮을수록 내면에 집중</span>하는 에너지예요.
              </p>

              {/* 종합 해석 */}
              <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.2)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#B8965A', marginBottom: 4 }}>종합 해석</p>
                <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7 }}>{getUnyoungSummary(v4Unyoung)}</p>
              </div>

              {/* 에너지 레벨 한눈에 */}
              <div className="mb-4 p-3 rounded-xl" style={{ background: '#faf7f2' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#8b7e6f', marginBottom: 8 }}>에너지 한눈에 보기</p>
                <div className="space-y-2.5">
                  {v4Unyoung.map((u, i) => {
                    const level = getUnyoungEnergyLevel(u.kr);
                    const posCtx = getUnyoungPositionContext(u.pillar);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span style={{ minWidth: 70, fontSize: 11, color: '#6b5b47', fontWeight: 600 }}>{posCtx}</span>
                        <div className="flex gap-0.5 flex-1">
                          {[1,2,3,4,5].map(n => (
                            <div key={n} className="h-2.5 rounded-sm flex-1" style={{ background: n <= level ? u.color : '#e8e0d4', maxWidth: 28 }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: u.color, minWidth: 28 }}>{u.kr}</span>
                        {u.pillar.includes('일지') && <span style={{ fontSize: 9, color: '#B8965A', fontWeight: 800 }}>핵심</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 상세 카드 */}
              <div className="space-y-2">
                {v4Unyoung.map((u, i) => {
                  const level = getUnyoungEnergyLevel(u.kr);
                  const bgColor = level >= 4 ? '#e8f5e9' : level <= 1 ? '#fce4ec' : '#fff3e0';
                  const borderColor = level >= 4 ? '#a5d6a7' : level <= 1 ? '#f8bbd0' : '#ffe0b2';
                  const posCtx = getUnyoungPositionContext(u.pillar);
                  return (
                    <div key={i} className="p-3 rounded-xl" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                      <div className="flex items-center gap-3 mb-1.5">
                        <div className="text-center" style={{ minWidth: 44 }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: u.color }}>{u.value}</div>
                          <div style={{ fontSize: 10, color: u.color + '99' }}>{u.kr}</div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#6b5b47' }}>{u.pillar}</span>
                          </div>
                          <span style={{ fontSize: 10, color: '#a0937f', fontWeight: 600 }}>{posCtx} 영역</span>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: '#6b5b47', lineHeight: 1.7, paddingLeft: 2 }}>{u.meaning}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </LocalFadeIn>

          {/* 운세 종합 점수 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-3">운세 종합 점수</h2>
              {/* 2026-05-28 — SSOT 정렬. 대인운(social) 제거 → 5개 카드 grid-cols-5 (균일 1행). */}
              <div className="grid grid-cols-5 gap-2">
                <ScoreRing label="직업운" score={scores.career} color="#2563eb" topicId="career" />
                <ScoreRing label="애정운" score={scores.love} color="#db2777" delay={100} topicId="love" />
                <ScoreRing label="재물운" score={scores.wealth} color="#d97706" delay={200} topicId="wealth" />
                <ScoreRing label="건강운" score={scores.health} color="#059669" delay={300} topicId="health" />
                <ScoreRing label="잠재력" score={scores.potential} color="#ea580c" delay={400} />
              </div>
              {/* 점수 해석 가이드 */}
              <div className="mt-4 pt-3 border-t border-border-light">
                {(() => {
                  const best = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b);
                  const worst = Object.entries(scores).reduce((a, b) => a[1] < b[1] ? a : b);
                  const labels: Record<string, string> = { career: '직업운', love: '애정운', wealth: '재물운', health: '건강운', potential: '잠재력' };
                  return (
                    <div className="space-y-1.5">
                      <p style={{ fontSize: 12, color: '#2E7D32', fontWeight: 600 }}>
                        가장 강한 운: {labels[best[0]]} ({best[1]}점) — 이 영역에서 타고난 재능이 빛나요
                      </p>
                      <p style={{ fontSize: 12, color: '#D32F2F', fontWeight: 600 }}>
                        보완이 필요한 운: {labels[worst[0]]} ({worst[1]}점) — 의식적인 노력이 도움돼요
                      </p>
                      <p style={{ fontSize: 11, color: '#8b7e6f' }}>
                        점수는 사주 원국의 오행 분포와 십성 관계를 기반으로 산출했어요
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </LocalFadeIn>

          {/* 대운 흐름 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">대운 흐름</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12 }}>10년 단위로 바뀌는 운의 큰 흐름이에요. <span style={{ fontWeight: 700, color: '#B8965A' }}>현재 대운</span>이 강조되어 있어요.</p>

              {/* 현재 대운 해석 */}
              {getDaeunCurrentSummary(v4Daeun) && (
                <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.2)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#B8965A', marginBottom: 4 }}>지금 이 시기의 의미</p>
                  <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{getDaeunCurrentSummary(v4Daeun)}</p>
                </div>
              )}

              {/* ═══ 대운 타임라인 시각화 (업그레이드) ═══ */}
              <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #e8e0d4', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div className="px-4 py-2.5" style={{ background: 'linear-gradient(135deg, #1B2A4A, #243656)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#E8D5A8', letterSpacing: '0.5px' }}>인생 대운 타임라인</p>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>10년 단위 운의 큰 흐름 — 오행별 색상 구분</p>
                </div>
                <div className="p-3" style={{ background: '#faf7f2' }}>
                  {/* 메인 바 차트 */}
                  <div className="flex gap-1 mb-1" style={{ height: 56 }}>
                    {v4Daeun.map((d, i) => {
                      const barEc = EC[d.elem];
                      return (
                        <div key={i} className="flex-1 relative overflow-hidden" style={{
                          borderRadius: d.current ? 8 : 5,
                          background: d.current
                            ? `linear-gradient(180deg, ${barEc.main}, ${barEc.dark})`
                            : `linear-gradient(180deg, ${barEc.light}, ${barEc.med}44)`,
                          border: d.current ? `2.5px solid ${barEc.main}` : `1px solid ${barEc.med}88`,
                          boxShadow: d.current ? `0 3px 12px ${barEc.main}40` : 'none',
                          transform: d.current ? 'scaleY(1.08)' : 'scaleY(1)',
                          transformOrigin: 'bottom',
                          transition: 'all 0.3s ease',
                        }}>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span style={{ fontSize: d.current ? 13 : 10, fontWeight: 900, color: d.current ? '#fff' : barEc.dark }}>
                              {d.gz}
                            </span>
                            <span style={{ fontSize: d.current ? 8 : 7, color: d.current ? 'rgba(255,255,255,0.8)' : barEc.main, fontWeight: 600, marginTop: 1 }}>
                              {d.kr}
                            </span>
                            {d.current && (
                              <span style={{ fontSize: 7, fontWeight: 800, color: '#E8D5A8', background: 'rgba(0,0,0,0.2)', borderRadius: 3, padding: '0 4px', marginTop: 2 }}>NOW</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* 나이·시기 라벨 */}
                  <div className="flex gap-1">
                    {v4Daeun.map((d, i) => (
                      <div key={i} className="flex-1 text-center">
                        <span style={{
                          fontSize: 9,
                          color: d.current ? EC[d.elem].main : '#a0937f',
                          fontWeight: d.current ? 800 : 400,
                        }}>
                          {d.age}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* 라벨 (학업기, 현재, ...) */}
                  <div className="flex gap-1 mt-0.5">
                    {v4Daeun.map((d, i) => (
                      <div key={i} className="flex-1 text-center">
                        <span style={{
                          fontSize: 8,
                          color: d.current ? EC[d.elem].dark : '#c9b99a',
                          fontWeight: d.current ? 700 : 400,
                        }}>
                          {d.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 오행 범례 + 읽기 안내 */}
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#f5f0e8', borderTop: '1px solid #e8e0d4' }}>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {(['wood', 'fire', 'earth', 'metal', 'water'] as const).map(elem => (
                      <div key={elem} className="flex items-center gap-1">
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: EC[elem].main }} />
                        <span style={{ fontSize: 9, color: '#8b7e6f', fontWeight: 500 }}>{EKR[elem]}</span>
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 8, color: '#c9b99a' }}>오행별 색상</span>
                </div>
              </div>

              <div className="space-y-2.5">
                {v4Daeun.map((d, i) => {
                  const ec = EC[d.elem];
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl"
                      style={{
                        padding: '10px 12px',
                        background: d.current ? ec.light : '#faf7f2',
                        border: d.current ? `2px solid ${ec.main}` : '1px solid #e8e0d4',
                        boxShadow: d.current ? `0 2px 10px ${ec.main}18` : 'none',
                      }}
                    >
                      <div className="text-center" style={{ minWidth: 50 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: ec.dark }}>{d.gz}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: ec.main }}>{d.kr}</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#6b5b47' }}>{d.age}</span>
                          {d.current && (
                            <span
                              className="rounded text-white"
                              style={{ padding: '1px 6px', background: ec.main, fontSize: 9, fontWeight: 800 }}
                            >
                              현재
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#a0937f' }}>{d.period} · {d.label}</div>
                      </div>
                      <span style={{ fontSize: 16 }}>{EHAN[d.elem]}</span>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const cur: any = v4Daeun.find(d => d.current);
                if (!cur) return null;
                const curEc = (EC as any)[cur.elem];
                return (
                  <div className="mt-3 p-3 rounded-xl" style={{ background: `${curEc.main}08`, border: `1px solid ${curEc.main}30` }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: curEc.dark }}>
                      현재 {cur.gz}({cur.kr}) 대운 — {(EKR as any)[cur.elem]} 에너지 시기
                    </p>
                    <p style={{ fontSize: 10, color: '#8b7e6f', marginTop: 2 }}>
                      {cur.label} ({cur.period})에 해당하는 시기로, {(EKR as any)[cur.elem]} 오행의 영향을 크게 받고 있어요.
                    </p>
                  </div>
                );
              })()}
              {/* 이렇게 읽어요 */}
              <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3949ab', marginBottom: 3 }}>이렇게 읽어요</p>
                <p style={{ fontSize: 10, color: '#5c6bc0', lineHeight: 1.6 }}>
                  대운은 인생의 큰 계절이에요. 봄(목)→여름(화)→환절기(토)→가을(금)→겨울(수)처럼, 각 시기에 맞는 전략이 달라요. 현재 대운의 오행이 나에게 어떤 영향을 주는지가 핵심이에요.
                </p>
              </div>
            </div>
          </LocalFadeIn>

          {/* 납음 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">납음 — 근본 에너지</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12 }}>
                사주의 가장 깊은 곳에 있는 근본 에너지예요. 각 기둥마다 고유한 에너지가 있고, <span style={{ fontWeight: 700, color: '#B8965A' }}>일주 납음이 가장 중요</span>해요.
              </p>

              {/* 종합 해석 */}
              <div className="p-3 rounded-xl mb-4" style={{ background: 'linear-gradient(135deg, #F5F0E8, #EDE5D5)', border: '1px solid rgba(184,150,90,0.2)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#B8965A', marginBottom: 4 }}>종합 해석</p>
                <p style={{ fontSize: 12, color: '#6b5b47', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{getNapeumSummary(v4Napeum)}</p>
              </div>

              <div className="space-y-2">
                {v4Napeum.map((n, i) => {
                  const isIlju = n.pillar === '일주';
                  return (
                    <div key={i} className="p-3 rounded-xl" style={{
                      background: isIlju ? '#FFF8E1' : '#faf7f2',
                      border: isIlju ? '2px solid #B8965A' : '1px solid #e8e0d4',
                    }}>
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 24 }}>{n.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#6b5b47' }}>{n.hanja}</span>
                            <span style={{ fontSize: 11, color: '#a0937f', fontWeight: 600 }}>{n.kr}</span>
                            <span className="rounded" style={{ padding: '2px 8px', background: isIlju ? '#B8965A' : '#B8965A20', color: isIlju ? '#fff' : '#B8965A', fontSize: 10, fontWeight: 700 }}>
                              {n.pillar}{isIlju ? ' ← 핵심' : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: '#a0937f', marginTop: 2 }}>{getNapeumPositionRole(n.pillar)}</div>
                          <div style={{ fontSize: 12, color: '#6b5b47', marginTop: 4, fontWeight: 500, lineHeight: 1.5 }}>{n.desc}</div>
                          <div style={{ fontSize: 11, color: isIlju ? '#8d6e00' : '#5c6bc0', marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${isIlju ? '#B8965A80' : '#e0e0e0'}`, lineHeight: 1.6 }}>
                            <span style={{ fontWeight: 700 }}>실생활:</span> {getNapeumPracticalTip(n.hanja)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 이렇게 읽어요 */}
              <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3949ab', marginBottom: 3 }}>이렇게 읽어요</p>
                <p style={{ fontSize: 10, color: '#5c6bc0', lineHeight: 1.6 }}>
                  납음은 당신의 '기본 성격 모드'예요. 일주 납음이 가장 중요 — 평소 자연스럽게 행동하는 방식이에요. 예를 들어 '역참의 넓은 땅'이면 사람을 모으고 연결하는 게 자연스러운 사람이에요. 이 성질을 살리는 방향으로 살면 인생이 편해져요.
                </p>
              </div>
            </div>
          </LocalFadeIn>
          </>
          )}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* Basic 카드 섹션 끝 */}
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

          {/* ─── Phase D'-2 · 프리미엄 10섹션 (목업 v2 진본) ─── */}
          {/* 2026-05-28 — Streaming 진행 banner: fresh SSE 모드에서 그룹 미완료 시 sticky 상단 표시.
             user 피드백: "다른 콘텐츠처럼 어느정도는 안된 section은 스켈레톤으로". 풀스크린 AILoading 5초 후 결과
             페이지로 진입 → PremiumResult 가 partial-safe 라 빈 sections 자리는 자체 fallback. 사용자에게 진행
             중임을 알리는 정보성 banner 로 보완. */}
          {isPremiumLayout && isPremiumStreamingIncomplete && (
            <div style={{
              position: 'sticky', top: 56, zIndex: 40,
              margin: '0 16px 14px',
              background: 'linear-gradient(135deg, #FFFBF0 0%, #FFF6E0 100%)',
              border: '1px solid rgba(184,150,90,0.35)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 2px 8px rgba(184,150,90,0.12)',
            }}>
              <div style={{
                width: 18, height: 18, flexShrink: 0,
                border: '2px solid rgba(184,150,90,0.25)',
                borderTopColor: '#B8965A',
                borderRadius: '50%',
                animation: 'premium-spin 0.9s linear infinite',
              }} />
              <style>{`@keyframes premium-spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5C4A2E', marginBottom: 4 }}>
                  풀이를 쓰는 중이에요 · {(arrivedGroups.A ? 1 : 0) + (arrivedGroups.D ? 1 : 0) + (arrivedGroups.B ? 1 : 0) + (arrivedGroups.C ? 1 : 0)}/4 도착
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                  {(['A', 'D', 'B', 'C'] as const).map((g) => (
                    <div key={g} style={{ flex: 1, height: 4, borderRadius: 999, background: arrivedGroups[g] ? '#B8965A' : 'rgba(184,150,90,0.18)', transition: 'background 0.4s' }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#8C6D3D', lineHeight: 1.5 }}>
                  '작성 중' 표시가 없는 섹션은 지금 바로 읽을 수 있어요. 나머지도 다 쓰는 대로 채워져요.
                </div>
              </div>
            </div>
          )}

          {isPremiumLayout && (
            // 2026-06-24 CS CRITICAL — 결과 렌더 크래시 시 홈으로 안 보내고/결제 유실 0/글 폴백.
            <ResultErrorBoundary fallbackSections={sections}>
              <PremiumResult
                report={storedReport!}
                sajuData={sajuData}
                v4Pillars={v4Pillars}
                v4Daeun={v4Daeun}
                v4Gilsin={v4Gilsin}
                v4Hyungsal={v4Hyungsal}
                scores={scores}
                pendingGroups={isPremiumStreamingIncomplete ? { A: !arrivedGroups.A, D: !arrivedGroups.D, B: !arrivedGroups.B, C: !arrivedGroups.C } : undefined}
              />
            </ResultErrorBoundary>
          )}
          {/* 2026-10-10 — 실제 후기 수집 (4그룹 다 도착한 뒤 · 결과 1건당 한 번) */}
          {isPremiumLayout && !isPremiumStreamingIncomplete && reportId !== 'local' && (
            <ReviewAsk contentType="premium" contentLabel="종합사주" reportKey={reportId} style={{ margin: '24px 16px 8px' }} />
          )}

          {/* ─── Phase C · L3·L4 블러 영역 시작 (신살 + 공망 + 상세 풀이 12섹션) ─── */}
          {/* Phase D' 작업 0: 단일 Primary CTA만 (1운 추가 결제 옵션 제거) */}
          {false && !isPremiumLayout && (
          <BlurredSection
            locked={locked}
            onUnlock={handleUnlock}
            primaryLabel={`${unlockTarget.costLabel}으로 해제하기`}
          >

          {/* 신살 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">신살 — 타고난 별</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 4 }}>
                사주에 타고난 특별한 에너지예요. <span style={{ color: '#2e7d32', fontWeight: 700 }}>길신</span>은 타고난 재능과 행운, <span style={{ color: '#e65100', fontWeight: 700 }}>흉살</span>은 주의하면 오히려 강점으로 바뀌는 에너지예요.
              </p>
              <p style={{ fontSize: 10, color: '#a0937f', marginBottom: 12 }}>
                아래 신살은 <b style={{ color: '#6b5b47' }}>일주(日柱)</b> 기준으로 추출한 것으로, 본인의 핵심 성향에 직접 영향을 줍니다.
              </p>

              {/* 요약 뱃지 */}
              <div className="flex items-center gap-2 mb-4">
                <span className="rounded-full px-2.5 py-1" style={{ background: '#e8f5e9', fontSize: 10, fontWeight: 700, color: '#2e7d32' }}>
                  길신 {v4Gilsin.length}개
                </span>
                <span className="rounded-full px-2.5 py-1" style={{ background: '#fff3e0', fontSize: 10, fontWeight: 700, color: '#e65100' }}>
                  흉살 {v4Hyungsal.length}개
                </span>
                <span className="rounded-full px-2.5 py-1" style={{ background: '#f5f5f5', fontSize: 10, fontWeight: 600, color: '#4A4A4A' }}>
                  일주 기준
                </span>
              </div>

              <div className="mb-4">
                <div className="text-label text-func-success mb-2">길신 — 타고난 재능</div>
                <div className="space-y-2">
                  {v4Gilsin.map((g, i) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: '#e8f5e9', border: '1px solid #c8e6c9' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#2e7d32' }}>{g.hanja}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>{g.kr}</span>
                        <span className="rounded" style={{ padding: '1px 6px', background: '#c8e6c9', color: '#1b5e20', fontSize: 9, fontWeight: 700 }}>
                          {g.source}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#2e7d32', lineHeight: 1.6, fontWeight: 500, marginBottom: 4 }}>
                        {g.desc}
                      </p>
                      <p style={{ fontSize: 10, color: '#1b5e20', lineHeight: 1.5, paddingTop: 4, borderTop: '1px dashed #a5d6a740' }}>
                        <b>실전 활용:</b> {getGilsinActionTip(g.hanja)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-label text-func-warning mb-2">흉살 — 주의하면 강점</div>
                <div className="space-y-2">
                  {v4Hyungsal.map((h, i) => (
                    <div key={i} className="p-3 rounded-xl" style={{ background: '#fff3e0', border: '1px solid #ffe0b2' }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#e65100' }}>{h.hanja}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#e65100' }}>{h.kr}</span>
                        <span className="rounded" style={{ padding: '1px 6px', background: '#ffe0b2', color: '#bf360c', fontSize: 9, fontWeight: 700 }}>
                          {h.source}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#e65100', lineHeight: 1.6, fontWeight: 500, marginBottom: 4 }}>
                        {h.desc}
                      </p>
                      <p style={{ fontSize: 10, color: '#bf360c', lineHeight: 1.5, paddingTop: 4, borderTop: '1px dashed #ffcc8040' }}>
                        <b>대처법:</b> {getHyungsalActionTip(h.hanja)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {/* 이렇게 읽어요 */}
              <div className="mt-4 p-2.5 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3949ab', marginBottom: 3 }}>이렇게 읽어요</p>
                <p style={{ fontSize: 10, color: '#5c6bc0', lineHeight: 1.6 }}>
                  길신이 많다 = 행운의 기회가 많다. 흉살이 있다 = 나쁜 게 아니라 '조심해야 할 포인트'예요. 흉살을 의식하고 대비하면 오히려 남들보다 강한 사람이 돼요. 신살은 바꿀 수 없지만, 활용 방법은 내가 선택할 수 있어요.
                </p>
              </div>
            </div>
          </LocalFadeIn>

          {/* 공망 */}
          <LocalFadeIn delay={80}>
            <div className="card">
              <h2 className="text-h3 text-text-primary mb-1">공망 — 비어있는 에너지</h2>
              <p style={{ fontSize: 11, color: '#8b7e6f', marginBottom: 12 }}>
                공망은 사주에서 '비어있는 자리'예요. 나쁜 게 아니라, <span style={{ fontWeight: 700, color: '#6a1b9a' }}>집착을 내려놓으면 오히려 자유롭고 창의적인 영역</span>이 돼요.
              </p>
              <div className="space-y-3">
                {v4Gongmang.map((g, i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #e1bee7' }}>
                    {/* 헤더 */}
                    <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'linear-gradient(135deg, #f3e5f5, #ede0f5)' }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#6a1b9a' }}>{g.value}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#6a1b9a' }}>{g.kr}</span>
                          <span className="rounded-full" style={{ padding: '1px 8px', background: '#e1bee7', color: '#6a1b9a', fontSize: 9, fontWeight: 700 }}>
                            {g.basis}
                          </span>
                          {g.category && (
                            <span className="rounded-full" style={{ padding: '1px 8px', background: '#6a1b9a', color: '#fff', fontSize: 9, fontWeight: 700 }}>
                              {g.category} 영역
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* 내용 */}
                    <div className="px-4 py-3 space-y-2" style={{ background: '#faf5ff' }}>
                      <p style={{ fontSize: 12, color: '#4a148c', lineHeight: 1.7, fontWeight: 500 }}>
                        {g.meaning}
                      </p>
                      <div className="p-2.5 rounded-lg" style={{ background: '#f3e5f5', border: '1px dashed #ce93d8' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#7b1fa2', marginBottom: 2 }}>실전 활용</p>
                        <p style={{ fontSize: 11, color: '#6a1b9a', lineHeight: 1.6 }}>
                          {g.tip}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* 이렇게 읽어요 */}
              <div className="mt-3 p-2.5 rounded-xl" style={{ background: '#f0f4ff', border: '1px solid #c5cae9' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#3949ab', marginBottom: 3 }}>이렇게 읽어요</p>
                <p style={{ fontSize: 10, color: '#5c6bc0', lineHeight: 1.6 }}>
                  공망의 영역은 사주의 일간({sajuData?.pillars?.[2]?.천간읽기} 일간)과 공망 지지의 오행 관계로 결정돼요. 예를 들어 재성 공망이면 '돈에 집착할수록 도망감', 관성 공망이면 '조직보다 자유로운 경로가 유리' — 비어있는 영역이기에 오히려 남들과 다른 강점이 돼요.
                </p>
              </div>
            </div>
          </LocalFadeIn>

          {/* (인생과제는 상세풀이 섹션 challenge_vis로 통합됨) */}

          {/* 상세 풀이 */}
          <div>
            <div className="flex items-center gap-2 px-1 mb-3">
              <div className="w-5 h-px bg-brand-gold" />
              <h2 className="text-h3 text-text-primary">상세 풀이 · 12섹션</h2>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2.5">
              {sections.map((s, i) => (
                <ReportSection
                  key={s.id}
                  section={s}
                  index={i}
                  elements={v4Elements}
                  hasBirthTime={hasBirthTime}
                  jijanggan={sajuData!.jijanggan}
                  pillars={sajuData!.pillars}
                  aiResult={aiResult}
                />
              ))}
            </div>
          </div>

          {/* ─── Phase C · L3·L4 블러 영역 종료 ─── */}
          </BlurredSection>
          )}

          {/* §6 UpsellCard — Premium 모드에서는 PremiumResult 의 PremiumUpsellCard 가 담당 (중복 방지) */}
          {false && !locked && tier === 'paid' && !isPremiumLayout && (
            <LocalFadeIn delay={80}>
              <UpsellCard contentType={upsellType} />
            </LocalFadeIn>
          )}

          {/* 크로스셀 "더 알아보기" — Premium 은 PremiumResult 의 TopicTopRecommend 가 담당 (점수 기반 동적 3 카드) */}
          {false && !isPremiumLayout && (
            <LocalFadeIn delay={80}>
              <div className="card space-y-3">
                <h3 className="text-h3 text-text-primary">더 알아보기</h3>
                <div className="grid grid-cols-3 gap-2">
                  {/* 2026-05-07: '궁합/대운' 1차 출시 후 공개 — 코드 보존, 공유만 노출 */}
                  {[
                    // { title: '궁합 분석', desc: '1운', action: () => navigate('/compat') },
                    // { title: '대운 상세', desc: '1운', action: () => navigate('/daeun') },
                    { title: '연애운 보기', desc: '1운', action: () => navigate('/topic/love') },
                    { title: '재물운 보기', desc: '1운', action: () => navigate('/topic/wealth') },
                    { title: '공유하기', desc: '+1운', action: () => setShowShareModal(true) },
                  ].map((item) => (
                    <button key={item.title} onClick={item.action} className="card text-center py-3 space-y-1 hover-lift">
                      <div className="w-8 h-8 rounded-lg mx-auto bg-brand-gold/10 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
                      </div>
                      <p className="text-caption text-text-primary font-semibold">{item.title}</p>
                      <span className="badge-gold text-tiny">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </LocalFadeIn>
          )}


          {/* 공유 리워드 배너 — Premium 은 PremiumResult 의 result-footer 가 담당 (중복 방지) */}
          {false && !isPremiumLayout && (
            <LocalFadeIn delay={80}>
              <button
                onClick={() => setShowShareModal(true)}
                className="w-full card-gold py-5 px-5 text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-h3 text-text-primary">친구에게 공유하면 1운 적립</p>
                    <p className="text-caption text-text-muted mt-0.5">공유받은 친구도 사주를 볼 수 있어요</p>
                  </div>
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #B8965A, #8C6D3D)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </div>
                </div>
              </button>
            </LocalFadeIn>
          )}

          {/* §7 AdBanner — 페이지 하단(footer 위) · build='appintos' && tier='free' 자체 분기 */}
          {adEligible && (
            <LocalFadeIn delay={80}>
              <div className="mt-2">
                <AdBanner tier={tier} locked={locked} />
              </div>
            </LocalFadeIn>
          )}

          {/* 출처 + 디스클레이머 — Premium 은 PremiumResult 의 ReportSources 가 담당 (중복 방지) */}
          {false && !isPremiumLayout && (
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
          )}

          {/* 3-part Footer CTA — Premium 은 자체 footer 가 있어 중복 방지 */}
          {false && !isPremiumLayout && (
            <FooterCTA pageKey="report" backTo="/storage" marginTop={24} />
          )}

          {/* §4 PaywallBar — sticky 72px (free + locked 시 scroll trigger 자체 처리) */}
          <PaywallBar
            tier={tier}
            locked={locked}
            onUnlock={handleUnlock}
            costLabel={unlockTarget.costLabel}
          />

          {/* Footer — 프리미엄 레이아웃에서는 PremiumResultFooter 가 자체 마무리하므로 숨김 */}
          {false && !isPremiumLayout && (
            <div className="text-center pt-8 pb-4">
              <div className="divider mb-4" />
              <p className="text-caption text-brand-gold font-bold">사주500</p>
              <p className="text-tiny text-text-hint mt-1">정통 명리학 기반 사주 분석 리포트</p>
              <p className="text-tiny text-text-disabled mt-1">
                &copy; 2026 사주500. 참고용이며 전문 상담을 대체하지 않아요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Phase D — BlurredSection / LockSvg / resolveUnlockTarget 은 _ui_chrome.tsx 로 이동 */
