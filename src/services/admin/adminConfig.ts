/**
 * 어드민(오너) 접근 제어 SSOT — 2026-05-29.
 *
 * 오너 본인 uid 만 /admin 대시보드 + Firestore 집계 데이터 접근 가능.
 * firestore.rules 의 OWNER 체크와 반드시 동일하게 유지 (둘 다 같은 uid 목록).
 *
 * ⚠️ 등록 방법:
 *   1. /admin 접속 → "현재 uid" 표시됨
 *   2. 그 uid 를 아래 OWNER_UIDS 에 추가 + firestore.rules 의 isOwner() 에도 동일 추가
 *   3. 재배포 (hosting + firestore:rules)
 */
export const OWNER_UIDS: string[] = [
  '6C4MSgYY5UMLBpsth0ehx3Pyj0K3', // 준기 · quswnsrl202@naver.com (구글 웹 로그인) · 안정적 권장
  '8Nda5XA4GwQfyjOLJk54i0ADdTb2', // 준기 · PC 웹 익명 세션 (편의 등록 · 쿠키 삭제 시 무효 → 구글 로그인 권장)
  'biXRUeNouMhbtPVMDcaylJUqFqj1', // 준기 · saju500.app 익명 세션 (2026-06-11 등록 · 쿠키 삭제 시 무효)
  '91KZVwV9foacOMJXMMZ9eWmZ4FQ2', // 준기 · 익명 세션 (2026-06-12 응급 등록 · 쿠키 삭제 시 무효)
  'PWfJGV5QeYTkbNlhbXFYNWcfsnT2', // 준기 · saju500.app 익명 세션 (2026-06-23 · 도메인 분리로 uid 다름 · 영구해결=Auth 승인도메인+구글로그인)
  // 토스앱 로그인 uid 는 다름 — 토스앱에서도 어드민 보려면 그 uid 추가
];

/** 영구 오너 — 이메일 기준 (2026-06-12). 익명 uid 는 쿠키 삭제마다 바뀌어 '됐다 안 됐다' 문제의 원인.
 *  구글 로그인 1번이면 어떤 브라우저·기기에서든 영구 통과. firestore.rules isOwner() 와 동일 유지. */
export const OWNER_EMAILS: string[] = [
  'quswnsrl202@naver.com',
];

export function isOwner(uid: string | null | undefined, email?: string | null): boolean {
  if (email && OWNER_EMAILS.includes(email.toLowerCase())) return true;
  return !!uid && OWNER_UIDS.includes(uid);
}
