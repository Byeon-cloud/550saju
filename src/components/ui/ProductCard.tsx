// v4.1 공용 — 홈 상품 매트릭스 카드 (free / 500 / 5000).
// 사양: docs/homepage_redesign_spec.md §5

export type ProductTier = 'free' | '500' | '5000';

export interface ProductCardProps {
  tier: ProductTier;
  title: string;
  /** 가격 라벨 (예: "500원 · 1운"). */
  price: string;
  /** 혜택 리스트. */
  bullets: string[];
  /** CTA 버튼 (라벨 + href OR onClick). */
  cta: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** true 이면 테두리 강조 + "지금 이 상품 1위" 뱃지. */
  highlight?: boolean;
  /** 경쟁사 평균가 대비 표시 (500원 상품 한정 권장). */
  compareAt?: string;
  className?: string;
}

const TIER_STYLE: Record<ProductTier, { ring: string; priceColor: string }> = {
  free: { ring: 'border-gray-100', priceColor: 'text-gray-700' },
  500: { ring: 'border-gold-brown/40', priceColor: 'text-gold-brown' },
  5000: { ring: 'border-ink/30', priceColor: 'text-ink' },
};

export function ProductCard({
  tier,
  title,
  price,
  bullets,
  cta,
  highlight,
  compareAt,
  className = '',
}: ProductCardProps) {
  const style = TIER_STYLE[tier];
  const ring = highlight ? 'border-2 border-gold-brown' : `border ${style.ring}`;
  const ctaStyle =
    tier === '500' || highlight
      ? 'bg-gold-brown text-white hover:bg-gold-brown-dark'
      : 'bg-white border border-ink text-ink hover:bg-gray-100';

  const ButtonBody = (
    <span className={`mt-4 inline-flex items-center justify-center w-full h-[52px] rounded-xl text-base font-semibold transition duration-200 ease-out ${ctaStyle}`}>
      {cta.label}
    </span>
  );

  return (
    <article className={`relative ${ring} bg-paper rounded-xl p-5 ${className}`}>
      {highlight ? (
        <span className="absolute -top-2 right-4 bg-gold-brown text-white text-xs font-semibold px-2 py-1 rounded-full">
          지금 이 상품 1위
        </span>
      ) : null}
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <div className="text-right">
          <div className={`text-base font-semibold ${style.priceColor}`}>{price}</div>
          {compareAt ? (
            <div className="text-xs text-gray-500 line-through">{compareAt}</div>
          ) : null}
        </div>
      </header>
      <ul className="mt-3 space-y-1.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-gray-700 leading-6">
            <span className="mt-2 inline-block w-1 h-1 rounded-full bg-gold-brown flex-shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {cta.href ? (
        <a href={cta.href} aria-label={`${title} · ${cta.label}`}>{ButtonBody}</a>
      ) : (
        <button
          type="button"
          onClick={cta.onClick}
          aria-label={`${title} · ${cta.label}`}
          className="block w-full"
        >
          {ButtonBody}
        </button>
      )}
    </article>
  );
}

export default ProductCard;
