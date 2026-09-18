// 결과 페이지(무료·유료 공통) 렌더링 완료 시 1회 서버 markAttendance 호출 훅.
// 근거: 09_이벤트_v4.md §3·§9 · 핸드오버 §0-Q3
//
// 사용:
//   const { mark } = useAttendanceOnResult();
//   useEffect(() => { if (isLoaded) mark(); }, [isLoaded]);
//
// 2026-09-17 — 장부 통일: 출석·운 지급·이벤트 탭 알림(Tier A/B)은 기기 장부가 SSOT.
//   실제 출석 적립·보상은 결과 도달 시 dailyReward.processAttendanceRewards() 가 처리하고,
//   3일 연속 운 지급 / 7일 토스포인트 지급 성공 시 그 자리에서 이벤트 탭 알림 플래그를 남긴다.
//   이 훅의 서버 호출(users/{uid}.unBalance 등 STUB 장부)은 기록용으로만 유지 — 결과를 표시·토스트 근거로 쓰지 않는다.
//   (구 동작: 서버가 3일 달성이라 답하면 "운 1 들어왔어요" 토스트 → 기기 잔액엔 운이 없어 허위 안내가 됐다.)
//
// 중복 방지:
//   - 같은 세션 내 재호출 no-op (sessionStorage 플래그)
//   - 서버가 KST 당일 1회만 attendance 생성 → idempotent

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

    // 서버 STUB 장부 기록 (non-blocking) — 반환값은 호출부 호환용. 알림 플래그는 세우지 않는다.
    return callMarkAttendance();
  }, []);

  return { mark };
}
