import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/common/Button';
import { FadeIn } from '@/components/common/FadeIn';
import { CHARGE_PACKAGES } from '@/constants/pricing';

export function ChargePage() {
  const [selectedId, setSelectedId] = useState<string>('yearly');
  const balance = 0;
  const selected = CHARGE_PACKAGES.find((p) => p.id === selectedId);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-cream)' }}>
      <Header title="운(運) 충전" />
      <div className="page-container flex-1 flex flex-col">
        <FadeIn>
          <div className="card-gold text-center py-6 mb-5">
            <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>현재 잔액</p>
            <p className="text-display mt-1" style={{ color: 'var(--brand-gold-dark)' }}>{balance} 운</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-hint)' }}>(= {(balance * 550).toLocaleString()}원)</p>
          </div>
        </FadeIn>

        <div className="flex flex-col gap-3 mb-6">
          {CHARGE_PACKAGES.map((pkg, i) => {
            const sel = selectedId === pkg.id;
            const rec = pkg.id === 'yearly';
            return (
              <FadeIn key={pkg.id} delay={i * 0.08}>
                <button onClick={() => setSelectedId(pkg.id)}
                  className="w-full card text-left relative transition-all"
                  style={sel ? { boxShadow: 'var(--shadow-glow)', border: '2px solid var(--brand-gold)' } : {}}>
                  {rec && <span className="absolute -top-2.5 left-4 badge badge-gold">추천</span>}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{pkg.name}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {pkg.un}운{pkg.bonusUn > 0 && <span className="font-bold" style={{ color: 'var(--brand-accent)' }}> +{pkg.bonusUn}운</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>{pkg.price.toLocaleString()}원</p>
                      {pkg.discount > 0 && <p className="text-[11px] font-bold" style={{ color: 'var(--brand-accent)' }}>{pkg.discount}% 할인</p>}
                    </div>
                  </div>
                  {rec && <p className="text-[10px] font-medium mt-2" style={{ color: 'var(--brand-accent)' }}>프리미엄과 같은 가격!</p>}
                </button>
              </FadeIn>
            );
          })}
        </div>

        <div className="mt-auto pb-2">
          <Button fullWidth size="lg" variant="gold" onClick={() => {}}>
            {selected ? `${selected.price.toLocaleString()}원 결제하기` : '결제하기'}
          </Button>
          <div className="mt-4 space-y-1">
            <p className="text-[10px]" style={{ color: 'var(--text-hint)' }}>· 운은 결제일로부터 1년간 유효합니다</p>
            <p className="text-[10px]" style={{ color: 'var(--text-hint)' }}>· 보너스 운은 환불 불가합니다</p>
          </div>
        </div>
      </div>
    </div>
  );
}
