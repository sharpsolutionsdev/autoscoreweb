-- ============================================================================
-- DartVoice Profiles — Migration 003
-- ============================================================================
-- Adds display_name to dartvoice_profiles so users can set a friendly name
-- that appears on their dashboard greeting and profile card.
-- ============================================================================

ALTER TABLE public.dartvoice_profiles
    ADD COLUMN IF NOT EXISTS display_name TEXT;
