/**
 * #saju-card-share Develop · 다이어그램 3종 (자체 SVG)
 *
 * recharts 회피 사유:
 *  · 사주 카드는 read-only 표시 (호버/툴팁 불필요)
 *  · 번들 영향 0 (recharts ~360KB → SVG ~6KB)
 *  · html2canvas 캡처 시 SVG 더 안정적 (recharts 의 동적 ResponsiveContainer 가 0px width 캡처 위험)
 *
 * 3 다이어그램:
 *   A. OhengRadar — 5각 radar (목·화·토·금·수)
 *   B. SipsungDonut — 5분류 도넛 (비겁·식상·재성·관성·인성, 단순화)
 *   C. PillarSeasonRail — 4기둥 계절 매핑 가로 띠
 */

import type { Pillar, OhengType, SipSung, JiJangGan } from '@/types/saju';
import type { OhengTheme } from './_chrome';

/* ══════════════════════════════════════════════════════════════════
 * SSOT 5 오행 컬러
 * ═════════════════════════════════════════════════════════════════ */
const OHENG_HEX: Record<OhengType, string> = {
  목: '#4E7A57',
  화: '#B04A38',
  토: '#B07F38',
  금: '#7D7870',
  수: '#3E5F82',
};

/* ══════════════════════════════════════════════════════════════════
 * A. OhengRadar — 5각 분포
 *  · 천간 + 지지 + 지장간 본기 카운트 통합
 *  · 5축 radar (목·화·토·금·수)
 * ═════════════════════════════════════════════════════════════════ */
function countOhengWithJijanggan(
  pillars: Pillar[],
  jijanggan: JiJangGan[],
): Record<OhengType, number> {
  const dist: Record<OhengType, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };

  // 천간 + 지지
  for (const p of pillars) {
    if (!p.available) continue;
    if (p.천간오행) dist[p.천간오행 as OhengType]++;
    if (p.지지오행) dist[p.지지오행 as OhengType]++;
  }

  // 지장간 (본기만 — 1번째 자만 카운트, 가중치 0.5 — 순수 천간/지지보다 약하게)
  // 지장간 한자 → 오행 매핑은 calculator.ts 의 매핑 재사용 불가 (모듈 의존 회피) — 인라인
  const HANJA_OHENG: Record<string, OhengType> = {
    甲: '목', 乙: '목',
    丙: '화', 丁: '화',
    戊: '토', 己: '토',
    庚: '금', 辛: '금',
    壬: '수', 癸: '수',
  };
  for (const j of jijanggan) {
    if (!j.지장간 || j.지장간.length === 0) continue;
    const main = j.지장간[0];
    const o = HANJA_OHENG[main];
    if (o) dist[o] += 0.5;
  }
  return dist;
}

export function OhengRadar({
  theme,
  pillars,
  jijanggan,
  size = 180,
}: {
  theme: OhengTheme;
  pillars: Pillar[];
  jijanggan: JiJangGan[];
  size?: number;
}) {
  const dist = countOhengWithJijanggan(pillars, jijanggan);
  const max = Math.max(1, ...Object.values(dist));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.40;
  const rLabel = size * 0.48;

  // 5각 정점 — 12시 방향부터 시계 방향 (목·화·토·금·수)
  const ohengs: OhengType[] = ['목', '화', '토', '금', '수'];
  const angles = ohengs.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);

  // 각 오행 점 좌표
  const points = ohengs.map((o, i) => {
    const ratio = dist[o] / max;
    const x = cx + Math.cos(angles[i]) * r * ratio;
    const y = cy + Math.sin(angles[i]) * r * ratio;
    return { x, y, oheng: o, value: dist[o] };
  });

  // 다각형 path
  const polygonPath = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // 배경 그리드 (3 ring)
  const gridRings = [0.33, 0.67, 1.0].map((scale, idx) => {
    const ringPoints = ohengs.map((_, i) => {
      const x = cx + Math.cos(angles[i]) * r * scale;
      const y = cy + Math.sin(angles[i]) * r * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return { points: ringPoints, key: `ring-${idx}`, scale };
  });

  // 라벨 좌표
  const labels = ohengs.map((o, i) => {
    const x = cx + Math.cos(angles[i]) * rLabel;
    const y = cy + Math.sin(angles[i]) * rLabel;
    return { x, y, oheng: o };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block' }}
      aria-label="오행 분포 5각 radar"
    >
      {/* 배경 그리드 */}
      {gridRings.map((g) => (
        <polygon
          key={g.key}
          points={g.points}
          fill="none"
          stroke="rgba(184,150,90,0.18)"
          strokeWidth={0.8}
        />
      ))}
      {/* 축선 5개 */}
      {ohengs.map((_, i) => {
        const x = cx + Math.cos(angles[i]) * r;
        const y = cy + Math.sin(angles[i]) * r;
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="rgba(184,150,90,0.12)"
            strokeWidth={0.8}
          />
        );
      })}
      {/* 데이터 다각형 */}
      <polygon
        points={polygonPath}
        fill={theme.accentSoft}
        stroke={theme.accent}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* 데이터 점 */}
      {points.map((p) => (
        <circle
          key={`pt-${p.oheng}`}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill={OHENG_HEX[p.oheng]}
          stroke="#FFFFFF"
          strokeWidth={1.5}
        />
      ))}
      {/* 라벨 */}
      {labels.map((l) => (
        <text
          key={`lbl-${l.oheng}`}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={700}
          fill={OHENG_HEX[l.oheng]}
          fontFamily="'Noto Serif KR', serif"
        >
          {l.oheng}
        </text>
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * B. SipsungDonut — 5분류 도넛 (비겁·식상·재성·관성·인성)
 *  · 천간 위주 카운트 (지지 제외 — 단순화)
 * ═════════════════════════════════════════════════════════════════ */

// Round 2: SSOT 통합 — sipsungColor.ts 의 SIPSUNG_CATEGORY_COLOR 사용
import { SIPSUNG_CATEGORY_COLOR, lookupCategory } from '@/constants/sipsungColor';

/** 5분류 컬러 (SSOT) */
const SIPSUNG_COLOR: Record<string, string> = {
  비겁: SIPSUNG_CATEGORY_COLOR.비겁.deep,
  식상: SIPSUNG_CATEGORY_COLOR.식상.color,
  재성: SIPSUNG_CATEGORY_COLOR.재성.deep,
  관성: SIPSUNG_CATEGORY_COLOR.관성.color,
  인성: SIPSUNG_CATEGORY_COLOR.인성.color,
};

function countSipsung(sipsung: SipSung[]) {
  const dist: Record<string, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const s of sipsung) {
    if (!s.십성 || s.십성 === '일주' || s.십성 === '日主') continue;
    const parts = String(s.십성).split('/');
    for (const p of parts) {
      const cat = lookupCategory(p.trim());
      if (cat) dist[cat]++;
    }
  }
  return dist;
}

export function SipsungDonut({
  sipsung,
  size = 160,
}: {
  sipsung: SipSung[];
  size?: number;
}) {
  const dist = countSipsung(sipsung);
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const stroke = size * 0.16;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(184,150,90,0.18)" strokeWidth={stroke} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#7A7269">
          데이터 없음
        </text>
      </svg>
    );
  }

  // 호 path 빌더 — 시계 방향 시작 12시
  const cats = Object.entries(dist).filter(([, v]) => v > 0);
  let acc = 0;
  const segments = cats.map(([cat, v]) => {
    const startAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
    acc += v;
    const endAngle = (acc / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + Math.cos(startAngle) * r;
    const y1 = cy + Math.sin(startAngle) * r;
    const x2 = cx + Math.cos(endAngle) * r;
    const y2 = cy + Math.sin(endAngle) * r;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    return { cat, value: v, path, color: SIPSUNG_COLOR[cat] };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="십성 5분류 도넛"
      style={{ display: 'block' }}
    >
      {/* 배경 ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(184,150,90,0.10)"
        strokeWidth={stroke}
      />
      {/* 데이터 호 */}
      {segments.map((s) => (
        <path
          key={s.cat}
          d={s.path}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeLinecap="butt"
        />
      ))}
      {/* 중앙 총 수 */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={20}
        fontWeight={700}
        fill="#1A1A1A"
        fontFamily="'Noto Serif KR', serif"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fill="#7A7269"
        letterSpacing="0.05em"
      >
        十神 합계
      </text>
    </svg>
  );
}

/** 십성 도넛 우측 범례 — 카드에서 가로 배치 시 사용 */
export function SipsungLegend({ sipsung }: { sipsung: SipSung[] }) {
  const dist = countSipsung(sipsung);
  const cats: Array<keyof typeof dist> = ['비겁', '식상', '재성', '관성', '인성'];
  const meanings: Record<string, string> = {
    비겁: '자아, 경쟁',
    식상: '표현, 창작',
    재성: '재물, 실리',
    관성: '관계, 책임',
    인성: '학문, 배움',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {cats.map((cat) => (
        <div
          key={cat}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: SIPSUNG_COLOR[cat],
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 700, color: '#1A1A1A', minWidth: 32 }}>{cat}</span>
          <span style={{ color: '#7A7269', fontSize: 12 }}>{meanings[cat]}</span>
          <span
            style={{
              marginLeft: 'auto',
              fontWeight: 700,
              color: SIPSUNG_COLOR[cat],
              fontFeatureSettings: '"tnum"',
            }}
          >
            {dist[cat]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * D. Component12Unseong — 12 운성 사이클 원형 다이어그램
 *  · 12 단계 시계 방향 (절→태→양→장생→목욕→관대→건록→제왕→쇠→병→사→묘)
 *  · 4 기둥(시·일·월·년) 의 운성 위치 dot 표시 — 일주 강조 (16px ring)
 *  · 중앙: "당신의 인생 단계" + 일주 운성명 + 한 줄 풀이
 * ═════════════════════════════════════════════════════════════════ */

interface Unseong12Stage {
  hanja: string;
  ko: string;
  /** 한 줄 풀이 */
  meaning: string;
}

const UNSEONG_12_CYCLE: Unseong12Stage[] = [
  { hanja: '絶', ko: '절',   meaning: '끝과 새 시작 사이' },
  { hanja: '胎', ko: '태',   meaning: '잉태, 가능성' },
  { hanja: '養', ko: '양',   meaning: '양육, 준비' },
  { hanja: '長生', ko: '장생', meaning: '시작, 성장' },
  { hanja: '沐浴', ko: '목욕', meaning: '변화, 정화' },
  { hanja: '冠帶', ko: '관대', meaning: '성숙, 본격 활동' },
  { hanja: '建祿', ko: '건록', meaning: '안정, 자리 잡음' },
  { hanja: '帝旺', ko: '제왕', meaning: '절정, 최고조' },
  { hanja: '衰',   ko: '쇠',   meaning: '쇠퇴 시작' },
  { hanja: '病',   ko: '병',   meaning: '시련, 약화' },
  { hanja: '死',   ko: '사',   meaning: '끝, 정리' },
  { hanja: '墓',   ko: '묘',   meaning: '보관, 휴식' },
];

/**
 * 12 단계별 친절한 해석 — 사주 모르는 사람도 자기에게 적용 가능하게
 *  · everyday: 일상 비유 (어떤 시기·역할인지)
 *  · howToLive: 이 단계에 어떻게 살아야 결이 살아나는지 (권장 행동)
 *  · strength: 이 단계의 강점
 *  · caution: 이 단계의 주의점
 */
export interface Unseong12Detail {
  hanja: string;
  ko: string;
  everyday: string;       // 일상 비유
  howToLive: string;      // 권장 행동 — 이렇게 살면 좋아요
  strength: string;       // 강점
  caution: string;        // 주의점
}

export const UNSEONG_12_DETAILS: Record<string, Unseong12Detail> = {
  '절': {
    hanja: '絶', ko: '절',
    everyday: '단절과 이별 — 기존 결을 비우고 새 결로 갈아타는 자리',
    howToLive: '한 자리에 오래 머물지 말고 환경 변화를 두려워하지 마세요. 단절은 새로운 시작의 신호입니다. 묵은 인연, 물건, 습관을 정리하면 다음 길이 열립니다.',
    strength: '변화에 빠르게 적응하는 결, 한 자리에 매이지 않는 자유로움',
    caution: '안정감을 무시하면 인연이 얕아짐, 한 가지를 끝까지 매듭짓는 연습 필요',
  },
  '태': {
    hanja: '胎', ko: '태',
    everyday: '뱃속 아기 — 새 결이 안에서 자라는 자리',
    howToLive: '아직 드러나지 않은 잠재가 있어요. 조급해하지 말고 안에서 키우는 시간을 가지세요. 학습, 구상, 계획이 가장 깊어지는 시기.',
    strength: '잠재력 풍부, 늦게 피는 결, 직관과 통찰',
    caution: '결과를 너무 빨리 보려 하면 지침, 인내가 결을 살림',
  },
  '양': {
    hanja: '養', ko: '양',
    everyday: '갓난아기 — 보호받으며 자라는 자리',
    howToLive: '지켜주는 환경(가족, 멘토, 조직) 안에서 결이 살아납니다. 혼자 모든 것을 짊어지려 하지 말고 도움 청하기 좋은 시기.',
    strength: '품을 받아들이는 결, 인복(人福), 도움받는 자리',
    caution: '의존이 너무 깊으면 자립이 늦어짐, 점차 독립의 결단 필요',
  },
  '장생': {
    hanja: '長生', ko: '장생',
    everyday: '갓 태어난 아기 — 호기심, 에너지, 배움이 가득',
    howToLive: '새로 시작하는 힘이 강하니 진로 전환과 새 분야 도전이 잘 풀려요. 늦게 시작해도 탄력 받는 결입니다.',
    strength: '시작의 결, 에너지와 낙천, 사람들이 좋아함',
    caution: '시작만 많고 마무리 부족 위험, 한 가지를 끝까지 가져가는 연습',
  },
  '목욕': {
    hanja: '沐浴', ko: '목욕',
    everyday: '사춘기 — 흔들리고 매력이 피어나는 시기',
    howToLive: '변화, 이동, 매력이 두드러지는 결. 한곳에 오래 머무는 게 답답하니 의식적으로 안정 루틴(운동, 취미, 관계) 한 가지는 잡아두세요.',
    strength: '매력과 표현력, 사람들이 끌리는 결, 변화 적응',
    caution: '변동성 커서 결정 흔들림, 한 자리에 머무는 인내 필요',
  },
  '관대': {
    hanja: '冠帶', ko: '관대',
    everyday: '사회 첫 출근 — 자격, 옷, 이름값을 갖추는 시기',
    howToLive: '형식, 자격, 이름값이 결을 살리는 자리. 자격증, 학위, 직함을 의식적으로 쌓아두세요. 사회적 인정이 큰 동력.',
    strength: '자기 갖추는 힘, 격식과 세련됨, 외형 빠르게 성장',
    caution: '겉치레에 매몰되지 않게, 안의 깊이도 함께 다지기',
  },
  '건록': {
    hanja: '建祿', ko: '건록',
    everyday: '커리어 안정기 — 자기 발로 서서 월급 받는 시기',
    howToLive: '자기 발로 서는 가장 안정된 자리. 노력한 만큼 결실이 또렷하게 돌아오니, 꾸준한 실력 다지기와 자기 영역 구축에 집중하세요.',
    strength: '독립, 실력, 꾸준함, 책임감 강한 결',
    caution: '너무 자기 결대로만 가면 외로워짐, 협업과 열린 자세 의식',
  },
  '제왕': {
    hanja: '帝旺', ko: '제왕',
    everyday: '인생 정점 — 권력과 영향력이 가장 큰 시기',
    howToLive: '그 자리에서 정점입니다. 다만 너무 강해 옆 사람과 부딪히기 쉬우니 한 박자 양보하는 연습이 평생 과제예요.',
    strength: '리더십, 결단, 강한 추진력, 카리스마',
    caution: '독선과 외로움 위험, 옆 의견 의식적으로 듣는 자리 마련',
  },
  '쇠': {
    hanja: '衰', ko: '쇠',
    everyday: '은퇴 직전 — 후임에게 자리를 물려주는 시기',
    howToLive: '결을 다듬고 다음 사람에게 넘기는 자리. 욕심내지 않으면 평탄하고, 멘토링, 후배 양성, 글쓰기, 기록이 잘 풀립니다.',
    strength: '경험, 여유, 이양의 결, 다듬어진 안목',
    caution: '소외감과 우울 주의, 활동성 의식적 유지',
  },
  '병': {
    hanja: '病', ko: '병',
    everyday: '몸이 아픈 시기 — 무리하지 말고 회복이 본업',
    howToLive: '본인이 돌봐야 하는 결. 무리하면 가장 먼저 탈이 나는 자리이니 건강과 휴식 우선순위를 높이세요. 의료, 돌봄, 심리 분야 적합.',
    strength: '돌봄과 공감, 섬세함, 위기 감지력',
    caution: '체력 부담, 몸 신호에 귀 기울이기, 자기연민 주의',
  },
  '사': {
    hanja: '死', ko: '사',
    everyday: '인생 마무리 — 거두고 정리하는 시기',
    howToLive: '끝맺음과 정리의 자리. 새로 벌이기보다 마무리와 완결이 본업입니다. 종교, 연구, 기록, 예술 분야에 적합한 결.',
    strength: '깊이와 통찰, 사색, 완결 능력, 영성',
    caution: '추진력 약함, 새 도전 미루기, 실행력 의식적 키우기',
  },
  '묘': {
    hanja: '墓', ko: '묘',
    everyday: '창고 — 깊이 묻어두고 시간이 지나야 가치가 보임',
    howToLive: '깊이 묻어두는 자리. 시간이 지나야 가치가 드러나는 결이라 장기 자산, 연구, 콜렉션, 아카이브 분야가 잘 어울립니다.',
    strength: '저장과 축적, 보존의 결, 장기 시야',
    caution: '결과 늦게 옴, 단기 성과 압박에 쉽게 흔들림, 인내 필요',
  },
};

export function getUnseongDetail(ko: string): Unseong12Detail | null {
  return UNSEONG_12_DETAILS[ko] || null;
}

/** lunar-javascript 가 반환하는 다양한 표기를 정규화 — '長生'/'장생'/'长生' 모두 동일 인덱스 */
// lunar-javascript 가 반환하는 간체/이칭 운성 → 사이클 정체(正體) 표준화.
//   2026-06-02 fix — 기존엔 长/禄 만 변환해 养(養)·绝(絶)·带(帶)·临官(建祿) 누락 → 일부 운성(예 養) "데이터 없음".
const UNSEONG_S2T: Record<string, string> = {
  '长': '長', '养': '養', '禄': '祿', '带': '帶', '绝': '絶', '临': '臨',
};
function canonicalUnseong(raw: string): string {
  let c = (raw || '').trim().split('').map((ch) => UNSEONG_S2T[ch] ?? ch).join('');
  if (c === '臨官' || c === '臨官格') c = '建祿'; // lunar 의 臨官 = 한국 명리 建祿
  return c;
}
function normalizeUnseong(s: string): number {
  if (!s) return -1;
  const cleaned = canonicalUnseong(s);
  return UNSEONG_12_CYCLE.findIndex(
    (u) => u.hanja === cleaned || u.ko === cleaned,
  );
}

export function Component12Unseong({
  unyoung,
  size = 280,
}: {
  unyoung: Array<{ position: string; 운성: string }>;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.44;     // dot 반경 (Stage 7b: 0.42 → 0.44, 외곽 도트 분리감 ↑)
  const rLabel = size * 0.36;     // 한자 반경
  const rInner = size * 0.18;     // 중앙 영역

  // 12 단계 좌표 — 12시 방향(절) 시작, 시계 방향
  const stages = UNSEONG_12_CYCLE.map((stage, i) => {
    const angle = -Math.PI / 2 + (i / 12) * 2 * Math.PI;
    return {
      ...stage,
      idx: i,
      angle,
      labelX: cx + Math.cos(angle) * rLabel,
      labelY: cy + Math.sin(angle) * rLabel,
      dotX: cx + Math.cos(angle) * rOuter,
      dotY: cy + Math.sin(angle) * rOuter,
    };
  });

  // 4 기둥 위치 매핑
  const PILLAR_POS_LABEL: Record<string, { ko: string; han: string }> = {
    '시지': { ko: '時', han: '時' },
    '일지': { ko: '日', han: '日' },
    '월지': { ko: '月', han: '月' },
    '년지': { ko: '年', han: '年' },
  };

  const pillarDots = unyoung
    .map((u) => {
      const idx = normalizeUnseong(u.운성);
      if (idx < 0) return null;
      const stage = stages[idx];
      const isDay = u.position === '일지';
      const meta = PILLAR_POS_LABEL[u.position];
      return {
        idx,
        position: u.position,
        han: meta?.han || u.position,
        x: stage.dotX,
        y: stage.dotY,
        isDay,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // 일주 운성 (중앙 강조)
  const dayUnseong = (() => {
    const day = unyoung.find((u) => u.position === '일지');
    if (!day) return null;
    const idx = normalizeUnseong(day.운성);
    if (idx < 0) return null;
    return UNSEONG_12_CYCLE[idx];
  })();

  // Stage 7e-2: 12운성 단계별 의미 컬러 (인생의 흐름)
  const STAGE_PHASE_COLOR = (idx: number): string => {
    if (idx <= 1) return '#8C6D3D';      // 절·태 (시작 전·잉태) — 핑크
    if (idx === 2) return '#A4B79A';     // 양 — 연두
    if (idx <= 5) return '#8C6D3D';      // 장생·목욕·관대 (성장) — 그린
    if (idx <= 7) return '#B8965A';      // 건록·제왕 (절정) — 골드
    if (idx <= 9) return '#D08F5A';      // 쇠·병 (쇠퇴) — 주황
    return '#7A7269';                     // 사·묘 (정리) — 회색
  };
  const STAGE_PHASE_LABEL = (idx: number): string => {
    if (idx <= 1) return '시작 전';
    if (idx === 2) return '잉태와 양육';
    if (idx <= 5) return '성장';
    if (idx <= 7) return '절정';
    if (idx <= 9) return '쇠퇴';
    return '정리';
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block' }}
      aria-label="12 운성 사이클"
    >
      <defs>
        {/* Stage 7b: 중앙 영역 라디얼 그라디언트 */}
        <radialGradient id="unseong-center-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(184,150,90,0.22)" />
          <stop offset="55%" stopColor="rgba(184,150,90,0.08)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* 외곽 ring 그라디언트 */}
        <linearGradient id="unseong-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(184,150,90,0.30)" />
          <stop offset="50%" stopColor="rgba(184,150,90,0.55)" />
          <stop offset="100%" stopColor="rgba(184,150,90,0.30)" />
        </linearGradient>
        {/* 일주 stage 빛 효과 라디얼 */}
        <radialGradient id="unseong-stage-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(184,150,90,0.45)" />
          <stop offset="60%" stopColor="rgba(184,150,90,0.15)" />
          <stop offset="100%" stopColor="rgba(184,150,90,0)" />
        </radialGradient>
      </defs>

      {/* Stage 7b 추가: 외곽 그라디언트 ring */}
      <circle
        cx={cx}
        cy={cy}
        r={rOuter + 6}
        fill="none"
        stroke="url(#unseong-ring-grad)"
        strokeWidth={1.5}
      />
      {/* 외곽 ring */}
      <circle
        cx={cx}
        cy={cy}
        r={rOuter}
        fill="none"
        stroke="rgba(184,150,90,0.32)"
        strokeWidth={1.2}
      />
      {/* 12 단계 분할 가는 선 (Stage 7b 추가) */}
      {stages.map((s, i) => {
        const innerX = cx + Math.cos(s.angle) * (rInner + 4);
        const innerY = cy + Math.sin(s.angle) * (rInner + 4);
        const outerX = cx + Math.cos(s.angle) * rOuter;
        const outerY = cy + Math.sin(s.angle) * rOuter;
        return (
          <line
            key={`tick-${i}`}
            x1={innerX}
            y1={innerY}
            x2={outerX}
            y2={outerY}
            stroke="rgba(184,150,90,0.10)"
            strokeWidth={0.8}
          />
        );
      })}
      {/* 중앙 영역 라디얼 fill */}
      <circle
        cx={cx}
        cy={cy}
        r={rInner + 4}
        fill="url(#unseong-center-grad)"
      />
      {/* 내부 ring (점선) */}
      <circle
        cx={cx}
        cy={cy}
        r={rInner + 8}
        fill="none"
        stroke="rgba(184,150,90,0.30)"
        strokeWidth={1}
        strokeDasharray="3 5"
      />

      {/* Stage 7e-2: 12 단계 컬러 마이크로 도트 (외곽 ring 위 단계별 컬러) */}
      {stages.map((s, i) => {
        const phaseColor = STAGE_PHASE_COLOR(i);
        const isDayStage = dayUnseong?.hanja === s.hanja;
        const dotR = isDayStage ? 4.5 : 3;
        const r = rOuter + 6;
        const dotX = cx + Math.cos(s.angle) * r;
        const dotY = cy + Math.sin(s.angle) * r;
        return (
          <circle
            key={`phase-dot-${i}`}
            cx={dotX}
            cy={dotY}
            r={dotR}
            fill={phaseColor}
            stroke={isDayStage ? '#FFFFFF' : 'none'}
            strokeWidth={isDayStage ? 2 : 0}
            opacity={isDayStage ? 1 : 0.55}
          />
        );
      })}

      {/* 12 단계 한자 + 한국어 */}
      {stages.map((s, i) => {
        const isDayStage = dayUnseong?.hanja === s.hanja;
        const phaseColor = STAGE_PHASE_COLOR(i);
        return (
          <g key={i}>
            {/* 일주 stage 빛 효과 (외곽 펄스) */}
            {isDayStage && (
              <>
                <circle
                  cx={s.labelX}
                  cy={s.labelY + 2}
                  r={26}
                  fill="url(#unseong-stage-glow)"
                />
                <circle
                  cx={s.labelX}
                  cy={s.labelY + 2}
                  r={20}
                  fill="rgba(184,150,90,0.10)"
                  stroke="rgba(184,150,90,0.55)"
                  strokeWidth={1.5}
                />
                <circle
                  cx={s.labelX}
                  cy={s.labelY + 2}
                  r={17}
                  fill="none"
                  stroke="rgba(184,150,90,0.30)"
                  strokeWidth={0.8}
                />
              </>
            )}
            <text
              x={s.labelX}
              y={s.labelY - 5}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={s.hanja.length === 2 ? 11 : 14}
              fontWeight={isDayStage ? 900 : 600}
              fill={isDayStage ? '#8C6D3D' : phaseColor}
              fontFamily="'Noto Serif KR', serif"
              opacity={isDayStage ? 1 : 0.85}
            >
              {s.hanja}
            </text>
            <text
              x={s.labelX}
              y={s.labelY + 10}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fontWeight={isDayStage ? 800 : 500}
              fill={isDayStage ? '#8C6D3D' : '#7A7269'}
              letterSpacing="0.02em"
            >
              {s.ko}
            </text>
          </g>
        );
      })}

      {/* 4 기둥 dot — Stage 7b 컬러 분리 (시=핑크 / 일=골드 / 월=블루 / 년=그린) */}
      {pillarDots.map((p, i) => {
        const colorMap: Record<string, string> = {
          '시지': '#8C6D3D',
          '일지': '#B8965A',
          '월지': '#8C6D3D',
          '년지': '#8C6D3D',
        };
        const dotColor = colorMap[p.position] || '#B8965A';
        return (
          <g key={`dot-${i}`}>
            {/* 일주 외곽 펄스 ring */}
            {p.isDay && (
              <>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={1}
                  opacity={0.35}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={11}
                  fill="none"
                  stroke={dotColor}
                  strokeWidth={1.8}
                  opacity={0.65}
                />
              </>
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={p.isDay ? 8 : 5.5}
              fill={dotColor}
              stroke="#FFFFFF"
              strokeWidth={1.8}
            />
            <text
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={p.isDay ? 9 : 7.5}
              fontWeight={900}
              fill="#FFFFFF"
              fontFamily="'Noto Serif KR', serif"
            >
              {p.han}
            </text>
          </g>
        );
      })}

      {/* Stage 7e-2: 중앙 영역 — 일주 운성 박스 (배경 + 외곽 + 단계 phase 라벨) */}
      {dayUnseong && (() => {
        const dayIdx = UNSEONG_12_CYCLE.findIndex((u) => u.hanja === dayUnseong.hanja);
        const phaseColor = STAGE_PHASE_COLOR(dayIdx);
        const phaseLabel = STAGE_PHASE_LABEL(dayIdx);
        return (
          <g>
            {/* 중앙 박스 배경 */}
            <rect
              x={cx - 56}
              y={cy - 38}
              width={112}
              height={76}
              rx={14}
              fill="rgba(255,255,255,0.85)"
              stroke="rgba(184,150,90,0.40)"
              strokeWidth={1.2}
            />
            {/* phase 컬러 strip 좌측 */}
            <rect
              x={cx - 56}
              y={cy - 38}
              width={4}
              height={76}
              rx={2}
              fill={phaseColor}
              opacity={0.85}
            />
            <text
              x={cx + 2}
              y={cy - 26}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8.5}
              fill={phaseColor}
              fontWeight={800}
              letterSpacing="0.16em"
            >
              {phaseLabel.toUpperCase()}
            </text>
            <text
              x={cx + 2}
              y={cy - 6}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={26}
              fontWeight={900}
              fill="#1A1A1A"
              fontFamily="'Noto Serif KR', serif"
            >
              {dayUnseong.hanja}
            </text>
            <text
              x={cx + 2}
              y={cy + 14}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={800}
              fill="#1A1A1A"
              letterSpacing="0.04em"
            >
              {dayUnseong.ko}
            </text>
            <text
              x={cx + 2}
              y={cy + 28}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fontWeight={500}
              fill="#7A7269"
            >
              {dayUnseong.meaning}
            </text>
          </g>
        );
      })()}
      {!dayUnseong && (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fill="#7A7269"
        >
          데이터 없음
        </text>
      )}
    </svg>
  );
}

/** 일주 운성 한 줄 풀이 (Component12Unseong 외부 카드용) */
export function getDayUnseongMeaning(unyoung: Array<{ position: string; 운성: string }>): {
  hanja: string;
  ko: string;
  meaning: string;
} | null {
  const day = unyoung.find((u) => u.position === '일지');
  if (!day) return null;
  const idx = normalizeUnseong(day.운성);
  if (idx < 0) return null;
  return UNSEONG_12_CYCLE[idx];
}

/* ══════════════════════════════════════════════════════════════════
 * C. PillarSeasonRail — 4 기둥 가로 띠 (시→일→월→년)
 *  · 각 기둥 = 천간/지지 컬러칩 + 계절 라벨
 * ═════════════════════════════════════════════════════════════════ */

/** 지지 → 계절 매핑 (월령 기준) */
const ZHI_SEASON: Record<string, string> = {
  寅: '초봄', 卯: '한봄', 辰: '늦봄',
  巳: '초여름', 午: '한여름', 未: '늦여름',
  申: '초가을', 酉: '한가을', 戌: '늦가을',
  亥: '초겨울', 子: '한겨울', 丑: '늦겨울',
};

export function PillarSeasonRail({ pillars }: { pillars: Pillar[] }) {
  const order = [3, 2, 1, 0];
  const labels = ['시', '일', '월', '년'];
  const labelsHanja = ['時', '日', '月', '年'];
  const labelsKo = ['하루의 끝', '나의 자리', '계절', '시대'];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
      }}
    >
      {order.map((idx, i) => {
        const p = pillars[idx];
        const isDay = idx === 2;
        const available = p?.available !== false;
        const ganColor = available ? OHENG_HEX[p?.천간오행 as OhengType] : '#999';
        const zhiColor = available ? OHENG_HEX[p?.지지오행 as OhengType] : '#999';
        const season = available && p?.지지 ? ZHI_SEASON[p.지지] : '';

        return (
          <div
            key={i}
            style={{
              textAlign: 'center',
              background: isDay ? 'rgba(184,150,90,0.10)' : '#F8F5EE',
              border: isDay
                ? '1.5px solid #B8965A'
                : '1px solid #E5DFD0',
              borderRadius: 10,
              padding: '8px 4px 6px',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isDay ? '#8C6D3D' : '#7A7269',
                letterSpacing: '0.05em',
                marginBottom: 4,
              }}
            >
              {labelsHanja[i]} {labels[i]}
            </div>
            <div
              style={{
                fontSize: 8.5,
                color: '#7A7269',
                marginBottom: 6,
                lineHeight: 1.3,
              }}
            >
              {labelsKo[i]}
            </div>
            {available ? (
              <>
                <div
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: ganColor,
                    lineHeight: 1.05,
                  }}
                >
                  {p.천간}
                </div>
                <div
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: zhiColor,
                    lineHeight: 1.05,
                    marginTop: 2,
                  }}
                >
                  {p.지지}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#7A7269',
                    marginTop: 4,
                    lineHeight: 1.3,
                  }}
                >
                  {season}
                </div>
              </>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  color: '#999',
                  fontStyle: 'italic',
                  padding: '12px 0',
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
