// reply-comments : 댓글 답글봇 (문달 + 공식, 멀티계정)
//
// 흐름 (15분 cron):
//   1) 각 활성 계정의 최근 발행 글 댓글 수집
//   2) 미응답 댓글 분류:
//      - 생일 댓글 → 만세력(8글자) 계산 → 사주 답글안
//      - 일반 댓글 → 글 맥락에 맞는 짧은 답글안
//   3) 그 계정의 텔레그램 봇으로 승인 카드 → ✅ 누르면 게시 (승인 없이는 안 나감)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeSaju } from "../_shared/manse.ts";
import { geminiJSON } from "../_shared/gemini.ts";
import { esc, sendMessage } from "../_shared/telegram.ts";

const GRAPH = "https://graph.threads.net/v1.0";
const MAX_PER_RUN = 5; // 계정당 한 번에 최대 처리 수

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY 미설정" }, 500);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: accounts } = await sb
    .from("accounts")
    .select("id, handle, threads_user_id, access_token, telegram_bot_token, telegram_chat_id")
    .eq("active", true)
    .not("access_token", "is", null)
    .not("telegram_bot_token", "is", null);

  const since = new Date(Date.now() - 3 * 86400_000).toISOString();
  const results: any[] = [];

  for (const acct of accounts ?? []) {
    let queued = 0;
    const { data: posts } = await sb
      .from("posts")
      .select("id, thread_post_id, body")
      .eq("status", "published")
      .eq("account_id", acct.id)
      .gte("published_at", since)
      .not("thread_post_id", "is", null);

    for (const post of posts ?? []) {
      if (queued >= MAX_PER_RUN) break;
      let comments: any[] = [];
      try {
        comments = await fetchReplies(post.thread_post_id, acct.access_token);
      } catch (e) {
        console.error(`replies 조회 실패 ${post.thread_post_id}:`, e);
        continue;
      }

      for (const c of comments) {
        if (queued >= MAX_PER_RUN) break;
        if (!c.id || !c.text) continue;
        if (c.username === acct.handle) continue; // 우리 글/답글 스킵

        const { data: existing } = await sb
          .from("comment_replies").select("comment_id").eq("comment_id", c.id).maybeSingle();
        if (existing) continue;

        // 생일 파싱 시도
        let bd: any = null;
        try {
          bd = await geminiJSON(GEMINI_API_KEY, PARSE_SYSTEM, `댓글: "${c.text}"`, 0.1);
        } catch { /* 파싱 실패 → 일반 댓글로 */ }

        let text = "";
        let ilju: string | null = null;
        let kind = "general";

        if (bd?.valid && bd.year && bd.month && bd.day) {
          // ── 사주 답글 ──
          kind = "saju";
          let saju;
          try {
            saju = computeSaju(bd.year, bd.month, bd.day, bd.hour ?? null, bd.minute ?? null);
          } catch (e) { console.error("만세력 실패:", e); continue; }
          ilju = saju.pillars.day;
          const style = REPLY_STYLES[Math.floor(Math.random() * REPLY_STYLES.length)];
          try {
            const r = await geminiJSON(
              GEMINI_API_KEY,
              READING_SYSTEM + toneBlock(acct.id),
              `${saju.summary}\n\n[이번 답글 스타일] ${style}\n위 사주 데이터(십성 분포, 없는 십성, 오행 편중, 신살)에 근거해서 '이 사주에만' 해당되는 걸 짚어줘. 일반론 금지. 시작은 매번 다르게.`,
            );
            text = (r?.reply ?? "").trim();
          } catch (e) { console.error("리딩 실패:", e); continue; }
        } else {
          // ── 일반 댓글 답글 ──
          try {
            const r = await geminiJSON(
              GEMINI_API_KEY,
              GENERAL_SYSTEM + toneBlock(acct.id),
              `[내가 올린 글]\n${(post.body ?? "").slice(0, 300)}\n\n[달린 댓글] @${c.username}: ${c.text}\n\n이 댓글에 달 답글 1개.`,
            );
            text = (r?.reply ?? "").trim();
          } catch (e) { console.error("일반답글 실패:", e); continue; }
        }

        if (!text) continue;
        if (text.length > 490) text = text.slice(0, 487) + "...";

        try {
          await sb.from("comment_replies").insert({
            comment_id: c.id,
            post_id: post.id,
            account_id: acct.id,
            status: "pending",
            birthdate: bd?.valid ? `${bd.year}-${bd.month}-${bd.day}` : null,
            comment_text: c.text,
            ilju,
            reply_text: text,
          });

          const head = kind === "saju"
            ? `🌙 <b>댓글 사주 답글</b>${ilju ? ` (${ilju}일주)` : ""}`
            : `💬 <b>댓글 답글</b>`;
          const card = `${head}\n\n` +
            `원댓글 @${esc(c.username ?? "")}: ${esc(c.text).slice(0, 150)}\n\n` +
            `✍️ 답글안:\n${esc(text)}\n\n이 댓글에 달까?`;
          await sendMessage(acct.telegram_bot_token, Number(acct.telegram_chat_id), card, [[
            { text: "✅ 답글 달기", callback_data: `creply_ok:${c.id}` },
            { text: "❌ 안 달기", callback_data: `creply_no:${c.id}` },
          ]]);
          queued++;
          results.push({ account: acct.id, kind, comment: c.text.slice(0, 25) });
        } catch (e) {
          console.error("pending 저장/카드 실패:", e);
        }
      }
    }
  }

  return json({ ok: true, queued: results.length, results });
});

async function fetchReplies(mediaId: string, token: string): Promise<any[]> {
  const url = `${GRAPH}/${mediaId}/replies?fields=id,text,username,timestamp&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 300));
  return data.data ?? [];
}

// 계정별 호칭/톤 오버라이드
function toneBlock(accountId: string): string {
  return accountId === "official"
    ? `\n[계정 톤] 이 답글은 사주앱 공식 계정 답글이다. '스친이' 호칭 절대 금지. 호칭 없이 담백하게, 친근한 전문가 톤(반말 OK, 까불기 X).`
    : `\n[계정 톤] 이 답글은 문달(친구 캐릭터) 답글이다. 상대 호칭은 '스친이'(너/너희 금지), 다정하고 친근하게.`;
}

const PARSE_SYSTEM =
  `너는 댓글에서 생년월일을 추출한다. 한국어 다양한 표기를 이해해라 ("98년 3월 3일 아침 7시", "2000.12.25", "1995-05-05생" 등).
오직 이 JSON만 출력:
{ "valid": true/false, "year": 연(4자리)/null, "month": 월/null, "day": 일/null, "hour": 시(0~23)/null, "minute": 분(0~59)/null, "is_lunar": true/false }
"오후 2시 18분"이면 hour=14, minute=18. 시간 없으면 hour=null. 생일로 보이는 게 없으면 valid=false. 두 자리 연도는 1900~2025 범위로 추정.`;

const REPLY_STYLES: string[] = [
  "담백하게 핵심만, 짧게. 110~150자.",
  "조금 더 풀어서 차분하게. 150~190자.",
  "'예전에 ~했을 거야' 살아온 경험 한 줄 먼저 짚고 들어가기.",
  "강점 먼저 짚어 기분 좋게 → 주의로 부드럽게 마무리.",
  "'혹시 ~하지 않아?' 질문 던지며 시작.",
  "조심할 점에 살짝 무게 두되 따뜻하게.",
];

const READING_SYSTEM =
  `너는 사주 진짜 잘 보는 사람이고, 댓글로 생일 남긴 사람에게 정성껏 사주를 봐주는 답글을 쓴다.
[명리 기반 — 정확하게가 생명]
- 주어지는 '사주 데이터'(8글자, 십성 분포, 없는 십성, 오행 편중, 신강/신약, 신살)에 근거해라.
- 누구한테나 맞는 일반론(겉단단 속여림, 정 많고 의리) 절대 금지. 바넘 효과 = 실패.
- '이 사주에만' 해당되는 걸 십성/오행으로 콕 집어라:
  비겁 많음→고집·동업/보증 주의 / 재성 없음→돈 새는 구조 / 식상 강함→표현·재능 / 관성 강함→책임·압박 / 인성 많음→생각 많고 결정 느림 / 오행 결핍→그 약점 / 괴강·백호→그 특성.
- 구성(항상): 구체적 강점 1 + 구체적으로 조심할 것 1 둘 다 포함. '왜'를 사주로 설명.
[톤]
- 반말 기본. 정성껏, 다정하게, 담백하게. 과한 텐션 오프닝("이야~~","대박!") 금지.
- 깔보는 반문 금지: "~같지?", "~냐?", "~인 줄 알았지?" 류 싸가지없는 말투 절대 X.
- 손윗사람일 수 있으니 무례하지 않게. 시간까지 줬으면 한 번 살려줘도 좋아.
[표기]
- 한자는 일주 이름 정도만. "~함/~음" 금지, 가운뎃점 금지.
- 마침표 줄줄이 금지, 줄바꿈으로. 이모티콘 많아야 1개. 맺음은 밝게("응원할게!!","잘 풀릴 거야!").
- 링크/홍보 절대 금지.
[매크로 티 금지]
- 매번 똑같은 구조/시작 금지. 'X일주구나'로 매번 시작하지 마. 보통 100~160자, 최대 200자.
[모범 예시]
"스친이 무술일주네~ 겉은 단단해 보여도 속은 은근 여리지? 마음 준 사람한테 다 퍼주다 상처도 많이 받았을 거야. 근데 그 따뜻한 정이 제일 큰 장점이야. 이제는 자신부터 좀 챙겨, 충분히 잘 풀릴 거야 :)"
오직 이 JSON: { "reply": "답글 본문" }`;

const GENERAL_SYSTEM =
  `너는 내 Threads 글에 달린 댓글에 답하는 운영자다. 짧고 진심 있게, 대화가 이어지게 답해라.
[규칙]
- 30~100자. 짧게. 댓글 내용에 '구체적으로' 반응해라 (영혼 없는 "감사합니다" 금지).
- 글 주제와 연결해 한 마디 보태거나, 가벼운 되물음으로 대화 이어가기.
- 마침표 줄줄이 금지, "~함/~음" 금지, 가운뎃점 금지, 이모티콘 0~1개.
- 링크/홍보 절대 금지. 점집톤 금지.
- 상대가 반말이면 반말, 존댓말이면 가볍게 맞춰줘도 좋다.
오직 이 JSON: { "reply": "답글 본문" }`;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
