import { useRef, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';

export interface TimelineStep {
  /** 라벨 (예: '오늘', '3일 후', '1주 후') */
  label: string;
  /** 카드 본문 제목 */
  title: string;
  /** 본문 */
  body: string;
  /** 잠금 상태 */
  locked?: boolean;
}

interface TimelineSwipeProps {
  steps: TimelineStep[];
  /** 잠금 카드 탭 시 콜백 */
  onLockedTap?: (step: TimelineStep) => void;
  /** 잠금 CTA 문구 */
  lockedCta?: string;
}

/**
 * IX-3 타임라인 3컷 가로 스와이프.
 * framer-motion drag="x" + snap + 인디케이터.
 */
export function TimelineSwipe({ steps, onLockedTap, lockedCta = '1운으로 열기 →' }: TimelineSwipeProps) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = 50;
    if (info.offset.x < -threshold && index < steps.length - 1) setIndex(index + 1);
    else if (info.offset.x > threshold && index > 0) setIndex(index - 1);
  }

  return (
    <div>
      <div ref={containerRef} style={{ overflow: 'hidden', position: 'relative' }}>
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          animate={{ x: -index * 100 + '%' }}
          transition={{ type: 'spring', damping: 22, stiffness: 240 }}
          style={{ display: 'flex', touchAction: 'pan-y' }}
        >
          {steps.map((step, i) => (
            <div
              key={`${step.label}-${i}`}
              style={{ flex: '0 0 100%', padding: '0 4px', boxSizing: 'border-box' }}
            >
              {step.locked ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onLockedTap?.(step)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onLockedTap?.(step);
                    }
                  }}
                  className="card-locked"
                  style={{ minHeight: 180, cursor: 'pointer' }}
                >
                  <div className="card-locked-blur" aria-hidden="true">
                    <div style={{ padding: 20 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#6F6557' }}>{step.label}</p>
                      <p style={{ fontSize: 15, lineHeight: 1.7, marginTop: 8 }}>
                        {step.title}에 대한 구체적 흐름과 조언이 이 안에 있습니다…
                      </p>
                    </div>
                  </div>
                  <div className="card-locked-overlay">
                    <p className="card-locked-title">{step.label} · {step.title}</p>
                    <div className="card-locked-cta">
                      <span>{lockedCta}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card-primary" style={{ minHeight: 180 }}>
                  <p
                    className="sec-meta"
                    style={{ marginBottom: 8, color: 'var(--brand-gold)' }}
                  >
                    {step.label}
                  </p>
                  <p className="sec-title" style={{ marginBottom: 8 }}>
                    {step.title}
                  </p>
                  <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}>
                    {step.body}
                  </p>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </div>

      {/* 페이지 인디케이터 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          marginTop: 12,
        }}
        aria-hidden="true"
      >
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}번 카드로 이동`}
            style={{
              width: i === index ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === index ? 'var(--brand-gold)' : 'rgba(184,150,90,0.3)',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'width 0.25s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
