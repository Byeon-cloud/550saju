/**
 * 관리자 v4 — 차트 부품 (2026-10-19, dataviz 규칙)
 *   - 색: 앱 파랑 #2E6DB0, 웹 주황 #C47A2C (검사 통과: 밝기, 채도, 색각 이상 구분 ΔE 22, 흰 바탕 대비 3:1 이상)
 *   - 막대 굵기 24px 이하, 위 끝만 4px 둥글게, 붙은 칸 사이 2px 흰 틈, 격자는 1px 옅은 회색
 *   - 값과 글자는 글자색(먹, 회색). 계열 색은 막대와 선, 옆의 작은 표시에만
 *   - 막대마다 마우스를 올리면(또는 탭하면) 날짜와 값, 숫자는 표로도 볼 수 있다(표 내려받기)
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { shortDay } from './api';
import type { DayStats } from './api';

export const PLAT_COLOR = { app: '#2E6DB0', web: '#C47A2C' } as const;
const INK = '#1A1A1A';
const MUTE = '#6F6557';
const GRID = '#ECE7DC';
const SURFACE = '#FFFFFF';

/** 작은 추세선 (숫자 칸 안). 지난 기간은 옅게, 마지막 점만 진하게 */
export function Spark({ values, color = '#8C8478', height = 28 }: { values: number[]; color?: string; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const w = 100;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 3 - (v / max) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block', marginTop: 6 }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.55} />
      <circle cx={lx} cy={ly} r={3} fill={color} stroke={SURFACE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 범례 (두 계열 이상일 때만) */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 14, fontSize: 13, color: MUTE }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: 'inline-block' }} />{it.label}
        </span>
      ))}
    </div>
  );
}

/** 날짜별 쌓은 세로 막대 (앱 아래, 웹 위). 마우스를 올리면 그날 값 */
export function DayColumns({ days, series, fmt, height = 170, title, right }: {
  days: DayStats[];
  series: { key: string; label: string; color: string; get: (d: DayStats) => number }[];
  fmt: (n: number) => string;
  height?: number;
  title?: string;
  right?: ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = days.map((d) => series.reduce((s, x) => s + (x.get(d) || 0), 0));
  const rawMax = Math.max(0, ...totals);
  const max = niceMax(rawMax);
  const padL = 44; const padB = 22; const W = 640; const H = height;
  const plotW = W - padL - 8; const plotH = H - padB - 8;
  const band = plotW / Math.max(1, days.length);
  const barW = Math.min(24, band * 0.62);
  const ticks = [0, max / 2, max];
  const y = (v: number) => 8 + plotH - (v / max) * plotH;
  const hd = hover != null ? days[hover] : null;
  return (
    <div style={{ background: SURFACE, border: '1px solid #E5DFD0', borderRadius: 12, padding: '12px 14px 10px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        {title && <span style={{ fontSize: 14, fontWeight: 800, color: INK }}>{title}</span>}
        {series.length > 1 ? <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} /> : right}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={title || '날짜별 막대'}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={MUTE}>{compact(t)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = padL + band * i + band / 2;
          let top = y(0);
          const segs = series.map((s) => {
            const v = s.get(d) || 0;
            const h = (v / max) * plotH;
            const seg = { s, v, y: top - h, h };
            top -= h;
            return seg;
          }).filter((g) => g.h > 0.5);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} tabIndex={0} style={{ outline: 'none' }}>
              {/* 막대보다 넓은 투명 칸 — 손가락이나 마우스가 잘 걸리게 */}
              <rect x={padL + band * i} y={8} width={band} height={plotH} fill="transparent" />
              {segs.map((g, k) => {
                const last = k === segs.length - 1;
                const gap = k > 0 ? 2 : 0; // 칸 사이 2px 흰 틈
                const hh = Math.max(0, g.h - gap);
                return last
                  ? <path key={g.s.key} d={roundTop(cx - barW / 2, g.y, barW, hh, Math.min(4, hh))} fill={g.s.color} opacity={hover == null || hover === i ? (d.partial ? 0.5 : 1) : 0.35} />
                  : <rect key={g.s.key} x={cx - barW / 2} y={g.y + gap} width={barW} height={hh} fill={g.s.color} opacity={hover == null || hover === i ? (d.partial ? 0.5 : 1) : 0.35} />;
              })}
              {(i === 0 || i === days.length - 1 || (days.length > 10 && i === Math.floor(days.length / 2))) && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize={11} fill={MUTE}>{shortDay(d.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hd && (
        <div style={{ position: 'absolute', top: 40, right: 14, background: SURFACE, border: '1px solid #E5DFD0', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: INK, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', pointerEvents: 'none', minWidth: 140 }}>
          <div style={{ color: MUTE, fontSize: 12 }}>{hd.day}{hd.partial ? ' (진행 중)' : ''}</div>
          {series.map((s) => (
            <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: MUTE }}><span style={{ width: 10, height: 2, background: s.color, display: 'inline-block' }} />{s.label}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(s.get(hd) || 0)}</b>
            </div>
          ))}
          {series.length > 1 && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, borderTop: '1px solid #ECE7DC', paddingTop: 4 }}><span style={{ color: MUTE }}>합계</span><b>{fmt(series.reduce((t, s) => t + (s.get(hd) || 0), 0))}</b></div>}
        </div>
      )}
    </div>
  );
}

/** 단계별 가로 막대 (전환 깔때기). 첫 단계 대비 비율을 막대 끝에 */
export function Funnel({ title, steps, color }: { title: string; steps: { label: string; value: number }[]; color: string }) {
  const first = steps[0]?.value || 0;
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div style={{ background: SURFACE, border: '1px solid #E5DFD0', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 8 }}>{title}</div>
      {steps.map((s, i) => {
        const w = (s.value / max) * 100;
        const rate = i && first ? (s.value / first) * 100 : null;
        return (
          <div key={s.label} style={{ display: 'grid', gridTemplateColumns: '112px 1fr 92px', alignItems: 'center', gap: 8, margin: '5px 0' }}>
            <span style={{ fontSize: 13, color: MUTE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
            <div style={{ height: 14, background: '#F3EFE6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(w, s.value ? 1.5 : 0)}%`, height: '100%', background: color, borderRadius: '0 4px 4px 0' }} />
            </div>
            <span style={{ fontSize: 13, color: INK, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {s.value.toLocaleString('ko-KR')}{rate != null && <span style={{ color: MUTE }}> {rate < 1 && rate > 0 ? rate.toFixed(2) : rate.toFixed(1)}%</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function roundTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
function compact(n: number): string {
  if (n >= 1e8) return `${Math.round(n / 1e7) / 10}억`;
  if (n >= 1e4) return `${Math.round(n / 1e3) / 10}만`;
  if (n >= 1e3) return `${Math.round(n / 100) / 10}천`;
  return String(Math.round(n));
}
