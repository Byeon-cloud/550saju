import { useState, useEffect, useRef } from 'react';
import { motion, type PanInfo } from 'framer-motion';

export interface TimeSlot {
  slot: '오전' | '오후' | '저녁' | '심야';
  range: string;   // '6-12시'
  score: number;   // 0-100
  tip: string;     // 60~100자
}

interface TimeSlotCarouselProps {
  slots: TimeSlot[];
  /** 현재 시각 (0-23). 초기 포커스 계산용 */
  currentHour?: number;
}

/**
 * IX-8 시간대 4구간 carousel.
 * 현재 시각에 해당하는 구간을 자동 포커스 + 골드 테두리.
 * 지나간 시간은 opacity 0.6.
 */
export function TimeSlotCarousel({ slots, currentHour }: TimeSlotCarouselProps) {
  const [index, setIndex] = useState(0);
  const dragConstraintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentHour == null) return;
    // 구간 매핑: 오전 6-12 / 오후 12-18 / 저녁 18-22 / 심야 22-6
    let targetIdx = 0;
    if (currentHour >= 6 && currentHour < 12) targetIdx = 0;
    else if (currentHour >= 12 && currentHour < 18) targetIdx = 1;
    else if (currentHour >= 18 && currentHour < 22) targetIdx = 2;
    else targetIdx = 3;
    setIndex(targetIdx);
  }, [currentHour]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const threshold = 50;
    if (info.offset.x < -threshold && index < slots.length - 1) setIndex(index + 1);
    else if (info.offset.x > threshold && index > 0) setIndex(index - 1);
  }

  // 지나간 시간(탭 불가 아니고 시각적 dim)
  function isPast(i: number): boolean {
    if (currentHour == null) return false;
    const slotEndHour = [12, 18, 22, 30]; // 구간 종료 (심야는 다음날 6시 = 30)
    const endHour = slotEndHour[i];
    const normalizedHour = currentHour < 6 && i === 3 ? currentHour + 24 : currentHour;
    return normalizedHour >= endHour;
  }

  return (
    <div>
      <div ref={dragConstraintRef} style={{ overflow: 'hidden' }}>
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          animate={{ x: -index * 100 + '%' }}
          transition={{ type: 'spring', damping: 22, stiffness: 240 }}
          style={{ display: 'flex', touchAction: 'pan-y' }}
        >
          {slots.map((s, i) => {
            const focused = i === index;
            const past = isPast(i);
            return (
              <div
                key={s.slot}
                style={{ flex: '0 0 100%', padding: '0 4px', boxSizing: 'border-box' }}
              >
                <div
                  className="card-primary"
                  style={{
                    minHeight: 180,
                    border: focused ? '2px solid var(--brand-gold)' : '0.5px solid var(--border-default)',
                    opacity: past ? 0.6 : 1,
                    transition: 'opacity 0.3s, border 0.3s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 18, fontWeight: 800 }}>{s.slot}</p>
                      <p className="sec-caption">{s.range}</p>
                    </div>
                    <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--brand-gold)' }}>
                      {s.score}
                    </p>
                  </div>
                  <p className="text-body-md" style={{ color: 'var(--text-secondary)' }}>
                    {s.tip}
                  </p>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* 인디케이터 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        {slots.map((s, i) => (
          <button
            key={s.slot}
            onClick={() => setIndex(i)}
            aria-label={`${s.slot} 시간대로 이동`}
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
