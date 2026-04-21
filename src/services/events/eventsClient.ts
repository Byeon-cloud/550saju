// 이벤트 v4 클라이언트 호출기 (markAttendance · onInviteReceived).
// 근거: 09_이벤트_v4.md §9 · 핸드오버 §1-B·§2
// emulator 연결은 reportGenerator.ts 에서 module-level 1회 연결되므로 재사용.

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app } from '@/services/auth/firebase';
import { ensureAuth } from '@/services/auth/authService';
import type { AttendanceResult } from '@/types/rewards';

const functions = getFunctions(app, 'us-central1');

let _emulatorWired = false;
function ensureEmulatorWired() {
  if (_emulatorWired) return;
  if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
    try {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    } catch {
      // 이미 연결된 경우 무시
    }
  }
  _emulatorWired = true;
}

/** 결과 페이지 렌더링 완료 직후 한 번 호출. 오늘(KST) 첫 호출만 실제 효과. */
export async function markAttendance(): Promise<AttendanceResult | null> {
  ensureEmulatorWired();
  try {
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

/** 앱인토스 ShareReward 콜백 또는 수동 초대 확정 시 호출. */
export async function onInviteReceived(args: { inviteId: string; receiver?: string }): Promise<InviteResult | null> {
  ensureEmulatorWired();
  try {
    await ensureAuth();
    const fn = httpsCallable<typeof args, InviteResult>(functions, 'onInviteReceived', { timeout: 15000 });
    const res = await fn(args);
    return res.data;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[onInviteReceived] failed:', e);
    return null;
  }
}
