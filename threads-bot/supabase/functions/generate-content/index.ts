// generate-content : BRAIN. 타입을 받아 Gemini로 초안 생성 → draft 저장 → 텔레그램 승인 카드 전송.
//
// 호출:
//   - 수동/테스트: POST { "content_type": "knowledge" }
//   - cron(슬롯별): body 에 content_type 지정해서 시간대별 자동 생성
//   - content_type 없으면 시간대(KST)로 자동 선택
//
// 생성된 글은 status='draft' 로 저장되고, 텔레그램에 [발행/예약/취소] 카드가 뜬다.
// 즉 AI 초안 → 사람 승인 → 예약 발행. (승인 없이는 절대 안 나감)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildUserPrompt, FORMAT_RECIPES, systemPromptFor } from "../_shared/brainPrompt.ts";
import { dateContextKST, dayGanjiKST } from "../_shared/ganji.ts";
import { computeSaju } from "../_shared/manse.ts";
import { geminiJSON } from "../_shared/gemini.ts";
import { buildApproveButtons, esc, sendMessage } from "../_shared/telegram.ts";

const THREADS_LIMIT = 500;

// 시간대(KST 시) → 기본 콘텐츠 타입 (슬롯 매핑)
function typeBySlot(hourKST: number): string {
  if (hourKST >= 6 && hourKST < 11) return "daily_fortune"; // 아침
  if (hourKST >= 11 && hourKST < 16) return "knowledge"; // 점심
  if (hourKST >= 16 && hourKST < 22) return "zodiac"; // 저녁
  return "comment_reading"; // 밤
}

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // 입력 content_type (없으면 시간대로) + 계정 (없으면 문달)
  const reqBody = await req.json().catch(() => ({}));
  const account: string = reqBody.account || "moondal";
  const topicHint: string = (reqBody.topic_hint ?? "").trim();
  const reqTargets: string[] = Array.isArray(reqBody.targets)
    ? reqBody.targets.filter((t: string) => t === "threads" || t === "x")
    : [];
  const targets = reqTargets.length ? reqTargets : ["threads"];
  const { data: acct } = await sb.from("accounts")
    .select("cta_link, telegram_bot_token, telegram_chat_id").eq("id", account).maybeSingle();
  // 카드는 '그 계정의 봇/챗'으로 (env 폴백)
  const BOT_TOKEN = acct?.telegram_bot_token || Deno.env.get("TELEGRAM_BOT_TOKEN");
  const OWNER_CHAT_ID = acct?.telegram_chat_id || Deno.env.get("TELEGRAM_CHAT_ID");
  if (!GEMINI_API_KEY || !BOT_TOKEN || !OWNER_CHAT_ID) {
    return json({ error: "GEMINI_API_KEY / 계정 텔레그램 봇 미설정" }, 500);
  }
  const ctx = dateContextKST();
  const ganji = dayGanjiKST();
  const kstNow = new Date(Date.now() + 9 * 3600_000);
  const kstHour = kstNow.getUTCHours();
  let contentType = reqBody.content_type || typeBySlot(kstHour);
  // 월요일 아침엔 오늘의기운 대신 주간운세
  if (contentType === "daily_fortune" && kstNow.getUTCDay() === 1) {
    contentType = "weekly";
  }

  // 매크로 티 방지: 떡밥성 타입은 매번 구성(구조)을 랜덤으로 바꿈
  const useFormat = !topicHint && (contentType === "knowledge" || contentType === "zodiac");
  const formatHint = useFormat
    ? FORMAT_RECIPES[Math.floor(Math.random() * FORMAT_RECIPES.length)]
    : undefined;

  // 주제 힌트에 생일(인물)이 있으면 → 진짜 만세력 계산해서 근거로 주입 (사주 지어내기 방지)
  let personSaju = "";
  // 힌트에서 인물 이름 추출: "홍명보 감독(1969..." / "손흥민(1992..." 패턴
  let personName = "";
  let personBirth = "";
  if (topicHint) {
    const nm = topicHint.match(/([가-힣]{2,4})\s*(?:감독|선수|의원|시장|대표|배우|가수|작가|회장)?\s*\(\s*(?:19|20)\d{2}/);
    if (nm) personName = nm[1];
  }
  if (topicHint) {
    const m = topicHint.match(/((?:19|20)\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);
    if (m) {
      try {
        const sj = computeSaju(Number(m[1]), Number(m[2]), Number(m[3]), null, null);
        personBirth = m[1] + "." + m[2] + "." + m[3];
        personSaju = "\n\n[이 인물의 실제 사주 데이터 — 만세력 계산값]\n" + sj.summary +
          "\n사주 해석은 반드시 위 데이터에만 근거해라. 데이터에 없는 건 지어내지 마라. 인물 이름은 힌트에 적힌 그 이름만 그대로 써라(다른 인물로 바꾸기 절대 금지).";
      } catch (_e) { /* 날짜 파싱 실패 시 무시 */ }
    }
  }

  try {
    // 1) BRAIN 생성 (인물 이름 검증 — 환각 시 최대 3회 재생성)
    let out: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      out = await geminiJSON(
      GEMINI_API_KEY,
      systemPromptFor(account),
      (topicHint ? "⚠️ 최우선 임무: 아래 [오늘의 주제/이슈]가 이 글의 중심 소재다. 다른 주제로 새지 마라.\n[오늘의 주제/이슈] " + topicHint + "\n→ 이슈 자체를 직접 언급하면서 사주 관점으로 엮어라. 특정 정당/인물 지지·비방만 금지." + (personName ? " 인물 이름은 정확히 '" + personName + "' 만 사용해라. 다른 어떤 사람 이름도 절대 쓰지 마라." : "") + "" + personSaju + "\n\n" : "") + buildUserPrompt(contentType, ctx, ganji, formatHint),
      topicHint ? 0.7 : 1.0, // 주제(인물) 글은 저온도 — 이름 환각 방지 (검증됨)
    );
      if (!personName) break;
      const allText = (out?.body ?? "") + (Array.isArray(out?.replies) ? out.replies.join(" ") : "");
      const nameOk = allText.includes(personName);
      if (nameOk) break;
      console.warn("이름 환각 감지 (시도 " + (attempt + 1) + "/3) — 재생성");
      out = null;
    }
    if (!out) throw new Error("인물 이름('" + personName + "') 환각 3회 — 생성 포기. 다시 시도해줘");
    const body: string = deNeo((out.body ?? "").trim());
    const topicTag: string = (out.topic_tag ?? "").trim();
    if (!body) throw new Error("BRAIN 빈 본문");

    const CTA = acct?.cta_link ?? Deno.env.get("THREADS_CTA_LINK") ?? "";

    // 대댓 체인: BRAIN replies(배열) → deNeo → 링크는 맨 끝에 짧게 따로
    const rawReplies: string[] = Array.isArray(out.replies) ? out.replies : [];
    const replyChain: string[] = rawReplies
      .map((r) => deNeo(String(r ?? "").replace(/\{LINK\}/g, CTA).trim()))
      .filter((r) => r.length > 0);
    if (contentType === "app_promo" && CTA) { // 링크는 앱홍보에만 (도배 방지)
      replyChain.push(`전체 풀이 궁금하면 👉 ${CTA}`); // 링크만 따로 (잡소리 X)
    }

    // 이미지 필요 여부 (app_promo 등 image_idea 있으면)
    let imageIdea: string = (out.image_idea ?? "").trim();
    // 인물 사주 글이면 → 만세력 캡쳐를 준기에게 명시적으로 요청 (바이럴용)
    if (personName && personBirth) {
      imageIdea = "[너가 캡쳐해서 사진 올려] " + personName + " 만세력 — 앱에 " + personBirth + " 입력해서 캡쳐 → 이 봇에 사진으로 보내줘";
    }
    const needsImage = !!imageIdea;

    const { data: post, error } = await sb
      .from("posts")
      .insert({
        body,
        reply_chain: replyChain,
        reply_body: null,
        topic_tags: topicTag ? [topicTag] : [],
        content_type: contentType,
        hook_type: out.hook_type ?? null,
        image_idea: imageIdea || null,
        needs_image: needsImage,
        account_id: account,
        targets,
        status: "draft",
        scheduled_at: new Date().toISOString(), // 버튼으로 확정
        tg_chat_id: Number(OWNER_CHAT_ID),
      })
      .select()
      .single();
    if (error || !post) throw new Error("draft 저장 실패: " + (error?.message ?? ""));

    // 텔레그램 승인 카드 (본문 + 대댓 체인 + 이미지 제안)
    const len = body.length;
    const warn = len > THREADS_LIMIT
      ? `\n\n⚠️ ${len}자 — Threads 한도 ${THREADS_LIMIT}자 초과, 잘릴 수 있어요.`
      : "";
    const chainText = replyChain.length
      ? replyChain.map((r, i) => `  ↳ 댓${i + 1}: ${esc(r)}`).join("\n")
      : "  (대댓 없음)";
    const imgReq = needsImage
      ? `\n\n📸 <b>이미지 필요</b>: ${esc(imageIdea)}\n   → 사진을 이 봇에 보내주면 첨부할게 (안 보내면 텍스트만 발행)`
      : "";
    const acctLabel = account === "official" ? "🏛 공식계정" : "📿 문달";
    const preview = `🤖 <b>AI 초안</b> ${acctLabel} [${contentType}] (본문 ${len}자, 대댓 ${replyChain.length}개)\n` +
      `🔮 오늘 일진: ${ganji.ko}(${ganji.han})\n\n` +
      `${esc(body)}\n\n${chainText}\n#${topicTag || "사주"}` +
      imgReq + warn +
      `\n\n맘에 들면 언제 올릴지 골라줘 (별로면 ❌취소 후 다시):`;

    const sent = await sendMessage(BOT_TOKEN, Number(OWNER_CHAT_ID), preview, buildApproveButtons(post.id, targets));
    const mid = sent?.result?.message_id;
    if (mid) await sb.from("posts").update({ tg_message_id: mid }).eq("id", post.id);

    return json({ ok: true, content_type: contentType, post_id: post.id, length: len, replies: replyChain.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 실패해도 텔레그램으로 알림 (조용히 죽지 않게)
    await sendMessage(BOT_TOKEN, Number(OWNER_CHAT_ID), `⚠️ 초안 생성 실패 (${contentType}):\n${esc(msg)}`)
      .catch(() => {});
    return json({ ok: false, error: msg }, 500);
  }
});

// "너" 호칭 → "스친이" 강제 치환 (LLM이 규칙 깜빡할 때 안전망). "너무"는 보호.
function deNeo(s: string): string {
  // 모델이 \n 을 글자 그대로 뱉는 버그 정리 (literal backslash-n -> 줄바꿈)
  s = s.split(String.fromCharCode(92) + "n").join("\n");
  return s
    .replace(/너무/g, " TM ")
    .replace(/너희|너네/g, "스친이들")
    .replace(/너도/g, "스친이도")
    .replace(/너가/g, "스친이가")
    .replace(/너는/g, "스친이는")
    .replace(/너랑/g, "스친이랑")
    .replace(/너를/g, "스친이를")
    .replace(/너한테/g, "스친이한테")
    .replace(/너의/g, "스친이")
    .replace(/너야/g, "스친이야")
    .replace(/ TM /g, "너무");
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
