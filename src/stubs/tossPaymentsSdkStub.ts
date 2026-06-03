/**
 * 앱인토스 빌드 전용 — @tosspayments/tosspayments-sdk stub
 *
 * 작성: 2026-05-09 (앱인토스 심사 반려 후)
 *
 * 동작: ait 빌드 시 vite.config.ts alias 가 `@tosspayments/tosspayments-sdk`
 *       를 본 파일로 대체. SDK 본체 코드 (수백 KB) 가 번들에 안 들어감.
 *
 * 본 파일이 호출되는 경로 자체가 없어야 함 (앱인토스에서는 IAP 사용).
 */
export async function loadTossPayments(_clientKey: string): Promise<any> {
  throw new Error('앱인토스 미니앱은 토스페이먼츠 SDK 를 지원하지 않습니다.');
}

export default { loadTossPayments };
