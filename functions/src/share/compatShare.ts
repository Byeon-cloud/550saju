/**
 * 궁합 보내기 (2026-10-17, 시험 E7)
 *
 *   궁합 결과는 보낸 사람 기기에만 저장돼 있어서, 공유 링크를 받은 사람은 '누군가 공유했어요'와 흐린 상자만 봤다.
 *   보낼 때 받는 사람에게 보여 줄 만큼만 서버에 작게 남긴다: 두 사람이 입력한 이름, 관계, 점수, 관계 유형,
 *   총평 첫 문장, 항목별 점수, 잘 맞는 점 한 줄, 두 사람의 띠. 생일과 사주 여덟 글자, 조심할 점과 조언은 남기지 않는다.
 *
 *   compatShares/{id} 는 id 를 아는 사람만 읽는다(규칙: get 만 허용, list 와 쓰기 금지). 120일 뒤 cleanupCompatShares 가 지우고,
 *   탈퇴하면 purgeUser 가 그 사람이 보낸 것을 지운다. 한 계정이 하루에 만들 수 있는 링크는 30개.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { randomBytes } from 'crypto';

const DAILY_LIMIT = 30;
const KEEP_DAYS = 120;
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/** HTML 태그와 줄바꿈을 걷고 길이를 자른다 */
function clean(v: unknown, max: number): string {
  return String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
function firstSentence(s: string, max: number): string {
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return clean(m ? m[0] : s, max);
}
function newId(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = randomBytes(14);
  let s = '';
  for (let i = 0; i < 14; i++) s += A[b[i] % A.length];
  return s;
}

export const createCompatShare = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const d = (request.data || {}) as Record<string, any>;
    const score = Math.round(Number(d.score));
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new HttpsError('invalid-argument', '궁합 점수가 없어요');
    const n1 = clean(d.n1, 12) || '나';
    const n2 = clean(d.n2, 12) || '상대';
    const cats = Array.isArray(d.cats)
      ? d.cats.slice(0, 6).map((c: any) => ({ n: clean(c?.n, 10), s: Math.max(0, Math.min(100, Math.round(Number(c?.s) || 0))) })).filter((c: any) => c.n)
      : [];
    const tti = (z: unknown) => (typeof z === 'string' && z.length === 1 && ZHI.includes(z) ? z : '');

    const db = admin.firestore();
    const limRef = db.doc(`users/${uid}/shareLog/${kstDay()}`);
    await db.runTransaction(async (tx) => {
      const s = await tx.get(limRef);
      const n = Number(s.data()?.compat || 0);
      if (n >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', '오늘은 더 보낼 수 없어요. 내일 다시 보내 주세요');
      tx.set(limRef, { compat: n + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });

    const id = newId();
    await db.doc(`compatShares/${id}`).set({
      uid,
      v: 1,
      n1,
      n2,
      rel: clean(d.rel, 10),
      score,
      rtype: clean(d.rtype, 24),
      head: firstSentence(clean(d.summary, 400), 140),
      cats,
      good: clean(d.good, 110),
      tti1: tti(d.tti1),
      tti2: tti(d.tti2),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + KEEP_DAYS * 864e5),
    });
    return { id };
  },
);

/** 탈퇴 파기용 — 그 사람이 보낸 궁합 링크 전부 */
export async function deleteCompatSharesOf(db: admin.firestore.Firestore, uid: string): Promise<number> {
  let n = 0;
  for (const col of ['compatShares', 'dreamShares']) { // 2026-10-17 꿈해몽 보내기(dreamShare.ts)도 같이
    for (;;) {
      const snap = await db.collection(col).where('uid', '==', uid).limit(300).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      n += snap.size;
    }
  }
  return n;
}

/** 120일 지난 궁합 링크 정리 (매일 04:40 KST) */
export const cleanupCompatShares = onSchedule(
  { schedule: '40 4 * * *', timeZone: 'Asia/Seoul', timeoutSeconds: 300, memory: '256MiB', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    let n = 0;
    for (const col of ['compatShares', 'dreamShares']) {
      for (let round = 0; round < 20; round++) {
        const snap = await db.collection(col).where('expireAt', '<', admin.firestore.Timestamp.now()).limit(300).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        n += snap.size;
      }
    }
    console.log('[cleanupCompatShares] 지움', n);
  },
);
