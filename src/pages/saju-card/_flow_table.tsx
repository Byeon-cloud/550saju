/**
 * #saju-card-share Round 3 ⭐ · 운의 흐름 표 (대운·세운·월운)
 *
 * 핵심 진단 (준기 + 두산 만세력 레퍼):
 *   "시간 흐름 부재" = 가장 큰 문제 → 정보 밀도 ↑ + 시간축 정렬
 *
 * 3 표:
 *   · DaeunTable — 8 칸 가로 스크롤 (10년 단위 인생 흐름)
 *   · SeunTable  — 7 칸 (현재 년 ±3, 매년)
 *   · WolunTable — 12 칸 (올해 1~12월, 절기 기반)
 *
 * 각 칸: 시점 라벨 + 60갑자 한자 박스(오행 컬러) + 십성 + 12운성
 * 두산 패턴 흡수 + SSOT 톤 (5 오행 컬러 + sipsungColor 매핑)
 *
 * 보존:
 *   · calculator.ts 무수정 (DaeUn[] 그대로 활용)
 *   · lunar-javascript 정통 호출만 (Solar.fromYmd → getLunar → year/month gan/zhi)
 *   · 한자 + 한국어 즉시 병기
 */

import { Solar } from 'lunar-javascript';
import { CHEONGAN_OHENG, JIJI_OHENG, CHEONGAN_EUMYANG, CHEONGAN_KO, JIJI_KO } from '@/constants/oheng';
import { lookupSipsung } from '@/constants/sipsungColor';
import { findCurrentDaeun } from '@/services/saju/daeunCurrent';
import type { DaeUn, OhengType, SajuData, SajuInput } from '@/types/saju';

const SERIF = "'Noto Serif KR', serif";

/* ══════════════════════════════════════════════════════════════════
 * SSOT 5 오행 컬러 매핑 — 박스 배경 + 한자 컬러 자동 결정
 * ═════════════════════════════════════════════════════════════════ */

interface OhengBoxStyle {
  bg: string;
  fg: string;
  borderOpt?: string; // 금(금속) 흰 박스 outline 용
}

const OHENG_BOX: Record<OhengType, OhengBoxStyle> = {
  목: { bg: '#4E7A57', fg: '#FFFFFF' },
  화: { bg: '#B04A38', fg: '#FFFFFF' },
  토: { bg: '#B07F38', fg: '#FFFFFF' },
  금: { bg: '#FFFFFF', fg: '#1A1A1A', borderOpt: '#9C9C9C' }, // 흰 박스 + 검 한자 + 회 outline
  수: { bg: '#2C2C2C', fg: '#FFFFFF' },
};

/* ══════════════════════════════════════════════════════════════════
 * 십성 도출 — 일간 기준 (대운/세운/월운 천간 → 십성)
 * ═════════════════════════════════════════════════════════════════ */

const OHENG_SAENG: Record<OhengType, OhengType> = {
  목: '화', 화: '토', 토: '금', 금: '수', 수: '목',
};
const OHENG_KEUK: Record<OhengType, OhengType> = {
  목: '토', 토: '수', 수: '화', 화: '금', 금: '목',
};

/** 일간 X + 대상 천간 Y → 10 십성 (Round 3 신규) */
export function deriveSipsung(ilgan: string, target: string): string {
  if (!ilgan || !target) return '';
  if (ilgan === target) return '비견';
  const xOh = CHEONGAN_OHENG[ilgan];
  const xYY = CHEONGAN_EUMYANG[ilgan];
  const yOh = CHEONGAN_OHENG[target];
  const yYY = CHEONGAN_EUMYANG[target];
  if (!xOh || !yOh) return '';
  const same = xYY === yYY;

  if (xOh === yOh) return same ? '비견' : '겁재';
  if (OHENG_SAENG[xOh] === yOh) return same ? '식신' : '상관';
  if (OHENG_KEUK[xOh] === yOh) return same ? '편재' : '정재';
  if (OHENG_KEUK[yOh] === xOh) return same ? '편관' : '정관';
  if (OHENG_SAENG[yOh] === xOh) return same ? '편인' : '정인';
  return '';
}

/* ══════════════════════════════════════════════════════════════════
 * 12 운성 lookup table — 일간 X 지지 Y → 12 운성
 *  (포태법 표준 — 양간 순행, 음간 역행)
 * ═════════════════════════════════════════════════════════════════ */
const UNSEONG_TABLE: Record<string, Record<string, string>> = {
  甲: { 亥:'장생', 子:'목욕', 丑:'관대', 寅:'건록', 卯:'제왕', 辰:'쇠', 巳:'병', 午:'사', 未:'묘', 申:'절', 酉:'태', 戌:'양' },
  乙: { 午:'장생', 巳:'목욕', 辰:'관대', 卯:'건록', 寅:'제왕', 丑:'쇠', 子:'병', 亥:'사', 戌:'묘', 酉:'절', 申:'태', 未:'양' },
  丙: { 寅:'장생', 卯:'목욕', 辰:'관대', 巳:'건록', 午:'제왕', 未:'쇠', 申:'병', 酉:'사', 戌:'묘', 亥:'절', 子:'태', 丑:'양' },
  丁: { 酉:'장생', 申:'목욕', 未:'관대', 午:'건록', 巳:'제왕', 辰:'쇠', 卯:'병', 寅:'사', 丑:'묘', 子:'절', 亥:'태', 戌:'양' },
  // 戊 = 丙 동궁, 己 = 丁 동궁 (정통 명리학)
  戊: { 寅:'장생', 卯:'목욕', 辰:'관대', 巳:'건록', 午:'제왕', 未:'쇠', 申:'병', 酉:'사', 戌:'묘', 亥:'절', 子:'태', 丑:'양' },
  己: { 酉:'장생', 申:'목욕', 未:'관대', 午:'건록', 巳:'제왕', 辰:'쇠', 卯:'병', 寅:'사', 丑:'묘', 子:'절', 亥:'태', 戌:'양' },
  庚: { 巳:'장생', 午:'목욕', 未:'관대', 申:'건록', 酉:'제왕', 戌:'쇠', 亥:'병', 子:'사', 丑:'묘', 寅:'절', 卯:'태', 辰:'양' },
  辛: { 子:'장생', 亥:'목욕', 戌:'관대', 酉:'건록', 申:'제왕', 未:'쇠', 午:'병', 巳:'사', 辰:'묘', 卯:'절', 寅:'태', 丑:'양' },
  壬: { 申:'장생', 酉:'목욕', 戌:'관대', 亥:'건록', 子:'제왕', 丑:'쇠', 寅:'병', 卯:'사', 辰:'묘', 巳:'절', 午:'태', 未:'양' },
  癸: { 卯:'장생', 寅:'목욕', 丑:'관대', 子:'건록', 亥:'제왕', 戌:'쇠', 酉:'병', 申:'사', 未:'묘', 午:'절', 巳:'태', 辰:'양' },
};

export function deriveUnseong(ilgan: string, zhi: string): string {
  return UNSEONG_TABLE[ilgan]?.[zhi] ?? '';
}

/* ══════════════════════════════════════════════════════════════════
 * 60갑자 컴퓨팅 — 세운 (년) + 월운 (월)
 * ═════════════════════════════════════════════════════════════════ */

interface Ganji {
  gan: string;
  zhi: string;
  ganji: string;
  ganOheng: OhengType;
  zhiOheng: OhengType;
}

/** 년도 → 60갑자 (Solar.fromYmd 6/1 기준) */
function yearGanji(year: number): Ganji | null {
  try {
    const lunar = Solar.fromYmd(year, 6, 1).getLunar();
    const gan = lunar.getYearGan();
    const zhi = lunar.getYearZhi();
    return {
      gan, zhi,
      ganji: `${gan}${zhi}`,
      ganOheng: CHEONGAN_OHENG[gan] ?? '토',
      zhiOheng: JIJI_OHENG[zhi] ?? '토',
    };
  } catch { return null; }
}

/** 년/월 → 60갑자 (절기 기반 — Solar.fromYmd 15일 기준 = 절기 안정 영역)
 *  lunar-javascript Lunar 타입 정의 누락 — any 캐스트 (런타임 메서드 모두 존재) */
function monthGanji(year: number, month: number): Ganji | null {
  try {
    const lunar = Solar.fromYmd(year, month, 15).getLunar() as any;
    const gan = lunar.getMonthGan();
    const zhi = lunar.getMonthZhi();
    return {
      gan, zhi,
      ganji: `${gan}${zhi}`,
      ganOheng: CHEONGAN_OHENG[gan] ?? '토',
      zhiOheng: JIJI_OHENG[zhi] ?? '토',
    };
  } catch { return null; }
}

/* ══════════════════════════════════════════════════════════════════
 * 60갑자 박스 — 천간/지지 한자 (오행 컬러 배경)
 * ═════════════════════════════════════════════════════════════════ */

function GanjiBox({
  gan,
  zhi,
  ganOheng,
  zhiOheng,
  size = 'md',
}: {
  gan: string;
  zhi: string;
  ganOheng: OhengType;
  zhiOheng: OhengType;
  size?: 'sm' | 'md';
}) {
  const isSmall = size === 'sm';
  const fontSize = isSmall ? 18 : 22;
  const boxSize = isSmall ? 28 : 34;
  const ganStyle = OHENG_BOX[ganOheng];
  const zhiStyle = OHENG_BOX[zhiOheng];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <div
        style={{
          width: boxSize,
          height: boxSize,
          background: ganStyle.bg,
          color: ganStyle.fg,
          border: ganStyle.borderOpt ? `1px solid ${ganStyle.borderOpt}` : 'none',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF,
          fontSize,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {gan}
      </div>
      <div
        style={{
          width: boxSize,
          height: boxSize,
          background: zhiStyle.bg,
          color: zhiStyle.fg,
          border: zhiStyle.borderOpt ? `1px solid ${zhiStyle.borderOpt}` : 'none',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: SERIF,
          fontSize,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {zhi}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * FlowCell — 표의 1 칸 (시점 + 60갑자 박스 + 십성 + 12운성)
 * ═════════════════════════════════════════════════════════════════ */

function FlowCell({
  topLabel,
  ganji,
  ilgan,
  highlighted,
  highlightTone = 'gold',
  size = 'md',
}: {
  /** 상단 시점 (예: "27세" / "2026" / "6월") */
  topLabel: string;
  ganji: Ganji;
  ilgan: string;
  highlighted?: boolean;
  highlightTone?: 'gold' | 'red';
  size?: 'sm' | 'md';
}) {
  const sipsung = deriveSipsung(ilgan, ganji.gan);
  const sipMeta = lookupSipsung(sipsung);
  const unseong = deriveUnseong(ilgan, ganji.zhi);

  const ringColor = highlightTone === 'red' ? '#B04A38' : '#B8965A';
  const ringBg =
    highlightTone === 'red' ? 'rgba(176,74,56,0.06)' : 'rgba(184,150,90,0.08)';

  return (
    <div
      style={{
        flex: '0 0 auto',
        minWidth: size === 'sm' ? 60 : 72,
        padding: '8px 6px 10px',
        background: highlighted ? ringBg : '#FFFFFF',
        border: highlighted
          ? `2px solid ${ringColor}`
          : '1px solid rgba(184,150,90,0.18)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        boxShadow: highlighted ? `0 2px 10px ${ringColor}33` : 'none',
      }}
    >
      {/* 시점 라벨 */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: highlighted ? ringColor : '#7A7269',
          letterSpacing: '0.04em',
        }}
      >
        {topLabel}
      </div>

      {/* 60갑자 박스 */}
      <GanjiBox
        gan={ganji.gan}
        zhi={ganji.zhi}
        ganOheng={ganji.ganOheng}
        zhiOheng={ganji.zhiOheng}
        size={size}
      />

      {/* 십성 라벨 (천간 기준) */}
      {sipsung && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: sipMeta?.color ?? '#7A7269',
            background: sipMeta?.soft ?? 'rgba(122,114,105,0.06)',
            padding: '1px 6px',
            borderRadius: 4,
            letterSpacing: '0.02em',
            lineHeight: 1.3,
          }}
        >
          {sipsung}
        </div>
      )}

      {/* 12운성 (압축) */}
      {unseong && (
        <div
          style={{
            fontSize: 12,
            color: '#7A7269',
            fontFamily: SERIF,
            letterSpacing: '0.02em',
          }}
        >
          {unseong}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 1. DaeunTable — 8 칸 가로 스크롤
 * ═════════════════════════════════════════════════════════════════ */

export function DaeunTable({
  daeun,
  ilgan,
  birthYear,
  onMore,
}: {
  daeun: DaeUn[];
  ilgan: string;
  birthYear: number;
  onMore?: () => void;
}) {
  // 2026-07 fix — 연나이 fallback 은 세는나이 대운나이와 1살 어긋남(현재대운 off-by-one 버그 클래스).
  //   SSOT(daeunCurrent.findCurrentDaeun)로 재판정 후 isCurrent 만 신뢰.
  findCurrentDaeun(daeun || [], birthYear);
  const cells = (daeun || []).slice(0, 8).map((d) => {
    return { d, isCurrent: d.isCurrent === true };
  });

  if (cells.length === 0) {
    return (
      <FlowEmptyCard
        label="대운"
        msg="대운 데이터를 계산할 수 없어요 (시간 미입력 시 일부 제한)"
      />
    );
  }

  return (
    <FlowSection title="대운" hanja="大運" sub="10년 단위 인생 흐름" onMore={onMore}>
      <FlowRail>
        {cells.map(({ d, isCurrent }, i) => {
          if (!d.간지 || d.간지.length < 2) return null;
          const gan = d.간지.charAt(0);
          const zhi = d.간지.charAt(1);
          return (
            <FlowCell
              key={i}
              topLabel={`${d.시작나이}세`}
              ganji={{
                gan, zhi,
                ganji: d.간지,
                ganOheng: CHEONGAN_OHENG[gan] ?? '토',
                zhiOheng: JIJI_OHENG[zhi] ?? '토',
              }}
              ilgan={ilgan}
              highlighted={isCurrent}
              highlightTone="gold"
            />
          );
        })}
      </FlowRail>
    </FlowSection>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 2. SeunTable — 7 칸 (현재 년 ±3)
 * ═════════════════════════════════════════════════════════════════ */

export function SeunTable({ ilgan, onMore }: { ilgan: string; onMore?: () => void }) {
  const currentYear = new Date().getFullYear();
  const range = [-3, -2, -1, 0, 1, 2, 3];
  const items = range
    .map((delta) => {
      const year = currentYear + delta;
      const ganji = yearGanji(year);
      return ganji ? { year, ganji, isCurrent: delta === 0 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (items.length === 0) {
    return <FlowEmptyCard label="세운" msg="세운 데이터를 계산할 수 없어요" />;
  }

  return (
    <FlowSection title="세운" hanja="歲運" sub="해마다 바뀌는 흐름" onMore={onMore}>
      <FlowRail>
        {items.map(({ year, ganji, isCurrent }) => (
          <FlowCell
            key={year}
            topLabel={String(year)}
            ganji={ganji}
            ilgan={ilgan}
            highlighted={isCurrent}
            highlightTone={isCurrent ? 'red' : 'gold'}
          />
        ))}
      </FlowRail>
    </FlowSection>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 3. WolunTable — 12 칸 (올해 1~12월)
 * ═════════════════════════════════════════════════════════════════ */

export function WolunTable({ ilgan, onMore }: { ilgan: string; onMore?: () => void }) {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const items = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const ganji = monthGanji(year, month);
    return ganji ? { month, ganji, isCurrent: month === currentMonth } : null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  if (items.length === 0) {
    return <FlowEmptyCard label="월운" msg="월운 데이터를 계산할 수 없어요" />;
  }

  return (
    <FlowSection title="월운" hanja="月運" sub={`${year}년 12개월 흐름`} onMore={onMore}>
      <FlowRail>
        {items.map(({ month, ganji, isCurrent }) => (
          <FlowCell
            key={month}
            topLabel={`${month}월`}
            ganji={ganji}
            ilgan={ilgan}
            highlighted={isCurrent}
            highlightTone={isCurrent ? 'red' : 'gold'}
            size="sm"
          />
        ))}
      </FlowRail>
    </FlowSection>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Layout helpers — Section / Rail / Empty
 * ═════════════════════════════════════════════════════════════════ */

function FlowSection({
  title,
  hanja,
  sub,
  onMore,
  children,
}: {
  title: string;
  hanja: string;
  sub?: string;
  onMore?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(184,150,90,0.18)',
        borderRadius: 14,
        padding: '14px 14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 14,
            fontWeight: 700,
            color: '#8C6D3D',
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 13, color: '#7A7269', fontFamily: SERIF }}>
          {hanja}
        </span>
        {onMore && (
          <button
            type="button"
            onClick={onMore}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              color: '#8C6D3D',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            더 자세히 →
          </button>
        )}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 13,
            color: '#7A7269',
            marginBottom: 10,
            fontStyle: 'italic',
          }}
        >
          {sub}
        </div>
      )}
      {children}
    </div>
  );
}

function FlowRail({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 4,
        // 스크롤바 디자인 (Webkit 한정 — Firefox 는 default)
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(184,150,90,0.4) transparent',
      }}
    >
      {children}
    </div>
  );
}

function FlowEmptyCard({ label, msg }: { label: string; msg: string }) {
  return (
    <FlowSection title={label} hanja="" sub="">
      <div
        style={{
          padding: '20px 0',
          textAlign: 'center',
          fontSize: 13,
          color: '#7A7269',
          fontStyle: 'italic',
        }}
      >
        {msg}
      </div>
    </FlowSection>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Export — 3 표 통합 컨테이너
 * ═════════════════════════════════════════════════════════════════ */

export function FlowTablesGroup({
  sajuData,
  input,
  onMoreDaeun,
  onMoreSeun,
  onMoreWolun,
}: {
  sajuData: SajuData;
  input: SajuInput;
  onMoreDaeun?: () => void;
  onMoreSeun?: () => void;
  onMoreWolun?: () => void;
}) {
  const ilgan = sajuData.pillars[2]?.천간 || '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DaeunTable
        daeun={sajuData.daeun}
        ilgan={ilgan}
        birthYear={input.birthYear}
        onMore={onMoreDaeun}
      />
      <SeunTable ilgan={ilgan} onMore={onMoreSeun} />
      <WolunTable ilgan={ilgan} onMore={onMoreWolun} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Export 모드 — Mini Flow (현재 대운 1 + 세운 1 + 월운 1)
 * ═════════════════════════════════════════════════════════════════ */

export function MiniFlow({
  sajuData,
  birthYear,
  layout = 'horizontal',
}: {
  sajuData: SajuData;
  birthYear: number;
  layout?: 'horizontal' | 'compact';
}) {
  const ilgan = sajuData.pillars[2]?.천간 || '';
  // 2026-07 fix — SSOT 재판정 (연나이 fallback 제거 · 현재대운 off-by-one 버그 클래스)
  const currentDaeun = sajuData.daeun
    ? (findCurrentDaeun(sajuData.daeun, birthYear) ?? null)
    : null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const seun = yearGanji(year);
  const wolun = monthGanji(year, month);

  if (!ilgan) return null;

  const items: Array<{
    topLabel: string;
    bottomLabel: string;
    ganji: Ganji;
  }> = [];

  if (currentDaeun?.간지 && currentDaeun.간지.length >= 2) {
    const gan = currentDaeun.간지.charAt(0);
    const zhi = currentDaeun.간지.charAt(1);
    items.push({
      topLabel: '대운',
      bottomLabel: `${currentDaeun.시작나이}세`,
      ganji: {
        gan, zhi, ganji: currentDaeun.간지,
        ganOheng: CHEONGAN_OHENG[gan] ?? '토',
        zhiOheng: JIJI_OHENG[zhi] ?? '토',
      },
    });
  }
  if (seun) items.push({ topLabel: '세운', bottomLabel: String(year), ganji: seun });
  if (wolun) items.push({ topLabel: '월운', bottomLabel: `${month}월`, ganji: wolun });

  if (items.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: layout === 'compact' ? 6 : 10,
        flexWrap: 'nowrap',
      }}
    >
      {items.map((it, i) => (
        <MiniFlowCell key={i} {...it} ilgan={ilgan} />
      ))}
    </div>
  );
}

function MiniFlowCell({
  topLabel,
  bottomLabel,
  ganji,
  ilgan,
}: {
  topLabel: string;
  bottomLabel: string;
  ganji: Ganji;
  ilgan: string;
}) {
  const sipsung = deriveSipsung(ilgan, ganji.gan);
  const sipMeta = lookupSipsung(sipsung);
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 80,
        background: '#FFFFFF',
        border: '1px solid rgba(184,150,90,0.25)',
        borderRadius: 12,
        padding: '10px 8px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#8C6D3D',
          letterSpacing: '0.06em',
        }}
      >
        {topLabel}
      </div>
      <GanjiBox
        gan={ganji.gan}
        zhi={ganji.zhi}
        ganOheng={ganji.ganOheng}
        zhiOheng={ganji.zhiOheng}
        size="sm"
      />
      {sipsung && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: sipMeta?.color ?? '#7A7269',
            background: sipMeta?.soft ?? 'rgba(122,114,105,0.06)',
            padding: '1px 6px',
            borderRadius: 4,
          }}
        >
          {sipsung}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#7A7269' }}>{bottomLabel}</div>
    </div>
  );
}

/* helper imports satisfy — unused warning silence */
void CHEONGAN_KO;
void JIJI_KO;
