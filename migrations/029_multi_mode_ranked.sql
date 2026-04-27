-- 029_multi_mode_ranked.sql
-- Multi-mode ranked system: per-mode Elo, mode catalog, anti-cheat stats source,
-- first-9 avg tracking. Additive migration — existing 501 BO5 ranked play keeps
-- working; new modes layer on top.
--
-- Goals:
--   1. Separate Elo/MMR per mode (chess.com style — Rapid/Blitz/Bullet)
--   2. Capture stats from DartCounter only (anti-cheat: no manual entry for ranked)
--   3. Track first-9 avg + checkout % per match for richer leaderboard sorting
--   4. Keep current ranked_profiles intact (legacy 501 BO5 source of truth)

BEGIN;

-- ── Modes catalog ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranked_modes (
  code              text PRIMARY KEY,
  name              text NOT NULL,
  short_name        text NOT NULL,
  description       text,
  family            text NOT NULL,           -- '501','301','cricket','bulls','t20s'
  format            text NOT NULL,           -- 'best_of_5','first_to_10', etc
  legs_to_win       integer,                 -- e.g. 3 for BO5
  target_count      integer,                 -- e.g. 10 for first-to-10 bulls
  source            text NOT NULL DEFAULT 'dartcounter',  -- 'dartcounter' | 'native'
  is_active         boolean NOT NULL DEFAULT true,
  is_pro_only       boolean NOT NULL DEFAULT false,
  display_order     integer NOT NULL DEFAULT 100,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ranked_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Modes readable by anyone" ON public.ranked_modes;
CREATE POLICY "Modes readable by anyone" ON public.ranked_modes
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.ranked_modes (code, name, short_name, description, family, format, legs_to_win, target_count, source, display_order)
VALUES
  ('501_bo5',     '501 — Best of 5 Legs',     '501 BO5',  'Standard 501 double-out, first to 3 legs.',                      '501',     'best_of_5',  3, NULL, 'dartcounter', 10),
  ('301_bo5',     '301 — Best of 5 Legs',     '301 BO5',  'Fast format, double-out, first to 3 legs.',                      '301',     'best_of_5',  3, NULL, 'dartcounter', 20),
  ('cricket_bo5', 'Cricket — Best of 5',      'Cricket',  'Standard tactics. First to close 15-20 + bull and lead score.',  'cricket', 'best_of_5',  3, NULL, 'dartcounter', 30),
  ('bulls_10',    'First to 10 Bulls',        '10 Bulls', 'DartVoice native. First player to hit 10 bullseyes wins.',       'bulls',   'first_to_n', NULL, 10, 'native',    40),
  ('t20s_10',     'First to 10 Treble 20s',   '10 T20s',  'DartVoice native. First player to hit 10 T20s wins.',            't20s',    'first_to_n', NULL, 10, 'native',    50)
ON CONFLICT (code) DO NOTHING;

-- ── Per-mode ratings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ranked_ratings (
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode                 text NOT NULL REFERENCES public.ranked_modes(code) ON DELETE RESTRICT,
  season_id            uuid REFERENCES public.ranked_seasons(id) ON DELETE SET NULL,
  mmr                  integer NOT NULL DEFAULT 1200,
  peak_mmr             integer NOT NULL DEFAULT 1200,
  rank_tier            text NOT NULL DEFAULT 'silver',
  placement_matches    integer NOT NULL DEFAULT 0,
  is_placed            boolean NOT NULL DEFAULT false,
  wins                 integer NOT NULL DEFAULT 0,
  losses               integer NOT NULL DEFAULT 0,
  win_streak           integer NOT NULL DEFAULT 0,
  best_win_streak      integer NOT NULL DEFAULT 0,
  total_180s           integer NOT NULL DEFAULT 0,
  total_140_plus       integer NOT NULL DEFAULT 0,
  total_tons           integer NOT NULL DEFAULT 0,
  total_high_finishes  integer NOT NULL DEFAULT 0,
  best_finish          integer NOT NULL DEFAULT 0,
  avg_match_average    numeric(6,2) NOT NULL DEFAULT 0,
  avg_first_9          numeric(6,2) NOT NULL DEFAULT 0,
  avg_checkout_pct     numeric(5,2) NOT NULL DEFAULT 0,
  total_legs_won       integer NOT NULL DEFAULT 0,
  total_legs_lost      integer NOT NULL DEFAULT 0,
  matches_played       integer NOT NULL DEFAULT 0,
  last_match_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_ranked_ratings_mode_mmr
  ON public.ranked_ratings (mode, mmr DESC);

CREATE INDEX IF NOT EXISTS idx_ranked_ratings_user
  ON public.ranked_ratings (user_id);

ALTER TABLE public.ranked_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ratings readable by anyone" ON public.ranked_ratings;
CREATE POLICY "Ratings readable by anyone" ON public.ranked_ratings
  FOR SELECT TO anon, authenticated USING (true);

-- Writes only by service_role (edge function ranked-match-result).

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_ranked_ratings_updated_at ON public.ranked_ratings;
CREATE TRIGGER trg_ranked_ratings_updated_at
  BEFORE UPDATE ON public.ranked_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Mode + anti-cheat fields on ranked_matches ─────────────────────────────
ALTER TABLE public.ranked_matches
  ADD COLUMN IF NOT EXISTS mode             text NOT NULL DEFAULT '501_bo5'
                                            REFERENCES public.ranked_modes(code) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS player1_first_9  numeric(6,2),
  ADD COLUMN IF NOT EXISTS player2_first_9  numeric(6,2),
  ADD COLUMN IF NOT EXISTS stats_source     text NOT NULL DEFAULT 'manual'
                                            CHECK (stats_source IN ('dartcounter','native','manual')),
  ADD COLUMN IF NOT EXISTS stats_verified   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dartcounter_match_id text;

CREATE INDEX IF NOT EXISTS idx_ranked_matches_mode
  ON public.ranked_matches (mode, completed_at DESC);

-- Mark all existing matches as 501_bo5 (default already does this) + flag them
-- as stats_verified=true since they ran through the existing trusted flow.
UPDATE public.ranked_matches
SET stats_verified = true,
    stats_source   = 'dartcounter'
WHERE stats_verified = false AND status = 'completed';

-- ── Mode on queue (separate queues per mode) ───────────────────────────────
ALTER TABLE public.ranked_queue
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT '501_bo5'
                          REFERENCES public.ranked_modes(code) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_ranked_queue_mode_waiting
  ON public.ranked_queue (mode, status, mmr) WHERE status = 'waiting';

-- ── Backfill ranked_ratings from legacy ranked_profiles (501 BO5) ──────────
INSERT INTO public.ranked_ratings (
  user_id, mode, season_id, mmr, peak_mmr, rank_tier,
  placement_matches, is_placed, wins, losses, win_streak, best_win_streak,
  total_180s, total_140_plus, total_tons, total_high_finishes, best_finish,
  avg_match_average, avg_checkout_pct,
  total_legs_won, total_legs_lost,
  matches_played, last_match_at, created_at
)
SELECT
  rp.id, '501_bo5', rp.season_id, rp.mmr, rp.peak_mmr, rp.rank_tier,
  rp.placement_matches, rp.is_placed, rp.wins, rp.losses, rp.win_streak, rp.best_win_streak,
  rp.total_180s, rp.total_140_plus, rp.total_tons, rp.total_high_finishes, rp.best_finish,
  rp.avg_match_average, rp.avg_checkout_pct,
  rp.total_legs_won, rp.total_legs_lost,
  COALESCE(rp.wins,0) + COALESCE(rp.losses,0),
  rp.updated_at, COALESCE(rp.created_at, now())
FROM public.ranked_profiles rp
ON CONFLICT (user_id, mode) DO NOTHING;

-- ── Per-user, per-mode stats view (for profile pages + leaderboards) ───────
DROP VIEW IF EXISTS public.dartvoice_player_mode_stats CASCADE;
CREATE VIEW public.dartvoice_player_mode_stats
WITH (security_invoker = true)
AS
SELECT
  r.user_id,
  r.mode,
  m.name              AS mode_name,
  m.short_name        AS mode_short_name,
  r.mmr,
  r.peak_mmr,
  r.rank_tier,
  r.is_placed,
  r.placement_matches,
  r.wins,
  r.losses,
  CASE WHEN (r.wins + r.losses) > 0
       THEN round(100.0 * r.wins / (r.wins + r.losses), 1)
       ELSE 0 END     AS win_rate,
  r.win_streak,
  r.best_win_streak,
  r.avg_match_average AS avg,
  r.avg_first_9       AS first_9_avg,
  r.avg_checkout_pct  AS checkout_pct,
  r.total_180s,
  r.total_140_plus,
  r.total_high_finishes,
  r.best_finish,
  r.total_legs_won,
  r.total_legs_lost,
  r.matches_played,
  r.last_match_at,
  rank() OVER (PARTITION BY r.mode ORDER BY r.mmr DESC) AS mode_rank
FROM public.ranked_ratings r
JOIN public.ranked_modes   m ON m.code = r.mode
WHERE m.is_active = true;

GRANT SELECT ON public.dartvoice_player_mode_stats TO anon, authenticated;

-- ── Profile display fields (display_name + avatar) on dartvoice_profiles ───
-- ranked_profiles already holds these; mirror to dartvoice_profiles so the
-- general profile page has them without joining the ranked tables.
ALTER TABLE public.dartvoice_profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url   text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS bio          text;

-- Backfill from ranked_profiles where present.
UPDATE public.dartvoice_profiles dp
SET display_name = COALESCE(dp.display_name, rp.display_name),
    avatar_url   = COALESCE(dp.avatar_url,   rp.avatar_url)
FROM public.ranked_profiles rp
WHERE rp.id = dp.id
  AND (dp.display_name IS NULL OR dp.avatar_url IS NULL);

-- Profile self-update policy (lets users edit their own display_name/avatar/bio)
DROP POLICY IF EXISTS "Users can update own dartvoice profile" ON public.dartvoice_profiles;
CREATE POLICY "Users can update own dartvoice profile"
  ON public.dartvoice_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Public read of profile (display_name, avatar_url, country_code, bio).
-- Sensitive fields like paypal_email are filtered via a view.
DROP VIEW IF EXISTS public.dartvoice_public_profiles CASCADE;
CREATE VIEW public.dartvoice_public_profiles
WITH (security_invoker = true)
AS
SELECT id, display_name, avatar_url, country_code, bio, created_at
FROM public.dartvoice_profiles;

GRANT SELECT ON public.dartvoice_public_profiles TO anon, authenticated;

COMMIT;
