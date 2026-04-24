import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = [
  "admin@dartvoice.app",
  "support@dartvoice.app",
  "reubensharp18@gmail.com",
  "sharpsolutionsdev@gmail.com",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...CORS, "Access-Control-Allow-Methods": "GET, POST, OPTIONS" },
    });
  }

  try {
    // ── Auth check ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: CORS });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller's JWT using the anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

    const sb = createClient(supabaseUrl, serviceKey);

    // Accept either (a) hard-coded ADMIN_EMAILS list or (b) row in admin_users
    // table keyed by user_id. This lets us grant admin access by inserting into
    // admin_users without a function redeploy.
    let isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "");
    if (!isAdmin) {
      try {
        const { data: adminRow } = await sb
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (adminRow && adminRow.user_id) isAdmin = true;
      } catch (_) { /* table may not exist */ }
    }
    if (!isAdmin) {
      return new Response("Forbidden", { status: 403, headers: CORS });
    }

    // ── POST actions (admin-only): manage users ─────────────────────
    // {action: "grant_trial"|"grant_active"|"revoke"|"set_ambassador", user_id, email?}
    if (req.method === "POST") {
      let body: any = {};
      try { body = await req.json(); } catch (_) {}
      const action = String(body.action || "");
      const uid = String(body.user_id || "");
      if (!uid) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...CORS, "Content-Type": "application/json" }
        });
      }
      const nowIso = new Date().toISOString();
      const inOneMonth = new Date(Date.now() + 30 * 86400 * 1000).toISOString();

      if (action === "grant_trial" || action === "grant_active") {
        const status = action === "grant_trial" ? "trialing" : "active";
        // Upsert a subscription row so the app recognises access
        const email = String(body.email || "");
        const { error } = await sb.from("dartvoice_subscriptions").upsert({
          user_id: uid,
          email: email || null,
          status,
          current_period_end: inOneMonth,
          updated_at: nowIso,
        }, { onConflict: "user_id" });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...CORS, "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ ok: true, status }), {
          headers: { ...CORS, "Content-Type": "application/json" }
        });
      }
      if (action === "revoke") {
        const { error } = await sb.from("dartvoice_subscriptions").update({
          status: "canceled",
          updated_at: nowIso,
        }).eq("user_id", uid);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...CORS, "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ ok: true, status: "canceled" }), {
          headers: { ...CORS, "Content-Type": "application/json" }
        });
      }
      if (action === "set_ambassador") {
        const on = !!body.value;
        const { error } = await sb.from("dartvoice_profiles").update({
          ambassador_partner: on,
        }).eq("id", uid);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { ...CORS, "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ ok: true, ambassador_partner: on }), {
          headers: { ...CORS, "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ error: "unknown action" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    // ── Parallel queries ────────────────────────────────────────────
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      { count: totalUsers },
      { data: subs },
      { data: newUsers },
      { data: referrals },
    ] = await Promise.all([
      sb.from("dartvoice_profiles").select("*", { count: "exact", head: true }),
      sb.from("dartvoice_subscriptions").select("user_id, email, status, current_period_end, updated_at, stripe_customer_id").order("updated_at", { ascending: false }),
      sb.from("dartvoice_profiles").select("id, created_at").gte("created_at", monthStart).order("created_at", { ascending: false }),
      sb.from("dartvoice_referrals").select("referred_email, referrer_user_id, status, reward_amount, created_at").order("created_at", { ascending: false }).limit(100),
    ]);

    // ── Aggregate by status ─────────────────────────────────────────
    const byStatus: Record<string, number> = {};
    for (const s of subs ?? []) {
      byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    }

    // ── Referral counts ─────────────────────────────────────────────
    const pendingStatuses = ["signed_up", "trial_active"];
    const refTotal = referrals?.length ?? 0;
    const refPending = referrals?.filter((r) => pendingStatuses.includes(r.status)).length ?? 0;

    // ── Enrich new users with email by fetching from auth ───────────
    // Use the service role to list users from auth.users
    const newUserIds = (newUsers ?? []).map((u) => u.id);
    let newThisMonth: { email: string; created_at: string }[] = [];

    if (newUserIds.length > 0) {
      // Fetch subscribers to get emails, otherwise fall back to auth admin API
      const { data: subEmails } = await sb
        .from("dartvoice_subscriptions")
        .select("user_id, email")
        .in("user_id", newUserIds);

      const emailMap: Record<string, string> = {};
      for (const s of subEmails ?? []) {
        if (s.email) emailMap[s.user_id] = s.email;
      }

      // For users without a subscription row, try auth.admin
      const missing = newUserIds.filter((id) => !emailMap[id]);
      if (missing.length > 0) {
        const { data: { users: authUsers } } = await sb.auth.admin.listUsers({ perPage: 1000 });
        for (const au of authUsers ?? []) {
          if (missing.includes(au.id) && au.email) {
            emailMap[au.id] = au.email;
          }
        }
      }

      newThisMonth = (newUsers ?? []).map((u) => ({
        email: emailMap[u.id] || "unknown",
        created_at: u.created_at,
      }));
    }

    // ── Enrich referrals with referrer email ────────────────────────
    const referrerIds = [...new Set((referrals ?? []).map((r) => r.referrer_user_id))];
    let referrerEmailMap: Record<string, string> = {};
    if (referrerIds.length > 0) {
      const { data: refSubs } = await sb
        .from("dartvoice_subscriptions")
        .select("user_id, email")
        .in("user_id", referrerIds);
      for (const s of refSubs ?? []) {
        if (s.email) referrerEmailMap[s.user_id] = s.email;
      }
    }

    const referralsList = (referrals ?? []).map((r) => ({
      referred_email: r.referred_email,
      referrer_email: referrerEmailMap[r.referrer_user_id] || null,
      status: r.status,
      reward_amount: r.reward_amount,
      created_at: r.created_at,
    }));

    // ── All users (admin export + management) ───────────────────────
    // Pull auth users (emails) + profiles (ambassador_partner) + subs (status)
    const allUsers: Array<{
      user_id: string;
      email: string | null;
      created_at: string | null;
      status: string | null;
      ambassador_partner: boolean;
      current_period_end: string | null;
    }> = [];
    try {
      const { data: { users: authUsers } } = await sb.auth.admin.listUsers({ perPage: 1000 });
      const { data: profs } = await sb.from("dartvoice_profiles").select("id, ambassador_partner");
      const profMap = new Map<string, boolean>();
      for (const p of profs ?? []) profMap.set(p.id, !!p.ambassador_partner);
      const subMap = new Map<string, { status: string; current_period_end: string | null }>();
      for (const s of subs ?? []) {
        const uid = (s as any).user_id ?? null;
        if (uid) subMap.set(uid, { status: s.status, current_period_end: s.current_period_end });
      }
      for (const au of authUsers ?? []) {
        const sub = subMap.get(au.id) || null;
        allUsers.push({
          user_id: au.id,
          email: au.email ?? null,
          created_at: au.created_at ?? null,
          status: sub?.status ?? null,
          ambassador_partner: profMap.get(au.id) ?? false,
          current_period_end: sub?.current_period_end ?? null,
        });
      }
    } catch (e) {
      console.error("all-users enrichment failed", e);
    }

    // ── Response ────────────────────────────────────────────────────
    return new Response(JSON.stringify({
      totalUsers: totalUsers ?? 0,
      byStatus,
      subscribers: subs ?? [],
      newThisMonth,
      referrals: { total: refTotal, pending: refPending },
      referralsList,
      allUsers,
    }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
