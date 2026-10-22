/**
 * 이 손님이 결제한 적이 있는지 (2026-10-22, 1.6.3 P1-1 충전 화면)
 *
 *   충전 화면에서 처음 결제하는 손님에게 7운 묶음 안내를 붙이고, charge_view 에 firstPayer 를 남기려고 쓴다.
 *   판정은 두 단계다.
 *     1) 이 기기 기록 — 결제를 마치면 남기는 표시, 토스 픽셀 첫 결제 표시, 웹 결제 번호 메모, 앱 결제 복구 기록
 *     2) 서버 users/{uid}.totalCharged — 기기 기록이 없을 때만 한 번 읽는다(10-22 전에 결제해 표시가 없는 손님).
 *        읽어서 결제 기록이 있으면 이 기기에 표시를 남겨 다음부터는 읽지 않는다.
 *   잔액의 paid 칸은 쓰지 않는다(실패 환불, 예전 기본 1운, 기기 여권 복원도 paid 로 들어와 결제 여부와 다르다).
 *   금액과 결제 수단은 여기서 다루지 않는다. 지급과 환불 판정은 전부 서버가 한다.
 */

const PAID_KEY = 'saju500:paid_once';
const LOCAL_SIGNS = [
  PAID_KEY,
  'saju500:tp_first_purchase', // 토스 픽셀 첫 결제 (tossPixel.ts)
];
const LOCAL_LISTS = [
  'saju500:web_payments', // 웹 포트원 결제 번호 메모 (refundRequest.ts)
  'saju500:iap_processed_orders:v1', // 앱 미지급 주문 복구 (iapService.ts)
];

/** 결제를 마친 순간 부른다 (앱 IAP, 웹 포트원, 웹 결제 복귀) */
export function markPaidOnce(): void {
  try { localStorage.setItem(PAID_KEY, String(Date.now())); } catch { /* noop */ }
}

/** 이 기기 기록만으로 본 결제 여부 (바로 답한다) */
export function hasPaidLocally(): boolean {
  try {
    if (LOCAL_SIGNS.some((k) => !!localStorage.getItem(k))) return true;
    return LOCAL_LISTS.some((k) => {
      try {
        const v = JSON.parse(localStorage.getItem(k) || '[]');
        return Array.isArray(v) && v.length > 0;
      } catch { return false; }
    });
  } catch { return false; }
}

/** 서버 기록으로 본 결제 여부 — true 결제 있음, false 없음, null 모름(로그인 전, 문서 없음, 네트워크 실패, 시간 초과) */
export async function hasPaidOnServer(timeoutMs = 4000): Promise<boolean | null> {
  const work = (async (): Promise<boolean | null> => {
    try {
      const [{ auth, db }, { doc, getDoc }] = await Promise.all([
        import('@/services/auth/firebase'),
        import('firebase/firestore'),
      ]);
      try { await auth.authStateReady(); } catch { /* 구형 SDK — 지금 상태로 본다 */ }
      const uid = auth.currentUser?.uid;
      if (!uid) return null;
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return null;
      const paid = Number((snap.data() as Record<string, unknown>)?.totalCharged) > 0;
      if (paid) markPaidOnce();
      return paid;
    } catch { return null; }
  })();
  const timeout = new Promise<null>((res) => setTimeout(() => res(null), timeoutMs));
  return Promise.race([work, timeout]);
}
