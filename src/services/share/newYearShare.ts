/**
 * 신년운세 미리 보기 보내기 (2026-10-18) — 받는 사람이 그 사람의 새해 미리 보기를 직접 열어 보는 링크 (/share/newyear/{id}).
 *   서버: functions/src/share/newYearShare.ts (createNewYearShare). 생일과 사주 여덟 글자는 보내지 않는다.
 *   받는 화면: pages/share/NewYearShareView.tsx.
 */
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';
import { db } from '@/services/auth/firebase';

export interface NewYearShareDoc {
  name: string;
  y: number;
  gz: string;
  verdict: string;
  g: string;
  b: string;
  r1: string;
  r2: string;
  good: number[];
  goodLabel: string;
  hard: number[];
  km: number;
  kd: number;
  kn: number;
}
export type NewYearShareInput = Omit<NewYearShareDoc, never>;

const made = new Map<string, string>(); // 같은 미리 보기를 여러 번 보내도 링크는 하나

export async function createNewYearShareId(input: NewYearShareInput, cacheKey: string): Promise<string> {
  const hit = made.get(cacheKey);
  if (hit) return hit;
  await ensureFunctionsTarget();
  const fn = httpsCallable<NewYearShareInput, { id: string }>(functions, 'createNewYearShare', { timeout: 15000 });
  const res = await fn(input);
  made.set(cacheKey, res.data.id);
  return res.data.id;
}

export function isNewYearShareId(id: string | undefined): boolean {
  return !!id && /^[A-Za-z0-9]{14}$/.test(id);
}

export async function fetchNewYearShare(id: string): Promise<NewYearShareDoc | null> {
  if (!isNewYearShareId(id)) return null;
  try {
    const snap = await getDoc(doc(db, 'newYearShares', id));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    const nums = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((m) => m >= 1 && m <= 12) : []);
    return {
      name: String(d.name || ''),
      y: Number(d.y) || 0,
      gz: String(d.gz || ''),
      verdict: String(d.verdict || ''),
      g: String(d.g || ''),
      b: String(d.b || ''),
      r1: String(d.r1 || ''),
      r2: String(d.r2 || ''),
      good: nums(d.good),
      goodLabel: String(d.goodLabel || ''),
      hard: nums(d.hard),
      km: Number(d.km) || 0,
      kd: Number(d.kd) || 0,
      kn: Number(d.kn) || 0,
    };
  } catch {
    return null;
  }
}
