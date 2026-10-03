/**
 * 앱인토스 인앱결제(IAP) + 웹 결제 서비스
 *
 * 앱인토스 IAP 정책:
 * - SDK: @apps-in-toss/web-framework (v1.1.3+)
 * - 상품 유형: 소모품(Consumable) — "운(運)"
 * - 수수료: 앱마켓 15% + 토스 5% = 20%
 * - 최소 가격: 공급가 400원(VAT별도), 소비자가 ~440원
 * - processProductGrant 콜백에서 서버 지급 처리 필수
 * - 앱 시작 시 getPendingOrders()로 미지급 주문 복구 필수
 *
 * @see https://developers-apps-in-toss.toss.im/iap/develop.html
 */

import { addPaidBalance, spendBalance } from '@/services/storage/localStore';
import type { ChargePackage } from '@/types/payment';

/** 앱인토스 환경인지 감지 */
export function isAppsInToss(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('TossApp');
}

/**
 * IAP 상품 SKU 매핑 — #55 정정 (2026-04-27, 4 패키지 진본)
 *
 * 토스 콘솔 진본 4 패키지 (1/4/7/15운) 정렬:
 *  - p1   1운  / 500원   — paidUn=1,  bonusUn=0
 *  - p4   4운  / 1500원  — paidUn=3,  bonusUn=1
 *  - p7   7운  / 2500원  — paidUn=5,  bonusUn=2
 *  - p15  15운 / 5000원  — paidUn=10, bonusUn=5  ★ 프리미엄 라인 (가장 인기)
 *
 * 토스 콘솔 표기 "14운(10+5)" 은 typo — 실제 SKU 명에 "15운" 명시 (10+5=15).
 *
 * **Superseded (2026-04-24 5 패키지 결정 무효)**:
 *  - 구 p5/p10/p30/p50 SKU 매핑 제거 — `pricing.ts LEGACY_PACKAGE_ALIASES` 로 자동 변환.
 *  - p7 = 구 p5 SKU 재사용 (가격 2500원 동일, 보너스만 추가)
 *  - p15 = 구 p10 SKU 재사용 (가격 5000원 동일, 보너스만 추가)
 *  - p4 = 신규 SKU (1500원 가격대 신설)
 */
const IAP_PRODUCT_MAP: Record<string, { sku: string; paidUn: number; bonusUn: number }> = {
  p1:  { sku: 'ait.0000025955.8f74931d.d3f5a2a979.5185316383', paidUn: 1,  bonusUn: 0 },
  p4:  { sku: 'ait.0000025955.5d5bec27.6ee0778e2a.5185547787', paidUn: 3,  bonusUn: 1 },
  p7:  { sku: 'ait.0000025955.79d2ae48.26de419a84.5185590911', paidUn: 5,  bonusUn: 2 },
  p15: { sku: 'ait.0000025955.304b4aa7.cabbd01e5e.5185730660', paidUn: 10, bonusUn: 5 },
};

/**
 * 인앱결제 요청
 */
/**
 * IAP 실패 사유별 안내 (2026-10-03) — 실측 충전 실패 70건 중 '토스 환경 제한' 10·'한국 계정 전용' 7건이
 *   사유 없이 '결제가 취소되었거나 오류가 발생했습니다' 한 줄만 보여 유저가 해결 방법을 몰랐다.
 *   코드 정의: 앱인토스 인앱결제 문서 (INVALID_USER_ENVIRONMENT · KOREAN_ACCOUNT_ONLY · USER_CANCELED).
 */
function iapErrorMessage(error: any): string {
  const code = String(error?.code || error?.type || '').toUpperCase();
  switch (code) {
    case 'USER_CANCELED':
      return '결제를 취소했어요';
    case 'KOREAN_ACCOUNT_ONLY':
      return '한국 App Store 계정에서만 결제할 수 있어요. 기기의 App Store 국가·지역을 대한민국으로 바꾼 뒤 다시 시도해 주세요.';
    case 'INVALID_USER_ENVIRONMENT':
      return '지금 기기·계정 설정에서는 결제가 제한돼 있어요. 토스 앱을 최신 버전으로 업데이트한 뒤 다시 시도하고, 계속되면 고객문의로 알려주세요.';
    case 'INTERNAL_ERROR':
      return '결제 처리 중 잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요. 결제가 완료됐다면 운은 자동으로 들어가요.';
    default:
      return '결제가 완료되지 않았어요. 잠시 후 다시 시도해 주세요.';
  }
}

export async function purchasePackage(pkg: ChargePackage): Promise<{ success: boolean; message: string }> {
  if (isAppsInToss()) {
    return purchaseViaIAP(pkg);
  }
  return purchaseViaWeb(pkg);
}

/**
 * 앱인토스 IAP 구매
 * SDK 1.1.3+ 필수 — processProductGrant 콜백 포함
 */
async function purchaseViaIAP(pkg: ChargePackage): Promise<{ success: boolean; message: string }> {
  // legacy 패키지 ID 대비 — pricing.ts LEGACY_PACKAGE_ALIASES 와 동일 매핑
  const { LEGACY_PACKAGE_ALIASES } = await import('@/constants/pricing');
  const resolvedId = LEGACY_PACKAGE_ALIASES[pkg.id] ?? pkg.id;
  const product = IAP_PRODUCT_MAP[resolvedId];
  if (!product) return { success: false, message: '상품 정보를 찾을 수 없습니다' };

  return new Promise((resolve) => {
    try {
      // 동적 import — 런타임에만 로드 (Vite 정적분석 우회)
      import('@apps-in-toss/web-framework').then((mod: any) => {
        const IAP = mod.IAP;
        IAP.createOneTimePurchaseOrder({
          options: {
            sku: product.sku,
            processProductGrant: async ({ orderId }: { orderId: string }) => {
              // 30초 내에 return true 해야 함 (앱인토스 정책)
              // 로컬 먼저 적립 → 서버는 비동기로 (실패 시 getPendingOrders로 복구)
              try {
                // 1. 로컬 즉시 적립 (UX 빠르게)
                addPaidBalance(product.paidUn, product.bonusUn);
                // 측정 — IAP 충전 완료 (2026-06-12: 웹 PG만 찍히고 IAP 누락이던 갭 fix)
                import('@/services/analytics').then(a => a.trackEvent('charge_complete', { amount: pkg.price, package: resolvedId, pg: 'iap' })).catch(() => {});

                // 2. 서버에 비동기 기록 (실패해도 return true — restorePendingPurchases 가 복구)
                // 2026-05-28 — silent fail 보강: 실패 시 console.error + pending orderId 로컬 큐 적재
                import('firebase/functions').then(({ getFunctions, httpsCallable }) => {
                  const fns = getFunctions(undefined, 'us-central1');
                  httpsCallable(fns, 'grantPurchase')({
                    orderId,
                    sku: product.sku,
                    paidUn: product.paidUn,
                    bonusUn: product.bonusUn,
                  }).catch((err) => {
                    console.error('[IAP] grantPurchase 실패 (restorePendingPurchases 가 복구):', orderId, err);
                    try {
                      const key = 'saju500:iap_pending_grants:v1';
                      const existing = JSON.parse(localStorage.getItem(key) || '[]');
                      existing.push({ orderId, sku: product.sku, paidUn: product.paidUn, bonusUn: product.bonusUn, ts: Date.now() });
                      localStorage.setItem(key, JSON.stringify(existing));
                    } catch { /* noop */ }
                  });
                });

                return true; // 30초 제한 내에 즉시 반환
              } catch {
                return false;
              }
            },
          },
          onEvent: (event: any) => {
            if (event.type === 'success') {
              const total = product.paidUn + product.bonusUn;
              resolve({
                success: true,
                message: `${total}운이 충전되었습니다!`,
              });
            }
          },
          onError: (error: any) => {
            console.error('[IAP] 구매 오류:', error);
            // 2026-06-18 — IAP 결제 실패/취소 트래킹 (결제 퍼널 drop-off · 기존 미트래킹)
            import('@/services/analytics').then((a) => a.trackEvent('charge_failed', { pg: 'iap', reason: String(error?.code || error?.type || error?.message || 'unknown').slice(0, 60) })).catch(() => {});
            resolve({ success: false, message: iapErrorMessage(error) });
          },
        });
      }).catch(() => {
        resolve({ success: false, message: '결제 모듈을 불러올 수 없습니다' });
      });
    } catch {
      resolve({ success: false, message: '결제 처리 중 오류가 발생했습니다' });
    }
  });
}

/**
 * 앱 시작 시 미지급 주문 복구
 * 결제는 완료됐지만 서버 지급이 실패한 경우 복구
 * App.tsx에서 한 번 호출
 */
/**
 * 🚨 IAP 결제 이력 기반 잔액 복구 (2026-08-07 · CS "운도 보관함도 전부 사라졌어요")
 *
 * 우리 잔액은 localStorage 가 주 저장소라 **기기 저장소가 초기화되면 충전한 운이 사라진다.**
 * 서버 users/{uid}.balance 는 '충전만' 반영된 값이라 그대로 복원하면 이미 쓴 운까지 부활해서
 * 복원 대상이 아니다(syncFromCloud 가 reportsOnly 인 이유).
 *
 * 반면 토스 IAP 주문 이력은 **토스 계정 기준**이라 기기·localStorage·익명 uid 와 무관하게 살아남는다.
 * → 이력을 서버로 보내 "결제했지만 이 uid 가 받은 적 없는 주문"만 골라 재지급받는다.
 *   중복/어뷰징 판정은 전부 서버(recoverIapOrders)가 한다. 클라는 금액을 신뢰받지 않는다.
 *
 * 실패해도 조용히 무시 — 기존 동작에 영향 0.
 */
export async function restoreCompletedPurchases(): Promise<{ granted: number; un: number; reports: number }> {
  const NONE = { granted: 0, un: 0, reports: 0 };
  if (!isAppsInToss()) return NONE;
  try {
    const { IAP } = await import('@apps-in-toss/web-framework');
    if (typeof (IAP as any)?.getCompletedOrRefundedOrders !== 'function') return NONE;

    // 페이지네이션 — hasNext/nextKey. 과도한 순회 방지로 5페이지 상한.
    const all: Array<{ orderId: string; sku: string; status: string; date?: string }> = [];
    let nextKey: string | null | undefined = undefined;
    for (let page = 0; page < 5; page++) {
      const res: any = await (IAP as any).getCompletedOrRefundedOrders(
        nextKey ? { nextKey } : undefined,
      );
      if (!res || !Array.isArray(res.orders)) break; // undefined = 앱 버전 미지원(5.231.0 미만)
      all.push(...res.orders);
      if (!res.hasNext || !res.nextKey) break;
      nextKey = res.nextKey;
    }
    const completed = all.filter((o) => o?.status === 'COMPLETED');
    if (completed.length === 0) return NONE;

    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const fns = getFunctions(undefined, 'us-central1');
    const r: any = await httpsCallable(fns, 'recoverIapOrders')({ orders: completed });
    const data = r?.data ?? {};
    const paidUn = Number(data.paidUn) || 0;
    const bonusUn = Number(data.bonusUn) || 0;

    if (paidUn > 0 || bonusUn > 0) {
      // 2026-08-13 — 기기 여권이 이번 부팅에 잔액 미러(잔여 잔액 스냅샷)를 이미 seed 했다면
      //   로컬 가산 skip. 미러에는 결제 운의 '잔여분'이 이미 들어있어 원액 재지급과 겹치면 이중가산.
      //   서버 호출 자체는 위에서 이미 끝났으므로 payments 기록·멱등 마킹은 그대로 남는다(미래 재발 방지).
      const { wasBalanceSeededFromMirror } = await import('@/services/storage/devicePassport');
      if (wasBalanceSeededFromMirror()) {
        console.info(`[IAP복구] 잔액 미러 seed 감지 — 로컬 가산 skip (+${paidUn + bonusUn}운 서버기록만)`);
      } else {
        addPaidBalance(paidUn, bonusUn); // 서버가 승인한 금액만 로컬 반영
        try {
          const { trackEvent } = await import('@/services/analytics');
          trackEvent('reward_earned', { kind: 'iap_recovery', amount: paidUn + bonusUn });
        } catch { /* noop */ }
      }
    }

    // 서버가 옛 uid 의 보관함을 이관했으면(uid 회전 케이스) 로컬로 내려받는다.
    //   이관은 users/{현재uid}/reports 에 복사되므로 reportsOnly 복원이면 충분.
    const migrated = Number(data.migratedReports) || 0;
    if (migrated > 0) {
      try {
        const { getAuth } = await import('firebase/auth');
        const curUid = getAuth().currentUser?.uid;
        if (curUid) {
          const sync = await import('@/services/storage/firestoreSync');
          await sync.syncFromCloud(curUid, { reportsOnly: true });
        }
      } catch { /* noop — 다음 부팅 bootSync 가 받아감 */ }
    }

    return { granted: Number(data.granted) || 0, un: paidUn + bonusUn, reports: migrated };
  } catch {
    return NONE; // 복구 실패는 무해 — 다음 부팅에 재시도
  }
}

export async function restorePendingPurchases(): Promise<void> {
  if (!isAppsInToss()) return;

  try {
    const { IAP } = await import('@apps-in-toss/web-framework');
    const result = await IAP.getPendingOrders();
    if (!result || result.orders.length === 0) return;

    // 2026-05-28 — idempotency: orderId 기반 처리 추적. SDK 재호출 시 중복 적립 차단.
    const PROCESSED_KEY = 'saju500:iap_processed_orders:v1';
    let processed: string[] = [];
    try { processed = JSON.parse(localStorage.getItem(PROCESSED_KEY) || '[]'); } catch { /* noop */ }
    const processedSet = new Set(processed);

    for (const order of result.orders) {
      const product = Object.values(IAP_PRODUCT_MAP).find(p => p.sku === order.sku);
      if (!product) continue;
      // 이미 처리한 orderId 면 SDK completeProductGrant 만 호출 (잔액 재적립 X)
      if (processedSet.has(order.orderId)) {
        try { await IAP.completeProductGrant({ params: { orderId: order.orderId } }); } catch { /* noop */ }
        continue;
      }

      try {
        addPaidBalance(product.paidUn, product.bonusUn);
        // 서버에도 재기록 시도 (pending 큐 fallback)
        try {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const fns = getFunctions(undefined, 'us-central1');
          await httpsCallable(fns, 'grantPurchase')({
            orderId: order.orderId, sku: order.sku,
            paidUn: product.paidUn, bonusUn: product.bonusUn,
          });
        } catch (serverErr) {
          console.error('[IAP] 복구 시 서버 기록 실패:', order.orderId, serverErr);
        }
        // orderId 처리 완료 표시
        processedSet.add(order.orderId);
        try { localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processedSet])); } catch { /* noop */ }

        // 지급 완료 처리
        await IAP.completeProductGrant({ params: { orderId: order.orderId } });
        console.log('[IAP] 복구 완료:', order.orderId);
      } catch (err) {
        console.error('[IAP] 복구 실패:', order.orderId, err);
      }
    }
  } catch {
    // SDK 로드 실패 — 무시
  }
}

/** 웹 브라우저 — 토스페이먼츠 PG 결제 */
async function purchaseViaWeb(pkg: ChargePackage): Promise<{ success: boolean; message: string }> {
  try {
    const { requestTossPayment } = await import('@/services/payment/tossPayments');
    await requestTossPayment(pkg);
    // requestTossPayment은 리다이렉트 발생 — 여기 도달하면 취소된 것
    return { success: false, message: '결제가 취소됐어요' };
  } catch (err: any) {
    console.error('[Web Payment]', err);
    return { success: false, message: err.message || '결제 처리 중 오류가 발생했어요' };
  }
}

/** 운 사용 — reward → bonus → paid 순으로 차감 */
export function spendUn(amount: number): boolean {
  return spendBalance(amount);
}
