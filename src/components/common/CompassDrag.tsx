import { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

type Direction = '동' | '서' | '남' | '북' | '동남' | '동북' | '서남' | '서북';

interface CompassDragProps {
  /** 오늘의 행운 방위 */
  direction: Direction;
  /** 설명 (예: '해가 뜨는 방향으로 움직이는 날') */
  desc?: string;
  /** 드래그 활성 (기본 true) */
  draggable?: boolean;
}

/** 방위별 각도 (12시 기준, 시계방향) */
const DIRECTION_DEG: Record<Direction, number> = {
  북: 0,
  동북: 45,
  동: 90,
  동남: 135,
  남: 180,
  서남: 225,
  서: 270,
  서북: 315,
};

const ALL_DIRECTIONS: Direction[] = ['북', '동북', '동', '동남', '남', '서남', '서', '서북'];

/**
 * IX-9 행운의 방위 나침반.
 * SVG 원형, 8방위 표시, 오늘의 방위에 골드 바늘.
 * 드래그 가능, 손 떼면 스프링으로 원위치.
 */
export function CompassDrag({ direction, desc, draggable = true }: CompassDragProps) {
  const size = 180;
  const radius = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const baseDeg = DIRECTION_DEG[direction];

  const rotation = useMotionValue(baseDeg);
  const [isDragging, setIsDragging] = useState(false);

  function handlePan(_: unknown, info: { point: { x: number; y: number } }) {
    // 중심에서 포인터까지 각도 (12시 기준 시계방향)
    // 나침반 위치는 뷰포트 기준이 아니라 transform을 기준으로 하므로 간이 처리
    const dx = info.point.x - (cx + (typeof window !== 'undefined' ? window.innerWidth / 2 - size / 2 : 0));
    const dy = info.point.y - cy;
    const rad = Math.atan2(dy, dx);
    const deg = (rad * 180) / Math.PI + 90;
    rotation.set(deg);
  }

  function handlePanEnd() {
    setIsDragging(false);
    // 스프링 복귀 — framer-motion spring을 animate 로 트리거
    const current = rotation.get();
    const target = baseDeg;
    // 최단 방향 결정
    let diff = target - current;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    rotation.set(current + diff);
  }

  // 바늘 회전
  const pointerTransform = useTransform(rotation, (v) => `rotate(${v}deg)`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <motion.div
        style={{
          width: size,
          height: size,
          position: 'relative',
          cursor: draggable ? 'grab' : 'default',
          touchAction: 'none',
        }}
        onPan={draggable ? handlePan : undefined}
        onPanStart={() => setIsDragging(true)}
        onPanEnd={handlePanEnd}
        animate={!isDragging ? { rotate: 0 } : {}}
      >
        <svg width={size} height={size} style={{ display: 'block' }}>
          {/* 외곽 원 */}
          <circle cx={cx} cy={cy} r={radius} fill="var(--bg-cream)" stroke="var(--brand-gold)" strokeWidth="1.5" />
          {/* 8방위 라벨 */}
          {ALL_DIRECTIONS.map((dir) => {
            const deg = DIRECTION_DEG[dir];
            const rad = (deg - 90) * (Math.PI / 180);
            const lx = cx + (radius - 16) * Math.cos(rad);
            const ly = cy + (radius - 16) * Math.sin(rad);
            const active = dir === direction;
            return (
              <text
                key={dir}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={dir.length === 1 ? 14 : 10}
                fontWeight={active ? 900 : 600}
                fill={active ? 'var(--brand-gold)' : 'var(--text-muted)'}
              >
                {dir}
              </text>
            );
          })}
          {/* 중앙 점 */}
          <circle cx={cx} cy={cy} r="4" fill="var(--brand-gold)" />
        </svg>

        {/* 골드 바늘 (오늘의 방위 가리키는, 사용자 드래그로 회전) */}
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            pointerEvents: 'none',
            transform: pointerTransform,
            transformOrigin: `${cx}px ${cy}px`,
          }}
        >
          <svg width={size} height={size}>
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - radius + 10}
              stroke="var(--brand-gold)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <polygon
              points={`${cx - 5},${cy - radius + 18} ${cx + 5},${cy - radius + 18} ${cx},${cy - radius + 8}`}
              fill="var(--brand-gold)"
            />
          </svg>
        </motion.div>
      </motion.div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand-gold)', marginBottom: 4 }}>
          {direction}쪽
        </p>
        {desc && (
          <p className="sec-caption" style={{ maxWidth: 240 }}>
            {desc}
          </p>
        )}
        {draggable && (
          <p className="sec-caption" style={{ marginTop: 6, opacity: 0.6 }}>
            드래그해 보세요
          </p>
        )}
      </div>
    </div>
  );
}
