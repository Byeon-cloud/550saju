// Threads (Meta) Graph API 공용 헬퍼
// 문서: https://developers.facebook.com/docs/threads
const GRAPH = "https://graph.threads.net/v1.0";

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Threads API 호출 + 429(rate limit) 지수 백오프 재시도.
 * - 429 또는 5xx 응답 시 재시도 (Retry-After 헤더 존중)
 * - 백오프: 2s → 4s → 8s → 16s → 32s (최대 maxRetries)
 */
export async function threadsFetch(
  url: string,
  init: RequestInit,
  maxRetries = 5,
): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let body: any;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { raw: text };
      }

      if (res.ok) return body;

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(2000 * 2 ** attempt, 32000);
        console.warn(
          `Threads ${res.status} (attempt ${attempt + 1}/${maxRetries}). ` +
            `${backoff}ms 후 재시도. body=${JSON.stringify(body)}`,
        );
        await sleep(backoff);
        continue;
      }

      // 재시도 불가 에러 또는 재시도 소진
      const err = new Error(
        `Threads API ${res.status}: ${JSON.stringify(body)}`,
      );
      (err as any).status = res.status;
      (err as any).body = body;
      throw err;
    } catch (e) {
      lastErr = e;
      // 네트워크 오류도 백오프 재시도
      if (attempt < maxRetries && !(e as any)?.status) {
        const backoff = Math.min(2000 * 2 ** attempt, 32000);
        console.warn(`Threads 네트워크 오류, ${backoff}ms 후 재시도:`, e);
        await sleep(backoff);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

interface ContainerParams {
  userId: string;
  accessToken: string;
  text: string;
  imageUrl?: string | null;
  replyToId?: string | null;
  topicTag?: string | null; // 주제 태그 (비팔로워 발견 통로) — 본문에만
}

/** 1단계: 미디어 컨테이너 생성 → creation_id 반환 */
export async function createContainer(p: ContainerParams): Promise<string> {
  const params = new URLSearchParams();
  params.set("access_token", p.accessToken);
  params.set("text", p.text);

  if (p.imageUrl) {
    params.set("media_type", "IMAGE");
    params.set("image_url", p.imageUrl);
  } else {
    params.set("media_type", "TEXT");
  }
  if (p.replyToId) params.set("reply_to_id", p.replyToId);
  if (p.topicTag) params.set("topic_tag", p.topicTag);

  const body = await threadsFetch(`${GRAPH}/${p.userId}/threads`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!body?.id) throw new Error(`컨테이너 생성 실패: ${JSON.stringify(body)}`);
  return body.id as string;
}

/** 2단계: 컨테이너 publish → 발행된 media id 반환 */
export async function publishContainer(
  userId: string,
  accessToken: string,
  creationId: string,
): Promise<string> {
  const params = new URLSearchParams();
  params.set("access_token", accessToken);
  params.set("creation_id", creationId);

  const body = await threadsFetch(`${GRAPH}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!body?.id) throw new Error(`발행 실패: ${JSON.stringify(body)}`);
  return body.id as string;
}

/**
 * 전체 발행 플로우: 컨테이너 생성 → containerWaitMs 대기 → publish.
 * Threads 권장: 미디어 서버 처리 위해 생성~publish 사이 ~30초 대기.
 */
export async function publishPost(
  p: ContainerParams,
  containerWaitMs = 30000,
): Promise<string> {
  const creationId = await createContainer(p);
  await sleep(containerWaitMs);
  return await publishContainer(p.userId, p.accessToken, creationId);
}

/**
 * 본문 + 대댓 체인 발행. 각 대댓은 직전 글에 답글로 달려 하나의 스레드가 됨.
 * 본문→댓1→댓2→...  (본문에만 topic_tag)
 */
export async function publishThreadChain(opts: {
  userId: string;
  accessToken: string;
  body: string;
  replies: string[];
  topicTag?: string | null;
  imageUrl?: string | null;
  bodyWaitMs?: number;
  replyWaitMs?: number;
}): Promise<{ bodyId: string; replyIds: string[] }> {
  const bodyWait = opts.imageUrl ? (opts.bodyWaitMs ?? 30000) : (opts.bodyWaitMs ?? 15000);
  const replyWait = opts.replyWaitMs ?? 4000;

  const bodyId = await publishPost({
    userId: opts.userId,
    accessToken: opts.accessToken,
    text: opts.body,
    imageUrl: opts.imageUrl,
    topicTag: opts.topicTag,
  }, bodyWait);

  const replyIds: string[] = [];
  let parent = bodyId;
  for (const r of opts.replies) {
    if (!r || !r.trim()) continue;
    const id = await publishPost({
      userId: opts.userId,
      accessToken: opts.accessToken,
      text: r,
      replyToId: parent,
    }, replyWait);
    replyIds.push(id);
    parent = id; // 직전 글에 이어 달기 = 연결된 스레드
  }
  return { bodyId, replyIds };
}
