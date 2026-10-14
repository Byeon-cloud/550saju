/**
 * aiUsageLog — AI 토큰 사용량 서버 로깅 (C7 · 2026-06-10 대시보드 v2)
 *
 * Firestore `aiUsage/{autoId}` 에 best-effort append:
 *   { type, model, inputTokens, outputTokens, ms, ok, day(KST), ts }
 *   + 선택 필드 (2026-10-03 원가 사각지대 보강): via · truncated · cacheReadTokens · cacheWriteTokens
 *     → 값이 있을 때만 기록 (Firestore 는 undefined 필드를 거부).
 *
 * 원칙:
 *  - fire-and-forget — try/catch + .catch() 이중 방어. 실패해도 생성 로직 영향 0.
 *  - 호출부는 "로깅 한 줄"만 추가 (생성 로직·반환값 절대 변경 금지).
 *  - usage 가 없으면 호출부에서 스킵 (Anthropic: response.usage.input_tokens/output_tokens,
 *    Gemini: usageMetadata.promptTokenCount/candidatesTokenCount).
 *    Anthropic 응답은 logAnthropicUsage(type, model, msg, t0, via) 한 줄로 — usage 없으면 내부에서 skip.
 *  - ⚠️ Anthropic usage.input_tokens 는 캐시 read/write 토큰을 제외한 값. 캐시 토큰은
 *    cacheReadTokens / cacheWriteTokens 로 따로 기록 (단가가 달라 원가 집계 시 별도 합산 필요).
 *  - 읽기는 어드민(/admin)만 — firestore.rules `aiUsage` read: isOwner().
 */
import * as admin from 'firebase-admin';

export interface AiUsageEntry {
  /** 콘텐츠 타입 (premium|report|topic|dream|deepDream|daily|chat|monthly|weekly 등) */
  type: string;
  /** 모델 ID (claude-opus-5-5 / claude-sonnet-5-5 / claude-haiku-5-5, 10-14 이전 기록은 4.6 세대) */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** API 호출 소요 ms */
  ms: number;
  /** 호출 성공 여부 */
  ok: boolean;
  /** 호출 경로 — callable(onCall) / stream(SSE onRequest) / fallback(스트림 내 폴백 호출). 미지정 시 미기록 */
  via?: 'callable' | 'stream' | 'fallback' | string;
  /** 출력 상한 도달로 잘림 (Anthropic stop_reason === 'max_tokens') */
  truncated?: boolean;
  /** 프롬프트 캐시 read 토큰 (Anthropic usage.cache_read_input_tokens) */
  cacheReadTokens?: number;
  /** 프롬프트 캐시 write 토큰 (Anthropic usage.cache_creation_input_tokens) */
  cacheWriteTokens?: number;
}

function kstDay(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** AI 사용량 기록 — fire-and-forget (await 금지 · 실패 무해) */
export function logAiUsage(entry: AiUsageEntry): void {
  try {
    const doc: Record<string, unknown> = {
      type: entry.type,
      model: entry.model,
      inputTokens: Number(entry.inputTokens) || 0,
      outputTokens: Number(entry.outputTokens) || 0,
      ms: Number(entry.ms) || 0,
      ok: entry.ok !== false,
      day: kstDay(), // KST 날짜 버킷 (집계 쿼리 효율)
      ts: admin.firestore.FieldValue.serverTimestamp(),
    };
    // 선택 필드 — 값이 있을 때만 (Firestore undefined 거부 · 기존 문서 shape 무변경)
    if (entry.via) doc.via = String(entry.via);
    if (typeof entry.truncated === 'boolean') doc.truncated = entry.truncated;
    if (Number.isFinite(entry.cacheReadTokens)) doc.cacheReadTokens = Number(entry.cacheReadTokens);
    if (Number.isFinite(entry.cacheWriteTokens)) doc.cacheWriteTokens = Number(entry.cacheWriteTokens);
    admin
      .firestore()
      .collection('aiUsage')
      .add(doc)
      .catch(() => { /* fire-and-forget */ });
  } catch { /* fire-and-forget */ }
}

/** Anthropic 응답 최소 shape — messages.create() 결과 · stream.finalMessage() 결과 둘 다 수용 */
export interface AnthropicMsgLike {
  usage?: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  } | null;
  stop_reason?: string | null;
}

/**
 * Anthropic 응답에서 바로 기록 — fire-and-forget (await 금지 · 실패 무해 · 반환값 없음).
 *  - usage 없으면 skip (기존 `if (msg.usage)` 관례 동일).
 *  - truncated = stop_reason === 'max_tokens' (stop_reason 이 없으면 미기록).
 *  - cache read/write 토큰은 숫자일 때만 기록.
 */
export function logAnthropicUsage(
  type: string,
  model: string,
  msgLike: AnthropicMsgLike | null | undefined,
  t0: number,
  via?: AiUsageEntry['via'],
): void {
  try {
    const u = msgLike?.usage;
    if (!u) return;
    const stop = msgLike?.stop_reason;
    logAiUsage({
      type,
      model,
      inputTokens: Number(u.input_tokens) || 0,
      outputTokens: Number(u.output_tokens) || 0,
      ms: Date.now() - t0,
      ok: true,
      via,
      truncated: stop ? stop === 'max_tokens' : undefined,
      cacheReadTokens: typeof u.cache_read_input_tokens === 'number' ? u.cache_read_input_tokens : undefined,
      cacheWriteTokens: typeof u.cache_creation_input_tokens === 'number' ? u.cache_creation_input_tokens : undefined,
    });
  } catch { /* fire-and-forget */ }
}
