// X(트위터) 발행 헬퍼 — OAuth 1.0a 서명 + 본문/답글 체인 발행
// ⚠️ 비용 가드: URL 포함 포스트는 $0.20(13배)라서 글에서 URL을 자동 제거한다.
//    링크는 준기가 X 앱에서 직접 대댓으로 (공짜).
import { createHmac, randomBytes } from "node:crypto";

const API = "https://api.x.com/2/tweets";

export interface XCreds {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

const enc = (v: string) =>
  encodeURIComponent(v).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

function authHeader(method: string, url: string, c: XCreds): string {
  const p: Record<string, string> = {
    oauth_consumer_key: c.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: c.accessToken,
    oauth_version: "1.0",
  };
  const base = [method, enc(url), enc(Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join("&"))].join("&");
  p.oauth_signature = createHmac("sha1", `${enc(c.apiSecret)}&${enc(c.accessSecret)}`).update(base).digest("base64");
  return "OAuth " + Object.keys(p).sort().map((k) => `${enc(k)}="${enc(p[k])}"`).join(", ");
}

/** Threads 글 → X 문화로 변환 (스친이=스레드 용어 → 트친). 기계적 치환이라 내용 불변 */
export function adaptForX(text: string): string {
  return text
    .replaceAll("스친이들", "트친들")
    .replaceAll("스친이가", "트친이")
    .replaceAll("스친이도", "트친도")
    .replaceAll("스친이는", "트친은")
    .replaceAll("스친이한테", "트친한테")
    .replaceAll("스친이랑", "트친이랑")
    .replaceAll("스친아", "트친아")
    .replaceAll("스친이", "트친")
    .replaceAll("스레드", "여기");
}

/** URL 제거 (PPU에서 URL 포스트 = $0.20 → 차단). 제거됐으면 true 반환 */
export function stripUrls(text: string): { text: string; stripped: boolean } {
  const re = /https?:\/\/\S+/g;
  const stripped = re.test(text);
  return { text: text.replace(re, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), stripped };
}

async function postTweet(c: XCreds, text: string, replyToId?: string): Promise<string> {
  const body: any = { text };
  if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: authHeader("POST", API, c), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.id) {
    throw new Error(`X ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.data.id as string;
}

/** 본문 + 답글 체인 발행 (전부 URL 제거 후). 반환: id들 + URL 제거 여부 */
export async function publishXChain(
  c: XCreds,
  body: string,
  replies: string[],
): Promise<{ bodyId: string; replyIds: string[]; urlStripped: boolean }> {
  let urlStripped = false;
  const b = stripUrls(adaptForX(body));
  urlStripped ||= b.stripped;
  const bodyId = await postTweet(c, b.text);
  const replyIds: string[] = [];
  let parent = bodyId;
  for (const r of replies) {
    const rr = stripUrls(adaptForX(r));
    urlStripped ||= rr.stripped;
    if (!rr.text) continue; // 링크만 있던 댓글은 통째로 스킵
    await new Promise((res) => setTimeout(res, 2000));
    const id = await postTweet(c, rr.text, parent);
    replyIds.push(id);
    parent = id;
  }
  return { bodyId, replyIds, urlStripped };
}
