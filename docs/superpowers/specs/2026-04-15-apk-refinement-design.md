# APK Refinement Design â€” 2026-04-15

## Scope
Refine the DartVoice Android APK for production: subscription-only access, reliable
voice injection without keyboard popups, empty/duplicate submission filtering,
checkout flow handling, visual polish, tablet responsiveness, mic input selection.

## Architecture (Approach A: Layered Gate + Stateful Voice Controller)

```
APK launch (main.py)
  â†’ loads html/apk-gate.html
    â†’ Supabase session check + dartvoice_subscriptions lookup
      â†’ no sub      â†’ trial signup CTA (loads /login?source=apk)
      â†’ active sub  â†’ window.location = html/web-app-mobile.html
  â†’ DartVoiceBridge (JS interface on control WebView)
  â†’ Scorer WebView (lazy, loads app.dartcounter.net)
```

Three JS modules inside html/web-app-mobile.html:

- **VoiceController** â€” state machine: IDLE â†’ LISTENING â†’ CHECKOUT â†’ COOLDOWN â†’ RECOVERING
- **ScoreValidator** â€” rejects invalid dart totals (179/178/176/175/173)
- **ScorerObserver** â€” via DartVoiceBridge; polls injected DartCounter DOM for
  checkout detection + input keyboard suppression

## Subscription Gate (html/apk-gate.html)
- Loads Supabase client + existing branding
- On boot: `sb.auth.getSession()` â†’ if no user, show "Sign in / Start Free Trial" CTA
- If user: query `dartvoice_subscriptions.status` â€” accept `active`, `trialing`
- Pass â†’ `window.location.replace('/html/web-app-mobile.html')`
- Fail â†’ show gate screen with two buttons: `Sign in` (loads `/login?source=apk`) and
  `Start 7-Day Free Trial` (loads `/login?source=apk&trial=1`)
- Gate screen features: mic-mesh-red.jpeg background, logo, value prop, CTA
- `source=apk` query param preserved through auth flow so login can redirect back

## Voice State Machine
States:
- `IDLE` â€” mic off
- `LISTENING` â€” normal scoring; full vocabulary
- `CHECKOUT` â€” active after detected checkout prompt; restricted vocabulary
- `COOLDOWN` â€” 1500ms lock after successful inject to prevent dupes
- `RECOVERING` â€” restart SpeechRecognition after error or 8s silence watchdog

Transitions enforce:
- Only `isFinal` results trigger injection
- ScoreValidator filters before inject: valid dart totals (0-180 minus impossibles)
- Cooldown blocks re-injection regardless of source
- Watchdog: if listening and no result in 8s, bounce recognition

Valid-score set: 0, 1-60, 25, 50, any multiples per dart; visit totals 0-170 OR 180
(reject 173, 175, 176, 178, 179 â€” impossible three-dart totals).

## Checkout Vocabulary (CHECKOUT state)
Accepted: "one dart"/"one", "two darts"/"two", "three darts"/"three", "no score",
"zero", "miss", "busted". Everything else silently ignored. After injection, return
to LISTENING state.

Detection: ScorerObserver polls scorer WebView for text content matching
/how many darts/i or /checkout.*darts/i on an interval. When detected, bridge
calls `window.onCheckoutDetected()` on control WebView.

## Keyboard Suppression (scorer WebView)
DartVoiceBridge injects on scorer page load:
- CSS: `input { caret-color: transparent; }`
- JS: adds `inputmode="none"` to all score inputs, prevents focus events from
  opening soft keyboard via `preventDefault` on touchstart of score inputs
- Injection uses `setReactValue` + `input/change` events (already in DARTCOUNTER_DRIVER);
  no `.focus()` call â€” that's what triggers the keyboard

## UI: Status Header
Replace the "BACK TO CONTROLS" Java button with a floating pill at top center:
- Green pulse + "Listening" when LISTENING
- Amber "Processing" during COOLDOWN
- Red "Mic lost â€” reconnecting" during RECOVERING
- Tap to close scorer (return to controls)

Java keeps the button but restyles: rounded pill, icon, status text updated via
`updateStatus(state)` bridge method called from JS.

## Mic Input Selection
Settings card gets new row: "Microphone" with dropdown populated from
`navigator.mediaDevices.enumerateDevices()` filtering `audioinput`. Selection
persisted in localStorage. Applied via `getUserMedia({audio: {deviceId}})` before
starting SpeechRecognition (note: Web Speech API doesn't accept deviceId directly;
we request the stream first to reserve the device).

## Visual Assets
- App icon: new raster at multiple densities generated from mic-mesh-red.jpeg
- Splash/loading: mic-mesh-red.jpeg full-screen with logo overlay (apk-gate shows
  while Supabase check runs)
- Logo in controls: existing "DART**VOICE**" text mark (no image change needed)
- In-session accent video: `soundwave-pulse.mp4` loops at low opacity behind mic btn

## Tablet Responsive
Breakpoints:
- `<600px` â€” current mobile layout
- `600-899px` â€” container max-width 700px, larger mic button, 4-col stat grid
- `â‰¥900px` â€” side-by-side layout: controls left 420px, activity log right
- Larger font sizes via `clamp()` on display headings

## Files Changed
- NEW: `html/apk-gate.html` â€” sub gate screen
- MODIFIED: `html/web-app-mobile.html` â€” voice state machine + UI + tablet CSS + mic select
- MODIFIED: `autoscore/main.py` â€” load `html/apk-gate.html` first
- MODIFIED: `autoscore/src/com/dartvoice/DartVoiceBridge.java` â€” status pill,
  keyboard suppression injection, checkout detection bridge
- NEW: `autoscore/res/drawable/` â€” new icon assets (handled at APK packaging time)

## Out of Scope
- Server-side subscription enforcement (client gate is sufficient; DartCounter
  itself requires auth)
- Localisation beyond existing accent selector
- Offline play (explicitly rejected by product)

