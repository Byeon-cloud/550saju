/**
 * 친구 초대 (2026-10-18) — 서버: functions/src/referral/referral.ts
 *
 *   - 내 초대 코드: getMyInvite() (서버가 만든 6자, 이 기기에 저장해 두고 모든 보내기 링크에 inv= 로 붙인다 → withInv)
 *   - 받은 사람: 앱을 열 때 captureInvite() 가 주소의 inv 를 저장하고 서버에 '누른 시각'을 남긴다(처음 누른 링크만)
 *   - 받은 사람이 사주를 넣고 로그인(앱: 토스 회원 확인, 웹: 카카오, 네이버, 구글, 애플)하면 completeInvite() → 두 사람 적립 대기
 *   - claimInviteRewards(): 앱을 열 때와 돌아올 때 적립 대기 운을 받아 기기 잔액(reward)에 더한다
 *   보상 금액과 상한은 서버 config/referral 이 정한다. 이 파일은 금액을 정하지 않는다.
 */
import { httpsCallable } from 'firebase/functions';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';
import { isAppsInToss } from '@/services/payment/iapService';
import { isAppintosBuild } from '@/lib/env';

const MY_CODE_KEY = 'saju500:inv:mine';
const PENDING_KEY = 'saju500:inv:pending';
const NOTICE_KEY = 'saju500:inv:notice';
const CODE_RE = /^[A-Z2-9]{6}$/;

export interface InviteRules { inviteeUn: number; referrerUn: number; purchaseBonusUn: number; purchaseMinTotalUn: number; purchaseHoldDays: number; monthlyCap: number; lifetimeCap: number }
export interface MyInvite {
  code: string;
  enabled: boolean;
  stats: { visits: number; qualified: number; purchased: number; earnedUn: number; monthQualified: number };
  rules: InviteRules;
}
export interface PendingInvite { code: string; ts: number; recorded?: boolean; isNew?: boolean; referrerName?: string; inviteeUn?: number; done?: string }

const inApp = () => isAppintosBuild || isAppsInToss();
function track(name: string, p: Record<string, string | number> = {}) {
  import('@/services/analytics').then((a) => a.trackEvent(name, p)).catch(() => {});
}
function read<T>(k: string): T | null {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 공간 없음 */ }
}
async function deviceId(): Promise<string | undefined> {
  if (!inApp()) return undefined;
  try { const mod: any = await import('@apps-in-toss/web-framework'); return mod?.getDeviceId?.() || undefined; } catch { return undefined; }
}
async function call<T>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  const { ensureAuth } = await import('@/services/auth/authService');
  await ensureAuth();
  await ensureFunctionsTarget();
  const fn = httpsCallable<Record<string, unknown>, T>(functions, name, { timeout: 20000 });
  return (await fn(data)).data;
}

/** 이 기기에 저장된 내 초대 코드 (없으면 '') — 보내기 링크에 붙일 때 쓴다 */
export function cachedInviteCode(): string {
  const c = read<{ code: string }>(MY_CODE_KEY);
  return c?.code && CODE_RE.test(c.code) ? c.code : '';
}
/** 마지막으로 받은 보상 규칙 (홈 문구용, 없으면 null) */
export function cachedInviteRules(): InviteRules | null {
  return read<{ rules?: InviteRules }>(MY_CODE_KEY)?.rules || null;
}
/** 보내기 링크에 inv 를 붙인다 (코드가 없으면 그대로) */
export function withInv(pathOrUrl: string): string {
  const c = cachedInviteCode();
  if (!c || /[?&]inv=/.test(pathOrUrl)) return pathOrUrl;
  return `${pathOrUrl}${pathOrUrl.includes('?') ? '&' : '?'}inv=${c}`;
}

/** 내 초대 코드와 성과 (서버). 이름은 받은 사람 화면에 'OO 님이 초대했어요'로 보인다 */
export async function getMyInvite(name?: string): Promise<MyInvite> {
  const r = await call<MyInvite>('getMyReferral', { deviceId: await deviceId(), name: name || '' });
  if (r?.code) write(MY_CODE_KEY, { code: r.code, at: Date.now(), rules: r.rules });
  return r;
}
/** 보내기 직전 — 내 코드가 없으면 받아 온다 (최대 2.5초, 실패하면 코드 없이 보낸다) */
export async function ensureInviteCode(): Promise<string> {
  const c = cachedInviteCode();
  if (c) return c;
  try {
    const r = await Promise.race([getMyInvite(), new Promise<null>((res) => setTimeout(() => res(null), 2500))]);
    return (r as MyInvite | null)?.code || '';
  } catch { return ''; }
}
/** 홈 등에서 미리 코드를 받아 둔다 (보내기 링크에 바로 붙게). 실패해도 무해 */
export function warmInviteCode(name?: string): void {
  if (cachedInviteCode()) return;
  getMyInvite(name).catch(() => {});
}

export function pendingInvite(): PendingInvite | null {
  const p = read<PendingInvite>(PENDING_KEY);
  if (!p || !CODE_RE.test(p.code)) return null;
  if (Date.now() - p.ts > 30 * 864e5) return null;
  return p;
}

/** 앱을 연 순간 (라우터가 주소를 바꾸기 전) — 주소의 inv 를 이 기기에 적어 둔다. 처음 누른 링크만, 내 코드는 무시 */
let landingSrc = '';
export function stashInviteFromUrl(): void {
  try {
    // main.tsx 가 첫 화면 주소에서 적어 둔 것 (라우터가 주소를 바꿔도 남는다), 없으면 지금 주소
    const landing = read<{ code: string; ts: number; path: string }>('saju500:inv:landing');
    const q = new URLSearchParams(window.location.search);
    const code = (landing?.code || q.get('inv') || '').toUpperCase();
    if (!CODE_RE.test(code) || pendingInvite() || code === cachedInviteCode()) return;
    const path = landing?.path || window.location.pathname;
    landingSrc = path.split('/')[2] || path.split('/')[1] || 'home';
    write(PENDING_KEY, { code, ts: landing?.ts || Date.now() });
  } catch { /* noop */ }
}

/** 인증 뒤 — 서버에 누른 기록을 남긴다 (서버 시각, 새 손님 여부) */
export async function captureInvite(): Promise<void> {
  try {
    stashInviteFromUrl();
    const p = pendingInvite();
    if (!p || p.recorded) return;
    const r = await call<{ ok: boolean; first?: boolean; isNew?: boolean; referrerName?: string; reason?: string; inviteeUn?: number }>('recordReferralVisit', {
      code: p.code, deviceId: await deviceId(), plat: inApp() ? 'ait' : 'web', src: landingSrc,
    });
    const next: PendingInvite = { ...p, recorded: true, isNew: !!r?.isNew && r?.ok !== false, referrerName: r?.referrerName || '', inviteeUn: r?.inviteeUn };
    if (r?.ok === false) next.done = r.reason || 'bad';
    write(PENDING_KEY, next);
    track('inv_visit', { isNew: next.isNew ? 1 : 0, ok: r?.ok === false ? 0 : 1 });
  } catch { /* 다음 부팅에 다시 */ }
}

/** 초대 코드를 직접 넣기 (링크 없이 코드만 받은 경우) — 처음 쓰는 날만 인정 */
export async function enterInviteCode(raw: string): Promise<{ ok: boolean; reason?: string; isNew?: boolean; referrerName?: string }> {
  const code = raw.trim().toUpperCase();
  if (!CODE_RE.test(code)) return { ok: false, reason: 'bad_code' };
  if (code === cachedInviteCode()) return { ok: false, reason: 'self' };
  const prev = pendingInvite();
  if (prev?.recorded) return { ok: false, reason: 'already' };
  try {
    const r = await call<{ ok: boolean; isNew?: boolean; referrerName?: string; reason?: string; inviteeUn?: number }>('recordReferralVisit', {
      code, deviceId: await deviceId(), plat: inApp() ? 'ait' : 'web', src: 'manual', manual: true,
    });
    if (r?.ok) write(PENDING_KEY, { code, ts: Date.now(), recorded: true, isNew: !!r.isNew, referrerName: r.referrerName || '', inviteeUn: r.inviteeUn });
    track('inv_visit', { isNew: r?.isNew ? 1 : 0, ok: r?.ok ? 1 : 0, manual: 1 });
    return r;
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** 받은 사람 카드를 보여 줄지 — 새 손님으로 들어왔고 아직 인정 전 */
export function inviteWelcomeVisible(): boolean {
  const p = pendingInvite();
  return !!p && !!p.recorded && !!p.isNew && !p.done;
}

export type CompleteStatus = 'granted' | 'need_login' | 'no_visit' | 'not_new' | 'no_saju' | 'used' | 'self' | 'expired' | 'paused' | 'disabled' | 'error';

/** 앱: 토스 회원 확인 (계정은 그대로) */
export async function verifyTossForInvite(): Promise<boolean> {
  try {
    const { appLogin } = await import('@apps-in-toss/web-framework');
    const { authorizationCode } = await appLogin();
    await call('verifyTossIdentity', { authorizationCode });
    return true;
  } catch {
    return false;
  }
}

/** 받은 사람 — 사주를 넣고 로그인한 뒤. 성공하면 바로 적립을 받아 온다 */
export async function completeInvite(): Promise<{ status: CompleteStatus; inviteeUn?: number; referrerName?: string }> {
  const p = pendingInvite();
  if (!p) return { status: 'no_visit' };
  try {
    // 서버가 사주를 넣었는지 확인하는 미러를 먼저 올린다
    const [{ pushProfilesMirror }, { getProfiles }] = await Promise.all([import('@/services/storage/firestoreSync'), import('@/services/storage/localStore')]);
    await pushProfilesMirror(getProfiles() as any);
    const r = await call<{ status: CompleteStatus; inviteeUn?: number; referrerName?: string }>('completeReferral', {});
    const st = r?.status || 'error';
    track('inv_complete', { status: st });
    if (['granted', 'used', 'not_new', 'self', 'expired', 'disabled'].includes(st)) write(PENDING_KEY, { ...p, done: st });
    if (st === 'granted') { lastClaim = 0; await claimInviteRewards(); takeInviteNotice(); } // 카드가 바로 안내하니 홈 안내는 지운다
    return r;
  } catch {
    track('inv_complete', { status: 'error' });
    return { status: 'error' };
  }
}

/** 적립 대기 운 받기 — 앱을 열 때와 돌아올 때 (30초에 한 번). 받은 만큼 기기 잔액에 더하고 안내를 남긴다 */
let lastClaim = 0;
export async function claimInviteRewards(): Promise<number> {
  if (Date.now() - lastClaim < 30000) return 0;
  lastClaim = Date.now();
  try {
    const r = await call<{ amount: number; kinds: Record<string, number> }>('claimRewards', { deviceId: await deviceId() });
    const amount = Number(r?.amount) || 0;
    if (amount > 0) {
      const { addRewardBalance } = await import('@/services/storage/localStore');
      addRewardBalance(amount);
      write(NOTICE_KEY, { amount, kinds: r.kinds || {}, at: Date.now() });
      track('inv_claim', { amount });
      try { window.dispatchEvent(new Event('saju500:balance-changed')); } catch { /* noop */ }
    }
    return amount;
  } catch {
    return 0;
  }
}
/** 받은 운 안내 (한 번 읽으면 지운다) */
export function takeInviteNotice(): { amount: number; kinds: Record<string, number> } | null {
  const n = read<{ amount: number; kinds: Record<string, number>; at: number }>(NOTICE_KEY);
  if (!n) return null;
  try { localStorage.removeItem(NOTICE_KEY); } catch { /* noop */ }
  return Date.now() - n.at < 3 * 864e5 ? n : null;
}
