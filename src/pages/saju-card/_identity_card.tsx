/**
 * #saju-card-share Stage 7b · L1 인장 — 가독성/위계 전면 재정렬
 *
 * 변경 (Stage 6/7a → 7b, CDO 결단 12 항목):
 *   #1 출생정보 → L1 hero 첫 영역 (만/세는 나이 + 시간 범위)
 *   #2 4주/8자 직관 표현 강화 (일주(나) 강조, 한글 우선)
 *   #3 정렬 다양화 (가운데 정렬: 정체성/풀이/personality + 가운데 일관성)
 *   #4 키워드 칩 위 카테고리 prefix ("주요 귀인")
 *   #5 CTA 교체: "내 사주도 보기" → "종합 사주 풀이 받기 (10운 · 5,000원)"
 *   #6 시간 표기 "05:00 → 묘시" → "05:00 · 묘시(卯時, 05:00~07:00)"
 *
 * 기본 원칙 (불변):
 *   - SSOT (베이지 #F8F5EE / 잉크 #1A1A1A / 골드 #B8965A)
 *   - 8글자 박스만 강한 5 오행 원색
 *   - 별명/이모지 0건 (✦ 텍스트 기호 OK)
 */

import type { OhengType, SajuData } from '@/types/saju';
import type { IljuAnimal } from '@/constants/iljuAnimal';
import { ILJU_ALL } from '@/constants/iljuAnimal';
import { getIljuMeaning } from '@/constants/iljuMeaning';
import type { SinsalHit, SinsalAnalysis } from '@/services/saju/sinsal';
import { getManAge, getKoreanAge, getHourBranch } from '@/utils/saju-format';
import { SajuDetailsTable } from './_details_table';
import { SinsalCardsSection } from './_visual_section';

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

const OHENG_ACCENT: Record<OhengType, { color: string; soft: string; tag: string }> = {
  목: { color: '#4E7A57', soft: 'rgba(78,122,87,0.06)',  tag: '木' },
  화: { color: '#B04A38', soft: 'rgba(176,74,56,0.05)',  tag: '火' },
  토: { color: '#B07F38', soft: 'rgba(176,127,56,0.06)', tag: '土' },
  금: { color: '#7D7870', soft: 'rgba(74,74,74,0.06)', tag: '金' },
  수: { color: '#3E5F82', soft: 'rgba(62,95,130,0.05)', tag: '水' },
};

const OHENG_BOX: Record<OhengType, { bg: string; fg: string; outline: string }> = {
  목: { bg: '#4E7A57', fg: '#FFFFFF', outline: '#1B5E2C' },
  화: { bg: '#B04A38', fg: '#FFFFFF', outline: '#9B1B1B' },
  토: { bg: '#B07F38', fg: '#FFFFFF', outline: '#C9A030' },
  금: { bg: '#FFFFFF', fg: '#1A1A1A', outline: '#9C9C9C' },
  수: { bg: '#1A1A1A', fg: '#FFFFFF', outline: '#3D3D3D' },
};

const OHENG_HAN: Record<OhengType, string> = {
  목: '木', 화: '火', 토: '土', 금: '金', 수: '水',
};

const GAN_KO: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
const ZHI_KO: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};

function getGabjaIndex(ilju: string): number {
  const idx = ILJU_ALL.indexOf(ilju);
  return idx >= 0 ? idx + 1 : 0;
}

/* ══════════════════════════════════════════════════════════════════
 * 키워드 칩 — 카테고리 분류 (Stage 7b)
 *  · 우선순위 + 카테고리 분류 → "주요 귀인" / "운명의 흐름" 라벨
 * ═════════════════════════════════════════════════════════════════ */

interface KeywordChip {
  ko: string;
  hanja: string;
  category: 'gwiin' | 'flow' | 'gongmang';
}

const KEYWORD_CATEGORY: Record<string, 'gwiin' | 'flow' | 'gongmang'> = {
  천을귀인: 'gwiin', 천덕귀인: 'gwiin', 월덕귀인: 'gwiin', 문창귀인: 'gwiin',
  학당귀인: 'gwiin', 관귀학관: 'gwiin', 태극귀인: 'gwiin', 협록: 'gwiin',
  도화살: 'flow', 화개살: 'flow', 역마살: 'flow', 장성살: 'flow', 반안살: 'flow',
  지살: 'flow', 망신살: 'flow', 월살: 'flow',
};

const CATEGORY_LABEL: Record<KeywordChip['category'], string> = {
  gwiin: '주요 귀인',
  flow: '운명의 흐름',
  gongmang: '비어 있는 자리',
};

const KEYWORD_PRIORITY = [
  '천을귀인', '천덕귀인', '월덕귀인', '문창귀인', '학당귀인', '태극귀인', '관귀학관',
  '도화살', '화개살', '역마살', '장성살', '반안살', '지살',
];

function pickKeywords(sinsalAnalysis: SinsalAnalysis | null, gongmangChars: string): KeywordChip[] {
  const out: KeywordChip[] = [];
  if (!sinsalAnalysis) {
    if (gongmangChars) out.push({ ko: `공망 ${gongmangChars}`, hanja: '空亡', category: 'gongmang' });
    return out;
  }
  const allHits: SinsalHit[] = [
    ...sinsalAnalysis.gilsongGwiin,
    ...sinsalAnalysis.shipiSinsal,
    ...sinsalAnalysis.bojo,
  ];
  for (const targetName of KEYWORD_PRIORITY) {
    if (out.length >= 3) break;
    const hit = allHits.find((h) => h.name === targetName);
    if (hit && !out.find((c) => c.ko === hit.name.replace(/살$/, ''))) {
      out.push({
        ko: hit.name.replace(/살$/, ''),
        hanja: hit.hanja,
        category: KEYWORD_CATEGORY[hit.name] || 'flow',
      });
    }
  }
  if (out.length < 3 && gongmangChars) {
    out.push({ ko: `공망 ${gongmangChars}`, hanja: '空亡', category: 'gongmang' });
  }
  return out.slice(0, 3);
}

/** 키워드 카테고리별 그룹핑 (배지 prefix 용) */
function groupByCategory(chips: KeywordChip[]): Array<{ label: string; items: KeywordChip[] }> {
  const map = new Map<string, KeywordChip[]>();
  for (const chip of chips) {
    const label = CATEGORY_LABEL[chip.category];
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(chip);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

/* ══════════════════════════════════════════════════════════════════
 * IdentityCard — L1 인장 (Stage 7b 가독성/위계 재정렬)
 * ═════════════════════════════════════════════════════════════════ */

export interface IdentityCardProps {
  name: string;
  ilju: string;
  iljuKo: string;
  animal: IljuAnimal | null;
  dayOheng: OhengType;
  sajuData: SajuData;
  primaryGwiin?: SinsalHit | null;
  sinsalAnalysis?: SinsalAnalysis | null;
  birthLabel: string;
  /** 출생 정보 (Stage 7b: hero 위 영역에 통합 노출) */
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  birthHour?: number;
  birthMinute?: number;
  hasBirthTime?: boolean;
  isLunar?: boolean;
  /** "종합 사주 풀이 받기 (10운)" CTA */
  onPremiumCta?: () => void;
  /** 스크롤 자세히 보기 (페이지 내 anchor) */
  onMoreDetails?: () => void;
  asExport?: boolean;
}

export function IdentityCard({
  name,
  ilju,
  iljuKo,
  animal,
  dayOheng,
  sajuData,
  sinsalAnalysis,
  birthLabel,
  birthYear,
  birthMonth,
  birthDay,
  birthHour,
  birthMinute,
  hasBirthTime,
  isLunar,
  onPremiumCta,
  onMoreDetails,
  asExport = false,
}: IdentityCardProps) {
  void animal;
  void name;
  void birthLabel; // 새 출생정보 위 영역 사용 — 기존 birthLabel 폐기
  void onMoreDetails; // Stage 7c: "만세력 자세히 보기" 버튼 폐지
  void onPremiumCta;  // Stage 7e: CTA 가 SajuCardPage 자세히 영역 맨 밑으로 이동 (props 시그니처는 보존)
  const accent = OHENG_ACCENT[dayOheng];
  const accentColor = accent.color;
  const gabjaIdx = getGabjaIndex(ilju);

  const meaningEntry = getIljuMeaning(ilju);
  const identity = meaningEntry?.identity || '사주 8글자가 그려내는 흐름';
  const description = meaningEntry?.description || '명리학으로 짚어본 본인의 사주';

  const ilgan = sajuData.pillars[2]?.천간 || '';
  const ilji = sajuData.pillars[2]?.지지 || '';
  const siji = sajuData.pillars[3]?.available ? sajuData.pillars[3]?.지지 : '';

  // 학술 라벨
  const ilganKo = GAN_KO[ilgan] || '';
  const ilganTag = ilganKo && ilgan ? `${ilganKo}(${ilgan}) 일간` : '';
  const sijiTag = (() => {
    if (siji) {
      const sijiKo = ZHI_KO[siji] || '';
      return sijiKo ? `${sijiKo}(${siji}) 시지` : '';
    }
    const iljiKo = ZHI_KO[ilji] || '';
    return iljiKo ? `${iljiKo}(${ilji}) 일지` : '';
  })();
  const academicLabel = ilganTag && sijiTag ? `${ilganTag}, ${sijiTag}` : ilganTag;

  // 출생정보 (Stage 7b — hero 위 통합)
  const birthLine = (() => {
    if (!birthYear) return '';
    const yyyymmdd = `${birthYear}.${String(birthMonth ?? 1).padStart(2, '0')}.${String(birthDay ?? 1).padStart(2, '0')}`;
    const calLabel = isLunar ? '음력' : '양력';
    return `${calLabel} ${yyyymmdd}`;
  })();
  const ageLine = (() => {
    if (!birthYear || !birthMonth || !birthDay) return '';
    const man = getManAge(birthYear, birthMonth, birthDay);
    const sehe = getKoreanAge(birthYear);
    return `만 ${man}세, 세는 ${sehe}세`;
  })();
  // 2026-06-02 — 입력은 '시(時) 밴드'만 받음(분 단위 X) → 대표시각 "11시"를 그대로 보이면
  //   11:41 입력자가 "내 시간 아닌데" 혼란. 분이 실제 있을 때만 정확 시각 표기, 없으면 시(時) 이름만.
  const hourLine = (() => {
    if (!hasBirthTime || birthHour === undefined) return '시간 모름';
    const branch = getHourBranch(birthHour, birthMinute);
    const hasMinute = (birthMinute ?? 0) > 0;
    if (!branch) {
      return hasMinute
        ? `${String(birthHour).padStart(2, '0')}:${String(birthMinute).padStart(2, '0')}`
        : '시간 모름';
    }
    const label = `${branch.ko}(${branch.hanja}, ${branch.range})`;
    // 분이 명시된 경우에만 정확 시각 prefix, 아니면 시(時)만
    return hasMinute
      ? `${String(birthHour).padStart(2, '0')}:${String(birthMinute).padStart(2, '0')}, ${label}`
      : label;
  })();

  // Stage 7e: 키워드 칩 폐지 (핵심 신살 카드로 대체) — 헬퍼는 보존 (export-layout 등에서 사용 가능)
  void pickKeywords;
  void groupByCategory;

  return (
    <div
      style={{
        position: 'relative',
        background: `linear-gradient(180deg, ${C.paperSoft} 0%, ${C.paper} 60%, ${accent.soft} 100%)`,
        padding: asExport ? 0 : '0 0 24px',
        overflow: 'hidden',
      }}
    >
      {/* 배경 워터마크 — 2026-10-10 v9 제거 */}
      <span
        aria-hidden
        style={{
          display: 'none',
          position: 'absolute',
          right: -60,
          top: 100,
          fontFamily: SERIF,
          fontSize: 380,
          fontWeight: 900,
          color: accentColor,
          opacity: 0.05,
          lineHeight: 0.85,
          pointerEvents: 'none',
          letterSpacing: '-0.04em',
          userSelect: 'none',
        }}
      >
        {ilju.charAt(1) || accent.tag}
      </span>
      {/* 좌상단 골드 halo */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: -100,
          top: -100,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor}1A 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ═════ 0. 상단 — 사주500 한글 + 본인의 사주 (Stage 7c: 영문 워터마크 폐지) ═════ */}
      <div
        style={{
          position: 'relative',
          padding: 'calc(20px + env(safe-area-inset-top)) 22px 4px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 14,
            fontWeight: 900,
            color: C.goldDeep,
            letterSpacing: '0.16em',
          }}
        >
          사주<span style={{ fontSize: 13, opacity: 0.7, marginLeft: 2 }}>500</span>
        </span>
        <span
          style={{
            fontSize: 13,
            color: C.mute,
            letterSpacing: '0.16em',
          }}
        >
          본인의 사주
        </span>
      </div>

      {/* ═════ 1. 출생정보 카드 (Stage 7d — 2줄 압축, 첫 화면 fit ↑) ═════ */}
      {birthLine && (
        <div
          style={{
            position: 'relative',
            margin: '10px 22px 0',
            padding: '10px 14px',
            background: C.surface,
            border: `1px solid ${C.cardLine}`,
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            zIndex: 1,
          }}
        >
          {/* 1줄: 양력 + 나이 합치기 */}
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 13.5,
              fontWeight: 800,
              color: C.ink,
              letterSpacing: '0.02em',
              textAlign: 'center',
            }}
          >
            {birthLine}
            {ageLine && (
              <span style={{ fontSize: 13, color: C.mute, fontWeight: 600, marginLeft: 8 }}>
                {ageLine}
              </span>
            )}
          </div>
          {/* 2줄: 시간 */}
          <div
            style={{
              fontSize: 13,
              color: hasBirthTime ? C.goldDeep : C.mute,
              fontWeight: hasBirthTime ? 700 : 500,
              fontStyle: hasBirthTime ? 'normal' : 'italic',
              letterSpacing: '0.02em',
            }}
          >
            {hourLine}
          </div>
        </div>
      )}

      {/* ═════ 2. HERO (Stage 7e-2) — 가운데 묶음 + 일주-박스 gap 조정 ═════ */}
      <div
        style={{
          position: 'relative',
          padding: '14px 22px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 22,
          zIndex: 1,
        }}
      >
        {/* 좌측 — 일주 한자 세로 + 캡슐 (gap 묶음 그룹) */}
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          {/* "일주(日柱) · 나" 강조 라벨 */}
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: C.gold,
              letterSpacing: '0.18em',
              marginBottom: 4,
              padding: '2px 8px',
              border: `1px solid ${C.goldLine}`,
              borderRadius: 2,
              background: C.goldSoft,
            }}
          >
            나의 일주(日柱)
          </div>
          {/* Stage 7e — 일주 한자 세로 복원 (사용자 결정: 세로 임팩트 유지) */}
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 80,
              fontWeight: 900,
              lineHeight: 0.96,
              color: C.ink,
              letterSpacing: '0.02em',
              textShadow: '0 2px 12px rgba(0,0,0,0.07)',
              userSelect: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <span>{ilgan || '命'}</span>
            <span>{ilji || ''}</span>
          </div>
          {iljuKo && (
            <div
              style={{
                marginTop: 6,
                padding: '3px 10px',
                background: C.goldSoft,
                border: `1px solid ${C.goldLine}`,
                borderRadius: 2,
                fontFamily: SERIF,
                fontSize: 13,
                color: C.goldDeep,
                letterSpacing: '0.08em',
                fontWeight: 800,
              }}
            >
              {iljuKo}
            </div>
          )}
        </div>
        {/* 우측 — 4주 오행 박스 그리드 (Stage 7e-2: 좌 그룹과 가까이) */}
        <div
          style={{
            flex: '0 0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 56px)',
            gridTemplateRows: 'repeat(2, 56px)',
            gap: 6,
          }}
        >
          {[3, 2, 1, 0].map((idx) => {
            const p = sajuData.pillars[idx];
            const labelKo = ['년주', '월주', '일주', '시주'][idx];
            const labelHan = ['年', '月', '日', '時'][idx];
            const isDay = idx === 2;
            if (!p?.available) {
              return (
                <div
                  key={idx}
                  style={{
                    width: 56,
                    height: 56,
                    border: `1.5px dashed ${C.line}`,
                    borderRadius: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: C.paperSoft,
                    color: C.mute,
                    fontSize: 13,
                    lineHeight: 1.2,
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{labelKo}</span>
                  <span>모름</span>
                </div>
              );
            }
            const ganOheng = p.천간오행 as OhengType;
            const box = OHENG_BOX[ganOheng];
            return (
              <div
                key={idx}
                style={{
                  width: 56,
                  height: 56,
                  background: box.bg,
                  color: box.fg,
                  border: isDay ? `3px solid ${C.gold}` : `1.5px solid ${box.outline}`,
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: SERIF,
                  boxShadow: isDay
                    ? `0 0 0 3px rgba(184,150,90,0.18), 0 6px 18px ${C.gold}55`
                    : '0 1px 3px rgba(0,0,0,0.08)',
                  position: 'relative',
                  outline: 'none',
                  transform: isDay ? 'scale(1.06)' : 'none',
                  transformOrigin: 'center',
                  zIndex: isDay ? 2 : 1,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: 5,
                    fontSize: 7.5,
                    fontWeight: 700,
                    opacity: 0.7,
                    letterSpacing: '0.04em',
                  }}
                  title={labelHan}
                >
                  {labelKo.charAt(0)}
                </span>
                {/* 일주 강조: "나" 배지 (Stage 7c) */}
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
                      background: C.goldDeep,
                      color: C.paper,
                      fontSize: 9,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      letterSpacing: 0,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                      border: `1.5px solid ${C.paper}`,
                    }}
                  >
                    나
                  </span>
                )}
                <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.0 }}>{p.천간}</span>
                <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginTop: 1 }}>
                  {OHENG_HAN[ganOheng]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═════ 3. 학술 라벨 (가운데 정렬, gold) ═════ */}
      {academicLabel && (
        <div
          style={{
            position: 'relative',
            padding: '0 22px',
            textAlign: 'center',
            fontFamily: SERIF,
            fontSize: 13,
            fontWeight: 700,
            color: accentColor,
            letterSpacing: '0.04em',
            zIndex: 1,
          }}
        >
          {academicLabel}
        </div>
      )}

      {/* ═════ 4. 정체성 한 줄 + 풀이 2줄 (Stage 7d — padding 축소) ═════ */}
      <div
        style={{
          position: 'relative',
          padding: '10px 22px 6px',
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 24,
            fontWeight: 800,
            color: C.ink,
            lineHeight: 1.25,
            letterSpacing: '-0.005em',
            marginBottom: 10,
          }}
        >
          {identity}
        </div>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 500,
            color: C.inkSoft,
            lineHeight: 1.7,
            whiteSpace: 'pre-line',
            maxWidth: 320,
            margin: '0 auto',
          }}
        >
          {description}
        </div>
        {/* 60갑자 인덱스 + personality 강조 (가운데, 골드 캡슐) */}
        {(gabjaIdx > 0 || meaningEntry?.personality) && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 14,
              padding: '6px 12px',
              background: C.surface,
              border: `1px solid ${C.goldLine}`,
              borderRadius: 2,
              fontSize: 13,
            }}
          >
            {gabjaIdx > 0 && (
              <span style={{ fontFamily: SERIF, fontWeight: 800, color: accentColor, letterSpacing: '0.04em' }}>
                60갑자 중 {gabjaIdx}번째
              </span>
            )}
            {gabjaIdx > 0 && meaningEntry?.personality && (
              <span aria-hidden="true" style={{ width: 1, height: 10, background: C.line }} />
            )}
            {meaningEntry?.personality && (
              <span style={{ fontWeight: 700, color: C.goldDeep, letterSpacing: '0.02em' }}>
                {meaningEntry.personality}
              </span>
            )}
          </div>
        )}
      </div>

      {/* divider */}
      <div
        aria-hidden
        style={{
          position: 'relative',
          margin: '14px 22px 0',
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${C.goldLine} 50%, transparent 100%)`,
          opacity: 0.6,
        }}
      />

      {/* ═════ 5. 만세력 정밀 — Stage 7c: 8글자 mini → 두산 단일 표 통합 ═════ */}
      <div style={{ position: 'relative', padding: '8px 22px 4px', zIndex: 1 }}>
        <SajuDetailsTable sajuData={sajuData} sinsalAnalysis={sinsalAnalysis ?? null} />
      </div>

      {/* divider */}
      <div
        aria-hidden
        style={{
          position: 'relative',
          margin: '4px 22px 0',
          height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${C.goldLine} 50%, transparent 100%)`,
          opacity: 0.6,
        }}
      />

      {/* ═════ 6. 핵심 신살 4 카드 (Stage 7e — 키워드 칩 폐지, 신살 카드 통합) ═════ */}
      <div style={{ position: 'relative', padding: '14px 22px 8px', zIndex: 1 }}>
        <SinsalCardsSection sinsalAnalysis={sinsalAnalysis ?? null} />
      </div>

      {/* Stage 7e: CTA + disclaimer 는 자세히 영역(SajuCardPage) 맨 밑으로 이동 */}
      {asExport && (
        <div
          style={{
            position: 'relative',
            textAlign: 'center',
            fontSize: 13,
            color: C.mute,
            letterSpacing: '0.18em',
            padding: '8px 22px 16px',
            fontWeight: 500,
            zIndex: 1,
          }}
        >
          saju500.app
        </div>
      )}
    </div>
  );
}

