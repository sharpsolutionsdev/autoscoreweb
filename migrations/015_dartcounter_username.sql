-- 015_dartcounter_username.sql
-- Adds the user's DartCounter platform username to dartvoice_profiles so the
-- ranked-match flow can show the DC handle (with DC logo) on the lobby /
-- match-found cinematic, and so the auto-add-friend helper in the Chrome
-- extension can submit it to DartCounter on the user's behalf.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.dartvoice_profiles
    ADD COLUMN IF NOT EXISTS dartcounter_username text;

COMMENT ON COLUMN public.dartvoice_profiles.dartcounter_username IS
    'The user''s DartCounter (app.dartcounter.net) handle. Used for ranked-match opponent display and auto-add-friend automation.';

-- Lower-case unique-ish lookup helper. We do NOT enforce uniqueness because
-- multiple DartVoice accounts could legitimately point at the same DC handle
-- (shared family device, testing accounts) — but the index speeds up the
-- "find user by DC name" lookup the in-match detector uses.
CREATE INDEX IF NOT EXISTS idx_dartvoice_profiles_dc_username_lower
    ON public.dartvoice_profiles ((lower(dartcounter_username)))
    WHERE dartcounter_username IS NOT NULL;
