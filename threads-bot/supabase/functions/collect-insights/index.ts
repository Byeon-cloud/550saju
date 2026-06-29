// collect-insights : LEARNING. 발행된 글의 성과(조회/좋아요/댓글/리포스트)를 Threads에서 수거.
//
// ⚠️ 계정별: 인사이트는 '그 글을 올린 계정의 토큰'으로만 조회 가능.
//   → 각 글의 account_id 에 맞는 토큰으로 호출한다. (문달 토큰으로 공식 글 조회하면 0 나옴)
//
// 호출:
//   - 평소(cron 6시간): 최근 14일 발행 글 지표 갱신 (모든 계정)
//   - 주간(cron + body {digest:true}): 활성 계정별 "이번 주 성과 요약"을 그 계정 봇으로

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMessage } from "../_shared/telegram.ts";

const GRAPH = "https://graph.threads.net/v1.0";

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 계정별 토큰/봇 맵
  const { data: accounts } = await sb
    .from("accounts")
    .select("id, access_token, telegram_bot_token, telegram_chat_id, active");
  const tokenOf: Record<string, string> = {};
  for (const a of accounts ?? []) if (a.access_token) tokenOf[a.id] = a.access_token;

  const reqBody = await req.json().catch(() => ({}));

  // 최근 30일 발행 글 + '한 번도 수거 안 된' 글(나이 무관 백필) — 빈틈 없이
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data: posts } = await sb
    .from("posts")
    .select("id, account_id, thread_post_id")
    .eq("status", "published")
    .not("thread_post_id", "is", null)
    .eq("deleted_on_threads", false)
    .or(`published_at.gte.${since},insights_updated_at.is.null`);

  let updated = 0;
  const fails: string[] = [];
  for (const p of posts ?? []) {
    const token = tokenOf[p.account_id || "moondal"];
    if (!token) continue;
    try {
      const m = await fetchInsights(p.thread_post_id, token);
      await sb.from("posts").update({
        views: m.views,
        likes: m.likes,
        replies: m.replies,
        reposts: m.reposts,
        insights_updated_at: new Date().toISOString(),
      }).eq("id", p.id);
      updated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Threads에서 삭제된 글(객체 없음) → 'deleted'로 빼서 집계/재시도에서 제외
      if (/does not exist|Unsupported get request/i.test(msg)) {
        await sb.from("posts").update({ deleted_on_threads: true }).eq("id", p.id);
        fails.push((p.account_id || "?") + ":삭제됨(제외)");
      } else {
        fails.push((p.account_id || "?") + ":" + msg.slice(0, 50));
      }
    }
  }

  // 주간 요약 — 활성 계정별로 그 계정 봇에 전송
  if (reqBody.digest) {
    for (const a of accounts ?? []) {
      if (!a.active || !a.telegram_bot_token || !a.telegram_chat_id) continue;
      await sendDigest(sb, a.id, a.telegram_bot_token, a.telegram_chat_id);
    }
  }

  return json({ ok: true, updated, fail_count: fails.length, fails: fails.slice(0, 5) });
});

async function fetchInsights(mediaId: string, token: string) {
  // Threads 인사이트 지표: views, likes, replies, reposts, quotes
  const metrics = "views,likes,replies,reposts,quotes";
  const url = `${GRAPH}/${mediaId}/insights?metric=${metrics}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 200));
  const out: Record<string, number> = {};
  for (const row of data.data ?? []) {
    out[row.name] = row.values?.[0]?.value ?? row.total_value?.value ?? 0;
  }
  return {
    views: out.views ?? 0,
    likes: out.likes ?? 0,
    replies: out.replies ?? 0,
    reposts: (out.reposts ?? 0) + (out.quotes ?? 0),
  };
}

async function sendDigest(sb: any, accountId: string, botToken: string, chatId: string) {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: posts } = await sb
    .from("posts")
    .select("content_type, body, views, likes, replies")
    .eq("status", "published")
    .eq("account_id", accountId)
    .eq("deleted_on_threads", false) // 삭제된 유령 글 제외
    .gte("published_at", since);

  const label = accountId === "official" ? "🏛 사주500" : "📿 " + accountId;
  if (!posts?.length) {
    await sendMessage(botToken, Number(chatId), `📊 ${label} 이번 주 발행된 글이 아직 없어`);
    return;
  }

  const score = (p: any) => (p.views ?? 0) + (p.likes ?? 0) * 3 + (p.replies ?? 0) * 5;
  const best = [...posts].sort((a, b) => score(b) - score(a))[0];
  const totalViews = posts.reduce((s: number, p: any) => s + (p.views ?? 0), 0);
  const avg = Math.round(totalViews / posts.length);

  const byType: Record<string, { v: number; n: number }> = {};
  for (const p of posts) {
    const t = p.content_type ?? "기타";
    byType[t] = byType[t] ?? { v: 0, n: 0 };
    byType[t].v += p.views ?? 0;
    byType[t].n++;
  }
  const typeRank = Object.entries(byType)
    .sort((a, b) => (b[1].v / b[1].n) - (a[1].v / a[1].n))
    .map(([t, s]) => `${t}: 평균 ${Math.round(s.v / s.n)}뷰 (${s.n}개)`)
    .join("\n");

  const msg = `📊 <b>${label} 이번 주 성과</b> (${posts.length}개 · 총 ${totalViews}뷰 · 평균 ${avg}뷰)\n\n` +
    `🏆 베스트 (조회 ${best.views ?? 0} · 좋아요 ${best.likes ?? 0} · 댓글 ${best.replies ?? 0}):\n` +
    `${(best.body ?? "").slice(0, 60)}...\n\n` +
    `📈 타입별 평균:\n${typeRank}\n\n→ 잘 터진 타입을 다음 주에 더 밀자`;
  await sendMessage(botToken, Number(chatId), msg);
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
