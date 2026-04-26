-- 028_tighten_rls_and_storage.sql
-- Address remaining Supabase advisor warnings:
--   - rls_policy_always_true: dartvoice_contact_messages "Allow anonymous inserts" had WITH CHECK (true)
--   - public_bucket_allows_listing: avatars bucket had two broad SELECT policies allowing object listing
--
-- Notes:
--   * Public buckets serve files via /storage/v1/object/public/ which bypasses RLS,
--     so dropping the broad SELECT policies still allows public URL access — it just
--     stops anonymous LIST/iteration of the bucket contents.
--   * Contact form policy is replaced with a length-bounded WITH CHECK that still
--     allows anonymous submissions (form is on contact.html) but rejects garbage.

-- ── Contact form: replace USING/WITH CHECK (true) with bounded validation ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='dartvoice_contact_messages'
      AND policyname='Allow anonymous inserts'
  ) THEN
    DROP POLICY "Allow anonymous inserts" ON public.dartvoice_contact_messages;
  END IF;
END $$;

CREATE POLICY "Anonymous contact submissions"
  ON public.dartvoice_contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND char_length(email) BETWEEN 3 AND 254
    AND position('@' in email) > 1
    AND position('.' in split_part(email, '@', 2)) > 0
    AND message IS NOT NULL
    AND char_length(message) BETWEEN 1 AND 5000
    AND (subject IS NULL OR char_length(subject) <= 200)
    AND (name IS NULL OR char_length(name) <= 200)
  );

-- ── Avatars bucket: drop broad listing-capable SELECT policies ──
-- Public bucket flag still serves objects directly; these policies only enabled
-- list/iteration via PostgREST, which is the leak the advisor flags.
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
