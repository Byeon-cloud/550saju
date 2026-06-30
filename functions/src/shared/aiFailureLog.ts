/**
 * aiFailureLog — AI 생성/전달 실패 서버 로깅 (2026-06-30 · 근본원인 추적).
 *   Firestore `aiFailures/{autoId}` best-effort append:
 *     { type, stage, message, uid, ms, day(KST), ts }
 *   stage 예: 'groupA'|'groupB'|'groupC'|'stream'|'merge'|'callable'|'parse'
 *
 * 원칙: fire-and-forget(생성 로직 영향 0). 읽기는 어드민(adminAiUsageReport)만.
 * 주의: 종합사주 '전달 실패'(SSE done 미수신)는 서버 입장에선 성공이라 여기 안 잡힘 →
 *       그건 클라 ai_error(reason) 로 잡는다. 본 로그는 서버 측 실제 실패(그룹/예외) 캡처용.
 */
import * as admin from 'firebase-admin';

function kstDay(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface AiFailureEntry {
  type: string;
  stage: string;
  message: string;
  uid?: string;
  ms?: number;
}

export function logAiFailure(e: AiFailureEntry): void {
  try {
    admin.firestore().collection('aiFailures').add({
      type: e.type || '?',
      stage: e.stage || '?',
      message: String(e.message || '').slice(0, 500),
      uid: e.uid || 'anonymous',
      ms: Number(e.ms) || 0,
      day: kstDay(),
      ts: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => { /* fire-and-forget */ });
  } catch { /* fire-and-forget */ }
}
