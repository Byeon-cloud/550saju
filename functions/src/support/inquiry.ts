/**
 * 웹 문의함 (2026-10-19)
 *
 *   왜: 앱(토스 안)은 토스 '고객센터'로 문의가 오면 토스 CS 콘솔이 기기와 회원을 알려 줘 바로 찾는다. 웹은 메일과 카카오 오픈채팅뿐이라
 *   누가 무슨 화면에서 무슨 일을 겪었는지 알 수 없었다(카카오엔 회원 ID 도 안 붙는다).
 *   → 웹 고객문의에 '여기에 바로 남기기' 양식. 회원 ID, 기기, 보던 화면, 잔액, 보던 결과를 자동으로 붙여 inquiries 에 남기고,
 *     오너 메일(info@)로 새 문의 알림. 관리자 '문의함'에서 고객 카드로 바로 넘어가 운을 넣고, 처리 표시, 메일 답장.
 *
 *   submitInquiry(누구나, 로그인 안 해도 익명 계정으로) / adminInquiries(오너): list, update, reply
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { MAIL_APP_PASSWORD, FROM_ADDR, BIZ_LINE, mailTransport, normalizeEmail } from '../pdf/mailPdf';
import { assertOwner } from '../admin/owner';

const CATEGORIES: Record<string, string> = {
  pay_missing: '결제했는데 운이 안 들어왔어요',
  ai_fail: '풀이가 안 나오거나 이상해요',
  lost: '기록이나 운이 사라졌어요',
  refund: '환불하고 싶어요',
  other: '그 밖의 문의',
};
const DAILY_LIMIT = 5;
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+$/g, '').slice(0, n);

export const submitInquiry = onCall(
  { timeoutSeconds: 30, memory: '256MiB', cors: true, secrets: [MAIL_APP_PASSWORD] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 눌러 주세요');
    const d = request.data || {};
    const category = CATEGORIES[String(d.category)] ? String(d.category) : 'other';
    const message = clip(d.message, 1000).trim();
    if (message.length < 5) throw new HttpsError('invalid-argument', '무슨 일인지 조금만 더 적어 주세요');
    const email = d.email ? normalizeEmail(d.email) : null;
    if (d.email && !email) throw new HttpsError('invalid-argument', '메일 주소를 다시 확인해 주세요');
    const m = d.meta && typeof d.meta === 'object' ? d.meta : {};
    const meta = {
      did: clip(m.did, 60), path: clip(m.path, 120), referrer: clip(m.referrer, 160), utm: clip(m.utm, 160),
      history: Array.isArray(m.history) ? m.history.slice(-8).map((x: unknown) => clip(x, 80)) : [],
      balance: m.balance && typeof m.balance === 'object' ? { paid: Number(m.balance.paid) || 0, bonus: Number(m.balance.bonus) || 0, reward: Number(m.balance.reward) || 0 } : null,
      reportId: clip(m.reportId, 60), appVersion: clip(m.appVersion, 30), browser: clip(m.browser, 60), inApp: clip(m.inApp, 20),
      loggedIn: !!m.loggedIn,
    };
    const db = admin.firestore();
    // 하루 다섯 번까지 (장난 방지)
    const quotaRef = db.collection('inquiryQuota').doc(`${uid}_${kstDay()}`);
    await db.runTransaction(async (tx) => {
      const q = await tx.get(quotaRef);
      const n = Number(q.data()?.n || 0);
      if (n >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', '오늘은 더 남길 수 없어요. 메일(info@juulabel.com)로 보내 주세요');
      tx.set(quotaRef, { n: n + 1, at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
    const ref = await db.collection('inquiries').add({
      uid, category, message, email: email || '', meta, plat: 'web', status: 'new',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // 오너에게 새 문의 알림 (실패해도 문의는 남아 있다)
    try {
      const bal = meta.balance ? `${meta.balance.paid + meta.balance.bonus + meta.balance.reward}운` : '-';
      await mailTransport().sendMail({
        from: `"사주500" <${FROM_ADDR}>`, to: FROM_ADDR,
        subject: `[사주500 웹 문의] ${CATEGORIES[category]} (회원 ${uid.slice(0, 8)})`,
        text: [
          `분류: ${CATEGORIES[category]}`, `내용: ${message}`, `답장 메일: ${email || '(없음)'}`,
          `회원 ID: ${uid}`, `기기: ${meta.did || '-'}`, `보던 화면: ${meta.path || '-'}`, `잔액(기기): ${bal}`,
          meta.reportId ? `보던 결과: ${meta.reportId}` : '', `브라우저: ${meta.browser || '-'}${meta.inApp ? ` (${meta.inApp} 앱 안)` : ''}`,
          '', '관리자 문의함에서 고객 카드를 열고 운을 넣거나 답장할 수 있어요: https://saju500.app/admin',
        ].filter(Boolean).join('\n'),
      });
    } catch (e: any) { console.warn('[submitInquiry] 알림 메일 실패', e?.message); }
    return { ok: true, id: ref.id };
  },
);

const ts = (v: any) => (v && typeof v.toMillis === 'function' ? v.toMillis() : 0);

export const adminInquiries = onCall(
  { timeoutSeconds: 30, memory: '256MiB', cors: true, secrets: [MAIL_APP_PASSWORD] },
  async (request) => {
    const by = assertOwner(request);
    const db = admin.firestore();
    const action = String(request.data?.action || 'list');
    if (action === 'list') {
      const snap = await db.collection('inquiries').orderBy('createdAt', 'desc').limit(150).get();
      return {
        items: snap.docs.map((x) => {
          const v = x.data() as any;
          return { id: x.id, uid: v.uid, category: v.category, categoryLabel: CATEGORIES[v.category] || v.category, message: v.message, email: v.email, meta: v.meta || {}, status: v.status, note: v.note || '', replies: (v.replies || []).map((r: any) => ({ at: ts(r.at) || Number(r.atMs) || 0, text: r.text })), createdAt: ts(v.createdAt) };
        }),
      };
    }
    const id = String(request.data?.id || '');
    if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpsError('invalid-argument', '문의 번호가 이상해요');
    const ref = db.collection('inquiries').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', '없는 문의예요');
    if (action === 'update') {
      const status = ['new', 'doing', 'done'].includes(String(request.data?.status)) ? String(request.data.status) : undefined;
      await ref.update({ ...(status ? { status } : {}), ...(request.data?.note !== undefined ? { note: clip(request.data.note, 500) } : {}), updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: by });
      return { ok: true };
    }
    if (action === 'reply') {
      const v = snap.data() as any;
      const text = clip(request.data?.text, 2000).trim();
      if (!v.email) throw new HttpsError('failed-precondition', '이 문의엔 답장 받을 메일이 없어요');
      if (text.length < 5) throw new HttpsError('invalid-argument', '답장 내용을 적어 주세요');
      await mailTransport().sendMail({
        from: `"사주500" <${FROM_ADDR}>`, to: v.email,
        subject: '사주500 문의에 답해 드려요',
        text: `${text}\n\n— 남겨 주신 문의 —\n${v.message}\n\n${BIZ_LINE}`,
      });
      await ref.update({
        status: 'done',
        replies: admin.firestore.FieldValue.arrayUnion({ text, atMs: Date.now(), by }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ok: true };
    }
    throw new HttpsError('invalid-argument', '모르는 요청이에요');
  },
);
