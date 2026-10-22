/**
 * topicPreview — 주제운 결제 전 미리 보기 (2026-10-23, 1.6.3 P1-6)
 *
 * 배경: 주제운 입력 화면에는 사람 고르기와 '분석하기 N운' 버튼뿐이라 무엇을 받는지 보이지 않았다(점검 5-5, 7-3).
 *   서버 확정 계산 두 가지를 버튼 위에 보여 준다. AI 호출 0, 원가 0.
 *   ① 짚을 해: topicHookPick — 유료 풀이 첫 장이 'N년 무렵' 질문으로 여는 바로 그 해(claudeTopic hookLine 과 같은 계산)
 *   ② 앞으로 가장 좋은 달: topicBestMonth — claudeTopic 이 같은 달을 '가장 좋은 달'로 꼽게 프롬프트에 넣는다.
 *      재회운은 재회 확정표(reunionPlan)를 상대 정보 없이 계산한 값이라, 상대 생일을 넣고 열면 달라질 수 있다 → noPartnerOnly 로 알려 화면이 숨긴다.
 *
 * - 인증 필수(익명 포함). uid 하루 30회 상한(genQuota 장부, 장부 실패는 허용). 화면은 실패하면 칸을 숨기고 예전처럼 동작한다.
 * - 입력 sajuData 는 필요한 칸만 골라 새로 만든다(기둥 간지, 태어난 해와 성별, 용신 희신 기신). 다른 값은 읽지도 남기지도 않는다.
 * - 응답 v1: { ok, v, topic, hook: { y, gz, place } | null, month: { y, m, noPartnerOnly } | null }
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createHash } from 'crypto';
import { kstNow, kstNowDate } from '../utils/kstTime';
import { topicHookPick, topicBestMonth } from '../ai/sajuFacts';

const TOPICS = new Set(['love', 'reunion', 'marriage', 'wealth', 'exam', 'business', 'health', 'move', 'study', 'career']);
const ALIAS: Record<string, string> = { moving: 'move' };
const DAILY_LIMIT = 30;
const GAN = '甲乙丙丁戊己庚辛壬癸';
const JI = '子丑寅卯辰巳午未申酉戌亥';
const OH = new Set(['목', '화', '토', '금', '수']);

/** 짚을 해에 움직인 자리 — topicHookPick 의 이유 문장으로 고른다 (주제와 안 맞으면 '타고난 자리') */
function hookPlace(topicId: string, why: string): string {
  if (why === '원국 자리를 크게 건드린 해') return '타고난 자리';
  if (/생활 기반 자리/.test(why)) return '생활 기반 자리';
  switch (topicId) {
    case 'love': case 'marriage': case 'reunion': return '인연 자리';
    case 'wealth': case 'business': return '돈이 들고 나는 자리';
    case 'career': case 'exam': return '일과 직장 자리';
    case 'study': return '공부 자리';
    case 'health': return '몸 자리';
    case 'move': return '사는 자리';
    default: return '타고난 자리';
  }
}

/** 클라가 보낸 사주에서 계산에 쓰는 칸만 골라 새로 만든다. 모자라면 null */
function pickSaju(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;
  const ps: any[] = Array.isArray(raw.pillars) ? raw.pillars.slice(0, 4) : [];
  const pillars = ps.map((x) => {
    const g = String(x?.천간 || ''); const j = String(x?.지지 || '');
    const ok = g.length === 1 && j.length === 1 && GAN.includes(g) && JI.includes(j) && x?.available !== false;
    return ok ? { 천간: g, 지지: j, available: true } : { 천간: '', 지지: '', available: false };
  });
  if (pillars.length < 3 || !pillars[2].천간 || !pillars[0].지지) return null;
  const by = Math.floor(Number(raw?.input?.birthYear));
  if (!(by >= 1900 && by <= 2100)) return null;
  const bm = Math.floor(Number(raw?.input?.birthMonth)) || 0;
  const bd = Math.floor(Number(raw?.input?.birthDay)) || 0;
  const gender = raw?.input?.gender === 'male' ? 'male' : 'female';
  const ma = raw?.myeongriAnalysis || {};
  const oh = (v: unknown) => (typeof v === 'string' && OH.has(v) ? v : undefined);
  return {
    pillars,
    input: { birthYear: by, birthMonth: bm >= 1 && bm <= 12 ? bm : 0, birthDay: bd >= 1 && bd <= 31 ? bd : 0, gender },
    myeongriAnalysis: { 용신: oh(ma.용신), 희신: oh(ma.희신), 기신: oh(ma.기신) },
  };
}

/** uid 하루 상한. true = 허용. 장부 실패(Firestore 장애)는 허용 */
async function underLimit(uid: string): Promise<boolean> {
  const n = kstNow();
  const day = `${n.year}${String(n.month).padStart(2, '0')}${String(n.day).padStart(2, '0')}`;
  const db = admin.firestore();
  const ref = db.doc(`genQuota/${day}_tp_${createHash('sha256').update(uid).digest('hex').slice(0, 24)}`);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const c = Number(snap.get('topicPreview') || 0);
      if (c >= DAILY_LIMIT) return false;
      tx.set(ref, {
        topicPreview: admin.firestore.FieldValue.increment(1),
        expireAt: admin.firestore.Timestamp.fromMillis(Date.now() + 3 * 24 * 3600 * 1000),
      }, { merge: true });
      return true;
    });
  } catch (e: any) {
    console.warn('[topicPreview] 상한 장부 실패, 허용:', e?.message);
    return true;
  }
}

export const topicPreview = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    const raw = String(request.data?.topicId || '').trim();
    const topicId = ALIAS[raw] || raw;
    if (!TOPICS.has(topicId)) throw new HttpsError('invalid-argument', 'topicId');
    const sajuData = pickSaju(request.data?.sajuData);
    if (!sajuData) throw new HttpsError('invalid-argument', 'sajuData');
    if (!(await underLimit(uid))) throw new HttpsError('resource-exhausted', '오늘은 더 볼 수 없어요');

    const now = kstNowDate();
    const h = topicHookPick(sajuData, now, topicId);
    const bm = topicBestMonth(sajuData, now, topicId);
    return {
      ok: true,
      v: 1,
      topic: topicId,
      hook: h ? { y: h.y, gz: h.gz, place: hookPlace(topicId, h.why) } : null,
      month: bm ? { y: bm.y, m: bm.m, noPartnerOnly: topicId === 'reunion' } : null,
    };
  },
);
