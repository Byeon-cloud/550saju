/**
 * 주제 분석 카테고리 픽토그램 — TopicAnalysisPage에서 사용
 * 이모지 대체. viewBox 24x24, stroke 1.5, fillOpacity 0.12~0.18
 *
 * 스타일 규칙: 브랜드픽토그램_시스템.md 참조
 */

interface PictogramProps {
  size?: number;
  color?: string;
  className?: string;
}

/** 연애운 — 두 원 겹침 (인연) */
export function IconTopicLove({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="12" r="5.5" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.1" />
      <circle cx="15" cy="12" r="5.5" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.1" />
    </svg>
  );
}

/** 재물운 — 동전 (원 + 십자 분할) */
export function IconTopicWealth({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      <path d="M8 12h8M12 8v8" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** 취업/직업운 — 문서 (모서리 접힘) */
export function IconTopicCareer({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 3h10l5 5v13H5z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M15 3v5h5" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <path d="M8 13h8M8 17h5" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** 결혼운 — 두 원 (결합) */
export function IconTopicMarriage({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="14" r="5" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="15" cy="14" r="5" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.15" />
      <path d="M9 6l3 2 3-2" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 사업운 — 상승 라인 차트 */
export function IconTopicBusiness({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M3 20h18" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M3 20L8 13l4 4 8-11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M15 6h5v5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 건강운 — 십자 + 원 */
export function IconTopicHealth({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5" />
      <path d="M12 7v10M7 12h10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 재회운 — 끊어진 고리 재연결 */
export function IconTopicReunion({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M10 7a4 4 0 00-4 4v2a4 4 0 004 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M14 7a4 4 0 014 4v2a4 4 0 01-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M9 12h6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.5 2" />
    </svg>
  );
}

/** 학업/시험운 — 펼친 책 */
export function IconTopicStudy({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 6c-2-1-5-1-8-1v14c3 0 6 0 8 1M12 6c2-1 5-1 8-1v14c-3 0-6 0-8 1" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 6v14" stroke={color} strokeWidth="1.2" opacity="0.4" />
    </svg>
  );
}

/** 대인관계운 — 두 반원 맞물림 */
export function IconTopicSocial({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="10" r="3.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      <circle cx="16" cy="10" r="3.5" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
      <path d="M3 20c1.5-3 3.5-4.5 5-4.5s2 1 4 1 2.5-1 4-1 3.5 1.5 5 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** 이사/이동운 — 화살표 사선 */
export function IconTopicMoving({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 19L19 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 5h9v9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5" cy="19" r="1.5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

/** 편지/CTA — 닫힌 봉투 */
export function IconLetter({ size = 24, color = 'currentColor', className }: PictogramProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="1.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5" />
      <path d="M4 7l8 6 8-6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** 주제 분석 카테고리 ID → 컴포넌트 매핑.
 *  2026-04-22 SSOT v1 정렬: 'exam' (합격·이직운) · 'move' alias 추가.
 *  'moving' 은 legacy 호환용으로 유지 (구 URL 통과). 'social' 은 구 대인관계운 유지. */
export const TOPIC_ICONS = {
  love: IconTopicLove,
  wealth: IconTopicWealth,
  career: IconTopicCareer,
  marriage: IconTopicMarriage,
  business: IconTopicBusiness,
  health: IconTopicHealth,
  reunion: IconTopicReunion,
  study: IconTopicStudy,
  exam: IconTopicStudy,    // SSOT v1 신규 · 시험·이직 (進) — 전용 아이콘 준비 전 study 픽토그램 재사용
  social: IconTopicSocial,
  moving: IconTopicMoving, // legacy
  move: IconTopicMoving,   // SSOT v1 canonical ID
} as const;

export type TopicKey = keyof typeof TOPIC_ICONS;
