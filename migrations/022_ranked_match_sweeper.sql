-- 022_ranked_match_sweeper.sql
-- Adds result-submission timestamps and schedules the auto-resolution sweeper.
--
-- Behaviour the sweeper enforces (executed in the ranked-match-sweeper edge fn):
--   * One player has submitted, the other hasn't, and >= 24h have passed since
--     that submission     → auto-accept the submitter's claim (silent player
--     forfeits) and run the normal MMR completion flow.
--   * Match is `in_progress` and no result submitted by either party within
--     48h of started_at   → cancel the match (no MMR change).
--   * Match has been in `lobby` for > 2h without ever starting
--                         → cancel (clears stale matchmaking lobbies).
--   * Disputed matches are NEVER auto-resolved — admin only.

ALTER TABLE public.ranked_matches
    ADD COLUMN IF NOT EXISTS player1_result_submitted_at timestamptz,
    ADD COLUMN IF NOT EXISTS player2_result_submitted_at timestamptz;

-- Backfill: any rows that already have *_result_submitted=true get a
-- conservative fallback timestamp so the sweeper has something to work with.
UPDATE public.ranked_matches
   SET player1_result_submitted_at = COALESCE(started_at, created_at)
 WHERE player1_result_submitted = true
   AND player1_result_submitted_at IS NULL;

UPDATE public.ranked_matches
   SET player2_result_submitted_at = COALESCE(started_at, created_at)
 WHERE player2_result_submitted = true
   AND player2_result_submitted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ranked_matches_sweep
    ON public.ranked_matches (status, started_at, created_at)
    WHERE status IN ('in_progress', 'lobby', 'pending');

-- ── Optional sweeper run log (for observability) ────────────
CREATE TABLE IF NOT EXISTS public.ranked_match_sweeper_log (
    id                          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ran_at                      timestamptz NOT NULL DEFAULT now(),
    scanned                     integer NOT NULL DEFAULT 0,
    forfeited_count             integer NOT NULL DEFAULT 0,
    cancelled_abandoned_count   integer NOT NULL DEFAULT 0,
    cancelled_stale_lobby_count integer NOT NULL DEFAULT 0,
    errors_count                integer NOT NULL DEFAULT 0,
    details                     jsonb
);

ALTER TABLE public.ranked_match_sweeper_log ENABLE ROW LEVEL SECURITY;

-- Admins only — keeps the audit trail visible in the admin dashboard.
CREATE POLICY "ranked_match_sweeper_log_admin_select"
    ON public.ranked_match_sweeper_log
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ranked_match_sweeper_log_ran_at
    ON public.ranked_match_sweeper_log (ran_at DESC);

-- ── Schedule: pg_cron + pg_net call to the edge function every 10 minutes ──
-- Requires the `pg_cron` and `pg_net` extensions enabled on the project.
-- Both ship enabled on every Supabase project by default.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Stash the project URL + service role key in vault so the cron job can call
-- the edge function. If you've never set these, run *once* (replace placeholders):
--
--   SELECT vault.create_secret('https://YOUR-PROJECT.supabase.co', 'project_url');
--   SELECT vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');
--
-- Or set them as Postgres GUCs via the dashboard (Database → Settings).

-- Idempotent: drop existing job if re-running the migration.
DO $$
BEGIN
    PERFORM cron.unschedule('ranked-match-sweeper-10min');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
    'ranked-match-sweeper-10min',
    '*/10 * * * *',
    $cron$
    SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/ranked-match-sweeper',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
        ),
        body := jsonb_build_object('source', 'pg_cron')
    );
    $cron$
);
