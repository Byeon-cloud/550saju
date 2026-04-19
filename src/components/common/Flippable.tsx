import { useState, type ReactNode, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FlippableProps {
  /** 앞면 — 기본 표시 */
  front: ReactNode;
  /** 뒷면 — 플립 시 표시 */
  back: ReactNode;
  /** 잠금 상태면 플립 대신 onLockedTap 호출 */
  locked?: boolean;
  /** 잠금 해제 CTA 텍스트 (locked=true 일 때 오버레이에 표시) */
  lockedTitle?: string;
  lockedSub?: string;
  lockedCta?: string;
  /** 잠금 클릭 시 콜백 (결제 모달 오픈 등) */
  onLockedTap?: () => void;
  /** 탭 시 자동 플립 (default: true) */
  flipOnTap?: boolean;
  /** 높이 고정 (px). 기본 160 */
  height?: number;
  /** 접근성 라벨 */
  ariaLabel?: string;
  className?: string;
}

/**
 * 범용 플립 카드.
 * IX-1(4기둥), IX-4(행운 프로필) 공통 사용.
 * framer-motion rotateY 스프링. prefers-reduced-motion 자동 폴백(AnimatePresence 보호).
 */
export function Flippable({
  front,
  back,
  locked = false,
  lockedTitle,
  lockedSub,
  lockedCta = '1운으로 열기 →',
  onLockedTap,
  flipOnTap = true,
  height = 160,
  ariaLabel,
  className = '',
}: FlippableProps) {
  const [flipped, setFlipped] = useState(false);

  function handleActivate() {
    if (locked) {
      onLockedTap?.();
      return;
    }
    if (flipOnTap) setFlipped((v) => !v);
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  }

  if (locked) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel || lockedTitle || '잠금 카드'}
        onClick={handleActivate}
        onKeyDown={handleKey}
        className={`card-locked ${className}`}
        style={{ height, cursor: 'pointer' }}
      >
        <div className="card-locked-blur">{front}</div>
        <div className="card-locked-overlay">
          {lockedTitle && <p className="card-locked-title">{lockedTitle}</p>}
          {lockedSub && <p className="card-locked-sub">{lockedSub}</p>}
          <div className="card-locked-cta">
            <span>{lockedCta}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel || '플립 카드'}
      aria-expanded={flipped}
      onClick={handleActivate}
      onKeyDown={handleKey}
      className={className}
      style={{ height, perspective: 1000, cursor: 'pointer' }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' }}>
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={flipped ? 'back' : 'front'}
            initial={{ rotateY: flipped ? -90 : 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: flipped ? 90 : -90, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 260 }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              backfaceVisibility: 'hidden',
            }}
          >
            {flipped ? back : front}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
