/**
 * 서버 지시로 기기 잔액 바꾸기 — 운 잔액의 기준은 기기(localStorage)라 서버만 바꿔서는 화면이 안 바뀐다.
 *
 * 1) 운 회수 지시 반영 (2026-10-16) — 서버 syncPortoneCancellations 가 포트원 취소 결제마다
 *   users/{uid}/balanceAdjustments/{paymentId} { paid: -n, bonus: -m, applied: false } 를 남긴다.
 *   앱이 열릴 때 여기서 기기 잔액에서 뺀다.
 *   두 번 빼지 않게: 이 기기에서 반영한 지시 ID 를 먼저 적고(localStorage), 서버 applied=true 는 그다음.
 *   표시가 실패해도 다음 부팅에 이 기기는 같은 지시를 다시 빼지 않는다.
 *
 * 2) 웹 포트원 결제를 기기에 넣기 (2026-10-24, 오너 승인 자동 채우기) — 웹 빌드, 웹 화면에서만. 앱인토스에서는 아무것도 하지 않는다.
 *   포트원 결제의 운을 이 기기에 더하는 곳은 confirmPortoneAndCredit 하나다. 서버 confirmPortonePayment 응답에 paidUn 이 올 때만 더한다.
 *     - 충전 화면(데스크톱 결제창, 모바일 결제 복귀)이 결제 확인을 부를 때
 *     - resumePortonePayments: 로그인한 웹 기기가 열릴 때와 로그인한 뒤, 확인이 끊긴 결제(결제창을 열기 직전 적어 둔 saju500:portone_pending)와
 *       서버 감시가 자동으로 채웠는데 아직 어느 기기에도 안 들어간 결제(결제 문서 deviceCreditPending)를 다시 확인할 때
 *   서버는 결제 하나에 paidUn 을 한 번만 돌려준다(손님 화면 확인이 넣었으면 그 응답, 감시가 넣었으면 기기 하나가 받아 가는 응답).
 *   '이미 처리된 결제예요'(paidUn 없음)면 더하지 않고 적어 둔 결제번호만 지운다.
 *   이 기기에서도 결제번호마다 한 번만 더한다(saju500:portone_credited).
 *   로그인 때의 잔액 맞추기(firestoreSync.syncFromCloud, 서버가 더 많으면 차이를 더함)는 아직 기기에 안 들어간 자동 채우기 몫을
 *   pendingPortoneCreditUn 으로 빼고 계산한다(그 몫은 여기서 넣는다). 둘이 같은 순간 돌지 않게 withBalanceLock 으로 차례를 지키고,
 *   로그인 직후에는 그 잔액 맞추기가 끝난 뒤에 결제를 넣는다(noteLoginBalanceSync).
 *   부팅 동기화(bootSync)는 잔액을 맞추지 않는다(reportsOnly, 기기에서만 깎는 운이 되살아나지 않게). 그래서 서버에만 들어간 자동 채우기 몫은
 *   잔액 차이로 내려보내지 않고 결제번호 단위로 여기서 넣는다.
 */
import { collection, getDocs, getDoc, query, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/services/auth/firebase';
import { reclaimBalance, addPaidBalance } from './localStore';
import { isAppintosBuild } from '@/lib/env';

const DONE_KEY = 'saju500:applied_adjustments';
const _ran = new Set<string>();

function doneIds(): Set<string> {
  try { return new Set<string>(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch { return new Set(); }
}
function markDone(ids: Set<string>): void {
  try { localStorage.setItem(DONE_KEY, JSON.stringify([...ids].slice(-200))); } catch { /* noop */ }
}

/** @returns 이번에 기기에서 뺀 운 */
export async function applyBalanceAdjustments(uid: string): Promise<number> {
  if (!uid || _ran.has(uid)) return 0;
  _ran.add(uid);
  let total = 0;
  try {
    const snap = await getDocs(query(collection(db, `users/${uid}/balanceAdjustments`), where('applied', '==', false)));
    if (snap.empty) return 0;
    for (const d of snap.docs) {
      const a = d.data() as { paid?: number; bonus?: number; reason?: string; paymentId?: string };
      if (!doneIds().has(d.id)) {
        // 2026-10-24 — 서버 감시가 자동으로 채웠는데 어느 기기에도 들어가기 전에 환불된 결제는 이 기기에서 뺄 몫이 없다
        //   (그 결제 문서에 deviceCreditPending 이 남아 있다). 결제 문서를 못 읽으면 이번엔 건너뛰고 다음 부팅에 다시 본다.
        let skipReclaim = false;
        if (a.reason === 'portone_refund') {
          const pay = await getDoc(doc(db, `users/${uid}/payments`, String(a.paymentId || d.id))).catch(() => null);
          if (!pay) continue;
          skipReclaim = pay.exists() && pay.data()?.deviceCreditPending === true;
        }
        const done = doneIds(); // 기다리는 동안 다른 탭이 반영했을 수 있다
        if (!done.has(d.id)) {
          if (!skipReclaim) total += reclaimBalance(Math.abs(Number(a.paid) || 0), Math.abs(Number(a.bonus) || 0));
          done.add(d.id);
          markDone(done);
        }
      }
      await updateDoc(doc(db, `users/${uid}/balanceAdjustments`, d.id), { applied: true, appliedAt: serverTimestamp() }).catch(() => undefined);
    }
  } catch (e) {
    console.warn('[balanceAdjust] 회수 지시 읽기 실패:', e);
    _ran.delete(uid); // 다음 부팅에서 다시
  }
  return total;
}

/* ══════════════════════════════════════════════════════════════════
 * 웹 포트원 결제 — 기기 장부 (2026-10-24)
 * ═════════════════════════════════════════════════════════════════ */

const PORTONE_PENDING_KEY = 'saju500:portone_pending'; // 결제창을 열기 직전에 적는 결제번호 (확인되면 지운다)
const PORTONE_CREDITED_KEY = 'saju500:portone_credited'; // 이 기기에 운을 더한 결제번호
const PENDING_TTL_MS = 7 * 864e5;

interface PortonePendingMemo { id: string; amount: number; at: number }

/** 웹 화면에서만 (앱인토스 빌드, 토스 앱 안 화면은 아님) */
export function isWebPortoneRuntime(): boolean {
  if (isAppintosBuild) return false;
  return !(typeof navigator !== 'undefined' && /TossApp|InTossApp/i.test(navigator.userAgent));
}

function readPending(): PortonePendingMemo[] {
  try {
    const list = JSON.parse(localStorage.getItem(PORTONE_PENDING_KEY) || '[]');
    if (!Array.isArray(list)) return [];
    const cut = Date.now() - PENDING_TTL_MS;
    return list.filter((x) => x && typeof x.id === 'string' && Number(x.at) >= cut);
  } catch { return []; }
}
function writePending(list: PortonePendingMemo[]): void {
  try { localStorage.setItem(PORTONE_PENDING_KEY, JSON.stringify(list.slice(0, 10))); } catch { /* noop */ }
}

/** 결제창을 열기 직전 — 확인이 끊겨도 다음에 다시 확인하려고 적어 둔다 (최근 10건, 7일) */
export function rememberPortonePending(id: string, amount: number): void {
  const list = readPending().filter((x) => x.id !== id);
  list.unshift({ id, amount, at: Date.now() });
  writePending(list);
}

/** 확인이 끝났거나(운이 들어감, 이미 처리됨) 결제창이 실패, 취소로 닫힌 결제 */
export function forgetPortonePending(id: string): void {
  const list = readPending();
  if (list.some((x) => x.id === id)) writePending(list.filter((x) => x.id !== id));
}

function creditedIds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PORTONE_CREDITED_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

/** 이 결제의 운을 이 기기에 이미 더했나 */
export function isPortoneCreditedHere(id: string): boolean {
  return creditedIds().includes(id);
}

/** 이 기기에 한 번만 더한다 (같은 결제번호는 두 번 더하지 않는다). @returns 이번에 더했으면 true */
function creditPortoneHere(id: string, paidUn: number, bonusUn: number): boolean {
  const ids = creditedIds();
  if (ids.includes(id)) { forgetPortonePending(id); return false; }
  addPaidBalance(Math.max(0, paidUn), Math.max(0, bonusUn));
  ids.push(id);
  try { localStorage.setItem(PORTONE_CREDITED_KEY, JSON.stringify(ids.slice(-100))); } catch { /* noop */ }
  forgetPortonePending(id);
  return true;
}

/** 잔액 맞추기와 포트원 결제 넣기가 한 탭에서 겹치지 않게 차례로 돌린다 (안에서 다시 부르지 않는다) */
let _lock: Promise<unknown> = Promise.resolve();
export function withBalanceLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = _lock.then(fn, fn);
  _lock = run.catch(() => undefined);
  return run;
}

export interface PortoneConfirmResult {
  ok: boolean;
  message: string;
  totalUn?: number;
  paidUn?: number;
  bonusUn?: number;
  /** 이번에 이 기기 잔액에 더했는가 */
  credited: boolean;
  /** 서버 감시가 먼저 넣은 결제를 이 기기가 받아 왔는가 */
  autoGranted?: boolean;
}

/**
 * 서버 결제 확인(confirmPortonePayment) + 응답의 paidUn 을 이 기기에 한 번 더하기.
 *   포트원 결제 운을 기기에 더하는 곳은 여기 하나다(충전 화면도 이걸 거친다).
 */
export function confirmPortoneAndCredit(paymentId: string, amount: number): Promise<PortoneConfirmResult> {
  return withBalanceLock(async () => {
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { app } = await import('@/services/auth/firebase');
      const fn = httpsCallable(getFunctions(app, 'us-central1'), 'confirmPortonePayment', { timeout: 25000 });
      const r = await fn({ paymentId, amount });
      const d = r.data as { success: boolean; message: string; totalUn?: number; paidUn?: number; bonusUn?: number; autoGranted?: boolean };
      let credited = false;
      if (d.success && d.paidUn != null) credited = creditPortoneHere(paymentId, Number(d.paidUn) || 0, Number(d.bonusUn) || 0);
      else if (d.success) forgetPortonePending(paymentId); // 이미 처리된 결제 — 더하지 않고 지운다
      return { ok: !!d.success, message: d.message, totalUn: d.totalUn, paidUn: d.paidUn, bonusUn: d.bonusUn, autoGranted: !!d.autoGranted, credited };
    } catch (e: any) {
      return { ok: false, message: e?.message || '결제 확인 중 오류가 발생했어요', credited: false };
    }
  });
}

export interface PendingPortoneCredit { id: string; amount: number; un: number }

/** 서버 감시가 채웠는데 아직 어느 기기에도 안 들어간 결제 (본인 결제 문서만 읽는다). 읽기에 실패하면 throw */
export async function listPendingPortoneCredits(uid: string): Promise<PendingPortoneCredit[]> {
  const snap = await getDocs(query(collection(db, `users/${uid}/payments`), where('deviceCreditPending', '==', true)));
  return snap.docs
    .map((d) => ({ id: d.id, x: d.data() as Record<string, any> }))
    .filter(({ x }) => x.status === 'confirmed' && x.pgProvider === 'portone')
    .map(({ id, x }) => ({ id, amount: Number(x.amount) || 0, un: (Number(x.paidUn) || 0) + (Number(x.bonusUn) || 0) }));
}

/** 로그인 때 잔액 맞추기에서 뺄 몫 — 그 가운데 이 기기에 아직 안 더한 것 (부르는 그 순간 기준, 기다림 없이) */
export function pendingPortoneCreditUn(list: PendingPortoneCredit[]): number {
  const done = creditedIds();
  return list.reduce((s, c) => (done.includes(c.id) ? s : s + c.un), 0);
}

const _resumed = new Set<string>();
let _loginSync: Promise<unknown> | null = null;

/**
 * 로그인 직후 잔액 맞추기(syncFromCloud 전체)가 돌고 있음을 알린다 (useAuth).
 *   그 안의 로그아웃 스냅샷 되살리기는 잔액 칸을 통째로 바꾸고, 잔액이 바뀔 때마다 그 스냅샷 문서(state/balance)도 새 값으로 덮인다.
 *   그래서 결제 넣기는 로그인 잔액 맞추기가 끝난 뒤에 한다.
 */
export function noteLoginBalanceSync(p: Promise<unknown>): void {
  const wrapped: Promise<unknown> = p.catch(() => undefined).then(() => { if (_loginSync === wrapped) _loginSync = null; });
  _loginSync = wrapped;
}

/**
 * 로그인한 웹 기기가 열릴 때와 로그인한 뒤 — 확인이 끊긴 결제와, 서버가 자동으로 채운 결제를 다시 확인해 이 기기에 넣는다.
 *   계정마다 페이지 한 번. 충전 화면이 지금 확인 중인 결제(주소의 portone_pid)는 건드리지 않는다.
 * @returns 이번에 이 기기에 넣은 운
 */
export async function resumePortonePayments(): Promise<number> {
  if (!isWebPortoneRuntime()) return 0;
  if (_loginSync) await _loginSync; // 로그인 잔액 맞추기가 먼저 (위 설명)
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return 0;
  const uid = user.uid;
  if (_resumed.has(uid)) return 0;
  _resumed.add(uid);
  let creditedUn = 0;
  try {
    const cands = new Map<string, number>(); // 결제번호 → 금액
    // 결제번호 앞 8자가 지금 계정과 같은 것만 (다른 계정 결제를 부르면 서버가 거부하고 불일치 기록만 남는다)
    for (const e of readPending()) if (e.id.startsWith(uid.slice(0, 8)) && Number(e.amount) > 0) cands.set(e.id, Number(e.amount));
    try {
      for (const c of await listPendingPortoneCredits(uid)) if (c.amount > 0) cands.set(c.id, c.amount);
    } catch { /* 서버 목록을 못 읽어도 이 기기 기록은 확인한다 */ }
    if (!cands.size) return 0;
    const urlPid = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('portone_pid') || '' : '';
    for (const [id, amount] of cands) {
      if (id === urlPid) continue; // 충전 화면이 확인한다
      if (isPortoneCreditedHere(id)) { forgetPortonePending(id); continue; }
      const r = await confirmPortoneAndCredit(id, amount);
      if (!r.ok || !r.credited) continue; // 실패는 다음에 다시, 이미 처리된 결제는 위에서 지웠다
      creditedUn += r.totalUn ?? ((r.paidUn || 0) + (r.bonusUn || 0));
      try { (await import('@/services/payment/payerHistory')).markPaidOnce(); } catch { /* noop */ }
      try { (await import('@/services/payment/refundRequest')).rememberWebPayment(id, amount); } catch { /* noop */ }
      import('@/services/analytics').then((a) => a.trackEvent('charge_complete', { amount, source: 'resume', pg: 'portone', auto: r.autoGranted ? 1 : 0 })).catch(() => {});
    }
    if (creditedUn > 0) {
      window.dispatchEvent(new CustomEvent('saju500:toast', { detail: { text: `결제가 확인돼 ${creditedUn}운을 넣었어요`, type: 'success' } }));
    }
  } catch (e) {
    console.warn('[balanceAdjust] 결제 이어 받기 실패:', e);
    _resumed.delete(uid); // 다음에 다시
  }
  return creditedUn;
}
