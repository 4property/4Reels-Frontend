import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Critical user flows. Lightweight â€” heavy unit-style assertions belong in
 * Vitest, not in an E2E pre-deploy gate. Each test stubs the backend
 * surface it needs through `installMockBackend`.
 */

test.describe('admin (super-admin session)', () => {
  test('lists agencies and opens the configuration drawer', async ({ page }) => {
    await installMockBackend(page, { agencies: [SAMPLE_AGENCY] });
    await page.goto('/v1/admin?admin=1');

    // Page header is the platform Admin console.
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();

    // Agency row from the mock shows up in the table.
    await expect(page.getByText('CKP Estate Agents')).toBeVisible();

    // Opening the drawer.
    await page.getByRole('button', { name: /Configure/ }).first().click();
    await expect(page.locator('.agency-config-drawer')).toBeVisible();
    // Drawer tabs include the four agency-config concerns.
    await expect(page.getByRole('button', { name: 'WordPress sources' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'GHL connection' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reel settings' })).toBeVisible();
  });

  test('hides the agency configuration tabs from the super-admin', async ({ page }) => {
    await installMockBackend(page, { agencies: [SAMPLE_AGENCY] });
    await page.goto('/v1/admin?admin=1');

    // Topbar tabs visible to a super-admin: only Admin.
    const tabs = page.locator('.tabs .tab');
    await expect(tabs).toHaveCount(1);
    await expect(tabs).toHaveText(/Admin/);
  });
});

test.describe('agency session', () => {
  test('renders the Reels dashboard with the empty state', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });

    await page.goto('/reels');

    // The "no reels yet" empty state confirms the live data path is wired.
    await expect(page.getByText(/No reels yet\./)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Reels/ })).toBeVisible();
  });

  test('shows the agency-config tabs but not the Admin tab', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });
    await page.goto('/reels');

    const tabs = page.locator('.tabs .tab');
    // 6 product tabs (Reels, Music, Social, Brand, Defaults, Automation).
    await expect(tabs).toHaveCount(6);
    await expect(tabs.filter({ hasText: 'Admin' })).toHaveCount(0);
  });
});

test.describe('mobile hamburguesa', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('opens the drawer and navigates between pages', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });
    await page.goto('/reels');

    await page.locator('.topbar-burger').click();
    const drawer = page.locator('.mnav-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.mnav-item', { hasText: 'Music' })).toBeVisible();

    await drawer.locator('.mnav-item', { hasText: 'Music' }).click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/\/music$/);
  });

  test('escape closes the drawer', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
    });
    await page.goto('/reels');
    await page.locator('.topbar-burger').click();
    await expect(page.locator('.mnav-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.mnav-panel')).toBeHidden();
  });
});

test.describe('theme', () => {
  // Theme toggle button is desktop-only; on mobile it lives inside the drawer.
  test('flips the data-theme attribute', async ({ page, viewport }) => {
    test.skip(viewport.width <= 900, 'theme toggle lives inside the mobile drawer');
    await installMockBackend(page, { agencies: [SAMPLE_AGENCY] });
    await page.goto('/v1/admin?admin=1');

    const html = page.locator('html');
    const initial = await html.getAttribute('data-theme');
    await page.locator('button[title="Theme"]').first().click();
    const after = await html.getAttribute('data-theme');
    expect(after).not.toBe(initial);
  });
});
