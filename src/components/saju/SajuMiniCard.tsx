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
  /** 천간 한글 읽기 (예: '무') */
  ganRead?: string;
  /** 지지 한글 읽기 (예: '오') */
  jiRead?: string;
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
  목: { bg: '#4E7A57', fg: '#FFFFFF', outline: '#1B5E2C' },
  화: { bg: '#B04A38', fg: '#FFFFFF', outline: '#9B1B1B' },
  토: { bg: '#B07F38', fg: '#FFFFFF', outline: '#C9A030' },
  금: { bg: '#FFFFFF', fg: '#1A1A1A', outline: '#9C9C9C' },
  수: { bg: '#1A1A1A', fg: '#FFFFFF', outline: '#3D3D3D' },
};

/** 천간 한자 → 한글 음 fallback (chRead prop 없을 때 자동 변환) */
const GAN_KO: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
/** 지지 한자 → 한글 음 fallback */
const ZHI_KO: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
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
            aria-label={`${p.label}주, ${p.unavailable ? '미입력' : `${p.gan}${p.ji}`}`}
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
  // 2026-05-04 v4 (준기 결단): 사주카드 _details_table BigCharCell 패턴과 100% 일치.
  //   천간/지지 둘 다 진한 오행 컬러 박스 + 흰 한자 + 박스 안 아래에 작은 오행 한자 (木/火/土/金/수)
  //   박스 아래에 한글 음 (갑/을/...) — chRead.
  //   일주 강조 = 천간/지지 박스 둘 다 더 큼 + 골드 border 2.5px + glow + "나" 뱃지.
  const ganBox = OHENG_BOX[p.ohengGan];
  const jiBox = OHENG_BOX[p.ohengJi];

  const renderBigBox = (
    ch: string,
    chRead: string | undefined,
    box: { bg: string; fg: string; outline: string },
    oheng: OhengType,
    isGan: boolean,
  ) => {
    // chRead prop 없으면 한자 → 한글 자동 매핑 (sajuData.pillars 의 천간읽기·지지읽기 누락 대비)
    const koAuto = isGan ? GAN_KO[ch] : ZHI_KO[ch];
    const koLabel = chRead || koAuto || '';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div
          style={{
            width: isDay ? 56 : 50,
            height: isDay ? 60 : 54,
            background: box.bg,
            color: box.fg,
            border: isDay ? `2.5px solid ${C_GOLD}` : `1.5px solid ${box.outline}`,
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: SERIF,
            letterSpacing: '0.02em',
            boxShadow: isDay ? `0 4px 12px ${C_GOLD}44` : '0 2px 5px rgba(0,0,0,0.10)',
            gap: 1,
          }}
        >
          <span
            style={{
              fontSize: isDay ? 26 : 22,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.01em',
            }}
          >
            {ch}
          </span>
          <span
            style={{
              fontSize: isDay ? 9.5 : 8.5,
              fontWeight: 700,
              opacity: 0.85,
              letterSpacing: '0.04em',
            }}
          >
            {OHENG_HAN[oheng]}
          </span>
        </div>
        {/* 한글 음 — 항상 표시 (한자만 보이는 가독성 문제 해결) */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: isDay ? C_GOLD_DEEP : '#5A5249',
            letterSpacing: '0.02em',
            fontFamily: SERIF,
            minHeight: 14,
          }}
        >
          {koLabel || ' '}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        padding: '4px 0',
        position: 'relative',
        transform: isDay ? 'scale(1.03)' : 'none',
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

      {/* 천간 박스 + 한글 음 */}
      {renderBigBox(p.gan, p.ganRead, ganBox, p.ohengGan, true)}

      {/* 지지 박스 + 한글 음 */}
      {renderBigBox(p.ji, p.jiRead, jiBox, p.ohengJi, false)}

      {/* 일주 "나" 뱃지 (셀 좌상단) */}
      {isDay && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 18,
            left: 4,
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
  );
}
