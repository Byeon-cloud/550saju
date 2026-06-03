// publish-thread : 발행 대상 1건을 집어 Threads 에 발행하고, 대댓을 단다.
//
// 호출: pg_cron 이 10분마다 (또는 수동 POST)
// 동작:
//   1) pending 이고 scheduled_at <= now() 인 가장 오래된 글 1건을 원자적으로 claim
//   2) Threads 2단계 발행 (컨테이너 생성 → 30초 대기 → publish)
//   3) reply_body 있으면 reply_to_id 로 대댓 자동
//   4) 성공 → status='published' / 실패 → 재시도 가능하면 pending, 아니면 failed
//
// env (Supabase Dashboard > Edge Functions > Secrets 에 등록):
//   THREADS_USER_ID, THREADS_ACCESS_TOKEN
//   (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 런타임 자동 주입)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishThreadChain } from "../_shared/threads.ts";

const MAX_ATTEMPTS = 5; // 이 횟수까지는 실패해도 pending 으로 되돌려 재시도

Deno.serve(async (req) => {
  // 간단 인증: service_role 키(JWT) 로만 호출되도록 Supabase 가 검증(verify_jwt).
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── 1) 발행 대상 1건 원자적 claim ─────────────────────────────
  // RPC(claim_due_post) 로 SELECT ... FOR UPDATE SKIP LOCKED 처리 (동시 실행 안전)
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

  // ── 계정별 자격증명 (글의 account_id 기준) ──────────────────────
  const accountId = post.account_id || "moondal";
  const { data: acct } = await sb
    .from("accounts")
    .select("threads_user_id, access_token")
    .eq("id", accountId)
    .maybeSingle();
  const THREADS_USER_ID = acct?.threads_user_id;
  const THREADS_ACCESS_TOKEN = acct?.access_token || Deno.env.get("THREADS_ACCESS_TOKEN");
  if (!THREADS_USER_ID || !THREADS_ACCESS_TOKEN) {
    // 토큰 없는 계정(예: 공식 미설정)으로는 절대 발행 안 함 → 다른 계정으로 잘못 안 나가게
    await sb.from("posts").update({
      status: "failed",
      last_error: `계정 '${accountId}' 토큰/user_id 미설정 — 발행 불가`,
    }).eq("id", post.id);
    return json({ claimed: 1, published: false, account: accountId, error: "계정 자격증명 없음" }, 200);
  }

  // ── 2~3) 본문 + 대댓 체인 발행 ────────────────────────────────
  // reply_chain(배열) 우선, 없으면 reply_body(구버전) 단일로 폴백
  const replies: string[] = Array.isArray(post.reply_chain)
    ? post.reply_chain.filter((r: any) => typeof r === "string" && r.trim())
    : (post.reply_body && post.reply_body.trim() ? [post.reply_body] : []);
  const topicTag = Array.isArray(post.topic_tags) ? post.topic_tags[0] : null;

  try {
    const { bodyId, replyIds } = await publishThreadChain({
      userId: THREADS_USER_ID,
      accessToken: THREADS_ACCESS_TOKEN,
      body: post.body,
      replies,
      topicTag,
      imageUrl: post.image_url,
    });

    await sb
      .from("posts")
      .update({
        status: "published",
        thread_post_id: bodyId,
        reply_post_id: replyIds[0] ?? null,
        reply_post_ids: replyIds,
        published_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", post.id);

    return json({
      claimed: 1,
      published: true,
      post_id: post.id,
      thread_post_id: bodyId,
      reply_count: replyIds.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 재시도 여지가 있으면 pending 으로 되돌림 (다음 cron 이 다시 시도)
    const retryable = post.attempts < MAX_ATTEMPTS;
    await sb
      .from("posts")
      .update({
        status: retryable ? "pending" : "failed",
        last_error: msg.slice(0, 2000),
      })
      .eq("id", post.id);

    return json(
      {
        claimed: 1,
        published: false,
        post_id: post.id,
        retryable,
        error: msg,
      },
      500,
    );
  }
});

interface Post {
  id: string;
  body: string;
  image_url: string | null;
  reply_body: string | null;
  reply_chain: string[] | null;
  topic_tags: string[] | null;
  account_id: string | null;
  attempts: number;
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
