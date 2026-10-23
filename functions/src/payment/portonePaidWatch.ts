/**
 * watchPortonePaid — 돈은 나갔는데 운이 안 들어간 웹 결제를 찾아 알린다 (2026-10-23, 읽기와 알림만)
 *
 * 왜: 웹 결제(포트원)는 손님 화면이 confirmPortonePayment 를 불러야 운이 들어간다. 모바일은 결제창이 다른 화면으로 넘어갔다가
 *   /charge?portone_pid=… 로 돌아와서야 부르는데, 돌아온 화면의 로그인 계정이 결제한 계정과 다르면(uid 앞 8자 대조에서 기록 없이 거부),
 *   돌아오지 못했으면(창을 닫음, 통신 끊김), 확인이 실패했으면 포트원에는 PAID 인데 우리 장부에는 confirmed 가 없다.
 *   포트원 웹훅 함수가 없어서 지금까지는 손님이 문의하지 않으면 아무도 몰랐다.
 *
 * 하는 일 (10분마다):
 *   1. 포트원에서 최근 48시간 안에 결제 완료(PAID)된 실결제를 찾는다. 테스트 채널 결제는 confirm 이 지급하지 않으니 뺀다.
 *      취소, 부분 취소된 결제는 포트원 상태가 PAID 가 아니라서 조회에서 빠진다.
 *   2. 결제 뒤 10분이 안 된 결제는 건너뛴다(손님 화면이 아직 확인 중일 수 있다).
 *   3. 우리 장부 users/{uid}/payments/{paymentId}(confirmPortonePayment 가 쓰는 곳)와, 계정 이관으로 다른 계정에 옮겨진 사본
 *      (payments.orderId 색인)에서 status 'confirmed' 를 찾는다. 하나도 없으면(기록 없음, pending, failed, needs_reconciliation)
 *      backofficeAlerts/portone_unconfirmed_{paymentId} 에 한 번만 남기고(create) 오너 메일을 보낸다.
 *   4. 앞서 알린 결제가 나중에 손님 화면에서 확인돼 운이 들어갔으면 그 경보에 resolvedAt 을 적고 메일에 같이 알린다(두 번 넣지 않게).
 *
 *   이 함수는 운을 넣지 않고, confirmPortonePayment 를 대신 부르지 않고, 결제 장부를 바꾸지 않는다.
 *   지급은 오너가 확인한 뒤 관리자 '고객 찾기와 운 넣기'로 한다(자동 지급은 오너 허락 뒤 따로).
 *   로컬 확인: scripts/ops/portone_paid_check.cjs (같은 대조, 읽기만)
 */
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { MAIL_APP_PASSWORD, FROM_ADDR, mailTransport } from '../pdf/mailPdf';
import { OWNER_EMAILS, OWNER_UIDS } from '../admin/owner';

const PORTONE_V2_API_SECRET = defineSecret('PORTONE_V2_API_SECRET');
const LOOKBACK_HOURS = 48;
const GRACE_MS = 10 * 60 * 1000; // 결제 뒤 이 시간 안은 손님 화면이 아직 확인 중일 수 있다

const kstText = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const tsMs = (v: any): number => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'string' ? Date.parse(v) || 0 : 0);

type Ledger = { status: string; failReason: string; where: string };

/** 이 결제의 우리 장부 상태 — confirmed 사본이 하나라도 있으면 confirmed. 없으면 가장 나중 기록의 상태 */
async function ledgerOf(db: admin.firestore.Firestore, uid: string, paymentId: string): Promise<Ledger> {
  const rows: Array<{ status: string; failReason: string; where: string; at: number }> = [];
  if (uid) {
    const d = await db.doc(`users/${uid}/payments/${paymentId}`).get().catch(() => null);
    if (d?.exists) {
      const x = d.data() || {};
      if (x.status === 'confirmed') return { status: 'confirmed', failReason: '', where: uid };
      rows.push({ status: String(x.status || ''), failReason: String(x.failReason || ''), where: uid, at: tsMs(x.lastAttemptAt) || tsMs(x.createdAt) });
    }
  }
  // 기기 이관, 결제 이력 복구로 다른 계정에 옮겨진 사본 (payments.orderId 는 COLLECTION_GROUP 색인이 있다)
  const g = await db.collectionGroup('payments').where('orderId', '==', paymentId).limit(5).get().catch(() => null);
  for (const d of g?.docs || []) {
    const x = d.data() || {};
    const where = d.ref.parent.parent?.id || '';
    if (x.status === 'confirmed') return { status: 'confirmed', failReason: '', where };
    rows.push({ status: String(x.status || ''), failReason: String(x.failReason || ''), where, at: tsMs(x.lastAttemptAt) || tsMs(x.createdAt) });
  }
  if (!rows.length) return { status: 'none', failReason: '', where: '' };
  rows.sort((a, b) => b.at - a.at);
  return rows[0];
}

const STATUS_TEXT: Record<string, string> = {
  none: '장부에 기록 없음(확인 요청이 오지 않았거나, 돌아온 화면의 계정이 달라 거부됨)',
  pending: '확인 중 멈춤(pending)',
  failed: '확인 실패(failed)',
  needs_reconciliation: '포트원 승인 뒤 지급 중 오류(needs_reconciliation)',
};

export const watchPortonePaid = onSchedule(
  { schedule: 'every 10 minutes', timeZone: 'Asia/Seoul', secrets: [PORTONE_V2_API_SECRET, MAIL_APP_PASSWORD], timeoutSeconds: 120, memory: '256MiB', retryCount: 0 },
  async () => {
    const db = admin.firestore();
    const key = PORTONE_V2_API_SECRET.value();
    const now = Date.now();
    const from = new Date(now - LOOKBACK_HOURS * 3600e3).toISOString();
    const items: any[] = [];
    for (let page = 0; page < 10; page++) {
      const body = { page: { number: page, size: 100 }, filter: { isTest: false, timestampType: 'STATUS_CHANGED_AT', from, until: new Date(now).toISOString(), status: ['PAID'] } };
      const res = await fetch('https://api.portone.io/payments?requestBody=' + encodeURIComponent(JSON.stringify(body)), { headers: { Authorization: `PortOne ${key}` } });
      if (!res.ok) { console.error('[watchPortonePaid] 조회 실패', res.status, (await res.text().catch(() => '')).slice(0, 300)); return; }
      const j: any = await res.json();
      items.push(...(j.items || []));
      if ((j.items || []).length < 100) break;
    }

    const fresh: string[] = [];
    const resolved: string[] = [];
    let checked = 0; let young = 0;
    for (const p of items) {
      const paymentId: string = String(p?.id || '');
      if (!paymentId || p.status !== 'PAID') continue;
      if (p.channel?.type && p.channel.type !== 'LIVE') continue; // 테스트 채널 결제는 confirm 이 지급하지 않는다
      const paidMs = Date.parse(p.paidAt || p.statusChangedAt || '') || 0;
      if (!paidMs || now - paidMs < GRACE_MS) { young++; continue; }
      checked++;

      let cd: any = p.customData;
      try { if (typeof cd === 'string') cd = JSON.parse(cd); } catch { cd = null; }
      const uid: string = typeof cd?.uid === 'string' && paymentId.startsWith(cd.uid.slice(0, 8)) ? cd.uid : '';
      const amount = Number(p.amount?.total || 0);

      const alertRef = db.collection('backofficeAlerts').doc(`portone_unconfirmed_${paymentId}`);
      const prev = await alertRef.get();
      if (prev.exists && prev.data()?.resolvedAt) continue; // 이미 알렸고 그 뒤 운이 들어감

      const led = await ledgerOf(db, uid, paymentId);
      if (led.status === 'confirmed') {
        if (prev.exists) {
          await alertRef.update({ resolvedAt: admin.firestore.FieldValue.serverTimestamp(), resolvedNote: '앞서 알린 뒤 손님 화면에서 확인돼 운이 들어감' }).catch(() => undefined);
          resolved.push(`결제번호 ${paymentId} (${amount.toLocaleString('ko-KR')}원) — 앞서 알린 결제인데 이제 운이 들어갔어요. 따로 넣지 마세요.`);
        }
        continue;
      }
      if (prev.exists) continue; // 결제당 한 번만 알린다

      const mismatch = await db.collection('portoneUidMismatch').doc(paymentId).get().catch(() => null);
      const mm = mismatch?.exists ? mismatch.data() : null;
      try {
        await alertRef.create({
          kind: 'portone_paid_unconfirmed', paymentId, amount,
          uidPrefix: uid ? uid.slice(0, 8) : paymentId.slice(0, 8),
          paidAt: new Date(paidMs).toISOString(),
          ledgerStatus: led.status, failReason: led.failReason.slice(0, 120),
          uidMismatchCallerUid8: mm?.callerUid8 || null,
          at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch { continue; } // 같은 시각에 다른 실행이 먼저 남겼다

      // 연락 메일 (구글, 카카오 선택 동의, 웹 네이버는 users.naverEmail). 오너 메일함으로만 보낸다
      let contact = '연락 메일 없음';
      if (uid) {
        try {
          const au = await admin.auth().getUser(uid);
          const mail = au.email || au.providerData.map((x) => x.email).find(Boolean);
          if (mail) contact = `연락 메일 ${mail}`;
        } catch { /* 계정 없음 */ }
        if (contact === '연락 메일 없음') {
          const u = await db.doc(`users/${uid}`).get().catch(() => null);
          const nv = u?.data()?.naverEmail;
          if (nv) contact = `연락 메일 ${nv}(네이버)`;
        }
      }
      const payerMail = String(p.customer?.email || '');
      if (contact === '연락 메일 없음' && payerMail && !/@saju500\.app$/i.test(payerMail)) contact = `연락 메일 ${payerMail}(결제창)`;
      const who = uid ? `회원 ID ${uid}${OWNER_UIDS.includes(uid) ? ' (오너 계정)' : ''}` : `회원 ID 앞 8자 ${paymentId.slice(0, 8)} (결제 정보에 회원 ID 없음)`;
      const lines = [
        `결제번호 ${paymentId}`,
        `  ${amount.toLocaleString('ko-KR')}원, ${String(p.orderName || '')}, 결제 ${kstText(paidMs)}(한국 시각), ${p.method?.type || ''}${p.method?.provider ? ` ${p.method.provider}` : ''}`,
        `  ${who}, ${contact}`,
        `  우리 장부: ${STATUS_TEXT[led.status] || led.status}${led.failReason ? `, 사유 ${led.failReason.slice(0, 80)}` : ''}${led.where && led.where !== uid ? `, 기록 위치 ${led.where}` : ''}`,
      ];
      if (mm) lines.push(`  돌아온 화면의 계정이 달라 확인이 거부됨: 그 계정 앞 8자 ${mm.callerUid8}${mm.callerAnon ? '(익명, 로그인이 풀린 채 돌아옴)' : ''}`);
      fresh.push(lines.join('\n'));
    }
    console.log(`[watchPortonePaid] PAID ${items.length}건, 확인 ${checked}건, 10분 안 ${young}건, 새 경보 ${fresh.length}건, 해결 ${resolved.length}건`);
    if (!fresh.length && !resolved.length) return;

    const parts: string[] = [];
    if (fresh.length) {
      parts.push(`포트원에는 결제 완료인데 운이 들어가지 않은 웹 결제예요(결제 뒤 10분 지남).\n\n${fresh.join('\n\n')}`);
      parts.push([
        '할 일',
        '- 관리자 \'고객 찾기와 운 넣기\'에서 회원 ID 로 찾아 결제 장부를 보고, 받은 운이 없으면 그 묶음만큼 넣어 주세요(이 경보는 운을 넣지 않아요).',
        '- 운을 넣지 않고 돌려주려면 포트원 콘솔에서 결제를 취소하면 돼요.',
        `- 기록: backofficeAlerts portone_unconfirmed_{결제번호}`,
      ].join('\n'));
    }
    if (resolved.length) parts.push(`앞서 알린 결제 중 이제 운이 들어간 것\n${resolved.join('\n')}`);
    try {
      await mailTransport().sendMail({
        from: `"사주500 경보" <${FROM_ADDR}>`,
        to: [...OWNER_EMAILS, FROM_ADDR].join(','),
        subject: fresh.length
          ? `[사주500 경보] 결제는 됐는데 운이 안 들어간 웹 결제 ${fresh.length}건`
          : `[사주500 경보] 앞서 알린 웹 결제 ${resolved.length}건은 운이 들어갔어요`,
        text: parts.join('\n\n'),
      });
    } catch (e: any) {
      console.error('[watchPortonePaid] 메일 실패', e?.message || e);
    }
  },
);
