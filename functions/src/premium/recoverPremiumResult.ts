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
 *
 * 2026-10-25 — 엉뚱한 결과를 돌려주던 것 수리. 예전엔 한 시간 안의 가장 새 결과 하나만 돌려줘서, 엄마 것을 받은 뒤
 *   아빠 것을 사고 앱이 닫히면 아빠 대신 엄마 결과가 다시 저장되고 아빠 몫 운은 환불 장부에서 지워졌다.
 *   요청에 sajuKey(네 기둥 글자와 성별, 클라 localStore.ts premiumSajuKey 와 같은 식)와 maxAgeMs(결제 뒤 지난 시간 + 여유)를
 *   붙이면 그 사주의 그 시간 안 결과만 찾는다. maxAgeMs 는 상대 시간이라 기기 시계가 틀려도 맞다.
 *   응답에 generatedAtMs, ageMs 를 더한다(옛 클라는 읽지 않는다).
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const HOUR_MS = 60 * 60 * 1000;

/** 결과가 어느 사주의 것인지 맞춰 보는 열쇠 — 클라 src/services/storage/localStore.ts premiumSajuKey 와 반드시 같은 식 */
function premiumSajuKey(sajuData: any): string {
  const ps = Array.isArray(sajuData?.pillars) ? sajuData.pillars : [];
  if (!ps.length) return '';
  return ps.map((p: any) => `${p?.position ?? ''}:${p?.천간 ?? ''}${p?.지지 ?? ''}:${p?.available === false ? 0 : 1}`).join('|')
    + `#${sajuData?.input?.gender ?? ''}`;
}

export const recoverPremiumResult = onCall(
  { timeoutSeconds: 20, memory: '256MiB', minInstances: 0, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다');

    const sajuKey = typeof request.data?.sajuKey === 'string' ? request.data.sajuKey.slice(0, 600) : '';
    const maxAgeRaw = Number(request.data?.maxAgeMs);
    // 1시간 이내 결과만 복원 (오래된 건 재방문 의도 모호 → 미복원). maxAgeMs 가 오면 그보다 짧게
    const windowMs = Number.isFinite(maxAgeRaw) && maxAgeRaw > 0 ? Math.min(maxAgeRaw, HOUR_MS) : HOUR_MS;
    const now = Date.now();

    const db = admin.firestore();
    // composite index 없이 — uid 단일 where + limit, 정렬/필터는 코드에서.
    const snap = await db.collection('reports').where('uid', '==', uid).limit(100).get();

    const candidates: Array<{ id: string; ts: number; d: FirebaseFirestore.DocumentData }> = [];
    snap.forEach((doc) => {
      const d = doc.data();
      // 종합사주(premium/basic) + recovery 블롭 있는 것만
      if (d.type !== 'premium' && d.type !== 'basic') return;
      if (!d.recovery || typeof d.recovery !== 'string') return;
      const ts = d.generatedAt?.toDate?.()?.getTime?.() ?? 0;
      if (!ts || now - ts > windowMs) return;
      candidates.push({ id: doc.id, ts, d });
    });
    candidates.sort((a, b) => b.ts - a.ts);

    for (const c of candidates) {
      let parsed: { content?: unknown; sajuData?: any } | null = null;
      try { parsed = JSON.parse(c.d.recovery); } catch { continue; }
      if (!parsed || !parsed.content) continue;
      // 사주 열쇠가 오면 그 사주 결과만 (다른 사람 결과를 이 결제의 결과로 넘기지 않는다)
      if (sajuKey && premiumSajuKey(parsed.sajuData) !== sajuKey) continue;
      return {
        found: true,
        reportId: c.id,
        reportType: c.d.type === 'premium' ? 'premium' : 'basic',
        content: parsed.content,
        sajuData: parsed.sajuData ?? null,
        generatedAtMs: c.ts,
        ageMs: now - c.ts,
      };
    }
    return { found: false };
  },
);
