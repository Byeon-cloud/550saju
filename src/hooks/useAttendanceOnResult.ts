// 결과 페이지(무료·유료 공통) 렌더링 완료 시 1회 markAttendance 호출 훅.
// 근거: 09_이벤트_v4.md §3·§9 · 핸드오버 §0-Q3
//
// 사용:
//   const { mark } = useAttendanceOnResult();
//   useEffect(() => { if (isLoaded) mark(); }, [isLoaded]);
//
// 중복 방지:
//   - 같은 세션 내 재호출 no-op (sessionStorage 플래그)
//   - 서버가 KST 당일 1회만 attendance 생성 → idempotent
//   - streak/week 달성 시 sessionStorage에 Tier A/B 플래그 저장 → 이벤트 탭 이동 시 트리거

import { useCallback, useRef } from 'react';
import { markAttendance as callMarkAttendance } from '@/services/events/eventsClient';
import type { AttendanceResult } from '@/types/rewards';

const SESSION_FIRED_KEY = 'events_attendance_marked_session';

export function useAttendanceOnResult() {
  const firedRef = useRef(false);

  const mark = useCallback(async (): Promise<AttendanceResult | null> => {
    if (firedRef.current) return null;
    try {
      if (sessionStorage.getItem(SESSION_FIRED_KEY) === '1') return null;
    } catch {/* ignore */}
    firedRef.current = true;
    try { sessionStorage.setItem(SESSION_FIRED_KEY, '1'); } catch {/* ignore */}

    const res = await callMarkAttendance();
    if (!res) return null;

    // Tier A: 3일 연속 달성 (streakRewardGranted)
    if (res.streakRewardGranted) {
      try {
        sessionStorage.setItem('events_pending_tier_a', '운 1 들어왔어요 · 3일 연속 출석');
      } catch {/* ignore */}
    }

    // Tier B: 7일 완주 (weekRewardGranted)
    if (res.weekRewardGranted && res.weekRewardKind) {
      try {
        sessionStorage.setItem('events_pending_tier_b', res.weekRewardKind);
      } catch {/* ignore */}
    }

    return res;
  }, []);

  return { mark };
}
