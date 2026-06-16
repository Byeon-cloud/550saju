// Gemini API 호출 헬퍼 (generateContent, JSON 강제)
// 무료 티어는 혼잡 시 503(high demand)/429 가 간헐적으로 뜸 →
// ① 재시도(백오프) ② 그래도 안 되면 예비 모델(2.0-flash)로 자동 전환.
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callOnce(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
): Promise<{ ok: true; data: any } | { ok: false; status: number; detail: string }> {
  const url = `${BASE}/${model}:generateContent?key=${apiKey}`;
  const body: any = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };
  // 2.5 계열만 thinking 끔 (출력 토큰 잠식 방지). 2.0 은 미지원이라 빼야 함.
  if (model.startsWith("gemini-2.5")) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, detail: JSON.stringify(data).slice(0, 300) };
  }
  return { ok: true, data };
}

export async function geminiJSON(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 1.0, // 콘텐츠 생성=1.0(창의), 사실 분석/파싱=0.2(환각 방지)
): Promise<any> {
  // 예비 키들(다른 무료 프로젝트 = 각각 별도 한도). 메인 붐비거나 한도 차면 자동 전환.
  const backupKeys = [
    Deno.env.get("GEMINI_API_KEY_2"),
    Deno.env.get("GEMINI_API_KEY_3"),
    Deno.env.get("GEMINI_API_KEY_4"),
  ].filter((k): k is string => !!k);
  // 시도 순서: 메인·2.5 ×2 → 예비키들·2.5 → 메인·2.0 → 예비키들·2.0
  const plan: Array<{ model: string; key: string; waitMs: number }> = [
    { model: PRIMARY_MODEL, key: apiKey, waitMs: 0 },
    { model: PRIMARY_MODEL, key: apiKey, waitMs: 2500 },
    ...backupKeys.map((key) => ({ model: PRIMARY_MODEL, key, waitMs: 800 })),
    { model: FALLBACK_MODEL, key: apiKey, waitMs: 800 },
    ...backupKeys.map((key) => ({ model: FALLBACK_MODEL, key, waitMs: 800 })),
  ];

  let last = "";
  for (const step of plan) {
    if (step.waitMs) await sleep(step.waitMs);
    const r = await callOnce(step.model, step.key, systemPrompt, userPrompt, temperature);
    if (r.ok) {
      const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        last = `빈 응답(${step.model})`;
        continue;
      }
      try {
        return JSON.parse(text);
      } catch {
        const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        try {
          return JSON.parse(cleaned);
        } catch {
          last = `JSON 파싱 실패(${step.model})`;
          continue;
        }
      }
    }
    last = `Gemini ${r.status}(${step.model}): ${r.detail}`;
    // 503/429/500 류만 재시도 가치 있음. 4xx(키/요청 문제)는 즉시 중단.
    if (r.status !== 503 && r.status !== 429 && r.status < 500) break;
  }
  throw new Error(last || "Gemini 호출 실패");
}
