-- ============================================================
-- Migration 013: Add player1_100_plus / player2_100_plus to
-- ranked_matches. The submit_result edge function and the
-- web client already write these fields, but they were missing
-- from the original 012_ranked_mode.sql schema.
-- ============================================================

ALTER TABLE public.ranked_matches
    ADD COLUMN IF NOT EXISTS player1_100_plus integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS player2_100_plus integer DEFAULT 0;

-- Allow the existing match_events check constraint to also accept '100_plus' events
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ranked_match_events_event_type_check'
    ) THEN
        ALTER TABLE public.ranked_match_events
            DROP CONSTRAINT ranked_match_events_event_type_check;
    END IF;

    ALTER TABLE public.ranked_match_events
        ADD CONSTRAINT ranked_match_events_event_type_check
        CHECK (event_type IN (
            'score','checkout','180','140_plus','100_plus','high_finish','leg_won','leg_lost'
        ));
END $$;
