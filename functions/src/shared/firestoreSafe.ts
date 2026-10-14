/**
 * AI 결과를 Firestore 에 사본으로 저장할 때의 안전장치 (2026-10-14)
 *
 *   실측: 5.5 세대 전환 뒤 월운 초안 저장이 'Property content contains an invalid nested entity' 로 거부돼
 *   생성은 끝났는데 사용자에게 실패와 환불이 나갔다(같은 사주 로컬 재현 2회는 정상, 모델 출력 모양이 가끔 다름).
 *   Firestore 는 배열 안의 배열, 20단계 넘는 깊이, 빈 키와 __이름__ 키, undefined 를 받지 않는다.
 *   → 저장 직전에 모양만 정리하고(내용은 그대로), 그래도 실패하면 글자 사본(contentJson)으로 남긴다.
 *     서버 사본은 보관과 복구용이라 저장 실패가 사용자 응답을 막지 않게 한다.
 */
import type * as admin from 'firebase-admin';

const MAX_DEPTH = 18;

export function fsSafe<T>(v: T): T {
  const walk = (x: any, depth: number, inArray: boolean): any => {
    if (x === undefined) return null;
    if (Array.isArray(x)) {
      if (inArray) return JSON.stringify(x); // 배열 안 배열
      return x.map((y) => walk(y, depth + 1, true));
    }
    if (x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
      if (depth >= MAX_DEPTH) return JSON.stringify(x);
      const o: Record<string, any> = {};
      for (const [k, y] of Object.entries(x)) {
        if (!k || /^__.*__$/.test(k) || y === undefined) continue;
        o[k] = walk(y, depth + 1, false);
      }
      return o;
    }
    return x;
  };
  try { return walk(v, 0, false); } catch { return v; }
}

/** 리포트 사본 저장 — content 는 fsSafe 로 정리, 그래도 실패하면 contentJson 글자 사본. 예외를 던지지 않는다 */
export async function setReportSafe(
  ref: admin.firestore.DocumentReference,
  data: Record<string, any>,
  options?: admin.firestore.SetOptions,
): Promise<void> {
  const put = (d: Record<string, any>) => (options ? ref.set(d, options) : ref.set(d));
  try {
    await put('content' in data ? { ...data, content: fsSafe(data.content) } : data);
    return;
  } catch (e: any) {
    console.error('[setReportSafe] 저장 실패 → 글자 사본으로 다시:', ref.path, e?.message);
  }
  try {
    const { content, ...rest } = data;
    await put({ ...rest, contentJson: JSON.stringify(content ?? null) });
  } catch (e2: any) {
    console.error('[setReportSafe] 글자 사본도 실패:', ref.path, e2?.message);
  }
}
