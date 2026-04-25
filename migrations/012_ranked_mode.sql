-- ============================================================
-- 012_ranked_mode.sql
-- DartVoice Ranked Mode — tables, indexes, RLS, helpers
-- ============================================================

-- ── 1. Seasons ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranked_seasons (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    starts_at   timestamptz NOT NULL,
    ends_at     timestamptz NOT NULL,
    is_active   boolean NOT NULL DEFAULT false,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.ranked_seasons ENABLE ROW LEVEL SECURITY;

-- Everyone can read seasons
CREATE POLICY "ranked_seasons_select" ON public.ranked_seasons
    FOR SELECT TO authenticated USING (true);

-- Insert the inaugural season
INSERT INTO public.ranked_seasons (name, starts_at, ends_at, is_active)
VALUES (
    'Season 1: The Beginning',
    now(),
    now() + interval '3 months',
    true
);

-- ── 2. Ranked Profiles ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranked_profiles (
    id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    mmr                 integer NOT NULL DEFAULT 1200,
    peak_mmr            integer NOT NULL DEFAULT 1200,
    rank_tier           text NOT NULL DEFAULT 'silver',
    placement_matches   integer NOT NULL DEFAULT 0,
    is_placed           boolean NOT NULL DEFAULT false,
    wins                integer NOT NULL DEFAULT 0,
    losses              integer NOT NULL DEFAULT 0,
    win_streak          integer NOT NULL DEFAULT 0,
    best_win_streak     integer NOT NULL DEFAULT 0,
    total_180s          integer NOT NULL DEFAULT 0,
    total_140_plus      integer NOT NULL DEFAULT 0,
    total_tons          integer NOT NULL DEFAULT 0,
    total_high_finishes integer NOT NULL DEFAULT 0,
    best_finish         integer NOT NULL DEFAULT 0,
    avg_match_average   numeric(6,2) NOT NULL DEFAULT 0,
    avg_checkout_pct    numeric(5,2) NOT NULL DEFAULT 0,
    total_legs_won      integer NOT NULL DEFAULT 0,
    total_legs_lost     integer NOT NULL DEFAULT 0,
    season_id           uuid REFERENCES public.ranked_seasons(id),
    display_name        text,
    avatar_url          text,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

ALTER TABLE public.ranked_profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read ranked profiles (leaderboard)
CREATE POLICY "ranked_profiles_select" ON public.ranked_profiles
    FOR SELECT TO authenticated USING (true);

-- Users can update their own profile (display_name, avatar_url only — MMR via edge fn)
CREATE POLICY "ranked_profiles_update_own" ON public.ranked_profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Users can insert their own profile (on first queue join)
CREATE POLICY "ranked_profiles_insert_own" ON public.ranked_profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_ranked_profiles_mmr
    ON public.ranked_profiles (mmr DESC);

CREATE INDEX IF NOT EXISTS idx_ranked_profiles_season
    ON public.ranked_profiles (season_id);

-- ── 3. Ranked Matches ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranked_matches (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id           uuid REFERENCES public.ranked_seasons(id),
    player1_id          uuid NOT NULL REFERENCES auth.users(id),
    player2_id          uuid NOT NULL REFERENCES auth.users(id),
    winner_id           uuid REFERENCES auth.users(id),
    player1_mmr_before  integer NOT NULL DEFAULT 0,
    player2_mmr_before  integer NOT NULL DEFAULT 0,
    player1_mmr_after   integer,
    player2_mmr_after   integer,
    player1_mmr_delta   integer,
    player2_mmr_delta   integer,
    player1_legs_won    integer NOT NULL DEFAULT 0,
    player2_legs_won    integer NOT NULL DEFAULT 0,
    player1_average     numeric(6,2) DEFAULT 0,
    player2_average     numeric(6,2) DEFAULT 0,
    player1_checkout_pct numeric(5,2) DEFAULT 0,
    player2_checkout_pct numeric(5,2) DEFAULT 0,
    player1_180s        integer DEFAULT 0,
    player2_180s        integer DEFAULT 0,
    player1_140_plus    integer DEFAULT 0,
    player2_140_plus    integer DEFAULT 0,
    player1_high_finish integer DEFAULT 0,
    player2_high_finish integer DEFAULT 0,
    match_format        text NOT NULL DEFAULT 'best_of_5',
    status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','lobby','in_progress','awaiting_confirmation','completed','disputed','cancelled')),
    -- Result confirmation: each player submits their view
    player1_result_submitted boolean DEFAULT false,
    player2_result_submitted boolean DEFAULT false,
    player1_claimed_p1_legs  integer,
    player1_claimed_p2_legs  integer,
    player2_claimed_p1_legs  integer,
    player2_claimed_p2_legs  integer,
    lobby_code          text,
    started_at          timestamptz,
    completed_at        timestamptz,
    created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.ranked_matches ENABLE ROW LEVEL SECURITY;

-- Players can read matches they are part of
CREATE POLICY "ranked_matches_select_own" ON public.ranked_matches
    FOR SELECT TO authenticated
    USING (player1_id = auth.uid() OR player2_id = auth.uid());

-- Allow reading completed matches for leaderboard / profile views
CREATE POLICY "ranked_matches_select_completed" ON public.ranked_matches
    FOR SELECT TO authenticated
    USING (status = 'completed');

-- Players can update their own result submission fields
CREATE POLICY "ranked_matches_update_result" ON public.ranked_matches
    FOR UPDATE TO authenticated
    USING (player1_id = auth.uid() OR player2_id = auth.uid())
    WITH CHECK (player1_id = auth.uid() OR player2_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ranked_matches_player1
    ON public.ranked_matches (player1_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ranked_matches_player2
    ON public.ranked_matches (player2_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ranked_matches_status
    ON public.ranked_matches (status);

CREATE INDEX IF NOT EXISTS idx_ranked_matches_season
    ON public.ranked_matches (season_id, status);

-- ── 4. Ranked Queue ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranked_queue (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    mmr             integer NOT NULL DEFAULT 1200,
    rank_tier       text NOT NULL DEFAULT 'silver',
    display_name    text,
    match_format    text NOT NULL DEFAULT 'best_of_5',
    status          text NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting','matched','expired')),
    matched_with    uuid REFERENCES auth.users(id),
    match_id        uuid REFERENCES public.ranked_matches(id),
    joined_at       timestamptz DEFAULT now(),
    expires_at      timestamptz DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.ranked_queue ENABLE ROW LEVEL SECURITY;

-- Users can see their own queue entry
CREATE POLICY "ranked_queue_select_own" ON public.ranked_queue
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Users can insert themselves into queue
CREATE POLICY "ranked_queue_insert_own" ON public.ranked_queue
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can delete (leave) their own queue entry
CREATE POLICY "ranked_queue_delete_own" ON public.ranked_queue
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Users can update their own entry (for matched status via realtime)
CREATE POLICY "ranked_queue_update_own" ON public.ranked_queue
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ranked_queue_waiting
    ON public.ranked_queue (status, mmr)
    WHERE status = 'waiting';

-- ── 5. Match Events (granular stat log) ─────────────────────
CREATE TABLE IF NOT EXISTS public.ranked_match_events (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    match_id    uuid NOT NULL REFERENCES public.ranked_matches(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id),
    leg_number  integer NOT NULL DEFAULT 1,
    event_type  text NOT NULL CHECK (event_type IN ('score','checkout','180','140_plus','high_finish','leg_won','leg_lost')),
    value       integer NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.ranked_match_events ENABLE ROW LEVEL SECURITY;

-- Players can read events for their matches
CREATE POLICY "ranked_match_events_select" ON public.ranked_match_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.ranked_matches m
            WHERE m.id = match_id
            AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
        )
    );

-- Players can insert events for their active matches
CREATE POLICY "ranked_match_events_insert" ON public.ranked_match_events
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.ranked_matches m
            WHERE m.id = match_id
            AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid())
            AND m.status = 'in_progress'
        )
    );

CREATE INDEX IF NOT EXISTS idx_ranked_match_events_match
    ON public.ranked_match_events (match_id, leg_number);

-- ── 6. Helper: compute rank tier from MMR ───────────────────
CREATE OR REPLACE FUNCTION public.compute_rank_tier(p_mmr integer)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_mmr >= 3000 THEN 'apex'
        WHEN p_mmr >= 2500 THEN 'diamond'
        WHEN p_mmr >= 2000 THEN 'platinum'
        WHEN p_mmr >= 1500 THEN 'gold'
        WHEN p_mmr >= 1000 THEN 'silver'
        ELSE 'bronze'
    END;
$$;

-- ── 7. Enable Realtime on queue and matches ─────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.ranked_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ranked_matches;

-- ── 8. Service-role bypass policies for edge functions ──────
-- Edge functions use the service role key, which bypasses RLS.
-- No additional policies needed for edge function writes.

-- ============================================================
-- Migration complete: Ranked Mode schema ready
-- ============================================================
