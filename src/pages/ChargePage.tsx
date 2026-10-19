// Charge Page — #55 Sprint 2 UI 개편 (2026-04-24)
// 스펙: docs/mockups/사주500_UI개편_07_운충전.md §1-§15 · 핸드오버 §2-8
// 골격: TopBar 56 → HeroBar 104 → RedirectHint 60(조건) → ChargePackages 2col → Notice → CheckoutBar 80 sticky
// 보존(E13): grantPurchase 분기 토스트, IAP processProductGrant (웹 토스페이먼츠 복귀 처리는 2026-10-14 제거, 웹 결제는 포트원)
// SSOT 토큰 적용 · 광고 없음 · 원화 노출 허용 유일 페이지

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CHARGE_PACKAGES } from '@/constants/pricing';
import { getBalance, addPaidBalance } from '@/services/storage/localStore';
import { purchasePackage } from '@/services/payment/iapService';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { isAppintosBuild, hasNativeNavBack } from '@/lib/env';
import { isPortoneTestEnabled, isPortoneLiveEnabled, isPortoneLiveMethod, requestPortoneTestPayment, requestPortoneLivePayment, confirmPortonePaymentServer } from '@/services/payment/portonePayment';
import type { PortonePgMethod } from '@/services/payment/portonePayment';
import { trackEvent } from '@/services/analytics';
import { LegalFooter } from '@/components/layout/LegalFooter';
import { useAuth } from '@/hooks/useAuth';
import { WebLoginSheet } from '@/components/auth/WebLoginSheet';
import { rememberWebPayment, openRefundRequest } from '@/services/payment/refundRequest';
import { useActiveProfile } from '@/hooks/useHomeData';

// ── SSOT 토큰 (D1 fix 2026-04-23 / #55)
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#6F6557',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  goldLine: 'rgba(184,150,90,0.28)',
  line: '#E5DFD0',
  success: '#4E7A57',
} as const;


// ── 인라인 SVG 아이콘 (lucide 의존 회피)
function ArrowLeftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function CheckCircleIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.5" />
      <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function InfoIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

// ── Main
/**
 * 충전하러 온 이유 기억 (2026-10-19, 웹 유료광고 준비)
 *   다른 화면은 '무엇을 사러 왔는지(returnTo, message, need)'를 화면 이동 state 로 넘긴다. 그런데 웹 결제는
 *   로그인(모바일 리다이렉트)과 카카오페이(모바일 리다이렉트)에서 페이지가 통째로 떠났다 돌아와 state 가 사라졌다
 *   → 결제를 마쳐도 신년운세로 돌아가지 못하고 충전 화면에 남았다. 탭 안 저장소(sessionStorage)에 30분 동안 둔다.
 *   되살리는 건 페이지를 새로 연 경우(location.key === 'default')뿐 — 홈에서 충전을 누른 경우까지 옛 목적지로 보내지 않게.
 */
const CHARGE_CTX_KEY = 'saju500:charge_ctx';
type ChargeCtx = { returnTo?: string; message?: string; need?: number; selected?: string; loginThenPay?: number; at: number };
function readChargeCtx(): ChargeCtx | null {
  try {
    const raw = sessionStorage.getItem(CHARGE_CTX_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as ChargeCtx;
    if (!c || Date.now() - Number(c.at || 0) > 30 * 60e3) { sessionStorage.removeItem(CHARGE_CTX_KEY); return null; }
    return c;
  } catch { return null; }
}
function writeChargeCtx(patch: Partial<ChargeCtx> | null): void {
  try {
    if (!patch) { sessionStorage.removeItem(CHARGE_CTX_KEY); return; }
    sessionStorage.setItem(CHARGE_CTX_KEY, JSON.stringify({ ...(readChargeCtx() || {}), ...patch, at: Date.now() }));
  } catch { /* noop */ }
}

export function ChargePage() {
  // 2026-10-17 퍼널: 충전 화면을 연 230명 중 184명이 사주를 넣은 적이 없었다(158명은 첫 화면에서 바로). 그 사람들에게 무료 길을 먼저
  const { hasProfile } = useActiveProfile();
  usePageTitle('운(運) 충전');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  // 2026-10-16 — 웹 실결제는 로그인한 계정만 (오너: 로그인 없이 결제됨). 익명이면 로그인 시트 → 익명 계정에 연결(uid 그대로)
  const { login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // 2026-05-07 fix — 다른 페이지가 보낸 returnTo state 도 redirect 로 인식
  // (잔액 부족 모달 → 충전 → 원래 페이지 자동 복귀 UX 일관성)
  // 2026-10-19 — 로그인, 카카오페이에서 돌아온 경우엔 저장해 둔 목적을 되살린다 (위 readChargeCtx 설명)
  const [ctx] = useState<ChargeCtx | null>(() => {
    const st = (location.state as any) || {};
    const q = new URLSearchParams(window.location.search);
    const qNeed = Number(q.get('need')) || 0;
    if (st.returnTo || st.message || qNeed > 0 || q.get('redirect')) {
      const c: ChargeCtx = { returnTo: st.returnTo || q.get('redirect') || undefined, message: st.message || undefined, need: qNeed || undefined, at: Date.now() };
      writeChargeCtx(null);
      writeChargeCtx(c);
      return c;
    }
    if (location.key === 'default') return readChargeCtx(); // 페이지를 새로 연 경우(돌아온 경우)만
    writeChargeCtx(null);
    return null;
  });
  const stateReturnTo = ((location.state as any)?.returnTo as string | undefined) || ctx?.returnTo;
  const redirectTo = searchParams.get('redirect') || stateReturnTo || null;
  const needRaw = searchParams.get('need') || (ctx?.need ? String(ctx.need) : null);
  const needUn = needRaw && !Number.isNaN(Number(needRaw)) ? Number(needRaw) : null;
  // 2026-05-29 — 잔액부족 모달 등이 보낸 안내 메시지 (왜 충전 화면에 왔는지). 기존엔 어디서도 표시 안 됨.
  const stateMessage = ((location.state as any)?.message as string | undefined) || ctx?.message;

  // 2026-06-24 — '어떤 콘텐츠에서 결제를 결심했나' 트래킹용 source 파생.
  //   returnTo/redirect 경로에서 콘텐츠 type 우선, 없으면 need 값, 둘 다 없으면 'direct'.
  const chargeSource = (() => {
    const path = redirectTo || '';
    if (/^\/topic\/([a-z]+)/.test(path)) return `topic:${path.match(/^\/topic\/([a-z]+)/)![1]}`;
    if (/^\/result\b/.test(path)) return 'premium';
    if (/^\/chat\b/.test(path)) return 'chat';
    if (/^\/dream\b/.test(path)) return 'dream';
    if (/^\/daily\b/.test(path)) return 'daily';
    if (/^\/(daeun|monthly|compat|tojung)\b/.test(path)) return path.replace(/^\/([a-z]+).*/, '$1');
    if (needUn !== null && needUn > 0) return `need:${needUn}`;
    return 'direct';
  })();

  /**
   * 기본 선택 — `?need=N` 있으면 N 이상 충전되는 가장 작은 패키지 자동 선택,
   * 없으면 p15 (가장 인기 / 프리미엄 라인 / 5,000원).
   * 2026-04-27 4 패키지 정정: 구 p10 → 신 p15.
   */
  const initialSelected = (() => {
    if (ctx?.selected && CHARGE_PACKAGES.some((p) => p.id === ctx.selected)) return ctx.selected; // 로그인하고 돌아오면 고른 패키지 그대로
    if (needUn !== null && needUn > 0) {
      const sorted = [...CHARGE_PACKAGES].sort((a, b) => a.un - b.un);
      const fit = sorted.find((p) => p.un >= needUn);
      if (fit) return fit.id;
    }
    return 'p15';
  })();

  const [selected, setSelected] = useState(initialSelected);
  const [balance, setBalanceDisplay] = useState(() => getBalance());
  const [purchasing, setPurchasing] = useState(false);
  // PG 입점심사용 포트원 결제창 (2026-06-12) — 웹 전용 · 운 적립 없음 · 자동취소
  // 2026-06-19 PG 심사 — 심사관이 saju500.app 에서 충전 시 '결제창이 떠야' 입점심사 통과(시연).
  //   그래서 웹 충전 = 포트원 심사용 결제창 기본 노출. (포트원 계약 승인 후 실결제로 전환)
  //   ⚠️ 운 적립 없음·자동취소라 실청구 0 → 미런칭 상태에서 안전.
  const [showPgSheet, setShowPgSheet] = useState(false);
  // 2026-07-02 — 포트원 실결제 (PG 계약 승인 후 VITE_PORTONE_LIVE=1 로 오픈). live 가 test 보다 우선.
  const portoneLive = !isAppintosBuild && isPortoneLiveEnabled();
  const portoneTest = !isAppintosBuild && !portoneLive && isPortoneTestEnabled();
  // 2026-06-18 웹 런칭 — 웹 실결제 게이트. 앱인토스 IAP 는 항상 라이브.
  //   2026-07-02 — 포트원 실결제(VITE_PORTONE_LIVE=1)도 오픈 조건에 추가 (준기 결정: 웹 PG = 포트원).
  const webPaymentReady = isAppintosBuild || portoneLive;
  // 2026-10-16 — 실결제는 계약이 끝난 결제수단만(카카오페이). 카드는 이니시스 심사가 끝날 때까지 안내만.
  //   PG 심사관 확인용 시험 결제창은 ?pgreview=1 로만 연다(실사용자가 시험창에서 결제하는 일이 없게).
  const pgReview = !isAppintosBuild && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pgreview') === '1' && isPortoneTestEnabled();
  const payWith = (method: PortonePgMethod) => {
    if (pgReview) return handlePgTest(method);
    if (portoneLive) {
      if (isPortoneLiveMethod(method)) return handlePgLive(method);
      toast.show('카드 결제는 곧 열려요. 지금은 카카오페이로 충전할 수 있어요', 'info');
      return;
    }
    return handlePgTest(method);
  };

  // p15 → CHARGE_PACKAGES[3] (4 패키지 정정 후 마지막 인덱스)
  const selectedPkg =
    CHARGE_PACKAGES.find((p) => p.id === selected) ??
    CHARGE_PACKAGES.find((p) => p.id === 'p15') ??
    CHARGE_PACKAGES[CHARGE_PACKAGES.length - 1];

  // ── 결제 리다이렉트 복귀 처리 — 포트원 실결제 (토스페이먼츠 복귀는 2026-10-14 제거)
  useEffect(() => {
    // 포트원 실결제 리다이렉트 복귀 (모바일) — 서버 검증·지급 재개 (2026-07-02)
    const portonePid = searchParams.get('portone_pid');
    if (portonePid) {
      const portoneAmount = Number(searchParams.get('portone_amount') || 0);
      const pgCode = searchParams.get('code'); // 포트원이 실패 시 code/message 쿼리 부착
      if (pgCode) {
        import('@/services/analytics').then((a) => a.trackEvent('charge_failed', { pg: 'portone', reason: (searchParams.get('message') || pgCode).slice(0, 60) })).catch(() => {});
        toast.show(searchParams.get('message') || '결제가 완료되지 않았어요', 'warning');
        setSearchParams({}, { replace: true });
        return;
      }
      setPurchasing(true);
      confirmPortonePaymentServer(portonePid, portoneAmount)
        .then((r) => {
          if (r.ok && r.paidUn != null) {
            addPaidBalance(r.paidUn, r.bonusUn || 0);
            rememberWebPayment(portonePid, portoneAmount);
            setBalanceDisplay(getBalance());
            toast.show(r.message, 'success');
            import('@/services/analytics').then(a => a.trackEvent('charge_complete', { amount: portoneAmount, source: chargeSource, pg: 'portone' })).catch(() => {});
            writeChargeCtx(null);
            if (redirectTo) setTimeout(() => navigate(redirectTo, { replace: true }), 1400);
          } else {
            toast.show(r.message || '결제 확인에 실패했어요. 잔액이 안 늘었다면 고객센터로 문의해주세요.', 'warning');
          }
        })
        .finally(() => {
          setPurchasing(false);
          setSearchParams({}, { replace: true });
        });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2026-06-24 — 충전 페이지 진입 트래킹 (전환 트리거 출처 명시). page_view 파생 charge_open 과 별개로
  //   source 를 담아 '어떤 콘텐츠에서 결제를 결심했나' 파악. 마운트 1회.
  useEffect(() => {
    trackEvent('charge_open', { source: chargeSource });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 결제 핸들러
  const handlePurchase = async () => {
    if (!selectedPkg || purchasing) return;
    // 웹 실결제 전 로그인 — 익명으로 결제하면 브라우저 저장소가 지워질 때 운과 결제 기록을 찾을 길이 없다
    if (portoneLive && !pgReview) {
      const { auth } = await import('@/services/auth/firebase');
      if (!auth.currentUser || auth.currentUser.isAnonymous) {
        trackEvent('charge_login_gate', { source: chargeSource });
        // 모바일 리다이렉트 로그인으로 페이지가 떠났다 돌아와도 결제 창을 이어서 연다
        writeChargeCtx({ selected: selectedPkg.id, loginThenPay: Date.now(), returnTo: redirectTo || undefined, message: stateMessage, need: needUn || undefined });
        setShowLogin(true);
        return;
      }
    }
    // 포트원 결제수단 선택 시트 — live(실결제) 또는 심사용 테스트 (live 우선)
    if (portoneLive || portoneTest) { setShowPgSheet(true); return; }
    // 웹 실결제 미오픈(test 키) — 헛결제 방지 안내. 앱인토스 IAP·live 키면 통과.
    if (!webPaymentReady) {
      toast.show('웹 결제는 곧 열려요. 조금만 기다려 주세요', 'info');
      return;
    }
    setPurchasing(true);
    const result = await purchasePackage(selectedPkg);
    setPurchasing(false);
    if (result.success) {
      setBalanceDisplay(getBalance());
      toast.show(result.message, 'success');
      if (redirectTo) {
        setTimeout(() => navigate(redirectTo), 1400);
      } else {
        setTimeout(() => navigate(-1), 1500);
      }
    } else {
      // 유저가 스스로 닫은 취소는 경고가 아니라 안내 톤
      toast.show(result.message, result.message === '결제를 취소했어요' ? 'info' : 'warning');
    }
  };

  // 포트원 실결제 실행 (2026-07-02) — 지급은 서버 confirmPortonePayment 검증 후에만
  const handlePgLive = async (method: PortonePgMethod) => {
    if (!selectedPkg || purchasing) return;
    setShowPgSheet(false);
    setPurchasing(true);
    const r = await requestPortoneLivePayment(selectedPkg, method);
    setPurchasing(false);
    if (r.ok && r.paidUn != null) {
      addPaidBalance(r.paidUn, r.bonusUn || 0);
      if (r.paymentId) rememberWebPayment(r.paymentId, selectedPkg.price);
      setBalanceDisplay(getBalance());
      toast.show(r.message, 'success');
      import('@/services/analytics').then(a => a.trackEvent('charge_complete', { amount: selectedPkg.price, source: chargeSource, pg: 'portone' })).catch(() => {});
      writeChargeCtx(null);
      if (redirectTo) setTimeout(() => navigate(redirectTo), 1400);
    } else if (r.cancelled) {
      toast.show('결제가 취소됐어요', 'info');
    } else {
      import('@/services/analytics').then(a => a.trackEvent('charge_failed', { pg: 'portone', reason: (r.message || '').slice(0, 60) })).catch(() => {});
      toast.show(r.message || '결제에 실패했어요. 다시 시도해주세요.', 'warning');
    }
  };

  // PG 심사용 테스트 결제 실행 (2026-06-12) — 운 적립 절대 없음
  const handlePgTest = async (method: PortonePgMethod) => {
    if (!selectedPkg || purchasing) return;
    setShowPgSheet(false);
    setPurchasing(true);
    const r = await requestPortoneTestPayment({
      method,
      amount: selectedPkg.price,
      orderName: `사주500 ${selectedPkg.un}운 충전`,
    });
    setPurchasing(false);
    toast.show(r.message, r.ok ? 'success' : r.cancelled ? 'info' : 'warning');
  };

  const goBack = () => {
    writeChargeCtx(null);
    if (redirectTo) navigate(redirectTo);
    else navigate(-1);
  };

  // 2026-10-19 — 결제하려다 로그인하러 떠났다 돌아왔으면(모바일 리다이렉트), 로그인이 확인되는 대로 결제 창을 연다
  useEffect(() => {
    if (isAppintosBuild || !ctx?.loginThenPay || Date.now() - ctx.loginThenPay > 15 * 60e3) return;
    let off: (() => void) | undefined;
    let done = false;
    import('@/services/auth/firebase').then(({ auth }) => {
      off = auth.onAuthStateChanged((u) => {
        if (done || !u || u.isAnonymous) return;
        done = true;
        writeChargeCtx({ loginThenPay: 0 });
        setShowPgSheet(true);
      });
    }).catch(() => {});
    return () => { off?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: C.paper,
      paddingBottom: isAppintosBuild ? 'calc(96px + env(safe-area-inset-bottom))' : 'calc(150px + env(safe-area-inset-bottom))', // CheckoutBar 80 + 여유 (웹은 청약철회 고지 줄까지 136px — 2026-10-16 사업자 정보 끝줄이 가리던 것)
    }}>

      {/* ─── §2. TopBar (56px · sticky) ─── */}
      <div style={{
        height: 56, background: C.paper,
        borderBottom: `1px solid ${C.line}`,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* 앱인토스: 토스 내비바 뒤로가기와 중복 → 숨김 (2026-09-16 심사 반려 · env.ts hasNativeNavBack) */}
        {hasNativeNavBack ? (
          <div style={{ width: 40, flexShrink: 0 }} aria-hidden="true" />
        ) : (
          <button
            onClick={goBack}
            aria-label={redirectTo ? '닫기' : '뒤로 가기'}
            style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.ink, background: 'transparent', border: 'none',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {redirectTo ? <CloseIcon /> : <ArrowLeftIcon />}
          </button>
        )}
        <div style={{
          flex: 1, textAlign: 'center',
          fontSize: 17, fontWeight: 700, color: C.ink,
        }}>
          운 충전
        </div>
        {/* 잔액 (v9: 알약 배지, 장식 점, 금색 상태 표시 금지 → 먹색 글자) */}
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: C.ink, flexShrink: 0,
        }}>
          잔액 {balance}운
        </div>
      </div>

      {/* 사주를 넣은 적 없는 사람 → 충전보다 무료 오늘의 운세 먼저 (운이 모자라 넘어온 사람에겐 안 보임) */}
      {!hasProfile && !redirectTo && (
        <div style={{ margin: '14px 16px 0', background: '#FFFDF8', border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 16px 14px' }}>
          <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 17, fontWeight: 700, color: C.ink }}>충전하기 전에 무료로 먼저 보세요</div>
          <div style={{ marginTop: 6, fontSize: 14.5, color: C.inkSoft, lineHeight: 1.65 }}>생년월일만 넣으면 내 사주로 오늘의 운세를 풀어 드려요. 하루 한 번 무료예요.</div>
          <button
            type="button"
            onClick={() => { trackEvent('charge_free_first', {}); navigate('/input?from=daily'); }}
            style={{ marginTop: 12, width: '100%', minHeight: 48, borderRadius: 12, border: `1px solid ${C.ink}`, background: 'transparent', color: C.ink, fontWeight: 800, fontSize: 15.5, cursor: 'pointer' }}
          >
            무료로 오늘의 운세 보기
          </button>
        </div>
      )}

      {/* ─── §3. HeroBar (104px · 1운=500원 환율 명시 · 원화 노출 유일 진입점) ─── */}
      <div style={{
        height: 104, background: C.goldSoft,
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${C.goldLine}`,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 17, fontWeight: 700, color: C.ink,
            fontFamily: "'Noto Serif KR', serif", letterSpacing: '-0.01em',
          }}>
            운으로 사주를 봐요
          </div>
          <div style={{ marginTop: 4, fontSize: 13.5, color: C.inkSoft, lineHeight: 1.4 }}>
            <strong style={{ color: C.goldDeep, fontWeight: 700 }}>1운 = 500원</strong>으로 충전돼요
          </div>
          <div style={{ marginTop: 2, fontSize: 13, color: C.mute }}>
            사주 풀이는 모두 운(運)으로 결제해요
          </div>
        </div>
        {/* "運" SVG 64×64 */}
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden style={{ flexShrink: 0, marginLeft: 12 }}>
          <circle cx="32" cy="32" r="30" fill="rgba(184,150,90,0.22)" />
          <circle cx="32" cy="32" r="30" stroke={C.gold} strokeWidth="0.8" opacity="0.5" fill="none" />
          <text
            x="32" y="42" textAnchor="middle"
            fontSize="28" fontWeight="700"
            fill={C.goldDeep}
            fontFamily="'Noto Serif KR', serif"
          >運</text>
        </svg>
      </div>

      {/* ─── §4. RedirectHint (URL ?need=N 또는 state.message — 왜 충전 화면에 왔는지 안내) ─── */}
      {(needUn !== null && needUn > 0) || stateMessage ? (
        <div style={{
          margin: '12px 16px 0',
          minHeight: 60, background: '#FFFFFF',
          border: `1px solid ${C.line}`, borderRadius: 12,
          display: 'flex', alignItems: 'center',
          padding: '12px 16px', gap: 10,
        }}>
          <InfoIcon color={C.goldDeep} />
          <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500, lineHeight: 1.45 }}>
            {stateMessage
              ? stateMessage
              : <><strong style={{ color: C.goldDeep, fontWeight: 700 }}>{needUn}운</strong>이 필요한 풀이로 돌아가요</>}
          </span>
        </div>
      ) : null}

      {/* ─── §5. ChargePackages (2열 그리드 · 카드 128px) ─── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div
          role="radiogroup"
          aria-label="충전 패키지 선택"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          {CHARGE_PACKAGES.map((pkg) => {
            const isSelected = selected === pkg.id;
            const hasBonus = pkg.bonusUn > 0;
            return (
              <motion.button
                key={pkg.id}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${pkg.un}운 패키지${hasBonus ? ` (본 ${pkg.paidUn}운 + 보너스 ${pkg.bonusUn}운)` : ''}, ${pkg.price.toLocaleString()}원${pkg.label ? ', ' + pkg.label : ''}`}
                onClick={() => setSelected(pkg.id)}
                whileTap={{ scale: 0.98 }}
                style={{
                  minHeight: 138,
                  background: isSelected ? C.goldSoft : '#FFFFFF',
                  border: isSelected ? `2px solid ${C.gold}` : `1px solid ${C.line}`,
                  borderRadius: 16,
                  padding: isSelected ? '11px 11px' : '12px',
                  textAlign: 'left',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.18s ease',
                  gap: 6,
                }}
              >
                {/* 상단: 라벨 + 보너스/체크 */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  minHeight: 18,
                }}>
                  <span style={{
                    fontSize: 13.5, fontWeight: 700, color: C.goldDeep,
                    letterSpacing: '-0.01em',
                  }}>
                    {pkg.label || ' '}
                  </span>
                  {hasBonus ? (
                    <span style={{
                      fontSize: 13.5, fontWeight: 700, color: '#FFFFFF',
                      background: '#1A1612', padding: '2px 8px', borderRadius: 999, // 2026-10-10 v9 상태 표시는 먹
                      flexShrink: 0, lineHeight: 1.4,
                    }}>
                      +{pkg.bonusUn}운 보너스
                    </span>
                  ) : isSelected ? (
                    <CheckCircleIcon color={C.goldDeep} />
                  ) : null}
                </div>

                {/* 중단: Stage 7e-7 — "3운+1운 보너스" 형식 노출 (사용자 요청) */}
                <div>
                  <div style={{
                    fontSize: 17, fontWeight: 800, color: C.ink, lineHeight: 1.25,
                    letterSpacing: '-0.01em',
                  }}>
                    {hasBonus ? (
                      <>
                        {pkg.paidUn}운
                        <span style={{ color: C.gold, margin: '0 2px' }}>+</span>
                        {pkg.bonusUn}운
                        <span style={{ fontSize: 13, color: C.goldDeep, fontWeight: 700, marginLeft: 4 }}>
                          보너스
                        </span>
                      </>
                    ) : (
                      `${pkg.un}운`
                    )}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: C.goldDeep, marginTop: 4,
                  }}>
                    {pkg.price.toLocaleString()}원
                  </div>
                </div>

                {/* 하단: 유도 문구 */}
                <div style={{
                  fontSize: 13, color: C.inkSoft, lineHeight: 1.4, fontWeight: 500,
                }}>
                  {pkg.guide}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─── §8. Notice (이용 정책) ─── */}
      <div style={{ padding: '20px 20px 8px', marginTop: 12 }}>
        <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.75, margin: 0 }}>
          보너스 운은 돈으로 환불되지 않아요. 결제를 환불하면 그 결제로 받은 보너스 운도 함께 회수돼요.
        </p>
        <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.75, margin: 0 }}>
          구매한 운은 계정 종료 시 소멸돼요.
        </p>
        <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.75, margin: 0 }}>
          운은 사주500 안에서만 쓸 수 있어요.
        </p>
        {/* 환불·청약철회 고지 — 웹/앱 분기.
            앱(앱인토스): 토스 IAP/토스페이 우산. 웹: 전자상거래법 제17조 디지털콘텐츠 청약철회 직접 고지. */}
        {isAppintosBuild ? (
          /* P0-A · 토스페이 환불 정책 (앱인토스 검수 §1-12) */
          <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.75, margin: 0 }}>
            환불은 토스페이 결제 취소 정책을 따르며, 결제 후 7일 이내 미사용 운에 한해 고객센터(info@juulabel.com)로 문의 시 심사 후 처리해요.
          </p>
        ) : (
          <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.75, margin: 0 }}>
            충전한 운을 분석에 사용(생성)하면 해당 운은 환불되지 않아요. 미사용 운은 결제 후 7일 이내 환불 가능하며, 청약철회일로부터 3영업일 이내 환급돼요. (디지털콘텐츠, 전자상거래법 제17조){' '}
            {/* 2026-10-16 — 환불 요청 길 (눈에 띄지 않게 본문 속 작은 링크) */}
            <button type="button" onClick={() => { void openRefundRequest(); }} className="tap-pad"
              style={{ background: 'none', border: 0, padding: 0, color: C.mute, textDecoration: 'underline', fontSize: 13, cursor: 'pointer' }}>
              환불 요청
            </button>
          </p>
        )}
        <p style={{ fontSize: 13, color: C.mute, lineHeight: 1.75, margin: '6px 0 0' }}>
          결제와 세금 관련 안내는{' '}
          <button className="tap-pad"
            onClick={() => navigate('/terms')}
            style={{
              fontSize: 13.5, fontWeight: 600, color: C.goldDeep,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, textDecoration: 'underline',
            }}
          >이용약관</button>
          과{' '}
          <button className="tap-pad"
            onClick={() => navigate('/privacy')}
            style={{
              fontSize: 13.5, fontWeight: 600, color: C.goldDeep,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, textDecoration: 'underline',
            }}
          >개인정보처리방침</button>
          에서 확인하세요.
        </p>
      </div>

      {/* 사업자 신원정보 — PG 입점심사 요건 "판매(결제) 페이지 하단 고정 노출" (2026-07-02).
          앱인토스에서는 LegalFooter 내부 게이팅으로 자동 null. */}
      <LegalFooter />

      {/* ─── §9. CheckoutBar (80px sticky · slide-up) ─── */}
      <AnimatePresence>
        {selectedPkg && (
          <motion.div
            key="checkout-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: C.ink, color: C.paper,
              zIndex: 100,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.18)',
            }}
            aria-live="polite"
          >
            {/* 웹 전용 — 결제 직전 청약철회 고지 (전자상거래법 제17조: 디지털콘텐츠 청약철회 불가 사실 결제 전 명시) */}
            {!isAppintosBuild && (
              <div style={{
                padding: '8px 20px',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'rgba(248,245,238,0.72)',
                borderBottom: '1px solid rgba(248,245,238,0.12)',
              }}>
                미사용 운은 7일 안에 전액 환불돼요, 분석에 사용한 운은 환불이 어려워요
              </div>
            )}
            <div style={{
              height: 80,
              padding: '0 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12,
            }}>
              {/* 좌: 선택한 패키지 요약 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600,
                  color: 'rgba(248,245,238,0.6)',
                  letterSpacing: '-0.01em',
                }}>
                  선택한 패키지
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 700, color: C.paper,
                  marginTop: 3, letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {selectedPkg.bonusUn > 0
                    ? `${selectedPkg.paidUn}운 + ${selectedPkg.bonusUn}운 보너스`
                    : `${selectedPkg.un}운`}
                </div>
              </div>

              {/* 우: 결제하기 버튼 (높이 48 · 폭 140) */}
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                style={{
                  height: 50, minWidth: 140, padding: '0 18px',
                  background: purchasing ? 'rgba(210,180,119,0.5)' : 'linear-gradient(180deg, #D2B477 0%, #B8965A 100%)',
                  color: '#17110A', borderRadius: 14,
                  fontSize: 16, fontWeight: 800,
                  cursor: purchasing ? 'not-allowed' : 'pointer',
                  border: 'none',
                  letterSpacing: '-0.01em',
                  transition: 'opacity 0.15s',
                  flexShrink: 0,
                }}
              >
                {purchasing
                  ? '처리 중...'
                  : (!webPaymentReady && !portoneTest)
                    ? '결제 준비 중'
                    : (isAppintosBuild ? '토스페이로 결제' : `${selectedPkg.price.toLocaleString()}원 결제하기`)}
              </button>
            </div>
            {/* iOS 홈바 영역 흡수 */}
            <div style={{ height: 'env(safe-area-inset-bottom)', background: C.ink }} />

            {/* PG 심사용 테스트 결제수단 시트 (2026-06-12 · 웹 전용) */}
            <AnimatePresence>
              {showPgSheet && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setShowPgSheet(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.45)', zIndex: 60 }}
                  />
<motion.div
                    initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    style={{
                      // 센터링은 margin auto 로 — transform 은 framer-motion y 애니메이션이 덮어씀 (2026-06-12 fix)
                      position: 'fixed', left: 0, right: 0, bottom: 0, margin: '0 auto',
                      width: '100%', maxWidth: 520, background: C.paper,
                      borderRadius: '20px 20px 0 0', padding: '10px 20px calc(20px + env(safe-area-inset-bottom))',
                      zIndex: 61, boxSizing: 'border-box',
                    }}
                  >
                    {/* 그래버 핸들 (바텀시트 표준 affordance) */}
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(26,26,26,0.15)', margin: '0 auto 14px' }} />

                    {/* 헤더: 타이틀 + 닫기 X */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <p style={{ fontSize: 17, fontWeight: 800, color: C.ink, margin: 0 }}>결제하기</p>
                      <button onClick={() => setShowPgSheet(false)} aria-label="닫기" style={{
                        width: 32, height: 32, borderRadius: 16, border: 'none', cursor: 'pointer',
                        background: 'rgba(26,26,26,0.06)', color: C.mute, fontSize: 16, lineHeight: 1,
                      }}>✕</button>
                    </div>

                    {/* 주문 요약 — 누르기 직전 금액 재확인 (이탈 방지 1순위) */}
                    {selectedPkg && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'rgba(184,150,90,0.08)', border: '1px solid rgba(184,150,90,0.25)',
                        borderRadius: 14, padding: '14px 16px', marginBottom: 16,
                      }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                          {selectedPkg.bonusUn > 0 ? `${selectedPkg.paidUn}운 + ${selectedPkg.bonusUn}운 보너스` : `${selectedPkg.un}운`}
                        </span>
                        <span style={{ fontSize: 17, fontWeight: 800, color: '#8C6D3D' }}>
                          {selectedPkg.price.toLocaleString()}원
                        </span>
                      </div>
                    )}

                    {/* 결제 수단 — 아이콘 + 라벨 리스트 행 (토스·배민 문법). live 활성 시 실결제 라우팅 */}
                    <button onClick={() => payWith('card')} style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 60,
                      padding: '0 16px', borderRadius: 14, cursor: 'pointer', marginBottom: 8,
                      border: '1px solid rgba(26,26,26,0.10)', background: '#FFFFFF', textAlign: 'left',
                    }}>
                      <span style={{
                        width: 36, height: 36, borderRadius: 9, background: 'rgba(26,26,26,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="#1A1A1A" strokeWidth="1.8" />
                          <rect x="2.5" y="8.4" width="19" height="3" fill="#1A1A1A" />
                          <rect x="5.5" y="14.4" width="6" height="1.8" rx="0.9" fill="#1A1A1A" />
                        </svg>
                      </span>
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: C.ink }}>신용과 체크카드{portoneLive && !pgReview && !isPortoneLiveMethod('card') && <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.mute }}>곧 열려요</span>}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#B9B2A8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button onClick={() => payWith('kakaopay')} style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 60,
                      padding: '0 16px', borderRadius: 14, cursor: 'pointer', marginBottom: 14,
                      border: '1px solid rgba(26,26,26,0.10)', background: '#FFFFFF', textAlign: 'left',
                    }}>
                      <span style={{
                        width: 36, height: 36, borderRadius: 9, background: '#FEE500',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {/* 카카오 말풍선 심볼 */}
                        <svg width="20" height="19" viewBox="0 0 24 22" fill="none">
                          <path d="M12 1C5.92 1 1 4.93 1 9.78c0 3.07 1.97 5.77 4.95 7.33l-1.2 4.45c-.1.4.35.72.7.49l5.23-3.48c.44.04.88.07 1.32.07 6.08 0 11-3.93 11-8.86C23 4.93 18.08 1 12 1z" fill="#1A1A1A" />
                        </svg>
                      </span>
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: C.ink }}>카카오페이</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#B9B2A8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>

                    {/* 안내 — 시험 결제창일 때만 '청구되지 않아요', 실결제일 때는 처리 주체 */}
                    <p style={{ fontSize: 13, color: C.mute, margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
                      {portoneLive && !pgReview
                        ? '결제는 포트원과 카카오페이가 처리해요. 결제한 운은 바로 들어와요'
                        : '지금은 결제 시스템을 점검하고 있어요. 실제로 청구되지 않고 자동으로 취소돼요'}
                    </p>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* 웹 결제 전 로그인 시트 (2026-10-16) — 앱 빌드에서는 렌더하지 않는다 */}
            {!isAppintosBuild && (
              <WebLoginSheet
                open={showLogin}
                onClose={() => setShowLogin(false)}
                onSuccess={() => { writeChargeCtx({ loginThenPay: 0 }); setShowLogin(false); setShowPgSheet(true); }}
                toast={toast}
                onLogin={login}
                title={['결제 전에', '로그인해 주세요']}
                desc={['충전한 운과 결제 내역을 계정에 지켜 둬요', '다른 기기에서도 그대로 쓸 수 있어요']}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChargePage;
