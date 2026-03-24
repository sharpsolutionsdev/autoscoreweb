# Web App System Skeleton

A reusable architecture template for a premium, conversion-focused web platform with auth, payments, user accounts, and a referral system. Drop in any niche or product — the skeleton stays the same.

---

## Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Vanilla HTML + Tailwind CSS (CDN) | No build step, no framework |
| JavaScript | Vanilla JS (inline + `app.js` global) | Shared logic loaded on every page |
| Auth | Supabase (magic link / OTP) | Passwordless — no passwords stored |
| Database | Supabase (Postgres + RLS) | Row-level security on all tables |
| Backend logic | Supabase Edge Functions (Deno/JS) | Server-side payment & promo validation |
| Payments | PayPal JS SDK + Edge Function verify | Client creates order, server verifies |
| Hosting | GitHub Pages + custom domain (CNAME) | Static files, zero infra |
| Domain | Namecheap DNS → CNAME | Points to GitHub Pages |

---

## Page Map

```
index.html           ← Landing / homepage (primary CTA)
auth.html            ← Sign in (magic link flow)
dashboard.html       ← Authenticated user area (vault/account)
[product].html       ← Core product/offer page (purchase flow)
admin.html           ← Admin panel (restricted)
leaderboard.html     ← Social proof / rankings
leagues.html         ← Community / group feature
past.html            ← History / past events / winners
how-it-works.html    ← Explainer / FAQ
payment-success.html ← Post-purchase redirect
payment-cancel.html  ← Abandoned payment redirect
terms.html           ← Legal
```

---

## Auth Flow

```
User lands on page
  → URL params captured immediately (before Supabase strips them)
  → Stored in sessionStorage + localStorage as fallback

User enters email on auth.html
  → Supabase sends magic link via email
  → On link click → SIGNED_IN event fires
  → Referral attribution runs at this moment (one-time)
  → User redirected to index.html (or original destination)
```

Key detail: referral params are read from the URL **before** Supabase's `history.replaceState` wipes them, then persisted to storage so they survive the magic link redirect (which may open in a different browser tab).

---

## Database Schema (Core Tables)

```
profiles
  id (UUID, FK → auth.users)
  username
  referral_code
  [niche-specific fields]

[product_items]           ← e.g. raffles, courses, events
  id, title, price, status, end_date, ...

user_[purchases]          ← e.g. user_tickets, enrollments
  id, user_id (FK), item_id (FK), quantity, promo_code_used, paypal_order_id, created_at

promo_codes
  id, code (UNIQUE), discount_percent, max_discount_base
  usage_limit, usage_remaining, active (BOOL), expires_at

referrals
  id, referrer_id (FK), referred_user_id (FK), created_at
```

All tables use RLS — users can only read/write their own rows. Admin access via service role key in Edge Functions only.

---

## Payment Flow

```
Client (browser)
  1. User selects quantity / applies promo code (UI only, no validation yet)
  2. PayPal JS SDK creates an order → sends to PayPal
  3. User approves in PayPal popup
  4. onApprove fires → sends PayPal Order ID to Edge Function

Edge Function (server)
  5. Receives: { paypalOrderId, itemId, quantity, promoCode, userId }
  6. Verifies PayPal order with PayPal API (server-to-server)
  7. Validates price against DB (not what client said)
  8. Validates promo code against DB (active, not expired, usage > 0)
  9. Checks for duplicate transaction (same PayPal Order ID)
  10. Inserts purchase record into DB (atomic)
  11. Decrements promo code usage_remaining
  12. Returns success → client redirects to dashboard
```

Security properties: price manipulation via DevTools is impossible, promo codes are never in client JS, duplicate charges are blocked, all operations are atomic.

---

## Referral System

```
Referrer shares link:  /auth.html?ref_username=johndoe
                   or  /auth.html?ref=JOHNDOE

New user signs up
  → ref params saved to localStorage before magic link wipes URL
  → On SIGNED_IN event:
      - Look up referrer by username or referral_code in profiles table
      - Check referrals table for duplicate (prevent re-attribution)
      - Insert into referrals table: { referrer_id, referred_user_id }
      - Clear all stored ref values (runs only once per signup)
```

---

## Promo Code System

```
DB-driven — codes are never hardcoded in JS.

promo_codes table fields:
  - discount_percent     (e.g. 50 = 50% off)
  - max_discount_base    (e.g. £25 cap)
  - usage_remaining      (decrements atomically on each valid use)
  - active               (toggle on/off instantly)
  - expires_at           (timestamp — auto-expires)

Validation happens server-side in the Edge Function only.
Client UI shows feedback but has no authority over pricing.
```

---

## Global JS (`app.js`)

Loaded on every page. Contains:
- Supabase client initialisation (`window.supabaseClient`)
- Referral param capture (runs immediately on load)
- `onAuthStateChange` listener (referral attribution)
- `processPayment()` helper
- `refreshVaultAfterPurchase()` helper
- Any shared utility functions

Pattern: attach everything to `window` so all pages share one client instance.

---

## Design System

```
Colors (Tailwind custom config, defined per page):
  brand:   #dc2626  (primary action, CTAs)
  accent:  #f59e0b  (premium highlight, gold tier)
  dark:    #0c1220  (page background)
  card:    #141f35  (surface / card background)
  success: #10b981  (confirmations)

Typography:
  Display font  → Barlow Condensed (bold, italic, condensed — headlines)
  Body font     → Plus Jakarta Sans (clean, readable)

Component patterns:
  - Cards: bg-card/60 backdrop-blur border border-white/8 rounded-3xl
  - CTAs:  bg-brand hover:bg-red-700 shadow glow effect
  - Inputs: dark bg, white/8 border, brand focus ring
  - Toasts: auto-dismiss, success/error states
  - Backgrounds: radial/conic gradients + blur blobs (decorative only)
```

---

## Funnel Structure

```
1. Landing page (index.html)
     → Hero + CTA → auth.html or product page

2. Auth (auth.html)
     → Email → magic link → signed in
     → New user: profile setup prompt on dashboard

3. Product page ([product].html)
     → View offer → select options → PayPal checkout
     → Edge Function validates → success redirect

4. Dashboard (dashboard.html)
     → View purchases / progress / profile
     → Upsell prompts for next offer

5. Community / social proof
     → leaderboard.html, leagues.html, past.html
     → Drives FOMO and repeat purchases
```

---

## Deployment

```
Repo: GitHub (main branch = live)
Host: GitHub Pages (static, free)
Domain: Custom domain via CNAME file → Namecheap DNS A/CNAME record
SSL:  Automatic via GitHub Pages

No build step — push HTML/JS/CSS → live within seconds.
```

---

## Key Architectural Decisions

| Decision | Why |
|---|---|
| No JS framework | Zero build step, instant deploys, easy to hand off |
| Supabase for everything | Auth + DB + Edge Functions in one platform, generous free tier |
| Magic link auth | No password reset flow, lower friction, higher signup rate |
| Server-side payment validation | Prevent price manipulation, fraud protection |
| DB-driven promo codes | Change/disable codes instantly without redeploying |
| RLS on all tables | Security enforced at DB level, not just app level |
| Referral captured on auth event | Only reliable moment — URL may be wiped before page loads |

---

## How to Clone This for a New Niche

1. **Replace** product tables (`raffles` → `courses` / `events` / `products`)
2. **Replace** `user_tickets` with `user_enrollments` / `user_orders` etc.
3. **Swap** payment provider (PayPal → Stripe) by updating Edge Function + client SDK
4. **Update** color scheme in each page's `tailwind.config`
5. **Update** fonts in Google Fonts link if desired
6. **Swap** decorative SVG backgrounds (dartboard → anything domain-relevant or remove)
7. **Rename** `app.js` global helpers to match new domain model
8. **Repoint** Supabase URL + anon key in `app.js`
9. **Deploy** to GitHub Pages with new CNAME

Everything else — auth, payments, referrals, promo codes, RLS, Edge Functions — is niche-agnostic and reusable as-is.
