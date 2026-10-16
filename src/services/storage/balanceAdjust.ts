/**
 * 운 회수 지시 반영 (2026-10-16) — 서버 syncPortoneCancellations 가 포트원 취소 결제마다
 *   users/{uid}/balanceAdjustments/{paymentId} { paid: -n, bonus: -m, applied: false } 를 남긴다.
 *   운 잔액의 기준은 기기라 서버 차감만으로는 화면이 안 바뀐다 → 앱이 열릴 때 여기서 기기 잔액에서 뺀다.
 *
 * 두 번 빼지 않게: 이 기기에서 반영한 지시 ID 를 먼저 적고(localStorage), 서버 applied=true 는 그다음.
 *   표시가 실패해도 다음 부팅에 이 기기는 같은 지시를 다시 빼지 않는다.
 */
import { collection, getDocs, query, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/auth/firebase';
import { reclaimBalance } from './localStore';

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
    const done = doneIds();
    for (const d of snap.docs) {
      const a = d.data() as { paid?: number; bonus?: number };
      if (!done.has(d.id)) {
        total += reclaimBalance(Math.abs(Number(a.paid) || 0), Math.abs(Number(a.bonus) || 0));
        done.add(d.id);
        markDone(done);
      }
      await updateDoc(doc(db, `users/${uid}/balanceAdjustments`, d.id), { applied: true, appliedAt: serverTimestamp() }).catch(() => undefined);
    }
  } catch (e) {
    console.warn('[balanceAdjust] 회수 지시 읽기 실패:', e);
    _ran.delete(uid); // 다음 부팅에서 다시
  }
  return total;
}
