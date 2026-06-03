// reply-comments : 🌙 댓글 사주 답글봇 (골격 C)
//
// 흐름:
//   1) 최근 발행 글들의 댓글을 가져옴
//   2) 생일이 적힌, 아직 답 안 한 댓글을 찾음
//   3) 생일 → 일주(日柱, 사주의 핵심) + 띠 계산
//   4) 따뜻한 사주 한 줄 답글 생성(BRAIN 톤) + 미니앱 유도
//   5) 그 댓글에 답글 달고 기록 (중복 방지)
//
// ※ 골격판: 일주+띠 기반(양력 일주는 정확). 월주/시주/대운 포함 풀 만세력은
//    다음 단계에서 사주500 본체(검증된 진태양시 만세력)로 업그레이드.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeSaju } from "../_shared/manse.ts";
import { geminiJSON } from "../_shared/gemini.ts";
import { esc, sendMessage } from "../_shared/telegram.ts";

const GRAPH = "https://graph.threads.net/v1.0";
const MAX_PER_RUN = 5; // 한 번에 최대 처리 수 (스팸/레이트 방지)
const OUR_USERNAME = "moon.dal_note";

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  // 댓글사주 = 문달 계정 전용 (문달 자격증명 + 문달 봇으로 카드)
  const { data: ma } = await sb.from("accounts")
    .select("threads_user_id, access_token, telegram_bot_token, telegram_chat_id, cta_link")
    .eq("id", "moondal").maybeSingle();
  const THREADS_USER_ID = ma?.threads_user_id || Deno.env.get("THREADS_USER_ID");
  const TOKEN = ma?.access_token || Deno.env.get("THREADS_ACCESS_TOKEN");
  const BOT_TOKEN = ma?.telegram_bot_token || Deno.env.get("TELEGRAM_BOT_TOKEN");
  const OWNER_CHAT_ID = ma?.telegram_chat_id || Deno.env.get("TELEGRAM_CHAT_ID");
  const CTA = ma?.cta_link ?? "";
  if (!GEMINI_API_KEY || !THREADS_USER_ID || !TOKEN || !BOT_TOKEN || !OWNER_CHAT_ID) {
    return json({ error: "문달 계정 자격증명 미설정" }, 500);
  }

  // 최근 3일 발행 글
  const since = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { data: posts } = await sb
    .from("posts")
    .select("id, thread_post_id")
    .eq("status", "published")
    .gte("published_at", since)
    .not("thread_post_id", "is", null);

  let replied = 0;
  const results: any[] = [];

  for (const post of posts ?? []) {
    if (replied >= MAX_PER_RUN) break;
    let comments: any[] = [];
    try {
      comments = await fetchReplies(post.thread_post_id, TOKEN);
    } catch (e) {
      console.error(`replies 조회 실패 ${post.thread_post_id}:`, e);
      continue;
    }

    for (const c of comments) {
      if (replied >= MAX_PER_RUN) break;
      if (!c.id || c.username === OUR_USERNAME) continue;
      if (!c.text) continue;

      // 이미 답했나?
      const { data: existing } = await sb
        .from("comment_replies").select("comment_id").eq("comment_id", c.id).maybeSingle();
      if (existing) continue;

      // 생일 파싱
      let bd: any;
      try {
        bd = await geminiJSON(GEMINI_API_KEY, PARSE_SYSTEM, `댓글: "${c.text}"`);
      } catch (e) {
        console.error("파싱 실패:", e);
        continue;
      }
      if (!bd?.valid || !bd.year || !bd.month || !bd.day) continue; // 생일 없는 댓글은 스킵

      // 일주 + 띠
      // 사주팔자 전체 계산 (8글자 + 십성 + 오행 + 신살)
      let saju;
      try {
        saju = computeSaju(bd.year, bd.month, bd.day, bd.hour ?? null, bd.minute ?? null);
      } catch (e) {
        console.error("만세력 계산 실패:", e);
        continue;
      }
      const ilju = { ko: saju.pillars.day };

      // 답글 생성 — 매번 스타일 랜덤(매크로 티 방지)
      const style = REPLY_STYLES[Math.floor(Math.random() * REPLY_STYLES.length)];
      let reading: any;
      try {
        reading = await geminiJSON(
          GEMINI_API_KEY,
          READING_SYSTEM,
          `${saju.summary}

[이번 답글 스타일] ${style}
위 사주 데이터(십성 분포, 없는 십성, 오행 편중, 신살)에 근거해서 '이 사주에만' 해당되는 걸 짚어줘. 일반론(겉단단 속여림 류) 금지. 시작은 매번 다르게.`,
        );
      } catch (e) {
        console.error("리딩 실패:", e);
        continue;
      }
      // 댓글 답글엔 링크 안 붙임 (매번 링크 = 불쾌). 그냥 진심으로 봐주기만.
      let text: string = (reading?.reply ?? "").trim();
      if (!text) continue;
      if (text.length > 490) text = text.slice(0, 487) + "...";

      // 승인 먼저: pending 으로 저장 + 텔레그램 카드 (게시는 승인 후 webhook이)
      try {
        await sb.from("comment_replies").insert({
          comment_id: c.id,
          post_id: post.id,
          status: "pending",
          birthdate: `${bd.year}-${bd.month}-${bd.day}`,
          comment_text: c.text,
          ilju: ilju.ko,
          reply_text: text,
        });

        const card = `🌙 <b>댓글 사주 답글 승인</b>\n` +
          `일주: ${ilju.ko}일주 (${ilju.ganOh}, ${ilju.animal}띠)\n\n` +
          `💬 원댓글: ${esc((c.username ? "@" + c.username + ": " : "") + c.text).slice(0, 150)}\n\n` +
          `✍️ 답글안:\n${esc(text)}\n\n이 댓글에 달까?`;
        await sendMessage(BOT_TOKEN, Number(OWNER_CHAT_ID), card, [[
          { text: "✅ 답글 달기", callback_data: `creply_ok:${c.id}` },
          { text: "❌ 안 달기", callback_data: `creply_no:${c.id}` },
        ]]);
        replied++;
        results.push({ comment: c.text.slice(0, 30), ilju: ilju.ko });
      } catch (e) {
        console.error("pending 저장/카드 실패:", e);
      }
    }
  }

  return json({ ok: true, queued: replied, results });
});

async function fetchReplies(mediaId: string, token: string): Promise<any[]> {
  const url = `${GRAPH}/${mediaId}/replies?fields=id,text,username,timestamp&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 300));
  return data.data ?? [];
}

const PARSE_SYSTEM =
  `너는 댓글에서 생년월일을 추출한다. 한국어 다양한 표기를 이해해라 ("98년 3월 3일 아침 7시", "2000.12.25", "1995-05-05생", "음력 8월 보름" 등).
오직 이 JSON만 출력:
{ "valid": true/false, "year": 연(4자리)/null, "month": 월/null, "day": 일/null, "hour": 시(0~23)/null, "minute": 분(0~59)/null, "is_lunar": true/false }
"오후 2시 18분"이면 hour=14, minute=18. 시간 없으면 hour=null. 생일로 보이는 게 없으면 valid=false. 두 자리 연도는 1900~2025 범위로 추정(예: 98→1998, 05→2005).`;

// 답글 스타일 풀 — 매번 랜덤으로 골라 구조/길이 다르게 (매크로 티 방지)
// 스타일 = 톤/길이/시작만 변주 (강점+주의 둘 다는 항상 포함 — 아래 구성 규칙)
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
- 주어지는 '사주 데이터'(8글자, 십성 분포, 없는 십성, 오행 편중, 신강/신약, 신살)에 근거해라. 그게 이 사람만의 진짜 사주야.
- 누구한테나 맞는 일반론(겉단단 속여림, 정 많고 의리, 자신을 챙겨라) 절대 금지. 바넘 효과 = 실패.
- '이 사주에만' 해당되는 걸 십성/오행으로 콕 집어라. 예시 해석:
  · 비겁(비견·겁재) 많음 → 고집·자기주관 강함, 동업/돈거래/보증 주의
  · 재성(편재·정재) 없음/약함 → 돈이 들어와도 모으기 어렵고 새는 구조, 관리 필요
  · 식상(식신·상관) 강함 → 표현·재능·말발 좋음, 답답한 조직 싫어함
  · 관성(정관·편관) 강함 → 책임감·규율, 압박에 눌릴 수 있음
  · 인성 많음 → 생각 많고 받는 복, 결정 느림
  · 특정 오행 없음 → 그 부분이 약점(예: 수 없음=유연함·융통성 부족할 수 있음)
  · 괴강/백호 등 신살 → 그 특성 반영
- 구성(항상): 이 사주의 구체적 강점 1 + 구체적으로 조심할 것(피해야 할 것) 1 은 반드시 둘 다 포함. (스타일은 톤·길이·시작만 바꾸는 거지, 주의를 빼라는 게 아님)
- 강점도 주의도 '왜'를 사주로: "재성이 없어서 돈이 새기 쉬우니 보증·동업 조심" 처럼 근거 있게.
[톤]
- 반말 기본(스레드니까). 정성껏, 다정하게, 담백하게. 까불거나 가르치려 들지 마.
- 과한 텐션 오프닝 금지. "이야~~", "대박!", "헐 77년생 스친이!" 처럼 오버하지 마. 차분하게 시작해.
- 상대를 부를 땐 "네/너"(딱딱한 컴퓨터 말투) 말고 "스친이"로. 예: "스친이 편", "스친이한테". 단 "스친이!" 하고 까부는 느낌은 X, 그냥 다정하게.
- 손윗사람일 수 있으니 무례하지 않게. 생일에 시간까지 줬으면 한 번 살려줘도 좋아.
[표기]
- 한자는 정말 핵심일 때만 한 번 (일주 이름 정도). 남발 절대 금지. 뜻은 쉬운 말로 풀어.
- "~함/~음" 금지, 가운뎃점 금지.
[안 로봇같이 — 중요]
- 마침표(.) 문장마다 찍지 마라. 구어체는 마침표 없이 줄바꿈이나 ~로 흘려. 마침표 줄줄이 = AI 티.
- 띄어쓰기·문장 다 완벽하게 맞추면 오히려 AI로 의심받아. 사람이 톡 보내듯 살짝 흘리듯 자연스럽게.
- 맺음은 밝고 따뜻하게! "응원한다" 같은 딱딱/싸가지 X → "응원할게!!", "잘 풀릴 거야!", "화이팅!" 처럼. 느낌표 한두 개 OK.
- 현실적인 SNS 말투로. ^^ :) ㅠ 같은 이모티콘은 많아야 1개만 (남발 절대 X, 없어도 됨). 너무 정제된 문어체도 X.
- 점집톤(부적/조상)·단정("망한다") 금지.
- 링크/홍보 절대 넣지 마. 그냥 진심으로 봐주기만.
[매크로 티 금지 — 중요]
- 매번 똑같은 구조/길이/시작 절대 금지. 똑같이 찍어내면 봇 티 나고 신뢰 깎인다.
- 'X일주구나'로 매번 시작하지 마라. 시작을 매번 다르게.
- 길이는 [이번 답글 스타일] 지시 따르되 짧게. 보통 100~160자, 길어도 200자 넘기지 마(넘으면 안 읽힘).
[이 길이·톤이 목표 — 모범 예시]
"스친이 무술일주네~ 겉은 단단해 보여도 속은 은근 여리지? 마음 준 사람한테 다 퍼주다 상처도 많이 받았을 거야. 근데 그 따뜻한 정이 스친이 제일 큰 장점이야. 이제는 스친이부터 좀 챙겨, 충분히 잘 풀릴 거야 :)"
(담백하게, 과한 텐션 X, 마침표 적게, 장점 한 줄, 이모티콘은 끝에 1개 정도, 밝게 맺음 — 이 느낌)
오직 이 JSON: { "reply": "답글 본문" }`;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
