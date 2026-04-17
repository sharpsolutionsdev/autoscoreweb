-- ==========================================================================
-- Migration 010: Add email and phone verification fields to dartvoice_profiles
-- ==========================================================================

BEGIN;

-- Add optional email and phone fields to ambassador profiles
ALTER TABLE IF EXISTS public.dartvoice_profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Backfill email from auth.users where available
UPDATE public.dartvoice_profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Helpful indexes for lookups
CREATE INDEX IF NOT EXISTS idx_dartvoice_profiles_email ON public.dartvoice_profiles (email);
CREATE INDEX IF NOT EXISTS idx_dartvoice_profiles_phone ON public.dartvoice_profiles (phone_number);

COMMIT;

-- Notes:
-- - This migration is non-destructive and adds nullable columns only.
-- - The existing triggers and RLS policies remain unchanged.
