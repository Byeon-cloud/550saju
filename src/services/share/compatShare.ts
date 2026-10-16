/**
 * 궁합 보내기 (2026-10-17, 시험 E7) — 받는 사람이 열어 볼 수 있게 궁합의 일부만 서버에 남기고 링크를 만든다.
 *   서버: functions/src/share/compatShare.ts (createCompatShare). 생일과 사주 여덟 글자, 조심할 점과 조언은 보내지 않는다.
 *   받는 화면: pages/SharePage.tsx 의 CompatShareView (/share/compat/{id}).
 */
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';
import { db } from '@/services/auth/firebase';

export interface CompatShareInput {
  n1: string;
  n2: string;
  rel: string;
  score: number;
  rtype?: string;
  summary?: string;
  cats?: Array<{ n: string; s: number }>;
  good?: string;
  tti1?: string;
  tti2?: string;
}

export interface CompatShareDoc {
  n1: string;
  n2: string;
  rel: string;
  score: number;
  rtype: string;
  head: string;
  cats: Array<{ n: string; s: number }>;
  good: string;
  tti1: string;
  tti2: string;
}

const made = new Map<string, string>(); // 같은 결과를 여러 번 보내도 링크는 하나

export async function createCompatShareId(input: CompatShareInput, cacheKey: string): Promise<string> {
  const hit = made.get(cacheKey);
  if (hit) return hit;
  await ensureFunctionsTarget();
  const fn = httpsCallable<CompatShareInput, { id: string }>(functions, 'createCompatShare', { timeout: 15000 });
  const res = await fn(input);
  made.set(cacheKey, res.data.id);
  return res.data.id;
}

export async function fetchCompatShare(id: string): Promise<CompatShareDoc | null> {
  if (!/^[A-Za-z0-9]{8,32}$/.test(id)) return null;
  try {
    const snap = await getDoc(doc(db, 'compatShares', id));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    return {
      n1: String(d.n1 || '나'),
      n2: String(d.n2 || '상대'),
      rel: String(d.rel || ''),
      score: Number(d.score) || 0,
      rtype: String(d.rtype || ''),
      head: String(d.head || ''),
      cats: Array.isArray(d.cats) ? d.cats.map((c: any) => ({ n: String(c.n || ''), s: Number(c.s) || 0 })).filter((c: any) => c.n) : [],
      good: String(d.good || ''),
      tti1: String(d.tti1 || ''),
      tti2: String(d.tti2 || ''),
    };
  } catch {
    return null;
  }
}
