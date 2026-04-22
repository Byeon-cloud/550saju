import type { ReactNode } from 'react';
import { Flippable } from '@/components/common/Flippable';
import type { OhengType } from '@/types/saju';

export interface PillarData {
  /** 한글 라벨 — 전통 순서 '시 · 일 · 월 · 년' */
  label: '시' | '일' | '월' | '년';
  /** 천간 한자 (예: '戊') */
  gan: string;
  /** 지지 한자 (예: '午') */
  ji: string;
  /** 천간 오행 */
  ohengGan: OhengType;
  /** 지지 오행 */
  ohengJi: OhengType;
  /** 십성 (예: '정재') */
  shipsin?: string;
  /** 뒷면에 표시할 꿈·오늘 연결 해석 2~3줄 */
  connection?: string;
  /** 미입력 시주 */
  unavailable?: boolean;
}

interface SajuMiniCardProps {
  pillars: PillarData[]; // 4개 (시→일→월→년 전통 순서)
  /** 플립 콜백 */
  onFlip?: (index: number) => void;
  /** 가운데 일주 강조 */
  highlightDay?: boolean;
}

const OHENG_COLORS: Record<OhengType, string> = {
  목: '#2D8A4E',
  화: '#D32F2F',
  토: '#F57F17',
  금: '#757575',
  수: '#1565C0',
};

/**
 * 4기둥 미니 카드 (IX-1 플립).
 * 시·일·월·년 전통 순서로 4열 그리드. 각 칸 탭 시 rotateY 플립 → 뒷면에 연결 해석.
 */
export function SajuMiniCard({ pillars, onFlip, highlightDay = true }: SajuMiniCardProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}
    >
      {pillars.map((p, i) => {
        const isDay = p.label === '일';
        return (
          <Flippable
            key={`${p.label}-${i}`}
            height={120}
            ariaLabel={`${p.label}주 · ${p.unavailable ? '미입력' : `${p.gan}${p.ji}`}`}
            front={renderFront(p, isDay && highlightDay)}
            back={renderBack(p)}
            flipOnTap={!p.unavailable}
            locked={false}
          />
        );
      })}
      {/* onFlip callback — Flippable 에서 직접 이벤트 전달은 생략, 필요 시 확장 */}
      {onFlip && null}
    </div>
  );
}

function renderFront(p: PillarData, highlight: boolean): ReactNode {
  if (p.unavailable) {
    return (
      <div
        className="pillar-mini-cell"
        style={{
          border: '1px dashed var(--border-default)',
          background: 'var(--bg-card)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <p className="pillar-mini-label">{p.label}</p>
        <p style={{ fontSize: 10, color: 'var(--text-hint)' }}>미입력</p>
      </div>
    );
  }
  const topOheng = OHENG_COLORS[p.ohengGan];
  return (
    <div
      className="pillar-mini-cell"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: highlight ? '#FEFBF2' : '#FFFFFF',
        border: highlight ? '2px solid var(--brand-gold)' : '0.5px solid var(--border-default)',
        borderTop: `3px solid ${topOheng}`,
      }}
    >
      <p className="pillar-mini-label" style={{ color: highlight ? 'var(--brand-gold)' : 'var(--text-muted)' }}>
        {p.label}
      </p>
      <p className="pillar-mini-gan" style={{ color: OHENG_COLORS[p.ohengGan] }}>{p.gan}</p>
      <p className="pillar-mini-ji" style={{ color: OHENG_COLORS[p.ohengJi] }}>{p.ji}</p>
    </div>
  );
}

function renderBack(p: PillarData): ReactNode {
  return (
    <div
      className="pillar-mini-cell"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 10,
        gap: 6,
        background: 'var(--bg-cream)',
        border: '0.5px solid rgba(184,150,90,0.3)',
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-gold)' }}>
        {p.label}주 · {p.shipsin ?? '—'}
      </p>
      <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
        {p.connection ?? '탭하면 꿈·오늘과의 연결이 보입니다.'}
      </p>
    </div>
  );
}
