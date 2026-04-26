# DartVoice Documentation Index

Central documentation for the DartVoice ecosystem. Split into business/strategy and technical architecture.

> Last reviewed: April 2026. State of the world: `dartvoice.app` is live, the repo is private (GitHub Pro), release binaries are mirrored to Cloudflare R2, and current MRR is **£74**.

---

## 💼 Business & Staff Guides

1. [00_STAFF_GUIDE.md](./00_STAFF_GUIDE.md) — Onboarding intro for new team members. Read this first.
2. [01_GENERAL_OVERVIEW.md](./01_GENERAL_OVERVIEW.md) — Product, market problem, full feature breakdown.
3. [02_VALUE_PROPOSITION.md](./02_VALUE_PROPOSITION.md) — Five-pillar positioning and messaging.
4. [03_PAYMENT_AND_FUNNEL.md](./03_PAYMENT_AND_FUNNEL.md) — Pricing tiers, launch promo, acquisition funnel, OTP auth.
5. [04_ADVERTISING_AND_MARKETING.md](./04_ADVERTISING_AND_MARKETING.md) — Channels (creator outreach, social, SEO, ASO, paid).
6. [05_UI_ENGINEERING_GUIDE.md](./05_UI_ENGINEERING_GUIDE.md) — Design system; bridging Tailwind mockups to Python GUIs.
7. [06_FUTURE_VISION_AND_MMR.md](./06_FUTURE_VISION_AND_MMR.md) — Ranked mode + MMR roadmap.
8. [07_TEAM_COLLABORATION_GUIDE.md](./07_TEAM_COLLABORATION_GUIDE.md) — AI workflow, Git, role split, env management.
9. [08_GROWTH_AND_ROADMAP.md](./08_GROWTH_AND_ROADMAP.md) — **NEW.** Current MRR baseline, 90-day plan, 12-month roadmap, KPI targets.

## 🛠 Operations

- [REPO_AUDIT.md](./REPO_AUDIT.md) — **NEW.** Cleanup plan: orphan files to delete, migration-folder reconciliation, structural improvements, CI suggestions.
- [GOING-PRIVATE.md](./GOING-PRIVATE.md) — Already-executed migration: GitHub Releases → Cloudflare R2, repo private. Kept for reference.
- [INJECTOR.md](./INJECTOR.md) — Chrome-extension injector internals.

## 🧠 Technical Manuals (`tech/`)

1. [tech/00_TECH_STACK_EXPLAINER.md](./tech/00_TECH_STACK_EXPLAINER.md) — Languages, frameworks, third-party services.
2. [tech/01_ARCHITECTURE.md](./tech/01_ARCHITECTURE.md) — Audio → automated input pipeline.
3. [tech/02_WEB_AND_BILLING.md](./tech/02_WEB_AND_BILLING.md) — Static frontend, Stripe webhooks, OTP bridge.
4. [tech/03_CLIENT_APPS.md](./tech/03_CLIENT_APPS.md) — Windows (`customtkinter`), Android (Kivy), Chrome (MV3).
5. [tech/04_DEPLOYMENT_GUIDE.md](./tech/04_DEPLOYMENT_GUIDE.md) — `.exe` (PyInstaller), `.aab` (Buildozer), extension `.zip`.

## 🦸 Superpowers (`superpowers/`)

Internal experiments and superpower prompts. Not user-facing.

---

## How to keep these accurate

- Whenever a major feature ships (or is sunset), update [01_GENERAL_OVERVIEW.md](./01_GENERAL_OVERVIEW.md) and [README.md](../README.md).
- Whenever pricing changes, update [03_PAYMENT_AND_FUNNEL.md](./03_PAYMENT_AND_FUNNEL.md) **and** the relevant Stripe products/coupons.
- Whenever the marketing strategy shifts, update [04_ADVERTISING_AND_MARKETING.md](./04_ADVERTISING_AND_MARKETING.md) and [08_GROWTH_AND_ROADMAP.md](./08_GROWTH_AND_ROADMAP.md).
- The roadmap doc ([08](./08_GROWTH_AND_ROADMAP.md)) is the only document that should reference live numbers (MRR, install count, etc.). Other docs stay qualitative so they don't go stale.
