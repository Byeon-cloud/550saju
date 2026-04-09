import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/services/auth/firebase';
import type { SajuData, Situation } from '@/types/saju';
import type {
  AIReportResponse,
  DaeunAnalysisResponse,
  MonthlyDetailResponse,
  CompatibilityResponse,
  TojungResponse,
} from '@/types/report';

const functions = getFunctions(app, 'us-central1');

/** httpsCallable with extended timeout for AI calls */
function aiCallable(name: string) {
  return httpsCallable(functions, name, { timeout: 300000 }); // 5분
}

/**
 * AI 사주 리포트 생성 — Firebase Function → Claude Sonnet 4.6
 */
export async function generateReport(
  sajuData: SajuData,
  situation?: Situation,
  reportType: 'basic' | 'premium' = 'basic',
): Promise<{ reportId: string; content: AIReportResponse }> {
  const fn = aiCallable('generateReport');
  const result = await fn({ sajuData, situation, reportType });
  return result.data as { reportId: string; content: AIReportResponse };
}

/**
 * 오늘의 운세 — Firebase Function → Gemini 2.5 Flash
 */
export async function generateDailyFortune(
  answers: number[],
  timeSlot: string,
  sajuSummary?: { ilgan: string; oheng: string; name: string },
): Promise<any> {
  const fn = aiCallable('generateDailyFortune');
  const result = await fn({ answers, timeSlot, sajuSummary });
  return result.data;
}

/**
 * AI 대화 — Firebase Function → Gemini 2.5 Pro
 */
/**
 * 꿈해몽 — Firebase Function → Gemini 2.5 Flash
 */
export async function generateDream(
  category: string,
  dreamText: string,
  sajuData?: SajuData,
): Promise<{ title: string; interpretation: string; luckyAction: string; category: string }> {
  const fn = aiCallable('generateDream');
  const result = await fn({ category, dreamText, sajuData });
  return result.data as { title: string; interpretation: string; luckyAction: string; category: string };
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

  const fn = aiCallable('generateChatAnswer');
  const result = await fn({ question, sajuData, chatHistory, timeSlot });
  return result.data as { answer: string; keywords?: string[]; todayCount: number; isPaid: boolean };
}

/**
 * 대운 해설 — Firebase Function → Claude Sonnet 4.6
 */
export async function generateDaeunAnalysis(
  sajuData: SajuData,
): Promise<{ reportId: string; content: DaeunAnalysisResponse }> {
  const fn = aiCallable('generateDaeun');
  const result = await fn({ sajuData });
  return result.data as { reportId: string; content: DaeunAnalysisResponse };
}

/**
 * 2026 월별 운세 — Firebase Function → Claude Sonnet 4.6
 */
export async function generateMonthlyFortune2026(
  sajuData: SajuData,
): Promise<{ reportId: string; content: MonthlyDetailResponse }> {
  const fn = aiCallable('generateMonthly');
  const result = await fn({ sajuData });
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
  const fn = aiCallable('generateCompatibility');
  const result = await fn({ sajuData1, sajuData2, relation });
  return result.data as { reportId: string; content: CompatibilityResponse };
}

/**
 * 토정비결 — Firebase Function → Gemini 2.5 Pro
 */
export async function generateTojungBigyeol(
  sajuData: SajuData,
): Promise<{ reportId: string; content: TojungResponse }> {
  const fn = aiCallable('generateTojung');
  const result = await fn({ sajuData });
  return result.data as { reportId: string; content: TojungResponse };
}
