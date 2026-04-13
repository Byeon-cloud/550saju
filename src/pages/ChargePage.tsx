import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';
import { CHARGE_PACKAGES } from '@/constants/pricing';
import { getBalance, addPaidBalance } from '@/services/storage/localStore';
import { purchasePackage } from '@/services/payment/iapService';
import { useToast } from '@/components/common/Toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getRemainingShareRewards, canEarnShareReward } from '@/services/share/shareReward';


export function ChargePage() {
  usePageTitle('운(運) 충전');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromMessage = (location.state as any)?.message as string | undefined;
  const [selected, setSelected] = useState('serious');
  const [balance, setBalanceDisplay] = useState(() => getBalance());
  const [purchasing, setPurchasing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const toast = useToast();
  const selectedPkg = CHARGE_PACKAGES.find(p => p.id === selected);

  // 토스페이먼츠 결제 후 리다이렉트 복귀 처리
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
      setMessage('결제 확인 중...');

      import('@/services/payment/tossPayments').then(({ confirmTossPayment }) => {
        confirmTossPayment(paymentKey, orderId, Number(amount))
          .then((result) => {
            if (result.success && result.paidUn != null) {
              addPaidBalance(result.paidUn, result.bonusUn || 0);
              setBalanceDisplay(getBalance());
              toast.show(result.message, 'success');
              // 프로모션 이벤트: 충전 완료
              import('@/services/toss/tossPromotion').then(m => m.triggerPromotionEvent(m.PROMO_EVENTS.CHARGE, { amount: String(amount) }));
            } else {
              toast.show(result.message || '결제 처리에 실패했어요', 'warning');
            }
          })
          .catch((err) => {
            toast.show('결제 확인 실패: ' + (err.message || '다시 시도해주세요'), 'warning');
          })
          .finally(() => {
            setPurchasing(false);
            setMessage(null);
            setSearchParams({}, { replace: true });
          });
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-bg-page">
      <Header title="운(運) 충전" />
      <div className="px-4 pt-4 pb-[120px] space-y-5">

        {/* 잔액 부족 안내 (다른 페이지에서 넘어온 경우) */}
        {fromMessage && (
          <FadeIn>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.2)' }}>
              <p className="text-caption text-brand-gold font-semibold text-center">{fromMessage}</p>
            </div>
          </FadeIn>
        )}

        {/* 잔액 카드 */}
        <FadeIn>
          <div className="card-gold py-5 px-5">
            <p className="text-caption text-text-muted">현재 내 잔액</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-display text-text-primary">{balance}</span>
              <span className="text-h2 text-brand-gold">운</span>
            </div>
          </div>
        </FadeIn>

        {/* 운이 뭔지 설명 — 친절하게 */}
        <FadeIn delay={0.03}>
          <div className="card py-4 px-5">
            <p className="text-h3 text-text-primary mb-3">운(運)으로 이런 걸 할 수 있어요</p>
            <div className="space-y-2.5">
              {[
                { service: '내 사주 풀이', desc: '성격, 직업, 연애 등 12가지 분석', cost: '1운' },
                { service: '사주 상담', desc: '대화로 주고받는 1:1 상담 5회', cost: '1운' },
                { service: '궁합 분석', desc: '두 사람의 사주 비교', cost: '1운' },
                { service: '대운 해설', desc: '10년 단위 운의 흐름', cost: '1운' },
                { service: '월별 운세', desc: '올해 12개월 점수와 조언', cost: '1운' },
              ].map((item) => (
                <div key={item.service} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-label text-text-primary">{item.service}</p>
                    <p className="text-[10px] text-text-muted">{item.desc}</p>
                  </div>
                  <span className="text-caption text-brand-gold font-bold flex-shrink-0 ml-3">{item.cost}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* 충전 패키지 */}
        <FadeIn delay={0.06}>
          <p className="text-h3 text-text-primary mb-3">충전 패키지</p>
          <div className="space-y-3">
            {CHARGE_PACKAGES.map((pkg) => {
              const isSelected = selected === pkg.id;
              const totalUn = pkg.un + pkg.bonusUn;
              const originalPrice = totalUn * 500;
              const isSaving = originalPrice > pkg.price;
              const saveAmount = originalPrice - pkg.price;

              return (
                <motion.button
                  key={pkg.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelected(pkg.id)}
                  className={`w-full rounded-2xl text-left p-4 transition-all relative overflow-hidden ${
                    isSelected
                      ? 'border-2 border-brand-gold shadow-glow'
                      : 'border border-border-light'
                  }`}
                  style={{ background: isSelected ? 'var(--bg-gold-solid)' : 'var(--bg-card)' }}
                >
                  {/* 추천 배지 */}
                  {pkg.id === 'serious' && (
                    <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl"
                      style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                      <span className="text-[10px] font-bold text-white">추천</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      {/* 패키지명 + 운 수량 */}
                      <p className="text-h3 text-text-primary">{pkg.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-h1 text-brand-gold">{pkg.un}운</span>
                        {pkg.bonusUn > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                            style={{ background: 'rgba(46,125,50,0.1)', color: '#2E7D32' }}>
                            +{pkg.bonusUn}운 보너스
                          </span>
                        )}
                      </div>
                      {/* 할인 정보 */}
                      {isSaving && (
                        <p className="text-[10px] text-func-success font-semibold mt-1">
                          {saveAmount.toLocaleString()}원 절약 ({pkg.discount}% 할인)
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      {/* 할인 전 가격 (취소선) */}
                      {isSaving && (
                        <p className="text-[11px] text-text-hint line-through">
                          {originalPrice.toLocaleString()}원
                        </p>
                      )}
                      {/* 실제 결제 가격 */}
                      <p className="text-h1 text-text-primary">{pkg.price.toLocaleString()}<span className="text-body-sm">원</span></p>
                      {/* 운당 가격 */}
                      {totalUn > 1 && (
                        <p className="text-[10px] text-text-muted mt-0.5">
                          1운당 {Math.round(pkg.price / totalUn).toLocaleString()}원
                        </p>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </FadeIn>

        {/* 무료로 운 받기 — 공유 리워드 */}
        <FadeIn delay={0.09}>
          <button
            onClick={async () => {
              try {
                const { isAppsInToss } = await import('@/services/payment/iapService');
                if (isAppsInToss()) {
                  // 앱인토스: contactsViral SDK — 앱인토스 공유 리워드 정책
                  const sdkName = '@apps-in-toss/' + 'web-framework';
                  const { contactsViral } = await import(/* @vite-ignore */ sdkName);
                  contactsViral({
                    options: { moduleId: 'a56725a6-4c52-40e5-b68b-2f752caf0a94' },
                    onEvent: async (event: any) => {
                      if (event.type === 'sendViral') {
                        // 앱인토스 공유 확인 → 제한 없이 적립 (contactsViral이 중복 관리)
                        const { claimShareRewardUnlimited } = await import('@/services/share/shareReward');
                        const earned = claimShareRewardUnlimited();
                        setBalanceDisplay(getBalance());
                        toast.show(`공유 완료! ${earned}운이 적립됐어요`, 'success');
                      }
                    },
                    onError: () => {
                      toast.show('공유가 취소됐어요', 'info');
                    },
                  });
                } else {
                  // 웹: navigator.share → 실제 공유 시에만 리워드
                  const url = `${window.location.origin}/share/invite`;
                  const text = '나도 500원에 내 사주 볼 수 있대! 한번 해봐';

                  if (navigator.share) {
                    try {
                      await navigator.share({ title: '사주500', text, url });
                      // 공유 완료 확인 → 리워드
                      const { claimShareReward } = await import('@/services/share/shareReward');
                      const earned = claimShareReward();
                      if (earned > 0) {
                        setBalanceDisplay(getBalance());
                        toast.show(`공유 완료! ${earned}운이 적립됐어요`, 'success');
                      } else {
                        toast.show('공유 완료!', 'success');
                      }
                    } catch {
                      toast.show('공유를 완료하면 1운이 적립돼요', 'info');
                    }
                  } else {
                    // PC 폴백: 링크 복사 (리워드 없음, 공유 확인 불가)
                    try { await navigator.clipboard.writeText(url); } catch { /* 무시 */ }
                    toast.show('링크가 복사됐어요! 친구에게 보내주세요', 'success');
                  }
                }
              } catch (e) {
                console.warn('[Share]', e);
                toast.show('다시 시도해주세요', 'info');
              }
            }}
            className="w-full card-gold py-4 px-5 text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-h3 text-text-primary">친구에게 공유하면 1운 적립</p>
                <p className="text-caption text-text-muted mt-0.5">
                  {canEarnShareReward()
                    ? `오늘 ${getRemainingShareRewards()}회 남음`
                    : '오늘 공유 보상을 모두 받았어요'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #C9A96E, #D4A843)' }}>
                <span className="text-[10px] font-black text-white">運</span>
              </div>
            </div>
          </button>
        </FadeIn>

        {/* 안내 */}
        <FadeIn delay={0.12}>
          <div className="space-y-1.5 px-1">
            <p className="text-caption text-text-hint">· 보너스 운과 리워드 운은 환불 대상에서 제외돼요</p>
            <p className="text-caption text-text-hint">· 유효기간 없어요. 충전한 운은 사라지지 않아요</p>
            <p className="text-caption text-text-hint">· 자동결제 없음. 한 번 충전으로 끝</p>
          </div>
        </FadeIn>
      </div>

      {/* 하단 CTA */}
      <div className="sticky-cta-bottom">
        {message && (
          <p className={`text-center text-caption mb-2 ${message.includes('충전') ? 'text-func-success' : 'text-func-warning'}`}>
            {message}
          </p>
        )}
        <Button
          fullWidth
          size="lg"
          loading={purchasing}
          onClick={async () => {
            if (!selectedPkg || purchasing) return;
            setPurchasing(true);
            setMessage(null);
            const result = await purchasePackage(selectedPkg);
            setPurchasing(false);
            setMessage(result.message);
            if (result.success) {
              setBalanceDisplay(getBalance());
              toast.show(result.message, 'success');
              // 프로모션 이벤트: IAP 충전 완료
              import('@/services/toss/tossPromotion').then(m => m.triggerPromotionEvent(m.PROMO_EVENTS.CHARGE, { package: selectedPkg.name }));
              setTimeout(() => navigate(-1), 1500);
            } else {
              toast.show(result.message, 'warning');
            }
          }}
        >
          {selectedPkg
            ? `${selectedPkg.price.toLocaleString()}원 결제하기`
            : '패키지를 선택해주세요'}
        </Button>
      </div>
    </div>
  );
}
