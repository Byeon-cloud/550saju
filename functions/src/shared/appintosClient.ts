/**
 * 앱인토스 토스포인트 API 어댑터 (STUB 모드 지원)
 *   근거: appintos_토스포인트_API_리서치_v1.md §6 · 핸드오버 §1-B-6
 *
 * 동작 규약:
 *   - 환경변수 APPINTOS_MTLS_CERT / APPINTOS_MTLS_KEY 부재 시 → STUB 응답
 *   - 존재 시 → 실제 mTLS 호출 (https://apps-in-toss-api.toss.im)
 *
 * STUB 모드 목적:
 *   mTLS 인증서 발급 전에도 전체 배선 완성. 심사 통과 후 Secrets 주입만으로 LIVE 전환.
 *   rewardClaims 문서에 `tossTxId: "STUB_..."` 기록되므로 데이터 흐름 검증 가능.
 *
 * 주의:
 *   - 인증서 파일은 git 커밋 금지 (.gitignore)
 *   - 프로모션코드 하드코딩 금지 (반드시 APPINTOS_PROMOTION_CODE env)
 */

import https from 'https';

type AppintosSuccess<T> = { resultType: 'SUCCESS'; success: T };
type AppintosFailure = { resultType: 'FAILURE'; error: { errorCode: string; reason: string } };
type AppintosResponse<T> = AppintosSuccess<T> | AppintosFailure;

interface GrantTossPointParams {
  userKey: string;
  promotionCode: string;
  amount: number;
  idempotencyKey: string;
}

interface GrantSuccess {
  key: string;
}

/** STUB / LIVE 자동 분기용 flag. */
function isStub(): boolean {
  return !process.env.APPINTOS_MTLS_CERT || !process.env.APPINTOS_MTLS_KEY;
}

/**
 * 토스포인트 지급 실행 (executePromotion).
 * STUB 모드: 항상 SUCCESS + key=`STUB_{timestamp}`.
 * LIVE 모드: mTLS 요청.
 */
export async function grantTossPoint(
  params: GrantTossPointParams,
): Promise<AppintosResponse<GrantSuccess>> {
  if (isStub()) {
    // eslint-disable-next-line no-console
    console.info('[appintosClient] STUB mode · grantTossPoint', {
      userKey: params.userKey.slice(0, 8) + '...',
      amount: params.amount,
      idempotencyKey: params.idempotencyKey,
    });
    return {
      resultType: 'SUCCESS',
      success: { key: `STUB_${Date.now()}_${params.idempotencyKey.slice(-8)}` },
    };
  }

  // ─── LIVE (mTLS) ───
  const cert = process.env.APPINTOS_MTLS_CERT!;
  const key = process.env.APPINTOS_MTLS_KEY!;
  const body = JSON.stringify({
    userKey: params.userKey,
    promotionCode: params.promotionCode,
    amount: params.amount,
    idempotencyKey: params.idempotencyKey,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: 'apps-in-toss-api.toss.im',
        port: 443,
        path: '/promotion/execute',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        cert,
        key,
        rejectUnauthorized: true,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const text = Buffer.concat(chunks).toString('utf8');
            const parsed = JSON.parse(text) as AppintosResponse<GrantSuccess>;
            resolve(parsed);
          } catch (e: any) {
            reject(new Error(`[appintosClient] parse failed: ${e?.message}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * userKey 조회 (getKey).
 * STUB 모드: `STUB_USERKEY_{uid}` 반환.
 * LIVE 모드: mTLS 호출 — 토스 로그인 세션에서 영구 userKey 조회.
 *   실 스펙은 mTLS 인증서 발급 시점에 콘솔 API 레퍼런스 Node.js 예제로 확정 예정.
 */
export async function getUserKey(uid: string): Promise<string> {
  if (isStub()) return `STUB_USERKEY_${uid}`;

  const cert = process.env.APPINTOS_MTLS_CERT!;
  const key = process.env.APPINTOS_MTLS_KEY!;
  const body = JSON.stringify({ uid });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: 'apps-in-toss-api.toss.im',
        port: 443,
        path: '/user/getKey',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        cert,
        key,
        rejectUnauthorized: true,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const text = Buffer.concat(chunks).toString('utf8');
            const parsed = JSON.parse(text) as AppintosResponse<{ userKey: string }>;
            if (parsed.resultType === 'SUCCESS') return resolve(parsed.success.userKey);
            reject(new Error(`[appintosClient] getUserKey failed: ${parsed.error.errorCode} ${parsed.error.reason}`));
          } catch (e: any) {
            reject(new Error(`[appintosClient] getUserKey parse: ${e?.message}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** 현재 모드 식별자 (로그·응답 디버깅용). */
export function getAppintosMode(): 'STUB' | 'LIVE' {
  return isStub() ? 'STUB' : 'LIVE';
}
