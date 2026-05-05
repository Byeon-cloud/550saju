// Charge Page — #55 Sprint 2 UI 개편 (2026-04-24)
// 스펙: docs/mockups/사주500_UI개편_07_운충전.md §1-§15 · 핸드오버 §2-8
// 골격: TopBar 56 → HeroBar 104 → RedirectHint 60(조건) → ChargePackages 2col → Divider → ShareRewardCard 140 → Notice → CheckoutBar 80 sticky
// 보존(E13): confirmTossPayment / grantPurchase 분기 토스트, IAP processProductGrant
// SSOT 토큰 적용 · 광고 없음 · 원화 노출 허용 유일 페이지

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CHARGE_PACKAGES } from '@/constants/pricing';
import { getBalance, addPaidBalance } from '@/services/storage/localStore';
import { purchasePackage, isAppsInToss } from '@/services/payment/iapService';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  getRemainingShareRewards,
  canEarnShareReward,
  claimShareReward,
  claimShareRewardUnlimited,
} from '@/services/share/shareReward';
import { isAppintosBuild } from '@/lib/env';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const redirectTo = searchParams.get('redirect');
  const needRaw = searchParams.get('need');
  const needUn = needRaw && !Number.isNaN(Number(needRaw)) ? Number(needRaw) : null;

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

  // ── 공유 핸들러 (앱인토스 contactsViral / 웹 navigator.share)
  const handleShare = async () => {
    try {
      if (isAppsInToss()) {
        const sdkName = '@apps-in-toss/' + 'web-framework';
        const mod: any = await import(/* @vite-ignore */ sdkName);
        mod.contactsViral({
          options: { moduleId: '0a21ea14-951b-4abb-8484-aaf61b0123b8' },
          onEvent: async (event: any) => {
            if (event.type === 'sendViral') {
              const earned = claimShareRewardUnlimited();
              setBalanceDisplay(getBalance());
              setRemainingShares(getRemainingShareRewards());
              toast.show(`공유 완료! ${earned}운이 적립됐어요`, 'success');
            }
          },
          onError: () => toast.show('공유가 취소됐어요', 'info'),
        });
        return;
      }

      // 웹: 일일 한도 체크 후 공유
      const url = `${window.location.origin}/share/invite`;
      const text = '나도 500원에 내 사주 볼 수 있대! 한번 해봐';

      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: '사주500', text, url });
          if (canEarnShareReward()) {
            const earned = claimShareReward();
            if (earned > 0) {
              setBalanceDisplay(getBalance());
              setRemainingShares(getRemainingShareRewards());
              toast.show(`공유 완료! ${earned}운이 적립됐어요`, 'success');
              return;
            }
          }
          toast.show('공유 완료! (오늘 보상 한도를 모두 받았어요)', 'info');
        } catch {
          toast.show('공유를 완료하면 1운이 적립돼요', 'info');
        }
      } else {
        // PC 폴백: 링크 복사
        try { await navigator.clipboard.writeText(url); } catch { /* 무시 */ }
        toast.show('링크가 복사됐어요! 친구에게 보내주세요', 'success');
      }
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

      {/* ─── §4. RedirectHint (URL ?need=N 일 때만) ─── */}
      {needUn !== null && needUn > 0 && (
        <div style={{
          margin: '12px 16px 0',
          height: 60, background: '#FFFFFF',
          border: `1px solid ${C.line}`, borderRadius: 12,
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 10,
        }}>
          <InfoIcon color={C.goldDeep} />
          <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>
            <strong style={{ color: C.goldDeep, fontWeight: 700 }}>{needUn}운</strong>이 필요한 풀이로 돌아가요
          </span>
        </div>
      )}

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
        {/* P0-A · 토스페이 환불 정책 (앱인토스 검수 §1-12) */}
        <p style={{ fontSize: 11, color: C.mute, lineHeight: 1.75, margin: 0 }}>
          · 환불은 토스페이 결제 취소 정책을 따르며, 결제 후 7일 이내 미사용 운에 한해 고객센터(info@juulabel.com)로 문의 시 심사 후 처리해요.
        </p>
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
                    ? `${selectedPkg.paidUn}운+${selectedPkg.bonusUn}운 보너스`
                    : `${selectedPkg.un}운`}
                  {' · '}
                  {selectedPkg.price.toLocaleString()}원
                </div>
              </div>

              {/* 우: 결제하기 버튼 (높이 48 · 폭 140) */}
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                style={{
                  height: 48, width: 140,
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
                  : (isAppintosBuild ? '토스페이로 결제' : '결제하기')}
              </button>
            </div>
            {/* iOS 홈바 영역 흡수 */}
            <div style={{ height: 'env(safe-area-inset-bottom)', background: C.ink }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChargePage;
