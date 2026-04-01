-- ============================================================================
-- DartVoice Subscriptions — Isolated Migration
-- ============================================================================
-- IMPORTANT: This does NOT touch any existing Oche Vault tables, triggers,
30
-- Run via Supabase SQL Editor (Dashboard → SQL → New Query → paste & Run).
-- ============================================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.dartvoice_subscriptions (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    install_id          TEXT,
    stripe_customer_id  TEXT,
    stripe_sub_id       TEXT,
    status              TEXT NOT NULL DEFAULT 'none',
    email               TEXT,
    trial_start         TIMESTAMPTZ,
    current_period_end  TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT dartvoice_subs_user_unique UNIQUE (user_id)
);

-- 2. Useful indexes
CREATE INDEX IF NOT EXISTS idx_dartvoice_subs_stripe_cust
    ON public.dartvoice_subscriptions (stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_dartvoice_subs_install
    ON public.dartvoice_subscriptions (install_id);

CREATE INDEX IF NOT EXISTS idx_dartvoice_subs_status
    ON public.dartvoice_subscriptions (status);

-- 3. Enable Row Level Security
ALTER TABLE public.dartvoice_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
--    a) Authenticated users can read ONLY their own row (used by the desktop/Android app
--       which queries via the Supabase Anon Key).
CREATE POLICY dartvoice_subs_select_own
    ON public.dartvoice_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

--    b) The Service Role key bypasses RLS automatically (Supabase behaviour).
--       No extra policy needed — the billing server's service-role client already
--       has full read/write access regardless of RLS.

-- 5. Auto-set updated_at on every change
CREATE OR REPLACE FUNCTION public.dartvoice_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dartvoice_subs_updated_at
    BEFORE UPDATE ON public.dartvoice_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.dartvoice_set_updated_at();

-- ============================================================================
-- Done.  The billing server (service-role) writes rows; the client apps
-- (anon key) can only SELECT their own subscription via RLS.
-- ============================================================================
