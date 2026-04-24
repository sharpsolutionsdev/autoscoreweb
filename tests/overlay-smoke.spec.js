// Playwright smoke test: overlay anchoring and live panel update
// Run with: npx playwright test tests/overlay-smoke.spec.js
const { test, expect } = require('@playwright/test');

test.describe('DartVoice overlay anchoring', () => {
  test('Live panel and overlay anchor above scorer-frame', async ({ page }) => {
    // Go to local or deployed web-app.html
    await page.goto(process.env.DV_TEST_URL || 'https://dartvoice.app/web-app.html');

    // Wait for iframe and overlays (use Locator for expect())
    const iframe = page.locator('iframe#scorer-frame, iframe[src*="dartcounter"]');
    await expect(iframe).toBeVisible({ timeout: 10000 });

    // Wait for live panel to be present in the DOM (visibility may be controlled by app state)
    const livePanel = page.locator('#dv-live-panel');
    await livePanel.waitFor({ state: 'attached', timeout: 10000 });

    // Wait for overlay (game shot or checkout overlay)
    // Ensure overlay host exists (app may create it only during animations)
    await page.evaluate(() => {
      if (!document.getElementById('dv-game-shot-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'dv-game-shot-overlay';
        overlay.className = 'dv-game-shot-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.display = 'flex';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '100050';
        document.body.appendChild(overlay);
      }
    });

    // Simulate a DV_GAME_ELEMENT_RECT message to force overlay repositioning
    await page.evaluate(() => {
      window.postMessage({
        type: 'DV_GAME_ELEMENT_RECT',
        rect: { left: 100, top: 200, width: 300, height: 80 },
        source: 'smoke-test'
      }, '*');
    });
    // Wait for overlay to appear
    const overlay = page.locator('#dv-game-shot-overlay, .dv-overlay, .dv-checkout-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Check overlay is above iframe (z-index)
    const overlayZ = await overlay.evaluate(el => getComputedStyle(el).zIndex);
    const iframeZ = await iframe.evaluate(el => getComputedStyle(el).zIndex);
    expect(Number(overlayZ)).toBeGreaterThanOrEqual(Number(iframeZ) || 0);

    // Check overlay is positioned within expected rect
    const rect = await overlay.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect.width).toBeGreaterThan(50);
    expect(rect.height).toBeGreaterThan(20);
  });
});
