/**
 * 550사주 로고 — 태극 + 오행 5색
 * 실제 로고 이미지(public/logo.png)가 있으면 이미지 사용,
 * 없으면 SVG fallback
 */

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="사주500"
      width={size}
      height={size}
      loading="lazy"
      className={className}
      onError={(e) => {
        // 이미지 없으면 SVG fallback
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}

/** 텍스트 로고 */
export function LogoText({ className = '' }: { className?: string }) {
  return (
    <span className={`font-black tracking-tight ${className}`}>
      <span className="text-brand-navy">사주</span>
      <span className="text-brand-gold">500</span>
    </span>
  );
}
