/**
 * 토스페이먼츠 웹 PG 결제
 * 흐름: requestTossPayment() → 토스 결제 페이지 리다이렉트 → /charge?paymentKey=...로 복귀 → confirmTossPayment()
 */
import type { ChargePackage } from '@/types/payment';
import { auth } from '@/services/auth/firebase';

const CLIENT_KEY = import.meta.env.VITE_TOSS_PAYMENTS_CLIENT_KEY;

/** 토스페이먼츠 SDK 인스턴스 (싱글톤) */
let tossPaymentsPromise: Promise<any> | null = null;

async function getTossPayments() {
  if (!tossPaymentsPromise) {
    const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk');
    tossPaymentsPromise = loadTossPayments(CLIENT_KEY);
  }
  return tossPaymentsPromise;
}

/** orderId 생성 */
function generateOrderId(uid: string, pkgId: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${uid.slice(0, 8)}_${pkgId}_${ts}_${rand}`;
}

/**
 * 토스페이먼츠 결제 요청 — 결제 페이지로 리다이렉트
 * 성공 시 /charge?paymentKey=...&orderId=...&amount=... 로 돌아옴
 */
export async function requestTossPayment(pkg: ChargePackage): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요');

  const tossPayments = await getTossPayments();
  const payment = tossPayments.payment({ customerKey: user.uid });

  const orderId = generateOrderId(user.uid, pkg.id);
  const origin = window.location.origin;

  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: pkg.price },
    orderId,
    orderName: `사주500 ${pkg.name} (${pkg.un + pkg.bonusUn}운)`,
    customerEmail: user.email || undefined,
    customerName: user.displayName || undefined,
    successUrl: `${origin}/charge?pg=success`,
    failUrl: `${origin}/charge?pg=fail`,
  });
}

/**
 * 결제 확인 — 서버에서 토스 API로 최종 승인
 */
export async function confirmTossPayment(
  paymentKey: string,
  orderId: string,
  amount: number,
): Promise<{ success: boolean; message: string; totalUn?: number; paidUn?: number; bonusUn?: number }> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const { app } = await import('@/services/auth/firebase');
  const functions = getFunctions(app, 'asia-northeast3');
  const confirmFn = httpsCallable(functions, 'confirmPayment');

  const result = await confirmFn({ paymentKey, orderId, amount });
  return result.data as { success: boolean; message: string; totalUn?: number; paidUn?: number; bonusUn?: number };
}
