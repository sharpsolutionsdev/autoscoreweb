# DartVoice System Architecture

## 1. High-Level Engine Pipeline

DartVoice is primarily a state-machine that processes audio streams into automated system outputs. At its core, the auto-scoring logic follows a rigid pipeline across all platforms:

1. **Audio Capture Layer**: Captures raw PCM audio from the host's active microphone (Desktop Mic, Android Phone, or Browser WebRTC).
2. **Speech Recognition Engine**: Translates raw audio streams into text strings in real-time. (e.g. Vosk for Python, `webkitSpeechRecognition` for Chrome).
3. **Regex & Keyword Parsing**: Cleans up the string (e.g., handles "ton eighty", "triple twenty") to extract the raw mathematical intent.
4. **Mathematical Verification (GameState)**: Checks if the parsed score is a valid dart score (1-180), handles bust logic for X01, or maps specific marks for Cricket.
5. **System Execution Layer**: Fires an output to external scoring software. This could be moving a mouse and clicking via PyAutoGUI (Windows), injecting DOM events via JavaScript (Chrome), or firing a webhook.

## 2. Platform "Tethering" Strategy

Because external applications (Target DartCounter, Nakka, DartConnect) do not have official public APIs for us to input scores, DartVoice acts as a local "Tether".

* **The Desktop Approach**: The DartVoice Python script tracks the coordinate positions of the external software’s number pad. Once a score is verbally confirmed, it sequentially injects synthetic mouse clicks onto those coordinates.
* **The Web Sandbox Approach**: The DartVoice Chrome Extension wraps the official web-based scorers. The extension operates with a `content.js` script that artificially triggers `click()` events on the `<div>` elements of the scorer's web interface.

## 3. The Security & Authentication Bridge

DartVoice does not host its own database of user passwords. Instead, authentication acts as a lightweight gatekeeper bridging the local clients to the Stripe billing backend.

* The Python/Chrome App asks for an **Email** and a **6-Digit Magic Code**.
* The server verifies if that Email currently has an active, paying Stripe Subscription.
* If active, the app writes an encrypted token locally (e.g. `dartvoice_config.json` or `localStorage`) to bypass the paywall gate for future sessions.
