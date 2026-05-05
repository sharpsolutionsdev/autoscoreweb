# DartVoice — Backlog

> Living list. Last refreshed: April 2026. For the strategic 12-month picture see [docs/08_GROWTH_AND_ROADMAP.md](docs/08_GROWTH_AND_ROADMAP.md).

## 🔥 Now (this week)

### Autoscore desktop app — calibration & UX rework (April 2026)
The Windows autoscore app fullscreen mode is broken and calibration UX needs a major polish. Tracked here so it's not lost.

- [ ] **Fullscreen regression** — [autoscore/dartvoice_v2.py](autoscore/dartvoice_v2.py) + [autoscore/main.py](autoscore/main.py): the fullscreen toggle no longer enters borderless. Repro: launch app, press the fullscreen control on the camera card → window stays windowed. Add a dedicated "Open Camera" / "Fullscreen" button to the camera card that calls `Window.fullscreen = 'auto'` and falls back to `'borderless'`; persist the preference in `~/.dartvoice_settings.json`.
- [ ] **Bigger calibration camera** — pop the camera feed into a centered modal (≥ 70 % of screen, max 1280×720) with a step-by-step coach overlay ("Click the **outer wire of 20**", "Now click the **outer wire of 6**", etc.). Today the feed sits in a small panel, users miss the wire.
- [ ] **More calibration points** — switch from 4-point homography to **6 or 8 point** (add 13/9/4/15 outer wires). Improves perspective correction at extreme camera angles. New points feed `cv2.findHomography` with `cv2.RANSAC, 5.0`.
- [ ] **Live perspective preview** — after calibration, show a real-time top-down warped view alongside the raw feed so the user can verify the dartboard is square.
- [ ] **Adjustable segment overlays** — when the user calibrates and we render the colored segment ring, allow them to **drag any double/triple ring** with the mouse to nudge it ±15 px. Persist offsets in the calibration JSON. This is the escape hatch for slightly-off calibrations.
- [ ] **Where is the camera surfaced** — document that today the camera is only visible from the autoscore desktop app's "Camera" tab, and the web app just embeds DartCounter's webcam. Decide if we surface a native DartVoice camera in [web-app.html](web-app.html) (separate work — needs WebRTC + the same homography transform in JS).

### Web-app polish (April 2026 sprint)
- [x] Edit-score voice tolerance — added "change last", "change score", "change last score", "correct that", "fix score", "redo", "that was wrong", "wrong score" — see [web-app.html](web-app.html#L6418-L6450)
- [x] Checkout overlay — bigger card (440-720px), longer hold (4 s → 8 s), bigger score & route chips — see [web-app.html](web-app.html#L5318-L5410)
- [ ] **In-game voice chat** — when the user is in a multiplayer game and presses a `chat` hotkey (or says "send chat <message>"), capture the next phrase, postMessage `DV_FILL_CHAT` to the iframe, then trigger DartCounter's send button. Bridge already supports `DV_FILL_CHAT` in [chrome_extension/content.js](chrome_extension/content.js).
- [ ] **Instant replay** — buffer the last 5 s of the camera `<video>` stream via `MediaRecorder` (rolling chunks). When a checkout fires (`dvShowTurnCheckoutOverlay`), surface a "🎬 Replay" button next to the overlay that plays the buffered Blob in a small picture-in-picture box for 4 s, then disposes.
- [ ] **Darts-at-double prompt gating** — only fire `dvShowCheckoutPrompt` for the *active* player. Currently driven by DartCounter's own dialog (which only asks the user, so should already be gated) — verify with a multiplayer trace and add a `state.activeIdx === userIdx` guard in [web-app.html](web-app.html#L7552) if needed.
- [ ] **Camera button regression check** — `openScorerAction('camera')` posts `DV_ACTION` to the iframe; bridge guard at [chrome_extension/content.js](chrome_extension/content.js#L2118) is correct for first-level frames. If still broken, capture a trace via `Ctrl+Shift+T` and inspect for `DV_ACTION camera: not in DOM yet` log lines (means DartCounter changed their button selector).
- [ ] **More motion polish** — the dashboard feels static; add subtle entry transitions to `.hud-card` (fade-up 200 ms stagger) and pulse the active turn arrow.
- [ ] **Figma icon set** — pull SVG icons from a shared Figma file via the Figma MCP, replace the inline SVGs in [web-app.html](web-app.html) with `<svg><use href="#icon-…"/></svg>` from a single sprite at [assets/media/icons.svg](assets/media/icons.svg).

- [ ] Extend the 20% launch promo (`PROMO_20`) — currently ~3 days remaining, decide new end date
- [ ] Code-sign the Windows installer with an EV cert (kills SmartScreen warning, ~30% install drop-off today)
- [ ] Submit signed `.aab` to Google Play (currently sideload-only via `apk-gate.html`)
- [ ] Outreach worker (`outreach-server/src/index.js`) — `pm2 restart` on the box (RPC retry loop now in code: exponential backoff, MAX_ATTEMPTS=5)
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
