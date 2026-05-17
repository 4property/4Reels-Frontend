import { test, expect } from '@playwright/test';
import {
  agencyConnectedSession,
  installMockBackend,
  SAMPLE_AGENCY,
  SAMPLE_AGENCY_ID,
  seedAgencyLocalStorage,
} from './support/mock-backend.js';

/**
 * Feature 31 — subtitles_tab_cleanup_and_autocaptions_switch (front).
 *
 * Verifies that:
 *   (a) The Subtitles tab exposes an "Auto-generate AI subtitles" toggle
 *       wired to settings['automation.autoCaptions'].
 *   (b) The legacy "Word highlight" / Karaoke card is gone from /defaults.
 *   (c) The `<LivePreview>` panel (the 3:4 frame on the right of the
 *       defaults page) is gone — there's no more live preview surface.
 *   (d) Saving with the toggle off PUTs settings['automation.autoCaptions']
 *       === false to /defaults.
 *   (e) Re-loading the page re-hydrates the toggle to its persisted value.
 *
 * Mirrors back feature 31 which already wires the 11 sub* settings + the
 * autoCaptions flag end-to-end through the ffmpeg subtitle filter graph.
 */

function defaultsRow(autoCaptions) {
  return {
    agency_id: SAMPLE_AGENCY_ID,
    platforms: ['instagram', 'tiktok'],
    intro_enabled: true,
    duration_seconds: 30,
    settings: {
      'automation.autoCaptions': autoCaptions,
    },
  };
}

function trackDefaultsPuts(page) {
  const bodies = [];
  page.on('request', (request) => {
    if (
      request.url().endsWith(`/v1/admin/agencies/${SAMPLE_AGENCY_ID}/defaults`) &&
      request.method() === 'PUT'
    ) {
      try {
        bodies.push(JSON.parse(request.postData() || '{}'));
      } catch {
        bodies.push({});
      }
    }
  });
  return bodies;
}

test.describe('feature 31 — subtitles tab cleanup + autoCaptions switch', () => {
  test('toggle is present, karaoke + live-preview are gone', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      defaultsByAgency: { [SAMPLE_AGENCY_ID]: defaultsRow(true) },
    });

    await page.goto('/defaults');
    await expect(page.getByRole('heading', { name: 'Defaults' })).toBeVisible();

    // Switch to the Subtitles tab.
    await page.getByRole('button', { name: /Subtitles/ }).click();

    // (a) Toggle card is present.
    const card = page.locator('[data-testid="auto-captions-card"]');
    await expect(card).toBeVisible();
    await expect(card.getByText('Auto-generate AI subtitles')).toBeVisible();
    const toggle = card.locator('button.toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // (b) Karaoke / Word highlight card is gone.
    await expect(page.getByText('Word highlight')).toHaveCount(0);
    await expect(page.getByText('Karaoke', { exact: false })).toHaveCount(0);

    // (c) Defaults live-preview surface is gone — the `.defaults-preview-wrap`
    // wrapper used to host the 3:4 frame. After feature 31 it must not
    // render anywhere on /defaults.
    await expect(page.locator('.defaults-preview-wrap')).toHaveCount(0);
    await expect(page.locator('.defaults-preview-frame')).toHaveCount(0);
  });

  test('flipping off + save PUTs automation.autoCaptions=false', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      defaultsByAgency: { [SAMPLE_AGENCY_ID]: defaultsRow(true) },
    });

    const bodies = trackDefaultsPuts(page);

    await page.goto('/defaults');
    await page.getByRole('button', { name: /Subtitles/ }).click();

    const toggle = page
      .locator('[data-testid="auto-captions-card"]')
      .locator('button.toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: /Save defaults/ }).click();

    await expect.poll(() => bodies.length).toBeGreaterThan(0);
    const body = bodies[bodies.length - 1];
    expect(body.settings).toBeDefined();
    expect(body.settings).toHaveProperty(['automation.autoCaptions'], false);
  });

  test('reload re-hydrates the toggle to its persisted value', async ({ page }) => {
    await seedAgencyLocalStorage(page);
    await installMockBackend(page, {
      agencies: [SAMPLE_AGENCY],
      ghlSession: agencyConnectedSession(SAMPLE_AGENCY_ID),
      // Seed it already off — the mock backend's `surfaceDefaultsForGet`
      // preserves arbitrary `settings.*` keys, so the GET on first paint
      // returns `automation.autoCaptions: false`.
      defaultsByAgency: { [SAMPLE_AGENCY_ID]: defaultsRow(false) },
    });

    await page.goto('/defaults');
    await page.getByRole('button', { name: /Subtitles/ }).click();

    const toggle = page
      .locator('[data-testid="auto-captions-card"]')
      .locator('button.toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await page.reload();
    await page.getByRole('button', { name: /Subtitles/ }).click();
    await expect(
      page
        .locator('[data-testid="auto-captions-card"]')
        .locator('button.toggle'),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
