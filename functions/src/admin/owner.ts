/**
 * 오너(관리자) 판정 — 서버 관리자 함수 공통 (2026-10-19)
 *   예전엔 adminGrantCompensation 안에 목록을 따로 들고 있었다. 서버 함수는 이 파일 하나를 쓴다.
 *   같은 목록이 src/services/admin/adminConfig.ts(화면 접근)와 firestore.rules isOwner()(직접 읽기)에도 있다 — 셋을 같이 고친다.
 *   이메일 판정은 확인된 이메일(email_verified)만 인정한다(다른 로그인 수단으로 같은 이메일을 적어 들어오는 것 차단).
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';

export const OWNER_UIDS = [
  '6C4MSgYY5UMLBpsth0ehx3Pyj0K3', // 준기, 구글 웹
  '8Nda5XA4GwQfyjOLJk54i0ADdTb2', // 준기, PC 웹 익명
  'biXRUeNouMhbtPVMDcaylJUqFqj1', // 준기, saju500.app 익명
  '91KZVwV9foacOMJXMMZ9eWmZ4FQ2', // 준기, 익명 응급
  'PWfJGV5QeYTkbNlhbXFYNWcfsnT2', // 준기, saju500.app 세션
];
export const OWNER_EMAILS = ['quswnsrl202@naver.com'];

export function isOwnerAuth(auth: CallableRequest['auth']): boolean {
  if (!auth?.uid) return false;
  if (OWNER_UIDS.includes(auth.uid)) return true;
  const email = String(auth.token?.email || '').toLowerCase();
  return !!email && OWNER_EMAILS.includes(email) && auth.token?.email_verified === true;
}

/** 오너가 아니면 막는다 (진단용으로 지금 uid 를 알려 준다 — 목록 누락을 바로 알 수 있게) */
export function assertOwner(request: CallableRequest): string {
  if (!isOwnerAuth(request.auth)) {
    const uid = request.auth?.uid || 'none';
    const email = String(request.auth?.token?.email || '') || 'none';
    throw new HttpsError('permission-denied', `오너 전용 — 현재 uid: ${uid}, email: ${email}`);
  }
  return request.auth!.uid;
}
