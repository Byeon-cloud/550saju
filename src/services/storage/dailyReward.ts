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
  // TODO(server): Phase 2 — Cloud Functions 로 이관. 어뷰징 방어 (기기 fingerprint + 토스 CI).
  return true;
}
