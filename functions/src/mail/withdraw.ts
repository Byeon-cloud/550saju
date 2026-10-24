/**
 * 메일 수신 거부를 '주소' 단위로 처리한다 (2026-10-25, 관리자 메일 판 검수)
 *
 *   아침 메일(dailyMailSubs)과 광고성 소식(emailLeads)은 계정(uid)마다 문서가 하나다. 웹은 익명 계정이 바뀌거나 휴대폰과 PC 가
 *   다른 계정이라, 같은 주소가 문서 여러 개에 있을 수 있다. 문서 하나만 끄면 다른 문서로 메일이 계속 간다.
 *   그래서 메일 속 '수신 거부'(mail/marketingMail.ts unsubscribeMail)와 오너의 '그만 보내기'(admin/mailList.ts) 모두 이 함수로
 *   같은 주소(대소문자 무시)의 문서를 한꺼번에 끈다.
 *
 *   개인정보 처리방침은 메일 주소를 '수신 동의 철회 시까지' 보관한다고 적었다. 그래서 끈 아침 메일 문서에서는 주소, 이름, 출생 연도를 지우고
 *   철회 기록(withdrawnAt, 주소의 해시)만 남긴다. 광고성 소식 문서는 결과지 메일(PDF) 기록이 아니면 주소를 지운다(결과지 주소는 그 보관 목적이 따로 있다).
 */
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

export type WithdrawScope = 'daily' | 'ad' | 'all';
const norm = (e: unknown) => String(e || '').trim().toLowerCase();
export const emailHash = (e: string) => createHash('sha256').update(norm(e)).digest('hex');

/** 이 주소(들)를 쓰는 문서를 모두 끈다. 끈 문서 번호를 돌려준다 */
export async function withdrawByEmail(emails: string[], scope: WithdrawScope, by: string): Promise<{ daily: string[]; ad: string[] }> {
  const want = new Set(emails.map(norm).filter(Boolean));
  const out = { daily: [] as string[], ad: [] as string[] };
  if (!want.size) return out;
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const del = admin.firestore.FieldValue.delete();
  const batch = db.batch();
  let n = 0;
  if (scope === 'daily' || scope === 'all') {
    // 구독 장부는 많아야 1,500명(iljuDaily MAX_SUBS) — 통째로 읽어 대소문자 무시로 맞춘다
    const subs = await db.collection('dailyMailSubs').select('email', 'active').get();
    for (const s of subs.docs) {
      const e = s.get('email');
      if (!e || !want.has(norm(e))) continue;
      const pii = { emailHash: emailHash(e), email: del, name: del, birthYear: del, updatedAt: now };
      // 이미 그만 받은 문서는 개인정보만 지운다(철회 날짜를 오늘로 바꾸면 그만 받은 날 통계가 옮겨 간다)
      if (s.get('active')) { batch.set(s.ref, { ...pii, active: false, withdrawnAt: now, withdrawnBy: by }, { merge: true }); out.daily.push(s.id); }
      else batch.set(s.ref, pii, { merge: true });
      n += 1;
    }
  }
  if (scope === 'ad' || scope === 'all') {
    const leads = await db.collection('emailLeads').select('email', 'marketingConsent', 'lastIssueId', 'lastSource').get();
    for (const l of leads.docs) {
      const e = l.get('email');
      if (!e || !want.has(norm(e))) continue;
      const pdf = !!l.get('lastIssueId') || l.get('lastSource') === 'premium_pdf';
      const on = !!l.get('marketingConsent');
      if (!on && pdf) continue; // 결과지 기록만 있고 이미 광고 동의가 없으면 그대로 둔다
      const pii = pdf ? {} : { emailHash: emailHash(e), email: del };
      if (on) { batch.set(l.ref, { ...pii, marketingConsent: false, marketingWithdrawnAt: now, withdrawnBy: by, updatedAt: now }, { merge: true }); out.ad.push(l.id); }
      else batch.set(l.ref, { ...pii, updatedAt: now }, { merge: true }); // 이미 철회한 광고 전용 문서는 주소만 지운다
      n += 1;
    }
  }
  if (n) await batch.commit();
  return out;
}
