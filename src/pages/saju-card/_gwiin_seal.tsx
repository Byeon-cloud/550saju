/**
 * #saju-card-share Round 2 · 귀인 인장(印章) ⭐ 시그니처 시각 자산
 *
 * 핵심 한 줄 (준기 직접 인용):
 *   "만세력 천을귀인 이미지가 가장 유명" → 사주 카드 시그니처
 *
 * 디자인:
 *   - 도장(印) 형태 SVG · 200×200pt
 *   - 붉은 원형 인주(印朱) 베이스 — 전통 도장 색감 (#A63030 채택, 너무 빨갛지 않게)
 *   - 이중 테두리 (외곽 4px solid + 내부 1.5px stroke 갭)
 *   - 4글자 한자 2×2 배치 (Noto Serif KR weight 900)
 *   - 미세한 vintage 효과 (filter 0.3 opacity 노이즈 X — 인쇄/캡처 안정성 우선)
 *
 * 4 귀인 우선순위 (analyzeSinsal.gilsongGwiin 기반):
 *   1순위 천을귀인(天乙貴人) — 가장 유명, 시그니처
 *   2순위 월덕귀인(月德貴人) — 덕성
 *   3순위 천덕귀인(天德貴人) — 덕성
 *   4순위 문창귀인(文昌貴人) — 학문
 *
 * 발현 안 됐으면 mount 0 (over-fit 방지) — 호출자 책임.
 *
 * 기술:
 *   - 자체 SVG (~80줄) · recharts/도장 라이브러리 회피
 *   - html2canvas 캡처 시 SVG text 안정 렌더 (filter 미사용)
 */

import type { SinsalHit } from '@/services/saju/sinsal';

/* ══════════════════════════════════════════════════════════════════
 * 4 귀인 메타 — 한 줄 설명 + 출처
 * ═════════════════════════════════════════════════════════════════ */
interface GwiinMeta {
  name: string;       // 한국어 이름
  hanja: string;      // 4글자 한자 (도장 본문)
  hanjaShort: string; // 2글자 한자 (백업)
  meaning: string;    // 한 줄 의미
  source: string;     // 출처 원전
  /** 우선순위 (1=가장 강한 시그니처) */
  priority: number;
}

const GWIIN_META: Record<string, GwiinMeta> = {
  천을귀인: {
    name: '천을귀인',
    hanja: '天乙貴人',
    hanjaShort: '天乙',
    meaning: '사주에서 가장 귀한 별. 위기 때 도움받고 인복이 깊은 자리.',
    source: '자평진전·적천수',
    priority: 1,
  },
  월덕귀인: {
    name: '월덕귀인',
    hanja: '月德貴人',
    hanjaShort: '月德',
    meaning: '품성이 어질고 덕이 있어 주변의 신뢰를 받는 자리.',
    source: '연해자평',
    priority: 2,
  },
  천덕귀인: {
    name: '천덕귀인',
    hanja: '天德貴人',
    hanjaShort: '天德',
    meaning: '하늘이 내린 덕. 큰 화를 면하고 음덕을 받는 자리.',
    source: '연해자평',
    priority: 3,
  },
  문창귀인: {
    name: '문창귀인',
    hanja: '文昌貴人',
    hanjaShort: '文昌',
    meaning: '학문·시험·문서의 별. 두뇌 회전과 글재주의 자리.',
    source: '자평진전',
    priority: 4,
  },
};

/* ══════════════════════════════════════════════════════════════════
 * 인장 컬러 — 전통 인주(印朱) 톤
 * ═════════════════════════════════════════════════════════════════ */
const SEAL_COLOR = {
  /** 인주(印朱) 베이스 — 너무 빨갛지 않게 (캡처/인쇄 시 burn 방지) */
  ink: '#A63030',
  /** 골드 inner ring (2순위 이하 귀인용) */
  gold: '#8C6D3D',
} as const;

/* ══════════════════════════════════════════════════════════════════
 * Public API
 * ═════════════════════════════════════════════════════════════════ */

/** 발현된 귀인 중 우선순위 가장 높은 1개 추출 */
export function pickPrimaryGwiin(gilsong: SinsalHit[]): SinsalHit | null {
  if (!gilsong || gilsong.length === 0) return null;
  const ranked = gilsong
    .filter((h) => GWIIN_META[h.name])
    .sort((a, b) => GWIIN_META[a.name].priority - GWIIN_META[b.name].priority);
  return ranked[0] ?? null;
}

export interface GwiinSealProps {
  /** SinsalHit 또는 직접 이름 */
  hit?: SinsalHit | null;
  name?: string;
  /** 인장 사이즈 (px) — 기본 200 */
  size?: number;
  /** 인주 컬러 강제 — 미지정 시 1순위=ink 빨강, 2~4순위=gold */
  forceColor?: 'ink' | 'gold';
}

/**
 * 도장(印) 형태 SVG — 200×200 (자체 결정 사이즈)
 * 자체 SVG 80줄, 추가 의존성 0.
 */
export function GwiinSeal({ hit, name, size = 200, forceColor }: GwiinSealProps) {
  const resolvedName = name || hit?.name || '';
  const meta = GWIIN_META[resolvedName];
  if (!meta) return null;

  const sealColor =
    forceColor === 'gold' ? SEAL_COLOR.gold
    : forceColor === 'ink' ? SEAL_COLOR.ink
    : (meta.priority === 1 ? SEAL_COLOR.ink : SEAL_COLOR.gold);

  // 4글자 2x2 배치 좌표 (viewBox 200×200, 인장 중앙 정렬)
  // 한자 4글자 = 천(좌상) 을(우상) 귀(좌하) 인(우하)
  const fs = size * 0.22; // 한자 폰트 사이즈 (44pt @ size=200)
  const cx = size / 2;
  const cy = size / 2;
  const offsetX = size * 0.13; // 좌우 간격
  const offsetY = size * 0.16; // 위아래 간격

  const chars = meta.hanja.split('');
  const positions = [
    { x: cx - offsetX, y: cy - offsetY }, // 좌상
    { x: cx + offsetX, y: cy - offsetY }, // 우상
    { x: cx - offsetX, y: cy + offsetY }, // 좌하
    { x: cx + offsetX, y: cy + offsetY }, // 우하
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block' }}
      aria-label={`${meta.name} 인장`}
      role="img"
    >
      {/* 외곽 베이스 (인주 면) */}
      <rect
        x={size * 0.05}
        y={size * 0.05}
        width={size * 0.9}
        height={size * 0.9}
        rx={size * 0.06}
        fill={sealColor}
      />

      {/* 내부 외곽선 (이중 테두리 — 외곽) */}
      <rect
        x={size * 0.09}
        y={size * 0.09}
        width={size * 0.82}
        height={size * 0.82}
        rx={size * 0.04}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={size * 0.012}
        opacity={0.85}
      />

      {/* 내부 안쪽 라인 (이중 테두리 — 내부) */}
      <rect
        x={size * 0.13}
        y={size * 0.13}
        width={size * 0.74}
        height={size * 0.74}
        rx={size * 0.02}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={size * 0.005}
        opacity={0.55}
      />

      {/* 4글자 한자 (Noto Serif KR weight 900) */}
      {positions.map((pos, i) => (
        <text
          key={i}
          x={pos.x}
          y={pos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fs}
          fontWeight={900}
          fill="#FFFFFF"
          fontFamily="'Noto Serif KR', serif"
          style={{ letterSpacing: '0.01em' }}
        >
          {chars[i] || ''}
        </text>
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * GwiinSealCard — 인장 + 의미 + 출처 + 발현 위치 통합 카드
 * ═════════════════════════════════════════════════════════════════ */

export interface GwiinSealCardProps {
  /** analyzeSinsal.gilsongGwiin 의 우선 귀인 1개 */
  hit: SinsalHit;
  /** 카드 컨테이너 배경 — paper(default) 또는 surface */
  background?: string;
  /** 인장 사이즈 (default 200) */
  sealSize?: number;
  /** 콤팩트 모드 (export 카톡용) — 의미·출처 짧게 */
  compact?: boolean;
}

export function GwiinSealCard({
  hit,
  background = '#F8F5EE',
  sealSize = 200,
  compact = false,
}: GwiinSealCardProps) {
  const meta = GWIIN_META[hit.name];
  if (!meta) return null;

  const positions = hit.positions
    .map((p) => `${p.pillar}(${p.char})`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(' · ');

  return (
    <div
      style={{
        background,
        border: '1px solid rgba(184,150,90,0.35)',
        borderRadius: 16,
        padding: '20px 18px',
        display: 'flex',
        gap: 18,
        alignItems: 'flex-start',
      }}
    >
      {/* 인장 */}
      <div style={{ flexShrink: 0 }}>
        <GwiinSeal hit={hit} size={sealSize} />
      </div>

      {/* 의미 + 출처 + 위치 */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 11,
            fontWeight: 700,
            color: '#A63030',
            letterSpacing: '0.18em',
            marginBottom: 4,
          }}
        >
          핵심 귀인
        </div>
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 20,
            fontWeight: 700,
            color: '#1A1A1A',
            marginBottom: 2,
            lineHeight: 1.3,
          }}
        >
          {meta.name}
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#7A7269',
              marginLeft: 6,
              letterSpacing: '0.04em',
            }}
          >
            {meta.hanja}
          </span>
        </div>
        <div
          style={{
            fontSize: compact ? 11.5 : 12.5,
            color: '#3D3D3D',
            lineHeight: 1.6,
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          {meta.meaning}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            fontSize: 10.5,
            color: '#7A7269',
            lineHeight: 1.5,
          }}
        >
          <div>
            <span style={{ fontWeight: 700, marginRight: 6 }}>발현</span>
            {positions}
          </div>
          {!compact && (
            <div>
              <span style={{ fontWeight: 700, marginRight: 6 }}>출처</span>
              {meta.source}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 우선 귀인 메타 lookup (export-layout 등 외부에서 한 줄 카피 필요할 때) */
export function getGwiinMeta(name: string): GwiinMeta | null {
  return GWIIN_META[name] ?? null;
}
