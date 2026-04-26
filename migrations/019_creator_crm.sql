-- ============================================================================
-- DartVoice Creator CRM + Social Outreach — Migration 010
-- ============================================================================
-- Creates:
--   admin_users         — gating table for /admin access
--   creators            — YouTube + social content creators pipeline
--   outreach_log        — every email / DM / comment sent, per creator or prospect
--   social_prospects    — reddit / x / facebook / instagram / tiktok leads
--   outreach_queue      — scheduled posts / DMs (consumed by bot server)
--   outreach_templates  — reusable message templates per platform
--
-- Run in Supabase SQL Editor.
-- After running, insert yourself as admin:
--   insert into public.admin_users (user_id) values ('YOUR-UUID');
-- ============================================================================

-- ── 1. Admin users ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Helper: is the caller an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

-- ── 2. Creators ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.creators (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name                TEXT NOT NULL,
    channel             TEXT,
    platform            TEXT DEFAULT 'YouTube',
    subs                INTEGER DEFAULT 0,
    email               TEXT,
    tier                TEXT DEFAULT 'pro',
    amount              NUMERIC(10,2) DEFAULT 10,
    status              TEXT DEFAULT 'new',
    -- statuses: new | contacted | responded | negotiating | active | declined
    slug                TEXT,
    notes               TEXT,
    date_added          DATE DEFAULT (now()::date),
    date_contacted      DATE,
    youtube_channel_id  TEXT,
    thumbnail_url       TEXT,
    clicks              INTEGER DEFAULT 0,
    signups             INTEGER DEFAULT 0,
    earned              NUMERIC(10,2) DEFAULT 0,
    pending_payout      NUMERIC(10,2) DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creators_status   ON public.creators (status);
CREATE INDEX IF NOT EXISTS idx_creators_platform ON public.creators (platform);
CREATE INDEX IF NOT EXISTS idx_creators_slug     ON public.creators (slug);

CREATE OR REPLACE FUNCTION public.creators_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS creators_updated_at ON public.creators;
CREATE TRIGGER creators_updated_at
    BEFORE UPDATE ON public.creators
    FOR EACH ROW EXECUTE FUNCTION public.creators_set_updated_at();

-- ── 3. Social prospects (reddit / x / fb / ig / tiktok) ──────────────────────

CREATE TABLE IF NOT EXISTS public.social_prospects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform        TEXT NOT NULL,
    -- platforms: reddit | x | facebook | instagram | tiktok | other
    handle          TEXT NOT NULL,
    display_name    TEXT,
    profile_url     TEXT,
    avatar_url      TEXT,
    followers       INTEGER DEFAULT 0,
    context         TEXT,
    -- e.g. the subreddit, hashtag, group or post where we found them
    post_url        TEXT,
    bio             TEXT,
    status          TEXT DEFAULT 'new',
    -- statuses: new | queued | contacted | responded | converted | blocked | skip
    tags            TEXT[],
    last_contacted  TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (platform, handle)
);

CREATE INDEX IF NOT EXISTS idx_prospects_platform ON public.social_prospects (platform);
CREATE INDEX IF NOT EXISTS idx_prospects_status   ON public.social_prospects (status);

DROP TRIGGER IF EXISTS social_prospects_updated_at ON public.social_prospects;
CREATE TRIGGER social_prospects_updated_at
    BEFORE UPDATE ON public.social_prospects
    FOR EACH ROW EXECUTE FUNCTION public.creators_set_updated_at();

-- ── 4. Outreach log (every touch) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outreach_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id   UUID REFERENCES public.creators(id) ON DELETE SET NULL,
    prospect_id  UUID REFERENCES public.social_prospects(id) ON DELETE SET NULL,
    sent_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    channel      TEXT,
    -- channel: email | reddit_dm | reddit_comment | x_dm | x_reply
    --          facebook_msg | instagram_dm | tiktok_comment | manual
    subject      TEXT,
    body         TEXT,
    external_id  TEXT,        -- id returned by the platform API (dm id, comment id)
    external_url TEXT,
    status       TEXT DEFAULT 'sent',
    -- statuses: queued | sent | failed | delivered | replied
    error        TEXT,
    sent_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_creator  ON public.outreach_log (creator_id);
CREATE INDEX IF NOT EXISTS idx_log_prospect ON public.outreach_log (prospect_id);
CREATE INDEX IF NOT EXISTS idx_log_sent_at  ON public.outreach_log (sent_at DESC);

-- ── 5. Outreach queue (bot worker consumes this) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.outreach_queue (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id   UUID REFERENCES public.social_prospects(id) ON DELETE CASCADE,
    creator_id    UUID REFERENCES public.creators(id) ON DELETE CASCADE,
    channel       TEXT NOT NULL,
    subject       TEXT,
    body          TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ DEFAULT now(),
    status        TEXT DEFAULT 'pending',
    -- statuses: pending | running | done | failed | cancelled
    attempts      INTEGER DEFAULT 0,
    last_error    TEXT,
    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_status    ON public.outreach_queue (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON public.outreach_queue (scheduled_for);

DROP TRIGGER IF EXISTS outreach_queue_updated_at ON public.outreach_queue;
CREATE TRIGGER outreach_queue_updated_at
    BEFORE UPDATE ON public.outreach_queue
    FOR EACH ROW EXECUTE FUNCTION public.creators_set_updated_at();

-- ── 6. Outreach templates ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outreach_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    channel     TEXT NOT NULL,
    subject     TEXT,
    body        TEXT NOT NULL,
    -- supports tokens: {name} {handle} {slug} {amount} {tier} {sender}
    is_default  BOOLEAN DEFAULT FALSE,
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS outreach_templates_updated_at ON public.outreach_templates;
CREATE TRIGGER outreach_templates_updated_at
    BEFORE UPDATE ON public.outreach_templates
    FOR EACH ROW EXECUTE FUNCTION public.creators_set_updated_at();

-- Seed a couple of defaults (idempotent)
INSERT INTO public.outreach_templates (name, channel, subject, body, is_default)
VALUES
('Reddit cold DM', 'reddit_dm', 'Saw your darts content',
'Hey {handle}, loved your recent post in r/{context}. We''re building DartVoice — voice-scored darts that''s 10× cheaper than Omni. Fancy a free Pro account + affiliate link? £{amount} per referral. Personal page: dartvoice.app/{slug}',
TRUE),
('X short pitch', 'x_dm', NULL,
'Hey {handle} — DartVoice: voice-scored darts, no camera. Free Pro for you + £{amount}/referral. dartvoice.app/{slug}',
TRUE),
('YouTube creator email', 'email', 'DartVoice x {name} — ambassador offer',
'Hi {name}, I run creator partnerships at DartVoice. We voice-score darts practice (no camera, no Omni £500). Would love to gift you Pro + set up an affiliate deal (£{amount}/referral). Personal page: dartvoice.app/{slug}',
TRUE)
ON CONFLICT DO NOTHING;

-- ── 7. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.admin_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_prospects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_queue      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_templates  ENABLE ROW LEVEL SECURITY;

-- admin_users: any authenticated user can check their own row (so the UI can gate)
DROP POLICY IF EXISTS admin_users_select_self ON public.admin_users;
CREATE POLICY admin_users_select_self
    ON public.admin_users FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Creators: admins full access; creators can read their own row (for /creator-portal)
DROP POLICY IF EXISTS creators_admin_all ON public.creators;
CREATE POLICY creators_admin_all
    ON public.creators FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS creators_own_select ON public.creators;
CREATE POLICY creators_own_select
    ON public.creators FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Social prospects, outreach log, queue, templates: admin-only
DROP POLICY IF EXISTS prospects_admin_all ON public.social_prospects;
CREATE POLICY prospects_admin_all
    ON public.social_prospects FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS log_admin_all ON public.outreach_log;
CREATE POLICY log_admin_all
    ON public.outreach_log FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS queue_admin_all ON public.outreach_queue;
CREATE POLICY queue_admin_all
    ON public.outreach_queue FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS templates_admin_all ON public.outreach_templates;
CREATE POLICY templates_admin_all
    ON public.outreach_templates FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Service role bypasses RLS — the bot server uses service_role key.
-- ============================================================================
