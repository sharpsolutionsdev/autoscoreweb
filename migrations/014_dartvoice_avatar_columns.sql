-- ============================================================
-- Migration 014: Ensure avatar columns exist on dartvoice_profiles
-- The dashboard saves avatar_url (Supabase Storage public URL) and
-- falls back to avatar_data (base64 data URL) when storage upload
-- fails. Migration 011 attempted to add avatar_url but it is
-- missing in production, so we re-add it here. avatar_data was
-- never declared in any migration but is written by the client.
-- ============================================================

ALTER TABLE public.dartvoice_profiles
    ADD COLUMN IF NOT EXISTS avatar_url  text,
    ADD COLUMN IF NOT EXISTS avatar_data text;
