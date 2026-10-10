/**
 * #saju-card-share Round 2 · 십성(十神) 컬러 매핑 SSOT
 *
 * 10 십성 → 5 카테고리 (음양 페어):
 *   비겁(녹) — 비견·겁재
 *   식상(분) — 식신·상관
 *   재성(금) — 정재·편재
 *   관성(청) — 정관·편관
 *   인성(자) — 정인·편인
 *
 * 적용 위치 (모두 동일 매핑 import):
 *   - SajuCardPage 8글자 카드 십성 라벨 (천간/지지 별)
 *   - 신살 섹션 4 카드 (chip 컬러)
 *   - _diagrams.tsx SipsungDonut + SipsungLegend
 *   - _export-layout.tsx 1×1 / 9×16 / 1200×630 모든 모드
 *
 * 점신 패턴 참고 + 명리학 5분류 정통 (자평진전 / 적천수).
 *
 * 네이밍:
 *   - main: 카테고리 메인 (음 측, 부드러운 톤) — 정재/식신/정관/정인/비견
 *   - deep: 카테고리 deep (양 측, 강한 톤) — 편재/상관/편관/편인/겁재
 */

export type SipsungCategory = '비겁' | '식상' | '재성' | '관성' | '인성';

export type SipsungName =
  | '비견' | '겁재'
  | '식신' | '상관'
  | '정재' | '편재'
  | '정관' | '편관'
  | '정인' | '편인';

export interface SipsungColorMeta {
  /** Hex color */
  color: string;
  /** Soft background (rgba ~10% alpha) */
  soft: string;
  /** 5분류 카테고리 */
  category: SipsungCategory;
  /** 한자 */
  hanja: string;
  /** 한 줄 의미 */
  meaning: string;
}

/** 10 십성 컬러 + 메타 — Round 2 spec 정렬 */
export const SIPSUNG_COLOR: Record<SipsungName, SipsungColorMeta> = {
  // 비겁 (녹)
  비견: {
    color: '#4E7A57',
    soft: 'rgba(78,122,87,0.10)',
    category: '비겁',
    hanja: '比肩',
    meaning: '나와 같은 자리 — 동료와 경쟁자',
  },
  겁재: {
    color: '#355A3E',
    soft: 'rgba(53,90,62,0.10)',
    category: '비겁',
    hanja: '劫財',
    meaning: '재물을 빼앗기는 결 — 양면적 동지',
  },
  // 식상 (분)
  식신: {
    color: '#B04A38',
    soft: 'rgba(176,74,56,0.10)',
    category: '식상',
    hanja: '食神',
    meaning: '내가 만들어내는 결 — 표현과 창작',
  },
  상관: {
    color: '#8A3326',
    soft: 'rgba(138,51,38,0.10)',
    category: '식상',
    hanja: '傷官',
    meaning: '재능과 반항의 결 — 날카로운 표현',
  },
  // 재성 (금)
  정재: {
    color: '#B07F38',
    soft: 'rgba(176,127,56,0.12)',
    category: '재성',
    hanja: '正財',
    meaning: '꾸준한 재물 — 노력의 결과',
  },
  편재: {
    color: '#8A6226',
    soft: 'rgba(138,98,38,0.12)',
    category: '재성',
    hanja: '偏財',
    meaning: '큰 재물 흐름 — 사업과 투자',
  },
  // 관성 (청)
  정관: {
    color: '#3E5F82',
    soft: 'rgba(62,95,130,0.10)',
    category: '관성',
    hanja: '正官',
    meaning: '책임과 명예 — 안정된 자리',
  },
  편관: {
    color: '#2A4560',
    soft: 'rgba(42,69,96,0.10)',
    category: '관성',
    hanja: '偏官',
    meaning: '강한 압박 — 도전과 돌파',
  },
  // 인성 (자)
  정인: {
    color: '#7A5C7E',
    soft: 'rgba(122,92,126,0.10)',
    category: '인성',
    hanja: '正印',
    meaning: '받아들이는 결 — 학문과 어머니',
  },
  편인: {
    color: '#5C4360',
    soft: 'rgba(92,67,96,0.10)',
    category: '인성',
    hanja: '偏印',
    meaning: '독특한 직관 — 종교와 예술',
  },
};

/** 5 카테고리 메타 (도넛/legend 용) */
export const SIPSUNG_CATEGORY_COLOR: Record<
  SipsungCategory,
  { color: string; deep: string; soft: string; label: string; meaning: string }
> = {
  비겁: { color: '#4E7A57', deep: '#355A3E', soft: 'rgba(78,122,87,0.10)', label: '자아, 경쟁', meaning: '독립심과 자기 길' },
  식상: { color: '#B04A38', deep: '#8A3326', soft: 'rgba(176,74,56,0.10)', label: '표현, 창작', meaning: '만들고 나누는 힘' },
  재성: { color: '#B07F38', deep: '#8A6226', soft: 'rgba(176,127,56,0.12)', label: '재물, 실리', meaning: '돈의 흐름과 자원' },
  관성: { color: '#3E5F82', deep: '#2A4560', soft: 'rgba(62,95,130,0.10)', label: '관계, 책임', meaning: '권위와 명예의 자리' },
  인성: { color: '#7A5C7E', deep: '#5C4360', soft: 'rgba(122,92,126,0.10)', label: '학문, 배움', meaning: '받아들이고 키우는 힘' },
};

/** 한자 (中) → 한국어 정규화 — calculator(lunar-javascript) 출력 대응.
 *  ⚠️ lunar 는 간체자(七杀·伤官·偏财·正财·劫财)를 반환한다. 번체만 넣으면 절반이 미매칭되니
 *  간체·번체·한국어 표기를 모두 키로 둔다 (2026-06-13 fix — RelflowCards "전부 없음" 버그 근절). */
const HANJA_TO_KO: Record<string, SipsungName> = {
  比肩: '비견',
  劫財: '겁재', 劫财: '겁재',
  食神: '식신',
  傷官: '상관', 伤官: '상관',
  正財: '정재', 正财: '정재',
  偏財: '편재', 偏财: '편재',
  正官: '정관',
  偏官: '편관', 七殺: '편관', 七杀: '편관', 칠살: '편관',
  正印: '정인', 偏印: '편인',
};

/**
 * 십성 문자열 1토큰 → 한국어 정통명 정규화.
 * 한국어면 그대로, 간체·번체 한자면 변환. "/" 다중 토큰은 호출부에서 분리해 넘길 것.
 * 매칭 실패(일주·日主·미지값) 시 null.
 */
export function normalizeSipsungKo(s: string | undefined | null): SipsungName | null {
  if (!s) return null;
  const t = String(s).trim();
  if (!t || t === '일주' || t === '日主') return null;
  if (t in SIPSUNG_COLOR) return t as SipsungName;
  return HANJA_TO_KO[t] ?? null;
}

/**
 * 십성 문자열 → SIPSUNG_COLOR 항목 lookup.
 * 한자/한국어 모두 지원, "/" 구분된 다중 십성 (지지의 지장간 십성) 은 첫 항목 사용.
 */
export function lookupSipsung(s: string | undefined | null): SipsungColorMeta | null {
  if (!s) return null;
  const first = String(s).split('/')[0].trim();
  if (!first || first === '일주' || first === '日主') return null;
  if (first in SIPSUNG_COLOR) return SIPSUNG_COLOR[first as SipsungName];
  const ko = HANJA_TO_KO[first];
  if (ko) return SIPSUNG_COLOR[ko];
  return null;
}

/** 카테고리 lookup — donut/legend 용 */
export function lookupCategory(name: string | undefined | null): SipsungCategory | null {
  const meta = lookupSipsung(name);
  return meta?.category ?? null;
}
