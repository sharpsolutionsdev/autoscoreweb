-- 011_creator_portal_access.sql
-- Allow creators to read their own outreach_log entries (activity timeline)
-- and insert their own creator_message entries (contact form in /creator-portal).
-- Also links existing creator rows to auth.users by matching email.

DROP POLICY IF EXISTS log_creator_own_select ON public.outreach_log;
CREATE POLICY log_creator_own_select
    ON public.outreach_log FOR SELECT TO authenticated
    USING (
        creator_id IS NOT NULL
        AND creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS log_creator_own_insert ON public.outreach_log;
CREATE POLICY log_creator_own_insert
    ON public.outreach_log FOR INSERT TO authenticated
    WITH CHECK (
        channel = 'creator_message'
        AND creator_id IS NOT NULL
        AND creator_id IN (SELECT id FROM public.creators WHERE user_id = auth.uid())
    );

-- Backfill: link creators rows to auth.users by email
UPDATE public.creators
   SET user_id = u.id
  FROM auth.users u
 WHERE public.creators.user_id IS NULL
   AND public.creators.email IS NOT NULL
   AND lower(public.creators.email) = lower(u.email);
