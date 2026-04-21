// v4.1 이벤트 탭 보상 타입 (2026-04-21)
// 근거: 사주500_UI개편_09_이벤트_v4.md §4·§5·§6 · 핸드오버 §1-B

export type RewardType =
  | 'attendance_streak3'          // 3일 연속 출석 → 운 1
  | 'attendance_week7_tosspoint'  // 7일 모두 출석 → 토스포인트 100원
  | 'attendance_week7_fallback'   // 토스포인트 지급 실패 시 폴백 → 운 2
  | 'invite'                      // 친구 초대 1건 → 운 1
  | 'share'                       // 공유 리워드 → 운 1
  | 'etc';                        // 기타 런칭 이벤트

export type RewardCurrency = 'UN' | 'TOSSPOINT';

export interface RewardClaim {
  type: RewardType;
  amount: number;                 // UN: 운 개수 · TOSSPOINT: 원
  currency: RewardCurrency;
  cycle?: string;                 // weekKey (YYYY-Www) or date (YYYY-MM-DD)
  idempotencyKey?: string;
  tossTxId?: string;               // 토스 API 응답 key (STUB 모드는 "STUB_...")
  inviteId?: string;
  grantedAt: unknown;              // Firestore Timestamp
}

/** Tier A (1운) · Tier B (토스포인트 100원) 모달 구분 */
export type RewardTier = 'A' | 'B';

/** markAttendance·claim* Function 반환 형식 */
export interface AttendanceResult {
  attended: boolean;               // 오늘 최초 여부
  streakCount: number;             // 현재 이동윈도우 streak (0~3)
  weekProgress: {
    completed: number;             // 이번 주 출석 일수 (0~7)
    weekKey: string;
  };
  streakRewardGranted?: boolean;   // 이번 호출로 3일 달성했는가
  weekRewardGranted?: boolean;     // 이번 호출로 7일 달성했는가
  weekRewardKind?: 'tosspoint' | 'un_fallback' | null;
  tossTxId?: string;
}
