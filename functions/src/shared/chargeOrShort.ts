/**
 * chargeOrShort — 생성 함수가 로그인 계정의 서버 잔액에서 운을 깎는 곳, 모자라도 막지 않는다 (2026-10-26)
 *
 * 배경: 주제운(callable, 스트림), 월운세(본편, 초안), 주간운세(본편, 초안), 궁합, 신년운세는 로그인 계정의 서버 잔액이 모자라면
 *   '운이 부족합니다'로 막았다. 기기 잔액과 서버 잔액은 여러 경로로 어긋난다(부팅 자동환불은 기기에만 돌려준다, 대화권을 운으로
 *   되돌리면 기기에만 더한다 등). 그래서 화면에 4운이 있는 손님이 연애운을 누르면 '분석에 실패해서 4운을 돌려드렸어요'가 되풀이됐다.
 *   오너 원칙(10-26, src/services/ai/serverSpend.ts 머리말): 화면에 운이 넉넉한 손님은 서버와 기기 잔액이 어긋났다는 이유로 막지 않는다.
 *   서버 차감은 장부를 맞추려는 것이지 막으려는 것이 아니다. 막는 것은 기기 잔액 확인(spendBalance)뿐이다.
 *
 * 규칙
 *   - 서버 잔액이 값을 다 낼 수 있으면 예전처럼 깎는다(deducted = cost, 순서는 computeBalanceDeduction 그대로 reward → bonus → paid).
 *   - 모자라면 서버에 남은 만큼만 깎고(2026-10-27, 0 이면 0) 생성을 이어 간다. 실패하면 호출부가 refundBalance(uid, deducted) 로
 *     깎은 만큼만 돌려준다. 남은 만큼을 깎는 이유: 서버가 기기보다 많이 남으면 웹 로그인 동기화가 그 차이를 기기에 더해 준다.
 *     어긋남은 console.warn('[serverShort]') 과 backofficeAlerts/spend_short_{KST 날짜}_{uid}(손님당 하루 한 문서, 건수와 운 합계, 종류별 건수)에 남긴다.
 *   - 모자란 생성은 서버가 운을 받지 않으므로, 함수를 직접 불러 끝없이 공짜로 받는 구멍이 되지 않게 익명 계정과 같은 하루 상한(genGuard)을 건다.
 *     상한을 넘으면 limited: true 를 돌려주고 호출부가 GEN_LIMIT_MESSAGE 로 막는다. 정상 손님은 하루에 닿지 않는 수다(주제운 20건 등).
 *   - users 문서가 없는 계정은 예전처럼 깎지 않는다(그 계정은 guardCallable, guardHttp 가 이미 익명과 같은 상한을 건다).
 *   - 트랜잭션 자체가 실패하면(Firestore 장애) 예전처럼 예외를 그대로 던진다(어긋남이 아니라 장애라서).
 *   - costFor(2026-10-27, 종합사주 반값): 값을 계정 문서로 정하는 콘텐츠. 같은 트랜잭션에서 값과 함께 적을 필드(extra)와
 *     상한에 막혀 되돌릴 때 적을 필드(revert)를 돌려준다. 모자란 경우에도 extra 는 적는다(반값을 쓴 것으로 본다).
 *   - chargeId(2026-10-27, 궁합): 기기 결제 장부 id. 같은 id 로 두 번 오면(웹에서 만드는 중에 새로고침) 두 번째는 깎지 않는다.
 *     표시는 users/{uid}/genCharges/{id}(클라 규칙 없음 = 서버만 씀). 다 만들면 markChargeDone 이 reportId 를 적어
 *     두 번째 호출이 같은 결과를 돌려줄 수 있게 하고, 실패하면 releaseCharge 가 지워 다시 누를 때 정상으로 깎게 한다.
 *     깎지 않는 두 번째 호출에도 모자란 생성과 같은 하루 상한을 건다(같은 id 로 계속 불러 공짜로 받는 구멍).
 */
import * as admin from 'firebase-admin';
import { checkGenQuota, type GenType } from './genGuard';
import type { Deduct } from './spendLedger';

type Db = admin.firestore.Firestore;

export interface ChargeOrShortResult {
  /** 실제로 깎은 운 (실패 때 돌려줄 수 있는 최대값). 모자랐거나 users 문서가 없으면 0 */
  deducted: number;
  /** 서버 잔액이 모자라 깎지 않고 진행했다 */
  short: boolean;
  /** 모자란 생성이 오늘 상한을 넘었다 → 호출부가 막는다 */
  limited: boolean;
  /** 정한 값 (costFor 가 있으면 그 값, 없으면 cost) */
  cost?: number;
  /** costFor 의 extra 를 적었다 (실패 때 호출부가 되돌린다) */
  extraApplied?: boolean;
  /** 같은 chargeId 로 이미 깎은 호출이 있다 (이번에는 깎지 않았다). 다 만든 것이면 reportId 가 있다 */
  already?: { reportId: string | null };
}

export interface CostPick {
  cost: number;
  extra?: Record<string, unknown>;
  revert?: Record<string, unknown>;
}

/** 기기 결제 장부 id 형식 (spendLedger.safeSpendId 와 같은 규칙) */
export function safeChargeId(v: unknown): string | null {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(v) ? v : null;
}

const chargeRef = (db: Db, uid: string, chargeId: string) => db.collection('users').doc(uid).collection('genCharges').doc(chargeId);

/** 다 만들었다 — 같은 장부 id 로 다시 오면 이 결과를 돌려줄 수 있게. 실패해도 생성은 그대로 */
export async function markChargeDone(db: Db, uid: string, chargeId: string | null | undefined, reportId: string): Promise<void> {
  if (!uid || !chargeId) return;
  try { await chargeRef(db, uid, chargeId).set({ status: 'done', reportId, doneAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }); }
  catch (e: any) { console.warn('[chargeOrShort] 완료 표시 실패:', e?.message || e); }
}

/** 실패해서 돌려줬다 — 표시를 지워 다시 누를 때 정상으로 깎게 한다 */
export async function releaseCharge(db: Db, uid: string, chargeId: string | null | undefined): Promise<void> {
  if (!uid || !chargeId) return;
  try { await chargeRef(db, uid, chargeId).delete(); }
  catch (e: any) { console.warn('[chargeOrShort] 표시 지우기 실패:', e?.message || e); }
}

/** 요청 IP — genGuard.ts clientIp 와 같은 규칙 (callable 은 request.rawRequest, 스트림은 req 를 넘긴다) */
export function requestIp(raw: any): string {
  try {
    const xf = String(raw?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return xf || String(raw?.ip || '');
  } catch { return ''; }
}

const kstDay = (): string => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/** 서버 잔액 합 (객체면 reward + bonus + paid, 숫자면 그대로) — 기록용 */
function balanceTotal(data: any): number {
  const bal = data?.balance;
  if (typeof bal === 'object' && bal !== null) return (Number(bal.reward) || 0) + (Number(bal.bonus) || 0) + (Number(bal.paid) || 0);
  return typeof bal === 'number' ? bal : 0;
}

/** 어긋남 기록 — 손님당 하루 한 문서에 더한다(관리자 경보 탭과 하루 요약이 kind 로 센다). 실패해도 생성은 그대로 */
async function noteShort(db: Db, uid: string, label: string, cost: number, serverBalance: number): Promise<void> {
  const FV = admin.firestore.FieldValue;
  const day = kstDay();
  try {
    await db.collection('backofficeAlerts').doc(`spend_short_${day}_${uid}`).set({
      kind: 'server_spend_short',
      uid,
      day,
      count: FV.increment(1),
      units: FV.increment(cost),
      types: { [label]: FV.increment(1) },
      lastLabel: label,
      lastCost: cost,
      lastServerBalance: serverBalance,
      message: '서버 잔액이 모자라 깎지 않고 만들었어요(기기 잔액과 어긋남). 막지는 않았어요.',
      at: FV.serverTimestamp(),
    }, { merge: true });
  } catch (e: any) {
    console.warn('[serverShort] 기록 실패:', e?.message || e);
  }
}

/**
 * 로그인 계정 생성 한 건의 서버 차감. 호출부는 DEV_MODE, 익명 여부를 먼저 거르고 부른다.
 *   label 은 기록용 짧은 이름(예: 'topic_love', 'monthlyDraft'), quota 는 genGuard 하루 상한 종류.
 */
export async function chargeOrShort(
  db: Db,
  deduct: Deduct,
  args: { uid: string; cost: number; quota: GenType; label: string; ip?: string; costFor?: (data: any) => CostPick; chargeId?: string | null },
): Promise<ChargeOrShortResult> {
  const { uid, quota, ip } = args;
  const chargeId = safeChargeId(args.chargeId);
  const label = String(args.label || quota).replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) || quota;
  if (!uid || !(args.cost > 0)) return { deducted: 0, short: false, limited: false };
  const userRef = db.collection('users').doc(uid);
  let revert: Record<string, unknown> | undefined;
  const r = await db.runTransaction(async (tx) => {
    const doc = await tx.get(userRef);
    const mark = chargeId ? await tx.get(chargeRef(db, uid, chargeId)) : null;
    if (!doc.exists) return { deducted: 0, short: false, have: 0, cost: args.cost, extra: false, already: null as null | { reportId: string | null } };
    if (mark?.exists) {
      // 같은 결제의 두 번째 호출 — 깎지 않는다
      const reportId = typeof mark.data()?.reportId === 'string' ? mark.data()!.reportId as string : null;
      return { deducted: 0, short: false, have: 0, cost: args.cost, extra: false, already: { reportId } };
    }
    const pick: CostPick = args.costFor ? args.costFor(doc.data()) : { cost: args.cost };
    const cost = pick.cost;
    revert = pick.revert;
    const extra = pick.extra && Object.keys(pick.extra).length ? pick.extra : null;
    const result = deduct(doc.data(), cost);
    let out: { deducted: number; short: boolean; have: number };
    if (!result) {
      // 2026-10-27 모자라면 서버에 남은 만큼은 깎는다. 하나도 안 깎으면 서버 잔액이 기기보다 많이 남아,
      //   웹 로그인 동기화(서버가 많으면 기기에 더한다)가 그 차이를 기기에 되살려 줬다(검토 결함). 실패 때는 깎은 만큼만 돌려준다
      const have = balanceTotal(doc.data());
      const drain = have > 0 ? deduct(doc.data(), have) : null;
      const upd = { ...(drain?.updates || {}), ...(extra || {}) };
      if (Object.keys(upd).length) tx.update(userRef, upd);
      out = { deducted: drain ? have : 0, short: true, have };
    } else {
      tx.update(userRef, extra ? { ...result.updates, ...extra } : result.updates);
      out = { deducted: cost, short: false, have: result.totalBefore };
    }
    if (chargeId) {
      tx.set(chargeRef(db, uid, chargeId), {
        label, cost, deducted: out.deducted, short: out.short, status: 'running',
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { ...out, cost, extra: !!extra, already: null as null | { reportId: string | null } };
  });

  if (r.already) {
    console.warn(`[chargeOrShort] 같은 결제의 두 번째 호출, 깎지 않음: uid=${uid} ${label} id=${chargeId} reportId=${r.already.reportId || '-'}`);
    const ok = await checkGenQuota({ type: quota, uid, anonymous: true, ip });
    return { deducted: 0, short: false, limited: !ok, cost: r.cost, extraApplied: false, already: r.already };
  }
  if (!r.short) return { deducted: r.deducted, short: false, limited: false, cost: r.cost, extraApplied: r.extra };

  console.warn(`[serverShort] 서버 잔액이 모자라 남은 만큼만 깎고 생성: uid=${uid} ${label} ${r.cost}운 (서버 잔액 ${r.have}운)`);
  const [, ok] = await Promise.all([
    noteShort(db, uid, label, r.cost, r.have),
    checkGenQuota({ type: quota, uid, anonymous: true, ip }),
  ]);
  if (!ok) {
    // 상한에 걸려 막을 거면 방금 깎은 남은 몫과 함께 적은 필드(반값 사용 등)를 되돌린다(막으면서 운만 가져가지 않게)
    try {
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(userRef);
        const bal = doc.data()?.balance;
        const FV = admin.firestore.FieldValue;
        const upd: Record<string, unknown> = r.extra && revert ? { ...revert } : {};
        if (r.deducted > 0) {
          if (typeof bal === 'object' && bal !== null) Object.assign(upd, { 'balance.paid': FV.increment(r.deducted), totalSpent: FV.increment(-r.deducted) });
          else Object.assign(upd, { balance: FV.increment(r.deducted), totalSpent: FV.increment(-r.deducted) });
        }
        if (Object.keys(upd).length) tx.update(userRef, upd);
        if (chargeId) tx.delete(chargeRef(db, uid, chargeId));
      });
    } catch (e: any) {
      console.error(`[serverShort] 상한 막힘 뒤 돌려주기 실패 uid=${uid} ${r.deducted}운:`, e?.message || e);
    }
    return { deducted: 0, short: true, limited: true, cost: r.cost, extraApplied: false };
  }
  return { deducted: r.deducted, short: true, limited: false, cost: r.cost, extraApplied: r.extra };
}
