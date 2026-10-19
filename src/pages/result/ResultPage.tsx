// Phase A (#54) — slimmed main from ResultPage.tsx (lines 2278-3420)
// Phase C (#54) — props 시그니처 + L1~L4 블러 분기 + 블러 해제 애니메이션 + 4 chrome mount
// Main component only — types/atoms/visuals/chrome extracted to siblings

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasNativeNavBack } from '@/lib/env';
import { useAttendanceOnResult } from '@/hooks/useAttendanceOnResult';
import { computeTopicScores } from '@/utils/sajuScores';
import { useSajuContext } from '@/contexts/SajuContext';
import { Header } from '@/components/layout/Header';
import { ErrorState } from '@/components/common/ErrorState';
import { ReviewAsk } from '@/components/common/ReviewAsk';
import { useToast } from '@/components/common/Toast';
import { AILoading } from '@/components/common/AILoading';
import {
  getReport, getReports, getMyProfile, saveReport, refundBalance, getPendingSpends,
  type LocalReport,
} from '@/services/storage/localStore';
// 2026-05-29 C1 fix — 프리미엄 SSE 실패 시 환불 금액 산정 (세일 반영).
import { getPremiumPrice } from '@/constants/pricing';
import {
  getDemoData,
  mapPillars, mapDaeun, mapSinSal,
} from './_data';
import { LocalFadeIn } from './_atoms';
import {
  PaywallBar,
  ShareSheet,
  AdBanner,
  resolveUnlockTarget,
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

import { realName } from '@/utils/personName';
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

/** 결과 본문 섹션 (렌더 오류 시 평문 폴백용) — 2026-10-14 1운 리포트 시각화(_visuals) 삭제로 여기로 옮김 */
interface SectionData {
  id: string;
  icon: string;
  title: string;
  keyInsight?: string;
  content: string;
  visual?: string;
}

interface ResultGate {
  tier: 'free' | 'paid';
  locked: boolean;
  adEligible: boolean;
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
        background: '#1A1612', // 2026-10-13 v9 먹 단색
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
          {realName(name) ? `${realName(name)} 님의 사주 풀이` : '사주 풀이'}
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#E8D9B8',
            marginTop: 2,
            letterSpacing: '0.05em',
          }}
        >
          종합사주 열 장 풀이
        </div>
      </div>
      <div
        style={{
          background: 'transparent',
          color: '#E2C98F',
          border: '1px solid rgba(214,184,122,0.7)',
          fontSize: 13,
          fontWeight: 700,
          padding: '3px 9px',
          borderRadius: 2,
          letterSpacing: '0.04em',
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

  return { tier, locked, adEligible };
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
    // 0. 2026-10-17 — 이미 저장된 기록을 다시 여는 경우(새로 만든 직후가 아님)는 그 기록의 사주가 먼저.
    //    예전엔 앱이 기억하는 사주(ctx)가 먼저라, 뒤로 가기로 돌아오면 본문은 A 인데 이름과 팔자는 다른 사람이 나왔다.
    const freshNow = typeof window !== 'undefined' && /[?&]fresh=1/.test(window.location.search);
    if (!freshNow && reportId && reportId !== 'local') {
      const own = getReport(reportId);
      if (own?.sajuData?.pillars?.length) return own.sajuData;
    }
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
        <Header title="종합사주" />
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
   *   결제 직진 진입(`/result/:id?fresh=1&type=premium`) 시 ResultPage 가
   *   직접 SSE 구동 → 그룹 도착마다 점진 렌더. PremiumResult 가 partial-safe
   *   (`aiResult ?? {}` + 모든 sub-component 방어) 라 빈 객체로 시작해도 안전. */
  const _qs = window.location.search;
  // 2026-10-14 — 1운 기본 리포트 생성 경로 제거: fresh 생성은 종합사주(type=premium)만. type 없는 fresh=1 은 생성하지 않는다
  //   (예전엔 basic SSE 를 불러 서버 차감 없이 만들고, 실패하면 로컬로 1운을 '환불'하는 구멍이 있었다)
  const isFreshMode = /[?&]fresh=1\b/.test(_qs) && /[?&]type=premium\b/.test(_qs);
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
        // 2026-10-15 보관함 'N운 사용' 장부 — 결제 때 장부에 남긴 금액, 없으면 지금 가격
        spentUn: (() => {
          try { const p = getPendingSpends().find((x) => x.type === 'premium'); if (p && p.amount >= 0) return p.amount; } catch { /* noop */ }
          return getPremiumPrice().actualPrice;
        })(),
      });
      // 결과 영속 완료 → premium pending 해제 (부팅 자동환불 대상 제외)
      import('@/services/storage/localStore').then(m => m.clearPendingSpendByType('premium')).catch(() => {});
    } catch { /* noop — UI 는 streamingAiResult 로 이미 렌더됨 */ }
    // URL 정리 (fresh 쿼리 제거 — 새로고침 시 재생성 방지)
    navigate(window.location.pathname, { replace: true });
  }, [reportId, sajuData, navigate]);

  // 차감액 산정: 세일 반영 actualPrice. 1회만 환불 (refundedRef 가드).
  // 🚨 2026-07-01 — 환불 전에 recovery 먼저: 서버가 이미 완성·저장(generatePremiumReportStream recovery 블롭)했으면
  //   재생성 0 으로 그대로 전달 → "서버 성공·전달 실패 → 환불+'분석실패'+토큰낭비" 근본 차단(준기 지적).
  const handleStreamFailure = useCallback(async (_msg: string) => {
    if (streamSettledRef.current || refundedRef.current) return;
    {
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
    const refundAmount = getPremiumPrice().actualPrice;
    try { refundBalance(refundAmount); } catch { /* noop */ }
    // 즉시 환불했으므로 pending 해제 (부팅 이중환불 방지)
    import('@/services/storage/localStore').then(m => m.clearPendingSpendByType('premium')).catch(() => {});
    setStreamError(`풀이를 만들지 못해서 ${refundAmount}운을 돌려드렸어요. 잠시 뒤 다시 만들어 주세요.`);
  }, [sajuData, deliverReport]);

  useEffect(() => {
    if (!isFreshMode || loadedReport || streamStartedRef.current || !sajuData) return;
    streamStartedRef.current = true;
    // 🚨 2026-06-22 CRITICAL — wall-clock 워치독(최종 안전망). 연결 hang(reader 무한대기)·부분그룹 도착 후
    //   멈춤 등 gotTerminal/catch 가 못 잡는 '진짜 멈춤'에서, 완료/실패 신호가 전혀 없으면 강제
    //   실패처리(환불 + 에러카드) → "로딩만 길고 결과 안 나옴" 영구 멈춤을 근본 차단.
    // 2026-06-24 — 180→120초 단축. 정상 종합사주 생성 상한 ~80-90초라 120초는 정상을 안 자르고 끊김 꼬리만 컷
    //   (토스 P99 로딩 150초 = 끊긴 채 워치독까지 매달린 값 → 천장을 120초로 낮춰 P99 직접 절감).
    watchdogRef.current = setTimeout(() => {
      if (!streamSettledRef.current) handleStreamFailure('시간 초과: 응답이 너무 오래 걸렸어요');
    }, 120000);
    (async () => {
      try {
        const mod = await import('@/services/ai/reportGenerator');
        // 🚨 2026-07-01 — 토스 웹뷰는 장시간 SSE 스트림을 조기종료(종합사주 "안 나옴"·토큰낭비 직접 원인).
        //   앱인토스는 SSE 끄고 안정적 callable(단일 요청·완성본 한 번에)로 직행. 웹만 SSE(점진 렌더) 유지.
        const { isAppsInToss } = await import('@/services/payment/iapService');
        if (isAppsInToss()) {
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
        await mod.generatePremiumReportStream(sajuData as any, undefined, {
          onGroup: (_g: 'A' | 'D' | 'B' | 'C', data: any) => {
            // 그룹 단위 머지 (필드 누적). tier='premium' 표식은 final 에서 박음
            setStreamingAiResult((prev: any) => mergePremiumGroup(prev, data));
            setArrivedGroups((prev) => (prev[_g] ? prev : { ...prev, [_g]: true }));
          },
          onDone: ({ content }: { reportId: string; content: any }) => {
            deliverReport({ ...(content as any), tier: 'premium' as const }); // 완성본 전달(영속·pending해제·URL정리 공통)
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
  }, [isFreshMode, sajuData, reportId]);

  // 2026-05-28 v3 — Fresh SSE 모드 정책 재정의:
  //   v1: 첫 필드 도착까지 AILoading (60-90초 답답)
  //   v2: 5초 후 강제 결과 진입 (빈 페이지 + 1분 빈 스켈레톤 — 더 안 좋음)
  //   v3: AILoading 유지 (첫 그룹 도착까지) → 결과 페이지 진입 시점엔 이미 첫 그룹(A) 데이터 있음
  //       AILoading 자체가 충분히 풍성 (사주 미니카드 + 5단계 인디케이터 + 명리학 팁) — user 읽을거리 충분.
  //       첫 group 도착 시 (Opus 14K ≈ 40-60초) 결과 페이지로 자연스럽게 전환.
  const isPremiumStreaming =
    isFreshMode && !loadedReport;
  // 2026-06-02 QA — fresh 스트리밍(premium+basic 공통) 빈-상태 게이트.
  //   기존: premium 만 AILoading 게이트 → basic(1운) fresh 는 빈 데이터로 렌더 시작 → "흰 화면 → 섹션 툭" 발생.
  //   수정: premium·basic 모두 첫 그룹 도착 전엔 AILoading 풀스크린 → 절대 빈 페이지 안 보임.
  const isFreshStreaming = isFreshMode && !loadedReport;
  // premium 스트리밍 진행 중(전 그룹 도착 전) — 상단 배너 게이트용
  const isPremiumStreamingIncomplete =
    isPremiumStreaming && !(arrivedGroups.A && arrivedGroups.D && arrivedGroups.B && arrivedGroups.C);
  // 2026-06-24 — 인플루언서 피드백: 부분 결과를 먼저 보여주면 fallback→AI 로 '읽는 도중 내용이 바뀌어' 혼란
  //   ("로딩중이었구나"). → 완성본만 노출. 전 그룹(A·B·C) 도착 전엔 premium·basic 모두 AILoading 유지(절대 부분 X).
  // 4그룹(premium A·D·B·C)
  const allGroupsArrived = arrivedGroups.A && arrivedGroups.D && arrivedGroups.B && arrivedGroups.C;
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

  // 결과가 실제로 있을 때 1회 — 출석 마커 + 일일/연속 보상 (출시 프로모션 50원은 2026-10 종료).
  //   fresh 생성은 전 그룹 도착 후(중도 실패·환불 건 제외). 보관함 재진입 등 모든 결과 도달 커버.
  const hasRealResult = !!storedReport && (!isFreshMode || allGroupsArrived);
  useEffect(() => {
    if (!hasRealResult || attendanceFiredRef.current) return;
    attendanceFiredRef.current = true;
    markAttendance().catch(() => {/* non-blocking */});
    import('@/services/storage/dailyReward').then(m => m.processAttendanceRewards());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRealResult]);

  // ── Phase C · 결과 게이트 도출 (서버 응답 기준)
  const gate = useMemo(() => deriveResultGate(storedReport), [storedReport]);
  const tier = props.tier ?? gate.tier;
  const locked = props.locked ?? gate.locked;
  const adEligible = props.adEligible ?? gate.adEligible;

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
      isFreshMode ||
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

  // 2026-10-17 — 다시 여는 기록은 그 기록의 이름과 입력이 먼저 (위 sajuData 와 같은 기준)
  const ownInput = !isFreshMode && (storedReport?.input as any)?.birthYear ? storedReport!.input : null;
  const name = (!isFreshMode && storedReport?.name) || ctxInput?.name || storedReport?.name || sajuData.input?.name || '사용자';
  const input = ownInput || ctxInput || storedReport?.input || sajuData.input;
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
  // 2026-05-04 동적화 — AI 응답의 daeunPeriods (8 대운별 score+reason) 전달.
  // AI 가 안 보내거나 일부만 보내도 mapDaeun 내부에서 매칭 안 되는 항목은 score=undefined → 클라이언트 fallback.
  const aiDaeunPeriods = (aiResult as any)?.daeunPeriods;
  const v4Daeun = mapDaeun(sajuData.daeun, input.birthYear, aiDaeunPeriods);
  const v4Gilsin = mapSinSal(sajuData.gilsin);
  const v4Hyungsal = mapSinSal(sajuData.hyungsal);

  // 점수: AI 결과 우선, 없으면 오행 기반 추정
  // 통일된 명리학 가중치 점수 — sajuScores.ts (모든 페이지 공유)
  const scores = useMemo((): Record<string, number> => {
    return computeTopicScores({
      sajuData,
      aiScores: aiResult?.scores,
    });
  }, [sajuData, aiResult]);


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
  const topScoreLabel = { career: '직업운', love: '연애운', wealth: '재물운', health: '건강운', potential: '잠재력' }[topScoreEntry[0]] || '';

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
        <Header title="종합사주" />
        <ErrorState
          title="풀이를 만들지 못했어요"
          description={streamError}
          onRetry={() => navigate('/premium', { replace: true })}
          retryLabel="다시 만들기"
        />
        {/* 2026-10-16 — 막다른 화면이던 것: 다시 만들기(운은 이미 돌려받음) + 홈, 고객문의 */}
        <div className="max-w-mobile mx-auto px-5 pb-10 flex gap-2">
          <button type="button" onClick={() => navigate('/', { replace: true })}
            className="flex-1 py-3 rounded-xl text-h3 font-semibold" style={{ background: '#FFFDF8', border: '1px solid #E1D7C4', color: '#4B4238' }}>
            홈으로
          </button>
          <button type="button" onClick={() => navigate(`/my?inquiry=ai_fail${reportId ? `&rid=${encodeURIComponent(reportId)}` : ''}`)}
            className="flex-1 py-3 rounded-xl text-h3 font-semibold" style={{ background: '#FFFDF8', border: '1px solid #E1D7C4', color: '#4B4238' }}>
            고객문의
          </button>
        </div>
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
        <Header title="종합사주" />
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
            onClick={() => navigate(`/my?inquiry=ai_fail${reportId ? `&rid=${encodeURIComponent(reportId)}` : ''}`)}
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
  if (isFreshStreamingIncomplete && !anyGroupArrived) {
    return (
      <AILoading
        name={name}
        type="종합사주"
        sajuData={sajuData}
        estimatedSeconds={100}
        steps={[
          '사주 8자와 오행 구조를 분석하고 있어요',
          '십성과 용신과 조후를 도출하고 있어요',
          '대운과 올해 흐름을 짚고 있어요',
          '관계와 실천 전략을 정리하고 있어요',
          '종합 리포트를 완성하고 있어요',
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
                <p className="text-h3 text-func-warning">태어난 시를 넣지 않았어요</p>
                <p className="text-caption text-text-secondary mt-1 leading-relaxed">
                  현재 3기둥 6글자로 분석 중이에요. 출생시간을 입력하면 <b>시주(時柱)</b>가 추가되어 더 자세히 풀 수 있어요.
                </p>
              </div>
            </LocalFadeIn>
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
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#5C4A2E', marginBottom: 4 }}>
                  풀이를 쓰는 중이에요, {(arrivedGroups.A ? 1 : 0) + (arrivedGroups.D ? 1 : 0) + (arrivedGroups.B ? 1 : 0) + (arrivedGroups.C ? 1 : 0)}/4 도착
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                  {(['A', 'D', 'B', 'C'] as const).map((g) => (
                    <div key={g} style={{ flex: 1, height: 4, borderRadius: 2, background: arrivedGroups[g] ? '#B8965A' : 'rgba(184,150,90,0.18)', transition: 'background 0.4s' }} />
                  ))}
                </div>
                <div style={{ fontSize: 13, color: '#8C6D3D', lineHeight: 1.5 }}>
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





          {/* §7 AdBanner — 페이지 하단(footer 위) · build='appintos' && tier='free' 자체 분기 */}
          {adEligible && (
            <LocalFadeIn delay={80}>
              <div className="mt-2">
                <AdBanner tier={tier} locked={locked} />
              </div>
            </LocalFadeIn>
          )}



          {/* §4 PaywallBar — sticky 72px (free + locked 시 scroll trigger 자체 처리) */}
          <PaywallBar
            tier={tier}
            locked={locked}
            onUnlock={handleUnlock}
            costLabel={unlockTarget.costLabel}
          />

        </div>
      </div>
    </div>
  );
}

/* Phase D — BlurredSection / LockSvg / resolveUnlockTarget 은 _ui_chrome.tsx 로 이동 */
