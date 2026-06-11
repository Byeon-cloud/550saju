// 어드민 대시보드 — 공용 컴포넌트 (2026-06-10)
//   Kpi(델타 배지) · Section · DataTable(정렬) · DeltaBadge · Empty · Skeleton · CsvButton
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export const C = {
  paper: '#F8F5EE', ink: '#1A1A1A', mute: '#7A7269', gold: '#B8965A', goldDeep: '#8C6D3D',
  line: '#E5DFD0', surface: '#FFFFFF',
  up: '#1E7A3C', down: '#C0392B',
};

export const CONTENT_LABEL: Record<string, string> = {
  daily: '오늘운세', dream: '꿈해몽', topic: '주제분석', premium: '종합사주',
  report: '종합사주', chat: '사주대화',
  deepDream: '심층해몽', daeun: '대운', monthly: '월운', compat: '궁합', tojung: '토정비결',
  basic: '1운 리포트', compatibility: '궁합',
};
export const CONTENT_COLORS = ['#B5441F', '#1A1A1A', '#5A7CA8', '#B8965A', '#6FA08C', '#9C5A8A'];

export const fmtNum = (n: number): string => n.toLocaleString('ko-KR');
export const fmtWon = (n: number): string => `₩${Math.round(n).toLocaleString('ko-KR')}`;
export const fmtPct = (n: number | null): string => (n == null ? '-' : `${n}%`);

/** 증감률 계산 — prev 0 이면 null (배지 '—') */
export function deltaPct(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

/** ▲+12% 초록 / ▼-8% 빨강 / ±0 회색 / null → NEW(전기간 0) */
export function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span style={{ fontSize: 11, fontWeight: 700, color: C.goldDeep, padding: '1px 6px', background: 'rgba(184,150,90,0.12)', borderRadius: 6 }}>NEW</span>;
  }
  const up = pct > 0;
  const zero = pct === 0;
  const color = zero ? C.mute : up ? C.up : C.down;
  const bg = zero ? 'rgba(122,114,105,0.10)' : up ? 'rgba(30,122,60,0.10)' : 'rgba(192,57,43,0.10)';
  const mark = zero ? '±' : up ? '▲' : '▼';
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, padding: '1px 6px', background: bg, borderRadius: 6, whiteSpace: 'nowrap' }}>
      {mark}{zero ? '0%' : `${up ? '+' : ''}${pct}%`}
    </span>
  );
}

export function Kpi({ label, value, delta, accent, sub }: {
  label: string; value: string; delta?: number | null; accent?: boolean; sub?: string;
}) {
  return (
    <div style={{ padding: '14px 16px', background: accent ? C.ink : C.surface, border: `1px solid ${C.line}`, borderRadius: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 11, color: accent ? 'rgba(255,255,255,0.6)' : C.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {delta !== undefined && <DeltaBadge pct={delta} />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? '#F4D166' : C.ink, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: accent ? 'rgba(255,255,255,0.5)' : C.mute, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Section({ title, right, children, caption }: {
  title: string; right?: ReactNode; children: ReactNode; caption?: string;
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: C.goldDeep, letterSpacing: '0.02em' }}>{title}</h2>
        {right}
      </div>
      {children}
      {caption && <p style={{ fontSize: 10, color: C.mute, marginTop: 6, lineHeight: 1.6 }}>{caption}</p>}
    </section>
  );
}

export function Empty({ text }: { text?: string }) {
  return (
    <div style={{ padding: '24px 16px', background: C.surface, border: `1px dashed ${C.line}`, borderRadius: 12, textAlign: 'center' }}>
      <p style={{ fontSize: 12, color: C.mute }}>{text || '아직 데이터 없음 — 사용이 누적되면 표시돼요'}</p>
    </div>
  );
}

/** 로딩 스켈레톤 — KPI 그리드 + 차트 자리 */
export function Skeleton() {
  const box = (h: number) => ({
    height: h, borderRadius: 16, background: 'linear-gradient(90deg, #EFEAE0 25%, #F6F2E9 50%, #EFEAE0 75%)',
    backgroundSize: '200% 100%', animation: 'adminShimmer 1.4s infinite',
  });
  return (
    <div>
      <style>{'@keyframes adminShimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }'}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={box(76)} />)}
      </div>
      <div style={{ ...box(200), marginBottom: 18 }} />
      <div style={box(140)} />
    </div>
  );
}

export function CsvButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: 700, color: C.goldDeep, padding: '4px 12px',
        background: C.surface, border: `1px solid ${C.gold}`, borderRadius: 8, cursor: 'pointer',
      }}
    >
      {label || 'CSV'}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// DataTable — 헤더 클릭 정렬 / 숫자 우측정렬·콤마 / 행 hover
// ─────────────────────────────────────────────────────────
export interface Col<R = any> {
  key: string;
  label: string;
  numeric?: boolean;                       // true → 우측정렬 + 콤마
  render?: (value: any, row: R) => ReactNode;
  width?: number | string;
}

export function DataTable<R extends Record<string, any>>({ columns, rows, initialSortKey, initialDesc = true }: {
  columns: Col<R>[]; rows: R[]; initialSortKey?: string; initialDesc?: boolean;
}) {
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [desc, setDesc] = useState(initialDesc);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'ko');
      return desc ? -cmp : cmp;
    });
    return copy;
  }, [rows, sortKey, desc]);

  const onHeader = (key: string) => {
    if (sortKey === key) setDesc((d) => !d);
    else { setSortKey(key); setDesc(true); }
  };

  if (rows.length === 0) return <Empty />;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.line}`, background: '#FCFAF5' }}>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => onHeader(c.key)}
                  style={{
                    padding: '10px 12px', fontSize: 11, fontWeight: 700, color: sortKey === c.key ? C.goldDeep : C.mute,
                    textAlign: c.numeric ? 'right' : 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                    width: c.width,
                  }}
                >
                  {c.label}{sortKey === c.key ? (desc ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => (
              <tr
                key={ri}
                style={{ borderBottom: ri < sorted.length - 1 ? `1px solid ${C.line}` : 'none' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#FAF7F0'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
              >
                {columns.map((c) => {
                  const v = row[c.key];
                  return (
                    <td
                      key={c.key}
                      style={{
                        padding: '9px 12px', color: C.ink,
                        textAlign: c.numeric ? 'right' : 'left', whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {c.render ? c.render(v, row) : (typeof v === 'number' ? fmtNum(v) : (v ?? '-'))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 미니 통계 셀 (광고 4종 등) */
export function MiniStat({ label, value, delta }: { label: string; value: number | string; delta?: number | null }) {
  return (
    <div style={{ padding: '10px 12px', background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: C.mute }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.ink, marginTop: 2 }}>
        {typeof value === 'number' ? fmtNum(value) : value}
      </div>
      {delta !== undefined && <div style={{ marginTop: 2 }}><DeltaBadge pct={delta} /></div>}
    </div>
  );
}
