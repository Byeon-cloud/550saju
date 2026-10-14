/**
 * purgeWithdrawnUsers — 토스 탈퇴 5일 뒤 개인정보 파기 (2026-10-14 신설)
 *
 * disconnectToss 콜백이 탈퇴(WITHDRAWAL_TERMS, WITHDRAWAL_TOSS) 때 users/{uid}.deleteScheduledAt 을
 *   5일 뒤로 찍어 두기만 하고, 그 예약을 실제로 지우는 쪽이 없었다. 매일 새벽 한 번 예약 시각이 지난
 *   사람을 찾아 purgeUserData 로 지운다 (payments 는 5년 보존).
 *
 * 건너뛰는 경우: 다시 로그인해 status 가 disconnected 가 아니게 된 사람, 연결 끊기(UNLINK)만 한 사람.
 * 파기를 마친 users 문서는 deleteScheduledAt 이 없어 다음 날 다시 걸리지 않는다.
 */
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { purgeUserData, unlinkPurgedUids } from './purgeUser';

const WITHDRAWAL_REFERRERS = new Set(['WITHDRAWAL_TERMS', 'WITHDRAWAL_TOSS']);
/** 한 번에 지우는 최대 인원 — 넘치면 다음 날 이어서 */
const MAX_PER_RUN = 100;

export const purgeWithdrawnUsers = onSchedule(
  { schedule: '20 4 * * *', timeZone: 'Asia/Seoul', timeoutSeconds: 540, memory: '512MiB', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collection('users')
      .where('deleteScheduledAt', '<=', now)
      .limit(MAX_PER_RUN)
      .get();

    const purged: string[] = [];
    let skipped = 0;
    for (const d of snap.docs) {
      const u = d.data() as Record<string, any>;
      const isWithdrawal = u.status === 'disconnected' && WITHDRAWAL_REFERRERS.has(String(u.disconnectReferrer || ''));
      if (!isWithdrawal || u.purgedAt) {
        // 예약이 남았지만 탈퇴 상태가 아니면 예약만 치운다 (재가입 등)
        if (!isWithdrawal) {
          await d.ref.update({ deleteScheduledAt: admin.firestore.FieldValue.delete() }).catch(() => undefined);
        }
        skipped++;
        continue;
      }
      const r = await purgeUserData(d.id, String(u.disconnectReferrer));
      purged.push(d.id);
      console.log(`[purgeWithdrawn] uid=${d.id} sub=${r.subcollections} reports=${r.topReports} progress=${r.progress} auth=${r.auth}${r.errors.length ? ' errors=' + r.errors.join(' | ') : ''}`);
    }

    const unlinked = await unlinkPurgedUids(purged);
    console.log(`[purgeWithdrawn] 대상 ${snap.size}, 파기 ${purged.length}, 건너뜀 ${skipped}, 기기 연결 해제 ${unlinked}`);
  },
);
