/**
 * 사주500 커스텀 아이콘 시스템
 * 이모지 대체용 SVG 아이콘
 */

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

const defaults = { size: 24, color: 'currentColor' };

/** 홈 */
export function IconHome({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 21V14h6v7" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** 사주 분석 (태극) */
export function IconSaju({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M12 3a9 9 0 010 18c0-2.5 1.5-4.5 0-9s0-6.5 0-9z" fill={color} fillOpacity="0.15" />
      <circle cx="12" cy="8" r="1.5" fill={color} />
      <circle cx="12" cy="16" r="1.5" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

/** 운세 (별) */
export function IconFortune({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.8 5.6 21.2 8 14 2 9.2h7.6L12 2z"
        stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={color} fillOpacity="0.1" />
    </svg>
  );
}

/** 보관함 */
export function IconStorage({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.8" />
      <path d="M3 9h18" stroke={color} strokeWidth="1.8" />
      <path d="M10 13h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 마이 (사람) */
export function IconProfile({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 알림 벨 */
export function IconBell({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 화살표 오른쪽 */
export function IconChevronRight({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 뒤로가기 */
export function IconBack({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 공유 */
export function IconShare({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <polyline points="16 6 12 2 8 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="2" x2="12" y2="15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 닫기 X */
export function IconClose({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 대화 (말풍선) */
export function IconChat({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M21 12a9 9 0 01-9 9c-1.5 0-2.9-.4-4.1-1L3 21l1.1-4.1A9 9 0 1121 12z"
        stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={color} fillOpacity="0.08" />
      <circle cx="8.5" cy="12" r="1" fill={color} />
      <circle cx="12" cy="12" r="1" fill={color} />
      <circle cx="15.5" cy="12" r="1" fill={color} />
    </svg>
  );
}

/** 플러스 */
export function IconPlus({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
