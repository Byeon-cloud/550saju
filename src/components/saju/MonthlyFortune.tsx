import { useMemo } from 'react';
import type { MonthlyFortune as MonthlyFortuneType } from '@/types/report';

interface Props {
  data: MonthlyFortuneType[];
}

/**
 * 2026 월별 운세 — 그라데이션 에어리어 차트
 * 고점/저점 확실하게 표시, 프리미엄 UI
 */
export function MonthlyFortune({ data }: Props) {
  const sorted = useMemo(() => [...data].sort((a, b) => a.month - b.month), [data]);

  const maxScore = Math.max(...sorted.map(d => d.score));
  const minScore = Math.min(...sorted.map(d => d.score));
  const bestMonth = sorted.find(d => d.score === maxScore);
  const worstMonth = sorted.find(d => d.score === minScore);

  // SVG 차트 좌표 계산
  const W = 340; // viewBox width
  const H = 160; // viewBox height
  const PAD_X = 20;
  const PAD_TOP = 25;
  const PAD_BOTTOM = 28;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  // Y축 범위: 점수 최소~최대에 여유 포함
  const yMin = Math.max(0, minScore - 10);
  const yMax = Math.min(100, maxScore + 10);
  const yRange = yMax - yMin || 1;

  const points = sorted.map((d, i) => {
    const x = PAD_X + (i / (sorted.length - 1)) * chartW;
    const y = PAD_TOP + chartH - ((d.score - yMin) / yRange) * chartH;
    return { x, y, month: d.month, score: d.score };
  });

  // Smooth curve path (Catmull-Rom to Bezier approximation)
  function smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return '';
    let path = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD_TOP + chartH} L${points[0].x},${PAD_TOP + chartH} Z`;

  // 그리드 라인 (4개)
  const gridLines = [0.25, 0.5, 0.75, 1].map(ratio => {
    const y = PAD_TOP + chartH * (1 - ratio);
    const label = Math.round(yMin + yRange * ratio);
    return { y, label };
  });

  return (
    <div className="space-y-3">
      <h4 className="text-h3 text-text-primary">월별 운세 흐름</h4>

      {/* 고점/저점 요약 */}
      <div className="flex gap-2 mb-1">
        {bestMonth && (
          <div className="flex-1 p-2 rounded-lg text-center" style={{ background: '#E7EFE6', border: '1px solid #c8e6c9' }}>
            <p style={{ fontSize: 12, color: '#4E7A57', fontWeight: 600 }}>최고의 달</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#4E7A57' }}>{bestMonth.month}월</p>
            <p style={{ fontSize: 12, color: '#6E9776', fontWeight: 700 }}>{bestMonth.score}점</p>
          </div>
        )}
        {worstMonth && (
          <div className="flex-1 p-2 rounded-lg text-center" style={{ background: '#fff3e0', border: '1px solid #ffe0b2' }}>
            <p style={{ fontSize: 12, color: '#8A6226', fontWeight: 600 }}>주의할 달</p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#8A6226' }}>{worstMonth.month}월</p>
            <p style={{ fontSize: 12, color: '#B07F38', fontWeight: 700 }}>{worstMonth.score}점</p>
          </div>
        )}
      </div>

      {/* SVG 그라데이션 에어리어 차트 */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#faf7f2', border: '1px solid #e8e0d4' }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
          <defs>
            {/* 에어리어 그라데이션 — 골드에서 투명으로 */}
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#B8965A" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#B8965A" stopOpacity={0.02} />
            </linearGradient>
            {/* 라인 그라데이션 */}
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8C6D3D" />
              <stop offset="50%" stopColor="#B8965A" />
              <stop offset="100%" stopColor="#B8965A" />
            </linearGradient>
          </defs>

          {/* 그리드 라인 */}
          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={PAD_X} y1={g.y} x2={W - PAD_X} y2={g.y} stroke="#e8e0d4" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PAD_X - 3} y={g.y + 3} fontSize="7" fill="#c9b99a" textAnchor="end">{g.label}</text>
            </g>
          ))}

          {/* 에어리어 (그라데이션 채우기) */}
          <path d={areaPath} fill="url(#areaGrad)" />

          {/* 라인 */}
          <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* 데이터 포인트 */}
          {points.map((p, i) => {
            const isBest = p.score === maxScore;
            const isWorst = p.score === minScore;
            const r = isBest || isWorst ? 5 : 2.5;
            return (
              <g key={i}>
                {/* 포인트 원 */}
                <circle cx={p.x} cy={p.y} r={r}
                  fill={isBest ? '#4E7A57' : isWorst ? '#8A6226' : '#B8965A'}
                  stroke="#fff" strokeWidth={isBest || isWorst ? 2 : 1}
                />
                {/* 고점/저점 라벨 */}
                {isBest && (
                  <g>
                    <rect x={p.x - 14} y={p.y - 20} width="28" height="14" rx="3" fill="#4E7A57" />
                    <text x={p.x} y={p.y - 11} fontSize="8" fill="#fff" textAnchor="middle" fontWeight="700">{p.score}</text>
                  </g>
                )}
                {isWorst && (
                  <g>
                    <rect x={p.x - 14} y={p.y + 6} width="28" height="14" rx="3" fill="#8A6226" />
                    <text x={p.x} y={p.y + 15} fontSize="8" fill="#fff" textAnchor="middle" fontWeight="700">{p.score}</text>
                  </g>
                )}
                {/* 월 라벨 */}
                <text x={p.x} y={H - 8} fontSize="8" fill={isBest ? '#4E7A57' : isWorst ? '#8A6226' : '#a0937f'} textAnchor="middle" fontWeight={isBest || isWorst ? '700' : '400'}>
                  {p.month}월
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#4E7A57' }} />
          <span style={{ fontSize: 12, color: '#4E7A57', fontWeight: 600 }}>최고점</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#8A6226' }} />
          <span style={{ fontSize: 12, color: '#8A6226', fontWeight: 600 }}>최저점</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#B8965A' }} />
          <span style={{ fontSize: 12, color: '#B8965A', fontWeight: 600 }}>운세 흐름</span>
        </div>
      </div>
    </div>
  );
}
