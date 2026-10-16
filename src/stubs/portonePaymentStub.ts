/**
 * portonePaymentStub — 앱인토스(ait) 빌드 전용 스텁 (2026-06-17)
 *
 * 토스 미니앱은 토스페이/IAP 외 결제수단 연동 금지(심사 반려) → 포트원(PortOne) SDK 가
 * 앱 번들에 포함되면 안 됨. ait 빌드에서 vite.config alias 로 portonePayment → 이 스텁 치환.
 * (@portone/browser-sdk 를 import 하지 않으므로 SDK 코드가 ait 번들에 들어가지 않음.)
 *
 * 앱인토스에선 isPortoneTestEnabled() 가 항상 false 라 포트원 결제 경로가 런타임에서도 비활성.
 * 시그니처는 실제 portonePayment.ts 와 동일하게 유지 (ChargePage 무수정).
 */
export type PortonePgMethod = 'card' | 'kakaopay';

export function isPortoneTestEnabled(): boolean {
  return false; // 앱인토스: 포트원 결제 비노출 (토스 IAP 고정)
}

export interface PortoneTestResult {
  ok: boolean;
  cancelled: boolean;
  message: string;
}

export async function requestPortoneTestPayment(_opts: {
  method: PortonePgMethod;
  amount: number;
  orderName: string;
}): Promise<PortoneTestResult> {
  // 앱인토스에선 호출 경로가 없지만, 안전하게 no-op 반환
  return { ok: false, cancelled: false, message: '앱에서는 토스 결제를 이용해주세요' };
}

/* ── 실결제 시그니처 (2026-07-03 · portonePayment.ts 실결제 선구현과 동기) ──
 *  앱인토스는 토스 IAP 고정 — 전부 비활성 no-op. ait 빌드 깨짐 방지용 시그니처 미러. */

export interface PortoneLiveResult {
  ok: boolean;
  cancelled: boolean;
  message: string;
  totalUn?: number;
  paidUn?: number;
  bonusUn?: number;
}

export function isPortoneLiveEnabled(): boolean {
  return false; // 앱인토스: 포트원 실결제 비활성 (토스 IAP 고정)
}

export function isPortoneLiveMethod(_m: PortonePgMethod): boolean {
  return false; // 앱인토스: 결제수단별 실결제도 전부 비활성 (2026-10-16 portonePayment.ts 와 시그니처 동기)
}

export async function requestPortoneLivePayment(
  _pkg: unknown,
  _method: PortonePgMethod,
): Promise<PortoneLiveResult> {
  return { ok: false, cancelled: false, message: '앱에서는 토스 결제를 이용해주세요' };
}

export async function confirmPortonePaymentServer(
  _paymentId: string,
  _amount: number,
): Promise<PortoneLiveResult> {
  return { ok: false, cancelled: false, message: '앱에서는 토스 결제를 이용해주세요' };
}
