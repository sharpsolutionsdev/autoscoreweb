-- ============================================================================
-- DartVoice Ambassador Program — Migration 002
-- ============================================================================
-- Creates:
--   dartvoice_profiles          — per-user referral code + payout email
--   dartvoice_referrals         — referral events (invited → signed_up → converted → rewarded)
--   dartvoice_ambassador_payouts — payout requests from ambassadors
--   dartvoice_ambassador_stats  — view aggregating per-user ambassador totals
--
-- Run via Supabase SQL Editor (Dashboard → SQL → New Query → paste & Run).
-- ============================================================================

-- ── 1. Profiles ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dartvoice_profiles (
    id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    referral_code  TEXT UNIQUE NOT NULL,
    paypal_email   TEXT,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.dartvoice_profiles_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dartvoice_profiles_updated_at
    BEFORE UPDATE ON public.dartvoice_profiles
    FOR EACH ROW EXECUTE FUNCTION public.dartvoice_profiles_set_updated_at();

-- Auto-create a profile row (with unique referral code) for every new user
CREATE OR REPLACE FUNCTION public.dartvoice_create_profile()
RETURNS TRIGGER AS $$
DECLARE
    code TEXT;
    attempts INT := 0;
BEGIN
    LOOP
        code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        BEGIN
            INSERT INTO public.dartvoice_profiles (id, referral_code)
            VALUES (NEW.id, code);
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            attempts := attempts + 1;
            IF attempts > 10 THEN RAISE EXCEPTION 'Could not generate unique referral code'; END IF;
        END;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER dartvoice_create_profile_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.dartvoice_create_profile();

-- Backfill: create profiles for existing users who don't have one yet
INSERT INTO public.dartvoice_profiles (id, referral_code)
SELECT
    u.id,
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.dartvoice_profiles p WHERE p.id = u.id
)
ON CONFLICT DO NOTHING;

-- ── 2. Referrals ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dartvoice_referrals (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referred_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    referred_email    TEXT,
    ref_code          TEXT,
    status            TEXT NOT NULL DEFAULT 'signed_up',
    -- statuses: signed_up → trial_active → converted → rewarded
    reward_amount     NUMERIC(10,2) DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT dartvoice_referrals_one_per_user UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_dartvoice_refs_referrer
    ON public.dartvoice_referrals (referrer_user_id);

CREATE INDEX IF NOT EXISTS idx_dartvoice_refs_code
    ON public.dartvoice_referrals (ref_code);

CREATE OR REPLACE FUNCTION public.dartvoice_referrals_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dartvoice_referrals_updated_at
    BEFORE UPDATE ON public.dartvoice_referrals
    FOR EACH ROW EXECUTE FUNCTION public.dartvoice_referrals_set_updated_at();

-- ── 3. Ambassador Payouts ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dartvoice_ambassador_payouts (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount        NUMERIC(10,2) NOT NULL,
    paypal_email  TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'requested',
    -- statuses: requested → processing → paid → rejected
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dartvoice_payouts_user
    ON public.dartvoice_ambassador_payouts (user_id);

CREATE OR REPLACE FUNCTION public.dartvoice_payouts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dartvoice_payouts_updated_at
    BEFORE UPDATE ON public.dartvoice_ambassador_payouts
    FOR EACH ROW EXECUTE FUNCTION public.dartvoice_payouts_set_updated_at();

-- ── 4. Ambassador Stats View ─────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.dartvoice_ambassador_stats AS
SELECT
    referrer_user_id,
    COUNT(*)                                                               AS total_referrals,
    COUNT(*) FILTER (WHERE status IN ('converted', 'rewarded'))           AS converted,
    COALESCE(SUM(reward_amount) FILTER (WHERE status = 'rewarded'), 0)    AS total_earnings
FROM public.dartvoice_referrals
GROUP BY referrer_user_id;

-- ── 5. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.dartvoice_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dartvoice_referrals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dartvoice_ambassador_payouts ENABLE ROW LEVEL SECURITY;

-- Profiles: any authenticated user can read (needed for referral code lookups),
--           only the owner can update/insert their own row.
CREATE POLICY dartvoice_profiles_select
    ON public.dartvoice_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY dartvoice_profiles_insert_own
    ON public.dartvoice_profiles FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY dartvoice_profiles_update_own
    ON public.dartvoice_profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- Referrals: referrers see their own rows; referred users may insert once.
CREATE POLICY dartvoice_referrals_select_as_referrer
    ON public.dartvoice_referrals FOR SELECT TO authenticated
    USING (referrer_user_id = auth.uid());

CREATE POLICY dartvoice_referrals_insert_as_referred
    ON public.dartvoice_referrals FOR INSERT TO authenticated
    WITH CHECK (referred_user_id = auth.uid());

-- Payouts: users manage their own rows.
CREATE POLICY dartvoice_payouts_select_own
    ON public.dartvoice_ambassador_payouts FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY dartvoice_payouts_insert_own
    ON public.dartvoice_ambassador_payouts FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- Done. Service role (billing server) bypasses RLS for all writes.
-- The billing server is responsible for:
--   - Updating dartvoice_referrals.status to 'converted'/'rewarded'
--   - Setting reward_amount when a referred user pays their first month
-- ============================================================================
