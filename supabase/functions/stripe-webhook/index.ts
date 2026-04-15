/**
 * SUPABASE EDGE FUNCTION: stripe-webhook
 *
 * Verifies Stripe webhook signatures and upserts `dartvoice_subscriptions`
 * so the website + extension instantly reflect subscribe/cancel/fail events.
 *
 * Env required:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Handled events:
 *   checkout.session.completed
 *   customer.subscription.{created,updated,deleted}
 *   invoice.payment_{succeeded,failed}
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno&no-check=true";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-info, apikey, Stripe-Signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const toIso = (ts?: number | null) =>
  ts ? new Date(ts * 1000).toISOString() : null;

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...CORS },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS },
    });

const payload = new Uint8Array(await req.arrayBuffer());
  const sig =
    req.headers.get("stripe-signature") ||
    req.headers.get("Stripe-Signature") ||
    "";

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (
    !STRIPE_SECRET_KEY ||
    !STRIPE_WEBHOOK_SECRET ||
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error("stripe-webhook: missing env vars");
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("stripe-webhook: signature failed:", (err as any).message);
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const etype: string = event.type;
  const obj: any = (event.data || {}).object || {};
  console.log("stripe-webhook event:", etype, obj.id ?? "(no id)");

  // --- helpers ---------------------------------------------------------------

  async function lookupAuthUserIdByEmail(
    email: string | null
  ): Promise<string | null> {
    if (!email) return null;
    try {
      const { data, error } = await sbAdmin
        .schema("auth")
        .from("users")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (!error && data && (data as any).id) return (data as any).id as string;
    } catch (e) {
      console.warn("auth.users lookup failed:", (e as any).message || e);
    }
    return null;
  }

  async function resolveUserId({
    maybeUserId,
    maybeCustomerId,
    maybeEmail,
  }: {
    maybeUserId?: string | null;
    maybeCustomerId?: string | null;
    maybeEmail?: string | null;
  }): Promise<string | null> {
    if (maybeUserId) return maybeUserId;

    if (maybeCustomerId) {
      const { data } = await sbAdmin
        .from("dartvoice_subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", maybeCustomerId)
        .limit(1)
        .maybeSingle();
      if (data && (data as any).user_id) return (data as any).user_id as string;
    }

    if (maybeEmail) {
      const { data } = await sbAdmin
        .from("dartvoice_subscriptions")
        .select("user_id")
        .ilike("email", maybeEmail)
        .limit(1)
        .maybeSingle();
      if (data && (data as any).user_id) return (data as any).user_id as string;
    }

    // Final fallback: look up auth.users directly by email. Handles the case
    // where the user signed up but no dartvoice_subscriptions row exists yet
    // (trigger 009 now creates a stub row, but this keeps us robust if the
    // trigger ever lags or was skipped for an older user).
    const authId = await lookupAuthUserIdByEmail(maybeEmail ?? null);
    if (authId) return authId;

    return null;
  }

  async function customerEmail(custId: string | null): Promise<string | null> {
    if (!custId) return null;
    try {
      const cust = await stripe.customers.retrieve(custId);
      return (cust as any).email || null;
    } catch {
      return null;
    }
  }

  async function upsertSubscription(row: Record<string, unknown>) {
    row.updated_at = new Date().toISOString();

    if (!row.user_id) {
      console.warn(
        "stripe-webhook: unresolved user_id — skipping upsert",
        JSON.stringify({
          stripe_customer_id: row.stripe_customer_id,
          stripe_sub_id: row.stripe_sub_id,
          email: row.email,
          status: row.status,
        })
      );
      return { skipped: true };
    }

    const { error } = await sbAdmin
      .from("dartvoice_subscriptions")
      .upsert(row, { onConflict: "user_id" });
    if (error) {
      console.error("upsert failed:", error.message, row);
      throw error;
    }
    return { skipped: false };
  }

  async function setSubscribedAtIfActive(
    userId: string,
    status: string | null,
    row: Record<string, unknown>
  ) {
    if (status !== "active" && status !== "trialing") return;
    const { data } = await sbAdmin
      .from("dartvoice_subscriptions")
      .select("subscribed_at")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!(data && (data as any).subscribed_at)) {
      row.subscribed_at = new Date().toISOString();
    }
  }

  // --- event handlers --------------------------------------------------------

  try {
    if (etype === "checkout.session.completed") {
      const session = obj;
      const clientRef = session.client_reference_id || null;
      const custId: string | null = session.customer || null;
      const subId: string | null = session.subscription || null;
      let email: string | null =
        (session.customer_details || {}).email ||
        session.customer_email ||
        null;

      if (!subId) {
        // one-off payment, not a subscription — ignore
        return ok({ received: true, ignored: "no_subscription_on_session" });
      }

      const sub = await stripe.subscriptions.retrieve(subId);
      const meta = (sub as any).metadata || {};
      const metaUserId = meta.supabase_user_id || null;
      const status: string | null = (sub as any).status || null;
      const periodEnd = toIso((sub as any).current_period_end || null);
      const trialStart = toIso((sub as any).trial_start || null);
      if (!email) email = await customerEmail(custId);

      const userId = await resolveUserId({
        maybeUserId: clientRef || metaUserId,
        maybeCustomerId: custId,
        maybeEmail: email,
      });

      const row: Record<string, unknown> = {
        user_id: userId,
        stripe_customer_id: custId,
        stripe_sub_id: subId,
        status,
        email,
      };
      if (periodEnd) row.current_period_end = periodEnd;
      if (trialStart) row.trial_start = trialStart;
      if (userId) await setSubscribedAtIfActive(userId, status, row);

      await upsertSubscription(row);
      return ok({ received: true, handled: "checkout.session.completed" });
    }

    if (
      etype === "customer.subscription.created" ||
      etype === "customer.subscription.updated"
    ) {
      const sub = obj;
      const custId: string | null = sub.customer || null;
      const subId: string | null = sub.id || null;
      const status: string | null = sub.status || null;
      const meta = sub.metadata || {};
      const metaUserId: string | null = meta.supabase_user_id || null;
      const email = await customerEmail(custId);

      const userId = await resolveUserId({
        maybeUserId: metaUserId,
        maybeCustomerId: custId,
        maybeEmail: email,
      });

      const row: Record<string, unknown> = {
        user_id: userId,
        stripe_customer_id: custId,
        stripe_sub_id: subId,
        status,
        email,
      };
      const periodEnd = toIso(sub.current_period_end || null);
      const trialStart = toIso(sub.trial_start || null);
      if (periodEnd) row.current_period_end = periodEnd;
      if (trialStart) row.trial_start = trialStart;
      if (userId) await setSubscribedAtIfActive(userId, status, row);

      await upsertSubscription(row);
      return ok({ received: true, handled: etype });
    }

    if (etype === "customer.subscription.deleted") {
      const sub = obj;
      const custId: string | null = sub.customer || null;
      const subId: string | null = sub.id || null;
      const email = await customerEmail(custId);
      const userId = await resolveUserId({
        maybeCustomerId: custId,
        maybeEmail: email,
      });
      const row: Record<string, unknown> = {
        user_id: userId,
        stripe_customer_id: custId,
        stripe_sub_id: subId,
        status: "canceled",
        email,
      };
      await upsertSubscription(row);
      return ok({ received: true, handled: etype });
    }

    if (etype === "invoice.payment_succeeded") {
      const invoice = obj;
      const custId: string | null = invoice.customer || null;
      const subId: string | null = invoice.subscription || null;
      if (!subId) return ok({ received: true, ignored: "invoice_no_sub" });

      const sub = await stripe.subscriptions.retrieve(subId);
      const status: string | null = (sub as any).status || null;
      const meta = (sub as any).metadata || {};
      const email = await customerEmail(custId);

      const userId = await resolveUserId({
        maybeUserId: meta.supabase_user_id || null,
        maybeCustomerId: custId,
        maybeEmail: email,
      });

      const row: Record<string, unknown> = {
        user_id: userId,
        stripe_customer_id: custId,
        stripe_sub_id: subId,
        status,
        email,
      };
      const periodEnd = toIso((sub as any).current_period_end || null);
      if (periodEnd) row.current_period_end = periodEnd;
      if (userId) await setSubscribedAtIfActive(userId, status, row);

      await upsertSubscription(row);
      return ok({ received: true, handled: etype });
    }

    if (etype === "invoice.payment_failed") {
      const invoice = obj;
      const custId: string | null = invoice.customer || null;
      const subId: string | null = invoice.subscription || null;
      const email = await customerEmail(custId);
      const userId = await resolveUserId({
        maybeCustomerId: custId,
        maybeEmail: email,
      });
      const row: Record<string, unknown> = {
        user_id: userId,
        stripe_customer_id: custId,
        stripe_sub_id: subId,
        status: "past_due",
        email,
      };
      await upsertSubscription(row);
      return ok({ received: true, handled: etype });
    }

    console.log("stripe-webhook: ignoring event type:", etype);
    return ok({ received: true, ignored: etype });
  } catch (err) {
    // We log but always return 200 so Stripe does not retry forever on
    // deterministic failures. Signature errors are the only 4xx case.
    console.error("stripe-webhook handler error:", (err as any).message || err);
    return ok({ received: true, warning: "handler_error", detail: String(err) });
  }
});
