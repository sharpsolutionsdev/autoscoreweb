// DartVoice referral-upsert Edge Function.
//
// Called from the dashboard client after sign-in when a `dv_ref_code` is
// present in sessionStorage. Runs under the service role so it can INSERT
// into public.dartvoice_referrals regardless of RLS, while still requiring
// a valid JWT on the Authorization header (verify_jwt=true) so only the
// referred user themselves can trigger the upsert.
//
// Idempotent via ux_dv_ref_referred_user (unique on referred_user_id when
// not null): a duplicate insert resolves to { ok: true, dupe: true } rather
// than a client-visible 23505.
//
// Request body: { code: string }
// Response:
//   200 { ok: true, dupe?: boolean, referral_id?: number }
//   400 { ok: false, error: 'missing_code' | 'invalid_code' | 'self_referral' }
//   401 { ok: false, error: 'unauthenticated' }
//   500 { ok: false, error: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  // verify_jwt=true has already rejected unauthenticated callers, but we also
  // need the user id. Parse the JWT via a user-scoped client that forwards the
  // Authorization header.
  const auth = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ ok: false, error: "unauthenticated" }, 401);
  const user = userData.user;

  let body: { code?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok, fall through */ }
  const code = (body.code || "").trim();
  if (!code) return json({ ok: false, error: "missing_code" }, 400);

  // Service-role client for the referrer lookup + insert (bypasses RLS).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: referrer, error: refErr } = await admin
    .from("dartvoice_profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  if (refErr) return json({ ok: false, error: refErr.message }, 500);
  if (!referrer) return json({ ok: false, error: "invalid_code" }, 400);
  if (referrer.id === user.id) return json({ ok: false, error: "self_referral" }, 400);

  // Attempt insert. If the partial unique index trips (same referred_user_id
  // already present), treat as a benign duplicate and return ok.
  const { data: inserted, error: insErr } = await admin
    .from("dartvoice_referrals")
    .insert({
      referrer_user_id: referrer.id,
      referred_user_id: user.id,
      referred_email: user.email,
      referral_code: code,
      status: "signed_up",
    })
    .select("id")
    .maybeSingle();

  if (insErr) {
    if ((insErr as { code?: string }).code === "23505") {
      return json({ ok: true, dupe: true });
    }
    return json({ ok: false, error: insErr.message }, 500);
  }

  return json({ ok: true, dupe: false, referral_id: inserted?.id });
});
