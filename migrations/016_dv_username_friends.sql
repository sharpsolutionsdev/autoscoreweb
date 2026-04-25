-- 016_dv_username_friends.sql
-- Adds public DartVoice handle (`dv_username`) for cross-user discovery, and
-- a `dv_friends` table for the platform's friend-request system.
-- Idempotent: safe to re-run.

-- ── 1. dv_username on dartvoice_profiles ─────────────────────────────────────
ALTER TABLE public.dartvoice_profiles
    ADD COLUMN IF NOT EXISTS dv_username text;

COMMENT ON COLUMN public.dartvoice_profiles.dv_username IS
    'Public DartVoice handle. Lowercase-unique. Used for friend search, leaderboard, and ranked match display.';

-- Case-insensitive uniqueness — only when set.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dartvoice_profiles_dv_username_lower
    ON public.dartvoice_profiles ((lower(dv_username)))
    WHERE dv_username IS NOT NULL;

-- ── 2. dv_friends ────────────────────────────────────────────────────────────
-- requester_id ─▶ recipient_id, status: pending | accepted | declined | blocked
CREATE TABLE IF NOT EXISTS public.dv_friends (
    id           bigserial PRIMARY KEY,
    requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status       text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','declined','blocked')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT dv_friends_no_self CHECK (requester_id <> recipient_id),
    CONSTRAINT dv_friends_uniq UNIQUE (requester_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_dv_friends_requester ON public.dv_friends (requester_id);
CREATE INDEX IF NOT EXISTS idx_dv_friends_recipient ON public.dv_friends (recipient_id);
CREATE INDEX IF NOT EXISTS idx_dv_friends_status    ON public.dv_friends (status);

CREATE OR REPLACE FUNCTION public.dv_friends_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dv_friends_updated_at ON public.dv_friends;
CREATE TRIGGER dv_friends_updated_at
    BEFORE UPDATE ON public.dv_friends
    FOR EACH ROW EXECUTE FUNCTION public.dv_friends_set_updated_at();

ALTER TABLE public.dv_friends ENABLE ROW LEVEL SECURITY;

-- Either party can read the row.
DROP POLICY IF EXISTS dv_friends_select ON public.dv_friends;
CREATE POLICY dv_friends_select ON public.dv_friends
    FOR SELECT TO authenticated
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Anyone authenticated can request a friend (must be the requester).
DROP POLICY IF EXISTS dv_friends_insert ON public.dv_friends;
CREATE POLICY dv_friends_insert ON public.dv_friends
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = requester_id);

-- Recipient can accept/decline; requester can cancel (delete).
DROP POLICY IF EXISTS dv_friends_update ON public.dv_friends;
CREATE POLICY dv_friends_update ON public.dv_friends
    FOR UPDATE TO authenticated
    USING (auth.uid() = recipient_id OR auth.uid() = requester_id);

DROP POLICY IF EXISTS dv_friends_delete ON public.dv_friends;
CREATE POLICY dv_friends_delete ON public.dv_friends
    FOR DELETE TO authenticated
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
