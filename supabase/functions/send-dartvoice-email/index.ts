/**
 * SUPABASE EDGE FUNCTION: send-dartvoice-email
 *
 * Sends branded DartVoice lifecycle emails via Resend.
 * Templates are fetched from the live site (dartvoice.app/emails/) so they
 * stay in sync with the repo without redeploying this function.
 *
 * POST body:
 *   { type, to, data? }
 *
 * Types:
 *   welcome              — New user signup
 *   subscription-active  — Trial → paid conversion
 *   payment-failed       — Card declined
 *   cancelled            — Subscription cancelled
 *   referral-invite      — Ambassador invites a friend
 *   referral-payout      — Ambassador earns commission
 *
 * Environment:
 *   RESEND_API_KEY       — Resend API key (dartvoice.app domain verified)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const TEMPLATE_BASE = "https://dartvoice.app/emails";

const TEMPLATE_MAP: Record<
  string,
  { file: string; subject: string; from: string }
> = {
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
  "referral-invite": {
    file: "email-referral-invite.html",
    subject: "{{referrer_name}} invited you to try DartVoice free",
    from: "DartVoice <invite@dartvoice.app>",
  },
  "referral-payout": {
    file: "email-referral-payout.html",
    subject: "You earned £5 — referral commission from DartVoice",
    from: "DartVoice <noreply@dartvoice.app>",
  },
  // Bulk-blast templates triggered from admin.html.
  "free-trial-blast": {
    file: "email-free-trial-blast.html",
    subject: "Try DartVoice free for 7 days — voice darts scoring",
    from: "DartVoice <hello@dartvoice.app>",
  },
  "one-hour-pass": {
    file: "email-one-hour-pass.html",
    subject: "Your 1-hour DartVoice pass — no signup needed",
    from: "DartVoice <hello@dartvoice.app>",
  },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function replacePlaceholders(
  html: string,
  data: Record<string, string>
): string {
  let result = html;
  for (const [key, value] of Object.entries(data)) {
    // Replace both {{key}} and {{ key }} variants
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(pattern, escapeHtml(value));
  }
  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const { type, to, data } = await req.json();

    // Validate inputs
    if (!type || !to) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, to" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    const tmpl = TEMPLATE_MAP[type];
    if (!tmpl) {
      return new Response(
        JSON.stringify({
          error: `Unknown email type: ${type}`,
          valid_types: Object.keys(TEMPLATE_MAP),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    // Fetch the HTML template from the live site
    const templateUrl = `${TEMPLATE_BASE}/${tmpl.file}`;
    const templateRes = await fetch(templateUrl);

    if (!templateRes.ok) {
      console.error(
        `Failed to fetch template ${templateUrl}: ${templateRes.status}`
      );
      return new Response(
        JSON.stringify({ error: "Failed to load email template" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    let html = await templateRes.text();

    // Replace placeholders with provided data
    const placeholders: Record<string, string> = data || {};
    html = replacePlaceholders(html, placeholders);

    // Also replace placeholders in the subject line
    let subject = tmpl.subject;
    for (const [key, value] of Object.entries(placeholders)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      subject = subject.replace(pattern, value);
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
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", res.status, err);
      return new Response(
        JSON.stringify({ error: "Failed to send email", detail: err }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    const result = await res.json();
    console.log(`Sent ${type} email to ${to}:`, result);

    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (e) {
    console.error("send-dartvoice-email error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
