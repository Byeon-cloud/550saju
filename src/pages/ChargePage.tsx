import { FadeIn } from '@/components/common/FadeIn';
import { CHARGE_PACKAGES } from '@/constants/pricing';
import { formatKRW } from '@/utils/format';

export function ChargePage() {
  return (
    <div className="page-container">
      <FadeIn>
        <h1 className="section-title mb-2">운(運) 충전</h1>
        <p className="text-brand-muted text-sm mb-6">운을 충전하고 사주를 확인하세요</p>
      </FadeIn>

      <div className="flex flex-col gap-3">
        {CHARGE_PACKAGES.map((pkg, i) => (
          <FadeIn key={pkg.id} delay={0.1 * (i + 1)}>
            <button className="card w-full text-left hover:border-brand-primary transition-colors">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-brand-text">{pkg.name}</p>
                  <p className="text-brand-muted text-sm mt-0.5">
                    {pkg.un}운{pkg.bonusUn > 0 ? ` + ${pkg.bonusUn}운 보너스` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-brand-primary text-lg">
                    {formatKRW(pkg.price)}
                  </p>
                  {pkg.discount > 0 && (
                    <p className="text-status-success text-xs font-medium">
                      {pkg.discount}% 할인
                    </p>
                  )}
                </div>
              </div>
            </button>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
