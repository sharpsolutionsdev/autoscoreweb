/**
 * SUPABASE EDGE FUNCTION: create-stripe-session
 *
 * Creates a Stripe Checkout session for DartVoice Pro subscriptions.
 * Mirrors the logic in billing_server/app.py /checkout endpoint.
 *
 * POST body (JSON, auth required):
 *   { successUrl?, cancelUrl? }
 *
 * Environment:
 *   STRIPE_SECRET_KEY       — Stripe secret key
 *   STRIPE_PRICE_ID         — DartVoice Pro price ID
 *   SITE_URL                — https://dartvoice.app
 *   SUPABASE_URL            — auto-set by Supabase
 *   SUPABASE_ANON_KEY       — auto-set by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — service role key
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check=true";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TRIAL_DAYS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Manual auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Not authenticated — please sign in first");
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
    if (authError || !user) {
      throw new Error("Not authenticated — please sign in first");
    }

    const { successUrl, cancelUrl } = await req.json();
    const siteUrl = Deno.env.get("SITE_URL") || "https://dartvoice.app";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-06-20",
    });

    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    if (!priceId) throw new Error("STRIPE_PRICE_ID not configured");

    // Find or create Stripe customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = newCustomer.id;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      payment_method_collection: "always",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: { supabase_user_id: user.id },
      },
      client_reference_id: user.id,
      success_url:
        successUrl || `${siteUrl}/thanks.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${siteUrl}/checkout-cancelled.html`,
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...CORS, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("create-stripe-session error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...CORS, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
