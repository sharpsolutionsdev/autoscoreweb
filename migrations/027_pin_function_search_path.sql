-- 027_pin_function_search_path.sql
-- Address Supabase advisor: function_search_path_mutable.
-- Pin search_path on every flagged public.* helper to a safe, explicit list.
-- This prevents search_path-injection attacks where a caller could create a
-- malicious function in a schema that resolves before the intended one.

DO $$
DECLARE
  rec RECORD;
  sigs TEXT[] := ARRAY[
    'public.creators_set_updated_at()',
    'public.compute_rank_tier(integer)',
    'public.spend_wallet(uuid, numeric, text, uuid, text)',
    'public.set_updated_at()',
    'public.sync_league_players_joined()',
    'public.dartvoice_on_subscription_active()',
    'public.dartvoice_handle_subscription_email()',
    'public.check_referral_milestones()',
    'public.check_referral_milestones(uuid)',
    'public.sync_referral_code()',
    'public.dv_friends_set_updated_at()',
    'public.sync_tournament_players_joined()',
    'public.generate_referral_code()',
    'public.update_raffle_ticket_count()',
    'public.deduct_credit_balance(uuid, numeric)',
    'public.credit_wallet(uuid, numeric, text, text)',
    'public.compute_rank_tier(integer)'
  ];
  s TEXT;
BEGIN
  FOREACH s IN ARRAY sigs LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', s);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skip (not found): %', s;
    END;
  END LOOP;
END $$;

-- stripe.* helpers (separate schema)
ALTER FUNCTION stripe.check_rate_limit(text, integer, integer) SET search_path = stripe, public, pg_temp;
ALTER FUNCTION stripe.set_updated_at() SET search_path = stripe, public, pg_temp;
ALTER FUNCTION stripe.set_updated_at_metadata() SET search_path = stripe, public, pg_temp;
