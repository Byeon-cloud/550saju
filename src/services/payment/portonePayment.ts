/**
 * portonePayment — 포트원 V2 테스트 결제 (PG 입점심사용 · 2026-06-12)
 *
 * 배경: 한국결제네트웍스·KG이니시스·카카오페이 입점심사는 "사이트에서 결제창이
 *   정상 호출되는 것"을 심사관이 직접 확인해야 진행됨 (포트원 안내 메일).
 *   → 웹 충전 페이지에 테스트 채널 결제창 호출만 구현 (실청구 X · 자동취소 · 운 적립 X).
 *
 * 전환 계획: PG 계약 완료 후 콘솔에서 실연동 채널 발급 → .env 의 채널 키만 교체 +
 *   서버 결제 검증(컨펌) 붙여서 웹 결제 오픈. 그 전까지 VITE_PORTONE_TEST=1 로만 노출.
 *
 * ⚠️ 이 모듈은 잔액(운)을 절대 건드리지 않는다 — 심사용 결제창 호출 전용.
 */
import * as PortOne from '@portone/browser-sdk/v2';

export type PortonePgMethod = 'card' | 'kakaopay';

const STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID as string | undefined;
const CHANNEL_INICIS = import.meta.env.VITE_PORTONE_CHANNEL_INICIS as string | undefined;
const CHANNEL_KAKAOPAY = import.meta.env.VITE_PORTONE_CHANNEL_KAKAOPAY as string | undefined;

/** 포트원 테스트 모드 활성 여부 (웹 전용 — 앱인토스는 토스 IAP 고정) */
export function isPortoneTestEnabled(): boolean {
  return import.meta.env.VITE_PORTONE_TEST === '1' && !!STORE_ID && !!CHANNEL_INICIS;
}

export interface PortoneTestResult {
  ok: boolean;
  cancelled: boolean;
  message: string;
}

/** 테스트 결제창 호출 — 성공해도 운 적립 없음 (자동취소되는 심사용 결제) */
export async function requestPortoneTestPayment(opts: {
  method: PortonePgMethod;
  amount: number;
  orderName: string;
}): Promise<PortoneTestResult> {
  if (!STORE_ID) return { ok: false, cancelled: false, message: '결제 설정이 아직 준비되지 않았어요' };
  const channelKey = opts.method === 'kakaopay' ? CHANNEL_KAKAOPAY : CHANNEL_INICIS;
  if (!channelKey) return { ok: false, cancelled: false, message: '해당 결제수단이 아직 준비되지 않았어요' };

  const paymentId = `pgtest-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  try {
    const resp = await PortOne.requestPayment({
      storeId: STORE_ID,
      channelKey,
      paymentId,
      orderName: opts.orderName,
      totalAmount: opts.amount,
      currency: 'CURRENCY_KRW',
      payMethod: opts.method === 'kakaopay' ? 'EASY_PAY' : 'CARD',
      // 모바일 리다이렉트 복귀 — 충전 페이지로 (테스트 완료 안내만)
      redirectUrl: `${window.location.origin}/charge?pgtest_done=1`,
      // 이니시스 V2 는 구매자 이름·이메일·휴대폰 필수 (누락 시 400) — 테스트용 고정값
      customer: { fullName: '심사테스트', email: 'pgtest@saju500.app', phoneNumber: '01012345678' },
    });
    if (resp?.code != null) {
      // 사용자가 창을 닫았거나 PG 측 거절
      const cancelled = String(resp.code).includes('CANCEL') || /취소/.test(resp.message || '');
      return { ok: false, cancelled, message: resp.message || '결제가 완료되지 않았어요' };
    }
    return { ok: true, cancelled: false, message: '테스트 결제가 완료됐어요 (자동 취소되며 청구되지 않아요)' };
  } catch (e: any) {
    return { ok: false, cancelled: false, message: e?.message || '결제창을 열지 못했어요' };
  }
}
