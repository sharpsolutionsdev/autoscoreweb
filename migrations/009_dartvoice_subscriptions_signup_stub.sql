-- ============================================================================
-- 009 — Seed a stub dartvoice_subscriptions row on auth.users signup
-- ============================================================================
-- Fixes a race condition in the Stripe webhook: if customer.subscription.created
-- fires before checkout.session.completed, the webhook used to have no row to
-- anchor to and would fail. Now every new user has a stub row with status='none'
-- so email/customer-id fallbacks in stripe-webhook always resolve.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dartvoice_seed_subscription_stub()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.dartvoice_subscriptions (user_id, email, status)
  VALUES (NEW.id, NEW.email, 'none')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS dartvoice_seed_sub_on_signup ON auth.users;
CREATE TRIGGER dartvoice_seed_sub_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.dartvoice_seed_subscription_stub();

-- Backfill: seed rows for existing users that don't have one yet
INSERT INTO public.dartvoice_subscriptions (user_id, email, status)
SELECT u.id, u.email, 'none'
FROM auth.users u
LEFT JOIN public.dartvoice_subscriptions s ON s.user_id = u.id
WHERE s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
