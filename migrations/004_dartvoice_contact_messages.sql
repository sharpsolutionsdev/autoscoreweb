-- ============================================================================
-- DartVoice Contact Messages — Migration 004
-- ============================================================================
-- Creates a table for storing contact form submissions from the website.
-- Anonymous inserts allowed via RLS so non-logged-in users can submit.
-- ============================================================================

CREATE TABLE public.dartvoice_contact_messages (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    subject    TEXT        NOT NULL,
    email      TEXT        NOT NULL,
    name       TEXT,
    message    TEXT        NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dartvoice_contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (anon key used from the website contact form)
CREATE POLICY "Allow anonymous inserts"
    ON public.dartvoice_contact_messages
    FOR INSERT
    WITH CHECK (true);
