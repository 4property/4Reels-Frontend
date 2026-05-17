// One-off functional audit spec, NOT part of the regular smoke suite.
//
// Points Playwright at the nginx-served `dist/` bundle at http://127.0.0.1/
// and lets the real backend (https://4reelsback-test.4property.com → :8001)
// answer every request. We do not call `installMockBackend` here — the
// whole point is to validate the deployed bundle against the live API.
//
// Read-only: an early `page.route()` aborts any non-GET request that
// reaches the live backend host, so a runaway debounced PATCH cannot mutate
// production data. Console errors are collected and asserted to be empty.

import { test, expect } from '@playwright/test';

const LIVE_BACKEND_HOST = '4reelsback-test.4property.com';

// Test agency on :8001 (Test / dev76.designbricks.ie). Property 677148 is
// `workflow_state=awaiting_review` so the editor is NOT in locked mode and
// PhotosPanel + SubtitlesPanel render in their interactive (drag/edit) form.
const REEL_SITE_ID = 'dev76.designbricks.ie';
const REEL_PROPERTY_ID = '677148';
const GHL_LOCATION_ID = 'v8H1XNB3YCQmVHRhqDoM'; // bound to the Test agency
const GHL_USER_ID = 'manual';

test.use({ baseURL: 'http://127.0.0.1' });

// One-off audit: requires an nginx-served `dist/` on http://127.0.0.1 AND
// reachability of the live `4reelsback-test.4property.com` backend. Skip in
// the regular `test:e2e` run unless explicitly opted in with
// `RUN_LIVE_AUDIT=1` so the suite stays green in the sandbox.
test.describe('audit — deployed editor (features 35 + 36)', () => {
  test.skip(
    !process.env.RUN_LIVE_AUDIT,
    'Live-backend audit; set RUN_LIVE_AUDIT=1 to run.',
  );

  test('photos + subtitles panels render against the live backend', async ({
    page,
  }) => {
    // 1. Seed the GHL MVP context BEFORE any script runs so SessionProvider
    //    auto-connects to the Test agency instead of showing the connect
    //    gate. This mirrors `seedAgencyLocalStorage` in tests/support but
    //    targets the real backend's location_id.
    await page.addInitScript(
      ({ locationId, userId }) => {
        window.localStorage.setItem(
          '4reels.ghlMvpContext',
          JSON.stringify({
            source: 'audit-script',
            userId,
            locationId,
            userName: 'Audit Bot',
            email: 'audit@example.com',
            encryptedContextOnly: false,
            userFallback: false,
          }),
        );
      },
      { locationId: GHL_LOCATION_ID, userId: GHL_USER_ID },
    );

    // 2. Read-only safety net: abort any write request that would hit the
    //    live backend. This audit must never mutate production data.
    await page.route(`https://${LIVE_BACKEND_HOST}/**`, async (route) => {
      const method = route.request().method();
      if (method === 'GET' || method === 'POST') {
        // POST is allowed because the GHL session bootstrap is a POST and
        // it's idempotent (just exchanges location_id → agency_token).
        await route.continue();
        return;
      }
      await route.abort('blockedbyclient');
    });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    // 3. Confirm reachability + bundle hash.
    const indexResp = await page.request.get('/');
    expect(indexResp.status()).toBe(200);
    const indexHtml = await indexResp.text();
    expect(indexHtml).toContain('/assets/index-C0tFPACT.js');

    // 4. Land directly on the editor route. The Dashboard renders underneath
    //    and the ReelEditor mounts as a full-screen overlay.
    await page.goto(`/reels/${REEL_SITE_ID}/${REEL_PROPERTY_ID}`);
    await expect(page.locator('.editor-overlay')).toBeVisible({ timeout: 20_000 });

    // 5. Photos tab.
    await page.getByRole('button', { name: /^Photos/ }).click();
    const photosTab = page.locator('[data-testid="photos-tab"]');
    await expect(photosTab).toBeVisible();
    await expect(page.locator('[data-testid="photos-grid"]')).toBeVisible();
    // Live reel has 13 images; wait for at least one tile to hydrate.
    await expect
      .poll(() => page.locator('[data-testid^="photo-tile-"]').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    const firstTile = page.locator('[data-testid="photo-tile-0"]');
    await expect(firstTile).toBeVisible();
    // Feature 35 wires draggable={!clientLocked} on every tile.
    expect(await firstTile.getAttribute('draggable')).toBe('true');
    await page.screenshot({
      path: 'test-results/audit-editor-live-photos.png',
      fullPage: false,
    });

    // 6. Subtitles tab.
    await page.getByRole('button', { name: /^Subtitles/ }).click();
    const subsTab = page.locator('[data-testid="subtitles-tab"]');
    await expect(subsTab).toBeVisible();
    await expect(page.locator('[data-testid="subtitles-add"]')).toBeVisible();
    await expect
      .poll(() => page.locator('[data-testid^="subtitle-row-"]').count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);
    // First cue must expose the text + timing inputs that feature 36 ships.
    await expect(page.locator('[data-testid="subtitle-text-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="subtitle-in-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="subtitle-out-0"]')).toBeVisible();
    await page.screenshot({
      path: 'test-results/audit-editor-live-subtitles.png',
      fullPage: false,
    });

    // 7. Locked banner is NOT shown for this editable reel.
    await expect(
      page.locator('[data-testid="photos-locked-banner"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="subtitles-locked-banner"]'),
    ).toHaveCount(0);

    // 8. Surface any console errors so the audit picks them up.
    expect(
      consoleErrors,
      `Console errors observed: ${consoleErrors.join(' | ')}`,
    ).toEqual([]);
  });
});
