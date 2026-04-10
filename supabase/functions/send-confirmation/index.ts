/**
 * SUPABASE EDGE FUNCTION: send-confirmation
 *
 * Triggered by database webhook on dartvoice_subscriptions INSERT/UPDATE.
 * Sends the appropriate lifecycle email based on the subscription status change.
 *
 * Delegates to send-dartvoice-email edge function for actual email delivery.
 *
 * Environment:
 *   SUPABASE_URL             — auto-set
 *   SUPABASE_SERVICE_ROLE_KEY — service role key
 *   RESEND_API_KEY           — Resend API key (used by send-dartvoice-email)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { record, old_record } = payload;

    if (!record) {
      return new Response(JSON.stringify({ skipped: "no record" }), {
        status: 200,
      });
    }

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Determine email from subscription row or auth user
    let email = record.email;
    if (!email && record.user_id) {
      try {
        const u = await supabase.auth.admin.getUserById(record.user_id);
        email = u.data?.user?.email;
      } catch (_) {}
    }

    if (!email) {
      console.log("No email found for user_id:", record.user_id);
      return new Response(JSON.stringify({ skipped: "no email" }), {
        status: 200,
      });
    }

    const newStatus = record.status;
    const oldStatus = old_record?.status;

    // Only send if status actually changed
    if (newStatus === oldStatus) {
      return new Response(JSON.stringify({ skipped: "status unchanged" }), {
        status: 200,
      });
    }

    let emailType: string | null = null;
    const emailData: Record<string, string> = { email };

    switch (newStatus) {
      case "trialing":
        // New trial — send welcome email
        if (!oldStatus || oldStatus === "none") {
          emailType = "welcome";
        }
        break;

      case "active":
        // Trial converted to paid, or resubscribed
        emailType = "subscription-active";
        if (record.current_period_end) {
          const d = new Date(record.current_period_end);
          emailData.next_billing_date = d.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
        }
        break;

      case "past_due":
        // Payment failed
        emailType = "payment-failed";
        emailData.card_last4 = "****";
        emailData.failed_date = new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        emailData.billing_portal_url = "https://dartvoice.app/dartvoice-dashboard.html";
        break;

      case "canceled":
        // Subscription cancelled
        emailType = "cancelled";
        if (record.current_period_end) {
          const d = new Date(record.current_period_end);
          emailData.access_end_date = d.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
        } else {
          emailData.access_end_date = "end of current period";
        }
        break;
    }

    if (!emailType) {
      console.log(`No email for status transition: ${oldStatus} → ${newStatus}`);
      return new Response(
        JSON.stringify({ skipped: `no email for ${newStatus}` }),
        { status: 200 }
      );
    }

    // Call the send-dartvoice-email function via Resend directly
    // (avoids circular edge function calls)
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set");
      return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), {
        status: 500,
      });
    }

    const TEMPLATE_BASE = "https://dartvoice.app/emails";
    const TEMPLATE_MAP: Record<string, { file: string; subject: string; from: string }> = {
      welcome: {
        file: "email-welcome.html",
        subject: "Welcome to DartVoice — your trial is active",
        from: "DartVoice <welcome@dartvoice.app>",
      },
      "subscription-active": {
        file: "email-subscription-active.html",
        subject: "Subscription confirmed — DartVoice Pro",
        from: "DartVoice <noreply@dartvoice.app>",
      },
      "payment-failed": {
        file: "email-payment-failed.html",
        subject: "Action needed — DartVoice payment failed",
        from: "DartVoice <noreply@dartvoice.app>",
      },
      cancelled: {
        file: "email-cancelled.html",
        subject: "Your DartVoice subscription has been cancelled",
        from: "DartVoice <noreply@dartvoice.app>",
      },
    };

    const tmpl = TEMPLATE_MAP[emailType];
    if (!tmpl) {
      return new Response(JSON.stringify({ skipped: "unknown type" }), {
        status: 200,
      });
    }

    // Fetch template
    const templateRes = await fetch(`${TEMPLATE_BASE}/${tmpl.file}`);
    if (!templateRes.ok) {
      console.error(`Template fetch failed: ${templateRes.status}`);
      return new Response(JSON.stringify({ error: "template fetch failed" }), {
        status: 502,
      });
    }

    let html = await templateRes.text();

    // Replace placeholders
    for (const [key, value] of Object.entries(emailData)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      html = html.replace(
        pattern,
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
      );
    }

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: tmpl.from,
        to: [email],
        subject: tmpl.subject,
        html,
      }),
    });

    const result = await res.json();
    console.log(`Sent ${emailType} to ${email}:`, result);

    // Update confirmation_sent_at in DB (use user_id as it's the most reliable key)
    const matchKey = record.user_id || record.id;
    const matchCol = record.user_id ? "user_id" : "id";
    if (matchKey) {
      const { error: updateErr } = await supabase
        .from("dartvoice_subscriptions")
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq(matchCol, matchKey);
      if (updateErr) console.error("Failed to update confirmation_sent_at:", updateErr);
    }

    return new Response(JSON.stringify({ ok: true, type: emailType, resend: result }), {
      status: 200,
    });
  } catch (err) {
    console.error("send-confirmation error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});
