import type { ReactNode } from 'react';
// 2026-05-04 디자인 업그레이드 — 사주카드(saju-card) 패턴 통일:
//   · 천간 박스 = 오행 컬러 배경 + 흰 한자 (saju-card _identity_card 와 동일)
//   · 우상단 오행 한자 뱃지 (StoragePage ProfileCard 패턴)
//   · 일주는 골드 outline + glow + scale 으로 강조
//   · 셀 하단에 지지 한자 (오행 컬러 텍스트 · 흰 배경 strip)
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
  /** 플립 콜백 (deprecated · API 호환만) */
  onFlip?: (index: number) => void;
  /** 가운데 일주 강조 */
  highlightDay?: boolean;
}

const OHENG_HAN: Record<OhengType, string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};

/** saju-card OHENG_BOX 와 동일 — 5 오행 박스 톤 */
const OHENG_BOX: Record<OhengType, { bg: string; fg: string; outline: string }> = {
  목: { bg: '#2D8A4E', fg: '#FFFFFF', outline: '#1B5E2C' },
  화: { bg: '#D32F2F', fg: '#FFFFFF', outline: '#9B1B1B' },
  토: { bg: '#E8B82A', fg: '#FFFFFF', outline: '#C9A030' },
  금: { bg: '#FFFFFF', fg: '#1A1A1A', outline: '#9C9C9C' },
  수: { bg: '#1A1A1A', fg: '#FFFFFF', outline: '#3D3D3D' },
};

const OHENG_TEXT: Record<OhengType, string> = {
  목: '#2D8A4E', 화: '#D32F2F', 토: '#C9A030', 금: '#4A4A4A', 수: '#1565E0',
};

const SERIF = "'Noto Serif KR', 'Apple SD Gothic Neo', serif";
const C_GOLD = '#B8965A';
const C_GOLD_DEEP = '#8C6D3D';
const C_PAPER = '#F8F5EE';

/**
 * 4기둥 미니 카드 — 사주카드 패턴 통일 (2026-05-04).
 * 시·일·월·년 전통 순서로 4열 그리드.
 */
export function SajuMiniCard({ pillars, onFlip: _onFlip, highlightDay = true }: SajuMiniCardProps) {
  void _onFlip;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}
    >
      {pillars.map((p, i) => {
        const isDay = p.label === '일' && highlightDay;
        return (
          <div
            key={`${p.label}-${i}`}
            style={{ minHeight: 132 }}
            aria-label={`${p.label}주 · ${p.unavailable ? '미입력' : `${p.gan}${p.ji}`}`}
          >
            {renderCell(p, isDay)}
          </div>
        );
      })}
    </div>
  );
}

function renderCell(p: PillarData, isDay: boolean): ReactNode {
  if (p.unavailable) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          background: '#FBF8F1',
          border: `1.5px dashed ${C_GOLD}55`,
          borderRadius: 12,
          padding: 8,
          fontFamily: SERIF,
        }}
      >
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C_GOLD_DEEP, letterSpacing: '0.04em' }}>
          {p.label}
        </span>
        <span style={{ fontSize: 9, color: '#A8A097', marginTop: 2 }}>모름</span>
      </div>
    );
  }
  const ganBox = OHENG_BOX[p.ohengGan];
  const jiTextColor = OHENG_TEXT[p.ohengJi];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        background: isDay ? '#FEFBF2' : '#FFFFFF',
        border: isDay ? `2px solid ${C_GOLD}` : `1px solid #E5DFD0`,
        borderRadius: 12,
        padding: '8px 6px 10px',
        position: 'relative',
        boxShadow: isDay
          ? `0 0 0 3px rgba(184,150,90,0.16), 0 6px 16px ${C_GOLD}40`
          : '0 1px 3px rgba(0,0,0,0.04)',
        transform: isDay ? 'scale(1.04)' : 'none',
        transformOrigin: 'center',
        zIndex: isDay ? 2 : 1,
      }}
    >
      {/* 라벨 (시/일/월/년) */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: isDay ? C_GOLD_DEEP : '#A8A097',
          letterSpacing: '0.06em',
          fontFamily: SERIF,
        }}
      >
        {p.label}
      </span>

      {/* 천간 박스 — 오행 컬러 배경 + 흰 한자 */}
      <div
        style={{
          width: 44,
          height: 44,
          background: ganBox.bg,
          color: ganBox.fg,
          border: `1.5px solid ${ganBox.outline}`,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF,
          fontSize: 22,
          fontWeight: 900,
          lineHeight: 1,
          position: 'relative',
          boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
        }}
      >
        {p.gan}
        {/* 우상단 오행 한자 뱃지 (ProfileCard 패턴) */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            fontSize: 8.5,
            fontWeight: 800,
            padding: '1px 4px',
            borderRadius: 999,
            background: '#FFFFFF',
            color: ganBox.bg === '#FFFFFF' ? ganBox.outline : ganBox.bg === '#1A1A1A' ? '#1A1A1A' : ganBox.bg,
            border: `1.2px solid ${ganBox.bg === '#FFFFFF' ? ganBox.outline : ganBox.bg === '#1A1A1A' ? '#1A1A1A' : ganBox.bg}`,
            lineHeight: 1.2,
            letterSpacing: '0.04em',
          }}
        >
          {OHENG_HAN[p.ohengGan]}
        </span>
      </div>

      {/* 지지 한자 — 오행 컬러 텍스트 */}
      <span
        style={{
          fontFamily: SERIF,
          fontSize: 18,
          fontWeight: 800,
          color: jiTextColor,
          lineHeight: 1,
          marginTop: 2,
        }}
      >
        {p.ji}
      </span>

      {/* 일주 강조 — "나" 뱃지 */}
      {isDay && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: C_GOLD_DEEP,
            color: C_PAPER,
            fontSize: 9,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
            border: `1.5px solid ${C_PAPER}`,
            fontFamily: SERIF,
          }}
        >
          나
        </span>
      )}
    </div>
  );
}
