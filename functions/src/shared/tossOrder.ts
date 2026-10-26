/**
 * 토스 앱 결제(인앱결제) 주문 확인 (2026-10-26 공용으로 뺌, 처음은 10-19 syncIapRefunds)
 *
 *   POST https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/order/get-order-status { orderId } (mTLS), 앱당 분당 3,000회.
 *   응답 { resultType: 'SUCCESS', success: { orderId, sku, status, statusDeterminedAt, reason } }
 *   10-26 실측: 실제 주문은 PURCHASED 와 상품 번호(sku). 없는 주문번호도 SUCCESS 로 오고 status NOT_FOUND, sku null.
 *     환불된 주문은 REFUNDED. 지급된 205건 전부 토스에 있었다(구매 203, 6월 환불 2).
 *
 *   왜: grantPurchase 가 클라이언트가 보낸 주문번호와 운 개수를 그대로 믿고 서버 잔액을 올렸다(10-26 점검).
 *     개발자 도구로 지어낸 주문번호를 보내면 서버 잔액이 늘고, 로그인 계정은 그 잔액으로 유료 풀이를 만들 수 있었다.
 */
import * as https from 'https';
import { defineSecret } from 'firebase-functions/params';
import { IAP_SKU_MAP, type IapSkuPackage } from './chargePackages';

export const TOSS_MTLS_CERT = defineSecret('TOSS_MTLS_CERT');
export const TOSS_MTLS_KEY = defineSecret('TOSS_MTLS_KEY');

export interface TossOrderStatus { status: string; at: string | null; sku: string | null }

export function tossOrderStatus(orderId: string, cert: string, key: string): Promise<TossOrderStatus> {
  const body = JSON.stringify({ orderId });
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: 'apps-in-toss-api.toss.im', port: 443, method: 'POST',
      path: '/api-partner/v1/apps-in-toss/order/get-order-status',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      cert, key, timeout: 10000,
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(raw);
          if (j.resultType !== 'SUCCESS') return reject(new Error(`토스 응답 ${res.statusCode} ${JSON.stringify(j.error || j).slice(0, 160)}`));
          resolve({ status: String(j.success?.status || ''), at: j.success?.statusDeterminedAt || null, sku: j.success?.sku ? String(j.success.sku) : null });
        } catch (e) { reject(new Error(`토스 응답 해석 실패 ${res.statusCode} ${raw.slice(0, 120)}`)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('토스 응답 시간 초과')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export type IapVerdict =
  /** 토스가 결제된 주문이라고 했다(PURCHASED, PAYMENT_COMPLETED) */
  | { kind: 'ok'; pkg: IapSkuPackage; sku: string; status: string }
  /** 주문은 있는데 처음 보는 상태 — 지급하고 경보로 남긴다(진짜 손님을 막지 않게) */
  | { kind: 'odd'; pkg: IapSkuPackage; sku: string; status: string }
  /** 토스에 묻지 못했다(연결, 시간 초과) — 지급하고 경보로 남긴다. 30분마다 syncIapRefunds 가 다시 본다 */
  | { kind: 'unverified'; pkg: IapSkuPackage; sku: string; reason: string }
  /** 없는 주문, 환불된 주문, 모르는 상품 — 지급하지 않는다 */
  | { kind: 'deny'; status: string; reason: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 주문을 토스에 확인하고 지급할 묶음을 서버 표로 정한다. 운 개수는 클라이언트 값이 아니라 토스가 알려 준 상품(sku)으로.
 *   NOT_FOUND 는 결제 직후 잠깐 안 보일 수 있어 1.5초 간격으로 두 번 더 묻는다.
 */
export async function verifyIapOrder(orderId: string, claimedSku: string, cert: string, key: string): Promise<IapVerdict> {
  const claimed = IAP_SKU_MAP[claimedSku];
  let st: TossOrderStatus | null = null;
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await wait(1500);
    try {
      st = await tossOrderStatus(orderId, cert, key);
      if (st.status !== 'NOT_FOUND') break;
    } catch (e: any) {
      st = null;
      lastErr = String(e?.message || e).slice(0, 160);
    }
  }
  if (!st) {
    if (!claimed) return { kind: 'deny', status: 'UNKNOWN_SKU', reason: `모르는 상품 ${claimedSku.slice(0, 60)}` };
    return { kind: 'unverified', pkg: claimed, sku: claimedSku, reason: lastErr || '토스 조회 실패' };
  }
  if (st.status === 'NOT_FOUND') return { kind: 'deny', status: st.status, reason: '토스에 없는 주문' };
  if (st.status === 'REFUNDED') return { kind: 'deny', status: st.status, reason: '환불된 주문' };
  const sku = st.sku || claimedSku;
  const pkg = IAP_SKU_MAP[sku];
  if (!pkg) return { kind: 'deny', status: st.status, reason: `모르는 상품 ${sku.slice(0, 60)}` };
  if (st.status === 'PURCHASED' || st.status === 'PAYMENT_COMPLETED') return { kind: 'ok', pkg, sku, status: st.status };
  return { kind: 'odd', pkg, sku, status: st.status };
}
