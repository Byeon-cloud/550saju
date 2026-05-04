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
  // 2026-05-04 v3 (준기 지적): "4주 8자" 가 명확히 분리되도록 천간 박스 + 지지 박스 둘로 나눔.
  // 천간 = 진한 오행 컬러 (보여지는 마음), 지지 = 옅은 오행 컬러 (내면 본능) — 시각적 위계.
  const ganBox = OHENG_BOX[p.ohengGan];
  const jiBox = OHENG_BOX[p.ohengJi];
  const ganBadgeColor = ganBox.bg === '#FFFFFF' ? ganBox.outline : ganBox.bg;
  const jiBadgeColor = jiBox.bg === '#FFFFFF' ? jiBox.outline : jiBox.bg;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '4px 0',
        position: 'relative',
        transform: isDay ? 'scale(1.04)' : 'none',
        transformOrigin: 'center',
        zIndex: isDay ? 2 : 1,
      }}
    >
      {/* 라벨 (시/일/월/년) */}
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          color: isDay ? C_GOLD_DEEP : '#A8A097',
          letterSpacing: '0.06em',
          fontFamily: SERIF,
        }}
      >
        {p.label}
      </span>

      {/* 일주 강조 — 골드 outline 컨테이너 (천간/지지 두 박스를 골드로 감쌈) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: isDay ? 4 : 0,
          borderRadius: isDay ? 14 : 0,
          background: isDay ? 'rgba(184,150,90,0.10)' : 'transparent',
          border: isDay ? `2px solid ${C_GOLD}` : 'none',
          boxShadow: isDay ? `0 0 0 3px rgba(184,150,90,0.14), 0 4px 14px ${C_GOLD}33` : 'none',
          position: 'relative',
        }}
      >
        {/* 천간 박스 — 진한 오행 컬러 + 흰 한자 + 우상단 오행 뱃지 */}
        <div
          style={{
            width: 52,
            height: 50,
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
            boxShadow: '0 2px 5px rgba(0,0,0,0.10)',
          }}
        >
          {p.gan}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: -5,
              right: -4,
              fontSize: 8.5,
              fontWeight: 800,
              padding: '1px 4px',
              borderRadius: 999,
              background: '#FFFFFF',
              color: ganBadgeColor,
              border: `1.2px solid ${ganBadgeColor}`,
              lineHeight: 1.2,
              letterSpacing: '0.04em',
            }}
          >
            {OHENG_HAN[p.ohengGan]}
          </span>
        </div>

        {/* 지지 박스 — 옅은 오행 컬러 (alpha) + 진한 한자 + 우하단 오행 뱃지 */}
        <div
          style={{
            width: 52,
            height: 46,
            background: jiBox.bg === '#FFFFFF'
              ? '#F8F5EE'  // 금: 베이지
              : jiBox.bg === '#1A1A1A'
                ? 'rgba(26,26,26,0.10)'  // 수: 검정 옅게
                : `${jiBox.bg}26`,  // 그 외: 컬러 alpha 0.15
            color: jiBox.bg === '#1A1A1A' ? '#1A1A1A' : jiBox.bg === '#FFFFFF' ? '#1A1A1A' : jiBox.bg,
            border: `1.5px solid ${jiBox.outline}55`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SERIF,
            fontSize: 19,
            fontWeight: 900,
            lineHeight: 1,
            position: 'relative',
          }}
        >
          {p.ji}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: -5,
              right: -4,
              fontSize: 8,
              fontWeight: 800,
              padding: '1px 4px',
              borderRadius: 999,
              background: '#FFFFFF',
              color: jiBadgeColor,
              border: `1.2px solid ${jiBadgeColor}`,
              lineHeight: 1.2,
              letterSpacing: '0.04em',
            }}
          >
            {OHENG_HAN[p.ohengJi]}
          </span>
        </div>

        {/* 일주 "나" 뱃지 (좌상단) */}
        {isDay && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: -10,
              left: -10,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: C_GOLD_DEEP,
              color: C_PAPER,
              fontSize: 9.5,
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.20)',
              border: `1.5px solid ${C_PAPER}`,
              fontFamily: SERIF,
              zIndex: 3,
            }}
          >
            나
          </span>
        )}
      </div>
    </div>
  );
}
