/**
 * TOPIC_THEMES — 10주제 운세 IA SSOT (JDS_Topic_IA 매트릭스)
 *
 * 출처: docs/design/JDS_Topic_IA.md
 * 작성: 2026-05-07 (사용자 요청 — Option A Phase 2)
 *
 * 정책:
 *  - 10주제 모두 동일 8섹션 골격 (主柱·八字·十神·時運·人緣·處方·吉物·日箴)
 *  - sipsungAxes: 주제별 4개 핵심 십성 (§03 분포 막대 시각화)
 *  - timelineType: 12months / 3stage / semester (§04 시기별 흐름)
 *  - meetLabels: boost/clash/calm 의 주제별 의미 (§05 인연 카드)
 *  - sec01Hanja: §01 한자 (桃花·復縁·婚姻·財星·進就·創業·壽元·官星·移動·學業)
 *  - accent: Hero stripe + 한자 워터마크 + chip 색 (단색만 — 그라디언트 X)
 *
 * 회귀 방지:
 *  - 검정/골드/크림이 base (--c-paper/--c-gold/--c-ink) — 주제색은 액센트로만
 *  - 자유 hex 추가 금지 (이 파일이 SSOT)
 */

import type { OhengType } from '@/types/saju';

export type TopicKey =
  | 'love'
  | 'reunion'
  | 'marriage'
  | 'wealth'
  | 'exam'
  | 'business'
  | 'career'
  | 'health'
  | 'move'
  | 'study';

export type TimelineType = '12months' | '3stage' | 'semester';

export interface TopicTheme {
  /** SSOT topic key */
  id: TopicKey;
  /** 한국어 라벨 — Hero 배지 */
  label: string;
  /** SSOT canonical 한자 (홈/Footer/Topic) — 1글자 */
  hanja: string;
  /** §01 한자 — 2글자 (桃花·復縁·婚姻·財星·進就·創業·官星·壽元·移動·學業) */
  sec01Hanja: string;
  /** §01 제목 (DailyMockupView §01 패턴 응용) */
  sec01Title: string;
  /** Hero H1 카피 — 2 line */
  heroH1: { line1: string; line2: string };
  /** 액센트 색 (단색) — Hero stripe·한자 워터마크·chip soft bg */
  accent: string;
  /** 액센트 어두운 톤 — sec-num·강조 텍스트 */
  accentDark: string;
  /** 액센트 soft 배경 (10%) */
  accentSoft: string;
  /** 사주 호명용 톤 ("일간 X 입장에서…") */
  sajuRefPrefix: string;
  /** §03 십성 4축 (메인·상생·저항·보조) — 분포 막대 시각화 */
  sipsungAxes: {
    main: string;       // 메인 십성 (예: '재성' / '정관')
    secondary: string;  // 상생 십성
    resistance: string; // 저항 십성
    aux: string;        // 보조 십성
  };
  /** §04 시기별 흐름 단위 */
  timelineType: TimelineType;
  /** §05 인연 카드 라벨 — 주제별 의미 */
  meetLabels: {
    boost: string;  // "도움 주는 사람"
    clash: string;  // "충돌하는 사람"
    calm: string;   // "평온한 사람"
  };
  /** §06 처방 톤 — 행동 처방의 주안점 (사주 specific 처방 가이드) */
  doFocus: string;   // "도화 시간대 활용·재성 활성 방위 만남"
  dontFocus: string; // "비교·고집·식상 약함 표 내지 않기"
  /** §07 럭키 6 강화 방향 — 부족 오행 보충 / 강한 오행 활용 */
  luckyFocus: 'support' | 'amplify'; // support=부족 보충, amplify=강한 활용
  /** §08 PullQuote 톤 — 사주 호명 강제 */
  pullQuoteHint: string;
  /** §08 업셀 카피 — 종합사주로 유도 */
  upsellHint: string;
  /** Hero gradient 베이스 (검정 base + 주제색 stripe) — DailyMockupView 패턴 동기화 */
  heroBaseGrad: string;
  /** 부족할 때 보충 오행 추천 (조후) — runtime 에서 사용자 사주에 따라 결정 */
  ohengAffinity: OhengType[];
}

/**
 * 10주제 SSOT — JDS_Topic_IA §1.2 매트릭스 정렬
 *
 * accent 색은 docs/design/JDS_Daily_Pattern.md §1.3 의 10주제 색표와 100% 동기화.
 * sipsungAxes 는 JDS_Topic_IA.md §2.1 매트릭스 정렬.
 */
export const TOPIC_THEMES: Record<TopicKey, TopicTheme> = {
  /* ────────── 緣 — 연애운 ────────── */
  love: {
    id: 'love',
    label: '연애운',
    hanja: '緣',
    sec01Hanja: '桃花',
    sec01Title: '연애운 핵심 흐름',
    heroH1: { line1: '관계의 흐름과', line2: '인연이 닿는 자리' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    sajuRefPrefix: '일지 배우자궁',
    sipsungAxes: {
      main: '재성',
      secondary: '정관',
      resistance: '정인',
      aux: '식상',
    },
    timelineType: '12months',
    meetLabels: {
      boost: '인연을 끌어오는 사람',
      clash: '관계를 깨는 사람',
      calm: '친구로 좋은 사람',
    },
    doFocus: '도화 시간대 활용, 재성 활성 방위 만남, 표현 늘리기',
    dontFocus: '비교 금지, 이상형 고집 금지, 식상 약함 표 내지 않기',
    luckyFocus: 'support',
    pullQuoteHint: '오늘의 기운을 만남에 어떻게 풀어낼지',
    upsellHint: '평생의 인연 흐름을 사주 전체로 보면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #2A2520 50%, #1D1812 100%)',
    ohengAffinity: ['화', '목'],
  },

  /* ────────── 復 — 재회운 ────────── */
  reunion: {
    id: 'reunion',
    label: '재회운',
    hanja: '復',
    sec01Hanja: '復縁',
    sec01Title: '재회운 핵심 흐름',
    heroH1: { line1: '다시 닿을 수 있는', line2: '관계의 변곡점' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    sajuRefPrefix: '합과 충 변곡',
    sipsungAxes: {
      main: '합과 충',
      secondary: '재성',
      resistance: '정관',
      aux: '식상',
    },
    timelineType: '3stage',
    meetLabels: {
      boost: '다시 연결되는 매개',
      clash: '재회를 막는 사람',
      calm: '미련 없이 정리할 사람',
    },
    doFocus: '합 들어오는 시기 신호 잡기, 표현 정리, 거리 조절',
    dontFocus: '집착 금지, 충돌기 결정 미루기, 과거 비교 금지',
    luckyFocus: 'amplify',
    pullQuoteHint: '재회의 가능성과 시기를 한 줄로',
    upsellHint: '평생 관계 운의 큰 흐름을 보고 싶다면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #2A2018 50%, #1D1612 100%)',
    ohengAffinity: ['화', '수'],
  },

  /* ────────── 婚 — 결혼운 ────────── */
  marriage: {
    id: 'marriage',
    label: '결혼운',
    hanja: '婚',
    sec01Hanja: '婚姻',
    sec01Title: '결혼운 핵심 흐름',
    heroH1: { line1: '평생을 함께 할', line2: '동반자의 기운' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    sajuRefPrefix: '일지 배우자궁',
    sipsungAxes: {
      main: '정관',
      secondary: '정인',
      resistance: '일지',
      aux: '합과 충',
    },
    timelineType: '12months',
    meetLabels: {
      boost: '결혼 도와주는 인맥',
      clash: '결혼 막는 가족',
      calm: '중립적인 가족',
    },
    doFocus: '정관 들어오는 시기 만남, 안정 행동, 가족 신뢰 쌓기',
    dontFocus: '충돌기 약속 금지, 조건 비교 금지, 일지 충 무시 금지',
    luckyFocus: 'amplify',
    pullQuoteHint: '결혼 적기와 짝의 기운을 한 줄로',
    upsellHint: '평생의 가족 운까지 사주 전체로 보면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #2A1F22 50%, #1D1318 100%)',
    ohengAffinity: ['토', '화'],
  },

  /* ────────── 財 — 재물운 ────────── */
  wealth: {
    id: 'wealth',
    label: '재물운',
    hanja: '財',
    sec01Hanja: '財星',
    sec01Title: '재물운 핵심 흐름',
    heroH1: { line1: '돈이 들어오고', line2: '머무는 자리' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(184,150,90,0.10)',
    sajuRefPrefix: '재성',
    sipsungAxes: {
      main: '정재',
      secondary: '편재',
      resistance: '식상',
      aux: '비겁',
    },
    timelineType: '12months',
    meetLabels: {
      boost: '돈 들어오게 하는 인맥',
      clash: '돈 새는 사람',
      calm: '안정적인 동료',
    },
    doFocus: '재성 활성 시기 투자, 편재 활성 방위 거래, 식상 활용 생산',
    dontFocus: '비겁 강한 시기 동업 금지, 충돌기 큰 거래 금지, 충동 구매 금지',
    luckyFocus: 'amplify',
    pullQuoteHint: '재성 들어오는 자리와 시기를 한 줄로',
    upsellHint: '평생의 재물 흐름을 사주 전체로 보면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #2A2520 50%, #1D1812 100%)',
    ohengAffinity: ['토', '금'],
  },

  /* ────────── 進 — 시험운 ────────── */
  exam: {
    id: 'exam',
    label: '시험운',
    hanja: '進',
    sec01Hanja: '進就',
    sec01Title: '시험운 핵심 흐름',
    heroH1: { line1: '집중이 빛나는', line2: '합격의 시간' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    sajuRefPrefix: '문창귀인과 학당귀인',
    sipsungAxes: {
      main: '정관',
      secondary: '정인',
      resistance: '문창귀인',
      aux: '식상',
    },
    timelineType: 'semester',
    meetLabels: {
      boost: '멘토, 합격 도와주는 사람',
      clash: '방해되는 사람',
      calm: '같이 공부하는 사람',
    },
    doFocus: '정관 시기 면접, 문창 시간대 학습, 인성 강화 환경',
    dontFocus: '식상 폭주 시기 도전 금지, 충돌기 결정 금지, 잔머리 금지',
    luckyFocus: 'support',
    pullQuoteHint: '시험 적기와 합격 가능성을 한 줄로',
    upsellHint: '평생 진로의 큰 흐름을 사주 전체로 보면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #1F2330 50%, #14171F 100%)',
    ohengAffinity: ['수', '목'],
  },

  /* ────────── 業 — 사업운 ────────── */
  business: {
    id: 'business',
    label: '사업운',
    hanja: '業',
    sec01Hanja: '創業',
    sec01Title: '사업운 핵심 흐름',
    heroH1: { line1: '판을 키우는', line2: '사업가의 기운' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(163,122,46,0.10)',
    sajuRefPrefix: '편재와 식신',
    sipsungAxes: {
      main: '편재',
      secondary: '식신',
      resistance: '정관',
      aux: '비겁',
    },
    timelineType: '3stage',
    meetLabels: {
      boost: '동업자, 투자자',
      clash: '경쟁자',
      calm: '직원, 고객',
    },
    doFocus: '편재 시기 확장, 식신 활용 생산, 정관 시기 정리',
    dontFocus: '비겁 강한 시기 동업 금지, 충돌기 큰 결정 금지, 자만 금지',
    luckyFocus: 'amplify',
    pullQuoteHint: '사업 단계와 결정 시점을 한 줄로',
    upsellHint: '평생 업의 큰 흐름을 사주 전체로 보면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #25201A 50%, #1A1610 100%)',
    ohengAffinity: ['토', '화'],
  },

  /* ────────── 官 — 직업운 ────────── */
  career: {
    id: 'career',
    label: '직업운',
    hanja: '官',
    sec01Hanja: '官星',
    sec01Title: '직업운 핵심 흐름',
    heroH1: { line1: '쌓아올리는 자리와', line2: '일의 기운' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    sajuRefPrefix: '관성',
    sipsungAxes: {
      main: '정관',
      secondary: '정인',
      resistance: '식상',
      aux: '재성',
    },
    timelineType: '12months',
    meetLabels: {
      boost: '상사, 멘토',
      clash: '라이벌',
      calm: '동료',
    },
    doFocus: '정관 시기 이직, 인성 시기 학습, 재성 활용 협상',
    dontFocus: '식상 폭주 시기 충돌 금지, 충돌기 사직 금지, 정관 약함 시기 자만 금지',
    luckyFocus: 'amplify',
    pullQuoteHint: '직업 변곡점과 자리의 기운을 한 줄로',
    upsellHint: '평생 일의 흐름을 사주 전체로 보면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #1F2530 50%, #14181F 100%)',
    ohengAffinity: ['금', '토'],
  },

  /* ────────── 壽 — 건강운 ────────── */
  health: {
    id: 'health',
    label: '건강운',
    hanja: '壽',
    sec01Hanja: '壽元',
    sec01Title: '건강운 핵심 흐름',
    heroH1: { line1: '몸의 결과', line2: '오래 가는 흐름' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    sajuRefPrefix: '일간 강약',
    sipsungAxes: {
      main: '일간 강약',
      secondary: '조후용신',
      resistance: '충극',
      aux: '식상',
    },
    timelineType: '12months',
    meetLabels: {
      boost: '건강 도와주는 사람',
      clash: '스트레스 주는 사람',
      calm: '평온한 사람',
    },
    doFocus: '조후 보충 음식, 약한 시기 휴식, 일간 강한 시간대 운동',
    dontFocus: '충극 시기 무리 금지, 식상 폭주 시 소진 금지, 약한 부위 무시 금지',
    luckyFocus: 'support',
    pullQuoteHint: '몸의 결과 주의 시기를 한 줄로',
    upsellHint: '평생 건강의 큰 흐름을 사주 전체로 보면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #1F2A25 50%, #141A17 100%)',
    ohengAffinity: ['수', '목'],
  },

  /* ────────── 移 — 이사운 ────────── */
  move: {
    id: 'move',
    label: '이사운',
    hanja: '移',
    sec01Hanja: '移動',
    sec01Title: '이사운 핵심 흐름',
    heroH1: { line1: '머무를 자리와', line2: '떠날 시점의 기운' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    sajuRefPrefix: '역마살',
    sipsungAxes: {
      main: '역마살',
      secondary: '대운 변곡',
      resistance: '충',
      aux: '토',
    },
    timelineType: '12months',
    meetLabels: {
      boost: '이사 도와주는 사람',
      clash: '이사 반대 가족',
      calm: '새 동네 사람',
    },
    doFocus: '역마 활성 시기 이사, 대운 변곡 시기 결정, 토 안정 방위 정착',
    dontFocus: '충돌기 이사 금지, 토 약한 시기 큰 변동 금지, 충동 결정 금지',
    luckyFocus: 'amplify',
    pullQuoteHint: '이사 적기와 방위를 한 줄로',
    upsellHint: '평생의 이동과 터의 흐름을 사주 전체로 보면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #1A2526 50%, #11181A 100%)',
    ohengAffinity: ['토', '수'],
  },

  /* ────────── 學 — 공부운 ────────── */
  study: {
    id: 'study',
    label: '학업운',
    hanja: '學',
    sec01Hanja: '學業',
    sec01Title: '학업운 핵심 흐름',
    heroH1: { line1: '집중이 흐르는', line2: '시간과 자리' },
    accent: '#8C6D3D', // 2026-10-10 v9 주제별 색 폐기 (금 하나)
    accentDark: '#7A5C2E',
    accentSoft: 'rgba(140,109,61,0.10)',
    sajuRefPrefix: '인성과 문창귀인',
    sipsungAxes: {
      main: '정인',
      secondary: '식신',
      resistance: '문창귀인',
      aux: '학당귀인',
    },
    timelineType: 'semester',
    meetLabels: {
      boost: '같이 공부하는 사람',
      clash: '방해되는 사람',
      calm: '응원해주는 사람',
    },
    doFocus: '인성 시기 깊은 학습, 문창 시간대 집중, 식신 활용 사고 정리',
    dontFocus: '식상 폭주 산만 금지, 충돌기 결정 금지, 인성 약함 시기 무리 금지',
    luckyFocus: 'support',
    pullQuoteHint: '집중이 흐르는 시간과 자리를 한 줄로',
    upsellHint: '평생 학업 잠재력을 사주 전체로 보면',
    heroBaseGrad: 'linear-gradient(135deg, #1A1A1A 0%, #251A22 50%, #181016 100%)',
    ohengAffinity: ['수', '목'],
  },
};

/* ══════════════════════════════════════════════════════════════════
 * Helper — TopicKey 안전 캐스트 (alias 흡수)
 * ═════════════════════════════════════════════════════════════════ */
const TOPIC_ALIASES: Record<string, TopicKey> = {
  love: 'love',
  reunion: 'reunion',
  marriage: 'marriage',
  wealth: 'wealth',
  exam: 'exam',
  business: 'business',
  career: 'career',
  health: 'health',
  move: 'move',
  moving: 'move', // legacy
  study: 'study',
};

export function normalizeTopicKey(input?: string | null): TopicKey {
  if (!input) return 'love';
  return TOPIC_ALIASES[input] || 'love';
}

export function getTopicTheme(topicId: string | null | undefined): TopicTheme {
  const key = normalizeTopicKey(topicId);
  return TOPIC_THEMES[key];
}

/* ══════════════════════════════════════════════════════════════════
 * AI 응답 schema (TopicResultV2) — JDS_Topic_IA §8 정렬
 *  · TopicMockupView 가 props 로 받는 통합 스키마
 *  · AI prompt 측에서 schema mandate (다음 phase 작업)
 * ═════════════════════════════════════════════════════════════════ */
export interface TopicResultV2 {
  topicId: TopicKey;

  /** §01 — 핵심 결 */
  title: string;                    // "{주제} 핵심 결" (20자)
  oneLineConclusion: string;        // 한 줄 결론 (사주 호명 필수)
  conclusionSajuRef?: string;       // "일간 기토(己土)..." 인용
  narrative: string;                // 1000자+ · <strong>·<u>·<b> 자동 주입

  /** §02 — 사주 4기둥 + 주제 인용 */
  sajuHighlights?: string[];        // 주제 specific 글자 카운트 (예: ['재성 X3', '정관 X1'])

  /** §03 — 십성 분포 */
  topicSipsung: {
    main: { name: string; count: number; level: '강함' | '보통' | '약함' | '부족' };
    secondary: { name: string; count: number; level: '강함' | '보통' | '약함' | '부족' };
    resistance: { name: string; count: number; level: '강함' | '보통' | '약함' | '부족' };
    aux: { name: string; count: number; level: '강함' | '보통' | '약함' | '부족' };
    interpretation: string;         // 200자+ 사주 specific 해석
  };

  /** §04 — 시기별 흐름 */
  timeline: {
    type: TimelineType;
    items: Array<{
      slot: string;                 // "1월" / "1단계 시작" / "1학기" 등
      score: number;                // 0-100
      message: string;              // 한 줄 설명
    }>;
    bestSlots?: string[];           // 강조 슬롯 (예: ['5월', '9월'])
  };

  /** §05 — 인연 카드 */
  meet: {
    boost: { who: string; why: string; tag?: string };
    clash: { who: string; why: string; tag?: string };
    calm: { who: string; why: string; tag?: string };
  };

  /** §06 — 행동 처방 (Do/Don't) */
  doList: Array<{ title: string; when?: string; detail: string }>;
  dontList: Array<{ title: string; when?: string; detail: string }>;

  /** §07 — 럭키 6 */
  lucky: {
    color: { value: string; reason: string };
    direction: { value: string; reason: string };
    hour: { value: string; reason: string };
    number: { value: string; reason: string };
    word: { value: string; reason: string };
    food: { value: string; reason: string };
  };

  /** §08 — 한 문장 + 다음 단계 */
  pullQuote: string;                // 80자+ · 사주 호명 필수
  upsellLine?: string;              // "평생을 사주 전체로..." 등 종합사주 유도
}
