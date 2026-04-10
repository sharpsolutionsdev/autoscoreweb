-- Add timestamps for subscription activation and email confirmation
ALTER TABLE public.dartvoice_subscriptions
    ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;

-- Done.