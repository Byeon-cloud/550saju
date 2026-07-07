import { httpsCallable } from 'firebase/functions';
import { ensureAuth } from '@/services/auth/authService';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';
import type { SajuData, Situation } from '@/types/saju';
import { refreshCurrentDaeun } from '@/services/saju/daeunCurrent';
import type {
  AIReportResponse,
  DaeunAnalysisResponse,
  MonthlyDetailResponse,
  WeeklyDetailResponse,
  CompatibilityResponse,
  TojungResponse,
} from '@/types/report';

// Functions 엔드포인트(emulator vs prod) 는 functionsClient.ts 에서 ping 후 결정.
// emulator 죽어 있으면 자동으로 prod fallback (2026-04-22 hardening).

/** httpsCallable with extended timeout for AI calls */
function aiCallable(name: string) {
  return httpsCallable(functions, name, { timeout: 300000 }); // 5분
}

/* ─── AI 생성 지연/에러 측정 (C3 · 2026-06-10) ───
 *   trackEvent('ai_done', {type, ms, mode}) / trackEvent('ai_error', {type, mode}).
 *   fire-and-forget — 실패해도 생성 로직·UX 영향 0.
 *   SSE 실패 → callable 폴백 시: SSE 쪽은 ai_error(sse) 1회, 폴백 결과는 callable 쪽에서
 *   ai_done/ai_error 1회 — 같은 논리 생성의 ai_done 은 항상 1회만 기록됨. */
function trackAi(name: 'ai_done' | 'ai_error', params: Record<string, string | number>) {
  import('@/services/analytics').then((a) => a.trackEvent(name, params)).catch(() => {});
}

/** Cloud Function 이름 → 측정 type 매핑 (callable 경로 자동 계측) */
const CALLABLE_AI_TYPE: Record<string, string> = {
  generateReport: 'report',
  generateDailyFortune: 'daily',
  generateDreamFree: 'dream',
  generateDreamDeep: 'deepDream',
  generateDream: 'dream',
  generateChatAnswer: 'chat',
  generateDaeun: 'daeun',
  generateMonthly: 'monthly',
  generateWeekly: 'weekly',
  generateCompatibility: 'compat',
  generateTopicAnalysis: 'topic',
  generateTojung: 'tojung',
};

/** SSE 스트림 콜백 계측 래퍼 — onDone/onError 최초 1회만 ai_done/ai_error 기록 */
function wrapStreamCallbacks<C extends { onDone: (arg: any) => void; onError: (...args: any[]) => void }>(
  type: string,
  callbacks: C,
): C {
  const t0 = Date.now();
  let settled = false;
  return {
    ...callbacks,
    onDone: (arg: any) => {
      if (!settled) { settled = true; trackAi('ai_done', { type, ms: Date.now() - t0, mode: 'sse' }); }
      callbacks.onDone(arg);
    },
    onError: (...args: any[]) => {
      // 2026-06-30 — 실패 원인 추적: SSE 실패 reason(에러 메시지) 까지 기록 → 근본 원인 진단.
      if (!settled) { settled = true; trackAi('ai_error', { type, mode: 'sse', ms: Date.now() - t0, reason: String(args[0] ?? '').slice(0, 140) }); }
      (callbacks.onError as any)(...args);
    },
  } as C;
}

/** 모든 Cloud Function 호출 전 인증 + emulator/prod 타겟 보장 */
async function callWithAuth(name: string, data: any): Promise<any> {
  // 2026-07 fix — AI 페이로드의 stale 현재대운 재계산 (서버 프롬프트가 isCurrent 를 그대로 신뢰).
  //   저장 프로필로 생성 시 저장 시점 대운이 프롬프트에 박히던 문제 차단 (전 콘텐츠 단일 지점).
  refreshCurrentDaeun(data?.sajuData);
  refreshCurrentDaeun(data?.sajuData1); // 궁합 (2인)
  refreshCurrentDaeun(data?.sajuData2);
  await ensureFunctionsTarget(); // emulator ping → prod fallback
  await ensureAuth(); // 인증 완료까지 대기
  const fn = aiCallable(name);
  const type = CALLABLE_AI_TYPE[name];
  const t0 = Date.now();
  try {
    const result = await fn(data);
    if (type) trackAi('ai_done', { type, ms: Date.now() - t0, mode: 'callable' });
    return result;
  } catch (e) {
    if (type) trackAi('ai_error', { type, mode: 'callable', ms: Date.now() - t0, reason: String((e as any)?.message || '').slice(0, 140) });
    throw e;
  }
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
 * 종합사주 결과 복구 — 서버 recovery 블롭에서 같은 uid 의 최근(1시간 내) 결과를 끌어옴 (재생성 0).
 * 2026-06-30 토큰 절감: SSE 전달 실패 시 callable 재생성 전에 호출 → 이미 만든 결과 재사용.
 * 호출부에서 sajuData 일치 확인 후 사용할 것(다른 사주 결과 오용 방지).
 */
export async function recoverPremiumResult(): Promise<{ found: boolean; reportId?: string; reportType?: string; content?: any; sajuData?: any }> {
  try {
    const result = await callWithAuth('recoverPremiumResult', {});
    return (result?.data as any) || { found: false };
  } catch {
    return { found: false };
  }
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
  refreshCurrentDaeun(sajuData); // 2026-07 fix — SSE 경로도 stale 현재대운 재계산
  callbacks = wrapStreamCallbacks('premium', callbacks); // C3 측정 (로직 무변경)
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
    // 🚨 2026-06-22 CRITICAL — done/error 이벤트를 받기 전에 스트림이 끝남(모바일 네트워크 전환·
    //   토스 웹뷰·Cloud Run/프록시 idle-timeout 등으로 연결이 '조용히' 끊김). 기존: 그냥 break →
    //   onDone/onError 둘 다 미발화 → ResultPage '분석 중' 배너가 영원히 + 환불·에러·복구 0 (무한로딩 직접 원인).
    //   이제 강제 onError → handleStreamFailure 로 환불 + 에러카드 정상 전환.
    callbacks.onError('완료 신호 없이 연결이 종료됐어요. 다시 시도해주세요.');
  } catch (e: any) {
    callbacks.onError(e?.message || '네트워크 오류');
  }
}

/**
 * Phase 1 (2026-05-27) · 1운 리포트 SSE 스트리밍 — generatePremiumReportStream 패턴 미러링.
 *   서버: generateReportStream (onRequest SSE · 3 그룹 병렬 · 1운 차감)
 *   onGroup: 그룹 A/B/C 도착 (각각 ~25-30s)
 *   onDone: 머지된 최종 content + reportId
 *   결과 페이지가 첫 그룹 도착 시 즉시 진입 → 점진 렌더 (오늘의 운세 패턴).
 */
export interface ReportStreamCallbacks {
  onStart?: () => void;
  onGroup?: (group: 'A' | 'B' | 'C', data: any, elapsedMs: number) => void;
  onDone: (result: { reportId: string; content: AIReportResponse }) => void;
  onError: (message: string) => void;
}

export async function generateReportStream(
  sajuData: SajuData,
  situation: Situation | undefined,
  callbacks: ReportStreamCallbacks,
): Promise<void> {
  refreshCurrentDaeun(sajuData); // 2026-07 fix — SSE 경로도 stale 현재대운 재계산
  callbacks = wrapStreamCallbacks('report', callbacks); // C3 측정 (로직 무변경)
  await ensureFunctionsTarget();
  await ensureAuth();

  const { getAuth } = await import('firebase/auth');
  const idToken = await getAuth().currentUser?.getIdToken();
  if (!idToken) {
    callbacks.onError('인증 토큰을 가져올 수 없습니다');
    return;
  }

  const projectId = (await import('@/services/auth/firebase')).firebaseConfig?.projectId;
  if (!projectId) { callbacks.onError('Firebase 프로젝트 설정 오류'); return; }
  const useEmulator =
    import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true';
  const url = useEmulator
    ? `http://localhost:5001/${projectId}/us-central1/generateReportStream`
    : `https://us-central1-${projectId}.cloudfunctions.net/generateReportStream`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ sajuData, situation }),
    });
    if (!res.ok || !res.body) { callbacks.onError(`서버 오류 ${res.status}`); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const ev of events) {
        if (!ev.trim()) continue;
        let eventName = 'message';
        let dataLine = '';
        for (const line of ev.split('\n')) {
          if (line.startsWith('event: ')) eventName = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataLine = line.slice(6);
        }
        if (!dataLine) continue;
        let payload: any = null;
        try { payload = JSON.parse(dataLine); } catch { continue; }

        if (eventName === 'start') callbacks.onStart?.();
        else if (eventName === 'group') callbacks.onGroup?.(payload.group, payload.data, payload.elapsedMs);
        else if (eventName === 'done') {
          callbacks.onDone({ reportId: payload.reportId, content: payload.content as AIReportResponse });
          return;
        } else if (eventName === 'error' || eventName === 'groupError') {
          callbacks.onError(payload.message || '알 수 없는 오류');
          return;
        }
      }
    }
    // 🚨 2026-06-22 CRITICAL — done/error 없이 스트림 종료(연결 silent-break) → 강제 onError (무한로딩 차단)
    callbacks.onError('완료 신호 없이 연결이 종료됐어요. 다시 시도해주세요.');
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
 * 오늘의 운세 SSE Streaming v6.1 (2026-05-06) — Parallel 3-way (A1·A2·B) + Shared Cache
 *   서버: generateDailyFortuneStream (onRequest SSE · 3-way 병렬)
 *   사용처: DailyFortunePage analyze() — Group A1 도착 시 즉시 결과 페이지 전이 (~6s)
 *
 *   이벤트 흐름:
 *     start → chunk(group:'A1'|'A2'|'B') × N → group(A1) ~6s → group(A2/B) ~25s → done
 *     (3 그룹 순서 무관, A1 이 가장 작아서 첫 도달)
 */
export type DailyFortuneGroupId = 'A1' | 'A2' | 'B' | 'A'; // 'A' 는 v6 legacy

export interface DailyFortuneStreamCallbacks {
  onStart?: () => void;
  onProgress?: (info: { chunks: number; chars: number; elapsedMs: number }) => void;
  /**
   * Partial JSON 도착 시 — Group A1/A2/B 의 누적 partial 을 머지한 결과.
   * 첫 valid object (title 등) 도달 시 클라이언트가 즉시 결과 페이지 전이.
   */
  onPartial?: (info: { partial: any; totalChars: number; group?: DailyFortuneGroupId }) => void;
  /**
   * Group 완료 시 — early phase transition 트리거.
   * Group A1 도착 시점 (~6s) 이 첫 paint 핵심.
   */
  onGroup?: (info: { group: DailyFortuneGroupId; data: any; elapsedMs: number }) => void;
  onDone: (info: { result: any | null; cached?: boolean; elapsedMs?: number }) => void;
  onError: (message: string) => void;
}

export async function generateDailyFortuneStream(
  args: {
    name: string;
    sajuData: any;
    date: string;
    weekday: string;
    todayGanzi: string;
    jeolgi?: string;
    dayJiShen?: string[];
    dayXiongSha?: string[];
    baseScores100?: { wealth: number; love: number; career: number; health: number };
    tomorrowGanzi?: string;
    tomorrowDate?: string;
  },
  callbacks: DailyFortuneStreamCallbacks,
): Promise<void> {
  callbacks = wrapStreamCallbacks('daily', callbacks); // C3 측정 (로직 무변경)
  await ensureFunctionsTarget();
  await ensureAuth();

  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const idToken = await auth.currentUser?.getIdToken();
  // anonymous 도 허용 — idToken 없어도 호출 가능 (서버에서 anonymous 처리)

  const projectId = (await import('@/services/auth/firebase')).firebaseConfig?.projectId;
  if (!projectId) {
    callbacks.onError('Firebase 프로젝트 설정 오류');
    return;
  }
  const useEmulator =
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true';
  const url = useEmulator
    ? `http://localhost:5001/${projectId}/us-central1/generateDailyFortuneStream`
    : `https://us-central1-${projectId}.cloudfunctions.net/generateDailyFortuneStream`;

  console.log('[generateDailyFortuneStream] starting', { url, hasToken: !!idToken });
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const t0 = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });
    console.log('[generateDailyFortuneStream] response', {
      status: res.status,
      hasBody: !!res.body,
      elapsedMs: Date.now() - t0,
    });

    if (!res.ok || !res.body) {
      callbacks.onError(`서버 오류 ${res.status}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    // Progressive Render v6.1 — Group A1/A2/B 별도 누적
    type GKey = 'A1' | 'A2' | 'B';
    const accumulated: Record<GKey, string> = { A1: '', A2: '', B: '' };
    const groupResults: Record<GKey, any> = { A1: null, A2: null, B: null };
    let lastPartialSig = '';
    // partial-json lazy import (실패해도 streaming 자체는 작동)
    let partialParse: any = null;
    let AllowAll: any = null;
    try {
      const mod: any = await import('partial-json');
      partialParse = mod.parse;
      AllowAll = mod.Allow?.ALL ?? mod.ALLOW_ALL ?? undefined;
    } catch (e) {
      console.warn('[generateDailyFortuneStream] partial-json 로드 실패 — progressive render 비활성:', e);
    }

    /** 한 그룹의 partial 파싱 (group 완료 시는 그대로 반환)
     *  2026-05-27 — Dream/Topic 과 통일: '{' prefix 부터 substring 파싱 (AI 가 prelude 붙여도 안전) */
    const parseGroupPartial = (key: GKey): any => {
      if (groupResults[key]) return groupResults[key];
      const acc = accumulated[key];
      if (acc.length < 40 || !partialParse) return null;
      const startIdx = acc.indexOf('{');
      if (startIdx === -1) return null;
      const jsonStr = startIdx === 0 ? acc : acc.slice(startIdx);
      if (jsonStr.length < 20) return null;
      try {
        return AllowAll !== undefined ? partialParse(jsonStr, AllowAll) : partialParse(jsonStr);
      } catch { return null; }
    };

    /** Group A1·A2·B partial 머지 + onPartial 호출 (signature 변경 시만) */
    const tryEmitPartial = (currentGroup: DailyFortuneGroupId) => {
      if (!callbacks.onPartial) return;
      const merged: any = {};
      const a1 = parseGroupPartial('A1');
      const a2 = parseGroupPartial('A2');
      const b = parseGroupPartial('B');
      if (a1 && typeof a1 === 'object') Object.assign(merged, a1);
      if (a2 && typeof a2 === 'object') Object.assign(merged, a2);
      if (b && typeof b === 'object') Object.assign(merged, b);
      const sig = Object.keys(merged).sort().join(',');
      const totalChars = accumulated.A1.length + accumulated.A2.length + accumulated.B.length;
      if (sig && (sig !== lastPartialSig || totalChars % 500 === 0)) {
        lastPartialSig = sig;
        try {
          callbacks.onPartial({ partial: merged, totalChars, group: currentGroup });
        } catch (err) {
          console.warn('[generateDailyFortuneStream] onPartial threw:', err);
        }
      }
    };

    /** 서버 group 식별자 → 클라이언트 키 정규화 (v6 legacy 'A' 도 호환) */
    const normalizeGroup = (g: any): GKey => {
      if (g === 'A1') return 'A1';
      if (g === 'A2') return 'A2';
      if (g === 'B') return 'B';
      return 'A1'; // legacy 'A' fallback → A1 으로 매핑
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

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
        } else if (eventName === 'chunk') {
          const g = normalizeGroup(payload.group);
          accumulated[g] += String(payload.delta || '');
          tryEmitPartial(g);
        } else if (eventName === 'group') {
          const g = normalizeGroup(payload.group);
          groupResults[g] = payload.data;
          callbacks.onGroup?.({ group: g, data: payload.data, elapsedMs: payload.elapsedMs });
          tryEmitPartial(g);
        } else if (eventName === 'progress') {
          callbacks.onProgress?.(payload);
        } else if (eventName === 'done') {
          callbacks.onDone({ result: payload.result, cached: payload.cached, elapsedMs: payload.elapsedMs });
        } else if (eventName === 'error') {
          callbacks.onError(payload.message || '알 수 없는 오류');
        }
      }
    }
    // 2026-07-03 silent-break 가드 — done/error 없이 스트림 종료 시 강제 onError (무한로딩 차단 · 종합사주 스트림과 동일)
    callbacks.onError('완료 신호 없이 연결이 종료됐어요. 다시 시도해주세요.');
  } catch (e: any) {
    console.error('[generateDailyFortuneStream] fetch failed:', e?.message, e);
    callbacks.onError(e?.message || '네트워크 오류');
  }
}

/**
 * 주제분석 SSE 스트리밍 — 오늘의 운세 패턴 (단일 호출 스트림 + partial-json 점진 렌더).
 *   서버: generateTopicAnalysisStream (onRequest SSE). 프롬프트·모델 callable 과 동일.
 *   onPartial: 누적 텍스트 partial-json 파싱 결과 (첫 minimal key 도달 시 클라 phase 전이)
 *   onDone: 최종 parsed content + reportId  /  onError: 실패 (호출부에서 callable 폴백)
 */
export interface TopicStreamCallbacks {
  onStart?: () => void;
  onPartial?: (info: { partial: any; totalChars: number }) => void;
  onDone: (info: { reportId: string; content: any }) => void;
  onError: (message: string) => void;
}

export async function generateTopicAnalysisStream(
  args: { topicId: string; sajuData: any; baseScore?: number; partnerInfo?: any; extraInfo?: any },
  callbacks: TopicStreamCallbacks,
): Promise<void> {
  callbacks = wrapStreamCallbacks('topic', callbacks); // C3 측정 (로직 무변경)
  await ensureFunctionsTarget();
  await ensureAuth();

  const { getAuth } = await import('firebase/auth');
  const idToken = await getAuth().currentUser?.getIdToken();

  const projectId = (await import('@/services/auth/firebase')).firebaseConfig?.projectId;
  if (!projectId) { callbacks.onError('Firebase 프로젝트 설정 오류'); return; }
  const useEmulator =
    import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true';
  const url = useEmulator
    ? `http://localhost:5001/${projectId}/us-central1/generateTopicAnalysisStream`
    : `https://us-central1-${projectId}.cloudfunctions.net/generateTopicAnalysisStream`;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(args) });
    if (!res.ok || !res.body) { callbacks.onError(`서버 오류 ${res.status}`); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulated = '';
    let lastSig = '';

    // partial-json lazy import (실패해도 스트리밍 자체는 작동 — done 에서 최종 파싱)
    let partialParse: any = null;
    let AllowAll: any = null;
    try {
      const mod: any = await import('partial-json');
      partialParse = mod.parse;
      AllowAll = mod.Allow?.ALL ?? mod.ALLOW_ALL ?? undefined;
    } catch (e) {
      console.warn('[generateTopicAnalysisStream] partial-json 로드 실패 — progressive render 비활성:', e);
    }

    // 2026-05-27 — Dream 과 통일: threshold 80→40, prefix '{' 부터 substring 파싱, throttle delta 기반
    let lastEmitLen = 0;
    const tryEmitPartial = () => {
      if (!callbacks.onPartial || !partialParse || accumulated.length < 40) return;
      const startIdx = accumulated.indexOf('{');
      if (startIdx === -1) return;
      const jsonStr = startIdx === 0 ? accumulated : accumulated.slice(startIdx);
      if (jsonStr.length < 20) return;
      let obj: any = null;
      try { obj = AllowAll !== undefined ? partialParse(jsonStr, AllowAll) : partialParse(jsonStr); }
      catch { return; }
      if (!obj || typeof obj !== 'object') return;
      const sig = Object.keys(obj).sort().join(',');
      if (sig && (sig !== lastSig || accumulated.length - lastEmitLen >= 400)) {
        lastSig = sig;
        lastEmitLen = accumulated.length;
        try { callbacks.onPartial({ partial: obj, totalChars: accumulated.length }); }
        catch (err) { console.warn('[topicStream] onPartial threw:', err); }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const ev of events) {
        if (!ev.trim()) continue;
        let eventName = 'message';
        let dataLine = '';
        for (const line of ev.split('\n')) {
          if (line.startsWith('event: ')) eventName = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataLine = line.slice(6);
        }
        if (!dataLine) continue;
        let payload: any = null;
        try { payload = JSON.parse(dataLine); } catch { continue; }

        if (eventName === 'start') {
          callbacks.onStart?.();
        } else if (eventName === 'chunk') {
          accumulated += String(payload.delta || '');
          tryEmitPartial();
        } else if (eventName === 'done') {
          callbacks.onDone({ reportId: payload.reportId, content: payload.content });
          return;
        } else if (eventName === 'error') {
          callbacks.onError(payload.message || '알 수 없는 오류');
          return;
        }
      }
    }
    // 2026-07-03 silent-break 가드 — done/error 없이 스트림 종료 시 강제 onError (무한로딩 차단 · 종합사주 스트림과 동일)
    callbacks.onError('완료 신호 없이 연결이 종료됐어요. 다시 시도해주세요.');
  } catch (e: any) {
    console.error('[generateTopicAnalysisStream] fetch failed:', e?.message);
    callbacks.onError(e?.message || '네트워크 오류');
  }
}

/**
 * 꿈해몽 무료 SSE 스트리밍 — 오늘의 운세 패턴 (단일 호출 스트림 + partial-json 점진).
 *   서버: generateDreamFreeStream (onRequest SSE). 프롬프트·모델 callable 과 동일.
 *   onPartial: 누적 partial-json  /  onDone: 최종 content  /  onError: 폴백 트리거
 */
export interface DreamFreeStreamCallbacks {
  onStart?: () => void;
  /** partial-json 누적 머지 결과 (Group A·B 합쳐진 상태) */
  onPartial?: (info: { partial: any; totalChars: number; group?: 'A' | 'B' }) => void;
  /** 그룹 완료 (parsed JSON · 2-그룹 병렬 모드) */
  onGroup?: (info: { group: 'A' | 'B'; data: any; elapsedMs: number }) => void;
  onDone: (info: { content: any }) => void;
  onError: (message: string, code?: string) => void;
}

export async function generateDreamFreeStream(
  args: { saju?: any; dreamContent: string; category: string; userConcern?: string },
  callbacks: DreamFreeStreamCallbacks,
): Promise<void> {
  callbacks = wrapStreamCallbacks('dream', callbacks); // C3 측정 (로직 무변경)
  await ensureFunctionsTarget();
  await ensureAuth();

  const { getAuth } = await import('firebase/auth');
  const idToken = await getAuth().currentUser?.getIdToken();

  const projectId = (await import('@/services/auth/firebase')).firebaseConfig?.projectId;
  if (!projectId) { callbacks.onError('Firebase 프로젝트 설정 오류'); return; }
  const useEmulator =
    import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true';
  const url = useEmulator
    ? `http://localhost:5001/${projectId}/us-central1/generateDreamFreeStream`
    : `https://us-central1-${projectId}.cloudfunctions.net/generateDreamFreeStream`;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(args) });
    if (!res.ok || !res.body) { callbacks.onError(`서버 오류 ${res.status}`); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    // 2026-05-27 v8 — 2-그룹 병렬 지원: A/B 별도 누적, A/B group 완료 시 머지.
    const accGroup: Record<'A' | 'B', string> = { A: '', B: '' };
    const groupResults: Record<'A' | 'B', any> = { A: null, B: null };
    let accumulated = ''; // legacy single-call fallback (사주 없을 때)
    let lastSig = '';
    let partialParse: any = null;
    let AllowAll: any = null;
    try {
      const mod: any = await import('partial-json');
      partialParse = mod.parse;
      AllowAll = mod.Allow?.ALL ?? mod.ALLOW_ALL ?? undefined;
    } catch (e) {
      console.warn('[generateDreamFreeStream] partial-json 로드 실패 — progressive render 비활성:', e);
    }

    /** 한 그룹 partial 파싱 — 2026-05-27 v10: 임계값 40→15, 매우 공격적 점진 파싱 */
    const parseGroupPartial = (g: 'A' | 'B'): any => {
      if (groupResults[g]) return groupResults[g];
      const acc = accGroup[g];
      if (acc.length < 15 || !partialParse) return null;
      const startIdx = acc.indexOf('{');
      if (startIdx === -1) return null;
      const jsonStr = startIdx === 0 ? acc : acc.slice(startIdx);
      if (jsonStr.length < 10) return null;
      try { return AllowAll !== undefined ? partialParse(jsonStr, AllowAll) : partialParse(jsonStr); }
      catch { return null; }
    };

    let lastEmitLen = 0;
    /** 2-그룹 머지 partial → onPartial emit (throttle 400→200) */
    const tryEmitGroupPartial = (currentGroup: 'A' | 'B') => {
      if (!callbacks.onPartial) return;
      const a = parseGroupPartial('A');
      const b = parseGroupPartial('B');
      if (!a && !b) return;
      const merged: any = { ...(a || {}), ...(b || {}) };
      const sig = Object.keys(merged).sort().join(',');
      const totalChars = accGroup.A.length + accGroup.B.length;
      if (sig && (sig !== lastSig || totalChars - lastEmitLen >= 200)) {
        lastSig = sig;
        lastEmitLen = totalChars;
        try { callbacks.onPartial({ partial: merged, totalChars, group: currentGroup }); }
        catch (err) { console.warn('[dreamFreeStream] onPartial threw:', err); }
      }
    };

    /** Single-call fallback partial (사주 없을 때) */
    const tryEmitSinglePartial = () => {
      if (!callbacks.onPartial || !partialParse || accumulated.length < 40) return;
      const startIdx = accumulated.indexOf('{');
      if (startIdx === -1) return;
      const jsonStr = startIdx === 0 ? accumulated : accumulated.slice(startIdx);
      if (jsonStr.length < 20) return;
      let obj: any = null;
      try { obj = AllowAll !== undefined ? partialParse(jsonStr, AllowAll) : partialParse(jsonStr); }
      catch { return; }
      if (!obj || typeof obj !== 'object') return;
      const sig = Object.keys(obj).sort().join(',');
      if (sig && (sig !== lastSig || accumulated.length - lastEmitLen >= 400)) {
        lastSig = sig;
        lastEmitLen = accumulated.length;
        try { callbacks.onPartial({ partial: obj, totalChars: accumulated.length }); }
        catch (err) { console.warn('[dreamFreeStream] onPartial threw:', err); }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const ev of events) {
        if (!ev.trim()) continue;
        let eventName = 'message';
        let dataLine = '';
        for (const line of ev.split('\n')) {
          if (line.startsWith('event: ')) eventName = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataLine = line.slice(6);
        }
        if (!dataLine) continue;
        let payload: any = null;
        try { payload = JSON.parse(dataLine); } catch { continue; }

        if (eventName === 'start') {
          callbacks.onStart?.();
        } else if (eventName === 'chunk') {
          // 2-그룹 모드면 group 필드 존재. 단일 모드면 없음.
          const g = payload.group as ('A' | 'B' | undefined);
          if (g === 'A' || g === 'B') {
            accGroup[g] += String(payload.delta || '');
            tryEmitGroupPartial(g);
          } else {
            accumulated += String(payload.delta || '');
            tryEmitSinglePartial();
          }
        } else if (eventName === 'group') {
          // 한 그룹 완전 완료 (parsed JSON) — 머지 갱신
          const g = payload.group as 'A' | 'B';
          if (g === 'A' || g === 'B') {
            groupResults[g] = payload.data;
            callbacks.onGroup?.({ group: g, data: payload.data, elapsedMs: payload.elapsedMs });
            // 머지 즉시 갱신
            const merged: any = { ...(groupResults.A || {}), ...(groupResults.B || {}) };
            try { callbacks.onPartial?.({ partial: merged, totalChars: accGroup.A.length + accGroup.B.length, group: g }); }
            catch { /* noop */ }
          }
        } else if (eventName === 'done') {
          callbacks.onDone({ content: payload.content });
          return;
        } else if (eventName === 'error') {
          callbacks.onError(payload.message || '알 수 없는 오류', payload.code);
          return;
        }
      }
    }
    // 2026-07-03 silent-break 가드 — done/error 없이 스트림 종료 시 강제 onError (무한로딩 차단 · 종합사주 스트림과 동일)
    callbacks.onError('완료 신호 없이 연결이 종료됐어요. 다시 시도해주세요.');
  } catch (e: any) {
    console.error('[generateDreamFreeStream] fetch failed:', e?.message);
    callbacks.onError(e?.message || '네트워크 오류');
  }
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
 * 월별 운세 — 단일월 심층 (2026-06-30 재작업) — Firebase Function → Claude Sonnet 4.6
 * monthInfo = 클라(MonthlyPage)가 lunar-javascript 로 정확 계산한 선택월 정보
 *   { year, month, label, wolGanji, yearGanji }. 서버는 간지 추측 X (만세력 정확성).
 */
export interface MonthInfo {
  year: number;
  month: number;
  label: string;     // '2026년 6월'
  wolGanji: string;  // 월간지 (한자, 예: '甲午')
  yearGanji: string; // 세운간지 (한자, 예: '丙午')
}

export async function generateMonthlyFortune2026(
  sajuData: SajuData,
  monthInfo: MonthInfo,
  progressId?: string, // 점진 로딩 좌표 — 서버가 M1/M2 그룹을 progress/{id} 에 증분 write
): Promise<{ reportId: string; content: MonthlyDetailResponse }> {
  const result = await callWithAuth('generateMonthly', { sajuData, monthInfo, progressId });
  return result.data as { reportId: string; content: MonthlyDetailResponse };
}

/** ⚡ async 2차리뷰 — 초안(1차만·~시간 반토막). 차감은 여기서 1회. 즉시 노출용. */
export async function generateMonthlyDraft2026(
  sajuData: SajuData,
  monthInfo: MonthInfo,
): Promise<{ reportId: string; content: MonthlyDetailResponse }> {
  const result = await callWithAuth('generateMonthlyDraft', { sajuData, monthInfo });
  return result.data as { reportId: string; content: MonthlyDetailResponse };
}

/** ⚡ async 2차리뷰 — 보정(2차만·백그라운드·무차감). 실패해도 draft 그대로 반환(무해). */
export async function generateMonthlyRefine2026(
  sajuData: SajuData,
  monthInfo: MonthInfo,
  draft: MonthlyDetailResponse,
  reportId?: string,
): Promise<{ content: MonthlyDetailResponse }> {
  const result = await callWithAuth('generateMonthlyRefine', { sajuData, monthInfo, draft, reportId });
  return result.data as { content: MonthlyDetailResponse };
}

/**
 * 주간운세 (이번 주 7일) — Firebase Function → Claude Sonnet 4.6
 * 2026-06-29 NEW. weekDays = 클라가 lunar-javascript 로 계산한 7일 일진 [{day,date,ganji,ganjiRead}].
 */
export async function generateWeeklyFortune(
  sajuData: SajuData,
  weekDays: { day: string; date: string; ganji: string; ganjiRead?: string }[],
  progressId?: string, // 점진 로딩 좌표 — 서버가 W1/W2 그룹을 progress/{id} 에 증분 write
): Promise<{ reportId: string; content: WeeklyDetailResponse }> {
  const result = await callWithAuth('generateWeekly', { sajuData, weekDays, progressId });
  return result.data as { reportId: string; content: WeeklyDetailResponse };
}

/** ⚡ async 2차리뷰 — 주간 초안(1차만·시간 반토막). 차감 1회. 즉시 노출용. */
export async function generateWeeklyDraft2026(
  sajuData: SajuData,
  weekDays: { day: string; date: string; ganji: string; ganjiRead?: string }[],
): Promise<{ reportId: string; content: WeeklyDetailResponse }> {
  const result = await callWithAuth('generateWeeklyDraft', { sajuData, weekDays });
  return result.data as { reportId: string; content: WeeklyDetailResponse };
}

/** ⚡ async 2차리뷰 — 주간 보정(2차만·백그라운드·무차감). 실패해도 draft 반환. */
export async function generateWeeklyRefine2026(
  sajuData: SajuData,
  weekDays: { day: string; date: string; ganji: string; ganjiRead?: string }[],
  draft: WeeklyDetailResponse,
  reportId?: string,
): Promise<{ content: WeeklyDetailResponse }> {
  const result = await callWithAuth('generateWeeklyRefine', { sajuData, weekDays, draft, reportId });
  return result.data as { content: WeeklyDetailResponse };
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
