import type { Timestamp } from 'firebase/firestore';

export type ReportType =
  | 'basic'
  | 'premium'
  | 'compatibility'
  | 'daeun'
  | 'yearly'
  | 'daily'
  | 'monthly'
  | 'tojung';

export interface ReportSection {
  id: string;
  title: string;
  keyInsight?: string;
  content: string;
}

/** 6개 운세 점수 */
export interface ReportScores {
  career: number;    // 직업운 0-100
  love: number;      // 애정운
  wealth: number;    // 재물운
  social: number;    // 대인운
  health: number;    // 건강운
  potential: number; // 잠재력
}

/** 럭키 프로필 (공유 트리거용) */
export interface LuckyProfile {
  colors: string[];       // HEX 3개
  colorNames: string[];   // 한국어 3개
  numbers: number[];      // 행운 숫자 3개
  direction: string;      // 행운 방위
  day: string;            // 행운 요일
  foods: string[];        // 행운 음식 3개
  element: string;        // 보충 오행
}

/** 직업 적합도 */
export interface CareerFit {
  job: string;
  score: number;
  reason?: string;  // 사주 근거 (용신 기반)
}

/** 월별 운세 */
export interface MonthlyFortune {
  month: number;
  score: number;
}

/** 관계 유형 맵 */
export interface RelationshipMap {
  work: { score: number; keyword: string };
  friend: { score: number; keyword: string };
  lover: { score: number; keyword: string };
}

/** 재물 흐름도 */
export interface WealthFlow {
  earning: { score: number; style: string };
  spending: { score: number; style: string };
  saving: { score: number; style: string };
}

/** 격국/용신 분석 기반 */
export interface AnalysisBase {
  격국: string;
  일간강약: string;
  용신: string;
  용신근거: string;
  희신?: string;
  기신?: string;
}

/** AI 응답 전체 구조 */
export interface AIReportResponse {
  sections: ReportSection[];
  scores: ReportScores;
  luckyProfile: LuckyProfile;
  careerFit: CareerFit[];
  monthlyFortune: MonthlyFortune[];
  relationshipMap: RelationshipMap;
  wealthFlow: WealthFlow;
  analysisBase?: AnalysisBase;
}

/** Firestore 저장용 리포트 */
export interface Report {
  rid: string;
  profileId: string;
  type: ReportType;

  situation?: {
    loveStatus?: string;
    jobStatus?: string;
    concern?: string;
  };

  content: AIReportResponse & {
    summary: string;  // 3줄 요약
  };

  cost: number;
  aiModel: string;
  generatedAt: Timestamp;

  shareId?: string;
  shareEnabled: boolean;

  // 궁합 전용
  partnerProfileId?: string;
  relationship?: string;
}

// ━━━ 대운 해설 ━━━
export interface DaeunAnalysisResponse {
  overview: string;
  periods: DaeunPeriodDetail[];
  currentHighlight: string;
  transitionAdvice: string;
  lifePhaseMap: { phase: string; daeun: string; theme: string }[];
}

export interface DaeunPeriodDetail {
  간지: string;
  시작나이: number;
  끝나이: number;
  isCurrent: boolean;
  theme: string;
  career: string;
  love: string;
  wealth: string;
  health: string;
  score: number;
  advice: string;
}

// ━━━ 2026 월별 운세 ━━━
export interface MonthlyDetailResponse {
  yearOverview: string;
  bestMonth: number;
  worstMonth: number;
  months: MonthlyDetail[];
}

export interface MonthlyDetail {
  month: number;
  score: number;
  theme: string;
  advice: string;
  luckyDay: string;
  luckyItem: string;
  career: string;
  love: string;
  wealth: string;
  caution: string;
}

// ━━━ 궁합 분석 ━━━
export interface CompatibilityResponse {
  overallScore: number;
  summary: string;
  categories: CompatCategory[];
  strengths: string[];
  challenges: string[];
  advice: string;
  futureOutlook: string;
  ohengHarmony: {
    person1Element: string;
    person2Element: string;
    relation: string;
    description: string;
  };
}

export interface CompatCategory {
  id: string;
  name: string;
  score: number;
  description: string;
}

// ━━━ 토정비결 ━━━
export interface TojungResponse {
  yearOverview: {
    총운: string;
    금전운: string;
    건강운: string;
    직장운: string;
    애정운: string;
    결혼운: string;
  };
  months: TojungMonth[];
  luckyAdvice: string;
}

export interface TojungMonth {
  month: number;
  괘: string;
  괘의미: string;
  전통해석: string;
  현대해석: string;
  score: number;
  keyword: string;
}
