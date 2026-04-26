# DartVoice — Advertising & Marketing Strategy

*Internal Staff Document — Confidential. Last reviewed: April 2026.*

For the **dated** plan with quarterly milestones, MRR baseline, and KPI targets, see [08_GROWTH_AND_ROADMAP.md](./08_GROWTH_AND_ROADMAP.md). This document is the *evergreen* channel playbook.

---

## Target Audience

### Primary: Home Practice Players
- **Age:** 25–55
- **Geography:** UK (primary), Europe, North America, Australia/NZ
- Owns a dartboard at home (garage, spare room, man cave). Plays multiple practice sessions per week. Already uses a digital scoring app (Target Dart Counter, Nakka, DartConnect). Watches PDC.
- Frustrated by manual score entry. Aware of camera-based auto-scoring (Omni, Scolia) but won't pay £300–500+.
- Comfortable with subscription software (Netflix, Spotify). £5–7/month is a no-brainer for something used 3–7 times/week.

### Secondary: League & Pub Players
- Plays in BDO/WDF affiliates or pub leagues. Practices between matches. Often plays at multiple locations — portability matters.

### Tertiary: Content Creators & Streamers
- Darts YouTubers/TikTokers filming practice sessions or challenges. PiP + match recording = clean content.

---

## Marketing Channels — Ranked by Priority

### 1. 📱 Short-Form Social Video (TikTok, Reels, Shorts)

**Why #1:** the demo is inherently visual and shareable. A 15-second clip of someone throwing darts, speaking a score, and seeing it appear automatically generates reactions, saves, and shares — what these algorithms reward.

**Content angles:**
- **The Demo Hook** — 3-second hook → throw → say score → score appears. Clean, fast.
- **The Comparison** — split-screen manual scoring vs DartVoice. "Why are you still tapping?"
- **The 180 Moment** — film a 180 with DartVoice live; the "MAXIMUM 180" overlay is screenshot-worthy.
- **The Setup Tour** — "My £50/year auto-scoring setup vs a £500 camera ring".
- **The Checkout Clutch** — player follows DartVoice's checkout suggestion to close a leg.
- **Promo-driven hooks** — "20% off ends in 3 days" while `PROMO_20` is live.

**Cadence:** 4–5 pieces/week across TikTok + Reels. Repurpose every piece across both.

**Hashtags:** `#darts #dartspractice #501 #darttok #dartsetup #autoscoring #dartvoice #targetdartcounter #pdc`

---

### 2. 🎯 Darts Creator Partnerships (managed in-house)

**Why:** the darts community has a small but incredibly engaged influencer ecosystem. These creators have built deep trust with our exact audience. We run this **systematically** through the in-house CRM at `admin.html`:

1. YouTube Data API discovery surfaces darts channels by keyword/region/size.
2. Hunter.io enriches with email addresses.
3. Templated, personal-feeling outreach (see `Creator Outreach Email.html`).
4. Sequenced sends + retry handled by the `outreach-server` Node worker (claimed via `claim_outreach_job` RPC).
5. Status tracked: contacted → replied → onboarded → first post → conversion.

**Tiers:**

| Tier | Followers | Approach | Budget |
|---|---|---|---|
| Nano (1K–10K) | Hyper-engaged dart niche | Free sub + ambassador link | £0 (product only) |
| Micro (10K–50K) | Dart-focused channels | Product seeding + affiliate | £50–200/video |
| Mid (50K–200K) | Multi-sport with dart content | Sponsored integration | £200–500/video |
| Macro (200K+) | Major dart YouTubers | Full campaign partnership | £500–2000/video |

**Integration formats:**
- **"Setup tour"** — DartVoice naturally appears as part of their scoring workflow.
- **"First reaction"** — genuine on-camera reactions are the most shareable.
- **"Challenge"** — "Beat my 501 average using DartVoice" drives installs.
- **Review/comparison** — DartVoice alongside other auto-scoring solutions.

---

### 3. 🌐 SEO & Organic Search

#### On-page (already implemented)
- All public pages have correct `<title>`, `<meta description>`, OG, and Twitter cards.
- Heading hierarchy is clean. Semantic HTML5.
- `G-DARTVOICE_PROD` analytics on every public page.
- `robots.txt` and `sitemap.xml` configured.

#### Content (to build)
A `/blog` index targeting:
- "How to improve your darts average at home"
- "Best darts scoring app 2026"
- "Target Dart Counter tips and tricks"
- "Auto-scoring darts without a camera"
- "Voice control darts app review"

#### YouTube SEO
Every video uploaded with keyword-rich titles, descriptions, and tags. YouTube is the world's second-largest search engine.

#### Technical SEO
Static HTML (fast), HTTPS via GitHub Pages, mobile-responsive, R2 binaries served from `releases.dartvoice.app`.

---

### 4. 👥 Community Engagement

**Where:**
- Reddit: r/darts (200K+), r/dartscounter
- Facebook: "Darts Practice", "Home Dart Setups", "Target Dart Counter Users", regional league groups
- Forums: Darts Nutz, A180, Winmau forums
- Discord: growing darts servers

**Rules (non-negotiable):**
1. Never spam. Contribute first.
2. Product mentions are organic.
3. Run occasional AMAs ("I built a voice-controlled dart scorer — AMA").
4. Share user-generated DartVoice clips in relevant threads.
5. Respond to every mention of auto-scoring/voice with a helpful, non-pushy comment.

Getting banned from r/darts would be catastrophic — treat it accordingly.

---

### 5. 📧 Email Marketing (Post-Acquisition)

Templates exist in [`emails/`](../emails/). The full sequenced drips below are not yet wired in Resend — that's a **TODO**.

#### Onboarding Drip (Days 0–7 of trial)
| Day | Email | Purpose |
|---|---|---|
| 0 | Welcome | Greet, link to dashboard |
| 1 | Quick Start Guide | 3-step summary + setup link |
| 3 | "How's it going?" | Check in, FAQ link |
| 5 | Feature highlight | Showcase something they may not know |
| 6 | Trial ending tomorrow | Soft urgency |
| 7 | Trial expired | "Subscribe to keep throwing hands-free" |

#### Retention (paid subscribers)
- Monthly "session stats" digest *(requires backend aggregation)*.
- New-feature announcements when capabilities ship.
- Seasonal: "Winter practice season — upgrade to yearly, save 28%".

#### Win-Back (cancelled)
- Day 3: "We miss you at the oche."
- Day 14: "Here's what's new since you left."
- Day 30: re-activation offer (e.g., 50% off first month).

---

### 6. 🏆 Ambassador & Referral Program

- Every subscriber gets a unique referral link from their dashboard (`referral.html`).
- Referred friend gets the standard 7-day free trial (no special deviation — consistent onboarding).
- Conversion = **£5 cash via PayPal** to the ambassador. No cap.
- Real-time tracking dashboard.
- Minimum payout: £5 (one referral).

**Amplification:**
- Encourage shares in darts WhatsApp groups, Facebook groups, league chats.
- Provide pre-made shareable assets (images, short clips, copy templates) — the `prototypes/social-media-gen.html` file is the source for these.
- Feature top ambassadors monthly with their permission.

---

### 7. 🛍 App Store Optimisation

**Chrome Web Store** (live):
- Listing: "DartVoice Launchpad — Voice Auto-Scorer for Darts"
- Screenshots show extension in action alongside DartCounter
- Detailed description covers supported game modes and offline functionality
- Source: [`chrome_extension/CHROME_WEB_STORE_LISTING.md`](../chrome_extension/CHROME_WEB_STORE_LISTING.md)

**Google Play** (pending submission of signed `.aab`):
- Title: "DartVoice — Voice-Controlled Darts Auto-Scorer"
- Description: voice darts, auto scorer, Target Dart Counter, 501, Cricket, hands-free
- Screenshots: listening state, score display, checkouts, calibration
- Encourage 5-star reviews from trial users who activate successfully

---

### 8. 💰 Paid Advertising (Phase 2)

Held intentionally until organic validates messaging. Infrastructure is ready (`gtag.js` audiences exist).

**Google Ads:** search → "dart scorer app", "auto dart scorer", "voice scoring darts", "Target Dart Counter voice". Display retargeting via the GA audience.

**Meta Ads:** video using best-performing organic Reels. Custom audience = website visitors. Lookalike from converted subscribers.

**TikTok Ads:** Spark Ads boosting top-performing organic. Targeting: sports/dart interest.

**Budget guidance:**
- Phase 1 (now → product-market-fit): £0 — organic only
- Phase 2 (scaling): £500–1000/mo test across Google + Meta
- Phase 3 (growth): scale winners, kill losers. Target **CAC < £15**, **LTV:CAC > 4:1**.

---

## Key Metrics to Track

| Metric | What it tells us | Target |
|---|---|---|
| Website → Trial conversion | Is the landing page compelling? | >3% |
| Trial → Paid conversion | Is the product sticky during trial? | >25% |
| Monthly churn | Are we retaining? | <8% |
| CAC | What does each new sub cost? | <£15 |
| LTV | How much does an avg sub generate? | >£60 |
| LTV:CAC | Is growth sustainable? | >4:1 |
| Referral rate | Are users telling friends? | >15% of users |
| NPS | Would users recommend? | >50 |

For *current* values vs these targets, see the latest snapshot in [08_GROWTH_AND_ROADMAP.md](./08_GROWTH_AND_ROADMAP.md).

---

## Messaging Pillars

Every piece of marketing content must ladder to one of these:

1. **"Always in your pocket."** — No hardware. Just your phone.
2. **"Just say your score."** — Zero learning curve. Natural darts language.
3. **"Works with your scorer."** — Not a replacement. A companion.
4. **"From £5/month."** — 100x cheaper than camera systems.
5. **"Try it free."** — 7-day trial, cancel anytime, zero risk.

---

## What Not To Do

- ❌ Don't trash competitors publicly. Position DartVoice as the affordable, portable *alternative* — not the "better" product.
- ❌ Don't over-promise accuracy. Voice recognition is excellent but not perfect.
- ❌ Don't spam darts communities. Contribute first, mention product second.
- ❌ Don't use stock photography. All visuals are real screenshots, real setups, or our CSS-rendered mockups.
- ❌ Don't ignore support requests. In a niche community, one bad experience travels fast — respond within 24 hours.
- ❌ Don't bake the launch promo (`PROMO_20`) into permanent assets. It's a lever; the floor price is £6.99/mo.
