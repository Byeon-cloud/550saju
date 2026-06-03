/**
 * 개운법 픽토그램 — ResultPage의 GaewoonVis에서 사용
 * 이모지(🎨🧭🍽🏊) 대체. 스타일은 브랜드픽토그램_시스템.md 준수.
 *   - viewBox 24x24, stroke 1.5, fillOpacity 0.12~0.18
 *   - 2D 라인 + 소프트 필
 */

interface PictogramProps {
  size?: number;
  color?: string;
  className?: string;
}

/** 개운:색상 — 팔레트(원+점 3개) */
export function IconGaewoonColor({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 3a9 9 0 100 18 2 2 0 002-2v-1a1.5 1.5 0 011.5-1.5H18a3 3 0 003-3A9 9 0 0012 3z"
        fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="7.5" cy="11" r="1.2" fill={color} fillOpacity="0.8" />
      <circle cx="11.5" cy="7" r="1.2" fill={color} fillOpacity="0.5" />
      <circle cx="16" cy="10" r="1.2" fill={color} fillOpacity="0.7" />
    </svg>
  );
}

/** 개운:방위 — 나침반(compass 재사용 스타일과 동일) */
export function IconGaewoonDirection({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5" />
      <path d="M12 6l2.5 4-2.5 4-2.5-4z" fill={color} fillOpacity="0.28" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1" fill={color} />
    </svg>
  );
}

/** 개운:음식 — 그릇(반원 + 김) */
export function IconGaewoonFood({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 12h18a0 0 0 010 0 9 9 0 01-18 0z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 20h20" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M9 7c0-1.5 1.5-1.5 1.5-3M13 7c0-1.5 1.5-1.5 1.5-3" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** 개운:운동 — 기본 체력 아이콘 (달리는 인물 추상) */
export function IconGaewoonExercise({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="15" cy="5" r="2" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.3" />
      <path d="M10 22l2-6 3 2v4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M7 14l4-3 4 2 3-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M3 12h4" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export const GAEWOON_ICONS = {
  color: IconGaewoonColor,
  direction: IconGaewoonDirection,
  food: IconGaewoonFood,
  exercise: IconGaewoonExercise,
} as const;

export type GaewoonKey = keyof typeof GAEWOON_ICONS;
