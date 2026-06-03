// refresh-token : 모든 활성 계정의 Threads long-lived 토큰을 갱신 (주 1회 cron).
// 계정별 토큰 → accounts.access_token 에 저장.
//   GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=<현재토큰>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH = "https://graph.threads.net";

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: accounts } = await sb
    .from("accounts")
    .select("id, access_token")
    .eq("active", true)
    .not("access_token", "is", null);

  const results: any[] = [];
  for (const a of accounts ?? []) {
    if (!a.access_token) continue;
    try {
      const url = `${GRAPH}/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(a.access_token)}`;
      const res = await fetch(url);
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.access_token) {
        results.push({ account: a.id, ok: false, detail: body });
        continue;
      }
      await sb.from("accounts")
        .update({ access_token: body.access_token, token_updated_at: new Date().toISOString() })
        .eq("id", a.id);
      results.push({ account: a.id, ok: true, expires_in: body.expires_in });
    } catch (e) {
      results.push({ account: a.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify({ refreshed: results }), {
    headers: { "content-type": "application/json" },
  });
});
