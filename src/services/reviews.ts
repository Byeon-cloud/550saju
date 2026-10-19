/**
 * 실제 후기 (2026-10-10)
 *   배경: 홈 후기 캐러셀(constants/reviews.ts)은 팀이 쓴 시드 문장이었다 → 실제 후기처럼 보여주면 거짓 후기(표시광고법).
 *   지금부터: 결과를 다 읽은 사람에게만 별점 + 한 줄을 받고, "홈에 익명으로 보여도 좋아요" 동의 + 오너 승인분만 공개.
 *   저장: Firestore reviews/{id} — 본인 create 만(수정·삭제 불가), 공개 읽기는 status=approved && consentPublic 만 (firestore.rules).
 *   나이·성별·이름은 받지 않는다 (개인정보 최소화) — 공개 표기는 '콘텐츠 · 월' 뿐.
 */
import { addDoc, collection, getDocs, limit, query, serverTimestamp, where, updateDoc, doc, orderBy } from 'firebase/firestore';
import { auth, db } from '@/services/auth/firebase';
import { ensureAuth } from '@/services/auth/authService';

export type ReviewContent = 'premium' | 'topic' | 'daily' | 'dream' | 'tojung' | 'monthly' | 'weekly' | 'compat';

export interface PublicReview {
  id: string;
  contentType: string;
  contentLabel: string;
  rating: number;
  text: string;
  month: number | null;
}

const DONE_PREFIX = 'saju500:review_done:';

/** 이미 이 결과에 후기를 남겼거나 '다음에' 를 눌렀는지 */
export function reviewHandled(key: string): boolean {
  try { return !!localStorage.getItem(DONE_PREFIX + key); } catch { return false; }
}
export function markReviewHandled(key: string, how: 'sent' | 'later' | 'toss'): void {
  try { localStorage.setItem(DONE_PREFIX + key, `${how}:${Date.now()}`); } catch { /* noop */ }
}

export async function submitReview(input: {
  contentType: ReviewContent;
  contentLabel: string;
  rating: number;
  text: string;
  consentPublic: boolean;
}): Promise<boolean> {
  try {
    await ensureAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
    await addDoc(collection(db, 'reviews'), {
      uid,
      contentType: input.contentType,
      contentLabel: input.contentLabel.slice(0, 20),
      rating,
      text: input.text.trim().slice(0, 300),
      consentPublic: !!input.consentPublic,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.warn('[reviews] submit fail:', e);
    return false;
  }
}

/** 홈 노출용 — 승인 + 공개 동의 + 글 있는 후기만. 없으면 빈 배열 (홈은 섹션 자체를 숨긴다) */
export async function getPublicReviews(max = 12): Promise<PublicReview[]> {
  try {
    const snap = await getDocs(query(
      collection(db, 'reviews'),
      where('status', '==', 'approved'),
      where('consentPublic', '==', true),
      limit(40),
    ));
    const rows = snap.docs.map((d) => {
      const x = d.data() as any;
      const ts = x.createdAt?.toDate ? x.createdAt.toDate() as Date : null;
      return {
        id: d.id,
        contentType: String(x.contentType || ''),
        contentLabel: String(x.contentLabel || ''),
        rating: Number(x.rating) || 0,
        text: String(x.text || '').trim(),
        month: ts ? ts.getMonth() + 1 : null,
        _t: ts ? ts.getTime() : 0,
      };
    }).filter((r) => r.text.length >= 8);
    rows.sort((a, b) => b._t - a._t);
    return rows.slice(0, max).map(({ _t, ...r }) => r);
  } catch {
    return [];
  }
}

/* ── 어드민 (오너만 — rules isOwner) ── */
export interface AdminReview extends PublicReview { status: string; consentPublic: boolean; createdAtMs: number }
export async function adminListReviews(): Promise<AdminReview[]> {
  const snap = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(100)));
  return snap.docs.map((d) => {
    const x = d.data() as any;
    const ts = x.createdAt?.toDate ? x.createdAt.toDate() as Date : null;
    return {
      id: d.id,
      contentType: String(x.contentType || ''),
      contentLabel: String(x.contentLabel || ''),
      rating: Number(x.rating) || 0,
      text: String(x.text || ''),
      month: ts ? ts.getMonth() + 1 : null,
      status: String(x.status || 'pending'),
      consentPublic: !!x.consentPublic,
      createdAtMs: ts ? ts.getTime() : 0,
    };
  });
}
export async function adminSetReviewStatus(id: string, status: 'approved' | 'hidden'): Promise<void> {
  await updateDoc(doc(db, 'reviews', id), { status });
}
