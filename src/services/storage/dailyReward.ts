/**
 * dailyReward — 데일리 리워드 배지 저장소 유틸 (Phase 1 · 클라이언트 only)
 *
 * 근거:
 *   - `docs/prd/P2_Path_E_티켓_트래커.md` P2-5
 *   - 인수인계 §7.P2-5 "DailyFortunePage 상단 — '오늘 3원 리워드' 배지"
 *   - `docs/prd/런칭프로모_3원리워드.md` §2.3 (1회성 3원 프로모 — 별도 장치)
 *
 * 단위 결정 (자체 · 준기 override 가능):
 *   인수인계 원문의 "3원" 은 런칭 프로모 PRD 의 1회성 3원 (KRW) 과 명칭 충돌.
 *   현재 balance 시스템은 "운(運)" 단위 (1운=500원, 최소 0.1 단위).
 *   → 데일리 배지는 **"0.1운 (= 50원 상당) 리워드"** 로 구현, UI 문구는 "데일리 리워드" 로 교체.
 *     (런칭 3원 프로모는 별도 `launchReward` 모델 — 본 유틸과 분리.)
 *
 * 제한:
 *   - 일 1회
 *   - 월 30회 (= 3운/월)
 *   - Phase 1 은 localStorage 기반 → 어뷰징 방어 없음. 서버 연결 시 보강 (TODO).
 */

import { addRewardBalance } from './localStore';

const LAST_CLAIM_KEY = 'saju500:daily_reward:last'; // YYYY-MM-DD
const MONTH_COUNT_KEY = 'saju500:daily_reward:month'; // { ym: 'YYYY-MM', count: number }

export const DAILY_REWARD_UN = 0.1; // 0.1운 = 50원 상당
export const MONTHLY_LIMIT = 30;    // 월 최대 3운

export interface DailyRewardState {
  claimedToday: boolean;
  monthReachedLimit: boolean;
  monthCount: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function thisMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function readMonthCount(): { ym: string; count: number } {
  try {
    const raw = window.localStorage.getItem(MONTH_COUNT_KEY);
    if (!raw) return { ym: thisMonthKey(), count: 0 };
    const parsed = JSON.parse(raw) as { ym: string; count: number };
    if (parsed.ym !== thisMonthKey()) {
      // 월이 넘어가면 자동 리셋
      return { ym: thisMonthKey(), count: 0 };
    }
    return parsed;
  } catch {
    return { ym: thisMonthKey(), count: 0 };
  }
}

function writeMonthCount(count: number): void {
  try {
    window.localStorage.setItem(
      MONTH_COUNT_KEY,
      JSON.stringify({ ym: thisMonthKey(), count }),
    );
  } catch {
    /* noop */
  }
}

export function getDailyRewardState(): DailyRewardState {
  let last = '';
  try {
    last = window.localStorage.getItem(LAST_CLAIM_KEY) ?? '';
  } catch { /* noop */ }
  const { count } = readMonthCount();
  return {
    claimedToday: last === todayKey(),
    monthReachedLimit: count >= MONTHLY_LIMIT,
    monthCount: count,
  };
}

/**
 * 데일리 리워드 수령. 성공 시 reward 버킷에 DAILY_REWARD_UN(0.1운) 추가.
 * @returns 수령 성공 여부 (false = 오늘 이미 수령 or 월 한도 초과)
 */
export function claimDailyReward(): boolean {
  const state = getDailyRewardState();
  if (state.claimedToday) return false;
  if (state.monthReachedLimit) return false;

  addRewardBalance(DAILY_REWARD_UN);
  try {
    window.localStorage.setItem(LAST_CLAIM_KEY, todayKey());
    writeMonthCount(state.monthCount + 1);
  } catch {
    /* noop — balance 는 이미 적립되었으므로 키 저장 실패 시에도 중복 지급 우려는 addRewardBalance 가 localStorage 에 의존하므로 동일하게 실패 */
  }
  // 7일 연속 출석 추적 (토스 프로모션 "7일 출석 완주 리워드" 연동)
  trackAttendanceStreak();
  // TODO(server): Phase 2 — Cloud Functions 로 이관. 어뷰징 방어 (기기 fingerprint + 토스 CI).
  return true;
}

/* ─────────────────────────────────────────────────────────────
 * 2026-06-02 통합 — 콘텐츠 이용 시 자동 출석 + 보상 (무료/유료 무관).
 *   기존 결함: (a) 일일 0.1운·출석이 "오늘운세 배지 클릭"에서만 적립 → 다른 콘텐츠 쓰면 누락,
 *   (b) 서버 markAttendance 의 3일 보상(운1)은 Firestore unBalance 에 써서 클라 localStorage 에 안 보임.
 *   해결: 어떤 콘텐츠 결과든 processAttendanceRewards() 1회 호출 → 클라 localStorage 잔액에 직접 적립.
 *   · 일일 0.1운 (일1회·월30회)  · 3일 연속 → 1운  · 7일 연속 → 토스 100원 프로모션
 * ──────────────────────────────────────────────────────────── */

const STREAK3_AT_KEY = 'saju500:attend_3day:streakAt'; // 마지막 3일보상 지급 시점의 streak 값

// 대시보드 v2 (C2) — 리워드 적립 계측 (fire-and-forget, 실패해도 UX 영향 0)
function trackReward(kind: 'daily' | 'streak3' | 'attend7', amount: number): void {
  import('@/services/analytics').then((a) => a.trackEvent('reward_earned', { kind, amount })).catch(() => {});
}

export interface AttendanceRewardResult {
  attendedNewToday: boolean;
  dailyRewardGranted: boolean;   // 0.1운
  streak3Granted: boolean;       // 1운
  streakCount: number;
}

/** 콘텐츠 결과 도달 시 호출 — 출석 적립 + 모든 일일/연속 보상 자동 지급 (클라 잔액 적립). */
export function processAttendanceRewards(): AttendanceRewardResult {
  const today = todayKey();
  let dailyRewardGranted = false;
  let streak3Granted = false;

  // 1) 일일 0.1운 자동 지급 (오늘 미수령 + 월 30회 한도)
  const st = getDailyRewardState();
  if (!st.claimedToday && !st.monthReachedLimit) {
    addRewardBalance(DAILY_REWARD_UN);
    try {
      window.localStorage.setItem(LAST_CLAIM_KEY, today);
      writeMonthCount(st.monthCount + 1);
    } catch { /* noop */ }
    dailyRewardGranted = true;
    trackReward('daily', DAILY_REWARD_UN);
  }

  // 2) 출석 streak 적립 (오늘 첫 콘텐츠일 때만)
  let days = readAttendDays();
  const attendedNewToday = days[days.length - 1] !== today;
  if (attendedNewToday) {
    days.push(today);
    days = days.slice(-7);
    writeAttendDays(days);
    // 7일 연속 → 토스 프로모션 (반복 사이클 — 7일 채울 때마다 지급, 앱인토스 환경에서만 실동작)
    tryGrant7DayCycle(days);
  }

  // 3) 3일 연속 → 1운 (3일 사이클마다 1회 · 클라 잔액 직접 적립)
  const streak = getAttendanceStreakCount();
  let lastAt = 0;
  try { lastAt = Number(window.localStorage.getItem(STREAK3_AT_KEY) || 0); } catch { /* noop */ }
  if (streak < lastAt) {
    // streak 끊김 → 기준 리셋
    lastAt = 0;
    try { window.localStorage.setItem(STREAK3_AT_KEY, '0'); } catch { /* noop */ }
  }
  if (streak - lastAt >= 3) {
    addRewardBalance(1);
    try { window.localStorage.setItem(STREAK3_AT_KEY, String(streak)); } catch { /* noop */ }
    streak3Granted = true;
    trackReward('streak3', 1);
  }

  return { attendedNewToday, dailyRewardGranted, streak3Granted, streakCount: streak };
}

/* ─────────────────────────────────────────────────────────────
 * 7일 출석 완주 추적 (토스 콘솔 "사주500 · 7일 출석 완주 리워드" 연동)
 *
 * 2026-05-09 추가 — 출석 일자를 배열로 추적, 연속 7일 시 grant7DayAttendance().
 * 출시 전 테스트: simulate7DayCompletion() 으로 7일 즉시 채워 TEST_ 코드 1회 호출 검증.
 * ──────────────────────────────────────────────────────────── */

const ATTEND_DAYS_KEY = 'saju500:attend_7day:days'; // ['YYYY-MM-DD', ...] (최근 7일 윈도우)
// 2026-06-08 — 준기 정정: 7일 완주 프로모는 1회성이 아니라 "7일 채울 때마다 계속 반복 지급".
//   기존 done 플래그(영구 1회) 폐기 → 지급일 기록 + 지급 후 days 리셋(다음 사이클 1일차부터).
const ATTEND_GRANT_AT_KEY = 'saju500:attend_7day:grantedAt'; // 마지막 지급일 YYYY-MM-DD (같은 날 중복 방지)

function readAttendDays(): string[] {
  try {
    const raw = window.localStorage.getItem(ATTEND_DAYS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeAttendDays(days: string[]): void {
  try {
    window.localStorage.setItem(ATTEND_DAYS_KEY, JSON.stringify(days.slice(-7)));
  } catch { /* noop */ }
}

// 2026-06-26 — 준기 결정: 5일 프로모 폐기. 토스 콘솔에 등록·활성된 기존 7일 프로모 코드 그대로 사용.
const ATTEND_TARGET_DAYS = 7;  // 7일 출석 완주
const ATTEND_GRACE_DAYS = 0;   // 순수 7일 연속 (원복)

/** 출석 완주 여부 — 최근 5개 출석일의 캘린더 span 이 (5-1+1=5)일 이내면 완주 = 5일 중 하루 빠짐 1회 허용. */
function isStreakComplete(days: string[]): boolean {
  if (days.length < ATTEND_TARGET_DAYS) return false;
  const lastN = days.slice(-ATTEND_TARGET_DAYS).map((d) => new Date(d + 'T00:00:00').getTime());
  const spanDays = Math.round((lastN[lastN.length - 1] - lastN[0]) / 86400000);
  return spanDays <= (ATTEND_TARGET_DAYS - 1 + ATTEND_GRACE_DAYS);
}

/** 출석 1일 적립 — 연속 7일 완성 시 토스 프로모션 지급 호출 */
export function trackAttendanceStreak(): void {
  const today = todayKey();
  let days = readAttendDays();
  if (days[days.length - 1] === today) return; // 오늘 이미 적립
  days.push(today);
  days = days.slice(-7);
  writeAttendDays(days);

  // 토스 프로모션 "7일 출석 완주 리워드" — 반복 사이클 (앱인토스 환경에서만 실동작)
  tryGrant7DayCycle(days);
}

/** 마지막 7일 완주 지급일 (같은 날 중복 지급 방지) */
function lastGrant7Day(): string {
  try {
    return window.localStorage.getItem(ATTEND_GRANT_AT_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * 7일 연속 완주 시 토스 프로모션 지급 시도 — 반복 사이클.
 * 지급 성공(또는 토스측 already_granted) 시: 지급일 기록 + days 윈도우 리셋 → 다음날부터 새 7일 사이클.
 * 실패(not_in_toss 등) 시: 리셋하지 않음 → 다음 콘텐츠 이용 때 재시도.
 */
function tryGrant7DayCycle(days: string[]): void {
  if (!isStreakComplete(days)) return;
  const today = todayKey();
  if (lastGrant7Day() === today) return; // 오늘 이미 지급됨
  import('@/services/toss/tossPromotion').then((m) => {
    m.grant7DayAttendance().then((r) => {
      if (r.ok || r.reason === 'already_granted') {
        try {
          window.localStorage.setItem(ATTEND_GRANT_AT_KEY, today);
        } catch { /* noop */ }
        writeAttendDays([]); // 다음 7일 사이클 시작
        if (r.ok) trackReward('attend7', 0); // 토스 프로모션 지급 (운 적립 아님 → amount 0)
      }
    });
  });
}

export function getAttendanceStreakCount(): number {
  const days = readAttendDays();
  // 뒤에서부터 연속 카운트
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (i === days.length - 1) { streak = 1; continue; }
    const cur = new Date(days[i + 1] + 'T00:00:00').getTime();
    const prev = new Date(days[i] + 'T00:00:00').getTime();
    if (Math.round((cur - prev) / 86400000) === 1) streak++;
    else break;
  }
  return streak;
}

/**
 * 출시 전 테스트 전용 — 7일 완주를 즉시 시뮬레이션.
 * 토스 정책상 출시 전 TEST_ 코드로 최소 1회 호출해야 콘솔 "시작하기" 활성화됨.
 * 7일 출석은 실제로 7일 걸려 테스트 불가 → 본 함수로 7일 채워 TEST 호출 검증.
 *
 * 호출법 (개발자 콘솔/디버그): import('@/services/storage/dailyReward').then(m => m.simulate7DayCompletion())
 */
export async function simulate7DayCompletion(): Promise<{ ok: boolean; reason?: string }> {
  // 오늘 기준 과거 7일 연속 날짜 생성
  const days: string[] = [];
  for (let i = ATTEND_TARGET_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  writeAttendDays(days);
  // 지급일 초기화 (재테스트 가능)
  try { window.localStorage.removeItem(ATTEND_GRANT_AT_KEY); } catch { /* noop */ }

  const m = await import('@/services/toss/tossPromotion');
  const r = await m.grant7DayAttendance();
  if (r.ok || r.reason === 'already_granted') {
    try { window.localStorage.setItem(ATTEND_GRANT_AT_KEY, todayKey()); } catch { /* noop */ }
    writeAttendDays([]); // 다음 사이클 시작 (반복 지급 구조와 동일)
  }
  return { ok: r.ok, reason: r.reason };
}
