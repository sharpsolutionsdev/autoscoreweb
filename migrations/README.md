# DartVoice Migrations

Plain-SQL migrations applied in order against the Supabase project
`poyjykgqsvgimssbhsuz`. Newer migrations assume all earlier ones have been
applied successfully.

## Apply with Supabase CLI

```bash
# from repo root, with SUPABASE_DB_URL set in your shell env:
psql "$SUPABASE_DB_URL" -f migrations/023_competitions.sql
psql "$SUPABASE_DB_URL" -f migrations/024_competitions_seed.sql
```

Or paste the file contents into the Supabase SQL Editor one file at a time.

## Order matters

| # | File | Adds |
|---|------|------|
| 023 | `023_competitions.sql` | competitions, competition_tickets, competition_winners, RLS, `reserve_competition_tickets()` RPC |
| 024 | `024_competitions_seed.sql` | 6 sample draws (replace `price_REPLACE_ME_*` first) |

## Stripe Price seeding (required before 024)

For each row in `024_competitions_seed.sql`:

1. Stripe Dashboard → **Products** → **+ Add product**
2. Name = the competition title, currency = **GBP**, pricing = **One-time**.
3. Set unit price = `ticket_price_pence / 100`.
4. After save, click the price → copy the `price_…` ID.
5. Replace the matching `price_REPLACE_ME_*` placeholder in the migration.
6. Save the migration and run `psql … -f 024_competitions_seed.sql`.

> Don't run 024 with placeholders still in it — the `/competition-checkout`
> endpoint refuses any competition where `stripe_price_id` doesn't resolve to
> a real Stripe Price, so the row would just sit dead.

## Backfilling Stripe IDs without re-seeding

If competitions were already inserted, just `UPDATE`:

```sql
UPDATE public.competitions
   SET stripe_price_id = 'price_1NZxyzABC...'
 WHERE slug = 'target-power-9five-gen7';
```

## Rolling back

Each migration adds tables/columns idempotently. Hand-roll a `DROP` if you
need to reverse — there's no down-migration framework here on purpose.
