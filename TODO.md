# DartVoice Stripe Webhook Fix - TODO

## [ ] 1. Edit stripe-webhook handler
   - File: supabase/functions/stripe-webhook/index.ts
   - Change: req.text() → new Uint8Array(await req.arrayBuffer())
   - Expected: Supabase auto-deploys Edge Function.

## [ ] 2. Test webhook manually
   - Resend recent checkout event from Stripe Dashboard.
   - Check Supabase Edge Function logs: expect "signature verified", no "failed".
   - Verify: dartvoice_subscriptions table updates with status "trialing"/"active".

## [ ] 3. Test sync fallback
   - Call POST /functions/v1/sync-stripe-subscription (with auth).
   - Expect: {synced: true, subscription: {... status: "trialing"/"active"}}

## [ ] 4. Test frontend
   - Refresh dashboard/paywall page.
   - Expect: Popup auto-closes, shows "Pro"/"Trialing", "Subscription active".

## [ ] 5. Monitor Stripe retries
   - Check Stripe Dashboard → Webhooks → no more failed deliveries.

**Next manual step**: After edit/save, go to Supabase Dashboard → Edge Functions → Logs to verify deploy/success.
