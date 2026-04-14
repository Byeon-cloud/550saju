import { getFunctions, httpsCallable } from 'firebase/functions';
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
 * AI 사주 리포트 생성 — Firebase Function → Claude Sonnet 4.6
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
 * 오늘의 운세 — Firebase Function → Gemini 2.5 Flash
 */
export async function generateDailyFortune(
  answers: number[],
  timeSlot: string,
  sajuSummary?: { ilgan: string; oheng: string; name: string },
  userConcern?: string,
): Promise<any> {
  const result = await callWithAuth('generateDailyFortune', { answers, timeSlot, sajuSummary, userConcern });
  return result.data;
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
): Promise<{ reportId: string; content: any }> {
  const result = await callWithAuth('generateTopicAnalysis', { topicId, sajuData, baseScore, partnerInfo });
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
