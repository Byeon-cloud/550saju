// v4.1 공용 — 결제 CTA 블록 표준.
// 사양: docs/design_system_v4_consolidated.md §2 / homepage_redesign_spec.md

export type CTABlockVariant = 'primary' | 'soft';

export interface CTABlockProps {
  variant?: CTABlockVariant;
  /** 상단 eyebrow (예: "500원"). */
  eyebrow?: string;
  /** 주 제목. */
  title: string;
  /** 타이틀 아래 서술. */
  description?: string;
  /** 혜택 리스트 (2~5개 권장). */
  bullets?: string[];
  /** CTA 버튼 라벨 (동사형). 기본 "결제하기". */
  ctaLabel?: string;
  /** CTA 클릭 핸들러. 없으면 버튼 노출 안 함. */
  onPay?: () => void;
  className?: string;
}

export function CTABlock({
  variant = 'primary',
  eyebrow,
  title,
  description,
  bullets,
  ctaLabel = '결제하기',
  onPay,
  className = '',
}: CTABlockProps) {
  const isPrimary = variant === 'primary';
  const wrap = isPrimary
    ? 'bg-ink text-paper rounded-2xl p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)]'
    : 'bg-gold-brown-soft/60 border-l-4 border-gold-brown rounded-lg p-5 text-ink';
  const eyebrowColor = isPrimary ? 'text-gold-brown-soft' : 'text-gold-brown';
  const descColor = isPrimary ? 'text-paper/80' : 'text-gray-700';
  const bulletColor = isPrimary ? 'text-paper/90' : 'text-ink';

  return (
    <div className={`${wrap} ${className}`}>
      {eyebrow ? (
        <span className={`block text-xs font-semibold uppercase tracking-[0.12em] ${eyebrowColor}`}>
          {eyebrow}
        </span>
      ) : null}
      <h3 className="mt-2 text-xl font-bold leading-7">{title}</h3>
      {description ? <p className={`mt-2 text-sm leading-[1.7] ${descColor}`}>{description}</p> : null}
      {bullets && bullets.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {bullets.map((b) => (
            <li key={b} className={`flex items-start gap-2 text-sm leading-6 ${bulletColor}`}>
              <span className="mt-2 inline-block w-1 h-1 rounded-full bg-current flex-shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {onPay ? (
        <button
          type="button"
          onClick={onPay}
          className="mt-5 w-full h-[52px] rounded-xl bg-gold-brown text-white text-base font-semibold transition duration-200 ease-out hover:bg-gold-brown-dark"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

export default CTABlock;
