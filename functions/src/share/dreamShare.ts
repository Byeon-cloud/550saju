/**
 * 꿈해몽 보내기 (2026-10-17) — 오너: 카톡으로 꿈 풀이를 공유했는데 친구가 '안 보이는데 뭐래?'
 *
 *   꿈 결과도 보낸 사람 기기에만 있어서 받은 사람은 빈 초대 화면만 봤다. 궁합 보내기(compatShare.ts)와 같은 방식으로
 *   받는 사람에게 보여 줄 만큼만 남긴다: 보낸 사람 이름, 꿈 갈래, 꿈 내용 앞부분(80자), 풀이 제목, 한 줄 판정,
 *   첫 장 풀이 한 문단, 상징 셋. 사주와 엮은 잠긴 풀이와 생일은 남기지 않는다.
 *   dreamShares/{id} 는 id 를 아는 사람만 읽는다(규칙: get 만). 120일 뒤 cleanupCompatShares 가 같이 지우고, 탈퇴하면 purgeUser 가 지운다.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomBytes } from 'crypto';

const DAILY_LIMIT = 30;
const KEEP_DAYS = 120;
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
function clean(v: unknown, max: number): string {
  return String(v ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function newId(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = randomBytes(14);
  let s = '';
  for (let i = 0; i < 14; i++) s += A[b[i] % A.length];
  return s;
}

export const createDreamShare = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const d = (request.data || {}) as Record<string, any>;
    const title = clean(d.title, 60);
    const narrative = clean(d.narrative, 320);
    if (!title && !narrative) throw new HttpsError('invalid-argument', '보낼 풀이가 없어요');
    const symbols = Array.isArray(d.symbols)
      ? d.symbols.slice(0, 3).map((s: any) => ({ k: clean(s?.k, 16), m: clean(s?.m, 140) })).filter((s: any) => s.k && s.m)
      : [];
    const db = admin.firestore();
    const limRef = db.doc(`users/${uid}/shareLog/${kstDay()}`);
    await db.runTransaction(async (tx) => {
      const s = await tx.get(limRef);
      const n = Number(s.data()?.dream || 0);
      if (n >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', '오늘은 더 보낼 수 없어요. 내일 다시 보내 주세요');
      tx.set(limRef, { dream: n + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
    const id = newId();
    await db.doc(`dreamShares/${id}`).set({
      uid,
      v: 1,
      name: clean(d.name, 12),
      cat: clean(d.cat, 20),
      dream: clean(d.dream, 80),
      title,
      quote: clean(d.quote, 140),
      narrative,
      symbols,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + KEEP_DAYS * 864e5),
    });
    return { id };
  },
);
