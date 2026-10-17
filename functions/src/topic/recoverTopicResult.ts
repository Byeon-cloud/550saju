/**
 * recoverTopicResult — 생성 중 앱 종료로 클라가 SSE 결과를 못 받은 경우, 서버에 저장된
 *   토픽 결과를 끌어와 복원 (재구매 0). 2026-06-17
 *
 * 배경: generateTopicAnalysisStream 은 결과를 reports 컬렉션에 저장하지만 doc id 가 랜덤이라
 *   클라가 못 찾음. 유저가 생성 도중 앱을 닫으면 onDone 미수신 → 로컬 보관함 저장 누락 →
 *   "신청했는데 안 들어와요" CS. (운은 reconcilePendingSpends 가 5분 후 자동환불.)
 *   → 토픽 재진입 시 미해결 pending 이 있으면 이 함수로 서버 결과를 복원.
 *
 * 보안: 본인(uid) 의 토픽 결과만. composite index 회피 위해 uid 단일 where + JS 필터.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const recoverTopicResult = onCall(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    const topicId = String(request.data?.topicId || '').trim();
    if (!topicId || !/^[a-z]+$/.test(topicId)) return { found: false };

    const db = admin.firestore();
    // composite index 없이 — uid 단일 where + limit, 정렬/필터는 코드에서.
    const snap = await db.collection('reports').where('uid', '==', uid).limit(100).get();

    let best: FirebaseFirestore.DocumentData | null = null;
    let bestTs = 0;
    let bestId = '';
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.type !== 'topic' || d.topicId !== topicId) return;
      const ts = d.generatedAt?.toDate?.()?.getTime?.() ?? 0;
      if (ts > bestTs) { bestTs = ts; best = d; bestId = doc.id; }
    });

    // 1시간 이내 결과만 복원 (오래된 건 재방문 의도가 모호 → 미복원)
    if (!best || Date.now() - bestTs > 60 * 60 * 1000) return { found: false };

    // 메타 제거 → 순수 content (클라가 보관함/캐시에 저장)
    const { uid: _u, type: _t, topicId: _ti, inputMeta: _im, aiModel: _am, generatedAt: _g, owner: _ow, ...content } = best as Record<string, unknown>;
    return { found: true, reportId: bestId, content };
  },
);
