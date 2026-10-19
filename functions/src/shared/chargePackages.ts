/**
 * 충전 묶음 표 (서버 기준) — 금액 → 결제 운 + 보너스 운.
 *   결제 확인(포트원), 환불 회수(포트원, 토스 앱 결제)가 이 표 하나를 쓴다. 클라이언트 표는 src/constants/pricing.ts CHARGE_PACKAGES.
 *   환불 때 거둘 운은 결제 기록의 값(클라이언트가 보낸 값일 수 있음)이 아니라 이 표로 정한다.
 */
export const PACKAGE_MAP: Record<number, { name: string; paidUn: number; bonusUn: number }> = {
  500: { name: '한 번만', paidUn: 1, bonusUn: 0 },
  1500: { name: '좀 더 보자', paidUn: 3, bonusUn: 1 },
  2500: { name: '제대로 보자', paidUn: 5, bonusUn: 2 },
  5000: { name: '올해 다 보자', paidUn: 10, bonusUn: 5 },
};
