/**
 * genGuard — 익명 호출의 AI 생성 하루 상한 (2026-10-14)
 *
 * 배경: 앱인토스 유저는 익명 계정이고 운 잔액이 기기 안(localStorage)에 있어서, 서버는 익명 호출의 운을 깎지 않는다.
 *   그래서 누군가 생성 함수를 직접 부르면 종합사주(원가 약 1,165원) 같은 풀이를 끝없이 공짜로 뽑을 수 있었다.
 *   정상 유저는 하루에 몇 번 안 만드니 넉넉한 하루 상한을 계정과 IP 두 곳에 걸어 둔다.
 *
 * - 로그인 계정(토스, 웹 소셜)은 서버가 운을 깎으므로 상한을 걸지 않는다.
 * - 세는 단위는 '생성 호출'이다. 스트림이 끊겨 callable 로 다시 부르면 두 번으로 센다 → 상한을 넉넉하게 잡았다.
 * - IP 상한은 통신사 공유 IP(여러 사람이 한 IP)를 생각해 계정 상한의 다섯 배 안팎.
 * - 하루 전체 건수가 경보선을 넘으면 backofficeAlerts 에 한 번 남긴다(막지는 않는다).
 * - 이 장부가 실패하면(Firestore 장애) 생성은 그대로 진행한다. 상한은 안전망이지 결제 경로가 아니다.
 */
import * as admin from 'firebase-admin';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { createHash } from 'crypto';
import { kstNow } from '../utils/kstTime';

export type GenType =
  | 'premium' | 'newyear' | 'monthly' | 'weekly' | 'daeun'
  | 'topic' | 'compat' | 'dream' | 'dreamDeep' | 'chat' | 'daily';

/** [계정 하루 상한, IP 하루 상한, 하루 전체 경보선] */
const LIMITS: Record<GenType, [number, number, number]> = {
  premium: [8, 40, 150],
  newyear: [8, 40, 150],
  monthly: [10, 50, 200],
  weekly: [10, 50, 200],
  daeun: [8, 40, 150],
  topic: [20, 100, 600],
  compat: [20, 100, 400],
  dream: [20, 100, 800],
  dreamDeep: [20, 100, 400],
  chat: [80, 400, 3000],
  daily: [20, 100, 2000],
};

export const GEN_LIMIT_MESSAGE = '오늘은 더 만들 수 없어요. 내일 다시 시도해 주세요';

const hash = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 24);
const today = (): string => { const n = kstNow(); return `${n.year}${String(n.month).padStart(2, '0')}${String(n.day).padStart(2, '0')}`; };

function clientIp(raw: any): string {
  try {
    const xf = String(raw?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return xf || String(raw?.ip || '');
  } catch { return ''; }
}

/** true = 허용, false = 상한 초과. 장부 실패는 허용으로 처리. */
export async function checkGenQuota(args: { type: GenType; uid?: string | null; anonymous: boolean; ip?: string }): Promise<boolean> {
  if (!args.anonymous) return true; // 로그인 계정은 서버 차감
  const [perKey, perIp, alertAt] = LIMITS[args.type];
  const db = admin.firestore();
  const day = today();
  const keyRef = db.doc(`genQuota/${day}_${args.uid ? 'u_' + hash(args.uid) : 'noauth_' + hash(args.ip || 'unknown')}`);
  const ipRef = args.ip ? db.doc(`genQuota/${day}_ip_${hash(args.ip)}`) : null;
  const allRef = db.doc(`genQuota/${day}_all`);
  const expireAt = admin.firestore.Timestamp.fromMillis(Date.now() + 3 * 24 * 3600 * 1000);
  try {
    const verdict = await db.runTransaction(async (tx) => {
      const [k, ip] = await Promise.all([tx.get(keyRef), ipRef ? tx.get(ipRef) : Promise.resolve(null)]);
      const kc = Number(k.get(args.type) || 0);
      const ic = ip ? Number(ip.get(args.type) || 0) : 0;
      if (kc >= perKey || (ipRef && ic >= perIp)) return { ok: false as const, kc, ic };
      const inc = { [args.type]: admin.firestore.FieldValue.increment(1), expireAt };
      tx.set(keyRef, inc, { merge: true });
      if (ipRef) tx.set(ipRef, inc, { merge: true });
      tx.set(allRef, inc, { merge: true });
      return { ok: true as const, kc, ic };
    });
    if (!verdict.ok) {
      console.warn(`[genGuard] 상한 초과 type=${args.type} key=${verdict.kc}/${perKey} ip=${verdict.ic}/${perIp}`);
      return false;
    }
    // 하루 전체 경보 (막지 않음, 한 번만)
    try {
      const all = await allRef.get();
      if (Number(all.get(args.type) || 0) === alertAt) {
        await db.collection('backofficeAlerts').add({
          kind: 'gen_volume', type: args.type, day, count: alertAt,
          message: `익명 ${args.type} 생성이 오늘 ${alertAt}건에 닿았어요. 평소보다 많으면 어뷰징을 확인하세요.`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch { /* noop */ }
    return true;
  } catch (e: any) {
    console.warn('[genGuard] 장부 실패, 통과시킴:', e?.message || e);
    return true;
  }
}

/** onCall 용 — 초과면 HttpsError('resource-exhausted') */
export async function guardCallable(request: CallableRequest<any>, type: GenType): Promise<void> {
  const anonymous = !request.auth || !!request.auth.token?.firebase?.sign_in_provider?.includes('anonymous');
  const ok = await checkGenQuota({ type, uid: request.auth?.uid ?? null, anonymous, ip: clientIp(request.rawRequest) });
  if (!ok) throw new HttpsError('resource-exhausted', GEN_LIMIT_MESSAGE);
}

/** onRequest(SSE) 용 — 초과면 false. 호출부가 429 로 응답 */
export async function guardHttp(req: any, uid: string | null, anonymous: boolean, type: GenType): Promise<boolean> {
  return checkGenQuota({ type, uid, anonymous: anonymous || !uid, ip: clientIp(req) });
}
