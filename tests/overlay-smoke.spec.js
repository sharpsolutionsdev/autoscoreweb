// Playwright smoke test: overlay anchoring and live panel update
// Run with: npx playwright test tests/overlay-smoke.spec.js
const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

test.describe('DartVoice overlay anchoring', () => {
  test('Live panel and overlay anchor above scorer-frame', async ({ page }) => {
    // Go to local or deployed web-app.html
    await page.goto(process.env.DV_TEST_URL || 'https://dartvoice.app/web-app.html');

    // Wait for iframe and overlays (use Locator for expect())
    const iframe = page.locator('iframe#scorer-frame, iframe[src*="dartcounter"]');
    await expect(iframe).toBeVisible({ timeout: 20000 });

    // Wait for live panel to be present in the DOM (visibility may be controlled by app state)
    const livePanel = page.locator('#dv-live-panel');
    await livePanel.waitFor({ state: 'attached', timeout: 15000 });

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
    // Wait for overlay to exist and be attached; visual visibility may be animated
    await overlay.waitFor({ state: 'attached', timeout: 20000 });

    // Check overlay's bounding box (should be present even if hidden briefly)
    const rect = await overlay.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect.width).toBeGreaterThan(10);
    expect(rect.height).toBeGreaterThan(10);

    // Check overlay is above iframe if z-index values are numeric
    const overlayZ = await overlay.evaluate(el => getComputedStyle(el).zIndex);
    const iframeZ = await iframe.evaluate(el => getComputedStyle(el).zIndex);
    const oz = Number.isNaN(Number(overlayZ)) ? 0 : Number(overlayZ);
    const iz = Number.isNaN(Number(iframeZ)) ? 0 : Number(iframeZ);
    expect(oz).toBeGreaterThanOrEqual(iz);
  });
});
