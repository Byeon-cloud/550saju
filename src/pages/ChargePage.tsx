// Charge Page — #55 Sprint 2 UI 개편 (2026-04-24)
// 스펙: docs/mockups/사주500_UI개편_07_운충전.md §1-§15 · 핸드오버 §2-8
// 골격: TopBar 56 → HeroBar 104 → RedirectHint 60(조건) → ChargePackages 2col → Divider → ShareRewardCard 140 → Notice → CheckoutBar 80 sticky
// 보존(E13): confirmTossPayment / grantPurchase 분기 토스트, IAP processProductGrant
// SSOT 토큰 적용 · 광고 없음 · 원화 노출 허용 유일 페이지

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CHARGE_PACKAGES } from '@/constants/pricing';
import { getBalance, addPaidBalance } from '@/services/storage/localStore';
import { purchasePackage } from '@/services/payment/iapService';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getRemainingShareRewards } from '@/services/share/shareReward';
import { isAppintosBuild } from '@/lib/env';
import { isPortoneTestEnabled, requestPortoneTestPayment } from '@/services/payment/portonePayment';
import type { PortonePgMethod } from '@/services/payment/portonePayment';

// ── SSOT 토큰 (D1 fix 2026-04-23 / #55)
const C = {
  paper: '#F8F5EE',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.14)',
  goldLine: 'rgba(184,150,90,0.28)',
  line: '#E5DFD0',
  success: '#2E7D32',
} as const;

const MAX_DAILY_SHARES = 3;

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
export function ChargePage() {
  usePageTitle('운(運) 충전');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  // 2026-05-07 fix — 다른 페이지가 보낸 returnTo state 도 redirect 로 인식
  // (잔액 부족 모달 → 충전 → 원래 페이지 자동 복귀 UX 일관성)
  const stateReturnTo = (location.state as any)?.returnTo as string | undefined;
  const redirectTo = searchParams.get('redirect') || stateReturnTo || null;
  const needRaw = searchParams.get('need');
  const needUn = needRaw && !Number.isNaN(Number(needRaw)) ? Number(needRaw) : null;
  // 2026-05-29 — 잔액부족 모달 등이 보낸 안내 메시지 (왜 충전 화면에 왔는지). 기존엔 어디서도 표시 안 됨.
  const stateMessage = (location.state as any)?.message as string | undefined;

  /**
   * 기본 선택 — `?need=N` 있으면 N 이상 충전되는 가장 작은 패키지 자동 선택,
   * 없으면 p15 (가장 인기 / 프리미엄 라인 / 5,000원).
   * 2026-04-27 4 패키지 정정: 구 p10 → 신 p15.
   */
  const initialSelected = (() => {
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
  // PG 입점심사용 테스트 결제 (2026-06-12) — 웹 전용 · 운 적립 없음 · 자동취소
  const [showPgSheet, setShowPgSheet] = useState(false);
  const portoneTest = !isAppintosBuild && isPortoneTestEnabled();
  const [remainingShares, setRemainingShares] = useState(() => getRemainingShareRewards());

  // p15 → CHARGE_PACKAGES[3] (4 패키지 정정 후 마지막 인덱스)
  const selectedPkg =
    CHARGE_PACKAGES.find((p) => p.id === selected) ??
    CHARGE_PACKAGES.find((p) => p.id === 'p15') ??
    CHARGE_PACKAGES[CHARGE_PACKAGES.length - 1];

  // ── E13 · Toss Payment 리다이렉트 복귀 처리 (보존)
  useEffect(() => {
    const pgStatus = searchParams.get('pg');
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    if (pgStatus === 'fail') {
      const errMsg = searchParams.get('message') || '결제가 취소됐어요';
      toast.show(errMsg, 'warning');
      setSearchParams({}, { replace: true });
      return;
    }

    if (paymentKey && orderId && amount) {
      setPurchasing(true);

      import('@/services/payment/tossPayments').then(({ confirmTossPayment }) => {
        confirmTossPayment(paymentKey, orderId, Number(amount))
          .then((result) => {
            if (result.success && result.paidUn != null) {
              addPaidBalance(result.paidUn, result.bonusUn || 0);
              setBalanceDisplay(getBalance());
              toast.show(result.message, 'success');
              // 2026-05-29 — 어드민 매출 퍼널: 충전 완료 이벤트
              import('@/services/analytics').then(a => a.trackEvent('charge_complete', { amount: Number(amount) || 0 }));
              import('@/services/toss/tossPromotion').then(m =>
                m.triggerPromotionEvent(m.PROMO_EVENTS.CHARGE, { amount: String(amount) })
              );
              if (redirectTo) setTimeout(() => navigate(redirectTo), 1400);
            } else {
              toast.show(result.message || '결제 처리에 실패했어요', 'warning');
            }
          })
          .catch((err) => {
            // E13 · 서버 에러 유형별 분기 (보존)
            const raw = err?.message || '';
            let userMsg: string;
            if (raw.includes('고객센터')) {
              userMsg = raw; // needs_reconciliation
            } else if (raw.includes('이미 처리된')) {
              userMsg = '이미 처리된 결제예요. 잔액을 확인해주세요.';
            } else if (raw.includes('결제 승인 실패')) {
              userMsg = '결제가 취소됐어요. 다시 시도해주세요.';
            } else {
              userMsg = '결제 확인 중 오류가 발생했어요. 다시 시도해주세요.';
            }
            toast.show(userMsg, 'warning');
          })
          .finally(() => {
            setPurchasing(false);
            setSearchParams({}, { replace: true });
          });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 결제 핸들러
  const handlePurchase = async () => {
    if (!selectedPkg || purchasing) return;
    // PG 심사용 테스트 결제 — 결제수단 선택 시트 (실청구 X · 운 적립 X)
    if (portoneTest) { setShowPgSheet(true); return; }
    setPurchasing(true);
    const result = await purchasePackage(selectedPkg);
    setPurchasing(false);
    if (result.success) {
      setBalanceDisplay(getBalance());
      toast.show(result.message, 'success');
      import('@/services/toss/tossPromotion').then(m =>
        m.triggerPromotionEvent(m.PROMO_EVENTS.CHARGE, { package: selectedPkg.name })
      );
      if (redirectTo) {
        setTimeout(() => navigate(redirectTo), 1400);
      } else {
        setTimeout(() => navigate(-1), 1500);
      }
    } else {
      toast.show(result.message, 'warning');
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

  // ── 공유 핸들러 — 전 앱 통합 (inviteFriendsViaToss SSOT)
  const handleShare = async () => {
    try {
      const { inviteFriendsViaToss } = await import('@/services/share/shareReward');
      await inviteFriendsViaToss({
        onReward: (earned) => {
          setBalanceDisplay(getBalance());
          setRemainingShares(getRemainingShareRewards());
          toast.show(`공유 완료! ${earned}운이 적립됐어요`, 'success');
        },
        onShared: () => {
          setRemainingShares(getRemainingShareRewards());
          toast.show('오늘 공유 보상은 다 받았어요 (하루 3회)', 'info');
        },
        onCancel: () => toast.show('공유가 취소됐어요', 'info'),
      });
    } catch (e) {
      console.warn('[Share]', e);
      toast.show('다시 시도해주세요', 'info');
    }
  };

  const goBack = () => {
    if (redirectTo) navigate(redirectTo);
    else navigate(-1);
  };

  const sharesUsed = MAX_DAILY_SHARES - remainingShares;

  return (
    <div style={{
      minHeight: '100vh',
      background: C.paper,
      paddingBottom: 'calc(96px + env(safe-area-inset-bottom))', // CheckoutBar 80 + 여유
    }}>

      {/* ─── §2. TopBar (56px · sticky) ─── */}
      <div style={{
        height: 56, background: C.paper,
        borderBottom: `1px solid ${C.line}`,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
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
        <div style={{
          flex: 1, textAlign: 'center',
          fontSize: 17, fontWeight: 700, color: C.ink,
        }}>
          운 충전
        </div>
        {/* 잔액 뱃지 */}
        <div style={{
          background: C.goldSoft, borderRadius: 999,
          padding: '5px 11px', fontSize: 13, fontWeight: 700,
          color: C.goldDeep, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 9, lineHeight: 1 }}>●</span>
          {balance}운
        </div>
      </div>

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
          <div style={{ marginTop: 2, fontSize: 11.5, color: C.mute }}>
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
                    fontSize: 11, fontWeight: 700, color: C.goldDeep,
                    letterSpacing: '-0.01em',
                  }}>
                    {pkg.label || ' '}
                  </span>
                  {hasBonus ? (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#FFFFFF',
                      background: C.success, padding: '2px 7px', borderRadius: 999,
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
                        <span style={{ fontSize: 11, color: C.goldDeep, fontWeight: 700, marginLeft: 4 }}>
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
                  fontSize: 11, color: C.inkSoft, lineHeight: 1.4, fontWeight: 500,
                }}>
                  {pkg.guide}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ─── §6. Divider "또는" ─── */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12, marginTop: 16,
      }}>
        <div style={{ flex: 1, height: 1, background: C.line }} />
        <span style={{ fontSize: 12, color: C.mute, fontWeight: 500, flexShrink: 0 }}>또는</span>
        <div style={{ flex: 1, height: 1, background: C.line }} />
      </div>

      {/* ─── §7. ShareRewardCard (140px · gold border · 상시 노출) ─── */}
      <div style={{
        margin: '0 16px',
        height: 140, background: C.paper,
        border: `1px solid ${C.gold}`, borderRadius: 16,
        padding: '18px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        boxShadow: '0 1px 0 rgba(184,150,90,0.05)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: C.ink,
            letterSpacing: '-0.01em',
          }}>
            친구에게 공유하고 1운 받기
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: C.mute, lineHeight: 1.55 }}>
            하루 3번까지, 총 3운(=1,500원치)까지<br />
            받을 수 있어요
          </div>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end', gap: 8, flexShrink: 0,
        }}>
          {/* 카운터 pill */}
          <div style={{
            background: C.goldSoft, borderRadius: 999,
            padding: '4px 10px', fontSize: 11, fontWeight: 700, color: C.goldDeep,
          }}>
            오늘 {sharesUsed}/{MAX_DAILY_SHARES}회
          </div>
          {/* 공유하기 버튼 (40×96) */}
          <button
            onClick={handleShare}
            style={{
              height: 40, width: 96,
              background: C.ink, color: C.paper,
              borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseDown={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseUp={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            공유하기
          </button>
        </div>
      </div>

      {/* ─── §8. Notice (이용 정책) ─── */}
      <div style={{ padding: '20px 20px 8px', marginTop: 12 }}>
        <p style={{ fontSize: 11, color: C.mute, lineHeight: 1.75, margin: 0 }}>
          · 보너스 운은 환불 대상에서 제외됩니다 (본 운만 환불 가능).
        </p>
        <p style={{ fontSize: 11, color: C.mute, lineHeight: 1.75, margin: 0 }}>
          · 구매한 운은 계정 종료 시 소멸돼요.
        </p>
        <p style={{ fontSize: 11, color: C.mute, lineHeight: 1.75, margin: 0 }}>
          · 운은 사주500 앱 안에서만 사용할 수 있어요.
        </p>
        <p style={{ fontSize: 11, color: C.mute, lineHeight: 1.75, margin: 0 }}>
          · 공유 리워드 어뷰징 감지 시 적립이 취소될 수 있어요.
        </p>
        {/* 환불·청약철회 고지 — 웹/앱 분기.
            앱(앱인토스): 토스 IAP/토스페이 우산. 웹: 전자상거래법 제17조 디지털콘텐츠 청약철회 직접 고지. */}
        {isAppintosBuild ? (
          /* P0-A · 토스페이 환불 정책 (앱인토스 검수 §1-12) */
          <p style={{ fontSize: 11, color: C.mute, lineHeight: 1.75, margin: 0 }}>
            · 환불은 토스페이 결제 취소 정책을 따르며, 결제 후 7일 이내 미사용 운에 한해 고객센터(info@juulabel.com)로 문의 시 심사 후 처리해요.
          </p>
        ) : (
          <p style={{ fontSize: 11, color: C.mute, lineHeight: 1.75, margin: 0 }}>
            · 충전한 운을 분석에 사용(생성)하면 해당 운은 환불되지 않아요. 미사용 운은 결제 후 7일 이내 환불 가능하며, 청약철회일로부터 3영업일 이내 환급돼요. (디지털콘텐츠 · 전자상거래법 제17조)
          </p>
        )}
        <p style={{ fontSize: 11, color: C.mute, lineHeight: 1.75, margin: '6px 0 0' }}>
          · 결제·세금 관련 안내는{' '}
          <button
            onClick={() => navigate('/terms')}
            style={{
              fontSize: 12, fontWeight: 600, color: C.goldDeep,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, textDecoration: 'underline',
            }}
          >이용약관</button>
          {' '}·{' '}
          <button
            onClick={() => navigate('/privacy')}
            style={{
              fontSize: 12, fontWeight: 600, color: C.goldDeep,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, textDecoration: 'underline',
            }}
          >개인정보처리방침</button>
          에서 확인하세요.
        </p>
      </div>

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
                fontSize: 11,
                lineHeight: 1.5,
                color: 'rgba(248,245,238,0.72)',
                borderBottom: '1px solid rgba(248,245,238,0.12)',
              }}>
                미사용 운은 7일 안에 전액 환불돼요 · 분석에 사용한 운은 환불이 어려워요
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
                  fontSize: 12, fontWeight: 600,
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
                  height: 48, minWidth: 140, padding: '0 18px',
                  background: purchasing ? 'rgba(248,245,238,0.5)' : C.paper,
                  color: C.ink, borderRadius: 12,
                  fontSize: 15, fontWeight: 700,
                  cursor: purchasing ? 'not-allowed' : 'pointer',
                  border: 'none',
                  letterSpacing: '-0.01em',
                  transition: 'opacity 0.15s',
                  flexShrink: 0,
                }}
              >
                {purchasing
                  ? '처리 중...'
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

                    {/* 결제 수단 — 아이콘 + 라벨 리스트 행 (토스·배민 문법) */}
                    <button onClick={() => handlePgTest('card')} style={{
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
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: C.ink }}>신용·체크카드</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#B9B2A8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button onClick={() => handlePgTest('kakaopay')} style={{
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

                    {/* 테스트 안내 — 작게 (심사 기간 한정) */}
                    <p style={{ fontSize: 11, color: C.mute, margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
                      지금은 결제 시스템 점검 중이에요 — 실제로 청구되지 않고 자동 취소됩니다
                    </p>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChargePage;
