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

    // ── Service-role client for writing ───────────────────────────────────────
    const sbAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Query Stripe for subscriptions by customer email ─────────────────────
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-06-20",
    });

    // Find Stripe customer(s) for this email
    const customers = await stripe.customers.list({
      email: user.email,
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
      user_id: user.id,
      stripe_customer_id: bestCustomerId,
      stripe_sub_id: bestSub.id,
      status: bestSub.status,
      email: user.email,
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
      .eq("user_id", user.id)
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
