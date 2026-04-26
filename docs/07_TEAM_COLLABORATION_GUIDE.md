# Team Collaboration & Development Workflow

*Internal Staff Document — Confidential. Last reviewed: April 2026.*

DartVoice is moving from a solo-founder prototype to a small collaborative engineering effort. Standardising how we develop, use AI, and split responsibilities is critical to keep momentum without code conflicts.

---

## 1. Repo & hosting facts (read first)

- **Repository:** private (GitHub Pro). The marketing site at `dartvoice.app` is **public** because GH Pro keeps Pages enabled on private repos.
- **Default branch:** the branch you deploy from. Pushes auto-deploy to GitHub Pages.
- **Custom domain:** [`CNAME`](../CNAME) → `dartvoice.app`.
- **Release binaries** live in **Cloudflare R2**, not in the repo and not in GitHub Releases. CI uploads on every successful build (see [`docs/GOING-PRIVATE.md`](./GOING-PRIVATE.md)).
- **Backend** is **Supabase** (project ref `poyjykgqsvgimssbhsuz`). Migrations and edge functions live under [`supabase/`](../supabase/).
- **Payments** are **Stripe** (account `Ochevault`).

If you're new to the repo, read [00_STAFF_GUIDE.md](./00_STAFF_GUIDE.md) before touching code.

---

## 2. AI-assisted development (the default)

DartVoice was built alongside AI from day one. Continue that.

- **AI-native IDEs:** Cursor, GitHub Copilot Agent / Chat, Gemini Code Assist, Claude Code. They can see the whole workspace and reason across `dartvoice_v2.py`, `web-app.html`, and `supabase/functions/*` simultaneously.
- **The core workflow:** never ask an AI to "build a feature" blindly. Provide a static HTML prototype (e.g., a section of `web-app.html` or a screenshot from `prototypes/`) and ask the AI to translate the UI into Python/JavaScript using the conventions in [05_UI_ENGINEERING_GUIDE.md](./05_UI_ENGINEERING_GUIDE.md).
- **Modular prompts:** one feature at a time. Prototype the visual design in HTML/Tailwind first, then have the AI translate.
- **Repo memory:** when the agent learns a pattern, capture it in `/memories/repo/` so it survives across sessions.

---

## 3. Git hygiene

- **Never push directly to the default branch.** Even solo, use feature branches (`git checkout -b feat/ranked-queue`).
- **Pull requests** for review, even self-review. PRs make the change history readable later.
- **Conventional-ish commits** preferred: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`. Don't be religious about it — readability is the goal.
- **Don't `--force` push** shared branches. If you need to rewrite history, do it on a feature branch only.
- **Don't `--no-verify`** to skip pre-commit hooks. Fix the lint, don't dodge it.

---

## 4. Environments & secrets

| Place | What lives there |
|---|---|
| `.env.local` (gitignored) | Local Stripe test keys, Supabase service role for scripts |
| GitHub Actions secrets | `CLOUDFLARE_API_TOKEN`, `SUPABASE_SERVICE_ROLE`, `STRIPE_LIVE_SECRET_KEY`, `RESEND_API_KEY` |
| Supabase project settings | Production env vars used by edge functions |
| Stripe Dashboard | Live mode + test mode toggle. Webhooks point to the `stripe-webhook` edge function |

**Never** commit a key. Rotate immediately if one slips. Share keys via a password manager (1Password, Bitwarden) — never DM/Slack/email.

---

## 5. Python / Node environments

### Python (autoscore / scripts)
```powershell
cd autoscore
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements_windows.txt
```

For the Android build, follow [`autoscore/SETUP.md`](../autoscore/SETUP.md).

### Node (outreach worker, tools)
```powershell
cd outreach-server
npm install
npm run dev    # local
pm2 restart outreach   # on the prod box
```

`tools/` and `scripts/` are mostly stand-alone scripts; check the file's header comment before running.

---

## 6. Role split (founder + collaborator)

When a backend collaborator joins, draw the line **strictly** to avoid stomping on each other.

### Founder & front-end architect
- Visual flow, marketing site, dashboard, web scorer, in-app UX
- Tailwind/HTML prototypes; AI translation into the desktop/Android GUIs
- Product vision, copy, pricing positioning, marketing campaigns
- Owner of [`docs/`](.)

### Backend & systems engineer
- Supabase schema, migrations, RLS, edge functions
- Stripe webhooks, OTP bridge, subscription state machine
- Outreach worker (`outreach-server/`)
- Core algorithms: PyAutoGUI calibration math, Vosk threading, anti-cheat heuristics
- CI/CD workflows (`.github/workflows/`) and the R2 release pipeline

### Shared
- `chrome_extension/` (UX is founder, MV3 plumbing is engineer)
- Anything in `supabase/migrations/` requires both eyes before merging

---

## 7. Adding a new feature — the playbook

1. **Prototype visually** — sketch the UI as a Tailwind block in a scratch HTML file or in `prototypes/`.
2. **Write the migration first** if data is involved. Number it sequentially in [`supabase/migrations/`](../supabase/migrations/).
3. **Edge function next** if there's server logic. Test with `supabase functions serve`.
4. **Wire the UI** into `web-app.html` / `dartvoice-dashboard.html` / etc. Reuse the components in [`components/`](../components/).
5. **Run the relevant smoke test** in [`tools/`](../tools/) (e.g., `tools/test-checkout.js`).
6. **Update docs** — at minimum [01_GENERAL_OVERVIEW.md](./01_GENERAL_OVERVIEW.md) (feature list) and [TODO.md](../TODO.md). If pricing/funnel changes, update [03_PAYMENT_AND_FUNNEL.md](./03_PAYMENT_AND_FUNNEL.md).
7. **PR + merge**. CI will deploy the static site and (if applicable) push the binary to R2.

---

## 8. House rules

- Static HTML + Tailwind CDN + vanilla JS for the public site. No build step, no framework lock-in.
- Backend logic goes in **Supabase Edge Functions** unless there is a hard reason (the long-running outreach worker is one such reason).
- All UI work follows [05_UI_ENGINEERING_GUIDE.md](./05_UI_ENGINEERING_GUIDE.md).
- Brand voice is confident and technical. We never trash competitors.
- If a doc goes stale, fix it in the same PR as the code change. The docs folder is part of the product.
