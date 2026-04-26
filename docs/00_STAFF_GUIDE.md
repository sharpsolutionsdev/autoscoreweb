# DartVoice — Internal Staff Guide

*Internal Staff Document — Confidential. Last reviewed: April 2026.*

Welcome. This is the top-level orientation for anyone joining the DartVoice team. Read this first, then drill down into the linked documents as needed.

---

## 1. What DartVoice is

DartVoice is a voice-controlled auto-scoring system for darts. The player throws three darts, calls the score from the oche, and DartVoice subtracts, rotates, suggests checkouts, and feeds the input into whichever scoring app they already use.

It exists as a multi-platform ecosystem on top of a Supabase backend:

- **Windows desktop** — `DartVoice_Setup.exe`, runs offline via Vosk
- **Android app** — `DartVoice.apk`, currently sideload-only (Play Store submission pending)
- **Chrome extension** — `DartVoice Launchpad` on the Web Store, MV3
- **Web scorer** — `web-app.html` and `web-app-mobile.html` for browser-only flows
- **Marketing + dashboard** — `dartvoice.app` (this repo, GitHub Pages, private repo via GH Pro)

Full feature list: [01_GENERAL_OVERVIEW.md](./01_GENERAL_OVERVIEW.md).

## 2. The pitch (memorise this)

> "DartVoice lets you score your darts games with your voice — hands-free, on any board, from the phone in your pocket. No camera, no special board, no £500 hardware. From £5/month, 7-day free trial."

Five pillars that ladder under that pitch: [02_VALUE_PROPOSITION.md](./02_VALUE_PROPOSITION.md).

## 3. How we make money

Pure SaaS subscription via Stripe.

| Plan | Price | Effective monthly |
|---|---|---|
| Monthly | £6.99/mo | £6.99 |
| 6-month ⭐ | £34.99 | £5.83 |
| 12-month 💚 | £59.99 | £5.00 |

A 7-day free trial precedes every plan. A 10-minute ungated demo precedes the trial (no signup, no card).

A **temporary launch promo** (`PROMO_20`, 20% off) is currently active and being extended manually. Treat it as a marketing lever, not the floor price.

Full billing detail: [03_PAYMENT_AND_FUNNEL.md](./03_PAYMENT_AND_FUNNEL.md).

## 4. How we acquire customers

In rough priority order:

1. **Short-form video** (TikTok / Reels / Shorts) — the demo is inherently shareable
2. **Creator partnerships** — managed via the in-house CRM at [`admin.html`](../admin.html), gated by the `admin_users` table
3. **SEO** — long-tail darts queries
4. **Reddit / Facebook darts groups** — genuine engagement, never spam
5. **Ambassador / referral program** — £5/conversion, no cap
6. **Chrome Web Store + Play Store** — passive ASO once Play submission is in
7. **Paid ads** — held until organic validates

Detail: [04_ADVERTISING_AND_MARKETING.md](./04_ADVERTISING_AND_MARKETING.md).

## 5. Where the code lives

| Concern | Path |
|---|---|
| Marketing site, dashboard, web scorer | repo root (`*.html`) |
| Reusable web components | [`components/`](../components/) |
| CSS | [`css/`](../css/) |
| Email templates | [`emails/`](../emails/) |
| Windows + Android sources | [`autoscore/`](../autoscore/) |
| Chrome extension | [`chrome_extension/`](../chrome_extension/) |
| Supabase migrations + edge functions | [`supabase/`](../supabase/) |
| Outreach worker (Node, runs on PM2) | [`outreach-server/`](../outreach-server/) |
| Build/deploy/QA helpers | [`scripts/`](../scripts/), [`tools/`](../tools/) |
| Documentation (you are here) | [`docs/`](.) |

## 6. Stuff worth knowing

- **Repo is private** but the marketing site is public. GitHub Pages still works because of GitHub Pro.
- **Release binaries** (`.apk`, `.exe`) live in Cloudflare R2 (`releases.dartvoice.app`), not GitHub Releases. CI uploads on every successful build. See [GOING-PRIVATE.md](./GOING-PRIVATE.md).
- **Auth is passwordless OTP** for everything: dashboard, web scorer, desktop client, APK, extension. One email = one identity.
- **No password database**. We never see card details (Stripe). We never store voice (all on-device).
- **Current MRR: £74.** That's the baseline we're growing from. See [08_GROWTH_AND_ROADMAP.md](./08_GROWTH_AND_ROADMAP.md).
- **Brand voice**: confident, technical, never trash competitors. Target Omni and Scolia are great products; we're the affordable, portable alternative.

## 7. Engineering norms

- AI-assisted development is the default. See [07_TEAM_COLLABORATION_GUIDE.md](./07_TEAM_COLLABORATION_GUIDE.md).
- Static HTML + Tailwind CDN + vanilla JS for the public site. No build step. No framework lock-in.
- Backend logic goes in Supabase Edge Functions (Deno/TS) — not random Node servers — unless there's a reason (the outreach worker is one such reason).
- Migrations are numbered and live in [`supabase/migrations/`](../supabase/migrations/).
- UI changes follow the design system in [05_UI_ENGINEERING_GUIDE.md](./05_UI_ENGINEERING_GUIDE.md).

## 8. Where to go next

- Building a feature? Start with [07_TEAM_COLLABORATION_GUIDE.md](./07_TEAM_COLLABORATION_GUIDE.md).
- Pitching a partner / writing copy? Start with [02_VALUE_PROPOSITION.md](./02_VALUE_PROPOSITION.md) and [04_ADVERTISING_AND_MARKETING.md](./04_ADVERTISING_AND_MARKETING.md).
- Thinking about the next 90 days? Read [08_GROWTH_AND_ROADMAP.md](./08_GROWTH_AND_ROADMAP.md).
- Adding ranked mode UI? Read [06_FUTURE_VISION_AND_MMR.md](./06_FUTURE_VISION_AND_MMR.md) and [`ranked_mode_implementation_plan.md`](../ranked_mode_implementation_plan.md).
