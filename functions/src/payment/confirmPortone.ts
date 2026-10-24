/**
 * confirmPortonePayment 본문 — 포트원 V2 웹 실결제 검증과 지급 (2026-07-02 선구현, 2026-10-24 검수 반영으로 index.ts 에서 옮김)
 *   index.ts 의 onCall 은 이 함수를 부르기만 한다. 시험(scripts/test/portone_auto_grant.cjs)이 이 파일을 그대로 돌린다.
 *
 * 흐름: 클라 PortOne.requestPayment 완료 → paymentId 전달 → 서버가 포트원 조회 API로
 *   결제 사실, 금액, 상태를 직접 확인 후 지급. (클라 신고 금액은 참고용, 진실은 포트원 API)
 *
 * 머니세이프: pending → confirmed | failed | needs_reconciliation. confirmed 만 중복 차단.
 *   방어 ① uid 바인딩 — paymentId 접두사(uid 앞 8자) + customData.uid 이중 확인
 *   방어 ② LIVE 채널 게이트 — channel.type !== 'LIVE' 면 지급 거부
 *
 * 2026-10-24 자동 채우기: 지급은 공용 함수 grantPortonePayment(grantedBy 'client') 하나로. 감시(watchPortonePaid)가
 *   먼저 넣은 결제(deviceCreditPending)는 다시 부르면 서버 잔액은 그대로 두고 그 운을 응답 paidUn 으로 기기 하나에 한 번 넘긴다.
 * 2026-10-24 검수:
 *   - 기기 표식(deviceKey): paidUn 을 돌려주기로 정한 기기를 결제 문서에 남기고, 응답이 끊겨 같은 기기가 다시 부르면 다시 돌려준다
 *     (grantPortone.ts claimPortoneDeviceCredit). 지급이 끝난 결제를 다시 부르는 세 길(이미 confirmed, pending 기록 단계에서 지급 끝남,
 *     지급 트랜잭션에서 지급 끝남)이 모두 같은 함수로 간다.
 *   - 오너가 결제 뒤 '결제 누락'으로 운을 넣었는데 그 기록에 이 결제번호가 없으면(예전 화면, 다른 결제번호) 자동으로 넣지 않고
 *     needs_reconciliation 으로 남긴다(감시가 오너에게 알린다). 결제번호가 있는 기록은 그 결제 문서가 이미 지급 끝남이라 여기까지 오지 않는다.
 *   - 실패 응답의 details.reason: not_found(포트원에 없는 결제), not_paid(결제 완료 아님), mismatch(금액, 통화, 회원, 채널 불일치),
 *     needs_reconciliation(수동 확인 대상). 기기는 이것을 보고 적어 둔 결제번호를 지운다(balanceAdjust.confirmPortoneAndCredit).
 *   - 계정 불일치 기록(portoneUidMismatch)은 결제번호마다 첫 기록만 만들고, 이후 attempts 만 20까지, 호출 계정마다 하루 5건까지.
 */
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { createHash } from 'crypto';
import { PACKAGE_MAP } from '../shared/chargePackages';
import { grantPortonePayment, claimPortoneDeviceCredit, cleanDeviceKey, isPortoneGranted } from './grantPortone';

export interface PortoneConfirmRequest {
  uid: string;
  isAnon: boolean;
  data: { paymentId?: unknown; amount?: unknown; deviceKey?: unknown } | null | undefined;
}

const PAYMENT_ID_RE = /^[A-Za-z0-9]{8}_[A-Za-z0-9_]{1,60}$/;
const MISMATCH_ATTEMPTS_MAX = 20;
const MISMATCH_NEW_PER_CALLER_DAY = 5;
const PORTONE_FETCH_TIMEOUT_MS = 10_000;
const ALREADY = { success: true, message: '이미 처리된 결제예요' };

const kstDay = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const tsMs = (v: any): number => (v && typeof v.toMillis === 'function' ? v.toMillis() : 0);

/**
 * 결제한 계정과 돌아온 화면의 계정이 다른 일 (watchPortonePaid 가 미지급 경보 메일에 같이 적는다).
 *   손님이 보낸 값으로 문서를 만들므로 쓰기를 줄인다: 결제번호마다 첫 기록(처음 돌아온 화면의 계정)은 create 로 보존하고,
 *   이후엔 attempts 만 20까지 늘린다. 새 결제번호 기록은 호출 계정마다 하루 5건까지. 보관은 expireAt(14일, Firestore TTL 정책이 켜져 있어야 지워진다).
 */
async function noteUidMismatch(db: admin.firestore.Firestore, uid: string, isAnon: boolean, paymentId: string, amount: number): Promise<void> {
  const FV = admin.firestore.FieldValue;
  const now = Date.now();
  const ref = db.collection('portoneUidMismatch').doc(paymentId);
  const quotaRef = db.collection('portoneUidMismatchQuota').doc(`${kstDay(now)}_${createHash('sha256').update(uid).digest('hex').slice(0, 16)}`);
  await db.runTransaction(async (tx) => {
    const [cur, quota] = await Promise.all([tx.get(ref), tx.get(quotaRef)]);
    if (cur.exists) {
      if ((Number(cur.data()?.attempts) || 0) >= MISMATCH_ATTEMPTS_MAX) return;
      tx.update(ref, { attempts: FV.increment(1), lastCallerUid8: uid.slice(0, 8), lastAt: FV.serverTimestamp() });
      return;
    }
    if ((Number(quota.data()?.n) || 0) >= MISMATCH_NEW_PER_CALLER_DAY) return;
    tx.set(quotaRef, { n: FV.increment(1), expireAt: admin.firestore.Timestamp.fromMillis(now + 2 * 864e5) }, { merge: true });
    tx.create(ref, {
      expireAt: admin.firestore.Timestamp.fromMillis(now + 14 * 864e5),
      kind: 'portone_confirm_uid_mismatch', paymentId,
      payerUid8: paymentId.slice(0, 8), callerUid8: uid.slice(0, 8), callerAnon: isAnon,
      amount, attempts: 1, at: FV.serverTimestamp(),
    });
  });
}

/**
 * 결제 뒤 오너가 이 회원에게 '결제 누락'으로 운을 넣었는데 그 기록이 이 결제번호를 가리키지 않는가 (관리자 adminGrantCompensation → compensationLog).
 *   있으면 자동으로 넣지 않는다(그 보상이 이 결제 몫일 수 있다). @returns 사유 글, 없으면 '' (조회 실패도 '', 손님 확인은 막지 않는다)
 */
async function ownerPayMissingAfter(db: admin.firestore.Firestore, uid: string, paymentId: string, paidMs: number): Promise<string> {
  if (!paidMs) return '';
  try {
    const logs = await db.collection('compensationLog').where('uids', 'array-contains', uid).limit(50).get();
    for (const d of logs.docs) {
      const c = d.data() || {};
      if (c.reason !== 'pay_missing') continue;
      if (c.paymentId && c.paymentId === paymentId) continue; // 이 결제 몫으로 넣은 기록 (그 결제 문서는 이미 지급 끝남)
      const at = tsMs(c.at);
      if (at && at >= paidMs - 60e3) return `pay_missing ${Number(c.amount) || 0}운${c.paymentId ? ` (결제번호 ${String(c.paymentId).slice(0, 14)}…)` : ' (결제번호 없음)'}`;
    }
  } catch (e: any) {
    console.warn('[confirmPortonePayment] 오너 지급 기록 조회 실패, 확인은 계속', e?.message || e);
  }
  return '';
}

export async function confirmPortoneCore(req: PortoneConfirmRequest, apiSecret: string): Promise<Record<string, unknown>> {
  const db = admin.firestore();
  const FV = admin.firestore.FieldValue;
  const { uid, isAnon } = req;
  const paymentId = req.data?.paymentId;
  const amount = req.data?.amount as number;
  if (!paymentId || typeof paymentId !== 'string' || !amount) {
    throw new HttpsError('invalid-argument', '필수 파라미터 누락');
  }
  const deviceKey = cleanDeviceKey(req.data?.deviceKey);

  // 방어 ① — paymentId 는 클라가 `${uid8}_...` 로 생성. 다른 계정 결제 컨펌 시도 차단.
  if (!paymentId.startsWith(uid.slice(0, 8))) {
    // 2026-10-23 — 거부는 그대로. 결제한 계정과 돌아온 화면의 계정이 다른 일을 남긴다(관리자 경보 목록 밖 전용 컬렉션, 있는 묶음 금액일 때만)
    if (PAYMENT_ID_RE.test(paymentId) && PACKAGE_MAP[amount]) await noteUidMismatch(db, uid, isAnon, paymentId, Number(amount) || 0).catch(() => undefined);
    throw new HttpsError('permission-denied', '본인 결제만 확인할 수 있어요');
  }

  const paymentRef = db.collection(`users/${uid}/payments`).doc(paymentId);

  // 지급이 끝난 결제를 다시 부른 경우 — 감시 몫 넘겨주기, 또는 같은 기기의 응답이 끊겼던 결제 다시 돌려주기 (grantPortone.ts)
  const deliverGranted = async (): Promise<Record<string, unknown>> => {
    const c = await claimPortoneDeviceCredit(uid, paymentId, deviceKey).catch(() => null);
    if (c?.claimed) {
      return {
        success: true, message: `${c.totalUn}운이 충전됐어요!`, totalUn: c.totalUn, paidUn: c.paidUn, bonusUn: c.bonusUn,
        autoGranted: c.grantedBy === 'watch', ...(c.recredit ? { recredit: true } : {}),
      };
    }
    return ALREADY;
  };

  // 1. E13 중복 지급 방지 — confirmed/needs_reconciliation 차단, pending/failed 재시도 허용
  const existing = await paymentRef.get();
  if (existing.exists) {
    const s = existing.data()?.status;
    if (s === 'confirmed') return deliverGranted();
    if (s === 'needs_reconciliation') {
      throw new HttpsError('failed-precondition', '결제가 승인됐지만 지급이 완료되지 않았어요. 고객센터로 문의해주세요.', { reason: 'needs_reconciliation' });
    }
  }

  // 2. 금액 → 패키지 사전 검증 (최종 검증은 포트원 API 응답 금액으로 재수행)
  const pkg = PACKAGE_MAP[amount];
  if (!pkg) throw new HttpsError('invalid-argument', `유효하지 않은 금액: ${amount}`);

  // 2026-10-24 — 상태 기록은 지급이 끝난 결제(confirmed 또는 confirmedAt)를 덮지 않고, 지급 트랜잭션은 결제 문서를 다시 읽는다
  const writeUnlessGranted = (fields: Record<string, unknown>, ifNew: Record<string, unknown> = {}) => db.runTransaction(async (tx) => {
    const d = await tx.get(paymentRef);
    if (isPortoneGranted(d.data())) return false;
    tx.set(paymentRef, d.exists ? fields : { ...ifNew, ...fields }, { merge: true });
    return true;
  });

  // 3. E13 pending 선기록 (createdAt 은 처음 한 번만)
  const pendingWritten = await writeUnlessGranted({
    type: 'charge', orderId: paymentId, amount,
    packageName: pkg.name,
    paidUn: pkg.paidUn, bonusUn: pkg.bonusUn,
    pgProvider: 'portone',
    status: 'pending',
    lastAttemptAt: FV.serverTimestamp(),
  }, { createdAt: FV.serverTimestamp() });
  // 그 사이 감시가 먼저 넣었다 — 그 운을 이 기기에 넘긴다 (한 기기 한 번, 서버 잔액은 그대로)
  if (!pendingWritten) return deliverGranted();

  // 4. 포트원 V2 결제 조회 API — 결제 사실, 상태, 금액을 서버가 직접 확인 (응답이 늦으면 10초에서 끊는다)
  let pay: any;
  try {
    const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: { Authorization: `PortOne ${apiSecret}` },
      signal: AbortSignal.timeout(PORTONE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error('[confirmPortonePayment] 포트원 조회 실패:', res.status, errBody);
      await writeUnlessGranted({
        status: 'failed',
        failReason: (errBody as any)?.message || `portone_http_${res.status}`,
        failedAt: FV.serverTimestamp(),
      });
      throw new HttpsError('internal', '결제 확인에 실패했어요. 다시 시도해주세요.', res.status === 404 ? { reason: 'not_found' } : undefined);
    }
    pay = await res.json();
  } catch (err: any) {
    if (err instanceof HttpsError) throw err;
    console.error('[confirmPortonePayment] 네트워크 에러:', err);
    await writeUnlessGranted({
      status: 'failed',
      failReason: 'network_error: ' + (err?.message || 'unknown'),
      failedAt: FV.serverTimestamp(),
    });
    throw new HttpsError('internal', '결제 확인 중 네트워크 오류가 발생했어요.');
  }

  // 5. 결제 검증 — 상태 PAID + 금액 일치 + uid 바인딩(customData) + LIVE 채널
  const failVerify = async (reason: string, userMsg: string, details: Record<string, unknown>): Promise<never> => {
    console.error('[confirmPortonePayment] 검증 실패:', reason, { paymentId, uid });
    await writeUnlessGranted({ status: 'failed', failReason: reason, failedAt: FV.serverTimestamp() });
    throw new HttpsError('failed-precondition', userMsg, details);
  };

  if (pay?.status !== 'PAID') {
    await failVerify(`status_${pay?.status || 'unknown'}`, '결제가 완료되지 않았어요. 다시 시도해주세요.', { reason: 'not_paid', status: String(pay?.status || '') });
  }
  const apiAmount = pay?.amount?.total;
  if (apiAmount !== amount || !PACKAGE_MAP[apiAmount]) {
    await failVerify(`amount_mismatch_${apiAmount}_vs_${amount}`, '결제 금액이 일치하지 않아요. 고객센터로 문의해주세요.', { reason: 'mismatch' });
  }
  if (pay?.currency && pay.currency !== 'KRW') {
    await failVerify(`currency_${pay.currency}`, '지원하지 않는 통화예요.', { reason: 'mismatch' });
  }
  // 방어 ① 이중 확인 — 클라가 customData 에 넣은 uid 와 호출자 일치
  let cd: any = null;
  try { cd = typeof pay?.customData === 'string' ? JSON.parse(pay.customData) : pay?.customData; } catch { /* 파싱 실패는 무시 (prefix 검증이 1차 방어) */ }
  if (cd?.uid && cd.uid !== uid) {
    await failVerify('customdata_uid_mismatch', '본인 결제만 확인할 수 있어요.', { reason: 'mismatch' });
  }
  // 방어 ② — 테스트 채널 결제는 절대 지급하지 않음
  if (pay?.channel?.type !== 'LIVE') {
    await failVerify(`channel_${pay?.channel?.type || 'unknown'}`, '테스트 결제는 충전되지 않아요.', { reason: 'mismatch' });
  }

  // 5-1. 결제 뒤 오너가 결제번호 없이(또는 다른 결제번호로) '결제 누락' 운을 넣었으면 자동으로 넣지 않는다 (위 설명)
  const paidMs = Date.parse(pay?.paidAt || pay?.statusChangedAt || '') || 0;
  const owner = await ownerPayMissingAfter(db, uid, paymentId, paidMs);
  if (owner) {
    console.warn('[confirmPortonePayment] 결제 뒤 오너 결제 누락 지급 기록이 있어 넣지 않음', paymentId.slice(0, 8), owner);
    await writeUnlessGranted({
      status: 'needs_reconciliation',
      failReason: `owner_pay_missing_after_pay: ${owner}`.slice(0, 200),
      portoneStatus: pay.status,
      portoneApprovedAt: FV.serverTimestamp(),
    }).catch(() => false);
    throw new HttpsError('failed-precondition', '이 결제는 고객센터에서 확인하고 있어요. 잔액이 맞지 않으면 고객센터로 문의해주세요.', { reason: 'needs_reconciliation' });
  }

  // 6. 지급 — 공용 함수 하나(grantPortone.ts). 트랜잭션이 결제 문서를 다시 읽어 감시의 자동 채우기와 겹쳐도 한 번만 넣는다.
  //   잔액 지급 + pending → confirmed + grantedBy 'client' + 이 기기 표식 + 친구 초대 첫 결제 보상
  const totalUn = pkg.paidUn + pkg.bonusUn;
  let alreadyGranted = false;
  try {
    const r = await grantPortonePayment({ uid, paymentId, pay, pkg, amount, grantedBy: 'client', deviceKey });
    alreadyGranted = !r.granted;
  } catch (err: any) {
    // E13 포트원은 PAID 인데 DB 실패 — 수동 복구 대상 (감시가 20분 뒤 자동 채우기로 다시 넣는다)
    console.error('[confirmPortonePayment] needs_reconciliation:', err);
    await writeUnlessGranted({
      status: 'needs_reconciliation',
      failReason: 'db_transaction_failed: ' + (err?.message || 'unknown'),
      portoneStatus: pay.status,
      portoneApprovedAt: FV.serverTimestamp(),
    }).catch(() => false);
    throw new HttpsError('internal', '결제는 승인됐지만 지급 중 오류가 발생했어요. 고객센터에 문의해주세요.', { reason: 'needs_reconciliation' });
  }
  // 같은 순간 감시가 먼저 넣었으면 그 운을 이 기기에 넘긴다 (한 기기 한 번, 서버 잔액은 그대로)
  if (alreadyGranted) return deliverGranted();
  return { success: true, message: `${totalUn}운이 충전됐어요!`, totalUn, paidUn: pkg.paidUn, bonusUn: pkg.bonusUn };
}
