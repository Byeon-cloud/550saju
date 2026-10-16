/**
 * portonePayment — 포트원 V2 웹 결제 (심사용 테스트 + 실결제 · 2026-07-02 실결제 선구현)
 *
 * 두 모드:
 *   [심사용 테스트] requestPortoneTestPayment — 입점심사관 확인용 결제창 (실청구 X · 운 적립 X).
 *     VITE_PORTONE_TEST=1 로 노출. 잔액 절대 안 건드림.
 *   [실결제] requestPortoneLivePayment + confirmPortonePaymentServer — PG 계약 승인 후
 *     VITE_PORTONE_LIVE=1 + 실연동 채널키 + 서버 PORTONE_V2_API_SECRET 교체로 오픈.
 *     지급은 반드시 서버(confirmPortonePayment)가 포트원 조회 API 검증 후 수행 —
 *     서버가 LIVE 채널만 지급하므로 테스트 채널로는 구조적으로 적립 불가.
 */
import * as PortOne from '@portone/browser-sdk/v2';
import { auth } from '@/services/auth/firebase';
import type { ChargePackage } from '@/types/payment';

export type PortonePgMethod = 'card' | 'kakaopay';

const STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID as string | undefined;
const CHANNEL_INICIS = import.meta.env.VITE_PORTONE_CHANNEL_INICIS as string | undefined;
const CHANNEL_KAKAOPAY = import.meta.env.VITE_PORTONE_CHANNEL_KAKAOPAY as string | undefined;
/** 실연동 채널 키 (2026-10-16) — 테스트 키와 따로 둔다. PG 계약이 끝난 결제수단만 채운다(카카오페이 완료, 이니시스와 KPN 은 심사 중) */
const LIVE_CHANNEL_INICIS = import.meta.env.VITE_PORTONE_LIVE_CHANNEL_INICIS as string | undefined;
const LIVE_CHANNEL_KAKAOPAY = import.meta.env.VITE_PORTONE_LIVE_CHANNEL_KAKAOPAY as string | undefined;
const liveChannelOf = (m: PortonePgMethod): string | undefined => (m === 'kakaopay' ? LIVE_CHANNEL_KAKAOPAY : LIVE_CHANNEL_INICIS) || undefined;

/** 포트원 테스트 모드 활성 여부 (웹 전용 — 앱인토스는 토스 IAP 고정) */
export function isPortoneTestEnabled(): boolean {
  return import.meta.env.VITE_PORTONE_TEST === '1' && !!STORE_ID && !!CHANNEL_INICIS;
}

/** 포트원 실결제 활성 여부 — VITE_PORTONE_LIVE=1 이고 실연동 채널이 하나라도 있으면 ON */
export function isPortoneLiveEnabled(): boolean {
  return import.meta.env.VITE_PORTONE_LIVE === '1' && !!STORE_ID && (!!LIVE_CHANNEL_KAKAOPAY || !!LIVE_CHANNEL_INICIS);
}

/** 이 결제수단에 실연동 채널이 있는가 (없으면 화면이 '곧 열려요' 안내) */
export function isPortoneLiveMethod(m: PortonePgMethod): boolean {
  return isPortoneLiveEnabled() && !!liveChannelOf(m);
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

  // ⚠️ 'pgtest-' 접두사 유지 — 서버 confirmPortonePayment 의 uid 접두사 검증과 절대 충돌하지 않게
  //   (심사용 paymentId 는 서버 컨펌 호출 자체를 안 하지만, 형식으로도 구분)
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

/* ══════════════════════════════════════════════════════════════════
 * 실결제 (2026-07-02 선구현 — PG 계약 승인 후 VITE_PORTONE_LIVE=1 로 오픈)
 * ═════════════════════════════════════════════════════════════════ */

export interface PortoneLiveResult {
  ok: boolean;
  cancelled: boolean;
  message: string;
  totalUn?: number;
  paidUn?: number;
  bonusUn?: number;
}

/** paymentId — 서버 confirmPortonePayment 의 uid 바인딩 검증(접두사 uid 8자)과 반드시 일치 */
function generateLivePaymentId(uid: string, pkgId: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${uid.slice(0, 8)}_${pkgId}_${ts}_${rand}`;
}

/**
 * 포트원 실결제 요청 → (데스크톱) 즉시 서버 검증·지급까지.
 * 모바일 리다이렉트 플로우는 /charge?portone_pid=... 복귀 후 ChargePage 가 컨펌 호출.
 * 지급 진실은 서버 — 클라는 결제창 호출과 컨펌 요청만 한다.
 */
export async function requestPortoneLivePayment(
  pkg: ChargePackage,
  method: PortonePgMethod,
): Promise<PortoneLiveResult> {
  const user = auth.currentUser;
  if (!user) return { ok: false, cancelled: false, message: '로그인이 필요해요' };
  if (!STORE_ID) return { ok: false, cancelled: false, message: '결제 설정이 아직 준비되지 않았어요' };
  // 실결제는 실연동 채널 키만 (테스트 키로 실결제창을 열면 서버가 지급을 거부해 돈만 나간 것처럼 보인다)
  const channelKey = liveChannelOf(method);
  if (!channelKey) return { ok: false, cancelled: false, message: '해당 결제수단이 아직 준비되지 않았어요' };

  const paymentId = generateLivePaymentId(user.uid, pkg.id);
  try {
    const resp = await PortOne.requestPayment({
      storeId: STORE_ID,
      channelKey,
      paymentId,
      orderName: `사주500 ${pkg.name} (${pkg.un + pkg.bonusUn}운)`,
      totalAmount: pkg.price,
      currency: 'CURRENCY_KRW',
      payMethod: method === 'kakaopay' ? 'EASY_PAY' : 'CARD',
      // 서버 방어 ① 이중 확인용 — confirmPortonePayment 가 customData.uid 대조 (SDK 는 객체 수용)
      customData: { uid: user.uid, pkgId: pkg.id },
      // 모바일 리다이렉트 복귀 — ChargePage useEffect 가 portone_pid 로 컨펌 재개
      redirectUrl: `${window.location.origin}/charge?portone_pid=${encodeURIComponent(paymentId)}&portone_amount=${pkg.price}`,
      // 이니시스 V2 구매자 필수 필드 — 익명 유저 대비 폴백.
      // TODO(실오픈 QA): 이니시스 라이브가 placeholder 휴대폰을 거부하면 구매자 정보 입력 시트 추가.
      customer: {
        fullName: user.displayName || '사주500 고객',
        email: user.email || `user-${user.uid.slice(0, 8)}@saju500.app`,
        phoneNumber: '01000000000',
      },
    });
    if (resp?.code != null) {
      const cancelled = String(resp.code).includes('CANCEL') || /취소/.test(resp.message || '');
      return { ok: false, cancelled, message: resp.message || '결제가 완료되지 않았어요' };
    }
    // 데스크톱(팝업/iframe) — 결제창 완료 즉시 서버 검증·지급
    return await confirmPortonePaymentServer(paymentId, pkg.price);
  } catch (e: any) {
    return { ok: false, cancelled: false, message: e?.message || '결제창을 열지 못했어요' };
  }
}

/** 서버 검증·지급 호출 — 포트원 조회 API 검증(금액·PAID·LIVE 채널·uid)은 전부 서버에서 */
export async function confirmPortonePaymentServer(
  paymentId: string,
  amount: number,
): Promise<PortoneLiveResult> {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const { app } = await import('@/services/auth/firebase');
    const functions = getFunctions(app, 'us-central1');
    const fn = httpsCallable(functions, 'confirmPortonePayment');
    const r = await fn({ paymentId, amount });
    const d = r.data as { success: boolean; message: string; totalUn?: number; paidUn?: number; bonusUn?: number };
    return { ok: !!d.success, cancelled: false, message: d.message, totalUn: d.totalUn, paidUn: d.paidUn, bonusUn: d.bonusUn };
  } catch (e: any) {
    return { ok: false, cancelled: false, message: e?.message || '결제 확인 중 오류가 발생했어요' };
  }
}
