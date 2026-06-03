// generate-analysis : 시사/화제 인물 사주 분석 (트렌드 잭킹)
//
// 호출(텔레그램): "분석: 오세훈 1961.1.4 / 정원오 1965.x.x / 서울시장 누가 유리?" 같은 자유 텍스트
// 흐름: 인물+생일+이슈 파싱 → 각자 만세력(8글자) 계산 → 정통 명리 비교 분석(본문+대댓 체인) → draft → 텔레그램 카드
//
// ※ 정치/승패 등 민감 주제는 단정 금지, "사주 관점의 재미" 프레임.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeSaju } from "../_shared/manse.ts";
import { geminiJSON } from "../_shared/gemini.ts";
import { buildApproveButtons, esc, sendMessage } from "../_shared/telegram.ts";

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const OWNER_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!GEMINI_API_KEY || !BOT_TOKEN || !OWNER_CHAT_ID) {
    return json({ error: "env 미설정" }, 500);
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const reqBody = await req.json().catch(() => ({}));
  const request: string = (reqBody.request ?? "").trim();
  if (!request) return json({ error: "request 비어있음" }, 400);

  try {
    // 1) 인물 + 생일 + 이슈 파싱 (저온도 — 정확히 추출, 환각 방지)
    const parsed = await geminiJSON(GEMINI_API_KEY, PARSE_SYSTEM, request, 0.1);
    const people = (parsed?.people ?? []).filter((p: any) => p?.name && p?.year);
    const topic: string = parsed?.topic ?? request;
    if (!people.length) {
      await sendMessage(BOT_TOKEN, Number(OWNER_CHAT_ID), "인물+생일을 못 찾았어. 예: 분석: 오세훈 1961.1.4 / 정원오 1965.3.2 / 서울시장 누가 유리?");
      return json({ ok: false, error: "no people" });
    }

    // 2) 각자 만세력 계산 — 이름 대신 플레이스홀더 {{P0}} 사용(환각 방지)
    const charts = people.map((p: any, i: number) => {
      const s = computeSaju(p.year, p.month ?? 1, p.day ?? 1, p.hour ?? null, p.minute ?? null);
      // 익명 요약만 전달 (생일·간지 숨김 → 모델이 유명인 못 알아봄)
      return `{{P${i}}} 의 사주:\n${s.anonSummary}`;
    }).join("\n\n");

    // 3) 전문 분석 생성
    const out = await geminiJSON(
      GEMINI_API_KEY,
      ANALYSIS_SYSTEM,
      `[이슈/질문] ${topic}\n\n[인물별 사주 데이터]\n${charts}\n\n위 사주 데이터에 근거해 정통 명리로 분석해줘. 인물은 반드시 {{P0}}, {{P1}} 표기로만 지칭해라(실제 이름 절대 쓰지 마).`,
      0.25,
    );
    let body: string = (out.body ?? "").trim();
    let replies: string[] = (Array.isArray(out.replies) ? out.replies : []).map((r: any) => String(r ?? "").trim()).filter(Boolean);
    if (!body) throw new Error("빈 분석");

    // 플레이스홀더 → 진짜 이름 치환
    const sub = (t: string) => people.reduce((acc: string, p: any, i: number) =>
      acc.replaceAll(`{{P${i}}}`, p.name), t);
    body = sub(body);
    replies = replies.map(sub);

    // 안전망: 모델이 플레이스홀더 무시하고 실제 이름을 흘렸을 때 잡아서 치환
    // (단일 인물일 때, 'OOO 사주/OOO의 사주' 패턴의 leaked 이름 → 준 이름으로)
    if (people.length === 1 && !body.includes(people[0].name)) {
      const joined = body + "\n" + replies.join("\n");
      const m = joined.match(/([가-힣]{2,4})(?:\s*님)?(?:의)?\s*사주/);
      if (m && m[1] !== people[0].name) {
        const leaked = m[1];
        body = body.replaceAll(leaked, people[0].name);
        replies = replies.map((r) => r.replaceAll(leaked, people[0].name));
      }
    }

    const imageIdea: string = (out.image_idea ?? "").trim();
    const { data: post, error } = await sb.from("posts").insert({
      body,
      reply_chain: replies,
      topic_tags: out.topic_tag ? [out.topic_tag] : ["사주"],
      content_type: "analysis",
      image_idea: imageIdea || null,
      needs_image: !!imageIdea,
      status: "draft",
      scheduled_at: new Date().toISOString(),
      tg_chat_id: Number(OWNER_CHAT_ID),
    }).select().single();
    if (error || !post) throw new Error("저장 실패: " + (error?.message ?? ""));

    const chainText = replies.length ? replies.map((r, i) => `  ↳ 댓${i + 1}: ${esc(r)}`).join("\n") : "  (대댓 없음)";
    const imgReq = imageIdea ? `\n\n📸 이미지 필요: ${esc(imageIdea)} → 사진 보내주면 첨부할게` : "";
    const card = `🔮 <b>시사 사주 분석</b> [${esc(topic).slice(0, 40)}]\n\n${esc(body)}\n\n${chainText}\n#${out.topic_tag || "사주"}${imgReq}\n\n언제 올릴까?`;
    await sendMessage(BOT_TOKEN, Number(OWNER_CHAT_ID), card, buildApproveButtons(post.id));

    return json({ ok: true, post_id: post.id, people: people.length, replies: replies.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sendMessage(BOT_TOKEN, Number(OWNER_CHAT_ID), `⚠️ 분석 생성 실패:\n${esc(msg)}`).catch(() => {});
    return json({ ok: false, error: msg }, 500);
  }
});

const PARSE_SYSTEM =
  `사용자 요청에서 분석할 인물들과 생일, 그리고 이슈/질문을 뽑아라. 생일 표기 다양("1961.1.4", "1961년 1월 4일 오전 5시" 등) 이해.
오직 JSON: { "topic": "이슈/질문 한 줄", "people": [ { "name": "이름", "year": 4자리, "month": 월/null, "day": 일/null, "hour": 0~23/null, "minute": 0~59/null } ] }
생일 없으면 그 인물은 빼라. 인물 없으면 people: [].`;

const ANALYSIS_SYSTEM =
  `너는 정통 명리학으로 화제의 인물/이슈를 분석하는 전문가다. 사주앱 공식계정에 올릴 분석 글을 쓴다.
[핵심]
- ⚠️ 인물은 무조건 {{P0}}, {{P1}} 같은 표기로만 지칭해라. 실제 사람 이름(오세훈, 이재명 등)이나 직책(대통령, 시장)을 절대 쓰지 마라. 시스템이 나중에 실제 이름으로 바꾼다. 예: "{{P0}} 사주를 보면~"
- ⚠️ 이 사주가 누구 건지 추측하지 마. 너의 외부 지식(경력·사건·정당)은 절대 쓰지 말고 오직 주어진 '사주 데이터'만으로 분석해라.
- 주어진 각 인물의 '사주 데이터'(8글자, 십성, 오행, 신강약, 신살)에만 근거. 데이터에 없는 건 지어내지 마.
- 십성/오행으로 '왜'를 설명: "관성이 천간에 안 떠서 권위운은 누리되 정점은 아쉽다", "재성이 약해 후천적으로 살린 걸로 보인다" 처럼 근거 있게.
[톤]
- 전문적이되 읽기 쉽게. 명리 용어는 써도 되지만(전문성 어필) 어려운 건 한 번 가볍게 풀어줘.
- 담백하고 차분하게. 까불지 말고. 반말 OK.
- 단정 금지. 특히 정치/승패는 "~로 보인다", "~가능성이 높아 보인다", "사주 관점에선 ~" 선에서. 편파적 정치 주장 금지. "재미로 보는 명리 관점" 임을 깔아라.
- 비방/혐오 금지. 인물 존중.
[구조]
- 본문(body): 주제를 흥미롭게 던지기. 예: "OOO vs OOO, 사주로 보면 누가 유리할까". 짧게.
- 대댓(replies): 인물별로 나눠서 분석(인물당 1~2개), 마지막 대댓에 종합/결론. 각 대댓 충실하되 안 읽히게 길지 마.
- 인물 이름으로 시작하면 좋음: "먼저 OOO 사주를 보면~"
[기타]
- 한자는 핵심 간지/용어에만 가끔. 남발 X. 마침표 줄이고 자연스럽게.
- image_idea: 인물 사진 등 이미지가 있으면 좋겠으면 한 줄로 (예: "두 후보 인물 사진"). 아니면 빈 문자열.
- 링크는 넣지 마. want_link 무시.
오직 JSON: { "body": "...", "replies": ["...","..."], "topic_tag": "사주", "image_idea": "" }`;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
