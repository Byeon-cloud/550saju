/**
 * 포트원 웹 결제 지급 — 운을 넣는 곳은 여기 하나 (2026-10-24)
 *
 *   손님 화면의 결제 확인(confirmPortonePayment, grantedBy 'client')과 감시의 자동 채우기(watchPortonePaid, grantedBy 'watch')가
 *   둘 다 이 함수로 지급한다. 같은 결제가 두 곳에서 동시에 와도 트랜잭션이 결제 문서를 다시 읽어 한 번만 넣는다
 *   (status confirmed 또는 confirmedAt 이 있으면 지급 끝, f74d77e 의 isGranted 와 같은 기준).
 *
 *   서버 잔액: users/{uid}.balance.paid, balance.bonus 를 늘리고 totalCharged 를 늘린다(문서가 없는 계정은 set merge 로 만든다).
 *   결제 문서: users/{uid}/payments/{paymentId} 를 confirmed 로, grantedBy 를 남긴다.
 *
 *   기기 잔액(운의 기준은 기기 localStorage): 손님 화면 확인은 응답의 paidUn 으로 그 기기가 바로 더한다.
 *   감시가 넣은 결제는 응답을 받을 기기가 없으므로 결제 문서에 deviceCreditPending: true 를 남긴다.
 *   로그인한 웹 기기가 열리면 그 결제를 confirmPortonePayment 로 다시 부르고, claimPortoneDeviceCredit 가 한 기기에만 한 번 넘긴다
 *   (서버 잔액은 다시 늘리지 않는다). 기기 쪽: src/services/storage/balanceAdjust.ts resumePortonePayments.
 */
import * as admin from 'firebase-admin';
import { PACKAGE_MAP } from '../shared/chargePackages';

export type PortoneGrantBy = 'client' | 'watch';
export interface PortonePkg { name: string; paidUn: number; bonusUn: number }

/** 지급이 끝난 결제인가 (confirmPortonePayment 의 isGranted 와 같은 기준) */
export const isPortoneGranted = (d?: admin.firestore.DocumentData | null): boolean => !!d && (d.status === 'confirmed' || !!d.confirmedAt);

/**
 * 포트원 결제 지급. 결제 검증(PAID, 금액, 통화, 회원 ID, 실결제 채널)은 부르는 쪽이 이미 끝냈다.
 * @returns granted: 이번에 넣었으면 true, 이미 지급된 결제면 false
 * @throws 트랜잭션 실패 (부르는 쪽이 needs_reconciliation 이나 경보로 남긴다)
 */
export async function grantPortonePayment(opts: {
  uid: string;
  paymentId: string;
  pay: any;
  pkg: PortonePkg;
  amount: number;
  grantedBy: PortoneGrantBy;
}): Promise<{ granted: boolean; totalUn: number }> {
  const { uid, paymentId, pay, pkg, amount, grantedBy } = opts;
  const db = admin.firestore();
  const FV = admin.firestore.FieldValue;
  const userRef = db.collection('users').doc(uid);
  const paymentRef = userRef.collection('payments').doc(paymentId);
  const totalUn = pkg.paidUn + pkg.bonusUn;
  let granted = false;

  await db.runTransaction(async (tx) => {
    granted = false; // 트랜잭션이 다시 돌 때를 위해
    const [userDoc, payDoc] = await Promise.all([tx.get(userRef), tx.get(paymentRef)]);
    if (isPortoneGranted(payDoc.data())) return;
    const data = userDoc.data() || {};

    // 2026-10-16 — update() 는 users/{uid} 문서가 없는 계정(웹 익명)에서 NOT_FOUND → 돈은 나가고 운은 안 들어가
    //   needs_reconciliation 으로 빠진다(6월 IAP 19건과 같은 원인). grantPurchase 처럼 set(merge) 로 문서가 없어도 만든다.
    tx.set(userRef, {
      balance: {
        paid: (data.balance?.paid ?? 0) + pkg.paidUn,
        bonus: (data.balance?.bonus ?? 0) + pkg.bonusUn,
      },
      totalCharged: FV.increment(pkg.paidUn),
    }, { merge: true });

    tx.set(paymentRef, {
      // 감시가 넣을 때는 확인 기록(pending)이 없을 수 있다 → 결제 기록의 기본 칸을 포트원 금액 기준으로 채운다(환불 회수가 이 값을 쓴다)
      type: 'charge', orderId: paymentId, amount,
      packageName: pkg.name, paidUn: pkg.paidUn, bonusUn: pkg.bonusUn,
      pgProvider: 'portone',
      ...(payDoc.exists ? {} : { createdAt: FV.serverTimestamp() }),
      unChange: totalUn,
      portoneStatus: pay?.status ?? null,
      portoneMethod: pay?.method?.type || null,
      portoneChannel: pay?.channel?.type || null,
      // 2026-10-21 — 카카오페이 안에서 머니로 냈는지 등록 카드로 냈는지 (화면에 '등록한 카드로도' 안내를 넣어 첫 카드 결제로 확인)
      portoneEasyPayMethod: pay?.method?.easyPayMethod?.type || null,
      status: 'confirmed',
      confirmedAt: FV.serverTimestamp(),
      grantedBy,
      ...(grantedBy === 'watch' ? { deviceCreditPending: true, autoGrantedAt: FV.serverTimestamp() } : {}),
    }, { merge: true });
    granted = true;
  });

  if (granted) {
    // 2026-10-18 친구 초대 — 초대받은 사람의 첫 결제면 초대한 사람에게 추가 보상 (실패해도 결제와 무관, 지급 응답을 막지 않는다)
    try {
      const { referralOnPurchase } = await import('../referral/referral');
      await referralOnPurchase(uid, pkg.paidUn, totalUn);
    } catch (e: any) {
      console.warn('[grantPortonePayment] 친구 초대 보상 건너뜀', e?.message || e);
    }
  }
  return { granted, totalUn };
}

/**
 * 감시가 넣은 결제의 운을 기기 하나에 한 번만 넘긴다 (서버 잔액은 바꾸지 않는다).
 *   deviceCreditPending 을 트랜잭션으로 내리므로 기기 여러 대가 동시에 불러도 한 기기만 paidUn 을 받는다.
 */
export async function claimPortoneDeviceCredit(uid: string, paymentId: string): Promise<{ claimed: boolean; paidUn: number; bonusUn: number; totalUn: number }> {
  const db = admin.firestore();
  const paymentRef = db.collection('users').doc(uid).collection('payments').doc(paymentId);
  let out = { claimed: false, paidUn: 0, bonusUn: 0, totalUn: 0 };
  await db.runTransaction(async (tx) => {
    out = { claimed: false, paidUn: 0, bonusUn: 0, totalUn: 0 };
    const snap = await tx.get(paymentRef);
    const d = snap.data();
    if (!d || d.status !== 'confirmed' || d.deviceCreditPending !== true) return;
    const pkg = PACKAGE_MAP[Number(d.amount)];
    const paidUn = pkg ? pkg.paidUn : Number(d.paidUn) || 0;
    const bonusUn = pkg ? pkg.bonusUn : Number(d.bonusUn) || 0;
    tx.update(paymentRef, {
      deviceCreditPending: false,
      deviceCreditedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    out = { claimed: true, paidUn, bonusUn, totalUn: paidUn + bonusUn };
  });
  return out;
}
