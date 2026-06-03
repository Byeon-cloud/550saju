// collect-insights : LEARNING. 발행된 글의 성과(조회/좋아요/댓글/리포스트)를 Threads에서 수거.
//
// 호출:
//   - 평소(cron 6시간): 최근 14일 발행 글의 지표 갱신
//   - 주간(cron + body {digest:true}): 위 갱신 후 "이번 주 성과 요약"을 텔레그램으로
//
// 이 데이터가 쌓이면 "잘 터진 타입/시간/후킹"을 알 수 있고, 다음 단계에서 프롬프트 가중에 쓴다.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMessage } from "../_shared/telegram.ts";

const GRAPH = "https://graph.threads.net/v1.0";

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const OWNER_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: dbToken } = await sb.rpc("get_threads_token");
  const TOKEN = dbToken || Deno.env.get("THREADS_ACCESS_TOKEN");
  if (!TOKEN) return json({ error: "토큰 없음" }, 500);

  const reqBody = await req.json().catch(() => ({}));

  // 최근 14일 발행된 글
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data: posts } = await sb
    .from("posts")
    .select("id, thread_post_id, content_type, hook_type, body, published_at")
    .eq("status", "published")
    .gte("published_at", since)
    .not("thread_post_id", "is", null);

  let updated = 0;
  for (const p of posts ?? []) {
    try {
      const m = await fetchInsights(p.thread_post_id, TOKEN);
      await sb.from("posts").update({
        views: m.views,
        likes: m.likes,
        replies: m.replies,
        reposts: m.reposts,
        shares: m.shares,
        insights_updated_at: new Date().toISOString(),
      }).eq("id", p.id);
      updated++;
    } catch (e) {
      console.error(`insights 실패 ${p.id}:`, e instanceof Error ? e.message : e);
    }
  }

  // 주간 요약
  if (reqBody.digest && BOT_TOKEN && OWNER_CHAT_ID) {
    await sendDigest(sb, BOT_TOKEN, OWNER_CHAT_ID);
  }

  return json({ ok: true, updated });
});

async function fetchInsights(mediaId: string, token: string) {
  const metrics = "views,likes,replies,reposts,quotes,shares";
  const url = `${GRAPH}/${mediaId}/insights?metric=${metrics}&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 300));
  const out: Record<string, number> = {};
  for (const item of data.data ?? []) {
    out[item.name] = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
  }
  return {
    views: out.views ?? 0,
    likes: out.likes ?? 0,
    replies: out.replies ?? 0,
    reposts: (out.reposts ?? 0) + (out.quotes ?? 0),
    shares: out.shares ?? 0,
  };
}

async function sendDigest(sb: any, botToken: string, chatId: string) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: posts } = await sb
    .from("posts")
    .select("content_type, hook_type, body, views, likes, replies")
    .eq("status", "published")
    .gte("published_at", since);

  if (!posts?.length) {
    await sendMessage(botToken, Number(chatId), "📊 이번 주 발행된 글이 아직 없어");
    return;
  }

  const score = (p: any) => (p.views ?? 0) + (p.likes ?? 0) * 3 + (p.replies ?? 0) * 5;
  const sorted = [...posts].sort((a, b) => score(b) - score(a));
  const best = sorted[0];

  // 타입별 평균 조회
  const byType: Record<string, { v: number; n: number }> = {};
  for (const p of posts) {
    const t = p.content_type ?? "기타";
    byType[t] = byType[t] ?? { v: 0, n: 0 };
    byType[t].v += p.views ?? 0;
    byType[t].n++;
  }
  const typeRank = Object.entries(byType)
    .map(([t, s]) => `${t}: 평균 ${Math.round(s.v / s.n)}뷰 (${s.n}개)`)
    .sort()
    .join("\n");

  const msg = `📊 <b>이번 주 성과 요약</b> (${posts.length}개 발행)\n\n` +
    `🏆 베스트 글 (조회 ${best.views ?? 0} · 좋아요 ${best.likes ?? 0} · 댓글 ${best.replies ?? 0}):\n` +
    `${(best.body ?? "").slice(0, 60)}...\n\n` +
    `📈 타입별 평균:\n${typeRank}\n\n` +
    `→ 잘 터진 타입을 다음 주에 더 밀어보자!`;
  await sendMessage(botToken, Number(chatId), msg);
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
