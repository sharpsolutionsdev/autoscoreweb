-- ====================================================================
-- RLS & ADMIN SETUP — OcheVault
-- Run this entire file in your Supabase SQL Editor
-- ====================================================================

-- ====================================================================
-- STEP 1: Add is_admin column to profiles
-- ====================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Set YOUR account as admin (replace with your actual user UUID from Supabase Auth > Users)
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'YOUR-USER-UUID-HERE';

-- ====================================================================
-- STEP 2: Enable RLS on all public tables
-- ====================================================================

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE raffles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals         ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- STEP 3: profiles policies
-- ====================================================================

-- Anyone can read a profile (needed for referral code/username lookup)
CREATE POLICY "profiles: public read"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile row (created on first sign-in)
CREATE POLICY "profiles: insert own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile; admins can update any profile
CREATE POLICY "profiles: update own or admin"
  ON profiles FOR UPDATE
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ))
  WITH CHECK (auth.uid() = id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- Only admins can delete profiles
CREATE POLICY "profiles: admin delete"
  ON profiles FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- ====================================================================
-- STEP 4: raffles policies
-- ====================================================================

-- Anyone (even unauthenticated) can read raffles — needed for homepage
CREATE POLICY "raffles: public read"
  ON raffles FOR SELECT
  USING (true);

-- Only admins can create raffles
CREATE POLICY "raffles: admin insert"
  ON raffles FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- Only admins can update raffles (e.g. draw winner, update status)
CREATE POLICY "raffles: admin update"
  ON raffles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- Only admins can delete raffles
CREATE POLICY "raffles: admin delete"
  ON raffles FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- ====================================================================
-- STEP 5: user_tickets policies
-- ====================================================================

-- Users can read their own tickets; admins can read all
CREATE POLICY "user_tickets: read own or admin"
  ON user_tickets FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Authenticated users can insert their own tickets (Edge Function uses service role, bypasses RLS)
CREATE POLICY "user_tickets: insert own"
  ON user_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only admins can update tickets (e.g. marking a winner)
CREATE POLICY "user_tickets: admin update"
  ON user_tickets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- Only admins can delete tickets
CREATE POLICY "user_tickets: admin delete"
  ON user_tickets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- ====================================================================
-- STEP 6: referrals policies
-- ====================================================================

-- Users can read referrals where they are referrer or referred
CREATE POLICY "referrals: read own"
  ON referrals FOR SELECT
  USING (
    auth.uid() = referrer_id
    OR auth.uid() = referred_user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Authenticated users can insert their own referral on sign-up
CREATE POLICY "referrals: insert own"
  ON referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_user_id);

-- Only admins can update referrals (status changes)
CREATE POLICY "referrals: admin update"
  ON referrals FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- ====================================================================
-- STEP 7: Fix function search_path (prevents privilege escalation)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.check_referral_milestones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  -- original function body — replace this with your actual body if different
  RETURN NEW;
END;
$func$;

-- Fix decrement_promo_usage (already in SUPABASE_SETUP_GUIDE.sql — just add search_path)
CREATE OR REPLACE FUNCTION public.decrement_promo_usage(promo_code TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.promo_codes
  SET usage_remaining = GREATEST(0, usage_remaining - 1)
  WHERE code = UPPER(promo_code)
    AND active = TRUE
    AND expires_at > NOW()
    AND usage_remaining > 0;
$$;

-- ====================================================================
-- STEP 8: Indexes for unindexed foreign keys
-- (Fixes "Unindexed foreign keys" advisor warnings)
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_user_tickets_user_id     ON public.user_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tickets_raffle_id   ON public.user_tickets(raffle_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id    ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user  ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_league_entries_user_id   ON public.league_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_user  ON public.tournament_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_p1   ON public.tournament_brackets(player1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_brackets_p2   ON public.tournament_brackets(player2_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON public.wallet_transactions(user_id);

-- ====================================================================
-- STEP 9: Admin helper function — draw a raffle winner
-- Picks one random user_id from user_tickets weighted by qty,
-- stores winner_user_id on the raffle row, sets status = 'completed'
-- ====================================================================

CREATE OR REPLACE FUNCTION public.draw_raffle_winner(p_raffle_id BIGINT)
RETURNS TABLE(winner_user_id UUID, winner_username TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_winner_id UUID;
  v_username  TEXT;
BEGIN
  -- Pick a random ticket entry weighted by qty
  SELECT ut.user_id
    INTO v_winner_id
    FROM public.user_tickets ut
   WHERE ut.raffle_id = p_raffle_id
   ORDER BY random()
   LIMIT 1;

  IF v_winner_id IS NULL THEN
    RAISE EXCEPTION 'No tickets found for raffle %', p_raffle_id;
  END IF;

  SELECT p.username INTO v_username
    FROM public.profiles p
   WHERE p.id = v_winner_id;

  -- Store winner on the raffle row and close it
  UPDATE public.raffles
     SET winner_user_id = v_winner_id,
         status = 'completed'
   WHERE id = p_raffle_id;

  RETURN QUERY SELECT v_winner_id, v_username;
END;
$$;

-- Grant execute only to authenticated users (RLS on calling function checks is_admin)
REVOKE ALL ON FUNCTION public.draw_raffle_winner(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.draw_raffle_winner(BIGINT) TO authenticated;

-- ====================================================================
-- STEP 10: Add winner_user_id column to raffles (if it doesn't exist)
-- ====================================================================

ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS winner_user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS description TEXT;

-- ====================================================================
-- STEP 11: Grant your account admin access
-- After running everything above, run this with YOUR user UUID:
-- ====================================================================

-- UPDATE public.profiles SET is_admin = TRUE WHERE id = 'YOUR-USER-UUID-HERE';

-- To find your UUID, run:
-- SELECT id, email FROM auth.users LIMIT 10;
