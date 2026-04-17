-- ==========================================================================
-- Migration 011: Add dartvoice_profile_verifications table
-- ==========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.dartvoice_profile_verifications (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone           TEXT NOT NULL,
    code            TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    verified        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpv_user ON public.dartvoice_profile_verifications (user_id);
CREATE INDEX IF NOT EXISTS idx_dpv_phone ON public.dartvoice_profile_verifications (phone);

COMMIT;

-- Notes:
-- - Non-destructive migration. Creates a small verification table to store one-time codes.
-- - Applying this requires running in your staging/prod DB (service role) via Supabase SQL editor or CLI.
