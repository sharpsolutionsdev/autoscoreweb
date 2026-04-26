# DartVoice — Payment System & Customer Acquisition Funnel

*Internal Staff Document — Confidential. Last reviewed: April 2026.*

---

## Payment & Monetization Model

DartVoice operates on a **Software-as-a-Service (SaaS) subscription model**. All payment processing, card handling, PCI compliance, and billing infrastructure is handled entirely by **Stripe** (account: `Ochevault`, `acct_1TCX9k1fLbzv9c0H`).

### Pricing Tiers

| Plan | Price | Effective Monthly | Savings vs Monthly | Billing Cycle |
|---|---|---|---|---|
| **Monthly** | £6.99/mo | £6.99 | — | Billed monthly |
| **6-Month** ⭐ Most Popular | £34.99/6mo | £5.83 | 17% (saves £6.95) | Billed every 6 months |
| **12-Month** 💚 Best Value | £59.99/yr | £5.00 | 28% (saves £23.89) | Billed every 12 months |

**All plans include:**
- 7-day free trial (cancel before day 7 to pay nothing)
- Full voice-controlled scoring on Windows, Android, and the Chrome extension
- Web scorer (`web-app.html`) for browser-only flows
- All game modes (501, 301, Cricket, Round the Board, 121, practice)
- Live checkout suggestions
- All future updates and new features
- Ambassador / referral access (earn £5 per converted referral)

### Active launch promo

`PROMO_20` — **20% off any plan**. Brings monthly down to £5.59/mo, 6-month to £27.99, 12-month to £47.99. Currently runs for a few more days and is being **extended manually**, *not* set as a permanent price. It is a top-of-funnel lever and an ambassador-pitch tool, not a baseline.

When the promo is extended, the welcome modal (`dv-welcome.js`) and any landing-page banners must be updated with the new countdown.

### Free Trial Structure

Every subscription starts with a **7-day free trial**. Before the trial begins, users get a **10-minute instant demo** in the web app and Chrome extension — no account, no card.

**Trial flow:**
1. 10-minute ungated demo (instant, no signup)
2. Sign up with email → 7-day free trial begins
3. After 7 days → billing starts automatically unless cancelled
4. Cancel anytime from the dashboard — instant, no questions asked

### How Payment Processing Works

1. **Checkout:** Stripe payment links are embedded on the marketing site (`index.html`) and dashboard. Users click "Start Free Trial" and land on a `buy.stripe.com` hosted checkout.
2. **Card Capture:** Stripe captures card details. DartVoice never sees, stores, or handles any payment card information.
3. **Subscription Created:** Stripe fires `customer.subscription.created` to our `stripe-webhook` Supabase Edge Function, which provisions the user account.
4. **Recurring Billing:** Stripe handles recurring charges automatically.
5. **Failed Payments:** Stripe Smart Retries first, then a branded "Payment Failed" email via Resend.
6. **Cancellation:** Users cancel from the DartVoice dashboard. Stripe flags the subscription as `cancel_at_period_end`; the user retains access until the paid period expires.

### Accepted Payment Methods
- Visa, Mastercard, American Express, and all standard Stripe-supported networks.

### Competitor Pricing Context (internal only)

| Competitor | Model | Cost |
|---|---|---|
| Target Omni | One-time hardware purchase | ~£500+ |
| Scolia | Hardware + optional sub | ~£300+ |
| Gran Board | Proprietary e-board | ~£200+ |
| **DartVoice** | **Software subscription** | **From £5/month** |

We never name competitors aggressively in marketing.

---

## Release Distribution

Subscribers download the platform clients from the dashboard. Binaries are served from **Cloudflare R2** under the public hostname `releases.dartvoice.app` (CI uploads on every successful build):

- `https://releases.dartvoice.app/DartVoice_Setup.exe`
- `https://releases.dartvoice.app/DartVoice.apk`

The APK is gated by `apk-gate.html` — only authenticated subscribers (or trial users) can pull it. The Chrome extension is installed from the Web Store.

---

## Customer Acquisition Funnel

The DartVoice funnel is **short, low-friction, and high-trust**. Fewer steps between curiosity and first use = higher conversion.

```
🌍 AWARENESS         Social (TikTok / Reels / Shorts) · SEO · word of mouth
                     Reddit r/darts · Facebook groups · ambassador links
        │
        ▼
👀 CONSIDERATION    dartvoice.app — animated demos, feature cards,
                    Omni vs DartVoice comparison, FAQ, 10-min free demo
        │
        ▼
💳 CONVERSION       Stripe hosted checkout → 7-day trial begins → welcome email
        │
        ▼
📥 ONBOARDING       Dashboard OTP login → download client → guide.html
                    → calibration (highest drop-off risk)
        │
        ▼
🎯 ACTIVATION       First voice-scored game = the magic moment
        │
        ▼
🔄 RETENTION        Session averages, checkout suggestions, ambassador
                    upsell, monthly → annual upgrade
```

### Funnel Stage Details

#### Stage 1: Awareness
- **Organic social:** Short-form video on TikTok, Reels, Shorts. The visual of someone throwing darts and a score appearing automatically is inherently shareable.
- **SEO:** "voice dart scorer", "auto dart scorer app", "hands-free darts", "Target Dart Counter voice".
- **Community:** Reddit r/darts, Facebook dart groups, dart league forums. Genuine engagement, never spam.
- **Ambassador / Referral:** Active subscribers share their unique link. Referred friends get the standard 7-day trial. Ambassador earns £5 cash on conversion.
- **Creator partnerships:** Managed via the in-house CRM (`admin.html`) — pipelines YouTube discovery → Hunter.io email lookup → templated outreach via the `outreach-server` worker.

#### Stage 2: Consideration
The `index.html` landing page is engineered as a high-conversion funnel:
- **Hero:** Animated phone + laptop mockups
- **Scrolling ticker:** Compatibility/feature awareness
- **Feature cards:** 6 interactive cards with live visual demos
- **Pro Capabilities bento grid:** Natural language parsing, dynamic checkouts, companion pop-up, modes, recording, themes
- **3-step "How It Works"**
- **Competitor comparison block:** Omni vs DartVoice
- **3 pricing tiers:** with "Most Popular" / "Best Value" badges
- **FAQ:** Offline, multi-device, trial terms

#### Stage 3: Conversion
- Single CTA: **"Start Free Trial"** → Stripe hosted checkout.
- The email used at checkout becomes the user's DartVoice identity. No password.
- The launch promo (when active) is auto-applied via the URL param or a coupon code.

#### Stage 4: Onboarding
1. Welcome email arrives instantly (Resend → `send-dartvoice-email`)
2. User opens `dartvoice-dashboard.html`
3. Email → OTP → authenticated
4. Downloads the correct client from R2 (or Chrome Web Store)
5. Follows `guide.html` for calibration
6. Throws their first voice-scored visit

**Target time from purchase to first scored visit: under 5 minutes.** Calibration is the highest-risk drop-off — `guide.html` is exhaustively detailed because of this.

#### Stage 5: Activation & Retention
Key retention drivers:
- Session averages tracked over time
- Checkout suggestions players come to rely on
- Reduced session time (~20–30%)
- The "always ready" factor — DartVoice is on the phone they already carry

#### Stage 6: Expansion
- Email nudges from monthly → 6-month / 12-month
- Ambassador program: £5 per converted referral, no cap, real-time dashboard
- Referred friends get the standard 7-day trial (no deviation — keeps onboarding consistent)

---

## Authentication System

Passwordless **OTP**, end-to-end:

1. User enters their email (the one used at Stripe checkout).
2. Backend (Supabase Auth → Resend) verifies the email has an active subscription.
3. If valid, a 6-digit OTP is sent.
4. User enters the OTP into the client (web, desktop, APK, or extension).
5. Session is authenticated.

**Why passwordless:**
- Zero forgotten-password support tickets.
- No password database to secure.
- Feels modern (Slack, Notion, WhatsApp Web).
- Lowest possible onboarding friction — the user already has their email open from the purchase confirmation.

---

## Email Lifecycle

7 custom-designed branded HTML templates handle the full lifecycle, sent through Resend via Supabase Edge Functions:

| Email | Trigger | Purpose |
|---|---|---|
| Welcome | Subscription created | Greet, set expectations, link to dashboard |
| OTP Code | Login requested | Deliver the 6-digit auth code |
| Payment Failed | Stripe charge fails | Alert user, payment-update link |
| Subscription Active | Trial converts or renewal | Confirm |
| Referral Invite | Ambassador shares | Invite the referred friend |
| Referral Payout | Referral converts | Notify ambassador of cash earned |
| Cancelled | Subscription cancelled | Confirm, leave the door open |

Templates: [`emails/`](../emails/). All sent from `@dartvoice.app`.
