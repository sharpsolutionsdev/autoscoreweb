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
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

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
      sb.from("dartvoice_subscriptions").select("email, status, current_period_end, updated_at, stripe_customer_id").order("updated_at", { ascending: false }),
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

    // ── Response ────────────────────────────────────────────────────
    return new Response(JSON.stringify({
      totalUsers: totalUsers ?? 0,
      byStatus,
      subscribers: subs ?? [],
      newThisMonth,
      referrals: { total: refTotal, pending: refPending },
      referralsList,
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
