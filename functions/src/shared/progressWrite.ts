/**
 * progressWrite — 점진 로딩 서버측 증분 write (2026-07-01)
 *
 * 🛡️ additive·best-effort 절대원칙:
 *  - 생성 중 그룹이 완성될 때마다 progress/{progressId} 에 그룹 데이터를 merge write.
 *  - 클라(ResultPage/Monthly/Weekly)가 onSnapshot 으로 구독 → 도착 그룹만 펼침/스켈레톤 교체.
 *  - write 실패는 절대 throw 안 함(catch 삼킴) → 머니/전달(callable·SSE 반환·환불) 경로에 영향 0.
 *  - progressId/uid 없으면 즉시 no-op (점진 미사용 호출 안전).
 *  - 기존 reports/{rid} 영구 저장본과 분리된 progress/{id} 컬렉션 (TTL·rules 단순).
 */
import * as admin from 'firebase-admin';

type Db = admin.firestore.Firestore;

/** 그룹 1개 완성 → progress/{id}.groups[groupKey] 에 merge */
export async function writeGroupProgress(
  db: Db,
  progressId: string | undefined,
  uid: string | undefined,
  groupKey: string,
  data: unknown,
): Promise<void> {
  if (!progressId || !uid) return; // 점진 미사용 호출 — no-op
  try {
    await db.collection('progress').doc(progressId).set(
      {
        uid, // rules: 본인만 read
        groups: { [groupKey]: data }, // merge:true → 그룹들 deep-merge 누적
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    // best-effort — 점진 write 실패는 무해(최종 결과는 기존 경로로 전달)
    console.warn('[progress] writeGroupProgress 실패(무해):', (e as { message?: string })?.message);
  }
}

/** 메타(콘텐츠 type + 총 그룹수) 1회 기록 — 클라 진행도 표시용 */
export async function setProgressMeta(
  db: Db,
  progressId: string | undefined,
  uid: string | undefined,
  meta: { type: string; total: number },
): Promise<void> {
  if (!progressId || !uid) return;
  try {
    await db.collection('progress').doc(progressId).set(
      { uid, meta, createdAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (e) {
    console.warn('[progress] setProgressMeta 실패(무해):', (e as { message?: string })?.message);
  }
}
