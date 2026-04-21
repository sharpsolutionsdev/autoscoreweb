# DartVoice Launchpad — Chrome Extension

Voice-controlled darts scoring. This extension bridges DartVoice (the web app at
`https://dartvoice.app`) with DartCounter's Scorer Studio, so the web app can
read live game state from the iframe and relay checkout prompts.

## Build & install (dev)

1. Clone this repo and navigate to `chrome_extension/`.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
   and select this directory.
3. Open `https://dartvoice.app/web-app.html` — the extension auto-injects into the
   iframe only when framed by dartvoice.app. Standalone visits to dartcounter.net
   are silently ignored (scope-gated).

## Package for Chrome Web Store

From the repo root:

```sh
cd chrome_extension
powershell -NoProfile -Command "Compress-Archive -Path * -DestinationPath ../chrome_extension_live_ui.zip -Force"
```

Upload `chrome_extension_live_ui.zip` to the Web Store developer dashboard.

## What's inside

- `manifest.json` — MV3 manifest, content scripts, DNR rules.
- `content.js` — Injected into dartcounter.net / nakka.com inside the dartvoice.app
  iframe. Posts `DV_GAME_STATE` messages to the parent, handles `DV_ACTION`
  (camera open, reorder), auto-rejects cookie banners.
- `auth-bridge.js` — Injected into dartvoice.app; forwards extension-aware session
  events back to the extension.
- `background.js` — Opens `welcome.html` on first install.
- `rules.json` — Declarative net request rules that strip `X-Frame-Options` so
  DartCounter renders in our iframe.
- `popup.html` / `popup.js` — Toolbar popup (status chip, mic picker, live game
  tab, version).

## Versioning

Manifest `version` follows `MAJOR.MINOR.PATCH`. Bump on any shipped change; the
Web Store requires strictly-increasing versions. Current: see
[manifest.json](./manifest.json).
