# DartVoice — Site UX/UI Audit

*Generated April 2026. Walks every primary user journey, flags broken/dead behaviour first, then UX/UI/accessibility/conversion improvements ordered by impact. File-and-line references throughout so anything actionable can be picked up immediately.*

---

## 0. TL;DR — fix these first (ordered by harm)

| # | Issue | Where | Severity | Fix |
|---|---|---|---|---|
| 1 | **Skill-question correct answer in client HTML** (`data-correct="true"`). One DevTools peek bypasses it. UK Gambling Act exemption requires a *genuine* skill barrier — currently exempt status is on shaky legal ground. | [competition.html:120](../../competition.html#L120) | 🚨 Legal | Move correctness check to webhook (don't issue ticket if `metadata.skill_pass !== '1'`), randomise question/answer order server-side, log the answer with the entry. |
| 2 | **No webhook receiver** for Stripe `checkout.session.completed`. Buyers will pay and get nothing in the DB — no `competition_tickets` row, no email, no draw entry. | n/a (missing) | 🚨 Revenue | Author Supabase Edge Function `stripe-webhook` (≈60 lines) — verify signature, on `metadata.kind=='competition'` insert into `competition_tickets`, increment `sold_tickets`, send email. |
| 3 | **`payment_link_url` column not yet on `competitions` table** — Buy button will throw "Checkout not configured". | DB | 🚨 Blocker | Apply [migrations/025_competitions_payment_links.sql](../../migrations/025_competitions_payment_links.sql) via Supabase SQL editor. |
| 4 | **Dead `BILLING_URL = 'https://billing.dartvoice.app'`** referenced in 3 places after Render shutdown. CSP still allows it. | [competition.html:6](../../competition.html#L6), [competition.html:167](../../competition.html#L167), [dartvoice-dashboard.html:1980](../../dartvoice-dashboard.html#L1980) | High | Delete constant + drop from CSP `connect-src`. |
| 5 | **`/competitions/terms.html` link is broken** — file does not exist. Linked from competitions.html legal block and competition.html buy panel. Visible to every prospective buyer. | [competition.html](../../competition.html), [competitions.html](../../competitions.html) | High | Create `competitions/terms.html` (T&Cs + free postal entry route — required for Gambling Act exemption). |
| 6 | **Quantity selector duplicated** — buyer picks qty on `competition.html`, then Stripe Payment Link asks again. Confusing; users can mismatch. | [competition.html:127-138](../../competition.html#L127-L138) | Medium | Either (a) pass `?quantity=N` to Stripe Payment Link (Stripe respects it), or (b) remove the on-page selector and let Stripe own qty. Recommend (a) — keeps cost preview on-page. |
| 7 | **Body-text contrast fails WCAG AA** in several places — `--muted: #6E6E82` on `#08080A` ≈ 4.4:1 (borderline 4.5 fail), `--muted-2: #4A4A5A` ≈ 2.6:1 (clear fail). Used on FAQ subtext, table data rows, footer, login helper text. | site-wide | Medium | Bump muted to `#8A8A9C` (≈5.4:1). Reserve `--muted-2` for non-text decoration only. |
| 8 | **No active state in nav** — current page never highlights. Visitors lose orientation across competitions/ranked/dashboard. | [components/dv-nav.js](../../components/dv-nav.js) | Medium | Read `location.pathname` in `connectedCallback`, apply `text-brand` + bottom border to matching link. |
| 9 | **"Web App" is the brand-red primary nav item** — but most visitors aren't subscribed and hit the 10-min hard-lock on first click. Treats them like a paying user. | [components/dv-nav.js](../../components/dv-nav.js) | Medium | Demote to muted weight, change label to "Try Free Demo", and keep the brand red for **Start Free Trial** CTA only. |
| 10 | **Loader plays on every page load**, including return visits. Adds ~250–1800 ms perceived delay even for warm-cache navigation. | [index.html:124-141](../../index.html#L124-L141) | Low | Skip loader if `sessionStorage.getItem('dv-seen')==='1'`; set on first hide. |

---

## 1. Journey: New Visitor → Subscriber

```
Landing (index.html) → CTA → login.html?intent=subscribe → Stripe checkout → thanks.html → dashboard
```

### What works ✅
- Hero copy is strong ("Call your scores. Play your game.").
- 5-pillar value prop is consistent with [docs/02_VALUE_PROPOSITION.md](../02_VALUE_PROPOSITION.md).
- Competitor comparison block + 3-tier pricing with badges ("Most Popular" / "Best Value") is conversion-shaped.
- 7-day trial framing reduces commitment friction.
- Referral capture from `?ref=` URL param is solid ([index.html:51-57](../../index.html#L51-L57)).

### Issues 🔴

**1.1 — Hero CTA leads to login, not Stripe.** [index.html:259](../../index.html#L259) sends `Start Free Trial` → `/login?intent=subscribe`. The funnel doc says "single CTA → Stripe hosted checkout". An interstitial "sign in" wall before payment is the **#1 known conversion-killer**. Redirect straight to Stripe Payment Link with `client_reference_id` after-payment-callback to provision the user. The OTP login becomes a *post-purchase* identity-claim step instead of a *pre-purchase* friction wall.
  - **Estimated lift:** +15–30% checkout-start rate (industry benchmark for removing pre-checkout signups).

**1.2 — Two different price-link sources.** Dashboard uses `PAYMENT_LINKS[plan]` lookup ([dartvoice-dashboard.html:2061](../../dartvoice-dashboard.html#L2061)); marketing site CTAs go through `/login`. Single source of truth would be a `js/payment-links.js` consumed by both.

**1.3 — Hero video is heavy.** `mic-focus.mp4` autoplays even on slow 4G. Add `media="(min-width: 768px)"` to the `<source>` and a smaller poster JPG fallback.

**1.4 — Reduced motion respected on the 3D canvas only.** Login spinner, pulsing dots, ticker, mic-bar, `ssMic`/`ssQuote` keyframes, `bgDrift` and `logoGlow` all run regardless. Wrap them in a single `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; } }` block in [css/general/base.css](../../css/general/base.css). Vestibular-disorder + epilepsy users currently get a strobe-y first impression.

### Improvements ✨

- **Above the fold, add social proof.** "£74 MRR baseline" → soon as you have 3 ambassador testimonials, put faces + quotes in the hero. Conversion sites with a single hero testimonial outperform pure copy heroes by ~10%.
- **Pricing block: pre-select "6-Month" tab on load.** It's the labelled "Most Popular". You're letting the cheapest-monthly anchor win by default.
- **Add a 0-friction demo embed.** The Chrome extension already has a 10-min ungated demo — a Loom-style 30-sec autoplaying *muted* clip on the landing page (with caption "Triple twenty → 60 → 441") would do more than the static feature cards.

---

## 2. Journey: Sign In (returning user)

```
login.html → email → 6-digit OTP → /dartvoice-dashboard
```

### What works ✅
- 6 separate OTP boxes ([login.html:170-186](../../login.html#L170-L186)) feel modern.
- Auto-styling on `.filled`, focus glow.
- Footer component included.

### Issues 🔴

**2.1 — No paste handler shown for the 6-box OTP.** Users instinctively copy the code from email and paste — into the *first* box, which discards 5 chars. Add `paste` listener that splits across all 6.

**2.2 — No "Resend code" rate-limit feedback.** If a user spams the button, Supabase rate-limits silently. Show "Wait 30s before requesting again" countdown.

**2.3 — No back-to-edit-email button** once OTP step is shown. Mistyped email = full reload.

**2.4 — `?intent=subscribe` doesn't show context** — visitor is told to log in but not told *why* ("Sign in to start your free trial"). Add `<h1>` swap based on `intent` param.

**2.5 — `<dv-nav>` shows on login.** Login pages should have minimal chrome — single back-arrow + logo. Current full nav invites bouncing.

---

## 3. Journey: Browse → Buy Competition Ticket

```
competitions.html → click card → competition.html?slug=… → skill Q → qty → Buy → Stripe Payment Link → success
```

### What works ✅
- Skeleton loaders prevent layout shift ([competitions.html:97-99](../../competitions.html#L97-L99)).
- Cards animate in, hover lift is tasteful.
- Countdown + sold/total + progress bar communicate scarcity well.
- Per-competition `hero_color` brand override is a nice touch.
- Legal block with BeGambleAware link is in the right place.

### Issues 🔴

**3.1 — Skill question is client-trustworthy.** See §0 row 1. The current implementation makes the prize draw legally a **lottery** under UK law (no genuine skill barrier = lottery = needs Gambling Commission licence ≈ £4,000+ application + ongoing compliance). Either fix it server-side or pull the competitions feature until you can.

**3.2 — "Tickets sold" updates only on page load.** Two buyers in parallel can both think 5 tickets remain. Subscribe to the row via Supabase Realtime (already in tech stack per docs).

**3.3 — Free postal entry route advertised but no page exists.** The legal exemption literally requires this — see Gambling Commission guidance. [competitions.html:179-181](../../competitions.html#L179-L181) and [competition.html:155](../../competition.html#L155) both link to `/competitions/terms.html` which 404s.

**3.4 — Buy button copy regresses.** Currently flips: `Answer the skill question` → `Get N tickets — £X.XX` → `Redirecting…`. Good. But after Stripe redirect-back with `?paid=1` the page just reloads silently — should show a celebratory confirmation toast ("🎟️ You're in! Ticket #1234 — good luck.").

**3.5 — Quantity duplication.** See §0 row 6.

**3.6 — No ticket-number display anywhere on the site after purchase.** Users want to see *their* numbers — gives them a reason to come back for the draw.

### Improvements ✨

- **Add an "Auto-enter every draw" subscriber benefit.** Pro members get N free entries/month into every active comp. Strong upsell from buyers → subscribers.
- **Live winner reveal page.** A `/competitions/[slug]/draw` page that animates the winning ticket number on the announced date drives social shares.
- **Trust badges on competition.html buy panel.** Stripe badge + "Verifiable random draw" + "Free postal entry" pills above the buy button. Reduces trust friction at moment of purchase.

---

## 4. Journey: Onboarding (post-purchase)

```
thanks.html → dartvoice-dashboard.html → download client → guide.html → calibrate → first scored visit
```

### What works ✅
- Dashboard is the strongest page in the app — pro-profile card, avatar upload, download cards, ambassador tile.
- Avatar upload writes preview to localStorage immediately *before* Supabase upload — perceived instant.
- OTP-bridged auth flows through to all platforms.
- 60-line `dvCheckout()` handles popup vs mobile gracefully.

### Issues 🔴

**4.1 — "Time to first scored visit" is unmeasured.** Per [docs/03_PAYMENT_AND_FUNNEL.md](../03_PAYMENT_AND_FUNNEL.md) target is <5 min. There's no analytics event firing when a user makes their first voice score. Without it, calibration drop-off is invisible. Fire `gtag('event', 'first_score', {platform})` from the desktop/Android/web clients.

**4.2 — `guide.html` is reactive, not proactive.** Dashboard has a downloads card but no inline "4-step setup" widget tracking which steps the user has completed (sign-in detected ✓, app downloaded ?, guide read ?, first score ?). That checklist would be the **single highest-impact addition** for activation.

**4.3 — Stripe checkout in popup window** ([dartvoice-dashboard.html:2073-2079](../../dartvoice-dashboard.html#L2073-L2079)) — popup blockers, mobile Safari ignoring positioning, polling for 10 minutes. Better: full-page redirect with `success_url` doing the deed. The popup pattern is 2014 UX.

**4.4 — Email mismatch landmine.** User pays at Stripe with `personal@gmail.com`, then signs into dashboard with `work@company.com`. No record found. The OTP flow should expose the Stripe-customer email lookup so the user can be told "Use the email you paid with: per…@gmail.com".

---

## 5. Journey: Web Scorer (free demo)

### What works ✅
- Cinematic loader sets the tone.
- DartCounter iframe + injector pattern is elegant.
- Onboarding tutorial dims iframe but keeps controls crisp — clever.

### Issues 🔴

**5.1 — `body { overflow: hidden }`** on web-app.html ([web-app.html:114](../../web-app.html#L114)) — keyboard users on small viewports can be locked out of the bottom of the page entirely. Use `overflow-x: hidden` only.

**5.2 — Auto-inject toggle button is a permanent fixed-position element** ([web-app.html:84-104](../../web-app.html#L84-L104)) bottom-right, 200px wide, *always visible*. Reads as a debug widget that shipped to prod. Move into a dev/ambassador-only menu.

**5.3 — Iframe `dartcounter` reliance** — third-party DOM. If they change their CSS class names, the injector silently breaks for every user. Add a console warn + telemetry on `tryFindIframeAndStart` exhaustion.

**5.4 — No 10-min hard-lock countdown shown.** Per docs there's a 10-minute trial then upgrade prompt. The page never tells the demo user how much time they have, then suddenly locks. Add a pill `⏱ 7:23 free demo remaining` to the header.

---

## 6. Journey: Android APK (sideload)

### What works ✅
- `apk-gate.html` is mobile-first, single-purpose, fast.
- Auth state branches cleanly via `view.active`.
- Reduced-motion respected.
- Auth, value pills, CTA stack — clean.

### Issues 🔴

**6.1 — Visitors on desktop hit a mobile-only page.** No "this is for Android — open on your phone" prompt with a QR code. Add it.

**6.2 — "Sideload .apk" friction is real.** No mention of the security warning Android *will* show, no screenshot of the install dialog. First-time sideloaders bounce here.

---

## 7. Journey: Ambassador / Creator Portal

### What works ✅
- Stats dashboard reads cleanly (clicks → signups → earned → pending).
- Quick-chat snippets with token replacement is genuinely useful.
- £25 minimum payout is in plain English.

### Issues 🔴

**7.1 — "Not on the program" CTA is a `mailto:` link.** No structured application form, no auto-acknowledgement, no CRM row created. Lead loss. Replace with an inline Supabase-backed form that creates a `creator_applications` row + sends Resend confirmation.

**7.2 — Referral link copy button** does the right thing but doesn't tell the user (no toast / no aria-live announce).

**7.3 — "Resources" tile links to Chrome Web Store generic** ([creator-portal.html:200](../../creator-portal.html#L200)) — should deep-link to your extension's listing.

---

## 8. Cross-cutting issues

### 8.1 Navigation
- **Active state missing** — see §0 row 8.
- **Web App as primary CTA** — see §0 row 9.
- **Rankings dropdown loads on hover** — touch users can't see it. Add explicit click-toggle with `aria-expanded`.
- **"More" menu is hover-only.** Touch users tap, see flash, lose it. Click should latch.

### 8.2 Accessibility (WCAG 2.2 AA)
- **Contrast:** see §0 row 7. Run [axe](https://www.deque.com/axe/) on competitions.html and login.html.
- **Focus indicators:** custom buttons (`btn-brand`, `btn-ghost`, `qty-btn`, `quick-pick`, `skill-opt`) all suppress browser default but don't add their own. Add `:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }` globally.
- **Skill-question divs** ([competition.html:118-122](../../competition.html#L118-L122)) — `<div>` with `cursor: pointer`. Should be `<button>` or have `role="radio"` + `tabindex` + keyboard handler.
- **Animations without reduced-motion guard** — see §1.4.
- **Icon-only buttons missing `aria-label`** — mobile menu buttons in nav, qty +/- buttons, copy-link buttons.
- **`alt=""` missing** on several decorative SVGs (need `aria-hidden="true"` so SR doesn't announce "image" repeatedly).

### 8.3 Performance
- **Tailwind built CSS** is loaded after the inline brand-theming script. Good. But every page also pulls Google Fonts CSS + Supabase CDN as render-blocking. Add `<link rel="preload" as="style">`.
- **Three.js canvas** on index hero is GPU-heavy. Consider a static SVG fallback for low-end devices (`navigator.deviceMemory < 4`).
- **Hero `<video>` loads on mobile** despite `poster` — set `preload="none"` and only enable autoplay above 768px.
- **`max-width: 5xl` scrollbar hiding hack** ([dartvoice-dashboard.html:127-131](../../dartvoice-dashboard.html#L127-L131)) — accessibility concern; users with motor impairments rely on visible scrollbars to gauge content length.

### 8.4 Brand consistency
- Some pages set `--brand` from localStorage in inline script, others don't ([apk-gate.html](../../apk-gate.html) has its own `:root` `--brand` hardcoded that *competes* with the localStorage script). Theme toggling will desync.
- Footer component included on most pages but not all (notably: no `<dv-footer>` on apk-gate, web-app-mobile).
- Two competitions hero font weights differ (Barlow 800 in [competitions.html](../../competitions.html), 900 in [competition.html](../../competition.html)).

### 8.5 SEO / Open Graph
- All pages share the same `og:image` (`og-image.png`). Competitions and Ranked deserve dedicated OG images for social shares.
- `<title>` formats inconsistent (`Sign In | DartVoice` vs `Dashboard | DartVoice` vs `Enter Competition · DartVoice` vs `DartVoice — APK`). Standardise on `Page · DartVoice`.
- Sitemap probably missing competitions/competition pages (slug-based).
- Robots.txt should disallow `/admin`, `/creator-portal`, `/u.html`.

### 8.6 Analytics
- `G-DARTVOICE_PROD` is a placeholder — every page logs to a non-existent property. **No data is being collected.** Replace with the real GA4 ID, or remove the script tags until it's set.
- No conversion events: trial start, ticket purchase, first score, ambassador signup. Without these, you cannot reason about funnel drop-off.

---

## 9. Concrete next-step list (small → large)

### Within an hour:
1. Apply [migrations/025_competitions_payment_links.sql](../../migrations/025_competitions_payment_links.sql) to Supabase.
2. Delete `BILLING_URL` constant + drop from CSP in [competition.html](../../competition.html) and [dartvoice-dashboard.html](../../dartvoice-dashboard.html).
3. Replace `G-DARTVOICE_PROD` with real GA4 ID, or comment out the script tags.
4. Add `:focus-visible` global outline rule to [css/general/base.css](../../css/general/base.css).
5. Bump `--muted` colour from `#6E6E82` → `#8A8A9C`.

### Within a day:
6. Author `competitions/terms.html` (T&Cs + free postal entry route).
7. Pass `?quantity=N` to Stripe Payment Link from competition.html buy handler.
8. Add active-page highlight to [components/dv-nav.js](../../components/dv-nav.js).
9. Add OTP paste handler + resend rate-limit countdown to [login.html](../../login.html).
10. Add post-purchase success toast on `?paid=1` return.

### Within a week:
11. **Stripe webhook receiver** as Supabase Edge Function — both for subscriptions and competition tickets. Without it, competition payments effectively vanish.
12. **Server-side skill-question validation** — store correct answer in DB, randomise order client-side, validate on webhook before issuing ticket.
13. **Onboarding checklist widget** on dashboard (sign-in / download / guide / first score).
14. Replace Stripe popup pattern with full-page redirect.
15. Email-mismatch handler on OTP flow.

### Strategic (within a month):
16. Make landing-page CTA go *direct* to Stripe (skip login interstitial).
17. Realtime ticket-sold updates on competition.html.
18. "Auto-entry into every comp" Pro perk — both retention and acquisition lever.
19. Ambassador application form (replace `mailto:`).
20. Single design-token source (one CSS variables file consumed by every page) to end the apk-gate/competitions/etc. divergence.

---

## 10. What I did not look at (and you may want to)

- The Windows `.exe` calibration UX (Python desktop app — outside the web codebase).
- Email rendering in actual mail clients (templates in [emails/](../../emails/) look fine, but Outlook desktop is its own special hell).
- Supabase RLS policies (covered in [docs/tech/](../tech/)).
- The Chrome extension UX (separate audit warranted; it's the demo gateway).
