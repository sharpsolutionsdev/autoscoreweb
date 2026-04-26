-- ============================================================================
-- DartVoice — Row Level Security audit
-- ============================================================================
-- Run this in the Supabase SQL editor (or `psql` against the project).
-- It produces three reports:
--   1. Tables with RLS *disabled* — these accept anon writes if reachable
--   2. Tables with RLS enabled but *zero policies* — anon gets nothing,
--      but service_role still works (often what you want for admin tables)
--   3. Every existing policy with its USING / WITH CHECK expression so you
--      can eyeball anything weird (e.g. "USING (true)" on a write policy)
--
-- Run this any time you add a migration. Aim for: every public table either
-- (a) RLS-on with explicit per-row policies, or (b) RLS-on with no policies
-- and only touched server-side via service_role.
-- ============================================================================

\echo '─── 1. Tables with RLS DISABLED (public schema) ───'
SELECT
    n.nspname  AS schema,
    c.relname  AS table,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND NOT c.relrowsecurity
ORDER BY c.relname;

\echo ''
\echo '─── 2. Tables with RLS enabled but no policies ───'
SELECT
    t.schemaname,
    t.tablename
FROM pg_tables t
JOIN pg_class c
  ON c.oid = (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass
LEFT JOIN pg_policies p
  ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND c.relrowsecurity
  AND p.policyname IS NULL
GROUP BY t.schemaname, t.tablename
ORDER BY t.tablename;

\echo ''
\echo '─── 3. Every public policy ───'
SELECT
    schemaname,
    tablename,
    policyname,
    cmd      AS command,        -- ALL / SELECT / INSERT / UPDATE / DELETE
    roles,
    qual     AS using_expr,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ────────────────────────────────────────────────────────────────────────────
-- Spot-check queries — flag the high-value tables. Each row returned = a
-- problem worth investigating.
-- ────────────────────────────────────────────────────────────────────────────
\echo ''
\echo '─── 4. Anon-readable PII surface (display_name, email, etc.) ───'
SELECT t.tablename, p.policyname, p.cmd, p.qual
FROM pg_policies p
JOIN pg_tables t USING (schemaname, tablename)
WHERE p.schemaname = 'public'
  AND p.cmd IN ('SELECT', 'ALL')
  AND p.qual IN ('true', '(true)', '')         -- USING (true) = anyone can read
  AND t.tablename IN (
      'dartvoice_subscriptions',
      'dartvoice_profiles',
      'admin_users',
      'creators',
      'social_prospects',
      'outreach_log',
      'outreach_queue',
      'competition_tickets'
  );

\echo ''
\echo '─── 5. Tables missing the "with_check" guard on writes ───'
-- A write policy without WITH CHECK lets a row pass UPDATE/INSERT validation
-- using only the OLD row state. Almost always a bug.
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT','UPDATE','ALL')
  AND (with_check IS NULL OR with_check = '');
