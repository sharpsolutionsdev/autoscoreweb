-- Phase 4: Profile completion fields + Ambassador Partner flag
-- Run against Supabase SQL Editor

-- 1. Add profile-completion fields (all optional)
ALTER TABLE public.dartvoice_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS ambassador_partner BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Index for admin lookups on ambassador_partner
CREATE INDEX IF NOT EXISTS idx_profiles_ambassador_partner
  ON public.dartvoice_profiles (ambassador_partner)
  WHERE ambassador_partner = TRUE;

-- 3. RLS: users can read/update their own extended profile fields
--    (Existing RLS on dartvoice_profiles already covers this via id = auth.uid())
