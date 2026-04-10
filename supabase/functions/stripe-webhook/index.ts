/**
 * SUPABASE EDGE FUNCTION: stripe-webhook
 *
 * Verify Stripe webhook signatures and update `dartvoice_subscriptions` when
 * subscriptions are created/updated/converted to active. This function is
 * intended to be the Stripe webhook endpoint you register in the Stripe
 * Dashboard (or with the Stripe CLI).
 *
 * Environment variables required for deploy:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Behavior:
 *  - Verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`.
 *  - Handles `checkout.session.completed`, `customer.subscription.*`,
 *    and `invoice.payment_succeeded` events.
 *  - Attempts to resolve a Supabase `user_id` from metadata, client_reference_id,
 *    or existing rows (matching `stripe_customer_id` or email).
 *  - Upserts the subscription row and sets `subscribed_at` when appropriate.
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

function toIso(ts?: number | null) {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") || req.headers.get("Stripe-Signature") || "";

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing required environment variables for stripe-webhook");
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe signature verification failed:", err.message || err);
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const etype: string = event.type;
    const obj: any = (event.data || {}).object || {};

    console.log("stripe-webhook event:", etype, obj.id ?? "(no id)");

    // Helper: attempt to resolve user_id from various sources
    async function resolveUserId({ maybeUserId, maybeCustomerId, maybeEmail }: { maybeUserId?: string | null; maybeCustomerId?: string | null; maybeEmail?: string | null; }) {
      if (maybeUserId) return maybeUserId;
      if (maybeCustomerId) {
        const { data, error } = await sbAdmin
          .from("dartvoice_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", maybeCustomerId)
          .limit(1)
          .maybeSingle();
        if (!error && data && (data as any).user_id) return (data as any).user_id;
      }
      if (maybeEmail) {
        const { data, error } = await sbAdmin
          .from("dartvoice_subscriptions")
          .select("user_id")
          .eq("email", maybeEmail)
          .limit(1)
          .maybeSingle();
        if (!error && data && (data as any).user_id) return (data as any).user_id;
      }
      return null;
    }

    // Helper: upsert a subscription row. If user_id present, onConflict uses user_id,
    // otherwise attempt to use stripe_customer_id as the conflict key.
    async function upsertRow(row: Record<string, unknown>) {
      row.updated_at = new Date().toISOString();
      if (row.user_id) {
        const { error } = await sbAdmin.from("dartvoice_subscriptions").upsert(row, { onConflict: "user_id" });
        if (error) throw error;
        return;
      }
      if (row.stripe_customer_id) {
        const { error } = await sbAdmin.from("dartvoice_subscriptions").upsert(row, { onConflict: "stripe_customer_id" });
        if (error) throw error;
        return;
      }
      // If we have neither, insert a new row (no onConflict)
      const { error } = await sbAdmin.from("dartvoice_subscriptions").insert(row);
      if (error) throw error;
    }

    // Main handlers
    if (etype === "checkout.session.completed") {
      const session = obj;
      const clientRef = session.client_reference_id || null;
      const custId = session.customer || null;
      const subId = session.subscription || null;
      let userId = clientRef || null;
      let email = (session.customer_details || {}).email || null;

      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId as string);
        const meta = (sub as any).metadata || {};
        userId = userId || meta.supabase_user_id || null;
        const status = (sub as any).status || null;
        const periodEnd = toIso((sub as any).current_period_end || null);

        if (!email) {
          try {
            const cust = await stripe.customers.retrieve(custId as string);
            email = (cust as any).email || email;
          } catch (_e) {
            // ignore
          }
        }

        const row: Record<string, unknown> = {
          user_id: userId,
          stripe_customer_id: custId || null,
          stripe_sub_id: subId || null,
          status: status || null,
          email: email || null,
        };
        if (periodEnd) row.current_period_end = periodEnd;

        // Mark subscribed_at when status is active and we don't already have it
        if (status === "active") {
          // read existing row to check subscribed_at
          if (userId) {
            const { data } = await sbAdmin.from("dartvoice_subscriptions").select("subscribed_at").eq("user_id", userId).limit(1).maybeSingle();
            if (!(data && (data as any).subscribed_at)) {
              row.subscribed_at = new Date().toISOString();
            }
          } else {
            // no user id — set subscribed_at anyway so row has the timestamp
            row.subscribed_at = new Date().toISOString();
          }
        }

        await upsertRow(row);
      }
    } else if (etype === "customer.subscription.created" || etype === "customer.subscription.updated") {
      const sub = obj;
      const custId = sub.customer || null;
      const subId = sub.id || null;
      const status = sub.status || null;
      const meta = sub.metadata || {};
      const maybeUserId = meta.supabase_user_id || null;
      let email: string | null = null;

      if (!maybeUserId) {
        // try to resolve by customer id
        // we'll attempt to look up an existing subscription row
      }

      try {
        // attempt to get customer email for record
        if (custId) {
          try {
            const cust = await stripe.customers.retrieve(custId as string);
            email = (cust as any).email || null;
          } catch (_e) {
            email = null;
          }
        }

        const userId = await resolveUserId({ maybeUserId, maybeCustomerId: custId, maybeEmail: email });

        const periodEnd = toIso(sub.current_period_end || null);

        const row: Record<string, unknown> = {
          user_id: userId,
          stripe_customer_id: custId || null,
          stripe_sub_id: subId || null,
          status: status || null,
          email: email || null,
        };
        if (periodEnd) row.current_period_end = periodEnd;

        if (status === "active") {
          if (userId) {
            const { data } = await sbAdmin.from("dartvoice_subscriptions").select("subscribed_at").eq("user_id", userId).limit(1).maybeSingle();
            if (!(data && (data as any).subscribed_at)) {
              row.subscribed_at = new Date().toISOString();
            }
          } else {
            row.subscribed_at = new Date().toISOString();
          }
        }

        await upsertRow(row);
      } catch (err) {
        console.error("failed handling subscription event", err);
        throw err;
      }
    } else if (etype === "invoice.payment_succeeded") {
      const invoice = obj;
      const custId = invoice.customer || null;
      const subId = invoice.subscription || null;

      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId as string);
          const status = (sub as any).status || null;
          const meta = (sub as any).metadata || {};
          let email: string | null = null;
          if (custId) {
            try {
              const cust = await stripe.customers.retrieve(custId as string);
              email = (cust as any).email || null;
            } catch (_e) {
              // ignore
            }
          }

          const userId = await resolveUserId({ maybeUserId: meta.supabase_user_id || null, maybeCustomerId: custId, maybeEmail: email });

          const periodEnd = toIso((sub as any).current_period_end || null);

          const row: Record<string, unknown> = {
            user_id: userId,
            stripe_customer_id: custId || null,
            stripe_sub_id: subId || null,
            status: status || null,
            email: email || null,
          };
          if (periodEnd) row.current_period_end = periodEnd;

          if (status === "active") {
            if (userId) {
              const { data } = await sbAdmin.from("dartvoice_subscriptions").select("subscribed_at").eq("user_id", userId).limit(1).maybeSingle();
              if (!(data && (data as any).subscribed_at)) {
                row.subscribed_at = new Date().toISOString();
              }
            } else {
              row.subscribed_at = new Date().toISOString();
            }
          }

          await upsertRow(row);
        } catch (err) {
          console.error("invoice handler failed", err);
        }
      }
    } else if (etype === "customer.subscription.deleted") {
      const sub = obj;
      const custId = sub.customer || null;
      const subId = sub.id || null;
      let email: string | null = null;
      if (custId) {
        try {
          const cust = await stripe.customers.retrieve(custId as string);
          email = (cust as any).email || null;
        } catch (_) {}
      }
      const userId = await resolveUserId({ maybeCustomerId: custId, maybeEmail: email });
      const row: Record<string, unknown> = {
        user_id: userId,
        stripe_customer_id: custId || null,
        stripe_sub_id: subId || null,
        status: "canceled",
        email: email || null,
      };
      await upsertRow(row);
    } else if (etype === "invoice.payment_failed") {
      const invoice = obj;
      const custId = invoice.customer || null;
      let email: string | null = null;
      if (custId) {
        try {
          const cust = await stripe.customers.retrieve(custId as string);
          email = (cust as any).email || null;
        } catch (_) {}
      }
      const userId = await resolveUserId({ maybeCustomerId: custId, maybeEmail: email });
      if (userId) {
        const row: Record<string, unknown> = {
          user_id: userId,
          stripe_customer_id: custId || null,
          status: "past_due",
          email: email || null,
        };
        await upsertRow(row);
      }
    } else {
      // Non-handled event types are accepted but not acted on
      console.log("Ignoring event type:", etype);
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json", ...CORS } });
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return new Response(JSON.stringify({ error: "internal_error", detail: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
