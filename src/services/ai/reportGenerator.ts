import { httpsCallable } from 'firebase/functions';
import { ensureAuth } from '@/services/auth/authService';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';
import type { SajuData, Situation } from '@/types/saju';
import type {
  AIReportResponse,
  DaeunAnalysisResponse,
  MonthlyDetailResponse,
  CompatibilityResponse,
  TojungResponse,
} from '@/types/report';

// Functions 엔드포인트(emulator vs prod) 는 functionsClient.ts 에서 ping 후 결정.
// emulator 죽어 있으면 자동으로 prod fallback (2026-04-22 hardening).

/** httpsCallable with extended timeout for AI calls */
function aiCallable(name: string) {
  return httpsCallable(functions, name, { timeout: 300000 }); // 5분
}

/** 모든 Cloud Function 호출 전 인증 + emulator/prod 타겟 보장 */
async function callWithAuth(name: string, data: any): Promise<any> {
  await ensureFunctionsTarget(); // emulator ping → prod fallback
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
 * T1 · 프리미엄 리포트 — SSE 스트리밍 (그룹 단위 점진 도착)
 *  · 서버 generatePremiumReportStream 호출 → 3 그룹 (A/B/C) 병렬 + 도착 즉시 송출
 *  · onGroup 콜백: 각 그룹 완료 시 partial 결과 (A/B/C 순서 무관)
 *  · onDone 콜백: 모든 그룹 merged + Firestore reportId
 *  · onError 콜백: 그룹 실패 또는 잔액 차감 실패 시
 *  · Opus 4.6 단일 모델 (퀄리티 보장)
 */
export interface PremiumStreamCallbacks {
  onStart?: () => void;
  onGroup?: (group: 'A' | 'B' | 'C', data: any, elapsedMs: number) => void;
  onDone: (result: { reportId: string; content: AIReportResponse }) => void;
  onError: (message: string) => void;
}

export async function generatePremiumReportStream(
  sajuData: SajuData,
  situation: Situation | undefined,
  callbacks: PremiumStreamCallbacks,
): Promise<void> {
  await ensureFunctionsTarget();
  await ensureAuth();

  // Firebase ID Token 가져오기
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    callbacks.onError('인증 토큰을 가져올 수 없습니다');
    return;
  }

  // Functions endpoint URL — region 'us-central1' 기준
  const projectId = (await import('@/services/auth/firebase')).firebaseConfig?.projectId;
  if (!projectId) {
    callbacks.onError('Firebase 프로젝트 설정 오류');
    return;
  }
  const useEmulator =
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true';
  const url = useEmulator
    ? `http://localhost:5001/${projectId}/us-central1/generatePremiumReportStream`
    : `https://us-central1-${projectId}.cloudfunctions.net/generatePremiumReportStream`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ sajuData, situation }),
    });

    if (!res.ok || !res.body) {
      callbacks.onError(`서버 오류 ${res.status}`);
      return;
    }

    // SSE 파서 — line-buffered
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE event: 한 이벤트 = `event: X\ndata: Y\n\n`
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // 마지막은 incomplete 일 수 있음

      for (const ev of events) {
        if (!ev.trim()) continue;
        const lines = ev.split('\n');
        let eventName = 'message';
        let dataLine = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) eventName = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataLine = line.slice(6);
        }
        if (!dataLine) continue;
        let payload: any = null;
        try { payload = JSON.parse(dataLine); } catch { continue; }

        if (eventName === 'start') {
          callbacks.onStart?.();
        } else if (eventName === 'group') {
          callbacks.onGroup?.(payload.group, payload.data, payload.elapsedMs);
        } else if (eventName === 'done') {
          callbacks.onDone({
            reportId: payload.reportId,
            content: payload.content as AIReportResponse,
          });
          return;
        } else if (eventName === 'error' || eventName === 'groupError') {
          callbacks.onError(payload.message || '알 수 없는 오류');
          return;
        }
      }
    }
  } catch (e: any) {
    callbacks.onError(e?.message || '네트워크 오류');
  }
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

// Stage 7e-7: generateWeeklyFortune 폐지 (사용자 결정 — 주간운세 서비스 미제공)
// 서버측 claudeWeekly.ts 는 유지 (legacy 호환), 클라이언트 export 제거.

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
