/**
 * 로컬 스토리지 기반 데이터 저장
 *
 * 운(運) 잔액 구조:
 * - paid: 결제로 충전한 운 (환불 가능)
 * - bonus: 충전 보너스 운 (환불 불가)
 * - reward: 공유/이벤트 리워드 운 (환불 불가)
 *
 * 사용 순서: reward → bonus → paid (유저에게 유리하게)
 * 환불 시: paid만 환불 대상
 *
 * ⚠ 2026-04-22 storage 통일:
 *   REPORTS / PROFILES / MY_PROFILE 모두 localStorage 사용 (이전엔 sessionStorage 였음).
 *   탭/창 닫혀도 데이터 유지. "보관함 빈 채로 보이던 버그" 해소.
 *   기존 sessionStorage 잔류 데이터는 첫 호출 시 1회 자동 마이그레이션 후 삭제.
 */

import type { SajuData, SajuInput, Situation } from '@/types/saju';

export type ContentType = 'report' | 'daily' | 'dream' | 'deepDream' | 'daeun' | 'monthly' | 'compat' | 'tojung' | 'topic';

export interface LocalReport {
  id: string;
  name: string;
  input: SajuInput;
  sajuData: SajuData;
  situation?: Situation;
  createdAt: string | number;
  /** 'free' = 무료 사주팔자, 'paid' = 상세 분석(1운) */
  type?: 'free' | 'paid';
  /** 콘텐츠 분류 */
  contentType?: ContentType;
  /** AI 결과 원문 (ResultPage 등에서 사용) */
  aiResult?: any;
  /**
   * 종합 사주 schema 버전 — claudePremium.ts 의 응답 구조 변경 추적용.
   *  v1: 기존 (sections, summary, sectionConclusions[] 배열)
   *  v2: 2026-04 신규 8 필드 (lifeEdge, sipCluster, shinsalCards, rel6Cards,
   *      actionList, monthlyInsight, sectionConclusions{} 객체, topicMini)
   * 표식만 — 자동 재호출은 안 함. UI 에서 "새 풀이 받기" 안내용.
   */
  schemaVersion?: 'v1' | 'v2';
}

/** 사주 프로필 — 리포트와 독립적으로 저장 (삭제해도 프로필 유지) */
export interface SajuProfile {
  id: string;
  name: string;
  input: SajuInput;
  sajuData: SajuData;
  relation?: string;
  createdAt: string | number;
}

/** 운 잔액 유형별 구조 */
export interface BalanceDetail {
  paid: number;    // 결제 운 (환불 가능)
  bonus: number;   // 보너스 운 (환불 불가)
  reward: number;  // 리워드 운 (환불 불가, 공유/이벤트)
}

const REPORTS_KEY = 'saju500_reports';
const BALANCE_KEY = 'saju500_balance_v2';
const BALANCE_LEGACY_KEY = 'saju500_balance';
const MY_PROFILE_KEY = 'saju500_my_profile';
const PROFILES_KEY = 'saju500_profiles';

// ─── 1회 sessionStorage → localStorage 마이그레이션 ───
// 2026-04-22 이전 버전 사용자 데이터 보존. 모듈 로드 시 1회 실행.
let _migrated = false;
function migrateSessionToLocal(): void {
  if (_migrated) return;
  _migrated = true;
  if (typeof window === 'undefined') return;
  try {
    const keys = [REPORTS_KEY, MY_PROFILE_KEY, PROFILES_KEY];
    for (const k of keys) {
      const fromSession = sessionStorage.getItem(k);
      if (fromSession && !localStorage.getItem(k)) {
        localStorage.setItem(k, fromSession);
      }
      if (fromSession) sessionStorage.removeItem(k);
    }
  } catch {
    // private mode 등 storage 불가 환경 — 조용히 무시
  }
}
migrateSessionToLocal();

// ─── 리포트 ───

export function saveReport(report: LocalReport): void {
  const reports = getReports();
  reports.unshift(report);
  if (reports.length > 500) reports.pop(); // 유료 리포트 영구 보관 (localStorage ~2.5MB)
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

export function getReports(): LocalReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getReport(id: string): LocalReport | null {
  return getReports().find(r => r.id === id) || null;
}

/**
 * 리포트(이용기록) 삭제 — 프로필(사주정보)과 독립.
 * ⚠ NO-CASCADE: 같은 사람의 프로필은 절대 함께 삭제하지 않는다.
 *   (정책: project_storage_data_model.md — "사주 정보 vs 이용기록 별도 테이블. cascade delete 금지")
 *   유저가 분석 1회를 지워도 본인 사주 자체는 마이/홈에 그대로 유지되어야 한다.
 */
export function deleteReport(id: string): void {
  const reports = getReports().filter(r => r.id !== id);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

/**
 * 캐시된 분석 결과 조회 — 같은 사람 + 같은 콘텐츠 타입이면 기존 결과 반환
 * 사주는 확정된 데이터이므로 같은 사람에 대한 분석은 항상 같은 결과여야 함
 */
export function getCachedResult(name: string, birthYear: number, birthMonth: number, birthDay: number, contentType: ContentType): LocalReport | null {
  const reports = getReports();
  return reports.find(r =>
    r.contentType === contentType &&
    r.aiResult && // AI 결과가 저장된 것만
    r.name === name &&
    r.input?.birthYear === birthYear &&
    r.input?.birthMonth === birthMonth &&
    r.input?.birthDay === birthDay
  ) || null;
}

// ─── 내 프로필 (본인 사주 고정) ───

/** 본인 프로필 조회 — pinned ID 우선, 없으면 relation '본인' 자동 탐색+고정 */
export function getMyProfile(): LocalReport | null {
  const myId = localStorage.getItem(MY_PROFILE_KEY);
  if (myId) {
    const report = getReport(myId);
    if (report) return report;
  }
  // fallback: relation이 '본인'이거나 미지정인 첫 번째 리포트
  const reports = getReports();
  const found = reports.find(r =>
    !r.input?.relation || r.input.relation === '본인' || r.input.relation === 'self'
  ) || null;
  if (found) localStorage.setItem(MY_PROFILE_KEY, found.id);
  return found;
}

/** 본인 프로필 고정 */
export function setMyProfile(reportId: string): void {
  localStorage.setItem(MY_PROFILE_KEY, reportId);
}

// ─── 잔액 (유형별) ───

function getBalanceDetail(): BalanceDetail {
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    if (raw) return JSON.parse(raw);

    // 레거시 마이그레이션: 기존 단일 잔액 → paid로 이전
    const legacy = Number(localStorage.getItem(BALANCE_LEGACY_KEY)) || 1;
    const detail: BalanceDetail = { paid: legacy, bonus: 0, reward: 0 };
    setBalanceDetail(detail);
    localStorage.removeItem(BALANCE_LEGACY_KEY);
    return detail;
  } catch {
    return { paid: 1, bonus: 0, reward: 0 };
  }
}

function setBalanceDetail(detail: BalanceDetail): void {
  localStorage.setItem(BALANCE_KEY, JSON.stringify(detail));
}

/** 총 잔액 (모든 유형 합산) */
export function getBalance(): number {
  const d = getBalanceDetail();
  return Math.round((d.paid + d.bonus + d.reward) * 10) / 10;
}

/** 유형별 잔액 조회 */
export function getBalanceBreakdown(): BalanceDetail {
  return getBalanceDetail();
}

/** 환불 가능한 금액 (paid만) */
export function getRefundableBalance(): number {
  return getBalanceDetail().paid;
}

/**
 * 운 충전 (결제)
 * @param paidUn 결제 운
 * @param bonusUn 보너스 운
 */
export function addPaidBalance(paidUn: number, bonusUn: number): void {
  const d = getBalanceDetail();
  d.paid += paidUn;
  d.bonus += bonusUn;
  setBalanceDetail(d);
}

/** 리워드 운 적립 (공유/이벤트) */
export function addRewardBalance(amount: number): void {
  const d = getBalanceDetail();
  d.reward = Math.round((d.reward + amount) * 10) / 10;
  setBalanceDetail(d);
}

/**
 * 운 사용 (서비스 이용)
 * 사용 순서: reward → bonus → paid (유저에게 유리)
 * 모든 유형의 운을 자유롭게 사용 가능 (프리미엄 포함)
 *
 * @returns 사용 성공 여부
 */
export function spendBalance(amount: number): boolean {
  const d = getBalanceDetail();
  const total = d.paid + d.bonus + d.reward;
  if (total < amount) return false;

  let remaining = amount;

  // 1. reward 먼저
  const fromReward = Math.min(d.reward, remaining);
  d.reward = Math.round((d.reward - fromReward) * 10) / 10;
  remaining -= fromReward;

  // 2. bonus
  if (remaining > 0) {
    const fromBonus = Math.min(d.bonus, remaining);
    d.bonus = Math.round((d.bonus - fromBonus) * 10) / 10;
    remaining -= fromBonus;
  }

  // 3. paid
  if (remaining > 0) {
    d.paid = Math.round((d.paid - remaining) * 10) / 10;
  }

  setBalanceDetail(d);
  return true;
}

/**
 * 환불 처리 — paid에서만 차감
 * @returns 실제 환불 가능한 운
 */
export function refundBalance(amount: number): number {
  const d = getBalanceDetail();
  const refundable = Math.min(d.paid, amount);
  d.paid = Math.round((d.paid - refundable) * 10) / 10;
  setBalanceDetail(d);
  return refundable;
}

/** 단순 잔액 설정 (레거시 호환, paid로 설정) */
export function setBalance(balance: number): void {
  const d = getBalanceDetail();
  d.paid = balance;
  setBalanceDetail(d);
}

// ─── 유틸 ───

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── 프로필 (리포트와 독립) ───

/** 저장된 프로필 목록 조회 — 없으면 기존 리포트에서 마이그레이션 */
export function getProfiles(): SajuProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) return JSON.parse(raw);
    // 마이그레이션: 기존 리포트에서 프로필 추출 (중복 제거)
    const reports = getReports();
    const seen = new Map<string, SajuProfile>();
    for (const r of reports) {
      if (!r.input?.birthYear || !r.name) continue;
      if (r.contentType === 'compat') continue;
      if (r.name?.includes('\u00d7') || r.name?.includes('x')) continue;
      const key = `${r.name}_${r.input.birthYear}_${r.input.birthMonth}_${r.input.birthDay}`;
      if (!seen.has(key)) {
        seen.set(key, {
          id: r.id,
          name: r.name,
          input: r.input,
          sajuData: r.sajuData,
          relation: r.input?.relation,
          createdAt: r.createdAt,
        });
      }
    }
    const profiles = Array.from(seen.values());
    if (profiles.length > 0) {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    }
    return profiles;
  } catch { return []; }
}

/** 프로필 직접 저장 — 리포트 생성 없이 프로필만 저장/업데이트 */
export function saveProfileDirect(profile: SajuProfile): void {
  const profiles = getProfiles();
  const key = `${profile.name}_${profile.input.birthYear}_${profile.input.birthMonth}_${profile.input.birthDay}`;
  const idx = profiles.findIndex(p =>
    `${p.name}_${p.input.birthYear}_${p.input.birthMonth}_${p.input.birthDay}` === key
  );
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.unshift(profile);
  }
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

/**
 * 프로필(사주정보) 삭제 — 이용기록과 독립.
 * ⚠ NO-CASCADE: 해당 인물의 과거 분석 리포트는 절대 함께 삭제하지 않는다.
 *   (정책: project_storage_data_model.md — "사주 정보 vs 이용기록 별도 테이블. cascade delete 금지")
 *   본인 프로필을 지우더라도 결제하여 받은 분석 결과는 보관함에 그대로 남는다.
 */
export function deleteProfile(profileId: string): void {
  const profiles = getProfiles().filter(p => p.id !== profileId);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}
