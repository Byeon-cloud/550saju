import type { ReactNode, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';

interface LockedCardProps {
  /** 공개 제목 (유저는 무엇을 여는지 알 수 있음) */
  title: string;
  /** 공개 서브텍스트 */
  subtitle?: string;
  /** CTA 문구 — 같은 상품 유도 카드끼리 다양하게 */
  ctaText?: string;
  /** 잠금 해제 콜백 (결제 모달 등) */
  onUnlock: () => void;
  /** 블러 처리될 플레이스홀더 (서버는 실제 원문 차단, 여기는 placeholder만) */
  previewContent?: ReactNode;
  /** 높이 지정 (px). 기본 auto */
  height?: number;
  className?: string;
}

/**
 * 블러 잠금 카드 (프리미엄_티저블러.md 3층 방어).
 *  1) CSS blur(7px) + saturate(1.1)
 *  2) 서버 원문 차단 — previewContent 는 플레이스홀더 전용
 *  3) 그라데이션 노이즈 오버레이
 */
export function LockedCard({
  title,
  subtitle,
  ctaText = '1운으로 열기 →',
  onUnlock,
  previewContent,
  height,
  className = '',
}: LockedCardProps) {
  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onUnlock();
    }
  }

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      role="button"
      tabIndex={0}
      aria-label={`${title} — 잠금 해제`}
      onClick={onUnlock}
      onKeyDown={handleKey}
      className={`card-locked ${className}`}
      style={height ? { height, cursor: 'pointer' } : { cursor: 'pointer' }}
    >
      <div className="card-locked-blur" aria-hidden="true">
        {previewContent ?? (
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: 15, lineHeight: 1.7 }}>
              준기님 사주의 관성과 비견겁이 이번 흐름에서 교차하면서 생기는 파동이
              있습니다. 이 파동은 대운과 세운의 교집합에서…
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.7, marginTop: 8 }}>
              구체적으로는 3일 차에 재성 동요가, 5일 차에 인성 보강이 맞물려…
            </p>
          </div>
        )}
      </div>
      <div className="card-locked-overlay">
        <div className="card-locked-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 10V7a6 6 0 1 1 12 0v3m-9 0h6m-9 0h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="card-locked-title">{title}</p>
        {subtitle && <p className="card-locked-sub">{subtitle}</p>}
        <div className="card-locked-cta">
          <span>{ctaText}</span>
        </div>
      </div>
    </motion.div>
  );
}
