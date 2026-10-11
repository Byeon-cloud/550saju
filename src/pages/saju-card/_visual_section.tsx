/**
 * #saju-card-share Stage 7a · L2 시각형 풀이 (슬림 버전)
 *
 * 변경 (Stage 6 → Stage 7a, CDO 결단 2026-04-25 PM):
 *   - 폐지: 오행 레이더 + 십성 도넛 가로 2열 (B 섹션)
 *   - 폐지: 합·충·형·공망 4 카드 grid (D 섹션)
 *   - 폐지: 단일 VisualSection 묶음 export
 *   - 유지: 12운성 사이클 + 핵심 신살 4 카드 + 운의 흐름 진입 링크
 *   - 추가: 각 섹션을 named export 로 분리 → 자세히 영역 단일 스크롤 stack
 *
 * 자세히 영역 새 구조 (탭 폐지):
 *   1. SajuDetailsTable (만세력 정밀, 두산 패턴 — _details_table.tsx)
 *   2. Component12UnseongSection (이 파일)
 *   3. SinsalCardsSection (이 파일)
 *   4. UnFlowEntryLinks (이 파일)
 *
 * 원칙:
 *   - SSOT 톤 (베이지 + 잉크 + 골드)
 *   - 자체 SVG (recharts 회피)
 *   - 데이터 0 변경 (calculator/sinsal/relations 무수정)
 */

import { Component12Unseong, getDayUnseongMeaning, getUnseongDetail } from './_diagrams';
import type { SajuData } from '@/types/saju';
import type { SinsalAnalysis, SinsalHit } from '@/services/saju/sinsal';

const C = {
  paper: '#F8F5EE',
  paperSoft: '#FBF8F1',
  surface: '#FFFFFF',
  ink: '#1A1A1A',
  inkSoft: '#3D3D3D',
  mute: '#7A7269',
  gold: '#B8965A',
  goldDeep: '#8C6D3D',
  goldSoft: 'rgba(184,150,90,0.10)',
  goldLine: 'rgba(184,150,90,0.40)',
  cardLine: 'rgba(184,150,90,0.18)',
  line: '#E5DFD0',
} as const;

const SERIF = "'Noto Serif KR', 'Apple SD Gothic Neo', serif";

/* ══════════════════════════════════════════════════════════════════
 * 1. Component12UnseongSection — 12운성 사이클
 * ═════════════════════════════════════════════════════════════════ */

export interface Component12UnseongSectionProps {
  name: string;
  sajuData: SajuData;
}

export function Component12UnseongSection({
  name,
  sajuData,
}: Component12UnseongSectionProps) {
  const meaning = getDayUnseongMeaning(sajuData.unyoung12 || []);
  const detail = meaning ? getUnseongDetail(meaning.ko) : null;

  return (
    <SectionCard title="12운성 사이클" hanja="運星" intro="태어남부터 정리까지: 인생의 12 단계 흐름.">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          padding: '8px 0 4px',
        }}
      >
        <Component12Unseong unyoung={sajuData.unyoung12 || []} size={260} />
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 13,
              fontWeight: 700,
              color: C.goldDeep,
              letterSpacing: '0.04em',
              marginBottom: 4,
            }}
          >
            {name ? `${name} 님의` : '나의'} 인생 단계
          </div>
          {meaning && (
            <div
              style={{
                fontSize: 13,
                color: C.ink,
                lineHeight: 1.6,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              일주는 <span style={{ color: C.goldDeep, fontWeight: 800 }}>{meaning.ko}</span>
              <span style={{ fontFamily: SERIF, fontSize: 13, color: C.mute, marginLeft: 4 }}>({meaning.hanja})</span>
              에 있어요
            </div>
          )}
          <div style={{ fontSize: 13, color: C.mute, lineHeight: 1.6, fontStyle: 'normal' }}>
            12운성은 사람이 태어나서 자라고 활동하다 정리되는 순환을 12단계로 본 명리학 모델입니다.
            본인의 일주가 어느 단계에 놓였는지에 따라 살아가는 리듬이 다르게 나타납니다.
          </div>
        </div>

        {detail && (
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              marginTop: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* 일상 비유 — 한 줄 핵심 */}
            <div
              style={{
                padding: '12px 14px',
                background: C.goldSoft,
                border: `1px solid ${C.goldLine}`,
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.goldDeep,
                  letterSpacing: '0.06em',
                  marginBottom: 4,
                }}
              >
                일상으로 비유하면
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, lineHeight: 1.55 }}>
                {detail.everyday}
              </div>
            </div>

            {/* 어떻게 살면 좋아요 — 가장 중요 */}
            <div
              style={{
                padding: '14px 16px',
                background: C.surface,
                border: `1px solid ${C.cardLine}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.goldDeep,
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 13.5 }}>道</span>
                <span>이 흐름으로 살아가려면</span>
              </div>
              <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.7 }}>
                {detail.howToLive}
              </div>
            </div>

            {/* 강점 + 주의점 2 column */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div
                style={{
                  padding: '12px 12px',
                  background: C.paperSoft,
                  border: `1px solid ${C.cardLine}`,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.goldDeep,
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
                  강점 長
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
                  {detail.strength}
                </div>
              </div>
              <div
                style={{
                  padding: '12px 12px',
                  background: C.paperSoft,
                  border: `1px solid ${C.cardLine}`,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.goldDeep,
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
                  주의 短
                </div>
                <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
                  {detail.caution}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 2. SinsalCardsSection — 핵심 신살 4 카드 grid
 * ═════════════════════════════════════════════════════════════════ */

const SINSAL_PRIORITY = ['천을귀인', '도화살', '화개살', '역마살', '월덕귀인', '천덕귀인', '문창귀인', '학당귀인'];

const SINSAL_PICTOGRAM: Record<string, (color: string) => React.ReactNode> = {
  // 길성/귀인
  천을귀인: (color) => <Pictogram_Star color={color} />,
  천덕귀인: (color) => <Pictogram_Cloud color={color} />,
  월덕귀인: (color) => <Pictogram_Moon color={color} />,
  문창귀인: (color) => <Pictogram_Brush color={color} />,
  학당귀인: (color) => <Pictogram_Book color={color} />,
  관귀학관: (color) => <Pictogram_Crown color={color} />,
  태극귀인: (color) => <Pictogram_Taegeuk color={color} />,
  // 12신살
  도화살:   (color) => <Pictogram_Flower color={color} />,
  화개살:   (color) => <Pictogram_Lotus color={color} />,
  역마살:   (color) => <Pictogram_Hoof color={color} />,
  장성살:   (color) => <Pictogram_GeneralStar color={color} />,
  반안살:   (color) => <Pictogram_Saddle color={color} />,
  지살:     (color) => <Pictogram_Earth color={color} />,
  망신살:   (color) => <Pictogram_Mask color={color} />,
  겁살:     (color) => <Pictogram_Sword color={color} />,
};

export interface SinsalCardsSectionProps {
  sinsalAnalysis: SinsalAnalysis | null;
}

export function SinsalCardsSection({ sinsalAnalysis }: SinsalCardsSectionProps) {
  if (!sinsalAnalysis) return null;

  // Stage 7e-8: 사용자 결단 — 보유 신살만 노출 (미보유는 카드로 만들지 않음).
  //   0개 발현 시: "이번 사주에 발현된 핵심 신살이 없어요" 안내.
  const allHits: SinsalHit[] = [
    ...sinsalAnalysis.gilsongGwiin,
    ...sinsalAnalysis.shipiSinsal,
    ...sinsalAnalysis.bojo,
  ];
  const seen = new Set<string>();
  const cards: Array<{ name: string; hanja: string; hit: SinsalHit; meaning: string }> = [];

  // 1) 우선순위 (천을귀인 → 도화 → 화개 → 역마 → 월덕 → 천덕 → 문창 → 학당) 먼저
  for (const target of SINSAL_PRIORITY) {
    const hit = allHits.find((h) => h.name === target);
    if (hit && !seen.has(hit.name)) {
      seen.add(hit.name);
      cards.push({ name: hit.name, hanja: hit.hanja, hit, meaning: hit.meaning || '' });
    }
  }
  // 2) 우선순위 외에도 SINSAL_PICTOGRAM 매핑된 신살 추가 (예: 장성/반안/지살/망신/겁살)
  for (const hit of allHits) {
    if (seen.has(hit.name)) continue;
    if (!SINSAL_PICTOGRAM[hit.name]) continue;
    seen.add(hit.name);
    cards.push({ name: hit.name, hanja: hit.hanja, hit, meaning: hit.meaning || '' });
  }

  return (
    <SectionCard
      title="핵심 신살"
      hanja="神煞"
      intro={
        cards.length > 0
          ? `내 사주에 발현된 ${cards.length}개의 신살이에요. 인생의 결과 흐름을 짚어주는 단서입니다.`
          : '이번 사주에 강하게 발현된 핵심 신살이 없어요. 12운성 흐름이 더 또렷하게 작용합니다.'
      }
    >
      {cards.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
          }}
        >
          {cards.map((c, i) => (
            <SinsalCard key={`${c.name}-${i}`} card={c} />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: C.paperSoft,
            border: `1px dashed ${C.cardLine}`,
            borderRadius: 12,
            fontSize: 13.5,
            color: C.mute,
            lineHeight: 1.6,
            fontStyle: 'normal',
          }}
        >
          신살은 사주에 따라 발현 여부가 달라요.
          <br />
          본인 사주는 신살 영향이 약한 대신, 12운성 단계의 흐름이 더 강하게 작용합니다.
        </div>
      )}
    </SectionCard>
  );
}

function SinsalCard({
  card,
}: {
  card: { name: string; hanja: string; hit: SinsalHit; meaning: string };
}) {
  // Stage 7e-8: 보유만 노출 (미보유 케이스 폐지). 항상 골드 톤.
  const has = true;
  const tone = C.gold;
  const toneSoft = C.goldSoft;
  const ko = card.name.replace('살', '');
  const pictogram = SINSAL_PICTOGRAM[card.name];
  const positions = card.hit?.positions
    ? card.hit.positions.map((p) => p.pillar).filter((v, i, a) => a.indexOf(v) === i)
    : [];

  return (
    <div
      style={{
        background: has ? C.paper : C.surface,
        border: `1px solid ${has ? C.goldLine : C.cardLine}`,
        borderRadius: 12,
        padding: '12px 12px 12px',
        minHeight: 168,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        opacity: has ? 1 : 0.78,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 좌측 강조 바 (보유 시) */}
      {has && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: 4,
            background: tone,
          }}
        />
      )}
      {/* 헤더 + 보유/미보유 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: has ? C.ink : C.mute,
              letterSpacing: '-0.01em',
            }}
          >
            {ko}
          </span>
          <span style={{ fontFamily: SERIF, fontSize: 12, color: C.mute, fontWeight: 600 }}>
            ({card.hanja})
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 2,
            background: has ? C.gold : 'rgba(122,114,105,0.12)',
            color: has ? C.paper : C.mute,
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          {has ? '보유' : '미보유'}
        </span>
      </div>
      {/* 픽토그램 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 0',
          background: toneSoft,
          borderRadius: 8,
          height: 60,
        }}
      >
        {pictogram ? pictogram(tone) : <Pictogram_Generic color={tone} />}
      </div>
      {/* 의미 */}
      <div
        style={{
          fontSize: 13,
          color: has ? C.inkSoft : C.mute,
          lineHeight: 1.5,
          fontWeight: 500,
        }}
      >
        {card.meaning || (has ? '발현된 길성' : '해당 없음')}
      </div>
      {/* 위치 */}
      {has && positions.length > 0 && (
        <div
          style={{
            marginTop: 'auto',
            fontSize: 12,
            color: tone,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {positions.join(', ')}
        </div>
      )}
    </div>
  );
}

/* 픽토그램 — 자체 SVG, 모두 ~40px */
function Pictogram_Star({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <path
        d="M21 4 L25.4 16.5 L38 17 L28 25 L31.6 38 L21 30.5 L10.4 38 L14 25 L4 17 L16.6 16.5 Z"
        fill={color}
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
        opacity={0.9}
      />
      <circle cx={21} cy={20} r={3} fill="#FFFFFF" />
    </svg>
  );
}
function Pictogram_Flower({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      {[0, 90, 180, 270].map((angle) => (
        <ellipse
          key={angle}
          cx={21}
          cy={11}
          rx={5.5}
          ry={9}
          fill={color}
          opacity={0.85}
          transform={`rotate(${angle} 21 21)`}
        />
      ))}
      <circle cx={21} cy={21} r={4} fill="#FFFFFF" stroke={color} strokeWidth={1.2} />
    </svg>
  );
}
function Pictogram_Lotus({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <circle cx={21} cy={21} r={14} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
      <circle cx={21} cy={21} r={9} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
      <circle cx={21} cy={21} r={4} fill={color} />
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx={21}
          cy={11}
          rx={2.5}
          ry={5}
          fill={color}
          opacity={0.6}
          transform={`rotate(${angle} 21 21)`}
        />
      ))}
    </svg>
  );
}
function Pictogram_Hoof({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <path
        d="M11 30 Q11 12 21 12 Q31 12 31 30 L26 30 Q26 18 21 18 Q16 18 16 30 Z"
        fill={color}
        opacity={0.9}
      />
      <line x1={11} y1={32} x2={31} y2={32} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
function Pictogram_Generic({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <circle cx={21} cy={21} r={14} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
      <circle cx={21} cy={21} r={6} fill={color} opacity={0.9} />
    </svg>
  );
}
/* 천덕귀인 — 구름 (하늘의 덕) */
function Pictogram_Cloud({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <path
        d="M10 28 Q5 28 5 23 Q5 18 11 18 Q12 13 17 13 Q22 13 23 18 Q28 17 30 22 Q36 22 36 27 Q36 31 31 31 L11 31 Q9 31 10 28 Z"
        fill={color}
        opacity={0.85}
      />
      <circle cx={26} cy={11} r={2.5} fill={color} opacity={0.5} />
      <circle cx={31} cy={9} r={1.5} fill={color} opacity={0.4} />
    </svg>
  );
}
/* 월덕귀인 — 초승달 (달의 덕) */
function Pictogram_Moon({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <path
        d="M28 7 A14 14 0 1 0 28 35 A11 11 0 1 1 28 7 Z"
        fill={color}
        opacity={0.9}
      />
      <circle cx={11} cy={13} r={1.4} fill={color} opacity={0.5} />
      <circle cx={8} cy={28} r={1.2} fill={color} opacity={0.4} />
      <circle cx={14} cy={32} r={1} fill={color} opacity={0.4} />
    </svg>
  );
}
/* 문창귀인 — 붓 (문서/학문) */
function Pictogram_Brush({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      {/* 붓 손잡이 */}
      <rect x={19} y={10} width={4} height={18} rx={1.5} fill={color} opacity={0.85} />
      {/* 붓털 */}
      <path
        d="M17 28 L25 28 L24 36 Q21 38 18 36 Z"
        fill={color}
        opacity={0.95}
      />
      {/* 손잡이 위 장식 */}
      <ellipse cx={21} cy={9} rx={3.5} ry={1.5} fill={color} opacity={0.6} />
    </svg>
  );
}
/* 학당귀인 — 책 (학문) */
function Pictogram_Book({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <path
        d="M7 11 L21 14 L35 11 L35 30 L21 33 L7 30 Z"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        opacity={0.85}
      />
      <line x1={21} y1={14} x2={21} y2={33} stroke={color} strokeWidth={1.6} opacity={0.9} />
      <path d="M11 18 L17 19" stroke={color} strokeWidth={1.2} opacity={0.5} />
      <path d="M11 22 L17 23" stroke={color} strokeWidth={1.2} opacity={0.5} />
      <path d="M25 19 L31 18" stroke={color} strokeWidth={1.2} opacity={0.5} />
      <path d="M25 23 L31 22" stroke={color} strokeWidth={1.2} opacity={0.5} />
    </svg>
  );
}
/* 관귀학관 — 관(冠) */
function Pictogram_Crown({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      {/* 관 본체 */}
      <path
        d="M8 28 L8 18 L14 22 L21 12 L28 22 L34 18 L34 28 Z"
        fill={color}
        opacity={0.9}
      />
      {/* 보석 */}
      <circle cx={14} cy={22} r={1.8} fill="#FFFFFF" opacity={0.85} />
      <circle cx={21} cy={17} r={2.2} fill="#FFFFFF" opacity={0.9} />
      <circle cx={28} cy={22} r={1.8} fill="#FFFFFF" opacity={0.85} />
      {/* 받침대 */}
      <rect x={7} y={29} width={28} height={3} rx={1} fill={color} opacity={0.7} />
    </svg>
  );
}
/* 태극귀인 — 태극 (음양) */
function Pictogram_Taegeuk({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <circle cx={21} cy={21} r={14} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />
      <path
        d="M21 7 A14 14 0 0 1 21 35 A7 7 0 0 0 21 21 A7 7 0 0 1 21 7 Z"
        fill={color}
        opacity={0.85}
      />
      <circle cx={21} cy={14} r={2} fill="#FFFFFF" />
      <circle cx={21} cy={28} r={2} fill={color} />
    </svg>
  );
}
/* 장성살 — 장군의 별 (큰 별 + 칼 모티프) */
function Pictogram_GeneralStar({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      {/* 6각 별 */}
      <path
        d="M21 5 L24 16 L35 16 L26 23 L29 34 L21 27 L13 34 L16 23 L7 16 L18 16 Z"
        fill={color}
        opacity={0.9}
      />
      <circle cx={21} cy={21} r={3.5} fill="#FFFFFF" />
    </svg>
  );
}
/* 반안살 — 안장 (말 안장) */
function Pictogram_Saddle({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <path
        d="M8 22 Q12 14 21 14 Q30 14 34 22 Q34 28 30 30 L12 30 Q8 28 8 22 Z"
        fill={color}
        opacity={0.85}
      />
      <path d="M21 14 L21 30" stroke="#FFFFFF" strokeWidth={1.2} opacity={0.7} />
      <ellipse cx={21} cy={22} rx={5} ry={3} fill="none" stroke="#FFFFFF" strokeWidth={1} opacity={0.6} />
    </svg>
  );
}
/* 지살 — 땅/대지 */
function Pictogram_Earth({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <rect x={7} y={24} width={28} height={10} rx={2} fill={color} opacity={0.85} />
      <path d="M7 24 Q12 20 17 22 Q22 24 27 21 Q32 19 35 24" fill="none" stroke={color} strokeWidth={2} opacity={0.7} />
      <circle cx={13} cy={29} r={1} fill="#FFFFFF" opacity={0.6} />
      <circle cx={22} cy={31} r={1} fill="#FFFFFF" opacity={0.6} />
      <circle cx={29} cy={29} r={1} fill="#FFFFFF" opacity={0.6} />
    </svg>
  );
}
/* 망신살 — 가면 (감춰진 얼굴) */
function Pictogram_Mask({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      <ellipse cx={21} cy={21} rx={13} ry={11} fill={color} opacity={0.85} />
      <ellipse cx={15} cy={20} rx={2.2} ry={1.4} fill="#FFFFFF" />
      <ellipse cx={27} cy={20} rx={2.2} ry={1.4} fill="#FFFFFF" />
      <path d="M16 27 Q21 30 26 27" stroke="#FFFFFF" strokeWidth={1.2} fill="none" opacity={0.7} />
    </svg>
  );
}
/* 겁살 — 칼 (위협, 단절) */
function Pictogram_Sword({ color }: { color: string }) {
  return (
    <svg width={42} height={42} viewBox="0 0 42 42" aria-hidden>
      {/* 칼날 */}
      <path d="M19 6 L23 6 L22 26 L20 26 Z" fill={color} opacity={0.85} />
      {/* 가드 */}
      <rect x={14} y={26} width={14} height={2.5} rx={1} fill={color} opacity={0.95} />
      {/* 손잡이 */}
      <rect x={19.5} y={28} width={3} height={6} fill={color} opacity={0.7} />
      <circle cx={21} cy={36} r={2} fill={color} opacity={0.85} />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 3. UnFlowEntryLinks — 운의 흐름 진입 링크 (대운/월운)
 * ═════════════════════════════════════════════════════════════════ */
export interface UnFlowEntryLinksProps {
  onMoreDaeun?: () => void;
  onMoreMonthly?: () => void;
}

export function UnFlowEntryLinks({
  onMoreDaeun,
  onMoreMonthly,
}: UnFlowEntryLinksProps) {
  if (!onMoreDaeun && !onMoreMonthly) return null;
  return (
    <SectionCard title="운의 흐름" hanja="運勢" intro="시간이 만드는 또 하나의 사주: 대운(10년), 월운(12개월).">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {onMoreDaeun && (
          <button type="button" onClick={onMoreDaeun} style={linkBtnStyle}>
            대운 자세히 보기 (10년 단위)
            <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 900, color: C.gold }}>→</span>
          </button>
        )}
        {onMoreMonthly && (
          <button type="button" onClick={onMoreMonthly} style={linkBtnStyle}>
            월운 자세히 보기 (12개월)
            <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 900, color: C.gold }}>→</span>
          </button>
        )}
      </div>
    </SectionCard>
  );
}

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 14px',
  background: '#FFFFFF',
  border: `1px solid ${C.goldLine}`,
  borderRadius: 10,
  fontSize: 13.5,
  fontWeight: 700,
  color: C.goldDeep,
  cursor: 'pointer',
  letterSpacing: '0.02em',
  width: '100%',
  textAlign: 'left',
};

/* ══════════════════════════════════════════════════════════════════
 * 공통 SectionCard
 * ═════════════════════════════════════════════════════════════════ */
function SectionCard({
  title,
  hanja,
  intro,
  children,
}: {
  title: string;
  hanja: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.cardLine}`,
        borderRadius: 14,
        padding: '14px 14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginBottom: intro ? 4 : 10,
          paddingBottom: 6,
          borderBottom: `1px dotted ${C.cardLine}`,
        }}
      >
        <span style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 800, color: C.goldDeep }}>{title}</span>
        <span style={{ fontSize: 13, color: C.mute, fontFamily: SERIF }}>{hanja}</span>
      </div>
      {intro && (
        <div style={{ fontSize: 13, color: C.mute, marginBottom: 10, lineHeight: 1.5, fontStyle: 'normal' }}>
          {intro}
        </div>
      )}
      {children}
    </div>
  );
}
