/**
 * spendLedger — 기기에서 깎던 1운 콘텐츠의 서버 차감 장부 (2026-10-25)
 *
 * 배경: 오늘의 운세(두 번째부터), 꿈해몽(두 번째 꿈, 잠금 풀이), 사주대화 대화권은 운을 기기에서만 깎았다.
 *   로그인 계정의 서버 잔액(users/{uid}.balance)은 그대로라, 웹에서 로그아웃 뒤 다시 로그인하면 syncFromCloud 가
 *   서버 잔액만큼 기기를 채워 쓴 운이 돌아왔다(되풀이 가능, 다른 브라우저도 같은 값).
 *   이제 로그인 계정은 서버도 같은 값을 깎는다. 익명 계정은 예전 그대로다(서버는 깎지 않고 genGuard 하루 상한만).
 *
 * 구매 하나 = spendId 하나 (기기 장부 markPendingSpend 의 id). 문서 users/{uid}/spends/{spendId}
 *   { kind, amount, status: 'charged' | 'refunded', holds, delivered, ... }
 *   - 같은 spendId 로 다시 부르면(스트림이 끊겨 callable 로 다시 부름, 500 재시도) 이미 'charged' 면 깎지 않는다.
 *   - 'refunded' 뒤 같은 spendId 로 다시 부르면 다시 깎는다(서버가 실패로 돌려준 뒤 폴백이 새로 만드는 경우).
 *   - holds 는 이 구매로 지금 생성 중인 서버 호출 수. 실패한 호출은 holds 를 하나 내리고, 남은 호출이 없고
 *     아직 결과를 넘긴 호출도 없을 때만 돌려준다(스트림이 실패해도 폴백 callable 이 돌고 있으면 돌려주지 않는다).
 *     함수가 시간 초과로 죽어 holds 가 남으면 서버는 돌려주지 못한다. 그때는 기기가 refundSpend 로 돌려받는다.
 *   - 기기가 실패로 보고 기기 운을 돌려줄 때 refundSpend 로 서버 몫도 돌려준다('charged' 일 때 한 번만).
 *   돌려주는 운은 그 spendId 로 깎은 만큼뿐이라 서버 잔액이 낸 것보다 늘어날 수 없다.
 *   돌려줄 때는 index.ts refundBalance 와 같이 결제분(paid)에 넣는다(기기 refundBalance 도 paid).
 *   클라이언트는 이 문서를 읽거나 쓸 수 없다(firestore.rules 에 없는 경로라 거부). 탈퇴 파기는 purgeUser 가 하위 컬렉션째 지운다.
 */
import * as admin from 'firebase-admin';

type Db = admin.firestore.Firestore;

/** index.ts computeBalanceDeduction 과 같은 모양 (그 함수를 그대로 넘겨받는다, 차감 순서 reward → bonus → paid) */
export type Deduct = (data: any, cost: number) => { totalBefore: number; updates: Record<string, any> } | null;

/** daily, dream 은 생성 함수가 깎고, dreamUnlock, chat 은 spendUn 이 깎는다 */
export type SpendKind = 'daily' | 'dream' | 'dreamUnlock' | 'chat';

export const SPEND_INSUFFICIENT_MESSAGE = '운이 부족합니다';

/** 차감 실패 이유 — insufficient(잔액 모자람), mismatch(같은 spendId 를 다른 종류나 값으로 다시 씀) */
export class SpendError extends Error {
  constructor(public reason: 'insufficient' | 'mismatch', message: string) {
    super(message);
  }
}

/** 기기 장부 id 형식만 받는다 (markPendingSpend: 시각36진수_난수36진수) */
export function safeSpendId(v: unknown): string | null {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(v) ? v : null;
}

/** 종류별 값. 대화권은 고른 운(1 이상 정수, 100 이하), 나머지는 1운 (클라 고정값과 같다) */
export function spendAmountFor(kind: SpendKind, raw?: unknown): number | null {
  if (kind === 'chat') {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
  }
  return 1;
}

export interface SpendHold {
  uid: string;
  spendId: string;
}

/**
 * 깎거나, 이미 깎인 같은 구매에 붙는다. 잡은 것은 끝날 때 releaseSpend 로 푼다.
 *   instant: 바로 넘기는 구매(잠금 해제, 대화권). 잡지 않고 넘긴 것으로 적는다(release 불필요).
 *   already: 이미 낸 같은 구매에 붙었다. users 문서가 없는 계정은 hold null, charged false, already false
 *   (다른 생성 함수의 'if (userDoc.exists)' 와 같이 서버가 깎지 않는 계정).
 *   잔액이 모자라면 SpendError('insufficient') 를 던진다.
 */
export async function holdSpend(
  db: Db,
  deduct: Deduct,
  args: { uid: string; spendId: string; kind: SpendKind; amount: number; instant?: boolean },
): Promise<{ hold: SpendHold | null; charged: boolean; already: boolean }> {
  const { uid, spendId, kind, amount, instant } = args;
  const userRef = db.collection('users').doc(uid);
  const spendRef = userRef.collection('spends').doc(spendId);
  const FV = admin.firestore.FieldValue;
  const out = await db.runTransaction(async (tx) => {
    const [userDoc, spendDoc] = await Promise.all([tx.get(userRef), tx.get(spendRef)]);
    if (!userDoc.exists) return { held: false, charged: false, already: false };
    const s = spendDoc.exists ? (spendDoc.data() as Record<string, any>) : null;
    if (s && s.kind !== kind) throw new SpendError('mismatch', '다른 구매에 쓴 번호예요');
    if (s && s.status === 'charged') {
      if (Number(s.amount) !== amount) throw new SpendError('mismatch', '값이 다른 같은 구매예요');
      // 이미 낸 구매 — 깎지 않고 붙기만 한다
      tx.update(spendRef, instant
        ? { delivered: true, updatedAt: FV.serverTimestamp() }
        : { holds: FV.increment(1), updatedAt: FV.serverTimestamp() });
      return { held: !instant, charged: false, already: true };
    }
    const result = deduct(userDoc.data(), amount);
    if (!result) throw new SpendError('insufficient', SPEND_INSUFFICIENT_MESSAGE);
    tx.update(userRef, result.updates);
    tx.set(spendRef, {
      kind,
      amount,
      status: 'charged',
      holds: instant ? 0 : 1,
      delivered: !!instant,
      charges: FV.increment(1),
      chargedAt: FV.serverTimestamp(),
      updatedAt: FV.serverTimestamp(),
    }, { merge: true });
    return { held: !instant, charged: true, already: false };
  });
  return { hold: out.held ? { uid, spendId } : null, charged: out.charged, already: out.already };
}

/** 잔액 칸 모양(객체/숫자)에 맞춘 돌려주기 값 — index.ts refundBalance 와 같은 규칙 */
function refundUpdates(userData: any, amount: number, reason: string): Record<string, any> {
  const FV = admin.firestore.FieldValue;
  const bal = userData?.balance;
  const updates: Record<string, any> = {
    totalSpent: FV.increment(-amount),
    lastRefundAt: FV.serverTimestamp(),
    lastRefundReason: reason,
  };
  if (typeof bal === 'object' && bal !== null) updates['balance.paid'] = FV.increment(amount);
  else updates.balance = FV.increment(amount);
  return updates;
}

/**
 * 생성 호출 하나가 끝났을 때. ok 면 넘긴 것으로 적고, 실패면 holds 를 내리고
 *   남은 호출이 없고 아무도 결과를 넘기지 않았을 때만 돌려준다. 절대 throw 하지 않는다(원래 응답 경로를 막지 않게).
 */
export async function releaseSpend(db: Db, hold: SpendHold | null, ok: boolean, reason: string): Promise<void> {
  if (!hold) return;
  const userRef = db.collection('users').doc(hold.uid);
  const spendRef = userRef.collection('spends').doc(hold.spendId);
  const FV = admin.firestore.FieldValue;
  try {
    const refunded = await db.runTransaction(async (tx) => {
      const [spendDoc, userDoc] = await Promise.all([tx.get(spendRef), tx.get(userRef)]);
      if (!spendDoc.exists) return 0;
      const s = spendDoc.data() as Record<string, any>;
      const holds = Math.max(0, (Number(s.holds) || 0) - 1);
      if (ok) {
        tx.update(spendRef, { holds, delivered: true, deliveredAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
        return 0;
      }
      const amount = Number(s.amount) || 0;
      if (s.status === 'charged' && holds === 0 && !s.delivered && amount > 0 && userDoc.exists) {
        tx.update(userRef, refundUpdates(userDoc.data(), amount, reason));
        tx.update(spendRef, { holds, status: 'refunded', refundedAt: FV.serverTimestamp(), refundReason: reason, updatedAt: FV.serverTimestamp() });
        return amount;
      }
      tx.update(spendRef, { holds, updatedAt: FV.serverTimestamp() });
      return 0;
    });
    if (refunded > 0) console.log(`[spendLedger] 돌려줌 uid=${hold.uid} spendId=${hold.spendId} amount=${refunded} reason=${reason}`);
  } catch (e: any) {
    console.error(`[spendLedger] release 실패 uid=${hold.uid} spendId=${hold.spendId} ok=${ok}: ${e?.message || e}`);
  }
}

/**
 * 기기가 그 구매를 실패로 보고 기기 운을 돌려줄 때 서버 몫도 돌려준다 (spendUn action 'refund').
 *   'charged' 인 구매만, 한 번만. 돌려준 운(없으면 0)을 반환한다.
 */
export async function refundSpend(db: Db, uid: string, spendId: string, reason: string): Promise<number> {
  const userRef = db.collection('users').doc(uid);
  const spendRef = userRef.collection('spends').doc(spendId);
  const FV = admin.firestore.FieldValue;
  const refunded = await db.runTransaction(async (tx) => {
    const [spendDoc, userDoc] = await Promise.all([tx.get(spendRef), tx.get(userRef)]);
    if (!spendDoc.exists || !userDoc.exists) return 0;
    const s = spendDoc.data() as Record<string, any>;
    const amount = Number(s.amount) || 0;
    if (s.status !== 'charged' || amount <= 0) return 0;
    tx.update(userRef, refundUpdates(userDoc.data(), amount, reason));
    tx.update(spendRef, { status: 'refunded', refundedAt: FV.serverTimestamp(), refundReason: reason, updatedAt: FV.serverTimestamp() });
    return amount;
  });
  if (refunded > 0) console.log(`[spendLedger] 기기 요청으로 돌려줌 uid=${uid} spendId=${spendId} amount=${refunded}`);
  return refunded;
}
