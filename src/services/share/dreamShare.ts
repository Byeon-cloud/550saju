/**
 * 꿈해몽 보내기 (2026-10-17) — 받는 사람이 꿈 풀이 첫 장을 직접 열어 보는 링크 (/share/dream/{id}).
 *   서버: functions/src/share/dreamShare.ts (createDreamShare). 사주와 엮은 잠긴 풀이와 생일은 보내지 않는다.
 *   받는 화면: pages/share/DreamShareView.tsx.
 */
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, ensureFunctionsTarget } from '@/services/firebase/functionsClient';
import { db } from '@/services/auth/firebase';

export interface DreamShareInput {
  name?: string;
  cat?: string;
  dream?: string;
  title?: string;
  quote?: string;
  narrative?: string;
  symbols?: Array<{ k: string; m: string }>;
}
export interface DreamShareDoc {
  name: string;
  cat: string;
  dream: string;
  title: string;
  quote: string;
  narrative: string;
  symbols: Array<{ k: string; m: string }>;
}

const made = new Map<string, string>(); // 같은 꿈을 여러 번 보내도 링크는 하나

export async function createDreamShareId(input: DreamShareInput, cacheKey: string): Promise<string> {
  const hit = made.get(cacheKey);
  if (hit) return hit;
  await ensureFunctionsTarget();
  const fn = httpsCallable<DreamShareInput, { id: string }>(functions, 'createDreamShare', { timeout: 15000 });
  const res = await fn(input);
  made.set(cacheKey, res.data.id);
  return res.data.id;
}

/** 예전 꿈 공유 주소는 날짜(YYYY-MM-DD)라 서버 문서가 없다 → 14자 id 만 읽는다 */
export function isDreamShareId(id: string | undefined): boolean {
  return !!id && /^[A-Za-z0-9]{14}$/.test(id);
}

export async function fetchDreamShare(id: string): Promise<DreamShareDoc | null> {
  if (!isDreamShareId(id)) return null;
  try {
    const snap = await getDoc(doc(db, 'dreamShares', id));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    return {
      name: String(d.name || ''),
      cat: String(d.cat || ''),
      dream: String(d.dream || ''),
      title: String(d.title || ''),
      quote: String(d.quote || ''),
      narrative: String(d.narrative || ''),
      symbols: Array.isArray(d.symbols) ? d.symbols.map((s: any) => ({ k: String(s.k || ''), m: String(s.m || '') })).filter((s: any) => s.k && s.m) : [],
    };
  } catch {
    return null;
  }
}
