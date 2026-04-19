import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app } from '@/services/auth/firebase';
import { ensureAuth } from '@/services/auth/authService';
import type { SajuData, Situation } from '@/types/saju';
import type {
  AIReportResponse,
  DaeunAnalysisResponse,
  MonthlyDetailResponse,
  CompatibilityResponse,
  TojungResponse,
} from '@/types/report';

const functions = getFunctions(app, 'us-central1');

/**
 * Dev 모드 + env 플래그 동시 만족 시 emulator 연결.
 *   .env.local 에 `VITE_USE_FUNCTIONS_EMULATOR=true` 설정 시만 활성화.
 *   prod 빌드에서는 절대 동작 안 함 (import.meta.env.DEV === false).
 *   HMR 재연결 방지 위해 module-level 1회만 실행.
 */
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true'
) {
  try {
    connectFunctionsEmulator(functions, 'localhost', 5001);
    // eslint-disable-next-line no-console
    console.info('[emulator] Functions connected → localhost:5001');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[emulator] connectFunctionsEmulator failed (already connected?):', e);
  }
}

/** httpsCallable with extended timeout for AI calls */
function aiCallable(name: string) {
  return httpsCallable(functions, name, { timeout: 300000 }); // 5분
}

/** 모든 Cloud Function 호출 전 인증 보장 */
async function callWithAuth(name: string, data: any): Promise<any> {
  await ensureAuth(); // 인증 완료까지 대기
  const fn = aiCallable(name);
  const result = await fn(data);
  return result;
}

/**
 * AI 사주 리포트 생성 — Firebase Function → Claude Opus 4.6 (기본)
 *
 * 모델 정책: Opus 4.6 메인 / Sonnet 4.6 검증 / Haiku 4.5 보조.
 * 서버측 SAJU_REPORT_MODEL 환경변수로 A/B 테스트 가능.
 */
export async function generateReport(
  sajuData: SajuData,
  situation?: Situation,
  reportType: 'basic' | 'premium' = 'basic',
): Promise<{ reportId: string; content: AIReportResponse }> {
  const result = await callWithAuth('generateReport', { sajuData, situation, reportType });
  return result.data as { reportId: string; content: AIReportResponse };
}

/**
 * 오늘의 운세 — Firebase Function → Claude Sonnet 4.6 (v3 스키마).
 *
 * Phase C 에서 DailyFortunePage 가 v4 입력(name, sajuData, date, todayGanzi 등)으로 전환.
 * 당분간 레거시 위치 인자(answers[], timeSlot, sajuSummary, userConcern) 호출도 컴파일만 통과시킴.
 * 서버는 v3 필수 필드가 없으면 invalid-argument 를 던지므로 런타임은 Phase C 후 정상.
 */
export async function generateDailyFortune(
  paramsOrAnswers?: any,
  _timeSlot?: string,
  _sajuSummary?: any,
  _userConcern?: string,
): Promise<any> {
  // 레거시 positional 호출 (Array 로 들어옴) — 객체로 재포장 (서버에서 v3 필수 필드 없으면 400)
  const payload = Array.isArray(paramsOrAnswers)
    ? { answers: paramsOrAnswers, timeSlot: _timeSlot, sajuSummary: _sajuSummary, userConcern: _userConcern }
    : paramsOrAnswers;
  const result = await callWithAuth('generateDailyFortune', payload);
  return result.data;
}

/**
 * 꿈해몽 무료 (v3 신규) — Firebase Function → Claude Sonnet 4.6.
 */
export async function generateDreamFree(args: {
  saju?: any;
  dreamContent: string;
  category: string;
  userConcern?: string;
}): Promise<any> {
  const result = await callWithAuth('generateDreamFree', args);
  return result.data;
}

/**
 * 꿈해몽 심층 (v3 신규, 유료 1운) — Firebase Function → Claude Sonnet 4.6 + 2차 리뷰.
 */
export async function generateDreamDeepV3(args: {
  saju: any;
  dreamContent: string;
  category: string;
  freeResultSummary: { title: string; verdict: string; symbols: string[] };
}): Promise<{ reportId: string; content: any }> {
  const result = await callWithAuth('generateDreamDeep', args);
  return result.data as { reportId: string; content: any };
}

/**
 * 주간 흐름 (v3 신규, 유료 1운) — Firebase Function → Claude Sonnet 4.6 + 2차 리뷰.
 */
export async function generateWeeklyFortune(args: {
  name: string;
  sajuData: SajuData;
  monday: string;
  weekdays: Array<{ date: string; weekday: string; ganzi: string }>;
}): Promise<{ reportId: string; content: any }> {
  const result = await callWithAuth('generateWeeklyFortune', args);
  return result.data as { reportId: string; content: any };
}

/**
 * AI 대화 — Firebase Function → Gemini 2.5 Pro
 */
/**
 * 꿈해몽 (무료) — Firebase Function → Gemini 2.5 Pro
 */
export async function generateDream(
  category: string,
  dreamText: string,
  sajuData?: SajuData,
): Promise<{ title: string; interpretation: string; luckyAction: string; category: string }> {
  const result = await callWithAuth('generateDream', { category, dreamText, sajuData });
  return result.data as { title: string; interpretation: string; luckyAction: string; category: string };
}

/**
 * 사주 연계 심층 해몽 (유료 1운) — Firebase Function → Gemini 2.5 Pro
 * 사주 원국과 꿈의 상징을 교차 분석, 5축 점수 + 오행 매핑 + 럭키 프로필
 */
export async function generateDeepDream(
  category: string,
  dreamText: string,
  sajuData: SajuData,
): Promise<any> {
  const result = await callWithAuth('generateDream', { category, dreamText, sajuData, mode: 'deep' });
  return result.data;
}

/**
 * AI 대화 — Firebase Function → Gemini 2.5 Pro
 */
export async function generateChatAnswer(
  question: string,
  sajuData?: SajuData,
  chatHistory?: Array<{ role: string; content: string }>,
): Promise<{ answer: string; keywords?: string[]; todayCount: number; isPaid: boolean }> {
  const h = new Date().getHours();
  let timeSlot = 'afternoon';
  if (h < 5) timeSlot = 'latenight';
  else if (h < 7) timeSlot = 'dawn';
  else if (h < 12) timeSlot = 'morning';
  else if (h < 14) timeSlot = 'noon';
  else if (h < 18) timeSlot = 'afternoon';
  else if (h < 21) timeSlot = 'evening';
  else timeSlot = 'night';

  const result = await callWithAuth('generateChatAnswer', { question, sajuData, chatHistory, timeSlot });
  return result.data as { answer: string; keywords?: string[]; todayCount: number; isPaid: boolean };
}

/**
 * 대운 해설 — Firebase Function → Claude Sonnet 4.6
 */
export async function generateDaeunAnalysis(
  sajuData: SajuData,
): Promise<{ reportId: string; content: DaeunAnalysisResponse }> {
  const result = await callWithAuth('generateDaeun', { sajuData });
  return result.data as { reportId: string; content: DaeunAnalysisResponse };
}

/**
 * 2026 월별 운세 — Firebase Function → Claude Sonnet 4.6
 */
export async function generateMonthlyFortune2026(
  sajuData: SajuData,
): Promise<{ reportId: string; content: MonthlyDetailResponse }> {
  const result = await callWithAuth('generateMonthly', { sajuData });
  return result.data as { reportId: string; content: MonthlyDetailResponse };
}

/**
 * 궁합 분석 — Firebase Function → Claude Sonnet 4.6
 */
export async function generateCompatibilityAnalysis(
  sajuData1: SajuData,
  sajuData2: SajuData,
  relation: string,
): Promise<{ reportId: string; content: CompatibilityResponse }> {
  const result = await callWithAuth('generateCompatibility', { sajuData1, sajuData2, relation });
  return result.data as { reportId: string; content: CompatibilityResponse };
}

/**
 * 주제별 심층분석 — Firebase Function → Gemini 2.5 Flash
 */
export async function generateTopicAnalysis(
  topicId: string,
  sajuData: SajuData,
  baseScore?: number,
  partnerInfo?: { name: string; birthYear: number; birthMonth: number; birthDay: number; gender: string; breakupYear?: number; breakupMonth?: number; birthHour?: number },
  extraInfo?: Record<string, any>,
): Promise<{ reportId: string; content: any }> {
  const result = await callWithAuth('generateTopicAnalysis', { topicId, sajuData, baseScore, partnerInfo, extraInfo });
  return result.data as { reportId: string; content: any };
}

/**
 * 토정비결 — Firebase Function → Gemini 2.5 Pro
 */
export async function generateTojungBigyeol(
  sajuData: SajuData,
): Promise<{ reportId: string; content: TojungResponse }> {
  const result = await callWithAuth('generateTojung', { sajuData });
  return result.data as { reportId: string; content: TojungResponse };
}
