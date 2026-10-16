/**
 * 결과 PDF 메일 보내기 (2026-10-16) — 종합사주 PDF 를 사용자가 입력한 주소로 첨부해 보낸다.
 *
 *   보내는 계정: 회사 구글 워크스페이스 info@juulabel.com (juulabel.com MX = Google). 비밀번호는 그 계정의 '앱 비밀번호'를
 *   시크릿 MAIL_APP_PASSWORD 에 둔다(오너가 만들어 넣는다. Claude 는 만들거나 넣지 않는다). 구글 워크스페이스 하루 발송 한도 약 2,000통.
 *   토스 앱 웹뷰는 PDF 내려받기가 브라우저로 튕겨 불편해서, 메일이 실제로 보관하기 쉬운 길이다.
 *   광고성 안내 수신 동의(선택)는 emailLeads/{uid} 에 따로 남긴다(정보통신망법 제50조: 광고는 사전 동의한 사람에게만).
 */
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import nodemailer from 'nodemailer';

export const MAIL_APP_PASSWORD = defineSecret('MAIL_APP_PASSWORD');
export const FROM_ADDR = 'info@juulabel.com';
export const BIZ_LINE = '주라벨 주식회사 | 대표 변준기 | 사업자등록번호 228-88-03113 | 부산광역시 사하구 하신중앙로 324, 2층 6호실 | info@juulabel.com';
/** 한 계정이 하루에 보낼 수 있는 결과 메일 (같은 PDF 를 여러 주소로 뿌리는 걸 막는다) */
const DAILY_LIMIT = 5;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
export function normalizeEmail(raw: unknown): string | null {
  const e = String(raw || '').trim();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

const kstDay = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/** 회사 구글 워크스페이스 메일 연결 — 결과 PDF, 광고 수신 동의 확인, 마감 안내가 같이 쓴다 (mail/marketingMail.ts) */
export function mailTransport() {
  let pass = '';
  try { pass = MAIL_APP_PASSWORD.value().replace(/\s+/g, ''); } catch { pass = ''; } // 구글 앱 비밀번호는 4자씩 띄어 보여 주지만 실제로는 16자
  if (!pass) throw new HttpsError('failed-precondition', '메일 보내기가 아직 준비되지 않았어요');
  return nodemailer.createTransport({ service: 'gmail', auth: { user: FROM_ADDR, pass } });
}

/** 수신 거부 링크용 토큰 — emailLeads/{uid}.unsubToken 에 두고, 없으면 만든다 */
export function newUnsubToken(): string {
  return require('crypto').randomBytes(16).toString('hex');
}
/** kind: 없으면 광고 소식(emailLeads), 'daily' 면 아침 일주 운세(dailyMailSubs) */
export function unsubUrl(uid: string, token: string, kind?: 'daily'): string {
  return `https://saju500.app/mail/unsub?u=${encodeURIComponent(uid)}&t=${token}${kind ? `&k=${kind}` : ''}`;
}

export async function sendPremiumPdfMail(opts: {
  db: admin.firestore.Firestore;
  uid: string;
  email: string;
  name: string;
  pdf: Buffer;
  issueId: string;
  marketingConsent: boolean;
}): Promise<void> {
  const { db, uid, email, name, pdf, issueId, marketingConsent } = opts;
  const day = kstDay();
  const limRef = db.doc(`users/${uid}/mailLog/${day}`);
  await db.runTransaction(async (tx) => {
    const s = await tx.get(limRef);
    const n = Number(s.data()?.count || 0);
    if (n >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', '오늘은 메일을 더 보낼 수 없어요. 내일 다시 시도해 주세요');
    tx.set(limRef, { count: n + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });

  const transport = mailTransport();
  const who = name ? `${name} 님` : '고객님';
  const leadRef = db.doc(`emailLeads/${uid}`);
  const prevLead = await leadRef.get().catch(() => null);
  const token: string = (prevLead?.data()?.unsubToken as string) || newUnsubToken();
  const consentDate = kstDay();
  const consentLineText = marketingConsent ? `${consentDate}에 사주500의 신년운세와 할인 소식 메일(광고성 정보) 수신에 동의하셨어요. 그만 받으려면: ${unsubUrl(uid, token)}` : '';
  const link = 'https://saju500.app/?utm_source=email&utm_medium=pdf&utm_campaign=premium_pdf';
  const text = [
    `${who}, 요청하신 종합사주 풀이를 PDF로 보내 드려요.`,
    '',
    '첨부한 파일을 휴대폰이나 컴퓨터에 저장해 두고 언제든 다시 읽어 보세요.',
    `궁금한 점이 생기면 사주500에서 사주대화로 물어볼 수 있어요: ${link}`,
    '',
    '이 메일은 사주500 결과 화면에서 직접 요청하신 결과지예요.',
    ...(consentLineText ? [consentLineText] : []),
    BIZ_LINE,
  ].join('\n');
  const html = `<div style="font-family:Pretendard,-apple-system,sans-serif;font-size:15px;line-height:1.75;color:#1A1612;max-width:560px">
<p>${escapeHtml(who)}, 요청하신 종합사주 풀이를 PDF로 보내 드려요.</p>
<p>첨부한 파일을 휴대폰이나 컴퓨터에 저장해 두고 언제든 다시 읽어 보세요.</p>
<p>궁금한 점이 생기면 <a href="${link}" style="color:#7A5C2E">사주500에서 사주대화로</a> 물어볼 수 있어요.</p>
<p style="font-size:12px;color:#8A8073;margin-top:28px">이 메일은 사주500 결과 화면에서 직접 요청하신 결과지예요.${marketingConsent ? `<br>${consentDate}에 신년운세와 할인 소식 메일(광고성 정보) 수신에 동의하셨어요. <a href="${unsubUrl(uid, token)}" style="color:#8A8073">그만 받기</a>` : ''}<br>${BIZ_LINE}</p>
</div>`;
  try {
    await transport.sendMail({
      from: `"사주500" <${FROM_ADDR}>`,
      to: email,
      subject: `[사주500] ${who}의 종합사주 풀이 PDF`,
      text,
      html,
      attachments: [{ filename: `사주500_${name || '내'}_종합사주.pdf`, content: pdf, contentType: 'application/pdf' }],
    });
  } catch (e: any) {
    console.error('[mailPdf] 발송 실패', e?.code || '', e?.message || e);
    throw new HttpsError('internal', '메일을 보내지 못했어요. 주소를 확인하고 다시 시도해 주세요');
  }

  // 메일 주소와 광고 수신 동의 기록 (동의는 선택, 기본 아니오)
  await leadRef.set({
    email,
    unsubToken: token,
    marketingConsent: !!marketingConsent,
    ...(marketingConsent ? { marketingConsentAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    lastSource: 'premium_pdf',
    lastIssueId: issueId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true }).catch((e) => console.warn('[mailPdf] 기록 실패', e?.message));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
