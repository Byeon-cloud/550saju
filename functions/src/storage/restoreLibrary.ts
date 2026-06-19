/**
 * restoreLibrary — 보관함 서버 복원 (2026-06-19)
 *
 * 배경: 보관함은 기기 localStorage 저장. 토스 웹뷰가 데이터를 비우면 보관함이 사라지고,
 *   기존 firestoreSync 는 내용(aiResult) 없이 메타만 백업해 복원해도 빈 껍데기였음.
 *   → 본 함수가 서버의 두 소스를 모두 긁어 "내용까지" 최대한 복원해 클라에 돌려준다.
 *
 * 소스:
 *   1) users/{uid}/reports — firestoreSync 백업본 (2026-06-19 이후 aiResultJson 에 내용 포함)
 *   2) reports (top-level) — 콘텐츠 생성 시 서버가 저장한 원본
 *        · premium/basic: recovery = JSON({content, sajuData})
 *        · topic: { topicId, ...result } 스프레드
 *
 * 보안: 본인(uid) 것만. content 필드 색인예외라 큰 JSON 도 안전.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

interface RestoredReport {
  id: string;
  name: string;
  input: unknown;
  sajuData: unknown;
  situation?: unknown;
  createdAt: string | null;
  contentType: string | null;
  type: string | null;
  profileId: string | null;
  aiResult: unknown;
}

function tsToIso(g: unknown): string | null {
  try {
    const d = (g as { toDate?: () => Date })?.toDate?.();
    return d ? d.toISOString() : null;
  } catch { return null; }
}

export const restoreLibrary = onCall(
  { timeoutSeconds: 30, memory: '256MiB', minInstances: 0, cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다');

    const db = admin.firestore();
    const out: RestoredReport[] = [];
    const seen = new Set<string>();

    // 1) users/{uid}/reports — 백업본 (메타 + 내용)
    try {
      const subSnap = await db.collection(`users/${uid}/reports`).get();
      subSnap.forEach((doc) => {
        const d = doc.data();
        let aiResult: unknown = null;
        try { if (d.aiResultJson) aiResult = JSON.parse(d.aiResultJson); } catch { /* noop */ }
        if (!aiResult) return; // 내용 없는 옛 백업은 아래 top-level 에서 채움
        out.push({
          id: doc.id, name: d.name ?? '복원된 분석', input: d.input ?? null, sajuData: d.sajuData ?? null,
          situation: d.situation ?? null, createdAt: typeof d.createdAt === 'string' ? d.createdAt : tsToIso(d.createdAt),
          contentType: d.contentType ?? null, type: d.type ?? 'paid', profileId: d.profileId ?? null, aiResult,
        });
        seen.add(doc.id);
      });
    } catch { /* noop */ }

    // 2) top-level reports — 생성 원본 (내용 보유). 백업본에 없는 것만 보강.
    try {
      const topSnap = await db.collection('reports').where('uid', '==', uid).limit(300).get();
      topSnap.forEach((doc) => {
        if (seen.has(doc.id)) return;
        const d = doc.data();
        const createdAt = tsToIso(d.generatedAt) || tsToIso(d.createdAt);
        if (d.recovery) {
          // premium / basic — recovery 블롭에 content + sajuData
          try {
            const rec = JSON.parse(d.recovery) as { content?: unknown; sajuData?: { input?: { name?: string } } };
            if (!rec.content) return;
            const ai = d.type === 'premium' ? { ...(rec.content as object), tier: 'premium' } : rec.content;
            out.push({
              id: doc.id, name: rec.sajuData?.input?.name ?? '복원된 분석', input: rec.sajuData?.input ?? null,
              sajuData: rec.sajuData ?? null, createdAt, contentType: 'report', type: 'paid', profileId: null, aiResult: ai,
            });
            seen.add(doc.id);
          } catch { /* noop */ }
        } else if (d.type === 'topic' && d.topicId) {
          // topic — { topicId, ...result } 스프레드. (sajuData 는 원본에 없어 null — 내용은 살아남)
          const { uid: _u, type: _t, topicId: _ti, generatedAt: _g, inputMeta: _im, aiModel: _am, ...content } = d as Record<string, unknown>;
          out.push({
            id: doc.id, name: '복원된 분석', input: null, sajuData: null, createdAt,
            contentType: 'topic', type: 'paid', profileId: null, aiResult: { topicId: d.topicId, ...content },
          });
          seen.add(doc.id);
        }
      });
    } catch { /* noop */ }

    return { reports: out };
  },
);
