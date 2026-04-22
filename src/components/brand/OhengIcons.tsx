/**
 * 오행 SVG 아이콘 — 이모지 대체
 * 목(木)/화(火)/토(土)/금(金)/수(水)
 * 프로페셔널한 미니멀 스타일
 */

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

/** 목(木) — 나무/잎 */
export function IconWood({ size = 24, color = '#2D8A4E', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2C8 6 5 9 5 13a7 7 0 0014 0c0-4-3-7-7-11z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      <line x1="12" y1="13" x2="12" y2="22" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/** 화(火) — 불꽃 */
export function IconFire({ size = 24, color = '#D32F2F', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2c-1 4-4 6-4 10a4 4 0 008 0c0-4-3-6-4-10z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 14c-.5-2-2-3-2-5a2 2 0 004 0c0 2-1.5 3-2 5z" fill={color} fillOpacity="0.3" />
    </svg>
  );
}

/** 토(土) — 산/땅 */
export function IconEarth({ size = 24, color = '#F57F17', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2 20h20L17 8l-5 7-4-4-6 9z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** 금(金) — 다이아몬드/보석 */
export function IconMetal({ size = 24, color = '#757575', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 4h12l4 7-10 11L2 11l4-7z" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M2 11h20M6 4l6 18M18 4l-6 18" stroke={color} strokeWidth="0.8" strokeOpacity="0.4" />
    </svg>
  );
}

/** 수(水) — 물방울 */
export function IconWater({ size = 24, color = '#1565C0', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2C8 8 5 12 5 16a7 7 0 0014 0c0-4-3-8-7-14z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/** 오행 아이콘 맵 */
export const OHENG_ICONS = {
  wood: IconWood,
  fire: IconFire,
  earth: IconEarth,
  metal: IconMetal,
  water: IconWater,
  목: IconWood,
  화: IconFire,
  토: IconEarth,
  금: IconMetal,
  수: IconWater,
} as const;

/** 서비스 아이콘 */
export function IconTaegeuk({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <circle cx="12" cy="12" r="11" stroke="#1B2A4A" strokeWidth="1.2" fill="none" />
      <path d="M12 1a11 11 0 010 22c0-3 2-5.5 0-11S12 4 12 1z" fill="#1B2A4A" />
      <circle cx="12" cy="7" r="2" fill="#B8965A" />
      <circle cx="12" cy="17" r="2" fill="#1B2A4A" stroke="#B8965A" strokeWidth="0.8" />
    </svg>
  );
}

/** 건강 아이콘 */
export function IconHealth({ size = 24, color = '#2E7D32', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/** 재물 아이콘 */
export function IconWealth({ size = 24, color = '#B8965A', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
      <path d="M12 6v12M9 9h4.5a1.5 1.5 0 010 3H9m0 0h5a1.5 1.5 0 010 3H9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** 직업 아이콘 */
export function IconCareer({ size = 24, color = '#1B2A4A', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="7" width="20" height="14" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke={color} strokeWidth="1.5" />
      <line x1="12" y1="11" x2="12" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** 연애 아이콘 */
export function IconLove({ size = 24, color = '#B8965A', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
