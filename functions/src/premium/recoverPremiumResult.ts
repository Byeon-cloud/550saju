/**
 * recoverPremiumResult — 종합사주(premium/basic) 생성 중 앱 종료로 클라가 결과를 못 받은 경우,
 *   서버에 저장된 결과를 끌어와 복원 (재생성 0). 2026-06-18
 *
 * 배경: generatePremiumReportStream / generateReportStream / generateReport 는 결과를 reports
 *   컬렉션에 저장하지만 (a) doc id 가 랜덤이고 (b) content 는 원래 메타만 저장(색인 한계)이라
 *   클라가 못 찾았다. 2026-06-18 부터 'recovery' 필드(색인예외)에 {content, sajuData} 를 별도
 *   best-effort 저장 → 본 함수가 그걸 끌어와 복원. (운은 reconcilePendingSpends 가 5분 후 자동환불.)
 *
 * 보안: 본인(uid) 의 결과만. composite index 회피 위해 uid 단일 where + JS 필터/정렬.
 *   recovery 필드가 없으면(=구버전·저장실패) found:false → 클라는 기존 자동환불 흐름 유지.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const recoverPremiumResult = onCall(
  { timeoutSeconds: 20, memory: '256MiB', minInstances: 0, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다');

    const db = admin.firestore();
    // composite index 없이 — uid 단일 where + limit, 정렬/필터는 코드에서.
    const snap = await db.collection('reports').where('uid', '==', uid).limit(100).get();

    let best: FirebaseFirestore.DocumentData | null = null;
    let bestTs = 0;
    let bestId = '';
    snap.forEach((doc) => {
      const d = doc.data();
      // 종합사주(premium/basic) + recovery 블롭 있는 것만
      if (d.type !== 'premium' && d.type !== 'basic') return;
      if (!d.recovery || typeof d.recovery !== 'string') return;
      const ts = d.generatedAt?.toDate?.()?.getTime?.() ?? 0;
      if (ts > bestTs) { bestTs = ts; best = d; bestId = doc.id; }
    });

    // 1시간 이내 결과만 복원 (오래된 건 재방문 의도 모호 → 미복원)
    if (!best || Date.now() - bestTs > 60 * 60 * 1000) return { found: false };

    let parsed: { content?: unknown; sajuData?: unknown } | null = null;
    try { parsed = JSON.parse((best as { recovery: string }).recovery); } catch { return { found: false }; }
    if (!parsed || !parsed.content) return { found: false };

    return {
      found: true,
      reportId: bestId,
      reportType: (best as { type?: string }).type === 'premium' ? 'premium' : 'basic',
      content: parsed.content,
      sajuData: parsed.sajuData ?? null,
    };
  },
);
