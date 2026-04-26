DartCounter Injector (for extension/content-script)

Purpose
- A small content script you can paste into your browser extension or run in the iframe console.
- Posts the keyboard/score element bounding rect to the parent page as { type: 'DV_GAME_ELEMENT_RECT' } so overlays can anchor precisely.
- Accepts commands via postMessage to simulate keyboard input inside the DartCounter iframe.

Files
- `scripts/injectors/dartcounter-inject.js` — the content script.

How to use (paste into your extension content script or the iframe console)
1) Inject the script inside the DartCounter iframe (via your extension or DevTools) — the script installs `window.DVInjector` API and listens for parent messages.

2) Parent → iframe examples (run on `dartvoice.app` parent)
```js
// find the iframe in the parent page
const iframe = document.querySelector('iframe[src*="dartcounter"]') || document.querySelector('#scorer-frame');
// ask the injector to start auto-posting keyboard rects
iframe.contentWindow.postMessage({ type: 'DV_INJECT_CMD', cmd: 'startAutoPost', selector: 'app-cricket-tactics-keyboard > div', intervalMs: 1000 }, '*');
// stop auto-posting
iframe.contentWindow.postMessage({ type: 'DV_INJECT_CMD', cmd: 'stopAutoPost' }, '*');
// request a single immediate rect post
iframe.contentWindow.postMessage({ type: 'DV_INJECT_CMD', cmd: 'postRect' }, '*');
// simulate input (example: three 19s submitted)
iframe.contentWindow.postMessage({ type: 'DV_INJECT_CMD', cmd: 'simulate', values: [19,19,19] }, '*');
```

// Provide a cricket-grid JSON (calibration) so the injector can compute precise
// click coordinates for cricket-mode simulation. `grid` should include at least
// `s20` and `t15` reference points (x/y relative to the keyboard container, or
// absolute page coords). Example:
```js
const grid = { s20:{x:120,y:40}, t15:{x:220,y:140}, submit:{x:340,y:480} };
iframe.contentWindow.postMessage({ type: 'DV_INJECT_CMD', cmd: 'setCricketGrid', grid }, '*');
// Optionally pass injector config (offsets/delays)
iframe.contentWindow.postMessage({ type: 'DV_INJECT_CMD', cmd: 'setInjectorConfig', cfg: { cricket_offset_x:0, cricket_offset_y:0 } }, '*');
```

3) From inside the iframe console (manual control)
```js
// start auto-post with default selector and interval
window.DVInjector.startAutoPost('app-cricket-tactics-keyboard > div', 1200);
// simulate inputs
window.DVInjector.simulateInput([19,19,19]);
// stop
window.DVInjector.stopAutoPost();
```

Messages the injector sends back to parent
- `{ type: 'DV_GAME_ELEMENT_RECT', rect: { left, top, width, height }, source: 'dartcounter-injector' }` — main payload used by the parent to anchor overlays
- `{ type: 'DV_INJECT_STATUS', status: '...' }` — lifecycle/log messages

Notes
- If the iframe is cross-origin, the parent can still `postMessage` to the iframe; the injector listens for messages from `window` and responds.
- The selector fallbacks in the script try multiple reasonable candidates — if your DartCounter markup differs, you can pass a custom `selector` when calling `startAutoPost`.
- Use the injector only in trusted environments (it simulates clicks inside the iframe). Do not paste service secrets into the script.

Quick debug tip
- On the parent run `window._dvOverlayDebug = true` to make the parent briefly outline chosen anchor elements when overlays are anchored.

If you want, I can also:
- Add a small parent helper in `web-app.html` to send the `startAutoPost` message automatically when an ambassador account loads the page.
- Create a small Chrome extension manifest + content script package in the repo for easy install.

Chrome extension (optional)
- The shipping extension lives in `chrome_extension/` (see [chrome_extension/README.md](../chrome_extension/README.md)). It includes the same injector plus a popup, auth bridge, and packaging.
- To use unpacked: load the `chrome_extension/` folder as an unpacked extension in Chrome/Edge. The content script runs in frames on `app.dartcounter.net` and installs the same injector as the console script.

Notes on safety
- The extension only runs on the DartCounter host(s) listed in the manifest and is intended for trusted developer use. Do not install in shared browsers without understanding permissions.
