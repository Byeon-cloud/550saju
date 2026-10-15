/**
 * #saju-card-share Round 2 · Export 전용 layout (3 모드 풍부함 ↑↑↑)
 *
 * Round 2 변경 (바이럴 직결):
 *  · 천을귀인 인장(印章) 강조 — 발현 시 1~3 모드 모두 노출 (시그니처)
 *  · 시적 풀이(hint) 메인으로 격상 (이전: 별명 메인 → 변경: 시적 풀이 메인)
 *  · 8글자 천간/지지 명확 분리 + 십성 컬러 적용 (sipsungColor SSOT)
 *  · 핵심 신살 카드 (귀인/길성 우선) + 한 줄 풀이
 *
 * 3 모드:
 *  · 'instagram-1x1' (1080×1080) — 인스타 피드, 정사각
 *      ┌─ 상단 (220pt): 시적 풀이 + "기유(己酉) 일주" 라벨
 *      ├─ 중앙 (550pt): 8글자 그리드 (4 기둥, 일주 1.3배 강조)
 *      ├─ 우상단 corner (180×180): 천을귀인 인장 (발현 시)
 *      └─ 하단 (310pt): 핵심 신살 1~2 + 로고 + CTA
 *
 *  · 'instagram-9x16' (1080×1920) — 인스타 스토리
 *      ┌─ 상단 (450pt): 시적 풀이 + 일주 한자 워터마크 + 그라디언트
 *      ├─ 중앙 1 (480pt): 8글자 그리드
 *      ├─ 중앙 2 (300pt): 천을귀인 인장 240×240 + 의미 + 출처
 *      ├─ 중앙 3 (380pt): 핵심 신살 3 (귀인/길성/흉살)
 *      └─ 하단 (310pt): 시적 풀이 다시 + 로고 + CTA
 *
 *  · 'kakao-share' (1200×630) — 카톡 unfurl
 *      ┌ 좌측 (600pt): 시적 풀이 + 일주 한자 워터마크 + 그라디언트
 *      └ 우측 (600pt): 천을귀인 인장 200 + 8글자 mini + 로고 + CTA
 *
 * 빠지는 정보 (Export 한정):
 *  · 지장간 (디테일 과잉)
 *  · 12운성 사이클 다이어그램 (큼)
 *  · 합/충/형/공망 chip list (빽빽)
 *  · 양력/음력/시간 (작은 글씨로만)
 *
 * 한자 폰트 fallback 0:
 *  · 모든 한자 Noto Serif KR 명시
 *  · 캡처 전 RAF + document.fonts.ready + 60ms 대기 (호출자 책임)
 */

import type { OhengType, Pillar, SajuData, SajuInput } from '@/types/saju';
import type { IljuAnimal } from '@/constants/iljuAnimal';
import type { SinsalHit } from '@/services/saju/sinsal';
import { OHENG_THEME, type OhengTheme } from './_chrome';
import { lookupSipsung } from '@/constants/sipsungColor';
import { GwiinSeal, getGwiinMeta } from './_gwiin_seal';
// Round 3 — 운의 흐름 mini
import { MiniFlow } from './_flow_table';
// Stage 4 보강 — 60갑자 직관적 풀이 (export 모드 톤 정렬)
import { getIljuMeaning } from '@/constants/iljuMeaning';
import { isAppintosBuild } from '@/lib/env';

/** 이미지 아래 출처 표기 — 앱(토스)에서 만든 이미지엔 웹 주소를 찍지 않는다 (앱 밖 유도 표기 방지, 2026-10-15) */
const BRAND_STAMP = isAppintosBuild ? '사주500' : 'saju500.app';
const BRAND_STAMP_FULL = isAppintosBuild ? '사주500' : '사주500  saju500.app';

const OHENG_HEX: Record<OhengType, string> = {
  목: '#4E7A57', 화: '#B04A38', 토: '#B07F38', 금: '#7D7870', 수: '#3E5F82',
};

export type ExportMode = 'instagram-1x1' | 'instagram-9x16' | 'kakao-share';

export interface ExportLayoutSpec {
  width: number;
  height: number;
}

export const EXPORT_SPECS: Record<ExportMode, ExportLayoutSpec> = {
  'instagram-1x1':  { width: 1080, height: 1080 },
  'instagram-9x16': { width: 1080, height: 1920 },
  'kakao-share':    { width: 1200, height: 630 },
};

const SERIF = "'Noto Serif KR', 'Apple SD Gothic Neo', serif";
const SANS = "'Pretendard', 'Noto Sans KR', system-ui, sans-serif";

/* ══════════════════════════════════════════════════════════════════
 * Public — SajuCardExportLayout
 * ═════════════════════════════════════════════════════════════════ */

export interface SajuCardExportLayoutProps {
  mode: ExportMode;
  name: string;
  ilju: string;
  iljuKo: string;
  animal: IljuAnimal | null;
  dayOheng: OhengType;
  sajuData: SajuData;
  /** Round 3 — birthYear (mini flow 의 현재 대운 추출용) */
  input: SajuInput;
  /** 핵심 신살 SinsalHit */
  primaryGwiin?: SinsalHit | null;
  /** 핵심 길성/흉살 hits — 1~3개 */
  keySinsals?: SinsalHit[];
  birthLabel: string;
}

export function SajuCardExportLayout(props: SajuCardExportLayoutProps) {
  const { mode } = props;
  const theme = OHENG_THEME[props.dayOheng];

  if (mode === 'kakao-share') return <KakaoLayout {...props} theme={theme} />;
  if (mode === 'instagram-9x16') return <StoryLayout {...props} theme={theme} />;
  return <FeedLayout {...props} theme={theme} />;
}

/* ══════════════════════════════════════════════════════════════════
 * Helpers
 * ═════════════════════════════════════════════════════════════════ */

interface CharCellSpec {
  /** 폰트 사이즈 (한자) */
  fs: number;
  /** 셀 패딩 */
  pad: number;
  /** 라벨/sip 폰트 */
  fsLabel: number;
  /** 12운성 폰트 */
  fsUnyung: number;
}

/** 8글자 그리드 — Round 2: 천간/지지 분리 + 십성 컬러 + 12운성 */
function EightCharGridExport({
  pillars,
  sipsung,
  unyoung12,
  spec,
}: {
  pillars: Pillar[];
  sipsung: Array<{ position: string; 십성: string }>;
  unyoung12: Array<{ position: string; 운성: string }>;
  spec: CharCellSpec;
}) {
  const order = [3, 2, 1, 0];
  const labelsHanja = ['時', '日', '月', '年'];
  const ganKeys = ['년간', '월간', '일간', '시간'];
  const zhiKeys = ['년지', '월지', '일지', '시지'];

  const pickSip = (idx: number, channel: 'gan' | 'zhi') => {
    const key = channel === 'gan' ? ganKeys[idx] : zhiKeys[idx];
    return sipsung.find((s) => s.position === key)?.십성 || '';
  };
  const pickUnyung = (idx: number) =>
    unyoung12.find((u) => u.position === zhiKeys[idx])?.운성 || '';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: spec.pad * 0.5,
      }}
    >
      {order.map((idx, i) => {
        const p = pillars[idx];
        const isDay = idx === 2;
        const ganSip = isDay ? '日主' : pickSip(idx, 'gan');
        const zhiSip = pickSip(idx, 'zhi');
        const unyung = pickUnyung(idx);
        const ganColor = p?.천간오행 ? OHENG_HEX[p.천간오행 as OhengType] : '#999';
        const zhiColor = p?.지지오행 ? OHENG_HEX[p.지지오행 as OhengType] : '#999';
        const ganSipMeta = lookupSipsung(ganSip);
        const zhiSipMeta = lookupSipsung(zhiSip);

        return (
          <div
            key={i}
            style={{
              background: isDay ? 'rgba(184,150,90,0.10)' : '#FFFFFF',
              border: isDay ? '3px solid #B8965A' : '1px solid rgba(184,150,90,0.22)',
              borderRadius: 16,
              padding: `${spec.pad}px ${spec.pad * 0.4}px`,
              textAlign: 'center',
              boxShadow: isDay ? '0 4px 18px rgba(184,150,90,0.20)' : 'none',
              transform: isDay ? 'scale(1.04)' : 'scale(1)',
              transformOrigin: 'center',
            }}
          >
            {/* 라벨 */}
            <div
              style={{
                fontSize: spec.fsLabel * 1.0,
                fontWeight: 700,
                color: isDay ? '#8C6D3D' : '#6F6557',
                letterSpacing: '0.05em',
                marginBottom: spec.pad * 0.6,
              }}
            >
              {labelsHanja[i]}
            </div>

            {p?.available !== false ? (
              <>
                {/* 천간 */}
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: spec.fs * (isDay ? 1.15 : 1.0),
                    fontWeight: 700,
                    color: ganColor,
                    lineHeight: 1.0,
                  }}
                >
                  {p?.천간}
                </div>
                <div
                  style={{
                    fontSize: spec.fsLabel * 0.85,
                    color: '#6F6557',
                    marginTop: spec.pad * 0.2,
                    lineHeight: 1.3,
                  }}
                >
                  {p?.천간읽기}
                </div>
                {/* 십성 chip (천간) */}
                {ganSipMeta && !isDay && (
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: spec.pad * 0.3,
                      padding: `${spec.pad * 0.2}px ${spec.pad * 0.5}px`,
                      borderRadius: 999,
                      lineHeight: 1.5,
                      background: `${ganSipMeta.color}1A`,
                      color: ganSipMeta.color,
                      fontSize: spec.fsLabel * 0.95,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {ganSipMeta.hanja.length === 2 ? ganSipMeta.hanja : ganSip.split('/')[0]}
                  </div>
                )}
                {isDay && (
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: spec.pad * 0.3,
                      padding: `${spec.pad * 0.2}px ${spec.pad * 0.5}px`,
                      borderRadius: 999,
                      lineHeight: 1.5,
                      background: '#1A1A1A',
                      color: '#F8F5EE',
                      fontSize: spec.fsLabel * 0.9,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      marginBottom: spec.pad * 0.3,
                    }}
                  >
                    日主 나
                  </div>
                )}

                {/* divider */}
                <div
                  style={{
                    height: 1,
                    background: 'rgba(184,150,90,0.30)',
                    margin: `${spec.pad * 0.6}px 0`,
                  }}
                />

                {/* 지지 */}
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: spec.fs * (isDay ? 1.15 : 1.0),
                    fontWeight: 700,
                    color: zhiColor,
                    lineHeight: 1.0,
                  }}
                >
                  {p?.지지}
                </div>
                <div
                  style={{
                    fontSize: spec.fsLabel * 0.85,
                    color: '#6F6557',
                    marginTop: spec.pad * 0.2,
                    lineHeight: 1.3,
                  }}
                >
                  {p?.지지읽기}
                </div>
                {zhiSipMeta && (
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: spec.pad * 0.3,
                      padding: `${spec.pad * 0.2}px ${spec.pad * 0.5}px`,
                      borderRadius: 999,
                      lineHeight: 1.5,
                      background: `${zhiSipMeta.color}1A`,
                      color: zhiSipMeta.color,
                      fontSize: spec.fsLabel * 0.95,
                      fontWeight: 700,
                    }}
                  >
                    {zhiSipMeta.hanja.length === 2 ? zhiSipMeta.hanja : zhiSip.split('/')[0]}
                  </div>
                )}

                {/* 12운성 */}
                {unyung && (
                  <div
                    style={{
                      fontSize: spec.fsUnyung,
                      color: '#6F6557',
                      marginTop: spec.pad * 0.4,
                      fontFamily: SERIF,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {unyung}
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  fontSize: spec.fsLabel,
                  color: '#999',
                  fontStyle: 'normal',
                  padding: `${spec.pad * 2}px 0`,
                }}
              >
                시간 모름
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 핵심 신살 chip — 한 줄 풀이 포함 */
function KeySinsalChip({
  hit,
  fontSize = 18,
  compact = false,
}: {
  hit: SinsalHit;
  fontSize?: number;
  compact?: boolean;
}) {
  const toneColor =
    hit.category === 'gilsin' ? '#B8965A'
    : hit.category === 'hyungsal' ? '#A63030'
    : '#6F6557';
  const toneSoft =
    hit.category === 'gilsin' ? 'rgba(184,150,90,0.08)'
    : hit.category === 'hyungsal' ? 'rgba(166,48,48,0.06)'
    : 'rgba(122,114,105,0.06)';

  return (
    <div
      style={{
        background: toneSoft,
        border: `1.5px solid ${toneColor}55`,
        borderRadius: 12,
        padding: `${fontSize * 0.6}px ${fontSize * 0.9}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: fontSize * 0.25,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: fontSize * 0.4 }}>
        <span
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: fontSize * 1.3,
            color: toneColor,
          }}
        >
          {hit.name}
        </span>
        <span style={{ fontSize: fontSize * 0.85, color: '#6F6557', fontFamily: SERIF }}>
          {hit.hanja}
        </span>
      </div>
      {!compact && hit.meaning && (
        <div
          style={{
            fontSize: fontSize * 0.95,
            color: '#3D3D3D',
            lineHeight: 1.55,
          }}
        >
          {hit.meaning}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * MODE 3: KakaoLayout — 1200×630
 * ═════════════════════════════════════════════════════════════════ */
function KakaoLayout({
  theme,
  name,
  ilju,
  iljuKo,
  animal,
  sajuData,
  input,
  primaryGwiin,
  birthLabel,
}: SajuCardExportLayoutProps & { theme: OhengTheme }) {
  // Stage 4 SSOT 보존: 베이지 베이스 + 일간 오행 액센트 (다크 네이비 톤 reject)
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        position: 'relative',
        background: '#FBF8F1', // 2026-10-13 v9 — 아래로 번지는 오행색 대신 종이 한 장
        boxSizing: 'border-box',
        fontFamily: SANS,
        overflow: 'hidden',
      }}
    >
      {/* accent halo 좌상단 — opacity ↓ (사주500 신비 + 고급 톤) */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: -120,
          top: -120,
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'none', // 2026-10-13 v9 — 빛번짐 제거
        }}
      />

      {/* 거대 일주 한자 워터마크 우측 — accent 매우 흐릿 */}
      <span
        aria-hidden
        style={{
          display: 'none', // 2026-10-11 v9 — 큰 한자 워터마크 제거 (화면과 같게)
          position: 'absolute',
          right: 420,
          bottom: -160,
          fontFamily: SERIF,
          fontSize: 520,
          fontWeight: 900,
          color: theme.accent,
          opacity: 0.07,
          lineHeight: 0.85,
          pointerEvents: 'none',
          letterSpacing: '-0.04em',
        }}
      >
        {ilju.charAt(1) || theme.watermarkHanja}
      </span>

      {/* 좌측: 정체성 카드 톤 — 잉크 메인 + accent 스트로크 */}
      <div
        style={{
          position: 'absolute',
          left: 56,
          top: 36,
          bottom: 36,
          width: 580,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#1A1A1A',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              background: '#8C6D3D',
              color: '#F8F5EE',
              padding: '6px 14px',
              borderRadius: 999,
              fontFamily: SERIF,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '0.18em',
              boxShadow: `0 4px 12px rgba(140,109,61,0.25)`,
            }}
          >
            사주500
          </span>
          <span
            style={{
              background: 'rgba(184,150,90,0.10)',
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              color: '#8C6D3D',
              border: `1px solid rgba(184,150,90,0.40)`,
            }}
          >
            만세력 카드
          </span>
        </div>

        {/* Stage 4 보강: 거대 일주 한자 — 잉크 단순 (outline 제거 + 자연스러운 톤) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 132,
              fontWeight: 800,
              lineHeight: 0.92,
              letterSpacing: '0.04em',
              color: '#1A1A1A',
              textShadow: `0 4px 16px ${theme.accent}1F, 0 2px 4px rgba(0,0,0,0.06)`,
            }}
          >
            {ilju || '命'}
          </span>
          <div style={{ flex: 1, paddingBottom: 14, minWidth: 0 }}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 14,
                fontWeight: 700,
                color: theme.accent,
                letterSpacing: '0.18em',
                marginBottom: 4,
              }}
            >
              日柱 {iljuKo}
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 24,
                fontWeight: 800,
                color: '#1A1A1A',
                letterSpacing: '-0.005em',
                lineHeight: 1.2,
              }}
            >
              {(() => {
                const m = getIljuMeaning(ilju);
                return m?.identity || `${name} 님의 사주`;
              })()}
            </div>
            {(() => {
              const m = getIljuMeaning(ilju);
              return m?.personality ? (
                <div style={{ fontSize: 11, color: theme.accent, marginTop: 4, fontWeight: 600, letterSpacing: '0.04em' }}>
                  {m.personality}
                </div>
              ) : null;
            })()}
            <div style={{ fontSize: 12, color: '#6F6557', marginTop: 4 }}>
              {birthLabel}
            </div>
          </div>
        </div>

        {/* Stage 4 보강: 직관적 풀이 (시적 → 명료) — 화이트 카드 + accent borderLeft */}
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 17,
            fontWeight: 500,
            lineHeight: 1.55,
            color: '#1A1A1A',
            padding: 3,
            background: '#FFFFFF',
            border: '1.5px solid rgba(26,22,18,0.6)',
            borderRadius: 2,
          }}
        >
          <div style={{ border: '1px solid rgba(26,22,18,0.22)', padding: '12px 16px' }}>
            {(() => {
              const m = getIljuMeaning(ilju);
              return (m ? `${m.identity}, ${m.description.replace(/\n/g, ' ')}` : null) || animal?.hint || `${name} 님의 사주 카드를 받아보세요`;
            })()}
          </div>
        </div>

        {/* CTA — 골드 deep solid (사주500 시그니처) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            background: '#8C6D3D',
            color: '#F8F5EE',
            padding: '14px 22px',
            borderRadius: 12,
            fontFamily: SERIF,
            fontSize: 18,
            fontWeight: 800,
            alignSelf: 'flex-start',
            letterSpacing: '-0.005em',
            boxShadow: `0 8px 20px rgba(140,109,61,0.30)`,
          }}
        >
          1운부터 이 사주 풀이 받기
          <span style={{ fontSize: 22, fontWeight: 900, color: '#B8965A' }}>→</span>
        </div>
      </div>

      {/* Stage 4 SSOT: 우측 화이트 카드 (베이지 배경 위 강한 그림자) */}
      <div
        style={{
          position: 'absolute',
          right: 36,
          top: 36,
          bottom: 36,
          width: 540,
          background: '#FFFFFF',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: primaryGwiin ? 'space-between' : 'center',
          gap: 16,
          boxSizing: 'border-box',
          boxShadow: `0 12px 36px rgba(184,150,90,0.18), 0 0 0 1px rgba(184,150,90,0.30)`,
        }}
      >
        {/* 천을귀인 인장 (있으면) */}
        {primaryGwiin && (() => {
          const meta = getGwiinMeta(primaryGwiin.name);
          return (
            <div style={{ textAlign: 'center' }}>
              <GwiinSeal hit={primaryGwiin} size={140} />
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#A63030',
                  letterSpacing: '0.18em',
                  marginTop: 8,
                }}
              >
                핵심 귀인
              </div>
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#1A1A1A',
                  marginTop: 2,
                }}
              >
                {meta?.name || primaryGwiin.name}
                <span
                  style={{
                    fontSize: 11,
                    color: '#6F6557',
                    marginLeft: 6,
                    fontWeight: 500,
                  }}
                >
                  {primaryGwiin.hanja}
                </span>
              </div>
            </div>
          );
        })()}

        {/* 8글자 mini */}
        <div style={{ width: '100%' }}>
          <EightCharGridExport
            pillars={sajuData.pillars}
            sipsung={sajuData.sipsung}
            unyoung12={sajuData.unyoung12 || []}
            spec={{ fs: 32, pad: 8, fsLabel: 9, fsUnyung: 9 }}
          />
        </div>

        {/* Round 3 — 운의 흐름 mini (대운+세운+월운) */}
        <div style={{ width: '100%' }}>
          <MiniFlow sajuData={sajuData} birthYear={input.birthYear} layout="compact" />
        </div>

        {/* 도메인 */}
        <div
          style={{
            fontSize: 13,
            color: '#6F6557',
            letterSpacing: '0.08em',
            fontWeight: 500,
          }}
        >
          {BRAND_STAMP}
        </div>
      </div>

      {/* Stage 4 SSOT 골드 outline */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 28,
          top: 28,
          right: 28,
          bottom: 28,
          border: `1px solid rgba(184,150,90,0.35)`,
          borderRadius: 16,
          pointerEvents: 'none',
        }}
      />

      {/* underline accent */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 56,
          width: 60,
          height: 3,
          background: theme.accent,
          top: 110,
          opacity: 0.85,
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * MODE 1: FeedLayout — 1080×1080
 *  · 상단 시적 풀이 / 중앙 8글자 / 우상단 인장 / 하단 신살 + CTA
 * ═════════════════════════════════════════════════════════════════ */
function FeedLayout({
  theme,
  name,
  ilju,
  iljuKo,
  animal,
  dayOheng,
  sajuData,
  input,
  primaryGwiin,
  keySinsals = [],
  birthLabel,
}: SajuCardExportLayoutProps & { theme: OhengTheme }) {
  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        background: '#F8F5EE',
        position: 'relative',
        boxSizing: 'border-box',
        fontFamily: SANS,
        overflow: 'hidden',
      }}
    >
      {/* 상단 220pt — 시적 풀이 + 일주 라벨 */}
      <div
        style={{
          height: 240,
          // 2026-10-11 — 앱 화면 머리(먹)와 같게. 오행 색은 아래 얇은 선으로만
          background: '#1A1612', // 2026-10-13 v9 — 먹 단색
          borderBottom: `4px solid ${theme.accent}`,
          padding: '40px 60px',
          color: '#F5EDDF',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'none', // 2026-10-11 v9 — 큰 한자 워터마크 제거 (화면과 같게)
            position: 'absolute',
            right: -40,
            bottom: -80,
            fontFamily: SERIF,
            fontSize: 320,
            fontWeight: 900,
            color: 'rgba(255,255,255,0.07)',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {ilju.charAt(1) || theme.watermarkHanja}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, letterSpacing: '0.3em' }}>
            사주500
          </span>
          <span
            style={{
              background: 'rgba(255,255,255,0.18)',
              padding: '4px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            만세력 카드
          </span>
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: 32,
            lineHeight: 1.45,
            margin: '20px 0 12px',
            position: 'relative',
            maxWidth: 840,
          }}
        >
          {/* Stage 4 보강: 직관적 풀이 (시적 → 명료) */}
          {(() => {
            const m = getIljuMeaning(ilju);
            return (m ? `${m.identity}, ${m.description.replace(/\n/g, ' ')}` : null) || animal?.hint || `${name} 님의 사주 카드`;
          })()}
        </h1>
        <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, opacity: 0.92, position: 'relative' }}>
          {ilju} <span style={{ opacity: 0.78 }}>({iljuKo})</span> 일주, {' '}
          <span style={{ fontSize: 14, opacity: 0.78 }}>
            {(() => {
              const m = getIljuMeaning(ilju);
              return m?.personality || dayOheng + ' 일간';
            })()}
          </span>
        </div>
      </div>

      {/* 우상단 인장 (발현 시) */}
      {primaryGwiin && (
        <div
          style={{
            position: 'absolute',
            top: 270,
            right: 50,
            zIndex: 2,
          }}
        >
          <GwiinSeal hit={primaryGwiin} size={160} />
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 11,
              fontWeight: 700,
              color: '#A63030',
              letterSpacing: '0.15em',
              marginTop: 6,
              textAlign: 'center',
            }}
          >
            {primaryGwiin.name}
          </div>
        </div>
      )}

      {/* 중앙 550pt — 8글자 그리드 */}
      <div
        style={{
          padding: `26px 60px ${primaryGwiin ? '16px' : '30px'}`,
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 18,
            fontWeight: 700,
            color: '#8C6D3D',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          四柱八字 사주 8글자
        </div>
        <EightCharGridExport
          pillars={sajuData.pillars}
          sipsung={sajuData.sipsung}
          unyoung12={sajuData.unyoung12 || []}
          spec={{ fs: 56, pad: 14, fsLabel: 16, fsUnyung: 13 }}
        />

        {/* Round 3 — 운의 흐름 mini (대운+세운+월운 — 현재 1칸씩) */}
        <div style={{ marginTop: 14 }}>
          <MiniFlow sajuData={sajuData} birthYear={input.birthYear} />
        </div>
      </div>

      {/* 하단 신살 + CTA */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '24px 60px 50px',
          background: '#F8F5EE',
        }}
      >
        {keySinsals.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 24,
              flexWrap: 'wrap',
            }}
          >
            {keySinsals.slice(0, 2).map((hit, i) => (
              <div key={i} style={{ flex: '1 1 48%', minWidth: 0 }}>
                <KeySinsalChip hit={hit} fontSize={14} />
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 14,
                fontWeight: 700,
                color: '#8C6D3D',
                letterSpacing: '0.18em',
                marginBottom: 4,
              }}
            >
              사주500
            </div>
            <div style={{ fontSize: 13, color: '#6F6557' }}>
              정통 명리학 사주 풀이, {birthLabel}
            </div>
          </div>
          <div
            style={{
              background: '#1A1A1A',
              color: '#F8F5EE',
              padding: '14px 22px',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            사주500 앱에서 1운부터 보기
            <span style={{ color: '#B8965A' }}>→</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * MODE 2: StoryLayout — 1080×1920
 *  · 상단 시적 풀이 / 8글자 / 인장 큰 / 핵심 신살 3 / 푸터
 * ═════════════════════════════════════════════════════════════════ */
function StoryLayout({
  theme,
  name,
  ilju,
  iljuKo,
  animal,
  dayOheng,
  sajuData,
  input,
  primaryGwiin,
  keySinsals = [],
}: SajuCardExportLayoutProps & { theme: OhengTheme }) {
  // Stage 4 SSOT 보존: 베이지 베이스 + 거대 한자 (240pt) 잉크 메인 + accent stroke (정체성 카드 톤)
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        background: '#FBF8F1', // 2026-10-13 v9 — 아래로 번지는 오행색 대신 종이 한 장
        position: 'relative',
        boxSizing: 'border-box',
        fontFamily: SANS,
        overflow: 'hidden',
      }}
    >
      {/* Stage 4 Hero band — 720pt SSOT 베이지 + accent halo */}
      <div
        style={{
          height: 650,
          background: '#FBF8F1',
          padding: '70px 70px 50px',
          color: '#1A1A1A',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: `1px solid rgba(184,150,90,0.30)`,
        }}
      >
        {/* 거대 일주 한자 워터마크 (640pt) — 우하단 accent 매우 흐릿 */}
        <span
          aria-hidden
          style={{
            display: 'none', // 2026-10-11 v9 — 큰 한자 워터마크 제거 (화면과 같게)
            position: 'absolute',
            right: -120,
            bottom: -200,
            fontFamily: SERIF,
            fontSize: 720,
            fontWeight: 900,
            color: theme.accent,
            opacity: 0.07,
            lineHeight: 0.85,
            pointerEvents: 'none',
            letterSpacing: '-0.04em',
          }}
        >
          {ilju.charAt(1) || theme.watermarkHanja}
        </span>
        {/* accent halo (소프트) */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: -160,
            top: -160,
            width: 520,
            height: 520,
            borderRadius: '50%',
            background: 'none', // 2026-10-13 v9 — 빛번짐 제거
          }}
        />

        {/* 상단 배지 — SSOT 골드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <span
            style={{
              background: '#8C6D3D',
              color: '#F8F5EE',
              padding: '8px 20px',
              borderRadius: 999,
              fontFamily: SERIF,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '0.18em',
              boxShadow: `0 4px 16px rgba(140,109,61,0.30)`,
            }}
          >
            사주500
          </span>
          <span
            style={{
              background: 'rgba(184,150,90,0.10)',
              padding: '8px 18px',
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 700,
              border: `1px solid rgba(184,150,90,0.40)`,
              color: '#8C6D3D',
            }}
          >
            만세력 카드
          </span>
        </div>

        {/* Stage 4 보강: 거대 일주 한자 (240pt) ⭐ 잉크 단순 (outline 제거) */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32, marginTop: 60, position: 'relative' }}>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 240,
              fontWeight: 800,
              lineHeight: 0.92,
              letterSpacing: '0.04em',
              color: '#1A1A1A',
              textShadow: `0 8px 32px ${theme.accent}28, 0 4px 8px rgba(0,0,0,0.08)`,
            }}
          >
            {ilju || '命'}
          </span>
          <div style={{ flex: 1, paddingBottom: 30, minWidth: 0 }}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 28,
                fontWeight: 700,
                color: theme.accent,
                letterSpacing: '0.18em',
                marginBottom: 8,
              }}
            >
              日柱 {iljuKo}
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 44,
                fontWeight: 800,
                color: '#1A1A1A',
                letterSpacing: '-0.005em',
                lineHeight: 1.15,
              }}
            >
              {(() => {
                const m = getIljuMeaning(ilju);
                return m?.identity || `${name} 님의 사주`;
              })()}
            </div>
            {(() => {
              const m = getIljuMeaning(ilju);
              return m?.personality ? (
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 16,
                    color: theme.accent,
                    marginTop: 6,
                    letterSpacing: '0.04em',
                    fontWeight: 600,
                  }}
                >
                  {m.personality}
                </div>
              ) : null;
            })()}
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 18,
                color: '#6F6557',
                marginTop: 8,
                letterSpacing: '0.04em',
                fontWeight: 600,
              }}
            >
              {dayOheng}({theme.watermarkHanja}) 일간
            </div>
          </div>
        </div>

        {/* Stage 4 보강: 직관적 풀이 (시적 → 명료) — 화이트 카드 + 좌측 accent 바 */}
        <h1
          style={{
            fontFamily: SERIF,
            fontWeight: 600,
            fontSize: 30,
            lineHeight: 1.5,
            margin: '40px 0 0',
            position: 'relative',
            padding: 5,
            background: '#FFFFFF',
            border: '2px solid rgba(26,22,18,0.6)',
            borderRadius: 2,
            color: '#1A1A1A',
          }}
        >
          {/* 2026-10-11 왼쪽 띠 → 두 줄 테두리 */}
          <div style={{ border: '1.5px solid rgba(26,22,18,0.22)', padding: '16px 20px' }}>
            {(() => {
              const m = getIljuMeaning(ilju);
              return (m ? `${m.identity}, ${m.description.replace(/\n/g, ' ')}` : null) || animal?.hint || `${name} 님의 사주 카드`;
            })()}
          </div>
        </h1>
      </div>

      {/* Stage 4 SSOT body — 베이지 배경 위 화이트 카드 (그림자만) */}
      <div style={{ padding: '26px 60px 40px', position: 'relative' }}>
        {/* 8글자 컬러 박스 (두산 패턴 강한 원색 — 박스 내부만) */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 20,
            padding: '28px 24px',
            boxShadow: `0 8px 24px rgba(184,150,90,0.15), 0 0 0 1px rgba(184,150,90,0.30)`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <span style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 800, color: '#1A1A1A', letterSpacing: '0.04em' }}>
              四柱八字
            </span>
            <span style={{ fontSize: 13, color: '#8C6D3D', fontWeight: 700, letterSpacing: '0.08em' }}>
              사주 8글자
            </span>
          </div>
          <EightCharGridExport
            pillars={sajuData.pillars}
            sipsung={sajuData.sipsung}
            unyoung12={sajuData.unyoung12 || []}
            spec={{ fs: 72, pad: 16, fsLabel: 18, fsUnyung: 15 }}
          />
        </div>

        {/* 천을귀인 인장 — 발현 시 + 다크 카드 */}
        {primaryGwiin && (() => {
          const meta = getGwiinMeta(primaryGwiin.name);
          return (
            <div
              style={{
                marginTop: 28,
                background: '#FFFFFF',
                borderRadius: 20,
                padding: '28px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 28,
                color: '#1A1A1A',
                border: `2px solid ${theme.accent}55`,
                boxShadow: `0 8px 24px rgba(184,150,90,0.18), 0 0 24px ${theme.accent}1F`,
              }}
            >
              <GwiinSeal hit={primaryGwiin} size={200} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#A63030',
                    letterSpacing: '0.18em',
                    marginBottom: 6,
                  }}
                >
                  내 사주의 핵심 귀인
                </div>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 30,
                    fontWeight: 800,
                    color: '#1A1A1A',
                    marginBottom: 4,
                    lineHeight: 1.2,
                  }}
                >
                  {meta?.name || primaryGwiin.name}
                  <span style={{ fontSize: 16, color: '#6F6557', marginLeft: 8, fontWeight: 500 }}>
                    {primaryGwiin.hanja}
                  </span>
                </div>
                <div style={{ fontSize: 15, color: '#3D3D3D', lineHeight: 1.6, marginBottom: 8 }}>
                  {meta?.meaning || primaryGwiin.meaning}
                </div>
                <div style={{ fontSize: 11, color: '#8C6D3D', fontWeight: 600, letterSpacing: '0.06em' }}>
                  ({meta?.source || '명리학 원전'})
                </div>
              </div>
            </div>
          );
        })()}

        {/* 운의 흐름 mini — 화이트 카드 */}
        <div
          style={{
            marginTop: 28,
            background: '#FFFFFF',
            borderRadius: 20,
            padding: '24px 22px',
            boxShadow: `0 8px 24px rgba(184,150,90,0.15), 0 0 0 1px rgba(184,150,90,0.30)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 800, color: '#1A1A1A' }}>
              運勢
            </span>
            <span style={{ fontSize: 12, color: theme.accent, fontWeight: 700, letterSpacing: '0.08em' }}>
              운의 흐름 (대운, 세운, 월운)
            </span>
          </div>
          <MiniFlow sajuData={sajuData} birthYear={input.birthYear} />
        </div>

        {/* 핵심 신살 3 — accent 컬러칩 */}
        {keySinsals.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 18,
                fontWeight: 800,
                color: theme.accent,
                letterSpacing: '0.12em',
                marginBottom: 14,
              }}
            >
              神煞 핵심 신살
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {keySinsals.slice(0, 2).map((hit, i) => (
                <KeySinsalChip key={i} hit={hit} fontSize={16} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stage 4 SSOT 푸터 — 골드 deep CTA (베이지 그라디언트) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '30px 60px 60px',
          background: `linear-gradient(to top, #F8F5EE 55%, transparent)`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 16,
            background: '#8C6D3D',
            color: '#F8F5EE',
            padding: '24px 44px',
            borderRadius: 18,
            fontFamily: SERIF,
            fontSize: 26,
            fontWeight: 800,
            marginBottom: 18,
            letterSpacing: '-0.005em',
            boxShadow: `0 12px 28px rgba(140,109,61,0.30), 0 0 0 1px rgba(255,255,255,0.10) inset`,
          }}
        >
          1운부터 이 사주 풀이 받기
          <span style={{ fontSize: 28, fontWeight: 900, color: '#B8965A' }}>→</span>
        </div>
        <div
          style={{
            fontSize: 14,
            color: '#8C6D3D',
            letterSpacing: '0.18em',
            fontWeight: 700,
            opacity: 0.85,
          }}
        >
          {BRAND_STAMP_FULL}
        </div>
      </div>
    </div>
  );
}
