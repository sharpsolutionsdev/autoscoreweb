-- ============================================================================
-- DartVoice Competitions (raffle draws) — Migration 023
-- ============================================================================
-- New revenue stream modelled on dartgearcompetitions.co.uk + mpowercompetitions.co.uk:
--   * Low ticket price (£0.99 – £4.99)
--   * Hard ticket cap per draw → guaranteed margin once cap is sold
--   * Fixed draw_at timestamp (legal requirement under UK Gambling Act 2005
--     "free-prize draw / prize competition" exemption — there must always be
--     a free postal entry route, see /competitions/terms)
--   * Optional "instant win" tickets (jsonb array of ticket_number → prize)
--
-- Tables:
--   competitions          — one row per draw
--   competition_tickets   — Stripe-paid entries (one row per checkout)
--   competition_winners   — finalised winners per draw / instant-win
--
-- All write paths run via the billing_server with the service role key.
-- The anon-key client only ever SELECTs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competitions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                 TEXT NOT NULL UNIQUE,
    title                TEXT NOT NULL,
    subtitle             TEXT,
    description          TEXT,
    prize_image_url      TEXT,
    prize_value_pence    INTEGER NOT NULL,                 -- retail value, for display
    ticket_price_pence   INTEGER NOT NULL CHECK (ticket_price_pence > 0),
    total_tickets        INTEGER NOT NULL CHECK (total_tickets > 0),
    sold_tickets         INTEGER NOT NULL DEFAULT 0 CHECK (sold_tickets >= 0),
    max_per_user         INTEGER NOT NULL DEFAULT 75,
    draw_at              TIMESTAMPTZ NOT NULL,
    status               TEXT NOT NULL DEFAULT 'draft',
    -- statuses: draft | active | sold_out | drawing | drawn | cancelled
    hero_color           TEXT DEFAULT '#CC0B20',
    instant_wins         JSONB DEFAULT '[]'::jsonb,
    -- shape: [{ticket_number: 137, prize_label: "£50 cash", claimed: false}, ...]
    stripe_price_id      TEXT,                              -- per-comp Stripe Price (£X)
    created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (sold_tickets <= total_tickets)
);

CREATE INDEX IF NOT EXISTS idx_competitions_status   ON public.competitions (status);
CREATE INDEX IF NOT EXISTS idx_competitions_draw_at  ON public.competitions (draw_at);

CREATE OR REPLACE FUNCTION public.competitions_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS competitions_updated_at ON public.competitions;
CREATE TRIGGER competitions_updated_at
    BEFORE UPDATE ON public.competitions
    FOR EACH ROW EXECUTE FUNCTION public.competitions_set_updated_at();

-- ── Tickets ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.competition_tickets (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id       UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    qty                  INTEGER NOT NULL CHECK (qty > 0),
    ticket_numbers       INTEGER[] NOT NULL,
    amount_paid_pence    INTEGER NOT NULL,
    stripe_session_id    TEXT UNIQUE,                       -- nullable for free postal entries
    payment_status       TEXT NOT NULL DEFAULT 'pending',
    -- statuses: pending | paid | refunded | failed | postal
    answer_correct       BOOLEAN,                           -- skill-question gate
    paid_at              TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_comp     ON public.competition_tickets (competition_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user     ON public.competition_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status   ON public.competition_tickets (payment_status);

-- ── Winners ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.competition_winners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id  UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    ticket_id       UUID REFERENCES public.competition_tickets(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    display_name    TEXT,
    ticket_number   INTEGER NOT NULL,
    prize_label     TEXT NOT NULL,
    is_instant_win  BOOLEAN NOT NULL DEFAULT FALSE,
    drawn_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_out_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_winners_comp ON public.competition_winners (competition_id);
CREATE INDEX IF NOT EXISTS idx_winners_drawn ON public.competition_winners (drawn_at DESC);

-- ── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE public.competitions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_tickets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_winners   ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can read non-draft competitions and the public winners list.
DROP POLICY IF EXISTS competitions_public_read ON public.competitions;
CREATE POLICY competitions_public_read ON public.competitions
    FOR SELECT
    USING (status IN ('active','sold_out','drawing','drawn'));

DROP POLICY IF EXISTS winners_public_read ON public.competition_winners;
CREATE POLICY winners_public_read ON public.competition_winners
    FOR SELECT
    USING (TRUE);

-- A signed-in user can read ONLY their own paid tickets.
DROP POLICY IF EXISTS tickets_own_read ON public.competition_tickets;
CREATE POLICY tickets_own_read ON public.competition_tickets
    FOR SELECT
    USING (user_id = auth.uid());

-- Admins full access (for /admin moderation pane)
DROP POLICY IF EXISTS competitions_admin_all ON public.competitions;
CREATE POLICY competitions_admin_all ON public.competitions
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS tickets_admin_all ON public.competition_tickets;
CREATE POLICY tickets_admin_all ON public.competition_tickets
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS winners_admin_all ON public.competition_winners;
CREATE POLICY winners_admin_all ON public.competition_winners
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- All other writes (ticket purchase, increment sold_tickets, draw winner)
-- happen exclusively via the billing_server with the service role key.

-- ── Atomic ticket reservation (race-safe) ───────────────────────────────────
-- The billing_server calls this from the Stripe webhook handler so two
-- simultaneous purchases can't oversell a draw.
CREATE OR REPLACE FUNCTION public.reserve_competition_tickets(
    p_competition_id UUID,
    p_qty            INTEGER
)
RETURNS INTEGER[]
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total      INTEGER;
    v_sold       INTEGER;
    v_status     TEXT;
    v_numbers    INTEGER[];
    v_i          INTEGER;
BEGIN
    SELECT total_tickets, sold_tickets, status
        INTO v_total, v_sold, v_status
    FROM public.competitions
    WHERE id = p_competition_id
    FOR UPDATE;

    IF v_status <> 'active' THEN
        RAISE EXCEPTION 'competition_not_active';
    END IF;
    IF v_sold + p_qty > v_total THEN
        RAISE EXCEPTION 'not_enough_tickets';
    END IF;

    v_numbers := ARRAY(SELECT generate_series(v_sold + 1, v_sold + p_qty));

    UPDATE public.competitions
        SET sold_tickets = v_sold + p_qty,
            status = CASE WHEN v_sold + p_qty = v_total THEN 'sold_out' ELSE 'active' END
        WHERE id = p_competition_id;

    RETURN v_numbers;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_competition_tickets(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_competition_tickets(UUID, INTEGER) TO service_role;

-- ── Sample seed (commented; run in dashboard once a Stripe Price exists) ────
-- INSERT INTO public.competitions
--   (slug, title, subtitle, prize_value_pence, ticket_price_pence, total_tickets, draw_at, status, stripe_price_id)
-- VALUES
--   ('target-power-9five-gen7',  'Target Phil Taylor Power 9Five Gen 7', 'Premium 95% tungsten · 23g/24g/25g',
--    20000,  299,  500, now() + interval '5 days', 'active', 'price_REPLACE_ME'),
--   ('luke-littler-gen-1',       'Target Luke Littler Gen 1',            'The teen sensation''s signature darts',
--    9999,   199,  600, now() + interval '3 days', 'active', 'price_REPLACE_ME'),
--   ('mvg-adrenalin',            'Winmau MvG Adrenalin',                  'Michael van Gerwen''s practice darts',
--    17999,  249,  800, now() + interval '7 days', 'active', 'price_REPLACE_ME'),
--   ('cash-500',                 '£500 Tax-Free Cash',                   'Straight to your bank, no questions',
--    50000,  299, 1500, now() + interval '4 days', 'active', 'price_REPLACE_ME'),
--   ('snakebite-gen-3',          'Red Dragon Peter Wright Snakebite Gen 3','Two-time world champion''s setup',
--    19999,  299,  500, now() + interval '6 days', 'active', 'price_REPLACE_ME'),
--   ('winmau-blade-6-board',     'Winmau Blade 6 Triple Core',           'The world-championship dartboard',
--    7499,    99, 1000, now() + interval '2 days', 'active', 'price_REPLACE_ME');
