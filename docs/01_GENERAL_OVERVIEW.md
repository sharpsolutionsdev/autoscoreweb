# DartVoice — General Overview & Software Features

*Internal Staff Document — Confidential. Last reviewed: April 2026.*

---

## What Is DartVoice?

DartVoice is a voice-controlled auto-scoring engine purpose-built for darts. It eliminates the single most disruptive element of every casual and competitive practice session: **manually entering scores**.

Every darts player who practices at home or in league play knows the pain. You throw three darts, walk to the board to pull them out, then walk back to a tablet, phone, or laptop to key in your score. That break in rhythm is concentration-destroying. DartVoice removes it entirely by listening to your voice and doing all the work — silently, instantly, and accurately.

The player simply speaks their score naturally — the way they'd announce it to a mate — and DartVoice handles the rest: parsing the terminology, subtracting from the total, rotating between players, calculating checkout routes, and feeding the input into whichever scoring platform the player is already using.

---

## The Core Problem We Solve

The darts scoring market is fractured. There are dozens of excellent scoring platforms — apps like **Target Dart Counter**, **Nakka**, **DartConnect**, and browser-based alternatives. But **none of them offer hands-free voice input**. Even the high-end hardware solutions like **Target Omni** (~£500+, requires physical ring installation on a specific board) only solve the problem for players willing to make that investment.

DartVoice is the **software-only alternative**. No hardware. No ring installation. No proprietary board. Just a microphone — the one already in your phone, your laptop, or a cheap Bluetooth headset — and the DartVoice engine running alongside whatever scorer you already love.

**It layers on top of existing platforms, not in place of them.**

---

## The Multi-Platform Ecosystem

DartVoice is not a single app. It is an ecosystem of clients, each designed for a different player setup:

### 🖥️ Windows Desktop Application
- Standalone Python desktop client packaged as `DartVoice_Setup.exe` (PyInstaller).
- Distributed via Cloudflare R2 (`releases.dartvoice.app`).
- Uses **Vosk** — an offline speech-recognition engine — for zero-latency, zero-cloud voice processing. Nothing leaves the machine after subscription verification.
- GUI calibration: the player tells DartVoice where the scoring interface's buttons are on screen, and it clicks them automatically (PyAutoGUI).
- Ideal for players with a dedicated home setup: PC and monitor at the oche.
- *Currently un-signed* — Windows SmartScreen warns on first install. EV code-signing is on the roadmap.

### 📱 Android Native Application
- Full DartVoice engine packaged as a native Android APK.
- Currently distributed as a **sideload** via `apk-gate.html` (Play Store submission of the signed `.aab` is pending).
- Built with Kivy + Buildozer; ships an embedded WebView that hosts `web-app-mobile.html` for the scoring UI.
- Can use either on-device Vosk **or** the Web Speech API depending on Android version.
- Visual Calibration: tap the screen targets on other apps (like Target Dart Counter) and DartVoice remembers where they are.
- **Picture-in-Picture (PiP)**: the DartVoice overlay floats on top of other apps.
- Runs as a **background service**: voice engine keeps listening with screen locked or another app in focus.
- Auth flows through the same OTP bridge as the desktop client.

### 🌐 Google Chrome Extension — *DartVoice Launchpad*
- Live on the Chrome Web Store: <https://chromewebstore.google.com/detail/dartvoice-launchpad/igldnjophdpofihidpbblchgfamncpgb>.
- MV3 manifest, current version `2.1.x`.
- Listens via `webkitSpeechRecognition` and pushes scores into the host page through DOM injection or simulated input.
- Auth bridge: forwards the user's `dartvoice.app` session into the extension so the popup knows who's signed in.
- Ships rules that strip `X-Frame-Options` so DartCounter can be embedded inside our own iframe.
- Includes a 10-minute ungated demo before requiring a subscription.

### 🌐 Web Scorer
- `web-app.html` (desktop browser) and `web-app-mobile.html` (in-APK WebView and mobile browsers).
- Pure browser scorer — no install. Mostly used as the canonical UI that the APK reuses.

### 🛡 Admin / Outreach CRM
- `admin.html` + `admin.js` — internal-only, gated by Supabase auth + `admin_users` row check.
- Pipelines creator outreach: YouTube discovery, Hunter.io email lookup, sequenced sends via the `outreach-server` Node worker.
- Not user-facing.

### 🏆 Ranked / Creator surfaces
- `ranked.html`, `rankings.html`, `creator-portal.html`, `referral.html` — landing pages for those programmes.
- The full ranked-mode database + edge-function work is partially shipped; see [`ranked_mode_implementation_plan.md`](../ranked_mode_implementation_plan.md) and [06_FUTURE_VISION_AND_MMR.md](./06_FUTURE_VISION_AND_MMR.md).

---

## Backend (Supabase)

Project ref: `poyjykgqsvgimssbhsuz` (DartVoice, EU/ENAM region, status `ACTIVE_HEALTHY`).

| Concern | Where |
|---|---|
| Auth (email OTP) | Supabase Auth, SMTP via Resend |
| User profiles, subscriptions, sessions | Postgres tables under RLS |
| Stripe webhook handling | Edge function `stripe-webhook` |
| OTP login bridge for native clients | Edge function `auth-callback` (and friends) |
| Outreach job claim / retry | RPCs added in `012_claim_outreach_job.sql` |
| Realtime updates (live games, ranked) | Postgres `realtime` |

Migrations: [`supabase/migrations/`](../supabase/migrations/). Edge functions: [`supabase/functions/`](../supabase/functions/).

---

## Complete Feature Breakdown

### 🎤 Voice Recognition
- Understands natural darts language: "Triple twenty", "Treble seventeen", "T20", "Ton eighty", "One-forty", "Bull", "Fifty", "Double sixteen", etc.
- Processes spoken scores in **under 100ms** on-device.
- Works entirely **offline** on the desktop and APK (Vosk). The Chrome extension currently uses the browser's online speech API; on-device WASM Vosk is on the roadmap.
- Background chatter and non-score conversation is automatically ignored.

### 🧮 Automatic Real-Time Scoring
- Subtracts scores automatically, tracks remaining totals, and rotates between up to **8 players**.
- Full session history is recorded — every visit, every dart.

### 🎯 Live Dynamic Checkout Suggestions
- When a player is on a checkout (e.g., 170 remaining), DartVoice displays the optimal route: **T20 → T20 → BULL**.
- In Per-Dart mode, the suggestion **recalculates after every single dart**.
- Covers all standard double-out checkouts from 170 down.

### 🗣️ Natural Language Parsing
- Per-Dart mode: "Triple seventeen" → T17 → 51.
- Per-Visit mode: "One-forty" → 140 subtracted.
- Cricket: "Two marks on nineteen", "Three on twenty".
- Shorthand, slang, and full terms are all interchangeable.

### 📢 Custom Wake Words & Smart Listening
- Set a custom trigger word (e.g., "Score") for activation-on-demand, or leave it Always On — DartVoice ignores anything that isn't a number or darts term.

### 🕹️ Every Game Mode
- X01 variants (301, 501, 701, custom), Cricket (full marks-based), Round the Board, 121, practice modes.
- Real-time session averages tracked per player, per leg.

### 🖥️ Companion Pop-Up / PiP Mode
- Windows: floating always-on-top window over DartCounter or any app.
- Android: PiP keeps DartVoice visible while the scoring app runs underneath.

### 🔄 Scoring Flexibility
- **Per-Visit**: call the total — "One-forty!" — and DartVoice subtracts.
- **Per-Dart**: call each dart — "T20, T20, T20" — and DartVoice sums then subtracts. One tap to switch.

### 🎨 Custom Colour Themes
- Crimson, Ocean, Neon, Gold, Purple, or custom accent.

### 🎬 Match Recording
- Save sessions on-screen for review or content.

### 🔇 Works Fully Offline (desktop + APK)
- Voice recognition runs entirely on-device via Vosk on the desktop and APK.
- The only internet requirement is the initial OTP sign-in to verify the subscription.

### 🔐 Target Dart Counter Compatible
- DartVoice is engineered to work seamlessly alongside Target Dart Counter — the most popular scoring app in the community.

### 🤝 Ambassador / Referral Program
- £5 cash via PayPal per converted referral, no cap.
- Real-time tracking dashboard (clicks, conversions, pending payouts) at `referral.html`.

### 📺 Streamer-friendly surfaces
- Creator portal pages (`creator-portal.html`) and clean overlays for ambassador profiles already exist on `web-app.html`.

---

## Who Is DartVoice For?

| Player type | How DartVoice helps |
|---|---|
| Home practice warriors | Practice 501 legs hands-free for hours without interrupting rhythm. |
| League players | Track session averages, review checkout routes, refine strategy. |
| Social dart nights | Up to 8-player multiplayer. No more arguing about turns or scores. |
| Streamers & creators | Match recording + floating PiP = clean content with no manual scoring visible. |
| Android-only players | Full engine on the phone in your pocket. No PC required. |
| Casual players upgrading | Affordable monthly entry vs £500+ hardware. |

---

## The "Always In Your Pocket" Promise

Unlike camera-based auto-scoring (Target Omni, Scolia, etc.), DartVoice requires **zero physical installation**. No ring to mount, no camera to angle, no lighting calibration, no specific board model.

- Your **phone** is the microphone.
- Your **voice** is the controller.
- It works on **any dartboard** in the world.

If you have your phone, you have DartVoice. That's the core promise: **always with you, always ready**.
