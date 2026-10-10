/**
 * dailyReward — 출석·데일리 리워드 **기기 장부** (localStorage · 앱인토스/웹 공통)
 *
 * 근거:
 *   - `docs/prd/P2_Path_E_티켓_트래커.md` P2-5
 *   - 인수인계 §7.P2-5 "DailyFortunePage 상단 — '오늘 3원 리워드' 배지"
 *   - `docs/prd/런칭프로모_3원리워드.md` §2.3 (1회성 프로모 — 별도 장치)
 *
 * 단위 결정 (자체 · 준기 override 가능):
 *   인수인계 원문의 "3원" 은 런칭 프로모 PRD 의 1회성 3원 (KRW) 과 명칭 충돌.
 *   현재 balance 시스템은 "운(運)" 단위 (1운=500원, 최소 0.1 단위).
 *   → 데일리 배지는 **"0.1운 (= 50원 상당) 리워드"** 로 구현, UI 문구는 "데일리 리워드" 로 교체.
 *     (출시 프로모션은 tossPromotion.ts 의 토스포인트 지급 — 본 유틸과 분리.)
 *
 * 2026-09-17 — 장부 통일 (준기 "원래 기획대로"):
 *   · 실제 운 지급이 이 기기(localStorage)에서 일어나므로 이벤트 탭의 모든 숫자
 *     (연속 출석 · 7일 진행 · 초대 남은 횟수 · 누적 받은 운)는 이 파일의 기기 장부에서 읽는다.
 *     서버 STUB 장부(users/{uid}.unBalance · streakAttendance · rewardClaims)는 표시 근거로 쓰지 않는다.
 *   · 출석 = 콘텐츠 결과 도달(processAttendanceRewards)만 인정. 오늘의 운세 배지로 0.1운 받기는 출석이 아니다.
 *   · 3일 연속마다 운 1 (3·6·9…일째). 연속 일수 카운터에 상한이 없어 7일을 넘겨도 멈추지 않는다.
 *     (구 구조는 출석일 목록을 최근 7개로 잘라 연속 일수가 7에서 멈췄고, 6일째 지급 기준과 겹쳐 3일 보상이 영구 정지됐다.)
 *   · 요일 무관 7일 연속마다 토스포인트 100원 반복 지급 (7·14·21…일째 · 앱인토스만).
 *     중복 방지는 사이클 단위(완주일) — 프로모 코드 단위 영구 키로는 2번째 사이클부터 지급이 막혔다.
 *     이벤트 탭의 "지급 완료" 는 토스 지급 성공 기록이 있을 때만 표시한다.
 *   · 날짜는 KST(kstToday) 기준.
 *
 * 제한:
 *   - 데일리 0.1운: 일 1회 · 월 30회 (= 3운/월)
 *   - 기기 저장소 기반 → 시계 조작·저장소 초기화 어뷰징 방어 없음. TODO(server): 서버 장부 이관.
 */

import { addRewardBalance } from './localStore';
import { isAppsInToss } from '@/services/payment/iapService';
import { kstToday } from '@/utils/kstDate';
import {
  DEVICE_REWARD_TYPES,
  UN_REWARD_TYPES,
  type DeviceRewardType,
  type RewardLedger,
  type RewardLedgerEntry,
} from '@/types/rewards';

const LAST_CLAIM_KEY = 'saju500:daily_reward:last'; // YYYY-MM-DD (KST)
const MONTH_COUNT_KEY = 'saju500:daily_reward:month'; // { ym: 'YYYY-MM', count: number }

export const DAILY_REWARD_UN = 0.1; // 0.1운 = 50원 상당
export const MONTHLY_LIMIT = 30;    // 월 최대 3운
export const STREAK_REWARD_DAYS = 3; // 3일 연속마다
export const STREAK_REWARD_UN = 1;   // 운 1
export const ATTEND_CYCLE_DAYS = 7;  // 7일 연속마다 토스포인트 (순수 연속 · 빠짐 허용 없음)

export interface DailyRewardState {
  claimedToday: boolean;
  monthReachedLimit: boolean;
  monthCount: number;
}

/* ─── 날짜 (KST) ─── */

function todayKey(): string {
  return kstToday();
}

function thisMonthKey(): string {
  return kstToday().slice(0, 7);
}

/** 'YYYY-MM-DD' → 일 단위 정수 (형식 오류면 NaN) */
function dayIndex(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(t) ? NaN : Math.round(t / 86400000);
}

function daysBetween(from: string, to: string): number {
  return dayIndex(to) - dayIndex(from);
}

function kstDateOf(epochMs: number): string {
  return new Date(epochMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ─────────────────────────────────────────────────────────────
 * 보상 기록 장부 — 기기에서 지급한 모든 보상(운·토스포인트)의 합계 + 종류별 최근 10건.
 *   이벤트 탭 "지금까지 받은 운" 카드·상세 시트의 SSOT.
 *   addRewardBalance(localStore) 자체는 기록을 남기지 않으므로 지급 호출부(이 파일·shareReward·tossPromotion)가 함께 기록한다.
 *   장부는 2026-09-17 도입 — 그 이전 운 지급은 복원할 수 없어 `since` 로 기록 시작일을 표시한다.
 * ──────────────────────────────────────────────────────────── */

const REWARD_LEDGER_KEY = 'saju500:reward_ledger:v1';
const LEDGER_RECENT_MAX = 10;

/** 장부·출석 상태가 바뀌면 window 에 발행 — 이벤트 탭이 구독해 즉시 갱신 */
export const REWARD_LEDGER_CHANGED_EVENT = 'saju500:reward-ledger-changed';

function zeroByType(): Record<DeviceRewardType, number> {
  return { daily: 0, streak3: 0, invite: 0, share: 0, launch_promo: 0, attend7: 0 };
}

function emptyLedger(): RewardLedger {
  return {
    v: 1,
    since: todayKey(),
    totals: zeroByType(),
    counts: zeroByType(),
    recent: { daily: [], streak3: [], invite: [], share: [], launch_promo: [], attend7: [] },
  };
}

function notifyRewardChanged(): void {
  try {
    window.dispatchEvent(new Event(REWARD_LEDGER_CHANGED_EVENT));
  } catch { /* noop */ }
}

export function getRewardLedger(): RewardLedger {
  const ledger = emptyLedger();
  try {
    const raw = window.localStorage.getItem(REWARD_LEDGER_KEY);
    if (!raw) return ledger;
    const p = JSON.parse(raw) as Partial<RewardLedger> | null;
    if (!p || typeof p !== 'object') return ledger;
    if (typeof p.since === 'string' && p.since) ledger.since = p.since;
    for (const t of DEVICE_REWARD_TYPES) {
      const total = Number(p.totals?.[t]);
      if (Number.isFinite(total)) ledger.totals[t] = total;
      const count = Number(p.counts?.[t]);
      if (Number.isFinite(count)) ledger.counts[t] = count;
      const rec = p.recent?.[t];
      if (Array.isArray(rec)) {
        ledger.recent[t] = rec
          .filter((e): e is RewardLedgerEntry =>
            !!e && typeof e.id === 'string' && Number.isFinite(Number(e.amount)) && Number.isFinite(Number(e.at)))
          .slice(0, LEDGER_RECENT_MAX);
      }
    }
  } catch { /* 손상 — 빈 장부로 취급 */ }
  return ledger;
}

/** 장부에 기록이 1건이라도 있는가 */
export function hasRewardRecords(ledger: RewardLedger = getRewardLedger()): boolean {
  return DEVICE_REWARD_TYPES.some((t) => ledger.counts[t] > 0);
}

/** 기기 장부 기준 지금까지 받은 운 합계 (토스포인트 제외) */
export function getReceivedUnTotal(ledger: RewardLedger = getRewardLedger()): number {
  return round1(UN_REWARD_TYPES.reduce((sum, t) => sum + ledger.totals[t], 0));
}

/**
 * 보상 지급 기록 1건 추가. 같은 id 가 최근 기록에 있으면 무시(중복 기록 방지).
 * 잔액 적립은 하지 않는다 — 호출부가 addRewardBalance / 토스 지급 성공 후 호출.
 * @returns 기록 여부
 */
export function appendRewardLog(
  type: DeviceRewardType,
  amount: number,
  id: string,
  at: number = Date.now(),
): boolean {
  if (!(amount > 0)) return false;
  const ledger = getRewardLedger();
  if (ledger.recent[type].some((e) => e.id === id)) return false;
  // 장부가 없던 기기는 emptyLedger 의 since(오늘)가 그대로 기록 시작일이 된다.
  // 이전 지급 기록을 옮겨 담을 때(seedLegacyPromoLedger)처럼 시작일보다 이른 기록이면 시작일을 그 날로 당긴다.
  const date = kstDateOf(at);
  if (DATE_RE.test(date) && (!DATE_RE.test(ledger.since) || date < ledger.since)) ledger.since = date;
  ledger.totals[type] = round1(ledger.totals[type] + amount);
  ledger.counts[type] += 1;
  ledger.recent[type] = [{ id, amount, at, date }, ...ledger.recent[type]]
    .sort((a, b) => b.at - a.at)
    .slice(0, LEDGER_RECENT_MAX);
  try {
    window.localStorage.setItem(REWARD_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    return false;
  }
  notifyRewardChanged();
  return true;
}

/* ─── 이벤트 탭 알림 플래그 (sessionStorage · EventsPage TrampolineFromSession 이 소비) ─── */

export const EVENTS_PENDING_TIER_A_KEY = 'events_pending_tier_a'; // 값 = 토스트 문구
export const EVENTS_PENDING_TIER_B_KEY = 'events_pending_tier_b'; // 값 = 'tosspoint'

function setPendingEventNotice(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch { /* noop */ }
}

/* ─── 데일리 0.1운 ─── */

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

// 대시보드 v2 (C2) — 리워드 적립 계측 (fire-and-forget, 실패해도 UX 영향 0)
function trackReward(kind: 'daily' | 'streak3' | 'attend7', amount: number): void {
  import('@/services/analytics').then((a) => a.trackEvent('reward_earned', { kind, amount })).catch(() => {});
}

/** 오늘 미수령 + 월 한도 이내면 0.1운 지급. 수령 기록을 먼저 남기고(실패 시 미지급) 적립 — 중복 지급 방지. */
function grantDailyIfEligible(): boolean {
  const st = getDailyRewardState();
  if (st.claimedToday || st.monthReachedLimit) return false;
  const today = todayKey();
  try {
    window.localStorage.setItem(LAST_CLAIM_KEY, today);
  } catch {
    return false;
  }
  writeMonthCount(st.monthCount + 1);
  addRewardBalance(DAILY_REWARD_UN);
  appendRewardLog('daily', DAILY_REWARD_UN, `daily:${today}`);
  trackReward('daily', DAILY_REWARD_UN);
  return true;
}

/**
 * 데일리 리워드 수령 (오늘의 운세 배지). 성공 시 reward 버킷에 DAILY_REWARD_UN(0.1운) 추가.
 * 출석으로는 치지 않는다 — 출석은 콘텐츠 결과 도달(processAttendanceRewards)만 인정.
 * @returns 수령 성공 여부 (false = 오늘 이미 수령 or 월 한도 초과)
 */
export function claimDailyReward(): boolean {
  // TODO(server): Phase 2 — Cloud Functions 로 이관. 어뷰징 방어 (기기 fingerprint + 토스 CI).
  return grantDailyIfEligible();
}

/* ─────────────────────────────────────────────────────────────
 * 출석 — 콘텐츠 결과 도달 시 processAttendanceRewards() 1회 호출 (무료/유료 무관 · 같은 날 재호출 안전).
 *   · 일일 0.1운 (일1회·월30회)  · 3일 연속마다 → 운 1  · 7일 연속마다 → 토스포인트 100원 (앱인토스)
 *   2026-06-02 통합 배경: 일일 0.1운·출석이 오늘운세 배지 클릭에서만 적립되던 누락 + 서버 markAttendance 의
 *   3일 보상(운1)이 Firestore unBalance 에 써져 기기 잔액에 안 보이던 문제 → 기기 잔액에 직접 적립.
 * ──────────────────────────────────────────────────────────── */

const ATTEND_STATE_KEY = 'saju500:attend:state:v2';
// 레거시 (2026-05-09 ~ 09-16) — 새 상태가 없을 때 1회 이관 원천. 구버전 롤백 대비 삭제하지 않는다.
//   구 'saju500:attend_3day:streakAt' 는 이관하지 않음 (새 규칙은 연속 일수 3의 배수 날에 지급).
const LEGACY_ATTEND_DAYS_KEY = 'saju500:attend_7day:days';
const LEGACY_ATTEND_GRANT_AT_KEY = 'saju500:attend_7day:grantedAt';

interface AttendState {
  v: 2;
  /** 마지막 출석일 (KST YYYY-MM-DD) */
  lastDate: string;
  /** lastDate 로 끝나는 연속 출석 일수 — 상한 없음 */
  streak: number;
  /** 마지막 3일 연속 보상 지급일 (같은 날 중복 방지) */
  streak3PaidOn: string;
  /** 7일 완주했지만 토스포인트 지급 성공 기록이 없는 사이클 (완주일) — 없으면 '' */
  cycle7Pending: string;
  /** 토스포인트 지급 성공이 기록된 마지막 사이클 (완주일) */
  cycle7PaidOn: string;
}

function emptyAttendState(): AttendState {
  return { v: 2, lastDate: '', streak: 0, streak3PaidOn: '', cycle7Pending: '', cycle7PaidOn: '' };
}

/** 구 구조(최근 7개 출석일 배열 + 지급일)에서 연속 일수 복원 — 최선 추정 */
function migrateLegacyAttendState(): AttendState {
  const st = emptyAttendState();
  try {
    const raw = window.localStorage.getItem(LEGACY_ATTEND_DAYS_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    const days = Array.from(new Set(
      (Array.isArray(arr) ? arr : []).filter((x): x is string => typeof x === 'string' && DATE_RE.test(x)),
    )).sort();
    const grantedAt = window.localStorage.getItem(LEGACY_ATTEND_GRANT_AT_KEY) ?? '';
    if (days.length > 0) {
      let run = 1;
      for (let i = days.length - 1; i > 0; i--) {
        if (daysBetween(days[i - 1], days[i]) === 1) run++;
        else break;
      }
      const runStart = days[days.length - run];
      st.lastDate = days[days.length - 1];
      // 구 구조는 7일 완주 처리 직후 목록을 비웠다 → 앞에 최소 7일 연속이 더 있었다.
      //   처리일 다음날부터 이어짐(차이 1): 처리일까지 7일 + run
      //   처리일 당일부터 이어짐(차이 0): 비운 뒤 같은 날 결과를 또 보면 처리일이 목록 첫 칸으로 다시 들어갔다 → 처리일 중복 1일 제외
      const gapFromGrant = DATE_RE.test(grantedAt) ? daysBetween(grantedAt, runStart) : NaN;
      st.streak = gapFromGrant === 1
        ? run + ATTEND_CYCLE_DAYS
        : gapFromGrant === 0
          ? run + ATTEND_CYCLE_DAYS - 1
          : run;
    } else if (DATE_RE.test(grantedAt)) {
      // 완주 처리 직후 비워진 상태 — 처리일이 마지막 출석일(연속 7일 이상)
      st.lastDate = grantedAt;
      st.streak = ATTEND_CYCLE_DAYS;
    }
    // 구 grantedAt 은 토스측 실지급 없이 'already_granted' 로도 기록됐으므로 지급 성공 기록(cycle7PaidOn)으로 옮기지 않는다.
  } catch { /* noop */ }
  return st;
}

function readAttendState(): AttendState {
  try {
    const raw = window.localStorage.getItem(ATTEND_STATE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AttendState> | null;
      if (p && p.v === 2) {
        const str = (x: unknown) => (typeof x === 'string' ? x : '');
        const streak = Number(p.streak);
        return {
          v: 2,
          lastDate: str(p.lastDate),
          streak: Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0,
          streak3PaidOn: str(p.streak3PaidOn),
          cycle7Pending: str(p.cycle7Pending),
          cycle7PaidOn: str(p.cycle7PaidOn),
        };
      }
    }
  } catch { /* 손상 — 레거시 이관으로 */ }
  return migrateLegacyAttendState();
}

function writeAttendState(st: AttendState): boolean {
  try {
    window.localStorage.setItem(ATTEND_STATE_KEY, JSON.stringify(st));
    return true;
  } catch {
    return false;
  }
}

export interface AttendanceRewardResult {
  attendedNewToday: boolean;
  dailyRewardGranted: boolean;   // 0.1운
  streak3Granted: boolean;       // 1운
  streakCount: number;
  /** 이번 호출로 7일 연속을 채워 토스포인트 지급 대기에 올렸는가 (앱인토스만) */
  cycle7Completed: boolean;
}

/** 콘텐츠 결과 도달 시 호출 — 출석 적립 + 모든 일일/연속 보상 자동 지급 (기기 잔액 적립). 같은 날 재호출은 no-op. */
export function processAttendanceRewards(): AttendanceRewardResult {
  const today = todayKey();

  // 1) 일일 0.1운 자동 지급 (오늘 미수령 + 월 30회 한도)
  const dailyRewardGranted = grantDailyIfEligible();

  // 2) 출석 적립 (오늘 첫 콘텐츠일 때만)
  const st = readAttendState();
  const gap = st.lastDate ? daysBetween(st.lastDate, today) : NaN;
  let attendedNewToday = false;
  let streak3Granted = false;
  let cycle7Completed = false;

  // gap < 0 = 기기 시계가 마지막 출석일보다 과거 → 적립하지 않음 (시계를 되돌려 반복 적립하는 것 방지)
  if (!st.lastDate || Number.isNaN(gap) || gap >= 1) {
    const next: AttendState = { ...st, lastDate: today, streak: gap === 1 ? st.streak + 1 : 1 };
    // 3) 3일 연속마다 → 운 1 (3·6·9…일째)
    const give3 = next.streak % STREAK_REWARD_DAYS === 0 && next.streak3PaidOn !== today;
    if (give3) next.streak3PaidOn = today;
    // 4) 7일 연속마다 → 토스포인트 지급 대기 (7·14·21…일째 · 앱인토스만)
    //    이전 미지급분이 남아 있으면 최신 완주분으로 교체 — 지급 대기는 1건만 유지(예산 급증 방지).
    if (next.streak % ATTEND_CYCLE_DAYS === 0 && isAppsInToss()) {
      next.cycle7Pending = today;
      cycle7Completed = true;
    }
    // 출석 기록을 못 남기면 보상도 주지 않는다 (다음 호출에서 같은 보상이 반복 지급되는 것 방지)
    if (writeAttendState(next)) {
      attendedNewToday = true;
      st.streak = next.streak;
      st.cycle7Pending = next.cycle7Pending;
      if (give3) {
        addRewardBalance(STREAK_REWARD_UN);
        // 알림 플래그를 장부 기록(변경 이벤트 발행)보다 먼저 — 이벤트 탭이 이벤트를 받자마자 플래그를 읽을 수 있게
        setPendingEventNotice(EVENTS_PENDING_TIER_A_KEY, `운 ${STREAK_REWARD_UN} 들어왔어요, ${next.streak}일 연속 출석`);
        appendRewardLog('streak3', STREAK_REWARD_UN, `streak3:${today}`);
        trackReward('streak3', STREAK_REWARD_UN);
        streak3Granted = true;
      }
      notifyRewardChanged();
    } else {
      cycle7Completed = false;
    }
  }

  // 5) 토스포인트 지급 대기분이 있으면 시도 (이번 완주분 또는 이전 실패분 재시도 · 비동기)
  if (st.cycle7Pending) void retryPendingAttend7Reward();

  return { attendedNewToday, dailyRewardGranted, streak3Granted, streakCount: st.streak, cycle7Completed };
}

/* ─────────────────────────────────────────────────────────────
 * 7일 연속 출석 → 토스포인트 (토스 콘솔 "한 주 모두 출석하고 토스포인트 100원 받기" · 반복 지급)
 *
 * 2026-06-08 준기 정정: 1회성이 아니라 "7일 채울 때마다 계속 반복 지급".
 * 2026-06-26 준기 결정: 5일 프로모 폐기, 순수 7일 연속 (빠짐 허용 없음).
 * 2026-09-17: 사이클 id(완주일) 단위 중복 방지 + 지급 성공 기록 분리 + 실패 시 대기 유지·재시도.
 *   재시도 시점 = 다음 콘텐츠 결과 도달 · 이벤트 탭 진입. 동시에 두 번 부르지 않도록 진행 중 약속을 공유한다.
 * 2026-09-18 보안 fix (실측: 기기 날짜를 하루씩 넘기며 결과를 다시 열어 70회 → 10회 지급 = 1,000원):
 *   출석·완주일은 기기 날짜라 조작할 수 있다 → 지급 직전 토스 서버 시각(getTossServerTime)을 받아
 *   ① 기기 오늘 = 완주일 = 서버 KST 날짜일 때만 지급 ② 서버 시각을 못 받으면 지급하지 않고 대기 유지(같은 날 재시도)
 *   ③ 완주일이 지나면(서버 날짜 > 완주일 또는 기기 날짜 ≠ 완주일) 다시는 조건을 맞출 수 없으므로 지급 없이 대기 해제
 *   ④ 안전 상한: 서버 시각 기준 최근 30일 지급 5회 이상이면 지급하지 않음 (보상 장부의 지급 기록 · 지급 시각 = 서버 시각).
 *   → 정상 유저는 완주한 날 결과를 볼 때 지급되고, 날짜를 조작해도 실제 7일에 1회 이상은 받을 수 없다.
 * ⚠️ 중복 방지가 기기 저장소뿐 — 지급 성공 응답을 받기 전에 앱이 종료되면 재시도가 이중 지급이 될 수 있고,
 *   저장소를 지우면 상한·사이클 기록도 함께 사라진다 (tossPromotion.ts grantPromotion 주석 · SDK 3.x 이행 전 서버화 과제).
 * ──────────────────────────────────────────────────────────── */

const ATTEND7_CAP_COUNT = 5;                        // 최근 30일 최대 지급 횟수 (정상 최대 4~5회)
const ATTEND7_CAP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

let attend7InFlight: Promise<void> | null = null;

/** 지급 없이 대기 해제 — 지급 조건(서버 날짜 = 완주일)을 다시는 맞출 수 없는 사이클. 막는 쪽이라 기기 시계로 판단해도 안전. */
function dropPendingAttend7(cycleId: string): void {
  const cur = readAttendState();
  if (cur.cycle7Pending !== cycleId) return;
  cur.cycle7Pending = '';
  writeAttendState(cur);
  notifyRewardChanged();
}

export function retryPendingAttend7Reward(): Promise<void> {
  if (attend7InFlight) return attend7InFlight;
  if (!isAppsInToss()) return Promise.resolve(); // 웹: SDK 호출 없음
  const cycleId = readAttendState().cycle7Pending;
  if (!cycleId) return Promise.resolve();

  attend7InFlight = (async () => {
    try {
      // ③ 기기 날짜가 완주일이 아니면 해제 (지난 사이클 · 시계를 앞당겨 완주한 뒤 되돌린 경우)
      if (todayKey() !== cycleId) {
        dropPendingAttend7(cycleId);
        return;
      }

      const m = await import('@/services/toss/tossPromotion');
      // ② 토스 서버 시각 — 못 받으면(미지원 앱·오류·시간 초과) 지급하지 않고 대기 유지
      const serverNow = await m.getTossServerTime();
      if (serverNow === null) return;
      const serverDate = m.kstDateFromEpoch(serverNow);
      if (serverDate > cycleId) {
        dropPendingAttend7(cycleId); // ③ 서버 기준으로 이미 지난 완주일
        return;
      }
      if (serverDate < cycleId) return; // ① 기기 시계가 앞서 있음 — 지급 안 함 (자정 무렵 몇 분 차이면 곧 같은 날이 되어 재시도로 지급)

      // ④ 최근 30일(서버 시각) 지급 5회 이상이면 지급하지 않음 — 대기 유지, 날이 바뀌면 ③ 으로 해제
      const recentGrants = getRewardLedger().recent.attend7.filter((e) => serverNow - e.at < ATTEND7_CAP_WINDOW_MS);
      if (recentGrants.length >= ATTEND7_CAP_COUNT) return;

      const r = await m.grant7DayAttendance(cycleId, serverNow);
      const cur = readAttendState();

      if (r.ok || r.reason === 'already_granted') {
        // ok = 이번 호출 지급 성공 / already_granted = 이 기기가 같은 사이클 지급 성공을 이미 기록함
        if (r.ok) {
          trackReward('attend7', 0); // 토스 프로모션 지급 (운 적립 아님 → amount 0)
          // 알림 플래그를 장부 변경 이벤트보다 먼저 — 이벤트 탭이 이벤트를 받자마자 모달을 띄울 수 있게
          setPendingEventNotice(EVENTS_PENDING_TIER_B_KEY, 'tosspoint');
        }
        if (cur.cycle7Pending === cycleId) cur.cycle7Pending = '';
        if (cycleId > cur.cycle7PaidOn) cur.cycle7PaidOn = cycleId;
        writeAttendState(cur);
        // TEST_ 코드 빌드(QA)의 지급은 실제 돈이 아니므로 보상 장부(누적 카드·30일 상한)에 넣지 않는다
        if (m.PROMO_IS_LIVE) {
          appendRewardLog('attend7', m.PROMO.ATTEND_7DAY.amount, `attend7:${cycleId}`, serverNow);
        }
        notifyRewardChanged();
        return;
      }

      // 4113 = 토스측 "이미 지급된 내역" — 성공으로 확인할 근거가 없으므로 지급 완료로 표시하지 않고 재시도만 멈춘다.
      if (/\b4113\b/.test(r.reason ?? '')) {
        dropPendingAttend7(cycleId);
      }
      // 그 밖의 실패(예산·버전·일시 오류) → 대기 유지, 같은 날 다음 기회에 재시도
    } catch { /* noop — 대기 유지 */ }
  })().finally(() => {
    attend7InFlight = null;
  });
  return attend7InFlight;
}

/* ─── 이벤트 탭 표시용 스냅샷 ─── */

export interface AttendanceSnapshot {
  today: string;
  lastDate: string;
  /** 오늘 출석(결과 도달) 했는가 */
  attendedToday: boolean;
  /** 연속이 살아 있는가 (오늘 또는 어제 출석) */
  alive: boolean;
  /** 이어지고 있는 연속 출석 일수 (끊겼으면 0) */
  streak: number;
  /** 출석 기록은 있는데 어제·오늘 모두 빠져 연속이 끊긴 상태 */
  broken: boolean;
  /** 3일 보상 사이클에서 채운 칸 (0~3) */
  streak3Filled: number;
  /** 오늘 3일 연속 보상을 받았는가 */
  streak3PaidToday: boolean;
  /** 7일 토스포인트 사이클에서 채운 칸 (0~7) */
  cycle7Filled: number;
  /** 오늘 7일 연속을 채웠는가 */
  cycle7CompletedToday: boolean;
  /** 지급 대기 중인 사이클 (완주일) · 없으면 '' */
  cycle7Pending: string;
  /** 지급 성공이 기록된 마지막 사이클 (완주일) */
  cycle7PaidOn: string;
}

export function getAttendanceSnapshot(): AttendanceSnapshot {
  const today = todayKey();
  const st = readAttendState();
  let gap = st.lastDate ? daysBetween(st.lastDate, today) : NaN;
  if (gap < 0) gap = 0; // 시계 역행 — 오늘 출석한 상태로 취급
  const attendedToday = gap === 0;
  const alive = gap === 0 || gap === 1;
  const streak = alive ? st.streak : 0;
  // 오늘 출석했으면 오늘 칸까지, 어제까지만 이어졌으면 어제 칸까지 채운다 (사이클 경계에서는 0칸 = 새 사이클)
  const filled = (n: number) => {
    if (streak <= 0) return 0;
    return attendedToday ? ((streak - 1) % n) + 1 : streak % n;
  };
  return {
    today,
    lastDate: st.lastDate,
    attendedToday,
    alive,
    streak,
    broken: !!st.lastDate && !alive,
    streak3Filled: filled(STREAK_REWARD_DAYS),
    streak3PaidToday: st.streak3PaidOn === today,
    cycle7Filled: filled(ATTEND_CYCLE_DAYS),
    cycle7CompletedToday: attendedToday && streak > 0 && streak % ATTEND_CYCLE_DAYS === 0,
    cycle7Pending: st.cycle7Pending,
    cycle7PaidOn: st.cycle7PaidOn,
  };
}

/** 이어지고 있는 연속 출석 일수 (끊겼으면 0) */
export function getAttendanceStreakCount(): number {
  return getAttendanceSnapshot().streak;
}

/*
 * 2026-09-17 제거: simulate7DayCompletion() — 가짜 출석일 7개를 쓰고 지급일 기록을 지워 실제 출석 기록을 망가뜨렸고,
 *   실서비스 번들의 `?_promotest=7day` 로 누구나 출석 없이 LIVE 코드 실지급(100원)을 받을 수 있었다.
 *   출시 전 TEST_ 코드 호출은 tossPromotion.test7DayPromotion() (MyPage 디버그 시트 · 개발 서버 `?_promotest=7day`) 로 한다.
 */
