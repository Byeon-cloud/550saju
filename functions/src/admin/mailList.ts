/**
 * 관리자 '메일' 판의 명단 (2026-10-24, 오너 지시 '이메일 누가 우리한테 줬는지, 싫어하는 사람은 취소')
 *
 *   adminMailList   메일 주소를 준 사람 한 줄씩: 아침 운세 메일(dailyMailSubs), 광고성 소식 동의와 결과지 메일(emailLeads),
 *                   웹 문의 답장 주소(inquiries)를 계정(uid)으로 합친다. 문의 주소는 답장용이라 광고 메일에 쓰면 안 된다.
 *                   주소는 가려서 보낸다(ab***@gm***.com). { reveal: uid } 로 한 사람 주소만 다 보고, 본 기록을 adminAudit 에 남긴다.
 *                   { full: true } 는 전체 주소(오너 화면의 '주소 전부 보기', CSV 내려받기). 이때도 몇 명을 봤는지 adminAudit 에 남긴다.
 *   adminMailOptOut 고객이 문의로 '메일 그만'을 말했을 때 오너가 대신 끊는다. { uid, scope: 'daily'|'ad'|'all' }.
 *                   메일 속 '수신 거부' 링크(mail/marketingMail.ts unsubscribeMail)와 같은 칸을 바꾸고, 누가 끊었는지 남긴다.
 *   결제는 처음 메일을 준 날 뒤의 결제 장부(status confirmed)만 더한다. 오너 계정은 owner 표시만 하고 숫자에서는 화면이 뺀다.
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertOwner, OWNER_UIDS } from './owner';
import { kstDayOf } from './stats';
import { withdrawByEmail, type WithdrawScope } from '../mail/withdraw';

/** 광고성 소식 문서의 주소를 보여 줘도 되나: 지금 동의했거나, 결과지 메일(PDF) 기록이라 따로 보관하는 주소 */
const keepLead = (d: any): boolean => !!d && (!!d.marketingConsent || !!d.lastIssueId || d.lastSource === 'premium_pdf');

const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;
const tsMs = (v: any): number => {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v) || 0;
  return 0;
};

/** ab***@gm***.com — 앞 두 글자와 도메인 앞 두 글자, 끝(.com 등)만 남긴다 */
export function maskEmail(raw: unknown): string {
  const e = String(raw || '');
  const at = e.indexOf('@');
  if (at < 1) return e ? '***' : '';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${local.slice(0, Math.min(2, local.length - 1) || 1)}***@${host.slice(0, 2)}***${tld}`;
}

const ageGroup = (birthYear: number, nowYear: number): string => {
  if (!birthYear) return '';
  const a = nowYear - birthYear;
  return a < 20 ? '10대' : a < 30 ? '20대' : a < 40 ? '30대' : a < 50 ? '40대' : a < 60 ? '50대' : '60대 이상';
};

async function audit(by: string, action: string, target: string, extra: Record<string, unknown> = {}) {
  await admin.firestore().collection('adminAudit').add({ at: admin.firestore.FieldValue.serverTimestamp(), by, action, target, ...extra });
}

export const adminMailList = onCall({ timeoutSeconds: 120, memory: '512MiB', cors: true }, async (request) => {
  const by = assertOwner(request);
  const db = admin.firestore();

  const reveal = String(request.data?.reveal || '');
  if (reveal) {
    if (!UID_RE.test(reveal)) throw new HttpsError('invalid-argument', '계정 번호가 올바르지 않아요');
    const [s, l, q] = await Promise.all([
      db.doc(`dailyMailSubs/${reveal}`).get(), db.doc(`emailLeads/${reveal}`).get(),
      db.collection('inquiries').where('uid', '==', reveal).limit(20).get().catch(() => null),
    ]);
    // 그만 받은 사람의 주소는 보여 주지 않는다(보관 목적이 끝났다). 문의 주소는 답장용으로 보여 준다
    const daily = s.data()?.active ? String(s.data()?.email || '') : '';
    const lead = keepLead(l.data()) ? String(l.data()?.email || '') : '';
    // 문의는 메일 칸이 빈 것도 있다 — 주소가 있는 것 중 가장 최근 것
    const inq = (q?.docs || []).filter((d) => d.get('email')).sort((a, b) => tsMs(b.get('createdAt')) - tsMs(a.get('createdAt')))[0];
    const email = daily || lead || String(inq?.get('email') || '');
    if (!email) throw new HttpsError('not-found', '보여 줄 수 있는 메일 주소가 없어요(그만 받았거나 지워졌어요)');
    await audit(by, 'mail_reveal', reveal);
    return { uid: reveal, email, adEmail: l.data()?.marketingConsent ? lead : '' };
  }

  const full = request.data?.full === true;
  const [subsSnap, leadsSnap, inqSnap] = await Promise.all([
    db.collection('dailyMailSubs').get(), db.collection('emailLeads').get(),
    db.collection('inquiries').select('uid', 'email', 'createdAt').get().catch(() => null),
  ]);
  const nowYear = Number(kstDayOf(Date.now()).slice(0, 4));
  type Row = {
    uid: string; owner: boolean; email: string; emailFull?: string; adEmailFull?: string; firstMs: number; firstDay: string;
    daily: 'on' | 'off' | null; dailyDay: string; dailyOffDay: string; dailySource: string; age: string; ilju: string;
    ad: 'on' | 'off' | 'none' | null; adDay: string; adOffDay: string; adSource: string;
    inquiryDay: string; inquiries: number;
    /** 그만 받았는데 주소가 아직 남은 문서(10-25 전에 수신 거부한 사람) — 화면의 '주소 지우기' */
    piiLeft: boolean;
    paid: number; payCount: number;
  };
  const rows = new Map<string, Row>();
  const get = (uid: string): Row => {
    let r = rows.get(uid);
    if (!r) {
      r = { uid, owner: OWNER_UIDS.includes(uid), email: '', firstMs: 0, firstDay: '', daily: null, dailyDay: '', dailyOffDay: '', dailySource: '', age: '', ilju: '',
        ad: null, adDay: '', adOffDay: '', adSource: '', inquiryDay: '', inquiries: 0, piiLeft: false, paid: 0, payCount: 0 };
      rows.set(uid, r);
    }
    return r;
  };
  const first = (r: Row, ms: number) => { if (ms && (!r.firstMs || ms < r.firstMs)) r.firstMs = ms; };

  for (const s of subsSnap.docs) {
    const d = s.data() as any;
    const r = get(s.id);
    // 그만 받은 아침 메일 주소는 가린 모양으로도 내보내지 않는다(2026-10-25 이후 수신 거부 때 지운다, mail/withdraw.ts)
    if (d.active && d.email) {
      r.email = r.email || maskEmail(d.email);
      if (full && !r.emailFull) r.emailFull = String(d.email);
    } else if (!d.active && d.email) r.piiLeft = true;
    r.daily = d.active ? 'on' : 'off';
    r.dailyDay = String(d.consentDay || '');
    r.dailyOffDay = !d.active && d.withdrawnAt ? kstDayOf(tsMs(d.withdrawnAt)) : '';
    r.dailySource = String(d.source || '');
    r.age = ageGroup(Number(d.birthYear) || 0, nowYear);
    r.ilju = String(d.ilju || '');
    first(r, tsMs(d.consentAt) || Date.parse(`${r.dailyDay}T00:00:00+09:00`) || 0);
  }
  for (const l of leadsSnap.docs) {
    const d = l.data() as any;
    const r = get(l.id);
    if (!keepLead(d) && d.email) r.piiLeft = true;
    if (keepLead(d) && d.email) {
      r.email = r.email || maskEmail(d.email);
      if (full && !r.emailFull) r.emailFull = String(d.email);
      // 광고성 소식은 emailLeads 주소로 간다. 광고 명단과 CSV 는 이 주소를 쓴다(아침 메일 주소와 다를 수 있다)
      if (full && d.marketingConsent) r.adEmailFull = String(d.email);
    }
    r.ad = d.marketingConsent ? 'on' : d.marketingWithdrawnAt ? 'off' : 'none';
    r.adDay = String(d.marketingConsentDay || (d.marketingConsentAt ? kstDayOf(tsMs(d.marketingConsentAt)) : ''));
    r.adOffDay = !d.marketingConsent && d.marketingWithdrawnAt ? kstDayOf(tsMs(d.marketingWithdrawnAt)) : '';
    r.adSource = String(d.lastSource || '');
    first(r, tsMs(d.marketingConsentAt) || tsMs(d.updatedAt));
  }

  for (const q of inqSnap?.docs || []) {
    const d = q.data() as any;
    const uid = String(d.uid || '');
    if (!d.email || !UID_RE.test(uid)) continue;
    const r = get(uid);
    const ms = tsMs(d.createdAt);
    r.email = r.email || maskEmail(d.email);
    if (full && !r.emailFull) r.emailFull = String(d.email);
    r.inquiries += 1;
    const day = ms ? kstDayOf(ms) : '';
    if (day > r.inquiryDay) r.inquiryDay = day;
    first(r, ms);
  }

  for (const r of rows.values()) r.firstDay = r.firstMs ? kstDayOf(r.firstMs) : (r.dailyDay || r.adDay);
  const list = [...rows.values()].sort((a, b) => b.firstMs - a.firstMs).slice(0, 3000);
  // 메일을 준 뒤의 결제 (확정 장부만). 문의 주소만 있는 사람은 메일 효과와 상관이 없어 세지 않는다
  const subscribed = list.filter((r) => r.daily !== null || r.ad !== null);
  for (let i = 0; i < subscribed.length; i += 20) {
    await Promise.all(subscribed.slice(i, i + 20).map(async (r) => {
      const pays = await db.collection(`users/${r.uid}/payments`).where('status', '==', 'confirmed').get().catch(() => null);
      if (!pays) return;
      for (const p of pays.docs) {
        const d = p.data() as any;
        const at = tsMs(d.confirmedAt) || tsMs(d.createdAt);
        if (!at || (r.firstMs && at < r.firstMs)) continue;
        r.paid += Number(d.amount) || 0; r.payCount += 1;
      }
    }));
  }
  if (full) await audit(by, 'mail_list_full', 'all', { count: list.length, purpose: String(request.data?.purpose || '').slice(0, 40) });
  return { rows: list.map(({ firstMs: _f, ...rest }) => rest), total: rows.size };
});

export const adminMailOptOut = onCall({ timeoutSeconds: 30, memory: '256MiB', cors: true }, async (request) => {
  const by = assertOwner(request);
  const uid = String(request.data?.uid || '');
  const scope = String(request.data?.scope || 'all');
  if (!UID_RE.test(uid)) throw new HttpsError('invalid-argument', '계정 번호가 올바르지 않아요');
  if (!['daily', 'ad', 'all'].includes(scope)) throw new HttpsError('invalid-argument', 'scope 는 daily, ad, all 중 하나예요');
  const db = admin.firestore();
  // 이 계정의 주소(아침 메일, 광고성 소식, 문의)를 모아 같은 주소를 쓰는 모든 계정의 문서를 끈다(mail/withdraw.ts)
  const [s, l, q] = await Promise.all([
    db.doc(`dailyMailSubs/${uid}`).get(), db.doc(`emailLeads/${uid}`).get(),
    db.collection('inquiries').where('uid', '==', uid).limit(5).get().catch(() => null),
  ]);
  const emails = [s.data()?.email, l.data()?.email, ...(q?.docs || []).map((d) => d.get('email'))].map((e) => String(e || '')).filter(Boolean);
  const res = await withdrawByEmail(emails, scope as WithdrawScope, 'owner');
  const done = [...(res.daily.length ? ['daily'] : []), ...(res.ad.length ? ['ad'] : [])];
  await audit(by, 'mail_opt_out', uid, { scope, done, dailyUids: res.daily, adUids: res.ad, cleanedUids: res.cleaned, reason: String(request.data?.reason || '').slice(0, 200) });
  return { ok: true, done, accounts: new Set([...res.daily, ...res.ad]).size, cleaned: res.cleaned.length };
});
