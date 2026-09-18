// 이벤트 v4 클라이언트 호출기 (markAttendance · onInviteReceived).
// 근거: 09_이벤트_v4.md §9 · 핸드오버 §1-B·§2
// 2026-04-22 hardening: emulator 죽어도 prod 자동 fallback (functionsClient.ts).

import { httpsCallable } from 'firebase/functions';
import { ensureAuth } from '@/services/auth/authService';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';
import type { AttendanceResult } from '@/types/rewards';

/**
 * 결과 페이지 렌더링 완료 직후 한 번 호출. 오늘(KST) 첫 호출만 실제 효과.
 * 2026-09-17 — 서버 STUB 장부(users/{uid}.unBalance · streakAttendance) 기록용. 운은 기기 장부
 *   (dailyReward.processAttendanceRewards)에서 지급되므로 반환값을 표시·토스트 근거로 쓰지 말 것.
 */
export async function markAttendance(): Promise<AttendanceResult | null> {
  try {
    await ensureFunctionsTarget();
    await ensureAuth();
    const fn = httpsCallable<unknown, AttendanceResult>(functions, 'markAttendance', { timeout: 30000 });
    const res = await fn({});
    return res.data;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[markAttendance] failed (non-blocking):', e);
    return null;
  }
}

export interface InviteResult {
  granted: boolean;
  dailyCount?: number;
  reason?: 'already_claimed' | 'daily_cap' | 'duplicate_receiver';
  idempotencyKey?: string;
}

/**
 * @deprecated 2026-09-17 — 호출처 없음. 초대 보상은 기기 장부(shareReward.claimShareReward('invite'))로 통일.
 *   서버 inviteEvents·unBalance 에 운이 따로 쌓이던 경로이며, 한 번에 여러 친구에게 보내도 inviteId 가 1개라
 *   2번째부터 already_claimed 로 막히던 문제도 있었다. 서버 함수 정리는 functions 영역 과제.
 */
export async function onInviteReceived(args: { inviteId: string; receiver?: string }): Promise<InviteResult | null> {
  try {
    await ensureFunctionsTarget();
    await ensureAuth();
    const fn = httpsCallable<typeof args, InviteResult>(functions, 'onInviteReceived', { timeout: 15000 });
    const res = await fn(args);
    // 2026-06-18 — 바이럴 수신 전환 트래킹 (공유→신규유입 K-factor)
    import('@/services/analytics').then((a) => a.trackEvent('invite_received', { granted: res.data?.granted ? 1 : 0, reason: String((res.data as any)?.reason || '').slice(0, 40) })).catch(() => {});
    return res.data;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[onInviteReceived] failed:', e);
    return null;
  }
}
