/**
 * purgeUserData — 한 사람의 개인정보를 지우고 결제 기록만 남긴다 (2026-10-14 신설)
 *
 * 근거: 개인정보보호법 제21조(지체 없이 파기) + 전자상거래법(결제 기록 5년 보존).
 *   웹 회원탈퇴(deleteAccount)와 토스 탈퇴 콜백 5일 뒤 파기(purgeWithdrawnUsers)가 같은 함수를 쓴다.
 *
 * 지우는 것
 *   1. users/{uid} 아래 하위 컬렉션 전부 (payments 만 남김) — 목록을 코드에 박지 않고 실제 존재하는
 *      컬렉션을 읽어 지운다. 예전 고정 목록은 state(사주원국 미러, 잔액, 삭제 장부)를 빠뜨렸다.
 *   2. 최상위 reports 중 uid 가 같은 문서 (generateReport 저장분)
 *   3. 최상위 progress 중 uid 가 같은 문서 (점진 표시용 풀이 조각)
 *   4. devices/{deviceId}.uids, anonKeys/{hash}.uids 에서 이 uid 연결 — 기기 여권이 지운 계정을
 *      기증자로 다시 잇지 않게 한다.
 *   5. users/{uid} 문서는 통째로 덮어써 결제 집계와 상태 표식만 남긴다 (이름, 생일, 성별, 토스 키 제거).
 *   6. Firebase Auth 계정
 *
 * 남기는 것: users/{uid}/payments, 최상위 iapOrders, compensations (돈이 오간 기록).
 * 멱등: 몇 번을 다시 돌려도 에러 없이 같은 결과. 각 단계 실패는 기록만 하고 다음 단계로 간다.
 */
import * as admin from 'firebase-admin';

/** 결제 기록이라 남기는 하위 컬렉션 */
const KEEP_SUBCOLLECTIONS = new Set(['payments']);

/** 덮어쓴 users 문서에 남길 필드 (돈과 상태 표식만) */
const KEEP_USER_FIELDS = [
  'provider',
  'createdAt',
  'totalCharged',
  'totalSpent',
  'status',
  'disconnectReferrer',
  'disconnectedAt',
  'deletedAt',
] as const;

export interface PurgeResult {
  uid: string;
  subcollections: number;
  topReports: number;
  progress: number;
  auth: 'deleted' | 'missing' | 'failed';
  errors: string[];
}

async function deleteQueryInBatches(q: FirebaseFirestore.Query): Promise<number> {
  const db = admin.firestore();
  let total = 0;
  // 한 번에 400건씩, 남은 게 없을 때까지
  for (let round = 0; round < 50; round++) {
    const snap = await q.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  return total;
}

export async function purgeUserData(uid: string, reason: string): Promise<PurgeResult> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const result: PurgeResult = { uid, subcollections: 0, topReports: 0, progress: 0, auth: 'failed', errors: [] };

  // 1) 하위 컬렉션 (payments 제외)
  try {
    const cols = await userRef.listCollections();
    for (const c of cols) {
      if (KEEP_SUBCOLLECTIONS.has(c.id)) continue;
      try {
        await db.recursiveDelete(c);
        result.subcollections++;
      } catch (e: any) {
        result.errors.push(`sub:${c.id}:${e?.message || e}`);
      }
    }
  } catch (e: any) {
    result.errors.push(`listCollections:${e?.message || e}`);
  }

  // 2) 최상위 reports
  try {
    result.topReports = await deleteQueryInBatches(db.collection('reports').where('uid', '==', uid));
  } catch (e: any) {
    result.errors.push(`reports:${e?.message || e}`);
  }

  // 3) 최상위 progress
  try {
    result.progress = await deleteQueryInBatches(db.collection('progress').where('uid', '==', uid));
  } catch (e: any) {
    result.errors.push(`progress:${e?.message || e}`);
  }

  // 4) 결과지 메일 주소와 광고 수신 동의 (2026-10-16 PDF 메일 보내기)
  try {
    await db.doc(`emailLeads/${uid}`).delete();
    await db.doc(`dailyMailSubs/${uid}`).delete(); // 2026-10-17 아침 일주 운세 메일
  } catch (e: any) {
    result.errors.push(`emailLeads:${e?.message || e}`);
  }

  // 4-1) 보낸 궁합 링크 (2026-10-17 궁합 보내기, share/compatShare.ts)
  try {
    const { deleteCompatSharesOf } = await import('../share/compatShare');
    await deleteCompatSharesOf(db, uid);
  } catch (e: any) {
    result.errors.push(`compatShares:${e?.message || e}`);
  }

  // 5) users 문서 덮어쓰기 — 남길 필드만 골라서 set (merge 없이)
  try {
    const snap = await userRef.get();
    const prev = snap.exists ? (snap.data() as Record<string, unknown>) : {};
    const kept: Record<string, unknown> = {};
    for (const k of KEEP_USER_FIELDS) {
      if (prev[k] !== undefined) kept[k] = prev[k];
    }
    await userRef.set({
      ...kept,
      deletedAt: kept.deletedAt ?? admin.firestore.FieldValue.serverTimestamp(),
      purgedAt: admin.firestore.FieldValue.serverTimestamp(),
      purgeReason: reason,
    });
  } catch (e: any) {
    result.errors.push(`userDoc:${e?.message || e}`);
  }

  // 6) Auth 계정 (마지막)
  try {
    await admin.auth().deleteUser(uid);
    result.auth = 'deleted';
  } catch (e: any) {
    if (e?.code === 'auth/user-not-found') {
      result.auth = 'missing';
    } else {
      result.errors.push(`auth:${e?.message || e}`);
    }
  }

  return result;
}

/**
 * 4) 기기 여권과 익명키 등록부에서 지운 uid 들의 연결을 뗀다.
 *   등록부는 uid 로 바로 찾을 수 없어 uids 필드만 골라 한 번 훑는다. 여러 명을 지울 때 한 번만 부른다.
 */
export async function unlinkPurgedUids(uids: string[]): Promise<number> {
  if (uids.length === 0) return 0;
  const db = admin.firestore();
  const target = new Set(uids);
  let unlinked = 0;
  for (const col of ['devices', 'anonKeys']) {
    try {
      const snap = await db.collection(col).select('uids').get();
      let batch = db.batch();
      let pending = 0;
      for (const d of snap.docs) {
        const m = ((d.data() as any)?.uids || {}) as Record<string, unknown>;
        const hits = Object.keys(m).filter((k) => target.has(k));
        if (hits.length === 0) continue;
        // 키 모양과 상관없이 안전하게 FieldPath 로 지운다
        const FP = admin.firestore.FieldPath;
        const DEL = admin.firestore.FieldValue.delete();
        const [first, ...rest] = hits;
        batch.update(d.ref, new FP('uids', first), DEL, ...rest.flatMap((h) => [new FP('uids', h), DEL]));
        unlinked += hits.length;
        pending++;
        if (pending >= 400) { await batch.commit(); batch = db.batch(); pending = 0; }
      }
      if (pending > 0) await batch.commit();
    } catch (e: any) {
      console.warn(`[purge] ${col} 연결 해제 경고:`, e?.message || e);
    }
  }
  return unlinked;
}
