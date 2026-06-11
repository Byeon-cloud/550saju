// publish-thread : 발행 대상 1건을 집어 타깃(Threads / X / 둘 다)에 발행한다.
//
// 호출: pg_cron 이 10분마다 (또는 수동 POST)
// 동작:
//   1) pending 이고 scheduled_at <= now() 인 가장 오래된 글 1건을 원자적으로 claim
//   2) post.targets ({threads}, {x}, {threads,x}) 별로 발행
//      - Threads: 2단계 발행 + 대댓 체인 + 주제태그
//      - X: 본문 + 답글 체인 (⚠️ URL 자동 제거 — PPU에서 URL 포스트 $0.20 방지)
//   3) 성공 → published / 실패 → 재시도 가능하면 pending, 아니면 failed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishThreadChain } from "../_shared/threads.ts";
import { publishXChain } from "../_shared/x.ts";

const MAX_ATTEMPTS = 5; // 이 횟수까지는 실패해도 pending 으로 되돌려 재시도

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── 1) 발행 대상 1건 원자적 claim ─────────────────────────────
  const { data: claimed, error: claimErr } = await sb
    .rpc("claim_due_post")
    .maybeSingle();

  if (claimErr) return json({ error: "claim 실패", detail: claimErr.message }, 500);
  if (!claimed) return json({ claimed: 0, message: "발행 대상 없음" });

  const post = claimed as Post;

  // 방어: id/본문 없는 유령 행이면 절대 발행하지 않음 (빈 글 방지)
  if (!post.id || !post.body || !post.body.trim()) {
    return json({ claimed: 0, message: "유효한 발행 대상 없음 (빈 행 무시)" });
  }

  const targets: string[] = Array.isArray(post.targets) && post.targets.length ? post.targets : ["threads"];

  // ── 계정 자격증명 ───────────────────────────────────────────────
  const accountId = post.account_id || "moondal";
  const { data: acct } = await sb
    .from("accounts")
    .select("threads_user_id, access_token, x_api_key, x_api_secret, x_access_token, x_access_secret")
    .eq("id", accountId)
    .maybeSingle();

  const replies: string[] = Array.isArray(post.reply_chain)
    ? post.reply_chain.filter((r: any) => typeof r === "string" && r.trim())
    : (post.reply_body && post.reply_body.trim() ? [post.reply_body] : []);
  const topicTag = Array.isArray(post.topic_tags) ? post.topic_tags[0] : null;

  const ok: Record<string, any> = {};
  const errors: string[] = [];

  // ── Threads 발행 ────────────────────────────────────────────────
  if (targets.includes("threads")) {
    if (!acct?.threads_user_id || !acct?.access_token) {
      errors.push(`threads: 계정 '${accountId}' Threads 자격증명 없음`);
    } else {
      try {
        const { bodyId, replyIds } = await publishThreadChain({
          userId: acct.threads_user_id,
          accessToken: acct.access_token,
          body: post.body,
          replies,
          topicTag,
          imageUrl: post.image_url,
        });
        ok.threads = { bodyId, replyCount: replyIds.length };
        await sb.from("posts").update({
          thread_post_id: bodyId,
          reply_post_id: replyIds[0] ?? null,
          reply_post_ids: replyIds,
        }).eq("id", post.id);
      } catch (e) {
        errors.push("threads: " + (e instanceof Error ? e.message : String(e)).slice(0, 300));
      }
    }
  }

  // ── X 발행 (URL 자동 제거 가드) ─────────────────────────────────
  if (targets.includes("x")) {
    if (!acct?.x_api_key || !acct?.x_access_token) {
      errors.push(`x: 계정 '${accountId}' X 자격증명 없음`);
    } else {
      try {
        const { bodyId, replyIds, urlStripped } = await publishXChain(
          {
            apiKey: acct.x_api_key,
            apiSecret: acct.x_api_secret,
            accessToken: acct.x_access_token,
            accessSecret: acct.x_access_secret,
          },
          post.body,
          replies,
        );
        ok.x = { bodyId, replyCount: replyIds.length, urlStripped };
        await sb.from("posts").update({
          x_post_id: bodyId,
          x_reply_ids: replyIds,
        }).eq("id", post.id);
      } catch (e) {
        errors.push("x: " + (e instanceof Error ? e.message : String(e)).slice(0, 300));
      }
    }
  }

  // ── 결과 정리 ──────────────────────────────────────────────────
  if (Object.keys(ok).length > 0) {
    // 한 곳이라도 성공 → published (실패한 타깃은 last_error 에 기록)
    await sb.from("posts").update({
      status: "published",
      published_at: new Date().toISOString(),
      last_error: errors.length ? errors.join(" | ").slice(0, 2000) : null,
    }).eq("id", post.id);
    return json({ claimed: 1, published: true, post_id: post.id, ok, errors });
  }

  // 전부 실패 → 재시도/실패 처리
  const msg = errors.join(" | ") || "알 수 없는 실패";
  const retryable = post.attempts < MAX_ATTEMPTS;
  await sb.from("posts").update({
    status: retryable ? "pending" : "failed",
    last_error: msg.slice(0, 2000),
  }).eq("id", post.id);
  return json({ claimed: 1, published: false, post_id: post.id, retryable, error: msg }, 500);
});

interface Post {
  id: string;
  body: string;
  image_url: string | null;
  reply_body: string | null;
  reply_chain: string[] | null;
  topic_tags: string[] | null;
  account_id: string | null;
  targets: string[] | null;
  attempts: number;
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
