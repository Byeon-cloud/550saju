/**
 * 포트원 자동 채우기 판정 (2026-10-24, 오너 승인 '자동채우기도 ㄱㄱ')
 *
 *   손님이 포트원으로 실제로 결제했는데(포트원 PAID) 결제 확인 화면이 끊겨 운이 들어가지 않은 결제를, 감시(watchPortonePaid)가
 *   확인 규칙 그대로 한 번만 채워 넣을지 여기서 정한다. 손님이 이미 낸 돈만큼의 운을 빠짐없이 전달하는 수리다(새로 주는 운은 없다).
 *   firebase 를 부르지 않는 순수 함수만 둔다(시험: scripts/test/portone_auto_grant.cjs). 지급 자체는 grantPortone.ts 하나뿐.
 *
 *   조건이 하나라도 애매하면 넣지 않는다. 결과는 세 가지:
 *     ok            — 넣는다
 *     final 막힘    — 이 결제는 자동으로 넣지 않는다(오너에게 이유를 적어 알리고, 이후 실행도 다시 보지 않는다)
 *     잠시 미룸     — 이번 실행만 건너뛴다(20분 안, 이번 실행 상한, 계정 조회 실패 등). 다음 실행에 다시 본다
 */

/** 결제 뒤 이 시간 안은 손님 화면이 아직 확인할 수 있다 */
export const AUTO_GRANT_MIN_AGE_MS = 20 * 60 * 1000;
/** 결제 뒤 이 시간이 지난 결제는 자동으로 넣지 않는다(감시가 멈췄다 돌아온 경우 등, 그사이 오너가 따로 처리했을 수 있다) */
export const AUTO_GRANT_MAX_AGE_MS = 48 * 3600 * 1000;

export interface AutoGrantConfig {
  enabled: boolean;
  maxPerRun: number;
  dailyCapWon: number;
}

/** Firestore config/portoneAutoGrant 가 없을 때의 값 */
export const AUTO_GRANT_DEFAULT: AutoGrantConfig = { enabled: true, maxPerRun: 5, dailyCapWon: 50000 };

/**
 * config/portoneAutoGrant 읽은 값 정리.
 *   문서나 칸이 없으면 기본값. 값이 잘못 들어 있으면 넣지 않는 쪽(꺼짐, 0)으로.
 */
export function normalizeAutoGrantConfig(raw: unknown): AutoGrantConfig {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const count = (v: unknown, def: number, max: number): number => {
    if (v === undefined || v === null) return def;
    const n = typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.floor(n)) : 0;
  };
  return {
    enabled: r.enabled === undefined || r.enabled === null ? AUTO_GRANT_DEFAULT.enabled : r.enabled === true,
    maxPerRun: count(r.maxPerRun, AUTO_GRANT_DEFAULT.maxPerRun, 20),
    dailyCapWon: count(r.dailyCapWon, AUTO_GRANT_DEFAULT.dailyCapWon, 1_000_000),
  };
}

/** 우리 장부의 한 줄 (users/{uid}/payments/{결제번호}, 이관 사본 포함) */
export interface LedgerRow {
  where: string; // 그 기록이 있는 계정
  status: string;
  failReason: string;
  /** status confirmed 이거나 confirmedAt 이 있음 (confirm 의 isGranted 와 같은 기준) */
  granted: boolean;
  /** 환불, 부분 환불 검토, 취소 기록 */
  refunded: boolean;
  /** 지급한 쪽 ('client', 'watch', 'owner' 관리자 결제 누락, 없으면 '') */
  grantedBy?: string;
}

/** 결제 확인이 이 사유로 실패했으면 결제 자체가 맞지 않는 것이라 자동으로 넣지 않는다 */
const BAD_FAIL_REASON = /^(amount_mismatch|currency_|channel_|customdata_uid_mismatch)/;
/** 장부 상태가 이것 중 하나일 때만 넣는다 (기록 없음은 행이 없는 것) */
const OK_LEDGER_STATUS = ['pending', 'needs_reconciliation', 'failed'];
const UID_RE = /^[A-Za-z0-9_-]{8,128}$/;

export interface AutoGrantInput {
  now: number;
  paymentId: string;
  /** 지급 직전에 다시 조회한 포트원 결제 (단건 조회) */
  fresh: {
    status?: string;
    channelType?: string;
    currency?: string;
    amount?: number;
    customDataUid?: string;
  };
  /** 목록 조회 때의 금액과 회원 ID (단건 조회와 같아야 한다) */
  listAmount: number;
  listCustomDataUid: string;
  /** 결제 시각 (ms) */
  paidMs: number;
  /** 충전 묶음 표(PACKAGE_MAP)에 있는 금액들 */
  packageAmounts: number[];
  /** 그 회원 ID 의 Firebase Auth 계정: 있음 true, 없음 false, 조회 실패 null */
  authExists: boolean | null;
  ledger: LedgerRow[];
  /** 오너가 경보를 직접 처리로 표시함 (backofficeAlerts 의 manualHandled) */
  manualHandled: boolean;
  /** 결제 뒤 오너가 이 회원에게 운을 넣은 기록(compensationLog): 있으면 사유 글, 없으면 false, 조회 실패 null */
  ownerGrantAfterPay: string | false | null;
  /** 오늘(한국 날짜) 이미 자동으로 넣은 금액 */
  grantedTodayWon: number;
  /** 이번 실행에서 이미 자동으로 넣은 건수 */
  grantedThisRun: number;
  cfg: AutoGrantConfig;
}

export type AutoGrantDecision =
  | { ok: true; uid: string }
  | { ok: false; final: boolean; reasons: string[] };

const wait = (reason: string): AutoGrantDecision => ({ ok: false, final: false, reasons: [reason] });

export function decideAutoGrant(x: AutoGrantInput): AutoGrantDecision {
  if (!x.cfg.enabled) return wait('자동 지급이 꺼져 있어요');
  if (!x.paidMs || !Number.isFinite(x.paidMs)) return { ok: false, final: true, reasons: ['결제 시각을 알 수 없어요'] };
  const age = x.now - x.paidMs;
  if (age < AUTO_GRANT_MIN_AGE_MS) return wait('결제 뒤 20분이 아직 안 지났어요');

  const finals: string[] = [];
  if (x.manualHandled) finals.push('오너가 직접 처리로 표시했어요');
  if (age > AUTO_GRANT_MAX_AGE_MS) finals.push('결제 뒤 48시간이 지나 자동으로 넣지 않았어요');

  // 포트원 결제 자체 (확인 규칙과 같게: PAID, 실결제 채널, 원화, 있는 묶음 금액)
  const f = x.fresh || {};
  if (f.status !== 'PAID') finals.push(`포트원 상태가 결제 완료가 아니에요(${f.status || '알 수 없음'})`);
  if (f.channelType !== 'LIVE') finals.push(`실결제 채널이 아니에요(${f.channelType || '알 수 없음'})`);
  if (f.currency !== 'KRW') finals.push(`통화가 원화가 아니에요(${f.currency || '알 수 없음'})`);
  const amount = Number(f.amount);
  if (!Number.isFinite(amount) || !x.packageAmounts.includes(amount)) finals.push(`충전 묶음에 없는 금액이에요(${f.amount ?? '알 수 없음'})`);
  if (Number(x.listAmount) !== amount) finals.push('목록 조회와 단건 조회의 금액이 달라요');

  // 회원 ID: 결제 정보(customData.uid)가 있고, 결제번호 앞 8자가 그 회원 ID 앞 8자와 같아야 한다
  const uid = typeof f.customDataUid === 'string' ? f.customDataUid : '';
  if (!uid) finals.push('결제 정보에 회원 ID 가 없어요');
  else {
    if (!UID_RE.test(uid)) finals.push('회원 ID 형식이 맞지 않아요');
    if (x.paymentId.slice(0, 8) !== uid.slice(0, 8)) finals.push('결제번호 앞 8자가 회원 ID 와 달라요');
    if (x.listCustomDataUid && x.listCustomDataUid !== uid) finals.push('목록 조회와 단건 조회의 회원 ID 가 달라요');
    if (x.authExists === false) finals.push('그 회원 ID 의 계정이 없어요(탈퇴 또는 삭제)');
  }

  // 우리 장부: 어느 계정에도 지급, 환불, 취소 기록이 없어야 하고, 남은 기록은 그 회원 ID 계정의 것만
  for (const r of x.ledger) {
    if (r.granted) finals.push(`장부에 이미 지급 기록이 있어요(${r.where.slice(0, 8)})`);
    if (r.refunded) finals.push(`장부에 환불이나 취소 기록이 있어요(${r.status})`);
    if (uid && r.where !== uid) finals.push(`다른 계정 장부에 이 결제 기록이 있어요(${r.where.slice(0, 8)})`);
    if (!r.granted && !r.refunded) {
      if (!OK_LEDGER_STATUS.includes(r.status)) finals.push(`장부 상태를 알 수 없어요(${r.status || '빈 값'})`);
      else if (r.status === 'failed' && BAD_FAIL_REASON.test(r.failReason)) finals.push(`확인이 결제 불일치로 실패했어요(${r.failReason.slice(0, 40)})`);
    }
  }

  if (typeof x.ownerGrantAfterPay === 'string') finals.push(`결제 뒤 오너가 이 회원에게 운을 넣은 기록이 있어요(${x.ownerGrantAfterPay})`);

  if (finals.length) return { ok: false, final: true, reasons: [...new Set(finals)] };

  // 여기부터는 다음 실행에 다시 볼 수 있는 것
  if (x.authExists === null) return wait('회원 계정 조회에 실패했어요');
  if (x.ownerGrantAfterPay === null) return wait('오너 지급 기록 조회에 실패했어요');
  // 하루 상한은 넘으면 경보만 (그 결제는 자동으로 넣지 않는다)
  if (x.grantedTodayWon + amount > x.cfg.dailyCapWon) {
    return { ok: false, final: true, reasons: [`오늘 자동 지급 상한을 넘어요(오늘 ${x.grantedTodayWon.toLocaleString('ko-KR')}원, 상한 ${x.cfg.dailyCapWon.toLocaleString('ko-KR')}원)`] };
  }
  if (x.grantedThisRun >= x.cfg.maxPerRun) return wait('이번 실행의 자동 지급 건수를 다 썼어요');
  return { ok: true, uid };
}

/** Firestore 결제 문서 한 장 → 장부 한 줄 */
export function ledgerRowOf(where: string, d: Record<string, any>): LedgerRow {
  const status = String(d?.status || '');
  return {
    where,
    status,
    failReason: String(d?.failReason || ''),
    granted: status === 'confirmed' || !!d?.confirmedAt,
    refunded: ['refunded', 'partial_refund_review', 'cancelled'].includes(status) || !!d?.refundedAt || !!d?.portoneCancelledAt,
    grantedBy: String(d?.grantedBy || ''),
  };
}

/** 한국 날짜 YYYY-MM-DD */
export function kstDay(ms: number): string {
  return new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
}

/**
 * 감시가 조회를 시작할 시각 (2026-10-24 검수).
 *   감시가 48시간 넘게 멈췄다 돌아오면 그 사이 결제를 못 봤다 → 마지막으로 끝까지 본 시각(lastOkAt) 1시간 앞부터, 최대 14일.
 */
export function watchLookbackFrom(now: number, lastOkAt: number | null | undefined): number {
  const base = now - 48 * 3600e3;
  const floor = now - 14 * 864e5;
  const last = Number(lastOkAt);
  if (!Number.isFinite(last) || last <= 0) return base;
  return Math.max(floor, Math.min(base, last - 3600e3));
}
