-- ============================================================================
-- 018 — Player nationality / country code
-- ============================================================================
-- Adds an ISO 3166-1 alpha-2 country code (e.g. 'GB', 'US', 'NL') to
-- dartvoice_profiles. Used to display a flag next to players in the leaderboard
-- and on public profiles.
-- ============================================================================

ALTER TABLE public.dartvoice_profiles
  ADD COLUMN IF NOT EXISTS country_code CHAR(2);

-- Light validation: store uppercase, A-Z only.
ALTER TABLE public.dartvoice_profiles
  DROP CONSTRAINT IF EXISTS dartvoice_profiles_country_code_check;
ALTER TABLE public.dartvoice_profiles
  ADD CONSTRAINT dartvoice_profiles_country_code_check
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

CREATE INDEX IF NOT EXISTS idx_dartvoice_profiles_country_code
  ON public.dartvoice_profiles (country_code);

-- Refresh the overview view to include the new column.
DROP VIEW IF EXISTS public.dartvoice_account_overview;
CREATE OR REPLACE VIEW public.dartvoice_account_overview AS
SELECT
  u.id                          AS user_id,
  u.email                       AS auth_email,
  p.email                       AS profile_email,
  p.display_name,
  p.dv_username,
  p.dartcounter_username,
  p.country_code,
  p.phone_number,
  p.phone_verified,
  p.referral_code,
  p.ambassador_partner,
  s.status                      AS subscription_status,
  s.email                       AS subscription_email,
  EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id) AS is_admin,
  u.created_at                  AS signed_up_at
FROM auth.users u
LEFT JOIN public.dartvoice_profiles      p ON p.id = u.id
LEFT JOIN public.dartvoice_subscriptions s ON s.user_id = u.id;
