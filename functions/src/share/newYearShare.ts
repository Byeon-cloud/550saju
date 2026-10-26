/**
 * 신년운세 미리 보기 보내기 (2026-10-18) — 무료 미리 보기를 가족과 친구에게 카톡으로 보낸다.
 *
 *   미리 보기는 보낸 사람 기기에서 사주로 계산해서(services/saju/newYearPreview.ts) 받는 사람 기기에는 없다.
 *   궁합 보내기(compatShare.ts)와 같은 방식으로 받는 사람에게 보여 줄 만큼만 남긴다: 이름, 대상 연도와 간지,
 *   그 해 판정, 천간과 지지의 오행과 역할, 좋은 달, 조심할 달, 꼭 기억할 날 첫 날과 개수. 생일과 사주 여덟 글자는 남기지 않는다.
 *   newYearShares/{id} 는 id 를 아는 사람만 읽는다(규칙: get 만). 120일 뒤 cleanupCompatShares 가 같이 지우고, 탈퇴하면 purgeUser 가 지운다.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomBytes } from 'crypto';

const DAILY_LIMIT = 30;
const KEEP_DAYS = 120;
const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const OH = ['목', '화', '토', '금', '수'];
const ROLES = ['용신', '희신', '기신', '중립'];
const VERDICTS = ['도움 기운이 강한 해', '도움과 부담이 섞인 해', '도움 기운이 들어오는 해', '부담 기운이 강한 해', '무난한 해'];
const GOOD_LABELS = ['도움 기운이 강한 달', '도움 기운이 들어오는 달'];
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

function clean(v: unknown, max: number): string {
  return String(v ?? '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}
function newId(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = randomBytes(14);
  let s = '';
  for (let i = 0; i < 14; i++) s += A[b[i] % A.length];
  return s;
}
const monthList = (v: unknown): number[] =>
  Array.isArray(v) ? [...new Set(v.map((m) => Math.round(Number(m))).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b).slice(0, 12) : [];
const pick = (v: unknown, list: string[]): string => (typeof v === 'string' && list.includes(v) ? v : '');

export const createNewYearShare = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const d = (request.data || {}) as Record<string, any>;
    const y = Math.round(Number(d.y));
    const gz = typeof d.gz === 'string' && d.gz.length === 2 && GAN.includes(d.gz[0]) && ZHI.includes(d.gz[1]) ? d.gz : '';
    const v = pick(d.verdict, VERDICTS);
    if (!(y >= 2026 && y <= 2030) || !gz || !v) throw new HttpsError('invalid-argument', '미리 보기가 없어요');
    const keyM = Math.round(Number(d.km)); const keyD = Math.round(Number(d.kd));

    const db = admin.firestore();
    const limRef = db.doc(`users/${uid}/shareLog/${kstDay()}`);
    await db.runTransaction(async (tx) => {
      const s = await tx.get(limRef);
      const n = Number(s.data()?.newyear || 0);
      if (n >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', '오늘은 더 보낼 수 없어요. 내일 다시 보내 주세요');
      tx.set(limRef, { newyear: n + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });

    const id = newId();
    await db.doc(`newYearShares/${id}`).set({
      uid,
      v: 1,
      name: clean(d.name, 12), // 2026-10-27 기본값 '보낸 분'을 저장하지 않는다(받는 화면에 '보낸 분 님의 …'로 보였다)
      y,
      gz,
      verdict: v,
      g: pick(d.g, OH),
      b: pick(d.b, OH),
      r1: pick(d.r1, ROLES),
      r2: pick(d.r2, ROLES),
      good: monthList(d.good),
      goodLabel: pick(d.goodLabel, GOOD_LABELS) || GOOD_LABELS[0],
      hard: monthList(d.hard),
      km: keyM >= 1 && keyM <= 12 ? keyM : 0,
      kd: keyD >= 1 && keyD <= 31 ? keyD : 0,
      kn: Math.max(0, Math.min(12, Math.round(Number(d.kn) || 0))),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + KEEP_DAYS * 864e5),
    });
    return { id };
  },
);
