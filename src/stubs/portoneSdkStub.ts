/**
 * portoneSdkStub — 앱인토스(ait) 빌드 전용 @portone/browser-sdk/v2 스텁 (2026-06-17)
 *
 * portonePayment 가 이미 stub 으로 치환되어 @portone 을 import 하지 않지만,
 * 토스 심사 스캐너가 번들에서 포트원 흔적을 0 으로 잡도록 SDK 패키지 자체도 빈 스텁으로 alias.
 */
export async function requestPayment(_opts: unknown): Promise<{ code?: string; message?: string }> {
  return { code: 'STUB', message: 'portone disabled in app build' };
}
