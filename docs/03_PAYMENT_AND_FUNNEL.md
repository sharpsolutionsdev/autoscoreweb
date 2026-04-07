# DartVoice — Payment System & Customer Acquisition Funnel

*Internal Staff Document — Confidential*

---

## Payment & Monetization Model

DartVoice operates on a **Software-as-a-Service (SaaS) subscription model**. All payment processing, card handling, PCI compliance, and billing infrastructure is handled entirely by **Stripe** — the industry-standard payments platform.

### Pricing Tiers

| Plan | Price | Effective Monthly | Savings vs Monthly | Billing Cycle |
|---|---|---|---|---|
| **Monthly** | £6.99/mo | £6.99 | — | Billed monthly |
| **6-Month** ⭐ Most Popular | £34.99/6mo | £5.83 | 17% (saves £6.95) | Billed every 6 months |
| **12-Month** 💚 Best Value | £59.99/yr | £5.00 | 28% (saves £23.89) | Billed every 12 months |

**All plans include:**
- 7-day free trial (cancel before day 7 to pay nothing)
- Full voice-controlled scoring
- All platforms (Windows, Android, Chrome Extension)
- All game modes (501, 301, Cricket, Round the Board, 121, practice)
- Live checkout suggestions
- All future updates and new features

### Free Trial Structure

Every subscription starts with a **7-day free trial**. Additionally, before the trial even begins, users get a **10-minute instant demo** — no account, no card. This lets them hear DartVoice process their voice and feel the product before any commitment.

**Trial flow:**
1. 10-minute ungated demo (instant, no signup)
2. Sign up with email → 7-day free trial begins
3. After 7 days → billing starts automatically unless cancelled
4. Cancel anytime from the dashboard — instant, no questions asked

### How Payment Processing Works

1. **Checkout:** Stripe payment links are embedded directly on the DartVoice marketing website (`index.html`) and guide page. Users click "Start Free Trial" and are redirected to a `buy.stripe.com` hosted checkout page.
2. **Card Capture:** Stripe securely captures the user's card details. DartVoice never sees, stores, or handles any payment card information. We are fully PCI-compliant by delegation.
3. **Subscription Created:** Stripe fires a webhook event (`customer.subscription.created`) to our backend API, which provisions the user account.
4. **Recurring Billing:** Stripe automatically handles recurring charges based on the selected billing cycle. No manual intervention needed.
5. **Failed Payments:** Stripe's Smart Retries system automatically retries failed charges using ML-optimised timing. If the payment ultimately fails, a branded "Payment Failed" email is dispatched.
6. **Cancellation:** Users cancel from their DartVoice dashboard. Stripe immediately flags the subscription as `cancel_at_period_end`, allowing the user to retain access until their current paid period expires.

### Accepted Payment Methods
- Visa
- Mastercard
- American Express
- All standard Stripe-supported card networks

### Competitor Pricing Context

For internal reference, our pricing is positioned dramatically below any competitor offering auto-scoring:

| Competitor | Model | Cost |
|---|---|---|
| Target Omni | One-time hardware purchase | ~£500+ |
| Scolia | Hardware + optional sub | ~£300+ |
| Gran Board | Proprietary e-board | ~£200+ |
| **DartVoice** | **Software subscription** | **From £5/month** |

This is not a comparison we make aggressively on the website (we avoid naming competitors directly), but internally it's important context for positioning conversations.

---

## Customer Acquisition Funnel

The DartVoice funnel is designed to be **short, low-friction, and high-trust**. The fewer steps between curiosity and first use, the higher our conversion rate.

### Funnel Visualisation

```
┌─────────────────────────────────────────────────────────────┐
│                    🌍 AWARENESS                             │
│  Social media (TikTok/Reels/YouTube) · SEO · Word of mouth │
│  Darts forums · Reddit r/darts · Facebook dart groups       │
│  Ambassador referral links · App store discovery             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    👀 CONSIDERATION                         │
│  User lands on dartvoice.com (index.html)                   │
│  Premium dark-mode landing page with:                       │
│   • Animated device mockups (phone + laptop)                │
│   • Feature cards with live visual demos                    │
│   • Competitor pricing comparison (vs Target Omni)          │
│   • Social proof, FAQ, and clear CTAs                       │
│   • 10-minute free demo (no signup needed)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   💳 CONVERSION                             │
│  User clicks "Start Free Trial"                             │
│  → Redirected to Stripe hosted checkout                     │
│  → Enters email + card (trial is free for 7 days)           │
│  → Subscription created, account provisioned                │
│  → Branded "Welcome" email sent immediately                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   📥 ONBOARDING                             │
│  User logs into DartVoice Dashboard                         │
│  → Passwordless OTP (One-Time Password) via email           │
│  → Downloads the correct client:                            │
│     • Windows: DartVoice.exe installer                      │
│     • Android: APK direct download                          │
│     • Chrome: Extension via Chrome Web Store                │
│  → Follows the Setup Guide (guide.html)                     │
│  → Completes X01 and/or Cricket Calibration                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   🎯 ACTIVATION                             │
│  First successful voice-scored game                         │
│  This is the "magic moment" — the point where the user      │
│  experiences the value proposition firsthand.                │
│  If they reach this point, retention is very high.           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   🔄 RETENTION & EXPANSION                  │
│  User continues playing sessions with DartVoice             │
│  → Session averages tracked over time                       │
│  → Checkout suggestions improve their game                  │
│  → Habit formed: DartVoice is part of every session         │
│  → User upgrades to 6-month or 12-month plan                │
│  → User joins Ambassador Program                            │
│  → User refers mates via referral link                      │
└─────────────────────────────────────────────────────────────┘
```

### Funnel Stage Details

#### Stage 1: Awareness
**Goal:** Get the right eyes on DartVoice.

**Channels:**
- **Organic Social:** Short-form video clips on TikTok, Instagram Reels, and YouTube Shorts showing voice scoring in action. The visual of someone throwing darts and a score appearing automatically is inherently shareable.
- **SEO:** Targeting high-intent long-tail keywords: "voice dart scorer", "auto dart scorer app", "hands-free darts", "Target Dart Counter voice control".
- **Community:** Engagement in Reddit r/darts, Facebook dart groups, and dart league forums. Not spam — genuine participation with organic product mentions.
- **Ambassador / Referral:** Active subscribers share their unique referral link. Referred friends get a 30-day trial (vs standard 7-day), creating a strong incentive for the friend to try it.

#### Stage 2: Consideration
**Goal:** Build instant trust and demonstrate clear value.

The `index.html` landing page is engineered as a **high-conversion sales funnel**:
- **Hero section:** Animated phone + laptop mockup showing DartVoice in action. Immediate visual proof.
- **Scrolling ticker:** "TARGET DART COUNTER COMPATIBLE · 501 · CRICKET · OFFLINE MODE · HANDS-FREE SCORING" — builds feature awareness passively.
- **Feature cards:** 6 interactive cards with live visual demos (animated waveforms, score subtraction, offline status, etc.).
- **Pro Capabilities (Deep Dive):** Bento grid showcasing advanced features — natural language parsing, dynamic checkouts, companion pop-up, game modes, match recording, custom themes.
- **3-step "How It Works":** Sign Up → Download → Throw & Call. Under 2 minutes.
- **Competitor comparison:** Side-by-side Target Omni (£500, hardware required) vs DartVoice (from £5/mo, uses your phone mic).
- **3 pricing tiers:** Clearly differentiated with "Most Popular" and "Best Value" badges.
- **FAQ:** Addressing top objections (offline capability, multi-device, trial terms).

#### Stage 3: Conversion
**Goal:** Zero-friction checkout.

- Single CTA across the page: **"Start Free Trial"**.
- Links directly to Stripe's hosted checkout. No intermediary forms, no account creation step, no CAPTCHA.
- The email used at Stripe checkout **becomes the user's DartVoice account**. One email = one identity across all platforms.
- The user does not need to create a password. Authentication is strictly OTP-based.

#### Stage 4: Onboarding
**Goal:** Get the user from purchase to first scored game as fast as possible.

**Critical path:**
1. User receives "Welcome" email with dashboard link
2. User goes to `dartvoice-dashboard.html`
3. Enters their email → receives OTP → authenticated
4. Downloads the correct client for their platform
5. Opens `guide.html` and follows the calibration walkthrough
6. Completes calibration (X01 and/or Cricket)
7. Throws their first voice-scored visit

**Target time from purchase to first scored visit: under 5 minutes.**

The calibration step is the **highest-risk drop-off point** in the funnel. If a user struggles with calibration, they may not return. This is why the guide page (`guide.html`) is exhaustively detailed with step-by-step visual instructions.

#### Stage 5: Activation & Retention
**Goal:** Form a habit. Make DartVoice inseparable from the darts session.

Once a player successfully completes their first session — typically 3–5 legs of 501 — the product value is self-evident. The key retention drivers are:
- **Session averages:** Players become invested in tracking their improvement over time.
- **Checkout suggestions:** Players start relying on DartVoice for finish routes they wouldn't have calculated themselves.
- **Reduced session time:** Players finish the same number of legs in 20–30% less time.
- **The "always ready" factor:** Because it's on their phone, they use it every single time they throw — not just when they're at their dedicated setup.

#### Stage 6: Expansion
**Goal:** Upgrade plan, refer friends, become an ambassador.

- Users on Monthly are prompted (gently, via email) to upgrade to 6-Month (save 17%) or 12-Month (save 28%).
- The **Ambassador Program** offers £5 cash via PayPal for every referred friend who converts to a paying subscriber. No cap.
- Referred friends receive a 30-day free trial (vs standard 7-day), which is a powerful incentive.
- Ambassador dashboard tracks clicks, conversions, and pending payouts in real-time.

---

## Authentication System

DartVoice uses a **passwordless OTP (One-Time Password)** system:

1. User enters their email (the one used at Stripe checkout) into the client or dashboard.
2. Backend verifies the email has an active Stripe subscription.
3. If valid, a 6-digit OTP is sent to that email address.
4. User enters the OTP into the client.
5. Session is authenticated. The user can now use the software.

**Why passwordless?**
- Eliminates forgotten password support tickets (a massive cost for SaaS).
- No password database to secure (reduces breach risk to near-zero).
- Feels modern and premium — similar to how Slack, Notion, and WhatsApp Web handle auth.
- Reduces friction at onboarding — the user already has their email open from the purchase confirmation.

---

## Email Lifecycle

7 custom-designed, fully branded HTML email templates handle the complete customer lifecycle:

| Email | Trigger | Purpose |
|---|---|---|
| **Welcome** | Subscription created | Greet, set expectations, link to dashboard |
| **OTP Code** | Login requested | Deliver the 6-digit authentication code |
| **Payment Failed** | Stripe charge fails | Alert user, provide payment update link |
| **Subscription Active** | Trial converts or renewal | Confirm active status |
| **Referral Invite** | User shares referral | Invite email to the referred friend |
| **Referral Payout** | Referral converts | Notify ambassador of cash earned |
| **Cancelled** | Subscription cancelled | Confirm, leave door open for return |

All emails maintain strict visual continuity with the DartVoice brand: dark backgrounds, red accents, premium typography.
