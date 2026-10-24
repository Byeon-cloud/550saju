/**
 * 신년운세 출시 기념가 마감 안내 메일 (2026-10-17, 시험 W6 / E14)
 *
 *   subscribeMarketingMail  웹 신년운세 화면의 '마감 전에 알림 받기'. 메일 주소와 광고성 정보 수신 동의를 emailLeads/{uid} 에 남기고
 *                           곧바로 '수신 동의 확인' 메일을 보낸다(정보통신망법 시행령 62조의3: 동의 처리 결과를 알려야 한다).
 *   unsubscribeMail         메일 속 '그만 받기' 링크(/mail/unsub?u=&t=). 토큰이 맞으면 동의를 거둔다. 메일 앱의 한 번 누르기 거부(POST)도 받는다.
 *   sendNewYearDeadlineMail 2026-11-28 10:00 KST 한 번. 동의한 사람에게만 '(광고)' 제목으로 보낸다. 밤 9시~아침 8시는 보내지 않는다
 *                           (정보통신망법 시행령 61조 3항이 전자우편을 야간 제한에서 빼지만, 우리 원칙으로 지킨다).
 *                           사람마다 mailCampaigns/{캠페인}/sent/{uid} 를 먼저 만들어 두 번 보내지 않는다.
 *   보내는 계정과 연결은 pdf/mailPdf.ts (info@juulabel.com, 시크릿 MAIL_APP_PASSWORD).
 */
import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { MAIL_APP_PASSWORD, FROM_ADDR, BIZ_LINE, mailTransport, newUnsubToken, normalizeEmail, unsubUrl } from '../pdf/mailPdf';
import { withdrawByEmail } from './withdraw';

const CAMPAIGN = 'newyear2027_deadline';
const LAUNCH_UNTIL = '2026-11-30'; // 클라 pricing.ts TOJUNG launchUntil, 서버 tojungCost 와 같은 날
const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const wrap = (inner: string) => `<div style="font-family:Pretendard,-apple-system,sans-serif;font-size:15px;line-height:1.8;color:#1A1612;max-width:560px">${inner}</div>`;
const foot = (uid: string, token: string, consentDay: string) => `<p style="font-size:12px;color:#8A8073;margin-top:28px;line-height:1.7">
${consentDay ? `${esc(consentDay)}에 사주500 신년운세와 할인 소식 메일 수신에 동의하셔서 보내 드려요.<br>` : ''}더 받지 않으려면 <a href="${unsubUrl(uid, token)}" style="color:#8A8073">수신 거부</a>를 눌러 주세요. 바로 처리돼요.<br>${esc(BIZ_LINE)}</p>`;

export const subscribeMarketingMail = onCall(
  { secrets: [MAIL_APP_PASSWORD], timeoutSeconds: 30, memory: '256MiB', minInstances: 0, cors: true, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', '잠시 뒤 다시 시도해 주세요');
    const email = normalizeEmail(request.data?.email);
    if (!email) throw new HttpsError('invalid-argument', '메일 주소를 다시 확인해 주세요');
    if (request.data?.consent !== true) throw new HttpsError('invalid-argument', '수신 동의가 필요해요');
    const db = admin.firestore();
    const day = kstDay();
    const limRef = db.doc(`users/${uid}/mailLog/${day}`);
    await db.runTransaction(async (tx) => {
      const s = await tx.get(limRef);
      const n = Number(s.data()?.subscribe || 0);
      if (n >= 3) throw new HttpsError('resource-exhausted', '오늘은 더 신청할 수 없어요. 내일 다시 시도해 주세요');
      tx.set(limRef, { subscribe: n + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
    const ref = db.doc(`emailLeads/${uid}`);
    const prev = (await ref.get()).data() || {};
    const token: string = prev.unsubToken || newUnsubToken();
    await ref.set({
      email,
      unsubToken: token,
      marketingConsent: true,
      marketingConsentAt: admin.firestore.FieldValue.serverTimestamp(),
      marketingConsentDay: day,
      topics: admin.firestore.FieldValue.arrayUnion('newyear2027'),
      lastSource: String(request.data?.source || 'newyear_deadline').slice(0, 30),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 동의 확인 메일 (광고가 아니라 동의 처리 결과 안내)
    try {
      await mailTransport().sendMail({
        from: `"사주500" <${FROM_ADDR}>`,
        to: email,
        subject: '[사주500] 메일 수신 동의를 확인해 드려요',
        text: [
          `${day}에 사주500 신년운세와 할인 소식 메일(광고성 정보) 수신에 동의하셨어요.`,
          `2027 신년운세 출시 기념가는 ${LAUNCH_UNTIL.slice(5, 7).replace(/^0/, '')}월 ${LAUNCH_UNTIL.slice(8)}일까지예요. 끝나기 전인 11월 28일에 한 번 알려 드릴게요.`,
          `더 받지 않으려면: ${unsubUrl(uid, token)}`,
          BIZ_LINE,
        ].join('\n'),
        html: wrap(`<p>${esc(day)}에 사주500 신년운세와 할인 소식 메일(광고성 정보) 수신에 동의하셨어요.</p>
<p>2027 신년운세 출시 기념가는 11월 30일까지예요. 끝나기 전인 11월 28일에 한 번 알려 드릴게요.</p>${foot(uid, token, '')}`),
        headers: { 'List-Unsubscribe': `<${unsubUrl(uid, token)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
    } catch (e: any) {
      console.error('[marketingMail] 동의 확인 메일 실패', e?.code || '', e?.message || e);
      throw new HttpsError('internal', '메일을 보내지 못했어요. 주소를 확인하고 다시 시도해 주세요');
    }
    return { ok: true };
  },
);

const unsubPage = (msg: string) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>수신 거부 | 사주500</title><meta name="robots" content="noindex"></head>
<body style="margin:0;background:#F4EFE4;color:#1A1612;font-family:Pretendard,-apple-system,sans-serif"><div style="max-width:480px;margin:0 auto;padding:60px 22px;text-align:center">
<div style="font-family:'Noto Serif KR',serif;font-weight:900;font-size:22px">사주<span style="color:#8C6D3D">500</span></div>
<p style="font-size:17px;line-height:1.8;margin-top:24px">${msg}</p>
<p style="margin-top:28px"><a href="https://saju500.app/" style="color:#7A5C2E;font-weight:700">사주500 홈으로</a></p></div></body></html>`;

export const unsubscribeMail = onRequest(
  { timeoutSeconds: 15, memory: '256MiB', minInstances: 0, invoker: 'public' },
  async (req, res) => {
    const uid = String(req.query.u || '');
    const t = String(req.query.t || '');
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'text/html; charset=utf-8');
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid) || !/^[a-f0-9]{32}$/.test(t)) {
      res.status(400).send(unsubPage('링크가 올바르지 않아요. info@juulabel.com 으로 메일을 주시면 바로 처리해 드릴게요.'));
      return;
    }
    try {
      // k=daily 는 아침 일주 운세 메일(ilju/iljuDaily.ts), 없으면 광고 소식
      const daily = req.query.k === 'daily';
      const ref = admin.firestore().doc(`${daily ? 'dailyMailSubs' : 'emailLeads'}/${uid}`);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.unsubToken !== t) {
        res.status(200).send(unsubPage('이미 처리됐거나 받을 메일이 없어요.'));
        return;
      }
      // 2026-10-25 같은 주소를 쓰는 다른 계정의 문서도 함께 끄고, 끈 문서의 주소는 지운다(mail/withdraw.ts)
      const email = String(snap.data()?.email || '');
      if (daily) {
        if (email) await withdrawByEmail([email], 'daily', 'unsub_link');
        else await ref.set({ active: false, withdrawnAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        res.status(200).send(unsubPage('수신 거부가 처리됐어요. 내일부터 아침 운세 메일을 보내지 않아요.'));
        return;
      }
      if (email) await withdrawByEmail([email], 'ad', 'unsub_link');
      else await ref.set({ marketingConsent: false, marketingWithdrawnAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      res.status(200).send(unsubPage('수신 거부가 처리됐어요. 앞으로 신년운세와 할인 소식 메일을 보내지 않아요.'));
    } catch (e: any) {
      console.error('[unsubscribeMail]', e?.message || e);
      res.status(500).send(unsubPage('잠시 뒤 다시 눌러 주세요. 계속 안 되면 info@juulabel.com 으로 알려 주세요.'));
    }
  },
);

/** 마감 안내 본문 — 정가를 판 적이 없는 기간이라 취소선과 할인율은 쓰지 않는다(공정위 고시) */
function deadlineMail(uid: string, token: string, consentDay: string) {
  const link = 'https://saju500.app/tojung?utm_source=email&utm_medium=newsletter&utm_campaign=newyear_deadline';
  const subject = '(광고) [사주500] 2027 신년운세 출시 기념가가 11월 30일에 끝나요';
  const text = [
    '2027 신년운세 출시 기념가 7운은 11월 30일까지예요. 12월 1일부터는 9운이에요.',
    '',
    '내 사주로 2027년 열두 달 흐름과 달마다 좋은 날, 조심할 날을 날짜까지 풀어 드려요.',
    `신년운세 보기: ${link}`,
    '',
    `${consentDay ? `${consentDay}에 수신에 동의하셔서 보내 드려요. ` : ''}더 받지 않으려면: ${unsubUrl(uid, token)}`,
    BIZ_LINE,
  ].join('\n');
  const html = wrap(`<p style="font-family:'Noto Serif KR',serif;font-size:19px;font-weight:700;line-height:1.5">2027 신년운세 출시 기념가가<br>11월 30일에 끝나요</p>
<p>출시 기념가 <b>7운</b>은 11월 30일까지예요. 12월 1일부터는 9운이에요.</p>
<p>내 사주로 2027년 열두 달 흐름과 달마다 좋은 날, 조심할 날을 날짜까지 풀어 드려요.</p>
<p style="margin:22px 0"><a href="${link}" style="display:inline-block;background:#B8965A;color:#17110A;font-weight:800;text-decoration:none;padding:13px 22px;border-radius:12px">2027 신년운세 보기</a></p>
${foot(uid, token, consentDay)}`);
  return { subject, text, html };
}

export const sendNewYearDeadlineMail = onSchedule(
  { schedule: '0 10 28 11 *', timeZone: 'Asia/Seoul', secrets: [MAIL_APP_PASSWORD], timeoutSeconds: 540, memory: '256MiB', retryCount: 0 },
  async () => {
    if (kstDay() > LAUNCH_UNTIL || !kstDay().startsWith('2026-')) { console.log('[deadlineMail] 기간 아님, 건너뜀'); return; }
    const db = admin.firestore();
    const leads = await db.collection('emailLeads').where('marketingConsent', '==', true).get();
    const transport = mailTransport();
    let sent = 0; let skipped = 0; let failed = 0;
    const seen = new Set<string>(); // 같은 주소가 계정 여러 개에 있어도 한 번만 (2026-10-25)
    for (const doc of leads.docs) {
      const d = doc.data();
      const email = normalizeEmail(d.email);
      if (!email || seen.has(email.toLowerCase())) { skipped++; continue; }
      seen.add(email.toLowerCase());
      const mark = db.doc(`mailCampaigns/${CAMPAIGN}/sent/${doc.id}`);
      try { await mark.create({ at: admin.firestore.FieldValue.serverTimestamp() }); } catch { skipped++; continue; } // 이미 보냄
      let token: string = d.unsubToken;
      if (!token) { token = newUnsubToken(); await doc.ref.set({ unsubToken: token }, { merge: true }); }
      const m = deadlineMail(doc.id, token, String(d.marketingConsentDay || ''));
      try {
        await transport.sendMail({
          from: `"사주500" <${FROM_ADDR}>`, to: email, subject: m.subject, text: m.text, html: m.html,
          headers: { 'List-Unsubscribe': `<${unsubUrl(doc.id, token)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        });
        sent++;
        await mark.set({ ok: true }, { merge: true });
      } catch (e: any) {
        failed++;
        await mark.set({ ok: false, err: String(e?.message || e).slice(0, 120) }, { merge: true });
      }
      await new Promise((r) => setTimeout(r, 400)); // 구글 발송 속도 제한 여유
    }
    await db.doc(`mailCampaigns/${CAMPAIGN}`).set({ sent, skipped, failed, total: leads.size, ranAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    console.log('[deadlineMail]', { sent, skipped, failed, total: leads.size });
  },
);
