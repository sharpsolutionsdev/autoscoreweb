/**
 * SUPABASE EDGE FUNCTION: sync-stripe-subscription
 *
 * Checks Stripe directly for a customer's subscription and syncs the result
 * back to dartvoice_subscriptions. Used as a fallback when the billing server
 * webhook fails to deliver (e.g. DNS down, server unreachable).
 *
 * POST body (JSON, auth required): {} (no body needed — uses the caller's auth)
 *
 * Environment:
 *   STRIPE_SECRET_KEY          — Stripe secret key
 *   SUPABASE_URL               — auto-set by Supabase
 *   SUPABASE_ANON_KEY          — auto-set by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check=true";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const apiKeyHeader = req.headers.get("apikey") || req.headers.get("x-api-key") || req.headers.get("api-key");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    let isAdminCall = false;
    let userId: string | null = null;
    let userEmail: string | null = null;

    // If caller provided the service role key (via Authorization: Bearer <key> or apikey header)
    // treat this as an admin/server call and accept a JSON body with `user_id` or `email`.
    if (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim() === serviceRoleKey) {
      isAdminCall = true;
    } else if (apiKeyHeader && apiKeyHeader === serviceRoleKey) {
      isAdminCall = true;
    }

    if (isAdminCall) {
      // Parse body for user identification
      const body = await req.json().catch(() => ({}));
      userId = body.user_id ?? null;
      userEmail = body.email ?? null;
      if (!userId && !userEmail) {
        return new Response(
          JSON.stringify({ error: "admin call requires user_id or email in body" }),
          { headers: { ...CORS, "Content-Type": "application/json" }, status: 400 }
        );
      }
    } else {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Error("Not authenticated");
      }
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      const {
        data: { user },
        error: authError,
      } = await supabaseClient.auth.getUser();
      if (authError || !user) throw new Error("Not authenticated");
      userId = user.id;
      userEmail = user.email ?? null;
    }

    // ── Service-role client for writing ───────────────────────────────────────
    const sbAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Query Stripe for subscriptions by customer email ─────────────────────
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-06-20",
    });

    // Ensure we have an email to search Stripe by. If admin-mode provided only user_id,
    // try to look up the email via the admin client.
    if (!userEmail && userId) {
      try {
        const u = await sbAdmin.auth.admin.getUserById(userId);
        userEmail = (u.data?.user?.email as string) ?? null;
      } catch (_) {
        // ignore lookup failures
      }
    }

    if (!userEmail) {
      return new Response(
        JSON.stringify({ synced: false, reason: "no_email_available" }),
        { headers: { ...CORS, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Find Stripe customer(s) for this email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 5,
    });

    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ synced: false, reason: "no_stripe_customer" }),
        { headers: { ...CORS, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check all customers for an active/trialing subscription
    let bestSub: Stripe.Subscription | null = null;
    let bestCustomerId: string | null = null;

    for (const cust of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: cust.id,
        limit: 5,
      });
      for (const sub of subs.data) {
        if (["active", "trialing"].includes(sub.status)) {
          bestSub = sub;
          bestCustomerId = cust.id;
          break;
        }
        // Keep the most recent one as fallback
        if (
          !bestSub ||
          sub.created > bestSub.created
        ) {
          bestSub = sub;
          bestCustomerId = cust.id;
        }
      }
      if (bestSub && ["active", "trialing"].includes(bestSub.status)) break;
    }

    if (!bestSub) {
      return new Response(
        JSON.stringify({ synced: false, reason: "no_subscription" }),
        { headers: { ...CORS, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ── Write to dartvoice_subscriptions ──────────────────────────────────────
    const periodEnd = bestSub.current_period_end
      ? new Date(bestSub.current_period_end * 1000).toISOString()
      : null;

    const trialStart = bestSub.trial_start
      ? new Date(bestSub.trial_start * 1000).toISOString()
      : null;

    const row: Record<string, unknown> = {
      user_id: userId,
      stripe_customer_id: bestCustomerId,
      stripe_sub_id: bestSub.id,
      status: bestSub.status,
      email: userEmail,
      updated_at: new Date().toISOString(),
    };
    if (periodEnd) row.current_period_end = periodEnd;
    if (trialStart) row.trial_start = trialStart;

    const { error: upsertError } = await sbAdmin
      .from("dartvoice_subscriptions")
      .upsert(row, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      throw new Error("Failed to sync subscription");
    }

    // ── Return the synced subscription ────────────────────────────────────────
    const { data: freshSub } = await sbAdmin
      .from("dartvoice_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    return new Response(
      JSON.stringify({ synced: true, subscription: freshSub }),
      { headers: { ...CORS, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("sync-stripe-subscription error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...CORS, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
