// v4.1 이벤트 탭 보상 타입 (2026-04-21)
// 근거: 사주500_UI개편_09_이벤트_v4.md §4·§5·§6 · 핸드오버 §1-B
//
// 2026-09-17 — 장부 통일: 실제 운 지급은 기기(localStorage)에서 일어나므로 이벤트 탭의 모든 숫자는
//   기기 장부(DeviceRewardType · RewardLedger)에서 읽는다. 아래 RewardType·RewardClaim·AttendanceResult 는
//   서버 STUB 장부(users/{uid}.unBalance · rewardClaims · streakAttendance) 스키마 — 표시·토스트 근거로 쓰지 말 것.

/* ─────────────────────────────────────────────────────────────
 * 기기 장부 (src/services/storage/dailyReward.ts · 이벤트 탭 표시 SSOT)
 * ──────────────────────────────────────────────────────────── */

/** 기기에서 실제로 지급되는 보상 종류 */
export type DeviceRewardType =
  | 'daily'         // 하루 첫 결과 → 운 0.1
  | 'streak3'       // 3일 연속 출석마다 → 운 1
  | 'invite'        // 친구 초대 공유 완료 → 운 1 (공유와 하루 3회 한도 공유)
  | 'share'         // 결과 공유 완료 → 운 1 (초대와 하루 3회 한도 공유)
  | 'launch_promo'  // 첫 콘텐츠 → 토스포인트 (원 · 앱인토스 1회)
  | 'attend7';      // 7일 연속 출석마다 → 토스포인트 (원 · 앱인토스 반복)

export const DEVICE_REWARD_TYPES: readonly DeviceRewardType[] = [
  'daily', 'streak3', 'invite', 'share', 'launch_promo', 'attend7',
];
/** 운 단위 보상 (나머지는 토스포인트 원 단위) */
export const UN_REWARD_TYPES: readonly DeviceRewardType[] = ['daily', 'streak3', 'invite', 'share'];

export interface RewardLedgerEntry {
  /** 중복 기록 방지 id (예: daily:2026-09-17 · attend7:2026-09-17) */
  id: string;
  /** 운 또는 원 — 단위는 보상 종류로 판단 */
  amount: number;
  /** 지급 시각 (epoch ms) */
  at: number;
  /** 지급일 KST YYYY-MM-DD */
  date: string;
}

export interface RewardLedger {
  v: 1;
  /** 이 기기에서 장부를 쓰기 시작한 날 (KST) — 그 이전 운 지급은 기록에 없음 */
  since: string;
  totals: Record<DeviceRewardType, number>;
  counts: Record<DeviceRewardType, number>;
  /** 종류별 최근 기록 (최신순 · 종류마다 최대 10건) */
  recent: Record<DeviceRewardType, RewardLedgerEntry[]>;
}

/* ─────────────────────────────────────────────────────────────
 * 서버 STUB 장부 스키마 (functions markAttendance · onInviteReceived) — 표시 근거 사용 금지
 * ──────────────────────────────────────────────────────────── */

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

/** markAttendance·claim* Function 반환 형식 (서버 STUB — 운 지급·표시에 사용 금지) */
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
