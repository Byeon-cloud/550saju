/**
 * 서버가 '운이 부족합니다'로 막았을 때 기기 잔액을 서버 값으로 맞춘다 (2026-10-23)
 *
 *   로그인한 손님은 유료 풀이 값을 서버 잔액(users/{uid}.balance)에서 깎는다(functions/src/index.ts).
 *   기기 잔액이 서버보다 많으면(처음 기기에 생기는 기본 1운, 기기에만 들어간 옛 보상) 화면은 '충분'인데 서버가 막아서,
 *   손님은 까닭도 모르고 같은 버튼을 계속 눌렀다(10-23 00:58 네이버 손님, 2,500원과 500원을 내고 연애운 4운이 여덟 번 막힘).
 *   firestoreSync 의 로그인 동기화는 '기기가 더 많으면 그대로 둔다'(결제 직후 서버 반영이 늦을 수 있어서)라 이 어긋남이 남는다.
 *   그래서 서버가 막은 그 순간에만(= 서버가 이미 본 값) 기기 잔액을 서버 값으로 낮추고, 화면을 충전으로 보낸다(App.tsx InsufficientWatcher).
 */
import { BALANCE_CHANGED_EVENT } from '@/services/storage/localStore';

const BALANCE_KEY = 'saju500_balance_v2';
export const INSUFFICIENT_EVENT = 'saju500:insufficient';

type Detail = { paid: number; bonus: number; reward: number };

export function isInsufficientError(e: unknown): boolean {
  const m = typeof e === 'string' ? e : String((e as { message?: string })?.message || '');
  return m.includes('운이 부족');
}

const num = (v: unknown) => Math.max(0, Number(v) || 0);
const total = (d: Detail) => Math.round((d.paid + d.bonus + d.reward) * 10) / 10;

/** 로그인 계정이면 서버 잔액을 읽어, 기기 잔액이 더 많을 때 서버 값으로 맞춘다. 맞춘 뒤 서버 잔액 합계를 돌려준다 */
export async function reconcileWithServer(): Promise<number | null> {
  try {
    const { auth, db } = await import('@/services/auth/firebase');
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return null; // 익명은 서버가 깎지 않는다
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', user.uid));
    const raw = snap.exists() ? (snap.data() as { balance?: unknown }).balance : undefined;
    if (raw == null) return null;
    const server: Detail = typeof raw === 'number'
      ? { paid: num(raw), bonus: 0, reward: 0 }
      : { paid: num((raw as Detail).paid), bonus: num((raw as Detail).bonus), reward: num((raw as Detail).reward) };
    const localRaw = localStorage.getItem(BALANCE_KEY);
    const local: Detail = localRaw ? JSON.parse(localRaw) : { paid: 0, bonus: 0, reward: 0 };
    if (total(server) < total({ paid: num(local.paid), bonus: num(local.bonus), reward: num(local.reward) }) - 0.05) {
      localStorage.setItem(BALANCE_KEY, JSON.stringify(server));
      try { window.dispatchEvent(new Event(BALANCE_CHANGED_EVENT)); } catch { /* noop */ }
      import('@/services/analytics').then((a) => a.trackEvent('balance_reconciled', { local: total(local), server: total(server) })).catch(() => {});
    }
    return total(server);
  } catch {
    return null;
  }
}

let lastAt = 0;
/** 유료 풀이 호출이 '운이 부족합니다'로 끝나면 부른다(reportGenerator). 잔액을 맞추고 화면에 알린다. 같은 실패가 SSE 와 callable 로 두 번 와도 한 번만 */
export function handleInsufficient(type: string): void {
  const now = Date.now();
  if (now - lastAt < 5000) return;
  lastAt = now;
  void reconcileWithServer().then((server) => {
    try { window.dispatchEvent(new CustomEvent(INSUFFICIENT_EVENT, { detail: { type, server } })); } catch { /* noop */ }
  });
}

/**
 * 로그인 계정에서 기기 잔액이 서버보다 1운 넘게 많으면(기본 1운이 기기에만 있음) 서버에도 한 번 넣어 달라고 한다
 *   (functions/src/auth/claimWelcomeUn.ts, 계정당 한 번). 앱이 뜰 때와 로그인한 뒤에 부른다(App.tsx BalanceGuard).
 */
export async function claimWelcomeIfPhantom(): Promise<void> {
  try {
    const { auth, db } = await import('@/services/auth/firebase');
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    const key = `saju500:welcome_un:${user.uid}`;
    if (localStorage.getItem(key)) return;
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', user.uid));
    const raw = snap.exists() ? (snap.data() as { balance?: unknown; welcomeUnAt?: unknown }) : {};
    if (raw.welcomeUnAt) { localStorage.setItem(key, '1'); return; }
    const b = raw.balance as Detail | number | undefined;
    const server = typeof b === 'number' ? num(b) : b ? total({ paid: num(b.paid), bonus: num(b.bonus), reward: num(b.reward) }) : 0;
    const localRaw = localStorage.getItem(BALANCE_KEY);
    const local = localRaw ? (JSON.parse(localRaw) as Detail) : { paid: 0, bonus: 0, reward: 0 };
    if (total({ paid: num(local.paid), bonus: num(local.bonus), reward: num(local.reward) }) - server < 0.95) return;
    const { httpsCallable } = await import('firebase/functions');
    const { functions, ensureFunctionsTarget } = await import('@/services/firebase/functionsClient');
    await ensureFunctionsTarget();
    const r = await httpsCallable<unknown, { ok: boolean; why: string }>(functions, 'claimWelcomeUn', { timeout: 15000 })({});
    if (r.data?.ok || r.data?.why === 'already') localStorage.setItem(key, '1');
    import('@/services/analytics').then((a) => a.trackEvent('welcome_un_claim', { ok: r.data?.ok ? 1 : 0, why: String(r.data?.why || '') })).catch(() => {});
  } catch { /* 다음에 다시 */ }
}
