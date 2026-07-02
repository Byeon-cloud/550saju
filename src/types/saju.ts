/** 오행 */
export type OhengType = '목' | '화' | '토' | '금' | '수';

/** 음양 */
export type EumYang = '양' | '음';

/** 역법 */
export type CalendarType = 'solar' | 'lunar' | 'lunar_leap';

/** 성별 */
export type Gender = 'male' | 'female';

/** 사주 입력 */
export interface SajuInput {
  name?: string;
  relation?: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  calendarType: CalendarType;
  gender: Gender;
  hasBirthTime: boolean;
  birthHour?: number;
  birthMinute?: number;
}

/** 기둥 (년/월/일/시) */
export interface Pillar {
  position: 'year' | 'month' | 'day' | 'time';
  천간: string;       // 天干 한자
  지지: string;       // 地支 한자
  천간읽기: string;   // 한국어 읽기
  지지읽기: string;
  천간오행: OhengType;
  지지오행: OhengType;
  천간음양: EumYang;
  지지음양: EumYang;
  available: boolean; // 시주 미입력 시 false
}

/** 십성 */
export interface SipSung {
  position: string;
  글자: string;
  십성: string;
  십성한자: string;
  의미: string;
}

/** 지장간 */
export interface JiJangGan {
  지지: string;
  지장간: string[];
  십성: string[];
}

/** 12운성 */
export interface UnYoung {
  position: string;
  운성: string;
  운성한자: string;
  의미: string;
}

/** 대운 */
export interface DaeUn {
  순번: number;
  /** 시작나이/끝나이 — 세는나이(虚岁) 기준 (lunar-javascript getStartAge 규약) */
  시작나이: number;
  끝나이: number;
  /** 시작·끝 실제 연도 (2026-07 fix) — "현재 대운" 판정의 정확한 기준. 구 저장본엔 없음(optional) */
  시작년도?: number;
  끝년도?: number;
  천간: string;
  지지: string;
  간지: string;
  isCurrent: boolean;
}

/** 납음 */
export interface NaPeum {
  position: string;
  납음: string;
  납음한자: string;
  의미: string;
}

/** 신살 */
export interface SinSal {
  이름: string;
  이름한자: string;
  의미: string;
  type: 'gilsin' | 'hyungsal';
}

/** 공망 */
export interface GongMang {
  기준: string;
  순: string;
  공망: string;
  의미: string;
}

/** 오행 분포 */
export type OhengDistribution = Record<OhengType, number>;

/** 형충합 관계 */
export interface HyungChungHap {
  type: '충' | '합' | '형';
  target: '천간' | '지지';
  positions: [string, string];
  chars: [string, string];
  desc: string;
}

/** 십성 5분류 분포 */
export interface SipSungDistribution {
  비겁: number;
  식상: number;
  재성: number;
  관성: number;
  인성: number;
}

/** 명리학 구조 분석 */
export interface MyeongriAnalysis {
  일간: string;
  일간오행: OhengType;
  월령: string;
  월령오행: OhengType;
  득령: boolean;
  십성분포: SipSungDistribution;
  형충합: HyungChungHap[];
  일간강약: '신강경향' | '신약경향' | '중화';
  강약근거: string;
  /** 격국(자평진전 §10) — 정격 8종 + 변격 4종 (audit 1 P0-3) */
  격국?: string;
  격국근거?: string;
  /** 용신(用神) — 결정론적 산출 (2026-06-26 보강1: 행운 색/방위 SSOT 단일화). 조후 우선 → 부억(신강=식상설기/신약=인성생조). */
  용신?: OhengType;
  희신?: OhengType;
  기신?: OhengType;
  용신근거?: string;
}

/** 사주 전체 데이터 */
export interface SajuData {
  input: SajuInput;
  pillars: Pillar[];
  elements: OhengDistribution;
  sipsung: SipSung[];
  jijanggan: JiJangGan[];
  unyoung12: UnYoung[];
  daeun: DaeUn[];
  napeum: NaPeum[];
  gilsin: SinSal[];
  hyungsal: SinSal[];
  gongmang: GongMang[];
  currentDaeun?: DaeUn;
  yearlyUn?: { 천간: string; 지지: string; 간지: string };
  띠?: string;
  myeongriAnalysis?: MyeongriAnalysis;
}

/** 상황 질문 */
export interface Situation {
  loveStatus?: '솔로' | '연애중' | '결혼' | '이혼/별거';
  jobStatus?: '학생' | '취준생' | '직장인' | '자영업' | '프리랜서' | '무직';
  concern?: string;
}
