# DartVoice Outreach Bot Server

Drains `public.outreach_queue` and sends messages via each platform's API.

## What works vs. what doesn't

| Channel          | How | Notes |
|------------------|-----|-------|
| `email`          | Handled client-side (mailto) — not this worker | |
| `reddit_dm`      | Official API via snoowrap | Subject to rate limits. Accounts get flagged for promo spam — **use a dedicated bot account with organic karma**. |
| `reddit_comment` | Official API via snoowrap | Subreddit-specific rules apply. Many darts subs auto-filter promo. |
| `x_dm`           | X API v2 (**paid Basic tier**, $200/mo min) | Cold DMs to non-followers violate the X ToS even with API access. Accounts lock fast. |
| `x_reply`        | X API v2 (paid) | Same caveats. |
| `facebook_msg`   | ❌ Graph API does not allow cold DMs. Manual only. |
| `instagram_dm`   | ❌ Graph API requires the user to DM your Business account first. Manual only. |
| `tiktok_comment` | ❌ No public comment-post endpoint. Manual only. |

For the "❌" rows the UI logs a queue entry but the worker marks it `failed` with `last_error` explaining the limitation. Attempting to browser-automate these will get the underlying account(s) banned — if you still want to try, see `src/browser/` (stubs only).

## Setup

```bash
cd outreach-server
npm install
cp .env.example .env       # fill in at least SUPABASE_SERVICE_KEY
npm start
```

Open http://localhost:3050/health — should report `{ ok: true, enabled: false }`. Flip `BOT_ENABLED=true` in `.env` once you're happy with the config.

## Safety

- Global kill: set `BOT_ENABLED=false`. The worker keeps polling but does not send.
- Per-platform min-gap env vars (e.g. `REDDIT_MIN_GAP_MS`) enforce a floor between sends.
- The admin UI's "Cancel all pending" button flips every `pending` row to `cancelled`.

## Adding a platform

1. Create `src/drivers/<name>.js` exporting `{ send(row) -> { ok, externalId?, externalUrl?, error? } }`.
2. Register it in `src/drivers/index.js` under the channel name(s).
3. Add the channel to `outreach_templates.channel` CHECK list if you want templates for it.
