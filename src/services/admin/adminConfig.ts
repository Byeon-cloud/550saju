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
  '8Nda5XA4GwQfyjOLJk54i0ADdTb2', // 준기 · 현재 PC 웹 익명 세션 (편의 등록 · 쿠키 삭제 시 무효 → 구글 로그인 권장)
  // 토스앱 로그인 uid 는 다름 — 토스앱에서도 어드민 보려면 그 uid 추가
];

export function isOwner(uid: string | null | undefined): boolean {
  return !!uid && OWNER_UIDS.includes(uid);
}
