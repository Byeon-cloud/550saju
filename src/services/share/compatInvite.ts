/**
 * 친구 궁합 초대장 (2026-10-18, 시험 E16) — 서버: functions/src/compat/compatInvite.ts
 *   보내는 사람: createInvite → 링크 /share/cjoin/{id} (inv 초대 코드도 붙는다)
 *   받은 사람: getInvite → answerInvite(내 사주) → 두 사람 모두 무료 궁합 점수와 한 줄 풀이
 *   전체 풀이는 지금 궁합 결과 화면 그대로(상대 사주는 서버가 생년월일을 빼고 넘겨준다)
 */
import { httpsCallable } from 'firebase/functions';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';

export interface QuickCompat { score: number; good: string[]; care: string[]; head: string }
export interface InviteView { ok: boolean; reason?: string; n1: string; rel: string; status: 'open' | 'answered'; mine: boolean; answeredByMe: boolean; n2: string; result: QuickCompat | null; other: any }
export interface MyInvite { id: string; rel: string; status: 'open' | 'answered'; n2: string; score: number | null; head: string; good: string[]; care: string[]; createdAtMs: number; other: any; fresh: boolean }

const SENT_KEY = 'saju500:cj:sent';

async function call<T>(name: string, data: Record<string, unknown>): Promise<T> {
  const { ensureAuth } = await import('@/services/auth/authService');
  await ensureAuth();
  await ensureFunctionsTarget();
  const fn = httpsCallable<Record<string, unknown>, T>(functions, name, { timeout: 15000 });
  return (await fn(data)).data;
}

export const isCompatInviteId = (id?: string) => !!id && /^[A-Za-z0-9]{14}$/.test(id);
export function hasSentCompatInvite(): boolean {
  try { return !!localStorage.getItem(SENT_KEY); } catch { return false; }
}

export async function createCompatInvite(p: { name: string; sajuData: any; relation: string }): Promise<string> {
  const r = await call<{ id: string }>('createCompatInvite', { name: p.name, sajuData: p.sajuData, relation: p.relation });
  try { localStorage.setItem(SENT_KEY, String(Date.now())); } catch { /* noop */ }
  return r.id;
}
export const getCompatInvite = (id: string) => call<InviteView>('getCompatInvite', { id });
export const answerCompatInvite = (id: string, name: string, sajuData: any) =>
  call<{ ok: boolean; reason?: string; result?: QuickCompat; n1?: string; other?: any }>('answerCompatInvite', { id, name, sajuData });
export const listMyCompatInvites = (markSeen = false) => call<{ items: MyInvite[] }>('listMyCompatInvites', { markSeen });
