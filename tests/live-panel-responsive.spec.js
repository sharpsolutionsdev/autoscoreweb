// Playwright test: verify `#dv-live-panel` is present and populated across viewports
// Run with: npx playwright test tests/live-panel-responsive.spec.js
const { test, expect } = require('@playwright/test');

test.setTimeout(120000);

const viewports = [
  { width: 1366, height: 768, name: 'desktop-large' },
  { width: 1280, height: 800, name: 'desktop' },
  { width: 1024, height: 768, name: 'laptop' },
  { width: 768, height: 1024, name: 'tablet-portrait' },
  { width: 375, height: 812, name: 'mobile' },
];

test.describe('DartVoice live panel responsiveness', () => {
  test('live stats attached and populated across viewports', async ({ page }) => {
    const url = process.env.DV_TEST_URL || 'https://dartvoice.app/web-app.html';

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(url);

      const livePanel = page.locator('#dv-live-panel');
      await livePanel.waitFor({ state: 'attached', timeout: 10000 });

      // Expect the panel to have at least one child element (stats container)
      const childrenCount = await livePanel.evaluate(el => el.children.length);
      expect(childrenCount).toBeGreaterThan(0);

      // Note: layout can hide panels visually; we only assert the panel exists and is populated
    }
  });
});
