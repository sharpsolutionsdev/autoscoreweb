-- 026_lock_account_overview.sql
-- Address Supabase advisor errors:
--   - auth_users_exposed: public.dartvoice_account_overview reveals auth.users columns to anon/authenticated
--   - security_definer_view: same view runs with creator privileges
--
-- The view is only consumed by admin tooling via service_role; it should never
-- have been reachable through PostgREST as anon/authenticated. Revoke those
-- grants and recreate the view with security_invoker so it honours the
-- caller's privileges/RLS instead of the creator's.

-- Recreate with security_invoker (Postgres 15+, supported on Supabase).
DROP VIEW IF EXISTS public.dartvoice_account_overview;
CREATE VIEW public.dartvoice_account_overview
WITH (security_invoker = true) AS
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

-- Strip every privilege from PostgREST-exposed roles.
REVOKE ALL ON public.dartvoice_account_overview FROM anon, authenticated, PUBLIC;

-- Keep admin tooling working.
GRANT SELECT ON public.dartvoice_account_overview TO service_role;

COMMENT ON VIEW public.dartvoice_account_overview IS
  'Admin overview joining auth.users with dartvoice_profiles + dartvoice_subscriptions. service_role only.';
