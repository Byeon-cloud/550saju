/**
 * 꿈해몽 카테고리 픽토그램 — DreamPage에서 사용
 * 이모지 대체. 동일 viewBox 24x24, stroke 1.5, fillOpacity 0.12~0.18
 *
 * 스타일 규칙: 브랜드픽토그램_시스템.md 참조
 *   - 2D 라인 + 소프트 필
 *   - 3D/만화 스타일 금지
 *   - currentColor 또는 domain color 허용
 */

interface PictogramProps {
  size?: number;
  color?: string;
  className?: string;
}

/** 동물의 꿈 — 발자국 (추상) */
export function IconDreamAnimal({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <ellipse cx="12" cy="15" rx="4" ry="3.2" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      <circle cx="7.5" cy="9" r="1.6" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.3" />
      <circle cx="16.5" cy="9" r="1.6" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.3" />
      <circle cx="9.5" cy="5.5" r="1.2" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.3" />
      <circle cx="14.5" cy="5.5" r="1.2" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.3" />
    </svg>
  );
}

/** 물의 꿈 — 파도 3선 */
export function IconDreamWater({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 8c3 0 3 2 6 2s3-2 6-2 3 2 6 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M3 13c3 0 3 2 6 2s3-2 6-2 3 2 6 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M3 18c3 0 3 2 6 2s3-2 6-2 3 2 6 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4" />
    </svg>
  );
}

/** 죽음/이별의 꿈 — 초승달 + 경계 */
export function IconDreamDeath({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M16 4a9 9 0 102 16A8 8 0 0116 4z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="7" cy="18" r="0.8" fill={color} opacity="0.5" />
      <circle cx="4" cy="13" r="0.6" fill={color} opacity="0.4" />
    </svg>
  );
}

/** 비행의 꿈 — 날개 */
export function IconDreamFlying({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 14c2-6 8-8 12-6-2 3-6 4-8 4 3 1 5 3 5 6-4 0-8-1-9-4z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15 8c2-1 4-1 6 0" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** 돈/재물의 꿈 — 엽전 (원+사각 구멍) */
export function IconDreamMoney({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="5" height="5" fill="none" stroke={color} strokeWidth="1.3" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

/** 사람의 꿈 — 반신 + 후광 */
export function IconDreamPeople({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="9" r="3.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      <path d="M5 20c1.5-3.5 4.5-5.5 7-5.5s5.5 2 7 5.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill={color} fillOpacity="0.08" />
    </svg>
  );
}

/** 쫓기는 꿈 — 바람결 3선 */
export function IconDreamChase({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 7h10c2 0 3 1 3 2s-1 2-2 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M3 13h13c2 0 3 1 3 2s-1 2-2 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M3 19h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** 자연/날씨 꿈 — 산 (삼각 연결) */
export function IconDreamNature({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M2 20h20L15 7l-4 7-3-4-6 10z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="16" cy="6" r="1.2" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

/** 기타 — 붓/연필 끝 */
export function IconDreamOther({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M15 4l5 5-9 9H6v-5l9-9z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13 6l5 5" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** 빈상태/결과없음 — 중립 점 3개 */
export function IconDreamEmpty({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="7" cy="12" r="1.3" fill={color} fillOpacity="0.3" />
      <circle cx="12" cy="12" r="1.3" fill={color} fillOpacity="0.5" />
      <circle cx="17" cy="12" r="1.3" fill={color} fillOpacity="0.3" />
    </svg>
  );
}

/** 행운 — 매화(4엽) */
export function IconLucky({ size = 24, color = '#C9A96E', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="6" r="3" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.3" />
      <circle cx="12" cy="18" r="3" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.3" />
      <circle cx="6" cy="12" r="3" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.3" />
      <circle cx="18" cy="12" r="3" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.3" />
      <circle cx="12" cy="12" r="1.2" fill={color} />
    </svg>
  );
}

/** 나침반 — 방향/방위 */
export function IconCompass({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
      <path d="M12 6l2.5 4-2.5 4-2.5-4z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1" fill={color} />
    </svg>
  );
}

/** 꿈 카테고리 ID → 컴포넌트 매핑 */
export const DREAM_ICONS = {
  animal: IconDreamAnimal,
  water: IconDreamWater,
  death: IconDreamDeath,
  flying: IconDreamFlying,
  money: IconDreamMoney,
  people: IconDreamPeople,
  chase: IconDreamChase,
  nature: IconDreamNature,
  other: IconDreamOther,
} as const;

export type DreamCategory = keyof typeof DREAM_ICONS;
