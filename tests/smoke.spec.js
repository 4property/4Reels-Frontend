import { test, expect } from '@playwright/test';
import { ROUTES } from './routes.js';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Smoke tests — for every route, in every viewport project:
 *   - the page loads (no navigation error)
 *   - no console errors are emitted during initial render
 *   - no same-origin asset requests fail
 *   - the hamburguesa shows on tablet / mobile, hides on desktop
 *
 * The frontend talks to the live backend at `VITE_MVP_API_URL`, so each
 * test installs Playwright route stubs (see `support/mock-backend.js`).
 *
 * Agency-mode routes additionally seed a GHL context in localStorage so
 * SessionProvider doesn't gate the page behind the "Connect GoHighLevel"
 * screen.
 */

const isMobileViewport = (project) => project === 'tablet' || project === 'mobile';

for (const route of ROUTES) {
  test.describe(`smoke: ${route.path}`, () => {
    test('renders without console errors or failed requests', async ({ page }, testInfo) => {
      // Backend stubs.
      if (route.mode === 'agency') {
        await seedAgencyLocalStorage(page);
        await installMockBackend(page, {
          agencies: [SAMPLE_AGENCY],
          ghlSession: agencyConnectedSession(),
        });
      } else {
        await installMockBackend(page, { agencies: [SAMPLE_AGENCY] });
      }

      const consoleErrors = [];
      const failedRequests = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
      page.on('requestfailed', (req) => {
        if (req.failure()?.errorText.match(/aborted|cancelled/i)) return;
        failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
      });

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), 'navigation status').toBeLessThan(400);

      // Wait a beat for the SessionProvider chain (resolveGhlMvpContext +
      // session POST + agency GET) to finish.
      await page.waitForLoadState('networkidle');

      expect(consoleErrors, 'console errors').toEqual([]);
      expect(failedRequests, 'failed requests').toEqual([]);

      await expect(page.locator('.topbar')).toBeVisible();

      const burger = page.locator('.topbar-burger');
      if (isMobileViewport(testInfo.project.name)) {
        await expect(burger).toBeVisible();
      } else {
        await expect(burger).toBeHidden();
      }
    });
  });
}
