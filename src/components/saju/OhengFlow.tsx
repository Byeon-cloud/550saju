import type { OhengDistribution, OhengType } from '@/types/saju';
import { OHENG_MAP } from '@/constants/oheng';

interface OhengFlowProps {
  elements: OhengDistribution;
}

const FLOW: OhengType[] = ['목', '화', '토', '금', '수'];
const HANJA: Record<OhengType, string> = { 목: '木', 화: '火', 토: '土', 금: '金', 수: '水' };

/** 오행 상생상극 순환 도식 — 원형 배치 */
export function OhengFlow({ elements }: OhengFlowProps) {
  const total = Object.values(elements).reduce((a, b) => a + b, 0) || 1;

  // 원형 좌표 계산 (5각형)
  const cx = 140, cy = 130, r = 85;
  const points = FLOW.map((_, i) => {
    const angle = (i * 72 - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  return (
    <div className="flex justify-center">
      <svg width="280" height="270" viewBox="0 0 280 270">
        {/* 상생 화살표 (외곽 — 연한 선) */}
        {FLOW.map((_, i) => {
          const from = points[i];
          const to = points[(i + 1) % 5];
          return (
            <line key={`sang-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="var(--border-main)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
          );
        })}

        {/* 상극 화살표 (내부 — 더 연한 점선) */}
        {FLOW.map((_, i) => {
          const from = points[i];
          const to = points[(i + 2) % 5];
          return (
            <line key={`gk-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="var(--oheng-fire)" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.2" />
          );
        })}

        {/* 노드 */}
        {FLOW.map((key, i) => {
          const info = OHENG_MAP[key];
          const p = points[i];
          const count = elements[key] || 0;
          const pct = Math.round((count / total) * 100);
          const nodeR = count === 0 ? 24 : 24 + count * 2.5;

          return (
            <g key={key}>
              {/* 배경 glow */}
              <circle cx={p.x} cy={p.y} r={nodeR + 6} fill={info.colorLight} opacity="0.5" />
              {/* 메인 원 */}
              <circle cx={p.x} cy={p.y} r={nodeR} fill={info.colorLight}
                stroke={count > 0 ? info.color : 'var(--border-main)'} strokeWidth={count > 0 ? 2 : 1} />
              {/* 한자 심볼 */}
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="14" fontWeight="900" dominantBaseline="central"
                fill={count > 0 ? info.color : 'var(--text-hint)'}>
                {HANJA[key]}
              </text>
              {/* 한자 + 개수 */}
              <text x={p.x} y={p.y + 10} textAnchor="middle" fontSize="11" fontWeight="800"
                fill={count > 0 ? info.colorDark : 'var(--text-hint)'}
                dominantBaseline="central">
                {info.hanja} {count}
              </text>
              {/* 퍼센트 */}
              <text x={p.x} y={p.y + 22} textAnchor="middle" fontSize="9" fill="var(--text-muted)"
                dominantBaseline="central">
                {pct}%
              </text>
            </g>
          );
        })}

        {/* 중앙 텍스트 */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text-muted)">
          상생 →
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="var(--text-hint)">
          목→화→토→금→수
        </text>
      </svg>
    </div>
  );
}
