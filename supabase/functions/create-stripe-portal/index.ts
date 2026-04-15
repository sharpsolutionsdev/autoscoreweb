/**
 * SUPABASE EDGE FUNCTION: create-stripe-portal
 *
 * Returns a short-lived Stripe Customer Portal URL so the authenticated user
 * can manage (update card, cancel, resume) their own DartVoice subscription.
 *
 * POST body (JSON, auth required): { returnUrl?: string }
 *
 * Env:
 *   STRIPE_SECRET_KEY, SITE_URL,
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check=true";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Not authenticated");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const SITE_URL = Deno.env.get("SITE_URL") || "https://dartvoice.app";

    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await sbUser.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

    const { returnUrl } = await req.json().catch(() => ({}));
    const backTo = returnUrl || `${SITE_URL}/dartvoice-dashboard.html`;

    let { data: sub } = await sbAdmin
      .from("dartvoice_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id || null;

    if (!customerId && user.email) {
      const list = await stripe.customers.list({ email: user.email, limit: 1 });
      if (list.data.length) {
        customerId = list.data[0].id;
        await sbAdmin
          .from("dartvoice_subscriptions")
          .upsert(
            {
              user_id: user.id,
              email: user.email,
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
      }
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "no_stripe_customer" }),
        {
          status: 404,
          headers: { ...CORS, "Content-Type": "application/json" },
        }
      );
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: backTo,
    });

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-stripe-portal error:", (err as any).message || err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
