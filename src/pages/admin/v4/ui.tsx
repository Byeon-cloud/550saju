/**
 * 관리자 v4 — 작은 화면 부품 (2026-10-19)
 *   색은 먹(앱)과 금(웹) 두 가지. 숫자 칸, 막대, 표, 구역.
 */
import type { CSSProperties, ReactNode } from 'react';
import { shortDay } from './api';
import type { DayStats } from './api';

export const K = {
  paper: '#F8F5EE', ink: '#1A1A1A', ink2: '#3D3D3D', mute: '#6F6557', line: '#E5DFD0', surface: '#FFFFFF',
  gold: '#B8965A', goldDeep: '#8C6D3D', red: '#A23A2A', green: '#1E7A3C',
  app: '#1A1A1A', web: '#B8965A',
};

export function Box({ title, right, children, note }: { title: string; right?: ReactNode; children: ReactNode; note?: string }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: K.ink, margin: 0 }}>{title}</h2>
        {right}
      </div>
      {children}
      {note && <p style={{ fontSize: 12.5, color: K.mute, marginTop: 6, lineHeight: 1.6 }}>{note}</p>}
    </section>
  );
}

export function Tile({ label, value, sub, delta, strong }: { label: string; value: string; sub?: string; delta?: number | null; strong?: boolean }) {
  return (
    <div style={{ padding: '12px 14px', background: strong ? K.ink : K.surface, border: `1px solid ${strong ? K.ink : K.line}`, borderRadius: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 13, color: strong ? '#CFC6B6' : K.mute }}>{label}</span>
        {delta !== undefined && delta !== null && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: delta > 0 ? K.green : delta < 0 ? K.red : K.mute }}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: strong ? '#F4EFE4' : K.ink, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: strong ? '#CFC6B6' : K.mute, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export const grid = (min = 150): CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 8 });

/** 날짜별 쌓은 막대 (앱 먹, 웹 금) */
export function Bars({ days, series, fmt, height = 120 }: {
  days: DayStats[];
  series: { name: string; color: string; get: (d: DayStats) => number }[];
  fmt: (n: number) => string;
  height?: number;
}) {
  const totals = days.map((d) => series.reduce((s, x) => s + (x.get(d) || 0), 0));
  const max = Math.max(1, ...totals);
  const w = 100 / Math.max(1, days.length);
  return (
    <div style={{ background: K.surface, border: `1px solid ${K.line}`, borderRadius: 12, padding: '12px 12px 6px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 12.5, color: K.mute }}>
        {series.map((s) => (
          <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2, display: 'inline-block' }} />{s.name}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>가장 큰 날 {fmt(max)}</span>
      </div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }} role="img" aria-label="날짜별 막대">
        {days.map((d, i) => {
          let y = height;
          return (
            <g key={d.day}>
              <title>{`${d.day} ${series.map((s) => `${s.name} ${fmt(s.get(d) || 0)}`).join(', ')}`}</title>
              {series.map((s) => {
                const v = s.get(d) || 0;
                const h = (v / max) * (height - 4);
                y -= h;
                return <rect key={s.name} x={i * w + w * 0.15} y={y} width={w * 0.7} height={h} fill={s.color} opacity={d.partial ? 0.45 : 1} />;
              })}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: K.mute, marginTop: 2 }}>
        <span>{days[0] ? shortDay(days[0].day) : ''}</span>
        <span>{days.length > 2 ? shortDay(days[Math.floor(days.length / 2)].day) : ''}</span>
        <span>{days.length ? `${shortDay(days[days.length - 1].day)}${days[days.length - 1].partial ? ' (오늘, 진행 중)' : ''}` : ''}</span>
      </div>
    </div>
  );
}

/** 단순 표 (머리줄 고정 없이, 넓으면 가로로 밀어 본다) */
export function Table({ head, rows, align }: { head: string[]; rows: (string | number | ReactNode)[][]; align?: ('l' | 'r')[] }) {
  return (
    <div style={{ overflowX: 'auto', background: K.surface, border: `1px solid ${K.line}`, borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr>{head.map((h, i) => (
            <th key={i} style={{ textAlign: align?.[i] === 'r' ? 'right' : 'left', padding: '8px 10px', color: K.mute, fontWeight: 700, borderBottom: `1px solid ${K.line}`, whiteSpace: 'nowrap' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length} style={{ padding: 14, color: K.mute, textAlign: 'center' }}>기록이 없어요</td></tr>}
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderTop: ri ? `1px solid ${K.line}` : undefined }}>
              {r.map((c, ci) => (
                <td key={ci} style={{ textAlign: align?.[ci] === 'r' ? 'right' : 'left', padding: '7px 10px', color: K.ink, whiteSpace: 'nowrap' }}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: K.surface, border: `1px solid ${K.line}`, borderRadius: 10, overflow: 'hidden' }}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" onClick={() => onChange(o.v)}
          style={{ padding: '7px 12px', fontSize: 13.5, fontWeight: 700, border: 0, cursor: 'pointer', background: value === o.v ? K.ink : 'transparent', color: value === o.v ? '#F4EFE4' : K.mute }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
