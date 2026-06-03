/**
 * 오늘의 운세 고민 카테고리 픽토그램 — DailyFortunePage에서 사용
 * 이모지 대체. viewBox 24x24, stroke 1.5, fillOpacity 0.12~0.18
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

/** 커리어 — 서류가방 */
export function IconConcernCareer({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="8" width="18" height="12" rx="1.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      <path d="M9 8V5.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5.5V8" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M3 13h18" stroke={color} strokeWidth="1.3" opacity="0.5" />
    </svg>
  );
}

/** 연애 — 하트 (라인) */
export function IconConcernLove({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** 재물 — 지갑 */
export function IconConcernWealth({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      <path d="M3 10h15a3 3 0 013 3v0a3 3 0 01-3 3H3" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="17" cy="13" r="1" fill={color} />
    </svg>
  );
}

/** 건강 — 잎사귀 + 맥박 */
export function IconConcernHealth({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 12c0-5 4-8 8-8 0 5-3 8-8 8z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 20h4l2-4 2 6 2-4h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** 대인관계 — 세 사람 (실루엣) */
export function IconConcernPeople({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="8" r="3" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5" />
      <circle cx="5.5" cy="10" r="2.2" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.3" />
      <circle cx="18.5" cy="10" r="2.2" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.3" />
      <path d="M7 20c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M2 20c0-2 1.5-3.5 3.5-3.5M22 20c0-2-1.5-3.5-3.5-3.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/** 전반 — 원 + 중앙 점 (중립) */
export function IconConcernGeneral({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.3" />
      <circle cx="12" cy="12" r="1" fill={color} />
    </svg>
  );
}

/** 고민 카테고리 ID → 컴포넌트 매핑 */
export const CONCERN_ICONS = {
  career: IconConcernCareer,
  love: IconConcernLove,
  wealth: IconConcernWealth,
  health: IconConcernHealth,
  people: IconConcernPeople,
  general: IconConcernGeneral,
} as const;

export type ConcernKey = keyof typeof CONCERN_ICONS;
