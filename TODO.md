# DartVoice — Backlog

> Living list. Last refreshed: April 2026. For the strategic 12-month picture see [docs/08_GROWTH_AND_ROADMAP.md](docs/08_GROWTH_AND_ROADMAP.md).

## 🔥 Now (this week)

- [ ] Extend the 20% launch promo (`PROMO_20`) — currently ~3 days remaining, decide new end date
- [ ] Code-sign the Windows installer with an EV cert (kills SmartScreen warning, ~30% install drop-off today)
- [ ] Submit signed `.aab` to Google Play (currently sideload-only via `apk-gate.html`)
- [ ] Outreach worker (`outreach-server/src/index.js`) — finish RPC retry loop, then `pm2 restart` on the box
- [ ] Bump Chrome extension to v2.1.6 zip + upload to Web Store (review queue)

## 📈 Next (this month)

- [ ] Ranked mode Phase 1 — apply [`supabase/migrations/011_ranked_mode.sql`](supabase/migrations/) and ship MMR utility functions (see [`ranked_mode_implementation_plan.md`](ranked_mode_implementation_plan.md))
- [ ] First creator partnership campaign (target: 3 micro-influencer integrations, see [docs/04_ADVERTISING_AND_MARKETING.md](docs/04_ADVERTISING_AND_MARKETING.md))
- [ ] Onboarding email drip sequence (Days 0/1/3/5/6/7) — templates exist, sequence not yet wired in Resend
- [ ] Monthly "session stats" retention email — needs backend aggregation job
- [ ] Add link-checker to CI (catches dead `dartvoice.app` links + R2 binary 404s on every push)

## 🧪 Soon (this quarter)

- [ ] Ranked mode Phase 2 — `ranked-queue` and `ranked-match-result` edge functions, realtime subscriptions
- [ ] Ranked mode Phase 3 — UI in `dartvoice-dashboard.html` and `web-app.html`, leaderboard page
- [ ] Pricing experiment — ranked-only tier, mobile-only tier, team/venue plan
- [ ] PDC/league partnership outreach (long shot, high reward)
- [ ] Replace `webkitSpeechRecognition` in the Chrome extension with on-device Vosk WASM (parity with desktop, removes Google dependency)

## 🧹 Cleanup / hygiene

- [ ] Action the cleanup list in [docs/REPO_AUDIT.md](docs/REPO_AUDIT.md) (orphan HTMLs, stray Chrome-extension zips, Gradle `build/tmp/`, brand-asset duplicates)
- [ ] **Reconcile the two migration folders** — `migrations/` (root, app schema) and `supabase/migrations/` (CRM only) have diverged. Pick one canonical home.
- [ ] Consolidate `web-app.html` + `web-app-mobile.html` if responsive parity is achievable
- [ ] Decide fate of `dartvoice_unzipped/handoff/` — historical handoff content, mostly superseded

## ✅ Recently shipped

- [x] Repo flipped private (GitHub Pro)
- [x] Cloudflare R2 mirror for `.apk` and `.exe` (`releases.dartvoice.app`)
- [x] All three CI workflows pushing to R2
- [x] Chrome extension published to Web Store
- [x] Live-game UI overhaul on `web-app.html`
- [x] Creator outreach CRM (`admin.html`) live and gated
- [x] `012_claim_outreach_job.sql` migration applied
- [x] Real Google Analytics ID (`G-DARTVOICE_PROD`) on every public page
