# DartVoice

Voice-controlled auto-scoring for darts. Players speak their score from the oche (`"one-forty"`, `"triple twenty"`, `"two marks on nineteen"`) and DartVoice subtracts, rotates, suggests checkouts, and pushes the input into whichever scoring app they already use.

This monorepo contains the entire DartVoice ecosystem: marketing site, dashboard, web scorer, transactional emails, the Windows desktop app, the Android app, the Chrome extension, the Supabase backend, and the outreach/admin tooling.

> Live: <https://dartvoice.app> · Repo: private (GitHub Pro)

---

## Architecture at a glance

```
┌──────────────────────┐   OTP / Stripe   ┌────────────────────────┐
│  dartvoice.app       │ ───────────────▶│  Supabase              │
│  (GitHub Pages)      │                  │  · Auth (email OTP)    │
│  · index.html etc.   │                  │  · Postgres + RLS      │
│  · web-app.html      │                  │  · Edge Functions      │
│  · dashboard         │◀─────────────────│  · Realtime            │
└──────────┬───────────┘                  └──────────┬─────────────┘
           │                                          │
           │ download                                 │ webhooks
           ▼                                          ▼
┌──────────────────────┐                  ┌────────────────────────┐
│  Cloudflare R2       │                  │  Stripe                │
│  · DartVoice.apk     │                  │  · Subscriptions       │
│  · DartVoice_Setup   │                  │  · Coupons / promos    │
│  releases.dartvoice. │                  └────────────────────────┘
│  app                 │
└──────────────────────┘

Clients
─ Windows desktop (autoscore/dartvoice_v2.py → DartVoice_Setup.exe)
─ Android app    (autoscore/main.py + buildozer → DartVoice.apk)
─ Chrome ext.    (chrome_extension/ → Web Store: DartVoice Launchpad)
```

### Hosting

| Layer | Where | Notes |
|---|---|---|
| Static site | **GitHub Pages**, custom domain `dartvoice.app` (see [CNAME](CNAME)) | Repo is **private** — works because of GitHub Pro. |
| Release binaries | **Cloudflare R2** bucket `dartvoice-releases`, public hostname `releases.dartvoice.app` | Dashboard download buttons fetch from R2, not GitHub Releases. CI uploads on every successful build. |
| Backend | **Supabase** project `poyjykgqsvgimssbhsuz` (DartVoice) | Auth, Postgres, Edge Functions, Realtime. |
| Payments | **Stripe** (account `Ochevault`) | Subscriptions + coupons. |
| Email | **Resend** via Supabase Edge Functions | All transactional mail from `@dartvoice.app`. |

---

## Top-level layout

```
index.html                  Marketing landing page (high-conversion funnel)
how-it-works.html           Product walkthrough
guide.html                  Setup + voice-command reference
login.html                  Email OTP entry
dartvoice-dashboard.html    Authenticated portal (downloads, account, ranked, referrals)
web-app.html / web-app-mobile.html
                            Browser-based scorer (used by the APK's WebView too)
admin.html / admin.js       Internal CRM (gated by admin_users table)
creator-portal.html         Public-facing creator landing pages
ranked.html / rankings.html Ranked mode landing + leaderboards
referral.html               Ambassador program

components/                 dv-nav.js, dv-footer.js (web components)
css/                        general/, components/, specific/
emails/                     Branded HTML email templates (Resend)
supabase/                   migrations/, functions/ (edge functions)
chrome_extension/           MV3 extension source + Web Store assets
autoscore/                  Windows + Android Python sources, build configs
outreach-server/            Long-running Node worker (creator email outreach)
billing_server/             Stripe-side helpers
scripts/, tools/            Build, deploy, and QA helpers
docs/                       All staff/business documentation (start here)
```

---

## Documentation

All product, business, and engineering docs live in [`docs/`](docs/). Start with [docs/INDEX.md](docs/INDEX.md).

The most useful entry points:

- [docs/00_STAFF_GUIDE.md](docs/00_STAFF_GUIDE.md) — onboarding for anyone new
- [docs/01_GENERAL_OVERVIEW.md](docs/01_GENERAL_OVERVIEW.md) — what the product does
- [docs/03_PAYMENT_AND_FUNNEL.md](docs/03_PAYMENT_AND_FUNNEL.md) — pricing, promos, billing
- [docs/04_ADVERTISING_AND_MARKETING.md](docs/04_ADVERTISING_AND_MARKETING.md) — channels & messaging
- [docs/08_GROWTH_AND_ROADMAP.md](docs/08_GROWTH_AND_ROADMAP.md) — current state, business plan, 12-month timeline
- [docs/GOING-PRIVATE.md](docs/GOING-PRIVATE.md) — repo-private + R2 release pipeline (already executed)

---

## Development

### Local preview

The site is plain static HTML — no build step.

```powershell
# from repo root
python -m http.server 8080
# then open http://localhost:8080
```

### Deploy

Push to the default branch. GitHub Pages publishes automatically. Custom domain is wired via [CNAME](CNAME).

### Release binaries

Triggered by the workflows in `.github/workflows/`:

- `build-windows.yml` — packages `dartvoice_v2.py` into `DartVoice_Setup.exe`, uploads to R2.
- `build-android.yml` — runs `buildozer` to produce `DartVoice.apk`, uploads to R2.
- `build-extension.yml` — zips the Chrome extension and uploads to R2.
- `seed-r2.yml` — one-shot helper used during the GitHub-Releases → R2 migration. See [docs/GOING-PRIVATE.md](docs/GOING-PRIVATE.md).

All workflows require the `CLOUDFLARE_API_TOKEN` repo secret.

### Backend

```powershell
# Supabase CLI (project ref: poyjykgqsvgimssbhsuz)
supabase functions deploy <name>
supabase db push
```

Edge functions live under [supabase/functions](supabase/functions). Migrations under [supabase/migrations](supabase/migrations).

### Chrome extension

```powershell
cd chrome_extension
# manual zip for Web Store upload
Compress-Archive * ..\dartvoice-launchpad.zip -Force
```

Live listing: <https://chromewebstore.google.com/detail/dartvoice-launchpad/igldnjophdpofihidpbblchgfamncpgb>

---

## Status snapshot — April 2026

| Area | State |
|---|---|
| Marketing site | ✅ Live on `dartvoice.app` |
| Stripe billing + webhooks | ✅ Live (monthly, 6-month, 12-month tiers) |
| Email lifecycle (Welcome, OTP, etc.) | ✅ Resend via Supabase |
| Windows desktop (`DartVoice_Setup.exe`) | ✅ Shipped (R2-hosted) |
| Android app (`DartVoice.apk`) | ✅ Shipped sideload (R2-hosted, gated by `apk-gate.html`) |
| Chrome extension | ✅ Published to Web Store |
| Repo private | ✅ Done (GH Pro) |
| Release mirror on R2 | ✅ Done |
| Creator outreach CRM (`admin.html`) | ✅ Live, internal-only |
| Ambassador / referral program | ✅ Live (£5 per converted referral) |
| Launch promo (`20% off`, `£6.99 → £5.59`) | 🟡 Active, temporary, currently being extended |
| Ranked mode (MMR) | 🟡 Plan in [`ranked_mode_implementation_plan.md`](ranked_mode_implementation_plan.md), partial schema, UI not yet shipped |
| Play Store submission (signed `.aab`) | ⬜ Pending |
| Code-signed Windows installer (EV cert) | ⬜ Pending — currently SmartScreen-warns |

---

## License & ownership

Proprietary. © DartVoice / Sharp Solutions.
