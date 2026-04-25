-- ============================================================================
-- 017 — Account creation consistency
-- ============================================================================
-- Goals:
--   • Every auth.users row must have a matching dartvoice_profiles row AND a
--     dartvoice_subscriptions row.
--   • Profile gets email + display_name (best-effort) seeded automatically.
--   • Backfill any existing users that are missing rows in either table.
--   • Keep dartvoice_profiles.email in sync with auth.users.email going forward.
-- ============================================================================

-- 1. Make sure email column exists on profiles (some envs have it, some don't).
ALTER TABLE public.dartvoice_profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_dartvoice_profiles_email
  ON public.dartvoice_profiles ((lower(email)));

-- 2. Replace dartvoice_create_profile so it ALSO populates email + display_name
--    (display_name = local-part of email as a safe default; user can edit later).
CREATE OR REPLACE FUNCTION public.dartvoice_create_profile()
RETURNS TRIGGER AS $$
DECLARE
  code      TEXT;
  attempts  INT := 0;
  guess_dn  TEXT;
BEGIN
  guess_dn := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(split_part(NEW.email, '@', 1), '')
  );

  LOOP
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    BEGIN
      INSERT INTO public.dartvoice_profiles (id, referral_code, email, display_name)
      VALUES (NEW.id, code, NEW.email, guess_dn)
      ON CONFLICT (id) DO UPDATE
        SET email        = COALESCE(public.dartvoice_profiles.email, EXCLUDED.email),
            display_name = COALESCE(public.dartvoice_profiles.display_name, EXCLUDED.display_name);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempts := attempts + 1;
      IF attempts > 10 THEN RAISE EXCEPTION 'Could not generate unique referral code'; END IF;
    END;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Keep email in sync if the auth user changes their email.
CREATE OR REPLACE FUNCTION public.dartvoice_sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.dartvoice_profiles
       SET email = NEW.email
     WHERE id = NEW.id;
    UPDATE public.dartvoice_subscriptions
       SET email = NEW.email
     WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS dartvoice_sync_profile_email ON auth.users;
CREATE TRIGGER dartvoice_sync_profile_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.dartvoice_sync_profile_email();

-- 4. Backfill missing dartvoice_profiles rows for any existing auth.users.
--    Generates a unique referral_code per row using gen_random_uuid.
INSERT INTO public.dartvoice_profiles (id, referral_code, email, display_name)
SELECT
  u.id,
  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'display_name',''), split_part(u.email,'@',1))
FROM auth.users u
LEFT JOIN public.dartvoice_profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. Backfill email/display_name on existing profiles where missing.
UPDATE public.dartvoice_profiles p
   SET email = u.email
  FROM auth.users u
 WHERE p.id = u.id
   AND (p.email IS NULL OR p.email = '');

UPDATE public.dartvoice_profiles p
   SET display_name = split_part(u.email, '@', 1)
  FROM auth.users u
 WHERE p.id = u.id
   AND (p.display_name IS NULL OR p.display_name = '');

-- 6. Backfill any missing dartvoice_subscriptions stub rows (covered by
--    009 as well, but harmless to re-run).
INSERT INTO public.dartvoice_subscriptions (user_id, email, status)
SELECT u.id, u.email, 'none'
FROM auth.users u
LEFT JOIN public.dartvoice_subscriptions s ON s.user_id = u.id
WHERE s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 7. Quick verification view (admin-only via RLS on the underlying tables).
--    Useful from the SQL editor when debugging account state.
CREATE OR REPLACE VIEW public.dartvoice_account_overview AS
SELECT
  u.id                          AS user_id,
  u.email                       AS auth_email,
  p.email                       AS profile_email,
  p.display_name,
  p.dv_username,
  p.dartcounter_username,
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
