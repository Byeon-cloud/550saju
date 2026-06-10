/**
 * aiUsageLog — AI 토큰 사용량 서버 로깅 (C7 · 2026-06-10 대시보드 v2)
 *
 * Firestore `aiUsage/{autoId}` 에 best-effort append:
 *   { type, model, inputTokens, outputTokens, ms, ok, day(KST), ts }
 *
 * 원칙:
 *  - fire-and-forget — try/catch + .catch() 이중 방어. 실패해도 생성 로직 영향 0.
 *  - 호출부는 "로깅 한 줄"만 추가 (생성 로직·반환값 절대 변경 금지).
 *  - usage 가 없으면 호출부에서 스킵 (Anthropic: response.usage.input_tokens/output_tokens,
 *    Gemini: usageMetadata.promptTokenCount/candidatesTokenCount).
 *  - 읽기는 어드민(/admin)만 — firestore.rules `aiUsage` read: isOwner().
 */
import * as admin from 'firebase-admin';

export interface AiUsageEntry {
  /** 콘텐츠 타입 (premium|report|topic|dream|deepDream|daily|chat 등) */
  type: string;
  /** 모델 ID (claude-opus-4-6 / claude-sonnet-4-6 / gemini-* 등) */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** API 호출 소요 ms */
  ms: number;
  /** 호출 성공 여부 */
  ok: boolean;
}

function kstDay(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** AI 사용량 기록 — fire-and-forget (await 금지 · 실패 무해) */
export function logAiUsage(entry: AiUsageEntry): void {
  try {
    admin
      .firestore()
      .collection('aiUsage')
      .add({
        type: entry.type,
        model: entry.model,
        inputTokens: Number(entry.inputTokens) || 0,
        outputTokens: Number(entry.outputTokens) || 0,
        ms: Number(entry.ms) || 0,
        ok: entry.ok !== false,
        day: kstDay(), // KST 날짜 버킷 (집계 쿼리 효율)
        ts: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => { /* fire-and-forget */ });
  } catch { /* fire-and-forget */ }
}
