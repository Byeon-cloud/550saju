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
    // 🚨 교차 네임스페이스 dedupe (2026-08-13 · 이중저장 진앙 fix)
    //   백업본(users/{uid}/reports)은 클라 base36 id, 생성원본(top-level reports)은 auto-id 라
    //   doc.id 만으로는 같은 리포트를 절대 중복 판정 못 한다 → 같은 종합사주가 2건으로 복원되고,
    //   클라가 auto-id 사본을 다시 백업해 users 하위에 영구 잉여 문서가 생겼다 (74유저·113건 실측).
    //   지문 = contentType + 분단위 + 이름. 재생성(관측상 2분+ 간격)은 분이 갈려 안전하게 살아남고,
    //   이름까지 봐서 같은 분에 생성된 '다른 사람' 리포트를 오탐으로 버리지 않는다.
    const fingerprints = new Set<string>();
    const fpOf = (contentType: string | null, iso: string | null, name: string | null): string | null => {
      if (!iso) return null;
      return `${contentType ?? 'report'}@${String(iso).slice(0, 16)}@${name ?? ''}`; // YYYY-MM-DDTHH:MM@이름
    };

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
          // 2026-10-17 궁합 상대방과 관계 (예전엔 빠져서 복원한 궁합의 상대 칸에 내 사주가 들어갔다)
          ...(typeof d.partnerJson === 'string' ? { partnerJson: d.partnerJson } : {}),
          ...(typeof d.relation === 'string' ? { relation: d.relation } : {}),
          ...(typeof d.spentUn === 'number' ? { spentUn: d.spentUn } : {}),
        });
        seen.add(doc.id);
        const fp = fpOf(d.contentType ?? null, typeof d.createdAt === 'string' ? d.createdAt : tsToIso(d.createdAt), d.name ?? null);
        if (fp) fingerprints.add(fp);
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
            // 지문 dedupe — 같은 리포트의 base36 백업본이 이미 나갔으면 auto-id 원본은 보강하지 않는다.
            //   이름+분단위 ±1분(클라 저장 시각과 서버 생성 시각이 수 초 어긋남). rec 파싱 후 이름 확보.
            const nm = rec.sajuData?.input?.name ?? '복원된 분석';
            const t = new Date(createdAt as string).getTime();
            const fps = [fpOf('report', createdAt, nm), fpOf('report', new Date(t - 60_000).toISOString(), nm), fpOf('report', new Date(t + 60_000).toISOString(), nm)];
            if (fps.some((f) => f && fingerprints.has(f))) return;
            const ai = d.type === 'premium' ? { ...(rec.content as object), tier: 'premium' } : rec.content;
            out.push({
              id: doc.id, name: rec.sajuData?.input?.name ?? '복원된 분석', input: rec.sajuData?.input ?? null,
              sajuData: rec.sajuData ?? null, createdAt, contentType: 'report', type: 'paid', profileId: null, aiResult: ai,
            });
            seen.add(doc.id);
          } catch { /* noop */ }
        } else if (d.type === 'topic' && d.topicId) {
          // topic — { topicId, ...result } 스프레드. (sajuData 는 원본에 없어 null — 내용은 살아남)
          const { uid: _u, type: _t, topicId: _ti, generatedAt: _g, inputMeta: _im, aiModel: _am, owner: _ow, ...content } = d as Record<string, unknown>;
          const owner = (d.owner && typeof d.owner === 'object') ? d.owner as Record<string, unknown> : null; // 2026-10-17~ 생성분만 있음
          out.push({
            id: doc.id, name: (owner?.name as string) || '복원된 분석', input: owner, sajuData: null, createdAt,
            contentType: 'topic', type: 'paid', profileId: null, aiResult: { topicId: d.topicId, ...content },
          });
          seen.add(doc.id);
        }
      });
    } catch { /* noop */ }

    return { reports: out };
  },
);
