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
 */

import type { SajuData, SajuInput, Situation } from '@/types/saju';

export type ContentType = 'report' | 'daily' | 'dream' | 'daeun' | 'monthly' | 'compat' | 'tojung';

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

export function deleteReport(id: string): void {
  const reports = getReports().filter(r => r.id !== id);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
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
