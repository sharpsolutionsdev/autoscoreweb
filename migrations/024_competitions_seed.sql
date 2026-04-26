-- ============================================================================
-- Migration 024: Seed initial competitions.
-- ============================================================================
-- BEFORE running this, create one Stripe Price per row in the Stripe dashboard
-- (Products → New product → recurring=NO, currency=GBP, price = ticket_price_pence).
-- Copy the price_xxx IDs back into the placeholders below.
--
-- All draws are scheduled relative to NOW() so this seed works on a fresh DB.
-- Adjust draw_at to match your actual go-live calendar before running in prod.
-- ============================================================================

INSERT INTO public.competitions
    (slug, title, subtitle, description,
     prize_value_pence, ticket_price_pence, total_tickets, max_per_user,
     draw_at, status, hero_color, stripe_price_id)
VALUES
    -- 1. Phil Taylor Power 9Five Gen 7
    ('target-power-9five-gen7',
     'Target Phil Taylor Power 9Five Gen 7',
     'Premium 95% tungsten · 23g/24g/25g',
     E'The legendary 16-time world champion''s signature tungsten setup.\n\n• 95% Swiss tungsten\n• Three weights to choose from\n• Premium flight + shaft set included\n• Carbon fibre case',
     20000, 299, 500, 75,
     now() + interval '5 days', 'active', '#CC0B20', 'price_1TQWlu1fLbzv9c0HGcZH8Pat'),

    -- 2. Luke Littler Gen 1
    ('luke-littler-gen-1',
     'Target Luke Littler Gen 1',
     'The teen sensation''s signature darts',
     E'Luke "The Nuke" Littler''s breakthrough setup that took the world by storm.\n\n• 90% tungsten, 23g\n• Pixel grip\n• Signature flights + shafts\n• Includes presentation case',
     9999, 199, 600, 75,
     now() + interval '3 days', 'active', '#CC0B20', 'price_1TQWlv1fLbzv9c0HuDWi6umA'),

    -- 3. MvG Adrenalin
    ('mvg-adrenalin',
     'Winmau MvG Adrenalin',
     'Michael van Gerwen''s practice darts',
     E'Built for power scoring with the same balance MvG uses on stage.\n\n• 90% tungsten, 22g\n• Practice-grade durability\n• Full Winmau accessory pack',
     17999, 249, 800, 75,
     now() + interval '7 days', 'active', '#0EA5E9', 'price_1TQWlv1fLbzv9c0HizFp8Lky'),

    -- 4. £500 Tax-Free Cash
    ('cash-500',
     '£500 Tax-Free Cash',
     'Straight to your bank, no questions',
     'Quick-fire cash draw — winner gets £500 transferred to a UK bank account or PayPal within 48 hours of the draw.',
     50000, 299, 1500, 75,
     now() + interval '4 days', 'active', '#22C55E', 'price_1TQWlv1fLbzv9c0HxhJebT9p'),

    -- 5. Snakebite Gen 3
    ('snakebite-gen-3',
     'Red Dragon Peter Wright Snakebite Gen 3',
     'Two-time world champion''s setup',
     E'Peter Wright''s most popular signature dart, beloved for its grip and balance.\n\n• 90% tungsten, 24g\n• Snakebite-pattern grip\n• Limited edition flights',
     19999, 299, 500, 75,
     now() + interval '6 days', 'active', '#10B981', 'price_1TQWlv1fLbzv9c0HXxVQfiUk'),

    -- 6. Winmau Blade 6 Triple Core
    ('winmau-blade-6-board',
     'Winmau Blade 6 Triple Core',
     'The world-championship dartboard',
     E'The official board of the BDO World Championship.\n\n• Razor-thin segment dividers\n• Self-healing sisal\n• Includes mount and surround',
     7499, 99, 1000, 75,
     now() + interval '2 days', 'active', '#F59E0B', 'price_1TQWlv1fLbzv9c0HRBQenPW0')
ON CONFLICT (slug) DO NOTHING;

-- Sanity check — list what was just seeded.
-- SELECT slug, title, ticket_price_pence, total_tickets, draw_at, status
-- FROM public.competitions ORDER BY draw_at;
