/**
 * 주제 10종 SSOT — 단일 진본
 *
 * 근거: docs/prd/주제별심층_10종_일관성SSOT_v1.md
 * 정책 (2026-04-22 준기 확정):
 *   1. 같은 사주 → 10주제 결과 모순 절대 금지
 *   2. 인접 주제(연애↔재회↔결혼 / 합격이직↔직업↔사업) 영역 침범 금지
 *   3. 한자 / 컬러 / 딱지 / lens 모두 이 파일이 SSOT
 *   4. 홈·라우터·서버·프롬프트가 모두 이 파일을 참조 (드리프트 0)
 *
 * 사용:
 *   import { TOPIC_REGISTRY, TOPIC_IDS, normalizeTopicId } from '@/constants/topics';
 */

/** 주제 ID — 순서 중요 (홈 노출 순서) */
export const TOPIC_IDS = [
  'love',     // 1. 연애 (HOT)
  'reunion',  // 2. 재회 (HOT)
  'marriage', // 3. 결혼
  'wealth',   // 4. 재물 (추천)
  'exam',     // 5. 합격·이직 (HOT)
  'business', // 6. 사업 (추천)
  'health',   // 7. 건강
  'move',     // 8. 이사·이동
  'study',    // 9. 학업
  'career',   // 10. 직업
] as const;

export type TopicId = typeof TOPIC_IDS[number];

/** 딱지 — 인기/추천만 (이모지 X · 텍스트만) */
export type TopicBadge = '인기' | '추천' | null;

export interface TopicMeta {
  /** 주제 ID (서버 키와 동일) */
  id: TopicId;
  /** 한국어 정식명 (UI 라벨) */
  label: string;
  /** 한자 1자 (브랜드 마크용) */
  kanji: string;
  /** SSOT 컬러 — Tailwind 외부에서도 인라인 스타일로 사용 */
  color: string;
  /** 인기/추천 딱지 */
  badge: TopicBadge;
  /** 카드 서브 카피 (홈 그리드용 · 25자 이하) */
  subCopy: string;
  /** Lens — 이 주제가 다루는 핵심 (서버 프롬프트 분기용) */
  lens: string;
  /** 다루지 않는 것 — 인접 주제로 보낼 영역 (모순 방지) */
  excludedScope: { reason: string; redirectTo: TopicId }[];
  /** 라우터 path */
  path: string;
  /** 인포그래픽 타입 (10주제 모두 다른 타입) */
  inforgraphicType: string;
}

/** 10주제 SSOT 레지스트리 */
export const TOPIC_REGISTRY: Record<TopicId, TopicMeta> = {
  love: {
    id: 'love',
    label: '연애운',
    // 2026-04-26 Phase D'-2 Bundle 2: 緣(인연) → 桃(도화) — mockup 진본 우선.
    //   사유: 桃 = 사주 직접 한자(도화살), 緣 = 일반 인연 (재회 復와 인접 — UX 헷갈림).
    //   D∞ 원칙: mockup 진본 디자인 우선.
    kanji: '桃',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: '인기',
    subCopy: '만남, 관계, 인연 흐름',
    lens: '일반 만남, 관계 흐름, 매력 발산, 연애 패턴',
    excludedScope: [
      { reason: '결혼 timing/배우자 결', redirectTo: 'marriage' },
      { reason: '헤어진 사람과의 재회', redirectTo: 'reunion' },
    ],
    path: '/topic/love',
    inforgraphicType: '관계 다이어그램 (인연 별자리 5노드 + 강도선)',
  },
  reunion: {
    id: 'reunion',
    label: '재회운',
    kanji: '復',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: '인기',
    subCopy: '헤어진 사람과의 흐름',
    lens: '헤어진 사람과의 재결합 가능성, timing, 접촉 방향',
    excludedScope: [
      { reason: '일반 새 만남', redirectTo: 'love' },
      { reason: '결혼 결정', redirectTo: 'marriage' },
    ],
    path: '/topic/reunion',
    inforgraphicType: '회복 곡선 (재회 가능성 % + 시점 마커)',
  },
  marriage: {
    id: 'marriage',
    label: '결혼운',
    kanji: '婚',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: null,
    subCopy: '인연 시기와 배우자 결',
    lens: '결혼 timing, 배우자 결, 결혼 후 생활 패턴',
    excludedScope: [
      { reason: '연애 일반', redirectTo: 'love' },
      { reason: '재회 결정', redirectTo: 'reunion' },
    ],
    path: '/topic/marriage',
    inforgraphicType: '결혼 timing 타임라인 (±3년 윈도우 + 배우자 결 카드)',
  },
  wealth: {
    id: 'wealth',
    label: '재물운',
    kanji: '財',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: '추천',
    subCopy: '돈, 투자, 현금흐름 변곡',
    lens: '돈의 결, 투자, 현금흐름, 재물 timing',
    excludedScope: [
      { reason: '사업 결정', redirectTo: 'business' },
      { reason: '직장 수입 구조', redirectTo: 'career' },
    ],
    path: '/topic/wealth',
    inforgraphicType: '현금흐름 곡선 (12개월 라인차트 + 변곡점 마커)',
  },
  exam: {
    id: 'exam',
    label: '합격 이직운',
    kanji: '進',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: '인기',
    subCopy: '시험과 이직 결정 시기',
    lens: '시험, 자격증, 이직, 전직 변동의 timing 과 방향',
    excludedScope: [
      { reason: '평생 직업 적성', redirectTo: 'career' },
      { reason: '창업과 자영업 결정', redirectTo: 'business' },
    ],
    path: '/topic/exam',
    inforgraphicType: '변동 leverage 차트 (timing 윈도우 + 방향 화살표)',
  },
  business: {
    id: 'business',
    label: '사업운',
    kanji: '業',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: '추천',
    subCopy: '창업과 자영업 흐름과 시기',
    lens: '자영업과 창업의 결, 재무 리스크, 사업 timing',
    excludedScope: [
      { reason: '직장인 커리어', redirectTo: 'career' },
      { reason: '단기 시험과 이직', redirectTo: 'exam' },
    ],
    path: '/topic/business',
    inforgraphicType: '사업 risk, return 매트릭스 (2x2 사분면 + 사주 위치점)',
  },
  health: {
    id: 'health',
    label: '건강운',
    kanji: '壽',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: null,
    subCopy: '체질, 기운, 주의 시기',
    lens: '체질, 기운, 올해 주의 시기, 생활 습관',
    excludedScope: [],
    path: '/topic/health',
    inforgraphicType: '체질 레이더 (오행 균형 + 주의 시기 달력)',
  },
  move: {
    id: 'move',
    label: '이사 이동운',
    kanji: '移',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: null,
    subCopy: '이사 이동 길흉 방향',
    lens: '주거 이전, 이동, 여행 timing 과 방향',
    excludedScope: [
      { reason: '직장 이직', redirectTo: 'exam' },
    ],
    path: '/topic/move',
    inforgraphicType: '방향, timing 컴퍼스 (8방위 + 길/흉 기간 표시)',
  },
  study: {
    id: 'study',
    label: '학업운',
    kanji: '學',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: null,
    subCopy: '시험, 집중력, 지식 흡수',
    lens: '학업, 집중력, 지식 흡수, 학습 패턴',
    excludedScope: [
      { reason: '시험 합격 timing', redirectTo: 'exam' },
      { reason: '평생 직업 결', redirectTo: 'career' },
    ],
    path: '/topic/study',
    inforgraphicType: '집중력 패턴 (시간대별 집중도 + 추천 학습 시점)',
  },
  career: {
    id: 'career',
    label: '직업운',
    kanji: '官',
    color: '#8C6D3D', // 2026-10-10 v9 — 주제별 색 폐기 (금 하나)
    badge: null,
    subCopy: '커리어, 승진, 평생 결',
    lens: '평생의 일의 결, 적성, 승진 흐름, 조직 내 패턴',
    excludedScope: [
      { reason: '시험과 이직 timing', redirectTo: 'exam' },
      { reason: '자영업과 창업', redirectTo: 'business' },
    ],
    path: '/topic/career',
    inforgraphicType: '커리어 타임라인 (10년 단위 + 승진 마커)',
  },
};

/**
 * 레거시 ID 정규화 — 과거 'moving' 등 호출이 들어와도 통과시킴.
 * 새 코드는 모두 표준 ID(TopicId) 사용.
 */
const TOPIC_ID_ALIASES: Record<string, TopicId> = {
  moving: 'move',          // 서버 구버전 키
  reconciliation: 'reunion', // 호환
  job: 'career',
  company: 'career',
  marry: 'marriage',
  test: 'exam',
  exam_job: 'exam',
};

/** 들어온 임의 문자열을 표준 TopicId 로 정규화. 못 찾으면 null. */
export function normalizeTopicId(raw: string | undefined | null): TopicId | null {
  if (!raw) return null;
  const v = String(raw).toLowerCase().trim();
  if ((TOPIC_REGISTRY as Record<string, TopicMeta>)[v]) return v as TopicId;
  if (TOPIC_ID_ALIASES[v]) return TOPIC_ID_ALIASES[v];
  return null;
}

/** TOPIC_REGISTRY 를 노출 순서대로 배열로 반환 (홈 카드 매핑용) */
export function listTopics(): TopicMeta[] {
  return TOPIC_IDS.map((id) => TOPIC_REGISTRY[id]);
}

/** 컬러 맵 (구버전 호환 · 가능하면 TOPIC_REGISTRY[id].color 직접 사용) */
export const TOPIC_COLORS: Record<TopicId, string> = TOPIC_IDS.reduce(
  (acc, id) => {
    acc[id] = TOPIC_REGISTRY[id].color;
    return acc;
  },
  {} as Record<TopicId, string>,
);
