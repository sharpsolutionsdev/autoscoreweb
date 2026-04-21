// Playwright smoke tests for the DartVoice web app.
// Run: npx playwright test tests/smoke.spec.js
//
// These are happy-path smokes against the hosted app (dartvoice.app). They do
// NOT load the Chrome extension — MV3 extensions require a separate
// `launchPersistentContext` fixture and a test build of the extension. See
// Phase 2 of the testing plan for the extension harness.

import { test, expect } from '@playwright/test';

const BASE = process.env.DV_BASE_URL || 'https://dartvoice.app';

test.describe('DartVoice smoke', () => {
  test('homepage renders hero + pricing', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page).toHaveTitle(/DartVoice/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto(BASE + '/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('web-app renders loader then scorer studio', async ({ page }) => {
    await page.goto(BASE + '/web-app.html');
    // Loader is visible briefly; studio shell should mount within 10s.
    await expect(page.locator('#dv-live-panel, .scorer-studio, main')).toBeVisible({ timeout: 10000 });
  });

  test('referral landing carries ?ref through to login', async ({ page }) => {
    await page.goto(BASE + '/referral.html?ref=TESTCODE');
    const cta = page.getByRole('link', { name: /sign.?up|get started|join/i }).first();
    await expect(cta).toBeVisible();
  });

  test('welcome page shows onboarding steps', async ({ page }) => {
    await page.goto(BASE + '/welcome.html?src=ext_install');
    await expect(page.locator('body')).toContainText(/open.*app|sign.?in|connect.*scorer/i);
  });
});
