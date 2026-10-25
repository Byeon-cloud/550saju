/**
 * 기기에서 깎는 1운 구매의 서버 차감 (2026-10-25) — 서버: functions/src/shared/spendLedger.ts, index.ts spendUn
 *
 *   로그인 계정(웹 소셜, 토스)은 서버 잔액(users/{uid}.balance)이 진본이다. 오늘의 운세(두 번째부터), 두 번째 꿈,
 *   꿈 잠금 풀이, 대화권 바꾸기는 기기에서만 깎아서, 웹에서 로그아웃 뒤 다시 로그인하면 쓴 운이 돌아왔다(되풀이 가능).
 *   이제 오늘의 운세와 두 번째 꿈은 생성 함수에 paid 와 spendId 를 보내고, 잠금 풀이와 대화권은 spendUn 으로 서버도 깎는다.
 *   spendId 는 기기 장부(markPendingSpend) id 를 그대로 쓴다. 같은 spendId 는 서버가 한 번만 깎는다(스트림과 callable 폴백).
 *   익명 계정은 아무것도 부르지 않는다(서버는 익명 운을 깎지 않는다, 예전 그대로).
 *
 *   기기가 그 구매를 실패로 보고 기기 운을 돌려줄 때는 refundServerSpend 로 서버 몫도 돌려받는다(깎인 구매만, 한 번만).
 *   돌려받기 요청은 이 기기 목록에 남겨 두고, 성공할 때까지 다음 차감이나 돌려받기 때 다시 보낸다(7일, 10번까지).
 *
 *   2026-10-26 — 서버가 '운이 부족합니다'라고 해도 막지 않는다 (오너 원칙: 화면에 운이 넉넉한 손님은 서버와 기기 잔액이 어긋났다는
 *   이유로 막거나 충전으로 보내지 않는다. 서버 차감은 장부를 맞추려는 것이지 막으려는 것이 아니다). 기기 운으로 예전처럼 진행하고
 *   어긋남만 남긴다(noteServerSpendShort). 막는 것은 기기 잔액 확인(spendBalance)뿐이다.
 */
import { httpsCallable } from 'firebase/functions';
import { auth } from '@/services/auth/firebase';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';

export type ServerSpendKind = 'dreamUnlock' | 'chat';
/** ok:true 면 진행한다. short 는 서버 잔액이 모자라 서버는 깎지 않고 기기 운으로만 진행한 경우 */
export type ServerSpendResult = { ok: true; short?: boolean } | { ok: false };

/** 서버가 운을 깎는 계정인지 (로그인 계정, 익명 아님) */
export function isServerChargedAccount(): boolean {
  const u = auth.currentUser;
  return !!u && !u.isAnonymous;
}

/** 서버가 '운이 부족합니다'로 막았는지 (스트림 error code 'insufficient', callable failed-precondition 메시지) */
export function isServerInsufficient(e: unknown): boolean {
  const code = String((e as { code?: unknown } | null)?.code ?? '');
  const msg = String((e as { message?: unknown } | null)?.message ?? '');
  return code === 'insufficient' || /운이 부족합니다/.test(msg);
}

/**
 * 2026-10-26 — 서버 잔액이 모자라 서버가 깎지 못했는데 기기 운으로 진행한 구매를 남긴다 (서버와 기기 잔액 어긋남 집계).
 *   type 은 daily, dream, dreamUnlock, chat
 */
export function noteServerSpendShort(type: string, amount: number): void {
  console.warn(`[serverSpend] 서버 잔액이 모자라 기기 운으로만 진행: ${type} ${amount}운`);
  import('@/services/analytics').then((a) => a.trackEvent('server_spend_short', { type, amount })).catch(() => {});
}

/**
 * 생성 없이 바로 넘기는 구매(꿈 잠금 풀이, 대화권)를 서버에서 깎는다. 기기 운을 먼저 깎은 뒤 부른다.
 *   ok:false 면 기기 운을 돌려줄 것. 깎였는지 모르는 실패(시간 초과, 연결 끊김)는 이 함수가 서버 몫 돌려받기를 걸어 둔다.
 *   2026-10-26 — 서버 잔액 모자람은 ok:true, short:true (막지 않는다, 서버는 깎지 않았으니 돌려받기도 없다).
 *   spendUn 이 없는 옛 서버(not-found, unimplemented)도 ok:true (함수보다 웹이 먼저 배포돼도 잠금 풀이와 대화권이 멈추지 않게, 예전 그대로 기기만).
 */
export async function chargeServerSpend(args: { spendId: string; kind: ServerSpendKind; amount: number }): Promise<ServerSpendResult> {
  if (!isServerChargedAccount()) return { ok: true };
  void flushServerSpendRefunds();
  try {
    await ensureFunctionsTarget();
    const fn = httpsCallable<{ spendId: string; kind: ServerSpendKind; amount: number }, { ok: boolean; charged?: boolean }>(functions, 'spendUn', { timeout: 20000 });
    await fn(args);
    return { ok: true };
  } catch (e) {
    if (isServerInsufficient(e)) {
      noteServerSpendShort(args.kind, args.amount);
      return { ok: true, short: true };
    }
    const code = String((e as { code?: unknown } | null)?.code ?? '');
    const msg = String((e as { message?: unknown } | null)?.message ?? '');
    // 2026-10-26 브라우저에서 없는 함수는 not-found 가 아니라 internal(메시지 소문자 'internal', 응답 0)로 온다(CORS 사전 요청이 404).
    //   서버가 던진 internal 은 메시지가 'INTERNAL' 이나 자기 문구라 여기 걸리지 않는다. 이 경우는 돌려받기도 걸지 않는다:
    //   서버가 못 받았으면 예전처럼 기기만, 서버가 깎고 응답만 잃었으면 양쪽이 한 번씩 깎인 그대로라 어긋나지 않는다.
    if (code === 'functions/not-found' || code === 'functions/unimplemented' || (code === 'functions/internal' && msg === 'internal')) return { ok: true };
    refundServerSpend(args.spendId);
    return { ok: false };
  }
}

const QUEUE_KEY = 'saju500:server_spend_refunds';
const QUEUE_MAX_AGE_MS = 7 * 86400000;
const QUEUE_MAX_TRIES = 10;
/** uid '' = 남길 때 계정을 몰랐다(부팅 자동환불, 로그인 정보 복원 전). 보낼 때 그때 로그인한 계정 몫으로 보낸다 */
type QueueItem = { uid: string; id: string; at: number; tries: number };
const ownedBy = (x: QueueItem, uid: string) => x.uid === uid || x.uid === '';

function readQueue(): QueueItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && typeof x.uid === 'string') : [];
  } catch { return []; }
}
function writeQueue(list: QueueItem[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-30))); } catch { /* noop */ }
}

/** 기기 운을 돌려준 구매의 서버 몫을 돌려받는다 (깎이지 않은 구매면 서버가 아무것도 하지 않는다). 기다리지 않는다 */
export function refundServerSpend(spendId: string | null | undefined): void {
  if (!spendId) return;
  const u = auth.currentUser;
  if (!u || u.isAnonymous) return;
  const list = readQueue().filter((x) => !(x.uid === u.uid && x.id === spendId));
  list.push({ uid: u.uid, id: spendId, at: Date.now(), tries: 0 });
  writeQueue(list);
  void flushServerSpendRefunds();
}

/**
 * 2026-10-26 — 부팅 자동환불(localStore reconcilePendingSpends)이 기기 운을 돌려준 구매들의 서버 몫 돌려받기를 남긴다.
 *   오늘의 운세, 꿈(두 번째 꿈, 잠금 풀이), 대화권은 로그인 계정이면 서버도 그 장부 id 로 깎았다. 기기만 돌려주면 서버와 어긋난다.
 *   부팅 때는 로그인 정보가 아직 복원되지 않았을 수 있어(auth.currentUser null) 계정을 모르면 uid '' 로 남기고, 로그인 확인 뒤 보낸다.
 *   서버는 그 계정이 그 spendId 로 실제로 깎인('charged') 구매만 한 번 돌려주므로 계정을 몰라도 다른 계정에 잘못 들어가지 않는다.
 */
export function queueServerSpendRefunds(spendIds: string[]): void {
  const ids = spendIds.filter((x) => typeof x === 'string' && x);
  if (!ids.length) return;
  const u = auth.currentUser;
  const uid = u && !u.isAnonymous ? u.uid : '';
  const list = readQueue().filter((x) => !(ids.includes(x.id) && (x.uid === uid || x.uid === '')));
  for (const id of ids) list.push({ uid, id, at: Date.now(), tries: 0 });
  writeQueue(list);
  // 로그인 정보 복원을 기다렸다 보낸다 (익명이거나 로그아웃 상태면 flush 가 아무것도 하지 않고 다음 기회에)
  const ready = typeof auth.authStateReady === 'function' ? auth.authStateReady() : Promise.resolve();
  ready.then(() => flushServerSpendRefunds()).catch(() => { /* 다음에 다시 */ });
}

let flushing = false;
/** 남은 돌려받기 요청을 보낸다 (지금 로그인한 계정 몫과 계정을 모르고 남긴 몫). 앱이 뜰 때 불러도 된다 */
export async function flushServerSpendRefunds(): Promise<void> {
  if (flushing) return;
  const u = auth.currentUser;
  if (!u || u.isAnonymous) return;
  const now = Date.now();
  const mine = readQueue().filter((x) => ownedBy(x, u.uid) && now - x.at < QUEUE_MAX_AGE_MS && x.tries < QUEUE_MAX_TRIES);
  if (!mine.length) return;
  flushing = true;
  const attempted = new Set(mine.map((x) => x.id));
  const done = new Set<string>();
  const failed = new Set<string>();
  try {
    await ensureFunctionsTarget();
    const fn = httpsCallable<{ action: 'refund'; spendId: string }, { ok: boolean; refunded?: number }>(functions, 'spendUn', { timeout: 20000 });
    for (const it of mine) {
      try {
        await fn({ action: 'refund', spendId: it.id });
        done.add(it.id);
      } catch {
        failed.add(it.id);
      }
    }
  } catch { /* 다음에 다시 */ } finally {
    // 보내는 사이 새로 들어온 요청을 지우지 않게 다시 읽어서 처리한 것만 고친다
    const later = Date.now();
    writeQueue(readQueue()
      .filter((x) => !(ownedBy(x, u.uid) && done.has(x.id)))
      .map((x) => (ownedBy(x, u.uid) && failed.has(x.id) ? { ...x, tries: x.tries + 1 } : x))
      .filter((x) => later - x.at < QUEUE_MAX_AGE_MS && x.tries < QUEUE_MAX_TRIES));
    flushing = false;
  }
  // 보내는 동안 새로 들어온 요청이 있으면 한 번 더
  if (readQueue().some((x) => ownedBy(x, u.uid) && !attempted.has(x.id))) void flushServerSpendRefunds();
}
