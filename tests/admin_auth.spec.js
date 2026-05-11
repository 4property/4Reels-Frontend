import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 5 (frontend_admin_auth_lockstep) — verify the client attaches
 * `Authorization: Bearer <token>` on `/v1/admin/*` once the GHL session
 * resolved with an `agency_token`, and that without a token the provider
 * sits in `needs-context` (no admin call ever leaves with a fake header).
 */

test.describe('admin auth lockstep', () => {
  test('GHL session bearer is forwarded to /v1/admin/agencies/{id}', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    const adminAuthHeaders = [];
    page.on('request', (request) => {
      if (request.url().includes('/v1/admin/')) {
        adminAuthHeaders.push({
          url: request.url(),
          authorization: request.headers().authorization || null,
        });
      }
    });

    await page.goto('/reels');
    await page.waitForLoadState('networkidle');

    // ActiveAgencyProvider fires GET /v1/admin/agencies/{id} once the
    // session is ready. That request must carry the bearer.
    expect(adminAuthHeaders.length, 'at least one admin call').toBeGreaterThan(0);
    for (const entry of adminAuthHeaders) {
      expect(entry.authorization, `Authorization on ${entry.url}`).toMatch(/^Bearer /);
    }
    const expected = `Bearer test-bearer-${SAMPLE_AGENCY_ID}`;
    expect(adminAuthHeaders[0].authorization).toBe(expected);
  });

  test('without an agency_token the provider stays in needs-context', async ({ page }) => {
    // GHL session returns connected:false → no agency_token → no token to
    // attach. The connect screen must render and no admin call goes out
    // with a fake bearer.
    await installMockBackend(page, { agencies: [SAMPLE_AGENCY] });

    const adminAuthHeaders = [];
    page.on('request', (request) => {
      if (request.url().includes('/v1/admin/')) {
        adminAuthHeaders.push(request.headers().authorization || null);
      }
    });

    await page.goto('/reels');
    await page.waitForLoadState('networkidle');

    // Gate screen visible.
    await expect(page.getByRole('heading', { name: 'Connect GoHighLevel' })).toBeVisible();

    // Whatever admin calls were made (likely zero) must not invent a bearer.
    for (const auth of adminAuthHeaders) {
      expect(auth, 'no Authorization header without a token').toBeNull();
    }
  });

  test('admin-direct mode forwards a pasted bearer to /v1/admin/agencies', async ({ page }) => {
    await installMockBackend(page, { agencies: [SAMPLE_AGENCY] });

    const seenAuth = [];
    page.on('request', (request) => {
      if (request.url().includes('/v1/admin/agencies')) {
        seenAuth.push(request.headers().authorization || null);
      }
    });

    // No ?admin=1 here so we land on the connect screen and exercise the
    // local super-admin <details> form. Ensures the paste-bearer path runs
    // setAuthToken before the next admin call leaves.
    await page.goto('/reels');
    await page.waitForLoadState('networkidle');

    await page.getByText('Local super-admin (developers only)').click();
    await page.getByPlaceholder('paste ADMIN_API_TOKEN here').fill('paste-bearer-xyz');
    await page.getByRole('button', { name: 'Connect as super-admin' }).click();

    await page.waitForLoadState('networkidle');

    // The super-admin user sees the Admin tab; navigating there triggers
    // GET /v1/admin/agencies which must carry the pasted bearer.
    const adminCalls = seenAuth.filter(Boolean);
    expect(adminCalls.length, 'admin call after pasting bearer').toBeGreaterThan(0);
    for (const auth of adminCalls) {
      expect(auth).toBe('Bearer paste-bearer-xyz');
    }
  });
});
