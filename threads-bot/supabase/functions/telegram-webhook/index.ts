// telegram-webhook : 텔레그램으로 글 작성 + 승인 + 예약을 처리한다.
//
// 흐름:
//   ① 주인이 봇에게 본문 DM
//      (대댓을 직접 쓰려면 본문 아래 "---" 줄 긋고 그 아래에 작성.
//       안 쓰면 기본 CTA 링크가 대댓으로 자동)
//   ② 봇이 미리보기 + 버튼 [지금 발행][1시간 뒤][3시간 뒤][내일 오전 9시][취소]
//   ③ 버튼 → posts.status='pending' + scheduled_at(UTC) 세팅 (또는 cancelled)
//   ④ 이후 cron(publish-thread)이 시각 되면 발행
//
// 보안: Telegram 이 보내는 x-telegram-bot-api-secret-token 헤더 검증 +
//       주인 chat_id 외 메시지 무시. (verify_jwt=false 로 배포)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  answerCallbackQuery,
  buildApproveButtons,
  editMessageText,
  esc,
  sendMessage,
} from "../_shared/telegram.ts";
import { publishPost } from "../_shared/threads.ts";

const THREADS_LIMIT = 500;

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // 멀티봇: 시크릿 헤더로 '어느 계정의 봇'인지 식별
  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const { data: acct } = await sb
    .from("accounts")
    .select("id, telegram_bot_token, telegram_chat_id, cta_link")
    .eq("telegram_webhook_secret", secret)
    .maybeSingle();
  if (!acct || !acct.telegram_bot_token) {
    return new Response("forbidden", { status: 403 });
  }
  const BOT_TOKEN = acct.telegram_bot_token as string;
  const OWNER_CHAT_ID = String(acct.telegram_chat_id ?? "");
  const CTA_LINK = (acct.cta_link as string) ?? "";
  const accountId = acct.id as string;

  const update = await req.json().catch(() => null);
  if (!update) return new Response("ok"); // 잘못된 본문이어도 200 (재전송 방지)

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message?.photo) {
      await handlePhoto(update.message);
    } else if (update.message?.text) {
      await handleMessage(update.message);
    }
  } catch (e) {
    console.error("webhook 처리 오류:", e);
  }

  // Telegram 에는 항상 200 (안 그러면 같은 update 재전송)
  return new Response("ok");

  // ── 새 글 작성 ────────────────────────────────────────────────
  async function handleMessage(msg: any) {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(OWNER_CHAT_ID)) {
      await sendMessage(BOT_TOKEN, chatId, "이 봇은 주인 전용이에요.");
      return;
    }

    // ✍️ 첨삭: 어떤 카드에 '답장'으로 수정본을 보내면 그 draft를 갱신
    if (msg.reply_to_message?.message_id) {
      const { data: target } = await sb.from("posts")
        .select("id").eq("tg_message_id", msg.reply_to_message.message_id)
        .eq("status", "draft").maybeSingle();
      if (target) {
        const raw2 = (msg.text as string).trim();
        const parts = raw2.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean);
        const newBody = parts[0] ?? raw2;
        const newChain = parts.slice(1);
        await sb.from("posts").update({
          body: newBody,
          ...(newChain.length ? { reply_chain: newChain } : {}),
        }).eq("id", target.id);
        const chainTxt = newChain.length
          ? newChain.map((r, i) => `  ↳ 댓${i + 1}: ${esc(r)}`).join("\n")
          : "(대댓 유지)";
        const sent = await sendMessage(
          BOT_TOKEN, chatId,
          `✏️ <b>수정됨</b> (${newBody.length}자)\n\n${esc(newBody)}\n\n${chainTxt}\n\n언제 올릴까?`,
          buildApproveButtons(target.id),
        );
        const mid = sent?.result?.message_id;
        if (mid) await sb.from("posts").update({ tg_message_id: mid }).eq("id", target.id);
        return;
      }
    }

    const raw = (msg.text as string).trim();

    // 🔥 트렌드 글: "주제: 재선거 참정권" → 그 이슈를 사주로 엮은 글 생성
    if (/^\/?(주제|트렌드)[:\s]/.test(raw)) {
      const hint = raw.replace(/^\/?(주제|트렌드)\s*[:：]?\s*/, "").trim();
      if (!hint) {
        await sendMessage(BOT_TOKEN, chatId, "주제를 같이 적어줘. 예: 주제: 재선거 참정권");
        return;
      }
      await sendMessage(BOT_TOKEN, chatId, `🔥 "${hint}" 사주로 엮어서 뽑는 중... 잠깐만!`);
      fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ account: accountId, content_type: "knowledge", topic_hint: hint }),
      }).catch((e) => console.error("trend 호출 실패:", e));
      return;
    }
    // 시사 사주 분석: "분석: 오세훈 1961.1.4 / 정원오 ... / 누가 유리?"
    if (/^\/?(분석|이슈)/.test(raw)) {
      await sendMessage(BOT_TOKEN, chatId, "🔮 사주 분석 뽑는 중... 인물 사주 계산하느라 좀 걸려, 잠깐만!");
      fetch(`${SUPABASE_URL}/functions/v1/generate-analysis`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ request: raw.replace(/^\/?(분석|이슈)\s*[:：]?\s*/, "") }),
      }).catch((e) => console.error("analysis 호출 실패:", e));
      return;
    }

    // 즉석 AI 생성 — 이 봇이 곧 계정이라 타입만 고르면 됨
    if (/^\/?(생성|new|뽑)/.test(raw)) {
      const lbl = accountId === "official" ? "🏛 공식계정" : "📿 문달";
      await sendMessage(BOT_TOKEN, chatId, `${lbl} — 어떤 글 뽑을까? 🤖`, [
        [
          { text: "☀️ 오늘의 기운", callback_data: "gen:daily_fortune" },
          { text: "🧠 명리 떡밥", callback_data: "gen:knowledge" },
        ],
        [
          { text: "🔮 띠별", callback_data: "gen:zodiac" },
          { text: "🌙 댓글 사주", callback_data: "gen:comment_reading" },
        ],
        [
          { text: "📅 이번 주", callback_data: "gen:weekly" },
          { text: "📣 앱 홍보", callback_data: "gen:app_promo" },
        ],
      ]);
      return;
    }

    if (raw.startsWith("/")) {
      // /start 등 — 봇(계정)별로 다른 인사
      const head = accountId === "official"
        ? "🏛 <b>사주앱 공식계정</b> 봇입니다.\n전문가 톤으로 정통 사주 콘텐츠를 관리해요.\n\n"
        : "📿 <b>문달</b> 계정 봇이야.\n친구처럼 편한 사주 콘텐츠 담당!\n\n";
      await sendMessage(
        BOT_TOKEN,
        chatId,
        head +
          "두 가지로 쓸 수 있어 👇\n" +
          "1️⃣ <b>직접 작성</b>: 올릴 본문을 그냥 보내 (대댓은 <code>---</code> 줄로 구분)\n" +
          "2️⃣ <b>AI한테 시키기</b>: <code>생성</code> 보내면 타입 골라서 초안 뽑아줘\n\n" +
          "둘 다 미리보기 + [발행/예약/취소] 버튼. 승인해야만 올라가 " +
          (accountId === "official" ? "" : "ㄱㄱ"),
      );
      return;
    }

    // 본문 / 대댓 체인 분리 ("---" 줄 기준, 여러 개 가능)
    // 예: 본문 \n---\n 댓1 \n---\n 댓2 ... 마지막에 링크만 댓 따로도 가능
    const parts = raw.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean);
    const body = parts[0] ?? raw;
    let replyChain: string[] = parts.slice(1);
    // 수동 글엔 링크 자동부착 안 함 (도배 방지) — 필요하면 --- 아래 직접 쓰기

    const { data: post, error } = await sb
      .from("posts")
      .insert({
        body,
        reply_chain: replyChain,
        reply_body: null,
        account_id: accountId,
        status: "draft",
        scheduled_at: new Date().toISOString(), // 임시값, 버튼으로 확정
        tg_chat_id: chatId,
      })
      .select()
      .single();

    if (error || !post) {
      await sendMessage(BOT_TOKEN, chatId, "저장 실패 😢 " + (error?.message ?? ""));
      return;
    }

    const len = body.length;
    const overWarn = len > THREADS_LIMIT
      ? `\n\n⚠️ 본문이 ${len}자예요. Threads 한도는 ${THREADS_LIMIT}자라 잘릴 수 있어요.`
      : "";
    const chainText = replyChain.length
      ? replyChain.map((r, i) => `  ↳ 댓${i + 1}: ${esc(r)}`).join("\n")
      : "  (대댓 없음)";

    const preview = `📝 <b>미리보기</b> (본문 ${len}자, 대댓 ${replyChain.length}개)\n\n` +
      `${esc(body)}\n\n${chainText}` +
      overWarn +
      `\n\n💡 대댓 여러 개로 나누려면 본문 사이에 "---" 줄을 넣어 보내\n\n언제 올릴까요?`;

    const sent = await sendMessage(BOT_TOKEN, chatId, preview, buildApproveButtons(post.id));
    const mid = sent?.result?.message_id;
    if (mid) await sb.from("posts").update({ tg_message_id: mid }).eq("id", post.id);
  }

  // ── 사진 첨부 ─────────────────────────────────────────────────
  async function handlePhoto(msg: any) {
    const chatId = msg.chat.id;
    if (String(chatId) !== String(OWNER_CHAT_ID)) return;

    // 이 봇(계정)의 최신 draft에 사진 첨부 (아무 글에나 가능)
    const { data: post } = await sb
      .from("posts")
      .select("id, body")
      .eq("status", "draft")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!post) {
      await sendMessage(BOT_TOKEN, chatId, "지금 사진 붙일 글(draft)이 없어. 글 먼저 만들고(생성 or 직접 작성) 사진 보내줘!");
      return;
    }

    try {
      // 제일 큰 사이즈 file_id
      const photos = msg.photo as any[];
      const fileId = photos[photos.length - 1].file_id;
      const fileInfo = await (await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)).json();
      const filePath = fileInfo.result?.file_path;
      if (!filePath) throw new Error("file_path 못 받음");
      const bin = await (await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`)).arrayBuffer();

      const objectPath = `app/${post.id}.jpg`;
      const up = await sb.storage.from("saju-images").upload(objectPath, new Uint8Array(bin), {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (up.error) throw up.error;
      const pub = sb.storage.from("saju-images").getPublicUrl(objectPath).data.publicUrl;

      await sb.from("posts").update({ image_url: pub, needs_image: false }).eq("id", post.id);
      await sendMessage(
        BOT_TOKEN,
        chatId,
        `✅ 사진 첨부 완료!\n\n${esc((post.body ?? "").slice(0, 60))}...\n\n이제 그 글의 [발행/예약] 버튼 눌러주면 사진까지 같이 올라가.`,
      );
    } catch (e) {
      await sendMessage(BOT_TOKEN, chatId, "사진 첨부 실패 😢 " + (e instanceof Error ? e.message : ""));
    }
  }

  // ── 버튼 처리 ─────────────────────────────────────────────────
  async function handleCallback(cq: any) {
    const chatId = cq.message.chat.id;
    const messageId = cq.message.message_id;
    if (String(chatId) !== String(OWNER_CHAT_ID)) {
      await answerCallbackQuery(BOT_TOKEN, cq.id, "권한 없음");
      return;
    }

    const [act, postId] = String(cq.data).split(":");
    await answerCallbackQuery(BOT_TOKEN, cq.id);

    // 🌙 댓글 사주 답글 승인 (creply_ok / creply_no:<comment_id>)
    if (act === "creply_ok" || act === "creply_no") {
      const commentId = postId;
      if (act === "creply_no") {
        await sb.from("comment_replies").update({ status: "cancelled" }).eq("comment_id", commentId);
        await editMessageText(BOT_TOKEN, chatId, messageId, "❌ 이 댓글엔 답 안 달게.");
        return;
      }
      const { data: cr } = await sb
        .from("comment_replies").select("*").eq("comment_id", commentId).maybeSingle();
      if (!cr || cr.status !== "pending") {
        await editMessageText(BOT_TOKEN, chatId, messageId, "이미 처리됐거나 없는 답글이야.");
        return;
      }
      // 그 댓글이 달린 '계정'의 자격증명으로 게시 (문달/공식 각자)
      const crAccount = cr.account_id || "moondal";
      const { data: ca } = await sb.from("accounts")
        .select("threads_user_id, access_token").eq("id", crAccount).maybeSingle();
      const THREADS_USER_ID = ca?.threads_user_id || Deno.env.get("THREADS_USER_ID")!;
      const token = ca?.access_token || Deno.env.get("THREADS_ACCESS_TOKEN");
      try {
        const replyId = await publishPost(
          { userId: THREADS_USER_ID, accessToken: token, text: cr.reply_text, replyToId: commentId },
          5000,
        );
        await sb.from("comment_replies")
          .update({ status: "posted", thread_post_id: replyId })
          .eq("comment_id", commentId);
        await editMessageText(BOT_TOKEN, chatId, messageId, "✅ 댓글에 답글 달았어!");
      } catch (e) {
        await editMessageText(BOT_TOKEN, chatId, messageId, "답글 게시 실패 😢 " + (e instanceof Error ? e.message : ""));
      }
      return;
    }

    // 즉석 생성: generate-content 호출 (계정은 이 봇 컨텍스트)
    if (act === "gen") {
      const type = postId; // gen:type
      await editMessageText(BOT_TOKEN, chatId, messageId, `🤖 [${type}] 뽑는 중... 잠깐만!`);
      fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ account: accountId, content_type: type }),
      }).catch((e) => console.error("generate 호출 실패:", e));
      return;
    }

    // 🔄 다시 뽑기: 이 글 취소하고 같은 타입/계정으로 새로 생성
    if (act === "regen") {
      const { data: p } = await sb.from("posts")
        .select("content_type, account_id").eq("id", postId).maybeSingle();
      await sb.from("posts").update({ status: "cancelled" }).eq("id", postId);
      await editMessageText(BOT_TOKEN, chatId, messageId, "🔄 다시 뽑는 중... 잠깐만!");
      fetch(`${SUPABASE_URL}/functions/v1/generate-content`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ account: p?.account_id || accountId, content_type: p?.content_type || "knowledge" }),
      }).catch((e) => console.error("regen 호출 실패:", e));
      return;
    }

    if (act === "cancel") {
      await sb.from("posts").update({ status: "cancelled" }).eq("id", postId);
      await editMessageText(BOT_TOKEN, chatId, messageId, "❌ 취소했어요. (발행 안 함)");
      return;
    }

    const when = scheduleFor(act);
    if (!when) {
      await editMessageText(BOT_TOKEN, chatId, messageId, "알 수 없는 동작이에요.");
      return;
    }

    const { error } = await sb
      .from("posts")
      .update({
        status: "pending",
        scheduled_at: when.iso,
        tg_chat_id: chatId,
        tg_message_id: messageId,
      })
      .eq("id", postId)
      .eq("status", "draft"); // draft 일 때만 (중복 클릭 방지)

    if (error) {
      await editMessageText(BOT_TOKEN, chatId, messageId, "예약 실패 😢 " + error.message);
      return;
    }

    await editMessageText(
      BOT_TOKEN,
      chatId,
      messageId,
      `✅ 예약 완료!\n🕒 발행 예정: <b>${when.label}</b>\n\n` +
        `(예약 시각이 지나면 10분 안에 자동으로 올라가요)`,
    );
  }
});

/** 한국시간(KST=UTC+9) 기준으로 발행 시각 계산 → UTC ISO 반환 */
function scheduleFor(act: string): { iso: string; label: string } | null {
  const now = Date.now();
  const KST = 9 * 60 * 60 * 1000;

  if (act === "now") {
    return { iso: new Date(now).toISOString(), label: "지금 바로" };
  }
  if (act === "1h") {
    return { iso: new Date(now + 3600_000).toISOString(), label: "1시간 뒤" };
  }
  if (act === "3h") {
    return { iso: new Date(now + 3 * 3600_000).toISOString(), label: "3시간 뒤" };
  }
  if (act === "9am") {
    // 다음 KST 오전 9시 (= UTC 0시) 를 미래로 계산
    const kstNow = new Date(now + KST);
    const target = new Date(
      Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate(),
        9, 0, 0, 0,
      ),
    ).getTime() - KST; // KST 9시를 UTC 로 환산
    let t = target;
    if (t <= now) t += 24 * 3600_000; // 이미 지났으면 내일
    return { iso: new Date(t).toISOString(), label: "내일 오전 9시 (한국시간)" };
  }
  return null;
}
