/**
 * mergeAnonIntoToss — 익명 계정 데이터를 토스 안정 uid 로 병합 (2026-06-22 · 엔드게임 P1)
 *
 * 배경: 앱 기본은 익명 로그인이라 uid 가 기기 저장소(IndexedDB)에 묶임. 토스 웹뷰가 저장소를
 *   통째로 비우면 새 익명 uid 발급 → 과거 백업(users/{oldUid}/reports)이 새 uid 로 조회 안 돼
 *   "결제했는데 보관함 사라짐" 자동복구 불가. 토스 SSO(toss_{userKey})는 토스 계정에 묶여
 *   저장소와 무관하게 uid 가 고정 → 이 함수가 익명 시절 리포트를 토스 uid 로 옮겨 영구 연결한다.
 *
 * 안전 설계:
 *   - 리포트(보관함)만 병합. 잔액(운)은 손대지 않음 — localStorage 가 uid 독립이라 같은 기기선
 *     보존되고, 서버 잔액 합산은 spend 로컬전용 구조에서 과복원/이중지급 리스크라 범위에서 제외.
 *     (잔액 cross-device 는 spend 서버화 완료 후 별도 처리)
 *   - 소유 증명: 익명 ID 토큰(verifyIdToken)으로 '호출자가 실제 그 익명 계정이었음'을 검증 →
 *     임의 익명 uid 의 보관함 탈취(프라이버시) 차단.
 *   - 멱등: accountMerges/{anonUid} 원장 + 'toss 에 없는 리포트만 복사' → 재실행해도 중복 0.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const mergeAnonIntoToss = onCall(
  { timeoutSeconds: 60, memory: '256MiB', cors: true },
  async (request) => {
    const tossUid = request.auth?.uid;
    if (!tossUid) throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    // 토스 계정으로 로그인된 상태에서만 (익명→익명 머지 방지)
    if (!tossUid.startsWith('toss_')) {
      throw new HttpsError('permission-denied', '토스 로그인 상태에서만 병합할 수 있어요');
    }
    const anonIdToken: unknown = request.data?.anonIdToken;
    if (!anonIdToken || typeof anonIdToken !== 'string') {
      throw new HttpsError('invalid-argument', 'anonIdToken 이 필요합니다');
    }

    // 1) 소유 증명 — 익명 ID 토큰 검증 (호출자가 실제 그 익명 계정이었는지)
    //   checkRevoked:true — 폐기/로그아웃된 토큰 재사용 창(자연만료 ~1h) 축소 (하드닝 2026-06-22).
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(anonIdToken, true);
    } catch {
      throw new HttpsError('unauthenticated', '익명 토큰 검증에 실패했어요');
    }
    const anonUid = decoded.uid;
    if (decoded.firebase?.sign_in_provider !== 'anonymous') {
      throw new HttpsError('permission-denied', '익명 계정만 병합 대상이에요');
    }
    if (anonUid === tossUid) return { merged: false, copied: 0, reason: 'same-uid' };

    const db = admin.firestore();

    // 2) 원장 'atomic 선점' — create() 는 문서가 이미 있으면 실패(원자적) → 같은 anonUid 를 서로 다른
    //   두 toss 가 동시 머지하는 경합에서 '먼저 create 성공한 쪽'만 진행 → 양쪽 동시 복사 차단 (하드닝).
    const mergeRef = db.collection('accountMerges').doc(anonUid);
    try {
      await mergeRef.create({
        mergedInto: tossUid,
        anonUid,
        status: 'copying',
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch {
      // 이미 누군가 선점함 — 같은 toss 면 멱등 재시도 허용, 다른 toss 면 거부(탈취/이중 병합 방지).
      const existing = await mergeRef.get();
      const into = existing.data()?.mergedInto;
      if (into && into !== tossUid) {
        throw new HttpsError('already-exists', '이미 다른 계정에 연결된 데이터예요');
      }
      // 같은 toss uid 로 재호출 → 멱등 (아래 '없는 것만 복사'가 자연히 누락분만 처리)
    }

    // 3) 리포트 복사 — toss 에 없는 것만 (멱등). 잔액·결제는 손대지 않음.
    let copied = 0;
    try {
      const anonReports = await db.collection(`users/${anonUid}/reports`).get();
      let batch = db.batch();
      let pending = 0;
      for (const d of anonReports.docs) {
        const targetRef = db.doc(`users/${tossUid}/reports/${d.id}`);
        const existing = await targetRef.get();
        if (!existing.exists) {
          batch.set(targetRef, d.data(), { merge: true });
          copied++;
          pending++;
          if (pending >= 400) {
            await batch.commit();
            batch = db.batch();
            pending = 0;
          }
        }
      }
      if (pending > 0) await batch.commit();
    } catch (e: any) {
      console.warn(`[mergeAnonIntoToss] 리포트 복사 일부 실패 anon=${anonUid} → ${tossUid}: ${e?.message || e}`);
    }

    // 4) 원장 완료 기록 (선점 doc 갱신)
    await mergeRef.set({
      mergedInto: tossUid,
      anonUid,
      copied,
      status: 'done',
      doneAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[mergeAnonIntoToss] anon=${anonUid} → ${tossUid} · 리포트 ${copied}건 복사`);
    return { merged: true, copied };
  }
);
