# Handoff: DartVoice Creator Outreach Admin

## Overview
A gated admin tool for the DartVoice team to discover darts content creators on YouTube, manage outreach, send personalised ambassador emails, and track the full pipeline from "New Lead" through to "Active Partner". Lives at `dartvoice.app/admin` (or a subroute), accessible only to authenticated admin users via Supabase.

## About the Design Files
The files in this bundle are **high-fidelity HTML prototypes** built as design references — not production code. Your task is to **recreate these designs inside the existing autoscoreweb codebase**, using its established patterns: vanilla JS, Tailwind CSS, Supabase JS v2, and the existing DartVoice design system (theme.js, base.css, dv-nav.js, dv-footer.js). Do not ship the HTML files directly.

## Fidelity
**High-fidelity.** Pixel-accurate colours, typography, spacing and interactions. Recreate as closely as possible using the codebase's existing Tailwind config and CSS custom properties.

---

## Design System (from existing codebase)

### Colours
```
--brand:        #CC0B20  (red, themeable via theme.js)
--brand-rgb:    204, 11, 32
--brand-light:  #e60d24
background:     #08080A
card:           #111114
card-2:         #18181C
wire:           #252530
muted:          #6E6E82
muted-2:        #4A4A5A
chalk:          #F0F0F5
success:        #22c55e
```

### Typography
```
Display: "Barlow Condensed", font-weight 900, font-style italic
Body:    "Plus Jakarta Sans", weights 400/500/600/700
```

### Key CSS classes (from base.css / Tailwind config)
- `.display` — Barlow Condensed 900 italic
- `.card-panel` — dark gradient card with brand-red border glow on hover
- `.btn-brand` — brand red button
- `.skeleton` — loading skeleton
- `.spinner` — loading spinner
- `.fade-up`, `.fade-up-0` through `.fade-up-4` — entrance animations
- `.noise` — subtle noise texture on body

---

## Screens / Views

### 1. Admin Gate (`/admin`)
**Purpose:** Auth check — redirect non-admins away immediately.

**Behaviour:**
- On load: call `supabase.auth.getUser()`
- If no session → redirect to `/login`
- If session but user not in `admin_users` table (or not matching hardcoded admin UUID) → redirect to `/dartvoice-dashboard`
- If admin → render the CRM

**Implementation note:** Check against a Supabase table `admin_users (user_id uuid primary key)` OR simply compare `user.id` to a hardcoded admin UUID stored in an env variable / JS const.

---

### 2. Creator CRM (`Creator CRM.html` — reference file)

**Layout:** Full-viewport single-page app. Sticky top nav + scrollable content area. Max-width 1200px centred.

**Top Nav (52px):**
- Left: DartVoice logo SVG + wordmark + "Creator CRM" label
- Right: Export CSV button | Email Template link | Add Creator button (brand red)

**Stats Bar (4 cards, CSS grid 4-col):**
Each card: `background: linear-gradient(160deg,#111114,#0D0D10)`, `border: 1px solid rgba(255,255,255,0.06)`, `border-radius: 14px`, `padding: 16px 20px`
- Total Creators (white number)
- Active Partners (green `#4ade80`)
- Total Est. Earnings at 1% (brand red, format `£X,XXX`)
- Missing Emails (amber `#fbbf24` if >0, else green)

**Filter + Search Bar:**
- Tab pills for: All | New Lead | Contacted | Responded | Negotiating | Active | Declined
- Each tab shows count badge
- Active tab: `background: rgba(255,255,255,0.08)`, `color: #F0F0F5`; active count badge: `background: rgba(204,11,32,0.2)`, `color: var(--brand)`
- Right side: search input (220px, expands to 260px on focus) + grid/list view toggle buttons

**Creator Grid (default view):**
- CSS grid: `repeat(auto-fill, minmax(280px,1fr))`, gap 14px
- Each card: dark gradient, 1px border, border-radius 14px, hover lift + border brighten
- Card contents:
  - Top row: avatar (36×36, border-radius 10px, brand bg, Barlow Condensed initials) + name/platform + status badge
  - Middle: channel handle (left) + formatted sub count (right)
  - Bottom: tier badge (left) + estimated earnings italic (right, brand red)
  - Warning strip if no email: amber tint, "⚠ Email not found"

**Creator Table (alternate view):**
- Columns: Creator | Platform | Subscribers | Email | Tier | Status | Est. Earnings | Actions
- Row hover: `rgba(255,255,255,0.02)` background
- Actions: mail icon, edit icon, delete icon (small ghost buttons)

**Status badges:**
```
new:         bg rgba(99,102,241,0.12)  border rgba(99,102,241,0.3)  text #818cf8
contacted:   bg rgba(245,158,11,0.12) border rgba(245,158,11,0.3)  text #fbbf24
responded:   bg rgba(6,182,212,0.12)  border rgba(6,182,212,0.3)   text #22d3ee
negotiating: bg rgba(168,85,247,0.12) border rgba(168,85,247,0.3)  text #c084fc
active:      bg rgba(34,197,94,0.12)  border rgba(34,197,94,0.3)   text #4ade80
declined:    bg rgba(100,100,120,0.12)border rgba(100,100,120,0.25) text #6E6E82
```

**Tier badges:**
```
starter: indigo tones
pro:     brand red tones
elite:   amber/gold tones
```

---

### 3. Add / Edit Creator Modal

**Overlay:** `background: rgba(0,0,0,0.75)`, `backdrop-filter: blur(6px)`
**Modal:** `background: #111114`, `border-radius: 20px`, `max-width: 560px`, `max-height: 90vh`, scrollable

**Fields (2-col grid where possible):**
- Name + Channel Handle
- Platform (select: YouTube/TikTok/Instagram/Twitch/Other) + Subscribers (number)
- Email
- Tier (select: starter/pro/elite) + Per Referral £ (number)
- Status (select) + Personal Page Slug (with `dartvoice.app/` prefix shown inline)
- Date Added + Date Contacted (date inputs)
- Notes (textarea)

**Email finder helper:** If email field is empty, show an info box with:
- Link to their YouTube About tab
- Link to Hunter.io search
- Reminder to check Instagram/TikTok bio

---

### 4. Creator Detail Modal

**Header:** Avatar (44px) + name + channel/platform

**Stats row (3 cols):**
- Subscribers | Per Referral £ | Est. Earnings (brand red, with a thin progress bar below)

**Info section:** key/value list — Email (mailto link) | Personal page URL | Tier badge | Date added | Date contacted

**Status update:** Row of pill buttons for each status. Active status highlighted in its colour.

**Notes:** Dark chip with the note text

**Actions:**
- "Open Email Template" (brand red, full width) → opens `Creator Outreach Email.html` with URL params pre-filled
- "Open in Gmail" (ghost, full width) → `mailto:` link
- Edit + Delete (ghost/danger, side by side)

---

### 5. Email Template (`Creator Outreach Email.html` — reference file)

**Layout:** 300px sidebar (dark) + main preview area

**Sidebar fields:**
- Sender name + email
- Creator: name, channel, subs, page slug, email
- Offer: tier pills, per referral £, sign-on bonus

**Preview tabs:** Rich (HTML email render) | Plain Text (copy-ready)

**Rich email structure:**
1. Logo + eyebrow + bold Barlow headline ("HEY [NAME], GOT A MINUTE?")
2. Personal intro paragraph (references sender name as "Head of Marketing & Creator Collaborations")
3. What is DartVoice? — 3-point list with icons (voice scoring, cheaper than Omni £500+, per dart or per visit)
4. Personal page pill (`dartvoice.app/[slug]`)
5. Offer box (brand red gradient, large £amount, tier badge, perks checklist)
6. Interactive earnings slider (conversion rate 0.5%–5%, live calc)
7. Script idea block (italic bordered quote)
8. Free trial options (browser demo + gifted pro account)
9. Open to negotiations section (green-tinted box)
10. Sign-off + CTA button + footer sig

**Copy Plain Text button:** copies full plain-text version to clipboard.

---

## YouTube Finder Feature (to be built)

**Purpose:** Search YouTube for darts creators directly from the admin page, see real channel data, and add them to the CRM in one click.

**API:** YouTube Data API v3
- Endpoint: `GET https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q={query}&maxResults=20&key={API_KEY}`
- Then: `GET https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id={channelId}&key={API_KEY}` for subscriber counts

**UI:** Search input with preset query chips ("darts review", "darts practice", "darts tutorial UK", "darts tips", "darts player"). Results show channel thumbnail, name, sub count, description excerpt, and "Add to CRM" button.

**Channel thumbnail:** `snippet.thumbnails.medium.url` from the API response.

---

## Hunter.io Email Finder (to be built)

**API:** `GET https://api.hunter.io/v2/email-finder?domain={domain}&first_name={first}&last_name={last}&api_key={KEY}`

**Trigger:** Button inside the creator detail modal / add modal when email field is empty.

---

## Gmail Send Integration (to be built)

**Flow:**
1. Admin clicks "Send Email" for a creator
2. Email composer opens (pre-filled from template)
3. On send: call Gmail API `POST /gmail/v1/users/me/messages/send`
4. Auto-update creator status to "Contacted" + set dateContacted = today
5. Log to Supabase `outreach_log` table

**Auth:** Google OAuth 2.0 — same Google Cloud project as YouTube API. Scope: `https://www.googleapis.com/auth/gmail.send`

---

## Supabase Schema

```sql
-- Creators table
create table creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),  -- admin who added
  name text not null,
  channel text,
  platform text default 'YouTube',
  subs integer default 0,
  email text,
  tier text default 'pro',
  amount numeric default 10,
  status text default 'new',
  slug text,
  notes text,
  date_added date default now(),
  date_contacted date,
  youtube_channel_id text,
  thumbnail_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Outreach log
create table outreach_log (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references creators(id) on delete cascade,
  sent_by uuid references auth.users(id),
  subject text,
  body text,
  sent_at timestamptz default now()
);

-- Admin users
create table admin_users (
  user_id uuid primary key references auth.users(id)
);

-- RLS: only admins can read/write creators
alter table creators enable row level security;
create policy "admin_only" on creators
  using (exists (select 1 from admin_users where user_id = auth.uid()));
```

---

## Interactions & Behaviour

- **Status change** → optimistic UI update + Supabase `update` call
- **Add creator** → Supabase `insert` + toast notification
- **Delete creator** → confirm dialog + Supabase `delete` + remove from state
- **Export CSV** → client-side CSV generation from current filtered list, trigger download
- **Search/filter** → client-side filter on in-memory data (no extra DB calls)
- **Email template link** → open `Creator Outreach Email.html` (or its integrated version) with URL params: `?name=Charlie&channel=@charliemurphy50&subs=84000&email=...&slug=charlie&tier=pro&amount=10`

---

## API Keys Needed from User

| Key | Where to get it | Used for |
|-----|----------------|---------|
| `YOUTUBE_API_KEY` | console.cloud.google.com → YouTube Data API v3 | Channel search + stats |
| `HUNTER_API_KEY` | hunter.io → API | Email finding |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role | DB writes from admin |
| `ADMIN_USER_ID` | Supabase → Auth → Users → UUID | Gating admin access |
| Google OAuth client ID/secret | console.cloud.google.com → OAuth 2.0 | Gmail send |

---

## Files in this Bundle

| File | Purpose |
|------|---------|
| `Creator CRM.html` | Full CRM prototype — reference for layout, components, interactions |
| `Creator Outreach Email.html` | Email composer prototype — reference for email template UI |
| `README.md` | This document |

## Existing Codebase Reference Files

These files in the autoscoreweb repo are directly relevant:

| File | Why |
|------|-----|
| `theme.js` | Brand theming system — use CSS vars `--brand`, `--brand-rgb` throughout |
| `css/general/base.css` | Global styles, animations, utilities |
| `dartvoice-dashboard.html` | Best reference for page structure, nav, card patterns, Tailwind config |
| `components/dv-nav.js` | Shared nav web component |
| `components/dv-footer.js` | Shared footer web component |
| `login.html` | Auth flow reference |

## Prompt for Claude Code

Paste this to get started:

```
I need you to build a gated admin page for the DartVoice site (autoscoreweb repo).

Read the full handoff README at handoff/README.md — it has everything: design spec, Supabase schema, API integrations, and the visual design system.

The two HTML prototypes (Creator CRM.html and Creator Outreach Email.html) are high-fidelity design references showing exactly what to build.

Start by:
1. Reading README.md thoroughly
2. Reading dartvoice-dashboard.html to understand the existing page structure and Tailwind config
3. Reading theme.js and css/general/base.css for the design system
4. Creating the Supabase tables from the schema in the README
5. Building admin.html following the CRM prototype exactly, gated by Supabase auth + admin_users table check
6. Wiring up the YouTube Data API search feature (API key will be provided)

Match the dark theme, typography, and component patterns from dartvoice-dashboard.html exactly. Use the existing Tailwind config — do not introduce new dependencies.
```
