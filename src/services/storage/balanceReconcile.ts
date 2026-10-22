/**
 * 로그인 계정의 기본 1운을 서버에도 맞춘다 (2026-10-23)
 *
 *   새 기기는 기본 1운으로 시작한다(localStore getBalanceDetail). 로그인 계정은 유료 풀이 값을 서버 잔액(users/{uid}.balance)에서 깎는데
 *   기본 1운이 기기에만 있어, 화면은 '충분'인데 서버가 '운이 부족합니다'로 막았다(10-23 00:58 네이버 손님, 결제 3,000원 뒤 연애운 4운이 여덟 번 막힘).
 *   로그인 계정에서 기기 잔액이 서버보다 1운 넘게 많으면 서버에 기본 1운을 한 번 넣어 달라고 한다(functions/src/auth/claimWelcomeUn.ts, 계정당 한 번).
 *
 *   10-23 검수 뒤 결정: 서버가 막았을 때 기기 잔액을 낮추고 충전 화면으로 자동 이동하는 장치는 넣지 않는다.
 *   페이지가 먼저 깎고 나중에 돌려주는 흐름, 앱 결제의 서버 반영 지연, 궁합 화면의 늦은 이동과 부딪혀 운이 사라져 보이거나 이중 결제를 부를 수 있었다.
 */
const BALANCE_KEY = 'saju500_balance_v2';

type Detail = { paid: number; bonus: number; reward: number };
const num = (v: unknown) => Math.max(0, Number(v) || 0);
const total = (d: Detail) => Math.round((num(d.paid) + num(d.bonus) + num(d.reward)) * 10) / 10;

/** 앱이 뜰 때와 로그인한 뒤 세션마다 한 번(App.tsx BalanceGuard) */
export async function claimWelcomeIfPhantom(): Promise<void> {
  try {
    const { auth, db } = await import('@/services/auth/firebase');
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    const doneKey = `saju500:welcome_un:${user.uid}`;
    const sessKey = `saju500:welcome_un_checked:${user.uid}`;
    if (localStorage.getItem(doneKey) || sessionStorage.getItem(sessKey)) return;
    sessionStorage.setItem(sessKey, '1');
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return; // 서버 문서가 없는 계정은 서버가 차감하지 않아 어긋남이 없다
    const raw = snap.data() as { balance?: unknown; welcomeUnAt?: unknown };
    if (raw.welcomeUnAt) { localStorage.setItem(doneKey, '1'); return; }
    const b = raw.balance;
    const server = typeof b === 'number' ? num(b) : b && typeof b === 'object' ? total(b as Detail) : 0;
    const localRaw = localStorage.getItem(BALANCE_KEY);
    const local = localRaw ? (JSON.parse(localRaw) as Detail) : { paid: 0, bonus: 0, reward: 0 };
    if (total(local) - server < 0.95) return;
    const { httpsCallable } = await import('firebase/functions');
    const { functions, ensureFunctionsTarget } = await import('@/services/firebase/functionsClient');
    await ensureFunctionsTarget();
    const r = await httpsCallable<unknown, { ok: boolean; why: string }>(functions, 'claimWelcomeUn', { timeout: 15000 })({});
    if (r.data?.ok || r.data?.why === 'already') localStorage.setItem(doneKey, '1');
    import('@/services/analytics').then((a) => a.trackEvent('welcome_un_claim', { ok: r.data?.ok ? 1 : 0, why: String(r.data?.why || '') })).catch(() => {});
  } catch { /* 다음 세션에 다시 */ }
}
