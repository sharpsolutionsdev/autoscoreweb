# DartVoice — General Overview & Software Features

*Internal Staff Document — Confidential*

---

## What Is DartVoice?

DartVoice is a voice-controlled auto-scoring engine purpose-built for darts. It eliminates the single most disruptive element of every casual and competitive practice session: **manually entering scores**.

Every darts player who practices at home or in league play knows the pain. You throw three darts, walk to the board to pull them out, then walk back to a tablet, phone, or laptop to key in your score. That break in rhythm is concentration-destroying. DartVoice removes it entirely by listening to your voice and doing all the work for you — silently, instantly, and accurately.

The player simply speaks their score naturally — the way they'd announce it to a mate — and DartVoice handles the rest: parsing the terminology, subtracting from the total, rotating between players, calculating checkout routes, and feeding the input into whichever scoring platform the player is already using.

---

## The Core Problem We Solve

The darts scoring market is fractured. There are dozens of excellent scoring platforms — apps like **Target Dart Counter**, **Nakka**, **DartConnect**, and browser-based alternatives. But **none of them offer hands-free voice input**. Even the high-end hardware solutions like **Target Omni** (which costs upwards of £500 and requires physical ring installation on a specific board) only solve the problem for players willing to make that investment.

DartVoice is the **software-only alternative**. No hardware. No ring installation. No proprietary board. Just a microphone — the one already in your phone, your laptop, or a cheap Bluetooth headset — and the DartVoice engine running alongside whatever scorer you already love.

**It layers on top of existing platforms, not in place of them.**

---

## The Multi-Platform Ecosystem

DartVoice is not a single app. It is an ecosystem of clients, each designed for a different player setup:

### 🖥️ Windows Desktop Application
- Full standalone desktop client written in Python.
- Runs as a lightweight local process alongside any darts scoring software on the same machine.
- Uses **Vosk** — an offline speech-recognition engine — for zero-latency, zero-cloud voice processing. Nothing leaves the machine.
- Features a **GUI calibration system**: the player tells DartVoice where the scoring interface's buttons are on screen, and it clicks them automatically.
- Ideal for players with a dedicated home setup: PC and monitor at the oche.

### 📱 Android Native Application
- The full DartVoice engine packaged as a native Android APK.
- Turns any Android phone into a **wireless microphone array** — prop it at the oche and let it listen.
- Features **Visual Calibration**: tap the screen targets on other apps (like Target Dart Counter) and DartVoice remembers where they are.
- Supports **Picture-in-Picture (PiP) mode**: the DartVoice overlay floats on top of other apps, so you never need to switch screens.
- Runs as a **background service**: the voice engine keeps listening even when the phone screen is locked or another app is in focus.
- **Always in your pocket** — no separate hardware to carry, charge, or lose. Your phone is the only device you need.

### 🌐 Google Chrome Extension
- A lightweight Manifest V3 extension that injects directly into browser-based scoring interfaces.
- Uses the browser's native `webkitSpeechRecognition` API to listen and parse.
- **Direct DOM manipulation**: instead of simulating mouse clicks, the extension reaches directly into the scoring interface's HTML elements and updates them programmatically.
- Full mathematical parsing for both X01 and Cricket game logic built into the extension itself.
- Perfect for players who score via a browser tab on their laptop or Chromebook.

---

## Complete Feature Breakdown

### 🎤 Voice Recognition
- Understands natural darts language: "Triple twenty", "Treble seventeen", "T20", "Ton eighty", "One-forty", "Bull", "Fifty", "Double sixteen", etc.
- Processes spoken scores in **under 100ms** on-device.
- Works entirely **offline** — no cloud, no API calls, no internet required during play.
- Background chatter and non-score conversation is automatically ignored.

### 🧮 Automatic Real-Time Scoring
- Subtracts scores automatically, tracks remaining totals, and rotates between up to **8 players**.
- No mental arithmetic required. Just speak and throw.
- Full session history is recorded — every visit, every dart.

### 🎯 Live Dynamic Checkout Suggestions
- When a player is on a checkout (e.g., 170 remaining), DartVoice displays the optimal checkout route: **T20 → T20 → BULL**.
- In Per-Dart mode, the checkout advice **recalculates after every single dart**. Throw your first dart, and the suggestion updates instantly for what's left.
- Covers **all standard double-out checkouts** from 170 down.

### 🗣️ Natural Language Parsing
- No rigid syntax. No menus. No button tapping.
- In **Per-Dart mode**: "Triple seventeen" → T17 → 51 points.
- In **Per-Visit mode**: "One-forty" → 140 points subtracted.
- In **Cricket mode**: "Two marks on nineteen", "Three on twenty".
- Understands shorthand, slang, and full terms interchangeably.

### 📢 Custom Wake Words & Smart Listening
- Set a custom trigger word (like your own personal Alexa) — e.g., "Score" — so DartVoice only activates when you want it to.
- Or leave it in **Always On** mode. Because DartVoice only reacts to numbers and darts terminology, casual conversation is ignored entirely.

### 🕹️ Every Game Mode
- **X01 variants**: 301, 501, 701, and any custom start.
- **Cricket**: Full marks-based scoring.
- **Round the Board** and practice modes.
- **121**: A popular short-format game.
- Real-time session averages tracked per player, per leg.

### 🖥️ Companion Pop-Up / PiP Mode
- On Windows: DartVoice runs as a **floating always-on-top window** over DartCounter or any app. Voice-score without ever switching windows.
- On Android: PiP mode keeps the DartVoice scoring overlay visible while the scoring app (e.g., Target Dart Counter) runs underneath.

### 🔄 Scoring Flexibility
- **Per-Visit mode**: Call the total yourself — "One-forty!" — and DartVoice subtracts it.
- **Per-Dart mode**: Call each dart individually — "T20, T20, T20" — and DartVoice sums them and subtracts. One tap to switch between modes.

### 🎨 Custom Colour Themes
- Pick your accent colour: Crimson, Ocean, Neon, Gold, Purple, or custom.
- Match DartVoice to your setup, your team colours, or your mood.

### 🎬 Match Recording
- Record sessions on-screen. Save highlights, review your performance, or relive that 9-darter.

### 🔇 Works Fully Offline
- Voice recognition runs entirely on-device via **Vosk**.
- The only internet requirement is signing in to verify your subscription. After that, it's fully offline.

### 🔐 Target Dart Counter Compatible
- DartVoice is engineered to work seamlessly alongside **Target Dart Counter** — the most popular scoring app in the darts community.
- Open both apps side by side. Call your scores. DartVoice inputs them into Target DC for you.

---

## Who Is DartVoice For?

DartVoice is designed for **every darts player** — not just tech-savvy early adopters:

| Player Type | How DartVoice Helps |
|---|---|
| **Home practice warriors** | Practice 501 legs hands-free for hours without interrupting rhythm. |
| **League players** | Track session averages, review checkout routes, and refine game strategy. |
| **Social dart nights** | Up to 8-player multiplayer. No more arguing about whose turn it is or what the score was. |
| **Streamers & content creators** | Match recording + floating PiP mode = clean content with no manual scoring visible. |
| **Android-only players** | Full DartVoice engine right on the phone in your pocket. No PC required. |
| **Casual players upgrading** | Affordable monthly entry point vs £500+ hardware solutions. |

---

## The "Always In Your Pocket" Promise

Unlike camera-based auto-scoring (Target Omni, Scolia, etc.), DartVoice requires **zero physical installation**. There is no ring to mount, no camera to angle, no lighting to calibrate, and no specific board model required.

- Your **phone** is the microphone.
- Your **voice** is the controller.
- It works on **any dartboard** in the world.

Whether you're playing at home, at a mate's house, at a pub, or on holiday — if you have your phone, you have DartVoice. That's the core promise: **it's always with you, always ready**.
