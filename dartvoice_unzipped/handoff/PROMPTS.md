# DartVoice Creator Admin — Claude Code Prompts

Use these prompts **in order** inside VS Code with Claude Code (Opus).
Paste one at a time, wait for it to finish before moving to the next.

---

## STEP 0 — orientation (run this first)

```
Read these files thoroughly before doing anything:
1. handoff/README.md — full spec, schema, API details
2. dartvoice-dashboard.html — existing page structure and Tailwind config to match
3. theme.js — brand theming system
4. css/general/base.css — global styles
5. components/dv-nav.js — shared nav
6. login.html — existing auth flow

Don't write any code yet. Just confirm you've read them and summarise:
- The Tailwind colour config
- How Supabase auth currently works in this codebase
- The existing CSS custom properties for brand colours
- Any patterns I should follow when creating new pages
```

---

## STEP 1 — Supabase schema

```
Create the Supabase tables from the schema in handoff/README.md.

Write a SQL migration file at supabase/migrations/001_creator_crm.sql with:
- creators table (all fields from README)
- outreach_log table
- admin_users table
- Row Level Security policies (admin_only on creators)
- Indexes on creators.status and creators.platform

Also write a setup guide comment at the top explaining how to run it in the Supabase dashboard.
```

---

## STEP 2 — Admin CRM page

```
Build admin.html in the repo root.

Reference design: handoff/Creator CRM.html (high-fidelity prototype — recreate this exactly)
Reference page structure: dartvoice-dashboard.html

Requirements:
- Auth gate: on load, check Supabase session. If no session → redirect to /login. If session but user not in admin_users table → redirect to /dartvoice-dashboard. Only proceed if admin.
- Match the existing page structure from dartvoice-dashboard.html: same nav (dv-nav.js), same Tailwind config, same CSS custom properties (--brand, --brand-rgb etc), same body background #08080A
- Load creators from Supabase 'creators' table (not localStorage)
- All CRUD operations (add, edit, delete, status update) must write to Supabase
- Stats header: total creators, active partners, total estimated earnings at 1%, missing emails count
- Filter tabs: All | New Lead | Contacted | Responded | Negotiating | Active | Declined (with counts)
- Grid and table view toggle
- Add/Edit creator modal with all fields from the prototype
- Creator detail modal with status update, email template link, Gmail link
- Email template link: opens Creator Outreach Email.html with URL params ?name=&channel=&subs=&email=&slug=&tier=&amount=
- Export CSV button (client-side)
- Search input (client-side filter)
- "Find email" helper links in add modal when email field is empty
- Status badges, tier badges exactly as in README colour spec
- Toast notifications on save/delete/status change
- All animations (fadeUp) matching the dartvoice-dashboard style
```

---

## STEP 3 — YouTube Finder tab

```
Add a "Find Creators" tab to admin.html.

I have a YouTube Data API v3 key: [PASTE YOUR API KEY HERE]

The tab should:
- Have a search input and preset query chips: "darts review", "darts tips", "darts practice", "darts tutorial UK", "darts player", "dartcounter"
- On search: call https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q={query}&maxResults=20&key={KEY}
- Then fetch subscriber counts: https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id={channelIds}&key={KEY}
- Show results as cards: channel thumbnail (snippet.thumbnails.medium.url), channel name, subscriber count (formatted), description excerpt, YouTube link
- "Add to CRM" button on each result: pre-fills the add creator modal with their data and switches to the CRM tab
- Handle API errors gracefully (quota exceeded, no results)
- Match the dark card style from the CRM prototype
```

---

## STEP 4 — Hunter.io email finder

```
Add email finding to admin.html.

I have a Hunter.io API key: [PASTE YOUR HUNTER.IO KEY HERE]

In the add/edit creator modal, when the email field is empty:
- Show a "Find Email" button next to the email input
- On click: extract the creator's first/last name from the name field, and try to derive a domain from their channel name
- Call https://api.hunter.io/v2/email-finder?first_name={first}&last_name={last}&domain={domain}&api_key={KEY}
- If found: auto-fill the email field and show a green confirmation
- If not found: show message "Not found — check YouTube About tab" with a link

Also add a bulk "Find Missing Emails" button in the main CRM header that runs the finder for all creators with empty emails (rate-limited, 1 per second).
```

---

## STEP 5 — Creator Portal page

```
Build creator-portal.html in the repo root.

Reference design: handoff/Creator Portal.html (high-fidelity prototype — recreate this exactly)

Requirements:
- Auth gate: requires Supabase session. If no session → redirect to /login
- Load the logged-in user's creator record from Supabase creators table (match on email)
- If no creator record found: show a friendly "You're not set up yet" message with a contact link
- Show: their referral link (dartvoice.app/{slug}), stats (clicks, sign-ups, earned, pending), monthly progress, recent activity feed from outreach_log, their deal breakdown, contact form, resources
- Copy link button: copies https://dartvoice.app/{slug} to clipboard
- Contact form: insert a row into outreach_log with type='creator_message', body = message content
- Stats are read from the creators table (add clicks, signups, earned, pending_payout columns if not already there)
- Match dartvoice-dashboard.html page structure exactly — same nav, same fonts, same colours
- This page lives at /creator-portal or accessible from dartvoice-dashboard.html for ambassador users
```

---

## STEP 6 — Wire everything together

```
Final integration pass:

1. In dartvoice-dashboard.html: if the logged-in user has a record in the creators table with status='active', show an "Ambassador Portal" card/button that links to creator-portal.html

2. In admin.html: the "Open Email Template" button should open Creator Outreach Email.html in a new tab with all URL params pre-filled from the creator record

3. In creator-portal.html: the contact form submission should send an email notification to team@dartvoice.app (use Supabase Edge Functions or a simple mailto fallback)

4. Add admin.html and creator-portal.html to the existing sitemap.xml (with changefreq=never so they don't get indexed)

5. Update robots.txt to disallow /admin and /creator-portal from search crawlers

6. Test the full flow:
   - Admin logs in → /admin → finds a creator via YouTube search → adds to CRM → sends email template → marks as contacted
   - Creator logs in → /dartvoice-dashboard → sees Ambassador Portal card → clicks to /creator-portal → sees their stats and link
```

---

## API keys you'll need to drop in

| What | Where to get it | Paste into |
|------|----------------|-----------|
| YouTube Data API v3 key | console.cloud.google.com → Enable YouTube Data API v3 → Credentials → API Key | Step 3 prompt |
| Hunter.io API key | hunter.io → Dashboard → API | Step 4 prompt |
| Supabase service_role key | Supabase → Project Settings → API → service_role | admin.html Supabase init |
| Your admin user UUID | Supabase → Authentication → Users → copy your UUID | admin_users table insert |

---

## Quick Supabase setup (do this before Step 2)

1. Go to your Supabase project → SQL Editor
2. Paste and run `supabase/migrations/001_creator_crm.sql` (created in Step 1)
3. Go to Authentication → Users → copy your user UUID
4. Run this in SQL Editor:
   ```sql
   insert into admin_users (user_id) values ('YOUR-UUID-HERE');
   ```
5. Done — your account is now the admin

---

## Notes for Claude Code

- The existing codebase uses **vanilla JS + Tailwind CDN + Supabase JS v2** — do not introduce React, Vue, or any build tools
- All pages must include the theme.js script in `<head>` for brand colour support
- Use the existing `dv-nav.js` web component for navigation on all new pages
- Tailwind config (colours, fonts) is defined inline in each page's `<script>` tag — copy the config from dartvoice-dashboard.html exactly
- The `--brand` CSS variable is set by theme.js — always use `var(--brand)` not hardcoded `#CC0B20`
- Supabase client is initialised with the public anon key for auth; use service_role key only for server-side operations (Edge Functions)
