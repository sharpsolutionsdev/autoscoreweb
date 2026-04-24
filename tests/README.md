Overlay smoke test (Playwright)

Purpose
- Quick smoke test that verifies overlay anchoring and that overlays render above the scorer iframe.

Safety & privacy
- This test does not require any project secrets. Do NOT set `SUPABASE_SERVICE_ROLE_KEY` or other secrets to run this test locally.
- The repo contains injector helpers and an optional `extension/` copy; loading the extension is optional and safe for local development.

Requirements
- Node.js 18+ recommended
- To run the test you'll need `@playwright/test` installed locally (dev dependency) and Playwright browsers.

Run locally (recommended, manual):

1. Create a local package.json if you don't have one yet:

```bash
npm init -y
```

2. Install Playwright test runner (dev deps) and browsers:

```bash
npm install -D @playwright/test
npx playwright install
```

3. Run the overlay smoke test (adjust `DV_TEST_URL` for local staging if needed):

```bash
# optional: point at local/deployed URL
# Windows PowerShell example
$env:DV_TEST_URL = 'http://localhost:5173/web-app.html'
npx playwright test tests/overlay-smoke.spec.js --reporter=list
```

Notes
- The test posts a synthetic `DV_GAME_ELEMENT_RECT` message to the page to verify overlay placement. If your page includes strict origin checks, run the test against a reachable host (e.g., deployed staging) or adjust test code accordingly.
- If `web-app.html` auto-starts the injector, you can disable that temporarily by toggling the in-page button (bottom-right) or running:

```js
localStorage.setItem('dv-autoinject', '0')
```

If you want, I can add a CI job that runs this smoke test in GitHub Actions, but it will add dev dependencies and require more CI minutes. For now this README provides safe local steps that will not change repo secrets or functionality.
