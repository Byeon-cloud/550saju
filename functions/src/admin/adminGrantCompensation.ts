/**
 * adminGrantCompensation — 어드민 CS 운 지급 (2026-06-12)
 *
 * 배경: 보상 장부(compensations)를 매번 개발자가 CLI 로 심어야 했음.
 *   → 어드민 'CS 지급' 탭에서 준기가 디바이스 ID + 운 수량 입력 → 즉시 장부 기록.
 *   수령은 기존 claimCompensation 파이프 그대로 (고객이 앱 열면 자동 적립). 배포 0.
 *
 * 2026-10-19 개편:
 *   - 오너 판정은 ./owner 하나로(예전엔 여기 목록을 따로 들고 있었다).
 *   - 토스 로그인 회원 ID(toss_숫자, 20자 미만)가 형식 검사에 걸려 지급이 막히던 것 → 회원 ID 6~128자 허용.
 *   - 지급 사유(reason)를 고른다: pay_missing(결제했는데 운이 안 들어옴), ai_fail(풀이 실패), lost_restored(기록 유실, 복구됨),
 *     lost_unrestored(기록 유실, 복구 안 됨), apology(불편 사과), other.
 *   - 지급할 때마다 compensationLog 에 한 줄씩 남긴다(장부 문서는 누적되며 덮어써져 이력이 사라졌다). action 'history' 로 본다.
 *   - 웹 회원도 받는다: 웹은 App.tsx 가 부팅 때 회원 ID 로 claimCompensation 을 부른다(10-19 전엔 앱만 불렀다).
 *
 * 2026-10-24 검수 — '결제 누락'(pay_missing)으로 웹 결제(포트원) 몫을 넣으면 그 결제를 지급 끝남으로 적는다.
 *   예전엔 보상 장부만 써서, 손님 기기가 나중에 같은 결제를 다시 확인하면(confirmPortonePayment) 운이 한 번 더 들어갔다.
 *   - paymentId: 웹 결제번호(회원 ID 앞 8자로 시작). 같은 트랜잭션에서 users/{회원}/payments/{결제번호} 를
 *     { status: 'confirmed', grantedBy: 'owner', ownerCompLogId } 로 적는다. 이미 운이 들어간 결제나 환불된 결제면 넣지 않고 거부한다.
 *     그 결제는 이제 확인을 다시 불러도 '이미 처리된 결제예요'(기기 표식이 없어 어느 기기도 다시 받지 않는다), 감시는 지급 끝남으로 본다.
 *   - 회원 ID 로 넣는 결제 누락은 paymentId 나 noPaymentId(앱 토스 결제라 웹 결제번호가 없음) 중 하나가 꼭 있어야 한다.
 *     결제번호 없이 넣은 기록이 남으면 confirmPortonePayment 가 그 회원의 그 시각 전 결제를 자동으로 넣지 않고 오너 확인으로 돌린다.
 *   - 운 자체는 지금처럼 보상 장부로 들어간다(claimCompensation 이 서버 잔액과 기기 잔액에). 결제 문서는 서버 잔액을 바꾸지 않는다.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertOwner } from './owner';
import { isPortoneGranted } from '../payment/grantPortone';

const PORTONE_PAYMENT_ID_RE = /^[A-Za-z0-9]{8}_[A-Za-z0-9_]{1,60}$/;
const isRefundedDoc = (d: Record<string, any> | undefined) =>
  !!d && (['refunded', 'partial_refund_review', 'cancelled'].includes(String(d.status || '')) || !!d.refundedAt || !!d.portoneCancelledAt);

const TOPIC_KEYS = ['love', 'reunion', 'marriage', 'wealth', 'exam', 'business', 'health', 'move', 'study', 'career'];
const REASONS = ['pay_missing', 'ai_fail', 'lost_restored', 'lost_unrestored', 'apology', 'other'];
const REASON_LABEL: Record<string, string> = {
  pay_missing: '결제 누락', ai_fail: '풀이 실패', lost_restored: '기록 유실(복구됨)', lost_unrestored: '기록 유실(복구 안 됨)', apology: '불편 사과', other: 'CS 보상',
};

export const adminGrantCompensation = onCall(
  { timeoutSeconds: 15, memory: '256MiB', cors: true },
  async (request) => {
    const uid = assertOwner(request);

    const action = String(request.data?.action || 'grant');
    // 디바이스 ID(hex 32~128, 토스 앱) 또는 회원 ID(Firebase uid, 토스 로그인 toss_숫자 포함). 회원 ID 는 대소문자를 지킨다.
    const rawTarget = String(request.data?.deviceId || request.data?.target || '').trim();
    const isHexDevice = /^[0-9a-f]{32,128}$/.test(rawTarget.toLowerCase());
    const isUid = !isHexDevice && /^[A-Za-z0-9_-]{6,128}$/.test(rawTarget);
    if (!isHexDevice && !isUid) {
      throw new HttpsError('invalid-argument', '디바이스 ID(hex 32~128) 또는 회원 ID 형식이 아니에요');
    }
    const targetId = isHexDevice ? rawTarget.toLowerCase() : rawTarget;
    const db = admin.firestore();
    const ref = db.collection('compensations').doc(targetId);

    // 상태 조회 — 지급 전 확인 / 수령 여부 추적
    if (action === 'status' || action === 'history') {
      const [snap, logs] = await Promise.all([
        ref.get(),
        action === 'history' ? db.collection('compensationLog').where('target', '==', targetId).limit(50).get().catch(() => null) : Promise.resolve(null),
      ]);
      const d = snap.exists ? (snap.data() as any) : null;
      return {
        exists: !!d,
        amount: d?.amount ?? 0,
        claimed: !!d?.claimed,
        note: d?.note ?? '',
        reason: d?.reason ?? '',
        wipeTopics: d?.wipeTopics ?? [],
        claimedAt: d?.claimedAt?.toDate?.()?.toISOString?.() ?? null,
        createdAt: d?.createdAt?.toDate?.()?.toISOString?.() ?? null,
        log: (logs?.docs || []).map((x) => {
          const l = x.data() as any;
          return { at: l.at?.toDate?.()?.toISOString?.() ?? null, amount: l.amount, reason: l.reason, note: l.note, paymentId: l.paymentId ?? null };
        }).sort((a, b) => String(b.at).localeCompare(String(a.at))),
      };
    }

    // 지급 — 미수령 장부가 있으면 누적, 수령됐거나 없으면 새 장부
    const amount = Math.max(1, Math.min(100, Math.round(Number(request.data?.amount) || 0)));
    const reason = REASONS.includes(String(request.data?.reason)) ? String(request.data.reason) : 'other';
    const note = String(request.data?.note || '').slice(0, 200) || REASON_LABEL[reason];
    const wipeTopics = (Array.isArray(request.data?.wipeTopics) ? request.data.wipeTopics : [])
      .filter((t: unknown) => typeof t === 'string' && TOPIC_KEYS.includes(t));

    // 결제 누락: 어느 웹 결제 몫인지 (위 '2026-10-24 검수')
    const paymentId = String(request.data?.paymentId || '').trim();
    const noPaymentId = request.data?.noPaymentId === true;
    if (paymentId && reason !== 'pay_missing') throw new HttpsError('invalid-argument', '결제번호는 사유가 결제 누락일 때만 넣어요');
    if (reason === 'pay_missing' && isUid && !paymentId && !noPaymentId) {
      throw new HttpsError('invalid-argument', '결제 누락은 어느 결제인지 결제번호를 같이 넣어 주세요. 앱(토스) 결제라 웹 결제번호가 없으면 \'결제번호 없음\'을 골라 주세요');
    }
    if (paymentId) {
      if (!isUid) throw new HttpsError('invalid-argument', '웹 결제번호는 회원 ID 로 넣을 때만 적을 수 있어요');
      if (!PORTONE_PAYMENT_ID_RE.test(paymentId)) throw new HttpsError('invalid-argument', '웹 결제번호 형식이 아니에요(회원 ID 앞 8자_묶음_…)');
      if (paymentId.slice(0, 8) !== targetId.slice(0, 8)) throw new HttpsError('invalid-argument', '이 결제번호는 이 회원의 결제가 아니에요(앞 8자가 회원 ID 와 달라요)');
    }
    const payRef = paymentId ? db.doc(`users/${targetId}/payments/${paymentId}`) : null;
    const logRef = db.collection('compensationLog').doc();

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const paySnap = payRef ? await tx.get(payRef) : null;
      if (paySnap?.exists) {
        const pd = paySnap.data() || {};
        if (pd.pgProvider && pd.pgProvider !== 'portone') throw new HttpsError('failed-precondition', '웹 결제(포트원)가 아니에요. 앱 결제는 \'결제번호 없음\'으로 넣어 주세요');
        if (isRefundedDoc(pd)) throw new HttpsError('failed-precondition', '환불된 결제예요. 운을 넣지 않았어요');
        if (isPortoneGranted(pd)) {
          // 서버에는 이미 들어간 결제다. 손님 기기에 안 보이면 로그인한 채로 웹을 다시 열면 그 기기로 들어간다(기기 표식, 자동 채우기 넘겨받기)
          const by = pd.grantedBy === 'owner' ? '오너가 넣음' : pd.grantedBy === 'watch' ? '자동 채우기' : '손님 화면 확인';
          throw new HttpsError('failed-precondition', `이미 운이 들어간 결제예요(${by}). 운을 넣지 않았어요. 손님 기기에 안 보이면 로그인한 채로 사주500 웹을 다시 열어 달라고 안내해 주세요`);
        }
      }
      const prev = snap.exists ? (snap.data() as any) : null;
      const pendingPrev = prev && !prev.claimed ? Number(prev.amount) || 0 : 0;
      const total = Math.min(100, pendingPrev + amount);
      tx.set(ref, {
        amount: total,
        note: note || prev?.note || 'CS 보상',
        reason,
        wipeTopics: wipeTopics.length > 0 ? wipeTopics : (prev && !prev.claimed ? prev.wipeTopics ?? [] : []),
        claimed: false,
        createdAt: prev?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        grantedBy: uid,
      });
      // 지급 이력 한 줄 (고객 찾기에서 회원 ID 로 찾을 수 있게 uids 배열도 남긴다)
      tx.set(logRef, {
        target: targetId,
        kind: isHexDevice ? 'device' : 'uid',
        uids: isHexDevice ? (Array.isArray(request.data?.uids) ? request.data.uids.filter((x: unknown) => typeof x === 'string').slice(0, 6) : []) : [targetId],
        amount, reason, note, wipeTopics,
        ...(reason === 'pay_missing' ? { paymentId: paymentId || null, noPaymentId: !paymentId } : {}),
        by: uid,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
      // 그 웹 결제는 오너가 넣은 것으로 지급 끝 (서버 잔액은 보상 수령 때 claimCompensation 이 더한다)
      //   paidUn, bonusUn: 나중에 포트원에서 이 결제를 취소하면 환불 회수(portoneCancelSync)가 거둘 몫. 보상은 전부 paid 칸으로 들어가므로
      //   넣은 운을 paid 로, 결제 묶음 값(확인 기록에 있으면)보다 크지 않게. totalCharged 는 이 결제로 늘지 않았으니 회수 때도 줄이지 않는다
      if (payRef) {
        const pd = paySnap?.exists ? paySnap.data() || {} : {};
        const pkgTotal = (Number(pd.paidUn) || 0) + (Number(pd.bonusUn) || 0);
        tx.set(payRef, {
          paidUn: pkgTotal > 0 ? Math.min(amount, pkgTotal) : amount,
          bonusUn: 0,
          type: 'charge', orderId: paymentId, pgProvider: 'portone',
          status: 'confirmed',
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          grantedBy: 'owner',
          ownerCompLogId: logRef.id,
          ownerGrantUn: amount,
          ...(paySnap?.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
        }, { merge: true });
      }
      return { totalPending: total, accumulated: pendingPrev > 0 };
    });
    console.info(`[adminGrant] ${amount}운 ${reason} (대기합계 ${result.totalPending}) target=${targetId.slice(0, 12)}…${paymentId ? ` 결제 ${paymentId.slice(0, 14)}…` : ''} by=${uid.slice(0, 8)}`);
    return { ok: true, ...result, paymentMarked: !!payRef };
  },
);
